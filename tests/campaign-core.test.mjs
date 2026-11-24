import test from 'node:test';
import assert from 'node:assert/strict';
import {canInvite,campaignMetrics,batchCandidates,sendBatch,batchLimit} from '../public/campaign-core.mjs';
const row=(id,status='selected',extra={})=>({id,status,email:id+'@example.invalid',...extra});
const op=(extra={})=>({mailStatus:'not_sent',passStatus:'not_prepared',rsvp:'pending',...extra});
test('Only manually selected, known safe, uninvited candidates are eligible',()=>{
 assert.ok(canInvite(row('a'),op()));
 for(const status of ['received','review','interview','invited','confirmed','rejected'])assert.equal(canInvite(row('a',status),op()),false);
 assert.equal(canInvite(row('a','selected',{invitedAt:'yesterday'}),op()),false);
 assert.equal(canInvite(row('a'),undefined),false);
 for(const mailStatus of ['sending','review_required','accepted'])assert.equal(canInvite(row('a'),op({mailStatus})),false);
 assert.equal(canInvite(row('a'),op({rsvp:'declined'})),false);
 assert.equal(canInvite(row('a'),op({passStatus:'revoked'})),false);
 assert.equal(canInvite(row('a'),op({checkedInAt:'now'})),false);
});
test('Campaign counters do not conflate historical RH decisions with Gmail acceptance',()=>{
 const records=[row('a'),row('b','invited'),row('c','confirmed'),row('d','received'),row('e')];
 const statuses=new Map([['a',op()],['b',op({mailStatus:'accepted',rsvp:'confirmed',checkedInAt:'today'})],['c',op()],['e',op({mailStatus:'review_required'})]]);
 const m=campaignMetrics(records,statuses);assert.equal(m.total,5);assert.equal(m.ready,1);assert.equal(m.accepted,1);assert.equal(m.legacyInvited,1);assert.equal(m.confirmed,1);assert.equal(m.present,1);assert.equal(m.review,1);assert.deepEqual(batchCandidates(records,statuses).map(r=>r.id),['a']);
});
test('Batch delivery stops on uncertain outcome, never automatically retries',async()=>{
 const calls=[];const result=await sendBatch(['a','b','c'],async id=>{calls.push(id);if(id==='b')throw Error('network');return {mailStatus:'accepted',recruitmentUpdated:true}});
 assert.deepEqual(calls,['a','b']);assert.equal(result.remaining,1);assert.equal(result.results[1].state,'review');
});
test('Batch stops on duplicate or unsuccessful RH reconciliation',async()=>{
 for(const response of [{mailStatus:'accepted',duplicatePrevented:true,recruitmentUpdated:true},{mailStatus:'accepted',recruitmentUpdated:false},{mailStatus:'sending'}]){
  let count=0;const result=await sendBatch(['a','b'],async()=>{count++;return response});assert.equal(count,1);assert.equal(result.remaining,1);assert.equal(result.results[0].state,'review');
 }
 await assert.rejects(sendBatch(Array(batchLimit+1).fill('x'),async()=>{}),/Lot invalide/);
});
test('Operator stop prevents the next message',async()=>{
 let stop=false;const result=await sendBatch(['a','b'],async()=>({mailStatus:'accepted',recruitmentUpdated:true}),()=>{stop=true},()=>stop);
 assert.equal(result.remaining,1);
});
