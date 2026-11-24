(function(root){
'use strict';
const roles={keynote:'Keynote speaker',workshop:'Animateur d’atelier',mentor:'Mentor',jury:'Membre du jury',leadership:'Direction H&S',guest:'Invité interne',organizer:'Organisation'};
const mailLabels={draft:'À inviter',sending:'En cours',accepted:'Acceptée par la messagerie',review_required:'À vérifier'};
const rsvpLabels={pending:'Réponse attendue',confirmed:'Confirmé',declined:'Décliné'};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function mount(container,api){
 const panel=document.createElement('section');panel.className='card guests-desk';container.prepend(panel);
 panel.innerHTML='<div class="guests-hero"><div><span class="studio-kicker">H&S · HOST & SPEAKER CENTER</span><h2>Ceux qui font vivre la journée.</h2><p>Invitez les collaborateurs, intervenants et mentors. Suivez les disponibilités et les arrivées séparément des candidats.</p></div><button type="button" class="button light" id="guests-open">Gérer les invités H&S</button></div><div id="guests-body" hidden><div id="guests-metrics" class="guests-metrics"></div><div class="guests-actions"><button type="button" id="guests-new" class="button">Ajouter un invité</button><button type="button" class="button ghost" id="guests-refresh">Actualiser</button></div><p id="guests-status" role="status" aria-live="polite"></p><div class="guests-filters"><label>Recherche<input id="guests-search" placeholder="Nom, service, sujet"></label><label>Rôle<select id="guests-role"><option value="">Tous les rôles</option>'+Object.entries(roles).map(([k,l])=>'<option value="'+k+'">'+esc(l)+'</option>').join('')+'</select></label><label>État<select id="guests-filter"><option value="">Tous les états</option><option value="draft">À inviter</option><option value="pending">Réponse attendue</option><option value="confirmed">Confirmés</option><option value="declined">Déclinés</option><option value="present">Présents</option><option value="review_required">À vérifier</option><option value="revoked">Annulés</option></select></label></div><div id="guests-list"></div><div id="guests-edit" hidden></div><div id="guests-preview" hidden></div></div>';
 const q=id=>panel.querySelector('#'+id),body=q('guests-body'),status=q('guests-status'),edit=q('guests-edit'),preview=q('guests-preview'),list=q('guests-list');
 let rows=[],busy=false,enabled=false,loaded=false;
 const say=s=>status.textContent=s;
 function draw(){
  const active=rows.filter(r=>!r.revokedAt);
  q('guests-metrics').innerHTML=[['Invités recensés',active.length],['À inviter',active.filter(r=>r.mailStatus==='draft').length],['Invitations acceptées',active.filter(r=>r.mailStatus==='accepted').length],['Confirmés',active.filter(r=>r.rsvp==='confirmed').length],['Présents',active.filter(r=>r.checkedInAt).length]].map(([l,v])=>'<div><small>'+l+'</small><strong>'+v+'</strong></div>').join('');
  const search=q('guests-search').value.toLowerCase(),role=q('guests-role').value,filter=q('guests-filter').value;
  const filtered=rows.filter(r=>(!role||r.role===role)&&[r.name,r.email,r.department,r.session].join(' ').toLowerCase().includes(search)&&(!filter||(filter==='revoked'?!!r.revokedAt:!r.revokedAt&&(filter==='present'?!!r.checkedInAt:filter==='pending'?r.mailStatus==='accepted'&&r.rsvp==='pending':r.mailStatus===filter||r.rsvp===filter))));
  list.innerHTML=filtered.length?filtered.map(r=>'<article class="guest-row"><div class="guest-avatar">'+esc(r.name.split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase())+'</div><div class="guest-info"><strong>'+esc(r.name)+'</strong><small>'+esc(roles[r.role])+' · '+esc(r.department||'H&S')+'</small><p>'+esc(r.session||'Contribution à définir')+(r.slot?' · '+esc(r.slot):'')+'</p><small>'+esc(r.email)+'</small></div><div class="guest-state"><span>'+esc(r.revokedAt?'Annulé':r.checkedInAt?'Présent':r.mailStatus==='accepted'?rsvpLabels[r.rsvp]:mailLabels[r.mailStatus])+'</span><button type="button" class="button ghost" data-guest-preview="'+r.id+'">Consulter</button></div></article>').join(''):'<div class="module-empty">'+(loaded?'Aucun invité correspondant. Ajoutez un intervenant pour commencer.':'Chargement…')+'</div>';
  list.querySelectorAll('[data-guest-preview]').forEach(b=>b.onclick=()=>open(b.dataset.guestPreview));
 }
 async function refresh(){
  if(busy)return;busy=true;say('Actualisation…');try{const data=await api('guest-list');if(!panel.isConnected)return;rows=data.guests||[];enabled=data.sendEnabled;loaded=true;draw();say(enabled?'Messagerie configurée. Aucun envoi sans confirmation.':'Envois indisponibles : vérifiez la configuration Gmail.')}catch(e){say(e.message)}finally{busy=false}
 }
 function form(row=null){
  if(busy)return;preview.hidden=true;edit.hidden=false;
  edit.innerHTML='<h3>'+ (row?'Modifier la fiche':'Nouvel invité H&S')+'</h3><form class="guest-form"><label>Nom complet<input name="name" required maxlength="150" value="'+esc(row?.name||'')+'"></label><label>Email professionnel<input name="email" type="email" required maxlength="254" '+(row?'readonly':'')+' value="'+esc(row?.email||'')+'"></label><label>Rôle<select name="role">'+Object.entries(roles).map(([k,l])=>'<option value="'+k+'" '+(row?.role===k?'selected':'')+'>'+esc(l)+'</option>').join('')+'</select></label><label>Direction / service<input name="department" maxlength="120" value="'+esc(row?.department||'')+'"></label><label>Sujet / atelier / contribution<input name="session" maxlength="180" value="'+esc(row?.session||'')+'"></label><label>Créneau d’intervention (facultatif)<input name="slot" type="time" value="'+esc(row?.slot||'')+'"></label><div class="guests-actions"><button class="button" type="submit">Enregistrer le brouillon</button><button class="button ghost" type="button" id="guest-cancel">Annuler</button></div></form>';
  edit.querySelector('#guest-cancel').onclick=()=>edit.hidden=true;
  const f=edit.querySelector('form');f.onsubmit=async e=>{e.preventDefault();if(busy)return;busy=true;const b=f.querySelector('button[type=submit]');b.disabled=true;try{const guest=Object.fromEntries(new FormData(f));await api(row?'guest-update':'guest-create',{...(row?{id:row.id,version:row.version}:{}),guest});edit.hidden=true;say('Brouillon enregistré. Aucun email envoyé.')}catch(err){say(err.message)}finally{busy=false;b.disabled=false}if(edit.hidden)await refresh()};edit.scrollIntoView({block:'nearest',behavior:'smooth'});
 }
 async function open(id){
  if(busy)return;busy=true;edit.hidden=true;preview.hidden=false;preview.textContent='Chargement de l’invitation…';
  try{const {guest:r,mail}=await api('guest-preview',{id});if(!panel.isConnected)return;
   preview.innerHTML='<div class="guest-preview-head"><div><span class="studio-kicker">INVITATION PERSONNELLE</span><h3>'+esc(r.name)+'</h3><p>'+esc(r.email)+' · '+esc(roles[r.role])+'</p></div><button type="button" class="button ghost" id="guest-close">Fermer</button></div><p><strong>Objet :</strong> '+esc(mail.subject)+'</p><div class="guest-email-preview">'+esc(mail.text)+'</div><div class="guests-actions">'+(!r.revokedAt&&r.mailStatus==='draft'?'<button type="button" class="button ghost" id="guest-edit">Modifier</button><button type="button" class="button" id="guest-send" '+(!enabled?'disabled':'')+'>Envoyer cette invitation</button>':'')+(!r.revokedAt&&r.mailStatus==='accepted'&&!r.checkedInAt&&r.rsvp!=='declined'?'<button type="button" class="button" id="guest-arrive">Valider la présence</button>':'')+(!r.revokedAt&&!r.checkedInAt&&r.mailStatus!=='sending'?'<button type="button" class="button ghost" id="guest-revoke">Annuler l’invitation</button>':'')+'</div><p class="guest-note">Cet accès ne crée aucun compte participant, jury ou administrateur. Le lien de confirmation est personnel.</p>';
   preview.querySelector('#guest-close').onclick=()=>{preview.hidden=true};
   const editBtn=preview.querySelector('#guest-edit');if(editBtn)editBtn.onclick=()=>form(r);
   for(const [bid,action,msg] of [['guest-send','guest-send','Envoyer réellement l’invitation à '+r.email+' ?'],['guest-arrive','guest-checkin','Valider la présence de '+r.name+' ?'],['guest-revoke','guest-revoke','Annuler définitivement cette invitation ?']]){
    const b=preview.querySelector('#'+bid);if(b)b.onclick=async()=>{if(busy||!confirm(msg))return;busy=true;b.disabled=true;try{await api(action,{id:r.id,version:r.version,confirm:true});preview.hidden=true;say(action==='guest-send'?'Invitation acceptée par la messagerie.':'Modification enregistrée.')}catch(e){say(e.message);preview.hidden=true}finally{busy=false;b.disabled=false}await refresh()};
   }
   preview.scrollIntoView({block:'nearest',behavior:'smooth'});
  }catch(e){preview.textContent=e.message}finally{busy=false}
 }
 q('guests-open').onclick=()=>{body.hidden=!body.hidden;if(!body.hidden)refresh()};q('guests-new').onclick=()=>form();q('guests-refresh').onclick=refresh;
 for(const id of ['guests-search','guests-role','guests-filter'])q(id).addEventListener(id==='guests-search'?'input':'change',draw);
 return panel;
}
root.HNSGuestCenter=Object.freeze({mount});
})(globalThis);
