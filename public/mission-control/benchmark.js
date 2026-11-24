(function(root){
'use strict';
const version='retail-bench-v1';
const descriptions={
 availability:{title:'Prévoir la rupture du lendemain',labels:['no','yes'],description:'Prévision à J+1, à partir des informations connues à J. Évaluation sur les 14 derniers jours.',baseline:'Persistance : rupture observée la veille.'},
 fresh:{title:'Trier les lots à traiter',labels:['review','withdraw','priority','monitor'],description:'Conformité à une règle de référence DLC, pas une mesure réelle de réduction des pertes.',baseline:'Contrôle humain systématique.'},
 loyalty:{title:'Prévoir le retour des clients',labels:['no','yes'],description:'Prévoir un achat pendant les 14 derniers jours à partir des 70 premiers. Le consentement marketing reste une contrainte distincte.',baseline:'Achat dans les 14 jours avant la coupure.'},
 inspection:{title:'Prioriser les observations rayon',labels:['normal','review'],description:'Tri des relevés structurés selon une règle de référence, sans mesure de performance vision.',baseline:'Contrôle humain systématique.'}
};
function dataset(id,t){
 const meta=descriptions[id];if(!Object.hasOwn(descriptions,id))throw Error('Challenge inconnu.');
 const rows=[];
 if(id==='availability'){
  const history=new Map();
  for(const x of t.inventory_daily){const k=x.store_id+'|'+x.sku,prev=history.get(k);if(x.split==='evaluation'&&prev)rows.push({sample:{sample_id:x.date+'|'+k,forecast_date:x.date,store_id:x.store_id,sku:x.sku,previous_date:prev.date,previous_closing_stock:prev.closing_stock,previous_sales:prev.sold_units,previous_stockout:prev.stockout},target:x.stockout?'yes':'no',baseline:prev.stockout?'yes':'no'});history.set(k,x)}
 }else if(id==='fresh'){
  for(const x of t.fresh_lots){const days=x.expiry_date?Math.round((Date.parse(x.expiry_date)-Date.parse(x.snapshot_date))/86400000):null;rows.push({sample:{sample_id:x.lot_id,...x},target:days===null?'review':days<0?'withdraw':days<=2&&x.quantity>Math.max(0,x.daily_sales)*Math.max(0,days)?'priority':'monitor',baseline:'review'})}
 }else if(id==='loyalty'){
  const hist=new Map(),future=new Set();
  for(const x of t.tickets){if(!x.customer_id)continue;if(x.date>='2026-11-08'){future.add(x.customer_id);continue}const h=hist.get(x.customer_id)||{visits:0,spend:0,last:null,recent:0};h.visits++;h.spend+=x.total_mad;if(!h.last||x.date>h.last)h.last=x.date;if(x.date>='2026-10-25')h.recent++;hist.set(x.customer_id,h)}
  for(const c of t.customers){const h=hist.get(c.customer_id)||{visits:0,spend:0,last:null,recent:0};rows.push({sample:{sample_id:c.customer_id,visits_train:h.visits,spend_train_mad:Math.round(h.spend*100)/100,last_purchase:h.last,visits_last_14d:h.recent,home_store:c.home_store},target:future.has(c.customer_id)?'yes':'no',baseline:h.recent?'yes':'no'})}
 }else{
  for(const x of t.shelf_audits.filter(x=>x.date>='2026-11-08')){const {priority,...sample}=x;rows.push({sample:{sample_id:x.audit_id,...sample},target:x.empty_facings===null||priority==='review'?'review':'normal',baseline:'review'})}
 }
 return {version,id,...meta,rows};
}
function parse(text){
 if(typeof text!=='string'||text.length>1500000)throw Error('Fichier trop volumineux.');
 const clean=text.replace(/^\uFEFF/,'').trim();if(!clean)throw Error('Fichier vide.');
 if(clean.startsWith('[')){const p=JSON.parse(clean);if(!Array.isArray(p))throw Error('Tableau JSON attendu.');return p}
 const lines=clean.split(/\r?\n/).filter(l=>l.trim()),delimiter=lines[0].includes(';')?';':',',cells=l=>l.split(delimiter).map(v=>v.trim().replace(/^"([^"]*)"$/,'$1')),headers=cells(lines.shift());
 if(headers.length!==2||headers[0]!=='sample_id'||headers[1]!=='prediction')throw Error('En-tête requis : sample_id,prediction.');
 return lines.map((line,i)=>{const row=cells(line);if(row.length!==2)throw Error('Ligne '+(i+2)+' invalide.');return{sample_id:row[0],prediction:row[1]}});
}
function align(d,p){if(!Array.isArray(p)||p.length!==d.rows.length)throw Error('Nombre attendu : '+d.rows.length+' prédictions.');const expected=new Set(d.rows.map(r=>r.sample.sample_id)),map=new Map();for(const x of p){if(!x||!expected.has(x.sample_id))throw Error('Identifiant inconnu.');if(map.has(x.sample_id))throw Error('Identifiant en double : '+x.sample_id);if(!d.labels.includes(x.prediction))throw Error('Classe invalide : '+x.sample_id+' ; classes : '+d.labels.join(', '));map.set(x.sample_id,x.prediction)}return d.rows.map(r=>map.get(r.sample.sample_id))}
function evaluate(d,values){if(!Array.isArray(values)||values.length!==d.rows.length||values.some(v=>!d.labels.includes(v)))throw Error('Prédictions incomplètes ou invalides.');const matrix=d.labels.map(()=>d.labels.map(()=>0));let correct=0;d.rows.forEach((r,i)=>{const a=d.labels.indexOf(r.target),p=d.labels.indexOf(values[i]);matrix[a][p]++;if(a===p)correct++});const div=(a,b)=>b?a/b:0,round=x=>Math.round(x*10000)/10000;const perClass=d.labels.map((label,i)=>{const tp=matrix[i][i],support=matrix[i].reduce((a,b)=>a+b,0),predicted=matrix.reduce((a,b)=>a+b[i],0),precision=div(tp,predicted),recall=div(tp,support);return{label,support,precision:round(precision),recall:round(recall),f1:round(div(2*precision*recall,precision+recall))}});const supported=perClass.filter(c=>c.support>0);return{count:d.rows.length,accuracy:round(div(correct,d.rows.length)),macroF1:round(div(supported.reduce((s,c)=>s+c.f1,0),supported.length)),matrix,perClass}}
function report(d,values){return{version,challenge:d.id,labels:d.labels,metrics:evaluate(d,values),baseline:evaluate(d,d.rows.map(r=>r.baseline))}}
root.HNSBenchmark={version,descriptions,dataset,parse,align,evaluate,report};
})(globalThis);
