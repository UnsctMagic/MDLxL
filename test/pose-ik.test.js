import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { allNodes, sampleNodeMatrices, sampleTrack } from '../src/animation.js';
import { applyMovementPose, applyMovementTransform, sampleMovement } from '../src/movement.js';
import { poseControlPoint, poseNodeControl, withPoseResult, poseAffectedPins, poseNodeConstraints, poseTrackScope, samplePoseChain, solvePoseBody, solvePoseLimb, solvePoseNode, suggestPoseBody, suggestPoseChain, suggestPoseRig, turnPoseEndpoint, validatePoseBody, validatePoseChain } from '../src/pose-ik.js';
import { createNode, openDocument } from '../src/editor-document.js';
import { createStarterDocument } from '../src/starter-model.js';
import { parseMdx } from '../src/mdx-container.js';
import { assertModelEquivalent } from '../src/save-equivalence.js';
import { pickPoseHandle, poseHandleTarget, projectPoseHandles } from '../app/pose-overlay.js';

const chain = { root: 1, middle: 2, end: 3, kind: 'arm', key: 'a' }, leg1 = { root: 4, middle: 5, end: 6, kind: 'leg', key: 'l' }, leg2 = { root: 7, middle: 8, end: 9, kind: 'leg', key: 'r' };
const q = (axis, angle) => new Quaternion().setFromAxisAngle(new Vector3(...axis).normalize(), angle).toArray();
const track = (...keys) => ({ LineType: 1, GlobalSeqId: null, Keys: keys.map(([Frame, value]) => ({ Frame, Vector: new Float32Array(value) })) });
function fixture() {
  const pivots = [[0, 0, 10], [0, 0, 18], [8, 0, 20], [14, 0, 18], [0, -3, 10], [2, -3, 5], [0, -3, 0], [0, 3, 10], [-2, 3, 5], [0, 3, 0]];
  const parents = [null, 0, 1, 2, 0, 4, 5, 0, 7, 8];
  return { Bones: pivots.map((PivotPoint, ObjectId) => ({ ObjectId, Name: `Odd ${ObjectId}`, Parent: parents[ObjectId], PivotPoint, Flags: 256 })), Helpers: [], PivotPoints: pivots, GlobalSequences: [], Sequences: [{ Name: 'A', Interval: [100, 1000], MoveSpeed: 0, NonLooping: false, Rarity: 0 }, { Name: 'Portrait', Interval: [2000, 3000], MoveSpeed: 0, NonLooping: false, Rarity: 0 }], Geosets: [] };
}
const near = (a, b, tolerance = 1e-4) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
const vectorNear = (a, b, tolerance) => a.forEach((value, i) => near(value, b[i], tolerance));
function apply(model, result) { return applyMovementPose(model, result.changes, 500, 0); }
function check(model, c, original, target) {
  const result = samplePoseChain(model, c, 500, 0);
  vectorNear(result.root.toArray(), original.root.toArray()); vectorNear(result.lengths, original.lengths);
  if (target) vectorNear(result.end.toArray(), target.toArray());
  near(Math.abs(result.rotations[2].dot(original.rotations[2])), 1, 1e-7);
  return result;
}

test('adjacent hierarchy suggestions use identities, reject skips, cyclic and missing parents', () => {
  const m = fixture(); assert.deepEqual(suggestPoseChain(m, 3), { root: 1, middle: 2, end: 3 });
  assert.throws(() => validatePoseChain(m, { root: 0, middle: 2, end: 3 }), /adjacent/);
  assert.throws(() => validatePoseChain(m, { root: 1, middle: 1, end: 3 }), /distinct/);
  m.Bones[0].Parent = 3; assert.throws(() => samplePoseChain(m, chain, 500, 0), /cyclic/);
  m.Bones[0].Parent = 800; assert.throws(() => samplePoseChain(m, chain, 500, 0), /missing parent/);
});

for (const mirrored of [false, true]) test(`reachable analytical solve samples exact native pose and twist, mirrored=${mirrored}`, () => {
  const m = fixture(); if (mirrored) for (const node of m.Bones) node.PivotPoint[0] *= -1;
  m.Bones[0].Translation = track([500, [3, 6, 2]]); m.Bones[0].Rotation = track([500, q([1, 2, 3], .8)]); m.Bones[0].Scaling = track([500, [2, 2, 2]]);
  m.Bones[1].Rotation = track([500, q([8, 0, 2], .4)]);
  const before = structuredClone(m), pose = samplePoseChain(m, chain, 500, 0), target = pose.end.clone().add(new Vector3(-1, 2, -1));
  const result = solvePoseLimb(m, chain, 500, 0, target); assert.deepEqual(m, before, 'solve does not mutate source');
  apply(m, result); check(m, chain, pose, target);
  for (const change of result.changes) { assert.equal(change.property, 'Rotation'); near(Math.hypot(...change.value), 1, 1e-10); }
});

test('inner and outer reach clamp, coincident target stays finite, bend direction remains continuous', () => {
  const m = fixture(), pose = samplePoseChain(m, chain, 500, 0);
  for (const distance of [1e5, 0, 1e-8]) {
    const copy = structuredClone(m), target = pose.root.clone().add(new Vector3(distance, 0, 0)), result = solvePoseLimb(copy, chain, 500, 0, target);
    apply(copy, result); const after = check(copy, chain, pose);
    near(after.root.distanceTo(after.end), distance > 1 ? pose.lengths[0] + pose.lengths[1] : Math.abs(pose.lengths[0] - pose.lengths[1]), 1e-4);
  }
  const a = solvePoseLimb(m, chain, 500, 0, pose.end.clone().add(new Vector3(0, .001, 0))), b = solvePoseLimb(m, chain, 500, 0, pose.end.clone().add(new Vector3(0, -.001, 0)));
  assert.ok(new Vector3(...a.bend).dot(new Vector3(...b.bend)) > .9999);
});

test('straight and folded equal-length chains handle zero targets without NaNs', () => {
  for (const end of [[20, 0, 0], [0, 0, 0]]) {
    const m = fixture(); m.Bones[1].PivotPoint = [0, 0, 0]; m.Bones[2].PivotPoint = [10, 0, 0]; m.Bones[3].PivotPoint = end;
    const pose = samplePoseChain(m, chain, 500, 0), result = solvePoseLimb(m, chain, 500, 0, [0, 0, 0]);
    apply(m, result); check(m, chain, pose); assert.ok(result.changes.flatMap(c => c.value).every(Number.isFinite));
  }
});

