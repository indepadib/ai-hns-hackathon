(function(root){'use strict';
const products=[{name:'Lait',price:10,cost:6,color:'#75b7d6'},{name:'Biscuits',price:15,cost:8,color:'#dcaf70'},{name:'Yaourt',price:12,cost:6,color:'#cc87b0'},{name:'Jus',price:18,cost:9,color:'#e1a46e'},{name:'Salade',price:20,cost:10,color:'#78b594'}];
const levels=[{title:'Premiers clients',duration:45,every:7,patience:20,target:5,budget:30},{title:'Sortie des bureaux',duration:65,every:5,patience:17,target:9,budget:36},{title:'Black Friday',duration:90,every:3,patience:15,target:18,budget:54},{title:'Le grand rush',duration:120,every:3,patience:13,target:25,budget:66}];
const hireCost=18;function basket(id){return Array.from({length:2+id%3},(_,i)=>(id*3+i*2)%products.length)}
function create(level=0){if(!levels[level])throw Error('Niveau inconnu');return{level,time:0,next:1,queue:[],manual:null,staff:[{hired:false,job:null},{hired:false,job:null}],served:0,lost:0,revenue:0,margin:0,spent:0,streak:0,best:0,done:false,history:[]}}
function customer(id,time){return{id,arrival:time,items:basket(id),scanned:0}}
function fill(s){if(!s.manual&&s.queue.length)s.manual=s.queue.shift();for(const lane of s.staff)if(lane.hired&&!lane.job&&s.queue.length)lane.job=s.queue.shift();return s}
function copy(s){return {...s,queue:s.queue.map(c=>({...c})),manual:s.manual?{...s.manual}:null,staff:s.staff.map(l=>({...l,job:l.job?{...l.job}:null})),history:[...s.history]}}
function sold(s,c){s.served++;s.revenue+=c.items.reduce((n,i)=>n+products[i].price,0);s.margin+=c.items.reduce((n,i)=>n+products[i].price-products[i].cost,0);s.streak++;s.best=Math.max(s.best,s.streak);s.history.push({type:'sale',id:c.id,time:s.time});}
function tick(s){if(s.done)return s;const n=copy(s),l=levels[n.level];n.time++;if(n.time<l.duration&&(n.time-1)%l.every===0){n.queue.push(customer(n.next++,n.time))}
const waiting=n.queue.filter(c=>n.time-c.arrival<l.patience);const lost=n.queue.length-waiting.length;n.queue=waiting;n.lost+=lost;if(lost)n.streak=0;
for(const lane of n.staff)if(lane.hired&&lane.job){lane.job.scanned++;if(lane.job.scanned===lane.job.items.length){sold(n,lane.job);lane.job=null}}
if(n.time>=l.duration){n.done=true;return n}return fill(n)}
function scan(s){if(s.done||!s.manual)return s;const n=copy(s);n.manual.scanned++;if(n.manual.scanned===n.manual.items.length){sold(n,n.manual);n.manual=null;fill(n)}return n}
function hire(s,i){if(s.done||!s.staff[i]||s.staff[i].hired||s.spent+hireCost>levels[s.level].budget)return s;const n=copy(s);n.staff[i].hired=true;n.spent+=hireCost;n.margin-=hireCost;return fill(n)}
function score(s){const l=levels[s.level],passed=s.done&&s.served>=l.target;return{passed,stars:passed?(s.lost<=1&&s.margin>0?3:2):s.done&&s.served>=Math.ceil(l.target*.7)?1:0}}
root.Checkout=Object.freeze({products,levels,hireCost,create,tick,scan,hire,score,basket});
})(globalThis);