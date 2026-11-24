import test from 'node:test';
import assert from 'node:assert/strict';
import {eligible,validEmail,qrPayload,qrId,invitationEmail} from '../lib/invitation-email.mjs';
const id='0123456789abcdef0123456789abcdef',secret='synthetic-test-secret-not-for-production';
test('eligibility and email validation reject unapproved records and header injection',()=>{
 assert.equal(eligible({status:'selected'}),true);assert.equal(eligible({status:'shortlisted'}),false);assert.equal(eligible({status:'rejected'}),false);
 assert.equal(validEmail('test@example.invalid'),true);assert.equal(validEmail('test@example.invalid\r\nBcc: x@y.com'),false);
});
test('signed QR is separate from access code and rejects altered signatures',()=>{
 const qr=qrPayload(id,secret);assert.equal(qrId(qr,secret),id);assert.equal(qrId(qr,'different-secret'),null);
 assert.equal(qrId(qr.slice(0,-1)+(qr.endsWith('A')?'B':'A'),secret),null);assert.equal(qrId('A'.repeat(24),secret),null);
});
test('EML includes alternative body, embedded QR and staging warning',()=>{
 const mail=invitationEmail({name:'<Test & Candidate>',email:'test@example.invalid',code:'A'.repeat(24),qrCode:'data:image/png;base64,aGVsbG8=',participantUrl:'https://hns-ai-challenge-staging.netlify.app/mission-control/',reference:'HNS-01234567',preview:true});
 assert.match(mail.html,/&lt;Test &amp; Candidate&gt;/);assert.match(mail.html,/cid:hns-pass-qr/);assert.match(mail.eml,/Content-ID: <hns-pass-qr>/);
 assert.match(mail.eml,/multipart\/alternative/);assert.match(mail.subject,/PRÉPRODUCTION/);assert.match(mail.text,/NE PAS ENVOYER/);
 assert.throws(()=>invitationEmail({name:'test',email:'x\r\ny@example.com'}));
});
