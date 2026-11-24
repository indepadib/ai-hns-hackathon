import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import '../public/mission-control/retail-data.js';
import '../public/mission-control/benchmark.js';
import '../public/mission-control/starter-kit.js';
test('All four Python starters run against actual synthetic benchmark inputs and reproduce public baselines',()=>{
 const data=globalThis.HNSRetailData.generate();
 for(const id of Object.keys(globalThis.HNSBenchmark.descriptions)){
  const kit=globalThis.HNSStarterKit.build(id),d=globalThis.HNSBenchmark.dataset(id,data);
  const dir=mkdtempSync(join(tmpdir(),'hns-starter-'));
  try{
   writeFileSync(join(dir,'starter.py'),kit.script);
   writeFileSync(join(dir,kit.input),globalThis.HNSRetailData.csv(d.rows.map(r=>r.sample)));
   execFileSync('python3',['starter.py'],{cwd:dir,timeout:20000});
   const values=globalThis.HNSBenchmark.align(d,globalThis.HNSBenchmark.parse(readFileSync(join(dir,kit.output),'utf8')));
   assert.deepEqual(values,d.rows.map(r=>r.baseline),id);
   assert.match(kit.readme,/pas un modèle IA/);
  }finally{rmSync(dir,{recursive:true,force:true})}
 }
});
test('Unknown challenges cannot generate a starter',()=>assert.throws(()=>globalThis.HNSStarterKit.build('unknown')));
