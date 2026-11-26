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
 for(const viewport of [{width:390,height:844},{width:1440,height:900}]){
  const context=await browser.newContext({viewport,acceptDownloads:true}),page=await context.newPage(),errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  const stages=['checkin','briefing','matching','challenge','problem','solution','build','redteam','pitch','submission'].map((id,i)=>({id,label:id,opensAt:i,unlocked:true}));
  let workspace={},version=0;
  await page.route('**/api/mission',async route=>{
   const req=route.request();let out={},status=200;
   if(req.method()==='GET')out={service:'hns-mission'};
   else{const body=req.postDataJSON();switch(body.action){
    case 'me':out={role:'participant'};break;
    case 'schedule':out={now:Date.now(),stages};break;
    case 'matching-list':out={people:[],choice:'solo',team:null};break;
    case 'load':out={workspace,version,submitted:false};break;
    case 'save':workspace=body.workspace;out={version:++version};break;
    default:status=400;out={error:'Unexpected mock request '+body.action};
   }}
   await route.fulfill({status,json:out});
  });
  await page.addInitScript(()=>{sessionStorage.setItem('hns_mission_token','synthetic-participant');sessionStorage.setItem('hns_mission_role','participant')});
  await page.goto(base+'/mission-control/');
  await page.locator('.flight-plan').waitFor();
  // Exercise the actual participant pages, not only the public discovery screen.
  assert.equal(await page.locator('.day-j-card').isVisible(),true);
  async function openMission(id){
   if(viewport.width<=800&&!(await page.locator('[data-mission="'+id+'"]').isVisible()))await page.locator('#mobile-mission-toggle').click();
   await page.locator('[data-mission="'+id+'"]').click();
  }
  await openMission('checkin');await page.getByRole('heading',{name:'Votre accueil, sans temps perdu'}).waitFor();
  await page.locator('.day-j-card input[type="checkbox"]').first().check();assert.match(await page.locator('.day-j-card .dayj-tile').first().innerText(),/1 \/ 6/);const playLink=page.locator('.day-j-card a[href="/mission-control/play/"]');assert.equal(await playLink.getAttribute('target'),'_blank');const beforeVersion=version;const gamePromise=context.waitForEvent('page');await playLink.click();const game=await gamePromise;await game.waitForLoadState('domcontentloaded');await game.locator('.hub-hero').waitFor();assert.equal(await game.evaluate(()=>window.opener===null),true);assert.equal(await game.evaluate(()=>sessionStorage.getItem('hns_mission_token')),null);await game.close();assert.equal(await page.locator('.day-j-card input[type="checkbox"]').first().isChecked(),true);assert.equal(version,beforeVersion);
  await openMission('briefing');await page.getByRole('heading',{name:'Briefing : les règles du jeu'}).waitFor();assert.equal(await page.locator('.day-j-card input[type="checkbox"]').count(),6);
  await page.getByRole('button',{name:'Un problème précis et un utilisateur',exact:true}).click();assert.match(await page.locator('.day-j-card .dayj-feedback').innerText(),/Bonne réponse/);
  await page.locator('#mission-home').click();
  console.log('Participant checkin and briefing verified:',viewport.width,'px');
  assert.match(await page.locator('.flight-total strong').innerText(),/0\/6/);
  assert.equal(await page.locator('.welcome-next strong').innerText(),'challenge');
  await page.locator('#home-resume').click();
  await page.locator('[data-vertical="retail"]').click();await page.locator('[data-challenge="availability"]').click();
  await page.locator('#mission-home').click();
  assert.match(await page.locator('.flight-total strong').innerText(),/1\/6/);
  assert.equal(await page.locator('.welcome-next strong').innerText(),'problem');
  await page.locator('.flight-grid [data-home-mission="build"]').click();
  await page.locator('#starter-code').waitFor();
  const download=page.waitForEvent('download');await page.locator('#starter-code').click();assert.equal((await download).suggestedFilename(),'starter.py');
  await page.locator('.starter-kit summary').click();
  assert.match(await page.locator('.starter-source').innerText(),/def predict\(row\):/);
  const layout=await page.evaluate(()=>({viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('main *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1&&e.getBoundingClientRect().width>0&&!e.closest('.lab-table,.starter-source,.explore-tables,.demo-track')).slice(0,12).map(e=>({tag:e.tagName,cls:String(e.className).slice(0,100),right:Math.round(e.getBoundingClientRect().right)}))}));console.log('Participant layout',JSON.stringify(layout));assert.ok(layout.scrollWidth<=layout.viewport+1,'Participant horizontal overflow: '+JSON.stringify(layout));
  assert.deepEqual(errors,[]);
  await page.screenshot({path:'browser-review/starter-'+viewport.width+'.png',fullPage:true});
  await page.locator('#mission-home').click();await page.locator('.flight-grid [data-home-mission="challenge"]').click();await page.locator('[data-vertical="logistics"]').click();assert.equal(await page.locator('[data-challenge="availability"]').count(),0);assert.equal(await page.locator('[data-challenge]').count(),8);page.once('dialog',d=>d.accept());await page.locator('[data-challenge="delivery-risk"]').click();await page.locator('#mission-home').click();await page.locator('.flight-grid [data-home-mission="build"]').click();await page.locator('#starter-code').waitFor();assert.match(await page.locator('.data-hero').innerText(),/La Voie Express/i);assert.equal(await page.locator('[data-explore-table="shipments_train"]').count(),1);assert.equal(await page.locator('[data-explore-table="inventory_daily"]').count(),0);const sectorDownload=page.waitForEvent('download');await page.locator('#starter-input').click();assert.equal((await sectorDownload).suggestedFilename(),'hns-delivery-risk-evaluation-inputs.csv');assert.deepEqual(errors,[]);await page.screenshot({path:'browser-review/sector-'+viewport.width+'.png',fullPage:true});console.log('Sector challenge and isolated Data Lab verified:',viewport.width,'px');
  await page.locator('#mission-home').click();await page.locator('.flight-grid [data-home-mission="challenge"]').click();await page.locator('[data-vertical="group"]').click();
  await page.locator('#custom-challenge-form').locator('..').locator('summary').click();
  const custom=page.locator('#custom-challenge-form');
  await custom.locator('[name=title]').fill('Assistant RH fictif');await custom.locator('[name=domain]').fill('RH');await custom.locator('[name=problem]').fill('Les collaborateurs ne trouvent pas les procédures internes fictives.');await custom.locator('[name=idea]').fill('Un assistant avec des références aux documents.');await custom.locator('[name=approach]').selectOption('LLM / RAG');
  page.once('dialog',d=>d.accept());await custom.locator('button[type=submit]').click();
  assert.match(await page.locator('#custom-status').innerText(),/Sujet libre sélectionné/);
  await page.locator('#mission-home').click();assert.match(await page.locator('.home-status').innerText(),/Assistant RH fictif/);
  await page.locator('.flight-grid [data-home-mission="build"]').click();assert.match(await page.locator('.data-hero').innerText(),/propres exemples/);assert.match(await page.locator('.studio-orientation').innerText(),/Build Sprint/);
  await page.locator('#learn-next').click();assert.match(await page.locator('#learn-position').innerText(),/2 \/ 3/);assert.deepEqual(errors,[]);

  await context.close();console.log('Participant Flight Plan and Starter verified:',viewport.width,'px');
 }
 for(const viewport of [{width:390,height:844},{width:1440,height:900}]){
  const context=await browser.newContext({viewport}),page=await context.newPage(),errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  const rows=[{id:'a'.repeat(32),alias:'Projet fictif Alpha',submittedAt:'2026-11-28T16:00:00Z',score:null},{id:'b'.repeat(32),alias:'Projet fictif Beta',submittedAt:'2026-11-28T16:01:00Z',score:null}];
  const workspace={challenge:{id:'availability'},problem:{summary:'Synthetic problem'},solution:{summary:'Synthetic solution'},submission:{result:'Synthetic demo'}};
  await page.route('**/api/mission',async route=>{
   const req=route.request();let out={},status=200;
   if(req.method()==='GET')out={service:'hns-mission'};
   else{const body=req.postDataJSON();switch(body.action){
    case 'me':out={role:'jury'};break;
    case 'jury-list':out={participants:rows};break;
    case 'jury-dossier':out={...rows.find(x=>x.id===body.id),workspace};break;
    case 'jury-score':{const row=rows.find(x=>x.id===body.id);assert.equal(body.expectedScoredAt,null);row.score={scores:body.scores,total:79.5,scoredAt:new Date().toISOString()};out={score:row.score};break}
    default:status=400;out={error:'Unexpected jury request '+body.action};
   }}
   await route.fulfill({status,json:out});
  });
  await page.addInitScript(()=>{sessionStorage.setItem('hns_mission_token','synthetic-jury');sessionStorage.setItem('hns_mission_role','jury')});
  await page.goto(base+'/mission-control/');
  await page.locator('[data-dossier]').first().click();
  await page.locator('#scoring').waitFor();
  for(const [k,v] of Object.entries({problem:80,design:70,build:90,test:60,demo:100}))await page.locator('#score-'+k).fill(String(v));
  assert.equal(await page.locator('#jury-total').innerText(),'79.5/100');
  await page.locator('#scoring button[value="next"]').click();
  await page.locator('.jury-dossier-heading h2').filter({hasText:'Projet fictif Beta'}).waitFor();
  assert.equal(rows[0].score.total,79.5);assert.equal(rows[1].score,null);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'Jury overflow');
  assert.deepEqual(errors,[]);
  await page.screenshot({path:'browser-review/jury-'+viewport.width+'.png',fullPage:true});
  await context.close();console.log('Jury evaluation and next project verified:',viewport.width,'px');
 }
 for(const viewport of [{width:390,height:844},{width:1440,height:900}]){
  const context=await browser.newContext({viewport,acceptDownloads:true}),page=await context.newPage(),errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  const id='a'.repeat(32),person={id,alias:'Participant fictif Alpha',count:1,dimensions:['data'],followup:'none'};
  const project={id,alias:'Projet fictif Alpha',members:[{id,alias:person.alias}],challenge:'availability',submitted:true,score:{total:79.5},rank:1,documented:6,holdout:null};
  await page.route('**/api/mission',async route=>{
   const req=route.request();let out={},status=200;
   if(req.method()==='GET')out={service:'hns-mission'};
   else{const body=req.postDataJSON();switch(body.action){
    case 'me':out={role:'admin'};break;
    case 'staff-list':out={participants:[],sendEnabled:false};break;
    case 'schedule':out={now:Date.now(),stages:[]};break;
    case 'team-dashboard':out={teams:[]};break;
    case 'final-results':out={generatedAt:new Date().toISOString(),projects:[project],people:[person],metrics:{projects:1,submitted:1,scored:1,pending:0,holdout:0,present:1,observed:1,followups:0},provisional:false};break;
    default:status=400;out={error:'Unexpected admin request '+body.action};
   }}
   await route.fulfill({status,json:out});
  });
  await page.addInitScript(()=>{sessionStorage.setItem('hns_mission_token','synthetic-admin');sessionStorage.setItem('hns_mission_role','admin')});
  await page.goto(base+'/mission-control/');
  await page.locator('#final-open').click();await page.locator('.final-project h3').waitFor();
  assert.equal(await page.locator('.final-rank').innerText(),'#1');
  await page.locator('[data-final-view="people"]').click();
  assert.equal(await page.locator('.final-person h3').innerText(),person.alias);
  assert.equal(await page.locator('.final-rank').count(),0);
  page.once('dialog',dialog=>dialog.accept());const download=page.waitForEvent('download');await page.locator('#final-export').click();assert.equal((await download).suggestedFilename(),'hns-restitution-confidentielle.json');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'Admin overflow');
  assert.deepEqual(errors,[]);
  await page.screenshot({path:'browser-review/final-'+viewport.width+'.png',fullPage:true});
  await context.close();console.log('Final restitution and confidential export verified:',viewport.width,'px');
 }
}finally{await browser.close()}
