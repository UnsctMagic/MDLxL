// MDLxL look: the Objects switch, its right-click types, Lights, the per-editor
// switch lists and old saves (owner's spec, 14 Nov 2026). A clicked object's diamonds: object-diamonds.test.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { parseCompatibleMdx } from '../src/mdx-compatibility.js';
import VIS_VIEW_MENU from '../src/view-menu.json' with { type: 'json' };
import XL_VIEW_MENU from '../src/view-menu-xl.json' with { type: 'json' };
import { clearQuickDisplay, defaultEditorDisplay, defaultPoseDisplay, setEditorDisplay, storedEditorDisplay } from '../src/display-overlays.js';
import { previewOverlayOptions, visibleMovementPoints, movementNodeCategories } from '../app/preview-overlays.js';
import { viewportOverlayOptions } from '../app/viewport-overlays.js';
import { MOVEMENT_EDITABLE_KINDS, xlObjectKinds } from '../src/object-display.js';

const require = createRequire(import.meta.url);
const { fixturePath } = require('./helpers/fixtures.cjs');
const { buildMenuTemplate } = require('../electron/menu.cjs');
const loadMdx = name => {
  const file = fixturePath(name); assert.ok(file && fs.existsSync(file), `fixture missing: ${file}`);
  const bytes = fs.readFileSync(file); return parseCompatibleMdx(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length));
};
const rows = (menu, mode) => menu[mode].map(([label]) => label);

// VIS = MDLVis 1.40 (owner, 14 Nov 2026): Shading, Vertices, Normals, Grid, Axes
// everywhere (Animations keeps no Axis guides, as before); the Objects submenu only in
// the Skeleton and Motion tabs. Copied here so a change to the VIS lists fails.
const VIEW = [['Shadows','shaded'], ['Vertices','showVertices'], ['Normals','normals'], ['Grid','grid']];
const OBJECTS = [['Bones','display:bones'], ['Attachment','display:attachments'], ['Emitters','display:particles'], ['Skeleton','display:skeleton']];
const MDLVIS_VIEW_MENU = {
  vertices: [...VIEW, ['Axis guides','axes'], ['Clear','clearDisplay']],
  bones: [...VIEW, ['Axis guides','axes'], ...OBJECTS, ['Clear','clearDisplay']],
  movement: [...VIEW, ['Axis guides','axes'], ...OBJECTS, ['Clear','clearDisplay']],
  animations: [...VIEW, ['Clear','clearDisplay']],
};

test('XL switch lists follow the owner\'s order in each editor; VIS has MDLVis 1.40\'s lists', () => {
  assert.deepEqual(rows(XL_VIEW_MENU, 'vertices'), ['Shadows', 'RGB', 'Vertices', 'Normals', 'Objects', 'Wireframe Overlay', 'Axis guides', 'Grid', 'Clear']);
  assert.deepEqual(rows(XL_VIEW_MENU, 'bones'), ['Shadows', 'Vertices', 'Bones', 'Skeleton', 'Objects', 'Lights', 'Wireframe Overlay', 'Axis guides', 'Grid', 'Clear']);
  assert.deepEqual(rows(XL_VIEW_MENU, 'movement'), ['Shadows', 'Vertices', 'Bones', 'Skeleton', 'F.Skeleton', 'Objects', 'Lights', 'Axis guides', 'Grid', 'Clear']);
  assert.deepEqual(rows(XL_VIEW_MENU, 'animations'), ['RGB', 'Shadows', 'Lights', 'Emitters', 'Events', 'Sounds', 'Grid', 'Clear']);
  assert.deepEqual(VIS_VIEW_MENU, MDLVIS_VIEW_MENU);
  // The native View menu follows the look.
  for (const mode of Object.keys(MDLVIS_VIEW_MENU)) {
    const labels = vanilla => buildMenuTemplate({}, () => {}, 'win32', [], value => value, { viewMode: mode, vanilla }).find(menu => menu.label === 'View').submenu.map(item => item.label);
    assert.deepEqual(labels(true), MDLVIS_VIEW_MENU[mode].map(([label]) => label), mode);
    assert.deepEqual(labels(false), rows(XL_VIEW_MENU, mode), mode);
  }
});

test('VIS display defaults are MDLVis\'s: Bones and Attachment on, Emitters and Skeleton off', () => {
  const vis = defaultEditorDisplay(true);
  for (const mode of ['vertices', 'bones', 'movement', 'animations']) for (const key of ['objects', 'lights', 'nodes', 'focusedSkeleton', 'wires', 'events', 'sounds', 'cameras'])
    assert.equal(vis[mode][key], undefined, mode + ' ' + key);
  for (const mode of ['bones', 'movement']) assert.deepEqual([vis[mode].bones, vis[mode].helpers, vis[mode].attachments, vis[mode].particles, vis[mode].skeleton], [true, true, true, false, false], mode);
  for (const mode of ['vertices', 'animations']) assert.deepEqual(Object.keys(vis[mode]).sort(), ['grid', 'normals', 'shaded', 'vertices'], mode);
});

const model = loadMdx('sd-chaos-orc');
const kinds = xlObjectKinds(model);
const idsOf = kind => [...kinds].filter(([, value]) => value === kind).map(([id]) => id);
const points = [...kinds.keys(), ...(model.CollisionShapes || []).map(node => node.ObjectId)].map(id => ({ node: { ObjectId: id }, overlayKind: kinds.get(id) || 'nodes' }));
const shown = options => new Set(visibleMovementPoints(points, options).map(point => point.overlayKind));

