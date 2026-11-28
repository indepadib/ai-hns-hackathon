'use strict';
import {targets,batchLimit,campaignMetrics,batchCandidates,sendBatch} from './campaign-core.mjs';
import {stages,inStage,nextAction} from './rh-journey.mjs';
let journeyFilter='all';
const $=id=>document.getElementById(id);
const labelStatus={received:'Reçu',review:'À étudier',interview:'Présélection / entretien',selected:'Sélectionné par les RH',invited:'Invité',confirmed:'Confirmé (historique)',rejected:'Non retenu',sending:'Envoi en cours'};
const statusList=['received','review','interview','selected','invited','confirmed','rejected'];
let secret='',records=[],selected=null,previousFocus=null,imported=[],cvBlobURL=null,cvRequestNumber=0;
let missionStatus=new Map(), missionUnavailable=false;
let gmailReady=false,campaignRunning=false,campaignStop=false,campaignChosen=new Set();
const txt=(s)=>document.createTextNode(String(s??''));
function el(tag,className='',value){const x=document.createElement(tag);if(className)x.className=className;if(value!==undefined)x.textContent=String(value);return x;}
function notify(message,error=false){const e=$('toast');e.textContent=message;e.hidden=false;e.style.background=error?'#803f37':'#193d30';clearTimeout(notify.timeout);notify.timeout=setTimeout(()=>e.hidden=true,5200);}
async function api(method='GET',body){
 const res=await fetch('/.netlify/functions/candidates-admin',{method,headers:{'Authorization':'Bearer '+secret,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store',credentials:'same-origin'});
 let data;try{data=await res.json()}catch{throw Error('Réponse serveur non valide')}
 if(!res.ok)throw Error(data.error||`Erreur ${res.status}`);return data;
}
async function missionApi(body){const res=await fetch('/api/mission',{method:'POST',headers:{Authorization:'Bearer '+secret,'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store',credentials:'same-origin'});const data=await res.json();if(!res.ok)throw Error(data.error||'Mission Control indisponible');return data;}
async function loadMissionStatus(){missionStatus=new Map();missionUnavailable=false;try{const ids=records.filter(r=>['selected','invited','confirmed'].includes(r.status)).map(r=>r.id);for(let i=0;i<ids.length;i+=100){const r=await missionApi({action:'recruitment-status',candidateIds:ids.slice(i,i+100)});for(const entry of r.entries||[])missionStatus.set(entry.candidateId,entry);}}catch{missionUnavailable=true;}}
const passLabels={not_prepared:'Non préparé',invited:'Prêt pour accueil',active:'Présent / actif',revoked:'Révoqué',not_sent:'Non envoyé',sending:'En cours',accepted:'Accepté par le fournisseur',review_required:'À contrôler',pending:'En attente',confirmed:'Confirmée',declined:'Déclinée'};
function passLabel(v){return passLabels[v]||'Non disponible';}
function sanitizeCell(s){return String(s??'').replaceAll('"','""')}
function scoreText(r){return `${r.triage?.score??0}/100`;}
function statusPill(status){return el('span','pill '+(status||'received'),labelStatus[status]||'Reçu');}
function updateMetrics(){
 $('nTotal').textContent=records.length;
 $('nDocumented').textContent=records.filter(r=>(r.triage?.score||0)>=70).length;
 $('nReview').textContent=records.filter(r=>['received','review','interview'].includes(r.status)).length;
 $('nInvited').textContent=records.filter(r=>['invited','confirmed'].includes(r.status)).length;
 const tracks=[...new Set(records.map(r=>r.track).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr'));
 const current=$('filterTrack').value;$('filterTrack').replaceChildren(new Option('Toutes les verticales',''),...tracks.map(t=>new Option(t,t)));$('filterTrack').value=tracks.includes(current)?current:'';
}
function matchingRecords(){
 const term=$('search').value.toLowerCase().trim(),status=$('filterStatus').value,track=$('filterTrack').value;
 const list=records.filter(r=>inStage(r,missionStatus.get(r.id),journeyFilter)&&(!status||r.status===status)&&(!track||r.track===track)&&(!term||[r.name,r.email,r.school,r.track,r.data?.project,r.data?.ai_tools,r.data?.ai_agents].join(' ').toLowerCase().includes(term)));
 const sort=$('sortBy').value;
 list.sort((a,b)=>sort==='documented'?(b.triage?.score||0)-(a.triage?.score||0):sort==='oldest'?(a.createdAt||'').localeCompare(b.createdAt||''):(b.createdAt||'').localeCompare(a.createdAt||''));
 return list;
}
function render(){updateMetrics();renderCampaignMetrics();renderJourney();const list=matchingRecords(),body=$('rows');body.replaceChildren();$('countLabel').textContent=`${list.length} dossier(s) affiché(s) sur ${records.length}`;
 if(!list.length){const tr=el('tr');const td=el('td','empty','Aucun dossier ne correspond à cette vue. Modifiez les filtres ou revenez à tous les dossiers.');td.colSpan=6;tr.append(td);body.append(tr);return}
 for(const r of list){
  const tr=el('tr');const c1=el('td');c1.append(el('strong','',r.name||'Sans nom'),el('small','',r.email||''));
  const c2=el('td','',r.track||'—');const c3=el('td');const meter=el('div','meter'),bar=el('span','bar'),fill=el('i');fill.style.width=`${r.triage?.score||0}%`;bar.append(fill);meter.append(bar,el('span','',scoreText(r)));c3.append(meter);
  const c4=el('td');c4.append(statusPill(r.status));const op=missionStatus.get(r.id);if(op?.rsvp==='confirmed')c4.append(el('small','','Participation confirmée'));else if(op?.rsvp==='declined')c4.append(el('small','','Participation déclinée'));if(op?.checkedInAt)c4.append(el('small','','Présence validée'));const c5=el('td','',new Date(r.createdAt).toLocaleDateString('fr-MA',{day:'2-digit',month:'short',year:'numeric'}));
  for(const [cell,label] of [[c1,'Candidat'],[c2,'Verticale'],[c3,'Documentation'],[c4,'Statut RH'],[c5,'Date']]) cell.dataset.label=label;
  const c6=el('td'),btn=el('button','more','Voir le dossier →');btn.addEventListener('click',()=>openDrawer(r.id));c6.dataset.label='';c6.append(btn);tr.append(c1,c2,c3,c4,c5,c6);body.append(tr);
 }
}
async function load(){
 const data=await api();records=data.records||[];await loadMissionStatus();render();if(selected){selected=records.find(r=>r.id===selected.id)||null;if(selected)drawDetail();else closeDrawer()}notify(`${records.length} candidature(s) chargée(s)`);
}
function clearCVPreview(){
 cvRequestNumber++;
 if(cvBlobURL){URL.revokeObjectURL(cvBlobURL);cvBlobURL=null;}
}
async function viewCandidateCV(id,section){
 clearCVPreview();const requestId=cvRequestNumber;
 section.replaceChildren(el('p','','Chargement sécurisé du CV…'));
 try{
  const response=await fetch('/.netlify/functions/candidate-cv?id='+encodeURIComponent(id),{method:'GET',headers:{Authorization:'Bearer '+secret},cache:'no-store',credentials:'same-origin'});
  if(!response.ok){const error=await response.json().catch(()=>({error:'Impossible d’ouvrir le CV'}));throw Error(error.error||'Impossible d’ouvrir le CV');}
  const blob=await response.blob();
  if(requestId!==cvRequestNumber)return;
  if(blob.type!=='application/pdf')throw Error('La pièce jointe n’est pas un PDF valide');
  cvBlobURL=URL.createObjectURL(blob);
  const controls=el('div','cv-actions');
  const download=el('a','cv-download','↓ Télécharger le CV');download.href=cvBlobURL;download.download='CV-candidat.pdf';
  const open=el('a','cv-download secondary','↗ Ouvrir en grand');open.href=cvBlobURL;open.target='_blank';open.rel='noopener noreferrer';
  controls.append(download,open);
  const viewer=el('iframe','cv-viewer');viewer.title='Aperçu sécurisé du CV PDF';viewer.src=cvBlobURL;viewer.setAttribute('loading','lazy');
  section.replaceChildren(controls,viewer);
 }catch(error){if(requestId!==cvRequestNumber)return;const msg=el('p','error',error.message||'Le CV est indisponible');section.replaceChildren(msg);
  const retry=el('button','cv-cta','Réessayer');retry.type='button';retry.addEventListener('click',()=>viewCandidateCV(id,section));section.append(retry);
 }
}
function addCVSection(root,r){
 const box=el('div','cv-panel');
 const sub=el('p','',r.hasCV?'Une pièce jointe est associée à cette candidature. Ouverture réservée à l’accès RH.':'Pas de CV renseigné dans le dossier RH. Tu peux rechercher une pièce jointe sur Netlify Forms.');box.append(sub);
 const button=el('button','cv-cta',r.hasCV?'Voir le CV PDF ↗':'Rechercher le CV dans Netlify');button.type='button';
 const display=el('div','cv-display');button.addEventListener('click',()=>viewCandidateCV(r.id,display));
 box.append(button,display);addSection(root,'CV · DOCUMENT CANDIDAT',box);
}
function addSection(target,title,content){const s=el('section','detail-section');s.append(el('h3','',title));if(typeof content==='string'){const p=el('p','',content||'Non renseigné');s.append(p)}else if(content)s.append(content);target.append(s);return s}
function detailMeta(r){const dl=el('dl','meta-grid');for(const [k,v] of [['École / parcours',r.school||'—'],['Verticale',r.track||'—'],['Disponibilité',r.data?.availability||'—'],['Participation',r.data?.format||'—'],['Ville',r.data?.city||'—'],['Situation',r.data?.status||'—'],['Opportunité',r.data?.opportunity||'—'],['Provenance',r.data?.utm_source||r.data?.source||'—']]){const div=el('div');div.append(el('dt','',k),el('dd','',v));dl.append(div)}return dl}
function drawDetail(){const r=selected;if(!r)return;clearCVPreview();const root=$('drawerBody');root.replaceChildren();$('drawerTitle').textContent=r.name||'Profil';$('drawerEmail').textContent=r.email||'';
 const next=nextAction(r,missionStatus.get(r.id),missionUnavailable);const step=el('div','rh-next-step');step.append(el('span','eyebrow','PROCHAINE ACTION'),el('h3','',next.label),el('p','',next.hint||''));root.append(step);
 const summary=el('div');summary.append(el('span','score-large',`${r.triage?.score||0}/100`),el('p','','Score de documentation — indicateur de complétude, pas d’aptitude professionnelle.'));addSection(root,'ANALYSE DE COMPLÉTUDE · GRATUITE',summary);
 const tags=el('div','chip-row');for(const v of r.triage?.evidence||[])tags.append(el('span','chip','✓ '+v));if((r.triage?.missing||[]).length){tags.append(el('span','chip',`${r.triage.missing.length} élément(s) à approfondir`))}addSection(root,'ÉLÉMENTS PRÉSENTS',tags);
 addSection(root,'INFORMATIONS',detailMeta(r));
 addCVSection(root,r);
 addSection(root,'PROJET RÉALISÉ',r.data?.project||'Non renseigné');
 addSection(root,'DIFFICULTÉ SURMONTÉE',r.data?.obstacle||'Non renseigné');
 addSection(root,'OUTILS IA',r.data?.ai_tools||'Non renseigné');
 addSection(root,'USAGE IA',r.data?.ai_usage||'Non renseigné');
 addSection(root,'AGENTS IA / AUTOMATISATIONS',r.data?.ai_agents||'Non renseigné');
 addSection(root,'IDÉE D’AGENT IA POUR H&S',r.data?.ai_agent_idea||'Non renseigné');
 const links=el('div');if(r.data?.portfolio){try{const u=new URL(r.data.portfolio);if(['https:','http:'].includes(u.protocol)){const a=el('a','',r.data.portfolio);a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';a.style.textDecoration='underline';links.append(a)}}catch{}}
 if(!links.childNodes.length)links.append(el('p','','Aucun lien de projet renseigné.'));addSection(root,'PORTFOLIO',links);
 const actions=el('div','status-actions');for(const status of statusList){if(['invited','confirmed'].includes(status))continue;const b=el('button',status===r.status?'active':'',labelStatus[status]);b.disabled=status===r.status||!!r.invitedAt||['invited','confirmed'].includes(r.status);b.addEventListener('click',()=>setStatus(status));actions.append(b)}if(r.status==='confirmed'&&!r.invitedAt)actions.append(el('p','','Ancienne présélection : utilisez « Corriger les anciens statuts » dans le cockpit. Les confirmations RSVP restent distinctes.'));if(r.status==='rejected'&&r.nonselection){const reinstate=el('button','primary','Réintégrer et réactiver l’invitation');reinstate.type='button';reinstate.disabled=r.nonselection.state==='sending';reinstate.onclick=()=>reinstateCandidate(r);actions.append(el('p','','Mail de non-sélection conservé dans l’historique. Réintégration exceptionnelle sur décision RH.'),reinstate)}addSection(root,'DÉCISION RH · MANUELLE',actions);
 const notes=el('div','notes');for(const n of [...(r.notes||[])].reverse()){const item=el('div','note-item');item.append(el('small','',new Date(n.at).toLocaleString('fr-MA')),el('p','',n.text));notes.append(item)}const label=el('label','','Ajouter une observation interne');label.setAttribute('for','noteText');const textarea=el('textarea');textarea.id='noteText';textarea.maxLength=1200;textarea.placeholder='À vérifier en entretien, retour du référent métier…';notes.append(label,textarea);addSection(root,'NOTES INTERNES',notes);
 const op=missionStatus.get(r.id),panel=el('div','hns-pass-status');panel.append(el('p','',missionUnavailable?'Connexion opérationnelle indisponible — aucun envoi possible.':op?'Pass : '+passLabel(op.passStatus)+' · Email : '+passLabel(op.mailStatus)+' · Réponse : '+passLabel(op.rsvp):'Pass non préparé.'));if(op?.checkedInAt)panel.append(el('p','','Arrivée : '+new Date(op.checkedInAt).toLocaleString('fr-MA')));const go=el('a','','Ouvrir Mission Control');go.href='/mission-control/';go.onclick=async e=>{e.preventDefault();try{const session=await missionApi({action:'rh-session'});if(session.role!=='rh'||!session.token)throw Error('Session RH indisponible');sessionStorage.setItem('hns_mission_token',session.token);sessionStorage.setItem('hns_mission_role','rh');location.assign('/mission-control/')}catch(err){notify(err.message,true)}};panel.append(go);addSection(root,'PASS & PARTICIPATION',panel);
 $('sendInvite').disabled=next.kind==='none'||!!next.disabled;$('sendInvite').textContent=next.label;$('sendInvite').onclick=()=>next.kind==='select'?confirm('Valider définitivement ce candidat ? Aucun email ne sera envoyé.')&&setStatus('selected'):next.kind==='pass'?invite():undefined;
}
function openDrawer(id){selected=records.find(r=>r.id===id)||null;if(!selected)return;previousFocus=document.activeElement;$('shade').hidden=false;$('drawer').hidden=false;document.body.style.overflow='hidden';drawDetail();$('closeDrawer').focus()}
function closeDrawer(){clearCVPreview();$('shade').hidden=true;$('drawer').hidden=true;document.body.style.overflow='';selected=null;previousFocus?.focus()}
async function postAction(body,success){try{await api('POST',body);await load();if(selected){selected=records.find(r=>r.id===selected.id)||null;if(selected)drawDetail()}notify(success)}catch(err){notify(err.message,true)}}
async function reinstateCandidate(r){if(!r||selected?.id!==r.id||r.status!=='rejected')return;const reason=prompt('Motif de réintégration de '+r.name+' (obligatoire) :','Candidat retenu après correction RH, présent au hackathon');if(!reason||reason.trim().length<5)return;if(!confirm('Réintégrer uniquement '+r.name+' ? Le mail précédent restera dans l’historique. Aucun nouvel email ne sera envoyé automatiquement.'))return;await postAction({action:'reinstate',id:r.id,reason:reason.trim(),confirm:true},'Candidat réintégré. Ouvrez son pass personnel pour valider sa présence.')}
async function setStatus(status){if(!selected)return;if(status==='selected'&&selected.status==='rejected'&&selected.nonselection)return reinstateCandidate(selected);if(status==='rejected'&&!confirm('Marquer ce candidat comme « Non retenu » ? Aucun email ne sera envoyé.'))return;await postAction({action:'set-status',id:selected.id,status},'Statut RH actualisé')}
async function addNote(){const value=$('noteText')?.value?.trim();if(!selected||!value)return notify('Renseigne une note avant de l’ajouter',true);await postAction({action:'note',id:selected.id,note:value},'Note enregistrée')}
async function invite(){if(!selected||!['selected','invited','confirmed'].includes(selected.status))return;const id=selected.id,button=$('sendInvite');button.disabled=true;try{const p=await missionApi({action:'rh-pass-preview',candidateId:id});if(selected?.id!==id)return;const dlg=el('dialog','hns-pass-dialog');const heading=el('header','hns-pass-hero');heading.append(el('p','','H&S INVEST · AI TALENT CHALLENGE 2026'),el('h2','','Votre pass personnel'),el('span','pass-event','28 NOV 2026 · 10 H'));const body=el('div','hns-pass-body');body.append(el('h3','','Bonjour '+p.name+','),el('p','','Samedi 28 novembre 2026 · Accueil à 10 h · LA BASE, Casablanca'),el('p','','Destinataire : '+p.email));if(!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(p.qrCode))throw Error('QR non valide');const qr=el('img');qr.src=p.qrCode;qr.alt='QR personnel de présence';qr.width=210;qr.height=210;const ticket=el('section','pass-ticket');const ticketTop=el('div','pass-ticket-top');ticketTop.append(el('span','eyebrow','ACCÈS PARTICIPANT'),el('h3','',p.name),el('p','','LA BASE · CASABLANCA'));const ticketCode=el('div','pass-ticket-code');ticketCode.append(qr,el('span','eyebrow','CODE PERSONNEL'),el('strong','',p.code),el('small','','Référence '+p.reference));ticket.append(ticketTop,ticketCode);body.append(ticket,el('p','','Le code devient actif après validation de la présence.'));const actions=el('div','hns-pass-actions'),download=el('button','light','Télécharger le brouillon email'),send=el('button','primary','Envoyer le pass'),close=el('button','light','Fermer');download.onclick=()=>{const url=URL.createObjectURL(new Blob([p.eml],{type:'message/rfc822'}));const a=el('a');a.href=url;a.download='invitation-'+p.reference+'.eml';a.click();setTimeout(()=>URL.revokeObjectURL(url),500)};send.disabled=!p.sendEnabled;send.onclick=async()=>{if(!confirm('Envoyer réellement cette invitation à '+p.email+' ?'))return;send.disabled=true;try{const out=await missionApi({action:'rh-pass-send',candidateId:id,confirm:true});notify(out.mailStatus==='accepted'?'Invitation acceptée par le fournisseur':'Envoi à contrôler');dlg.close();await load()}catch(e){notify(e.message,true)}};close.onclick=()=>dlg.close();actions.append(download,send,close);body.append(actions);const availability=el('div','hns-send-diagnostic');availability.setAttribute('role','status');availability.append(el('strong','',p.sendEnabled?'Prêt à envoyer':'Envoi bloqué'),el('p','','Statut RH : '+(labelStatus[p.rhStatus]||p.rhStatus||'Non renseigné')+' · Email : '+passLabel(p.mailStatus)));if(!p.sendEnabled)availability.append(el('p','',p.sendBlocker?.message||'Actualisez la fiche pour connaître le motif du blocage.'));body.append(availability);dlg.append(heading,body);dlg.addEventListener('close',()=>dlg.remove(),{once:true});document.body.append(dlg);dlg.showModal()}catch(e){notify(e.message,true)}finally{if(selected?.id===id){const next=nextAction(selected,missionStatus.get(id),missionUnavailable);button.disabled=next.kind==='none'||!!next.disabled}}}

function exportCSV(){const cols=['Date','Nom','Email','Verticale','Parcours','Statut RH','Documentation /100','CV déclaré'];const list=[cols,...matchingRecords().map(r=>[r.createdAt,r.name,r.email,r.track,r.school,labelStatus[r.status]||r.status,r.triage?.score||0,r.hasCV?'Oui':'Non'])];const csv='\ufeff'+list.map(row=>row.map(v=>'"'+sanitizeCell(v)+'"').join(';')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='hns-ai-talent-candidatures-2026.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),500)}
function csvParse(raw){const rows=[];let row=[],v='',q=false;for(let i=0;i<raw.length;i++){const ch=raw[i];if(ch==='"'){if(q&&raw[i+1]==='"'){v+='"';i++}else q=!q}else if(ch===','&&!q){row.push(v);v=''}else if((ch==='\n'||ch==='\r')&&!q){if(ch==='\r'&&raw[i+1]==='\n')i++;row.push(v);rows.push(row);row=[];v=''}else v+=ch}if(v||row.length){row.push(v);rows.push(row)}if(rows.length<2)return [];const headings=rows.shift().map(h=>h.replace(/^\ufeff/,'').trim().toLowerCase().replace(/[^a-z0-9_]/g,''));return rows.map(row=>Object.fromEntries(headings.map((h,i)=>[h,row[i]||'']))).filter(x=>Object.values(x).some(Boolean))}
function normalizeImport(row){const aliases={name:['name','nom','fullname','nomcomplet'],email:['email','emailaddress','courriel'],school:['school','ecole','parcours'],status:['status','statut'],created_at:['created_at','createdat','date','submittedat'],project:['project','projet'],obstacle:['obstacle'],portfolio:['portfolio','lien'],ai_tools:['ai_tools','aitools'],ai_usage:['ai_usage','aiusage'],ai_agents:['ai_agents','aiagents'],ai_agent_idea:['ai_agent_idea','aiagentidea'],track:['track','verticale'],format:['format'],opportunity:['opportunity'],city:['city','ville'],availability:['availability'],source:['source'],consent:['consent'],cv:['cv']};const out={};for(const [field,names] of Object.entries(aliases)){const key=names.find(k=>row[k]!==undefined);out[field]=key?row[key]:''}return out}
$('loginForm').addEventListener('submit',async e=>{e.preventDefault();secret=$('adminKey').value.trim();$('adminKey').value='';try{await load();$('login').hidden=true;$('workspace').hidden=false;$('logout').hidden=false;void gmailStatus()}catch(err){secret='';notify(err.message,true)}});
$('logout').onclick=()=>{campaignStop=true;gmailReady=false;campaignChosen.clear();sessionStorage.removeItem('hns_mission_token');sessionStorage.removeItem('hns_mission_role');clearCVPreview();secret='';records=[];selected=null;journeyFilter='all';missionStatus.clear();closeDrawer();$('workspace').hidden=true;$('login').hidden=false;$('logout').hidden=true;notify('Session fermée')};
$('refresh').onclick=()=>load().catch(e=>notify(e.message,true));$('exportCsv').onclick=exportCSV;
for(const id of ['search','filterStatus','filterTrack','sortBy'])$(id).addEventListener(id==='search'?'input':'change',()=>{if(id==='filterStatus')journeyFilter='all';render()});
$('closeDrawer').onclick=closeDrawer;$('shade').onclick=closeDrawer;document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('drawer').hidden)closeDrawer()});$('saveNote').onclick=addNote;
$('openImport').onclick=()=>$('importDialog').showModal();
$('importCsv').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;try{const rows=csvParse(await f.text()).map(normalizeImport);imported=rows.filter(r=>r.email&&r.name);$('importPreview').textContent=`${imported.length} dossiers valides détectés. Aucun dossier existant ne sera remplacé.`;$('doImport').disabled=!imported.length}catch{notify('Fichier CSV invalide',true)}});
$('doImport').onclick=async()=>{if(!imported.length)return;try{let count=0,skipped=0;for(let i=0;i<imported.length;i+=150){const r=await api('POST',{action:'import',records:imported.slice(i,i+150)});count+=r.imported;skipped+=r.skipped}$('importDialog').close();await load();notify(`${count} dossiers importés, ${skipped} ignorés`)}catch(e){notify(e.message,true)}};

async function gmailStatus(){if(!secret)return;try{const status=await missionApi({action:'gmail-status'});gmailReady=!!(status.connected&&status.testedAt&&status.sendEnabled);renderCampaignMetrics();$('gmailStatus').textContent=status.connected?(status.email+' · '+(status.testedAt?'Test accepté par Gmail': 'Connectée — test interne requis')+' · '+(status.sendEnabled?'Envois activés':'Envois candidats désactivés')):'Gmail non connecté · recrutement@hns.ma';$('gmailConnect').textContent=status.connected?'Reconnecter Gmail':'Connecter Gmail';$('gmailTest').disabled=!status.connected||!!status.testedAt;}catch(e){gmailReady=false;renderCampaignMetrics();$('gmailStatus').textContent=e.message;$('gmailTest').disabled=true}}
$('gmailCheck').onclick=gmailStatus;
$('gmailConnect').onclick=async()=>{const popup=window.open('about:blank','_blank');if(!popup){notify('Autorisez les fenêtres contextuelles pour connecter Gmail.',true);return}popup.opener=null;try{const r=await missionApi({action:'gmail-connect'});const url=new URL(r.url);if(url.origin!=='https://accounts.google.com')throw Error('URL Google invalide');popup.location.href=url.href;$('gmailStatus').textContent='Autorisez Gmail dans le nouvel onglet, puis actualisez le statut.'}catch(e){popup.close();notify(e.message,true)}};
$('gmailTest').onclick=async()=>{if(!confirm('Envoyer un unique email de test à recrutement@hns.ma ? Aucun candidat ne sera contacté.'))return;$('gmailTest').disabled=true;try{await missionApi({action:'gmail-test',confirm:true});notify('Test accepté par Gmail. Vérifiez la boîte de réception.')}catch(e){notify(e.message,true)}finally{await gmailStatus()}};
window.addEventListener('focus',()=>{if(secret)void gmailStatus()});

function renderCampaignMetrics(){
 const m=campaignMetrics(records,missionStatus);
 const metrics=[['Dossiers en revue / validés',m.shortlist,'Objectif '+targets.shortlist],['Validés · à inviter',m.ready,'Sélection RH requise'],['Invitations acceptées',m.accepted,'Objectif '+targets.invited],['Confirmations RSVP',m.confirmed,m.pending+' réponses attendues'],['Présents',m.present,'Objectif '+targets.present],['Déclinés',m.declined,'Réponses négatives']];
 $('campaignMetrics').replaceChildren(...metrics.map(([label,value,detail])=>{const card=el('article','campaign-metric');card.append(el('span','',label),el('strong','',missionUnavailable?'—':value),el('small','',detail));return card}));
 $('campaignSummary').textContent=missionUnavailable?'Synchronisation indisponible — envois bloqués.':m.selected+' dossiers au statut sélectionné · '+m.ready+' prêts à inviter · '+m.legacyInvited+' invitations RH historiques / manuelles';
 $('campaignAlerts').textContent=missionUnavailable?'Actualisez les données avant de préparer un lot.':m.review?m.review+' envoi(s) à contrôler dans Gmail. Aucune relance automatique.':!gmailReady?'Messagerie non activée : connectez Gmail et vérifiez le test.':'Les invitations sont individuelles. Aucun destinataire en copie.';
 $('openCampaign').disabled=!secret||missionUnavailable||!gmailReady||!m.ready||campaignRunning;
}
function renderCampaignRows(){
 const list=batchCandidates(records,missionStatus);
 $('campaignRows').replaceChildren(...list.map(r=>{
  const label=el('label','campaign-row');const cb=el('input');cb.type='checkbox';cb.checked=campaignChosen.has(r.id);cb.disabled=campaignRunning;cb.onchange=()=>{if(cb.checked){if(campaignChosen.size>=batchLimit){cb.checked=false;notify('Maximum '+batchLimit+' destinataires par lot.',true);return}campaignChosen.add(r.id)}else campaignChosen.delete(r.id);updateCampaignSelection()};const info=el('div');info.append(el('strong','',r.name||'Sans nom'),el('small','',r.email),el('small','',r.track||'Verticale non renseignée'));label.append(cb,info);return label;
 }));
 if(!list.length)$('campaignRows').append(el('p','','Aucun dossier sélectionné et éligible.'));
 updateCampaignSelection();
}
function updateCampaignSelection(){
 $('campaignSelection').textContent=campaignChosen.size+' destinataire(s) sur '+batchLimit+' maximum';
 $('sendCampaign').textContent='Envoyer '+campaignChosen.size+' invitation(s)';
 $('sendCampaign').disabled=campaignRunning||!gmailReady||!campaignChosen.size;
 $('selectCampaign').disabled=campaignRunning;$('clearCampaign').disabled=campaignRunning;
 $('closeCampaign').disabled=campaignRunning;
}
$('openCampaign').onclick=()=>{if(!gmailReady||missionUnavailable)return;campaignChosen.clear();$('campaignProgress').textContent='Vérifiez les noms et adresses avant de valider.';renderCampaignRows();$('campaignDialog').showModal()};
$('selectCampaign').onclick=()=>{if(campaignRunning)return;campaignChosen=new Set(batchCandidates(records,missionStatus).slice(0,batchLimit).map(r=>r.id));renderCampaignRows()};
$('clearCampaign').onclick=()=>{campaignChosen.clear();renderCampaignRows()};
$('closeCampaign').onclick=()=>{if(!campaignRunning)$('campaignDialog').close()};
$('campaignDialog').addEventListener('cancel',e=>{if(campaignRunning)e.preventDefault()});
$('stopCampaign').onclick=()=>{campaignStop=true;$('campaignProgress').textContent='Arrêt demandé après la requête en cours.'};
$('sendCampaign').onclick=async()=>{
 if(campaignRunning||!gmailReady||missionUnavailable)return;
 const eligible=new Set(batchCandidates(records,missionStatus).map(r=>r.id)),ids=[...campaignChosen].filter(id=>eligible.has(id));
 if(!ids.length||ids.length!==campaignChosen.size)return notify('La sélection a changé. Actualisez le lot.',true);
 if(!confirm('Envoyer réellement '+ids.length+' invitations individuelles depuis recrutement@hns.ma aux destinataires cochés ?'))return;
 campaignRunning=true;campaignStop=false;$('stopCampaign').hidden=false;renderCampaignRows();renderCampaignMetrics();
 try{
  const result=await sendBatch(ids,id=>missionApi({action:'rh-pass-send',candidateId:id,confirm:true}),(item,n)=>{$('campaignProgress').textContent=n+'/'+ids.length+' traité(s) · '+(item.state==='accepted'?'Accepté par Gmail':'Résultat à contrôler : lot interrompu')},()=>campaignStop||!secret);
  const accepted=result.results.filter(x=>x.state==='accepted').length,review=result.results.length-accepted;
  $('campaignProgress').textContent=accepted+' accepté(s) · '+review+' à contrôler · '+result.remaining+' non traité(s). Aucun renvoi automatique.';
  campaignChosen.clear();await load();await gmailStatus();
 }catch(e){$('campaignProgress').textContent='Actualisation impossible. Vérifiez les statuts dans Gmail avant toute relance.'}
 finally{campaignRunning=false;$('stopCampaign').hidden=true;renderCampaignRows();renderCampaignMetrics()}
};

let resetSnapshot=null,resetRunning=false;
function setResetBusy(busy){resetRunning=busy;$('closeReset').disabled=busy;$('refreshReset').disabled=busy;$('resetIncludeSelected').disabled=busy;$('applyReset').disabled=busy||!resetSnapshot?.eligible.length;}
async function analyzeReset(){
 if(resetRunning||!secret)return;
 resetSnapshot=null;setResetBusy(true);$('resetSummary').textContent='Analyse sécurisée de l’historique, des emails et des réponses…';$('resetRows').replaceChildren();
 try{
  const includeSelected=$('resetIncludeSelected').checked;
  const data=await missionApi({action:'rh-reset-preview',includeSelected});
  resetSnapshot={eligible:data.eligible||[],protected:data.protected||[],includeSelected};
  $('resetSummary').textContent=resetSnapshot.eligible.length+' dossier(s) à reclasser · '+resetSnapshot.protected.length+' protégé(s). Aucun email ne sera envoyé.';
  for(const [list,label] of [[resetSnapshot.eligible,'À reclasser'],[resetSnapshot.protected,'Protégé — inchangé']]){
   for(const r of list){const item=el('div','campaign-row');const info=el('div');info.append(el('strong','',r.name||'Sans nom'),el('small','',label+' · '+(labelStatus[r.status]||r.status)));item.append(info);$('resetRows').append(item);}
  }
 }catch(e){$('resetSummary').textContent=e.message;resetSnapshot=null}finally{setResetBusy(false)}
}
$('openReset').onclick=()=>{if(campaignRunning)return notify('Terminez le lot d’invitations avant de reclasser.',true);$('resetIncludeSelected').checked=false;resetSnapshot=null;$('resetDialog').showModal();void analyzeReset()};
$('refreshReset').onclick=analyzeReset;
$('resetIncludeSelected').onchange=analyzeReset;
$('closeReset').onclick=()=>{if(!resetRunning)$('resetDialog').close()};
$('resetDialog').addEventListener('cancel',e=>{if(resetRunning)e.preventDefault()});
$('applyReset').onclick=async()=>{
 if(resetRunning||campaignRunning||!resetSnapshot?.eligible.length)return;
 const snapshot=resetSnapshot,ids=snapshot.eligible.map(r=>r.id);
 if(!confirm('Reclasser '+ids.length+' dossiers dans Présélection / entretien ? Les invitations et réponses existantes seront protégées. Aucun email ne sera envoyé.'))return;
 setResetBusy(true);let moved=0,skipped=0,processed=0;
 try{
  for(let i=0;i<ids.length;i+=20){const result=await missionApi({action:'rh-reset-apply',includeSelected:snapshot.includeSelected,ids:ids.slice(i,i+20),confirm:true});for(const entry of result.results||[]){processed++;if(entry.state==='moved')moved++;else skipped++;}$('resetSummary').textContent=processed+'/'+ids.length+' traité(s) · '+moved+' reclassé(s) · '+skipped+' protégé(s) ou à vérifier.';}
  resetSnapshot=null;$('resetRows').replaceChildren();await load();
  $('resetSummary').textContent=moved+' dossier(s) reclassé(s) dans Présélection / entretien. '+skipped+' dossier(s) non modifié(s). Aucun email envoyé.';
 }catch(e){resetSnapshot=null;$('resetSummary').textContent=moved+' modification(s) confirmée(s) avant interruption. Actualisez l’analyse avant toute nouvelle opération.';try{await load()}catch{}}
 finally{setResetBusy(false)}
};

$('closeRestoreReport').onclick=()=>$('restoreReportDialog').close();
$('restoreReport').onclick=async()=>{
 const root=$('restoreReportBody');root.replaceChildren(el('p','','Lecture du rapport de production…'));$('restoreReportDialog').showModal();
 try{
  const {report}=await missionApi({action:'rh-restore-status'});
  const labels={completed:'Restauration terminée',partial:'Restauration partielle — à contrôler',running:'Opération enregistrée comme en cours',review_required:'Rapport à contrôler',not_started:'Aucun rapport enregistré'};
  root.replaceChildren(el('h3','',labels[report?.state]||'État non disponible'));
  if(Number.isInteger(report?.restored)){for(const [label,value] of [['Dossiers retrouvés',report.matched],['Remis en sélectionné',report.restored],['Protégés',report.protected],['Conflits',report.conflicts],['Erreurs',report.errors]]){const row=el('div','restore-stat');row.append(el('span','',label),el('strong','',String(value??'—')));root.append(row)}}
  if(report?.finishedAt)root.append(el('p','','Rapport du '+new Date(report.finishedAt).toLocaleString('fr-MA',{timeZone:'Africa/Casablanca'})));
  root.append(el('p','','Lecture seule. Aucun statut ni email modifié.'));
 }catch(e){root.replaceChildren(el('p','',e.message||'Rapport indisponible'))}
};

function chooseJourney(id){journeyFilter=id;$('filterStatus').value='';$('filterTrack').value='';$('search').value='';render();$('candidateList').scrollIntoView({behavior:'smooth',block:'start'})}
function renderJourney(){
 const box=$('journeyStages');box.replaceChildren();
 stages.forEach((stage,index)=>{
  const count=records.filter(r=>inStage(r,missionStatus.get(r.id),stage.id)).length;
  const unknown=missionUnavailable&&!['interview','selected'].includes(stage.id);
  const button=el('button','journey-stage'+(journeyFilter===stage.id?' chosen':''));button.type='button';button.setAttribute('aria-pressed',String(journeyFilter===stage.id));button.disabled=unknown;
  button.append(el('span','journey-index',String(index+1).padStart(2,'0')),el('strong','journey-value',unknown?'—':String(count)),el('span','journey-label',stage.label),el('small','',stage.hint));
  if(stage.target&&!unknown){const p=el('progress');p.max=stage.target;p.value=Math.min(count,stage.target);p.setAttribute('aria-label',count+' sur objectif '+stage.target);button.append(p)}
  button.onclick=()=>chooseJourney(stage.id);box.append(button);
 });
 const active=stages.find(x=>x.id===journeyFilter);$('journeyHint').textContent=active?'Vue active : '+active.label+'. Les chiffres sont des états actuels, pas un cumul.':'Choisissez une étape pour filtrer les dossiers. Les chiffres sont des états actuels, pas un cumul.';
}
$('journeyStart').onclick=()=>chooseJourney('interview');$('journeyAll').onclick=()=>chooseJourney('all');
$('journeyCheckin').onclick=async()=>{const b=$('journeyCheckin');b.disabled=true;try{const session=await missionApi({action:'rh-session'});if(session.role!=='rh'||!session.token)throw Error('Session RH indisponible');sessionStorage.setItem('hns_mission_token',session.token);sessionStorage.setItem('hns_mission_role','rh');location.assign('/mission-control/')}catch(e){notify(e.message,true)}finally{b.disabled=false}};

/* Non-selection communication: deliberately separate from invitations and RH decisions. */
const nonselectionPanel=el('section','campaign-panel nonselection-panel');
nonselectionPanel.innerHTML='<header><div><span class="eyebrow">RELATION CANDIDATS · ÉDITION 01</span><h2>Continuer l’aventure</h2><p>Informer avec bienveillance les candidats non retenus et annoncer le deuxième hackathon.</p></div><button type="button" class="primary" id="openNonselection">Préparer les emails</button></header><p class="subtle">Finalisez en masse les dossiers hors sélection, puis préparez les emails. Les sélectionnés, invités, confirmés et passes existants sont protégés.</p>';
$('campaignTitle').closest('section').after(nonselectionPanel);
const nonselectionDialog=el('dialog','hns-pass-dialog nonselection-dialog');nonselectionDialog.innerHTML='<header class="hns-pass-hero"><p>H&S · RELATION CANDIDATS</p><h2>Une réponse à chaque candidat.</h2></header><div class="nonselection-body"><p id="nonselectionStatus" role="status" aria-live="polite"></p><div class="nonselection-controls"><button type="button" id="nsRefresh">Actualiser</button><button type="button" id="nsBulkMark">Classer les dossiers hors sélection</button><button type="button" id="nsSelect">Sélectionner les 20 suivants</button><button type="button" id="nsAll">Sélectionner tous les éligibles</button><button type="button" id="nsClear">Vider la sélection</button></div><div id="nsRows" class="nonselection-rows"></div><section id="nsPreview" hidden><h3>Aperçu personnalisé</h3><p id="nsRecipient"></p><strong id="nsSubject"></strong><iframe id="nsHtml" title="Aperçu du mail de non-sélection" sandbox="" referrerpolicy="no-referrer"></iframe><details><summary>Version texte</summary><pre id="nsText"></pre></details></section><p id="nsCount" aria-live="polite"></p><div class="nonselection-controls"><button type="button" class="primary" id="nsSend" disabled>Envoyer</button><button type="button" id="nsStop" hidden>Arrêter le lot</button><button type="button" id="nsClose">Fermer</button></div></div>';
document.body.append(nonselectionDialog);
let nsRows=[],nsChosen=new Set(),nsBusy=false,nsStop=false,nsEnabled=false,nsEpoch=0,nsPreviewId=null;
function nsLock(){for(const id of ['nsRefresh','nsSelect','nsAll','nsBulkMark','nsClear','nsClose'])$(id).disabled=nsBusy;$('nsSend').disabled=nsBusy||!nsEnabled||!nsChosen.size||!nsPreviewId||!nsChosen.has(nsPreviewId)||!gmailReady||campaignRunning||resetRunning;$('nsCount').textContent=nsChosen.size+' destinataire(s) sélectionné(s) · Prévisualisez un email avant envoi.';$('nsSend').textContent='Envoyer '+nsChosen.size+' email(s)';$('nsRows').querySelectorAll('button').forEach(x=>x.disabled=nsBusy);$('nsRows').querySelectorAll('input').forEach((x,i)=>x.disabled=nsBusy||nsRows[i]?.state!=='ready')}
function nsRender(){
 const labels={ready:'À informer',protected:'Protégé',accepted:'Accepté par la messagerie',sending:'En cours — à contrôler',review_required:'À contrôler'};
 $('nsRows').replaceChildren(...nsRows.map(r=>{const row=el('article','campaign-row'),cb=el('input');cb.type='checkbox';cb.checked=nsChosen.has(r.id);cb.disabled=r.state!=='ready'||nsBusy;cb.onchange=()=>{if(r.state!=='ready'||nsBusy){cb.checked=false;return}if(cb.checked){if(nsChosen.size>=700){cb.checked=false;return notify('Maximum 700 destinataires.',true)}nsChosen.add(r.id)}else nsChosen.delete(r.id);if(!nsChosen.has(nsPreviewId)){nsPreviewId=null;$('nsPreview').hidden=true}nsLock();};const info=el('div','ns-info');info.append(el('strong','',r.name),el('small','',r.email),el('small','',labels[r.state]||'À vérifier'));if(r.state==='protected')info.append(el('small','',r.blocker));row.append(cb,info);if(r.state==='ready'){const b=el('button','','Aperçu');b.type='button';b.onclick=async()=>{if(nsBusy||!secret)return;const key=secret,epoch=nsEpoch;try{const p=await missionApi({action:'rh-nonselection-preview',candidateId:r.id});if(secret!==key||epoch!==nsEpoch||!nonselectionDialog.open)return;nsPreviewId=r.id;$('nsRecipient').textContent=p.email;$('nsSubject').textContent=p.mail.subject;$('nsText').textContent=p.mail.text;$('nsHtml').srcdoc=String(p.mail.html||'').replace(/href\s*=\s*(["']).*?\1/gi,'href="#"');$('nsPreview').hidden=false;nsLock()}catch(e){notify(e.message,true)}};row.append(b)}return row}));
 if(!nsRows.length)$('nsRows').append(el('p','','Aucun dossier au statut Non retenu.'));
 nsLock();$('nsRows').querySelectorAll('input').forEach((x,i)=>x.disabled=nsBusy||nsRows[i]?.state!=='ready');
}
async function nsRefresh(){if(nsBusy||!secret)return;const key=secret,epoch=++nsEpoch;nsBusy=true;nsEnabled=false;nsChosen.clear();nsRows=[];nsPreviewId=null;$('nsPreview').hidden=true;$('nonselectionStatus').textContent='Vérification des décisions RH et des invitations existantes…';nsRender();try{const rejected=records.filter(r=>r.status==='rejected');let enabled=true;for(let i=0;i<rejected.length;i+=60){const part=rejected.slice(i,i+60);const res=await missionApi({action:'rh-nonselection-status',ids:part.map(r=>r.id)});if(secret!==key||epoch!==nsEpoch)return;enabled=enabled&&res.enabled;const map=new Map(res.entries.map(x=>[x.id,x]));nsRows.push(...part.map(r=>({id:r.id,name:r.name,email:r.email,...(map.get(r.id)||{state:'protected',blocker:'Statut non vérifié'})})));}nsEnabled=enabled;$('nonselectionStatus').textContent=nsRows.filter(r=>r.state==='ready').length+' à informer · '+nsRows.filter(r=>r.state==='accepted').length+' déjà traités · '+nsRows.filter(r=>!['ready','accepted'].includes(r.state)).length+' protégés ou à vérifier.'}catch(e){nsEnabled=false;nsRows=[];$('nonselectionStatus').textContent=e.message}finally{nsBusy=false;if(secret===key&&epoch===nsEpoch)nsRender()}}
$('openNonselection').onclick=()=>{if(!secret||campaignRunning||resetRunning)return notify('Terminez les opérations RH en cours.',true);nonselectionDialog.showModal();void nsRefresh()};
$('nsBulkMark').onclick=async()=>{
 if(nsBusy||!secret||campaignRunning||resetRunning)return;
 const key=secret,epoch=++nsEpoch;nsBusy=true;nsLock();let marked=0,blocked=0,issue='';
 try{
  await load();if(secret!==key||epoch!==nsEpoch)return;
  const snapshot=records.filter(r=>['received','review','interview'].includes(r.status)).map(r=>({id:r.id,status:r.status}));
  if(!snapshot.length){issue='Aucun dossier en attente de décision.';return}
  const eligible=[];for(let i=0;i<snapshot.length;i+=60){
   $('nonselectionStatus').textContent='Vérification des protections : '+Math.min(i+60,snapshot.length)+' / '+snapshot.length;
   const r=await missionApi({action:'rh-nonselection-bulk-preview',items:snapshot.slice(i,i+60)});
   if(secret!==key||epoch!==nsEpoch)return;
   for(const row of r.results||[])if(row.state==='eligible')eligible.push({id:row.id,status:row.status});else blocked++;
  }
  if(!eligible.length){issue='Aucun dossier éligible.';return}
  if(!confirm('Passer '+eligible.length+' dossiers hors sélection au statut Non retenu ? '+blocked+' dossier(s) protégé(s) ou à vérifier. Aucun mail ne sera envoyé à cette étape.')){issue='Opération annulée.';return}
  for(let i=0;i<eligible.length;i+=20){
   if(secret!==key||epoch!==nsEpoch)return;
   const r=await missionApi({action:'rh-nonselection-bulk-mark',items:eligible.slice(i,i+20),confirm:true});
   marked+=(r.results||[]).filter(x=>x.state==='marked').length;blocked+=(r.results||[]).filter(x=>x.state!=='marked').length;
   $('nonselectionStatus').textContent=marked+' dossiers classés · '+blocked+' protégés / à vérifier.';
   if((r.results||[]).some(x=>x.state==='review')){issue='Arrêt : vérifier les dossiers en erreur.';break}
  }
 }catch(e){issue=e.message}finally{
  nsBusy=false;if(secret===key&&epoch===nsEpoch){try{await load();await nsRefresh()}catch(e){issue=issue||e.message}if(secret===key)$('nonselectionStatus').textContent=marked+' dossier(s) classé(s) Non retenu · '+blocked+' protégé(s) / à vérifier. '+issue+' Aucun email envoyé.';}
 }
};
$('nsAll').onclick=()=>{if(nsBusy)return;nsChosen=new Set(nsRows.filter(r=>r.state==='ready').map(r=>r.id));nsRender()};
$('nsRefresh').onclick=nsRefresh;$('nsSelect').onclick=()=>{if(nsBusy)return;nsChosen=new Set(nsRows.filter(r=>r.state==='ready').slice(0,20).map(r=>r.id));nsRender()};$('nsClear').onclick=()=>{nsChosen.clear();nsPreviewId=null;$('nsPreview').hidden=true;nsRender()};$('nsClose').onclick=()=>{if(!nsBusy){nsEpoch++;nonselectionDialog.close()}};nonselectionDialog.addEventListener('cancel',e=>{if(nsBusy)e.preventDefault();else nsEpoch++});
$('nsStop').onclick=()=>{nsStop=true;$('nonselectionStatus').textContent='Arrêt demandé après le message en cours.'};
$('nsSend').onclick=async()=>{if(nsBusy||!nsEnabled||!gmailReady||!secret||campaignRunning||resetRunning||!nsChosen.has(nsPreviewId))return;const ids=[...nsChosen],key=secret;if(!ids.length||ids.length>700||ids.some(id=>!nsRows.some(r=>r.id===id&&r.state==='ready')))return;if(!confirm('Envoyer réellement '+ids.length+' email(s) individuels de non-sélection ? Vérifiez que ces décisions sont définitives pour la première édition.'))return;nsBusy=true;nsStop=false;$('nsStop').hidden=false;nsLock();let sent=0,issue=false;try{for(const id of ids){if(nsStop||secret!==key)break;try{const p=await missionApi({action:'rh-nonselection-send',candidateId:id,confirm:true});if(p.mailStatus!=='accepted')throw Error('État à vérifier');sent++;$('nonselectionStatus').textContent=sent+'/'+ids.length+' messages acceptés par la messagerie.'}catch{issue=true;break}}}finally{nsBusy=false;$('nsStop').hidden=true;if(secret===key){await nsRefresh();$('nonselectionStatus').textContent=sent+' accepté(s) · '+(ids.length-sent)+' non confirmé(s) dans ce lot. '+(issue?'Contrôlez le dernier envoi dans Gmail avant toute nouvelle opération.':'Aucune relance automatique.')}else{nsRows=[];nsChosen.clear();nonselectionDialog.close();nsRender()}}};
$('logout').addEventListener('click',()=>{nsStop=true;nsEpoch++;nsChosen.clear();nsRows=[];nsEnabled=false;nsPreviewId=null;$('nsPreview').hidden=true;$('nsText').textContent='';$('nsHtml').srcdoc='';$('nsRecipient').textContent='';$('nsSubject').textContent='';$('nsRows').replaceChildren();if(nonselectionDialog.open)nonselectionDialog.close()});
