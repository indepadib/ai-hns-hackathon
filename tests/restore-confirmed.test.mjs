import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,createHash} from 'node:crypto';
import {isRestorable,safePass,restoredRecord,runRestoration,operation,marker} from '../lib/restore-confirmed.mjs';
const at='2026-11-24T17:51:00Z',secret='x'.repeat(40);
const make=(id,from='confirmed')=>({id,status:'interview',history:[{action:'status',value:from},{at,action:'status-correction',from,to:'interview',reason:'legacy-preselection'}],notes:[{text:'keep'}],cvFile:{filename:'file.pdf'}});
function mock(){const m=new Map();let rev=0;return {get:async k=>structuredClone(m.get(k)?.data),list:async()=>({blobs:[...m.keys()].map(key=>({key}))}),getWithMetadata:async k=>structuredClone(m.get(k)),setJSON:async(k,data,o={})=>{const old=m.get(k);if(o.onlyIfNew&&old||o.onlyIfMatch&&o.onlyIfMatch!==old?.etag)return{modified:false};m.set(k,{data:structuredClone(data),etag:String(++rev)});return{modified:true}}}}
test('Restore only confirmed cohort, not ordinary interviews or previous selected records',()=>{
 const row=make('a'.repeat(64));assert.equal(isRestorable(row),true);assert.equal(isRestorable(make('b'.repeat(64),'selected')),false);
 assert.equal(isRestorable({...row,history:[{action:'status',value:'interview'}]}),false);
 assert.equal(isRestorable({...row,history:[...row.history,{action:'status',value:'interview'}]}),false);
 assert.equal(isRestorable({...row,history:[...row.history,{action:'note'}]}),true);
 assert.equal(isRestorable({...row,invitedAt:at}),false);
 const updated=restoredRecord(row,at);assert.equal(updated.status,'selected');assert.deepEqual(updated.notes,row.notes);assert.deepEqual(updated.cvFile,row.cvFile);assert.equal(updated.history.at(-1).reason,operation);assert.equal(isRestorable(updated),false);
});
test('Actual RSVP, mail and check-in remain protected',()=>{assert.equal(safePass(null,null),true);assert.equal(safePass({status:'invited',rsvp:'pending'},null),true);assert.equal(safePass({status:'active'},null),false);assert.equal(safePass({status:'invited',rsvp:'confirmed'},null),false);assert.equal(safePass(null,{state:'sending'}),false)});
test('One-time migration restores only matched safe dossiers and reports aggregate totals',async()=>{
 const rh=mock(),db=mock(),a='a'.repeat(64),b='b'.repeat(64),c='c'.repeat(64);
 await rh.setJSON(a,make(a));await rh.setJSON(b,make(b,'selected'));await rh.setJSON(c,make(c));
 const code=createHmac('sha256',secret).update('invitation-v1:'+c).digest('hex').slice(0,24).toUpperCase(),passId=createHash('sha256').update(code).digest('hex').slice(0,32);
 await db.setJSON('invitation-mail-'+passId,{state:'accepted'});
 const report=await runRestoration({rh,db,secret,now:()=>at});assert.equal(report.state,'completed');assert.equal(report.matched,2);assert.equal(report.restored,1);assert.equal(report.protected,1);
 assert.equal((await rh.get(a)).status,'selected');assert.equal((await rh.get(b)).status,'interview');assert.equal((await rh.get(c)).status,'interview');assert.equal((await db.get(marker)).restored,1);
 assert.equal((await runRestoration({rh,db,secret})).state,'already_started');
});
