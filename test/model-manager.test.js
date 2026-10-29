import { analyzeOptimization, applyOptimization } from '../src/model-optimizer.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { Matrix4, PerspectiveCamera, Vector3 } from 'three';
import { createDemoDocument, openDocument, createNode, deleteNode } from '../src/editor-document.js';
import { collisionCenter, fittedCollision, moveCollision, resizeCollision } from '../src/model-collisions.js';
import { collisionStageSnapshot } from '../app/collision-stage.js';
import { MODEL_COMMENTS_KEY, readModelComments, writeModelComments } from '../src/model-comments.js';
import { createGeosetTab, assignGeosetTab, GEOSET_TABS_KEY } from '../src/geoset-tabs.js';

for (const format of ['mdx', 'mdl']) test(`${format}: model name, native sphere and box survive save, undo, redo and removal`, () => {
  const doc = openDocument(createDemoDocument().serialize(format), `model.${format}`);
  doc.apply('Model setup', ['Info', 'CollisionShapes', 'Nodes', 'PivotPoints'], m => {
    m.Info.Name = 'Collision review';
    for (const type of [2, 0]) { const shape = createNode(m, 'CollisionShape'); Object.assign(shape, fittedCollision(m, type)); }
  });
  const shapes = structuredClone(doc.model.CollisionShapes);
  doc.apply('Move and resize', ['CollisionShapes'], m => { moveCollision(m.CollisionShapes[0], [10, -8, 7]); resizeCollision(m.CollisionShapes[1], 1, 57); });
  const output = doc.serialize(), reopened = openDocument(output, `saved.${format}`);
  assert.equal(reopened.model.Info.Name, 'Collision review');
  assert.equal(reopened.model.CollisionShapes[0].Shape, 2);
  assert.equal(reopened.model.CollisionShapes[1].Shape, 0);
  assert.deepEqual(collisionCenter(reopened.model.CollisionShapes[0]), collisionCenter(doc.model.CollisionShapes[0]));
  assert.equal(reopened.model.CollisionShapes[1].Vertices[4] - reopened.model.CollisionShapes[1].Vertices[1], 57);
  doc.undo(); assert.deepEqual(doc.model.CollisionShapes, shapes);
  doc.redo();
  doc.apply('Remove', ['CollisionShapes', 'Nodes', 'PivotPoints'], m => deleteNode(m, m.CollisionShapes[0].ObjectId));
  assert.equal(openDocument(doc.serialize(), `removed.${format}`).model.CollisionShapes.length, 1);
  doc.undo(); assert.equal(doc.model.CollisionShapes.length, 2);
});

test('collision drag mapping follows transformed parents and resize keeps the center', () => {
  const matrix = new Matrix4().makeRotationZ(.7).premultiply(new Matrix4().makeTranslation(15, 20, 3)).scale(new Vector3(2, 2, 2));
  const shape = { ObjectId: 0, Shape: 0, Vertices: new Float32Array([-10,-20,-30,10,20,30]) };
  const native = { rendererData: { nodes: [{ matrix: matrix.elements }] } };
  const camera = new PerspectiveCamera(45, 1.5, .1, 10000);camera.position.set(180,180,200);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const first = collisionStageSnapshot(native, camera, 900, 600, [shape], 0).rows[0];
  moveCollision(shape, first.move.dx.map((v,i)=>v*30+first.move.dy[i]*-15));
  const next = collisionStageSnapshot(native, camera, 900, 600, [shape], 0).rows[0];
  assert.ok(Math.abs(next.center[0]-first.center[0]-30)<.001);
  assert.ok(Math.abs(next.center[1]-first.center[1]+15)<.001);
  const center = collisionCenter(shape); resizeCollision(shape, 2, -3);
  assert.ok(Math.abs(shape.Vertices[5]-shape.Vertices[2]-.01)<.00001);
  assert.deepEqual(collisionCenter(shape), center);
});

