import {createHmac,createHash,timingSafeEqual} from 'node:crypto';
export const guestRoles={keynote:'Keynote speaker',business:'Représentant de verticale · Business Talk',workshop:'Animateur d’atelier',mentor:'Mentor',jury:'Membre du jury',leadership:'Direction H&S',guest:'Invité interne',organizer:'Organisation'};
export const verticals={property:'GIDNA / Kaya',media:'WB Group',retail:'One Retail',life:'Dislog / DMD',logistics:'La Voie Express / BLS',chari:'Chari Fintech',group:'H&S Groupe'};
const normalized=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const verticalKey=value=>{
 const raw=normalized(value);
 if(!raw)return '';
 if(raw==='industry'||raw==='industrie'||raw==='dmd'||raw==='dislog dmd')return 'life';
 const aliases={'one retail':'retail','la voie express':'logistics','bls':'logistics','gidna kaya':'property','gidna':'property','kaya':'property','wb group':'media','fintech':'chari','chari fintech':'chari','h s groupe':'group','groupe':'group','it rh':'group'};
 return Object.hasOwn(verticals,raw)?raw:aliases[raw]||Object.keys(verticals).find(k=>normalized(verticals[k])===raw)||null;
};
const validEmail=email=>typeof email==='string'&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)&&!/[\r\n]/.test(email);
const displayRow=row=>({...row,vertical:verticalKey(row.vertical)||''});
async function listGuests(db){
 const guests=[];let cursor;do{const page=await db.list({prefix:'event-guest-v1-',...(cursor?{cursor}:{})});for(let i=0;i<page.blobs.length;i+=15){const rows=await Promise.all(page.blobs.slice(i,i+15).map(e=>db.get(e.key,{type:'json'})));guests.push(...rows.filter(Boolean).map(displayRow))}cursor=page.cursor}while(cursor);
 return guests.sort((a,b)=>a.name.localeCompare(b.name,'fr'));
}
function planRows(raw){
 let value;try{value=typeof raw==='string'?JSON.parse(raw):raw}catch{return null}
 if(Array.isArray(value))return value;
 if(!value||typeof value!=='object')return null;
 for(const k of ['guests','invites','roster','profiles','invitees','people','entries'])if(Array.isArray(value[k]))return value[k];
 return null;
}
function planEntry(entry){
 if(Array.isArray(entry)){
  if(entry.length!==6||!entry.every(x=>typeof x==='string'))return null;
  const [name,oldVertical,department,role,slot,session]=entry;
  const vertical=verticalKey(oldVertical||'group');
  if(!name.trim()||!vertical||!Object.hasOwn(guestRoles,role)||(slot&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(slot)))return null;
  return {name,vertical,department,role,slot,session};
 }
 return entry&&typeof entry==='object'?entry:null;
}
function mergedPlan(plan,contacts){
 const primary=(planRows(plan)||[]).map(planEntry).filter(Boolean),extra=(planRows(contacts)||[]).map(planEntry).filter(Boolean),merged=new Map();
 for(const entry of extra){const name=normalized(entry?.name||entry?.fullName||entry?.full_name||entry?.nom);if(name)merged.set(name,entry)}
 for(const entry of primary){const name=normalized(entry?.name||entry?.fullName||entry?.full_name||entry?.nom);if(!name)continue;const previous=merged.get(name)||{};merged.set(name,{...previous,...entry,email:entry.email||entry.professionalEmail||previous.email||'',emailOptions:[...new Set([...(previous.emailOptions||[]),...(Array.isArray(entry.emailOptions)?entry.emailOptions:[])])]})}
 return [...merged.values()];
}
function planGuest(entry){
 if(!entry||typeof entry!=='object')throw Error('Fiche invalide');
 const rawRole=entry.role||entry.eventRole||'guest';
 const role=Object.hasOwn(guestRoles,rawRole)?rawRole:Object.keys(guestRoles).find(k=>normalized(guestRoles[k])===normalized(rawRole))||'guest';
 const vertical=verticalKey(entry.vertical||entry.verticalId||entry.track||entry.bu)||'';
 const fields=validateGuest({name:entry.name||entry.fullName||entry.full_name||entry.nom,email:entry.email||entry.professionalEmail||'',role:role==='business'&&!vertical?'guest':role,vertical,department:entry.department||entry.position||entry.title||entry.function||entry.fonction||'',session:entry.session||entry.topic||'',slot:entry.slot||''});
 const emailOptions=Array.isArray(entry.emailOptions)?[...new Set(entry.emailOptions.filter(validEmail).map(e=>e.toLowerCase()))].slice(0,5):[];
 return {...fields,emailOptions};
}

