// The shared test helpers in test/helpers/ and the app's read-only test hook (app/test-hook.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { key, track, bone, sequence, minimalModel } from './helpers/model-fixtures.js';
import { assertNear, assertVecNear } from './helpers/assert-near.js';
import { sanityTest } from './helpers/hive.mjs';
import { comparePoses, maxNodeMatrixDifference } from './helpers/pose-compare.mjs';
import { createDemoDocument } from '../src/editor-document.js';

const require = createRequire(import.meta.url);
const { root, appTarget, appDist, sha256File } = require('./helpers/app.cjs');
const { fixturePath, tempDir } = require('./helpers/fixtures.cjs');
const { PROBE_SOURCE } = require('./helpers/fiber-probe.cjs');

test('appTarget uses MDLXL_TEST_EXE, then MDLXL_SUITE_PKG, then the development Electron with this repo', () => {
  assert.deepEqual(appTarget({ MDLXL_TEST_EXE: 'D:/a/MDLxL.exe', MDLXL_SUITE_PKG: 'D:/b' }), { executablePath: path.resolve('D:/a/MDLxL.exe'), args: [], packaged: true });
  assert.deepEqual(appTarget({ MDLXL_SUITE_PKG: 'D:/b/MDLxL-win32-x64' }), { executablePath: path.join(path.resolve('D:/b/MDLxL-win32-x64'), 'MDLxL.exe'), args: [], packaged: true });
  const dev = appTarget({});
  assert.equal(dev.packaged, false); assert.deepEqual(dev.args, [root]); assert.match(path.basename(dev.executablePath), /^electron/i);
  assert.equal(appDist(dev), path.join(root, 'dist'));
  assert.equal(appDist(appTarget({ MDLXL_TEST_EXE: 'D:/a/MDLxL.exe' })), path.join(path.resolve('D:/a'), 'resources/app/dist'));
});

test('fixturePath reads the runner variables and knows which fixtures have no default', () => {
  assert.equal(fixturePath('footman', {}), path.join(root, 'out/pose/Footman.mdx'));
  assert.equal(fixturePath('footman', { MDLXL_SUITE_FOOTMAN: 'D:/x/Footman.mdx' }), path.resolve('D:/x/Footman.mdx'));
  assert.equal(fixturePath('archer', {}), null);
  assert.throws(() => fixturePath('nope'), /Unknown fixture/);
});