test('unsupported inherited-transform flags reject before mutation rather than disagreeing with the mesh renderer', () => {
  for (const flag of [1, 2, 4, 7]) {
    const m = fixture(); m.Bones[0].Translation = track([500, [4, 3, 2]]); m.Bones[0].Rotation = track([500, q([0, 0, 1], .5)]); m.Bones[0].Scaling = track([500, [2, 2, 2]]); m.Bones[1].Flags |= flag;
    const before = structuredClone(m); assert.throws(() => solvePoseLimb(m, chain, 500, 0, [10, 1, 18]), /preview renderer/); assert.deepEqual(m, before);
  }
  const m = fixture(); m.Bones[2].Flags |= 2; assert.throws(() => samplePoseChain(m, chain, 500, 0), /inherited transforms/);
});

test('body mapping rejects a hierarchy link that excludes body translation', () => {
  const m = fixture(); m.Bones[4].Flags |= 1;
  assert.throws(() => validatePoseBody(m, 0, [leg1, leg2]), /inherited translation|inherited transforms/);
  assert.throws(() => solvePoseBody(m, 0, [{ chain: leg1 }], 500, 0, [0, 0, -1]), /inherited translation|inherited transforms/);
});

test('straight-chain bend memory keeps continuity, while a bent sampled FK pose overrides memory', () => {
  const m = fixture(), pose = samplePoseChain(m, chain, 500, 0), direction = pose.end.clone().sub(pose.root).normalize();
  const extended = solvePoseLimb(m, chain, 500, 0, pose.root.clone().addScaledVector(direction, 1000)); apply(m, extended);
  const local = new Vector3(...extended.bend).applyQuaternion(extended.pose.rotations[0].clone().invert());
  const straight = samplePoseChain(m, chain, 500, 0), memory = local.clone().applyQuaternion(straight.rotations[0]);
  const folded = solvePoseLimb(m, chain, 500, 0, straight.end.clone().addScaledVector(direction, -.2), { bendMemory: memory });
  assert.ok(new Vector3(...folded.bend).dot(new Vector3(...extended.bend)) > .99);
  const normal = fixture(), target = pose.end.clone().add(new Vector3(-1, 1, 0));
  const a = solvePoseLimb(normal, chain, 500, 0, target), b = solvePoseLimb(normal, chain, 500, 0, target, { bendMemory: new Vector3(...a.bend).negate() });
  vectorNear(a.bend, b.bend, 1e-8);
});

test('nonuniform/reflected/singular scales, billboards, coincident joints and invalid keys reject before mutation', () => {
  for (const scale of [[1, 2, 1], [-1, -1, -1], [0, 0, 0]]) { const m = fixture(); m.Bones[0].Scaling = track([500, scale]); const before = structuredClone(m); assert.throws(() => solvePoseLimb(m, chain, 500, 0, [10, 0, 18]), /scale|transform/); assert.deepEqual(m, before); }
  const m = fixture(); m.Bones[0].Flags |= 8; assert.throws(() => samplePoseChain(m, chain, 500, 0), /billboard/);
  m.Bones[0].Flags = 256; m.Bones[2].PivotPoint = m.Bones[1].PivotPoint; assert.throws(() => samplePoseChain(m, chain, 500, 0), /nonzero/);
  m.Bones[2].PivotPoint = [8, 0, 20]; m.Bones[0].Rotation = track([500, [0, 0, 0, 0]]); assert.throws(() => samplePoseChain(m, chain, 500, 0), /invalid/);
});

test('Bend keeps endpoint pose; Turn writes only endpoint Rotation and holds its pivot', () => {
  const m = fixture(), pose = samplePoseChain(m, chain, 500, 0), result = solvePoseLimb(m, chain, 500, 0, pose.end, { pole: pose.middle.clone().add(new Vector3(0, 8, 0)) });
  apply(m, result); const bent = check(m, chain, pose, pose.end); assert.ok(bent.middle.distanceTo(pose.middle) > 1);
  const turned = turnPoseEndpoint(m, chain, 500, 0, q([0, 0, 1], .4)); assert.deepEqual(turned.changes.map(change => change.id), [3]); apply(m, turned);
  const after = samplePoseChain(m, chain, 500, 0); vectorNear(after.end.toArray(), pose.end.toArray()); assert.ok(Math.abs(after.rotations[2].dot(pose.rotations[2])) < .999);
});

test('IK to direct bone rotation to IK seeds the new pose with no stale target', () => {
  const m = fixture(), start = samplePoseChain(m, chain, 500, 0); apply(m, solvePoseLimb(m, chain, 500, 0, start.end.clone().add(new Vector3(-2, 1, 0))));
  applyMovementTransform(m, [1], 500, 0, { mode: 'rotate', axis: 'Z', amount: 20 });
  const edited = samplePoseChain(m, chain, 500, 0), result = solvePoseLimb(m, chain, 500, 0, edited.end);
  const bytes = structuredClone(m); assert.equal(apply(m, result), 0); assert.deepEqual(m, bytes);
  const target = edited.end.clone().add(new Vector3(0, 0, 1)); apply(m, solvePoseLimb(m, chain, 500, 0, target)); check(m, chain, edited, target);
});

test('writer rejects globals, overlap, malformed and restricted tracks atomically', () => {
  for (const prepare of [m => { m.Bones[2].Rotation = { ...track([0, [0, 0, 0, 1]]), GlobalSeqId: 0 }; m.GlobalSequences = [1000]; }, m => { m.Sequences[1].Interval = [900, 3000]; }]) {
    const m = fixture(); prepare(m); const original = structuredClone(m), changes = [1, 2].map(id => ({ id, property: 'Rotation', value: q([0, 0, 1], .4) })); assert.throws(() => applyMovementPose(m, changes, 500, 0), /global|shared/); assert.deepEqual(m, original);
  }
  const m = fixture(), pose = samplePoseChain(m, chain, 500, 0), result = solvePoseLimb(m, chain, 500, 0, pose.end.clone().add(new Vector3(-1, 1, 0)));
  assert.throws(() => applyMovementPose(m, result.changes, 500, 0, { rotation: true }), /restricted/); assert.ok(applyMovementPose(m, result.changes, 500, 0, { translation: true }) > 0);
});

