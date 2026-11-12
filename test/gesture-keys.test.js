import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PAINT_STROKE_ACTIONS, gestureBlocksKey, holdGestureKey, onMousePressLost, watchMousePress } from '../app/gesture-keys.js';
import { PAINT_KEY_PREFIX } from '../src/learn-keycaps.js';
import { uvDragChanged, uvZoom } from '../src/uv-tools.js';

const source = file => readFileSync(new URL('../app/' + file, import.meta.url), 'utf8');
const detail = (key, extra = {}) => ({ event: { key, target: { ownerDocument: 'doc' } }, claims: [], ...extra });
const live = () => true, idle = () => false;

test('during a drag only modifier keys and Esc pass', () => {
  for (const key of ['Delete', 'Backspace', 'z', 'y', 'v', 'c', 'e', 'b', 'u', 'r', 'm', 'F1', 'F5', 'F12', ' ', 'ArrowLeft', 'Enter', 'Tab', '1']) assert.equal(gestureBlocksKey(key), true, key);
  for (const key of ['Escape', 'Control', 'Shift', 'Alt', 'Meta', 'AltGraph']) assert.equal(gestureBlocksKey(key), false, key);
});

test('a live drag takes the key, and says so for the Alt logic', () => {
  const blocked = detail('z');
  assert.equal(holdGestureKey(blocked, null, live), true);
  assert.equal(blocked.gesture, true);
  const alt = detail('Alt');
  assert.equal(holdGestureKey(alt, null, live), false, 'a modifier is never taken');
  assert.equal(alt.gesture, true, 'but the drag is reported, so an Alt tap arms nothing');
  const esc = detail('Escape');
  assert.equal(holdGestureKey(esc, null, live), false, 'Esc stays with each owner\'s rollback claim');
  const none = detail('z');
  assert.equal(holdGestureKey(none, null, idle), false, 'no drag, no effect');
  assert.equal(none.gesture, undefined);
});

test('a key meant for something on top of the drag is left alone', () => {
  const element = { ownerDocument: 'doc', getClientRects: () => [{}] };
  assert.equal(holdGestureKey(detail('Delete'), element, live), true, 'same document, visible canvas, no window on top');
  assert.equal(holdGestureKey(detail('Delete', { localWindow: { contains: () => true } }), element, live), true, 'the drag is inside the focused window');
  assert.equal(holdGestureKey(detail('Delete', { localWindow: { contains: () => false } }), element, live), false, 'a dialog opened over the drag keeps its keys');
  assert.equal(holdGestureKey(detail('Delete'), { ownerDocument: 'doc', getClientRects: () => [] }, live), false, 'a hidden canvas holds nothing');
  assert.equal(holdGestureKey(detail('Delete'), { ownerDocument: 'other', getClientRects: () => [{}] }, live), false, 'a key from another window');
});

test('the Hotkeys claim order lets a drag take a key before any window or command', () => {
  // The drag answers at priority 0; menus sit below it and windows above, so Ctrl+Z never reaches a window's Undo.
  const order = [], claims = [{ priority: 10, run: () => { order.push('window undo'); return true; } }, { priority: -20, run: () => { order.push('menu'); return false; } }, { priority: 0, run: () => { order.push('drag'); return holdGestureKey(detail('z'), null, live); } }];
  for (const claim of claims.sort((a, b) => a.priority - b.priority)) if (claim.run()) break;
  assert.deepEqual(order, ['menu', 'drag']);
  const hotkeys = source('Hotkeys.jsx');
  assert.match(hotkeys, /altInGesture\.current = !!claim\.detail\.gesture/, 'Hotkeys reads the drag report from the same claim');
  assert.match(hotkeys, /altAlone = !altInGesture\.current/, 'Alt pressed during a drag arms no shortcut');
  assert.match(hotkeys, /event\.key === 'Alt' && altInGesture\.current\) \{ altInGesture\.current = false; event\.preventDefault\(\); return; \}/, 'its release does not open the menu bar');
  assert.match(hotkeys, /event\.key !== 'Alt' \|\| altInGesture\.current/, 'no key hints flash during a drag');
});

