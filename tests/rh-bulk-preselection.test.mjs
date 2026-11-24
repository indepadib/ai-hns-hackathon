import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSubmissionNumbers, planPreselection, applyPreselection } from '../lib/rh-bulk-preselection.mjs';

const candidate = (n, status = 'new', version = 'v1') => ({ submissionNumber:n,id:'test-'+n,status,version });
const settings = { selectedStatus:'selected', eligibleStatuses:['new','review'] };
const candidates = [candidate(1),candidate(2,'selected'),candidate(3,'validated'),candidate(4),candidate(4),candidate(5,'invited'),candidate(6,'new',null)];

test('accepts comma, semicolon, newline and deduplicates', () => {
  assert.deepEqual(parseSubmissionNumbers('1, 2;3\n1'),{ids:[1,2,3],duplicates:[1]});
});
test('rejects invalid input instead of guessing', () => {
  for (const input of ['', '1.5', 'abc', '-1', '0', '9007199254740993']) assert.throws(()=>parseSubmissionNumbers(input));
});
test('preview distinguishes eligible, already selected, protected, ambiguous, missing and unversioned', () => {
  const p=planPreselection({...settings,input:'1 2 3 4 5 6 7',candidates});
  assert.deepEqual(p.rows.map(r=>r.action),['select','already-selected','preserve','ambiguous','preserve','unverifiable','missing']);
});
test('bulk action only selects confirmed eligible records and never sends invitations',async()=>{
  const calls=[];
  const p=await applyPreselection({...settings,input:'1 2 3 4 5 6 7',confirmedNumbers:[1,2,3,4,5,6,7],actor:'rh-test',
    authorize:async actor=>actor==='rh-test',loadCandidates:async()=>candidates,compareAndSelect:async x=>{calls.push(x);return {updated:true}}});
  assert.equal(p.counts.updated,1);
  assert.deepEqual(calls,[{id:'test-1',expectedStatus:'new',expectedVersion:'v1',nextStatus:'selected',actor:'rh-test',notify:false}]);
});
test('unauthorized actor cannot read or mutate dossiers',async()=>{
  await assert.rejects(applyPreselection({...settings,input:'1',confirmedNumbers:[1],authorize:()=>false,loadCandidates:()=>assert.fail(),compareAndSelect:()=>assert.fail()}),/refusé/);
});
test('fresh read preserves RH decisions taken after preview',async()=>{
  const result=await applyPreselection({...settings,input:'1',confirmedNumbers:[1],authorize:()=>true,loadCandidates:()=>[candidate(1,'validated','v2')],compareAndSelect:()=>assert.fail()});
  assert.equal(result.counts.preserve,1);
});
test('reports conflict, failure and unconfirmed records separately',async()=>{
  const result=await applyPreselection({...settings,input:'1 2 3',confirmedNumbers:[1,2],authorize:()=>true,loadCandidates:()=>[candidate(1),candidate(2),candidate(3)],compareAndSelect:async x=>{if(x.id==='test-2')throw new Error('test');return {updated:false}}});
  assert.deepEqual(result.counts,{conflict:1,error:1,'not-confirmed':1});
});
