import { PRESETS } from './presets.js';
/** Model-facing view of the fixed roster, never the native descendant catalog. */
export function registryTool(definition) {
  const properties = {}, required = [];
  for (const [name, spec] of Object.entries(definition.parameters)) {
    const {required: isRequired, ...schema} = spec;
    properties[name] = schema;
    if (isRequired) required.push(name);
  }
  return { ...definition, parameters: {type:'object',properties,required,additionalProperties:false},
    output: {...definition.output, schema:{}} };
}
export function roster(manager, leadId) {
  const team = manager.team(leadId), run = manager.live.get(leadId)?.run;
  return {
    fixedMemberCount: team.members.length, coordinatorIsSeparate: true,
    explanation: '固定成员人数不含当前主助手。原生子会话计数包含历史执行，不是群成员人数。',
    members: team.members.map(m => ({ id: m.id, name: m.name, duty: m.duty, stage: m.stage,
      provider: m.provider, model: m.model, status: run?.members.find(x => x.id === m.id)?.status || 'idle' }))
  };
}
export function bridgeDefinitions(manager, leadId, canStart = async () => {}) {
  const output = { schema: { type: 'json' }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] };
  const assertLead = exec => { if (exec.agent?.id !== leadId || !manager.teams[leadId]?.revision) throw new Error('仅已配置固定团队的主会话可以派发团队任务'); };
  return [
    { name: 'list_agents', description: '查询当前固定团队的真实名单、人数、模型和状态。只返回配置的成员，不返回历史子会话。主助手单独计数。',
      parameters: { scope: { type: 'string', description: '兼容参数；任何 scope 都返回当前固定团队，而非历史子会话。' } }, output,
      async execute(_args, exec) { assertLead(exec); return roster(manager, leadId); } },
    { name: 'team_discuss', description: '让已配置的固定成员真正共同讨论或执行用户任务；自动按阶段执行并等待所有成员结果，不创建额外成员。用户要求共同讨论、团队协作时调用此工具，禁止用主助手自问自答冒充成员发言。',
      parameters: { task: { type: 'string', required: true, description: '本次用户任务及交付要求，包含足够上下文。' } }, output, timeoutMs: 21 * 60000,
      async execute(args, exec) {
        assertLead(exec);
        if (exec.signal?.aborted) throw new Error('本轮已停止');
        await canStart(leadId);
        if (exec.signal?.aborted) throw new Error('本轮已停止');
        // One accepted discussion per Lead turn: model retries and parallel calls cannot duplicate work.
        const turn = exec.agent.session.snapshotEvents().filter(e => e.type === 'turn/start').at(-1)?.data?.turn;
        if (!Number.isSafeInteger(turn)) throw new Error('无法确认当前轮次，未启动任务');
        const timeout = PRESETS.find(p=>p.id===manager.team(leadId).presetId)?.timeoutMinutes||15;
        const run = await manager.start(leadId, `chat-turn-${turn}`, args.task, timeout);
        const runtime = manager.live.get(leadId);
        const cancel = () => { void manager.stop(leadId, '主聊天停止了团队任务').catch(e => manager.adapter.log?.(e.message)); };
        exec.signal?.addEventListener('abort', cancel, { once: true });
        try {
          if (exec.signal?.aborted) cancel();
          if (runtime?.run.id === run.id) await runtime.done;
          if (runtime?.stopping) await runtime.stopping;
          const final = manager.team(leadId).runs.find(r => r.id === run.id);
          return { runId: final.id, status: final.status, fixedMemberCount: final.members.length,
            members: final.members.map(m => ({ id: m.id, name: m.name, status: m.status, model: m.actualModel || {provider:m.provider,model:m.model}, output: m.output, error: m.error })),
            instruction: '仅引用以上成员实际返回的内容。未完成或未发言必须如实说明，不可编造讨论。' };
        } finally { exec.signal?.removeEventListener('abort', cancel); }
      } }
  ];
}
export function installChatBridge(ctx, manager, defineTool, canStart) {
  const installed = new Map();
  function install(agent) {
    if (installed.has(agent) || !manager.teams[agent.id]?.revision) return;
    const disposers = [];
    try {
      for (const definition of bridgeDefinitions(manager, agent.id, canStart)) disposers.push(agent.ctx.tools.register(defineTool(definition)));
      disposers.push(agent.ctx.systemPrompt.context({ name: 'team-console:fixed-roster', required: true,
        order: agent.ctx.systemPrompt.getContextOrder('TEAM_IDENTITY'),
        text: () => `本会话使用固定团队，以下数据是当前成员名单的权威来源：${JSON.stringify(roster(manager, agent.id))}\n历史 subagent/catalog、旧对话中的“16人”和原生顶部子会话数量都不是当前群人数。需要查询时使用 list_agents。用户要求“共同讨论”“你们讨论”“团队协作”时必须调用 team_discuss，把用户任务及必要上下文交给它并等待真实结果。不要调用 subagent/workflow/spawn_teammate/send_message，也不需要用户去面板手动唤醒。team_discuss 的四名配置成员不包含你这个主助手。不得以多个视角自问自答冒充团队发言。` }));
      installed.set(agent, () => { for (const d of disposers.reverse()) d(); });
    } catch (error) { for (const d of disposers.reverse()) d(); throw error; }
  }
  for (const agent of ctx.agents.list()) install(agent);
  ctx.on('agent/created', ({agent}) => install(agent), {global:true});
  ctx.on('agent/disposed', ({agent}) => { installed.get(agent)?.(); installed.delete(agent); }, {global:true});
  ctx.effect(() => () => { for (const dispose of installed.values()) dispose(); installed.clear(); }, 'team-console: main chat tools');
  return id => { const agent = ctx.agents.get(id); if (agent) install(agent); };
}