test('the fixture has every object kind the switches cover', () => {
  for (const kind of ['bones', 'attachments', 'particles', 'events', 'sounds', 'lights']) assert.ok(idsOf(kind).length, kind);
  // Odd events (SPN here) are events in XL; VIS keeps main's classification.
  const odd = model.EventObjects.find(node => node.Name.startsWith('SPN'));
  assert.equal(kinds.get(odd.ObjectId), 'events');
  assert.equal(movementNodeCategories(model, true).has(odd.ObjectId), false);
});

test('Objects shows attachments, emitters, events and sounds; Lights is its own switch; collision never', () => {
  const display = defaultEditorDisplay();
  assert.deepEqual(shown(previewOverlayOptions(display.movement, false, 'movement')), new Set(['bones', 'attachments', 'particles', 'events', 'sounds']));
  const lights = setEditorDisplay(display, 'movement', 'lights', true);
  assert.deepEqual(shown(previewOverlayOptions(lights.movement, false, 'movement')), new Set(['bones', 'attachments', 'particles', 'events', 'sounds', 'lights']));
  // Lights is shared with Bones, like the Bones switch.
  assert.equal(lights.bones.lights, true);
  const off = setEditorDisplay(lights, 'movement', 'objects', false);
  assert.deepEqual(shown(previewOverlayOptions(off.movement, false, 'movement')), new Set(['bones', 'lights']));
  assert.equal(off.bones.objects, false);
  assert.ok(!shown(previewOverlayOptions(lights.bones, false, 'bones')).has('nodes'));
});

test('right-click types filter what Objects draws and picks, shared between Bones and Movement', () => {
  let display = defaultEditorDisplay();
  display = setEditorDisplay(display, 'bones', 'objectTypesSounds', value => !value);
  display = setEditorDisplay(display, 'bones', 'objectTypesAttachments', value => !value);
  assert.equal(display.movement.objectTypesSounds, false);
  assert.deepEqual(shown(previewOverlayOptions(display.movement, false, 'movement')), new Set(['bones', 'particles', 'events']));
  display = setEditorDisplay(display, 'movement', 'objectTypesEmitters', false);
  display = setEditorDisplay(display, 'movement', 'objectTypesEvents', false);
  assert.deepEqual(shown(previewOverlayOptions(display.bones, false, 'bones')), new Set(['bones']));
  // Clear keeps the checkbox choices, like Bones' Helpers/Bones.
  const cleared = clearQuickDisplay(display, 'movement');
  assert.equal(cleared.movement.objects, false); assert.equal(cleared.bones.objects, false);
  assert.equal(cleared.movement.objectTypesSounds, false); assert.equal(cleared.movement.objectTypesEvents, false);
});

test('Vertices: Objects starts off and never shows lights; Animations draws no symbols', () => {
  const display = defaultEditorDisplay();
  assert.equal(display.vertices.objects, false);
  const on = setEditorDisplay(display, 'vertices', 'objects', true);
  const vertex = viewportOverlayOptions({ overlays: on.vertices, vanilla: false });
  assert.deepEqual(shown(vertex), new Set(['attachments', 'particles', 'events', 'sounds']));
  const animations = previewOverlayOptions({ ...display.animations, lights: true, particles: true }, true, 'animations');
  assert.equal(shown(animations).size, 0);
  assert.equal(animations.boneLines, false);
  assert.deepEqual([display.animations.rgb, display.animations.lights, display.animations.particles, display.animations.events, display.animations.sounds], [true, true, true, true, true]);
});

test('POSE starts with Objects and Lights off', () => {
  const pose = defaultPoseDisplay(defaultEditorDisplay().movement);
  assert.deepEqual([pose.objects, pose.lights], [false, false]);
  assert.equal(defaultPoseDisplay(defaultEditorDisplay(true).movement).objects, undefined);
});

const storage = value => ({ getItem: () => JSON.stringify(value) });
test('old XL saves: Nodes becomes Lights, the old kinds become Objects and its ticks', () => {
  const restored = storedEditorDisplay(false, storage({ xl: {
    movement: { nodes: true, particles: true, attachments: false, events: false, sounds: false },
    bones: { nodes: false, particles: false, attachments: false, events: false, sounds: false },
    vertices: { bones: true, attachments: true },
  }, vis: { movement: { nodes: true } } }));
  assert.deepEqual([restored.movement.lights, restored.movement.objects, restored.movement.objectTypesEmitters, restored.movement.objectTypesAttachments, restored.movement.objectTypesSounds], [true, true, true, false, false]);
  // Nothing was on: Objects off, every type still ticked for next time.
  assert.deepEqual([restored.bones.objects, restored.bones.objectTypesSounds], [false, true]);
  assert.deepEqual([restored.vertices.objects, restored.vertices.objectTypesAttachments, restored.vertices.bones], [true, true, false]);
  // VIS saves keep only MDLVis's switches; removed ones are dropped.
  assert.equal(storedEditorDisplay(true, storage({ vis: { movement: { nodes: true } } })).movement.nodes, undefined);
  for (const junk of ['{', '"x"', '[1]', 'null', '{"xl":{"movement":7,"bones":null}}']) assert.doesNotThrow(() => storedEditorDisplay(false, { getItem: () => junk }), junk);
});

test('Movement moves every shown kind except sounds', () => {
  assert.deepEqual([...MOVEMENT_EDITABLE_KINDS].sort(), ['attachments', 'bones', 'events', 'lights', 'particles', 'ribbons']);
});

