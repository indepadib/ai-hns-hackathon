import {canInvite} from './campaign-core.mjs';
export const stages=[
 {id:'interview',label:'Présélection',hint:'Examiner les dossiers',target:150},
 {id:'selected',label:'Validation RH',hint:'Retenir les profils',target:60},
 {id:'ready',label:'À inviter',hint:'Envoyer les pass'},
 {id:'sent',label:'Invitations',hint:'Acceptées par Gmail',target:60},
 {id:'confirmed',label:'Confirmations',hint:'Réponses positives'},
 {id:'present',label:'Présences',hint:'Contrôles à l’accueil',target:50}
];
export function inStage(row,op,id){
 switch(id){
 case 'interview':return row.status==='interview';
 case 'selected':return row.status==='selected';
 case 'ready':return canInvite(row,op);
 case 'sent':return op?.mailStatus==='accepted';
 case 'confirmed':return op?.rsvp==='confirmed';
 case 'present':return !!op?.checkedInAt;
 case 'pending':return op?.mailStatus==='accepted'&&(!op.rsvp||op.rsvp==='pending');
 case 'review':return ['sending','review_required'].includes(op?.mailStatus);
 default:return true;
 }
}
export function nextAction(row,op,unavailable){
 if(!row)return {kind:'none',label:'Aucune action'};
 if(op?.checkedInAt)return {kind:'pass',label:'Consulter le pass',hint:'Présence déjà validée.'};
 if(['selected','invited','confirmed'].includes(row.status))return {kind:'pass',label:op?.mailStatus==='accepted'?'Consulter le pass':'Prévisualiser le pass',hint:unavailable?'Synchronisation opérationnelle indisponible.':op?.mailStatus==='accepted'?'Invitation déjà acceptée.':'Vérifiez le destinataire et l’état de l’envoi.',disabled:unavailable};
 if(row.status==='interview'&&!row.invitedAt)return {kind:'select',label:'Valider la sélection RH',hint:'Décision manuelle : aucun email ne part à cette étape.'};
 return {kind:'none',label:'Consulter le dossier',hint:'Les décisions RH restent manuelles.'};
}
