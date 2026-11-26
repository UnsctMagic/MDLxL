// Compare the material bow grip with the palms that actually contact the donor shaft.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { Triangle, Vector3 } from 'three';
import { openDocument } from '../src/editor-document.js';
import { allNodes, nodePivot, sampleNodeMatrices, skinGeoset } from '../src/animation.js';
import { nodeIndex } from '../src/node-hierarchy.js';
import { vertexBones } from '../src/part-bones.js';
import { transferRig } from '../src/anim-transfer.js';
import { standSequenceIndex } from '../src/sequence-editor.js';
import { transplantSkeleton } from '../src/skeleton-transplant.js';
import { solidContactFaces, posedContactFaces, surfaceGap, pointToContactSurface } from './helpers/transplant-contact.js';
const { testModel } = createRequire(import.meta.url)('./helpers/fixtures.cjs');
const files = ['nightelf__archer', 'orc__herotaurenchieftain'].map(n => testModel('corpus-sd/' + n + '.mdx'));
const point = (model, id, matrices) => new Vector3().fromArray(nodePivot(model, allNodes(model).find(n => n.ObjectId === id), id)).applyMatrix4(matrices.get(id));
function closestGrip(model, root, hand, matrices) {
  const tree = nodeIndex(model), nodes = new Map(allNodes(model).map(n => [n.ObjectId, n]));
  let best = null;
  for (const [gi, g] of model.Geosets.entries()) {
    const skin = skinGeoset(g, matrices);
    for (let f = 0; f < g.Faces.length; f += 3) {
      const indices = Array.from(g.Faces.slice(f, f + 3));
      if (!indices.every(vi => { const ids = vertexBones(g, vi); return ids.length && ids.every(id => tree.isAncestor(id, root) && !/^plane|^hero|glow/i.test(nodes.get(id)?.Name || '')); })) continue;
      const triangle = new Triangle(...indices.map(vi => new Vector3().fromArray(skin, vi * 3)));
      if (triangle.getArea() < 1e-10) continue;
      const at = triangle.closestPointToPoint(hand, new Vector3()), gap = at.distanceTo(hand);
      if (!best || gap < best.gap) best = { gi, indices, gap, bary: triangle.getBarycoord(at, new Vector3()).toArray() };
    }
  }
  return best;
}

function contactFixture() {
  const [own, donor] = files.map(f => openDocument(new Uint8Array(fs.readFileSync(f)), f).model);
  const ownRig = transferRig(own), donorRig = transferRig(donor), sourceArm = Object.values(ownRig.parts).find(p => p.weapon);
  const ownRoot = own.Attachments.find(n => /^weapon ref$/i.test(n.Name)).Parent, donorRoot = donor.Attachments.find(n => /^weapon ref$/i.test(n.Name)).Parent;
  const stand = standSequenceIndex(own), reference = sampleNodeMatrices(own, own.Sequences[stand].Interval[0], stand);
  const grip = closestGrip(own, ownRoot, point(own, sourceArm.marker, reference), reference);
  assert.ok(grip && grip.gap / ownRig.hipHeight < 0.05);
  const ownHands = {}, donorHands = {};
  for (const side of ['armL', 'armR']) {
    ownHands[side] = solidContactFaces(own, ownRig.parts[side].marker, { hand: true, excludeRoot: ownRoot });
    donorHands[side] = solidContactFaces(donor, donorRig.parts[side].marker, { hand: true, excludeRoot: donorRoot });
  }
  const shaft = solidContactFaces(donor, donorRoot), made = transplantSkeleton(own, donor, { mirror: false, autoFix: { surfaceGrip: true } });
  assert.equal(new Set(shaft.flatMap(f => f.ids.map(i => f.gi + ':' + i))).size, 16);
  return { own, donor, ownRig, donorRig, grip, ownHands, donorHands, shaft, ...made };
}
function contactAt(fixture, frame, si) {
  const { donor, model, grip } = fixture, dm = sampleNodeMatrices(donor, frame, si), mm = sampleNodeMatrices(model, frame, si);
  const shaft = posedContactFaces(donor, dm, fixture.shaft), skin = skinGeoset(model.Geosets[grip.gi], mm);
  const actual = grip.indices.reduce((p, vi, i) => p.addScaledVector(new Vector3().fromArray(skin, vi * 3), grip.bary[i]), new Vector3());
  return { frame, resultGrip: actual.toArray(), hands: ['armL', 'armR'].map(side => ({
    side, donorSurfaceGap: surfaceGap(posedContactFaces(donor, dm, fixture.donorHands[side]), shaft),
    resultFitError: pointToContactSurface(actual, posedContactFaces(model, mm, fixture.ownHands[side])),
  })) };
}
test('Archer bow grip follows actual shaft-contact palms including exclusive switches', { skip: files.some(f => !fs.existsSync(f)) ? 'private SD grip fixtures unavailable' : false }, () => {
  const fixture = contactFixture();
  for (const [name, expected] of [['Attack - 1', ['armL', 'armR']], ['Attack - 2', ['armR']], ['Stand - 2', ['armL']]]) {
    const si = fixture.donor.Sequences.findIndex(s => s.Name.trim() === name), interval = fixture.donor.Sequences[si].Interval;
    const contact = contactAt(fixture, (interval[0] + interval[1]) / 2, si);
    const holding = contact.hands.filter(h => h.donorSurfaceGap < 0.001);
    assert.deepEqual(holding.map(h => h.side), expected, name + ' actual donor hand-surface fixture');
    assert.ok(Math.min(...holding.map(h => h.resultFitError)) / fixture.ownRig.hipHeight < 0.08, name + ' loses the actual corresponding holding palm: ' + JSON.stringify(contact));
  }
});
test('Archer keeps the continuously holding Tauren right palm through early Attack 2', { skip: files.some(f => !fs.existsSync(f)) ? 'private SD grip fixtures unavailable' : false }, () => {
  const fixture = contactFixture(), si = fixture.donor.Sequences.findIndex(s => s.Name.trim() === 'Attack - 2'), start = fixture.donor.Sequences[si].Interval[0];
  const records = Array.from({ length: 41 }, (_, i) => contactAt(fixture, start + i * 5, si));
  assert.ok(records.every(r => r.hands.find(h => h.side === 'armR').donorSurfaceGap < 0.001), 'the actual donor right-hand surface stays on its shaft throughout the interval');
  const worst = records.reduce((a, b) => a.hands[1].resultFitError > b.hands[1].resultFitError ? a : b);
  assert.ok(worst.hands[1].resultFitError / fixture.ownRig.hipHeight < 0.08, 'the grip leaves the actual continuously holding palm: ' + JSON.stringify(worst));
});
