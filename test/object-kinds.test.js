import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { PerspectiveCamera } from 'three';
import { OBJECT_KINDS, OBJECT_KIND_KEYS, EDITOR_KINDS, ANIMATION_EFFECT_KINDS, objectKind, objectSymbol, objectOverlayOptions, migrateObjectDisplay } from '../src/object-kinds.js';
import { defaultEditorDisplay, defaultPoseDisplay, storedEditorDisplay, saveEditorDisplay } from '../src/display-overlays.js';
import { previewOverlayOptions, visibleMovementPoints, hasObjectMarkers } from '../app/preview-overlays.js';
import { viewportOverlayOptions } from '../app/viewport-overlays.js';
import { projectMovementNodes, pickMovementNode } from '../app/movement-overlay.js';
import { rigMarkerVisible } from '../app/rig-markers-gl.js';
import { allNodes } from '../src/animation.js';

const VIEW_MENU = createRequire(import.meta.url)('../src/view-menu.json');
const LABELS = OBJECT_KINDS.map(kind => kind.label);

// One of everything an editor can show.
const mixedModel = () => ({
  Sequences: [], GlobalSequences: [], PivotPoints: Array.from({ length: 14 }, (_, id) => [id * 10, 0, 0]),
  Bones: [{ ObjectId: 0, Name: 'Root' }], Helpers: [{ ObjectId: 1, Name: 'Helper', Parent: 0 }],
  Attachments: [{ ObjectId: 2, Name: 'Hand Ref' }],
  ParticleEmitters: [{ ObjectId: 3, Name: 'Old' }], ParticleEmitters2: [{ ObjectId: 4, Name: 'Sparks' }],
  ParticleEmitterPopcorns: [{ ObjectId: 5, Name: 'Pop' }], RibbonEmitters: [{ ObjectId: 6, Name: 'Trail' }],
  EventObjects: [{ ObjectId: 7, Name: 'SNDxSWIN' }, { ObjectId: 8, Name: 'SPLxBLOD' }, { ObjectId: 9, Name: 'FPTxFOOT' }, { ObjectId: 10, Name: 'UBRxUBER' }, { ObjectId: 11, Name: 'OddEvent' }],
  Lights: [{ ObjectId: 12, Name: 'Lamp' }], CollisionShapes: [{ ObjectId: 13, Name: 'Hit' }],
});
const camera = () => { const c = new PerspectiveCamera(50, 1, 1, 2000); c.position.set(65, -400, 0); c.up.set(0, 0, 1); c.lookAt(65, 0, 0); c.updateMatrixWorld(true); c.updateProjectionMatrix(); return c; };
const points = model => projectMovementNodes(model, 0, -1, camera(), 800, 800, 0, new Map());

test('the switch list is Bones, Attachments, Emitters, Events, Sounds, Lights, Collision; nothing is called Nodes', () => {
  assert.deepEqual(LABELS, ['Bones', 'Attachments', 'Emitters', 'Events', 'Sounds', 'Lights', 'Collision']);
  assert.deepEqual(OBJECT_KIND_KEYS, ['bones', 'attachments', 'particles', 'events', 'sounds', 'lights', 'collision']);
  for (const kind of OBJECT_KINDS) assert.ok(kind.tip && kind.collections.length, kind.key);
});

test('every object of a mixed model has exactly one kind, the same in XL and ViS', () => {
  const model = mixedModel(), kinds = objectKind(model);
  assert.equal(kinds.size, allNodes(model).length);
  for (const node of allNodes(model)) assert.ok(OBJECT_KIND_KEYS.includes(kinds.get(node.ObjectId)), node.Name);
  assert.deepEqual(allNodes(model).map(node => node.ObjectId).sort((a, b) => a - b).map(id => kinds.get(id)), ['bones', 'bones', 'attachments', 'particles', 'particles', 'particles', 'particles',
    'sounds', 'events', 'events', 'events', 'events', 'lights', 'collision']);
  assert.equal(kinds.get(6), 'particles', 'ribbons share the Emitters switch');
  assert.equal(kinds.get(7), 'sounds'); assert.equal(kinds.get(11), 'events', 'odd events are Events, not a leftover pile');
  assert.equal(kinds.get(12), 'lights'); assert.equal(kinds.get(13), 'collision');
  // Ribbons and the named events keep their own symbol.
  assert.deepEqual([...objectSymbol(model)], [[6, 'ribbons'], [8, 'blood'], [9, 'foot'], [10, 'uber']]);
  for (const point of points(model)) assert.ok(OBJECT_KIND_KEYS.includes(point.overlayKind), `${point.node.Name} has a kind`);
});

