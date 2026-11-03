import { readFile, mkdir, writeFile, rename, appendFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { TeamManager } from './manager.js';
import { installChatBridge, registryTool } from './chat-bridge.js';
import { PRESETS, applyPreset } from './presets.js';
import { performanceSummary } from './metrics.js';

const STATE = new URL('../state/teams.json', import.meta.url);
const LOG = new URL('../state/plugin.log', import.meta.url);
export const inject = ['connection', 'agents', 'subagents', 'tools', 'llm', 'sessions', 'systemPrompt'];
const message = error => error instanceof Error ? error.message : String(error);

export async function apply(ctx) {
  await mkdir(new URL('../state/', import.meta.url), { recursive: true });
  const log = line => { void appendFile(LOG, new Date().toISOString() + ' ' + line + '\n').catch(() => {}); };
  let initial = {};
  try {
    initial = JSON.parse(await readFile(STATE, 'utf8'));
    if (initial.version !== 2 || typeof initial.teams !== 'object' || initial.teams === null) throw new Error('团队状态文件格式不受支持');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }

  const adapter = {
    log,
    requireParent(id) {
      const parent = ctx.agents.get(id);
      if (!parent) throw new Error('当前主会话尚未连接，请先在主会话发送消息或重新打开会话');
      if (parent.session.header.origin === 'subagent') throw new Error('请在主会话中建立团队，子会话不能另建团队');
      return parent;
    },
    async validateModel(member) {
      const models = await ctx.llm.listModels(member.provider);
      if (!models.some(m => m.id === member.model)) throw new Error(`「${member.name}」的模型不可用：${member.provider}/${member.model}`);
      await ctx.llm.resolveCallConfig({ provider: member.provider, model: member.model });
    },
    async start({ leadId, member, prompt, signal }) {
      const parent = adapter.requireParent(leadId);
      const handle = await ctx.subagents.startActivation({
        delivery: 'caller', provider: 'spawn', childId: member.sessionId, label: member.name, signal,
        request: { parent, prompt: [{ type: 'text', text: prompt }],
          maxDepth: (parent.session.header.delegationDepth ?? parent.options.delegationDepth ?? 0) + 1,
          agentOptions: { provider: member.provider, model: member.model }
        }
      });
      return { result: handle.result, dispose: async () => {
        const errors = [];
        const jobs = ctx.get('jobs');
        if (jobs) for (const job of jobs.list(member.sessionId)) if (job.owner === member.sessionId && ['running', 'stopping'].includes(job.status)) {
          try { await jobs.kill(job.id, member.sessionId, '团队任务结束'); } catch (error) { errors.push(error); }
        }
        try { await handle.dispose(); } catch (error) { errors.push(error); }
        if (errors.length) throw new Error(errors.map(message).join('; '));
      } };
    }
  };
  const manager = new TeamManager(adapter, async state => {
    const temp = fileURLToPath(STATE) + '.tmp';
    await writeFile(temp, JSON.stringify(state, null, 2), 'utf8');
    await rename(temp, STATE);
  }, initial);
  ctx.tools.guard(exec => manager.guard(exec));
  ctx.on('session/event', (session, event) => {
    manager.capture(session.id, event);
    if (event.type === 'turn/end' && event.data?.reason?.kind === 'aborted') void manager.stop(session.id, '主会话已停止').catch(e => log(message(e)));
  }, { global: true });
  ctx.on('agent/disposed', ({ agent }) => {
    if (agent && manager.live.has(agent.id)) void manager.stop(agent.id, '主会话已关闭').catch(e => log(message(e)));
  }, { global: true });
  ctx.effect(() => () => manager.dispose(), 'team-console: task ownership');

  function legacy(id) {
    const managed = new Set((manager.teams[id]?.runs || []).flatMap(r => r.members.map(m => m.sessionId)));
    const agents = ctx.agents.list(), descendants = new Set([id]);
    let changed;
    do { changed = false; for (const agent of agents) if (!descendants.has(agent.id) && descendants.has(agent.session.header.parentSession)) { descendants.add(agent.id); changed = true; } } while (changed);
    return agents.filter(a => a.id !== id && descendants.has(a.id) && !managed.has(a.id)).map(a => ({
      id: a.id, status: a.status, provider: a.options.provider || '', model: a.options.model || '',
      parentId: a.session.header.parentSession
    }));
  }
  async function stopLegacy(id) {
    const parent = adapter.requireParent(id);
    const failures = [];
    parent.cancel({ kind: 'user' });
    const rows = legacy(id);
    for (const row of rows) {
      try { ctx.agents.get(row.id)?.cancel({ kind: 'user' }); } catch (e) { failures.push(message(e)); }
    }
    for (const owner of [id, ...rows.map(r => r.id)]) {
      const jobs = ctx.get('jobs');
      if (jobs) for (const job of jobs.list(owner)) if (job.owner === owner && ['running', 'stopping'].includes(job.status)) {
        try { await jobs.kill(job.id, owner, '用户停止历史团队'); } catch (e) { failures.push(message(e)); }
      }
    }
    try { await ctx.subagents.drainChildren(parent, rows.filter(r => r.parentId === id).map(r => r.id)); } catch (e) { failures.push(message(e)); }
    if (failures.length) throw new Error('部分历史任务未确认停止：' + failures.join('; '));
    return { stopped: rows.length, remaining: legacy(id).filter(a => a.status === 'running') };
  }
  const canStart = async id => {
    if (legacy(id).some(a => a.status === 'running')) throw new Error('仍有旧版子任务运行，请先停止历史任务');
  };
  const refreshBridge = installChatBridge(ctx, manager, registryTool, canStart);
  // This exact Fetch route runs behind Harness owner authentication, including Electron's IPC bridge.
  ctx.connection.fetch.register({ path: '/api/team-console-v2', methods: ['POST'], requestBody: 'buffered',
    fetch: async request => {
      try {
        const raw = await request.text();
        if (raw.length > 100000) throw new Error('请求过大');
        const input = JSON.parse(raw);
        const id = input.sessionId;
        let value;
        switch (input.action) {
          case 'state': {
            value = { ...manager.view(id, input.runId), legacy: legacy(id) };
            value.runs=value.runs.map(r=>({...r,metrics:performanceSummary(manager.team(id).runs.find(x=>x.id===r.id))}));
            try {
              const active = new Set(manager.live.get(id)?.run.members.map(m => m.sessionId) || []);
              value.executionHistoryCount = (await ctx.subagents.listChildren(id)).filter(m => !active.has(m.id)).length;
            } catch { value.executionHistoryCount = null; }
            break;
          }
          case 'preset-preview': value=applyPreset(input.presetId,manager.team(id).members); break;
          case 'configure':
            if(input.presetId && input.presetId!=='custom' && !PRESETS.some(p=>p.id===input.presetId))throw Error('未知团队模板');
            value = await manager.configure(id, input.members, input.revision,input.presetId||'custom'); refreshBridge(id); break;
          case 'start':
            manager.team(id);
            if (legacy(id).some(a => a.status === 'running')) throw new Error('仍有旧版子任务运行，请先在成员配置中停止历史任务');
            value = await manager.start(id, input.requestId, input.task, input.timeoutMinutes); break;
          case 'stop': value = await manager.stop(id); break;
          case 'stop-legacy': manager.team(id); value = await stopLegacy(id); break;
          case 'catalog': {
            const groups = [], failures = [];
            for (const provider of ctx.llm.listProviders()) {
              try { groups.push({ id: provider.id, name: provider.name, models: (await ctx.llm.listModels(provider.id)).map(m => ({ id: m.id, name: m.name || m.id })) }); }
              catch (e) { failures.push({ id: provider.id, error: message(e) }); }
            }
            value = { groups, failures, presets:PRESETS }; break;
          }
          default: throw new Error('未知团队操作');
        }
        return Response.json({ ok: true, value }, { headers: { 'cache-control': 'no-store' } });
      } catch (error) {
        log('request failed: ' + message(error));
        return Response.json({ ok: false, error: message(error) }, { status: 400, headers: { 'cache-control': 'no-store' } });
      }
    }
  });
  await manager.save();
  log('v4 host ready: six team presets, reported usage metrics, main-chat bridge');
}
