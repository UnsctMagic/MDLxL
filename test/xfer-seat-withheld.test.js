// Seat weapon is suggested only where there is something to repair (docs/agent-tasks/xfer-fable-plan.md, step 6). Owner on
// reasonable-32: "the before is a better transfer... how can you not see this???".
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { openDocument } from '../src/editor-document.js';
import { seatWithheld } from '../src/transplant-weapon-seat.js';
import { suggestToggles } from '../src/xfer-suggest-toggles.js';

const { fixturePath } = createRequire(import.meta.url)('./helpers/fixtures.cjs');
const load = file => openDocument(fs.readFileSync(file), file).model;

// The plan's C4 table (gap in arm lengths, place 0 butt to 1 head). Values C4 does not give (shaft, roll, flat of some
// pairs) are this step's live readings, out/fable-plan/step-6/table.md; random-24 (not in the reasonable set) takes the
// worst case for them.
const grip = (gapMax, place) => ({ gapMax, place });
const C4 = {
  'reasonable-32': { own: grip(.12, .16), plain: grip(.12, .17), seated: grip(null, .17), shaft: 17, roll: 80, flat: 2.4, support: false },
  'reasonable-38': { own: grip(.04, .11), plain: grip(.03, .12), seated: grip(null, .30), shaft: 31, roll: 1, flat: 1.5, support: false },
  'reasonable-40': { own: grip(.04, .04), plain: grip(.05, .00), seated: grip(null, .57), shaft: 87, roll: 11, flat: 2.4, support: false },
  'new-08': { own: grip(.03, .62), plain: grip(.03, .62), seated: grip(null, .20), shaft: 33, roll: 1, flat: 1.2, support: false },
  'random-10': { own: grip(.02, .12), plain: grip(.05, .54), seated: grip(null, .38), shaft: 84, roll: 89, flat: 4.0, support: false },
  'random-21': { own: grip(.04, .37), plain: grip(.44, .44), seated: grip(null, .57), shaft: 143, roll: 77, flat: 2.3, support: false },
  'random-17': { own: grip(.41, .13), plain: grip(.48, .38), seated: grip(null, .03), shaft: 110, roll: 24, flat: 2.3, support: false },
  'random-24': { own: grip(.00, .18), plain: grip(.00, .18), seated: grip(null, .07), shaft: 0, roll: 90, flat: 3, support: true },
};

test('seatWithheld on the C4 pairs: withheld where the plain grip was right, kept where Seat repairs or adds a second hand', () => {
  assert.equal(seatWithheld(C4['reasonable-32']), 'rolls the blade', 'the sabre turned flat');
  assert.equal(seatWithheld(C4['reasonable-38']), 'slides the hand off the handle', 'the hand slid up the lance');
  for (const id of ['reasonable-40', 'new-08', 'random-10', 'random-21', 'random-17', 'random-24'])
    assert.equal(seatWithheld(C4[id]), null, `${id} keeps Seat`);
  assert.equal(seatWithheld({ ...C4['reasonable-38'], shaft: 35 }), null, 'a shaft 35 deg or more off the donor\'s is something to repair');
  assert.equal(seatWithheld({ ...C4['reasonable-32'], flat: 1.9 }), null, 'a round weapon has no blade to roll');
  assert.equal(seatWithheld({}), null, 'nothing read: nothing withheld');
});

test('Arkain Cavalry Sergeant onto the French Dragoon Cavalry: Seat weapon shown, not suggested', { skip: ['xfer-r32-own', 'xfer-r32-donor'].some(key => !fs.existsSync(fixturePath(key))) ? 'XFER reasonable models unavailable' : false }, () => {
  const { visible, suggested, scores } = suggestToggles(load(fixturePath('xfer-r32-own')), load(fixturePath('xfer-r32-donor')), { events: true, emitters: false, keep: [], mirror: false });
  assert.ok(visible.includes('seatWeapon'), `shown ${visible.join(', ')}`);
  assert.ok(!suggested.includes('seatWeapon'), `suggested ${suggested.join(', ')} (${JSON.stringify(scores.seat)})`);
  assert.equal(scores.seat?.withheld, 'rolls the blade');
});
