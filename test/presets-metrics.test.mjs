import test from 'node:test';
import assert from 'node:assert/strict';
import {PRESETS,applyPreset,memberName} from '../lib/presets.js';
import {defaults,validateMembers,TeamManager} from '../lib/manager.js';
import {performanceSummary} from '../lib/metrics.js';
test('all six templates yield valid teams, keep id/model but regenerate names from role, and leave source untouched',()=>{
 const original=defaults().map(m=>({...m,provider:'p',model:'m'})), before=structuredClone(original);
 assert.equal(PRESETS.length,6);
 // 命名约定变更：套用模板时名称必须由「职责之大娃/二娃/…」重新派生（旧行为是保留历史名，会导致职责与名称错位）。
 for(const p of PRESETS){const {members}=applyPreset(p.id,original);validateMembers(members);
  assert.equal(members.length,p.roles.length);
  assert.ok(members.every((m,i)=>m.id===original[i].id&&m.provider==='p'&&m.model==='m'),'ID 与模型必须保留');
  assert.ok(members.every((m,i)=>m.name===memberName(p.roles[i].title,i)),'名称必须由职责派生');
  assert.ok(members.every(m=>m.duty.includes('交付')));}
 assert.deepEqual(original,before);assert.throws(()=>applyPreset('missing',original));
});
test('metrics deduplicate usage records and never add cache tokens again to provider total',()=>{
 const manager=new TeamManager({});const member={id:'m',status:'completed',startedAt:100};
 const run={startedAt:100,endedAt:2100,members:[member],messages:[]};manager.owned.set('child',{run,member});
 const event={type:'assistant/message',seq:7,data:{usage:{totalTokens:100,inputTokens:20,outputTokens:10,cacheReadTokens:70}}};
 manager.capture('child',event);manager.capture('child',event);manager.capture('child',{type:'tool/call',seq:8});
 const result=performanceSummary(run);assert.equal(result.reportedTotalTokens,100);assert.equal(result.toolCalls,1);assert.equal(result.wallSeconds,2);assert.equal(member.metrics.cacheReadTokens,70);
 assert.equal(performanceSummary({members:[{status:'completed'}]}).reportedTotalTokens,null);
});
