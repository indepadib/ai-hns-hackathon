import {createHmac,createHash,timingSafeEqual} from 'node:crypto';
export const guestRoles={keynote:'Keynote speaker',workshop:'Animateur d’atelier',mentor:'Mentor',jury:'Membre du jury',leadership:'Direction H&S',guest:'Invité interne',organizer:'Organisation'};
const text=(x,max)=>typeof x==='string'?x.trim().slice(0,max):'';
const html=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function validateGuest(input){
 const name=text(input?.name,150),email=text(input?.email,254).toLowerCase(),role=input?.role,session=text(input?.session,180),slot=text(input?.slot,5),department=text(input?.department,120);
 if(!name||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||/[\r\n]/.test(email)||!Object.hasOwn(guestRoles,role))throw Error('Nom, adresse email valide et rôle requis.');
 if(slot&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(slot))throw Error('Horaire invalide.');
 return {name,email,role,session,slot,department};
}
export const guestId=email=>createHash('sha256').update('hns-guest-v1:'+email).digest('hex').slice(0,32);
export const guestKey=id=>'event-guest-v1-'+id;
export const guestToken=(id,secret)=>id+'.'+createHmac('sha256',secret).update('guest-rsvp-v1:'+id).digest('hex');
export function verifyGuestToken(token,secret){
 if(typeof token!=='string'||! /^[a-f0-9]{32}\.[a-f0-9]{64}$/.test(token))return null;
 const id=token.split('.')[0],expected=guestToken(id,secret);return timingSafeEqual(Buffer.from(expected),Buffer.from(token))?id:null;
}
export function guestMail(row,secret){
 const url='https://ai.hns.ma/invites/#'+guestToken(row.id,secret);
 const role=guestRoles[row.role],details=[role,row.session,row.slot?'Créneau : '+row.slot+' (heure de Casablanca)':''].filter(Boolean).join(' · ');
 const subject='Invitation H&S AI Talent Challenge — '+role;
 const message='Bonjour '+row.name+',\n\nNous avons le plaisir de vous inviter au H&S AI Talent Challenge, le samedi 28 novembre 2026 à LA BASE, Casablanca. Accueil à 10 h.\n\nVotre rôle : '+details+'.\nVotre participation permettra d’accompagner les talents et de partager votre expertise au service de l’innovation chez H&S.\n\nMerci de confirmer votre disponibilité : '+url+'\nLieu : https://share.google/nBgf2AVHLM4jRQhqD\n\nAu plaisir de vous accueillir,\nL’équipe H&S AI Talent Challenge';
 return {subject,text:message,html:'<div style="font-family:Arial,sans-serif;color:#173450;max-width:580px;margin:auto"><div style="background:#102a4d;color:white;padding:26px;border-radius:12px"><small>H&S AI TALENT CHALLENGE 2026</small><h1>Votre expertise fait la différence.</h1><p>28 novembre · 10 h · LA BASE, Casablanca</p></div><p>Bonjour '+html(row.name)+',</p><p>Nous avons le plaisir de vous inviter à accompagner les talents lors du H&S AI Talent Challenge.</p><div style="background:#f0f5fb;padding:16px;border-radius:9px"><strong>Votre rôle</strong><p>'+html(details)+'</p></div><p>Merci de confirmer votre disponibilité.</p><p><a href="'+url+'" style="display:inline-block;background:#102a4d;color:white;padding:14px 18px;border-radius:8px;text-decoration:none">Répondre à l’invitation</a></p><p><a href="https://share.google/nBgf2AVHLM4jRQhqD">Consulter le lieu</a></p><p>L’équipe H&S AI Talent Challenge</p></div>'};
}
export async function guestAction({action,body,auth,db,secret,canSend,deliver,now=()=>new Date()}){
 const result=(value,status=200)=>({value,status}),error=(message,status=400)=>result({error:message},status);
 const publicAction=['guest-rsvp-read','guest-rsvp'].includes(action);
 if(!publicAction&&auth?.role!=='admin')return error('Accès organisation requis',403);
 if(action==='guest-list'){
  const guests=[];let cursor;do{const page=await db.list({prefix:'event-guest-v1-',...(cursor?{cursor}:{})});for(let i=0;i<page.blobs.length;i+=15){const rows=await Promise.all(page.blobs.slice(i,i+15).map(e=>db.get(e.key,{type:'json'})));guests.push(...rows.filter(Boolean))}cursor=page.cursor}while(cursor);
  return result({guests:guests.sort((a,b)=>a.name.localeCompare(b.name,'fr')),sendEnabled:canSend});
 }
 if(action==='guest-create'){
  let fields;try{fields=validateGuest(body.guest)}catch(e){return error(e.message)}
  const id=guestId(fields.email),row={id,...fields,mailStatus:'draft',rsvp:'pending',createdAt:now().toISOString(),version:0};
  const write=await db.setJSON(guestKey(id),row,{onlyIfNew:true});return write?.modified?result({guest:row},201):error('Cette adresse est déjà enregistrée.',409);
 }
 const id=publicAction?verifyGuestToken(body.token,secret):body.id;
 if(typeof id!=='string'||! /^[a-f0-9]{32}$/.test(id))return error('Invitation invalide',404);
 const key=guestKey(id),meta=await db.getWithMetadata(key,{type:'json'}),row=meta?.data;
 if(!row||!meta.etag)return error('Invitation introuvable',404);
 if(publicAction){
  if(now().getTime()>Date.parse('2026-11-29T00:00:00+01:00')||row.mailStatus!=='accepted'||row.revokedAt)return error('Invitation indisponible ou expirée',404);
  const safe=r=>({name:r.name,role:guestRoles[r.role],session:r.session,slot:r.slot,rsvp:r.rsvp,checkedInAt:r.checkedInAt||null});
  if(action==='guest-rsvp-read')return result({guest:safe(row)});
  if(!['confirmed','declined'].includes(body.response)||row.checkedInAt)return error('Réponse non modifiable',409);
  if(row.rsvp===body.response)return result({guest:safe(row)});
  const next={...row,rsvp:body.response,respondedAt:now().toISOString(),version:row.version+1};
  const write=await db.setJSON(key,next,{onlyIfMatch:meta.etag});return write?.modified?result({guest:safe(next)}):error('Invitation actualisée entre-temps. Réessayez.',409);
 }
 if(action==='guest-preview')return result({mail:guestMail(row,secret),guest:row});
 if(body.version!==row.version)return error('Fiche modifiée. Actualisez avant de poursuivre.',409);
 if(action==='guest-update'){
  if(row.mailStatus!=='draft'||row.revokedAt)return error('Invitation déjà traitée',409);
  let fields;try{fields=validateGuest({...body.guest,email:row.email})}catch(e){return error(e.message)}
  const next={...row,...fields,version:row.version+1};const write=await db.setJSON(key,next,{onlyIfMatch:meta.etag});return write?.modified?result({guest:next}):error('Fiche modifiée',409);
 }
 if(action==='guest-revoke'||action==='guest-checkin'){
  if(body.confirm!==true||row.mailStatus==='sending')return error('Confirmation requise ou envoi en cours',409);
  if(action==='guest-checkin'&&(row.mailStatus!=='accepted'||row.revokedAt||row.rsvp==='declined'))return error('Invitation non admissible',409);
  if(action==='guest-revoke'&&row.checkedInAt)return error('Présence déjà enregistrée',409);
  const next={...row,[action==='guest-revoke'?'revokedAt':'checkedInAt']:now().toISOString(),version:row.version+1};
  if(row.revokedAt||row.checkedInAt)return result({guest:row});
  const write=await db.setJSON(key,next,{onlyIfMatch:meta.etag});return write?.modified?result({guest:next}):error('Fiche modifiée',409);
 }
 if(action!=='guest-send')return error('Action inconnue',404);
 if(!canSend||body.confirm!==true||row.mailStatus!=='draft'||row.revokedAt)return error('Envoi désactivé, déjà traité ou non confirmé',409);
 const sending={...row,mailStatus:'sending',startedAt:now().toISOString(),version:row.version+1};
 const lock=await db.setJSON(key,sending,{onlyIfMatch:meta.etag});if(!lock?.modified)return error('Envoi déjà en cours',409);
 try{
  const receipt=await deliver({email:row.email,mail:guestMail(row,secret),id:'guest-'+id});
  if(!receipt?.id)throw Error('Acceptation non confirmée');
  const next={...sending,mailStatus:'accepted',acceptedAt:now().toISOString(),providerId:receipt.id,version:sending.version+1};
  const written=await db.setJSON(key,next,{onlyIfMatch:lock.etag});if(!written?.modified)throw Error('État non réconcilié');
  return result({guest:next});
 }catch{
  const next={...sending,mailStatus:'review_required',version:sending.version+1};await db.setJSON(key,next,{onlyIfMatch:lock.etag}).catch(()=>{});
  return error('Envoi à vérifier. Aucun nouvel envoi automatique.',503);
 }
}
