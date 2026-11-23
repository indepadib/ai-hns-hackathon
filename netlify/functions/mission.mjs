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
const readEnv=name=>globalThis.Netlify?.env?.get(name)||process.env[name];
const env={admin:'HNS_ADMIN_KEY',rh:'HNS_RH_KEY',jury:'HNS_JURY_KEY'};
const scoresNames=['problem','design','build','test','demo'];
function store(){return getStore({name:'hns-ai-mission-control',consistency:'strong'})}
async function listParticipants(db){const out=[];let cursor;do{const page=await db.list({prefix:'participant-',...(cursor?{cursor}:{})});for(const entry of page.blobs){const rec=await db.get(entry.key,{type:'json'});if(rec)out.push({id:entry.key.slice(12),alias:rec.alias,team:rec.team||'',teamSize:rec.teamSize||1,status:rec.status||'active',submitted:!!rec.submitted,checkedInAt:rec.checkedInAt||null,submittedAt:rec.submittedAt||null,score:rec.score||null})}cursor=page.cursor}while(cursor&&out.length<1000);return out}
export default async function handler(request){
 if(request.method==='GET')return json({status:'ok',service:'hns-mission',version:'github-initial'});
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
  if(typeof body.password!=='string'||!equal(body.password,key))return fail('Identifiants incorrects',401,'INVALID_CREDENTIALS');
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
  if(action==='staff-list'){
   if(!['admin','rh'].includes(auth.role))return fail('Accès RH requis',403);
   return json({participants:await listParticipants(db)});
  }
  if(action==='jury-list'){
   if(auth.role!=='jury')return fail('Accès jury requis',403);
   const people=await listParticipants(db);
   return json({participants:people.filter(p=>p.submitted).map(p=>({id:p.id,alias:p.alias,team:p.team,submittedAt:p.submittedAt,score:p.score}))});
  }
  if(action==='checkin'){
   if(!['admin','rh'].includes(auth.role))return fail('Accès RH requis',403);
   const alias=within(body.alias,70),team=within(body.team,50),teamSize=Number(body.teamSize||1);
   if(!alias||alias.length>70)return fail('Référence participant obligatoire');
   if(![1,2].includes(teamSize))return fail('Une équipe ne peut pas dépasser deux personnes');
   const code=randomBytes(12).toString('hex').toUpperCase(),id=hash(code).slice(0,32);
   const rec={codeHash:hash(code),alias,team,teamSize,status:'active',version:0,workspace:{},submitted:false,checkedInAt:new Date().toISOString()};
   await db.setJSON(participantKey(id),rec);
   return json({id,alias,code,checkedInAt:rec.checkedInAt});
  }
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
   const rec=await db.get(participantKey(body.id),{type:'json'});
   if(!rec||!rec.submitted)return fail('Dossier non soumis',404);
   return json({id:body.id,alias:rec.alias,team:rec.team,workspace:rec.workspace||{},submittedAt:rec.submittedAt,score:rec.score||null});
  }
  if(action==='jury-score'){
   if(auth.role!=='jury')return fail('Accès jury requis',403);
   if(!validId(body.id))return fail('Identifiant invalide');
   const values=body.scores;
   if(!values||typeof values!=='object'||!scoresNames.every(k=>Number.isInteger(values[k])&&values[k]>=0&&values[k]<=100))return fail('Notes invalides : 0 à 100');
   const key=participantKey(body.id),rec=await db.get(key,{type:'json'});
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
  if(action==='load')return json({workspace:rec.workspace||{},version:rec.version||0,submitted:!!rec.submitted,submittedAt:rec.submittedAt||null});
  if(action==='save'){
   if(rec.submitted)return fail('Dossier déjà soumis',409);
   if(!Number.isInteger(body.version)||body.version!==(rec.version||0))return fail('Dossier modifié dans une autre session : rechargez avant de sauvegarder',409,'VERSION_CONFLICT');
   const w=body.workspace;if(!w||typeof w!=='object'||Array.isArray(w))return fail('Dossier invalide');
   const allowed=['problem','solution','tasks','tests','decisions','redteam','audit','submission','challenge'];
   const clean={};for(const k of allowed)if(w[k]!==undefined)clean[k]=w[k];
   if(JSON.stringify(clean).length>120000)return fail('Dossier trop volumineux',413);
   rec.workspace=clean;rec.version=(rec.version||0)+1;rec.updatedAt=new Date().toISOString();
   await db.setJSON(key,rec);
   return json({version:rec.version,savedAt:rec.updatedAt});
  }
  if(action==='submit'){
   if(rec.submitted)return fail('Dossier déjà soumis',409);
   if(!Number.isInteger(body.version)||body.version!==(rec.version||0))return fail('Version de dossier obsolète',409,'VERSION_CONFLICT');
   const w=rec.workspace||{};
   if(!String(w.problem?.summary||'').trim()||!String(w.solution?.summary||'').trim()||!String(w.submission?.result||'').trim())return fail('Problème, solution et résultat final obligatoires');
   rec.submitted=true;rec.submittedAt=new Date().toISOString();await db.setJSON(key,rec);
   return json({submittedAt:rec.submittedAt,receipt:'HNS-'+auth.id.slice(0,8).toUpperCase()});
  }
  return fail('Action inconnue',404);
 }catch(error){
  console.error('HNS_MISSION_RUNTIME_ERROR',error?.name||'Error',error?.message||'Unknown');
  return fail('Erreur temporaire du service. Contactez l’organisation.',503,'BACKEND_UNAVAILABLE');
 }
}
