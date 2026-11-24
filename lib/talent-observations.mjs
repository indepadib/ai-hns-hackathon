// Individual observations are human-authored, not a talent score or employment decision.
export const dimensions={business:'Compréhension métier',engineering:'Conception et exécution',data:'Rigueur des données',testing:'Tests et esprit critique',collaboration:'Collaboration',communication:'Communication'};
export const phases={briefing:'Briefing',problem:'Problème',solution:'Architecture',build:'Construction',redteam:'Robustesse',pitch:'Démonstration',jury:'Entretien jury'};
export const followups={none:'Non défini',discuss:'Échange complémentaire',technical:'Entretien technique à préparer',review:'À revoir avec un mentor'};
const text=(x,max)=>typeof x==='string'?x.trim().slice(0,max):'';
export function validateObservation(input){
 if(!input||!Object.hasOwn(dimensions,input.dimension)||!Object.hasOwn(phases,input.phase))throw Error('Dimension ou mission invalide.');
 const observer=text(input.observer,100),fact=text(input.fact,1800),reference=text(input.reference,600),question=text(input.question,600);
 if(!observer||fact.length<12)throw Error('Identifiez l’observateur et décrivez un fait concret (12 caractères minimum).');
 return{dimension:input.dimension,phase:input.phase,observer,fact,reference,question};
}
export function validateFollowup(input){
 if(!input||!Object.hasOwn(followups,input.status))throw Error('Suivi invalide.');
 const reason=text(input.reason,600),observer=text(input.observer,100);
 if(input.status!=='none'&&(!observer||reason.length<12))throw Error('Un suivi doit être motivé par un fait et attribué à un observateur.');
 return {status:input.status,reason,observer};
}
export function summarize(profile){const notes=Array.isArray(profile?.notes)?profile.notes:[];return{count:notes.length,dimensions:Object.keys(dimensions).filter(k=>notes.some(n=>n.dimension===k)),followup:profile?.followup?.status||'none',updatedAt:profile?.updatedAt||null}}
