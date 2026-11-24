import {getStore} from '@netlify/blobs';
import {oauthConfig,completeOAuth} from '../../lib/gmail-oauth.mjs';
const readEnv=name=>(globalThis.Netlify?.env?.get(name)||process.env[name]||'').trim();
const isLive=(request,context)=>new URL(request.url).hostname==='ai.hns.ma'&&context?.site?.id==='33dae2ce-086d-4470-b6fe-248f3ca49b70'&&context?.deploy?.context==='production'&&readEnv('HNS_UNIFIED_PRODUCTION')==='true';
const store=()=>getStore({name:'hns-ai-mission-control',consistency:'strong'});
export const config={path:'/api/gmail/callback',method:'GET'};
export default async function handler(request,context){
 if(request.method==='GET'){
  const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'"};
  if(!isLive(request,context))return new Response('Indisponible', {status:403,headers});
  const cfg=oauthConfig(readEnv),url=new URL(request.url);
  let success=false;try{if(!cfg||url.searchParams.has('error'))throw Error('Denied');await completeOAuth(store(),cfg,{state:url.searchParams.get('state'),code:url.searchParams.get('code')});success=true}catch{console.warn('GMAIL_OAUTH_CALLBACK_FAILED')}
  return new Response('<!doctype html><html lang="fr"><meta charset="utf-8"><title>Connexion Gmail H&S</title><body style="font:16px system-ui;max-width:600px;margin:80px auto;padding:24px"><h1>'+(success?'Gmail connecté':'Connexion non finalisée')+'</h1><p>'+(success?'Compte recrutement@hns.ma autorisé. Retournez au Talent Center et actualisez le statut.':'Vérifiez le compte Google, les autorisations et la configuration OAuth, puis recommencez.')+'</p><a href="/admin-recrutement.html">Retour au Talent Center</a></body></html>',{status:success?200:400,headers});
 }
 return new Response('Method not allowed',{status:405,headers:{'Cache-Control':'no-store'}});
}
