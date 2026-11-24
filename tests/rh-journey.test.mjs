import test from 'node:test';
import assert from 'node:assert/strict';
import {inStage,nextAction,stages} from '../public/rh-journey.mjs';
import {readFileSync} from 'node:fs';
const row={id:'x',status:'selected',email:'test@example.invalid'};
const op={mailStatus:'not_sent',passStatus:'not_prepared',rsvp:'pending'};
test('Journey filters distinguish RH status, provider acceptance, RSVP and arrival',()=>{
 assert.equal(stages.length,6);
 assert.equal(inStage(row,op,'selected'),true);assert.equal(inStage(row,op,'ready'),true);assert.equal(inStage(row,op,'sent'),false);
 assert.equal(inStage({...row,status:'confirmed'},null,'confirmed'),false);
 assert.equal(inStage(row,{...op,rsvp:'confirmed'},'confirmed'),true);
 assert.equal(inStage(row,{...op,mailStatus:'accepted'},'sent'),true);
 assert.equal(inStage(row,{...op,checkedInAt:'now'},'present'),true);
 assert.equal(inStage({...row,status:'interview'},op,'ready'),false);
});
test('Next action requires manual decision and respects operational availability',()=>{
 assert.equal(nextAction({...row,status:'interview'},null,false).kind,'select');
 assert.equal(nextAction(row,op,false).kind,'pass');
 assert.equal(nextAction(row,op,true).disabled,true);
 assert.equal(nextAction({...row,status:'rejected'},null,false).kind,'none');
 assert.equal(nextAction({...row,status:'confirmed'},null,false).kind,'pass');
});
test('All journey controls wired and existing RH login, campaign and correction retained',()=>{
 const html=readFileSync('public/admin-recrutement.html','utf8'),js=readFileSync('public/admin.js','utf8');
 for(const id of ['journeyStart','journeyCheckin','journeyStages','journeyAll','journeyHint','candidateList','loginForm','openCampaign','openReset','restoreReport','sendInvite'])assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(js,/inStage\(r,missionStatus\.get\(r\.id\),journeyFilter\)/);
 assert.match(js,/confirm\('Valider définitivement ce candidat/);
 assert.match(js,/rh-pass-send/);assert.match(js,/rh-session/);
});
