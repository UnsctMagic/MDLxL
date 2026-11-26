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
