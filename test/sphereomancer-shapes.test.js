import test from 'node:test';
import assert from 'node:assert/strict';
import { OrthographicCamera, PerspectiveCamera } from 'three';
import { createStarterDocument } from '../src/starter-model.js';
import { createNode, openDocument } from '../src/editor-document.js';
import { runOptimizeStage, SPHERE_PRESETS, presetShapes, simpleSettings } from '../src/optimizexl.js';
import { stageAvailability } from '../src/optimizexl-availability.js';
import { collisionStageSnapshot } from '../app/collision-stage.js';

const preset = name => SPHERE_PRESETS.findIndex(p => p.name === name);

test('Sphereomancer saves boxes and mixed presets as native collision shapes', () => {
  const bytes = createStarterDocument().serialize('mdx');
  const rows = [...presetShapes(preset('Square')), ...presetShapes(preset('x1'))];
  const cavalry = runOptimizeStage(bytes, 'spheres', { spheres: rows, size: 2 }), m = openDocument(cavalry.bytes, 'x.mdx').model;
  assert.deepEqual(m.CollisionShapes.map(n => n.Shape), [0, 2]);
  assert.deepEqual(Array.from(m.CollisionShapes[0].Vertices), rows[0].map(v => Math.fround(v * 2)));
  assert.equal(m.CollisionShapes[0].Name, 'OptimizeXL Box 1');
  assert.equal(m.CollisionShapes[1].BoundsRadius, Math.fround(rows[1][3] * 2));
  for (const format of ['mdl', 'mdx']) {
    const doc = openDocument(cavalry.bytes, 'x.mdx'), again = openDocument(doc.serialize(format), 'again.' + format).model;
    assert.deepEqual(again.CollisionShapes.map(n => [n.Shape, Array.from(n.Vertices).length]), [[0, 6], [2, 3]], format);
  }
  assert.throws(() => runOptimizeStage(bytes, 'spheres', { size: 1, spheres: [[10, 0, 0, 0, 10, 10]] }), /maximum corner/);
});

test('a model whose collision is one valid box needs no Sphereomancer star', async () => {
  const doc = createStarterDocument();
  doc.apply('Origin', ['Attachments', 'PivotPoints'], m => { createNode(m, 'Attachment').Name = 'Origin Ref'; });
  const boxed = runOptimizeStage(doc.serialize('mdx'), 'spheres', { size: 1, preset: preset('Square') }).bytes;
  for await (const item of stageAvailability(boxed)) if (item.stage === 'spheres') assert.equal(item.hasChanges, false);
});

test('five fixed native presets in owner order, with x2 standard unit as default', () => {
  assert.deepEqual(SPHERE_PRESETS.map(p => p.name), ['x1','x2 standard unit','x3','Mounted','Square']);
  const model = createStarterDocument().model, settings = simpleSettings('spheres',0,model);
  assert.equal(settings.preset,1); assert.deepEqual(settings.spheres,presetShapes(1));
  assert.deepEqual(presetShapes(0),[[3.5388801097869873,3.874919891357422,41.05950164794922,52.40719985961914]]);
  assert.deepEqual(presetShapes(1),[[5.257450103759766,0,63.22100067138672,38.07600021362305],[3.239419937133789,0,22.847400665283203,38.07600021362305]]);
  assert.deepEqual(presetShapes(2),[...presetShapes(1),[5.257450103759766,0,63.22100067138672+40.3736,38.07600021362305]]);
  assert.deepEqual(presetShapes(3),[[0,0,45,55],[35,0,95,55],[-15,0,75,55]]);
  assert.deepEqual(presetShapes(4),[[-56.55099868774414,-64.06929779052734,0,56.55099868774414,64.06929779052734,113.10199737548828]]);
  settings.spheres[0][0]=999; assert.notEqual(presetShapes(1)[0][0],999,'presets are copied');
});

