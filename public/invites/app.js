'use strict';
const box=document.querySelector('#invite'),token=location.hash.slice(1);
async function request(action,response,materials){const r=await fetch('/api/mission',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,token,...(response?{response}:{}),...(materials?{materials}:{})}),cache:'no-store'});const data=await r.json();if(!r.ok)throw Error(data.error||'Invitation indisponible');return data.guest}
function node(tag,text,cls){const el=document.createElement(tag);el.textContent=text;if(cls)el.className=cls;return el}
function render(guest){
 box.replaceChildren(node('span','VOTRE INVITATION','kicker'),node('h2','Bonjour '+guest.name),node('p',guest.role,'role'));
 if(guest.vertical)box.append(node('p',guest.vertical));if(guest.session)box.append(node('p',guest.session));if(guest.slot)box.append(node('p','Votre intervention : '+guest.slot+' (heure de Casablanca)'));
 const status=node('p',guest.checkedInAt?'Présence enregistrée.':guest.rsvp==='confirmed'?'Votre participation est confirmée.':guest.rsvp==='declined'?'Votre indisponibilité est enregistrée.':'Pouvez-vous être des nôtres ?','status');box.append(status);
 if(guest.rsvp==='confirmed'&&!guest.checkedInAt&&/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(guest.qrCode||'')&&/^HNSG:[A-F0-9]{32}:[A-F0-9]{32}$/.test(guest.passCode||'')){const pass=document.createElement('section');pass.className='guest-pass';pass.append(node('span','PASS INVITÉ · 28 NOVEMBRE','kicker'),node('h3','Votre accès personnel'),node('p','Présentez ce QR code à l’accueil. Il est personnel et sert uniquement au contrôle d’accès à l’accueil.'));const qr=document.createElement('img');qr.src=guest.qrCode;qr.alt='QR code personnel de l’invité';qr.width=240;qr.height=240;pass.append(qr);const link=node('a','Enregistrer le QR code');link.href=guest.qrCode;link.download='HNS-pass-invite.png';pass.append(link,node('details','','pass-details'));const details=pass.querySelector('details');details.append(node('summary','Code de secours'),node('code',guest.passCode));box.append(pass)}
 if(guest.brief){const brief=document.createElement('section');brief.className='brief';brief.append(node('h3','Préparer votre intervention'),node('p',guest.brief.duration+' · '+guest.brief.format));const ol=document.createElement('ol');for(const item of guest.brief.items)ol.append(node('li',item));brief.append(ol,node('p',guest.brief.note));box.append(brief)}
 if(guest.studioAccess===true||guest.juryAccess===true){
 const section=document.createElement('section');section.className='brief';section.append(node('span','MISSION CONTROL · H&S','kicker'),node('h3','Votre espace de suivi'),node('p','Suivez le déroulé en direct, consultez les projets et évaluez les candidats. Aucun code supplémentaire nécessaire.'));
 const openStudio=(label,role,action)=>{const b=node('button',label);b.type='button';b.onclick=async()=>{b.disabled=true;try{const r=await fetch('/api/mission',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,token}),cache:'no-store'});const data=await r.json();if(!r.ok||data.role!==role||!data.token)throw Error(data.error||'Accès indisponible');sessionStorage.setItem('hns_mission_token',data.token);sessionStorage.setItem('hns_mission_role',role);location.assign('/mission-control/')}catch(e){status.textContent=e.message;b.disabled=false}};section.append(b)};
 if(guest.studioAccess)openStudio('Accéder à Mission Control','guest','guest-studio-login');
 if(guest.juryAccess)openStudio('Ouvrir la notation officielle du jury','jury','guest-jury-login');
 box.append(section);
 }
 if(guest.checkedInAt)return;
 const actions=document.createElement('div');actions.className='actions';const yes=node('button','Je confirme ma présence'),no=node('button','Je ne pourrai pas venir','secondary');
 for(const [b,response] of [[yes,'confirmed'],[no,'declined']]){b.type='button';b.disabled=guest.rsvp===response;b.onclick=async()=>{yes.disabled=no.disabled=true;try{render(await request('guest-rsvp',response))}catch(e){status.textContent=e.message;yes.disabled=guest.rsvp==='confirmed';no.disabled=guest.rsvp==='declined'}};actions.append(b)}box.append(actions);
}
request('guest-rsvp-read').then(render).catch(e=>box.replaceChildren(node('h2','Invitation indisponible'),node('p',e.message),node('p','Contactez l’organisation pour vérifier votre invitation.')));
