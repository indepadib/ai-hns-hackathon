import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {pathToFileURL} from 'node:url';
import {normalizeCV,candidateHasCV,safeCandidateSummary,safeNextLink} from '../lib/recruitment/_cv.mjs';
const hosted='https://d33wubrfki0l68.cloudfront.net/test-recruitment-uploads/cv.pdf';

test('PDF upload metadata is validated',()=>{
 assert.deepEqual(normalizeCV({filename:'CV.pdf',url:hosted,size:337761}),{filename:'CV.pdf',url:hosted,size:337761});
 assert.equal(normalizeCV({url:'https://evil.example/cv.pdf',filename:'CV.pdf'}),null);
 assert.equal(normalizeCV({url:'http://d33wubrfki0l68.cloudfront.net/cv.pdf',filename:'CV.pdf'}),null);
 assert.equal(normalizeCV({url:hosted,filename:'CV.exe'}).filename,'CV.pdf');
 assert.equal(candidateHasCV('cv.pdf'),true);
 assert.equal(candidateHasCV('[object Object]'),false);
});
test('Recruiter candidate listing never returns raw CV URLs',()=>{
 const summary=safeCandidateSummary({id:'abc',data:{cv:hosted,project:'project'},cvFile:{filename:'CV.pdf',url:hosted},hasCV:true});
 assert.equal(summary.hasCV,true);assert.equal(summary.cvAvailable,true);
 assert.equal(summary.cvFile,undefined);assert.equal(summary.data.cv,undefined);
 assert.ok(!JSON.stringify(summary).includes('cloudfront'));
});
test('Netlify API pagination link is constrained to the original host and endpoint',()=>{
 assert.equal(safeNextLink('<https://api.netlify.com/api/v1/forms/123/submissions?page=2>; rel="next"'), 'https://api.netlify.com/api/v1/forms/123/submissions?page=2');
 assert.equal(safeNextLink('<https://evil.example/api/v1/forms/123/submissions?page=2>; rel="next"'),null);
});
// Test candidate-cv via a temporary dependency-free server substitute for @netlify/blobs.
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hns-cv-test-'));
for(const name of ['_utils.mjs','_cv.mjs'])fs.copyFileSync(path.resolve('lib/recruitment',name),path.join(dir,name));
fs.writeFileSync(path.join(dir,'fakeblobs.mjs'),`export const data=new Map();export function getStore(){return {get:async id=>data.get(id)||null,getMetadata:async()=>({etag:'version-1'}),setJSON:async()=>({modified:true})}}`);
fs.writeFileSync(path.join(dir,'candidate-cv.mjs'),fs.readFileSync(path.resolve('netlify/functions/candidate-cv.mjs'),'utf8').replace("from '@netlify/blobs'","from './fakeblobs.mjs'").replaceAll("../../lib/recruitment/","./"));
const {default:rawCVHandler,findCVForEmail}=await import(pathToFileURL(path.join(dir,'candidate-cv.mjs')));
const liveContext={site:{id:'33dae2ce-086d-4470-b6fe-248f3ca49b70'},deploy:{context:'production'}};
const cvHandler=(req,context=liveContext)=>rawCVHandler(req,context);
const {data:store}=await import(pathToFileURL(path.join(dir,'fakeblobs.mjs')));
const id='a'.repeat(64);const token='z'.repeat(48);process.env.CONTEXT='production';process.env.HNS_ADMIN_TOKEN=token;
function req(auth=true){return new Request(`https://ai.hns.ma/.netlify/functions/candidate-cv?id=${id}`,{headers:auth?{Authorization:'Bearer '+token,Origin:'https://ai.hns.ma'}:{Origin:'https://ai.hns.ma'}})}
test('Authenticated CV endpoint rejects unauthenticated request',async()=>{
 const res=await cvHandler(req(false));assert.equal(res.status,401);
});
test('CV fallback to Netlify API accepts existing submission metadata',async()=>{
 const fetcher=async(url)=>new Response(JSON.stringify([{data:{email:'candidate@example.com',cv:{filename:'Candidate CV.pdf',url:hosted,size:12345}}}]),{status:200,headers:{'Content-Type':'application/json'}});
 const cv=await findCVForEmail('candidate@example.com','token',fetcher);
 assert.equal(cv.url,hosted);
});
test('No API token: old candidates return a helpful response, not a public CV link',async()=>{
 delete process.env.HNS_NETLIFY_API_TOKEN;
 store.set(id,{id,email:'candidate@example.com',name:'Candidate',hasCV:true});
 const res=await cvHandler(req(true));assert.equal(res.status,424);assert.ok((await res.json()).error.includes('HNS_NETLIFY_API_TOKEN'));
});
test('Authenticated backend proxies PDF bytes only',async()=>{
 const savedFetch=globalThis.fetch;
 store.set(id,{id,email:'candidate@example.com',cvFile:{url:hosted,filename:'CV.pdf',size:21},hasCV:true});
 globalThis.fetch=async()=>new Response(new TextEncoder().encode('%PDF-1.7\nexample-data'),{status:200,headers:{'Content-Type':'application/pdf'}});
 try{const res=await cvHandler(req(true));assert.equal(res.status,200);assert.equal(res.headers.get('content-type'),'application/pdf');assert.equal(res.headers.get('cache-control'),'private, no-store, max-age=0');assert.ok((await res.arrayBuffer()).byteLength>5);}finally{globalThis.fetch=savedFetch;}
});

test('CV endpoint is blocked on preview and alternate sites',async()=>{assert.equal((await cvHandler(req(true),{site:{id:'staging'},deploy:{context:'production'}})).status,403);assert.equal((await cvHandler(req(true),{...liveContext,deploy:{context:'deploy-preview'}})).status,403)});
