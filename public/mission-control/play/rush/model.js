(function(root){'use strict';
// Original arcade simulation. Fictional products, demand and timing; integer MAD.
const map=['.........','.R..A....','....#....','..B...C..','....#....','.D.....K.','.........'];
const products=[{id:'A',name:'Lait',color:'#5a8fc6',price:10,cost:6},{id:'B',name:'Biscuits',color:'#c68a4c',price:15,cost:8},{id:'C',name:'Yaourts',color:'#ba79a0',price:12,cost:7}];
const levels=[
{title:'Première ouverture',event:'Apprenez à charger, remplir et encaisser.',duration:45,interval:7,target:4,stock:3,delivery:15,patience:20,expiry:45},
{title:'Rush du midi',event:'Les clients arrivent plus vite.',duration:65,interval:5,target:8,stock:3,delivery:15,patience:18,expiry:40},
{title:'Rupture imminente',event:'Stock de départ réduit. Anticipez les livraisons.',duration:75,interval:5,target:10,stock:1,delivery:12,patience:18,expiry:35},
{title:'DLC sous pression',event:'Les produits frais périment plus vite. Évitez de trop remplir.',duration:80,interval:5,target:10,stock:3,delivery:13,patience:17,expiry:22},
{title:'Samedi soir',event:'Un pic de fréquentation et des clients impatients.',duration:95,interval:4,target:14,stock:4,delivery:12,patience:16,expiry:35},
{title:'Grand défi One Retail',event:'Maîtrisez le service, les stocks et les pertes.',duration:110,interval:4,target:18,stock:3,delivery:12,patience:16,expiry:28}];
const loc={R:{x:1,y:1},A:{x:4,y:1},B:{x:2,y:3},C:{x:6,y:3},D:{x:1,y:5},K:{x:7,y:5}},entrance={x:8,y:6},start={x:3,y:5};
const dist=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y),walkable=(x,y)=>Number.isInteger(x)&&Number.isInteger(y)&&map[y]?.[x]==='.';
const copy=s=>JSON.parse(JSON.stringify(s)),pdef=id=>products.find(p=>p.id===id);
function create(level=0){if(!levels[level])throw Error('Niveau inconnu');const l=levels[level];return{level,time:0,player:{...start},carry:null,shelves:Object.fromEntries(products.map(p=>[p.id,Array.from({length:l.stock},()=>p.id==='C'?l.expiry:9999)])),reserve:{A:8,B:8,C:8},customers:[],nextId:1,sales:0,revenue:0,margin:0,lost:0,waste:0,delivered:0,done:false,last:'Prêt à ouvrir le magasin.',log:[]}}
function note(s,t){s.last=t;s.log.push({time:s.time,text:t});if(s.log.length>12)s.log.shift()}
function adjacent(s,id){return dist(s.player,loc[id])===1}
function nearby(s){return Object.keys(loc).filter(k=>adjacent(s,k))}
function path(from,to){if(!walkable(to.x,to.y))return[];const q=[{p:from,steps:[]}],seen=new Set([from.x+','+from.y]);while(q.length){const x=q.shift();if(dist(x.p,to)===0)return x.steps;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const p={x:x.p.x+dx,y:x.p.y+dy},k=p.x+','+p.y;if(walkable(p.x,p.y)&&!seen.has(k)){seen.add(k);q.push({p,steps:[...x.steps,p]})}}}return[]}
function standNear(from,id){const p=loc[id];if(!p)return null;const adj=[[1,0],[-1,0],[0,1],[0,-1]].map(([x,y])=>({x:p.x+x,y:p.y+y})).filter(a=>walkable(a.x,a.y));return adj.map(a=>({a,path:path(from,a)})).filter(x=>dist(from,x.a)===0||x.path.length).sort((a,b)=>a.path.length-b.path.length)[0]?.a||null}
function move(s,x,y){if(s.done||dist(s.player,{x,y})!==1||!walkable(x,y))return s;return{...s,player:{x,y}}}
function action(s,id,sku){if(s.done||!adjacent(s,id))return s;const n=copy(s),l=levels[n.level];if(id==='R'){if(n.carry){note(n,'Vous portez déjà un carton. Remplissez le rayon ou retournez-le.');return n}const p=pdef(sku);if(!p||!n.reserve[sku]){note(n,'Ce produit est indisponible en réserve.');return n}const q=Math.min(4,n.reserve[sku]);n.reserve[sku]-=q;n.carry={sku,qty:q};note(n,'Carton '+p.name+' chargé : '+q+' unités.')}
else if(id==='D'){if(n.carry){n.reserve[n.carry.sku]+=n.carry.qty;n.carry=null;note(n,'Carton retourné en réserve.')}else note(n,'Aucun carton à retourner.')}
else if(id==='K'){const c=n.customers.find(c=>c.stage==='queue');if(!c){note(n,'Aucun client à encaisser.');return n}n.customers=n.customers.filter(x=>x.id!==c.id);const p=pdef(c.sku);n.sales++;n.revenue+=p.price;n.margin+=p.price-p.cost;note(n,'+ '+p.price+' DH · client servi !')}
else if(pdef(id)){if(n.carry?.sku!==id){note(n,'Il faut un carton de '+pdef(id).name+'.');return n}const q=Math.min(n.carry.qty,8-n.shelves[id].length);if(!q){note(n,'Rayon plein.');return n}for(let i=0;i<q;i++)n.shelves[id].push(id==='C'?n.time+l.expiry:9999);n.shelves[id].sort((a,b)=>a-b);n.carry.qty-=q;if(!n.carry.qty)n.carry=null;note(n,'Rayon '+pdef(id).name+' : +'+q+' unités.')}return n}
function tick(s){if(s.done)return s;const n=copy(s),l=levels[n.level];n.time++;
const before=n.shelves.C.length;n.shelves.C=n.shelves.C.filter(t=>t>n.time);const spoiled=before-n.shelves.C.length;if(spoiled){n.waste+=spoiled;n.margin-=spoiled*pdef('C').cost;note(n,spoiled+' yaourt(s) périmé(s) retiré(s).')}
if(n.time%l.delivery===0){for(const p of products)n.reserve[p.id]+=4;n.delivered++;note(n,'Livraison reçue : +4 unités de chaque référence.')}
if(n.time===1||n.time%l.interval===0){const sku=products[(n.nextId-1+n.level)%3].id;n.customers.push({id:n.nextId++,sku,stage:'walk',age:0,wait:0,position:{...entrance}})}
const next=[];for(const c of n.customers){c.age++;if(c.stage==='walk'){const a=standNear(c.position,c.sku);const p=a&&path(c.position,a)[0];if(p)c.position=p;if(a&&dist(c.position,a)===0)c.stage='shop';next.push(c)}
else if(c.stage==='shop'){if(n.shelves[c.sku].length){c.expiry=n.shelves[c.sku].shift();c.stage='checkout';c.wait=0;next.push(c)}else{c.wait++;if(c.wait>=5){n.lost++;note(n,'Client perdu : rupture de '+pdef(c.sku).name+'.')}else next.push(c)}}
else if(c.stage==='checkout'){const a=standNear(c.position,'K');const p=a&&path(c.position,a)[0];if(p)c.position=p;if(a&&dist(c.position,a)===0){c.stage='queue';c.wait=0}next.push(c)}
else if(c.stage==='queue'){c.wait++;if(c.wait>=l.patience){n.lost++;if(c.expiry>n.time)n.shelves[c.sku].push(c.expiry);else{n.waste++;n.margin-=pdef(c.sku).cost}note(n,'Client parti : attente trop longue.')}else next.push(c)}}n.customers=next;
if(n.time>=l.duration){n.done=true;note(n,'Service terminé ! Les clients encore présents ne sont pas comptés comme perdus.')}return n}
function score(s){const l=levels[s.level],stars=s.sales>=l.target?(s.lost<=2&&s.waste<=2?3:2):s.sales>=Math.ceil(l.target*.6)?1:0;return{stars,passed:s.sales>=l.target,service:s.sales+s.lost?Math.round(100*s.sales/(s.sales+s.lost)):null}}
root.Rush=Object.freeze({map,products,levels,loc,entrance,start,dist,walkable,create,nearby,path,standNear,move,action,tick,score});
})(globalThis);