const briefMap={
 business:{duration:'7 minutes',format:'4 slides recommandées (3 à 5 maximum)',items:['Notre verticale : métiers, clients et création de valeur (1 min).','Notre réalité terrain : processus et principales difficultés (2 min).','Trois problématiques concrètes, avec exemples, impacts et données disponibles si possible (3 min).','Notre ambition Data & IA : résultats attendus et compétences utiles (1 min).'],note:'Présentez les problèmes sans imposer de solution technique. Utilisez uniquement des informations partageables avec les candidats.'},
 keynote:{duration:'10 minutes',format:'3 à 5 slides recommandées',items:['Contexte et ambition de H&S.','Un exemple concret ou une réalisation vérifiable.','Message clé et perspectives pour les talents.'],note:'Privilégiez une prise de parole inspirante et concrète.'},
 workshop:{duration:'15 minutes (proposition)',format:'3 à 5 slides ou une démonstration courte',items:['Objectif opérationnel de l’atelier.','Une méthode ou un exemple applicable au challenge.','Exercice pratique et résultat attendu.'],note:'Ne développez pas à la place des participants. Prévoyez une ressource ou un exemple réutilisable.'},
 mentor:{duration:'Pendant le Build Sprint',format:'Aucun support obligatoire',items:['Accompagner les équipes, clarifier les blocages et challenger les choix.','Consigner des observations factuelles et des questions pour le jury.'],note:'Ne pas fournir de solution toute faite.'},
 jury:{duration:'Créneau communiqué par l’organisation',format:'Aucun support obligatoire',items:['Prendre connaissance du barème officiel et des preuves attendues.','Évaluer les prototypes et poser des questions factuelles.'],note:'Les notes de projet et les observations individuelles restent distinctes.'}
};
export function guestBrief(row){return briefMap[row.role]||null}
const text=(x,max)=>typeof x==='string'?x.trim().slice(0,max):'';
const html=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function validateGuest(input){
 const name=text(input?.name,150),email=text(input?.email,254).toLowerCase(),role=input?.role,session=text(input?.session,180),slot=text(input?.slot,5),department=text(input?.department,120),vertical=verticalKey(input?.vertical);
 if(!name||(email&&!validEmail(email))||!Object.hasOwn(guestRoles,role))throw Error('Nom et rôle requis ; renseignez une adresse email valide si disponible.');
 if(slot&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(slot))throw Error('Horaire invalide.');
 if(vertical===null||role==='business'&&!vertical)throw Error('Sélectionnez une verticale H&S valide.');
 return {name,email,role,session,slot,department,vertical};
}
export const guestId=email=>createHash('sha256').update('hns-guest-v1:'+email).digest('hex').slice(0,32);
export const guestKey=id=>'event-guest-v1-'+id;
export const guestToken=(id,secret)=>id+'.'+createHmac('sha256',secret).update('guest-rsvp-v1:'+id).digest('hex');
export function verifyGuestToken(token,secret){
 if(typeof token!=='string'||! /^[a-f0-9]{32}\.[a-f0-9]{64}$/.test(token))return null;
 const id=token.split('.')[0],expected=guestToken(id,secret);return timingSafeEqual(Buffer.from(expected),Buffer.from(token))?id:null;
}
const guestMac=(id,secret)=>createHmac('sha256',secret).update('guest-checkin-v1:'+id.toLowerCase()).digest('hex').slice(0,32).toUpperCase();
export const guestQrPayload=(id,secret)=>'HNSG:'+id.toUpperCase()+':'+guestMac(id,secret);
export function guestQrId(code,secret){const m=/^HNSG:([A-F0-9]{32}):([A-F0-9]{32})$/.exec(code);if(!m)return null;const id=m[1].toLowerCase();return timingSafeEqual(Buffer.from(m[2]),Buffer.from(guestMac(id,secret)))?id:null}
export async function guestArrivalCount(db){return (await listGuests(db)).filter(r=>r.checkedInAt&&!r.revokedAt).length}
export async function scanGuestPass({db,secret,code,auth,now=()=>new Date()}){
 const err=(error,status=400)=>({status,value:{error}});
 if(!['admin','rh'].includes(auth?.role))return err('Accès accueil requis',403);
 const id=guestQrId(code,secret);if(!id)return err('QR invité invalide');
 const key=guestKey(id);
 for(let i=0;i<8;i++){
  const current=await db.getWithMetadata(key,{type:'json'}),row=current?.data;
  if(!row||!current.etag||row.mailStatus!=='accepted'||row.revokedAt||row.rsvp==='declined')return err('Pass invité non admissible',409);
  if(row.rsvp!=='confirmed'&&!row.checkedInAt)return err('Confirmation de présence requise pour ce pass invité',409);
  const value={kind:'guest',id,alias:row.name,guestRole:guestRoles[row.role],checkedInAt:row.checkedInAt};
  if(row.checkedInAt)return {status:200,value:{...value,alreadyPresent:true,guestPresent:await guestArrivalCount(db)}};
  const t=now();
  if(t.getTime()<Date.parse('2026-11-28T00:00:00+01:00')||t.getTime()>=Date.parse('2026-11-29T00:00:00+01:00'))return err('Le pass est valable le 28 novembre 2026 uniquement',409);
  const checkedInAt=t.toISOString(),next={...row,checkedInAt,version:(row.version||0)+1};
  const write=await db.setJSON(key,next,{onlyIfMatch:current.etag});
  if(write?.modified)return {status:200,value:{...value,checkedInAt,guestPresent:await guestArrivalCount(db)}};
 }
 return err('Scan concurrent : réessayez',409);
}
export function guestMail(row,secret){
 const url='https://ai.hns.ma/invites/#'+guestToken(row.id,secret);
 const role=guestRoles[row.role],brief=guestBrief(row),details=[role,verticals[row.vertical],row.session,row.slot?'Créneau : '+row.slot+' (heure de Casablanca)':''].filter(Boolean).join(' · ');
 const subject='Invitation H&S AI Talent Challenge — '+(row.role==='business'?'Business Talk · '+(verticals[row.vertical]||'Votre verticale'):role);
 const prep=brief?'\n\nPréparation de votre intervention — '+brief.duration+'\n'+brief.format+'.\n'+brief.items.map((x,i)=>(i+1)+'. '+x).join('\n')+'\n'+brief.note+( ['business','keynote','workshop'].includes(row.role)?'\nMerci de préparer votre support et, idéalement, de le transmettre à l’organisation avant vendredi 27 novembre à 18 h (heure de Casablanca), via votre espace personnel ci-dessous.':''):'';
 const prepHtml=brief?'<div style="margin:20px 0;padding:16px;border:1px solid #d4e1ef;border-radius:9px"><h2 style="font-size:18px">Préparation de votre intervention</h2><p><strong>'+html(brief.duration)+' · '+html(brief.format)+'</strong></p><ol>'+brief.items.map(x=>'<li>'+html(x)+'</li>').join('')+'</ol><p>'+html(brief.note)+'</p>'+(['business','keynote','workshop'].includes(row.role)?'<p>Idéalement, transmettez votre support avant vendredi 27 novembre à 18 h (heure de Casablanca) via votre espace personnel.</p>':'')+'</div>':'';
 const message='Bonjour '+row.name+',\n\nNous avons le plaisir de vous inviter au H&S AI Talent Challenge, le samedi 28 novembre 2026 à LA BASE, Casablanca. Accueil à 10 h.\n\nVotre rôle : '+details+'.\nVotre participation permettra d’accompagner les talents et de partager votre expertise au service de l’innovation chez H&S.'+prep+'\n\nMerci de confirmer votre disponibilité : '+url+'\nAprès confirmation, votre QR code personnel sera disponible dans ce même espace. Présentez-le à l’accueil le 28 novembre.\nLieu : https://share.google/nBgf2AVHLM4jRQhqD\n\nAu plaisir de vous accueillir,\nL’équipe H&S AI Talent Challenge';
 return {subject,text:message,html:'<div style="font-family:Arial,sans-serif;color:#173450;max-width:580px;margin:auto"><div style="background:#102a4d;color:white;padding:26px;border-radius:12px"><small>H&S AI TALENT CHALLENGE 2026</small><h1>Votre expertise fait la différence.</h1><p>28 novembre · 10 h · LA BASE, Casablanca</p></div><p>Bonjour '+html(row.name)+',</p><p>Nous avons le plaisir de vous inviter à accompagner les talents lors du H&S AI Talent Challenge.</p><div style="background:#f0f5fb;padding:16px;border-radius:9px"><strong>Votre rôle</strong><p>'+html(details)+'</p></div>'+prepHtml+'<p>Merci de confirmer votre disponibilité. Votre QR code personnel sera disponible dans cet espace après confirmation.</p><p><a href="'+url+'" style="display:inline-block;background:#102a4d;color:white;padding:14px 18px;border-radius:8px;text-decoration:none">Répondre à l’invitation</a></p><p><a href="https://share.google/nBgf2AVHLM4jRQhqD">Consulter le lieu</a></p><p>L’équipe H&S AI Talent Challenge</p></div>'};
}
export const guestSeedMarker='hns-event-guest-seed-2026-11-28-v1';
export async function runGuestSeed({db,guestPlan,guestContacts,now=()=>new Date()}){
 const previous=await db.get(guestSeedMarker,{type:'json'});
 if(previous?.state==='completed')return {...previous,alreadyCompleted:true};
 const expected=23,plan=mergedPlan(guestPlan,guestContacts);
 const report=async data=>{const r={...data,expected,at:now().toISOString()};await db.setJSON(guestSeedMarker,r);return r};
 if(plan.length!==expected)return report({state:'review_required',reason:'roster_count',planned:plan.length});
 let validated;
 try{validated=plan.map(planGuest)}catch{return report({state:'review_required',reason:'invalid_roster',planned:plan.length})}
 const emails=validated.map(x=>x.email).filter(Boolean);
 if(new Set(emails).size!==emails.length)return report({state:'review_required',reason:'duplicate_email',planned:plan.length});
 const imported=await guestAction({action:'guest-import-plan',body:{confirm:true},auth:{role:'admin'},db,canSend:false,guestPlan,guestContacts,now});
 const rows=await listGuests(db),matched=validated.filter(x=>rows.some(r=>normalized(r.name)===normalized(x.name))).length;
 const complete=imported.status===200&&matched===expected&&!imported.value.invalid;
 return report({state:complete?'completed':'review_required',planned:plan.length,matched,created:imported.value.created||0,skipped:imported.value.skipped||0,invalid:imported.value.invalid||0,emailReady:rows.filter(r=>!r.revokedAt&&validEmail(r.email)&&validated.some(v=>normalized(v.name)===normalized(r.name))).length});
}
export function guestSeedAllowed(event,readEnv,now=()=>new Date()){
 const site='33dae2ce-086d-4470-b6fe-248f3ca49b70';
 return event?.site?.id===site&&event?.deploy?.siteId===site&&event?.deploy?.context==='production'&&event?.deploy?.branch==='main'&&!!event?.deploy?.publishedAt&&readEnv('HNS_UNIFIED_PRODUCTION')==='true'&&now().getTime()<Date.parse('2026-11-28T09:00:00+01:00');
}
export const guestContactMarker='hns-event-guest-confirmed-contacts-v1';
export async function applyConfirmedGuestContacts({db,raw,now=()=>new Date(),expectedCount=10,marker=guestContactMarker}){
 if(!Number.isInteger(expectedCount)||expectedCount<1||expectedCount>23)return {state:'not_applied',reason:'expected_count'};
 const existing=await db.get(marker,{type:'json'});if(existing)return {...existing,alreadyApplied:true};
 const entries=planRows(raw);if(!entries||entries.length!==expectedCount)return {state:'not_applied',reason:'expected_count'};
 const inputs=entries.map(e=>({name:normalized(e?.name),email:text(e?.email,254).toLowerCase(),names:[normalized(e?.name),...(Array.isArray(e?.aliases)?e.aliases.map(normalized):[])].filter(Boolean)}));
 if(inputs.some(e=>!e.name||!validEmail(e.email))||new Set(inputs.map(e=>e.name)).size!==expectedCount||new Set(inputs.map(e=>e.email)).size!==expectedCount)return {state:'not_applied',reason:'invalid_confirmations'};
 const report={state:'completed',expected:expectedCount,updated:0,unchanged:0,protected:0,missing:0,conflicts:0,at:now().toISOString()};
 const rows=await listGuests(db);
 for(const input of inputs){
  const matches=rows.filter(row=>input.names.includes(normalized(row.name)));
  if(matches.length!==1){report[matches.length?'conflicts':'missing']++;continue}
  const match=matches[0],key=guestKey(match.id),meta=await db.getWithMetadata(key,{type:'json'}),row=meta?.data;
  if(!row||!meta.etag||!input.names.includes(normalized(row.name))){report.conflicts++;continue}
  if(row.email===input.email){report.unchanged++;continue}
  if(row.mailStatus!=='draft'||row.revokedAt||row.checkedInAt){report.protected++;continue}
  if((await listGuests(db)).some(r=>r.id!==row.id&&r.email===input.email)){report.conflicts++;continue}
  const next={...row,email:input.email,emailOptions:[],emailConfirmedAt:now().toISOString(),version:(row.version||0)+1};
  const write=await db.setJSON(key,next,{onlyIfMatch:meta.etag});report[write?.modified?'updated':'conflicts']++;
 }
 if(report.updated+report.unchanged!==report.expected)report.state='review_required';
 await db.setJSON(marker,report,{onlyIfNew:true});
 return report;
}

