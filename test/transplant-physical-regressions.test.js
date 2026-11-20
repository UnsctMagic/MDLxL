// Physical regression fixtures retain the exact original vertex memberships.
// Covers missing living-form motion, wrist-mounted shields and idle shoulder flips.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { Quaternion, Vector3 } from 'three';
import { openDocument } from '../src/editor-document.js';
import { allNodes, nodePivot, sampleGeosetAnimation, sampleNodeMatrices, sampleTrack, skinGeoset } from '../src/animation.js';
import { vertexBones } from '../src/part-bones.js';
import { transferRig } from '../src/anim-transfer.js';
import { transplantSkeleton } from '../src/skeleton-transplant.js';

const { testModel } = createRequire(import.meta.url)('./helpers/fixtures.cjs');
const fixture = name => testModel(name);
const load = name => { const file = fixture(name); return openDocument(new Uint8Array(fs.readFileSync(file)), file).model; };
const absent = names => names.some(name => !fs.existsSync(fixture(name))) ? 'private physical regression fixture unavailable' : false;
const statueNames = ['corpus-sd/undead__obsidianstatue.mdx', 'corpus-sd/nightelf__druidoftheclaw.mdx'];
const shieldNames = ['corpus-sd/human__footman.mdx', 'transfer-astra-r1/handgunner_repeater.mdx'];
const clearanceNames = ['transfer-astra-r1/handgunner_arquebus.mdx', 'transfer-astra-r1/WH_DOC_Demonette9_1.mdx'];
const cache = new Map();
function pair(names) {
  const key = names.join('|');
  if (!cache.has(key)) {
    const own = load(names[0]), donor = load(names[1]);
    cache.set(key, { own, donor, ...transplantSkeleton(own, donor, { mirror: false }) });
  }
  return cache.get(key);
}
function under(model, id, root) {
  const nodes = new Map(allNodes(model).map(node => [node.ObjectId, node])), seen = new Set();
  while (nodes.has(id) && !seen.has(id)) {
    if (id === root) return true;
    seen.add(id); id = nodes.get(id).Parent;
  }
  return false;
}
const span = points => Math.max(...points.flatMap(p => points.map(q => p.distanceTo(q))));
const livingStatue = [16, 17, 19, 27];

const polearm = ['transfer-astra-r1/stormvermin7.mdx','corpus-sd/creeps__razormane.mdx'];
test('the rigid polearm grip stays in the striking hand through the jointed flail attack', {skip:absent(polearm)}, () => {
  const {own,donor,model,report} = pair(polearm);
  const ownRig = transferRig(own), arm = Object.values(ownRig.parts).find(p=>p.weapon);
  const donorArm = transferRig(donor).parts[arm.key];
  const palm = report.donorNodes[donorArm.marker], tree = new Map(allNodes(own).map(n=>[n.ObjectId,n]));
  const seek = new Vector3().fromArray(nodePivot(own,tree.get(arm.marker),arm.marker));
  let grip = null;
  for (const [gi,g] of own.Geosets.entries()) for (let vi=0; vi<g.Vertices.length/3; vi++) {
    const ids = vertexBones(g,vi);
    if (!ids.length || !ids.every(id=>/^bone_weapon$/i.test(tree.get(id)?.Name))) continue;
    const d = new Vector3().fromArray(g.Vertices,vi*3).distanceTo(seek);
    if (!grip || d < grip.d) grip = {gi,vi,d};
  }
  assert.ok(grip && palm != null);
  const si = model.Sequences.findIndex(s=>/^attack/i.test(s.Name)), [a,b]=model.Sequences[si].Interval;
  const path = Array.from({length:33},(_,i)=>{
    const matrices=sampleNodeMatrices(model,a+(b-a)*i/32,si);
    return new Vector3().fromArray(skinGeoset(model.Geosets[grip.gi],matrices),grip.vi*3)
      .applyMatrix4(matrices.get(palm).clone().invert());
  });
  assert.ok(span(path) < 0.01, 'the grip drifts '+span(path).toFixed(2)+' model units from its place in the palm');
});

