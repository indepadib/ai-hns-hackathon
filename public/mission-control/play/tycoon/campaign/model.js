(function(root){'use strict';
// All amounts in integer MAD; quantities are basket-equivalents. Fictional training assumptions.
const shops=[
{id:'market',name:'Market',kind:'Épicerie',color:'#348e71',open:0,price:80,cost:53,demand:150,capacity:180,fixed:1250,upgrade:4500},
{id:'beauty',name:'Beauty',kind:'Beauté',color:'#b876a0',open:14000,price:140,cost:75,demand:80,capacity:105,fixed:1400,upgrade:5000},
{id:'sport',name:'Sport',kind:'Sport',color:'#537eb9',open:18000,price:240,cost:150,demand:60,capacity:80,fixed:1600,upgrade:6000},
{id:'cafe',name:'Café',kind:'Restauration',color:'#ce9550',open:10000,price:45,cost:21,demand:200,capacity:230,fixed:1750,upgrade:4000},
{id:'home',name:'Home',kind:'Bricolage',color:'#8c84bd',open:16000,price:170,cost:101,demand:75,capacity:100,fixed:1500,upgrade:5500},
{id:'market2',name:'Market II',kind:'Épicerie',color:'#508e8e',open:12000,price:80,cost:53,demand:135,capacity:170,fixed:1250,upgrade:4500}];
const events=[
['Lancement','Le quartier découvre votre enseigne.',100,100,100,100,100,100,100,100],
['Festival beauté','Trafic beauté et restauration en hausse.',105,140,95,125,100,105,100,100],
['Retard fournisseur','Le fournisseur économique connaît des difficultés.',105,100,100,100,100,105,100,70],
['Week-end sportif','La demande sport accélère.',105,95,155,115,95,100,100,100],
['Chaleur','Café et épicerie sont sollicités.',125,90,85,155,95,120,100,100],
['Inflation','Les achats coûtent plus cher cette semaine.',95,90,90,95,90,95,112,100],
['Concurrence','Un concurrent ouvre à proximité.',85,90,90,85,95,85,100,100],
['Rentrée','Rebond sport et maison.',115,110,145,110,145,115,100,100],
['Travaux','Accès plus difficile au quartier.',80,80,80,90,90,85,100,85],
['Fête locale','Une forte animation stimule les ventes.',135,125,120,150,110,130,100,100],
['Tension logistique','Les commandes économiques sont moins bien servies.',105,100,105,105,110,100,105,60],
['Fin de trimestre','Priorité au cash et aux stocks résiduels.',90,90,85,95,85,90,100,100]];
const phases=['Lancer','Structurer','Accélérer','Consolider'];
const prices=[90,100,110],staffs=[1,2,3],covers=[75,100,125],suppliers=['reliable','economy','contract'],marketing=['none','local','loyalty'];
const techs=[{id:'forecast',name:'Prévision IA',cost:3500,desc:'Réduit l’écart entre prévision et demande, sans changer la demande réelle.'},{id:'wms',name:'WMS intelligent',cost:2800,desc:'Améliore de 10 points la réception du fournisseur économique (maximum 100 %).'} ,{id:'pos',name:'Caisses assistées',cost:3200,desc:'Augmente de 15 % la capacité de service des magasins.'}];
const responses=[{id:'none',name:'Observer',cost:0,desc:'Aucun coût ni action supplémentaire.'},{id:'express',name:'Transport express',cost:650,desc:'Réception économique +15 points cette semaine (maximum 100 %).'}, {id:'quality',name:'Don anti-gaspi',cost:400,desc:'Donne la moitié des invendus du café. Coût d’achat inchangé, moins de gaspillage.'}];
const variation=(week,i)=>[-8,5,12,-4,7,-10,3,9,-7,15,-6,2][(week+i*3)%12];
const get=id=>shops.find(x=>x.id===id),sum=(a,f)=>a.reduce((n,x)=>n+f(x),0),qty=lots=>sum(lots,x=>x.qty),value=lots=>sum(lots,x=>x.qty*x.cost);
function create(){return{week:0,cash:45000,debt:0,tech:[],stores:shops.map((p,i)=>({id:p.id,level:i===0?1:0,lots:[],rep:70,loyal:0})),totals:{revenue:0,profit:0,capex:0,served:0,demand:0,waste:0,interest:0},history:[],done:false,reason:null}}
function defaultOps(){return{price:100,staff:2,cover:100,supplier:'reliable',marketing:'none'}}
function defaults(s){const ops={};for(const x of s.stores)if(x.level)ops[x.id]=defaultOps();return{invest:'none',finance:0,tech:'none',response:'none',ops}}
function forecast(s,x,o){const p=get(x.id),e=events[s.week],i=shops.indexOf(p),traffic=e[i+2]/100,rep=.75+x.rep/280,loyal=1+x.loyal/250,elastic=1+(100-o.price)*.013,marketingBoost=o.marketing==='local'?1.16:o.marketing==='loyalty'?1.08:1;return Math.max(0,Math.round(p.demand*traffic*rep*loyal*elastic*marketingBoost))}
function plan(s,d){const technology=d?.tech||'none',response=d?.response||'none',owned=s.tech||[];if(s.done||!d||![-10000,0,10000].includes(d.finance)||typeof d.invest!=='string'||!d.ops)throw Error('Décision invalide');
const stores=s.stores.map(x=>({...x,lots:x.lots.map(l=>({...l}))}));let capex=0;
if(d.invest!=='none'){const [a,id]=d.invest.split(':'),x=stores.find(z=>z.id===id),p=get(id);if(!x||!p)throw Error('Commerce inconnu');if(a==='open'&&!x.level&&p.open){x.level=1;capex=p.open}else if(a==='upgrade'&&x.level===1){x.level=2;capex=p.upgrade}else throw Error('Investissement impossible')}
const technologyItem=techs.find(x=>x.id===technology),responseItem=responses.find(x=>x.id===response);if(technology!=='none'&&(!technologyItem||owned.includes(technology)))throw Error('Technologie indisponible');if(!responseItem)throw Error('Réponse inconnue');const tech=[...owned,...(technologyItem?[technology]:[])],techCost=technologyItem?.cost||0,responseCost=responseItem.cost;capex+=techCost;
const debt=s.debt+d.finance,available=s.cash+d.finance,interest=Math.ceil(Math.max(0,debt)*.015),e=events[s.week];
const rows=stores.filter(x=>x.level).map(x=>{const p=get(x.id),o=d.ops[x.id];if(!o||!prices.includes(o.price)||!staffs.includes(o.staff)||!covers.includes(o.cover)||!suppliers.includes(o.supplier)||!marketing.includes(o.marketing))throw Error('Paramètres manquants ou invalides : '+p.name);
const capacity=Math.floor(p.capacity*(x.level===2?1.5:1)*([.62,1,1.35][o.staff-1])*(tech.includes('pos')?1.15:1)),baseForecast=forecast(s,x,o),pred=tech.includes('forecast')?Math.round(baseForecast*(100+variation(s.week,shops.indexOf(p))*.65)/100):baseForecast,target=Math.min(Math.round(p.capacity*(x.level===2?1.8:1.2)),Math.ceil(pred*o.cover/100)),order=Math.max(0,target-qty(x.lots)),discount=o.supplier==='economy'?12:o.supplier==='contract'&&order>=100?8:0,fill=o.supplier==='economy'?Math.min(100,Math.floor(85*e[9]/100)+(tech.includes('wms')?10:0)+(response==='express'?15:0)):o.supplier==='contract'?95:100,unitCost=Math.round(p.cost*e[8]/100*(100-discount)/100),received=Math.floor(order*fill/100),fixed=p.fixed+(x.level===2?450:0),labor=o.staff*450,market=o.marketing==='local'?500:o.marketing==='loyalty'?350:0,holding=Math.ceil(value(x.lots)*.005),price=Math.round(p.price*o.price/100);
return{id:x.id,name:p.name,forecast:pred,baseForecast,capacity,target,order,received,unitCost,price,stock:qty(x.lots),reserve:order*unitCost,purchase:received*unitCost,fixed,labor,market,holding,fill}});
const reserve=capex+interest+responseCost+sum(rows,r=>r.reserve+r.fixed+r.labor+r.market+r.holding),spend=capex+interest+responseCost+sum(rows,r=>r.purchase+r.fixed+r.labor+r.market+r.holding);
return{valid:debt>=0&&debt<=30000&&available>=reserve,stores,rows,capex,interest,reserve,spend,available,debt,tech,techCost,response,responseCost}}
function play(s,d){const p=plan(s,d);if(!p.valid)throw Error('Budget ou crédit invalide');const rows=p.rows.map(r=>{const x=p.stores.find(z=>z.id===r.id),o=d.ops[r.id],i=shops.findIndex(z=>z.id===r.id),delta=variation(s.week,i),demand=Math.max(0,Math.round(r.baseForecast*(100+delta)/100)),lots=x.lots.map(l=>({...l}));if(r.received)lots.push({qty:r.received,cost:r.unitCost});const {served:sold,missed,stockLoss,capacityLoss}=bottlenecks(demand,qty(lots),r.capacity);let left=sold,cogs=0;for(const l of lots){const q=Math.min(left,l.qty);l.qty-=q;left-=q;cogs+=q*l.cost}
const surplus=x.id==='cafe'?qty(lots):0,saved=x.id==='cafe'&&p.response==='quality'?Math.floor(surplus/2):0,waste=surplus-saved,wasteCost=x.id==='cafe'?value(lots):0;x.lots=x.id==='cafe'?[]:lots.filter(l=>l.qty>0);const service=demand?sold/demand:1;x.rep=Math.max(25,Math.min(100,x.rep+Math.round((service-.85)*22)-(o.price===110?3:0)+(o.staff===3?1:0)));x.loyal=Math.max(0,Math.min(45,x.loyal+(o.marketing==='loyalty'&&service>=.8?5:0)-1));
const revenue=sold*r.price,profit=revenue-cogs-wasteCost-r.fixed-r.labor-r.market-r.holding;
return{...r,demand,sold,missed,stockLoss,capacityLoss,cogs,waste,saved,wasteCost,revenue,profit,rep:x.rep,loyal:x.loyal,endStock:qty(x.lots),endValue:value(x.lots)}});
const revenue=sum(rows,x=>x.revenue),profit=sum(rows,x=>x.profit)-p.interest-p.responseCost,cash=p.available-p.spend+revenue,week=s.week+1;
const totals={revenue:s.totals.revenue+revenue,profit:s.totals.profit+profit,capex:s.totals.capex+p.capex,served:s.totals.served+sum(rows,x=>x.sold),demand:s.totals.demand+sum(rows,x=>x.demand),waste:s.totals.waste+sum(rows,x=>x.waste),interest:s.totals.interest+p.interest};
let n={week,cash,debt:p.debt,tech:p.tech,stores:p.stores,totals,history:[...s.history,{week:s.week,decision:JSON.parse(JSON.stringify(d)),rows,revenue,profit,capex:p.capex,interest:p.interest,responseCost:p.responseCost,cash,debt:p.debt}],done:week===events.length,reason:week===events.length?'complete':null};
// Search the cheapest ordinary operating plan independently for each open shop.
if(!n.done&&!plan(n,minimumPlan(n)).valid){n.done=true;n.reason='cash'}
return n}
function minimumPlan(s){const d=defaults(s);d.finance=s.debt+10000<=30000?10000:0;for(const o of Object.values(d.ops))o.staff=1;for(const id of Object.keys(d.ops)){let best=null;for(const price of prices)for(const cover of covers)for(const supplier of suppliers)for(const market of marketing){const o={price,staff:1,cover,supplier,marketing:market};d.ops[id]=o;const r=plan(s,d).rows.find(x=>x.id===id),cost=r.reserve+r.fixed+r.labor+r.market+r.holding;if(!best||cost<best.cost)best={o,cost}}d.ops[id]=best.o}return d}
function bottlenecks(demand,available,capacity){const stockLoss=Math.max(0,demand-available),served=Math.min(demand,available,capacity),capacityLoss=Math.max(0,Math.min(demand,available)-capacity);return{served,stockLoss,capacityLoss,missed:stockLoss+capacityLoss}}
function projection(row){const x=bottlenecks(row.forecast,row.stock+row.received,row.capacity);return{...x,available:row.stock+row.received,forecast:row.forecast}}
function reuse(s,d){const prev=s.history.at(-1)?.decision?.ops;if(!prev)return d;return {...d,ops:Object.fromEntries(Object.keys(d.ops).map(id=>[id,prev[id]?{...prev[id]}:{...d.ops[id]}]))}}
function summary(s){const t=s.totals;return{cash:s.cash,debt:s.debt,netCash:s.cash-s.debt,stock:sum(s.stores,x=>value(x.lots)),shops:s.stores.filter(x=>x.level).length,service:t.demand?Math.round(t.served/t.demand*100):null,rep:Math.round(sum(s.stores.filter(x=>x.level),x=>x.rep)/s.stores.filter(x=>x.level).length),...t}}
function goals(s){const t=summary(s);return[{label:'3 commerces ouverts',ok:t.shops>=3},{label:'Contribution positive',ok:t.profit>0},{label:'Service ≥ 85 %',ok:t.service>=85},{label:'Réputation ≥ 75',ok:t.rep>=75},{label:'Cash net ≥ 10 000 DH',ok:t.netCash>=10000}]}
root.Campaign=Object.freeze({shops,events,phases,prices,staffs,covers,suppliers,marketing,techs,responses,create,defaultOps,defaults,forecast,plan,play,summary,goals,minimumPlan,bottlenecks,projection,reuse});
})(globalThis);