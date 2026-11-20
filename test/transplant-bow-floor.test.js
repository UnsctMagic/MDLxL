import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { Triangle, Vector3 } from 'three';
import { openDocument } from '../src/editor-document.js';
import { allNodes, nodePivot, sampleNodeMatrices, skinGeoset } from '../src/animation.js';
import { vertexBones } from '../src/part-bones.js';
import { geosetMaterialLayers, hasOnlyAdditiveLayers } from '../src/geoset-extras.js';
import { transferRig, rigSizeRatio } from '../src/anim-transfer.js';
import { standSequenceIndex } from '../src/sequence-editor.js';
import { transplantSkeleton } from '../src/skeleton-transplant.js';
import { solidContactFaces, posedContactFaces, surfaceGap, pointToContactSurface } from './helpers/transplant-contact.js';
const { testModel } = createRequire(import.meta.url)('./helpers/fixtures.cjs');
const files = ['nightelf__archer', 'orc__herotaurenchieftain'].map(name => testModel('corpus-sd/' + name + '.mdx'));
const point = (m, id, matrices) => new Vector3().fromArray(nodePivot(m, m.Nodes[id], id)).applyMatrix4(matrices.get(id));
function under(model, id, roots) {
  const nodes = new Map(allNodes(model).map(n => [n.ObjectId, n]));
  const seen = new Set();
  while (nodes.has(id) && !seen.has(id)) {
    if (roots.has(id)) return true;
    seen.add(id); id = nodes.get(id).Parent;
  }
  return false;
}
function vertices(model, roots) {
  return model.Geosets.map(g => Array.from({ length: g.Vertices.length / 3 }, (_, i) => i)
    .filter(i => vertexBones(g, i).some(id => under(model, id, roots))));
}
const minimum = (skin, members) => Math.min(...members.flatMap((ids, gi) => ids.map(i => skin[gi][i * 3 + 2])));
const skinAt = (model, frame, si) => {
  const matrices = sampleNodeMatrices(model, frame, si);
  return { matrices, skin: model.Geosets.map(g => skinGeoset(g, matrices)) };
};
function floor(model, members, si) {
  const [a, b] = model.Sequences[si].Interval, heights = [];
  for (let frame = a; frame < b; frame += 1000 / 30) heights.push(minimum(skinAt(model, Math.round(frame), si).skin, members));
  heights.push(minimum(skinAt(model, b, si).skin, members));
  return heights.sort((x, y) => x - y)[heights.length >> 1];
}