const OWNERS = {
  'UVEditor.jsx': /holdGestureKey\(event\.detail, element, \(\) => !!s\.drag && !\['pan', 'zoom'\]\.includes\(s\.drag\.type\)\)/,
  'Viewport.jsx': /holdGestureKey\(claim\.detail,canvas,\(\)=>!!down&&down\.action!=='zoom'\)/,
  'GamePreview.jsx': /holdGestureKey\(claim\.detail,canvas,\(\)=>!!nodeGesture\|\|!!selectionGesture\)/,
  'StageRotate.jsx': /holdGestureKey\(detail,null,\(\)=>!!drag\.current\)/,
  'GlowStageTools.jsx': /holdGestureKey\(detail,null,\(\)=>!!drag\.current\)/,
  'CorpseStageTools.jsx': /holdGestureKey\(detail,null,\(\)=>!!drag\.current\)/,
  'ParticleStageTools.jsx': /holdGestureKey\(detail,null,\(\)=>!!drag\.current\)/,
  'ParticlePlacementStage.jsx': /holdGestureKey\(detail,null,\(\)=>!!drag\.current\)/,
  'CollisionOverlay.jsx': /holdGestureKey\(detail,null,\(\)=>!!gesture\.current\)/,
  'ParticleEditor.jsx': /holdGestureKey\(detail, null, \(\) => !!gesture\.current\)/,
  'KeyframeTimeline.jsx': /holdGestureKey\(detail, null, \(\) => !!cleanup\.current\)/,
  'AnimXL.jsx': /holdGestureKey\(detail, null, \(\) => !!drag\.current\)/,
  'ShowcaseLayers.jsx': /holdGestureKey\(detail,root\.current,\(\)=>!!drag\.current\)/,
  'ShowcaseWorkspace.jsx': /holdGestureKey\(detail,null,\(\)=>!!cropDrag\.current\)/,
  'PaintViewport.jsx': /holdGestureKey\(claim\.detail, renderer\.domElement, \(\) => !!down && down\.action !== 'zoom', PAINT_STROKE_ACTIONS\)/,
  'PaintTextureCanvas.jsx': /holdGestureKey\(detail,image\.current,\(\)=>!!gesture\.current,PAINT_STROKE_ACTIONS\)/,
  'PaintCutoutEditor.jsx': /holdGestureKey\(detail,null,\(\)=>!!drag\.current\)/,
};
test('every drag owner holds the keyboard for as long as its drag lives', () => {
  for (const [file, claim] of Object.entries(OWNERS)) assert.match(source(file), claim, file);
});

