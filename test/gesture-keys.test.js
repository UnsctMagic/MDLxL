import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PAINT_STROKE_KEYS, gestureBlocksKey, holdGestureKey } from '../app/gesture-keys.js';

const source = file => readFileSync(new URL('../app/' + file, import.meta.url), 'utf8');
const detail = (key, extra = {}) => ({ event: { key, target: { ownerDocument: 'doc' } }, claims: [], ...extra });
const live = () => true, idle = () => false;

test('during a drag only modifier keys and Esc pass', () => {
  for (const key of ['Delete', 'Backspace', 'z', 'y', 'v', 'c', 'e', 'b', 'u', 'r', 'm', 'F1', 'F5', 'F12', ' ', 'ArrowLeft', 'Enter', 'Tab', '1']) assert.equal(gestureBlocksKey(key), true, key);
  for (const key of ['Escape', 'Control', 'Shift', 'Alt', 'Meta', 'AltGraph']) assert.equal(gestureBlocksKey(key), false, key);
  for (const key of PAINT_STROKE_KEYS) { assert.equal(gestureBlocksKey(key), true, key); assert.equal(gestureBlocksKey(key, PAINT_STROKE_KEYS), false, key); }
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
  assert.equal(holdGestureKey(detail('['), null, live, PAINT_STROKE_KEYS), false, 'Paint keeps its brush keys mid-stroke');
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
  'ParticleEditor.jsx': /holdGestureKey\(detail, null, \(\) => !!gesture\.current && mouseHeld\.current\)/,
  'KeyframeTimeline.jsx': /holdGestureKey\(detail, null, \(\) => !!cleanup\.current\)/,
  'AnimXL.jsx': /holdGestureKey\(detail, null, \(\) => !!drag\.current\)/,
  'ShowcaseLayers.jsx': /holdGestureKey\(detail,root\.current,\(\)=>!!drag\.current\)/,
  'ShowcaseWorkspace.jsx': /holdGestureKey\(detail,null,\(\)=>!!cropDrag\.current\)/,
  'PaintViewport.jsx': /holdGestureKey\(claim\.detail, renderer\.domElement, \(\) => !!down && down\.action !== 'zoom', PAINT_STROKE_KEYS\)/,
  'PaintTextureCanvas.jsx': /holdGestureKey\(detail,image\.current,\(\)=>!!gesture\.current,PAINT_STROKE_KEYS\)/,
  'PaintCutoutEditor.jsx': /holdGestureKey\(detail,null,\(\)=>!!drag\.current\)/,
};
test('every drag owner holds the keyboard for as long as its drag lives', () => {
  for (const [file, claim] of Object.entries(OWNERS)) assert.match(source(file), claim, file);
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
