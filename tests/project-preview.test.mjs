import test from 'node:test';import assert from 'node:assert/strict';import {projectPreview} from '../lib/team-signals.mjs';import '../public/mission-control/verticals.js';
test('Preview only reports saved facts and readable BU and challenge labels',()=>{
 const p=projectPreview({challenge:{id:'custom-retail',custom:{title:'Sujet fictif'}},problem:{summary:JSON.stringify({problem:'Problème fictif',kpi:'Temps'})},solution:{summary:JSON.stringify({model:'RAG'})},tests:{summary:JSON.stringify({tasks:[{status:'done'},{status:'pending'}],cases:[{status:'pass'},{status:'fail'}]})},submission:{result:'Prototype fictif'}});
 assert.equal(p.problem,'Problème fictif');assert.equal(p.solution,'RAG');assert.equal(p.completedTasks,1);assert.equal(p.passedTests,1);assert.equal(p.result,'Prototype fictif');
 assert.deepEqual(globalThis.HNSVerticals.projectLabel(p.challengeId,p.customTitle),{bu:'One Retail',title:'Sujet fictif'});
 assert.equal(globalThis.HNSVerticals.projectLabel('mrb-vendeur-expert').bu,'One Retail');
 assert.equal(projectPreview({}).result,'');assert.equal(projectPreview({}).testCount,0);
 assert.equal(globalThis.HNSVerticals.projectLabel('').title,'Challenge non choisi');
});