test('tempDir stays under out/tmp by default and under MDLXL_TEMP when set', t => {
  const made = tempDir('helper-test-');
  t.after(() => fs.rmSync(made, { recursive: true, force: true }));
  assert.equal(path.dirname(made), path.join(root, 'out', 'tmp'));
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'out/tmp/package.json'), 'utf8')).type, 'commonjs');
  const custom = path.join(made, 'custom'), inner = tempDir('x-', { MDLXL_TEMP: custom });
  assert.equal(path.dirname(inner), custom);
  fs.writeFileSync(path.join(made, 'a.txt'), 'abc');
  assert.equal(sha256File(path.join(made, 'a.txt')), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('model fixtures build the shapes tests use, with typed key vectors', () => {
  const k = key(100, [1, 2, 3], { InTan: [0, 0, 0], OutTan: [1, 1, 1] });
  assert.ok(k.Vector instanceof Float32Array); assert.ok(k.InTan instanceof Float32Array);
  assert.deepEqual(track([k], 2), { Keys: [k], LineType: 2, GlobalSeqId: null });
  const model = minimalModel({ Bones: [bone(0, { Translation: track([k]) })], Sequences: [sequence('Walk', [0, 500])] });
  assert.equal(model.Bones[0].Name, 'Bone0'); assert.deepEqual(model.Sequences[0].Interval, [0, 500]); assert.deepEqual(model.GlobalSequences, []);
});

test('approximate asserts need an explicit epsilon and honour it', () => {
  assertNear(1, 1.000001, 1e-5); assertVecNear([1, 2], new Float32Array([1, 2.000001]), 1e-5);
  assert.throws(() => assertNear(1, 1.1, 1e-3)); assert.throws(() => assertNear(1, 1)); assert.throws(() => assertVecNear([1], [1, 2], 1));
});

test('Hive loader and pose comparison work on a real model', () => {
  const doc = createDemoDocument(), result = sanityTest(doc.serialize('mdx'));
  assert.equal(result.errors, 0); assert.ok(Array.isArray(result.nodes));
  assert.ok(globalThis.ModelViewer);
  const { max, samples } = maxNodeMatrixDifference(doc.model, structuredClone(doc.model), { step: 50 });
  assert.equal(max, 0); assert.ok(samples > 0);
  assert.equal(comparePoses(doc.model, doc.model, () => {}, { step: 50 }), samples);
});

const fakeFiberPage = hook => {
  const runtime = { native: {}, controls: {} }, props = { model: {}, onPoseCommit() {} }, session = { doc: { model: {} }, assets: new Map() };
  const hooks = (...states) => states.reduceRight((next, memoizedState) => ({ memoizedState, next }), null);
  const app = { memoizedState: hooks(session), return: null }, preview = { memoizedState: hooks({ current: runtime }, { current: props }), return: app };
  const element = { '__reactFiber$abc': { memoizedState: null, return: preview } };
  const window = { __mdlxl: hook }, document = { querySelector: () => element };
  vm.runInNewContext(PROBE_SOURCE, { window, document });
  return { window, runtime, props, session, element };
};

test('page probes find editor owners through the hook or, on older builds, through React fibers', () => {
  const fiber = fakeFiberPage(undefined), found = fiber.window.mdlxlProbe();
  assert.equal(found.runtime, fiber.runtime); assert.equal(found.props, fiber.props); assert.equal(found.session, fiber.session);
  assert.equal(fiber.window.findFiberState('.game-preview-root', state => !!state?.onPoseCommit), fiber.props);
  const runtime = { native: {}, controls: {} }, props = { model: {} }, session = { doc: { model: {} } };
  const hooked = fakeFiberPage({ session: () => session, preview: () => ({ runtime, props }) }).window.mdlxlProbe();
  assert.equal(hooked.runtime, runtime); assert.equal(hooked.props, props); assert.equal(hooked.session, session);
});

test('the app test hook appears only when the desktop bridge enables it, and is read-only', async () => {
  const saved = { window: globalThis.window, document: globalThis.document };
  try {
    const element = {};
    globalThis.document = { querySelector: () => element };
    globalThis.window = { desktop: { testHook: false } };
    await import('../app/test-hook.js?off');
    assert.equal(globalThis.window.__mdlxl, undefined);
    globalThis.window = { desktop: { testHook: true } };
    const { exposeAppForTests, exposePreviewForTests } = await import('../app/test-hook.js?on');
    const hook = globalThis.window.__mdlxl, doc = { model: { Bones: [] } };
    assert.equal(hook.session(), null);
    exposeAppForTests(() => ({ session: { doc }, doc, selection: { a: 1 }, selectedNodeIds: [2], activeGeoset: 0 }));
    exposePreviewForTests(element, () => ({ runtime: 'r', props: 'p' }));
    assert.equal(hook.document(), doc); assert.equal(hook.model(), doc.model); assert.deepEqual(hook.selection(), { selection: { a: 1 }, selectedNodeIds: [2], activeGeoset: 0 });
    assert.deepEqual(hook.preview(), { runtime: 'r', props: 'p' }); assert.equal(hook.preview({}), null);
    assert.ok(Object.isFrozen(hook));
  } finally { globalThis.window = saved.window; globalThis.document = saved.document; }
});


test('page probes distinguish sibling previews and find Citadel props and ref states across the tree', () => {
  const page = fakeFiberPage(undefined), fiber = page.element['__reactFiber$abc'];
  const runtime = { renderer: {}, camera: {} }, props = { originalModel: {}, onWorkingModelChange() {} };
  const workspace = { memoizedProps: props, memoizedState: null };
  const viewport = { memoizedState: { memoizedState: { current: runtime }, next: null }, sibling: null };
  workspace.sibling = viewport;
  const root = { child: workspace, memoizedState: null };
  fiber.return = { stateNode: { current: root }, memoizedState: null, return: null };
  assert.equal(page.window.findFiberState('.paint-workspace', value => value?.originalModel, { tree: true, props: true }), props);
  assert.equal(page.window.findFiberState('.paint-workspace', value => value?.renderer && value.camera, { tree: true }), runtime);
  assert.equal(page.window.findFiberState('.paint-workspace', value => value?.renderer), null);
  const other = fakeFiberPage(undefined);
  assert.equal(page.window.mdlxlProbe(other.element).runtime, other.runtime);
  assert.equal(page.window.mdlxlProbe(other.element).props, other.props);
});

test('owner props probe reads the committed host rather than its stale DOM fiber', () => {
  const element = {}, staleProps = { value: 'old' }, currentProps = { value: 'current' };
  const oldRoot = { return: null }, currentRoot = { return: null };
  oldRoot.stateNode = { current: currentRoot };
  const staleOwner = { memoizedProps: staleProps, return: oldRoot };
  element.__reactFiber$props = { stateNode: element, return: staleOwner };
  const currentOwner = { memoizedProps: currentProps, return: currentRoot };
  const currentHost = { stateNode: element, return: currentOwner };
  currentRoot.child = currentOwner; currentOwner.child = currentHost;
  const window = {}, document = { querySelector: selector => selector === '.owner' ? element : null };
  vm.runInNewContext(PROBE_SOURCE, { window, document });
  assert.equal(window.findFiberProps('.owner', props => !!props.value), currentProps);
  assert.equal(window.findFiberProps('.owner', props => !!props.missing), null);
  assert.equal(window.findFiberProps('.missing', () => true), null);
});