test('missing/keyless tracks seed only active interval, preserve gaps, other intervals and cubic tangents', () => {
  for (const line of [1, 2, 3]) {
    const m = fixture(), old = track([50, [0, 0, 0, 1]], [500, q([0, 0, 1], .1)], [1500, q([1, 0, 0], .2)], [2000, q([0, 1, 0], .3)]); old.LineType = line;
    if (line >= 2) for (const key of old.Keys) { key.InTan = new Float32Array(q([1, 0, 0], .2)); key.OutTan = new Float32Array(q([0, 0, 1], .2)); }
    m.Bones[1].Rotation = old; const before = structuredClone(old), value = q([0, 0, 1], .5);
    applyMovementPose(m, [{ id: 1, property: 'Rotation', value }, { id: 2, property: 'Rotation', value }], 500, 0);
    assert.equal(m.Bones[1].Rotation.LineType, line); assert.deepEqual(m.Bones[1].Rotation.Keys.filter(k => k.Frame !== 500), before.Keys.filter(k => k.Frame !== 500));
    assert.deepEqual(m.Bones[2].Rotation.Keys.map(k => k.Frame), [100, 500, 1000]); assert.deepEqual(sampleTrack(m.Bones[2].Rotation, 2500, { interval: m.Sequences[1].Interval, quaternion: true, fallback: [0, 0, 0, 1] }), [0, 0, 0, 1]);
    if (line >= 2) { const delta = new Quaternion().fromArray(value).multiply(new Quaternion().fromArray(before.Keys[1].Vector).normalize().invert()); vectorNear(Array.from(m.Bones[1].Rotation.Keys[1].InTan), delta.multiply(new Quaternion().fromArray(before.Keys[1].InTan)).toArray()); }
  }
});

test('body mapping follows hierarchy, and one/two simultaneous pins preserve feet and lengths', () => {
  assert.equal(suggestPoseBody(fixture(), [leg1, leg2]), 0); assert.throws(() => validatePoseBody(fixture(), 1, [leg1, leg2]), /drives/);
  for (const legs of [[leg1], [leg1, leg2]]) {
    const m = fixture(), original = structuredClone(m), poses = legs.map(c => samplePoseChain(m, c, 500, 0)), displacement = new Vector3(.6, .1, -.6);
    const result = solvePoseBody(m, 0, legs.map(chain => ({ chain })), 500, 0, displacement); assert.deepEqual(m, original);
    assert.equal(result.changes.filter(change => change.property === 'Translation').length, 1); assert.ok(result.changes.every(change => change.id === 0 && change.property === 'Translation' || change.property === 'Rotation'));
    apply(m, result); legs.forEach((c, i) => { const after = samplePoseChain(m, c, 500, 0); vectorNear(after.end.toArray(), poses[i].end.toArray()); vectorNear(after.lengths, poses[i].lengths); near(Math.abs(after.rotations[2].dot(poses[i].rotations[2])), 1, 1e-7); });
    vectorNear(Array.from(sampleTrack(m.Bones[0].Translation, 500, { interval: m.Sequences[0].Interval, fallback: [0, 0, 0] })), displacement.toArray());
  }
});

test('direct scale and translation preserve native cubic handles, other keys and controller ownership', () => {
  for (const [property, oldValue, value] of [['Scaling', [2, 3, 4], [4, 6, 8]], ['Translation', [2, 3, 4], [3, 5, 7]]]) for (const line of [2, 3]) {
    const m = fixture(), prior = track([50, oldValue], [500, oldValue], [1500, oldValue], [2500, oldValue]);
    prior.LineType = line; for (const key of prior.Keys) { key.InTan = new Float32Array([1, 2, 3]); key.OutTan = new Float32Array([4, 5, 6]); }
    m.Bones[0][property] = prior; const before = structuredClone(prior);
    applyMovementPose(m, [{id:0, property, value}], 500, 0);
    const after = m.Bones[0][property]; assert.equal(after.LineType, line); assert.deepEqual(after.Keys.filter(key=>key.Frame!==500),before.Keys.filter(key=>key.Frame!==500));
    for (const tangent of ['InTan','OutTan']) vectorNear(Array.from(after.Keys[1][tangent]), Array.from(before.Keys[1][tangent], (component,i)=>property==='Scaling'?component*2:line===3?component+value[i]-oldValue[i]:component));
    const unchanged=structuredClone(m); assert.throws(()=>applyMovementPose(m,[{id:0,property,value:oldValue}],500,0,{[property==='Scaling'?'scaling':'translation']:true}),/restricted/); assert.deepEqual(m,unchanged);
    m.Bones[0][property].GlobalSeqId=0; m.GlobalSequences=[1000]; assert.throws(()=>applyMovementPose(m,[{id:0,property,value:oldValue}],500,0),/global/);
  }
});

test('body reaches the boundary without a rollback, restrictions prevent all writes', () => {
  const m = fixture(), before = structuredClone(m), pins = [leg1, leg2].map(chain => ({ chain }));
  const limited = solvePoseBody(m, 0, pins, 500, 0, [0, 0, 100]); assert.ok(limited.limited); assert.ok(limited.fraction > 0 && limited.fraction < 1); assert.deepEqual(m, before);
  const bounded = structuredClone(m); apply(bounded, limited);
  for (const chain of [leg1, leg2]) vectorNear(samplePoseChain(bounded, chain, 500, 0).end.toArray(), samplePoseChain(m, chain, 500, 0).end.toArray());
  const further = solvePoseBody(m, 0, pins, 500, 0, [0, 0, 200]); near(further.fraction * 200, limited.fraction * 100, 1e-5);
  const result = solvePoseBody(m, 0, [leg1, leg2].map(chain => ({ chain })), 500, 0, [.5, 0, -.5]);
  for (const restriction of [{ translation: true }, { rotation: true }]) { assert.throws(() => applyMovementPose(m, result.changes, 500, 0, restriction), /restricted/); assert.deepEqual(m, before); }
  const zero = solvePoseBody(m, 0, [leg1, leg2].map(chain => ({ chain })), 500, 0, [0, 0, 0]); assert.equal(apply(m, zero), 0);
});

test('automatic body posing crouches with stable endpoints and rises beyond reach without limiting the body', () => {
  const m=fixture(), original=structuredClone(m), chains=[chain,leg1,leg2], config={chains,pins:[]}, poses=chains.map(c=>samplePoseChain(m,c,500,0));
  for(const z of [-3,25]) {
    const constraints=poseNodeConstraints(m,config,0), result=solvePoseNode(m,0,constraints,500,0,{mode:'move',space:'world',values:[0,0,z]}), posed=structuredClone(m);
    assert.equal(result.fraction,1);assert.equal(result.limited,false);assert.deepEqual(m,original);apply(posed,result);
    vectorNear(sampleMovement(posed,posed.Bones[0],'Translation',500,0),[0,0,z]);
    for(let i=0;i<chains.length;i++) {
      const p=samplePoseChain(posed,chains[i],500,0);vectorNear(p.lengths,poses[i].lengths);near(Math.abs(p.rotations[2].dot(poses[i].rotations[2])),1,1e-7);
      if(z<0)vectorNear(p.end.toArray(),poses[i].end.toArray());
      else {near(p.root.distanceTo(p.end),p.lengths[0]+p.lengths[1]);assert.ok(p.end.z>poses[i].end.z+10);}
    }
  }
});

