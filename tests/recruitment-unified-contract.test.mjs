import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
test('Preserve form name, PDF upload and direct CV route',()=>{assert.match(read('public/__forms.html'),/hns-ai-candidates-2026/);assert.match(read('public/index.html'),/name="cv" type="file"/);assert.match(read('public/admin.js'),/\/\.netlify\/functions\/candidate-cv/);});
test('All RH invitations use the unified API; legacy endpoint cannot send',()=>{const admin=read('public/admin.js');assert.match(admin,/rh-pass-preview/);assert.match(admin,/rh-pass-send/);assert.match(admin,/recruitment-status/);assert.doesNotMatch(admin,/action:'invite'/);assert.doesNotMatch(read('netlify/functions/candidates-admin.mjs'),/await sendMail/);});
test('Preserve existing store and CV form identifier',()=>{assert.match(read('netlify/functions/_utils.mjs'),/hns-ai-recruitment-2026/);assert.match(read('netlify/functions/candidate-cv.mjs'),/6af0f91202bfb9a6322bb546/);});
