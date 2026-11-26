// A communication workflow, never a hiring decision. The RH row is the authoritative lock.
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const thanks='Merci d’avoir pris le temps de nous présenter votre parcours, vos réalisations et votre intérêt pour la Data et l’intelligence artificielle.';
const decision='Cette première édition du H&S AI Talent Challenge a suscité un véritable engouement. Le nombre de places étant limité, votre candidature n’a malheureusement pas été retenue pour cette première édition.';
const next='Un deuxième hackathon est prévu afin de rencontrer de nouveaux talents et de poursuivre le recrutement pour accompagner les ambitions Data & IA du Groupe H&S.';
const closing='Nous vous invitons à rester attentif à nos prochaines communications. Nous espérons avoir l’occasion de vous retrouver et de découvrir ce que vous construirez.';
export function nonselectionMail(row){
 const subject='H&S AI Talent Challenge — L’aventure continue !';
 const name=String(row.name||'').trim().slice(0,120),greeting=name?'Bonjour '+name+',':'Bonjour,';
 const text=[greeting,thanks,decision,'L’AVENTURE CONTINUE',next,closing,'Merci encore pour votre confiance.','L’équipe H&S AI Talent Challenge'].join('\n\n');
 const html=`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#edf2f7;font-family:Arial,Helvetica,sans-serif;color:#173450"><div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">Un mot sur votre candidature et la suite du H&amp;S AI Talent Challenge.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#edf2f7"><tr><td align="center" style="padding:22px 8px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="max-width:600px;border-radius:18px;overflow:hidden">
<tr><td bgcolor="#12365d" style="padding:26px 28px 30px;color:#ffffff"><p style="margin:0;font-size:16px;font-weight:bold;letter-spacing:2px">H&amp;S INVEST</p><p style="margin:9px 0 0;color:#b9d6ee;font-size:11px;letter-spacing:2px">AI TALENT CHALLENGE / 2026</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px"><tr><td width="42" height="3" bgcolor="#a8d3f3"></td><td></td></tr></table><p style="margin:19px 0 9px;font-size:11px;font-weight:bold;letter-spacing:1.5px;color:#b9d6ee">ÉDITION 01 · UN MOT DE L’ÉQUIPE</p><h1 style="font-size:32px;line-height:1.18;letter-spacing:-.6px;margin:0;color:#ffffff">Merci pour votre<br>candidature.</h1><p style="margin:14px 0 0;font-size:15px;line-height:1.5;color:#d7e8f7">Les talents d’aujourd’hui construisent les solutions de demain.</p></td></tr>
<tr><td style="padding:27px 28px 20px"><p style="margin:0 0 14px;font-size:19px;font-weight:bold;color:#12365d">${esc(greeting)}</p><p style="font-size:15px;line-height:1.7;margin:0 0 16px">${esc(thanks)}</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#f0f5fb" style="border:1px solid #c8d9ea;border-radius:10px"><tr><td width="4" bgcolor="#7599bd"></td><td style="padding:16px 17px"><p style="margin:0 0 7px;font-size:10px;font-weight:bold;letter-spacing:1.4px;color:#32669c">VOTRE CANDIDATURE · ÉDITION 01</p><p style="font-size:15px;line-height:1.65;margin:0">${esc(decision)}</p></td></tr></table></td></tr>
<tr><td style="padding:2px 28px 23px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#eaf1f8" style="border-radius:12px;border:1px solid #c8d9ea"><tr><td style="padding:20px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td valign="top" style="padding-right:10px"><p style="margin:0 0 8px;font-size:10px;font-weight:bold;letter-spacing:1.5px;color:#32669c">LA SUITE · ÉDITION 02</p><h2 style="margin:0;font-size:24px;line-height:1.2;letter-spacing:-.5px;color:#12365d">L’aventure continue.</h2></td><td width="62" align="center" valign="middle" bgcolor="#12365d" style="border-radius:9px;color:#d7e8f7;font-size:28px;font-weight:bold;padding:8px">02</td></tr></table><p style="margin:16px 0 0;line-height:1.65;font-size:14px;color:#173450">${esc(next)}</p></td></tr></table></td></tr>
<tr><td style="padding:0 28px 27px"><p style="font-size:15px;line-height:1.65;margin:0 0 18px">${esc(closing)}</p><p style="font-size:14px;line-height:1.65;margin:0">Merci encore pour votre confiance.<br><strong style="color:#12365d">L’équipe H&amp;S AI Talent Challenge</strong></p></td></tr>
<tr><td bgcolor="#eaf1f8" style="padding:18px 28px;border-top:1px solid #d9e5ef"><p style="margin:0 0 6px;font-size:11px;font-weight:bold;letter-spacing:1.2px;color:#32669c">H&amp;S INVEST · AI TALENT CHALLENGE 2026</p><p style="margin:0;font-size:11px;color:#526580;line-height:1.5">Ce message concerne votre candidature à la première édition.</p></td></tr>
</table></td></tr></table></body></html>`;
 return {subject,text,html};
}
export function nonselectionBlock(row,ops){
 if(!row||row.status!=='rejected')return 'Décision RH Non retenu requise';
 if(row.invitedAt||ops.pass||ops.invitation)return 'Pass ou invitation existante — dossier protégé';
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email||''))return 'Adresse email invalide';
 if(row.nonselection)return 'Communication déjà enregistrée';
 return null;
}
// Bulk decisions are restricted to the explicit outstanding statuses, never invited/selected/confirmed.
export function bulkRejectionBlock(row,ops){
 if(!row||!['received','review','interview'].includes(row.status))return 'Statut protégé ou déjà traité';
 if(row.invitedAt||ops.pass||ops.invitation)return 'Pass ou invitation existante';
 if(row.nonselection)return 'Communication existante';
 return null;
}
export async function nonselectionAction({action,body,rh,operations,enabled,deliver,now=()=>new Date()}){
 const ok=(value,status=200)=>({value,status}),err=(error,status=409)=>ok({error},status);
 async function inspect(id){const row=await rh.get(id,{type:'json'});const ops=await operations(id);const blocker=nonselectionBlock(row,ops);return{id,state:row?.nonselection?.state||(blocker?'protected':'ready'),blocker,acceptedAt:row?.nonselection?.acceptedAt||null}}
 if(['rh-nonselection-bulk-preview','rh-nonselection-bulk-mark'].includes(action)){
  const apply=action==='rh-nonselection-bulk-mark',items=body.items;
  if(!Array.isArray(items)||!items.length||items.length>(apply?20:60)||new Set(items.map(x=>x?.id)).size!==items.length||items.some(x=>!x||typeof x.id!=='string'||!/^[a-f0-9]{64}$/.test(x.id)||!['received','review','interview'].includes(x.status)))return err('Lot de décisions invalide',400);
  if(apply&&body.confirm!==true)return err('Confirmation RH requise',403);
  const results=[];
  for(let i=0;i<items.length;i+=5){
   const batch=await Promise.all(items.slice(i,i+5).map(async item=>{
    try{
     const current=await rh.getWithMetadata(item.id,{type:'json'}),row=current?.data;
     if(!row||!current.etag||row.status!==item.status)return {id:item.id,state:'protected',blocker:'Statut modifié'};
     const blocker=bulkRejectionBlock(row,await operations(item.id));
     if(blocker)return {id:item.id,state:'protected',blocker};
     if(!apply)return {id:item.id,status:row.status,state:'eligible'};
     const at=now().toISOString(),next={...row,status:'rejected',updatedAt:at,history:[...(row.history||[]),{at,action:'status',value:'rejected',source:'bulk-nonselection'}].slice(-80)};
     const write=await rh.setJSON(item.id,next,{onlyIfMatch:current.etag});
     return {id:item.id,state:write?.modified?'marked':'conflict'};
    }catch{return {id:item.id,state:'review'};}
   }));results.push(...batch);
  }
  return ok({results});
 }
 if(action==='rh-nonselection-status'){
  if(!Array.isArray(body.ids)||body.ids.length>60||body.ids.some(id=>typeof id!=='string'||! /^[a-f0-9]{64}$/.test(id)))return err('Lot invalide',400);
  const entries=[];for(let i=0;i<body.ids.length;i+=12)entries.push(...await Promise.all(body.ids.slice(i,i+12).map(inspect)));return ok({entries,enabled});
 }
 const id=body.candidateId;if(typeof id!=='string'||! /^[a-f0-9]{64}$/.test(id))return err('Dossier invalide',400);
 const current=await rh.getWithMetadata(id,{type:'json'}),row=current?.data;if(!row||!current.etag)return err('Dossier introuvable',404);
 const blocker=nonselectionBlock(row,await operations(id));
 if(action==='rh-nonselection-preview')return blocker?err(blocker):ok({mail:nonselectionMail(row),email:row.email,name:row.name});
 if(action!=='rh-nonselection-send'||!enabled||body.confirm!==true)return err('Envoi non confirmé ou indisponible',403);
 if(blocker)return err(blocker);
 const started={...row,nonselection:{state:'sending',startedAt:now().toISOString(),template:'edition-1-v1'}};
 const lock=await rh.setJSON(id,started,{onlyIfMatch:current.etag});if(!lock?.modified)return err('Dossier modifié, envoi bloqué');
 async function finish(state,extra={}){for(let attempt=0;attempt<4;attempt++){const latest=await rh.getWithMetadata(id,{type:'json'});if(!latest?.etag||latest.data.nonselection?.state!=='sending')return false;const write=await rh.setJSON(id,{...latest.data,nonselection:{...latest.data.nonselection,state,...extra}},{onlyIfMatch:latest.etag});if(write.modified)return true}return false}
 try{
  const latest=await rh.get(id,{type:'json'});if(latest?.status!=='rejected'||latest.email!==row.email||nonselectionBlock({...latest,nonselection:null},await operations(id)))throw Error('Dossier modifié');
  const receipt=await deliver({email:row.email,mail:nonselectionMail(row),id:'nonselection-v1-'+id});if(!receipt?.id)throw Error('Acceptation inconnue');
  if(!await finish('accepted',{acceptedAt:now().toISOString(),providerId:receipt.id}))throw Error('Etat non réconcilié');
  return ok({mailStatus:'accepted'});
 }catch{await finish('review_required').catch(()=>{});return err('Envoi à contrôler dans Gmail. Aucun renvoi automatique.',503)}
}
