import {randomBytes,createHash,createCipheriv,createDecipheriv} from 'node:crypto';
export const mailbox='recrutement@hns.ma';
export const redirectUri='https://ai.hns.ma/api/gmail/callback';
export const sendScope='https://www.googleapis.com/auth/gmail.send';
export const connectionKey='gmail-oauth-connection-v1';
const digest=s=>createHash('sha256').update(s).digest('base64url');
const stateKey=state=>'gmail-oauth-state-'+digest(state);
const keyFor=secret=>createHash('sha256').update('hns-gmail-oauth-v1:'+secret).digest();
export function oauthConfig(env){
 const clientId=env('HNS_GOOGLE_CLIENT_ID'),clientSecret=env('HNS_GOOGLE_CLIENT_SECRET'),secret=env('HNS_SESSION_SECRET');
 if(!clientId||!clientSecret||!secret||secret.length<32)return null;
 return {clientId,clientSecret,secret};
}
export function seal(value,secret){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',keyFor(secret),iv);const data=Buffer.concat([c.update(value,'utf8'),c.final()]);return [iv,c.getAuthTag(),data].map(b=>b.toString('base64url')).join('.')}
export function unseal(value,secret){const [iv,tag,data]=String(value).split('.').map(x=>Buffer.from(x,'base64url'));const c=createDecipheriv('aes-256-gcm',keyFor(secret),iv);c.setAuthTag(tag);return Buffer.concat([c.update(data),c.final()]).toString('utf8')}
export async function beginOAuth(db,config){
 const state=randomBytes(32).toString('base64url'),verifier=randomBytes(48).toString('base64url');
 const result=await db.setJSON(stateKey(state),{verifier:seal(verifier,config.secret),expires:Date.now()+10*60*1000,used:false},{onlyIfNew:true});
 if(!result?.modified)throw Error('State collision');
 const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
 url.search=new URLSearchParams({client_id:config.clientId,redirect_uri:redirectUri,response_type:'code',scope:'openid email '+sendScope,access_type:'offline',prompt:'consent select_account',login_hint:mailbox,state,code_challenge:digest(verifier),code_challenge_method:'S256'}).toString();
 return url.href;
}
async function tokenRequest(config,params,fetcher){const r=await fetcher('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:config.clientId,client_secret:config.clientSecret,...params}),redirect:'error',signal:AbortSignal.timeout(12000)});const data=await r.json().catch(()=>null);if(!r.ok||typeof data?.access_token!=='string')throw Error('Google authorization failed');return data}
export async function completeOAuth(db,config,{state,code},fetcher=fetch){
 if(!/^[\w-]{43}$/.test(state||'')||typeof code!=='string'||!code||code.length>4096)throw Error('Invalid OAuth response');
 const k=stateKey(state),current=await db.getWithMetadata(k,{type:'json'});
 if(!current?.data||current.data.used||current.data.expires<Date.now())throw Error('Expired OAuth state');
 const lock=await db.setJSON(k,{used:true,expires:current.data.expires},{onlyIfMatch:current.etag});if(!lock?.modified)throw Error('OAuth state consumed');
 const tokens=await tokenRequest(config,{grant_type:'authorization_code',code,redirect_uri:redirectUri,code_verifier:unseal(current.data.verifier,config.secret)},fetcher);
 if(!String(tokens.scope||'').split(' ').includes(sendScope)||typeof tokens.refresh_token!=='string')throw Error('Gmail send or offline consent missing');
 const res=await fetcher('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:'Bearer '+tokens.access_token},redirect:'error',signal:AbortSignal.timeout(10000)});
 const profile=await res.json().catch(()=>null);
 if(!res.ok||profile?.email?.toLowerCase()!==mailbox||profile.email_verified!==true)throw Error('Unexpected Google account');
 await db.setJSON(connectionKey,{email:mailbox,refresh:seal(tokens.refresh_token,config.secret),connectedAt:new Date().toISOString(),testedAt:null});
 return mailbox;
}
export async function oauthAccess(db,config){
 const conn=await db.get(connectionKey,{type:'json'});
 if(conn?.email!==mailbox||!conn.refresh)throw Error('Connect Gmail first');
 return (await tokenRequest(config,{grant_type:'refresh_token',refresh_token:unseal(conn.refresh,config.secret)},fetch)).access_token;
}
export async function oauthStatus(db){const r=await db.get(connectionKey,{type:'json'});return {connected:r?.email===mailbox&&!!r.refresh,email:mailbox,connectedAt:r?.connectedAt||null,testedAt:r?.testedAt||null}}
export async function gmailSend(accessToken,raw,fetcher=fetch){
 const res=await fetcher('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',headers:{Authorization:'Bearer '+accessToken,'Content-Type':'application/json'},body:JSON.stringify({raw:Buffer.from(raw).toString('base64url')}),redirect:'error',signal:AbortSignal.timeout(15000)});
 const data=await res.json().catch(()=>null);if(!res.ok||typeof data?.id!=='string')throw Error('Gmail acceptance not confirmed');return {id:data.id,provider:'gmail-oauth'};
}
