import {getStore} from '@netlify/blobs';
import {runRestoration,operation} from '../../lib/restore-confirmed.mjs';
const readEnv=k=>(globalThis.Netlify?.env?.get(k)||process.env[k]||'').trim();
const SITE='33dae2ce-086d-4470-b6fe-248f3ca49b70';
export default {
 async deploySucceeded(event){
  if(event?.site?.id!==SITE||event?.deploy?.siteId!==SITE||event?.deploy?.context!=='production'||event?.deploy?.branch!=='main'||!event?.deploy?.publishedAt||readEnv('HNS_UNIFIED_PRODUCTION')!=='true'||readEnv('HNS_RH_RESTORE_OPERATION')!==operation)return;
  const secret=readEnv('HNS_SESSION_SECRET');if(secret.length<32)return;
  const rh=getStore({name:'hns-ai-recruitment-2026',region:'eu-central-1',consistency:'strong'}),db=getStore({name:'hns-ai-mission-control',consistency:'strong'});
  const result=await runRestoration({rh,db,secret});
  console.info('HNS_RH_RESTORE_RESULT',JSON.stringify(result));
 }
};
