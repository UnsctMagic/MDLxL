// Two-hand grip (docs/agent-tasks/xfer-fable-plan.md, step 7): the other hand onto the weapon in the animations where the
// donor holds its weapon with both hands. Owner on the Elf Death Knight (reasonable-08): two-handed weapon, fists crossed.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { Vector3 } from 'three';
import { openDocument } from '../src/editor-document.js';
import { sampleNodeMatrices, skinGeoset } from '../src/animation.js';
import { transferRig } from '../src/anim-transfer.js';
import { standSequenceIndex } from '../src/sequence-editor.js';
import { transplantSkeleton } from '../src/skeleton-transplant.js';
import { readWeapon, secondHandShare } from '../src/transplant-weapon-seat.js';
import { secondHandGains } from '../src/xfer-suggest-toggles.js';

const { fixturePath } = createRequire(import.meta.url)('./helpers/fixtures.cjs');
const missing = ['xfer-r08-own', 'xfer-r08-donor'].some(key => !fs.existsSync(fixturePath(key))) ? 'XFER reasonable models unavailable' : false;
const load = key => { const file = fixturePath(key); return openDocument(fs.readFileSync(file), file).model; };
const OPTIONS = { events: true, emitters: false, keep: [], mirror: false };
// reasonable-08's suggested ticks (Rest pose fit, Smooth feet, Keep own torso).
const TICKS = { skinLandmarks: true, trackWindow: true, keepTorso: true };

test('Footman Leader onto the Elf Death Knight with Two-hand grip: the left hand holds the sword in Attack - 1, the right hand is untouched', { skip: missing }, () => {
  const own = load('xfer-r08-own'), donor = load('xfer-r08-donor');
  const without = transplantSkeleton(own, donor, { ...OPTIONS, autoFix: TICKS }).model;
  const withGrip = transplantSkeleton(own, donor, { ...OPTIONS, autoFix: { ...TICKS, surfaceGrip: true } }).model;
  const attack = model => secondHandShare(own, donor, model)?.clips.find(clip => clip.name === 'Attack - 1')?.share ?? 0;
  const before = attack(without), after = attack(withGrip);
  assert.ok(after >= .8, `with Two-hand grip the left palm is on the sword in ${after.toFixed(2)} of Attack - 1 (wanted 0.8)`);
  assert.ok(before < .8, `without it ${before.toFixed(2)}`);
  // The right (main) hand's palm is where it was in every moment of Attack - 1.
  const main = readWeapon(own, transferRig(own, { sequence: Math.max(0, standSequenceIndex(own)) })).items[0].hand;
  const palm = (model, frame, si) => { const world = sampleNodeMatrices(model, frame, si), skin = new Map(); return main.patch.reduce((sum, { gi, v }) => { if (!skin.has(gi)) skin.set(gi, skinGeoset(model.Geosets[gi], world)); return sum.add(new Vector3().fromArray(skin.get(gi), 3 * v)); }, new Vector3()).divideScalar(main.patch.length); };
  const si = without.Sequences.findIndex(s => s.Name.trim() === 'Attack - 1'), [a, z] = without.Sequences[si].Interval;
  for (let k = 0; k <= 8; k++) {
    const frame = Math.round(a + (z - a) * k / 8);
    assert.ok(palm(without, frame, si).distanceTo(palm(withGrip, frame, si)) < 1e-3 * main.arm.length, `right palm moved at ${frame}`);
  }
});

test('Seat weapon on the Footman Leader / Elf Death Knight: Seat\'s own second hand still needs a donor two-handed in Stand', { skip: missing }, () => {
  const own = load('xfer-r08-own'), donor = load('xfer-r08-donor');
  const seated = transplantSkeleton(own, donor, { ...OPTIONS, autoFix: { ...TICKS, seatWeapon: true } }).report.autoFix?.seatWeapon || [];
  assert.ok(seated.length, 'Seat acted');
  assert.ok(seated.every(item => !item.support), `no second hand from Seat: ${JSON.stringify(seated.map(item => item.support ?? null))}`);
});

// Plan decision 23: a strong gain in one two-handed animation also counts, as long as no two-handed animation loses much.
test('secondHandGains on reasonable-08\'s readings: Attack - 1 rises 0.32, nothing falls by more than 0.1: suggested', () => {
  const reading = (share, clips) => ({ share, clips: clips.map(([name, donorOn, value]) => ({ name, donorOn, share: value })) });
  const without = reading(.866, [['Attack - 1', 1, .579], ['Attack - 2', 1, .71], ['Attack Slam', 1, .97], ['Attack Walk Stand Spin 1', .52, .86], ['Spell', .24, 1]]);
  const withGrip = reading(.960, [['Attack - 1', 1, .895], ['Attack - 2', 1, 1], ['Attack Slam', 1, .95], ['Attack Walk Stand Spin 1', .52, .79], ['Spell', .24, .4]]);
  assert.equal(secondHandGains(without, withGrip), true, 'overall +0.094, Attack - 1 +0.316');
  // A two-handed animation falling by more than 0.1 stops it (Spell is not two-handed: its fall does not count).
  assert.equal(secondHandGains(without, reading(.960, [['Attack - 1', 1, .895], ['Attack - 2', 1, 1], ['Attack Slam', 1, .80], ['Attack Walk Stand Spin 1', .52, .79]])), false);
  // Neither 0.1 overall nor 0.2 in one animation.
  assert.equal(secondHandGains(without, reading(.90, [['Attack - 1', 1, .70], ['Attack - 2', 1, .80], ['Attack Slam', 1, .97], ['Attack Walk Stand Spin 1', .52, .86]])), false);
  // 0.1 overall alone, as before.
  assert.equal(secondHandGains(reading(0, [['Attack - 1', 1, 0]]), reading(.61, [['Attack - 1', 1, .61]])), true);
  // No animation where the donor holds with both hands: never.
  assert.equal(secondHandGains(reading(0, [['Spell', .2, 0]]), reading(.9, [['Spell', .2, .9]])), false);
});
