import test from 'node:test';
import assert from 'node:assert/strict';
import {guestAction,guestToken,guestMail,validateGuest} from '../lib/event-guests.mjs';
function fixture(){
 const records=new Map();let sequence=0,sends=0;
 const db={list:async({prefix})=>({blobs:[...records.keys()].filter(k=>k.startsWith(prefix)).map(key=>({key}))}),get:async k=>structuredClone(records.get(k)?.data??null),getWithMetadata:async k=>structuredClone(records.get(k)??null),setJSON:async(k,data,opts={})=>{const old=records.get(k);if(opts.onlyIfNew&&old||opts.onlyIfMatch&&opts.onlyIfMatch!==old?.etag)return{modified:false};const etag=String(++sequence);records.set(k,{data:structuredClone(data),etag});return{modified:true,etag}}};
 const secret='S'.repeat(40),now=()=>new Date('2026-11-24T19:00:00Z');
 const call=(action,body={},auth={role:'admin'},enabled=true,deliver=async()=>({id:'mock-'+ ++sends}))=>guestAction({action,body,auth,db,secret,canSend:enabled,deliver,now});
 return{call,secret,sends:()=>sends}
}
test('Guest workflow is separate, explicit, concurrent-safe and supports private RSVP',async()=>{
 const {call,secret,sends}=fixture(),guest={name:'Synthetic Speaker',email:'speaker@example.invalid',role:'keynote',session:'AI in retail',slot:'10:30'};
 assert.equal((await call('guest-create',{guest},{role:'rh'})).status,403);
 const created=await call('guest-create',{guest});assert.equal(created.status,201);const {id,version}=created.value.guest;
 assert.equal((await call('guest-create',{guest})).status,409);
 const preview=await call('guest-preview',{id});assert.match(preview.value.mail.text,/10:30/);assert.match(preview.value.mail.text,/28 novembre/);assert.equal(sends(),0);
 const token=guestToken(id,secret);
 assert.equal((await call('guest-rsvp-read',{token},null)).status,404);
 assert.equal((await call('guest-send',{id,version,confirm:false})).status,409);
 assert.equal((await call('guest-send',{id,version,confirm:true},{role:'admin'},false)).status,409);
 const concurrent=await Promise.all([call('guest-send',{id,version,confirm:true}),call('guest-send',{id,version,confirm:true})]);assert.deepEqual(concurrent.map(x=>x.status).sort(),[200,409]);assert.equal(sends(),1);
 const read=await call('guest-rsvp-read',{token},null);assert.equal(read.status,200);assert.equal(Object.hasOwn(read.value.guest,'email'),false);
 assert.equal((await call('guest-rsvp',{token:token.slice(0,-1)+'z',response:'confirmed'},null)).status,404);
 const rsvp=await call('guest-rsvp',{token,response:'confirmed'},null);assert.equal(rsvp.value.guest.rsvp,'confirmed');
 assert.equal((await call('guest-list',{},null)).status,403);
 const row=(await call('guest-list')).value.guests[0];
 assert.equal((await call('guest-checkin',{id,version:row.version,confirm:true})).status,200);
 assert.equal((await call('guest-rsvp',{token,response:'declined'},null)).status,409);
});
test('Uncertain guest send cannot be automatically retried',async()=>{
 const {call}=fixture(),r=await call('guest-create',{guest:{name:'Test Mentor',email:'mentor@example.invalid',role:'mentor'}});
 const {id,version}=r.value.guest;
 assert.equal((await call('guest-send',{id,version,confirm:true},{role:'admin'},true,async()=>{throw Error('timeout')})).status,503);
 const row=(await call('guest-list')).value.guests[0];assert.equal(row.mailStatus,'review_required');
 assert.equal((await call('guest-send',{id,version:row.version,confirm:true})).status,409);
});
test('Guest email escapes content and validates slot and role',()=>{
 const g=validateGuest({name:'<script>',email:'x@example.invalid',role:'workshop',slot:'13:30'});
 assert.ok(!guestMail({...g,id:'a'.repeat(32)},'S'.repeat(40)).html.includes('<script>'));
 assert.throws(()=>validateGuest({...g,slot:'25:00'}));assert.throws(()=>validateGuest({...g,role:'admin'}));
});

test('Business Talk invitations carry the six-vertical brief and only invited speakers can submit presentation links',async()=>{
 const {call,secret}=fixture();
 const fields={name:'Synthetic BU representative',email:'bu@example.invalid',role:'business',vertical:'retail',session:'Nos enjeux métiers',slot:'10:50'};
 assert.throws(()=>validateGuest({...fields,vertical:''}));
 assert.throws(()=>validateGuest({...fields,vertical:'unknown'}));
 const created=await call('guest-create',{guest:fields});assert.equal(created.status,201);
 const {id,version}=created.value.guest,token=guestToken(id,secret);
 const preview=await call('guest-preview',{id});assert.match(preview.value.mail.subject,/One Retail/);assert.match(preview.value.mail.text,/4 slides recommandées/);assert.match(preview.value.mail.text,/Trois problématiques/);assert.match(preview.value.mail.html,/Préparation de votre intervention/);
 const materials={title:'Business Talk',link:'https://example.invalid/slides',notes:'Version de travail'};
 assert.equal((await call('guest-materials',{token,materials},null)).status,404);
 assert.equal((await call('guest-send',{id,version,confirm:true})).status,200);
 assert.equal((await call('guest-materials',{token,materials:{...materials,link:'javascript:alert(1)'}},null)).status,400);
 assert.equal((await call('guest-materials',{token,materials},null)).status,200);
 const row=(await call('guest-list')).value.guests[0];assert.equal(row.materials.link,materials.link);assert.equal(row.vertical,'retail');assert.equal(row.rsvp,'pending');
 const read=await call('guest-rsvp-read',{token},null);assert.equal(read.value.guest.brief.items.length,4);assert.equal(read.value.guest.canShareMaterials,true);assert.equal(read.value.guest.materials.title,materials.title);
});
