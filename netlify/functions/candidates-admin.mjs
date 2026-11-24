import {getStore} from '@netlify/blobs';
import {secureTokenEqual,env,openStoreOptions,ready,candidateId,clean,validateEmail} from './_utils.mjs';
import {triage,dataFromSubmission,statusValues} from './triage.mjs';
import {normalizeCV,candidateHasCV,safeCandidateSummary} from './_cv.mjs';
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
const allowedActions=new Set(['set-status','note','invite','import']);
function auth(request){
 const bearer=(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
 return secureTokenEqual(env('HNS_ADMIN_TOKEN'),bearer);
}
function sanitize(r){return {...safeCandidateSummary(r),triage:triage(r)};}
function timeEvent(action,extra={}){return {at:new Date().toISOString(),action,...extra};}
async function modify(store,id,updater){
 const current=await store.getWithMetadata(id,{type:'json'});if(!current?.data)return null;
 if(!current.etag)return {conflict:true};
 const next=updater(current.data);const result=await store.setJSON(id,next,{onlyIfMatch:current.etag});
 return result.modified?{record:next}:{conflict:true};
}
export default async(request,context)=>{
 if(context?.site?.id!=='33dae2ce-086d-4470-b6fe-248f3ca49b70'||context?.deploy?.context!=='production'||new URL(request.url).hostname!=='ai.hns.ma')return response({error:'Disponible uniquement en production'},403);
 if(!['GET','POST'].includes(request.method))return response({error:'Méthode non autorisée'},405);
 const origin=request.headers.get('origin');if(origin && origin!==new URL(request.url).origin)return response({error:'Origine refusée'},403);
 if(!auth(request))return response({error:'Accès non autorisé'},401);
 try{
  const store=getStore({...openStoreOptions(),consistency:'strong'});
  if(request.method==='GET'){
   const {blobs}=await store.list();if(blobs.length>700)return response({error:'Capacité de l’outil atteinte; contacter l’administrateur'},422);
   const records=(await Promise.all(blobs.map(x=>store.get(x.key,{type:'json'})))).filter(Boolean).map(sanitize).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
   return response({records,emailReady:ready(),formName:'hns-ai-candidates-2026',count:records.length});
  }
  const body=await request.json().catch(()=>null);
  if(!body || !allowedActions.has(body.action))return response({error:'Action invalide'},400);
  if(body.action==='import'){
   const entries=body.records;if(!Array.isArray(entries)||entries.length<1||entries.length>200)return response({error:'Import limité à 200 dossiers par lot'},422);
   let imported=0,skipped=0;
   for(const raw of entries){const source=raw.data??raw;const data=dataFromSubmission(source),email=data.email.toLowerCase();const cvFile=normalizeCV(source.cv),hasCV=candidateHasCV(source.cv);if(!validateEmail(email)||!data.name){skipped++;continue;}
    const id=candidateId(email),now=new Date().toISOString();const record={id,email,name:clean(data.name,120),school:clean(data.school,150),track:clean(data.track,100),data,cvFile,hasCV,status:'received',source:'netlify-csv-import',createdAt:raw.created_at&&/^\d{4}-\d\d-\d\d/.test(raw.created_at)?clean(raw.created_at,40):now,updatedAt:now,ackSentAt:null,invitedAt:null,notes:[],history:[timeEvent('imported')]};
    const r=await store.setJSON(id,record,{onlyIfNew:true});
    if(r.modified){imported++;}else{ // Backfill a CV reference from an older Netlify CSV, without overwriting RH decisions.
      const current=await store.getWithMetadata(id,{type:'json'});const old=current?.data;
      if(cvFile && old && !old.cvFile && current?.etag){const updated=await store.setJSON(id,{...old,cvFile,hasCV:true},{onlyIfMatch:current.etag});updated.modified?imported++:skipped++;}else skipped++;
    }
   }
   return response({ok:true,imported,skipped});
  }
  if(typeof body.id!=='string'||!/^[a-f0-9]{64}$/.test(body.id))return response({error:'Dossier invalide'},400);
  if(body.action==='set-status'){
   const status=body.status;if(!statusValues.includes(status)||['invited','confirmed'].includes(status))return response({error:'Les statuts Invité et Confirmé sont réservés au parcours invitation / participation. Utilisez Sélectionné pour valider un candidat.'},422);
   const result=await modify(store,body.id,r=>{
    if(r.nonselection&&status!==r.status)throw Object.assign(Error('Une communication de non-sélection est enregistrée pour cette édition. Vérification RH requise avant reclassement.'),{rhProtected:true});
    if(r.invitedAt||['invited','confirmed'].includes(r.status))throw Object.assign(Error('Dossier déjà invité ou historique à corriger via le module dédié.'),{rhProtected:true});
    return {...r,status,updatedAt:new Date().toISOString(),history:[...(r.history||[]),timeEvent('status',{value:status})].slice(-80)};});
   if(!result)return response({error:'Candidat absent'},404);if(result.conflict)return response({error:'Mis à jour simultanément. Recharge la liste.'},409);return response({ok:true,record:sanitize(result.record)});
  }
  if(body.action==='note'){
   const note=clean(body.note,1200);if(note.length<3)return response({error:'Commentaire trop court'},422);
   const result=await modify(store,body.id,r=>({...r,notes:[...(r.notes||[]),{at:new Date().toISOString(),text:note}].slice(-30),updatedAt:new Date().toISOString(),history:[...(r.history||[]),timeEvent('note')].slice(-80)}));
   if(!result)return response({error:'Candidat absent'},404);if(result.conflict)return response({error:'Mis à jour simultanément. Recharge la liste.'},409);return response({ok:true,record:sanitize(result.record)});
  }
  return response({error:'Utilisez le pass H&S dans la fiche candidat. Ancien envoi désactivé.'},503);
 }catch(err){if(err?.rhProtected)return response({error:err.message},409);console.error('H&S RH admin:',err?.message||err);return response({error:'Erreur serveur lors de la gestion RH'},500);}
};