test('each editor menu is an ordered part of the list with the same names', () => {
  const kindRows = mode => VIEW_MENU[mode].filter(([, action]) => OBJECT_KIND_KEYS.includes(action.replace('display:', '')));
  for (const mode of Object.keys(VIEW_MENU)) {
    assert.ok(!VIEW_MENU[mode].some(([label, action]) => label === 'Nodes' || action === 'display:nodes'), `${mode} has no Nodes switch`);
    const rows = kindRows(mode), keys = rows.map(([, action]) => action.replace('display:', ''));
    assert.deepEqual(keys, OBJECT_KIND_KEYS.filter(key => keys.includes(key)), `${mode} keeps the shared order`);
    for (const [label, action] of rows) assert.equal(label, OBJECT_KINDS.find(kind => 'display:' + kind.key === action).label, `${mode} ${action}`);
  }
  assert.deepEqual(kindRows('vertices').map(row => row[0]), ['Bones']);
  assert.deepEqual(kindRows('bones').map(row => row[0]), LABELS);
  assert.deepEqual(kindRows('movement').map(row => row[0]), LABELS);
  assert.deepEqual(VIEW_MENU.animations.map(row => row[0]), ['Emitters', 'Events', 'Sounds', 'Wireframe', 'Grid', 'Clear']);
  assert.deepEqual(kindRows('animations').map(row => row[1].replace('display:', '')), ANIMATION_EFFECT_KINDS);
  // Every switch an editor offers is a switch it remembers.
  for (const vanilla of [false, true]) for (const mode of Object.keys(VIEW_MENU)) for (const [, action] of kindRows(mode))
    assert.equal(typeof defaultEditorDisplay(vanilla)[mode][action.replace('display:', '')], 'boolean', `${mode} ${action}`);
});

test('Bones and Movement can show and pick lights and collision', () => {
  const model = mixedModel(), all = points(model);
  for (const editor of ['bones', 'movement']) for (const key of ['lights', 'collision']) {
    const off = previewOverlayOptions({ ...defaultEditorDisplay()[editor] }, true, editor);
    const on = previewOverlayOptions({ ...defaultEditorDisplay()[editor], [key]: true }, true, editor);
    const target = all.find(point => point.overlayKind === key);
    assert.equal(visibleMovementPoints(all, off).includes(target), false, `${editor} ${key} hidden by default`);
    assert.equal(visibleMovementPoints(all, on).includes(target), true, `${editor} ${key} shown by its switch`);
    assert.equal(rigMarkerVisible(target, on, new Map()), true, `${editor} ${key} marker drawn`);
    assert.equal(pickMovementNode(visibleMovementPoints(all, on), target.x, target.y)?.node.ObjectId, target.node.ObjectId, `${editor} ${key} can be clicked`);
  }
});

test('each switch shows its own kind and no other', () => {
  const all = points(mixedModel());
  for (const key of OBJECT_KIND_KEYS) {
    const shown = visibleMovementPoints(all, previewOverlayOptions({ ...defaultEditorDisplay().movement, bones: false, helpers: false, focusedSkeleton: false, particles: false, [key]: true, ...(key === 'bones' && { helpers: true }) }, true, 'movement'));
    assert.deepEqual([...new Set(shown.map(point => point.overlayKind))], [key], key);
    assert.equal(shown.length, all.filter(point => point.overlayKind === key).length, key);
  }
});

test('Animations draws no symbols or skeleton whatever is switched on', () => {
  const all = points(mixedModel()), everything = Object.fromEntries([...OBJECT_KIND_KEYS, 'helpers', 'skeleton', 'focusedSkeleton'].map(key => [key, true]));
  const options = previewOverlayOptions(everything, true, 'animations');
  assert.equal(hasObjectMarkers(options), false);
  assert.deepEqual([options.boneLines, options.focusedBoneLines, options.focusedBoneMarkers], [false, false, false]);
  assert.deepEqual(visibleMovementPoints(all, options), []);
  assert.deepEqual(EDITOR_KINDS.animations, []);
  const display = defaultEditorDisplay().animations;
  assert.deepEqual(ANIMATION_EFFECT_KINDS.map(key => display[key]), [true, true, true]);
  for (const key of ['bones', 'helpers', 'skeleton', 'focusedSkeleton', 'attachments', 'lights', 'collision']) assert.equal(key in display, false, key);
});

test('Vertex shows bones only, in XL and ViS', () => {
  const everything = Object.fromEntries([...OBJECT_KIND_KEYS, 'helpers', 'skeleton'].map(key => [key, true]));
  const options = viewportOverlayOptions({ editorDisplayMode: 'vertices', overlays: everything });
  assert.deepEqual(OBJECT_KIND_KEYS.filter(key => options[key]), ['bones']);
  assert.equal(options.boneLines, false);
  for (const vanilla of [false, true]) {
    const display = defaultEditorDisplay(vanilla).vertices;
    assert.deepEqual(OBJECT_KIND_KEYS.filter(key => key in display), ['bones'], vanilla ? 'ViS' : 'XL');
    assert.equal(display.bones, vanilla, 'ViS Vertex shows bones as before');
  }
});

test('the preview and the vertex viewport answer the same for the same switches', () => {
  for (const key of OBJECT_KIND_KEYS) {
    const overlays = { ...Object.fromEntries(OBJECT_KIND_KEYS.map(kind => [kind, false])), helpers: false, [key]: true };
    const preview = previewOverlayOptions(overlays, false, 'bones'), viewport = viewportOverlayOptions({ overlays, editorDisplayMode: 'bones' });
    for (const kind of [...OBJECT_KIND_KEYS, 'helpers']) assert.equal(preview[kind], viewport[kind], `${key} → ${kind}`);
    assert.deepEqual(objectOverlayOptions(overlays, { editor: 'bones' }), Object.fromEntries([...OBJECT_KIND_KEYS, 'helpers'].map(kind => [kind, preview[kind]])));
  }
});

