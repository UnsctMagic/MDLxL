import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera } from 'three';
import { createStarterDocument } from '../src/starter-model.js';
import { createDemoDocument, createNode, openDocument } from '../src/editor-document.js';
import { runOptimizeStage, SPHERE_PRESETS, presetShapes } from '../src/optimizexl.js';
import { stageAvailability } from '../src/optimizexl-availability.js';
import { fitCollisionShapes, fitSpheres } from '../src/model-collisions.js';
import { collisionStageSnapshot } from '../app/collision-stage.js';

const preset = name => SPHERE_PRESETS.findIndex(p => p.name === name);

test('Sphereomancer saves boxes and mixed presets as native collision shapes', () => {
  const bytes = createStarterDocument().serialize('mdx');
  const cavalry = runOptimizeStage(bytes, 'spheres', { preset: preset('Cavalry'), size: 2 }), m = openDocument(cavalry.bytes, 'x.mdx').model;
  assert.deepEqual(m.CollisionShapes.map(n => n.Shape), [0, 2]);
  assert.deepEqual(Array.from(m.CollisionShapes[0].Vertices), SPHERE_PRESETS[preset('Cavalry')].spheres[0].map(v => Math.fround(v * 2)));
  assert.equal(m.CollisionShapes[0].Name, 'OptimizeXL Box 1');
  assert.equal(m.CollisionShapes[1].BoundsRadius, Math.fround(SPHERE_PRESETS[preset('Cavalry')].spheres[1][3] * 2));
  for (const format of ['mdl', 'mdx']) {
    const doc = openDocument(cavalry.bytes, 'x.mdx'), again = openDocument(doc.serialize(format), 'again.' + format).model;
    assert.deepEqual(again.CollisionShapes.map(n => [n.Shape, Array.from(n.Vertices).length]), [[0, 6], [2, 3]], format);
  }
  assert.throws(() => runOptimizeStage(bytes, 'spheres', { size: 1, spheres: [[10, 0, 0, 0, 10, 10]] }), /maximum corner/);
});

test('a model whose collision is one valid box needs no Sphereomancer star', async () => {
  const doc = createStarterDocument();
  doc.apply('Origin', ['Attachments', 'PivotPoints'], m => { createNode(m, 'Attachment').Name = 'Origin Ref'; });
  const boxed = runOptimizeStage(doc.serialize('mdx'), 'spheres', { size: 1, preset: preset('Small building') }).bytes;
  for await (const item of stageAvailability(boxed)) if (item.stage === 'spheres') assert.equal(item.hasChanges, false);
});

test('fitting stacks equal spheres along a standing body and stands boxes on the ground', () => {
  // A footman-sized column: 60 wide, 100 tall, standing on Z=0.
  const points = [];
  for (let z = 0; z <= 100; z += 5) for (let a = 0; a < 16; a++) points.push([Math.cos(a / 16 * Math.PI * 2) * 30, Math.sin(a / 16 * Math.PI * 2) * 30, z]);
  const spheres = fitSpheres(points);
  assert.equal(spheres.length, 2);
  assert.ok(spheres.every(s => Math.abs(s[0]) < 1 && Math.abs(s[1]) < 1 && Math.abs(s[3] - spheres[0][3]) < 1e-4));
  assert.ok(spheres[0][2] < 50 && spheres[1][2] > 50);
  // Lying down (a wolf or horse), the same body stacks along its length.
  const lying = fitSpheres(points.map(([x, y, z]) => [z, y, x + 30]));
  assert.ok(lying.length >= 2 && Math.abs(lying[0][0] - lying[1][0]) > 30 && Math.abs(lying[0][2] - lying[1][2]) < 1);

  const model = createDemoDocument().model;
  const [box] = fitCollisionShapes(model, 'box');
  assert.equal(box.length, 6);
  assert.ok([0, 1, 2].every(axis => box[axis + 3] > box[axis]));
  assert.deepEqual(presetShapes(preset('Fit to model (box)'), model), [box]);
  const fitted = presetShapes(preset('Fit to model (spheres)'), model);
  assert.ok(fitted.length >= 1 && fitted.every(s => s.length === 4 && s[3] > 0));
  assert.ok(openDocument(runOptimizeStage(createDemoDocument().serialize('mdx'), 'spheres', { size: 1, preset: preset('Fit to model (spheres)') }).bytes, 'x.mdx').model.CollisionShapes.length === fitted.length);
});

test('a sphere draws as one camera-facing outline plus a faint ground ring', () => {
  const camera = new PerspectiveCamera(45, 1.5, .1, 10000); camera.position.set(180, -220, 140); camera.lookAt(0, 0, 40); camera.updateMatrixWorld();
  const shape = { ObjectId: -1, Shape: 2, Vertices: new Float32Array([0, 0, 40]), BoundsRadius: 30 };
  const row = collisionStageSnapshot({ rendererData: { nodes: [] } }, camera, 900, 600, [shape], -1).rows[0];
  assert.equal(row.outlines.length, 1); assert.equal(row.guides.length, 1);
  const distances = row.outlines[0].map(p => Math.hypot(p[0] - row.center[0], p[1] - row.center[1]));
  assert.ok(Math.max(...distances) - Math.min(...distances) < Math.max(...distances) * .02, 'outline is a circle around the center');
  assert.equal(row.handles.length, 6);
});
