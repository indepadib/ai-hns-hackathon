import {chromium} from 'playwright';import assert from 'node:assert/strict';import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({headless:true});await mkdir('browser-review',{recursive:true});const id='a'.repeat(32),code='HNST:'+'A'.repeat(32)+':'+'B'.repeat(32);
try{for(const viewport of [{width:390,height:844},{width:1440,height:900}]){
 const context=await browser.newContext({viewport}),page=await context.newPage(),errors=[];let saved=[],profileReads=0;page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/mission',async route=>{const b=route.request().postDataJSON();let out={},status=200;switch(b.action){
 case 'scout-login':assert.equal(b.code,'synthetic-code');out={token:'mentor-session',role:'mentor'};break;
 case 'scout-session':out={role:'mentor',name:'Mentor fictif'};break;
 case 'scout-directory':out={people:[{id,alias:'Candidat fictif',present:true,count:saved.length,ownCount:saved.length}]};break;
 case 'scout-scan':assert.equal(b.code,code);profileReads++;case 'scout-profile':out={id,alias:'Candidat fictif',school:'École fictive',team:'Équipe 01',challenge:'stock',vertical:'retail',problem:'Ruptures en magasin',signals:{documented:3},notes:saved,count:saved.length};break;
 case 'scout-observe':assert.equal(b.id,id);assert.equal(b.observation.level,'3');assert.match(b.observation.fact,/contribution/);saved.push({...b.observation,observer:'Mentor fictif',at:'2026-11-28T12:00:00Z'});out={saved:true};break;
 default:status=400;out={error:'Action imprévue '+b.action}}
 await route.fulfill({status,json:out})});
 await page.goto('http://127.0.0.1:8765/scout/');await page.getByLabel('Code ou clé').fill('synthetic-code');await page.getByRole('button',{name:'Se connecter'}).click();await page.getByRole('heading',{name:'Bonjour, Mentor fictif'}).waitFor();await page.getByLabel('Code de secours').fill(code);await page.getByRole('button',{name:'Ouvrir le code'}).click();await page.getByRole('heading',{name:'Candidat fictif'}).waitFor();assert.equal(profileReads,1);await page.getByLabel('Niveau constaté (facultatif)').selectOption('3');await page.getByLabel('Fait observé / contribution personnelle').fill('A montré sa contribution personnelle et son test.');await page.getByRole('button',{name:'Enregistrer l’observation'}).click();await page.getByText('Observation enregistrée.',{exact:true}).waitFor();assert.equal(saved.length,1);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.deepEqual(errors,[]);await page.screenshot({path:'browser-review/scout-'+viewport.width+'.png',fullPage:true});await context.close();console.log('Scout observation verified: '+viewport.width+'px')
}}finally{await browser.close()}
