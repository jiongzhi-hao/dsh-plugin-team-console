export function performanceSummary(run) {
 const members=run.members||[], reported=members.filter(m=>m.metrics?.reportedEvents>0);
 return {wallSeconds:run.endedAt?Math.round((run.endedAt-run.startedAt)/100)/10:null,
  reportedMembers:reported.length,memberCount:members.length,
  reportedTotalTokens:reported.length?reported.reduce((n,m)=>n+m.metrics.totalTokens,0):null,
  toolCalls:members.reduce((n,m)=>n+(m.metrics?.toolCalls||0),0),
  usageComplete:reported.length===members.filter(m=>m.startedAt).length&&reported.length>0,
  completedMembers:members.filter(m=>m.status==='completed').length};
}
