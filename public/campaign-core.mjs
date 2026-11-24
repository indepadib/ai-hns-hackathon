// Pure, shared operational rules. No automatic RH decision.
export const targets=Object.freeze({shortlist:150,invited:60,present:50});
export const batchLimit=20;
export function canInvite(row,ops){
 return !!row&&row.status==='selected'&&!row.invitedAt&&typeof row.email==='string'&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)&&!!ops&&ops.mailStatus==='not_sent'&&['invited','not_prepared'].includes(ops.passStatus)&&ops.rsvp!=='declined'&&!ops.checkedInAt;
}
export function campaignMetrics(records,statuses){
 const out={total:records.length,shortlist:0,selected:0,accepted:0,legacyInvited:0,ready:0,confirmed:0,declined:0,present:0,review:0,pending:0};
 for(const row of records){
  const op=statuses.get(row.id);
  if(['review','interview','selected','invited','confirmed'].includes(row.status))out.shortlist++;
  if(row.status==='selected')out.selected++;
  if(op?.mailStatus==='accepted')out.accepted++;
  else if(row.invitedAt||['invited','confirmed'].includes(row.status))out.legacyInvited++;
  if(canInvite(row,op))out.ready++;
  if(op?.rsvp==='confirmed')out.confirmed++;
  if(op?.rsvp==='declined')out.declined++;
  if(op?.checkedInAt)out.present++;
  if(['review_required','sending'].includes(op?.mailStatus))out.review++;
  if((op?.mailStatus==='accepted'||row.invitedAt||['invited','confirmed'].includes(row.status))&&(!op?.rsvp||op.rsvp==='pending'))out.pending++;
 }
 return out;
}
export function batchCandidates(records,statuses){return records.filter(row=>canInvite(row,statuses.get(row.id)))}
export async function sendBatch(ids,send,onProgress,shouldStop=()=>false){
 if(!Array.isArray(ids)||!ids.length||ids.length>batchLimit||new Set(ids).size!==ids.length)throw Error('Lot invalide');
 const results=[];
 for(const id of ids){
  if(shouldStop())break;
  try{
   const response=await send(id);
   const state=response?.mailStatus==='accepted'&&response.recruitmentUpdated===true&&!response.duplicatePrevented?'accepted':'review';
   results.push({id,state});onProgress?.(results.at(-1),results.length);
   if(state!=='accepted')break;
  }catch{results.push({id,state:'review'});onProgress?.(results.at(-1),results.length);break}
 }
 return {results,remaining:ids.length-results.length};
}
