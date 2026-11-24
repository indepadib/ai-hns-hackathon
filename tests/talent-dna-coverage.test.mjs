import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {summarize,dimensions,validateObservation} from '../lib/talent-observations.mjs';
test('Individual coverage counts distinct dimensions rather than assigning a skill score',()=>{
 const a=validateObservation({dimension:'data',phase:'build',observer:'Observer',fact:'Identified duplicate keys in the synthetic dataset.'});
 const b=validateObservation({dimension:'data',phase:'redteam',observer:'Observer',fact:'Checked invalid data before running a prediction.'});
 assert.deepEqual(summarize({notes:[a,b]}).dimensions,['data']);assert.equal(summarize({notes:[a,b]}).count,2);assert.equal(Object.keys(dimensions).length,6);assert.deepEqual(summarize(null).dimensions,[]);
});
test('Coverage filter and confidential individual brief are linked without automatic score',()=>{
 const js=readFileSync('public/mission-control/app.js','utf8');
 for(const id of ['dna-overview','dna-coverage-filter','dna-brief'])assert.ok(js.includes('id="'+id+'"'));
 assert.match(js,/const dnaPrompts=/);assert.match(js,/Exporter cette fiche nominative confidentielle/);assert.match(js,/dimensionsNonObservees/);
});
