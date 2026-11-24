import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,unlink} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import {qrPayload} from '../lib/invitation-email.mjs';

test('Unified RH to participant flow with synthetic stores and a mocked provider', async()=>{
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
  const call=async(body,token='',host='ai.hns.ma')=>{const r=await handler(new Request('https://'+host+'/api/mission',{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify(body)}));return {status:r.status,data:await r.json()}};
  const admin=env.HNS_ADMIN_TOKEN;
  assert.equal((await call({action:'rh-pass-preview',candidateId})).status,403);
  assert.equal((await call({action:'rh-pass-preview',candidateId},admin)).status,409);
  await rh.setJSON(candidateId,{...(await rh.get(candidateId)),status:'selected'});
  assert.equal((await call({action:'rh-pass-preview',candidateId},admin,'preview.example.invalid')).status,403);
  const first=await call({action:'rh-pass-preview',candidateId},admin);assert.equal(first.status,200,JSON.stringify(first.data));assert.match(first.data.qrCode,/^data:image\/png;base64,/);assert.equal(first.data.sendEnabled,false);
  const code=first.data.code,id=createHash('sha256').update(code).digest('hex').slice(0,32);
  assert.equal((await call({action:'rh-pass-preview',candidateId},admin)).data.code,code);
  assert.equal((await call({action:'rh-pass-send',candidateId,confirm:true},admin)).status,403);
  assert.equal((await call({action:'participant-login',code})).status,401);
  globalThis.fetch=async(url,options)=>{assert.equal(url,'https://api.resend.com/emails');assert.equal(JSON.parse(options.body).to[0],email);sent++;return new Response(JSON.stringify({id:'mock-mail-id'}),{status:200})};
  process.env.HNS_INVITATION_SEND_ENABLED='true';
  assert.equal((await call({action:'rh-pass-send',candidateId,confirm:false},admin)).status,403);
  const mail=await call({action:'rh-pass-send',candidateId,confirm:true},admin);assert.equal(mail.status,200,JSON.stringify(mail.data));assert.equal(mail.data.mailStatus,'accepted');assert.equal(mail.data.recruitmentUpdated,true);assert.equal(sent,1);
  assert.equal((await rh.get(candidateId)).status,'invited');assert.equal((await rh.get(candidateId)).notes[0].text,'Preserve me');
  await call({action:'rh-pass-send',candidateId,confirm:true},admin);assert.equal(sent,1);
  assert.equal((await call({action:'invitation-rsvp',code,response:'confirmed'})).status,200);
  const status=await call({action:'recruitment-status',candidateIds:[candidateId]},admin);assert.equal(status.status,200);assert.equal(status.data.entries[0].rsvp,'confirmed');assert.equal(status.data.entries[0].mailStatus,'accepted');
  const staff=await call({action:'rh-login',password:env.HNS_RH_KEY});assert.equal(staff.status,200);const token=staff.data.token;
  const qr=qrPayload(id,env.HNS_SESSION_SECRET);const scan=await call({action:'scan-invitation',code:qr},token);assert.equal(scan.status,200,JSON.stringify(scan.data));
  assert.equal((await call({action:'scan-invitation',code:qr},token)).data.alreadyPresent,true);
  assert.equal((await call({action:'participant-login',code})).status,200);
  const after=await call({action:'recruitment-status',candidateIds:[candidateId]},admin);assert.ok(after.data.entries[0].checkedInAt);
  assert.equal((await call({action:'revoke',id},token)).status,200);assert.equal((await call({action:'participant-login',code})).status,401);
 }finally{globalThis.fetch=oldFetch;for(const [k,v] of Object.entries(oldEnv)){if(v===undefined)delete process.env[k];else process.env[k]=v}await Promise.all([unlink(mock).catch(()=>{}),unlink(entry).catch(()=>{})]);}
});
