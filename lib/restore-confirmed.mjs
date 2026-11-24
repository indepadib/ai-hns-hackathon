import {createHmac,createHash} from 'node:crypto';
export const operation='restore-legacy-confirmed-2026-11-24-v1';
export const marker='rh-migration-'+operation;
const start=Date.parse('2026-11-24T17:44:00Z'),end=Date.parse('2026-11-24T18:00:00Z');
export function isRestorable(row){
 if(!row||row.status!=='interview'||row.invitedAt||row.confirmedAt||row.checkedInAt||!Array.isArray(row.history))return false;
 if(row.history.some(e=>['invited','invitation_sent','mail_sent'].includes(e.action)||e.action==='status'&&e.value==='invited'))return false;
 const last=[...row.history].reverse().find(e=>e.action==='status'||e.action==='status-correction'||e.action==='status-restoration'||e.action==='invited');
 const at=Date.parse(last?.at||'');
 return last?.action==='status-correction'&&last.from==='confirmed'&&last.to==='interview'&&last.reason==='legacy-preselection'&&at>=start&&at<=end;
}
export function safePass(pass,mail){return !mail&&(!pass||pass.status==='invited'&&!pass.checkedInAt&&!pass.respondedAt&&!['confirmed','declined'].includes(pass.rsvp))}
export function restoredRecord(row,at){return {...row,status:'selected',updatedAt:at,history:[...row.history,{at,action:'status-restoration',from:'interview',to:'selected',reason:operation}]}}
export async function restoreBatch({rh,db,secret,ids,now=()=>new Date().toISOString()}){
 const result={restored:0,protected:0,conflicts:0,errors:0};
 for(let i=0;i<ids.length;i+=10)await Promise.all(ids.slice(i,i+10).map(async id=>{
  try{
   const current=await rh.getWithMetadata(id,{type:'json'}),row=current?.data;
   if(!current?.etag||row?.id!==id||!isRestorable(row)){result.protected++;return}
   const code=createHmac('sha256',secret).update('invitation-v1:'+id).digest('hex').slice(0,24).toUpperCase(),passId=createHash('sha256').update(code).digest('hex').slice(0,32);
   const [pass,mail]=await Promise.all([db.get('participant-'+passId,{type:'json'}),db.get('invitation-mail-'+passId,{type:'json'})]);
   if(!safePass(pass,mail)){result.protected++;return}
   const write=await rh.setJSON(id,restoredRecord(row,now()),{onlyIfMatch:current.etag});if(write?.modified)result.restored++;else result.conflicts++;
  }catch{result.errors++}
 }));
 return result;
}
export async function runRestoration({rh,db,secret,now=()=>new Date().toISOString()}){
 const lock=await db.setJSON(marker,{state:'running',startedAt:now()},{onlyIfNew:true});
 if(!lock?.modified)return {state:'already_started'};
 try{
  const {blobs}=await rh.list();if(blobs.length>700)throw Error('Capacity exceeded');
  const ids=blobs.map(b=>b.key).filter(k=>/^[a-f0-9]{64}$/.test(k));let candidates=[];
  for(let i=0;i<ids.length;i+=20){const chunk=ids.slice(i,i+20);const rows=await Promise.all(chunk.map(id=>rh.get(id,{type:'json'})));candidates.push(...chunk.filter((id,j)=>rows[j]?.id===id&&isRestorable(rows[j])))}
  const result=await restoreBatch({rh,db,secret,ids:candidates,now});
  const report={state:result.errors||result.conflicts?'partial':'completed',matched:candidates.length,...result,finishedAt:now()};
  await db.setJSON(marker,report);return report;
 }catch{const report={state:'review_required',finishedAt:now()};await db.setJSON(marker,report);return report}
}