test('crossing full extension in either drag direction stays continuous and returns to the original pose', () => {
  const m=fixture(), config={chains:[leg1,leg2],pins:[]}, constraints=poseNodeConstraints(m,config,0);
  let previous;
  for(const z of [...Array.from({length:101},(_,i)=>-3+i*.15),...Array.from({length:101},(_,i)=>12-i*.15)]) {
    const copy=structuredClone(m), result=solvePoseNode(m,0,constraints,500,0,{mode:'move',space:'world',values:[0,0,z]});apply(copy,result);
    const poses=[leg1,leg2].map(c=>samplePoseChain(copy,c,500,0));
    if(previous)for(let i=0;i<poses.length;i++){assert.ok(poses[i].end.distanceTo(previous[i].end)<.16);assert.ok(poses[i].middle.distanceTo(previous[i].middle)<1.0);}
    previous=poses;
  }
  const zero=solvePoseNode(m,0,constraints,500,0,{mode:'move',space:'world',values:[0,0,0]});assert.equal(apply(m,zero),0);
  const rise=solvePoseNode(m,0,constraints,500,0,{mode:'move',space:'world',values:[0,0,25]});apply(m,rise);
  Object.assign(config,withPoseResult(config,rise));
  const lower=solvePoseNode(m,0,poseNodeConstraints(m,config,0),500,0,{mode:'move',space:'world',values:[0,0,-25]});apply(m,lower);
  for(const c of [leg1,leg2])vectorNear(samplePoseChain(m,c,500,0).end.toArray(),samplePoseChain(fixture(),c,500,0).end.toArray());
  assert.ok(samplePoseChain(m,leg1,500,0).middle.x>0,'left knee keeps its bend after straightening');
  assert.ok(samplePoseChain(m,leg2,500,0).middle.x<0,'right knee keeps its bend after straightening');
});

test('automatic goals rebase after direct FK, endpoint edits and frame changes', () => {
  for(const edit of ['fk','endpoint','frame']) {
    const m=fixture();let config={chains:[leg1,leg2],pins:[]};
    const rise=solvePoseNode(m,0,poseNodeConstraints(m,config,0),500,0,{mode:'move',space:'world',values:[0,0,25]});apply(m,rise);config=withPoseResult(config,rise);
    if(edit==='fk')applyMovementTransform(m,[leg1.root],500,0,{mode:'rotate',space:'world',values:[15,0,0]});
    if(edit==='endpoint')apply(m,solvePoseLimb(m,leg1,500,0,samplePoseChain(m,leg1,500,0).end.clone().add(new Vector3(1,0,1))));
    const frame=edit==='frame'?600:500, before=structuredClone(m), pose=samplePoseChain(m,leg1,frame,0);
    const result=solvePoseNode(m,0,poseNodeConstraints(m,config,0),frame,0,{mode:'move',space:'world',values:[0,0,0]});
    vectorNear(result.targets.find(t=>t.key==='l').position,pose.end.toArray());assert.deepEqual(m,before);
  }
});

test('automatic targets permit complete ancestor turns while explicit pins alone limit movement', () => {
  const m=fixture(), chains=[chain,leg1,leg2], config={chains,pins:[]}, before=structuredClone(m);
  const turn={mode:'rotate',space:'world',values:[0,170,0]}, result=solvePoseNode(m,0,poseNodeConstraints(m,config,0,'rotate'),500,0,turn);
  const posed=structuredClone(m), ordinary=structuredClone(m);apply(posed,result);applyMovementTransform(ordinary,[0],500,0,turn);
  vectorNear(sampleMovement(posed,posed.Bones[0],'Rotation',500,0),sampleMovement(ordinary,ordinary.Bones[0],'Rotation',500,0));assert.equal(result.fraction,1);
  config.pins=['l'];const mixed=solvePoseNode(m,0,poseNodeConstraints(m,config,0),500,0,{mode:'move',space:'world',values:[0,0,25]});assert.ok(mixed.limited);apply(m,mixed);
  vectorNear(samplePoseChain(m,leg1,500,0).end.toArray(),samplePoseChain(before,leg1,500,0).end.toArray());
});

test('automatic scope includes compensated channels without intercepting direct joint FK or ordinary scale', () => {
  const m=fixture(), config={chains:[chain,leg1,leg2],pins:[],body:0};
  assert.equal(poseTrackScope(config,{kind:'body'},'move',m).length,10);
  assert.deepEqual(poseNodeConstraints(m,config,chain.root),[]);assert.deepEqual(poseNodeConstraints(m,config,chain.middle),[]);
  const change={mode:'rotate',space:'world',values:[15,0,0]}, expected=structuredClone(m);
  applyMovementTransform(expected,[chain.root],500,0,change);apply(m,solvePoseNode(m,chain.root,poseNodeConstraints(m,config,chain.root,'rotate'),500,0,change));assert.deepEqual(m,expected);
  assert.deepEqual(poseNodeConstraints(m,config,0,'scale'),[]);
  config.pins=['a'];assert.equal(poseNodeConstraints(m,config,chain.root)[0].pinned,true);
});

test('handle centres and labels select POSE consistently; disabled and invalid controls cannot intercept', () => {
  const m = fixture(), config = { enabled: true, chains: [chain, leg1, leg2], body: 0, pins: ['l', 'r'], target: { kind: 'body' } };
  assert.deepEqual(poseTrackScope(config, { kind: 'endpoint', key: 'a' }, 'rotate'), [{ id: 3, property: 'Rotation' }]);
  assert.equal(poseTrackScope(config, config.target, 'move').length, 7);
  const camera = new PerspectiveCamera(42, 1, .1, 1000); camera.position.set(50, -100, 60); camera.lookAt(0, 0, 10); camera.updateMatrixWorld();
  const handles = projectPoseHandles(m, config, 500, 0, camera, 600, 600), hand = handles.find(h => h.key === 'a');
  assert.equal(pickPoseHandle([hand], hand.x, hand.y), hand); assert.equal(pickPoseHandle([hand], hand.x + 13, hand.y), hand);
  assert.equal(pickPoseHandle([hand], hand.x + 24, hand.y), hand);
  assert.deepEqual(projectPoseHandles(m, { ...config, enabled: false }, 500, 0, camera, 600, 600), []);
  m.Bones[2].Parent = 0; assert.ok(!projectPoseHandles(m, config, 500, 0, camera, 600, 600).some(h => h.key === 'a'));
});

