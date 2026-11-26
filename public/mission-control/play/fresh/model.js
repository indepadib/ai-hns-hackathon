(function(root){'use strict';
// Units are individual fictional fresh-food packages; prices in integer MAD.
const products={Y:{name:'Yaourt',price:12,cost:6,color:'#bc79a2'},M:{name:'Lait',price:10,cost:6,color:'#609ac4'},S:{name:'Salade',price:18,cost:9,color:'#73a682'}};
const levels=[
{title:'Premier service',target:5,maxWaste:1,rounds:[{lots:[['Y',0],['Y',1],['M',1],['S',0]],full:{Y:1,M:1,S:0},markdown:1,donate:1,hold:2},{lots:[['S',1],['M',2],['Y',2]],full:{Y:1,M:1,S:1},markdown:1,donate:1,hold:2},{lots:[['M',2],['S',2]],full:{Y:1,M:1,S:1},markdown:2,donate:1,hold:0}]},
{title:'Livraison tardive',target:7,maxWaste:2,rounds:[{lots:[['Y',0],['Y',0],['Y',1],['M',1],['S',0]],full:{Y:1,M:0,S:1},markdown:1,donate:1,hold:2},{lots:[['M',1],['M',2],['S',1],['S',2]],full:{Y:1,M:2,S:1},markdown:1,donate:1,hold:2},{lots:[['Y',2],['S',2],['M',2]],full:{Y:1,M:1,S:1},markdown:2,donate:1,hold:0}]},
{title:'Rayon sous pression',target:8,maxWaste:2,rounds:[{lots:[['Y',-1],['Y',0],['M',0],['M',1],['S',1],['S',0]],full:{Y:1,M:1,S:0},markdown:1,donate:1,hold:2},{lots:[['Y',1],['Y',2],['M',1],['S',1]],full:{Y:1,M:1,S:1},markdown:2,donate:1,hold:2},{lots:[['S',2],['S',2],['M',2]],full:{Y:1,M:1,S:1},markdown:2,donate:1,hold:0}]},
{title:'Le grand défi anti-gaspi',target:10,maxWaste:2,rounds:[{lots:[['Y',-1],['Y',0],['Y',1],['M',0],['M',2],['S',0]],full:{Y:1,M:1,S:0},markdown:1,donate:1,hold:2},{lots:[['Y',1],['M',1],['M',2],['S',1],['S',2]],full:{Y:1,M:1,S:2},markdown:1,donate:1,hold:2},{lots:[['Y',2],['M',2],['S',2],['S',2]],full:{Y:1,M:2,S:1},markdown:2,donate:1,hold:0}]}];
const zones=['full','markdown','donate','hold','discard'];
const lotList=(l,r)=>levels[l].rounds[r].lots.map(([sku,expiry],i)=>({id:l+'-'+r+'-'+i,sku,expiry}));
function create(level=0){if(!levels[level])throw Error('Niveau inconnu');return{level,round:0,items:lotList(level,0),assigned:{},sold:0,donated:0,waste:0,margin:0,revenue:0,history:[],done:false}}
function capacity(s,zone,sku){const r=levels[s.level].rounds[s.round];return zone==='full'?r.full[sku]:zone==='discard'?Infinity:r[zone]}
function canPlace(s,id,zone){const it=s.items.find(x=>x.id===id);if(s.done||!it||!zones.includes(zone))return false;if(it.expiry<s.round&&zone!=='discard')return false;if(zone==='hold'&&it.expiry<=s.round)return false;const used=s.items.filter(x=>x.id!==id&&s.assigned[x.id]===zone&&(zone!=='full'||x.sku===it.sku)).length;return used<capacity(s,zone,it.sku)}
function place(s,id,zone){if(!canPlace(s,id,zone))return s;return{...s,assigned:{...s.assigned,[id]:zone}}}
function unplace(s,id){if(!s.assigned[id])return s;const assigned={...s.assigned};delete assigned[id];return{...s,assigned}}
function ready(s){return !s.done&&s.items.every(x=>s.assigned[x.id]&&canPlace(s,x.id,s.assigned[x.id]))}
function settle(s){if(!ready(s))throw Error('Affectez chaque produit à une destination valide');let revenue=0,margin=0,sold=0,donated=0,waste=0;const held=[];for(const x of s.items){const p=products[x.sku],z=s.assigned[x.id];if(z==='full'||z==='markdown'){const price=z==='full'?p.price:Math.floor(p.price*.5);revenue+=price;margin+=price-p.cost;sold++}else if(z==='donate'){donated++;margin-=p.cost}else if(z==='discard'){waste++;margin-=p.cost}else held.push(x)}
const round=s.round+1,done=round===levels[s.level].rounds.length;return{...s,round,done,items:done?held:[...held,...lotList(s.level,round)],assigned:{},sold:s.sold+sold,donated:s.donated+donated,waste:s.waste+waste,margin:s.margin+margin,revenue:s.revenue+revenue,history:[...s.history,{sold,donated,waste,margin,revenue,held:held.length,assigned:{...s.assigned}}]}}
function score(s){const l=levels[s.level],passed=s.done&&s.sold>=l.target&&s.waste<=l.maxWaste;return{passed,stars:passed?(s.margin>0?3:2):s.done&&s.sold>=Math.ceil(l.target*.7)?1:0}}
root.Fresh=Object.freeze({products,levels,zones,create,capacity,canPlace,place,unplace,ready,settle,score});
})(globalThis);