// Heuristic checklist, NOT a predictive hiring model. Never uses name, age, city, school, gender.
export const formFields=['name','email','school','status','project','portfolio','obstacle','ai_tools','ai_usage','ai_agents','ai_agent_idea','track','format','opportunity','city','availability','source','consent','utm_source','utm_campaign','cv'];
export const statusValues=['received','review','interview','selected','invited','confirmed','rejected'];
export function tidy(value, max=1500){ return String(value ?? '').trim().slice(0,max); }
export function validEmail(value){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tidy(value,254));}
export function validURL(value){ try{const u=new URL(tidy(value,400));return ['http:','https:'].includes(u.protocol);}catch{return false;} }
export function dataFromSubmission(raw){ const data={};for(const key of formFields) data[key]=tidy(raw?.[key],key==='project'||key==='obstacle'||key==='ai_agent_idea'?2500:500);return data; }
export function triage(input){
 const d=input?.data ?? input ?? {};
 const signals=[
   {key:'project',title:'Projet réalisé décrit',points:20,ok:tidy(d.project).length>=30},
   {key:'obstacle',title:'Difficulté surmontée décrite',points:15,ok:tidy(d.obstacle).length>=25},
   {key:'ai_agent_idea',title:'Idée d’agent IA expliquée',points:20,ok:tidy(d.ai_agent_idea).length>=30},
   {key:'ai_tools',title:'Outils IA renseignés',points:10,ok:tidy(d.ai_tools).length>=4},
   {key:'ai_agents',title:'Expérience d’agents explicitée',points:15,ok:tidy(d.ai_agents).length>=20&&!/^(non|jamais|aucun|pas encore|no\b)/i.test(tidy(d.ai_agents))},
   {key:'portfolio',title:'Lien de réalisation/portfolio',points:10,ok:validURL(d.portfolio)},
   {key:'availability',title:'Disponibilité renseignée',points:10,ok:tidy(d.availability).length>0}
 ];
 const score=signals.reduce((s,x)=>s+(x.ok?x.points:0),0);
 return {score,maxScore:100,band:score>=70?'Dossier documenté':score>=45?'À approfondir':'Informations à compléter',evidence:signals.filter(x=>x.ok).map(x=>x.title),missing:signals.filter(x=>!x.ok).map(x=>x.title),signals};
}
export function csvCell(v){const s=String(v??'');return /[",\n\r]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;}
export function makeCSV(records){const head=['Date','Nom','Email','Verticale','École/Parcours','Statut RH','Score complétude','CV renseigné'];const rows=records.map(r=>[r.createdAt,r.name,r.email,r.track,r.school,r.status,triage(r).score,r.hasCV?'Oui':'Non']);return '\uFEFF'+[head,...rows].map(row=>row.map(csvCell).join(',')).join('\r\n');}
