/* All records are synthetic and reproducible. No real customer or retailer data. */
(function(root){
'use strict';
function generate(randomSource=null){
 let seed=20261128;const rnd=typeof randomSource==='function'?randomSource:()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296},int=(a,b)=>a+Math.floor(rnd()*(b-a+1)),money=x=>Math.round(x*100)/100,day=i=>new Date(Date.UTC(2026,7,30+i)).toISOString().slice(0,10);
 const stores=Array.from({length:6},(_,i)=>({store_id:'S'+(i+1),city:['Casablanca','Casablanca','Rabat','Fès','Tanger','Marrakech'][i],format:i<3?'Proximité':'Supermarché',traffic_index:[1.2,.8,1.05,.9,1.15,1.3][i]}));
 const cats=['Épicerie','Boissons','Frais','Hygiène','Entretien','Surgelés'];
 const names=['Riz','Pâtes','Lentilles','Farine','Huile','Café','Thé','Biscuits','Chocolat','Conserve','Eau','Jus','Soda','Lait UHT','Eau gazeuse','Thé glacé','Boisson fruit','Sirop','Eau minérale','Nectar','Yaourt','Lait frais','Fromage','Dessert','Salade','Jambon de dinde','Crème','Beurre','Jus frais','Œufs','Savon','Shampooing','Dentifrice','Gel douche','Déodorant','Mouchoirs','Crème mains','Brosse à dents','Coton','Lingettes','Lessive','Liquide vaisselle','Nettoyant sol','Éponge','Sac poubelle','Désinfectant','Détartrant','Papier ménage','Nettoyant vitre','Assouplissant','Petits pois','Frites','Pizza','Glace','Poisson','Légumes','Fruits rouges','Nuggets','Pâte feuilletée','Haricots'];
 const products=names.map((name,i)=>{const price=money(int(6,110)+.9);return{sku:'SKU'+String(i+1).padStart(3,'0'),name,category:cats[Math.floor(i/10)],price_mad:price,cost_mad:money(price*(.58+rnd()*.18)),supplier_id:'SUP'+(1+i%12),lead_days:2+i%5,pack_size:[6,12,24][i%3],shelf_life_days:i>=20&&i<30?7+i%14:180,base_demand:1+i%9}});
 const customers=Array.from({length:1200},(_,i)=>({customer_id:'C'+String(i+1).padStart(5,'0'),home_store:stores[i%6].store_id,signup_date:day(-int(1,500)),marketing_consent:rnd()<.76,segment_hint:['occasionnel','régulier','familial','premium'][i%4]}));
 const inventory_daily=[],purchase_orders=[],fresh_lots=[],tickets=[],ticket_lines=[],shelf_audits=[];let po=0,tid=0,lot=0;
 const inventory=new Map();for(const s of stores)for(const p of products)inventory.set(s.store_id+'|'+p.sku,{stock:int(8,75),pending:null});
 for(let d=0;d<84;d++)for(const s of stores){
  const basketLines=[];
  for(const p of products){
   const x=inventory.get(s.store_id+'|'+p.sku),opening=x.stock;let received=0;if(x.pending&&x.pending.arrival===d){received=x.pending.qty;x.pending=null}
   const promo=(d+Number(p.sku.slice(3)))%17<3,demand=Math.max(0,Math.round(p.base_demand*s.traffic_index*(d%7===5||d%7===6?1.35:1)*(promo?1.6:1)*(.45+rnd()*1.2)));
   const available=opening+received,sold=Math.min(available,demand),waste=Math.min(available-sold,p.category==='Frais'&&rnd()<.18?int(1,3):0),closing=available-sold-waste,price=money(p.price_mad*(promo?.8:1));x.stock=closing;
   const observedStock=rnd()<.008?null:closing;
   inventory_daily.push({date:day(d),store_id:s.store_id,sku:p.sku,opening_stock:opening,received_units:received,sold_units:sold,waste_units:waste,closing_stock:observedStock,price_mad:price,promo:promo?1:0,stockout:closing===0?1:0,split:d<70?'train':'evaluation'});
   if(!x.pending&&closing<p.base_demand*(p.lead_days+1)){const qty=Math.ceil(p.base_demand*(p.lead_days+7)/p.pack_size)*p.pack_size,arrival=d+p.lead_days+(rnd()<.16?int(1,3):0);x.pending={arrival,qty};purchase_orders.push({po_id:'PO'+(++po),store_id:s.store_id,sku:p.sku,order_date:day(d),expected_date:day(d+p.lead_days),actual_date:arrival<84?day(arrival):null,ordered_qty:qty,received_qty:arrival<84?qty:0,status:arrival<84?'received':'open'})}
   let remaining=sold;while(remaining>0){const qty=Math.min(remaining,int(1,3));remaining-=qty;basketLines.push({sku:p.sku,qty,unit_price_mad:price,line_total_mad:money(qty*price)})}
   if(d>=70&&p.category==='Frais'){let remaining=closing;while(remaining>0){const qty=Math.min(remaining,int(3,12));remaining-=qty;fresh_lots.push({snapshot_date:day(d),store_id:s.store_id,sku:p.sku,lot_id:'L'+(++lot),quantity:qty,expiry_date:rnd()<.025?null:day(d+int(-1,p.shelf_life_days)),daily_sales:sold,price_mad:price,cost_mad:p.cost_mad})}}
   if(d%7===0&&Number(p.sku.slice(3))%3===0){const expected=int(4,12),empty=int(0,expected),missing=int(0,Math.min(3,expected));shelf_audits.push({audit_id:'A'+(shelf_audits.length+1),date:day(d),store_id:s.store_id,sku:p.sku,expected_facings:expected,empty_facings:rnd()<.03?null:empty,missing_labels:missing,observed_stock:observedStock,priority:missing>0||empty/expected>.5?'review':'normal'})}
  }
  for(let i=basketLines.length-1;i>0;i--){const j=int(0,i);[basketLines[i],basketLines[j]]=[basketLines[j],basketLines[i]]}
  for(let i=0;i<basketLines.length;){const basket=basketLines.slice(i,i+int(1,6));i+=basket.length;const id='T'+(++tid);const customer=rnd()<.68?customers[int(0,customers.length-1)].customer_id:null;tickets.push({ticket_id:id,date:day(d),store_id:s.store_id,customer_id:customer,total_mad:money(basket.reduce((sum,l)=>sum+l.line_total_mad,0))});for(const l of basket)ticket_lines.push({ticket_id:id,...l})}
 }
 return {stores,products,customers,inventory_daily,purchase_orders,fresh_lots,tickets,ticket_lines,shelf_audits};
}
const info={stores:['store_id','6 magasins fictifs'],products:['sku','60 références, 6 catégories, prix et fournisseurs'],customers:['customer_id','Profils anonymes, consentement simulé'],inventory_daily:['date + store_id + sku','Stocks, ventes, casse, promotions et ruptures ; 70 jours entraînement + 14 jours évaluation'],purchase_orders:['po_id','Commandes fournisseurs et retards simulés'],fresh_lots:['lot_id','Instantanés indépendants de lots et DLC sur 14 jours'],tickets:['ticket_id','Paniers synthétiques multi-lignes, identifiés ou anonymes'],ticket_lines:['ticket_id (jointure)','Quantités, prix et montant ; cohérents avec les ventes'],shelf_audits:['audit_id','Relevés rayon structurés ; aucune image fournie']};
const packs={availability:['stores','products','inventory_daily','purchase_orders'],fresh:['stores','products','inventory_daily','fresh_lots'],loyalty:['stores','products','customers','tickets','ticket_lines'],inspection:['stores','products','inventory_daily','shelf_audits']};
function csv(rows){if(!rows.length)return '';const keys=Object.keys(rows[0]);const cell=v=>v===null||v===undefined?'':'"'+String(v).replace(/"/g,'""')+'"';return [keys.join(','),...rows.map(r=>keys.map(k=>cell(r[k])).join(','))].join('\n')}
root.HNSRetailData={generate,info,packs,csv,version:'1.0 · seed 20261128'};
})(globalThis);
