import test from 'node:test';import assert from 'node:assert/strict';import '../public/mission-control/verticals.js';
test('MRB official open briefs are selectable without synthetic benchmark or changing existing catalog IDs',()=>{
 const v=globalThis.HNSVerticals;assert.equal(v.openBriefs.length,2);assert.equal(v.openBriefs[0].priority,true);
 for(const b of v.openBriefs){assert.equal(v.verticalFor(b.id),'retail');assert.equal(v.customVertical(b.id),'retail');assert.equal(v.get(b.id),null);assert.equal(v.validateCustom(b.id,{}).title,b.title);assert.equal(v.openCustom(b.id).vertical,'retail');assert.match(b.deliverable,/30 %.*30 %.*20 %.*20 %/);assert.match(b.data,/Aucun jeu de données réel/)}
 assert.equal(v.verticalFor('availability'),'retail');assert.equal(v.customVertical('custom-retail'),'retail');assert.equal(v.openBrief('availability'),null);
 assert.match(v.openBrief('mrb-maalem-parcours').metric,/10 h\/semaine/);
});