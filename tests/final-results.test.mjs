import test from 'node:test';
import assert from 'node:assert/strict';
import {finalResults} from '../lib/final-results.mjs';
test('Ranks only submitted projects with valid official scores; ties share their rank',()=>{
 const rows=[{id:'a',alias:'Alpha',submitted:true,score:{total:90}},{id:'b',alias:'Beta',submitted:true,score:{total:90}},{id:'c',alias:'Gamma',submitted:true,score:{total:80}},{id:'d',alias:'Delta',submitted:false,score:{total:99}},{id:'e',alias:'Epsilon',submitted:true,score:null},{id:'f',alias:'Phi',submitted:true,score:{total:0}}];
 const result=finalResults(rows);
 assert.deepEqual(result.projects.filter(p=>p.rank!==null).map(p=>[p.id,p.rank]),[['a',1],['b',1],['c',3],['f',4]]);
 assert.equal(result.metrics.scored,4);assert.equal(result.metrics.pending,1);assert.equal(result.provisional,true);
});
test('Individual observations are alphabetical and never assigned a project rank',()=>{
 const people=[{id:'b',alias:'Beta',count:5,followup:'technical'},{id:'a',alias:'Alpha',count:0,followup:'none'}];
 const r=finalResults([],people);assert.deepEqual(r.people.map(p=>p.id),['a','b']);assert.equal(r.metrics.observed,1);assert.equal(r.metrics.followups,1);assert.ok(r.people.every(p=>!Object.hasOwn(p,'rank')));
});