test('rig suggestions recognize actual named limbs and isolate bad candidates without changing a model', () => {
  const m = fixture(); m.Bones[0].Name = 'Root'; m.Bones[1].Name = 'Chest'; m.Bones[3].Name = 'Wrist.L'; m.Bones[6].Name = 'Foot_L'; m.Bones[9].Name = 'Ankle.R';
  const before = structuredClone(m), suggested = suggestPoseRig(m, 500, 0);
  assert.deepEqual(m, before); assert.deepEqual(suggested.chains.map(c => [c.end, c.kind]), [[3, 'arm'], [6, 'leg'], [9, 'leg']]); assert.equal(suggested.body, 0); assert.ok(suggested.nodes.includes(1));
  m.Bones[0].Name = 'Hand'; const invalid = suggestPoseRig(m, 500, 0); assert.ok(invalid.unavailable.some(item => item.id === 0)); assert.equal(invalid.chains.length, 3);
  const wrist = m.Bones.splice(3, 1)[0]; m.Attachments = [wrist]; assert.doesNotThrow(() => validatePoseChain(m, chain));
  const pose = samplePoseChain(m, chain, 500, 0), result = solvePoseLimb(m, chain, 500, 0, pose.end.clone().add(new Vector3(-1, 0, 0))); apply(m, result); vectorNear(samplePoseChain(m, chain, 500, 0).end.toArray(), result.pose.end.toArray());
});

test('nearby body and chest labels remain separately selectable at their authored pivots', () => {
  const m=fixture(); m.Bones[1].PivotPoint=m.Bones[0].PivotPoint.slice();
  const camera=new PerspectiveCamera(42,1,.1,1000); camera.position.set(50,-100,60); camera.lookAt(0,0,10); camera.updateMatrixWorld();
  const handles=projectPoseHandles(m,{enabled:true,chains:[],pins:[],body:0,nodes:[1]},500,0,camera,600,600), body=handles.find(handle=>handle.kind==='body'), chest=handles.find(handle=>handle.id===1);
  assert.equal(body.x,chest.x); assert.equal(body.y,chest.y); assert.ok(Math.abs(body.labelY-chest.labelY)>=16);
  for(const handle of [body,chest])assert.equal(pickPoseHandle(handles,handle.labelX+3,handle.labelY),handle);
});

test('overlapping handles and native markers share one complete selection cycle, while a drag keeps its selected object', () => {
  const hand={kind:'endpoint',key:'arm',label:'Hand',x:30,y:40,visible:true}, head={kind:'node',id:5,label:'Head',x:34,y:40,visible:true};
  const nodes=[{node:{ObjectId:3},x:30,y:40,visible:true},{node:{ObjectId:8},x:32,y:40,visible:true},{node:{ObjectId:9},x:90,y:40,visible:true}];
  let target=null;const visited=[];
  for(let step=0;step<4;step++){const hit=pickPoseHandle([hand,head],30,40,target,nodes);target=poseHandleTarget(hit);visited.push(target);assert.deepEqual(poseHandleTarget(pickPoseHandle([hand,head],30,40,target,nodes,true)),target);}
  assert.deepEqual(visited,[{kind:'endpoint',key:'arm'},{kind:'node',id:3,marker:true},{kind:'node',id:8,marker:true},{kind:'node',id:5}]);
  assert.equal(pickPoseHandle([hand,head],30,40,target,nodes),hand);
  assert.equal(pickPoseHandle([hand,head],hand.x+22,hand.y,target,nodes),hand,'a label selects its named handle directly');
  assert.equal(pickPoseHandle([{...hand,visible:false}],30,40,null,[]),null,'hidden controls never enter the cycle');
});

test('a bone under a hand control retains a separate selected marker and native channel scope', () => {
  const m=fixture(),camera=new PerspectiveCamera(42,1,.1,1000);camera.position.set(50,-100,60);camera.lookAt(0,0,10);camera.updateMatrixWorld();
  const config={enabled:true,chains:[chain],pins:[],body:0,nodes:[],target:{kind:'node',id:3,marker:true}};
  const handles=projectPoseHandles(m,config,500,0,camera,600,600),active=handles.filter(handle=>handle.selected);
  assert.equal(active.length,1);assert.equal(active[0].marker,true);assert.equal(active[0].quiet,true);assert.equal(active[0].id,3);
  assert.equal(handles.find(handle=>handle.kind==='endpoint').selected,false);assert.deepEqual(poseTrackScope(config,config.target,'move',m),[{id:3,property:'Translation'}]);
});

test('direct object Move/Rotate/Scale need no limb setup and use ordinary Movement transforms', () => {
  for (const [mode, values] of [['move', [2, -1, 3]], ['rotate', [0, 0, 15]], ['scale', [1.1, 1.1, 1.1]]]) {
    const m = fixture(), before = structuredClone(m), expected = structuredClone(m), change = { mode, values, space: 'world' };
    applyMovementTransform(expected, [0], 500, 0, change); const result = solvePoseNode(m, 0, [], 500, 0, change); assert.deepEqual(m, before); apply(m, result);
    vectorNear(sampleMovement(m,m.Bones[0],{move:'Translation',rotate:'Rotation',scale:'Scaling'}[mode],500,0), sampleMovement(expected,expected.Bones[0],{move:'Translation',rotate:'Rotation',scale:'Scaling'}[mode],500,0), 1e-6);
  }
  assert.doesNotThrow(() => validatePoseBody(fixture(), 0, []));
});

test('body Rotate/Scale compensate feet together, and upper-body controls compensate a pinned hand', () => {
  for (const change of [{ mode: 'rotate', space: 'world', values: [0, 0, 12] }, { mode: 'scale', space: 'local', values: [1.03, 1.03, 1.03] }]) {
    const m = fixture(), poses = [leg1,leg2].map(c => samplePoseChain(m,c,500,0)), before=structuredClone(m), result=solvePoseNode(m,0,[leg1,leg2].map(chain=>({chain})),500,0,change);
    assert.deepEqual(m,before); assert.ok(result.changes.length); apply(m,result);
    [leg1,leg2].forEach((c,i)=>{const after=samplePoseChain(m,c,500,0);vectorNear(after.end.toArray(),poses[i].end.toArray());near(Math.abs(after.rotations[2].dot(poses[i].rotations[2])),1,1e-7);});
  }
  const m=fixture(), config={chains:[chain,leg1,leg2],pins:['a','l','r']}; assert.deepEqual(poseAffectedPins(m,config,1),[chain]);
  const pose=samplePoseChain(m,chain,500,0); apply(m,solvePoseNode(m,1,[{chain}],500,0,{mode:'move',space:'world',values:[.3,0,0]})); vectorNear(samplePoseChain(m,chain,500,0).end.toArray(),pose.end.toArray());
});

