// Settings previews: every control has a scene, scenes use the real numbers, and
// the loop plays three times, rests, stops while hidden and cleans up after itself.
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEFAULT_UV_DRAG, UV_DRAG_PRESETS } from '../src/uv-drag-settings.js';
import { normalizePreferences } from '../src/preferences.js';
import { uvSnapFactor, uvSnapTurn, uvTurn, uvZoom } from '../src/uv-tools.js';
import { rotationBehavior, rotationDragDegrees, rotationRim } from '../src/rotation-drag.js';
import { Vector3 } from 'three';
import { beginGizmoRotation } from '../app/movement-overlay.js';
import { pointerDragPoint } from '../app/viewport-performance.js';
import { gestureAt, loopProgress, LOOPS, runLoop } from '../app/settings-preview/clock.js';
import { gizmoScript, gizmoTrack, PIVOT, pointerTrack, previewCamera, STAGE, TRACK_STEPS, UV_PIECE_REACH, uvRotateTrack, uvZoomTrack, wheelAdjustSteps, wheelNotchFactor } from '../app/settings-preview/tracks.js';
import { contrast, legible, previewLook } from '../app/settings-preview/palette.js';

const require = createRequire(import.meta.url);
const close = (actual, expected, label, within = 1e-9) => assert.ok(Math.abs(actual - expected) <= within, `${label}: ${actual} is not ${expected}`);
const prefs = changes => normalizePreferences(changes);