test('tool windows that set no new switches still show no markers', () => {
  // Attachemator, Auto Corpse, EMTR, Showcase and the others pass their own small sets.
  for (const overlays of [{}, { bones: false, particles: false, attachments: false }, { grid: false, axes: false, boneLines: false }, { attachments: false, bones: false, helpers: false, particles: false, sounds: false, events: false, skeleton: false, focusedSkeleton: false }])
    assert.equal(hasObjectMarkers(previewOverlayOptions(overlays)), false, JSON.stringify(overlays));
  const attachemator = previewOverlayOptions({ attachments: true, bones: false, helpers: false, particles: false, sounds: false, events: false, skeleton: false, focusedSkeleton: true });
  assert.deepEqual([...OBJECT_KIND_KEYS, 'helpers'].filter(key => attachemator[key]), ['attachments']);
  const blood = previewOverlayOptions({ attachments: false, bones: false, helpers: false, particles: false, sounds: false, events: true, skeleton: false, focusedSkeleton: false });
  assert.deepEqual([...OBJECT_KIND_KEYS, 'helpers'].filter(key => blood[key]), ['events']);
});

const storage = initial => { const data = new Map(Object.entries(initial || {})); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), data }; };
const saved = value => storage({ 'mdlxl-editor-display': JSON.stringify(value) });

test('saved switches from before Lights and Collision carry over', () => {
  assert.deepEqual(migrateObjectDisplay({ nodes: true, events: false }), { events: false, lights: true, collision: true });
  assert.deepEqual(migrateObjectDisplay({ nodes: true }, true), { lights: true, collision: true, events: true, sounds: true });
  assert.deepEqual(migrateObjectDisplay({ bones: true }), { bones: true }, 'already current');
  const old = mode => ({ xl: { [mode]: { bones: false, nodes: true, particles: false, sounds: true, events: false, attachments: true, grid: true } },
    vis: { [mode]: { bones: true, nodes: true, particles: true, attachments: false } } });
  const xl = storedEditorDisplay(false, saved(old('movement'))).movement;
  assert.deepEqual([xl.lights, xl.collision, xl.events, xl.sounds, xl.particles, xl.attachments, xl.bones, xl.helpers, xl.grid], [true, true, false, true, false, true, false, false, true]);
  assert.equal('nodes' in xl, false);
  const vis = storedEditorDisplay(true, saved(old('movement'))).movement;
  assert.deepEqual([vis.lights, vis.collision, vis.events, vis.sounds, vis.particles, vis.attachments], [true, true, true, true, true, false], 'ViS kept every event under Nodes');
  const off = storedEditorDisplay(false, saved({ xl: { bones: { nodes: false } } })).bones;
  assert.deepEqual([off.lights, off.collision], [false, false]);
});

test('with nothing saved, or a current save, the defaults and choices stand', () => {
  for (const vanilla of [false, true]) {
    assert.deepEqual(storedEditorDisplay(vanilla, storage()), defaultEditorDisplay(vanilla));
    const store = storage(), xl = defaultEditorDisplay(), vis = defaultEditorDisplay(true);
    xl.bones.lights = true; vis.bones.collision = true; xl.animations.sounds = false;
    saveEditorDisplay(xl, vis, store);
    assert.deepEqual(storedEditorDisplay(false, store), xl); assert.deepEqual(storedEditorDisplay(true, store), vis);
  }
});

test('switches an editor no longer owns are dropped; ViS Animations keeps showing its effects', () => {
  const old = { bones: true, helpers: true, skeleton: true, focusedSkeleton: true, nodes: true, attachments: true, particles: false, sounds: false, events: false, wires: true };
  const xl = storedEditorDisplay(false, saved({ xl: { animations: old, vertices: { ...old, particles: true } } }));
  assert.deepEqual(Object.keys(xl.animations).sort(), Object.keys(defaultEditorDisplay().animations).sort());
  assert.deepEqual([xl.animations.particles, xl.animations.sounds, xl.animations.events, xl.animations.wires], [false, false, false, true], 'XL choices already hid the real effects');
  assert.deepEqual(OBJECT_KIND_KEYS.filter(key => key in xl.vertices), ['bones']);
  // In ViS the old Emitters switch only showed a symbol; the effects always played.
  const vis = storedEditorDisplay(true, saved({ vis: { animations: old } })).animations;
  assert.deepEqual([vis.particles, vis.sounds, vis.events, vis.wires], [true, true, true, true]);
});

test('POSE starts clean and carries no Nodes switch', () => {
  const pose = defaultPoseDisplay({ ...defaultEditorDisplay().movement, nodes: true, lights: true });
  assert.equal('nodes' in pose, false);
  assert.deepEqual(OBJECT_KIND_KEYS.filter(key => pose[key]), []);
  assert.equal(pose.focusedSkeleton, true);
});
