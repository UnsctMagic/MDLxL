import test from 'node:test';
import assert from 'node:assert/strict';
import { clearQuickDisplay, defaultEditorDisplay, defaultPoseDisplay, setEditorDisplay, storedEditorDisplay, saveEditorDisplay } from '../src/display-overlays.js';
import { previewOverlayOptions, visibleMovementPoints } from '../app/preview-overlays.js';
import { boneHighlightColors } from '../app/rig-markers-gl.js';

// MDLxL look, owner's revised spec (14 Nov 2026): Objects and Lights replace Nodes and the per-kind switches.
test('Bones and Movement start with Objects on; Animations enables all effect categories and hides symbols', () => {
  const state = defaultEditorDisplay();
  const enabled = mode => Object.entries(state[mode]).filter(([key, on]) => on && !key.startsWith('boneTypes') && !key.startsWith('objectTypes')).map(([key]) => key);
  assert.deepEqual(enabled('vertices'), ['shaded', 'vertices']);
  // The shared rig Bones switch starts on; Movement also highlights the selected chain.
  assert.deepEqual(enabled('bones'), ['shaded', 'vertices', 'bones', 'helpers', 'objects']);
  assert.deepEqual([state.movement.bones, state.movement.focusedSkeleton, state.movement.skeleton, state.movement.objects, state.movement.lights], [true, true, false, true, false]);
  assert.equal(state.animations.bones, true);
  for (const mode of ['vertices', 'bones', 'movement', 'animations']) assert.equal(state[mode].nodes, undefined, mode);
  for(const key of ['particles','sounds','events']) {
    assert.equal(state.movement[key],undefined,key);assert.equal(state.animations[key],true,key);
  }
});

test('display switches belong to their respective editor', () => {
  const initial = defaultEditorDisplay();
  const bones = setEditorDisplay(initial, 'bones', 'bones', true);
  const skeleton = setEditorDisplay(bones, 'bones', 'skeleton', true);
  const movement = setEditorDisplay(skeleton, 'movement', 'lights', true);
  assert.equal(movement.bones.bones, true);
  assert.equal(movement.bones.skeleton, true);
  assert.equal(setEditorDisplay(initial, 'bones', 'bones', false).movement.bones, false);
  assert.equal(movement.movement.lights, true);
  assert.equal(movement.vertices.bones, false);
  assert.equal(movement.animations.skeleton, false);
  // Animations' Lights is its own switch (the light effect, not a symbol).
  assert.equal(movement.animations.lights, initial.animations.lights);
  assert.deepEqual(initial, defaultEditorDisplay());
});

test('XL: Bones, Movement and Animations share the Bones switch', () => {
  for (const vanilla of [false]) {
    const initial = defaultEditorDisplay(vanilla);
    const on = setEditorDisplay(initial, 'animations', 'bones', true);
    for (const editor of ['bones', 'movement', 'animations']) assert.equal(on[editor].bones, true, editor);
    assert.equal(on.vertices.bones, vanilla);
    assert.equal(on.movement.particles, initial.movement.particles);
    const off = setEditorDisplay(on, 'movement', 'bones', value => !value);
    for (const editor of ['bones', 'movement', 'animations']) assert.equal(off[editor].bones, false, editor);
    const cleared = clearQuickDisplay(setEditorDisplay(initial, 'bones', 'bones', true), 'bones');
    for (const editor of ['bones', 'movement', 'animations']) assert.equal(cleared[editor].bones, false, editor);
    assert.deepEqual(clearQuickDisplay(on, 'vertices').movement, on.movement);
  }
});

test('Bone markers and Skeleton retain independent controls', () => {
  const defaults = { ...defaultEditorDisplay().bones, bones: false };
  assert.deepEqual(
    [previewOverlayOptions({ ...defaults, nodes: true }).bones, previewOverlayOptions({ ...defaults, nodes: true }).boneLines],
    [false, false],
  );
  assert.deepEqual(
    [previewOverlayOptions({ ...defaults, skeleton: true }).bones, previewOverlayOptions({ ...defaults, skeleton: true }).boneLines],
    [false, true],
  );
});