test('a sphere draws as one camera-facing outline plus a faint ground ring', () => {
  const camera = new PerspectiveCamera(45, 1.5, .1, 10000); camera.position.set(180, -220, 140); camera.lookAt(0, 0, 40); camera.updateMatrixWorld();
  const shape = { ObjectId: -1, Shape: 2, Vertices: new Float32Array([0, 0, 40]), BoundsRadius: 30 };
  const row = collisionStageSnapshot({ rendererData: { nodes: [] } }, camera, 900, 600, [shape], -1).rows[0];
  assert.equal(row.outlines.length, 1); assert.equal(row.guides.length, 1);
  const distances = row.outlines[0].map(p => Math.hypot(p[0] - row.center[0], p[1] - row.center[1]));
  assert.ok(Math.max(...distances) - Math.min(...distances) < Math.max(...distances) * .02, 'outline is a circle around the center');
  assert.equal(row.handles.length, 1);
  assert.deepEqual(row.handles[0].point,row.outlines[0][0],'radius grab is on the visible outline');
  assert.ok(row.handles[0].basis.unitsPerPixel>0);
  assert.ok(row.move.dx.every(Number.isFinite)&&row.move.dy.every(Number.isFinite));
});

// Outline faces resize the dimensions visible in this view; depth stays out of the way.
for (const [view, position, perspective, expected] of [
  ['Front', [0,-300,40], false, [[0,-1],[0,1],[2,-1],[2,1]]],
  ['Side', [300,0,40], false, [[1,-1],[1,1],[2,-1],[2,1]]],
  ['Top', [0,0,340], false, [[0,-1],[0,1],[1,-1],[1,1]]],
  ['angled Perspective', [180,-220,140], true, [[0,-1],[0,1],[1,-1],[1,1],[2,-1],[2,1]]],
  ['level centred Perspective', [0,-300,40], true, [[0,-1],[0,1],[2,-1],[2,1]]],
]) test('box outline handles in '+view, () => {
  const camera=perspective?new PerspectiveCamera(45,1.5,.1,10000):new OrthographicCamera(-150,150,100,-100,.1,10000);
  camera.up.set(0,0,1);camera.position.fromArray(position);camera.lookAt(0,0,40);camera.updateMatrixWorld();
  const shape={ObjectId:-1,Shape:0,Vertices:new Float32Array([-30,-30,0,30,30,80])};
  const row=collisionStageSnapshot({rendererData:{nodes:[]}},camera,900,600,[shape],-1).rows[0];
  assert.deepEqual(row.handles.map(h=>[h.axis,h.sign]),expected,view+' exposes visible dimensions, excluding projected depth');
  for(const handle of row.handles) assert.ok(handle.basis.unitsPerPixel>0 && Number.isFinite(handle.basis.unitsPerPixel));
});

test('Sphereomancer begins with authored spheres and boxes, copied independently of presets', () => {
 const doc=createStarterDocument();doc.apply('Authored collisions',['CollisionShapes','Nodes','PivotPoints'],m=>{
  Object.assign(createNode(m,'CollisionShape'),{Shape:2,Vertices:new Float32Array([12,-8,61]),BoundsRadius:27});
  Object.assign(createNode(m,'CollisionShape'),{Shape:0,Vertices:new Float32Array([-20,-30,0,45,65,92])});
 });
 const settings=simpleSettings('spheres',0,doc.model);
 assert.deepEqual(settings.spheres,[[12,-8,61,27],[-20,-30,0,45,65,92]]);
 assert.equal(settings.size,1);assert.equal(settings.preset,null,'authored shapes are distinct from a chosen preset');
 settings.spheres[0][0]=999;assert.equal(doc.model.CollisionShapes[0].Vertices[0],12);
 assert.deepEqual(presetShapes(1),SPHERE_PRESETS[1].spheres,'choosing a preset replaces authored rows');
});

test('each sphere has a separate right-side selection box and boxes keep their existing controls', () => {
 const camera=new PerspectiveCamera(45,1.5,.1,10000);camera.position.set(180,-220,140);camera.lookAt(0,0,40);camera.updateMatrixWorld();
 const shapes=[{ObjectId:-1,Shape:2,Vertices:new Float32Array([0,0,40]),BoundsRadius:30},{ObjectId:-2,Shape:2,Vertices:new Float32Array([0,0,90]),BoundsRadius:25},{ObjectId:-3,Shape:0,Vertices:new Float32Array([-30,-30,0,30,30,80])}];
 const rows=collisionStageSnapshot({rendererData:{nodes:[]}},camera,900,600,shapes,-1).rows;
 for(const row of rows.slice(0,2)) { assert.ok(row.selectionBox,'every sphere, selected or not, has its own box');assert.ok(row.selectionBox[0]>Math.max(...row.outlines[0].map(p=>p[0]))+12,'selection box sits to the right of the sphere');assert.equal(row.selectionBox[1],row.center[1]); }
 assert.equal(rows[2].selectionBox,undefined);
});
