import test from 'node:test';
import assert from 'node:assert/strict';
import {resetEligibility,resetRecord} from '../lib/rh-preselection.mjs';
const row={id:'a'.repeat(64),status:'confirmed',notes:[{text:'existing note'}],history:[{action:'status',value:'confirmed'}],cvFile:{filename:'example.pdf'}};
test('Legacy confirmed without delivery or RSVP moves to interview while retaining dossier',()=>{
 assert.equal(resetEligibility(row,null,null),true);
 assert.equal(resetEligibility(row,{status:'invited',rsvp:'pending'},null),true);
 const next=resetRecord(row,'2026-11-24T17:00:00Z');
 assert.equal(next.status,'interview');assert.deepEqual(next.notes,row.notes);assert.deepEqual(next.cvFile,row.cvFile);assert.deepEqual(next.history[0],row.history[0]);assert.equal(next.history.at(-1).from,'confirmed');
 assert.equal(resetEligibility(next,null,null),false);
});
test('Never reset actual invitations, responses, presence, revoked passes or uncertain sends',()=>{
 for(const r of [{...row,invitedAt:'now'},{...row,confirmedAt:'now'},{...row,history:[{action:'invited'}]},{...row,history:[{action:'status',value:'invited'}]},{...row,status:'invited'}])assert.equal(resetEligibility(r,null,null),false);
 for(const p of [{status:'active'},{status:'revoked'},{status:'invited',rsvp:'confirmed'},{status:'invited',rsvp:'declined'},{status:'invited',respondedAt:'now'}])assert.equal(resetEligibility(row,p,null),false);
 for(const state of ['accepted','review_required','sending'])assert.equal(resetEligibility(row,null,{state}),false);
});
test('Selected dossiers reset only with explicit inclusion',()=>{
 const selected={...row,status:'selected'};assert.equal(resetEligibility(selected,null,null),false);assert.equal(resetEligibility(selected,null,null,{includeSelected:true}),true);
});
