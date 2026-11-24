import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const js=readFileSync('public/mission-control/app.js','utf8'),css=readFileSync('public/mission-control/style.css','utf8');
test('Arrival express separates front desk from access management',()=>{
 for(const id of ['arrival-focus','arrival-manage','arrival-feedback','arrival-present','arrival-recent-list','arrival-refresh','manual-checkin','scan-start'])assert.ok(js.includes('id="'+id+'"'),id);
 assert.match(css,/\.arrival-mode \.staff-people/);assert.match(css,/\.management-mode \.scanner-card/);
 assert.match(js,/arrivalMode=true/);assert.match(js,/arrived\.slice\(0,5\)/);
});
test('Scan paths share authenticated confirmation and camera lifecycle',()=>{
 assert.match(js,/const checkin=async code/);assert.match(js,/await api\('scan-invitation',\{code\}\)/);
 assert.match(js,/await checkin\(code\)/);assert.match(js,/if\(document\.hidden\)\{stop\(\);break\}/);
 assert.match(js,/stream\?\.getTracks\(\)\.forEach\(t=>t\.stop\(\)\)/);
 assert.match(js,/if\(scanBusy\|\|mailBusy\)return/);
});
