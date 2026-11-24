'use strict';
const $=id=>document.getElementById(id);
const labelStatus={received:'Reçu',review:'À étudier',interview:'Entretien',selected:'Sélectionné',invited:'Invité',confirmed:'Confirmé',rejected:'Non retenu',sending:'Envoi en cours'};
const statusList=['received','review','interview','selected','invited','confirmed','rejected'];
let secret='',records=[],selected=null,previousFocus=null,imported=[],cvBlobURL=null,cvRequestNumber=0;
let missionStatus=new Map(), missionUnavailable=false;
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
 const list=records.filter(r=>(!status||r.status===status)&&(!track||r.track===track)&&(!term||[r.name,r.email,r.school,r.track,r.data?.project,r.data?.ai_tools,r.data?.ai_agents].join(' ').toLowerCase().includes(term)));
 const sort=$('sortBy').value;
 list.sort((a,b)=>sort==='documented'?(b.triage?.score||0)-(a.triage?.score||0):sort==='oldest'?(a.createdAt||'').localeCompare(b.createdAt||''):(b.createdAt||'').localeCompare(a.createdAt||''));
 return list;
}
function render(){updateMetrics();const list=matchingRecords(),body=$('rows');body.replaceChildren();$('countLabel').textContent=`${list.length} dossier(s) affiché(s) sur ${records.length}`;
 if(!list.length){const tr=el('tr');const td=el('td','empty','Aucune candidature trouvée. Modifie les filtres ou importe les anciens dossiers.');td.colSpan=6;tr.append(td);body.append(tr);return}
 for(const r of list){
  const tr=el('tr');const c1=el('td');c1.append(el('strong','',r.name||'Sans nom'),el('small','',r.email||''));
  const c2=el('td','',r.track||'—');const c3=el('td');const meter=el('div','meter'),bar=el('span','bar'),fill=el('i');fill.style.width=`${r.triage?.score||0}%`;bar.append(fill);meter.append(bar,el('span','',scoreText(r)));c3.append(meter);
  const c4=el('td');c4.append(statusPill(r.status));const c5=el('td','',new Date(r.createdAt).toLocaleDateString('fr-MA',{day:'2-digit',month:'short',year:'numeric'}));
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
 const actions=el('div','status-actions');for(const status of statusList){if(status==='invited')continue;const b=el('button',status===r.status?'active':'',labelStatus[status]);b.disabled=status===r.status||r.status==='invited'&&status!=='confirmed';b.addEventListener('click',()=>setStatus(status));actions.append(b)}addSection(root,'DÉCISION RH · MANUELLE',actions);
 const notes=el('div','notes');for(const n of [...(r.notes||[])].reverse()){const item=el('div','note-item');item.append(el('small','',new Date(n.at).toLocaleString('fr-MA')),el('p','',n.text));notes.append(item)}const label=el('label','','Ajouter une observation interne');label.setAttribute('for','noteText');const textarea=el('textarea');textarea.id='noteText';textarea.maxLength=1200;textarea.placeholder='À vérifier en entretien, retour du référent métier…';notes.append(label,textarea);addSection(root,'NOTES INTERNES',notes);
 const op=missionStatus.get(r.id),panel=el('div','hns-pass-status');panel.append(el('p','',missionUnavailable?'Connexion opérationnelle indisponible — aucun envoi possible.':op?'Pass : '+passLabel(op.passStatus)+' · Email : '+passLabel(op.mailStatus)+' · Réponse : '+passLabel(op.rsvp):'Pass non préparé.'));if(op?.checkedInAt)panel.append(el('p','','Arrivée : '+new Date(op.checkedInAt).toLocaleString('fr-MA')));const go=el('a','','Ouvrir Mission Control');go.href='/mission-control/';go.onclick=async e=>{e.preventDefault();try{const session=await missionApi({action:'rh-session'});if(session.role!=='rh'||!session.token)throw Error('Session RH indisponible');sessionStorage.setItem('hns_mission_token',session.token);sessionStorage.setItem('hns_mission_role','rh');location.assign('/mission-control/')}catch(err){notify(err.message,true)}};panel.append(go);addSection(root,'PASS & PARTICIPATION',panel);
 $('sendInvite').disabled=!['selected','invited','confirmed'].includes(r.status)||missionUnavailable;$('sendInvite').textContent='Prévisualiser le pass';
}
function openDrawer(id){selected=records.find(r=>r.id===id)||null;if(!selected)return;previousFocus=document.activeElement;$('shade').hidden=false;$('drawer').hidden=false;document.body.style.overflow='hidden';drawDetail();$('closeDrawer').focus()}
function closeDrawer(){clearCVPreview();$('shade').hidden=true;$('drawer').hidden=true;document.body.style.overflow='';selected=null;previousFocus?.focus()}
async function postAction(body,success){try{await api('POST',body);await load();if(selected){selected=records.find(r=>r.id===selected.id)||null;if(selected)drawDetail()}notify(success)}catch(err){notify(err.message,true)}}
async function setStatus(status){if(!selected)return;if(status==='rejected'&&!confirm('Marquer ce candidat comme « Non retenu » ? Aucun email ne sera envoyé.'))return;await postAction({action:'set-status',id:selected.id,status},'Statut RH actualisé')}
async function addNote(){const value=$('noteText')?.value?.trim();if(!selected||!value)return notify('Renseigne une note avant de l’ajouter',true);await postAction({action:'note',id:selected.id,note:value},'Note enregistrée')}
async function invite(){if(!selected||!['selected','invited','confirmed'].includes(selected.status))return;const id=selected.id,button=$('sendInvite');button.disabled=true;try{const p=await missionApi({action:'rh-pass-preview',candidateId:id});if(selected?.id!==id)return;const dlg=el('dialog','hns-pass-dialog');const heading=el('header','hns-pass-hero');heading.append(el('p','','H&S INVEST · AI TALENT CHALLENGE 2026'),el('h2','','Votre aventure commence ici.'));const body=el('div','hns-pass-body');body.append(el('h3','','Bonjour '+p.name+','),el('p','','Samedi 28 novembre 2026 · Invitation individuelle'),el('p','','Destinataire : '+p.email));if(!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(p.qrCode))throw Error('QR non valide');const qr=el('img');qr.src=p.qrCode;qr.alt='QR personnel de présence';qr.width=210;qr.height=210;body.append(qr,el('p','','Référence : '+p.reference),el('strong','',p.code),el('p','','Le code devient actif après validation de la présence.'));const actions=el('div','hns-pass-actions'),download=el('button','light','Télécharger le brouillon email'),send=el('button','primary','Envoyer le pass'),close=el('button','light','Fermer');download.onclick=()=>{const url=URL.createObjectURL(new Blob([p.eml],{type:'message/rfc822'}));const a=el('a');a.href=url;a.download='invitation-'+p.reference+'.eml';a.click();setTimeout(()=>URL.revokeObjectURL(url),500)};send.disabled=!p.sendEnabled;send.onclick=async()=>{if(!confirm('Envoyer réellement cette invitation à '+p.email+' ?'))return;send.disabled=true;try{const out=await missionApi({action:'rh-pass-send',candidateId:id,confirm:true});notify(out.mailStatus==='accepted'?'Invitation acceptée par le fournisseur':'Envoi à contrôler');dlg.close();await load()}catch(e){notify(e.message,true)}};close.onclick=()=>dlg.close();actions.append(download,send,close);body.append(actions);if(!p.sendEnabled)body.append(el('p','','Envoi désactivé, déjà enregistré ou à contrôler.'));dlg.append(heading,body);dlg.addEventListener('close',()=>dlg.remove(),{once:true});document.body.append(dlg);dlg.showModal()}catch(e){notify(e.message,true)}finally{button.disabled=false}}

function exportCSV(){const cols=['Date','Nom','Email','Verticale','Parcours','Statut RH','Documentation /100','CV déclaré'];const list=[cols,...matchingRecords().map(r=>[r.createdAt,r.name,r.email,r.track,r.school,labelStatus[r.status]||r.status,r.triage?.score||0,r.hasCV?'Oui':'Non'])];const csv='\ufeff'+list.map(row=>row.map(v=>'"'+sanitizeCell(v)+'"').join(';')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='hns-ai-talent-candidatures-2026.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),500)}
function csvParse(raw){const rows=[];let row=[],v='',q=false;for(let i=0;i<raw.length;i++){const ch=raw[i];if(ch==='"'){if(q&&raw[i+1]==='"'){v+='"';i++}else q=!q}else if(ch===','&&!q){row.push(v);v=''}else if((ch==='\n'||ch==='\r')&&!q){if(ch==='\r'&&raw[i+1]==='\n')i++;row.push(v);rows.push(row);row=[];v=''}else v+=ch}if(v||row.length){row.push(v);rows.push(row)}if(rows.length<2)return [];const headings=rows.shift().map(h=>h.replace(/^\ufeff/,'').trim().toLowerCase().replace(/[^a-z0-9_]/g,''));return rows.map(row=>Object.fromEntries(headings.map((h,i)=>[h,row[i]||'']))).filter(x=>Object.values(x).some(Boolean))}
function normalizeImport(row){const aliases={name:['name','nom','fullname','nomcomplet'],email:['email','emailaddress','courriel'],school:['school','ecole','parcours'],status:['status','statut'],created_at:['created_at','createdat','date','submittedat'],project:['project','projet'],obstacle:['obstacle'],portfolio:['portfolio','lien'],ai_tools:['ai_tools','aitools'],ai_usage:['ai_usage','aiusage'],ai_agents:['ai_agents','aiagents'],ai_agent_idea:['ai_agent_idea','aiagentidea'],track:['track','verticale'],format:['format'],opportunity:['opportunity'],city:['city','ville'],availability:['availability'],source:['source'],consent:['consent'],cv:['cv']};const out={};for(const [field,names] of Object.entries(aliases)){const key=names.find(k=>row[k]!==undefined);out[field]=key?row[key]:''}return out}
$('loginForm').addEventListener('submit',async e=>{e.preventDefault();secret=$('adminKey').value.trim();$('adminKey').value='';try{await load();$('login').hidden=true;$('workspace').hidden=false;$('logout').hidden=false;void gmailStatus()}catch(err){secret='';notify(err.message,true)}});
$('logout').onclick=()=>{sessionStorage.removeItem('hns_mission_token');sessionStorage.removeItem('hns_mission_role');clearCVPreview();secret='';records=[];selected=null;closeDrawer();$('workspace').hidden=true;$('login').hidden=false;$('logout').hidden=true;notify('Session fermée')};
$('refresh').onclick=()=>load().catch(e=>notify(e.message,true));$('exportCsv').onclick=exportCSV;
for(const id of ['search','filterStatus','filterTrack','sortBy'])$(id).addEventListener(id==='search'?'input':'change',render);
$('closeDrawer').onclick=closeDrawer;$('shade').onclick=closeDrawer;document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('drawer').hidden)closeDrawer()});$('saveNote').onclick=addNote;$('sendInvite').onclick=invite;
$('openImport').onclick=()=>$('importDialog').showModal();
$('importCsv').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;try{const rows=csvParse(await f.text()).map(normalizeImport);imported=rows.filter(r=>r.email&&r.name);$('importPreview').textContent=`${imported.length} dossiers valides détectés. Aucun dossier existant ne sera remplacé.`;$('doImport').disabled=!imported.length}catch{notify('Fichier CSV invalide',true)}});
$('doImport').onclick=async()=>{if(!imported.length)return;try{let count=0,skipped=0;for(let i=0;i<imported.length;i+=150){const r=await api('POST',{action:'import',records:imported.slice(i,i+150)});count+=r.imported;skipped+=r.skipped}$('importDialog').close();await load();notify(`${count} dossiers importés, ${skipped} ignorés`)}catch(e){notify(e.message,true)}};

