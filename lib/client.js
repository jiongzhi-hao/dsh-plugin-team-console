window.__ModuleLoader__.load({
  id: '@jiongzhi-hao/dsh-plugin-team-console',
  factory(require) {
    const R = require('react'), h = R.createElement;
    const TAB = '@jiongzhi-hao/dsh-plugin-team-console';
    const labels = { queued: '待执行', running: '执行中', stopping: '停止中', completed: '已完成', failed: '失败', cancelled: '已取消', interrupted: '已中断' };
    const colors = ['#2563eb', '#7c3aed', '#0891b2', '#d97706'];
    const bubbleColors = ['#eff6ff', '#f5f3ff', '#ecfeff', '#fffbeb'];
    const bubbleBorders = ['#bfdbfe', '#ddd6fe', '#a5f3fc', '#fde68a'];
    function memberColors(id, members) {
      const index = Math.max(0, members.map(m => m.id).slice().sort().indexOf(id)) % colors.length;
      return { '--accent': colors[index], '--bubble-bg': bubbleColors[index], '--bubble-border': bubbleBorders[index] };
    }
    let ctx;
    const css = `
.tc2{height:100%;min-height:0;display:flex;flex-direction:column;font-family:inherit;font-size:12px;line-height:1.55;color:var(--dsw-alias-label-primary,#172033);background:var(--dsw-alias-bg-layer-1,transparent)}
.tc2 *{box-sizing:border-box}.tc2 button,.tc2 input,.tc2 select,.tc2 textarea{font:inherit;color:inherit}.tc2 button{cursor:pointer;border:1px solid #cbd5e1;border-radius:7px;background:transparent;padding:5px 9px}.tc2 button:disabled{opacity:.45;cursor:default}.tc2 .primary{background:#2563eb;color:white;border-color:#2563eb}.tc2 .danger{color:#dc2626;border-color:#fca5a5}.tc2 input,.tc2 select,.tc2 textarea{background:var(--dsw-alias-bg-layer-2,#f8fafc);border:1px solid #cbd5e1;border-radius:6px;padding:6px;min-width:0;max-width:100%}.tc2 textarea{resize:vertical;width:100%;min-height:65px}.tc2 input:focus,.tc2 textarea:focus,.tc2 select:focus{outline:2px solid #93c5fd}
.tc2-head{padding:12px;border-bottom:1px solid #cbd5e144;display:flex;align-items:center;gap:8px;flex-wrap:wrap}.tc2-head strong{font-size:14px}.tc2-sub{color:var(--dsw-alias-label-tertiary,#64748b);font-size:11px}.tc2-pill{border-radius:20px;padding:2px 7px;background:#2563eb15;color:#2563eb;font-size:11px}.tc2-settings{flex:none;max-height:48%;overflow:auto;border-bottom:1px solid #cbd5e144;padding:10px 12px}.tc2-row{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin:7px 0}.tc2-grow{flex:1;min-width:0}.tc2-card{border:1px solid #cbd5e155;border-left:3px solid var(--accent);padding:9px;border-radius:8px;margin:9px 0}.tc2-fields{display:grid;grid-template-columns:1fr 1fr;gap:7px}.tc2 label{display:flex;flex-direction:column;gap:3px;font-size:11px}.tc2-wide{grid-column:1/-1}.tc2-note{padding:8px 12px;font-size:11px;background:#2563eb0b}.tc2-error{color:#dc2626;background:#ef444410;white-space:pre-wrap;overflow-wrap:anywhere}.tc2-history{padding:8px 12px;display:flex;gap:6px;border-bottom:1px solid #cbd5e144;flex-wrap:wrap}.tc2-chat{flex:1;min-height:80px;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:14px}.tc2-empty{margin:auto;text-align:center;padding:20px;max-width:300px;color:var(--dsw-alias-label-tertiary,#64748b)}.tc2-message{display:flex;gap:7px;align-items:flex-start}.tc2-avatar{width:25px;height:25px;border-radius:8px;display:grid;place-items:center;color:white;background:var(--accent);flex:none}.tc2-bubble{padding:8px 10px;border:1px solid #cbd5e155;background:var(--dsw-alias-bg-layer-2,#f1f5f9);border-radius:0 9px 9px 9px;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.65}.tc2-message.own{flex-direction:row-reverse}.tc2-message.own .tc2-bubble{background:#2563eb14;border-color:#2563eb33;border-radius:9px 0 9px 9px}.tc2-msgbody{min-width:0;max-width:90%}.tc2-who{font-size:10px;color:var(--dsw-alias-label-tertiary,#64748b);margin-bottom:3px;display:flex;gap:8px}.tc2-event{font-size:10px;text-align:center;color:var(--dsw-alias-label-tertiary,#64748b);white-space:pre-wrap;overflow-wrap:anywhere}.tc2-compose{padding:10px 12px;border-top:1px solid #cbd5e144;flex:none}.tc2-compose textarea{max-height:130px}.tc2-legacy{padding:8px;background:#d9770610;border-radius:7px;margin-top:7px}.tc2-launch{background:transparent;border:0;color:inherit;cursor:pointer;padding:7px 10px;display:flex;align-items:center;gap:7px;font:inherit}
`;
    const layoutCss = `.tc2{overflow:hidden}.tc2-settings{max-height:38%}.tc2-chat{min-height:0}.tc2-history select:first-child{flex:1;min-width:100px;max-width:100%}.tc2-memberStatus{flex:none;max-height:105px;overflow:auto}.tc2-memberStatus .tc2-row{margin:3px 0}.tc2-compose{background:var(--dsw-alias-bg-layer-1,#fff)}.tc2-compose textarea{min-height:58px;max-height:100px}.tc2-head{padding:9px 12px}.tc2-message:not(.own) .tc2-bubble{background:var(--bubble-bg,#eff6ff);border-color:var(--bubble-border,#bfdbfe);color:#1e293b}.tc2-message:not(.own) .tc2-who strong{color:var(--accent)}`;
    async function api(action, sessionId, data = {}, signal) {
      const response = await fetch('/api/team-console-v2', { method: 'POST', credentials: 'same-origin',
        headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...data, action, sessionId }),
        signal: signal || AbortSignal.timeout(20000) });
      if (response.status === 404) throw new Error('新版团队服务尚未启动，请重启 Harness 后打开此面板。');
      let result;
      try { result = await response.json(); } catch { throw new Error('团队服务没有返回有效数据，请检查插件日志。'); }
      if (!response.ok || !result.ok) throw new Error(result.error || '团队操作失败');
      return result.value;
    }
    function service(name) { try { return ctx.get(name); } catch { return undefined; } }
    function Wrapper(props) { return h(TeamPane, { ...props, key: props.sessionId }); }
    function TeamPane({ sessionId }) {
      const [state, setState] = R.useState(null), [draft, setDraft] = R.useState(null);
      const [catalog, setCatalog] = R.useState({ groups: [], failures: [] });
      const [presetId,setPresetId] = R.useState('custom');
      const [error, setError] = R.useState(''), [note, setNote] = R.useState(''), [busy, setBusy] = R.useState('');
      const [settings, setSettings] = R.useState(true), [dirty, setDirty] = R.useState(false);
      const [task, setTask] = R.useState(''), [timeout, setTimeoutValue] = R.useState(15);
      const [selected, setSelected] = R.useState(''), [filter, setFilter] = R.useState('all'), [events, setEvents] = R.useState(false);
      const [statusMode, setStatusMode] = R.useState(() => {
        try { return ['shown', 'hidden'].includes(localStorage.getItem('team-console/status/' + sessionId)) ? localStorage.getItem('team-console/status/' + sessionId) : 'auto'; }
        catch { return 'auto'; }
      });
      const alive = R.useRef(true), retry = R.useRef(null), body = R.useRef(null), pinned = R.useRef(true), refreshRef = R.useRef(null), selectedRef = R.useRef(''), dirtyRef = R.useRef(false), appliedPreset = R.useRef('custom');
      selectedRef.current = selected;
      dirtyRef.current = dirty;
      const activeRun = state?.runs.find(r => r.status === 'running' || r.status === 'stopping');
      const run = state?.runs.find(r => r.id === selected) || state?.runs.at(-1);
      const active = !!activeRun;
      const showStatus = statusMode === 'shown' || (statusMode === 'auto' && ['running', 'stopping'].includes(run?.status));
      const changeStatus = mode => { setStatusMode(mode); try { localStorage.setItem('team-console/status/' + sessionId, mode); } catch {} };
      R.useEffect(() => {
        alive.current = true;
        let timer, running, controller;
        const load = async () => {
          if (running || !alive.current) return;
          running = true; controller = new AbortController();
          const timeoutId = window.setTimeout(() => controller.abort(), 15000);
          try {
            const next = await api('state', sessionId, { runId: selectedRef.current }, controller.signal);
            if (alive.current) { setState(next); if (!dirtyRef.current) {setDraft(next.members);setPresetId(next.presetId||'custom');appliedPreset.current=next.presetId||'custom';} setError(''); }
          } catch (e) { if (alive.current) setError(e.message); }
          finally { running = false; window.clearTimeout(timeoutId); }
        };
        refreshRef.current = load;
        const tick = async () => { if (!document.hidden) await load(); if (alive.current) timer = window.setTimeout(tick, 1500); };
        const visible = () => { if (!document.hidden) void load(); };
        document.addEventListener('visibilitychange', visible);
        void tick();
        void api('catalog', sessionId).then(value => { if (alive.current) setCatalog(value); }).catch(e => { if (alive.current) setError(e.message); });
        return () => { alive.current = false; controller?.abort(); window.clearTimeout(timer); document.removeEventListener('visibilitychange', visible); };
      }, [sessionId]);
      const visibleMessages = (run?.messages || []).filter(m => (events || m.kind !== 'system') && (filter === 'all' || m.memberId === filter || m.kind === 'user'));
      R.useLayoutEffect(() => { if (body.current && pinned.current) body.current.scrollTop = body.current.scrollHeight; }, [run?.id, run?.messages.length, filter, events]);
      const update = (id, patch) => { dirtyRef.current = true; setDraft(rows => rows.map(m => m.id === id ? { ...m, ...patch } : m)); setDirty(true); };
      const act = async (kind, fn) => {
        setBusy(kind); setError(''); setNote('');
        try { await fn(); await refreshRef.current?.(); }
        catch (e) { if (alive.current) setError(e.message); }
        finally { if (alive.current) setBusy(''); }
      };
      const save = () => act('save', async () => {
        const saved = await api('configure', sessionId, { members: draft, revision: state.revision, presetId:appliedPreset.current });
        if (alive.current) { setState(saved); setDraft(saved.members);setPresetId(saved.presetId||'custom'); setDirty(false); setNote('成员与模型已保存到本机，固定团队已启用。'); }
      });
      const start = () => act('start', async () => {
        retry.current ||= crypto.randomUUID();
        const created = await api('start', sessionId, { requestId: retry.current, task, timeoutMinutes: timeout });
        if (alive.current) { setSelected(created.id); setSettings(false); setTask(''); retry.current = null; pinned.current = true; }
      });
      const badge = status => h('span', { className: 'tc2-pill' }, labels[status] || status);
      return h('div', { className: 'tc2' },
        h('div', { className: 'tc2-head' }, h('strong', null, '团队群聊'), h('span', { className: 'tc2-pill' }, '固定 ' + (state?.members.length || 4) + ' 人'),
          state?.executionHistoryCount != null ? h('span', { className: 'tc2-sub', title: '原生顶部的子智能体数字包含历史执行记录，不是当前群成员人数' }, '历史执行 ' + state.executionHistoryCount + ' 条') : null,
          h('span', { className: 'tc2-grow' }), h('button', { onClick: () => setSettings(!settings) }, settings ? '收起配置' : '成员配置'),
          h('button', { className: 'danger', disabled: !active || busy === 'stop', onClick: () => void act('stop', async () => { await api('stop', sessionId); setNote('团队停止完成。'); }) }, busy === 'stop' ? '正在停止…' : '停止全部')),
        error ? h('div', { className: 'tc2-note tc2-error', role: 'alert' }, error) : null,
        note ? h('div', { className: 'tc2-note', role: 'status' }, note) : null,
        settings ? h('section', { className: 'tc2-settings', style: { maxHeight: run ? '34%' : '48%' } },
          h('div',{className:'tc2-row'},h('label',{className:'tc2-grow'},'团队模板',h('select',{'aria-label':'团队模板',value:presetId,disabled:active||!!busy,onChange:e=>{setPresetId(e.target.value);dirtyRef.current=true;setDirty(true);}},
            h('option',{value:'custom'},'自定义'),...(catalog.presets||[]).map(p=>h('option',{key:p.id,value:p.id},p.name+' · '+p.roles.length+'人')))),
            h('button',{disabled:active||!!busy||presetId==='custom',onClick:()=>void act('preset',async()=>{const preview=await api('preset-preview',sessionId,{presetId});dirtyRef.current=true;setDraft(preview.members);appliedPreset.current=presetId;setTimeoutValue(preview.preset.timeoutMinutes);setDirty(true);setNote('已生成模板草稿，保留对应成员的名字和模型。检查后点击“保存团队”生效。');})},'套用到草稿')),
          h('div',{className:'tc2-sub'},(catalog.presets||[]).find(p=>p.id===presetId)?.description||'模板调整角色、阶段与交付规范；不会自动更换模型或启动任务。'),
          h('div', { className: 'tc2-sub' }, '每人明确选择模型和负责部分。同阶段并行，后续阶段接收前序结果。最多 4 人，成员无法扩员。'),
          ...(draft || []).map((m, i) => h('div', { className: 'tc2-card', key: m.id, style: memberColors(m.id, draft) },
            h('div', { className: 'tc2-fields' },
              h('label', null, '名称', h('input', { value: m.name, maxLength: 24, disabled: active, onChange: e => update(m.id, { name: e.target.value }) })),
              h('label', null, '执行阶段', h('select', { value: m.stage, disabled: active, onChange: e => update(m.id, { stage: Number(e.target.value) }) }, ...[1, 2, 3, 4].map(n => h('option', { key: n, value: n }, '阶段 ' + n)))),
              h('label', { className: 'tc2-wide' }, '执行模型（必选）', h('select', { value: m.provider && m.model ? JSON.stringify([m.provider, m.model]) : '', disabled: active,
                onChange: e => { const [provider, model] = e.target.value ? JSON.parse(e.target.value) : ['', '']; update(m.id, { provider, model }); } },
                h('option', { value: '' }, '请选择模型'),
                ...catalog.groups.map(g => h('optgroup', { key: g.id, label: g.name || g.id }, ...g.models.map(model => h('option', { key: model.id, value: JSON.stringify([g.id, model.id]) }, model.name + ' · ' + g.id)))),
                m.provider && !catalog.groups.some(g => g.id === m.provider && g.models.some(x => x.id === m.model)) ? h('option', { value: JSON.stringify([m.provider, m.model]) }, m.provider + '/' + m.model + '（需重新验证）') : null)),
              h('label', { className: 'tc2-wide' }, '负责部分 / 可修改的文件范围', h('textarea', { value: m.duty, maxLength: 2000, disabled: active, onChange: e => update(m.id, { duty: e.target.value }) }))),
            h('div', { className: 'tc2-row' }, h('span', { className: 'tc2-sub tc2-grow' }, '固定成员 ' + (i + 1)),
              h('button', { disabled: active || draft.length <= 1, onClick: () => { setDraft(draft.filter(x => x.id !== m.id)); setDirty(true); } }, '删除配置')))),
          h('div', { className: 'tc2-row' },
            h('button', { disabled: active || !draft || draft.length >= 4, onClick: () => { setDraft([...draft, { id: crypto.randomUUID(), name: '成员' + (draft.length + 1), duty: '', provider: '', model: '', stage: 1 }]); setDirty(true); } }, '添加成员'),
            h('span', { className: 'tc2-grow' }),
            h('button', { disabled: active || !state || !!busy, onClick: () => { setDraft(state.members); setDirty(false); } }, '恢复已保存'),
            h('button', { className: 'primary', disabled: active || !state || !!busy, onClick: save }, busy === 'save' ? '验证模型并保存…' : '保存团队')),
          catalog.failures.length ? h('div', { className: 'tc2-error' }, '部分供应商目录读取失败：' + catalog.failures.map(f => f.id + ': ' + f.error).join('；')) : null,
          state?.legacy?.length ? h('div', { className: 'tc2-legacy' }, h('strong', null, '历史任务 · ' + state.legacy.length + ' 个驻留会话'),
            h('p', null, '这些是旧版留下的子会话，不属于上面的固定成员。停止历史任务会同时停止主会话及其旧子任务。'),
            h('button', { className: 'danger', disabled: active || !!busy, onClick: () => void act('legacy', async () => { const result = await api('stop-legacy', sessionId); setNote('历史任务清理完成：' + result.stopped + ' 个会话。'); }) }, '停止历史任务')) : null) : null,
        h('div', { className: 'tc2-history' },
          h('select', { 'aria-label': '任务记录', value: run?.id || '', onChange: e => { setSelected(e.target.value); setFilter('all'); pinned.current = true; } },
            !(state?.runs.length) ? h('option', { value: '' }, '暂无任务记录') : null,
            ...[...(state?.runs || [])].reverse().map(r => h('option', { key: r.id, value: r.id }, (labels[r.status] || r.status) + ' · ' + r.task.slice(0, 24)))),
          h('select', { 'aria-label': '筛选成员发言', value: filter, onChange: e => setFilter(e.target.value) }, h('option', { value: 'all' }, '全部成员'), ...(run?.members || []).map(m => h('option', { key: m.id, value: m.id }, m.name))),
          h('button', { onClick: () => setEvents(!events) }, events ? '隐藏进度' : '显示进度'),
          run ? h('button', { 'aria-expanded': showStatus, onClick: () => changeStatus(showStatus ? 'hidden' : 'shown') }, showStatus ? '收起成员状态' : '显示成员状态') : null),
        run && showStatus ? h('div', { className: 'tc2-note tc2-memberStatus' },
          h('div', { className: 'tc2-row' }, h('strong', { className: 'tc2-grow' }, '成员执行状态'),
            h('button', { 'aria-label': '关闭成员状态', title: '隐藏此摘要，可用“显示成员状态”恢复', onClick: () => changeStatus('hidden') }, '×')),
          ...run.members.map(m => h('div', { key: m.id, className: 'tc2-row' }, h('strong', null, m.name), badge(m.status),
          h('span', { className: 'tc2-sub', title: m.error || '' }, m.actualModel ? '已核对 ' + m.actualModel.provider + '/' + m.actualModel.model : '指定 ' + m.provider + '/' + m.model),
          m.error ? h('span', { className: 'tc2-error' }, m.error) : null))) : null,
        run?.metrics ? h('div',{className:'tc2-sub',style:{padding:'4px 12px'},title:'仅统计成员上报用量，不含主助手，不等于计费金额；旧记录未回填'},
          '耗时 '+(run.metrics.wallSeconds==null?'进行中':run.metrics.wallSeconds+'秒')+' · 成员 Token '+(run.metrics.reportedTotalTokens==null?'未记录':run.metrics.reportedTotalTokens.toLocaleString())+' · 已上报 '+run.metrics.reportedMembers+'/'+run.metrics.memberCount+' 人') : null,
        h('div', { className: 'tc2-chat', ref: body, onScroll: e => { const el = e.currentTarget; pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60; } },
          !visibleMessages.length ? h('div', { className: 'tc2-empty' }, state ? '先保存每名成员的模型与分工，再在下方发起团队任务。这里按任务显示成员发言，系统提示默认折叠。' : '正在连接团队服务…') : null,
          ...visibleMessages.map(m => {
            if (m.kind === 'system') return h('div', { key: m.id, className: 'tc2-event' }, m.speaker + ' · ' + m.text);
            const member = run.members.find(x => x.id === m.memberId);
            return h('div', { key: m.id, className: 'tc2-message' + (m.kind === 'user' ? ' own' : ''), style: memberColors(m.memberId, run.members) },
              h('span', { className: 'tc2-avatar' }, m.speaker.slice(0, 1)),
              h('div', { className: 'tc2-msgbody' }, h('div', { className: 'tc2-who' }, h('strong', null, m.speaker),
                h('span', { title: member ? member.provider + '/' + member.model : '' }, new Date(m.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))),
                h('div', { className: 'tc2-bubble' }, m.text)));
          })),
        h('div', { className: 'tc2-compose' },
          h('textarea', { 'aria-label': '团队任务', placeholder: '描述团队任务与交付要求。也可以在主聊天中说“让固定团队共同讨论”。', value: task, maxLength: 20000,
            onChange: e => { setTask(e.target.value); retry.current = null; } }),
          h('div', { className: 'tc2-row' }, h('span', { className: 'tc2-sub tc2-grow' }, dirty ? '配置有未保存修改' : active ? '当前任务结束或停止后可开始新任务' : '主聊天可直接请求固定团队共同讨论'),
            h('select', { 'aria-label': '任务超时', value: timeout, disabled: active, onChange: e => setTimeoutValue(Number(e.target.value)) }, ...[1, 5, 15, 30, 60].map(n => h('option', { value: n, key: n }, n + ' 分钟超时'))),
            h('button', { className: 'primary', disabled: active || !!busy || dirty || !task.trim() || !state?.revision, onClick: start }, busy === 'start' ? '正在启动…' : '开始任务'))));
    }
    function Launcher() { return h('button', { className: 'tc2-launch', title: '打开固定团队群聊', onClick: () => service('sidebarRight')?.openTab('team-console') }, '◉', '团队'); }
    function apply(context) {
      ctx = context;
      if (!document.querySelector('style[data-team-console-v2]')) { const style = document.createElement('style'); style.dataset.teamConsoleV2 = ''; style.textContent = css + layoutCss; document.head.appendChild(style); context.effect(() => () => style.remove(), 'team-console: styles'); }
      context.inject(['sidebarRightTabs'], scope => scope.effect(() => scope.sidebarRightTabs.register({ id: TAB, kind: 'team-console', multiple: false, priority: 'extension',
        title: () => '团队群聊', guide: [{ id: 'team-console', order: 20, title: () => '团队群聊', description: () => '固定成员 · 明确模型 · 分阶段执行' }] }), 'team-console: tab'));
      for (const [name, component] of [['sidebar.right.pane.tab', Wrapper], ['sidebar.right.pane.tab.title', () => '团队群聊']]) {
        context.slots.inject(name, () => context.slots.register({ name, key: TAB, inject: sessionId => ({ sessionId }) }, component));
      }
      context.slots.inject('sidebar.footer.action', () => context.slots.register({ name: 'sidebar.footer.action', id: 'team-console-launcher', order: 10, inject: () => ({}) }, Launcher));
    }
    return { apply, inject: ['slots'] };
  }
});

