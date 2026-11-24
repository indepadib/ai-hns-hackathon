// UI adapter for the existing authenticated RH page; no endpoint is assumed.
export function mountBulkPreselection(root, api) {
  if (!root || typeof api?.preview !== 'function' || typeof api?.apply !== 'function') {
    throw new Error('Adaptateur RH authentifié requis.');
  }
  const el=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};
  const heading=el('h2','Présélection groupée');
  const help=el('p','Collez les numéros de soumission Netlify, séparés par des virgules ou des retours à la ligne. Les dossiers déjà validés ou invités restent inchangés.');
  const label=el('label','Identifiants des dossiers');
  const input=el('textarea');input.rows=6;input.id='bulk-preselection-ids';label.htmlFor=input.id;
  const preview=el('button','Prévisualiser');preview.type='button';
  const apply=el('button','Appliquer la présélection');apply.type='button';apply.disabled=true;
  const message=el('p');message.setAttribute('role','status');message.setAttribute('aria-live','polite');
  const report=el('div');let plan=null,busy=false;
  const labels={'select':'À sélectionner','already-selected':'Déjà sélectionné','preserve':'Statut conservé','missing':'Introuvable','ambiguous':'Correspondance multiple','unverifiable':'Version non vérifiable','updated':'Sélectionné','conflict':'Conflit — à vérifier','error':'Échec — à vérifier','not-confirmed':'Non confirmé'};
  const invalidate=()=>{plan=null;apply.disabled=true;report.replaceChildren();};
  input.addEventListener('input',invalidate);
  function render(result) {
    report.replaceChildren();
    const table=el('table');const header=el('tr');
    for(const h of ['N° Netlify','Statut actuel','Action']) header.append(el('th',h));
    const head=el('thead');head.append(header);table.append(head);
    const body=el('tbody');
    for(const row of result.rows ?? []) {
      const tr=el('tr');tr.append(el('td',String(row.number)),el('td',row.status??'—'),el('td',labels[row.action]??row.action));body.append(tr);
    }
    table.append(body);report.append(table);
    const counts=Object.entries(result.counts??{}).map(([key,count])=>count+' '+(labels[key]??key));
    message.textContent=counts.join(' · ')+(result.duplicates?.length?' · '+result.duplicates.length+' doublon(s) ignoré(s)':'');
  }
  function setBusy(value){busy=value;input.disabled=value;preview.disabled=value;apply.disabled=value||!plan?.rows?.some(r=>r.action==='select');}
  preview.addEventListener('click',async()=>{
    if(busy)return;invalidate();setBusy(true);message.textContent='Vérification des dossiers…';
    try{plan=await api.preview({input:input.value});render(plan);}
    catch{message.textContent='Prévisualisation impossible. Vérifiez votre session RH et réessayez.';}
    finally{setBusy(false);}
  });
  apply.addEventListener('click',async()=>{
    if(busy||!plan)return;
    const confirmedNumbers=plan.rows.filter(r=>r.action==='select').map(r=>r.number);
    if(!confirmedNumbers.length)return;
    if(!window.confirm('Passer '+confirmedNumbers.length+' dossier(s) au statut Sélectionné, sans envoyer d’invitation ?'))return;
    setBusy(true);message.textContent='Application des changements…';
    try{const result=await api.apply({input:input.value,confirmedNumbers});plan=null;render(result);await api.refresh?.();}
    catch{plan=null;message.textContent='Résultat non confirmé. Actualisez les dossiers avant toute nouvelle tentative.';}
    finally{setBusy(false);}
  });
  root.replaceChildren(heading,help,label,input,preview,apply,message,report);
}
