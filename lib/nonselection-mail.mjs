// A communication workflow, never a hiring decision. The RH row is the authoritative lock.
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paragraphs=[
'Nous tenons à vous remercier chaleureusement pour votre candidature au H&S AI Talent Challenge et pour l’intérêt que vous portez à notre groupe.',
'Cette première édition a suscité un véritable engouement, avec un nombre particulièrement important de candidatures.',
'Malheureusement, compte tenu du nombre limité de places disponibles, nous n’avons pas pu retenir votre candidature pour cette première édition.',
'Mais l’aventure ne s’arrête pas là !',
'Nous avons le plaisir de vous annoncer qu’un deuxième hackathon est prévu afin de rencontrer et de recruter de nouveaux talents pour accompagner les ambitions du groupe H&S en matière de Data et d’intelligence artificielle.',
'Nous serons ravis de vous retrouver à cette occasion et vous encourageons à rester attentif à nos prochaines communications.',
'Merci encore pour votre intérêt, votre motivation et la confiance que vous nous accordez.',
'Au plaisir de vous rencontrer prochainement.'
];
export function nonselectionMail(row){const subject='H&S AI Talent Challenge — L’aventure continue !',greeting='Bonjour '+(String(row.name||'').trim().slice(0,120)||'')+',';return{subject,text:[greeting,...paragraphs,'L’équipe H&S AI Talent Challenge'].join('\n\n'),html:'<div style="font-family:Arial,sans-serif;color:#173450;max-width:580px;margin:auto;line-height:1.6"><div style="background:#102a4d;color:white;padding:24px;border-radius:12px"><small>H&S AI TALENT CHALLENGE</small><h1 style="font-size:26px">L’aventure continue !</h1></div><p>'+esc(greeting)+'</p>'+paragraphs.map((p,i)=>'<p>'+ (i===3?'<strong>'+esc(p)+'</strong>':esc(p))+'</p>').join('')+'<p><strong>L’équipe H&S AI Talent Challenge</strong></p></div>'}}
export function nonselectionBlock(row,ops){
 if(!row||row.status!=='rejected')return 'Décision RH Non retenu requise';
 if(row.invitedAt||ops.pass||ops.invitation)return 'Pass ou invitation existante — dossier protégé';
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email||''))return 'Adresse email invalide';
 if(row.nonselection)return 'Communication déjà enregistrée';
 return null;
}
export async function nonselectionAction({action,body,rh,operations,enabled,deliver,now=()=>new Date()}){
 const ok=(value,status=200)=>({value,status}),err=(error,status=409)=>ok({error},status);
 async function inspect(id){const row=await rh.get(id,{type:'json'});const ops=await operations(id);const blocker=nonselectionBlock(row,ops);return{id,state:row?.nonselection?.state||(blocker?'protected':'ready'),blocker,acceptedAt:row?.nonselection?.acceptedAt||null}}
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