/** The scenes contain JSX, so they load through esbuild like the other component tests. */
async function loadPreview() {
  const result = await build({
    stdin: { contents: `export * from './app/settings-preview/SettingsPreview.jsx'; export * from './app/settings-preview/registry.js'; export * from './app/settings-preview/use-target.js';`, resolveDir: process.cwd(), loader: 'js' },
    bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external', logLevel: 'silent', loader: { '.jsx': 'jsx' },
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, module, module.exports);
  return module.exports;
}
const preview = await loadPreview();

/** Every 'demo' and 'static' control of the settings audit, by data-hotkey or aria-label. */
const AUDIT_CONTROLS = [
  // Mouse
  'mouse:preset:classic', 'mouse:preset:orbit', 'mouse:binding:right', 'mouse:binding:middle', 'mouse:rotation-editor', 'mouse:rotation-sensitivity', 'Use default rotation sensitivity', 'Shift rotation precision', 'Use default rotation precision',
  'mouse:sensitivity-slider', 'mouse:sensitivity-value', 'mouse:wheel:rotate', 'mouse:wheel:scroll', 'mouse:wheel:pointer', 'mouse:pointer-slider', 'mouse:pointer-value', 'mouse:right-scroll-adjust', 'mouse:fine', 'mouse:uv',
  'mouse:uv-rotate-preset', 'mouse:uv-rotate-style', 'mouse:uv-rotate-speed', 'mouse:uv-rotate-zone', 'mouse:uv-rotate-big-pieces', 'mouse:uv-rotate-reverse', 'mouse:uv-rotate-snap', 'mouse:uv-zoom-style', 'mouse:uv-zoom-speed', 'mouse:uv-zoom-snap',
  // Learn and pressed keys
  'hotkeys:learn', 'Learn mode: Where', 'Learn mode: Size', 'Learn mode: Look', 'Learn mode: Stays for', 'Learn mode: Learned after', 'Learn mode: Then quiet for', 'capture:pressed-keys',
  // Graphics and capture
  'Lighting setup', ...['ambient', 'diffuse', 'specular'].flatMap(c => ['R', 'G', 'B'].map(a => `lighting:${c}:${a}`)), 'lighting:power', 'platform:enabled', 'Platform shape', 'platform:size', 'platform:height', 'Platform color',
  'graphics:preset:fast', 'graphics:preset:balanced', 'graphics:preset:quality', 'graphics:pixel-ratio', 'graphics:max-fps', 'graphics:antialias', 'graphics:textures', 'graphics:lighting', 'graphics:particles',
  'Recording frame rate', 'Recording quality', 'Screenshot quality',
  // Appearance
  'Viewport appearance preset', 'Interface appearance set', 'UI accent', 'Geoset set', 'Compact Set color', 'Tool highlight', 'appearance:panel-width', 'appearance:panel-scale',
  'Viewport background appearance set', 'Viewport background type', 'Viewport background color', 'Background image display mode', 'Image opacity', 'appearance:background:opacity',
  'Highlight Geoset appearance set', 'Highlight Geoset color', 'Highlight Geoset type', 'Highlight via View', 'Highlight via Selection',
  'Wire style', 'appearance:size:occludedOpacity', ...['Selected geoset', 'Other visible geosets'].flatMap(part => [`${part} appearance set`, `${part} wire color`, `${part} wire style`]), ...['selectedGeoset', 'otherGeoset'].flatMap(part => ['thickness', 'opacity', 'spacing'].map(key => `appearance:${part}:${key}`)),
  'appearance:xray-vertices', ...['Selected vertices', 'Unselected vertices'].flatMap(part => [`${part} appearance set`, `${part} color`, `${part} marker style`]), 'appearance:selectedVertex:size', 'appearance:unselectedVertex:size',
  'Bones & skeleton appearance set', 'Bone style', 'Skeleton style', ...['Bone', 'Root bone', 'Helpers', 'Refs', 'Selected bone', 'Parent bone', 'Child bones'].map(name => `Bones ${name}`), 'appearance:bones:thickness', 'appearance:bones:highlight',
  'appearance:influence:opacity', ...['Ghost', 'Moved by the bone', 'Follows through child bones'].map(name => `Bone influence ${name}`),
  'Controllers appearance set', 'Move gizmo', 'Rotate handles', 'Handle shape', 'Body shape', 'Bend shape', 'Pin button style', 'Show body-part symbols', 'Controller size', ...['Handle', 'Selected', 'Pinned', 'Background', 'Pose skeleton', 'Outline', 'X axis', 'Y axis', 'Z axis'].map(name => `Controller ${name}`),
  'Folders & lists appearance set', ...['List background', 'List text', 'Type and ID text', 'List border', 'Hierarchy lines', 'Hovered row', 'Selected row', 'Selected row text', 'Selection edge'].map(name => `Tree ${name}`), 'appearance:tree:font-size',
  'Node colors appearance set', ...['Bones', 'Helpers', 'Attachments', 'Lights', 'Emitters', 'Sounds', 'Blood splats', 'Footprints', 'Ubersplats', 'Spawn objects', 'Collision shapes'].map(name => `Node ${name}`),
  'Sound folder colors appearance set', ...['Other folders', 'Human', 'Orc', 'Undead', 'Night Elf', 'Naga', 'Demon', 'Creeps', 'Abilities', 'Sound', 'Unavailable'].map(name => `Folder ${name}`),
  'Quadview appearance set', 'appearance:quadview:grid', 'Quadview background color', 'Quadview minor grid color', 'Quadview major grid color', 'Quadview origin axes color', 'appearance:quadview:spacing', 'appearance:quadview:major', 'appearance:quadview:thickness', 'appearance:quadview:opacity', 'appearance:quadview:major-opacity', 'Quadview image display', 'appearance:quadview:image-opacity',
  'Editor helpers appearance set', ...['keyframe', 'activeKeyframe', 'bone', 'node', 'particle', 'event', 'selection', 'uvSelection'].map(key => `appearance:color:${key}`), 'Emitter marker', 'appearance:size:keyframeSize', 'appearance:size:helperSize',
  'Citadel Paint appearance set', ...['Brush tips — light theme', 'Brush tips — dark themes', 'Brush cursor', 'Geoset selection', 'Geoset border', 'Selected lamp'].map(name => `Citadel ${name}`), 'citadel:borderThickness',
  // Grid
  'grid:preset:classic', 'grid:preset:fine', 'grid:preset:world', 'grid:preset:xyz', 'grid:spacing', 'grid:major-every', 'grid:extent', 'grid:opacity', 'grid:major-opacity', 'grid:small', ...['xz', 'yz', 'xy'].map(p => `grid:plane:${p}`), ...['x', 'y', 'z'].map(a => `grid:axis:${a}`), ...['gridMinor', 'gridMajor', 'axisX', 'axisY', 'axisZ'].map(c => `grid:color:${c}`),
];
const NEW_CONTROLS = ['mouse:rotation-workplane-drag', 'mouse:rotation-handle-drag', 'mouse:rotation-line-pick', 'mouse:rotation-lever-pick', 'mouse:rotation-off-handle', 'mouse:rotation-face-on', 'mouse:rotation-reverse', 'mouse:rotation-handle-speed', 'mouse:rotation-dpi', 'mouse:rotation-zone', 'mouse:rotation-big-selections', 'mouse:rotation-shift', 'mouse:rotation-snap', 'preset:uv:select', 'preset:rotate:select', 'appearance:toolbar-mode'];
const NOTHING_TO_SHOW = ['mouse:reset', 'mouse:uv-reset', 'appearance:reset', 'updates:check', 'hotkeys:search', 'game-data:choose', 'close', 'done', 'tab:mouse', 'file-icon:mdl:page'];

test('the registry covers every audited control and every new one, and only those with something to show', () => {
  for (const key of [...AUDIT_CONTROLS, ...NEW_CONTROLS]) assert.ok(preview.previewEntry(key), `no scene for ${key}`);
  for (const key of NOTHING_TO_SHOW) assert.equal(preview.previewEntry(key), null, `${key} has no preview`);
  for (const [, scene] of preview.PREVIEW_LINES) assert.ok(preview.previewScene(scene), `${scene} is not a scene`);
  assert.equal(preview.PREVIEW_SCENE_IDS.length, 13);
  assert.equal(new Set(preview.PREVIEW_LINES.map(([key]) => key)).size, preview.PREVIEW_LINES.length, 'one line per key');
  for (const id of Object.values(preview.PREVIEW_DEFAULT_TARGET)) assert.ok(preview.previewEntry(id), id);
});

test('the exact key wins over a family, and uv is not swallowed by its neighbours', () => {
  assert.equal(preview.previewEntry('mouse:uv').scene, 'pointer-gain');
  assert.equal(preview.previewEntry('mouse:uv-rotate-speed').scene, 'uv-rotate');
  assert.equal(preview.previewEntry('lighting:power').focus, 'power');
  assert.equal(preview.previewEntry('lighting:diffuse:G').focus, 'light');
});

const GROUP = '[role=group][aria-label]';
test('the target resolver walks from the hovered element to the control, data-hotkey first', () => {
  const element = (attrs, { host, group, inner } = {}) => ({ getAttribute: name => attrs[name] ?? null, matches: selector => selector.includes('data-hotkey') && (attrs['data-hotkey'] || attrs['aria-label']) ? true : false, querySelector: () => inner ?? null, closest: selector => selector === GROUP ? group ?? null : host ?? null });
  const both = element({ 'data-hotkey': 'mouse:rotation-snap', 'aria-label': 'Angle snap' }); both.closest = () => both;
  assert.equal(preview.resolvePreviewTarget(both).id, 'mouse:rotation-snap');
  const input = element({ 'data-hotkey': 'mouse:uv-rotate-zone' }), label = element({}, { inner: input }); label.closest = selector => selector === GROUP ? null : label;
  assert.deepEqual(preview.resolvePreviewTarget(label), { element: input, id: 'mouse:uv-rotate-zone' });
  const group = element({ 'aria-label': 'Viewport background type' }), bare = element({}, { group }); bare.closest = selector => selector === GROUP ? group : bare;
  assert.equal(preview.resolvePreviewTarget(bare).id, 'Viewport background type');
  const reset = element({ 'data-hotkey': 'mouse:reset' }); reset.closest = () => reset;
  assert.equal(preview.resolvePreviewTarget(reset), null);
  assert.equal(preview.resolvePreviewTarget({ closest: () => null }), null);
});

test('UV Rotate frames are uvTurn at every preset, sample for sample', () => {
  for (const [name, settings] of Object.entries(UV_DRAG_PRESETS)) for (const focus of ['style', 'speed', 'zone', 'bigPieces', 'snap']) {
    const track = uvRotateTrack(settings, focus), reach = focus === 'bigPieces' ? track.reach : UV_PIECE_REACH, drag = { settings, pivotScreen: [...PIVOT], reach, fine: 1 };
    uvTurn(drag, ...track.path(0));
    track.frames.forEach((frame, i) => {
      const turn = uvTurn(drag, frame.x, frame.y);
      close(frame.turn, turn, `${name} ${focus} ${i}`);
      close(frame.applied, frame.ctrl ? uvSnapTurn(turn, settings.rotateSnap) : turn, `${name} ${focus} applied`);
    });
  }
});

test('a higher Rotate speed turns further, by exactly the setting', () => {
  const at = rotateSpeed => uvRotateTrack({ ...DEFAULT_UV_DRAG, rotateSpeed, rotateStyle: 'leftRight' }, 'style').frames.at(-1).applied;
  close(at(140) / at(70), 2, 'twice the speed', 1e-9);
  assert.ok(uvRotateTrack({ ...DEFAULT_UV_DRAG, rotateStyle: 'leftRight', rotateReverse: true }, 'style').frames.at(-1).applied < 0, 'reverse flips');
});

test('UV Zoom frames are uvZoom, and centre collapses to one spot', () => {
  for (const zoomStyle of ['centre', 'rightUp', 'leftRight', 'upDown']) for (const uvSensitivity of [1, 2.5]) {
    const settings = { ...DEFAULT_UV_DRAG, zoomStyle, zoomSnap: 10 }, track = uvZoomTrack(settings, 'snap', uvSensitivity), drag = { settings, pivotScreen: [...PIVOT], uvSensitivity };
    uvZoom(drag, ...track.path(0), 0);
    track.frames.forEach((frame, i) => {
      const factor = uvZoom(drag, frame.x, frame.y, uvSensitivity);
      close(frame.factor, factor, `${zoomStyle} ${i}`);
      close(frame.applied, frame.ctrl ? uvSnapFactor(factor, 10) : factor, `${zoomStyle} snapped`);
    });
  }
  assert.equal(uvZoomTrack(DEFAULT_UV_DRAG, 'style').frames.at(-1).applied, 0, 'past the centre everything is on one spot');
  const upDown = uvZoomTrack({ ...DEFAULT_UV_DRAG, zoomStyle: 'upDown' }, 'style').frames.map(frame => frame.applied);
  assert.ok(Math.min(...upDown) > 0, 'up/down can never collapse');
});

test('3D Rotate frames are rotationDragDegrees over the gesture the real entry point begins', () => {
  for (const rotation of [{}, { workplaneDrag: 'leftRight' }, { workplaneDrag: 'circle' }, { workplaneDrag: 'ring' }, { sensitivity: .4, reverse: true }, { snap: 15, useDPI: false }]) {
    const preferences = prefs({ rotation, pointerSensitivity: 1.5 }), track = gizmoTrack(preferences, { mode: 'workplane' });
    const drag = beginGizmoRotation({ x: track.start[0], y: track.start[1], world: new Vector3(), camera: previewCamera(track.view), width: STAGE.width, height: STAGE.height, handle: null, rotation: null, space: 'world', workplaneEnabled: true, workplane: track.workplane, preferences, editor: 'all' });
    track.frames.forEach((frame, i) => close(frame.degrees, rotationDragDegrees(drag, frame.x - track.start[0], frame.y - track.start[1], 1.5, frame.shift, frame.ctrl), `${JSON.stringify(rotation)} ${i}`));
  }
  for (const style of ['lines', 'rings']) for (const handleDrag of ['swing', 'ring', 'leftRight']) {
    const preferences = prefs({ rotation: { handleDrag }, viewportAppearance: { controllers: { rotateHandles: style } } }), track = gizmoTrack(preferences, { mode: 'handle' });
    const drag = beginGizmoRotation({ x: track.start[0], y: track.start[1], world: new Vector3(), camera: previewCamera(track.view), width: STAGE.width, height: STAGE.height, handle: { axis: track.grabbed }, rotation: null, space: 'world', workplaneEnabled: false, workplane: track.workplane, preferences, editor: 'all' });
    track.frames.forEach((frame, i) => close(frame.degrees, rotationDragDegrees(drag, frame.x - track.start[0], frame.y - track.start[1], 1, frame.shift, frame.ctrl), `${style} ${handleDrag} ${i}`));
  }
  const line = changes => gizmoTrack(prefs({ rotation: changes }), { mode: 'workplane', changes: { workplaneDrag: 'arrow' } });
  close(line({}).frames.at(-1).degrees, line({}).travel, 'a straight rule turns one degree per pixel', 1e-6);
  close(line({ sensitivity: .5 }).frames.at(-1).degrees, line({}).travel * .5, 'sensitivity scales it', 1e-6);
  close(line({ reverse: true }).frames.at(-1).degrees, -line({}).travel, 'reverse flips it', 1e-6);
  const snapped = gizmoTrack(prefs({ rotation: { snap: 45 } }), { mode: 'workplane', ctrlFrom: .1 });
  snapped.frames.filter(frame => frame.ctrl).forEach(frame => close(frame.degrees % 45, 0, 'lands on the step'));
});

test('every 3D Rotate focus builds a gesture for each setting value', () => {
  const values = { workplaneDrag: ['arrow', 'leftRight', 'circle', 'ring'], handleDrag: ['swing', 'ring', 'leftRight'], linePick: ['lever', 'axis'], offHandle: ['wheel', 'none'], faceOn: ['circle', 'arrow'], shift: ['slow', 'snap'], snap: [0, 1, 5, 15, 45, 90], centerZone: [0, 8, 40, 100], leverPick: [2, 6, 30], useDPI: [true, false], reverse: [true, false], bigSelections: [true, false] };
  for (const [key, list] of Object.entries(values)) for (const value of list) for (const style of ['lines', 'rings', 'arcs']) for (const focus of ['workplaneDrag', 'handleDrag', 'linePick', 'leverPick', 'offHandle', 'faceOn', 'reverse', 'dpi', 'zone', 'bigSelections', 'precision', 'shift', 'snap']) {
    const preferences = prefs({ rotation: { [key]: value }, viewportAppearance: { controllers: { rotateHandles: style } } }), script = gizmoScript(focus, rotationBehavior(preferences, 'all'), preferences), { reference, ...options } = script;
    const track = gizmoTrack(preferences, options);
    assert.equal(track.frames.length, TRACK_STEPS + 1);
    assert.ok(track.frames.every(frame => Number.isFinite(frame.degrees) && Number.isFinite(frame.x) && Number.isFinite(frame.y)), `${key}=${value} ${style} ${focus}`);
  }
});

test('off-handle None does nothing, and the deadzone circle is the real rim', () => {
  const none = gizmoTrack(prefs({ rotation: { offHandle: 'none' } }), { mode: 'off', path: t => [PIVOT[0] + 70 * Math.cos(t * 3), PIVOT[1] + 70 * Math.sin(t * 3)] });
  assert.ok(none.frames.every(frame => frame.degrees === 0));
  for (const centerZone of [0, 8, 40]) assert.equal(gizmoTrack(prefs({ rotation: { centerZone } }), { mode: 'off', path: () => [20, 20] }).ringRadius, rotationRim(centerZone));
});

test('pointer rulers are pointerDragPoint', () => {
  for (const gain of [.2, 1, 2.5, 4]) close(pointerTrack(gain).at(-1).moved, pointerDragPoint({ x: 0, y: 0 }, { x: 44, y: 0 }, gain).x, `gain ${gain}`);
  const fine = pointerTrack(1, { travel: 80, fineFrom: .5, fine: .2 }).at(-1);
  assert.ok(fine.moved < 80 * .75, 'fine control slows the second half');
});

test('wheel scenes read the real adjuster', () => {
  close(wheelNotchFactor(2.5), Math.exp(100 * .0015 * 2.5), 'zoom per notch');
  const steps = wheelAdjustSteps({ scrollSensitivity: 2.5, pointerSensitivity: 1 }, 'scroll');
  assert.deepEqual(steps, [2.5, 3.05, 3.73, 4.56]);
  assert.deepEqual(wheelAdjustSteps({ pointerSensitivity: 1 }, 'pointer'), [1, 1.22, 1.49, 1.82]);
});

test('the clock plays three loops, rests on the final frame, and stops at rest', () => {
  assert.equal(LOOPS, 3);
  assert.deepEqual(loopProgress(0, 3000), { phase: 0, done: false });
  assert.deepEqual(loopProgress(9000, 3000), { phase: 1, done: true });
  assert.equal(gestureAt(1), 1);
  const frames = [], phases = []; let id = 0;
  const stop = runLoop({ duration: 100, request: callback => { frames.push(callback); return ++id; }, cancel() {}, onPhase: phase => phases.push(phase), doc: { hidden: false, addEventListener() {}, removeEventListener() {} } });
  for (let now = 0; now <= 400 && frames.length; now += 16) frames.shift()(now);
  assert.equal(phases.at(-1), 1);
  assert.equal(frames.length, 0, 'no frame requested after the rest');
  stop();
});

test('the loop waits while the document is hidden and leaves nothing behind when stopped', () => {
  let callback = null, cancelled = 0, listeners = 0, visibility = null;
  const doc = { hidden: false, addEventListener(_, fn) { listeners++; visibility = fn; }, removeEventListener() { listeners--; } };
  const phases = [], stop = runLoop({ duration: 100, request: fn => { callback = fn; return 1; }, cancel() { cancelled++; callback = null; }, onPhase: phase => phases.push(phase), doc });
  callback(0); callback(50);
  assert.equal(phases.at(-1), .5);
  doc.hidden = true; visibility();
  assert.equal(callback, null, 'no frames while hidden');
  doc.hidden = false; visibility(); callback(5000); callback(5010);
  assert.ok(Math.abs(phases.at(-1) - .6) < 1e-9, 'hidden time did not count');
  stop();
  assert.equal(listeners, 0);
  assert.ok(cancelled >= 1);
});

test('every registry line renders as inert SVG with no sentences', () => {
  const preferences = prefs({ learn: { enabled: true }, platform: { enabled: true }, showPressedKeys: true });
  for (const [key] of preview.PREVIEW_LINES) {
    const id = key.endsWith('*') ? key.slice(0, -1) + 'probe' : key;
    const html = renderToStaticMarkup(React.createElement(preview.SettingsPreview, { preferences, target: id }));
    assert.match(html, /^<svg /, key);
    assert.match(html, /role="img"/, key);
    assert.match(html, /focusable="false"/, key);
    assert.match(html, /aria-label="[^"]+"/, key);
    assert.doesNotMatch(html, /tabindex|<a |<button|<input/i, key);
    const texts = [...html.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map(match => match[1]);
    for (const text of texts) assert.ok(text.length <= 14 && text.split(' ').length <= 3, `${key}: "${text}"`);
    assert.doesNotMatch(html, /NaN|undefined/, key);
  }
});

test('each frame of an animated scene renders, at the side-panel size and at the strip', () => {
  const preferences = prefs({});
  for (const [width, height] of [[220, 165], [560, 96], [220, 96]]) for (const [key] of preview.PREVIEW_LINES.filter(([, scene]) => ['uv-rotate', 'uv-zoom', 'gizmo-rotate', 'pointer-gain', 'mouse-camera', 'wheel', 'keycap', 'compare'].includes(scene))) {
    const id = key.endsWith('*') ? key.slice(0, -1) + 'probe' : key, entry = preview.previewEntry(id), scene = preview.previewScene(entry.scene), value = JSON.parse(JSON.stringify(scene.read(preferences, entry, {}))), track = scene.track ? scene.track(value, entry.focus, entry.options) : null;
    for (const phase of [0, .3, .6, 1]) assert.doesNotMatch(renderToStaticMarkup(React.createElement('svg', null, preview.renderSceneFrame({ scene, entry, value, track, phase, preferences, width, height }))), /NaN|undefined/, `${key} @${phase}`);
  }
});

test('the key badge follows the user\'s binding, and an unbound key shows none', () => {
  const scene = preview.previewScene('gizmo-rotate'), entry = preview.previewEntry('mouse:rotation-snap');
  const read = preferences => scene.read(preferences, entry, {});
  assert.equal(read(prefs({})).snapKey, 'Ctrl');
  assert.equal(read(prefs({ modifiers: { 'drag.rotate.snap': 'Alt' } })).snapKey, 'Alt');
  assert.equal(read(prefs({ modifiers: { 'drag.rotate.snap': '' } })).snapKey, '');
});

test('the accent stays readable on any stage, and a preview is the default page view', () => {
  for (const stage of ['#cccccc', '#101010', '#ff00ff', '#ffffff']) for (const color of ['#71b5f3', '#ffff00', '#000080']) assert.ok(contrast(legible(color, stage), stage) >= 3, `${color} on ${stage}`);
  const look = previewLook(prefs({}));
  assert.equal(look.stage, '#cccccc', 'the user\'s background');
  assert.equal(look.axes.X, '#ff0000', 'the user\'s axis colours');
});

test('appearance scenes read each setting where it is stored', () => {
  const html = (target, changes) => renderToStaticMarkup(React.createElement(preview.SettingsPreview, { preferences: prefs(changes), target }));
  const base = prefs({}), view = change => ({ viewportAppearance: { ...base.viewportAppearance, ...change } }), visuals = change => ({ visuals: { ...base.visuals, ...change } });
  assert.notEqual(html('Wire style', view({ wireMode: 'hidden-line' })), html('Wire style', view({ wireMode: 'all' })), 'Wire style');
  assert.notEqual(html('appearance:xray-vertices', view({ xrayVertices: true })), html('appearance:xray-vertices', view({ xrayVertices: false })), 'X-Ray');
  for (const wireMode of ['all', 'hidden-line']) assert.notEqual(html('appearance:size:occludedOpacity', { ...view({ wireMode }), ...visuals({ occludedOpacity: .2 }) }), html('appearance:size:occludedOpacity', view({ wireMode })), 'Hidden wire intensity: ' + wireMode);
  const tree = change => view({ tree: { ...base.viewportAppearance.tree, ...change } });
  assert.match(html('Folder Sound', tree({ folders: { ...base.viewportAppearance.tree.folders, Sound: '#abc123' } })), /#abc123/, 'Sound folder colour');
  assert.match(html('Node Ubersplats', tree({ nodes: { ...base.viewportAppearance.tree.nodes, ubersplat: '#abc124' } })), /#abc124/, 'every node colour');
  assert.notEqual(html('graphics:pause-when-hidden', { graphics: { ...base.graphics, pauseWhenHidden: false } }), html('graphics:pause-when-hidden', { graphics: { ...base.graphics, pauseWhenHidden: true } }), 'Pause rendering');
});
test('controls that lacked a scene have one, and a control with none shows the page default', () => {
  for (const key of ['preset:mouse:select', 'Use Rotation sensitivity', 'Use default: Rotation sensitivity', 'Use default: Deadzone near centre', 'graphics:pause-when-hidden']) assert.ok(preview.previewEntry(key), key);
  const hook = readFileSync(new URL('../app/settings-preview/use-target.js', import.meta.url), 'utf8');
  assert.match(hook, /if \(event\.target\?\.closest\?\.\(HOST\)\) setTarget\(previous => previous\.id === pageDefault\.current \? previous : \{ id: pageDefault\.current,/);
});
