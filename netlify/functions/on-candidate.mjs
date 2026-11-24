import {getStore} from '@netlify/blobs';
import {clean,validateEmail,candidateId,receiptTemplate,sendMail,ready,openStoreOptions} from './_utils.mjs';
import {dataFromSubmission} from './triage.mjs';
import {normalizeCV,candidateHasCV} from './_cv.mjs';
// Verified platform event; the website's public form cannot write directly to the private RH store.
export default {
 async formSubmitted(event){
  if(process.env.CONTEXT&&process.env.CONTEXT!=='production')return;
  const raw=event?.data||{};const data=dataFromSubmission(raw);
  const cvFile=normalizeCV(raw.cv);const hasCV=candidateHasCV(raw.cv);
  const email=clean(data.email,254).toLowerCase();
  if(!validateEmail(email)||!clean(data.name)||!clean(data.ai_tools)||!clean(data.consent))return;
  const store=getStore(openStoreOptions());const id=candidateId(email);
  const existing=await store.get(id,{type:'json'});
  if(existing){ // Same email: do not overwrite RH decisions, notes or invitation state.
    if(cvFile && !existing.cvFile){const meta=await store.getMetadata(id);if(meta?.etag)await store.setJSON(id,{...existing,cvFile,hasCV:true},{onlyIfMatch:meta.etag});}
    if(!existing.ackSentAt&&ready()){
      await sendMail(email,receiptTemplate(existing.name),`hns-received-${id}`);
      const current=await store.getWithMetadata(id,{type:'json'});if(current?.data&&!current.data.ackSentAt)await store.setJSON(id,{...current.data,ackSentAt:new Date().toISOString()},{onlyIfMatch:current.etag});
    }
    return;
  }
  const record={id,email,name:clean(data.name,120),school:clean(data.school,150),track:clean(data.track,100),data,cvFile,hasCV,status:'received',source:'netlify-event',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),ackSentAt:null,invitedAt:null,notes:[],history:[{at:new Date().toISOString(),action:'received'}]};
  const created=await store.setJSON(id,record,{onlyIfNew:true});if(!created.modified)return;
  if(!ready()){console.info('H&S RH: candidature stored, receipt email disabled');return;}
  try{await sendMail(email,receiptTemplate(record.name),`hns-received-${id}`);const current=await store.getWithMetadata(id,{type:'json'});if(current?.data&&!current.data.ackSentAt)await store.setJSON(id,{...current.data,ackSentAt:new Date().toISOString()},{onlyIfMatch:current.etag});}
  catch(err){console.error('H&S RH: receipt email failed',err?.message||err)}
 }
};
