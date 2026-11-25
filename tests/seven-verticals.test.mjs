import test from 'node:test';
import assert from 'node:assert/strict';
import '../public/mission-control/verticals.js';
import '../public/mission-control/benchmark.js';
import {verticals} from '../lib/event-guests.mjs';
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
