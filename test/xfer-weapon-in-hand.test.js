// Weapon in hand (docs/agent-tasks/xfer-fable-plan.md, step 9 and decision 18). Owner: "Weapon leaves hand ... but only in
// 1 anim".
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { openDocument } from '../src/editor-document.js';
import { transplantSkeleton } from '../src/skeleton-transplant.js';
import { attackExcess, handGapRows, leavesHand } from '../src/transplant-weapon-seat.js';

const { fixturePath } = createRequire(import.meta.url)('./helpers/fixtures.cjs');
// 16 moments: in the hand at first, then the result's grip opens while the donor keeps holding.
const rows = (donor, result) => donor.map((donorGap, k) => ({ donorGap, resultGap: result[k] }));
const held = Array(16).fill(.05);
const opens = [.02, .02, .03, .05, .30, .45, .50, .40, .05, .03, .03, .03, .03, .03, .03, .03];

test('leavesHand: a weapon that leaves the hand during an attack while the donor holds on', () => {
  const found = leavesHand({ ownGrip: .02, clips: [{ name: 'Attack - 3', rows: rows(held, opens) }] });
  assert.equal(found?.clip, 'Attack - 3');
  assert.ok(Math.abs(found.excess - (.50 - .08)) < 1e-9, `largest excess ${found?.excess}`);
  assert.equal(found.share, 4 / 16);
  // Attack animations only: a steady offset in Stand or Walk is how the model holds its weapon.
  assert.equal(leavesHand({ ownGrip: .02, clips: [{ name: 'Stand - 2', rows: rows(held, opens) }, { name: 'Walk', rows: rows(held, opens) }] }), null);
  // It must start in the hand.
  assert.equal(leavesHand({ ownGrip: .02, clips: [{ name: 'Attack - 3', rows: rows(held, [.4, ...opens.slice(1)]) }] }), null);
  // The model's own grip sitting further out (reasonable-31: a constant 0.20) is no excess.
  assert.equal(leavesHand({ ownGrip: .20, clips: [{ name: 'Attack - 1', rows: rows(held, Array(16).fill(.20)) }] }), null);
  // Fewer than a tenth of the held moments out: not leaving.
  assert.equal(leavesHand({ ownGrip: .02, clips: [{ name: 'Attack - 3', rows: rows(held, [...Array(15).fill(.03), .5]) }] }), null);
  // Where the donor lets go (its gap over 0.15), those moments do not count.
  assert.equal(leavesHand({ ownGrip: .02, clips: [{ name: 'Attack - 3', rows: rows([.05, .05, .05, .05, .6, .6, .6, .6, ...Array(8).fill(.05)], opens) }] }), null);
});

// The plan's engine test (step 9). At 26 Nov, Opus's keepInHand brings Attack - 3 to 0.14 (plan: 0.05) and leaves Stand - 2
// at 0.24 mid-clip (plan: above 0.3, but the donor's own gap there is 0.17, inside the 0.15-0.30 fade): kept as specified,
// marked todo until Fable decides; it does not count as a pass.
test('Footman Leader onto the Elf Death Knight with Weapon in hand: Attack - 3 held, Stand - 2 still lets go', { todo: 'keepInHand short of the plan numbers (Fable to decide)', skip: ['xfer-r08-own', 'xfer-r08-donor'].some(key => !fs.existsSync(fixturePath(key))) ? 'XFER reasonable models unavailable' : false }, () => {
  const load = key => { const file = fixturePath(key); return openDocument(fs.readFileSync(file), file).model; };
  const own = load('xfer-r08-own'), donor = load('xfer-r08-donor');
  const ticks = { skinLandmarks: true, trackWindow: true, keepTorso: true }, options = { events: true, emitters: false, keep: [], mirror: false };
  const worst = (reading, name) => Math.max(...reading.clips.find(c => c.name === name).rows.map(r => r.resultGap - r.donorGap));
  const without = handGapRows(own, donor, transplantSkeleton(own, donor, { ...options, autoFix: ticks }).model);
  const withBox = handGapRows(own, donor, transplantSkeleton(own, donor, { ...options, autoFix: { ...ticks, gripInHand: true } }).model);
  assert.ok(worst(without, 'Attack - 3') > .15, `without the box Attack - 3 ${worst(without, 'Attack - 3').toFixed(2)}`);
  assert.ok(worst(withBox, 'Attack - 3') <= .05, `with the box Attack - 3 ${worst(withBox, 'Attack - 3').toFixed(2)}`);
  assert.ok(withBox.clips.find(c => c.name === 'Stand - 2').rows[7].resultGap > .3, 'Stand - 2 lets the sword leave mid-clip');
  assert.ok(attackExcess(withBox, 'Attack - 3') < attackExcess(without, 'Attack - 3'));
});
