import test from 'node:test';
import assert from 'node:assert/strict';
import { TeamManager, defaults } from '../lib/manager.js';
import { roster, bridgeDefinitions } from '../lib/chat-bridge.js';
function rig() {
  let calls=0;
  const manager=new TeamManager({validateModel:async()=>{},requireParent:()=>{},start:async()=>{calls++;return {result:Promise.resolve({stopReason:'completed',output:[{type:'text',text:'real answer'}]}),dispose:async()=>{}};}});
  const agent={id:'lead',session:{snapshotEvents:()=>[{type:'turn/start',data:{turn:3}}]}};
  return {manager,agent,get calls(){return calls;},async ready(){await manager.configure('lead',defaults().map(m=>({...m,provider:'p',model:'m'})),0);}};
}
test('fixed roster excludes fifteen historic executions and counts main assistant separately',async()=>{
  const r=rig();await r.ready();r.manager.team('lead').runs.push(...Array.from({length:15},(_,i)=>({id:'old'+i,status:'completed',members:[{id:'old'+i}]})));
  const result=await bridgeDefinitions(r.manager,'lead')[0].execute({scope:'descendants'},{agent:r.agent});
  assert.equal(result.fixedMemberCount,4);assert.equal(result.members.length,4);assert.equal(result.coordinatorIsSeparate,true);assert.ok(result.members.every(m=>m.status==='idle'));
});
test('main-chat discussion waits for four real results and retries cannot create another run',async()=>{
  const r=rig();await r.ready();const tool=bridgeDefinitions(r.manager,'lead')[1];
  const result=await tool.execute({task:'discuss'},{agent:r.agent,signal:new AbortController().signal});
  assert.equal(result.status,'completed');assert.equal(r.calls,4);assert.ok(result.members.every(m=>m.output==='real answer'));
  await tool.execute({task:'retry'},{agent:r.agent,signal:new AbortController().signal});assert.equal(r.calls,4);
});
test('workers cannot call the Lead discussion tool and cancelled calls cannot start work',async()=>{
  const r=rig();await r.ready();const tool=bridgeDefinitions(r.manager,'lead')[1];
  await assert.rejects(tool.execute({task:'work'},{agent:{id:'worker'}}),/仅已配置/);
  const c=new AbortController();c.abort();await assert.rejects(tool.execute({task:'work'},{agent:r.agent,signal:c.signal}),/停止/);assert.equal(r.calls,0);
});