test('Archer bow clearance follows the holding shoulder after palm fitting without lifting the feet', {
  skip: files.some(file => !fs.existsSync(file)) ? 'private SD bow clearance fixtures unavailable' : false,
}, () => {
  const [own, donor] = files.map(file => openDocument(new Uint8Array(fs.readFileSync(file)), file).model);
  const ownRig = transferRig(own), donorRig = transferRig(donor);
  const { model, report } = transplantSkeleton(own, donor, { mirror: false });
  const free = transplantSkeleton(own, donor, { mirror: false, floor: 'free' }).model;
  const stand = standSequenceIndex(donor), ownStand = standSequenceIndex(own);
  const legRoots = rig => new Set(Object.values(rig.parts).filter(p => p.limbKind === 'leg').flatMap(p => p.joints));
  const ownLegs = vertices(own, legRoots(ownRig)), donorLegs = vertices(donor, legRoots(donorRig));
  const weaponRoot = m => m.Attachments.find(n => /^weapon ref$/i.test(n.Name)).Parent;
  const bow = vertices(own, new Set([weaponRoot(own)]));
  const axeRoot = weaponRoot(donor);
  const axe = donor.Geosets.map(g => hasOnlyAdditiveLayers(geosetMaterialLayers(donor, g)) ? [] :
    Array.from({ length: g.Vertices.length / 3 }, (_, i) => i).filter(i => {
      const ids = vertexBones(g, i); return ids.length && ids.every(id => id === axeRoot);
    }));
  assert.equal(axe.reduce((n, ids) => n + ids.length, 0), 16, 'the direct solid axe shaft/head vertices exclude child glow planes');
  const ownFloor = floor(model, ownLegs, stand), donorFloor = floor(donor, donorLegs, stand);
  const sourceZ = own.Geosets.flatMap(g => Array.from(g.Vertices).filter((_, i) => i % 3 === 2));
  const tolerance = 0.02 * (Math.max(...sourceZ) - Math.min(...sourceZ));
  const size = rigSizeRatio(ownRig, donorRig);
  const sourcePose = skinAt(own, own.Sequences[ownStand].Interval[0], ownStand);
  const sourceHand = Object.values(ownRig.parts).find(p => p.weapon).marker;
  const palm = point(own, sourceHand, sourcePose.matrices);
  let grip = null;
  own.Geosets.forEach((g, gi) => {
    if ((own.Materials[g.MaterialID]?.Layers?.[0]?.FilterMode || 0) >= 3) return;
    for (let f = 0; f < g.Faces.length; f += 3) {
      const ids = Array.from(g.Faces.slice(f, f + 3));
      if (!ids.every(i => bow[gi].includes(i))) continue;
      const triangle = new Triangle(...ids.map(i => new Vector3().fromArray(sourcePose.skin[gi], i * 3)));
      if (triangle.getArea() < 1e-8) continue;
      const at = triangle.closestPointToPoint(palm, new Vector3()), gap = at.distanceTo(palm);
      if (!grip || gap < grip.gap) grip = { gi, ids, gap, bary: triangle.getBarycoord(at, new Vector3()).toArray() };
    }
  });
  assert.ok(grip, 'actual source bow surface touches the source palm');
  const ownHands = {}, donorHands = {}, shaft = solidContactFaces(donor, axeRoot);
  for (const side of ['armL', 'armR']) {
    ownHands[side] = solidContactFaces(own, ownRig.parts[side].marker, { hand: true, excludeRoot: weaponRoot(own) });
    donorHands[side] = solidContactFaces(donor, donorRig.parts[side].marker, { hand: true, excludeRoot: axeRoot });
  }
  let worst = { excess: -Infinity }, footDrift = 0;
  for (const name of ['Attack - 1', 'Attack - 2']) {
    const si = donor.Sequences.findIndex(s => s.Name.trim() === name);
    assert.ok(si >= 0);
    const [a, b] = donor.Sequences[si].Interval;
    for (let k = 0; k <= 128; k++) {
      const frame = a + (b - a) * k / 128;
      const result = skinAt(model, frame, si), original = skinAt(donor, frame, si), uncorrected = skinAt(free, frame, si);
      const bowHeight = minimum(result.skin, bow) - ownFloor, axeHeight = minimum(original.skin, axe) - donorFloor;
      const excess = -bowHeight - tolerance - Math.max(0, -axeHeight) * size;
      if (excess > worst.excess) worst = { sequence: name, frame, phase: k / 128, bowHeight, axeHeight, excess, tolerance };
      for (const [gi, ids] of ownLegs.entries()) for (const vi of ids) {
        footDrift = Math.max(footDrift, new Vector3().fromArray(result.skin[gi], vi * 3).distanceTo(new Vector3().fromArray(uncorrected.skin[gi], vi * 3)));
      }
      if (k === 64) {
        const at = grip.ids.reduce((p, vi, i) => p.addScaledVector(new Vector3().fromArray(result.skin[grip.gi], vi * 3), grip.bary[i]), new Vector3());
        const sourceShaft = posedContactFaces(donor, original.matrices, shaft);
        const holding = ['armL', 'armR'].filter(key => surfaceGap(posedContactFaces(donor, original.matrices, donorHands[key]), sourceShaft) < 0.001);
        assert.ok(holding.length, name + ' has an actual donor holding palm');
        const gap = Math.min(...holding.map(key => pointToContactSurface(at, posedContactFaces(model, result.matrices, ownHands[key]))));
        assert.ok(gap / ownRig.hipHeight < 0.08, name + ' loses its actual holding palm while clearing the floor: ' + gap);
      }
    }
  }
  assert.ok(footDrift < 0.001, `bow clearance lifts the feet by ${footDrift}`);
  assert.ok(worst.excess < 0.03, JSON.stringify(worst));
});
