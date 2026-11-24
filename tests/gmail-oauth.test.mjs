import test from 'node:test';
import assert from 'node:assert/strict';
import {beginOAuth,completeOAuth,oauthStatus,unseal,seal,connectionKey,gmailSend,sendScope,redirectUri} from '../lib/gmail-oauth.mjs';
const cfg={clientId:'example.apps.googleusercontent.com',clientSecret:'not-real',secret:'s'.repeat(40)};
function store(){const m=new Map();let rev=0;return {get:async k=>m.get(k)?.data,getWithMetadata:async k=>m.get(k),setJSON:async(k,data,opts={})=>{const old=m.get(k);if(opts.onlyIfNew&&old||opts.onlyIfMatch&&old?.etag!==opts.onlyIfMatch)return{modified:false};m.set(k,{data,etag:String(++rev)});return{modified:true}}}}
const json=(obj)=>new Response(JSON.stringify(obj),{status:200});
function provider(email='recrutement@hns.ma'){return async(url,options)=>{if(url==='https://oauth2.googleapis.com/token'){assert.equal(options.body.get('redirect_uri'),redirectUri);assert.ok(options.body.get('code_verifier'));return json({access_token:'fake-access',refresh_token:'fake-refresh',scope:'openid email '+sendScope})}assert.equal(url,'https://openidconnect.googleapis.com/v1/userinfo');return json({email,email_verified:true})}}
test('OAuth state is one use, PKCE enabled, refresh encrypted and account pinned',async()=>{
 const db=store(),url=new URL(await beginOAuth(db,cfg));
 assert.equal(url.origin,'https://accounts.google.com');assert.equal(url.searchParams.get('redirect_uri'),redirectUri);assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.equal(url.searchParams.get('access_type'),'offline');
 const params={state:url.searchParams.get('state'),code:'synthetic'};
 await completeOAuth(db,cfg,params,provider());assert.equal((await oauthStatus(db)).connected,true);assert.equal((await oauthStatus(db)).testedAt,null);
 const record=await db.get(connectionKey);assert.notEqual(record.refresh,'fake-refresh');assert.equal(unseal(record.refresh,cfg.secret),'fake-refresh');
 await assert.rejects(completeOAuth(db,cfg,params,provider()),/state/);
 assert.throws(()=>unseal(record.refresh,'other-secret'));
});
test('Wrong Google account cannot connect',async()=>{const db=store(),url=new URL(await beginOAuth(db,cfg));await assert.rejects(completeOAuth(db,cfg,{state:url.searchParams.get('state'),code:'synthetic'},provider('other@example.invalid')),/Unexpected/);assert.equal((await oauthStatus(db)).connected,false)});
test('Gmail sends RFC MIME as base64url and validates acceptance',async()=>{const raw='To: recruitment@example.invalid\r\nSubject: test\r\n\r\nHello';const result=await gmailSend('mock-access',raw,async(url,opt)=>{assert.equal(url,'https://gmail.googleapis.com/gmail/v1/users/me/messages/send');assert.equal(Buffer.from(JSON.parse(opt.body).raw,'base64url').toString(),raw);return json({id:'mock-id'})});assert.equal(result.provider,'gmail-oauth');await assert.rejects(gmailSend('mock-access',raw,async()=>json({})),/acceptance/)});
