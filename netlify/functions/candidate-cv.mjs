import {getStore} from '@netlify/blobs';
import {secureTokenEqual,env,openStoreOptions} from './_utils.mjs';
import {normalizeCV,safeNextLink} from './_cv.mjs';

const SITE_FORM_ID='6af0f91202bfb9a6322bb546'; // Existing H&S Netlify Forms ID
const err=(message,status=400)=>new Response(JSON.stringify({error:message}),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});

// Optional, on-demand restoration of the CV references for older candidates.
// API endpoint: documented listFormSubmissions, GET /api/v1/forms/{form_id}/submissions.
export async function findCVForEmail(email,token,fetcher=fetch){
  if(!token||!email)return null;
  let next=`https://api.netlify.com/api/v1/forms/${SITE_FORM_ID}/submissions?per_page=100&page=1`;
  for(let i=0;i<10 && next;i++){
    const res=await fetcher(next,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},redirect:'manual'});
    if(!res.ok)throw new Error(`Impossible de synchroniser Netlify Forms (${res.status})`);
    const submissions=await res.json();
    if(!Array.isArray(submissions))throw new Error('Réponse API Netlify inattendue');
    for(const sub of submissions){
      if(String(sub.data?.email||sub.email||'').toLowerCase().trim()!==email.toLowerCase().trim())continue;
      const found=normalizeCV(sub.data?.cv);
      if(found)return found;
    }
    next=safeNextLink(res.headers.get('link'));
  }
  return null;
}

export default async function handler(request){
  if(process.env.CONTEXT&&process.env.CONTEXT!=='production')return err('Indisponible en préproduction',403);
  if(request.method!=='GET')return err('Méthode non autorisée',405);
  const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return err('Origine refusée',403);
  const bearer=(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
  if(!secureTokenEqual(env('HNS_ADMIN_TOKEN'),bearer))return err('Accès RH non autorisé',401);
  const id=new URL(request.url).searchParams.get('id')||'';
  if(!/^[a-f0-9]{64}$/.test(id))return err('Identifiant candidat invalide',400);
  try{
    const store=getStore(openStoreOptions());
    const record=await store.get(id,{type:'json'});
    if(!record)return err('Dossier candidat introuvable',404);
    let file=normalizeCV(record.cvFile);
    if(!file){
      const token=env('HNS_NETLIFY_API_TOKEN');
      if(!token)return err('CV non relié au dossier : ajoute HNS_NETLIFY_API_TOKEN dans les variables Netlify pour synchroniser les fichiers existants.',424);
      file=await findCVForEmail(record.email,token);
      if(file){ // Preserve notes, statuses, and concurrent edits.
        const meta=await store.getMetadata(id);
        if(meta?.etag)await store.setJSON(id,{...record,cvFile:file,hasCV:true},{onlyIfMatch:meta.etag});
      }
    }
    if(!file)return err('Aucun CV PDF trouvé dans Netlify Forms pour ce candidat',404);
    const upstream=await fetch(file.url,{method:'GET',redirect:'manual',headers:{Accept:'application/pdf'}});
    if(!upstream.ok)return err('Le PDF n’est plus accessible dans Netlify Forms',502);
    const maxBytes=6*1024*1024;
    const declaredSize=Number(upstream.headers.get('content-length')||0);
    if(declaredSize>maxBytes)return err('PDF trop volumineux',413);
    const pdf=new Uint8Array(await upstream.arrayBuffer());
    if(pdf.byteLength>maxBytes||pdf.byteLength<5||new TextDecoder().decode(pdf.subarray(0,5))!=='%PDF-')return err('Fichier PDF non valide',415);
    return new Response(pdf,{status:200,headers:{'Content-Type':'application/pdf','Content-Disposition':'inline; filename="CV.pdf"','Content-Length':String(pdf.byteLength),'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
  }catch(error){console.error('H&S CV',String(error?.message||error).slice(0,120));return err('Impossible de charger le CV pour le moment',502);}
}
