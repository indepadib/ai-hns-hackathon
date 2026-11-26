(function(root){'use strict';
const KEY='hns-career-v1',chapters=[{id:'rush',title:'Employé polyvalent',place:'Le premier magasin',url:'/mission-control/play/rush/',xp:100,description:'Réussissez le premier niveau de Retail Rush.'},{id:'store',title:'Responsable magasin',place:'Le week-end décisif',url:'/mission-control/play/retail/',xp:200,description:'Terminez les trois journées et obtenez une contribution positive.'},{id:'tycoon',title:'Directeur de réseau',place:'Votre empire retail',url:'/mission-control/play/tycoon/campaign/',xp:400,description:'Terminez les 12 semaines avec au moins 3 objectifs sur 5.'}];
const rewards=[{id:'cap',name:'Casquette Gold',price:100,description:'Casquette dorée visible dans Retail Rush.'},{id:'apron',name:'Tablier Émeraude',price:150,description:'Tablier vert visible sur votre avatar Retail Rush.'},{id:'frame',name:'Cadre Prestige',price:250,description:'Cadre doré autour du plateau Retail Rush.'}];
function empty(){return{version:1,completed:{},owned:[],active:[]}}
function normalize(x){const s=empty();if(!x||x.version!==1)return s;for(const c of chapters){if(x.completed?.[c.id]===true)s.completed[c.id]=true}for(const r of rewards){if(x.owned?.includes?.(r.id)&&balance(s)>=r.price)s.owned.push(r.id)}s.active=s.owned.filter(id=>x.active?.includes?.(id));return s}
function xp(s){return chapters.reduce((n,c)=>n+(s.completed[c.id]?c.xp:0),0)}
function balance(s){return xp(s)-rewards.reduce((n,r)=>n+(s.owned.includes(r.id)?r.price:0),0)}
function unlocked(s,id){const i=chapters.findIndex(c=>c.id===id);return i>=0&&chapters.slice(0,i).every(c=>s.completed[c.id])}
function complete(s,id){if(!chapters.some(c=>c.id===id)||s.completed[id])return s;return {...s,completed:{...s.completed,[id]:true}}}
function purchase(s,id){const r=rewards.find(x=>x.id===id);if(!r||s.owned.includes(id)||balance(s)<r.price)return s;return{...s,owned:[...s.owned,id],active:[...s.active,id]}}
function toggle(s,id){if(!s.owned.includes(id))return s;return {...s,active:s.active.includes(id)?s.active.filter(x=>x!==id):[...s.active,id]}}
function read(){try{return normalize(JSON.parse(root.localStorage.getItem(KEY)||'null'))}catch{return empty()}}
function write(s){try{root.localStorage.setItem(KEY,JSON.stringify(s));return true}catch{return false}}
function record(id){const s=read(),n=complete(s,id);return {newly:n!==s,saved:write(n),state:n}}
root.RetailCareer=Object.freeze({chapters,rewards,empty,normalize,xp,balance,unlocked,complete,purchase,toggle,read,write,record});
})(globalThis);