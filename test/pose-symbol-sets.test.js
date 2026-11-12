import test from 'node:test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { DEFAULT_POSE_SYMBOL_SET, POSE_SYMBOL_NAMES, POSE_SYMBOL_SETS, POSE_SYMBOL_SET_IDS, isPoseMaskSet, poseMaskFile, poseSymbolLayers, poseSymbolSetId } from '../src/pose-symbol-sets.js';
import { CONTROLLER_SHAPES, DEFAULT_CONTROLLER_APPEARANCE, controllerAppearanceForTheme, controllerShapePoints, normalizeControllerAppearance } from '../src/controller-appearance.js';
import themeData from '../src/application-themes.json' with { type: 'json' };
const themeIds = () => themeData;
import { normalizePreferences } from '../src/preferences.js';
import { BUILT_IN_VIEWPORT_PRESETS } from '../src/viewport-appearance.js';
import { poseSymbolName } from '../app/pose-overlay.js';
import { poseMaskUrl } from '../app/pose-masks.js';

const REQUIRED = ['Hand', 'Foot', 'Hoof', 'Head', 'Neck', 'Chest', 'Spine', 'Pelvis', 'Body', 'Wing', 'Tail', 'Object', 'Magnet'];
const ARITY = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

/** A small SVG path grammar check: known commands, whole argument groups, a leading move, nothing else in the text. */
function pathProblem(d) {
  if (typeof d !== 'string' || !d.trim()) return 'empty';
  const token = /([MmLlHhVvCcSsQqTtAaZz])|(-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?)|[\s,]+/gy;
  const tokens = []; let at = 0, match;
  while (at < d.length && (match = (token.lastIndex = at, token.exec(d)))) { if (match[1] || match[2]) tokens.push(match[1] || Number(match[2])); at = token.lastIndex; }
  if (at < d.length) return `unexpected text at ${at}`;
  if (!/^[Mm]$/.test(tokens[0])) return 'does not start with a move';
  for (let i = 0; i < tokens.length;) {
    const command = tokens[i++], arity = ARITY[command.toUpperCase()];
    let count = 0; while (i < tokens.length && typeof tokens[i] === 'number') { i++; count++; }
    if (arity === 0 ? count : !count || count % arity) return `${command} has ${count} numbers`;
  }
  return '';
}

test('every set defines every required symbol with valid path data', () => {
  assert.deepEqual([...POSE_SYMBOL_NAMES].sort(), [...REQUIRED].sort());
  assert.equal(POSE_SYMBOL_SET_IDS.length, 5);
  for (const id of POSE_SYMBOL_SET_IDS.filter(id => !isPoseMaskSet(id))) {
    const set = POSE_SYMBOL_SETS[id];
    assert.ok(set.label && set.line > 0 && set.cut > 0, id);
    assert.deepEqual(Object.keys(set.symbols).sort(), [...REQUIRED].sort(), `${id} symbols`);
    for (const name of REQUIRED) {
      const paths = set.symbols[name];
      assert.equal(paths.length, 3, `${id}/${name} is [fill, cut, line]`);
      assert.ok(paths.some(Boolean), `${id}/${name} draws something`);
      for (const [index, d] of paths.entries()) if (d) assert.equal(pathProblem(d), '', `${id}/${name}/${index}`);
      assert.ok(poseSymbolLayers(id, name).length, `${id}/${name} layers`);
    }
  }
});

test('the path checker rejects broken data', () => {
  for (const bad of ['', 'L1 1', 'M1', 'M1 1L2', 'M1 1A1 1 0 1 1 2', 'M1 1X2 2', 'M1 1Z3']) assert.notEqual(pathProblem(bad), '', bad);
  assert.equal(pathProblem('M1 1h.01M-2.5 3A2 2 0 1 1 4 5Z'), '');
});

