import test from 'node:test';
import assert from 'node:assert/strict';
import {guestAction,guestToken,guestMail,validateGuest,guestQrPayload,guestQrId,scanGuestPass} from '../lib/event-guests.mjs';
function fixture(guestPlan,guestContacts){
 const records=new Map();let sequence=0,sends=0;
 const db={list:async({prefix})=>({blobs:[...records.keys()].filter(k=>k.startsWith(prefix)).map(key=>({key}))}),get:async k=>structuredClone(records.get(k)?.data??null),getWithMetadata:async k=>structuredClone(records.get(k)??null),setJSON:async(k,data,opts={})=>{const old=records.get(k);if(opts.onlyIfNew&&old||opts.onlyIfMatch&&opts.onlyIfMatch!==old?.etag)return{modified:false};const etag=String(++sequence);records.set(k,{data:structuredClone(data),etag});return{modified:true,etag}}};
 const secret='S'.repeat(40),now=()=>new Date('2026-11-24T19:00:00Z');
 const call=(action,body={},auth={role:'admin'},enabled=true,deliver=async()=>({id:'mock-'+ ++sends}))=>guestAction({action,body,auth,db,secret,canSend:enabled,deliver,guestPlan,guestContacts,now});
 return{call,db,secret,sends:()=>sends}
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

test('Business Talk invitations carry the seven-vertical brief and only invited speakers can submit presentation links',async()=>{
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

test('Private roster import is explicit, admin-only, idempotent and does not send invitations',async()=>{
 const {call,sends}=fixture(JSON.stringify({guests:[{name:'Synthetic Missing Email',role:'guest'},{name:'Synthetic Fintech Speaker',role:'business',vertical:'fintech',email:'fintech@example.invalid'}]}));
 assert.equal((await call('guest-import-plan',{confirm:true},{role:'rh'})).status,403);
 assert.equal((await call('guest-import-plan',{confirm:false})).status,409);
 assert.equal((await call('guest-list')).value.planCount,2);
 assert.equal((await call('guest-import-plan',{confirm:true})).value.created,2);
 assert.equal((await call('guest-import-plan',{confirm:true})).value.skipped,2);
 const row=(await call('guest-list')).value.guests.find(r=>!r.email);
 assert.equal((await call('guest-send',{id:row.id,version:row.version,confirm:true})).status,409);
 const updated=await call('guest-update',{id:row.id,version:row.version,guest:{...row,email:'missing@example.invalid'}});
 assert.equal(updated.value.guest.email,'missing@example.invalid');assert.equal(sends(),0);
 assert.equal((await call('guest-send',{id:row.id,version:updated.value.guest.version,confirm:true})).status,200);
 assert.equal(sends(),1);
});
test('Legacy industry maps to consolidated Dislog DMD and group and fintech are supported',()=>{
 const g={name:'Synthetic',role:'business',email:'s@example.invalid'};
 assert.equal(validateGuest({...g,vertical:'industry'}).vertical,'life');
 assert.equal(validateGuest({...g,vertical:'group'}).vertical,'group');
 assert.equal(validateGuest({...g,vertical:'fintech'}).vertical,'chari');
});

test('Private contact data supplements existing roles without choosing an ambiguous address',async()=>{
 const {call,sends}=fixture(JSON.stringify({guests:[{name:'Synthetic Speaker',role:'business',vertical:'fintech'}]}),JSON.stringify({guests:[{name:'Synthetic Speaker',emailOptions:['one@example.invalid','two@example.invalid']},{name:'Synthetic Mentor',email:'mentor@example.invalid'}]}));
 assert.equal((await call('guest-import-plan',{confirm:true})).value.created,2);
 const rows=(await call('guest-list')).value.guests;
 const speaker=rows.find(r=>r.name==='Synthetic Speaker');
 assert.equal(speaker.role,'business');assert.equal(speaker.email,'');assert.equal(speaker.emailOptions.length,2);
 assert.equal((await call('guest-send',{id:speaker.id,version:speaker.version,confirm:true})).status,409);
 assert.equal(rows.find(r=>r.name==='Synthetic Mentor').email,'mentor@example.invalid');
 assert.equal(sends(),0);
});

test('Original six-column private speaker roster retains role, slot and sector when contacts are merged',async()=>{
 const plan={roster:[['Synthetic Speaker','chari','Fintech','business','11:15','Business talk'],['Synthetic Mentor','','IT','mentor','','Support'],['Legacy','industry','Industry','mentor','','Test'],['Invalid','unknown','Demo','business','','Test']]};
 const contacts={guests:[{name:'Synthetic Speaker',email:'speaker@example.invalid'}]};
 const {call,sends}=fixture(JSON.stringify(plan),JSON.stringify(contacts));
 assert.equal((await call('guest-list')).value.planCount,3);
 assert.equal((await call('guest-import-plan',{confirm:true})).value.created,3);
 const rows=(await call('guest-list')).value.guests;
 const s=rows.find(x=>x.name==='Synthetic Speaker');assert.equal(s.role,'business');assert.equal(s.slot,'11:15');assert.equal(s.vertical,'chari');assert.equal(s.email,'speaker@example.invalid');
 assert.equal(rows.find(x=>x.name==='Synthetic Mentor').vertical,'group');assert.equal(rows.find(x=>x.name==='Legacy').vertical,'life');assert.equal(sends(),0);
});

test('Guest QR is distinct, only issued after RSVP and scans only on event day with authorized staff',async()=>{const {call,db,secret,sends}=fixture();const created=await call('guest-create',{guest:{name:'Synthetic QR Guest',email:'qr@example.invalid',role:'mentor'}});const {id,version}=created.value.guest,token=guestToken(id,secret),code=guestQrPayload(id,secret),now=()=>new Date('2026-11-28T10:00:00+01:00'),scan=(c=code,auth={role:'rh'},clock=now)=>scanGuestPass({db,secret,code:c,auth,now:clock});assert.equal(guestQrId(code,secret),id);assert.equal(guestQrId(code.replace('HNSG:','HNS2:'),secret),null);assert.equal((await scan()).status,409);await call('guest-send',{id,version,confirm:true});assert.equal((await call('guest-rsvp-read',{token},null)).value.guest.passCode,undefined);assert.equal((await scan()).status,409);const confirmed=await call('guest-rsvp',{token,response:'confirmed'},null);assert.equal(confirmed.value.guest.passCode,code);assert.equal((await scan(code,{role:'participant'})).status,403);assert.equal((await scan(code,{role:'rh'},()=>new Date('2026-11-27T10:00:00+01:00'))).status,409);assert.equal((await scan(code.slice(0,-1)+(code.endsWith('0')?'1':'0'))).status,400);const pair=await Promise.all([scan(),scan()]);assert.ok(pair.every(x=>x.status===200));assert.equal(pair.filter(x=>x.value.alreadyPresent).length,1);assert.equal(pair[0].value.guestPresent,1);assert.equal(pair[0].value.kind,'guest');assert.equal((await call('guest-rsvp-read',{token},null)).value.guest.passCode,undefined);assert.equal(sends(),1);});

test('Premium guest mail is personalized, includes the published indicative agenda and a signed personal RSVP link',()=>{
 const secret='S'.repeat(40),id='a'.repeat(32);
 const row={id,name:'Invité <Test> & Associé',email:'test@example.invalid',role:'business',vertical:'retail',department:'Direction',session:'Atelier <stock>',slot:'11:20'};
 const mail=guestMail(row,secret),url='https://ai.hns.ma/invites/#'+guestToken(id,secret);
 assert.match(mail.subject,/One Retail/);
 assert.ok(mail.text.includes(url));
 assert.ok(mail.html.includes('href="'+url+'"'));
 assert.ok(mail.html.includes('Invité &lt;Test&gt; &amp; Associé'));
 assert.ok(!mail.html.includes('Atelier <stock>'));
 assert.match(mail.html,/Répondre à mon invitation/);
 assert.match(mail.html,/Votre créneau : 11:20/);
 assert.match(mail.text,/10:00 — Accueil/);
 assert.match(mail.text,/18:00 — Clôture/);
 assert.match(mail.text,/Programme indicatif/);
 assert.match(mail.html,/Préparation de votre intervention/);
 assert.ok(mail.html.indexOf('Répondre à mon invitation')<mail.html.indexOf('Préparation de votre intervention'));
 assert.ok(!mail.html.includes('HNSG:'));
 const leadership=guestMail({...row,role:'leadership',slot:''},secret);
 assert.match(leadership.html,/Découvrez les talents/);
 assert.doesNotMatch(leadership.html,/Préparation de votre intervention/);
 assert.doesNotMatch(leadership.html,/Votre créneau :/);
 for(const content of [mail.text,mail.html,leadership.text,leadership.html])assert.doesNotMatch(content,/transmettez votre support|avant vendredi 27 novembre|Votre support<\/strong>/i);
});
