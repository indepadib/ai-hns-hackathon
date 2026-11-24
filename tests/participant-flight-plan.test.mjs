import test from 'node:test';import assert from 'node:assert/strict';
import '../public/mission-control/journey.js';
const {plan,rulesFor}=globalThis.HNSJourney;
const ids=['checkin','briefing','matching','challenge','problem','solution','build','redteam','pitch','submission'];
const stages=ids.map((id,i)=>({id,opensAt:i*100}));
test('Flight plan recommends an incomplete open mission instead of skipping to the latest scheduled stage',()=>{
 const p=plan({stages,now:850,match:{choice:'solo'}});assert.equal(p.current,'pitch');assert.equal(p.recommended,'challenge');assert.equal(p.documented,0);
 const q=plan({stages,now:850,match:{choice:'solo'},workspace:{challenge:{id:'retail'}}});assert.equal(q.recommended,'problem');assert.equal(q.documented,1);
});
test('Matching is recommended only before a choice and locked missions remain unavailable',()=>{
 assert.equal(plan({stages,now:250}).recommended,'matching');
 assert.equal(plan({stages,now:250,match:{choice:'pending-peer'}}).recommended,'matching');
 assert.equal(plan({stages,now:250}).steps.every(s=>!s.open),true);
 assert.equal(plan({stages,now:1000,submitted:true}).recommended,'submission');
});
test('Build documentation requires both proof and observed tests; guide and progress agree',()=>{
 const w={tests:{summary:JSON.stringify({tasks:[{status:'done',proof:'commit'}],cases:[{status:'pass',expected:'1',actual:'1'}]})}};
 assert.equal(rulesFor(w,()=>null).build[1].every(x=>x[1]),true);
 assert.equal(plan({workspace:w,stages,now:700}).steps.find(x=>x.id==='build').done,2);
 assert.equal(plan({workspace:{tests:{summary:'text only'}},stages,now:700}).steps.find(x=>x.id==='build').done,0);
});
