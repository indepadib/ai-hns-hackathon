import test from 'node:test';
import assert from 'node:assert/strict';
import {deliveryConfig,deliverInvitation} from '../lib/invitation-delivery.mjs';
const values={HNS_MAIL_PROVIDER:'gmail',HNS_GMAIL_USER:'recrutement@hns.ma',HNS_GMAIL_APP_PASSWORD:'abcd efgh ijkl mnop',HNS_INVITATION_FROM:'H&S AI Talent Challenge <recrutement@hns.ma>'};
const config=(override={})=>deliveryConfig(key=>({...values,...override})[key]);
test('Gmail config requires authorized mailbox and app-specific password',()=>{
 assert.equal(config().provider,'gmail');
 assert.equal(config({HNS_GMAIL_APP_PASSWORD:''}),null);
 assert.equal(config({HNS_GMAIL_USER:''}),null);
 assert.equal(config({HNS_INVITATION_FROM:'attacker@example.invalid'}),null);
 assert.equal(config({HNS_MAIL_PROVIDER:'unknown'}),null);
});
test('Gmail sends private individualized message with TLS and inline QR',async()=>{
 let closed=false;
 const result=await deliverInvitation(config(),{email:'candidate@example.invalid',mail:{subject:'Test',html:'<img src="cid:hns-pass-qr">',text:'Code test'},qrCode:'data:image/png;base64,AQID',id:'a'.repeat(32)},{createTransport:opts=>{
 assert.equal(opts.host,'smtp.gmail.com');assert.equal(opts.port,587);assert.equal(opts.requireTLS,true);
 return {sendMail:async m=>{assert.equal(m.to,'candidate@example.invalid');assert.equal(m.replyTo,'recrutement@hns.ma');assert.equal(m.attachments[0].cid,'hns-pass-qr');assert.deepEqual(m.attachments[0].content,Buffer.from([1,2,3]));return {accepted:[m.to],messageId:'<test@hns.ma>'}},close:()=>{closed=true}};
 }});
 assert.equal(result.provider,'gmail');assert.equal(closed,true);
});
test('Gmail does not report acceptance when SMTP rejects recipient',async()=>{
 await assert.rejects(deliverInvitation(config(),{email:'candidate@example.invalid',mail:{},qrCode:'data:image/png;base64,AQID',id:'b'.repeat(32)},{createTransport:()=>({sendMail:async()=>({accepted:[],messageId:'<test@hns.ma>'})})}),/acceptance/);
});
