import test from 'node:test';
import assert from 'node:assert/strict';
import '../public/mission-control/verticals.js';
import '../public/mission-control/benchmark.js';
import '../public/mission-control/learning.js';
const V=globalThis.HNSVerticals,L=globalThis.HNSLearning;
test('Custom challenge validates and maps to each approved vertical, without assigning a fabricated benchmark',()=>{
 const input={title:'Assistant RH fictif',domain:'RH',problem:'Un collaborateur ne trouve pas les procédures fictives.',idea:'Assistant avec références aux documents fictifs.',approach:'LLM / RAG',email:'discard@example.invalid'};
 for(const v of V.verticals){const id='custom-'+v.id,brief=V.validateCustom(id,input);assert.equal(V.verticalFor(id),v.id);assert.equal(brief.vertical,v.id);assert.equal(brief.title,input.title);assert.equal(Object.hasOwn(brief,'email'),false);assert.equal(V.get(id),null);assert.equal(Object.hasOwn(globalThis.HNSBenchmark.descriptions,id),false)}
 assert.throws(()=>V.validateCustom('custom-unknown',input));
 assert.throws(()=>V.validateCustom('custom-group',{...input,problem:'x'}));
 assert.throws(()=>V.validateCustom('custom-group',{...input,approach:'other'}));
});
test('Ten learning modules have actionable steps, examples, and pitfalls',()=>{
 assert.deepEqual(Object.keys(L.lessons),['checkin','briefing','matching','challenge','problem','solution','build','redteam','pitch','submission']);
 for(const [id,l] of Object.entries(L.lessons)){assert.equal(l.length,7,id);assert.equal(l[4].length,3,id);assert.ok(l[5]&&l[6],id)}
 assert.equal(Object.keys(L.examples.problem).length,6);
});