// A drag whose pointerup never arrives must end, and must not leave the keyboard dead.
const LOST = {
  'UVEditor.jsx': /onMousePressLost\(\(\) => \{ if \(s\.drag\) cancelGesture\(\); \}\)/,
  'Viewport.jsx': /onMousePressLost\(\(\) => \{ if \(down\) cancelGesture\(\); \}\)/,
  'PaintViewport.jsx': /onMousePressLost\(\(\) => \{ if \(down\) cancelGesture\(\); \}\)/,
  'StageRotate.jsx': /useMousePressLost\(\(\)=>\{if\(drag\.current\)abort\(\);\}\)/,
  'GlowStageTools.jsx': /useMousePressLost\(\(\)=>\{if\(drag\.current\)abort\(\);\}\)/,
  'CorpseStageTools.jsx': /useMousePressLost\(\(\)=>\{if\(drag\.current\)abort\(\);\}\)/,
  'ParticleStageTools.jsx': /useMousePressLost\(\(\)=>\{if\(drag\.current\)abort\(\);\}\)/,
  'ParticlePlacementStage.jsx': /useMousePressLost\(\(\)=>\{if\(drag\.current\)abort\(\);\}\)/,
  'CollisionOverlay.jsx': /useMousePressLost\(\(\)=>\{if\(gesture\.current\)cancel\(\);\}\)/,
  'KeyframeTimeline.jsx': /useMousePressLost\(\(\) => \{ if \(cleanup\.current\) \{ cleanup\.current\(\); cleanup\.current = null; seek\(scrubStart\.current\); \} \}\)/,
  'AnimXL.jsx': /useMousePressLost\(\(\) => \{ if \(drag\.current\) \{[^}]*setSettings\(stripBefore\.current\); \} \}\)/,
  'ShowcaseWorkspace.jsx': /useMousePressLost\(\(\)=>\{if\(cropDrag\.current\)\{[^}]*cropDrag\.current=null;\}\}\)/,
  'PaintTextureCanvas.jsx': /useMousePressLost\(\(\)=>\{if\(gesture\.current\)abort\(\);\}\)/,
  'PaintCutoutEditor.jsx': /useMousePressLost\(\(\)=>\{if\(drag\.current\)cancelDrag\(\);\}\)/,
};
test('every drag owner without its own blur and lost-capture path ends the drag when the press is lost', () => {
  for (const [file, claim] of Object.entries(LOST)) assert.match(source(file), claim, file);
  // GamePreview and ShowcaseLayers already end on window blur and on lost capture.
  assert.match(source('GamePreview.jsx'), /ownerWindow\.addEventListener\('blur', previewWindowBlur\)/);
  assert.match(source('GamePreview.jsx'), /canvas\.addEventListener\('lostpointercapture', cancelGestureCapture\)/);
  assert.match(source('ShowcaseLayers.jsx'), /window\.addEventListener\('blur',cancel\)/);
  assert.match(source('ShowcaseLayers.jsx'), /onLostPointerCapture=\{end\}/);
});

function fakeWindow() {
  const listeners = new Map();
  return {
    addEventListener(type, listener) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(listener); },
    removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
    fire(type, event = {}) { for (const listener of [...(listeners.get(type) || [])]) listener({ pointerId: 1, pointerType: 'mouse', buttons: 1, ...event }); },
    count: () => [...listeners.values()].reduce((sum, set) => sum + set.size, 0),
  };
}
const keyIn = (view, key = 'z', extra = {}) => ({ event: { key, view, target: { ownerDocument: 'doc' }, ...extra }, claims: [] });

