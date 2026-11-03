import test from 'node:test';
import assert from 'node:assert/strict';
import { TeamManager, defaults, validateMembers } from '../lib/manager.js';
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return {promise,resolve,reject}; };
const tick = () => new Promise(r => setImmediate(r));
function rig(extra = {}, initial = {}) {
  const calls = [], saved = [];
  const adapter = {
    async validateModel(m) { if (m.model === 'missing') throw new Error('model unavailable'); },
    requireParent() {},
    async start(spec) {
      const finish = deferred();
      const call = { ...spec, finish, disposed: 0 };
      calls.push(call);
      return { result: finish.promise, async dispose() { call.disposed++; finish.resolve({stopReason:'aborted',output:[]}); } };
    }, ...extra
  };
  const manager = new TeamManager(adapter, async state => saved.push(state), initial);
  const members = defaults().map(m => ({ ...m, provider:'provider-a', model:'model-a' }));
  return { manager, members, calls, saved, async configure(id='lead') { return manager.configure(id,members,0); } };
}
test('enforces four real slots, unique identity/name and explicit models', () => {
  const m = defaults().map(m => ({...m, provider:'p', model:'m'}));
  assert.throws(() => validateMembers([...m,{...m[0],id:'other'}]), /1 至 4/);
  assert.throws(() => validateMembers([{...m[0],model:''}]), /明确选择模型/);
  assert.throws(() => validateMembers([m[0],{...m[1],name:m[0].name}]), /唯一/);
});
test('configuration is revision checked, persisted, and validates models', async () => {
  const r=rig(); await r.configure();
  assert.equal(r.saved.at(-1).teams.lead.members.length,4);
  await assert.rejects(r.manager.configure('lead',r.members,0),/其他窗口/);
  await assert.rejects(r.manager.configure('lead',[{...r.members[0],model:'missing'}],1),/unavailable/);
  assert.equal(r.manager.snapshot('lead').revision,1);
});
test('concurrent start and network retry create only one run', async () => {
  const r=rig(); await r.configure();
  const [a,b]=await Promise.all([r.manager.start('lead','request-001','task'),r.manager.start('lead','request-001','task')]);
  assert.equal(a.id,b.id); assert.equal(r.manager.snapshot('lead').runs.length,1);
  await tick(); assert.equal(r.calls.length,3); // stage 1 only
  await assert.rejects(r.manager.start('lead','request-002','task'),/已有/);
  await assert.rejects(r.manager.configure('lead',r.members,1),/不能更改/);
  await r.manager.stop('lead');
});
test('stages use fixed identities, explicit routes, and previous results', async () => {
  const r=rig(); await r.configure(); await r.manager.start('lead','request-001','work'); await tick();
  assert.equal(r.calls.length,3);
  for(const call of r.calls) { assert.equal(call.member.model,'model-a'); call.finish.resolve({stopReason:'completed',output:[{type:'text',text:'proof '+call.member.name}]}); }
  await tick(); await tick(); assert.equal(r.calls.length,4);
  assert.match(r.calls[3].prompt,/proof/); assert.equal(r.calls[3].member.id,r.members[0].id);
  const done=r.manager.live.get('lead').done;
  r.calls[3].finish.resolve({stopReason:'completed',output:[{type:'text',text:'final'}]});
  await done; assert.equal(r.manager.snapshot('lead').runs[0].status,'completed');
  assert.equal(r.calls.length,4); assert.equal(r.manager.live.size,0);
});
test('stop cancels workers, pending stages and concurrent repeated stop', async () => {
  const r=rig(); await r.configure(); await r.manager.start('lead','request-001','work'); await tick();
  await Promise.all([r.manager.stop('lead'),r.manager.stop('lead')]);
  const run=r.manager.snapshot('lead').runs[0];
  assert.equal(run.status,'cancelled'); assert.equal(r.calls.length,3);
  assert.ok(run.members.every(m => m.status==='cancelled'));
  assert.ok(r.calls.every(c => c.signal.aborted && c.disposed>=1));
});
test('stopping during slow startup disposes late handles and never starts stage 2', async () => {
  const gate=deferred(), settled=deferred(); let disposed=0;
  const r=rig({async start(){ await gate.promise; return {result:settled.promise,async dispose(){disposed++;settled.resolve({stopReason:'aborted',output:[]});}}; }});
  await r.configure(); await r.manager.start('lead','request-001','work'); await tick();
  const stop=r.manager.stop('lead'); assert.equal(r.manager.snapshot('lead').runs[0].status,'stopping');
  gate.resolve(); await stop; assert.ok(disposed>=3); assert.equal(r.manager.snapshot('lead').runs[0].status,'cancelled');
});
test('one member failure prevents later stages and is never reported as completed', async () => {
  const r=rig(); await r.configure(); await r.manager.start('lead','request-001','work'); await tick();
  const done=r.manager.live.get('lead').done;
  r.calls.forEach((c,i)=>c.finish.resolve({stopReason:i===0?'error':'completed',output:[]}));
  await done; const run=r.manager.snapshot('lead').runs[0];
  assert.equal(run.status,'failed'); assert.equal(r.calls.length,3); assert.equal(run.members[0].status,'interrupted');
});
test('host guard rejects recursive delegation, including configured Lead', async () => {
  const r=rig(); await r.configure(); await r.manager.start('lead','request-001','work'); await tick();
  const id=r.calls[0].member.sessionId;
  for(const name of ['spawn_teammate','subagent','subagent_claude_code','workflow','send_message']) assert.ok(r.manager.guard({agent:{id},name}));
  assert.ok(r.manager.guard({agent:{id:'lead'},name:'workflow'}));
  assert.equal(r.manager.guard({agent:{id:'unrelated'},name:'workflow'}),undefined);
  assert.equal(r.manager.guard({agent:{id},name:'read_file'}),undefined);
  await r.manager.stop('lead');
});
test('chat accepts only assistant text and deduplicates durable events by session and seq', async () => {
  const r=rig(); await r.configure(); await r.manager.start('lead','request-001','work'); await tick();
  const id=r.calls[0].member.sessionId, run=r.manager.live.get('lead').run, count=run.messages.length;
  r.manager.capture(id,{type:'user/message',seq:1,data:{content:[{type:'text',text:'runtime context'}]}});
  r.manager.capture(id,{type:'tool/result',seq:2,data:{content:[{type:'text',text:'tool result'}]}});
  const event={type:'assistant/message',seq:3,data:{message:{content:[{type:'thinking',text:'secret thought'},{type:'text',text:'hello'}]}}};
  r.manager.capture(id,event);r.manager.capture(id,event);
  assert.equal(run.messages.length,count+1);assert.equal(run.messages.at(-1).memberId,r.calls[0].member.id);assert.equal(run.messages.at(-1).text,'hello');
  await r.manager.stop('lead');
});
test('different sessions have isolated rosters and task history', async () => {
  const r=rig();await r.configure('one');await r.configure('two');
  await r.manager.start('one','request-001','one task');await tick();
  assert.equal(r.manager.snapshot('two').runs.length,0);
  assert.ok(!r.manager.view('two').members.some(m=>m.sessionId));
  await r.manager.stop('one');
});
test('restart retains history but marks active work interrupted and never replays it', () => {
  const r=rig({}, {teams:{lead:{revision:1,members:[],runs:[{id:'old',status:'running',members:[{status:'running'},{status:'queued'}],messages:[]}]}}});
  const run=r.manager.snapshot('lead').runs[0];assert.equal(run.status,'interrupted');assert.ok(run.members.every(m=>m.status==='interrupted'));assert.equal(r.calls.length,0);
});
test('persistence failure prevents dispatch entirely', async () => {
  const r=rig();await r.configure();r.manager.persist=async()=>{throw new Error('disk full');};
  await assert.rejects(r.manager.start('lead','request-001','work'),/disk full/);
  assert.equal(r.calls.length,0);assert.equal(r.manager.live.size,0);assert.equal(r.manager.owned.size,0);
});
test('actual model mismatch cancels every member and prevents later stages', async () => {
  const r=rig();await r.configure();await r.manager.start('lead','request-001','work');await tick();
  const runtime=r.manager.live.get('lead');
  r.manager.capture(r.calls[0].member.sessionId,{type:'request/header',data:{header:{config:{provider:'wrong',model:'wrong'}}}});
  await runtime.stopping;
  assert.equal(r.manager.snapshot('lead').runs[0].status,'cancelled');assert.equal(r.calls.length,3);
  assert.equal(r.manager.snapshot('lead').runs[0].members[1].actualModel.provider,'wrong');
});
test('failed cleanup keeps admission closed until an explicit successful stop retry', async () => {
  let rejectCleanup=true;
  const r=rig({async start(){return {result:Promise.resolve({stopReason:'completed',output:[{type:'text',text:'done'}]}),async dispose(){if(rejectCleanup)throw Error('cleanup failed');}};}});
  await r.configure();await r.manager.start('lead','request-001','work');
  await r.manager.live.get('lead').done;
  assert.equal(r.manager.snapshot('lead').runs[0].status,'stopping');
  await assert.rejects(r.manager.start('lead','request-002','another'),/已有/);
  await assert.rejects(r.manager.stop('lead'),/cleanup failed/);
  rejectCleanup=false;await r.manager.stop('lead');
  assert.equal(r.manager.snapshot('lead').runs[0].status,'cancelled');assert.equal(r.manager.live.size,0);
});
