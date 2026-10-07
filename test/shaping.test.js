import test from 'node:test';
import assert from 'node:assert/strict';
import { buildForgeMesh, commitForge } from '../src/forge.js';
import { SHAPE_TOOLS, previewShape, resolveShapeSelection, shapeGeosets } from '../src/shaping.js';
import { createDemoDocument, openDocument } from '../src/editor-document.js';
import { buildForgePrimitive } from '../src/forge-primitives.js';
import { previewSupportedShape, shapeGeosetsWithSupport } from '../src/shaping-support.js';

const setup = () => { const doc = createDemoDocument(), mesh = buildForgeMesh({ width: 16, height: 16, mask: new Uint8Array(256).fill(1), detail: 35, thickness: 1, trim: true }); const result = doc.apply('Forge', [], m => commitForge(m, mesh, { texturePath: 'test.tga' })); return { doc, indices: result.geosetIndices }; };
test('a shield bends through its middle and folds at an exact selected vertex row in either direction', () => {
  const mesh = buildForgePrimitive({ shape: 'Grid', complexity: 1, width: 100, height: 100 }), model = { Geosets: mesh.geosets, Info: {}, Sequences: [] }, selection = resolveShapeSelection(model, [0]), source = model.Geosets[0].Vertices.slice();
  for (const direction of [1, 2]) {
    const bent = previewShape(model, selection, { tool: 'Bend', axis: 0, direction, amount: 90, pivot: 'middle' }).Geosets[0].Vertices;
    for (let id = 0; id < source.length / 3; id++) if (source[id * 3] === 0) assert.ok(Math.abs(bent[id * 3] - source[id * 3]) < 1e-6);
    assert.notDeepEqual(bent, source); assert.deepEqual(model.Geosets[0].Vertices, source);
  }
  const folded = previewShape(model, selection, { tool: 'Bend', axis: 0, direction: 2, amount: 90, pivot: 'selected', origin: [0, 0, 0], bendStyle: 'fold' }).Geosets[0].Vertices;
  for (let id = 0; id < source.length / 3; id++) { const x = source[id * 3]; assert.ok(Math.abs(folded[id * 3] - x / Math.sqrt(2)) < 1e-4); assert.ok(Math.abs(folded[id * 3 + 2] + Math.abs(x) / Math.sqrt(2)) < 1e-4); }
  for (const pivot of ['start', 'end']) { const anchor = pivot === 'start' ? -50 : 50, bent = previewShape(model, selection, { tool: 'Bend', axis: 0, direction: 2, amount: 45, pivot }).Geosets[0].Vertices; for (let id = 0; id < source.length / 3; id++) if (source[id * 3] === anchor) assert.deepEqual(bent.slice(id * 3, id * 3 + 3), source.slice(id * 3, id * 3 + 3)); }
});
test('selected centers and local influence shape only the requested area and preserve rigging and UVs', () => {
  const mesh = buildForgePrimitive({ shape: 'Grid', complexity: 4 }), model = { Geosets: mesh.geosets, Info: {}, Sequences: [] }, selection = resolveShapeSelection(model, [0]), before = structuredClone(model);
  for (const tool of ['Bend', 'Warp', 'Dome', 'Wrap', 'Taper']) {
    const result = previewShape(model, selection, { tool, axis: tool === 'Dome' ? 2 : 0, direction: tool === 'Dome' ? 0 : 2, amount: 30, pivot: 'selected', origin: [0, 0, 0], radius: 30 }), source = before.Geosets[0], moved = result.Geosets[0];
    assert.notDeepEqual(moved.Vertices, source.Vertices, tool);
    for (let id = 0; id < source.Vertices.length / 3; id++) if (Math.hypot(...source.Vertices.slice(id * 3, id * 3 + 3)) >= 30) assert.deepEqual(moved.Vertices.slice(id * 3, id * 3 + 3), source.Vertices.slice(id * 3, id * 3 + 3));
    assert.deepEqual(moved.TVertices, source.TVertices); assert.deepEqual(moved.Faces, source.Faces); assert.deepEqual(model, before);
  }
  assert.throws(() => previewShape(model, selection, { pivot: 'selected' }), /Select vertices/);
  assert.throws(() => previewShape(model, selection, { axis: 0, direction: 0 }), /differ/);
});
test('selection uses arbitrary checked geosets and only selected vertices when present', () => {
  const { doc } = setup();
  const selected = resolveShapeSelection(doc.model, new Set([0, 1]), { 0: [0, 1] }); assert.deepEqual(selected, { 0: [0, 1] });
  const all = resolveShapeSelection(doc.model, new Set([0, 1])); assert.equal(all[0].length, doc.model.Geosets[0].Vertices.length / 3); assert.equal(all[1].length, doc.model.Geosets[1].Vertices.length / 3);
});
test('local shaping uses the chosen edge or vertex center, including depth on a solid', () => {
  const model = { Geosets: buildForgePrimitive({ shape: 'Cube', depth: 20 }).geosets, Info: {}, Sequences: [] }, selection = resolveShapeSelection(model, [0]), source = model.Geosets[0].Vertices;
  const dome = previewShape(model, selection, { tool: 'Dome', axis: 2, pivot: 'selected', origin: [0, 0, 10], amount: 5, radius: 15 }).Geosets[0].Vertices;
  assert.notDeepEqual(dome, source);
  for (let id = 0; id < source.length / 3; id++) if (source[id * 3 + 2] === -10) assert.deepEqual(dome.slice(id * 3, id * 3 + 3), source.slice(id * 3, id * 3 + 3));
  const bent = previewShape(model, selection, { tool: 'Bend', axis: 0, direction: 2, pivot: 'start', amount: 30, radius: 40 }).Geosets[0].Vertices;
  assert.notDeepEqual(bent, source);
  for (let id = 0; id < source.length / 3; id++) if (source[id * 3] >= 0) assert.deepEqual(bent.slice(id * 3, id * 3 + 3), source.slice(id * 3, id * 3 + 3));
});
test('optional Forge grid support bends a four-corner shield and preserves UV mapping, rigging, persistence and undo', () => {
  const doc = createDemoDocument(), mesh = buildForgePrimitive({ shape: 'Plane' }), g = mesh.geosets[0];
  g.Vertices = new Float32Array([-50, -50, 0, 50, -50, 0, 50, 50, 0, -50, 50, 0]); g.Normals = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]); g.TVertices = [new Float32Array([0, 0, 1, 0, 1, 1, 0, 1])]; g.Faces = new Uint16Array([0, 1, 2, 0, 2, 3]);
  const { geosetIndices: [gi] } = doc.apply('Coarse shield', [], m => commitForge(m, mesh, { texturePath: 'Textures\\white.blp' })), before = structuredClone(doc.model), selection = resolveShapeSelection(doc.model, [gi]);
  const options = { tool: 'Bend', axis: 0, direction: 2, amount: 90, pivot: 'middle', bendStyle: 'fold', support: 2 }, preview = previewSupportedShape(doc.model, selection, options), shaped = preview.Geosets[gi];
  assert.deepEqual(doc.model, before); assert.ok(shaped.Faces.length > 6 && shaped.Faces.length <= 216);
  const z = Array.from(shaped.Vertices).filter((_, i) => i % 3 === 2); assert.ok(Math.max(...z) - Math.min(...z) > 20, 'corners alone would remain flat; support must create a bent middle');
  for (let id = 0; id < shaped.Vertices.length / 3; id++) { const u = shaped.TVertices[0][id * 2], v = shaped.TVertices[0][id * 2 + 1], x = u * 100 - 50; assert.ok(Math.abs(shaped.Vertices[id * 3] - x / Math.sqrt(2)) < 1e-4); assert.ok(Math.abs(shaped.Vertices[id * 3 + 1] - (v * 100 - 50)) < 1e-4); }
  assert.deepEqual(shaped.Groups, before.Geosets[gi].Groups); assert.ok(shaped.VertexGroup.every(n => n === 0));
  doc.apply('Bend with support', [], m => shapeGeosetsWithSupport(m, selection, options)); assert.deepEqual(doc.model.Geosets[gi].Vertices, shaped.Vertices);
  for (const format of ['mdl', 'mdx']) assert.equal(openDocument(doc.serialize(format)).model.Geosets[gi].Faces.length, shaped.Faces.length);
  doc.undo(); assert.deepEqual(doc.model, before);
  assert.throws(() => shapeGeosetsWithSupport(doc.model, { [gi]: [0] }, options), /Whole geosets/); assert.deepEqual(doc.model, before);
});
test('all tools preview immutably, preserve UVs and rigging, and apply with undo', () => {
  for (const tool of SHAPE_TOOLS) {
    const { doc, indices } = setup(), before = structuredClone(doc.model), selection = resolveShapeSelection(doc.model, new Set(indices)), options = { tool, axis: tool === 'Dome' ? 2 : 1, amount: 45 };
    const preview = previewShape(doc.model, selection, options); assert.deepEqual(doc.model, before);
    assert.notDeepEqual(preview.Geosets[indices[0]].Vertices, before.Geosets[indices[0]].Vertices);
    doc.apply(tool, [], m => shapeGeosets(m, selection, options));
    for (const gi of indices) { assert.deepEqual(doc.model.Geosets[gi].Vertices, preview.Geosets[gi].Vertices); for (const field of ['TVertices', 'VertexGroup', 'Groups', 'Faces']) assert.deepEqual(doc.model.Geosets[gi][field], before.Geosets[gi][field]); }
    const reopen = openDocument(doc.serialize('mdx')); assert.deepEqual(reopen.diagnostics.filter(d => d.severity === 'error'), []);
    doc.undo(); assert.deepEqual(doc.model, before);
  }
});
test('zero amount is identity and invalid deformation cannot partially mutate a model', () => {
  const { doc, indices } = setup(), selection = resolveShapeSelection(doc.model, new Set(indices));
  for (const tool of SHAPE_TOOLS) { const result = previewShape(doc.model, selection, { tool, axis: 1, amount: 0 }); for (const gi of indices) assert.deepEqual(result.Geosets[gi].Vertices, doc.model.Geosets[gi].Vertices); }
  const before = structuredClone(doc.model); assert.throws(() => shapeGeosets(doc.model, selection, { tool: 'Taper', axis: 1, amount: -100 }), /collapsing/); assert.deepEqual(doc.model, before);
  assert.throws(() => shapeGeosets(doc.model, { [indices[0]]: [999999] }, { tool: 'Bend' }), /out of range/); assert.deepEqual(doc.model, before);
});
test('a partial vertex deformation keeps every unselected position exactly intact', () => {
  const { doc } = setup(), original = doc.model.Geosets[0].Vertices.slice();
  shapeGeosets(doc.model, { 0: [0, 1, 2] }, { tool: 'Dome', axis: 2, amount: 20 });
  assert.deepEqual(doc.model.Geosets[0].Vertices.slice(9), original.slice(9));
});
test('partial shaping keeps coincident UV and hard-normal seam copies together within the selected geoset',()=>{
  const {doc,indices}=setup(),gi=indices[1],g=doc.model.Geosets[gi],position=id=>Array.from(g.Vertices.slice(id*3,id*3+3)).join(','),groups=new Map();
  for(let id=0;id<g.Vertices.length/3;id++){const key=position(id);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(id);}const copies=[...groups.values()].find(ids=>ids.length>1);
  assert.ok(copies?.length>1);const untouched=doc.model.Geosets[indices[0]].Vertices.slice();
  shapeGeosets(doc.model,{[gi]:[copies[0],0,1,2]},{tool:'Dome',axis:2,amount:20});
  assert.ok(copies.every(id=>position(id)===position(copies[0])));assert.deepEqual(doc.model.Geosets[indices[0]].Vertices,untouched);
});
