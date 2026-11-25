(function(root){'use strict';
// Synthetic training scenario. Monetary values are integer cents, not real store economics.
const days=[
 {name:'Vendredi',event:'Avant le week-end',forecast:[9,7],demand:[10,7],arrival:0,baskets:8,extra:[0,2,4]},
 {name:'Samedi',event:'Pic de fréquentation',forecast:[17,10],demand:[18,11],arrival:8,baskets:10,extra:[0,3,5]},
 {name:'Dimanche',event:'Fin du week-end',forecast:[13,8],demand:[12,8],arrival:6,baskets:9,extra:[0,2,4]}
];
const products={milk:{price:1000,cost:600},fresh:{price:1200,cost:650}};
const campaigns=[{id:'none',name:'Aucune offre',description:'Pas de coupon. Les autres paniers suivent la demande naturelle.',base:0,coupon:0},{id:'target',name:'Offre ciblée',description:'Coupon de 5 DH sur 3 paniers existants et sur les nouveaux paniers générés.',base:3,coupon:500},{id:'wide',name:'Offre générale',description:'Coupon de 10 DH sur 8 paniers existants et sur les nouveaux paniers générés.',base:8,coupon:1000}];
const quantities=[0,6,12,18],discounts=[0,20,50];
const zero=()=>({revenue:0,margin:0,missed:0,waste:0,spend:0,coupon:0,baskets:0,demand:0,served:0});
function create(){return{day:0,milk:12,lots:[{qty:8,expires:0},{qty:10,expires:2}],totals:zero(),history:[],done:false}}
function validate(s,d){if(s.done)throw Error('Partie terminée');if(!quantities.includes(d.order)||s.day===2&&d.order!==0||!discounts.includes(d.markdown)||!campaigns.some(c=>c.id===d.campaign))throw Error('Décision invalide')}
function play(s,d){
 validate(s,d);const day=days[s.day],campaign=campaigns.find(c=>c.id===d.campaign),ci=campaigns.indexOf(campaign),lots=s.lots.map(l=>({...l})).sort((a,b)=>a.expires-b.expires);
 const milkSold=Math.min(s.milk,day.demand[0]),milkMiss=day.demand[0]-milkSold;
 let remaining=day.demand[1],freshBase=0,freshExtra=0,freshRevenue=0,freshCost=0,markdownCost=0;
 function sell(l,q){l.qty-=q;const price=l.expires===s.day?Math.round(products.fresh.price*(100-d.markdown)/100):products.fresh.price;freshRevenue+=q*price;freshCost+=q*products.fresh.cost;markdownCost+=q*(products.fresh.price-price)}
 for(const l of lots){const q=Math.min(remaining,l.qty);sell(l,q);remaining-=q;freshBase+=q}
 let incremental=d.markdown===20?3:d.markdown===50?6:0;
 for(const l of lots.filter(l=>l.expires===s.day)){const q=Math.min(incremental,l.qty);sell(l,q);incremental-=q;freshExtra+=q}
 const waste=lots.filter(l=>l.expires===s.day).reduce((a,l)=>a+l.qty,0),wasteCost=waste*products.fresh.cost;
 const extra=day.extra[ci],baskets=day.baskets+extra,redeemed=campaign.base+extra,coupon=redeemed*campaign.coupon;
 // The other baskets are independent of the two tracked SKU streams; no double counting.
 const otherRevenue=baskets*6000-coupon,otherMargin=baskets*1500-coupon;
 const revenue=milkSold*products.milk.price+freshRevenue+otherRevenue,margin=milkSold*(products.milk.price-products.milk.cost)+freshRevenue-freshCost-wasteCost+otherMargin;
 const spend=d.order*products.milk.cost,missed=milkMiss+remaining,served=milkSold+freshBase,demand=day.demand[0]+day.demand[1];
 const metrics={revenue,margin,missed,waste,spend,coupon,baskets,demand,served};
 const result={day:s.day,decision:{...d},metrics,milkSold,milkMiss,freshBase,freshExtra,freshMiss:remaining,waste,wasteCost,markdownCost,extra,redeemed,otherMargin,otherRevenue,milkEnd:s.milk-milkSold,freshEnd:lots.filter(l=>l.expires>s.day).reduce((a,l)=>a+l.qty,0)};
 const totals=Object.fromEntries(Object.keys(metrics).map(k=>[k,s.totals[k]+metrics[k]]));
 const nextDay=s.day+1,done=nextDay===days.length,nextLots=lots.filter(l=>l.qty>0&&l.expires>s.day);
 if(!done&&days[nextDay].arrival)nextLots.push({qty:days[nextDay].arrival,expires:nextDay+1});
 return{day:nextDay,milk:result.milkEnd+d.order,lots:nextLots,totals,history:[...s.history,result],done}
}
function baseline(){let s=create();for(let i=0;i<3;i++)s=play(s,{order:i<2?12:0,markdown:0,campaign:'none'});return s}
function summary(s){const t=s.totals;return{...t,availability:t.demand?Math.round(100*t.served/t.demand):0,stockValue:s.milk*products.milk.cost+s.lots.reduce((a,l)=>a+l.qty*products.fresh.cost,0)}}
root.RetailGame=Object.freeze({days,products,campaigns,quantities,discounts,create,play,baseline,summary});
})(globalThis);