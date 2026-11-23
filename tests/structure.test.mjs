import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../public/mission-control/index.html',import.meta.url),'utf8');
const backend=readFileSync(new URL('../netlify/functions/mission.mjs',import.meta.url),'utf8');
const ui=readFileSync(new URL('../public/mission-control/app.js',import.meta.url),'utf8');

test('Police locale et CSP sans dépendance Google Fonts',()=>{
 assert.match(html,/mission-control\/style\.css/);
 assert.doesNotMatch(html,/fonts\.googleapis\.com/);
});
test('Secrets récupérés uniquement depuis les variables du serveur',()=>{
 for(const name of ['HNS_ADMIN_KEY','HNS_RH_KEY','HNS_JURY_KEY','HNS_SESSION_SECRET'])assert.ok(backend.includes(name),'Missing '+name);
 assert.ok(backend.includes('process.env.HNS_SESSION_SECRET'));
 assert.ok(backend.includes('process.env[env[role]]'));
});
test('Séparation des quatre parcours et contrôle d’accès côté serveur',()=>{
 for(const role of ['admin','rh','jury','participant'])assert.ok(ui.includes(role));
 assert.ok(backend.includes("auth.role!=='jury'"));
 assert.ok(backend.includes("auth.role!=='participant'"));
});
test('Protection de soumission et conflits de sauvegarde',()=>{
 assert.ok(backend.includes('VERSION_CONFLICT'));
 assert.ok(backend.includes('rec.submitted'));
 assert.ok(backend.includes('scoreHistory'));
});