test('the default is one named constant that names an existing set', () => {
  assert.ok(POSE_SYMBOL_SET_IDS.includes(DEFAULT_POSE_SYMBOL_SET));
  assert.equal(DEFAULT_CONTROLLER_APPEARANCE.symbolSet, DEFAULT_POSE_SYMBOL_SET);
  assert.deepEqual(POSE_SYMBOL_SET_IDS.map(id => POSE_SYMBOL_SETS[id].label), ['Modern', 'Figure', 'Skeleton', 'Rig', 'Outline']);
});

test('no two sets share a path string', () => {
  const owner = new Map();
  for (const id of POSE_SYMBOL_SET_IDS.filter(id => !isPoseMaskSet(id))) for (const name of REQUIRED) for (const d of POSE_SYMBOL_SETS[id].symbols[name]) {
    if (!d) continue;
    const key = `${id}/${name}`;
    assert.ok(!owner.has(d) || owner.get(d).split('/')[0] === id, `${key} repeats ${owner.get(d)}`);
    owner.set(d, key);
  }
});

test('an unknown stored set id falls back to the default or to the value already in use', () => {
  assert.equal(poseSymbolSetId('missing'), DEFAULT_POSE_SYMBOL_SET);
  assert.equal(poseSymbolSetId(undefined), DEFAULT_POSE_SYMBOL_SET);
  assert.equal(poseSymbolSetId('__proto__'), DEFAULT_POSE_SYMBOL_SET);
  assert.deepEqual(poseSymbolLayers('missing', 'Hand'), poseSymbolLayers(DEFAULT_POSE_SYMBOL_SET, 'Hand'));
  assert.deepEqual(poseSymbolLayers('figure', 'Nothing'), poseSymbolLayers('figure', 'Object'));
  assert.deepEqual(poseSymbolLayers('rig', 'Nothing'), poseSymbolLayers('rig', 'Object'));
  assert.equal(normalizeControllerAppearance({ symbolSet: 'missing' }).symbolSet, DEFAULT_POSE_SYMBOL_SET);
  assert.equal(normalizeControllerAppearance({ symbolSet: 'missing' }, { symbolSet: 'outline' }).symbolSet, 'outline');
  assert.equal(normalizeControllerAppearance({}).filled, true);
});

test('the choice travels with the other controller values', () => {
  const chosen = normalizePreferences({ viewportAppearance: { controllers: { symbolSet: 'skeleton', filled: false, shape: 'square', size: 20 } } }).viewportAppearance.controllers;
  assert.deepEqual([chosen.symbolSet, chosen.filled, chosen.shape, chosen.size], ['skeleton', false, 'square', 20]);
  const again = normalizePreferences(JSON.parse(JSON.stringify(normalizePreferences({ viewportAppearance: { controllers: chosen } })))).viewportAppearance.controllers;
  assert.equal(again.symbolSet, 'skeleton');
  assert.equal(normalizePreferences({ viewportAppearance: { controllers: { symbolSet: 'nonsense' } } }).viewportAppearance.controllers.symbolSet, DEFAULT_POSE_SYMBOL_SET);
  for (const preset of Object.values(BUILT_IN_VIEWPORT_PRESETS)) assert.equal(preset.appearance.controllers.symbolSet, DEFAULT_POSE_SYMBOL_SET, `${preset.id} carries the set like it carries the shapes`);
  assert.equal(controllerAppearanceForTheme('nord').symbolSet, DEFAULT_POSE_SYMBOL_SET);
});

test('handle labels map to symbol names, with Neck and Pelvis as ordinary symbols', () => {
  for (const name of REQUIRED) assert.equal(poseSymbolName(name), name);
  assert.equal(poseSymbolName('Chain'), 'Object');
  assert.equal(poseSymbolName('Some bone'), 'Object');
});

