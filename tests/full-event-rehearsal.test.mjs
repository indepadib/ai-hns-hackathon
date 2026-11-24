import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,unlink} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import {qrPayload} from '../lib/invitation-email.mjs';
import '../public/mission-control/retail-data.js';
import '../public/mission-control/benchmark.js';

test('Full event rehearsal: shared team, conflicting saves, signed benchmark, confidential jury and restitution', async()=>{
 const suffix=randomUUID(),dir=new URL('../netlify/functions/',import.meta.url);
 const mock=new URL('test-blobs-'+suffix+'.mjs',dir),entry=new URL('test-mission-'+suffix+'.mjs',dir);
 const env={CONTEXT:'production',HNS_UNIFIED_PRODUCTION:'true',HNS_SESSION_SECRET:'S'.repeat(40),HNS_ADMIN_KEY:'admin-test-password',HNS_RH_KEY:'rh-test-password',HNS_JURY_KEY:'jury-test-password',HNS_ADMIN_TOKEN:'R'.repeat(42),HNS_INVITATION_SEND_ENABLED:'false',HNS_RESEND_API_KEY:'synthetic-key',HNS_INVITATION_FROM:'H&S <test@example.invalid>'};
 const oldEnv=Object.fromEntries(Object.keys(env).map(k=>[k,process.env[k]])),oldFetch=globalThis.fetch;
 let sent=0;
 try{
  Object.assign(process.env,env);
  await writeFile(mock,`const stores=new Map();let rev=0;
export function getStore({name}){if(!stores.has(name))stores.set(name,new Map());const m=stores.get(name);return {
 list:async({prefix=''}={})=>({blobs:[...m.keys()].filter(k=>k.startsWith(prefix)).map(key=>({key}))}),
 get:async(k)=>m.has(k)?structuredClone(m.get(k).data):null,
 getWithMetadata:async(k)=>m.has(k)?structuredClone(m.get(k)):null,
 setJSON:async(k,data,opt={})=>{const old=m.get(k);if(opt.onlyIfNew&&old||opt.onlyIfMatch&&old?.etag!==opt.onlyIfMatch)return{modified:false};const etag=String(++rev);m.set(k,{data:structuredClone(data),etag});return{modified:true,etag}}};}`);
  const source=await readFile(new URL('mission.mjs',dir),'utf8');
  assert.match(source,/from '@netlify\/blobs'/);
  await writeFile(entry,source.replace("from '@netlify/blobs'","from './test-blobs-"+suffix+".mjs'"));
  const {default:handler}=await import(entry.href),{getStore}=await import(mock.href);
  const rh=getStore({name:'hns-ai-recruitment-2026'}),email='synthetic@example.invalid',candidateId=createHash('sha256').update(email).digest('hex');
  await rh.setJSON(candidateId,{id:candidateId,name:'TEST SYNTHETIC',email,status:'review',notes:[{text:'Preserve me'}],history:[]});
  const call=async(body,token='',host='ai.hns.ma')=>{const r=await handler(new Request('https://'+host+'/api/mission',{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify(body)}),{site:{id:'33dae2ce-086d-4470-b6fe-248f3ca49b70'},deploy:{context:'production'}});return {status:r.status,data:await r.json()}};
  const admin=env.HNS_ADMIN_TOKEN;
  const org=await call({action:'admin-login',password:env.HNS_ADMIN_KEY}),staff=await call({action:'rh-login',password:env.HNS_RH_KEY}),jury=await call({action:'jury-login',password:env.HNS_JURY_KEY});
  assert.equal(org.status,200);assert.equal(staff.status,200);assert.equal(jury.status,200);
  const ot=org.data.token,rt=staff.data.token,jt=jury.data.token;
  async function stage(stage,opensAt){assert.equal((await call({action:'schedule-update',stage,opensAt},ot)).status,200)}
  await stage('matching',0);await stage('challenge',Date.now()+3600000);await stage('problem',Date.now()+3600000);
  async function candidate(name){
   const email=name.toLowerCase().replace(/\s+/g,'-')+'@example.invalid',candidateId=createHash('sha256').update(email).digest('hex');
   await rh.setJSON(candidateId,{id:candidateId,name,email,status:'selected',history:[]});
   const pass=await call({action:'rh-pass-preview',candidateId},admin);assert.equal(pass.status,200,JSON.stringify(pass.data));
   const code=pass.data.code,id=createHash('sha256').update(code).digest('hex').slice(0,32);
   assert.equal((await call({action:'participant-login',code})).status,401);
   assert.equal((await call({action:'scan-invitation',code:qrPayload(id,env.HNS_SESSION_SECRET)},rt)).status,200);
   const login=await call({action:'participant-login',code});assert.equal(login.status,200);return {id,token:login.data.token};
  }
  const a=await candidate('TEST ALPHA'),b=await candidate('TEST BETA'),c=await candidate('TEST GAMMA');
  // A fresh solo tab and simultaneous reciprocal choices.
  const solo=await call({action:'load'},a.token);assert.equal(solo.data.teamId,null);
  const matches=await Promise.all([call({action:'matching-choice',target:b.id},a.token),call({action:'matching-choice',target:a.id},b.token)]);
  assert.ok(matches.every(x=>x.status===200),JSON.stringify(matches));assert.equal(matches.filter(x=>x.data.mutual).length,1);
  const [la,lb]=await Promise.all([call({action:'load'},a.token),call({action:'load'},b.token)]);
  const teamId=la.data.teamId;assert.ok(teamId);assert.equal(lb.data.teamId,teamId);assert.equal(la.data.version,0);assert.equal(lb.data.version,0);
  for(const id of ['challenge','problem','solution','build','redteam','pitch','submission'])await stage(id,0);
  assert.equal((await call({action:'matching-list'},c.token)).data.closed,true);
  assert.equal((await call({action:'matching-choice',target:a.id},c.token)).data.code,'MATCHING_CLOSED');
  const workspace={challenge:{id:'availability'},problem:{summary:'Synthetic stock availability problem'},solution:{summary:'A deterministic baseline with validation'},submission:{result:'Demonstrated predictions',limits:'Synthetic data only'}};
  assert.equal((await call({action:'save',workspace,version:0,teamId:null,requestId:randomUUID()},a.token)).data.code,'TEAM_CHANGED');
  const writes=await Promise.all([call({action:'save',workspace,version:0,teamId,requestId:randomUUID()},a.token),call({action:'save',workspace:{...workspace,solution:{summary:'Second concurrent edit'}},version:0,teamId,requestId:randomUUID()},b.token)]);
  assert.deepEqual(writes.map(w=>w.status).sort(),[200,409]);
  const current=await call({action:'load'},b.token);assert.equal(current.data.version,1);
  assert.equal((await call({action:'save',workspace,version:1,teamId,requestId:randomUUID()},b.token)).status,200);
  const dataset=globalThis.HNSBenchmark.dataset('availability',globalThis.HNSRetailData.generate());
  const bench=await call({action:'benchmark-evaluate',challenge:'availability',teamId,values:dataset.rows.map(r=>r.baseline)},a.token);assert.equal(bench.status,200,JSON.stringify(bench.data));assert.ok(bench.data.signature);
  const complete={...workspace,tests:{benchmark:bench.data}};
  assert.equal((await call({action:'save',workspace:complete,version:2,teamId,requestId:randomUUID()},a.token)).status,200);
  const submit=await call({action:'submit',version:3,teamId},b.token);assert.equal(submit.status,200,JSON.stringify(submit.data));
  assert.equal((await call({action:'load'},a.token)).data.receipt,submit.data.receipt);
  assert.equal((await call({action:'save',workspace,version:3,teamId,requestId:randomUUID()},a.token)).status,409);
  assert.equal((await call({action:'jury-holdout-inputs',id:teamId},a.token)).status,403);
  const list=await call({action:'jury-list'},jt);assert.deepEqual(list.data.participants.map(x=>x.id),[teamId]);
  const inputs=await call({action:'jury-holdout-inputs',id:teamId},jt);assert.equal(inputs.status,200,JSON.stringify(inputs.data));assert.ok(inputs.data.inputs.length);assert.ok(inputs.data.inputs.every(x=>!Object.hasOwn(x,'target')));
  const values=inputs.data.inputs.map(x=>x.previous_stockout?'yes':'no');
  const holdout=await call({action:'jury-holdout-score',id:teamId,values,inputDigest:inputs.data.inputDigest},jt);assert.equal(holdout.status,200,JSON.stringify(holdout.data));assert.equal(holdout.data.report.private,true);
  assert.equal((await call({action:'jury-holdout-score',id:teamId,values,inputDigest:inputs.data.inputDigest},jt)).data.code,'HOLDOUT_LOCKED');
  const score=await call({action:'jury-score',id:teamId,scores:{problem:80,design:70,build:90,test:60,demo:100},expectedScoredAt:null},jt);assert.equal(score.status,200);assert.equal(score.data.score.total,79.5);
  for(const [p,dimension] of [[a,'data'],[b,'engineering']])assert.equal((await call({action:'talent-observe',id:p.id,version:0,observation:{dimension,phase:'build',observer:'Synthetic observer',fact:'Demonstrated a concrete contribution in the prototype.'}},ot)).status,200);
  const final=await call({action:'final-results'},ot);assert.equal(final.status,200,JSON.stringify(final.data));assert.equal(final.data.metrics.present,3);assert.equal(final.data.metrics.projects,2);assert.equal(final.data.metrics.submitted,1);assert.equal(final.data.metrics.scored,1);assert.equal(final.data.metrics.holdout,1);assert.equal(final.data.metrics.observed,2);assert.equal(final.data.projects[0].id,teamId);assert.equal(final.data.projects[0].members.length,2);assert.equal(final.data.people.find(p=>p.id===a.id).dimensions[0],'data');assert.equal(final.data.people.find(p=>p.id===b.id).dimensions[0],'engineering');assert.ok(final.data.people.every(p=>!Object.hasOwn(p,'rank')));
  assert.equal(sent,0);
 }finally{globalThis.fetch=oldFetch;for(const [k,v] of Object.entries(oldEnv)){if(v===undefined)delete process.env[k];else process.env[k]=v}await Promise.all([unlink(mock).catch(()=>{}),unlink(entry).catch(()=>{})]);}
});
