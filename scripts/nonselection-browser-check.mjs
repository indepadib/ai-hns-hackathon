import {chromium} from 'playwright';import assert from 'node:assert/strict';import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({headless:true}),base='http://127.0.0.1:8765';await mkdir('browser-review',{recursive:true});
try{for(const viewport of [{width:390,height:844},{width:1440,height:900}]){
 const context=await browser.newContext({viewport}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const records=[['a','Non retenu fictif','rejected'],['b','Protégé fictif','rejected'],['c','Présélection fictive','interview'],['d','Sélection fictive','selected']].map(([id,name,status])=>({id:id.repeat(64),name,status,email:id+'@example.invalid',track:'Retail',createdAt:'2026-11-20T00:00:00Z',triage:{score:50}}));let sent=0,previews=0,accepted=false;
 await page.route('**/.netlify/functions/candidates-admin',route=>route.fulfill({json:{records}}));
 await page.route('**/api/mission',async route=>{const b=route.request().postDataJSON();let out;switch(b.action){
 case 'recruitment-status':out={entries:[{candidateId:records[3].id,passStatus:'not_prepared',mailStatus:'not_sent',rsvp:'pending'}]};break;
 case 'gmail-status':out={connected:true,testedAt:'2026-11-20',sendEnabled:true,email:'recrutement@hns.ma'};break;
 case 'rh-nonselection-status':assert.deepEqual(b.ids,[records[0].id,records[1].id]);out={enabled:true,entries:[{id:records[0].id,state:accepted?'accepted':'ready'},{id:records[1].id,state:'protected',blocker:'Pass existant'}]};break;
 case 'rh-nonselection-preview':assert.equal(b.candidateId,records[0].id);previews++;out={email:records[0].email,mail:{subject:'L’aventure continue !',text:'Un deuxième hackathon est prévu.'}};break;
 case 'rh-nonselection-send':assert.equal(b.candidateId,records[0].id);assert.equal(b.confirm,true);sent++;accepted=true;out={mailStatus:'accepted'};break;
 default:throw Error('Unexpected action '+b.action);
 }await route.fulfill({json:out})});
 await page.goto(base+'/admin-recrutement.html');await page.locator('#adminKey').fill('synthetic-only-token-'.repeat(3));await page.locator('#loginForm button').click();await page.locator('#gmailStatus').getByText(/Test accepté par Gmail/).waitFor();await page.locator('#openNonselection').click();await page.locator('#nsRows article').first().waitFor();
 assert.equal(await page.locator('#nsRows article').count(),2);assert.equal(await page.locator('#nsRows input').nth(1).isDisabled(),true);
 await page.locator('#nsSelect').click();assert.equal(await page.locator('#nsSend').isDisabled(),true);await page.locator('#nsRows button').click();await page.locator('#nsPreview').waitFor();assert.equal(previews,1);assert.equal(sent,0);assert.equal(await page.locator('#nsRows input').nth(1).isDisabled(),true);
 await page.screenshot({path:'browser-review/nonselection-'+viewport.width+'.png',fullPage:true});
 page.once('dialog',d=>d.accept());await page.locator('#nsSend').click();await page.locator('#nonselectionStatus').getByText(/1 accepté/).waitFor();assert.equal(sent,1);assert.equal(await page.locator('#nsSend').isDisabled(),true);assert.deepEqual(errors,[]);await context.close();console.log('Non-selection candidate communication verified:',viewport.width,'px');
}}finally{await browser.close()}