test('the visible living statue skin follows the donor body', { skip: absent(statueNames) }, () => {
  const { own, donor, model, report } = pair(statueNames);
  const root = report.donorNodes[transferRig(donor).body];
  const points = livingStatue.flatMap(gi => Array.from({ length: own.Geosets[gi].Vertices.length / 3 }, (_, vi) => [gi, vi]));
  assert.ok(points.length > 500, 'the actual statue body geometry is measured');
  const bones = new Set(points.flatMap(([gi, vi]) => vertexBones(model.Geosets[gi], vi)));
  assert.ok([...bones].every(id => under(model, id, root)), 'visible statue skin remains outside animated donor root');
  const si = model.Sequences.findIndex(s => /^attack$/i.test(s.Name));
  assert.ok(si >= 0, 'ordinary donor Attack exists');
  const [a, b] = model.Sequences[si].Interval;
  const positions = Array.from({ length: 17 }, (_, k) => {
    const matrices = sampleNodeMatrices(model, a + (b - a) * k / 16, si);
    const skin = model.Geosets.map(g => skinGeoset(g, matrices)), centre = new Vector3();
    for (const [gi, vi] of points) centre.add(new Vector3().fromArray(skin[gi], vi * 3));
    return centre.divideScalar(points.length);
  });
  assert.ok(span(positions) > 1, 'the visible statue body actually moves through Attack');
});

test('ordinary donor Attack keeps the statue living Stand form', { skip: absent(statueNames) }, () => {
  const { model } = pair(statueNames);
  const si = model.Sequences.findIndex(s => /^attack$/i.test(s.Name));
  assert.ok(si >= 0);
  const [a, b] = model.Sequences[si].Interval;
  for (let k = 0; k <= 16; k++) {
    const frame = a + (b - a) * k / 16;
    const shown = gi => sampleGeosetAnimation(model, gi, frame, si).alpha > 0.02;
    assert.ok([...livingStatue,18,28].every(shown) && !shown(0), `Attack phase ${k / 16} switches the living statue into its destroyer form`);
  }
});

test('the Footman shield stays on the forearm during donor Attack 2', { skip: absent(shieldNames) }, () => {
  const { own, donor, model, report } = pair(shieldNames);
  const vertices = Array.from({ length: own.Geosets[0].Vertices.length / 3 }, (_, vi) => vi)
    .filter(vi => vertexBones(own.Geosets[0], vi).includes(15));
  assert.equal(own.Nodes[15].Name, 'Mesh01');
  assert.equal(own.Nodes[15].Parent, 35);
  assert.equal(own.Nodes[35].Name, 'Bone_Arm2_R');
  assert.equal(vertices.length, 61, 'the original shield membership');
  const arm = Object.values(transferRig(own).parts).find(part => part.joints.includes(35));
  const donorArm = transferRig(donor).parts[arm.key];
  const forearm = report.donorNodes[donorArm.joints.at(-2)];
  const si = model.Sequences.findIndex(s => /^attack[ -]*2$/i.test(s.Name));
  assert.ok(si >= 0);
  const [a, b] = model.Sequences[si].Interval;
  const positions = Array.from({ length: 17 }, (_, k) => {
    const matrices = sampleNodeMatrices(model, a + (b - a) * k / 16, si);
    const skin = skinGeoset(model.Geosets[0], matrices), centre = new Vector3();
    for (const vi of vertices) centre.add(new Vector3().fromArray(skin, vi * 3));
    return centre.divideScalar(vertices.length).applyMatrix4(matrices.get(forearm).clone().invert());
  });
  const drift = span(positions);
  assert.ok(drift < 0.001, `shield moves ${drift} units relative to its forearm`);
});

test('floor clearance keeps the shoulder continuous through Stand 4', { skip: absent(clearanceNames) }, () => {
  const { own, donor, model, report } = pair(clearanceNames);
  const free = transplantSkeleton(own, donor, { mirror: false, floor: 'free' }).model;
  const arm = transferRig(donor).parts.armR, shoulder = report.donorNodes[arm.joints[0]];
  const si = model.Sequences.findIndex(s => /^stand 4$/i.test(s.Name));
  assert.ok(si >= 0);
  const interval = model.Sequences[si].Interval;
  const rotation = (m, frame) => new Quaternion().fromArray(sampleTrack(m.Nodes[shoulder].Rotation, frame,
    { interval, globalSequences: m.GlobalSequences, fallback: [0, 0, 0, 1], quaternion: true }));
  let previous = null, worst = { excess: 0, frame: interval[0] };
  for (let frame = interval[0]; frame <= interval[1]; frame++) {
    const bent = rotation(model, frame), original = rotation(free, frame);
    if (previous) {
      const excess = (previous.bent.angleTo(bent) - previous.original.angleTo(original)) * 180 / Math.PI;
      if (excess > worst.excess) worst = { excess, frame };
    }
    previous = { bent, original };
  }
  // The old solver flipped about 69 degrees over 8ms near the end of this idle.
  assert.ok(worst.excess < 1, `floor correction adds ${worst.excess} degrees in 1ms at ${worst.frame}`);
});
