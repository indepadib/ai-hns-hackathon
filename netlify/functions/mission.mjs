import QRCode from 'qrcode';
import {getStore} from '@netlify/blobs';
import {createHmac,createHash,randomBytes,timingSafeEqual} from 'node:crypto';

const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
const fail=(message,status=400,code='REQUEST_FAILED')=>json({error:message,code},status);
const hash=value=>createHash('sha256').update(String(value)).digest('hex');
const equal=(a,b)=>{const aa=Buffer.from(String(a)),bb=Buffer.from(String(b));return aa.length===bb.length&&timingSafeEqual(aa,bb)};
const encode=data=>Buffer.from(JSON.stringify(data)).toString('base64url');
const sign=(data,secret)=>{const payload=encode(data);return payload+'.'+createHmac('sha256',secret).update(payload).digest('base64url')};
const verify=(token,secret)=>{try{const[p,s]=token.split('.');if(!p||!s)return null;const expected=createHmac('sha256',secret).update(p).digest('base64url');if(!equal(expected,s))return null;const data=JSON.parse(Buffer.from(p,'base64url').toString('utf8'));if(!data||!Number.isFinite(data.exp)||data.exp<Date.now())return null;if(!['admin','rh','jury','participant'].includes(data.role))return null;return data}catch{return null}};
const validId=id=>typeof id==='string'&&/^[a-f0-9]{32}$/.test(id);
const participantKey=id=>'participant-'+id;
const within=(s,max)=>String(s??'').trim().slice(0,max);
const readEnv=name=>{const native=globalThis.Netlify?.env?.get(name);return (native||process.env[name]||'').trim()};
const env={admin:'HNS_ADMIN_KEY',rh:'HNS_RH_KEY',jury:'HNS_JURY_KEY'};
const scoresNames=['problem','design','build','test','demo'];
function store(){return getStore({name:'hns-ai-mission-control',consistency:'strong'})}
async function listParticipants(db){const out=[];let cursor;do{const page=await db.list({prefix:'participant-',...(cursor?{cursor}:{})});for(const entry of page.blobs){const rec=await db.get(entry.key,{type:'json'});if(rec)out.push({id:entry.key.slice(12),alias:rec.alias,team:rec.team||'',teamSize:rec.teamSize||1,status:rec.status||'active',submitted:!!rec.submitted,checkedInAt:rec.checkedInAt||null,submittedAt:rec.submittedAt||null,score:rec.score||null})}cursor=page.cursor}while(cursor&&out.length<1000);return out}
const defaultSchedule=()=>[['checkin','Accueil', '10:00'],['briefing','Briefing','10:30'],['matching','Matching','11:00'],['challenge','Choix du challenge','11:45'],['problem','Problem Canvas','12:15'],['solution','AI Solution Canvas','13:30'],['build','Build Sprint','14:15'],['redteam','Red Team','15:45'],['pitch','Pitch final','16:15'],['submission','Soumission et jury','17:15']].map(([id,label,time])=>({id,label,opensAt:Date.parse('2026-11-28T'+time+':00+01:00')}));
export const config = { rateLimit: { action: 'rate_limit', windowLimit: 30, windowSize: 60, aggregateBy: ['ip'] } };
export default async function handler(request){
 if(request.method==='GET'){const ready=readEnv('HNS_SESSION_SECRET').length>=32&&Object.values(env).every(name=>readEnv(name).length>=8);console.info('HNS_RUNTIME_HEALTH',JSON.stringify(Object.fromEntries(['HNS_SESSION_SECRET',...Object.values(env)].map(name=>[name,!readEnv(name)?'missing':readEnv(name).length<(name==='HNS_SESSION_SECRET'?32:8)?'too_short':'ready']))));return json({status:ready?'ok':'configuration_required',service:'hns-mission',version:'runtime-health-v2'},ready?200:503)}
 if(request.method!=='POST')return fail('Méthode non autorisée',405);
 if(Number(request.headers.get('content-length')||0)>250000)return fail('Requête trop volumineuse',413);
 const secret=readEnv('HNS_SESSION_SECRET');
 if(!secret||secret.length<32){console.error('HNS_CONFIGURATION_INVALID HNS_SESSION_SECRET');return fail('Configuration de session indisponible',503,'SESSION_NOT_CONFIGURED')}
 let body;
 try{body=await request.json();if(!body||typeof body!=='object'||Array.isArray(body))throw Error('invalid');if(JSON.stringify(body).length>200000)return fail('Requête trop volumineuse',413)}catch{return fail('Corps JSON invalide',400)}
 const action=body.action;
 const loginRoles={'admin-login':'admin','rh-login':'rh','jury-login':'jury'};
 if(Object.hasOwn(loginRoles,action)){
  const role=loginRoles[action],key=readEnv(env[role]);
  if(!key||key.length<8){console.error('HNS_CONFIGURATION_INVALID '+env[role]);return fail('Accès '+role+' non configuré',503,'ROLE_NOT_CONFIGURED')}
  if(typeof body.password!=='string'||body.password.length>256||!equal(hash(body.password),hash(key)))return fail('Identifiants incorrects',401,'INVALID_CREDENTIALS');
  return json({role,token:sign({role,exp:Date.now()+4*60*60*1000},secret)});
 }
 try{
 const db=store();
  if(action==='participant-login'){
   const code=within(body.code,80).toUpperCase();
   if(!/^[A-F0-9]{24}$/.test(code))return fail('Code invalide',401);
   const id=hash(code).slice(0,32),rec=await db.get(participantKey(id),{type:'json'});
   if(!rec||!equal(rec.codeHash,hash(code))||rec.status!=='active')return fail('Code inconnu ou désactivé',401);
   return json({role:'participant',id,token:sign({role:'participant',id,exp:Date.now()+8*60*60*1000},secret)});
  }
  const raw=String(request.headers.get('authorization')||''),token=raw.replace(/^Bearer\s+/i,'');
  const auth=verify(token,secret);
  if(!auth)return fail('Session absente ou expirée',401,'NOT_AUTHENTICATED');
  if(action==='me')return json({role:auth.role,id:auth.id||null});
  if(action==='schedule'||action==='schedule-update'){
   const defaults=defaultSchedule();
   let stages=await db.get('event-schedule',{type:'json'})||defaults;
   if(action==='schedule-update'){
    if(auth.role!=='admin')return fail('Accès administrateur requis',403);
    const index=stages.findIndex(x=>x.id===body.stage);
    if(index<0||!Number.isSafeInteger(body.opensAt)||body.opensAt<0||body.opensAt>8640000000000000)return fail('Horaire invalide');
    stages[index]={...stages[index],opensAt:body.opensAt};
    await db.setJSON('event-schedule',stages);
   }
   const now=Date.now();
   return json({now,stages:stages.map(x=>({...x,unlocked:now>=x.opensAt}))});
  }
  if(action==='team-dashboard'){
   if(!['admin','jury'].includes(auth.role))return fail('Accès interdit',403);
   const people=await listParticipants(db),teams=[],assigned=new Set();
   let cursor;
   do{
    const page=await db.list({prefix:'team-',...(cursor?{cursor}:{})});
    for(const entry of page.blobs){
     const t=await db.get(entry.key,{type:'json'});
     if(!t||!Array.isArray(t.members))continue;
     t.members.forEach(id=>assigned.add(id));
     teams.push({id:entry.key.slice(5),alias:t.alias,members:t.members.map(id=>people.find(p=>p.id===id)?.alias||id),submitted:!!t.submitted,submittedAt:t.submittedAt||null,score:t.score||null,progress:Object.keys(t.workspace||{}).filter(k=>JSON.stringify(t.workspace[k]).length>10).length});
    }
    cursor=page.cursor;
   }while(cursor);
   for(const p of people.filter(p=>p.status==='active'&&!assigned.has(p.id))){
    const rec=await db.get(participantKey(p.id),{type:'json'});
    teams.push({id:p.id,alias:p.alias,members:[p.alias],submitted:p.submitted,submittedAt:p.submittedAt,score:p.score,progress:Object.keys(rec?.workspace||{}).filter(k=>JSON.stringify(rec.workspace[k]).length>10).length});
   }
   return json({teams:teams.filter(t=>auth.role==='admin'||t.submitted).sort((a,b)=>(b.score?.total??-1)-(a.score?.total??-1))});
  }
  if(action==='staff-list'){
   if(!['admin','rh'].includes(auth.role))return fail('Accès RH requis',403);
   return json({participants:await listParticipants(db)});
  }
  if(action==='jury-list'){
   if(auth.role!=='jury')return fail('Accès jury requis',403);
   const people=await listParticipants(db);
   const participants=people.filter(p=>p.submitted).map(p=>({id:p.id,alias:p.alias,team:p.team,submittedAt:p.submittedAt,score:p.score}));
   let cursor;const assigned=new Set();
   do{const page=await db.list({prefix:'team-',...(cursor?{cursor}:{})});for(const entry of page.blobs){const t=await db.get(entry.key,{type:'json'});if(!t)continue;(t.members||[]).forEach(id=>assigned.add(id));if(t.submitted)participants.push({id:entry.key.slice(5),alias:t.alias,team:(t.members||[]).map(id=>people.find(p=>p.id===id)?.alias||id).join(' / '),submittedAt:t.submittedAt,score:t.score||null})}cursor=page.cursor}while(cursor);
   return json({participants:participants.filter(p=>!assigned.has(p.id)).sort((a,b)=>(b.score?.total??-1)-(a.score?.total??-1))});
  }
  if(action==='invitation-details'){
   if(!['admin','rh'].includes(auth.role))return fail('Accès RH requis',403);
   const candidateId=within(body.candidateId,160);
   if(!candidateId)return fail('Référence candidat obligatoire');
   const code=createHmac('sha256',secret).update('invitation-v1:'+candidateId).digest('hex').slice(0,24).toUpperCase();
   const id=hash(code).slice(0,32),rec=await db.get(participantKey(id),{type:'json'});
   if(!rec||rec.status==='revoked')return fail('Invitation indisponible',404);
   const qrCode=await QRCode.toDataURL(code,{errorCorrectionLevel:'M',margin:4,width:320});
   return json({id,alias:rec.alias,code,qrCode,status:rec.status,participantUrl:'https://ai.hns.ma/mission-control/'});
  }
  if(action==='sync-recruitment'){
   if(!['admin','rh'].includes(auth.role))return fail('Accès RH requis',403);
   const recruitmentKey=readEnv('HNS_RECRUITMENT_KEY');
   if(!recruitmentKey)return fail('Connexion recrutement non configurée',503);
   const response=await fetch('https://ai.hns.ma/.netlify/functions/candidates-admin',{headers:{Authorization:'Bearer '+recruitmentKey},redirect:'error',signal:AbortSignal.timeout(15000)});
   if(!response.ok)return fail('Source recrutement indisponible',502);
   const payload=await response.json();
   const rows=Array.isArray(payload)?payload:payload.records||payload.candidates||payload.items;
   if(!Array.isArray(rows))return fail('Format recrutement inconnu',502);
   let created=0,existing=0;
   for(const row of rows){
    if(!['selected','invited','confirmed'].includes(row.status))continue;
    const candidateId=within(row.id,160),alias=within(row.name,70);
    if(!candidateId||!alias)continue;
    const code=createHmac('sha256',secret).update('invitation-v1:'+candidateId).digest('hex').slice(0,24).toUpperCase();
    const id=hash(code).slice(0,32),key=participantKey(id);
    if(await db.get(key,{type:'json'})){existing++;continue}
    const result=await db.setJSON(key,{candidateId,alias,codeHash:hash(code),status:'invited',version:0,workspace:{},submitted:false,checkedInAt:null},{onlyIfNew:true});
    if(result?.modified===false)existing++;else created++;
   }
   return json({created,existing});
  }
  if(action==='prepare-invitation'){
   if(!['admin','rh'].includes(auth.role))return fail('Accès RH requis',403);
   const candidateId=within(body.candidateId,160),alias=within(body.alias,70);
   if(!candidateId||!alias)return fail('Référence candidat et nom obligatoires');
   const code=createHmac('sha256',secret).update('invitation-v1:'+candidateId).digest('hex').slice(0,24).toUpperCase();
   const id=hash(code).slice(0,32),key=participantKey(id);
   const existing=await db.get(key,{type:'json'});
   if(existing?.status==='revoked')return fail('Invitation révoquée',409);
   if(!existing)await db.setJSON(key,{candidateId,alias,codeHash:hash(code),status:'invited',version:0,workspace:{},submitted:false,checkedInAt:null},{onlyIfNew:true});
   const qrCode=await QRCode.toDataURL(code,{errorCorrectionLevel:'M',margin:4,width:320});
   return json({id,code,qrCode,alias:existing?.alias||alias,status:existing?.status||'invited'});
  }
  if(action==='scan-invitation'){
   if(!['admin','rh'].includes(auth.role))return fail('Accès RH requis',403);
   const code=within(body.code,80).toUpperCase();
   if(!/^[A-F0-9]{24}$/.test(code))return fail('Code invalide');
   const id=hash(code).slice(0,32),key=participantKey(id);
   const rec=await db.get(key,{type:'json'});
   if(!rec||!equal(rec.codeHash,hash(code))||!rec.candidateId||!['invited','active'].includes(rec.status))return fail('Invitation inconnue ou révoquée',404);
   if(rec.status==='active')return json({id,alias:rec.alias,checkedInAt:rec.checkedInAt,alreadyPresent:true});
   rec.status='active';rec.checkedInAt=new Date().toISOString();
   await db.setJSON(key,rec);
   return json({id,alias:rec.alias,checkedInAt:rec.checkedInAt});
  }
  if(action==='checkin')return fail('Scan QR obligatoire',403,'QR_REQUIRED');
  if(action==='revoke'){
   if(!['admin','rh'].includes(auth.role))return fail('Accès RH requis',403);
   if(!validId(body.id))return fail('Identifiant invalide');
   const key=participantKey(body.id),rec=await db.get(key,{type:'json'});
   if(!rec)return fail('Participant inconnu',404);
   rec.status='revoked';rec.revokedAt=new Date().toISOString();await db.setJSON(key,rec);return json({revoked:true});
  }
  if(action==='jury-dossier'){
   if(auth.role!=='jury')return fail('Accès jury requis',403);
   if(!validId(body.id))return fail('Identifiant invalide');
   const rec=await db.get('team-'+body.id,{type:'json'})||await db.get(participantKey(body.id),{type:'json'});
   if(!rec||!rec.submitted)return fail('Dossier non soumis',404);
   return json({id:body.id,alias:rec.alias,team:rec.team,workspace:rec.workspace||{},submittedAt:rec.submittedAt,score:rec.score||null});
  }
  if(action==='jury-score'){
   if(auth.role!=='jury')return fail('Accès jury requis',403);
   if(!validId(body.id))return fail('Identifiant invalide');
   const values=body.scores;
   if(!values||typeof values!=='object'||!scoresNames.every(k=>Number.isInteger(values[k])&&values[k]>=0&&values[k]<=100))return fail('Notes invalides : 0 à 100');
   const team=await db.get('team-'+body.id,{type:'json'}),key=team?'team-'+body.id:participantKey(body.id),rec=team||await db.get(key,{type:'json'});
   if(!rec||!rec.submitted)return fail('Dossier non soumis',409);
   const total=Math.round((values.problem*.2+values.design*.2+values.build*.25+values.test*.2+values.demo*.15)*100)/100;
   rec.scoreHistory=Array.isArray(rec.scoreHistory)?rec.scoreHistory.slice(-99):[];
   if(rec.score)rec.scoreHistory.push(rec.score);
   rec.score={scores:Object.fromEntries(scoresNames.map(k=>[k,values[k]])),total,scoredAt:new Date().toISOString()};
   await db.setJSON(key,rec);return json({score:rec.score});
  }
  if(auth.role!=='participant'||!validId(auth.id))return fail('Accès participant requis',403);
  const key=participantKey(auth.id),rec=await db.get(key,{type:'json'});
  if(!rec||rec.status!=='active')return fail('Accès désactivé',403);
  const schedule=await db.get('event-schedule',{type:'json'})||defaultSchedule();
  const isOpen=id=>schedule.some(stage=>stage.id===id&&Date.now()>=stage.opensAt);
  if(['matching-list','matching-choice'].includes(action)&&!isOpen('matching'))return fail('Matching pas encore ouvert',403,'STAGE_LOCKED');
  if(action==='submit'&&!isOpen('submission'))return fail('Soumission pas encore ouverte',403,'STAGE_LOCKED');
  if(action==='matching-list'){
   const people=await listParticipants(db);
   return json({people:people.filter(p=>p.id!==auth.id&&p.status==='active'&&p.checkedInAt&&!p.team).map(p=>({id:p.id,alias:p.alias})),choice:rec.matchChoice||null,team:rec.team||null});
  }
  if(action==='matching-choice'){
   const lock=await db.setJSON('matching-lock',{at:Date.now()},{onlyIfNew:true});
   if(!lock?.modified)return fail('Matching occupé, réessayez dans un instant',409);
   try{
   const current=await db.get(key,{type:'json'});
   if(!current||current.status!=='active')return fail('Accès désactivé',403);
   Object.assign(rec,current);
   if(rec.team||rec.submitted)return fail('Choix déjà verrouillé',409);
   if(validId(rec.matchChoice)){
    const existingTeam=await db.get('team-'+hash([auth.id,rec.matchChoice].sort().join(':')).slice(0,32),{type:'json'});
    if(existingTeam?.members?.includes(auth.id))return fail('Binôme déjà constitué',409);
   }
   if(!rec.checkedInAt)return fail('Présence requise',403);
   const target=body.target;
   if(target!=='solo'&&(!validId(target)||target===auth.id))return fail('Choix invalide');
   if(target!=='solo'){
    const peer=await db.get(participantKey(target),{type:'json'});
    if(!peer||peer.status!=='active'||!peer.checkedInAt||peer.team)return fail('Participant indisponible',409);
    if(validId(peer.matchChoice)){
     const existingTeam=await db.get('team-'+hash([target,peer.matchChoice].sort().join(':')).slice(0,32),{type:'json'});
     if(existingTeam?.members?.includes(target))return fail('Participant déjà en binôme',409);
    }
   }
   rec.matchChoice=target;
   await db.setJSON(key,rec);
   if(target==='solo')return json({choice:target,mutual:false});
   const peer=await db.get(participantKey(target),{type:'json'});
   if(peer?.matchChoice!==auth.id)return json({choice:target,mutual:false});
   const members=[auth.id,target].sort(),teamId=hash(members.join(':')).slice(0,32);
   const teamKey='team-'+teamId;
   await db.setJSON(teamKey,{members,alias:'Binôme '+teamId.slice(0,6).toUpperCase(),workspace:{},version:0,submitted:false},{onlyIfNew:true});
   return json({choice:target,mutual:true,teamId});
   }finally{await db.delete('matching-lock')}
  }
  if(action==='load'){
   let dossier=rec,teamId=null;
   if(validId(rec.matchChoice)){
    const members=[auth.id,rec.matchChoice].sort(),id=hash(members.join(':')).slice(0,32);
    const team=await db.get('team-'+id,{type:'json'});
    if(team?.members?.includes(auth.id)){dossier=team;teamId=id}
   }
   return json({workspace:dossier.workspace||{},version:dossier.version||0,submitted:!!dossier.submitted,submittedAt:dossier.submittedAt||null,teamId});
  }
  let dossierKey=key;
  if(validId(rec.matchChoice)){
   const id=hash([auth.id,rec.matchChoice].sort().join(':')).slice(0,32);
   const team=await db.get('team-'+id,{type:'json'});
   if(team?.members?.includes(auth.id))dossierKey='team-'+id;
  }
  const metadata=await db.getWithMetadata(dossierKey,{type:'json'});
  if(!metadata?.data||!metadata.etag)return fail('Dossier indisponible',409);
  const dossier=metadata.data;
  if(action==='save'){
   if(!isOpen('problem'))return fail('Dossier pas encore ouvert',403,'STAGE_LOCKED');
   if(dossier.submitted)return fail('Dossier déjà soumis',409);
   if(!Number.isInteger(body.version)||body.version!==(dossier.version||0))return fail('Dossier modifié dans une autre session : rechargez avant de sauvegarder',409,'VERSION_CONFLICT');
   const w=body.workspace;if(!w||typeof w!=='object'||Array.isArray(w))return fail('Dossier invalide');
   const allowed=['problem','solution','tasks','tests','decisions','redteam','audit','submission','challenge'];
   const stageFor={problem:'problem',solution:'solution',tasks:'build',tests:'build',decisions:'build',redteam:'redteam',audit:'redteam',submission:'pitch',challenge:'challenge'};const clean={...dossier.workspace};for(const k of allowed)if(w[k]!==undefined&&isOpen(stageFor[k]))clean[k]=w[k];
   if(JSON.stringify(clean).length>120000)return fail('Dossier trop volumineux',413);
   dossier.workspace=clean;dossier.version=(dossier.version||0)+1;dossier.updatedAt=new Date().toISOString();
   const write=await db.setJSON(dossierKey,dossier,{onlyIfMatch:metadata.etag});if(!write?.modified)return fail('Modification concurrente : rechargez le dossier',409,'VERSION_CONFLICT');
   return json({version:dossier.version,savedAt:dossier.updatedAt});
  }
  if(action==='submit'){
   if(dossier.submitted)return fail('Dossier déjà soumis',409);
   if(!Number.isInteger(body.version)||body.version!==(dossier.version||0))return fail('Version de dossier obsolète',409,'VERSION_CONFLICT');
   const w=dossier.workspace||{};
   if(!String(w.problem?.summary||'').trim()||!String(w.solution?.summary||'').trim()||!String(w.submission?.result||'').trim())return fail('Problème, solution et résultat final obligatoires');
   dossier.submitted=true;dossier.submittedAt=new Date().toISOString();const write=await db.setJSON(dossierKey,dossier,{onlyIfMatch:metadata.etag});if(!write?.modified)return fail('Modification concurrente : rechargez le dossier',409,'VERSION_CONFLICT');
   return json({submittedAt:dossier.submittedAt,receipt:'HNS-'+dossierKey.split('-').pop().slice(0,8).toUpperCase()});
  }
  return fail('Action inconnue',404);
 }catch(error){
  console.error('HNS_MISSION_RUNTIME_ERROR',error?.name||'Error',error?.message||'Unknown');
  return fail('Erreur temporaire du service. Contactez l’organisation.',503,'BACKEND_UNAVAILABLE');
 }
}