function pressHarness() {
  const view = fakeWindow(), stop = watchMousePress(view);
  let lost = 0;
  const unlisten = onMousePressLost(() => { lost += 1; });
  return { view, lost: () => lost, end() { stop(); unlisten(); } };
}
test('a live press holds keys; a normal release ends the hold without calling it lost', () => {
  const { view, lost, end } = pressHarness();
  assert.equal(holdGestureKey(keyIn(view), null, live), false, 'no press, nothing to hold for');
  view.fire('pointerdown');
  assert.equal(holdGestureKey(keyIn(view), null, live), true);
  view.fire('pointerup');
  assert.equal(holdGestureKey(keyIn(view), null, live), false, 'a stale drag state cannot swallow keys after the release');
  view.fire('lostpointercapture');
  assert.equal(lost(), 0, 'the capture released after pointerup is not a lost press');
  end();
});
test('losing the window, the capture or the buttons ends the press and tells the owners', () => {
  for (const [name, finish] of [
    ['window blur', view => view.fire('blur')],
    ['lost capture', view => view.fire('lostpointercapture')],
    ['a move with no button held', view => view.fire('pointermove', { buttons: 0 })],
  ]) {
    const { view, lost, end } = pressHarness();
    view.fire('pointerdown');
    finish(view);
    assert.equal(lost(), 1, name);
    assert.equal(holdGestureKey(keyIn(view), null, live), false, name + ': keys are not swallowed');
    end();
  }
});
test('a move during the drag with a button held, or from another pointer, keeps the hold', () => {
  const { view, lost, end } = pressHarness();
  view.fire('pointerdown');
  view.fire('pointermove');
  view.fire('pointermove', { pointerId: 9, buttons: 0 });
  view.fire('pointermove', { pointerType: '', buttons: 0 });
  assert.equal(lost(), 0);
  assert.equal(holdGestureKey(keyIn(view), null, live), true);
  end();
});
test('a key finds the capture gone and heals the guard by itself', () => {
  const { view, lost, end } = pressHarness();
  let held = true;
  view.fire('pointerdown');
  view.fire('gotpointercapture', { target: { hasPointerCapture: id => id === 1 && held } });
  assert.equal(holdGestureKey(keyIn(view), null, live), true, 'the capture is still live');
  held = false;
  assert.equal(holdGestureKey(keyIn(view), null, live), false, 'no live capture, no hold');
  assert.equal(lost(), 1);
  end();
});
test('windows are watched separately and shared watches stop with their last user', () => {
  const view = fakeWindow(), other = fakeWindow(), first = watchMousePress(view), second = watchMousePress(view), third = watchMousePress(other);
  view.fire('pointerdown');
  other.fire('blur');
  assert.equal(holdGestureKey(keyIn(view), null, live), true, 'the other window losing focus does not end this press');
  first();
  assert.ok(view.count() > 0);
  second();
  assert.equal(view.count(), 0);
  third();
  assert.equal(holdGestureKey(keyIn(view), null, live), true, 'a window nobody watches keeps the old behaviour');
});

const STROKE_BINDINGS = { [PAINT_KEY_PREFIX + '[']: ['['], [PAINT_KEY_PREFIX + ']']: ['K'], [PAINT_KEY_PREFIX + 'M']: ['M'], [PAINT_KEY_PREFIX + 'Shift+[']: ['Shift+{'], 'paint:undo': ['='] };
const strokeKey = (key, extra = {}, shortcuts = STROKE_BINDINGS) => holdGestureKey({ event: { key, target: { ownerDocument: 'doc' }, ...extra }, claims: [], shortcuts }, null, live, PAINT_STROKE_ACTIONS);
test('a Paint stroke passes the current keys of its stroke actions, on any layout', () => {
  assert.equal(strokeKey('['), false, 'brush size');
  assert.equal(strokeKey('х', { code: 'BracketLeft' }), false, 'Russian: the same physical key');
  assert.equal(strokeKey('ü', { code: 'BracketLeft' }), false, 'German: the same physical key');
  assert.equal(strokeKey('M'), false, 'Caps Lock');
  assert.equal(strokeKey('m'), false, 'lower case');
  assert.equal(strokeKey('{', { shiftKey: true }), false, 'softness');
  assert.equal(strokeKey('k'), false, 'a stroke action moved to another key still works');
});
test('a Paint stroke holds everything else', () => {
  assert.equal(strokeKey(']'), true, 'the key its action was moved away from');
  assert.equal(strokeKey('='), true, 'another action bound to a stroke key does not fire mid-stroke');
  for (const flag of ['ctrlKey', 'altKey', 'metaKey']) assert.equal(strokeKey('[', { [flag]: true }), true, flag);
  assert.equal(strokeKey('z'), true);
  assert.equal(holdGestureKey(detail('['), null, live), true, 'other drags do not pass stroke keys');
});
test('the claim carries the current bindings', () => assert.match(source('Hotkeys.jsx'), /localWindow, shortcuts: latest\.current\.shortcuts, claims: \[\]/));

