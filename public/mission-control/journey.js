// Pure advisory progress; never changes server stages, scores or submissions.
(function(root){
'use strict';
function decode(raw){try{const p=JSON.parse(raw);return p&&typeof p==='object'&&!Array.isArray(p)?p:{note:raw}}catch{return{note:raw}}}
function rulesFor(w,estimateImpact){const p=decode(w.problem?.summary||''),s=decode(w.solution?.summary||''),t=decode(w.tests?.summary||''),sub=w.submission||{},story=sub.story||{},risk=w.redteam||{};const has=v=>typeof v==='string'&&v.trim().length>0;const cases=Array.isArray(t.cases)?t.cases:[],tasks=Array.isArray(t.tasks)?t.tasks:[];const rules={challenge:['Mission brief',[['Un défi sélectionné',has(w.challenge?.id)]]],problem:['Carte du problème',[['Un problème concret et son utilisateur',has(p.problem)&&has(p.users)],['Une preuve ou une observation',has(p.evidence)],['Un impact et un KPI mesurable',has(p.impact)&&has(p.kpi)]]],solution:['Architecture IA',[['Entrées et traitement justifiés',has(s.data)&&has(s.model)],['Sortie et décision métier',has(s.output)&&has(s.action)],['Contrôle des erreurs et garde-fous',has(s.guard)]]],build:['Prototype et rapport de test',[['Une tâche terminée',tasks.some(t=>t?.status==='done'&&has(t.proof))],['Un scénario avec attendu et observé',cases.some(c=>['pass','fail'].includes(c?.status)&&has(c.expected)&&has(c.actual))]]],redteam:['Rapport de robustesse',[['Quatre scénarios examinés',['quality','accuracy','privacy','fallback'].every(k=>['verified','failed'].includes(risk[k]?.status)&&has(risk[k]?.proof))],['Corrections des échecs identifiés',Object.values(risk).some(r=>r?.status==='failed')&&Object.values(risk).filter(r=>r?.status==='failed').every(r=>has(r.mitigation))||Object.values(risk).filter(r=>r?.status==='verified'&&has(r.proof)).length===4]]],pitch:['Démonstration et business case',[['Résultat réel et limites',has(sub.result)&&has(sub.limits)],['Storyboard en quatre séquences',['hook','demo','evidence','impact'].every(k=>has(story[k]))],['Hypothèses économiques et sources',!!estimateImpact(sub.impact||{})&&has(sub.impact?.basis)]]],submission:['Dossier de synthèse',[['Problème central renseigné',has(p.problem)||has(p.note)],['Architecture renseignée',has(s.model)||has(s.note)],['Résultat démontrable renseigné',has(sub.result)]]]};
return rules;
}
const order=['challenge','problem','solution','build','redteam','pitch'];
function plan({workspace={},stages=[],match={},submitted=false,now=Date.now(),estimateImpact=()=>null}={}){
 const rules=rulesFor(workspace,estimateImpact),open=id=>stages.some(s=>s.id===id&&now>=s.opensAt);
 const steps=order.map(id=>{const [title,criteria]=rules[id],done=criteria.filter(c=>c[1]).length;return{id,title,done,total:criteria.length,missing:criteria.filter(c=>!c[1]).map(c=>c[0]),open:open(id)}});
 const documented=steps.filter(s=>s.done===s.total).length;
 const recommended=submitted?'submission':open('matching')&&!match.closed&&!match.choice&&!match.team?'matching':steps.find(s=>s.open&&s.done<s.total)?.id||(open('submission')?'submission':stages.filter(s=>now>=s.opensAt).at(-1)?.id||null);
 return {steps,documented,total:steps.length,recommended,current:stages.filter(s=>now>=s.opensAt).at(-1)?.id||null};
}
root.HNSJourney=Object.freeze({rulesFor,plan});
})(globalThis);