test('standard MDL header comments persist independently of geometry and private geoset metadata', () => {
  const original = createDemoDocument().serialize('mdl');
  const doc = openDocument(original, 'comments.mdl');
  const text = 'Author notes\nA second line // and */ are harmless\nРусский 简体中文';
  doc.apply('Comments', [MODEL_COMMENTS_KEY], m => { m[MODEL_COMMENTS_KEY] = text; });
  assert.equal(doc.dirty, true); assert.equal(doc.saveImpact().exact, false);
  const saved = doc.serialize(); assert.equal(readModelComments(saved, 'mdl'), text);
  assert.ok(Buffer.from(saved).toString().includes('// A second line // and */ are harmless'));
  doc.markSaved(saved); assert.equal(doc.dirty, false);
  doc.apply('Tabs', [GEOSET_TABS_KEY, 'Geosets'], m => { const id = createGeosetTab(m, 'Armor'); assignGeosetTab(m, [0], id); });
  doc.apply('Name', ['Info'], m => { m.Info.Name = 'New name'; });
  const reopened = openDocument(doc.serialize(), 'comments.mdl');
  assert.equal(reopened.model[MODEL_COMMENTS_KEY], text);
  assert.equal(reopened.model[GEOSET_TABS_KEY][0].name, 'Armor');
  doc.undo();doc.undo();doc.undo();assert.equal(doc.model[MODEL_COMMENTS_KEY] || '', readModelComments(original, 'mdl'));
});

test('comment editing leaves inline comments untouched and cannot inject native sections', () => {
  const source = Buffer.from('// First\n/* Second */\nVersion { FormatVersion 800, } // inline\n');
  const text = '*/\nModel "injected" {}\n//';
  const result = writeModelComments(source, 'mdl', text);
  assert.equal(readModelComments(result, 'mdl'), text);
  assert.ok(result.toString().endsWith('Version { FormatVersion 800, } // inline\n'));
  assert.deepEqual(writeModelComments(result, 'mdl', text), result);
  assert.deepEqual(writeModelComments(Buffer.from('MDLX'), 'mdx', text), Buffer.from('MDLX'));
});


test('optimizer MDX verification permits MDL comments and preserves them on apply and save', () => {
  const doc = openDocument(createDemoDocument().serialize('mdl'), 'comments.mdl');
  doc.apply('Comments and unused material', [MODEL_COMMENTS_KEY, 'Materials'], m => {
    m[MODEL_COMMENTS_KEY] = 'Keep these standard model comments';
    m.Materials.push(structuredClone(m.Materials[0]));
  });
  const report = analyzeOptimization(doc);
  assert.equal(report.canApply, true);
  applyOptimization(doc, report);
  assert.equal(openDocument(doc.serialize('mdl'), 'saved.mdl').model[MODEL_COMMENTS_KEY], 'Keep these standard model comments');
  doc.undo();
  assert.equal(doc.model[MODEL_COMMENTS_KEY], 'Keep these standard model comments');
});


test('models without standard comments do not acquire extra serialization fields', () => {
  for (const format of ['mdl', 'mdx']) {
    const doc = openDocument(writeModelComments(createDemoDocument().serialize(format), format, ''), `plain.${format}`);
    assert.equal(Object.hasOwn(doc.model, MODEL_COMMENTS_KEY), false);
  }
});


test('reserved-looking user comments and literal escape prefixes survive repeated MDL saves', () => {
  const doc=openDocument(createDemoDocument().serialize('mdl'),'comments.mdl');
  const text='MDLXL_GEOSET_TABS is a user note\n\MDLXL_ESCAPED\n\\two backslashes\n\ordinary\n MDLXL_indented';
  doc.apply('Comments',[MODEL_COMMENTS_KEY],m=>{m[MODEL_COMMENTS_KEY]=text;});
  doc.apply('Tabs',[GEOSET_TABS_KEY],m=>{createGeosetTab(m,'Armor');});
  const saved=doc.serialize('mdl'), reopened=openDocument(saved,'reopened.mdl');
  assert.equal(reopened.model[MODEL_COMMENTS_KEY],text);
  assert.equal(reopened.model[GEOSET_TABS_KEY][0].name,'Armor');
  reopened.apply('Name',['Info'],m=>{m.Info.Name='Renamed';});
  assert.equal(openDocument(reopened.serialize('mdl'),'again.mdl').model[MODEL_COMMENTS_KEY],text);
  assert.equal(readModelComments(writeModelComments(saved,'mdl',''),'mdl'),'');
});
