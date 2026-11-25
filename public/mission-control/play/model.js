(function(root){'use strict';
const sets={
 business:{title:'Business Match',desc:'Retrouvez le métier correspondant à chacune des sept verticales du hackathon.',pairs:[
 ['GIDNA / Kaya','Chantiers et immobilier','Exemple : anticiper les retards et la disponibilité des matériaux.'],
 ['WB Group','Médias et publicité','Exemple : mesurer la performance d’une campagne ou prévoir ses écarts.'],
 ['One Retail','Commerce et magasins','Exemple : repérer les risques de rupture en rayon.'],
 ['Dislog / DMD','Industrie et distribution','Exemple : détecter les anomalies de qualité avant un contrôle.'],
 ['La Voie Express / BLS','Logistique et transport','Exemple : anticiper un retard de livraison.'],
 ['Chari Fintech','Paiements et commerce digital','Exemple : signaler une transaction atypique à vérifier.'],
 ['H&S Groupe','IT, RH et fonctions transverses','Exemple : orienter un ticket IT ou retrouver une procédure.']]},
 ai:{title:'AI Match',desc:'Reliez sept notions à leur rôle dans la construction d’un prototype.',pairs:[
 ['Problem Canvas','Besoin, utilisateur et preuve','Avant de choisir une technologie, identifiez le problème métier.'],
 ['RAG','Recherche documentaire + génération','Le modèle s’appuie sur des documents retrouvés ; vérifiez ses références.'],
 ['Baseline','Point de comparaison simple','Comparez votre modèle à une règle de référence sur le même jeu de test.'],
 ['Benchmark','Évaluation sur un jeu distinct','Mesurez les résultats sur des données non utilisées pour ajuster votre modèle.'],
 ['Red Team','Recherche des failles et limites','Testez les cas dégradés, les erreurs et les garde-fous.'],
 ['Human-in-the-loop','Validation par une personne','Une recommandation sensible peut exiger une vérification humaine.'],
 ['Déploiement','Prototype exécutable et reproductible','Une commande locale ou un lien testé peut suffire pour la démo.']]}
};
function shuffle(a,rng){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function create(mode='business',rng=Math.random){if(!Object.hasOwn(sets,mode))throw Error('Mode inconnu');const pair=sets[mode].pairs;return {mode,cards:shuffle(pair.flatMap((p,i)=>[0,1].map(side=>({id:i+'-'+side,pair:i,side,label:p[side]}))),rng),open:[],matched:[],moves:0,locked:false,last:null,done:false}}
function flip(state,id){if(state.locked||state.done||state.open.includes(id)||state.matched.includes(id)||!state.cards.some(c=>c.id===id))return state;const open=[...state.open,id];if(open.length===1)return {...state,open,last:null};const [a,b]=open.map(i=>state.cards.find(c=>c.id===i)),match=a.pair===b.pair&&a.side!==b.side,matched=match?[...state.matched,...open]:state.matched;return {...state,open:match?[]:open,matched,moves:state.moves+1,locked:!match,last:{match,pair:match?a.pair:null},done:matched.length===state.cards.length}}
function conceal(state){return state.locked?{...state,open:[],locked:false}:state}
root.HNSPlay=Object.freeze({sets,create,flip,conceal});
})(globalThis);