async function gmailStatus(){if(!secret)return;try{const status=await missionApi({action:'gmail-status'});$('gmailStatus').textContent=status.connected?(status.email+' · '+(status.testedAt?'Test accepté par Gmail': 'Connectée — test interne requis')+' · '+(status.sendEnabled?'Envois activés':'Envois candidats désactivés')):'Gmail non connecté · recrutement@hns.ma';$('gmailConnect').textContent=status.connected?'Reconnecter Gmail':'Connecter Gmail';$('gmailTest').disabled=!status.connected||!!status.testedAt;}catch(e){$('gmailStatus').textContent=e.message;$('gmailTest').disabled=true}}
$('gmailCheck').onclick=gmailStatus;
$('gmailConnect').onclick=async()=>{const popup=window.open('about:blank','_blank');if(!popup){notify('Autorisez les fenêtres contextuelles pour connecter Gmail.',true);return}popup.opener=null;try{const r=await missionApi({action:'gmail-connect'});const url=new URL(r.url);if(url.origin!=='https://accounts.google.com')throw Error('URL Google invalide');popup.location.href=url.href;$('gmailStatus').textContent='Autorisez Gmail dans le nouvel onglet, puis actualisez le statut.'}catch(e){popup.close();notify(e.message,true)}};
$('gmailTest').onclick=async()=>{if(!confirm('Envoyer un unique email de test à recrutement@hns.ma ? Aucun candidat ne sera contacté.'))return;$('gmailTest').disabled=true;try{await missionApi({action:'gmail-test',confirm:true});notify('Test accepté par Gmail. Vérifiez la boîte de réception.')}catch(e){notify(e.message,true)}finally{await gmailStatus()}};
window.addEventListener('focus',()=>{if(secret)void gmailStatus()});
