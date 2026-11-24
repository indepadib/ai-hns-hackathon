import test from 'node:test';
import assert from 'node:assert/strict';
import {teamSignals} from '../lib/team-signals.mjs';
test('empty workspace does not count as a documented deliverable',()=>{const s=teamSignals({problem:{summary:'{}'},solution:{summary:'{}'},tests:{summary:'{"tasks":[],"cases":[]}'},submission:{result:''}});assert.equal(s.documented,0);assert.equal(s.testsEvidenced,0);});
test('test status without observed and expected results is not evidence',()=>{const s=teamSignals({tests:{summary:JSON.stringify({cases:[{status:'pass',actual:'',expected:'yes'},{status:'fail',actual:'no',expected:'yes'}]})}});assert.equal(s.testsEvidenced,1);assert.equal(s.proof.test,true);});
test('unmitigated failures remain visible even when another risk is verified',()=>{const s=teamSignals({redteam:{quality:{status:'verified',proof:'log'},accuracy:{status:'failed',mitigation:''}}});assert.equal(s.unresolved,1);assert.equal(s.riskVerified,1);assert.equal(s.proof.redteam,false);});
test('complete concept evidence is separate from jury quality',()=>{const s=teamSignals({problem:{summary:JSON.stringify({problem:'Stock',users:'Manager',evidence:'Observation',kpi:'Target'})}});assert.equal(s.proof.problem,true);assert.equal(s.documented,1);assert.equal('score' in s,false);});