test('body translation stops at the first inner reach boundary and retains a valid folded limb', () => {
  const m=fixture(); m.Bones[4].PivotPoint=[0,-3,10];m.Bones[5].PivotPoint=[0,-3,0];m.Bones[6].PivotPoint=[0,-3,-2];
  const pose=samplePoseChain(m,leg1,500,0), result=solvePoseBody(m,0,[{chain:leg1}],500,0,[0,0,-25]); assert.ok(result.limited); near(result.fraction,.16,1e-5); apply(m,result);
  const after=samplePoseChain(m,leg1,500,0); vectorNear(after.end.toArray(),pose.end.toArray());vectorNear(after.lengths,pose.lengths);assert.ok(after.root.distanceTo(after.end)>=8-1e-5);
});

test('native Footman suggestions include both hands, both feet and the shared whole-body root', {skip:!fs.existsSync('out/pose/Footman.mdx')}, () => {
  const m=openDocument(fs.readFileSync('out/pose/Footman.mdx'),'Footman.mdx').model, rig=suggestPoseRig(m,500,0);
  assert.deepEqual(rig.chains.map(c=>c.end).sort((a,b)=>a-b),[29,32,38,42]);assert.equal(rig.body,25);assert.ok(rig.nodes.includes(39)&&rig.nodes.includes(33)&&rig.nodes.includes(26));
});

test('Knight SD arm native solve, atomic Undo/Redo and MDX reopen preserve all other data/chunks', () => {
  const path = new URL('fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx', import.meta.url), bytes = fs.readFileSync(path), hash = createHash('sha256').update(bytes).digest('hex');
  const doc = openDocument(bytes, 'Knight.mdx'), original = structuredClone(doc.model), c = { root: 23, middle: 37, end: 46 }, pose = samplePoseChain(doc.model, c, 2000, 1), target = pose.end.clone().add(new Vector3(2, 1, 1));
  assert.equal(applyMovementPose(doc.model, solvePoseLimb(doc.model, c, 2000, 1, pose.end).changes, 2000, 1), 0, 'no-op retains rounded authored quaternions'); assert.deepEqual(doc.model, original);
  const result = solvePoseLimb(doc.model, c, 2000, 1, target); doc.apply('POSE', ['Nodes'], m => applyMovementPose(m, result.changes, 2000, 1));
  const edited = structuredClone(doc.model), strip = model => { const copy = structuredClone(model); for (const key of ['Bones', 'Nodes']) for (const node of copy[key] || []) if (node && [23, 37, 46].includes(node.ObjectId)) delete node.Rotation; return copy; };
  assert.deepEqual(strip(edited), strip(original)); assert.ok(doc.undo()); assert.deepEqual(doc.model, original); assert.equal(doc.undo(), false); assert.ok(doc.redo()); assert.deepEqual(doc.model, edited);
  // This imported fixture has an existing MDL conversion failure for helper
  // type flags even before editing. Its MDX path remains losslessly testable.
  assert.throws(() => openDocument(bytes, 'Knight.mdx').serialize('mdl'), /Helpers\[0\].Flags/);
  for (const format of ['mdx']) { const saved = doc.serialize(format), reopen = openDocument(saved, `pose.${format}`); const after = samplePoseChain(reopen.model, c, 2000, 1); near(after.end.distanceTo(target), 0, .002); near(Math.abs(after.rotations[2].dot(pose.rotations[2])), 1, 1e-6); }
  const saved = doc.serialize('mdx'), oldChunks = parseMdx(bytes).chunks, newChunks = parseMdx(saved).chunks;
  for (const chunk of oldChunks) if (chunk.tag !== 'BONE') { const other = newChunks.find(item => item.tag === chunk.tag); assert.deepEqual(Buffer.from(saved).subarray(other.offset, other.payloadOffset + other.declaredSize), bytes.subarray(chunk.offset, chunk.payloadOffset + chunk.declaredSize), `${chunk.tag} unchanged`); }
  assert.equal(createHash('sha256').update(fs.readFileSync(path)).digest('hex'), hash);
});

const nativeFixture = process.env.MDLXL_POSE_FIXTURE || new URL('../out/pose/Footman.mdx', import.meta.url);
test('native SD Footman limb/body preserves both foot pins and all other data through MDL and MDX', { skip: !fs.existsSync(nativeFixture) }, () => {
  const bytes = fs.readFileSync(nativeFixture), hash = createHash('sha256').update(bytes).digest('hex'), doc = openDocument(bytes, 'Footman.mdx'), original = structuredClone(doc.model);
  const arm = { root: 36, middle: 37, end: 38 }, legs = [{ root: 27, middle: 28, end: 29 }, { root: 30, middle: 31, end: 32 }];
  const pose = samplePoseChain(doc.model, arm, 500, 0), target = pose.end.clone().add(new Vector3(-1, 0, 2)), feet = legs.map(chain => samplePoseChain(doc.model, chain, 500, 0));
  doc.apply('Arm', ['Nodes'], m => applyMovementPose(m, solvePoseLimb(m, arm, 500, 0, target).changes, 500, 0));
  doc.apply('Body with two pins', ['Nodes'], m => applyMovementPose(m, solvePoseBody(m, 26, legs.map(chain => ({ chain })), 500, 0, [0, 0, -1]).changes, 500, 0));
  const permitted = new Set([27, 28, 29, 30, 31, 32, 36, 37, 38]), strip = model => { const copy = structuredClone(model); for (const key of ['Nodes', 'Bones', 'Helpers']) for (const node of copy[key] || []) if (node) { if (permitted.has(node.ObjectId)) delete node.Rotation; if (node.ObjectId === 26) delete node.Translation; } return copy; };
  assert.deepEqual(strip(doc.model), strip(original));
  for (const node of allNodes(original)) for (const property of ['Translation', 'Rotation']) {
    if (!(permitted.has(node.ObjectId) && property === 'Rotation' || node.ObjectId === 26 && property === 'Translation')) continue;
    const after = allNodes(doc.model).find(item => item.ObjectId === node.ObjectId);
    assert.deepEqual(after[property]?.Keys?.filter(key => key.Frame < 167 || key.Frame > 1667) || [], node[property]?.Keys?.filter(key => key.Frame < 167 || key.Frame > 1667) || []);
  }
  for (const format of ['mdx', 'mdl']) {
    const saved = doc.serialize(format), reopened = openDocument(saved, `posed.${format}`);
    assertModelEquivalent(strip(original), strip(reopened.model));
    near(samplePoseChain(reopened.model, arm, 500, 0).end.distanceTo(target), 0, .002);
    legs.forEach((chain, i) => { const after = samplePoseChain(reopened.model, chain, 500, 0); vectorNear(after.end.toArray(), feet[i].end.toArray(), .002); vectorNear(after.lengths, feet[i].lengths, .002); near(Math.abs(after.rotations[2].dot(feet[i].rotations[2])), 1, 1e-6); });
    if (format === 'mdx') for (const chunk of parseMdx(bytes).chunks) if (!['BONE', 'HELP'].includes(chunk.tag)) { const match = parseMdx(saved).chunks.find(item => item.tag === chunk.tag); assert.deepEqual(Buffer.from(saved).subarray(match.offset, match.payloadOffset + match.declaredSize), bytes.subarray(chunk.offset, chunk.payloadOffset + chunk.declaredSize), `${chunk.tag} preserved`); }
  }
  assert.equal(createHash('sha256').update(fs.readFileSync(nativeFixture)).digest('hex'), hash);
});

