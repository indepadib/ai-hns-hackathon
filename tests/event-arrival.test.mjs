import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {invitationEmail} from '../lib/invitation-email.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Confirmed 10h arrival is consistent on public, RSVP, staff and participant pages',()=>{
 const landing=read('public/index.html');
 assert.match(landing,/<time>10:00<\/time><div><strong>Accueil/);
 assert.doesNotMatch(landing,/<time>08:30<\/time>/);
 assert.match(read('public/invitation-confirm/index.html'),/Accueil à 10 h/);
 assert.match(read('public/mission-control/app.js'),/28 NOVEMBRE 2026 · 10 H · LA BASE/);
 assert.match(read('public/admin.js'),/Accueil à 10 h · LA BASE/);
 assert.match(read('netlify/functions/mission.mjs'),/\['checkin','Accueil', '10:00'\]/);
});
test('Invitation HTML and plain text include confirmed arrival, venue and map link',()=>{
 const email=invitationEmail({name:'Test',email:'test@example.invalid',code:'A'.repeat(24),qrCode:'data:image/png;base64,AQID',participantUrl:'https://ai.hns.ma/mission-control/',reference:'HNS-AAAAAAAA'});
 for(const part of [email.html,email.text]){assert.match(part,/Accueil à 10 h/);assert.match(part,/LA BASE, Casablanca/);assert.match(part,/https:\/\/share\.google\/nBgf2AVHLM4jRQhqD/);}
});
