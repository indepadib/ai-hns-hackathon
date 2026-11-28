// These signals measure documented evidence, never candidate talent.
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const has=v=>typeof v==='string'&&v.trim().length>0;
function decode(v){if(!has(v))return {};try{return obj(JSON.parse(v))}catch{return {note:v}}}
export function teamSignals(workspace){
 const w=obj(workspace),p=decode(w.problem?.summary),s=decode(w.solution?.summary),t=decode(w.tests?.summary),sub=obj(w.submission),risk=obj(w.redteam);
 const cases=Array.isArray(t.cases)?t.cases.filter(x=>x&&typeof x==='object'):[],tasks=Array.isArray(t.tasks)?t.tasks.filter(x=>x&&typeof x==='object'):[],story=obj(sub.story);
 const evidenced=cases.filter(x=>['pass','fail'].includes(x.status)&&has(x.expected)&&has(x.actual)),verified=['quality','accuracy','privacy','fallback'].filter(k=>risk[k]?.status==='verified'&&has(risk[k]?.proof)).length;
 const unresolved=['quality','accuracy','privacy','fallback'].filter(k=>risk[k]?.status==='failed'&&!has(risk[k]?.mitigation)).length;
 const proof={challenge:has(w.challenge?.id),problem:has(p.problem)&&has(p.users)&&has(p.evidence)&&has(p.kpi),solution:has(s.data)&&has(s.model)&&has(s.output)&&has(s.action)&&has(s.guard),build:tasks.some(x=>x.status==='done'&&has(x.proof)),test:evidenced.length>0,redteam:verified>0&&unresolved===0,pitch:has(sub.result)&&['hook','demo','evidence','impact'].every(k=>has(story[k]))};
 const questions=[];if(!has(p.evidence))questions.push('Quelle observation indépendante confirme votre problème ?');if(!has(p.kpi))questions.push('Quel indicateur de départ et quelle cible mesurable ?');if(!has(s.guard))questions.push('Que se passe-t-il si le modèle se trompe ?');if(!evidenced.length)questions.push('Montrez un test avec un résultat attendu et observé.');if(unresolved)questions.push('Comment traitez-vous les échecs de robustesse non corrigés ?');if(!has(sub.result))questions.push('Quelle partie du prototype fonctionne réellement ?');if(!has(sub.impact?.basis))questions.push('Quelle est la source des hypothèses économiques ?');
 return {proof,documented:Object.values(proof).filter(Boolean).length,total:7,tasksDone:tasks.filter(x=>x.status==='done'&&has(x.proof)).length,tasksTotal:tasks.length,testsEvidenced:evidenced.length,testsTotal:cases.length,riskVerified:verified,unresolved,questions};
}

/** Short factual excerpts from saved project content, never generated evaluations. */
export function projectPreview(workspace){
 const w=obj(workspace),p=decode(w.problem?.summary),s=decode(w.solution?.summary),t=decode(w.tests?.summary),sub=obj(w.submission);
 const excerpt=v=>typeof v==='string'?v.trim().slice(0,300):'';
 const tasks=Array.isArray(t.tasks)?t.tasks:[],cases=Array.isArray(t.cases)?t.cases:[];
 return {challengeId:excerpt(w.challenge?.id),customTitle:excerpt(w.challenge?.custom?.title),problem:excerpt(p.problem||p.note),users:excerpt(p.users),solution:excerpt(s.model||s.note),output:excerpt(s.output),kpi:excerpt(p.kpi),result:excerpt(sub.result),limits:excerpt(sub.limits),taskCount:tasks.length,completedTasks:tasks.filter(x=>x?.status==='done').length,testCount:cases.length,passedTests:cases.filter(x=>x?.status==='pass').length};
}
