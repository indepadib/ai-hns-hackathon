import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {guestMail} from '../lib/event-guests.mjs';
const browser=await chromium.launch({headless:true});const base='http://127.0.0.1:8765';
await mkdir('browser-review',{recursive:true});
try{
 for(const viewport of [{width:390,height:844},{width:1440,height:900}]){
  const context=await browser.newContext({viewport}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const guests=[];let sends=0;const id='a'.repeat(32),inviteToken=id+'.'+'b'.repeat(64);
  await page.route('**/api/mission',async route=>{
   const req=route.request();let out={},status=200;
   if(req.method()==='GET')out={service:'hns-mission'};
   else{const body=req.postDataJSON();switch(body.action){
    case 'me':out={role:'admin'};break;
    case 'staff-list':out={participants:[],sendEnabled:false};break;
    case 'schedule':out={now:Date.now(),stages:[]};break;
    case 'team-dashboard':out={teams:[]};break;
    case 'guest-list':out={guests,sendEnabled:true};break;
    case 'guest-create':guests.push({id,...body.guest,version:0,mailStatus:'draft',rsvp:'pending'});out={guest:guests[0]};status=201;break;
    case 'guest-preview':out={guest:guests[0],mail:guestMail(guests[0],'S'.repeat(40))};break;
    case 'guest-send':assert.equal(body.confirm,true);sends++;guests[0].mailStatus='accepted';guests[0].version++;out={guest:guests[0]};break;
    case 'guest-materials':case 'guest-rsvp-read':case 'guest-rsvp':
      assert.equal(body.token,inviteToken);
      if(body.action==='guest-rsvp')guests[0].rsvp=body.response;
      if(body.action==='guest-materials')guests[0].materials=body.materials;
      out={guest:{name:guests[0].name,role:'Représentant de verticale · Business Talk',vertical:'One Retail',session:guests[0].session,slot:guests[0].slot,rsvp:guests[0].rsvp,...(guests[0].rsvp==='confirmed'?{passCode:'HNSG:'+'A'.repeat(32)+':'+'B'.repeat(32),qrCode:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII='}:{}),canShareMaterials:true,materials:guests[0].materials,brief:{duration:'7 minutes',format:'4 slides recommandées',items:['Notre métier','Notre réalité terrain','Trois problématiques','Notre ambition'],note:'Exemples concrets'}}};break;
    default:status=400;out={error:'Unexpected synthetic request '+body.action};
   }}
   await route.fulfill({status,json:out});
  });
  await page.addInitScript(()=>{if(window.top!==window.self)return;sessionStorage.setItem('hns_mission_token','synthetic-admin');sessionStorage.setItem('hns_mission_role','admin')});
  await page.goto(base+'/mission-control/');
  const shortcuts=page.getByRole('navigation',{name:'Raccourcis organisation'});await shortcuts.waitFor();
  assert.equal(await shortcuts.getByRole('button').count(),5);
  for(const [id,section] of [['arrivals','.staff-heading'],['teams','.talent-command'],['schedule','.admin-utility'],['results','.final-desk'],['guests','.guests-desk']]){
   await shortcuts.locator('[data-event-jump="'+id+'"]').click();
   assert.equal(await page.locator(section+' h2').first().evaluate(el=>document.activeElement===el),true,'Shortcut focus '+id);
  }
  assert.equal(sends,0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'Organizer navigation overflow');
  await page.locator('#guests-open').click();await page.locator('#guests-new').click();
  const form=page.locator('.guest-form');await form.locator('[name=name]').fill('Intervenant fictif');await form.locator('[name=email]').fill('speaker@example.invalid');await form.locator('[name=role]').selectOption('business');await form.locator('[name=vertical]').selectOption('retail');await form.locator('[name=department]').fill('One Retail');await form.locator('[name=session]').fill('IA et opérations');await form.locator('[name=slot]').fill('13:30');
  await form.locator('button[type=submit]').click();await page.locator('[data-guest-preview]').click();await page.locator('#guest-send').waitFor();assert.equal(sends,0);
  const mailFrame=page.frameLocator('#guest-mail-frame');
  await mailFrame.getByText('Bonjour Intervenant fictif,',{exact:true}).waitFor();
  assert.equal(await mailFrame.getByRole('link',{name:'Répondre à mon invitation'}).getAttribute('href'),'#');
  assert.match(await mailFrame.locator('body').innerText(),/Programme indicatif/);
  assert.match(await mailFrame.locator('body').innerText(),/Votre créneau : 13:30/);
  await page.locator('#guest-close').click();
  await page.locator('#guest-select-visible').click();await page.locator('#guest-batch-review').click();
  assert.match(await page.locator('#guest-batch-panel').innerText(),/speaker@example.invalid/);assert.equal(sends,0);
  await page.locator('#guest-batch-cancel').click();assert.equal(sends,0);
  if(viewport.width===390){
   await page.locator('[data-guest-preview]').click();await page.locator('#guest-send').waitFor();
   page.once('dialog',d=>d.accept());await page.locator('#guest-send').click();
  }else{
   await page.locator('#guest-batch-review').click();
   page.once('dialog',d=>d.accept());await page.locator('#guest-batch-send').click();
  }
  await page.locator('.guest-state').getByText('Réponse attendue',{exact:true}).waitFor();assert.equal(sends,1);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'Guest center overflow');
  await page.screenshot({path:'browser-review/guest-center-'+viewport.width+'.png',fullPage:true});
  await page.goto(base+'/invites/#'+inviteToken);await page.getByRole('button',{name:'Je confirme ma présence'}).click();await page.getByText('Votre participation est confirmée.').waitFor();assert.equal(guests[0].rsvp,'confirmed');await page.getByAltText('QR code personnel de l’invité').waitFor();await page.getByText('7 minutes · 4 slides recommandées').waitFor();assert.equal(await page.locator('.materials').count(),0);assert.doesNotMatch(await page.locator('#invite').innerText(),/transmettez votre support|avant vendredi 27 novembre/i);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'Guest RSVP overflow');assert.deepEqual(errors,[]);
  await page.screenshot({path:'browser-review/guest-rsvp-'+viewport.width+'.png',fullPage:true});await context.close();console.log('Guest invitation and RSVP verified:',viewport.width,'px');
 }
}finally{await browser.close()}
