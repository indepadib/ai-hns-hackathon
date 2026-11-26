(function(root){'use strict';
const products=[{name:'Lait',price:10,cost:6,color:'#75b7d6'},{name:'Biscuits',price:15,cost:8,color:'#dcaf70'},{name:'Yaourt',price:12,cost:6,color:'#cc87b0'},{name:'Jus',price:18,cost:9,color:'#e1a46e'},{name:'Salade',price:20,cost:10,color:'#78b594'}];
const levels=[{title:'Premiers clients',duration:45,every:7,patience:20,target:5,budget:30},{title:'Sortie des bureaux',duration:65,every:5,patience:17,target:9,budget:36},{title:'Black Friday',duration:90,every:3,patience:15,target:18,budget:54},{title:'Le grand rush',duration:120,every:3,patience:13,target:25,budget:66}];
const hireCost=18;const manualTargets=[3,4,6,8];function basket(id){return Array.from({length:2+id%3},(_,i)=>(id*3+i*2)%products.length)}
function create(level=0){if(!levels[level])throw Error('Niveau inconnu');return{level,time:0,next:1,queue:[],manual:null,staff:[{hired:false,job:null},{hired:false,job:null}],served:0,manualServed:0,lost:0,revenue:0,margin:0,spent:0,streak:0,best:0,errors:0,lockUntil:0,done:false,history:[]}}
function customer(id,time){const items=basket(id),total=items.reduce((n,i)=>n+products[i].price,0);return{id,arrival:time,items,scanned:0,total,cash:id%2===1?Math.ceil(total/10)*10+10:null,change:0,verified:false}}
function fill(s){if(!s.manual&&s.queue.length)s.manual=s.queue.shift();for(const lane of s.staff)if(lane.hired&&!lane.job&&s.queue.length)lane.job=s.queue.shift();return s}
function copy(s){return {...s,queue:s.queue.map(c=>({...c})),manual:s.manual?{...s.manual}:null,staff:s.staff.map(l=>({...l,job:l.job?{...l.job}:null})),history:[...s.history]}}
function sold(s,c,manual=false){s.served++;if(manual)s.manualServed++;s.revenue+=c.items.reduce((n,i)=>n+products[i].price,0);s.margin+=c.items.reduce((n,i)=>n+products[i].price-products[i].cost,0);s.streak++;s.best=Math.max(s.best,s.streak);s.history.push({type:'sale',id:c.id,time:s.time,manual});}
function tick(s){if(s.done)return s;const n=copy(s),l=levels[n.level];n.time++;if(n.time<l.duration&&(n.time-1)%l.every===0){n.queue.push(customer(n.next++,n.time))}
const waiting=n.queue.filter(c=>n.time-c.arrival<l.patience);const lost=n.queue.length-waiting.length;n.queue=waiting;n.lost+=lost;if(lost)n.streak=0;
for(const lane of n.staff)if(lane.hired&&lane.job){lane.job.scanned++;if(lane.job.scanned===lane.job.items.length){sold(n,lane.job);lane.job=null}}
if(n.time>=l.duration){n.done=true;return n}return fill(n)}
function phase(s){const c=s.manual;if(!c)return 'idle';if(c.scanned<c.items.length)return c.scanned===1&&c.id%3===0&&!c.verified?'verify':'scan';return c.cash===null?'card':'cash'}
function blocked(s){return s.done||!s.manual||s.time<s.lockUntil}
function wrong(s){const n=copy(s);n.errors++;n.streak=0;n.lockUntil=n.time+2;return n}
function scan(s,sku){if(blocked(s)||phase(s)!=='scan')return s;if(sku!==s.manual.items[s.manual.scanned])return wrong(s);const n=copy(s);n.manual.scanned++;return n}
function verify(s,correct){if(blocked(s)||phase(s)!=='verify')return s;if(correct!==true)return wrong(s);const n=copy(s);n.manual.verified=true;return n}
function change(s,value){if(blocked(s)||phase(s)!=='cash'||![1,2,5,10,20].includes(value))return s;const n=copy(s);n.manual.change+=value;return n}
function clearChange(s){if(blocked(s)||phase(s)!=='cash')return s;const n=copy(s);n.manual.change=0;return n}
function pay(s){if(blocked(s)||!['cash','card'].includes(phase(s)))return s;if(phase(s)==='cash'&&s.manual.change!==s.manual.cash-s.manual.total)return wrong(s);const n=copy(s);sold(n,n.manual,true);n.manual=null;return fill(n)}
function hire(s,i){if(s.done||!s.staff[i]||s.staff[i].hired||s.spent+hireCost>levels[s.level].budget)return s;const n=copy(s);n.staff[i].hired=true;n.spent+=hireCost;n.margin-=hireCost;return fill(n)}
function score(s){const l=levels[s.level],passed=s.done&&s.served>=l.target&&s.manualServed>=manualTargets[s.level];return{passed,stars:passed?(s.lost<=1&&s.margin>0&&s.errors<=2?3:2):s.done&&s.served>=Math.ceil(l.target*.7)?1:0}}
root.Checkout=Object.freeze({products,levels,hireCost,create,tick,scan,hire,score,basket,phase,verify,change,clearChange,pay,manualTargets});
})(globalThis);