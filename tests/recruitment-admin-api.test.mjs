import {test} from 'node:test';import {strict as assert} from 'node:assert';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {pathToFileURL} from 'node:url';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hns-rh-test-'));const fdir=path.resolve('netlify/functions');
for(const x of ['_utils.mjs','triage.mjs','_cv.mjs'])fs.copyFileSync(path.resolve('lib/recruitment',x),path.join(dir,x));
const store=String.raw`const db=new Map();let rev=0;export function getStore(){return {list:async()=>({blobs:[...db.keys()].map(key=>({key}))}),get:async(k)=>db.get(k)?.value??null,getMetadata:async(k)=>db.has(k)?{etag:db.get(k).etag}:null,getWithMetadata:async(k)=>db.has(k)?{data:structuredClone(db.get(k).value),etag:db.get(k).etag}:null,setJSON:async(k,value,opt={})=>{const current=db.get(k);if(opt.onlyIfNew&&current)return {modified:false};if(opt.onlyIfMatch&&current?.etag!==opt.onlyIfMatch)return {modified:false};db.set(k,{value,etag:'rev-'+(++rev)});return {modified:true}}}}`;
fs.writeFileSync(path.join(dir,'fakeblobs.mjs'),store);
let src=fs.readFileSync(path.join(fdir,'candidates-admin.mjs'),'utf8').replace("from '@netlify/blobs'","from './fakeblobs.mjs'").replaceAll("../../lib/recruitment/","./");fs.writeFileSync(path.join(dir,'admin.mjs'),src);
const {default:rawHandler}=await import(pathToFileURL(path.join(dir,'admin.mjs')));
const liveContext={site:{id:'33dae2ce-086d-4470-b6fe-248f3ca49b70'},deploy:{context:'production'}};
const handler=(req,context=liveContext)=>rawHandler(req,context);
process.env.CONTEXT='production';process.env.HNS_ADMIN_TOKEN='A'.repeat(42);
function req(method,body,authorized=true){return new Request('https://ai.hns.ma/.netlify/functions/candidates-admin',{method,headers:authorized?{'Authorization':'Bearer '+'A'.repeat(42),'Origin':'https://ai.hns.ma',...(body?{'Content-Type':'application/json'}:{})}:{'Origin':'https://ai.hns.ma'},body:body?JSON.stringify(body):undefined})}
test('Private RH API rejects unauthorized requests',async()=>{const r=await handler(req('GET',null,false));assert.equal(r.status,401)});
test('Import, automatic completeness, notes and manual statuses all work',async()=>{
 const imp=await handler(req('POST',{action:'import',records:[{name:'Candidate Test',email:'test@example.com',project:'Prototype en magasin et démonstration visible',obstacle:'Aucun automatisme sans validation utilisateur',ai_tools:'ChatGPT, Cursor',ai_agent_idea:'Un agent qui recommande une action, avec validation humaine',availability:'Oui'}]}));assert.equal(imp.status,200);assert.equal((await imp.json()).imported,1);
 const view=await handler(req('GET'));assert.equal(view.status,200);const data=await view.json();assert.equal(data.records.length,1);const rec=data.records[0];assert.ok(rec.triage.score>0);assert.equal(rec.status,'received');
 const note=await handler(req('POST',{action:'note',id:rec.id,note:'À valider après entretien court'}));assert.equal(note.status,200);
 const status=await handler(req('POST',{action:'set-status',id:rec.id,status:'selected'}));assert.equal(status.status,200);assert.equal((await status.json()).record.status,'selected');
 const mail=await handler(req('POST',{action:'invite',id:rec.id}));assert.equal(mail.status,503);
 const view2=await handler(req('GET'));const r2=(await view2.json()).records[0];assert.equal(r2.status,'selected');assert.equal(r2.notes.length,1);
});
test('Import same email never overwrites RH decisions',async()=>{const res=await handler(req('POST',{action:'import',records:[{name:'Candidate Test 2',email:'test@example.com'}]}));const body=await res.json();assert.equal(body.imported,0);assert.equal(body.skipped,1);const view=await handler(req('GET'));assert.equal((await view.json()).records[0].status,'selected')});
test('No invalid status or unsolicited email',async()=>{const v=await handler(req('GET'));const id=(await v.json()).records[0].id;const r=await handler(req('POST',{action:'set-status',id,status:'invited'}));assert.equal(r.status,422)});

test('RH list is blocked outside the original production site',async()=>{assert.equal((await handler(req('GET'),{site:{id:'staging'},deploy:{context:'production'}})).status,403);assert.equal((await handler(req('GET'),{...liveContext,deploy:{context:'deploy-preview'}})).status,403)});

test('Manual RH cannot assign Confirmé before invitation',async()=>{const v=await handler(req('GET'));const id=(await v.json()).records[0].id;const r=await handler(req('POST',{action:'set-status',id,status:'confirmed'}));assert.equal(r.status,422)});
