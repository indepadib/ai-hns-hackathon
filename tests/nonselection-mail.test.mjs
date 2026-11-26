import test from 'node:test';import assert from 'node:assert/strict';import {nonselectionAction,nonselectionMail,nonselectionBlock} from '../lib/nonselection-mail.mjs';
function fixture(initial={status:'rejected',email:'candidate@example.invalid',name:'Candidate fictif'},ops={pass:null,invitation:null}){
 const id='a'.repeat(64);let row=structuredClone(initial),version=1,sends=0;
 const rh={get:async k=>k===id?structuredClone(row):null,getWithMetadata:async k=>k===id?{data:structuredClone(row),etag:String(version)}:null,setJSON:async(k,next,opts)=>{if(k!==id||opts.onlyIfMatch!==String(version))return{modified:false};row=structuredClone(next);version++;return{modified:true,etag:String(version)}}};
 const call=(action,body={},enabled=true,deliver=async()=>({id:'fake-'+ ++sends}))=>nonselectionAction({action,body:{candidateId:id,...body},rh,operations:async()=>ops,enabled,deliver,now:()=>new Date('2026-11-24T21:00:00Z')});
 return{id,call,row:()=>structuredClone(row),sends:()=>sends};
}
test('Nonselection communication requires human rejection and protects every other status and existing pass',async()=>{
 for(const status of ['received','review','interview','selected','invited','confirmed']){const f=fixture({status,email:'test@example.invalid',name:'Test'});assert.equal((await f.call('rh-nonselection-preview')).status,409);assert.equal((await f.call('rh-nonselection-send',{confirm:true})).status,409);assert.equal(f.sends(),0)}
 for(const ops of [{pass:{status:'invited'},invitation:null},{pass:null,invitation:{state:'review_required'}}]){const f=fixture(undefined,ops);assert.equal((await f.call('rh-nonselection-send',{confirm:true})).status,409);assert.equal(f.sends(),0)}
 assert.ok(nonselectionBlock({status:'rejected',email:'test@example.invalid',invitedAt:'2026-11-23'},{pass:null,invitation:null}));
});
test('Candidate preview is side effect free and actual delivery is explicit and exactly once under concurrency',async()=>{
 const f=fixture(),p=await f.call('rh-nonselection-preview');assert.equal(p.status,200);assert.match(p.value.mail.text,/deuxième hackathon/);assert.match(p.value.mail.text,/première édition/);assert.equal(f.sends(),0);assert.equal(f.row().nonselection,undefined);
 assert.equal((await f.call('rh-nonselection-send',{confirm:false})).status,403);assert.equal((await f.call('rh-nonselection-send',{confirm:true},false)).status,403);
 const results=await Promise.all([f.call('rh-nonselection-send',{confirm:true}),f.call('rh-nonselection-send',{confirm:true})]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);assert.equal(f.sends(),1);assert.equal(f.row().status,'rejected');assert.equal(f.row().nonselection.state,'accepted');
 const state=await f.call('rh-nonselection-status',{ids:[f.id]});assert.equal(state.value.entries[0].state,'accepted');assert.equal((await f.call('rh-nonselection-send',{confirm:true})).status,409);
});
test('Unknown provider result cannot be retried and status remains non-retained',async()=>{
 const f=fixture();assert.equal((await f.call('rh-nonselection-send',{confirm:true},true,async()=>{throw Error('timeout')})).status,503);assert.equal(f.row().nonselection.state,'review_required');assert.equal(f.row().status,'rejected');assert.equal((await f.call('rh-nonselection-send',{confirm:true})).status,409);
 assert.ok(!nonselectionMail({name:'<script>'}).html.includes('<script>'));
});

test('Bulk nonselection protects selected, invited, confirmed, existing passes and stale decisions; marks only outstanding dossiers without sending',async()=>{
 for(const status of ['received','review','interview']){
  const f=fixture({status,email:'candidate@example.invalid',name:'Fictif',notes:[{text:'Conserver'}]});
  const items=[{id:f.id,status}];
  assert.equal((await f.call('rh-nonselection-bulk-preview',{items})).value.results[0].state,'eligible');
  assert.equal(f.row().status,status);
  assert.equal((await f.call('rh-nonselection-bulk-mark',{items})).status,403);
  assert.equal((await f.call('rh-nonselection-bulk-mark',{items,confirm:true})).value.results[0].state,'marked');
  assert.equal(f.row().status,'rejected');assert.equal(f.row().notes[0].text,'Conserver');assert.equal(f.sends(),0);
  assert.equal((await f.call('rh-nonselection-bulk-mark',{items,confirm:true})).value.results[0].state,'protected');
 }
 for(const status of ['selected','invited','confirmed','rejected']){
  const f=fixture({status,email:'candidate@example.invalid'});
  assert.equal((await f.call('rh-nonselection-bulk-mark',{items:[{id:f.id,status:'received'}],confirm:true})).value.results[0].state,'protected');
  assert.equal(f.row().status,status);assert.equal(f.sends(),0);
 }
 for(const ops of [{pass:{status:'invited'},invitation:null},{pass:null,invitation:{state:'accepted'}}]){
  const f=fixture({status:'interview',email:'candidate@example.invalid'},ops);
  assert.equal((await f.call('rh-nonselection-bulk-mark',{items:[{id:f.id,status:'interview'}],confirm:true})).value.results[0].state,'protected');assert.equal(f.row().status,'interview');
 }
});
