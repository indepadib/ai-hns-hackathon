(function(root){'use strict';
// Training scenario, fictional items, lots, times, wages and demand.
const depot={r:2,c:0};
const bins=[
{id:'A1',r:0,c:1,sku:'LAIT',name:'Lait',lot:'L-21',expiry:1,stock:5},
{id:'A2',r:0,c:3,sku:'LAIT',name:'Lait',lot:'L-28',expiry:8,stock:8},
{id:'B1',r:1,c:2,sku:'CAFE',name:'Café',lot:'C-12',expiry:60,stock:8},
{id:'B2',r:1,c:4,sku:'BIS',name:'Biscuits',lot:'B-09',expiry:30,stock:6},
{id:'C1',r:3,c:1,sku:'YAO',name:'Yaourts',lot:'Y-22',expiry:2,stock:3},
{id:'C2',r:3,c:3,sku:'YAO',name:'Yaourts',lot:'Y-29',expiry:9,stock:8},
{id:'D1',r:4,c:2,sku:'BIS',name:'Biscuits',lot:'B-02',expiry:10,stock:5},
{id:'D2',r:4,c:4,sku:'CAFE',name:'Café',lot:'C-18',expiry:90,stock:9}];
const orders=[{id:'VF-01',name:'Magasin Val Fleuri',lines:[['LAIT',4],['YAO',5],['CAFE',2]]},{id:'TR-02',name:'Magasin Trèfle',lines:[['LAIT',3],['BIS',5],['YAO',2]]}];
const distance=(a,b)=>Math.abs(a.r-b.r)+Math.abs(a.c-b.c);
function warehouse(){return{order:0,position:{...depot},stock:Object.fromEntries(bins.map(b=>[b.id,b.stock])),picked:{},travel:0,errors:0,history:[],done:false}}
function remaining(s,sku){return Math.max(0,(orders[s.order]?.lines.find(x=>x[0]===sku)?.[1]||0)-(s.picked[sku]||0))}
function pick(s,id,qty){if(s.done)return s;const b=bins.find(x=>x.id===id);if(!b||!Number.isInteger(qty)||qty<1||qty>30)return s;
 const reject=message=>({...s,errors:s.errors+1,history:[...s.history,{type:'error',message}]});
 if(!remaining(s,b.sku))return reject('Référence absente ou déjà complète pour cette commande.');
 if(qty>remaining(s,b.sku)||qty>s.stock[id])return reject('Quantité supérieure au besoin ou au stock disponible.');
 if(bins.some(x=>x.sku===b.sku&&x.expiry<b.expiry&&s.stock[x.id]>0))return reject('FEFO : un lot plus ancien est encore disponible. Prenez-le en priorité.');
 return{...s,position:{r:b.r,c:b.c},stock:{...s.stock,[id]:s.stock[id]-qty},picked:{...s.picked,[b.sku]:(s.picked[b.sku]||0)+qty},travel:s.travel+distance(s.position,b),history:[...s.history,{type:'pick',id,qty,message:b.name+' · '+qty+' unité(s) · lot '+b.lot}]}
}
function walk(s,r,c){if(s.done||!Number.isInteger(r)||!Number.isInteger(c)||r<0||r>4||c<0||c>4||distance(s.position,{r,c})!==1)return s;return{...s,position:{r,c},travel:s.travel+1}}
function route(from,to){if(!Number.isInteger(to.r)||!Number.isInteger(to.c)||to.r<0||to.r>4||to.c<0||to.c>4)return[];const steps=[];let {r,c}=from;while(c!==to.c){c+=Math.sign(to.c-c);steps.push({r,c})}while(r!==to.r){r+=Math.sign(to.r-r);steps.push({r,c})}return steps}
function pickHere(s,id,q){const b=bins.find(x=>x.id===id);return b&&distance(s.position,b)===0?pick(s,id,q):s}
function dispatchHere(s){return distance(s.position,depot)===0?dispatch(s):s}
function canDispatch(s){return !s.done&&orders[s.order].lines.every(([sku])=>remaining(s,sku)===0)}
function dispatch(s){if(!canDispatch(s))return s;return{...s,order:s.order+1,position:{...depot},picked:{},travel:s.travel+distance(s.position,depot),history:[...s.history,{type:'dispatch',message:orders[s.order].id+' expédiée et stock mis à jour.'}],done:s.order+1===orders.length}}
function optimalWarehouse(){let best=Infinity;const visit=s=>{if(s.done){best=Math.min(best,s.travel);return}if(s.travel>=best)return;if(canDispatch(s)){visit(dispatch(s));return}for(const b of bins){const q=Math.min(remaining(s,b.sku),s.stock[b.id]);if(!q)continue;const n=pick(s,b.id,q);if(n.errors===s.errors)visit(n)}};visit(warehouse());return best}
const slots=[
{time:'17:00',forecast:5,arrivals:[2,3,1,2,4]},
{time:'17:10',forecast:8,arrivals:[2,4,2,3,1,4,3]},
{time:'17:20',forecast:12,arrivals:[4,2,3,4,1,3,2,4,2,1]},
{time:'17:30',forecast:9,arrivals:[3,2,4,1,3,2,4,1]},
{time:'17:40',forecast:5,arrivals:[1,2,3,2,2]},
{time:'17:50',forecast:3,arrivals:[2,1,3]}];
const cashierCost=600,marginPerCustomer=1800,patience=15,maxStaff=3,budget=12000;
function cashier(){return{round:0,queue:[],nextId:0,served:0,abandoned:0,wait:0,spend:0,arrived:0,history:[],done:false,lanes:[null,null,null]}}
function cashStep(s,staff){if(s.done||!Number.isInteger(staff)||staff<1||staff>maxStaff||s.spend+staff*cashierCost>budget||s.spend+staff*cashierCost+(slots.length-s.round-1)*cashierCost>budget)return s;
 const start=s.round*10,slot=slots[s.round],queue=s.queue.map(x=>({...x})),lanes=s.lanes.map(x=>x?{...x}:null),events=[];let served=0,abandoned=0,wait=0,id=s.nextId;
 // Closing a lane never interrupts a basket already being scanned; those lanes must stay open.
 if(lanes.slice(staff).some(Boolean))return s;
 for(let minute=start;minute<start+10;minute++){
  for(let j=0;j<slot.arrivals.length;j++)if(Math.floor(j*10/slot.arrivals.length)===minute-start)queue.push({id:id++,arrived:minute,service:slot.arrivals[j]});
  for(let i=0;i<staff;i++)if(lanes[i]&&lanes[i].finish<=minute){served++;events.push({type:'served',id:lanes[i].id});lanes[i]=null}
  while(queue.length&&minute-queue[0].arrived>=patience){const x=queue.shift();abandoned++;events.push({type:'abandoned',id:x.id})}
  for(let i=0;i<staff;i++)if(!lanes[i]&&queue.length){const x=queue.shift();wait+=minute-x.arrived;lanes[i]={id:x.id,finish:minute+x.service}}
 }
 // A sale ending exactly on the boundary is completed before next-round staffing.
 for(let i=0;i<staff;i++)if(lanes[i]&&lanes[i].finish<=start+10){served++;lanes[i]=null}
 const done=s.round+1===slots.length,spend=s.spend+staff*cashierCost;
 return{round:s.round+1,queue,lanes,nextId:id,served:s.served+served,abandoned:s.abandoned+abandoned,wait:s.wait+wait,spend,arrived:s.arrived+slot.arrivals.length,done,history:[...s.history,{staff,served,abandoned,wait,queue:queue.length,busy:lanes.filter(Boolean).length,arrivals:slot.arrivals.length,events}]}
}
function allowed(s,staff){return !s.done&&Number.isInteger(staff)&&staff>=1&&staff<=maxStaff&&!s.lanes.slice(staff).some(Boolean)&&s.spend+staff*cashierCost+(slots.length-s.round-1)*cashierCost<=budget}
function cashSummary(s){const busy=s.lanes.filter(Boolean).length,started=s.served+busy;return{served:s.served,abandoned:s.abandoned,waiting:s.queue.length,busy,arrived:s.arrived,wait:started?s.wait/started:0,spend:s.spend,contribution:s.served*marginPerCustomer-s.spend}}
function bestCash(){let best=null;const walk=s=>{if(s.done){const t=cashSummary(s);if(!best||t.contribution>best.summary.contribution||t.contribution===best.summary.contribution&&t.wait<best.summary.wait)best={state:s,summary:t};return}for(let i=1;i<=3;i++)if(allowed(s,i))walk(cashStep(s,i))};walk(cashier());return best}
root.OperationsGames=Object.freeze({depot,bins,orders,distance,warehouse,remaining,pick,walk,route,pickHere,dispatchHere,canDispatch,dispatch,optimalWarehouse,slots,cashier,cashStep,allowed,cashSummary,bestCash,cashierCost,marginPerCustomer,budget,patience});
})(globalThis);