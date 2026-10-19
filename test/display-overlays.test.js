import test from 'node:test';
import assert from 'node:assert/strict';
import { clearQuickDisplay, defaultEditorDisplay, defaultPoseDisplay, setEditorDisplay } from '../src/display-overlays.js';
import { previewOverlayOptions } from '../app/preview-overlays.js';

test('Movement enables only Emitters; Animations enables all effect categories and hides symbols', () => {
  const state = defaultEditorDisplay();
  for (const mode of ['vertices', 'bones']) {
    assert.deepEqual(Object.entries(state[mode]).filter(([, enabled]) => enabled).map(([key]) => key), ['shaded', 'vertices']);
  }
  assert.equal(state.movement.nodes,false);
  assert.equal(state.animations.nodes,false);
  for(const key of ['particles','sounds','events']) {
    assert.equal(state.movement[key],key==='particles',key);assert.equal(state.animations[key],true,key);
  }
});

test('display switches belong to their respective editor', () => {
  const initial = defaultEditorDisplay();
  const bones = setEditorDisplay(initial, 'bones', 'bones', true);
  const skeleton = setEditorDisplay(bones, 'bones', 'skeleton', true);
  const movement = setEditorDisplay(skeleton, 'movement', 'nodes', true);
  assert.equal(movement.bones.bones, true);
  assert.equal(movement.bones.skeleton, true);
  assert.equal(movement.movement.nodes, true);
  assert.equal(movement.vertices.bones, false);
  assert.equal(movement.animations.skeleton, false);
  assert.equal(movement.animations.nodes, false);
  assert.deepEqual(initial, defaultEditorDisplay());
});

test('Bones, Movement and Animations share the Bones switch', () => {
  for (const vanilla of [false, true]) {
    const initial = defaultEditorDisplay(vanilla);
    const on = setEditorDisplay(initial, 'animations', 'bones', true);
    for (const editor of ['bones', 'movement', 'animations']) assert.equal(on[editor].bones, true, editor);
    assert.equal(on.vertices.bones, false);
    assert.equal(on.movement.particles, initial.movement.particles);
    const off = setEditorDisplay(on, 'movement', 'bones', value => !value);
    for (const editor of ['bones', 'movement', 'animations']) assert.equal(off[editor].bones, false, editor);
    const cleared = clearQuickDisplay(setEditorDisplay(initial, 'bones', 'bones', true), 'bones');
    for (const editor of ['bones', 'movement', 'animations']) assert.equal(cleared[editor].bones, false, editor);
    assert.deepEqual(clearQuickDisplay(on, 'vertices').movement, on.movement);
  }
});

test('Bone markers and Skeleton retain independent controls', () => {
  const defaults = defaultEditorDisplay().bones;
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
    [true, true, false, true],
  );
  const whole = setEditorDisplay(focused, 'movement', 'skeleton', true);
  assert.equal(whole.movement.skeleton, true);
  assert.equal(whole.movement.focusedSkeleton, false);
});

test('Clear turns off only the active editor options', () => {
  const state = setEditorDisplay(defaultEditorDisplay(), 'bones', 'skeleton', true);
  const cleared = clearQuickDisplay(state, 'bones');
  assert.ok(Object.values(cleared.bones).every(enabled => !enabled));
  assert.deepEqual(cleared.vertices, state.vertices);
  assert.deepEqual(cleared.movement, state.movement);
});

test('VIS retains the original independent Nodes, Emitters and Attachment display flags',()=>{
 const state=defaultEditorDisplay(true);
 for(const mode of ['vertices','bones','movement','animations']){
  assert.equal(state[mode].particles,false);assert.equal(state[mode].nodes,false);
  assert.equal(state[mode].events,undefined);assert.equal(state[mode].sounds,undefined);
 }
 const nodes=previewOverlayOptions({...state.movement,nodes:true},false,'movement',true);
 assert.equal(nodes.nodes,true);assert.equal(nodes.particles,false);assert.equal(nodes.bones,false);
 const emitters=previewOverlayOptions({...state.animations,particles:true},false,'animations',true);
 assert.equal(emitters.particles,true);assert.equal(emitters.nodes,false);
});

test('POSE defaults hide symbols and geometry markers while preserving normal settings', () => {
  const normal = { ...defaultEditorDisplay().movement, shaded:false, grid:true, bones:true, nodes:true, attachments:true, particles:true, vertices:true, skeleton:true, wires:true };
  const before = structuredClone(normal), pose = defaultPoseDisplay(normal);
  for (const key of ['bones','nodes','attachments','particles','sounds','events','vertices','skeleton','wires','normals','cameras']) assert.equal(pose[key],false,key);
  assert.equal(pose.focusedSkeleton,true);assert.equal(pose.grid,true);assert.equal(pose.shaded,false);
  const changed = setEditorDisplay({ movement:pose },'movement','particles',true);
  assert.equal(changed.movement.particles,true);assert.deepEqual(normal,before);
});