test('Focused Skeleton uses only highlighted connectors and is exclusive with Skeleton', () => {
  const initial = defaultEditorDisplay();
  const skeleton = setEditorDisplay(initial, 'movement', 'skeleton', true);
  const focused = setEditorDisplay(skeleton, 'movement', 'focusedSkeleton', true);
  assert.equal(focused.movement.skeleton, false);
  assert.equal(focused.movement.focusedSkeleton, true);
  assert.deepEqual(
    [previewOverlayOptions(focused.movement).boneLines, previewOverlayOptions(focused.movement).focusedBoneLines, previewOverlayOptions(focused.movement).bones, previewOverlayOptions(focused.movement).focusedBoneMarkers],
    [true, true, true, true],
  );
  const whole = setEditorDisplay(focused, 'movement', 'skeleton', true);
  assert.equal(whole.movement.skeleton, true);
  assert.equal(whole.movement.focusedSkeleton, false);
});

test('Clear turns off only the active editor options', () => {
  const state = setEditorDisplay(defaultEditorDisplay(), 'bones', 'skeleton', true);
  const cleared = clearQuickDisplay(state, 'bones');
  assert.ok(Object.entries(cleared.bones).every(([key, enabled]) => key.startsWith('boneTypes') || key.startsWith('objectTypes') ? enabled : !enabled));
  assert.deepEqual(cleared.vertices, state.vertices);
  // Bones, Objects and Lights are shared by the rig editors, so only those switches follow the Clear.
  assert.deepEqual(cleared.movement, { ...state.movement, bones: false, helpers: false, objects: false, lights: false });
});

test('VIS keeps independent Bones, Attachment and Emitters switches in Bones and Movement only',()=>{
 const state=defaultEditorDisplay(true);
 for(const mode of ['bones','movement']) assert.equal(state[mode].particles,false);
 const emitters=previewOverlayOptions({...state.movement,bones:false,particles:true},false,'movement',true);
 assert.deepEqual([emitters.particles,emitters.attachments,emitters.bones,emitters.nodes,emitters.ribbons],[true,true,false,false,false]);
 // Hidden keys left over in Animations draw nothing there.
 const animations=previewOverlayOptions({...state.animations,bones:true,particles:true,attachments:true,nodes:true},false,'animations',true);
 assert.deepEqual([animations.bones,animations.particles,animations.attachments,animations.nodes,animations.boneLines],[false,false,false,false,false]);
});

test('POSE defaults hide symbols and geometry markers while preserving normal settings', () => {
  const normal = { ...defaultEditorDisplay().movement, shaded:false, grid:true, bones:true, nodes:true, attachments:true, particles:true, vertices:true, skeleton:true, wires:true };
  const before = structuredClone(normal), pose = defaultPoseDisplay(normal);
  for (const key of ['bones','nodes','attachments','particles','sounds','events','vertices','skeleton','wires','normals','cameras']) assert.equal(pose[key],false,key);
  assert.equal(pose.focusedSkeleton,true);assert.equal(pose.grid,true);assert.equal(pose.shaded,false);
  const changed = setEditorDisplay({ movement:pose },'movement','particles',true);
  assert.equal(changed.movement.particles,true);assert.deepEqual(normal,before);
  // POSE has no Helpers switch: helper markers (e.g. a Footman's head) follow Bones.
  const helper = { node:{ ObjectId:39 }, overlayKind:'bones', helperNode:true };
  assert.deepEqual(visibleMovementPoints([helper],previewOverlayOptions(defaultPoseDisplay({ ...normal, helpers:false }))),[]);
  const bones = setEditorDisplay({ movement:defaultPoseDisplay({ ...normal, helpers:false }) },'movement','bones',true).movement;
  assert.deepEqual(visibleMovementPoints([helper],previewOverlayOptions(bones)),[helper]);
  assert.deepEqual(visibleMovementPoints([helper],previewOverlayOptions(clearQuickDisplay({ movement:bones },'movement').movement)),[]);
});

