import {getStore} from '@netlify/blobs';
import {guestSeedAllowed,runGuestSeed,applyConfirmedGuestContacts} from '../../lib/event-guests.mjs';
const readEnv=k=>(globalThis.Netlify?.env?.get(k)||process.env[k]||'').trim();
export default {
 async deploySucceeded(event){
  if(!guestSeedAllowed(event,readEnv))return;
  const db=getStore({name:'hns-ai-mission-control',consistency:'strong'});
  const report=await runGuestSeed({db,guestPlan:readEnv('HNS_EVENT_GUEST_PLAN'),guestContacts:readEnv('HNS_EVENT_GUEST_CONTACTS')});
  console.info('HNS_GUEST_SEED_RESULT',JSON.stringify(report));
  const contacts=await applyConfirmedGuestContacts({db,raw:readEnv('HNS_EVENT_GUEST_CONFIRMED_CONTACTS')});
  console.info('HNS_GUEST_CONTACTS_RESULT',JSON.stringify(contacts));
 }
};