test('one body operation is atomic history, including absent tracks restored by Undo', () => {
  const doc = createStarterDocument(); doc.apply('Rig fixture', ['Nodes', 'Sequences', 'PivotPoints'], m => {
    const data = fixture(); m.Sequences = data.Sequences;
    for (let id = 1; id < 10; id++) createNode(m, 'Bone');
    data.Bones.forEach((node, id) => { Object.assign(m.Bones[id], node); m.PivotPoints[id] = m.Bones[id].PivotPoint = new Float32Array(node.PivotPoint); });
  });
  const clean = openDocument(doc.serialize('mdx'), 'rig.mdx'), before = structuredClone(clean.model), result = solvePoseBody(clean.model, 0, [leg1, leg2].map(chain => ({ chain })), 500, 0, [.5, 0, -.5]);
  assert.deepEqual(solvePoseBody(clean.model, 0, [leg1, leg2].map(chain => ({ chain })), 500, 0, [0, 0, 0]).changes, []);
  clean.apply('Body', ['Nodes'], m => applyMovementPose(m, result.changes, 500, 0)); const after = structuredClone(clean.model);
  assert.ok(clean.undo()); assert.deepEqual(clean.model, before); assert.equal(clean.undo(), false); assert.ok(clean.redo()); assert.deepEqual(clean.model, after);
  for (const format of ['mdx', 'mdl']) { const reopened = openDocument(clean.serialize(format), `body.${format}`); for (const c of [leg1, leg2]) { const original = samplePoseChain(before, c, 500, 0), saved = samplePoseChain(reopened.model, c, 500, 0); vectorNear(saved.end.toArray(), original.end.toArray()); near(Math.abs(saved.rotations[2].dot(original.rotations[2])), 1, 1e-6); } }
  const failed = structuredClone(clean.model); assert.throws(() => clean.apply('Failed body', ['Nodes'], m => { const bad = [...result.changes, { id: 9, property: 'Translation', value: [NaN, 0, 0] }]; applyMovementPose(m, bad, 500, 0); })); assert.deepEqual(clean.model, failed); assert.ok(clean.undo()); assert.deepEqual(clean.model, before);
});


function connectedEdit(model, config, id, values, mode = 'move', frame = 500) {
  const target = { kind: id === config.body ? 'body' : 'node', id };
  return solvePoseNode(model, id, poseNodeConstraints(model, config, id, mode, target), frame, 0,
    { mode, space: 'world', values, control: poseNodeControl(model, config, target, mode) });
}
function jointPoints(model, frame = 500) {
  const matrices = sampleNodeMatrices(model, frame, 0, frame);
  return new Map(allNodes(model).map(node => [node.ObjectId, new Vector3(...(node.PivotPoint || model.PivotPoints[node.ObjectId])).applyMatrix4(matrices.get(node.ObjectId))]));
}
function connectedLengths(model, frame = 500) {
  const points = jointPoints(model, frame);
  return allNodes(model).filter(node => points.has(node.Parent)).map(node => points.get(node.ObjectId).distanceTo(points.get(node.Parent)));
}

test('Head and Chest grips bend connected SD joints instead of translating parts away', { skip: !fs.existsSync(nativeFixture) }, () => {
  const source = openDocument(fs.readFileSync(nativeFixture), 'Footman.mdx').model, config = { ...suggestPoseRig(source, 500, 0), pins: [] };
  for (const id of [33, 39]) for (const values of [[0, 3, 0], [4, -2, 1], [100, -80, 100]]) {
    const model = structuredClone(source), before = structuredClone(model), lengths = connectedLengths(model);
    const matrices = sampleNodeMatrices(model, 500, 0, 500), grip = poseControlPoint(model, config, id, matrices);
    assert.ok(grip.distanceTo(jointPoints(model).get(id)) > 1, 'grip lies on the visible part above its joint');
    const result = connectedEdit(model, config, id, values);
    assert.deepEqual(model, before); assert.ok(result.changes.length > 0);
    assert.ok(result.changes.every(change => change.property === 'Rotation'));
    apply(model, result); vectorNear(connectedLengths(model), lengths, .003);
    assert.ok(poseControlPoint(model, config, id, sampleNodeMatrices(model, 500, 0, 500)).distanceTo(grip) > .01);
    for (const node of allNodes(model)) {
      const old = allNodes(before).find(old => old.ObjectId === node.ObjectId);
      assert.deepEqual(node.Translation, old.Translation); assert.deepEqual(node.Scaling, old.Scaling); assert.deepEqual(node.PivotPoint, old.PivotPoint); assert.equal(node.Parent, old.Parent);
    }
    if (id === 39) assert.ok(result.changes.some(change => change.id === 33), 'head drag shares motion with the chest');
    else {
      const after = sampleNodeMatrices(model, 500, 0, 500), orientation = matrix => new Quaternion().setFromRotationMatrix(matrix).normalize();
      near(Math.abs(orientation(after.get(39)).dot(orientation(matrices.get(39)))), 1, 1e-6);
      assert.ok(jointPoints(model).get(39).distanceTo(jointPoints(before).get(39)) > .01, 'head follows chest position while keeping facing');
    }
  }
});