export async function guestAction({action,body,auth,db,secret,canSend,deliver,guestPlan,guestContacts,now=()=>new Date()}){
 const result=(value,status=200)=>({value,status}),error=(message,status=400)=>result({error:message},status);
 const publicAction=['guest-rsvp-read','guest-rsvp','guest-materials'].includes(action);
 if(!publicAction&&auth?.role!=='admin')return error('Accès organisation requis',403);
 if(action==='guest-list'){
  const guests=await listGuests(db),plan=mergedPlan(guestPlan,guestContacts);
  const existing=new Set(guests.map(g=>normalized(g.name)));
  const planMissing=plan.filter(e=>!existing.has(normalized(e.name||e.fullName||e.full_name||e.nom))).length;
  const importReport=await db.get(guestSeedMarker,{type:'json'});
  return result({guests,sendEnabled:canSend,planCount:plan.length,planMissing,importReport:importReport||null});
 }
 if(action==='guest-import-plan'){
  if(body.confirm!==true)return error('Confirmation de l’import requise.',409);
  const plan=mergedPlan(guestPlan,guestContacts);if(!plan||!plan.length||plan.length>200)return error('Liste privée non disponible ou format invalide.',409);
  const guests=await listGuests(db),names=new Set(guests.map(g=>normalized(g.name))),emails=new Set(guests.map(g=>g.email).filter(Boolean));
  let created=0,skipped=0,invalid=0;
  for(const entry of plan){
   let fields;try{fields=planGuest(entry)}catch{invalid++;continue}
   if(names.has(normalized(fields.name))||(fields.email&&emails.has(fields.email))){skipped++;continue}
   const id=guestId(fields.email||'draft:'+normalized(fields.name)),row={id,...fields,mailStatus:'draft',rsvp:'pending',createdAt:now().toISOString(),version:0};
   const write=await db.setJSON(guestKey(id),row,{onlyIfNew:true});
   if(write?.modified){created++;names.add(normalized(fields.name));if(fields.email)emails.add(fields.email)}else skipped++;
  }
  return result({created,skipped,invalid});
 }
 if(action==='guest-create'){
  let fields;try{fields=validateGuest(body.guest)}catch(e){return error(e.message)}
  const existing=await listGuests(db);if(existing.some(g=>normalized(g.name)===normalized(fields.name)||(fields.email&&g.email===fields.email)))return error('Cet invité est déjà enregistré.',409);
  const id=guestId(fields.email||'draft:'+normalized(fields.name)),row={id,...fields,mailStatus:'draft',rsvp:'pending',createdAt:now().toISOString(),version:0};
  const write=await db.setJSON(guestKey(id),row,{onlyIfNew:true});return write?.modified?result({guest:row},201):error('Cette adresse est déjà enregistrée.',409);
 }
 const id=publicAction?verifyGuestToken(body.token,secret):body.id;
 if(typeof id!=='string'||! /^[a-f0-9]{32}$/.test(id))return error('Invitation invalide',404);
 const key=guestKey(id),meta=await db.getWithMetadata(key,{type:'json'}),row=meta?.data?displayRow(meta.data):null;
 if(!row||!meta.etag)return error('Invitation introuvable',404);
 if(publicAction){
  if(now().getTime()>Date.parse('2026-11-29T00:00:00+01:00')||row.mailStatus!=='accepted'||row.revokedAt)return error('Invitation indisponible ou expirée',404);
  const safe=r=>({name:r.name,role:guestRoles[r.role],vertical:verticals[r.vertical]||'',session:r.session,slot:r.slot,rsvp:r.rsvp,checkedInAt:r.checkedInAt||null,brief:guestBrief(r),materials:r.materials||null,canShareMaterials:['business','keynote','workshop'].includes(r.role),...(r.rsvp==='confirmed'&&!r.checkedInAt?{passCode:guestQrPayload(r.id,secret)}:{})});
  if(action==='guest-rsvp-read')return result({guest:safe(row)});
  if(action==='guest-materials'){
   if(!['business','keynote','workshop'].includes(row.role))return error('Ce rôle ne requiert pas de support',403);
   const title=text(body.materials?.title,180),link=text(body.materials?.link,1200),notes=text(body.materials?.notes,1800);
   let url;try{url=new URL(link)}catch{return error('Lien HTTPS valide requis.')}
   if(url.protocol!=='https:'||url.username||url.password||!title)return error('Titre et lien HTTPS requis.');
   const next={...row,materials:{title,link:url.href,notes,submittedAt:now().toISOString()},version:row.version+1};
   const write=await db.setJSON(key,next,{onlyIfMatch:meta.etag});return write?.modified?result({guest:safe(next)}):error('Fiche actualisée. Réessayez.',409);
  }
  if(!['confirmed','declined'].includes(body.response)||row.checkedInAt)return error('Réponse non modifiable',409);
  if(row.rsvp===body.response)return result({guest:safe(row)});
  const next={...row,rsvp:body.response,respondedAt:now().toISOString(),version:row.version+1};
  const write=await db.setJSON(key,next,{onlyIfMatch:meta.etag});return write?.modified?result({guest:safe(next)}):error('Invitation actualisée entre-temps. Réessayez.',409);
 }
 if(action==='guest-preview')return result({mail:guestMail(row,secret),guest:row});
 if(body.version!==row.version)return error('Fiche modifiée. Actualisez avant de poursuivre.',409);
 if(action==='guest-update'){
  if(row.mailStatus!=='draft'||row.revokedAt)return error('Invitation déjà traitée',409);
  let fields;try{fields=validateGuest({...body.guest,email:row.email||body.guest?.email})}catch(e){return error(e.message)}
  if(fields.email&&(await listGuests(db)).some(g=>g.id!==id&&g.email===fields.email))return error('Cette adresse est déjà enregistrée.',409);
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
 if(!canSend||!validEmail(row.email)||body.confirm!==true||row.mailStatus!=='draft'||row.revokedAt)return error('Envoi désactivé, déjà traité ou non confirmé',409);
 if((await listGuests(db)).some(g=>g.id!==id&&g.email===row.email))return error('Adresse en double : vérifiez les fiches avant l’envoi.',409);
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
