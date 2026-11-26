// A legless flyer on a winged donor keeps the donor's steadiness (docs/agent-tasks/xfer-fable-plan.md, step 10). Owner:
// "jumps up and down while the donor remains stable".
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { Vector3 } from 'three';
import { openDocument } from '../src/editor-document.js';
import { allNodes, nodePivot, sampleGeosetAnimation, sampleNodeMatrices, skinGeoset } from '../src/animation.js';
import { transferRig } from '../src/anim-transfer.js';
import { standSequenceIndex } from '../src/sequence-editor.js';
import { transplantSkeleton } from '../src/skeleton-transplant.js';

const { fixturePath } = createRequire(import.meta.url)('./helpers/fixtures.cjs');
const missing = ['xfer-r43-own', 'xfer-r43-donor'].some(key => !fs.existsSync(fixturePath(key))) ? 'XFER reasonable models unavailable' : false;
const load = key => { const file = fixturePath(key); return openDocument(fs.readFileSync(file), file).model; };
// The joint's vertical range over one animation (25 moments).
function range(model, id, name) {
  const si = model.Sequences.findIndex(s => s.Name.trim() === name), node = allNodes(model).find(n => n.ObjectId === id);
  const [a, z] = model.Sequences[si].Interval, heights = [];
  for (let k = 0; k <= 24; k++) heights.push(new Vector3().fromArray(nodePivot(model, node, id)).applyMatrix4(sampleNodeMatrices(model, Math.round(a + (z - a) * k / 24), si).get(id)).z);
  return Math.max(...heights) - Math.min(...heights);
}
// The visible height in the first Stand moment (as Jump height reads it).
const standHeight = model => {
  const si = standSequenceIndex(model), frame = model.Sequences[si].Interval[0], world = sampleNodeMatrices(model, frame, si);
  let lo = Infinity, hi = -Infinity;
  for (const [gi, g] of model.Geosets.entries()) { if (sampleGeosetAnimation(model, gi, frame, si).alpha < .5) continue; const skin = skinGeoset(g, world); for (let i = 2; i < skin.length; i += 3) { lo = Math.min(lo, skin[i]); hi = Math.max(hi, skin[i]); } }
  return hi - lo;
};

test('Gryphon Rider onto the Dragonhawk Rider: the legless flyer hovers with the donor body, not its dangling feet', { skip: missing }, () => {
  const own = load('xfer-r43-own'), donor = load('xfer-r43-donor');
  const { model, report } = transplantSkeleton(own, donor, { events: true, emitters: false, keep: [], mirror: false });
  assert.equal(report.counts.ground, 'hover');
  const body = transferRig(donor, { sequence: Math.max(0, standSequenceIndex(donor)) }).body, mapped = report.donorNodes[body];
  for (const name of ['Stand', 'Walk']) {
    const donorRange = range(donor, body, name), resultRange = range(model, mapped, name);
    // The donor body's rise scaled by the standing heights (plan step 10 fix), within 20% and 1% of the height.
    const allowed = 1.2 * donorRange * standHeight(own) / standHeight(donor) + .01 * standHeight(own);
    assert.ok(resultRange <= allowed, `${name}: body rises and falls ${resultRange.toFixed(1)}, the donor's ${donorRange.toFixed(1)} (allowed ${allowed.toFixed(1)})`);
  }
});
