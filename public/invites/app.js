'use strict';
const box=document.querySelector('#invite'),token=location.hash.slice(1);
async function request(action,response){const r=await fetch('/api/mission',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,token,...(response?{response}:{})}),cache:'no-store'});const data=await r.json();if(!r.ok)throw Error(data.error||'Invitation indisponible');return data.guest}
function node(tag,text,cls){const el=document.createElement(tag);el.textContent=text;if(cls)el.className=cls;return el}
function render(guest){
 box.replaceChildren(node('span','VOTRE INVITATION','kicker'),node('h2','Bonjour '+guest.name),node('p',guest.role,'role'));
 if(guest.session)box.append(node('p',guest.session));if(guest.slot)box.append(node('p','Votre intervention : '+guest.slot+' (heure de Casablanca)'));
 const status=node('p',guest.checkedInAt?'Présence enregistrée.':guest.rsvp==='confirmed'?'Votre participation est confirmée.':guest.rsvp==='declined'?'Votre indisponibilité est enregistrée.':'Pouvez-vous être des nôtres ?','status');box.append(status);
 if(guest.checkedInAt)return;
 const actions=document.createElement('div');actions.className='actions';const yes=node('button','Je confirme ma présence'),no=node('button','Je ne pourrai pas venir','secondary');
 for(const [b,response] of [[yes,'confirmed'],[no,'declined']]){b.type='button';b.disabled=guest.rsvp===response;b.onclick=async()=>{yes.disabled=no.disabled=true;try{render(await request('guest-rsvp',response))}catch(e){status.textContent=e.message;yes.disabled=guest.rsvp==='confirmed';no.disabled=guest.rsvp==='declined'}};actions.append(b)}box.append(actions);
}
request('guest-rsvp-read').then(render).catch(e=>box.replaceChildren(node('h2','Invitation indisponible'),node('p',e.message),node('p','Contactez l’organisation pour vérifier votre invitation.')));
