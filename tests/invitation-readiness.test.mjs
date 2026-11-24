import test from 'node:test';
import assert from 'node:assert/strict';
import {invitationBlocker} from '../lib/invitation-readiness.mjs';
const ready={live:true,enabled:true,provider:'gmail-oauth',connection:{connected:true,testedAt:'2026-11-24'},row:{status:'selected'},pass:{status:'invited',rsvp:'pending'},mail:null};
test('Selected candidate with verified Gmail and no previous invitation can be sent',()=>assert.equal(invitationBlocker(ready),null));
test('Invitation refusal returns actionable and mutually specific reason',()=>{
 for(const [change,code] of [[{live:false},'PREVIEW'],[{enabled:false},'SEND_DISABLED'],[{provider:null},'PROVIDER_MISSING'],[{connection:{connected:true,testedAt:null}},'GMAIL_TEST_REQUIRED'],[{mail:{state:'accepted'}},'ALREADY_SENT'],[{mail:{state:'review_required'}},'MAIL_REVIEW'],[{row:{status:'selected',invitedAt:'yesterday'}},'RH_ALREADY_INVITED'],[{row:{status:'confirmed'}},'RH_STATUS'],[{pass:{status:'invited',rsvp:'declined'}},'DECLINED'],[{pass:{status:'active'}},'PASS_STATE']]){
  assert.equal(invitationBlocker({...ready,...change}).code,code);
 }
});