test('Modern is the default set and ships all 13 masks, full size and 64 px', () => {
  assert.equal(DEFAULT_POSE_SYMBOL_SET, 'modern');
  assert.equal(DEFAULT_CONTROLLER_APPEARANCE.symbolSet, 'modern');
  assert.equal(normalizeControllerAppearance({}).symbolSet, 'modern');
  assert.ok(isPoseMaskSet('modern') && !isPoseMaskSet('figure'));
  assert.deepEqual(poseSymbolLayers('modern', 'Hand'), []);
  for (const name of REQUIRED) for (const small of [false, true]) {
    const file = poseMaskFile(name, small), path = new URL(`../app/assets/pose-symbols/${file}`, import.meta.url);
    assert.equal(file, name.toLowerCase() + (small ? '-64' : '') + '.png');
    const bytes = fs.readFileSync(path);
    assert.deepEqual([...bytes.subarray(1, 4)], [0x50, 0x4e, 0x47], `${file} is a PNG`);
    assert.equal(bytes.readUInt32BE(16), small ? 64 : 256, `${file} width`);
    assert.ok(poseMaskUrl(name, small).endsWith(file), `${name} url`);
  }
  assert.equal(poseMaskFile('Nothing'), 'object.png');
  for (const id of ['figure', 'skeleton', 'rig', 'outline']) assert.equal(normalizeControllerAppearance({ symbolSet: id }).symbolSet, id, 'older sets stay selectable');
});

test('Symbol Color is its own appearance colour next to the Ring Color', () => {
  for (const theme of ['light', 'dark', 'nord']) {
    const look = controllerAppearanceForTheme(theme);
    assert.match(look.symbolColor, /^#[0-9a-f]{6}$/);
    assert.equal(look.symbolColor, look.color, `${theme} starts with the symbol in the ring colour`);
  }
  const chosen = normalizeControllerAppearance({ color: '#112233', symbolColor: '#AABBCC' });
  assert.deepEqual([chosen.color, chosen.symbolColor], ['#112233', '#aabbcc'], 'each colour is kept apart');
  assert.equal(normalizeControllerAppearance({ symbolColor: 'red' }).symbolColor, DEFAULT_CONTROLLER_APPEARANCE.symbolColor);
  assert.equal(normalizeControllerAppearance({ symbolColor: 'red' }, { symbolColor: '#010203' }).symbolColor, '#010203');
  // A profile saved before the Symbol Color existed keeps drawing the symbol in its Handle colour.
  assert.equal(normalizeControllerAppearance({ color: '#445566', symbolSet: 'rig' }).symbolColor, '#445566');
  const saved = normalizePreferences({ viewportAppearance: { controllers: { color: '#445566', symbolColor: '#778899' } } }).viewportAppearance.controllers;
  assert.deepEqual([saved.color, saved.symbolColor], ['#445566', '#778899']);
  const again = normalizePreferences(JSON.parse(JSON.stringify(normalizePreferences({ viewportAppearance: { controllers: saved } })))).viewportAppearance.controllers;
  assert.equal(again.symbolColor, '#778899');
  assert.equal(normalizePreferences({}).viewportAppearance.controllers.symbolColor, DEFAULT_CONTROLLER_APPEARANCE.symbolColor);
});

test('triangle handles are gone: not offered, saved triangles become diamonds', () => {
  assert.ok(!CONTROLLER_SHAPES.includes('triangle'));
  assert.equal(controllerShapePoints('triangle', 10), null);
  for (const id of Object.keys(themeIds())) {
    const look = controllerAppearanceForTheme(id);
    for (const key of ['shape', 'bodyShape', 'bendShape']) assert.ok(CONTROLLER_SHAPES.includes(look[key]), `${id} ${key}`);
  }
  const saved = normalizeControllerAppearance({ shape: 'triangle', bodyShape: 'triangle', bendShape: 'triangle' }, controllerAppearanceForTheme('nord'));
  assert.deepEqual([saved.shape, saved.bodyShape, saved.bendShape], ['diamond', 'diamond', 'diamond']);
});
