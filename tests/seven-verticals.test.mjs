import test from 'node:test';
import assert from 'node:assert/strict';
import '../public/mission-control/verticals.js';
import '../public/mission-control/benchmark.js';
import {parseGuestPlan,verticals,guestAction,validateGuest} from '../lib/event-guests.mjs';
const api=globalThis.HNSVerticals;
test('Seven verticals, eight challenges per vertical, stable legacy industry identifiers',()=>{
 assert.deepEqual(api.verticals.map(v=>v.id),['property','media','retail','life','logistics','chari','group']);
 assert.deepEqual(Object.keys(verticals),api.verticals.map(v=>v.id));
 const ids=[...api.retailIds,...api.topics.map(t=>t.id)];
 assert.equal(ids.length,56);assert.equal(new Set(ids).size,56);
 for(const v of api.verticals)assert.equal(ids.filter(id=>api.verticalFor(id)===v.id).length,8,v.id);
 for(const id of ['line-failure','quality-defect','yield-loss'])assert.equal(api.verticalFor(id),'life');
});
test('All 52 sector challenge packs contain independent training and evaluation records and benchmark supports them',()=>{
 for(const t of api.topics){
  const p=api.generate(t.id),train=p.tables[t.table+'_train'],evaluation=p.tables[t.table+'_evaluation'];
  assert.equal(train.length,1800,t.id);assert.equal(evaluation.length,600,t.id);
  assert.ok(train.every(x=>['yes','no'].includes(x.target)),t.id);
  assert.ok(evaluation.every(x=>!Object.hasOwn(x,'target')),t.id);
  assert.equal(new Set([...train,...evaluation].map(x=>x.sample_id)).size,2400,t.id);
  assert.ok(t.features.length===3&&t.features.every(f=>f[1]<f[3]&&f[3]<f[2]),t.id);
  assert.equal(globalThis.HNSBenchmark.dataset(t.id).rows.length,600,t.id);
  assert.equal(api.stress(t.id).length,4,t.id);
 }
});
test('Guest roster is sanitized, does not invent addresses and is admin only',async()=>{
 const raw=JSON.stringify({roster:[['Synthetic','chari','Demo','business','11:15','Test'],['Support','','Demo','mentor','','Test'],['Legacy','industry','Demo','mentor','','Test'],['Invalid','unknown','Demo','business','','Test']],gaps:[['Group','Data lead','','Review']]});
 const p=parseGuestPlan(raw);
 assert.deepEqual(p.roster.map(x=>x.vertical),['chari','group','life']);
 assert.ok(p.roster.every(x=>!Object.hasOwn(x,'email')));
 assert.equal(p.gaps.length,1);
 assert.equal(parseGuestPlan('invalid').roster.length,0);
 assert.equal(validateGuest({name:'Demo',email:'demo@example.invalid',role:'business',vertical:'industry'}).vertical,'life');
 const db={list:async()=>({blobs:[]})};
 const x=await guestAction({action:'guest-list',body:{},auth:{role:'admin'},db,guestPlan:raw,canSend:false});
 assert.equal(x.value.plan.roster.length,3);
 const denied=await guestAction({action:'guest-list',body:{},auth:{role:'rh'},db,guestPlan:raw});
 assert.equal(denied.status,403);
 assert.equal(Object.hasOwn(denied.value,'plan'),false);
});
