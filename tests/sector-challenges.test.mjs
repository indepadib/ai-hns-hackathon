import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {execFileSync} from 'node:child_process';
import '../public/mission-control/verticals.js';import '../public/mission-control/retail-data.js';import '../public/mission-control/benchmark.js';import '../public/mission-control/starter-kit.js';import {privateDataset,inputPayload,evaluatePrivate} from '../lib/private-benchmark.mjs';
const V=globalThis.HNSVerticals,B=globalThis.HNSBenchmark,S=globalThis.HNSStarterKit,R=globalThis.HNSRetailData;
test('Six verticals and 19 unique proposed subjects; each new subject has distinct schema and reproducible temporal split',()=>{
 assert.equal(V.verticals.length,6);assert.equal(V.topics.length+V.retailIds.length,19);assert.equal(new Set(V.topics.map(t=>t.table)).size,15);
 for(const v of V.verticals)assert.equal(v.id==='retail'?V.retailIds.length:V.topics.filter(t=>t.vertical===v.id).length,v.id==='retail'?4:3);
 for(const t of V.topics){
  const p=V.generate(t.id),q=V.generate(t.id),names=Object.keys(p.tables),train=p.tables[names[0]],evalRows=p.tables[names[1]];
  assert.equal(V.verticalFor(t.id),t.vertical);assert.equal(train.length,1800);assert.equal(evalRows.length,600);assert.ok(train.at(-1).observation_date<evalRows[0].observation_date);
  assert.deepEqual(p.rows,q.rows);assert.equal(new Set([...train,...evalRows].map(x=>x.sample_id)).size,2400);
  assert.ok(evalRows.every(x=>!Object.hasOwn(x,'target')));assert.ok(train.some(x=>x.target==='yes')&&train.some(x=>x.target==='no'));
  assert.ok(train.every(x=>t.features.every(([k,min,max])=>x[k]>=min&&x[k]<=max)));
  assert.equal(B.dataset(t.id,null).rows.length,600);assert.equal(V.stress(t.id).length,4);
 }
});
test('Every sector starter actually runs Python and matches its baseline, with a distinct private holdout',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'hns-sector-'));try{
 for(const t of V.topics){
  const d=B.dataset(t.id,null),kit=S.build(t.id);
  await writeFile(join(dir,'starter.py'),kit.script);await writeFile(join(dir,kit.input),R.csv(d.rows.map(x=>x.sample)));
  execFileSync('python3',['starter.py'],{cwd:dir,stdio:'pipe'});
  const values=B.align(d,B.parse(await readFile(join(dir,kit.output),'utf8')));assert.deepEqual(values,d.rows.map(x=>x.baseline));
  assert.equal(B.report(d,values).metrics.count,600);
  const hidden=privateDataset(t.id,null,'ab'.repeat(32)),payload=inputPayload(hidden);
  assert.equal(payload.inputs.length,600);assert.ok(payload.inputs.every(x=>!Object.hasOwn(x,'target')&&!Object.hasOwn(x,'baseline')));
  assert.notDeepEqual(hidden.rows[0].sample,d.rows[0].sample);
  assert.notDeepEqual(hidden.rows.map(x=>x.target),d.rows.map(x=>x.target));
  assert.equal(evaluatePrivate(hidden,hidden.rows.map(x=>({sample_id:x.sample.sample_id,prediction:x.baseline}))).metrics.count,600);
 }
 }finally{await rm(dir,{recursive:true,force:true})}
});
