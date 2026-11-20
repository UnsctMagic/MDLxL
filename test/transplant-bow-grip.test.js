// Physical fixture: TC Attack - 1 midpoint still contacts the axe shaft with
// its left palm. The Archer's actual bow grip must stay near that mapped palm.
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
test('Archer bow grip switches palms with the Tauren shaft through both attacks', { skip: files.some(f => !fs.existsSync(f)) ? 'private SD grip fixtures unavailable' : false }, () => {
  const [own, donor] = files.map(f => openDocument(new Uint8Array(fs.readFileSync(f)), f).model);
  const ownRig = transferRig(own), donorRig = transferRig(donor), arm = Object.values(ownRig.parts).find(p => p.weapon);
  const stand = standSequenceIndex(own), reference = sampleNodeMatrices(own, own.Sequences[stand].Interval[0], stand);
  const ownRoot = own.Attachments.find(n => /^weapon ref$/i.test(n.Name)).Parent;
  const grip = closestGrip(own, ownRoot, point(own, arm.marker, reference), reference);
  assert.ok(grip && grip.gap / ownRig.hipHeight < 0.05, 'the source bow physically contacts its source hand');
  const { model, report } = transplantSkeleton(own, donor, { mirror: false });
  const donorRoot = donor.Attachments.find(n => /^weapon ref$/i.test(n.Name)).Parent;
  for (const [attack,side] of [['Attack - 1','armL'],['Attack - 2','armR']]) {
    const sequence = donor.Sequences.findIndex(s => s.Name.trim() === attack);
    const interval = donor.Sequences[sequence].Interval, frame = (interval[0] + interval[1]) / 2;
    const donorMatrices = sampleNodeMatrices(donor, frame, sequence), hand = donorRig.parts[side].marker;
    const contact = closestGrip(donor, donorRoot, point(donor, hand, donorMatrices), donorMatrices);
    assert.ok(contact && contact.gap / donorRig.hipHeight < 0.06, 'the donor is holding the weapon at this exact frame');
    const matrices = sampleNodeMatrices(model, frame, sequence), vertices = skinGeoset(model.Geosets[grip.gi], matrices);
    const actual = grip.indices.reduce((p, vi, i) => p.addScaledVector(new Vector3().fromArray(vertices, vi * 3), grip.bary[i]), new Vector3());
    const gap = actual.distanceTo(point(model, report.donorNodes[hand], matrices));
    assert.ok(gap / ownRig.hipHeight < 0.12, `${attack} bow grip is ${gap.toFixed(2)} units from the donor's holding palm`);
  }
});
