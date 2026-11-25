import {createHmac,createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {validateObservation,dimensions,phases,followups} from './talent-observations.mjs';
import {teamSignals} from './team-signals.mjs';
import {qrId} from './invitation-email.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex'),idOk=s=>typeof s==='string'&&/^[a-f0-9]{32}$/.test(s),clip=(s,n)=>typeof s==='string'?s.trim().slice(0,n):'';
const until=Date.parse('2026-11-29T00:00:00+01:00');
const mk=id=>'scout-mentor-v1-'+id,nk=id=>'talent-observation-v1-'+id;
const mac=(id,secret)=>createHmac('sha256',secret).update('scout-badge-v1:'+id).digest('hex').slice(0,32).toUpperCase();
export const scoutBadge=(id,secret)=>'HNST:'+id.toUpperCase()+':'+mac(id,secret);
export function scoutId(value,secret){const m=/^HNST:([A-F0-9]{32}):([A-F0-9]{32})$/.exec(value);if(!m)return qrId(value,secret);const id=m[1].toLowerCase();return timingSafeEqual(Buffer.from(m[2]),Buffer.from(mac(id,secret)))?id:null}
export const levels={1:'A besoin d’un accompagnement important',2:'En progression avec assistance',3:'Autonome sur la contribution observée',4:'Maîtrise démontrée et choix argumentés'};
export function validateScoutObservation(input,observer){const n=validateObservation({...input,observer});const level=input?.level===null||input?.level===''?null:Number(input?.level);if(level!==null&&!Object.hasOwn(levels,level))throw Error('Niveau invalide. Choisissez non observé si nécessaire.');const recommendation=input?.recommendation||'none';if(!Object.hasOwn(followups,recommendation))throw Error('Suite invalide.');return {...n,level,recommendation,source:'field-mentor'};}
const safeMentor=r=>({id:r.id,name:r.name,assigned:r.assigned,revoked:!!r.revokedAt});
const parse=s=>{try{const x=JSON.parse(s||'{}');return x&&typeof x==='object'?x:{}}catch{return {}}};
async function readMentors(db){let cursor,out=[];do{const page=await db.list({prefix:'scout-mentor-v1-',...(cursor?{cursor}:{})});for(const e of page.blobs){const r=await db.get(e.key,{type:'json'});if(r)out.push(r)}cursor=page.cursor}while(cursor);return out}
export async function scoutAction({action,body={},auth,db,secret,listParticipants,recruitmentCandidate,renderQR,sign,now=()=>new Date()}){
 const ok=(value,status=200)=>({value,status}),fail=(error,status=400)=>ok({error},status),clock=now().getTime();
 if(clock>=until)return fail('Accès terrain expiré.',403);
 const manager=['admin','rh'].includes(auth?.role),admin=auth?.role==='admin';
 if(action==='scout-badge'){
  if(auth?.role!=='participant'||!idOk(auth.id))return fail('Accès participant requis',403);
  const p=await db.get('participant-'+auth.id,{type:'json'});if(!p||p.status!=='active'||!p.checkedInAt)return fail('Présence requise',403);
  const code=scoutBadge(auth.id,secret);return ok({code,qrCode:await renderQR(code)});
 }
 if(action==='scout-login'){
  const code=clip(body.code,80).toUpperCase();if(!/^[A-F0-9]{32}$/.test(code))return fail('Code mentor invalide',401);
  const id=sha(code).slice(0,32),r=await db.get(mk(id),{type:'json'});if(!r||r.revokedAt)return fail('Code mentor invalide ou révoqué',401);
  return ok({role:'mentor',token:sign({role:'mentor',id,exp:Math.min(clock+8*3600000,until)},secret),name:r.name});
 }
 let mentor=null;
 if(auth?.role==='mentor'&&idOk(auth.id)){mentor=await db.get(mk(auth.id),{type:'json'});if(!mentor||mentor.revokedAt)return fail('Accès mentor révoqué',403)}
 if(!manager&&!mentor)return fail('Accès organisation ou mentor requis',403);
 const people=()=>listParticipants(db),allowed=id=>manager||mentor.assigned.includes(id);
 if(action==='scout-session')return ok({role:auth.role,name:mentor?.name||'Organisation'});
 if(action==='scout-mentors'){if(!admin)return fail('Accès administrateur requis',403);return ok({mentors:(await readMentors(db)).map(safeMentor)})}
 if(action==='scout-create'||action==='scout-assign'||action==='scout-revoke'){
  if(!admin)return fail('Accès administrateur requis',403);
  const assigned=Array.isArray(body.assigned)?[...new Set(body.assigned)]:[],valid=new Set((await people()).filter(p=>['active','invited'].includes(p.status)).map(p=>p.id));
  if(action!=='scout-revoke'&&(assigned.length>80||assigned.some(id=>!valid.has(id))))return fail('Affectations invalides');
  if(action==='scout-create'){
   const name=clip(body.name,100);if(name.length<3)return fail('Nom du mentor requis');
   const code=randomBytes(16).toString('hex').toUpperCase(),id=sha(code).slice(0,32),r={id,name,assigned,createdAt:now().toISOString()};
   if(!(await db.setJSON(mk(id),r,{onlyIfNew:true}))?.modified)return fail('Réessayez',409);return ok({mentor:safeMentor(r),code},201);
  }
  if(!idOk(body.id)||body.confirm!==true)return fail('Confirmation requise');
  const m=await db.getWithMetadata(mk(body.id),{type:'json'});if(!m?.data||m.data.revokedAt)return fail('Mentor indisponible',404);
  const next={...m.data,...(action==='scout-revoke'?{revokedAt:now().toISOString()}:{assigned})};
  if(!(await db.setJSON(mk(body.id),next,{onlyIfMatch:m.etag}))?.modified)return fail('Actualisez le mentor',409);return ok({mentor:safeMentor(next)});
 }
 if(action==='scout-directory'){
  const rows=(await people()).filter(p=>allowed(p.id)&&(manager?['active','invited'].includes(p.status):p.status==='active'&&p.checkedInAt));
  const data=await Promise.all(rows.map(async p=>{const notes=(await db.get(nk(p.id),{type:'json'}))?.notes||[];const own=mentor?notes.filter(n=>n.mentorId===mentor.id):notes;return {id:p.id,alias:p.alias,present:p.status==='active'&&!!p.checkedInAt,count:notes.length,ownCount:own.length}}));
  return ok({people:data.sort((a,b)=>a.count-b.count||a.alias.localeCompare(b.alias,'fr'))});
 }
 const id=action==='scout-scan'?scoutId(clip(body.code,80).toUpperCase(),secret):body.id;
 if(!idOk(id)||!allowed(id))return fail('Candidat non attribué ou code invalide',403);
 const p=await db.get('participant-'+id,{type:'json'});
 if(!p||p.status!=='active'||!p.checkedInAt)return fail('Candidat non présent',404);
 if(action==='scout-profile'||action==='scout-scan'){
  const matching=await db.get('matching-state-v2',{type:'json'}),teamId=matching?.teams?.[id],team=teamId?await db.get('team-'+teamId,{type:'json'}):null,dossier=team||p,w=dossier.workspace||{},problem=parse(w.problem?.summary),solution=parse(w.solution?.summary);
  const candidate=await recruitmentCandidate(p.candidateId),d=candidate?.data||{};
  const profile=await db.get(nk(id),{type:'json'})||{version:0,notes:[]};
  return ok({id,alias:p.alias,school:clip(candidate?.school||d.school,140),background:clip(d.status,140),cvAvailable:manager&&!!(candidate?.hasCV||candidate?.cvFile),team:team?.alias||'Solo / non associé',challenge:clip(w.challenge?.id,100),vertical:clip(w.challenge?.vertical,80),problem:clip(problem.problem,700),approach:clip(solution.model||solution.approach,700),signals:teamSignals(w),submitted:!!dossier.submitted,updatedAt:dossier.updatedAt||null,count:profile.notes.length,notes:manager?profile.notes:profile.notes.filter(n=>n.mentorId===mentor.id)});
 }
 if(action==='scout-observe'){
  let note;try{note=validateScoutObservation(body.observation,mentor?.name||clip(body.observation?.observer,100)||'Organisation')}catch(e){return fail(e.message)}
  const requestId=clip(body.requestId,80);if(!/^[a-f0-9-]{36}$/i.test(requestId))return fail('Référence requise');
  for(let i=0;i<8;i++){
   const meta=await db.getWithMetadata(nk(id),{type:'json'}),profile=meta?.data||{version:0,notes:[],followup:{status:'none'}};
   const actor=mentor?.id||'organisation';if(profile.notes.some(n=>n.requestId===requestId&&n.mentorId===actor))return ok({saved:true,replayed:true});
   if(profile.notes.length>=80)return fail('Limite de 80 observations atteinte',409);
   const at=now().toISOString(),entry={...note,id:randomBytes(12).toString('hex'),requestId,mentorId:actor,at},next={...profile,notes:[...profile.notes,entry],version:(profile.version||0)+1,updatedAt:at};
   if((await db.setJSON(nk(id),next,meta?.etag?{onlyIfMatch:meta.etag}:{onlyIfNew:true}))?.modified)return ok({saved:true,note:entry});
  }
  return fail('Conflit de sauvegarde. Réessayez.',409);
 }
 return fail('Action inconnue',404);
}
