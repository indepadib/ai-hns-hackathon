// Authoritative explanation for a disabled invitation, without exposing credentials.
export function invitationBlocker({live,enabled,provider,connection,row,pass,mail}){
 if(!live)return {code:'PREVIEW',message:'Envoi réservé au site officiel ai.hns.ma.'};
 if(!enabled)return {code:'SEND_DISABLED',message:'Envoi désactivé sur ce déploiement. Contactez l’administrateur.'};
 if(!provider)return {code:'PROVIDER_MISSING',message:'Configuration de l’expéditeur Gmail indisponible. Vérifiez la messagerie officielle.'};
 if(provider==='gmail-oauth'&&(!connection?.connected||!connection?.testedAt))return {code:'GMAIL_TEST_REQUIRED',message:'Connectez Gmail et validez le test interne depuis le Talent Center.'};
 if(mail?.state==='accepted')return {code:'ALREADY_SENT',message:'Invitation déjà acceptée par le fournisseur. Aucun renvoi automatique.'};
 if(mail)return {code:'MAIL_REVIEW',message:'Un envoi précédent est en cours ou à contrôler. Vérifiez Gmail avant toute relance.'};
 if(row?.invitedAt||row?.status==='invited')return {code:'RH_ALREADY_INVITED',message:'Une invitation est déjà enregistrée dans le dossier RH. Vérifiez l’historique.'};
 if(row?.status!=='selected')return {code:'RH_STATUS',message:'Le dossier doit être au statut « Sélectionné » pour un premier envoi. Ne changez ce statut que si aucune invitation n’a été envoyée.'};
 if(pass?.rsvp==='declined')return {code:'DECLINED',message:'Le candidat a décliné sa participation.'};
 if(pass?.status!=='invited'||pass?.checkedInAt)return {code:'PASS_STATE',message:'Ce pass est déjà actif, révoqué ou non expédiable.'};
 return null;
}
