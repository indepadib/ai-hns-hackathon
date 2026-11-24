(function(root){
'use strict';
const types={source:'Source',prepare:'Préparation',rule:'Règle métier',model:'Modèle IA',decision:'Condition / contrôle',output:'Sortie',human:'Validation humaine',action:'Action métier'};
function empty(){return{nodes:[],edges:[]}}
function validate(g){
 if(!g||!Array.isArray(g.nodes)||!Array.isArray(g.edges)||g.nodes.length>24||g.edges.length>80)throw Error('Workflow invalide ou trop volumineux.');
 const ids=new Set();for(const n of g.nodes){if(!n||typeof n.id!=='string'||!/^n[0-9]+$/.test(n.id)||ids.has(n.id)||!Object.hasOwn(types,n.type)||typeof n.label!=='string'||n.label.length>120||typeof n.detail!=='string'||n.detail.length>1000)throw Error('Bloc invalide.');ids.add(n.id)}
 const edgeIds=new Set(),adj=new Map(g.nodes.map(n=>[n.id,[]]));for(const e of g.edges){if(!e||!ids.has(e.from)||!ids.has(e.to)||e.from===e.to)throw Error('Connexion invalide.');const k=e.from+'|'+e.to;if(edgeIds.has(k))throw Error('Connexion déjà présente.');edgeIds.add(k);adj.get(e.from).push(e.to)}
 const visiting=new Set(),visited=new Set();function visit(id){if(visiting.has(id))throw Error('Boucle interdite dans ce workflow séquentiel.');if(visited.has(id))return;visiting.add(id);for(const to of adj.get(id))visit(to);visiting.delete(id);visited.add(id)}for(const id of ids)visit(id);
 return g;
}
function connect(g,from,to){return validate({...g,edges:[...g.edges,{from,to}]})}
function remove(g,id){return validate({nodes:g.nodes.filter(n=>n.id!==id),edges:g.edges.filter(e=>e.from!==id&&e.to!==id)})}
function add(g,type){const id='n'+(Math.max(0,...g.nodes.map(n=>Number(n.id.slice(1))))+1);return validate({...g,nodes:[...g.nodes,{id,type,label:types[type]||'',detail:''}]})}
function layout(g){validate(g);const levels=new Map(g.nodes.map(n=>[n.id,0]));for(let i=0;i<g.nodes.length;i++)for(const e of g.edges)levels.set(e.to,Math.max(levels.get(e.to),levels.get(e.from)+1));const grouped=[];for(const n of g.nodes){const i=levels.get(n.id);(grouped[i]||=([])).push(n)}return grouped}
function inspect(g){validate(g);const incoming=new Set(g.edges.map(e=>e.to)),outgoing=new Set(g.edges.map(e=>e.from));const sources=g.nodes.filter(n=>n.type==='source');const reachable=new Set(sources.map(n=>n.id));for(let i=0;i<g.nodes.length;i++)for(const e of g.edges)if(reachable.has(e.from))reachable.add(e.to);
const checks=[{label:'Source de données définie',ok:sources.length>0},{label:'Traitement accessible depuis une source',ok:g.nodes.some(n=>['prepare','rule','model'].includes(n.type)&&reachable.has(n.id))},{label:'Sortie ou action accessible',ok:g.nodes.some(n=>['output','action'].includes(n.type)&&reachable.has(n.id))},{label:'Contrôle ou validation accessible',ok:g.nodes.some(n=>['decision','human'].includes(n.type)&&reachable.has(n.id))},{label:'Tous les blocs reliés à une source',ok:g.nodes.length>0&&g.nodes.every(n=>reachable.has(n.id))},{label:'Chaque bloc décrit',ok:g.nodes.length>0&&g.nodes.every(n=>n.label.trim()&&n.detail.trim())}];
return{checks,isolated:g.nodes.filter(n=>!incoming.has(n.id)&&!outgoing.has(n.id)).length};
}
function starter(){let g=empty();for(const type of ['source','prepare','model','decision','output','human','action'])g=add(g,type);for(const [a,b] of [['n1','n2'],['n2','n3'],['n3','n4'],['n4','n5'],['n4','n6'],['n5','n7'],['n6','n7']])g=connect(g,a,b);return g}
root.HNSWorkflow={types,empty,validate,connect,remove,add,layout,inspect,starter};
})(globalThis);