test('Focused Skeleton bones can be clicked with Bones off', () => {
  const point = (ObjectId, Parent, overlayKind = 'bones') => ({ node: { ObjectId, Parent }, overlayKind });
  const points = [point(0), point(1, 0), point(2, 1), point(3, 2), point(4, 0), point(5, 1, 'attachments')];
  const options = previewOverlayOptions({ bones: false, focusedSkeleton: true, attachments: false });
  assert.equal(options.bones, false);
  // Bone 1 selected: parent 0, children 2 and 3 are shown and pickable; sibling 4 and the attachment are not.
  const ids = visibleMovementPoints(points, options, boneHighlightColors(points, [1])).map(item => item.node.ObjectId);
  assert.deepEqual(ids, [0, 1, 2, 3]);
  assert.deepEqual(visibleMovementPoints(points, options, boneHighlightColors(points, [])), []);
  assert.deepEqual(visibleMovementPoints(points, options).map(item => item.node.ObjectId), []);
  assert.deepEqual(visibleMovementPoints(points, previewOverlayOptions({ bones: true })).map(item => item.node.ObjectId), [0, 1, 2, 3, 4]);
});


test('Bones controls both marker types and persists in XL and VIS', () => {
  const storage = { value: null, getItem() { return this.value; }, setItem(_, value) { this.value = value; } };
  let state = storedEditorDisplay(false, storage);
  assert.deepEqual([state.bones.bones, state.bones.helpers, state.bones.objects], [true, true, true]);
  state = setEditorDisplay(state, 'bones', 'helpers', true);
  state = setEditorDisplay(state, 'bones', 'objectTypesSounds', false);
  state = setEditorDisplay(state, 'bones', 'bones', false);
  saveEditorDisplay(state, state, storage);
  const restored = storedEditorDisplay(false, storage), vis = storedEditorDisplay(true, storage);
  for (const mode of ['bones', 'movement', 'animations']) {
    assert.deepEqual([restored[mode].bones, restored[mode].helpers], [false, false]);
    if (mode !== 'animations') assert.deepEqual([restored[mode].objects, restored[mode].objectTypesSounds], [true, false]);
    // VIS: Bones and Attachment exist in Bones and Movement only.
    assert.deepEqual([vis[mode].bones, vis[mode].helpers, vis[mode].attachments], mode === 'animations' ? [undefined, undefined, undefined] : [false, false, true]);
  }
  const points = [
    { node: { ObjectId: 0 }, overlayKind: 'bones' },
    { node: { ObjectId: 1, Parent: 0 }, overlayKind: 'bones', helperNode: true },
    { node: { ObjectId: 2, Parent: 1 }, overlayKind: 'attachments' },
  ];
  const opts = previewOverlayOptions(restored.bones);
  assert.deepEqual(visibleMovementPoints(points, opts).map(p => p.node.ObjectId), [2]);
  assert.equal(boneHighlightColors(points, [2]).get(2), '#ff0000', 'a directly selected ref has a selection highlight');
  assert.deepEqual(visibleMovementPoints(points, { bones: true, helpers: false, attachments: false }).map(p => p.node.ObjectId), [0]);
});


test('Focused Skeleton retains helper joints in the selected chain with ordinary helpers hidden', () => {
  const points = [
    { node: { ObjectId: 0 }, overlayKind: 'bones', helperNode: true },
    { node: { ObjectId: 1, Parent: 0 }, overlayKind: 'bones' },
    { node: { ObjectId: 2, Parent: 1 }, overlayKind: 'bones', helperNode: true },
    { node: { ObjectId: 3 }, overlayKind: 'bones', helperNode: true },
  ];
  const options = previewOverlayOptions({ bones: false, helpers: false, focusedSkeleton: true });
  const focus = boneHighlightColors(points, [1]);
  assert.deepEqual(visibleMovementPoints(points, options, focus).map(point => point.node.ObjectId), [0,1,2]);
});
