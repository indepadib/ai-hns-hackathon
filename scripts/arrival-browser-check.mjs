import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({headless:true});
const base='http://127.0.0.1:8765',code='A'.repeat(24);
await mkdir('browser-review',{recursive:true});
try{
 for(const viewport of [{width:390,height:844},{width:1440,height:900}]){
  const context=await browser.newContext({viewport});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',err=>errors.push(err.message));
  const people=[{id:'a'.repeat(32),alias:'Candidat fictif Alpha',status:'invited',rsvp:'confirmed',mailStatus:'accepted'},{id:'b'.repeat(32),alias:'Candidat fictif Beta',status:'active',rsvp:'confirmed',checkedInAt:'2026-11-28T09:05:00Z',mailStatus:'accepted'}];
  let scans=0;
  await page.route('**/api/mission',async route=>{
   const req=route.request();let out={};let status=200;
   if(req.method()==='GET')out={service:'hns-mission'};
   else{const body=req.postDataJSON();switch(body.action){
    case 'me':out={role:'rh'};break;
    case 'staff-list':out={participants:people,sendEnabled:true};break;
    case 'scan-invitation':{
      scans++;if(body.code!==code){status=404;out={error:'Invitation inconnue'};break}
      const p=people[0],alreadyPresent=p.status==='active';p.status='active';p.checkedInAt='2026-11-28T09:10:00Z';out={id:p.id,alias:p.alias,checkedInAt:p.checkedInAt,alreadyPresent};break
    }
    default:status=400;out={error:'Unexpected synthetic request'};
   }}
   await route.fulfill({status,json:out});
  });
  await page.addInitScript(()=>{sessionStorage.setItem('hns_mission_token','synthetic-test-token');sessionStorage.setItem('hns_mission_role','rh')});
  await page.goto(base+'/mission-control/');
  await page.locator('#arrival-focus').waitFor();
  assert.equal(await page.locator('#staff-search').isVisible(),false);
  assert.equal(await page.locator('#scan-start').isVisible(),true);
  await page.locator('#manual-code').fill(code);await page.locator('#manual-checkin button').click();
  await page.getByText('Bienvenue, Candidat fictif Alpha !').waitFor();
  assert.match(await page.locator('#arrival-present').innerText(),/2\s*\/ 50/);
  assert.equal(scans,1);
  await page.locator('#manual-code').fill(code);await page.locator('#manual-checkin button').click();
  await page.getByText('Déjà enregistré',{exact:true}).waitFor();
  assert.match(await page.locator('#arrival-present').innerText(),/2\s*\/ 50/);
  await page.locator('#arrival-manage').click();
  assert.equal(await page.locator('#staff-search').isVisible(),true);
  assert.equal(await page.locator('#scan-start').isVisible(),false);
  await page.locator('#arrival-focus').click();
  await page.locator('#manual-code').fill('B'.repeat(24));await page.locator('#manual-checkin button').click();
  await page.getByText('Pass non validé',{exact:true}).waitFor();
  assert.match(await page.locator('#arrival-present').innerText(),/2\s*\/ 50/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true,'Horizontal overflow');
  assert.deepEqual(errors,[]);
  await page.screenshot({path:'browser-review/arrival-'+viewport.width+'.png',fullPage:true});
  await context.close();
  console.log('Arrival express verified:',viewport.width,'px');
 }
}finally{await browser.close()}
