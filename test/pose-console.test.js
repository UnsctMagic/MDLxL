import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Vector3 } from 'three';
import { normalizePreferences } from '../src/preferences.js';
import { BUILT_IN_VIEWPORT_PRESETS as presets } from '../src/viewport-appearance.js';
import { exportConfiguration, importConfiguration } from '../src/portable-settings.js';
import { movementPinPosition } from '../app/movement-overlay.js';
import { projectPoseSkeleton, pickPoseHandle, drawPoseOverlay } from '../app/pose-overlay.js';
import { openDocument } from '../src/editor-document.js';
import { applyMovementPose } from '../src/movement.js';
import { suggestPoseRig, samplePoseChain, solvePoseLimb, poseTrackScope, poseChainIds } from '../src/pose-ik.js';
import {createRequire} from 'node:module';
const {testModel}=createRequire(import.meta.url)('./helpers/fixtures.cjs');

test('each appearance includes controllers; mixed sets and custom shapes survive configuration export', () => {
  const looks = new Set();
  for (const preset of Object.values(presets)) {
    const { controllers, ...legacy } = preset.appearance;
    looks.add(JSON.stringify(controllers));
    const migrated = normalizePreferences({ rendererRevision: 3, theme: preset.theme, viewportAppearance: legacy });
    assert.deepEqual(migrated.viewportAppearance.controllers, controllers);
  }
  assert.equal(looks.size, 7);
  const prefs = normalizePreferences({ rendererRevision: 3, theme: 'light', viewportAppearance: { ...presets['mdlvis-vanilla'].appearance, controllers: { ...presets['blender-style'].appearance.controllers, bendShape: 'triangle', pinStyle: 'round', size: 22 } } });
  assert.deepEqual(importConfiguration(JSON.stringify(exportConfiguration(prefs))), prefs);
  assert.equal(prefs.theme, 'light'); assert.equal(prefs.viewportAppearance.controllers.shape, 'square');
  assert.equal(prefs.viewportAppearance.background.color, '#cccccc');
  const invalid = normalizePreferences({ rendererRevision: 3, viewportAppearance: { controllers: { color: 'red', shape: 'bad', size: 900, pinStyle: 'bad' } } });
  assert.equal(invalid.viewportAppearance.controllers.size, 24);
  assert.equal(invalid.viewportAppearance.controllers.shape, 'circle');
});

test('Pin clears the outward ends of the gizmo on either side, rejecting an inward preferred position', () => {
  for (const side of [-1, 1]) {
    const body = { kind: 'body', label: 'Body', x: 400, y: 250, visible: true };
    const limb = { kind: 'endpoint', chain: { kind: 'leg' }, x: 400 + 110 * side, y: 400, visible: true };
    const arrow = { startX: limb.x, startY: limb.y, dx: 100 * side, dy: 0, x: limb.x + 100 * side, y: limb.y };
    const position = movementPinPosition(limb, [arrow], 900, 700, 76, 28, [body, limb], { x: -100 * side, y: -14 });
    assert.ok(side > 0 ? position.x > arrow.x : position.x + 76 < arrow.x, 'outside all arrows');
    assert.deepEqual(movementPinPosition(limb, [arrow], 900, 700, 76, 28, [body, limb], { x: position.x - limb.x, y: position.y - limb.y }), position);
  }
});

test('pose skeleton connects controls and joints without native mesh/weapon branches', () => {
  const points = [{ ObjectId: 0 }, { ObjectId: 1, Parent: 0 }, { ObjectId: 2, Parent: 1 }, { ObjectId: 3, Parent: 2 }, { ObjectId: 4, Parent: 1 }, { ObjectId: 5, Parent: 4 }].map(node => ({ node, visible: true, x: node.ObjectId * 10, y: 0 }));
  const body = { ...points[0], id: 0, kind: 'body', selected: true };
  const limb = { kind: 'endpoint', chain: { root: 1 }, joints: points.slice(1, 4), key: 'arm' };
  const segments = projectPoseSkeleton(points, [body, limb], { target: { kind: 'body' } });
  assert.equal(segments.length, 3);
  assert.ok(segments.every(segment => segment.selected));
  assert.ok(segments.every(segment => segment.from.x <= 30 && segment.to.x <= 30));
  const square = { kind: 'endpoint', key: 'arm', x: 100, y: 100, visible: true, shape: 'square', size: 24 };
  assert.equal(pickPoseHandle([square], 122, 122, null, [], false), square, 'square corners are pickable');
});

test('Restrict switches body lead off for hands and feet, retaining native limb edits and exact Undo', { skip: !fs.existsSync(testModel('pose/Footman.mdx')) }, () => {
  const doc = openDocument(fs.readFileSync(testModel('pose/Footman.mdx'))), before = structuredClone(doc.model);
  const rig = { ...suggestPoseRig(doc.model, 500, 0), pins: [] };
  for (const kind of ['arm', 'leg']) for (const restrict of [false, true, undefined]) {
    const config = { ...rig, restrict }, chain = rig.chains.find(chain => chain.kind === kind), pose = samplePoseChain(doc.model, chain, 500, 0);
    const result = solvePoseLimb(doc.model, chain, 500, 0, pose.end.clone().add(new Vector3(2, 1, 2)), { config });
    const scope = poseTrackScope(config, { kind: 'endpoint', key: chain.key }, 'move', doc.model), ids = new Set(poseChainIds(chain));
    assert.ok(result.changes.every(change => scope.some(item => item.id === change.id && item.property === change.property)));
    assert.equal(result.changes.some(change => !ids.has(change.id)), restrict === false, kind + ' body lead');
    doc.apply('Pose', ['Nodes'], model => applyMovementPose(model, result.changes, 500, 0));
    assert.ok(samplePoseChain(doc.model, chain, 500, 0).end.distanceTo(pose.end) > .1);
    assert.ok(doc.undo()); assert.deepEqual(doc.model, before);
  }
});

test('drawing differently shaped controls never leaks scaling into following handles or frames', () => {
  let depth = 0, scale = 1;
  const stack = [];
  const context = new Proxy({ save() { stack.push(scale); depth++; }, restore() { scale = stack.pop(); depth--; }, scale(x) { scale *= x; } }, { get: (target, key) => target[key] || (() => {}) });
  const appearance = { ...presets['mdlvis-vanilla'].appearance.controllers, symbols: false };
  const handles = ['circle', 'diamond', 'triangle', 'square'].map((shape, index) => ({ shape, size: 12 + index * 3, kind: index === 2 ? 'bend' : 'body', x: 40 + index * 50, y: 50, visible: true, label: 'Body' }));
  for (let frame = 0; frame < 3; frame++) { drawPoseOverlay(context, handles, 2, null, appearance); assert.equal(depth, 0); assert.equal(scale, 1); }
});
