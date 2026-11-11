import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera } from 'three';
import { pickPoseHandle, poseHandleKey, poseTargetKey, projectPoseHandles } from '../app/pose-overlay.js';

const chain = { root: 1, middle: 2, end: 3, kind: 'arm', key: 'limb:3' }, leg = { root: 4, middle: 5, end: 6, kind: 'leg', key: 'limb:6' };
function fixture() {
  const pivots = [[0, 0, 10], [0, 0, 18], [8, 0, 20], [14, 0, 18], [0, -3, 10], [2, -3, 5], [0, -3, 0], [0, 3, 10]];
  const parents = [null, 0, 1, 2, 0, 4, 5, 0];
  return { Bones: pivots.map((PivotPoint, ObjectId) => ({ ObjectId, Name: `Odd ${ObjectId}`, Parent: parents[ObjectId], PivotPoint, Flags: 256 })), Helpers: [], PivotPoints: pivots, GlobalSequences: [], Sequences: [{ Name: 'A', Interval: [100, 1000], MoveSpeed: 0, NonLooping: false, Rarity: 0 }], Geosets: [] };
}
const camera = new PerspectiveCamera(42, 1, .1, 1000); camera.position.set(50, -100, 60); camera.lookAt(0, 0, 10); camera.updateMatrixWorld();
const project = config => projectPoseHandles(fixture(), config, 500, 0, camera, 600, 600);
const base = { enabled: true, chains: [chain, leg], body: 0, nodes: [7], roles: { 7: 'Head' }, pins: ['limb:6'], target: null };
const others = handles => handles.filter(handle => !handle.hidden).map(({ hidden, ...rest }) => rest);

test('a hidden endpoint, body and part handle are flagged, kept in the array and never picked', () => {
  const plain = project(base);
  assert.ok(plain.every(handle => !handle.hidden), 'nothing is hidden by default');
  for (const [id, find] of [['limb:3', h => h.kind === 'endpoint' && h.key === 'limb:3'], ['body', h => h.kind === 'body'], ['node:7', h => h.kind === 'node' && h.id === 7 && !h.quiet]]) {
    const handles = project({ ...base, hidden: [id] }), hiddenHandle = handles.find(find);
    assert.ok(hiddenHandle, `${id} stays in the array for skeleton and pin maths`);
    assert.equal(hiddenHandle.hidden, true, `${id} is flagged hidden`);
    assert.equal(poseHandleKey(hiddenHandle), id);
    assert.equal(handles.filter(h => h.hidden).length, 1, 'only the named handle is hidden');
    const hit = pickPoseHandle(handles, hiddenHandle.x, hiddenHandle.y);
    assert.notEqual(hit, hiddenHandle, `${id} cannot be picked at its exact position`);
    assert.ok(!hit || !hit.hidden);
    hiddenHandle.hovered = true;
    assert.notEqual(pickPoseHandle(handles, hiddenHandle.x + 24, hiddenHandle.y), hiddenHandle, `${id} has no label hit area`);
    hiddenHandle.hovered = false;
    assert.deepEqual(others(handles), others(plain.filter(h => poseHandleKey(h) !== id)), 'the other handles are identical to the result without hidden');
  }
});

test('a hidden selected limb offers no bend handle and is not selected', () => {
  const target = { kind: 'endpoint', key: 'limb:3' };
  const shown = project({ ...base, target });
  assert.ok(shown.some(h => h.kind === 'bend'), 'a visible selected limb has a bend handle');
  const handles = project({ ...base, target, hidden: ['limb:3'] });
  assert.ok(!handles.some(h => h.kind === 'bend'), 'no bend handle for a hidden limb');
  assert.ok(!handles.some(h => h.selected), 'a hidden handle is not selected');
  const bend = { kind: 'bend', key: 'limb:3' };
  assert.ok(!project({ ...base, target: bend, hidden: ['limb:3'] }).some(h => h.kind === 'bend'));
});

test('hidden identities: bend handles and unmapped markers have none; targets map to their handle', () => {
  const handles = project({ ...base, target: { kind: 'endpoint', key: 'limb:3' } });
  assert.equal(poseHandleKey(handles.find(h => h.kind === 'bend')), null);
  assert.ok(handles.filter(h => h.quiet).every(h => poseHandleKey(h) === null));
  assert.equal(poseTargetKey({ kind: 'endpoint', key: 'limb:3' }), 'limb:3');
  assert.equal(poseTargetKey({ kind: 'bend', key: 'limb:3' }), 'limb:3');
  assert.equal(poseTargetKey({ kind: 'body' }), 'body');
  assert.equal(poseTargetKey({ kind: 'node', id: 7 }), 'node:7');
  assert.equal(poseTargetKey({ kind: 'node', id: 7, marker: true }), null);
  assert.equal(poseTargetKey(null), null);
});