test('connected Head Move has native rotation scope and raw head markers keep normal translation', { skip: !fs.existsSync(nativeFixture) }, () => {
  const model = openDocument(fs.readFileSync(nativeFixture), 'Footman.mdx').model, config = { ...suggestPoseRig(model, 500, 0), pins: [] }, target = { kind: 'node', id: 39 };
  const scope = poseTrackScope(config, target, 'move', model), ids = scope.map(item => item.id);
  assert.ok(ids.includes(33) && ids.includes(39) && ids.includes(36) && ids.includes(34));
  assert.ok(scope.every(item => item.property === 'Rotation'));
  assert.deepEqual(poseTrackScope(config, { ...target, marker: true }, 'move', model), [{ id: 39, property: 'Translation' }]);
  assert.deepEqual(connectedEdit(model, config, 39, [0, 0, 0]).changes, []);
  assert.throws(() => { const result = connectedEdit(model, config, 39, [0, 3, 0]); applyMovementPose(model, result.changes, 500, 0, { rotation: true }); }, /restricted/);
  const before = structuredClone(model); applyMovementTransform(model, [39], 500, 0, { mode: 'move', space: 'world', values: [0, 1, 0] });
  const direct = structuredClone(model); assert.notDeepEqual(direct, before);
  assert.deepEqual(connectedEdit(model, config, 39, [0, 0, 0]).changes, [], 'returning from FK never restores an old head target');
});

test('multiple spine and neck joints share a head drag with continuous, fixed-length motion', () => {
  const model = fixture();
  for (const [id, name, parent, pivot] of [[10, 'Spine', 0, [0,0,12]], [11, 'Chest', 10, [0,0,17]], [12, 'Neck', 11, [0,0,22]], [13, 'Head', 12, [0,0,24]]]) {
    model.Bones.push({ ObjectId:id, Name:name, Parent:parent, PivotPoint:pivot, Flags:256 }); model.PivotPoints[id] = pivot;
  }
  const config = { body:0, nodes:[10,11,12,13], chains:[], pins:[] }, lengths = connectedLengths(model);
  assert.deepEqual(poseNodeControl(model, config, { kind:'node', id:13 }).joints, [10,11,12,13]);
  assert.deepEqual(poseNodeControl(model, { ...config, nodes:[] }, { kind:'node', id:13 }).joints, [], 'unmapped nodes retain ordinary controls');
  model.Bones.push({ObjectId:14,Name:'Helper01',Parent:11,PivotPoint:[0,0,19],Flags:256});model.PivotPoints[14]=[0,0,19];model.Bones.find(node=>node.ObjectId===12).Parent=14;
  assert.deepEqual(poseNodeControl(model,config,{kind:'node',id:13}).joints,[10,11,14,12,13]);
  const helperLengths=connectedLengths(model);
  let previous = null;
  for (let i=0;i<=40;i++) {
    const copy=structuredClone(model), result=connectedEdit(copy,config,13,[i*.1,0,0]); apply(copy,result);
    vectorNear(connectedLengths(copy),helperLengths,1e-4);
    const points=jointPoints(copy); if(previous) for(const id of [10,11,12,13]) assert.ok(points.get(id).distanceTo(previous.get(id))<.4,'small mouse steps do not flip the torso'); previous=points;
  }
});

test('upper-body explicit hand pins remain reachable without releasing or stretching', { skip: !fs.existsSync(nativeFixture) }, () => {
  const model = openDocument(fs.readFileSync(nativeFixture), 'Footman.mdx').model, config = { ...suggestPoseRig(model, 500, 0), pins: [] };
  config.pins=config.chains.filter(chain=>chain.kind==='arm').map(chain=>chain.key);
  const hands=config.chains.filter(chain=>chain.kind==='arm').map(chain=>({chain,pose:samplePoseChain(model,chain,500,0)}));
  apply(model,connectedEdit(model,config,39,[0,35,0]));
  for(const {chain,pose} of hands) { const after=samplePoseChain(model,chain,500,0);vectorNear(after.end.toArray(),pose.end.toArray(),.003);vectorNear(after.lengths,pose.lengths,.003); }
});

test('upper-body native keys survive history and MDL/MDX animation round trips with intact rig', { skip: !fs.existsSync(nativeFixture) }, () => {
  const doc=openDocument(fs.readFileSync(nativeFixture),'Footman.mdx'), original=structuredClone(doc.model), config={...suggestPoseRig(doc.model,500,0),pins:[]};
  const allowed=new Set();
  for(const [frame,id,values] of [[500,39,[0,4,0]],[850,33,[3,-2,0]],[1200,39,[-2,0,2]]]) {
    const result=connectedEdit(doc.model,config,id,values,'move',frame); result.changes.forEach(change=>allowed.add(change.id));
    doc.apply('Connected upper body',['Nodes'],model=>applyMovementPose(model,result.changes,frame,0));
  }
  const edited=structuredClone(doc.model); assert.ok(doc.undo());assert.ok(doc.redo());assert.deepEqual(doc.model,edited);
  const strip=model=>{const copy=structuredClone(model);for(const key of ['Nodes','Bones','Helpers','Attachments'])for(const node of copy[key]||[])if(node&&allowed.has(node.ObjectId))delete node.Rotation;return copy;};
  assert.deepEqual(strip(edited),strip(original));
  for(const format of ['mdl','mdx']) {
    const reopened=openDocument(doc.serialize(format),'connected.'+format);assertModelEquivalent(edited,reopened.model);assertModelEquivalent(strip(original),strip(reopened.model));
    for(const frame of [500,675,850,1025,1200])vectorNear(connectedLengths(reopened.model,frame),connectedLengths(original,frame),.004);
  }
});


test('a selected controller symbol keeps its drag when another handle label crosses it', () => {
  const body={kind:'body',label:'Body',x:50,y:40,visible:true}, hand={kind:'endpoint',key:'arm',label:'Hand',x:20,y:40,labelX:40,labelY:40,labelWidth:40,visible:true};
  assert.equal(pickPoseHandle([hand,body],50,40,{kind:'body'},[],true),body);
  assert.equal(pickPoseHandle([hand,body],65,40,{kind:'body'},[],true),body);
  assert.equal(pickPoseHandle([hand,body],75,40,{kind:'body'},[],true),hand,'label remains clickable outside the selected symbol');
  assert.equal(pickPoseHandle([hand,body],50,40,null,[],false),hand,'unselected label still selects its named control');
});
