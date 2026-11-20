import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { openDocument } from '../src/editor-document.js';
import { transferRig } from '../src/anim-transfer.js';
import { transplantSkeleton, mirrorModel } from '../src/skeleton-transplant.js';
import { gradeMotion } from '../scripts/xfer-review/ruler.mjs';

const { testModel } = createRequire(import.meta.url)('./helpers/fixtures.cjs');
const fixture = name => testModel((name.includes('__') ? 'corpus-sd/' : 'transfer-astra-r1/') + name + '.mdx');
function check(ownName, donorName, label, verify) {
  const files = [ownName, donorName].map(fixture);
  test(label, { skip: files.some(f => !fs.existsSync(f)) ? 'private transfer fixture unavailable' : false }, () => {
    const [own, donor] = files.map(file => openDocument(new Uint8Array(fs.readFileSync(file)),file).model);
    const a = transferRig(own), b = transferRig(donor);
    const mirror = !!(a.weaponSide && b.weaponSide && a.weaponSide !== b.weaponSide);
    const made = transplantSkeleton(own, donor, {mirror, extents:false});
    const scores = gradeMotion(own, mirror ? mirrorModel(donor) : donor, made.model, made.report);
    verify(scores, made);
  });
}
check('creeps__wareagle', 'creeps__harpy', 'Eagle wing skin takes the branching Harpy wingbeat', ({metrics}) => {
  assert.ok(metrics.donorFlap > 0.12);
  assert.ok(metrics.resultFlap > 0.16 * metrics.donorFlap, JSON.stringify(metrics));
});
for (const [own, donor, problem] of [
  ['stormvermin7', 'creeps__razormane', 'distal-weapon'],
  ['creeps__tuskarranged', 'Greenskin_Orc3', 'weapon-visibility'],
  ['skink_javelin_orange', 'creeps__firepandarenbrewmaster', 'grip'],
  ['creeps__highelfarcher', 'orc__headhunter', 'projectile'],
  ['nightelf__archer', 'orc__herotaurenchieftain', 'projectile'],
  ['handgunner_arquebus', 'WH_DOC_Demonette9_1', 'jitter'],
  ['creeps__thunderlizard', 'nightelf__huntress', 'head'],
]) {
  check(own, donor, own + ' on ' + donor + ' clears ' + problem, ({reasons,metrics}) => {
    assert.ok(!reasons.includes(problem), JSON.stringify({reasons, metrics}));
  });
}
