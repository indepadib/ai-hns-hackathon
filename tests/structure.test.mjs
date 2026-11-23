import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('La page Mission Control existe et charge une feuille CSS locale',()=>{
 const html=readFileSync(new URL('../public/mission-control/index.html',import.meta.url),'utf8');
 assert.match(html,/mission-control\/style\.css/);
 assert.doesNotMatch(html,/fonts\.googleapis\.com/);
});
test('Les secrets ne sont pas fixés dans les sources du backend',()=>{
 const code=readFileSync(new URL('../netlify/functions/mission.mjs',import.meta.url),'utf8');
 for(const key of ['HNS_ADMIN_KEY','HNS_RH_KEY','HNS_JURY_KEY','HNS_SESSION_SECRET'])assert.match(code,new RegExp('process\\.env\\.'+key));
 assert.match(code,/role/);
});