test('UV drags commit exactly what the map shows', () => {
  // 13 px from the centre, 1 px further out: a 7% size change that used to be left on the map uncommitted.
  const drag = { settings: { zoomStyle: 'centre', zoomSpeed: 100 }, zoomStyle: undefined, pivotScreen: [0, 0], x: 13, y: 0, scaleDX: 0, scaleDY: 0, pointerSensitivity: 1, uvSensitivity: 1 };
  uvZoom(drag, 13, 0, 0);
  const factor = uvZoom(drag, 14, 0, 1), original = new Float32Array([.2, .2, .4, .4, .9, .9]), center = .3;
  assert.ok(factor > 1.05, 'the sample really changes the size: ' + factor);
  const shown = Float32Array.from(original);
  for (const index of [0, 1]) for (const axis of [0, 1]) shown[index * 2 + axis] = center + (original[index * 2 + axis] - center) * factor;
  assert.equal(uvDragChanged(original, shown, [0, 1]), true);
  assert.equal(uvDragChanged(original, Float32Array.from(original), [0, 1]), false, 'a click that changed nothing adds no undo step');
  assert.equal(uvDragChanged(original, shown, [2]), false, 'only the dragged coordinates count');
  const uv = source('UVEditor.jsx');
  assert.match(uv, /const commit = p\.wrapperControls \? uvDragChanged\(drag\.original, s\.uv, drag\.indices\)\s*:\s*Math\.hypot\(drag\.endX - drag\.x, drag\.endY - drag\.y\) > 1;/);
  assert.match(uv, /if \(commit\) p\.onChange/);
  assert.doesNotMatch(uv, /drag\.moved/, 'no second opinion on whether the drag changed anything');
});

test('every held drag also has Esc: the owners added here roll back first', () => {
  assert.match(source('ShowcaseLayers.jsx'), /event\.key!=='Escape'\|\|!drag\.current\)return false;abort\(\);return true/);
  assert.match(source('ShowcaseWorkspace.jsx'), /setCrop\(cropDrag\.current\.previous\);cropDrag\.current=null;return true/);
  assert.match(source('KeyframeTimeline.jsx'), /cleanup\.current\(\); cleanup\.current = null; seek\(scrubStart\.current\); return true/);
  assert.match(source('AnimXL.jsx'), /setSettings\(stripBefore\.current\); return true/);
});

test('a camera drag keeps the keyboard', () => {
  // Viewport returns before `down` exists for orbit and pan; zoom and UV pan are excluded by name above.
  const viewport = source('Viewport.jsx'), press = viewport.slice(viewport.indexOf('function pointerDown'), viewport.indexOf('function selectionReach'));
  assert.ok(press.indexOf("if (action === 'move' || action === 'rotate') return;") < press.indexOf('down = { ...start, pointerId: event.pointerId, ...selectionKeys'));
});

test('Ctrl from before the press waits for one release in the UV Wrapper, and the key alone redraws', () => {
  const uv = source('UVEditor.jsx');
  assert.match(uv, /snapHeldAtPress: modifierHeld\(event, 'drag\.uv\.snap', p\.preferences\)/);
  assert.match(uv, /const snapping = event\.snap && !drag\.snapHeldAtPress/);
  assert.match(uv, /if \(!snap\) s\.drag\.snapHeldAtPress = false/);
  assert.match(uv, /addEventListener\('keydown', snapKey, true\); ownerWindow\.addEventListener\('keyup', snapKey, true\)/);
  assert.match(uv, /s\.pendingMove = null;/, 'a new drag never reuses the last drag\'s point');
});

test('all 3D editors pass the snap key held at press into the latch', () => {
  assert.match(source('Viewport.jsx'), /ctrl: dragKeys\(event, 'rotate', p\.preferences\)\.ctrlKey, reach/);
  assert.match(source('GamePreview.jsx'), /ctrl: dragKeys\(event, 'rotate', p\.preferences\)\.ctrlKey, reach \}\)/);
  assert.match(source('StageRotate.jsx'), /ctrl:dragKeys\(event,'rotate',preferences\)\.ctrlKey/);
  assert.match(source('ShowcaseLayers.jsx'), /ctrl:dragKeys\(event,'rotate',latest\.current\.preferences\)\.ctrlKey/);
});
