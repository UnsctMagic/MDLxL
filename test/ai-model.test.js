import test from 'node:test';
import assert from 'node:assert/strict';
import { createStarterDocument } from '../src/starter-model.js';
import { openDocument } from '../src/editor-document.js';
import {
  encodeAiValue,
  decodeAiValue,
  patchAiModel,
  prepareAiEdit,
  applyAiEdit,
  readAiModel,
  aiSelectionSignature,
  checkAiTarget,
} from '../src/ai-model.js';
import { mirrorSelection } from '../src/ai-mesh.js';

test('script results reject cycles and non-JSON values while allowing shared model aliases', () => {
  const shared = { x: 1 };
  assert.deepEqual(encodeAiValue([shared, shared]), [{ x: 1 }, { x: 1 }]);
  shared.self = shared;
  assert.throws(() => encodeAiValue(shared), /circular/);
  assert.throws(() => encodeAiValue(1n), /JSON/);
  assert.throws(() => decodeAiValue({ $type: 'constructor', $data: [1, 2] }), /typed array/);
});

test('scoped collection edits include only their exact editor-maintained counts', () => {
  const before = structuredClone(createStarterDocument().model), after = structuredClone(before);
  after.GeosetAnims.push({GeosetId:0,Alpha:1,Color:new Float32Array([1,0,0]),Flags:2});
  after.Info.NumGeosetAnims = after.GeosetAnims.length;
  const options = {scope:['/GeosetAnims']}, prepared = prepareAiEdit(before, after, options);
  const applied = structuredClone(before); applyAiEdit(applied, prepared);
  assert.equal(applied.Info.NumGeosetAnims, after.GeosetAnims.length);
  assert.deepEqual(applied.Geosets, before.Geosets);
  assert.throws(() => prepareAiEdit(before, {...after,Info:{...after.Info,Name:'Unrequested rename'}}, options), /scope: \/Info\/Name/);
  assert.throws(() => prepareAiEdit(before, {...after,Info:{...after.Info,NumGeosetAnims:999}}, options), /scope: \/Info\/NumGeosetAnims/);
  assert.throws(() => prepareAiEdit(before, after, {scope:['/Geosets/0/Anims']}), /scope:/);
  assert.throws(() => prepareAiEdit(before, after, {...options,protectedPaths:['/Info/NumGeosetAnims']}), /protected path/);
});

test('a geoset edit may update the model bounds it moves, nothing else in Info', () => {
  const before = createStarterDocument().model, after = structuredClone(before);
  after.Geosets[0].Vertices[0] += 500;
  after.Info.MaximumExtent = Float32Array.from([600, 600, 600]);
  after.Info.BoundsRadius = 900;
  const prepared = prepareAiEdit(before, after, { scope: ['/Geosets'] });
  assert.ok(prepared.changes.some(c => c.path.join('/') === 'Info/BoundsRadius'));
  // Without a geometry change in scope the bounds stay protected.
  assert.throws(() => prepareAiEdit(before, { ...before, Info: { ...before.Info, BoundsRadius: 900 } }, { scope: ['/Geosets'] }), /scope: \/Info\/BoundsRadius/);
});

test('precise UV edit is undoable and preserves geometry, rig and other data through MDX/MDL', () => {
  const doc = createStarterDocument(),
    before = structuredClone(doc.model),
    original = doc.serialize('mdx');
  const after = patchAiModel(before, [{ op: 'set', path: '/Geosets/0/TVertices/0/0', value: 0.125 }]);
  const edit = prepareAiEdit(before, after, {
    scope: ['/Geosets/0/TVertices'],
    protectedPaths: ['/Bones', '/Geosets/0/Vertices', '/Materials', '/Textures'],
  });
  doc.apply('AI UV surgery', edit.sections, m => applyAiEdit(m, edit));
  assert.equal(doc.model.Geosets[0].TVertices[0][0], 0.125);
  for (const format of ['mdx', 'mdl']) {
    const reopened = openDocument(doc.serialize(format), 'edited.' + format);
    assert.equal(reopened.model.Geosets[0].TVertices[0][0], 0.125);
    assert.deepEqual(reopened.model.Geosets[0].Vertices, before.Geosets[0].Vertices);
  }
  doc.undo();
  assert.deepEqual(doc.serialize('mdx'), original);
  doc.redo();
  assert.equal(doc.model.Geosets[0].TVertices[0][0], 0.125);
});
test('scope and protected paths reject collateral changes before commit', () => {
  const before = createStarterDocument().model,
    after = structuredClone(before);
  after.Geosets[0].Vertices[0] += 2;
  after.Textures[0].Image = 'unwanted.blp';
  assert.throws(() => prepareAiEdit(before, after, { scope: ['/Geosets/0/Vertices'] }), /exceeds/);
  assert.throws(
    () => prepareAiEdit(before, after, { scope: ['/Geosets', '/Textures'], protectedPaths: ['/Textures/0'] }),
    /protected/,
  );
  assert.throws(() => prepareAiEdit(before, after, { scope: [''] }), /canonical/);
});
test('typed arrays retain type, narrow reads report truncation and patches reject unsafe paths', () => {
  const value = { a: new Float32Array([1, 2]), b: new Uint16Array([3, 4]) };
  assert.deepEqual(decodeAiValue(encodeAiValue(value)), value);
  assert.throws(() => patchAiModel(value, [{ op: 'set', path: '/__proto__/bad', value: 1 }]), /Unsafe/);
  assert.throws(() => patchAiModel(value, [{ op: 'set', path: '/b/1', value: 70000 }]), /range/);
  assert.throws(() => patchAiModel(value, [{ op: 'set', path: '/a/3', value: 1 }]), /splice/);
  assert.deepEqual(readAiModel(value, { path: '/a', limit: 1 }), {
    path: '/a',
    offset: 0,
    total: 2,
    truncated: true,
    value: { $type: 'Float32Array', $data: [1] },
  });
});
test('animation-window protection preserves every key outside requested sequences', () => {
  const before = createStarterDocument().model;
  before.Bones[0].Translation = {
    LineType: 1,
    GlobalSeqId: null,
    Keys: [0, 100, 200, 300].map(Frame => ({ Frame, Vector: new Float32Array([0, 0, 0]) })),
  };
  const after = structuredClone(before);
  after.Bones[0].Translation.Keys[1].Vector[0] = 4;
  assert.equal(
    prepareAiEdit(before, after, { scope: ['/Bones/0/Translation'], animationRanges: [[0, 100]] })
      .changeCount,
    1,
  );
  after.Bones[0].Translation.Keys[2].Vector[0] = 2;
  assert.throws(
    () => prepareAiEdit(before, after, { scope: ['/Bones/0/Translation'], animationRanges: [[0, 100]] }),
    /outside/,
  );
  after.Bones[0].Translation.Keys[2].Vector[0] = 0;
  after.Bones[0].Translation.LineType = 2;
  assert.throws(
    () => prepareAiEdit(before, after, { scope: ['/Bones/0/Translation'], animationRanges: [[0, 100]] }),
    /interpolation/,
  );
});
test('targets reject changed selections, changed revisions and different tabs', () => {
  const state = {
    session: { id: 'one' },
    doc: { revision: 2 },
    selection: { 0: [1, 2, 3] },
    selectedNodeIds: [],
    selectable: new Set([0]),
    activeGeoset: 0,
    uvSet: 0,
  };
  const target = { documentId: 'one', revision: 2, selectionSignature: aiSelectionSignature(state) };
  checkAiTarget(target, state);
  assert.throws(() => checkAiTarget(target, { ...state, selection: { 0: [2] } }), /selection changed/);
  assert.throws(() => checkAiTarget(target, { ...state, doc: { revision: 3 } }), /changed/);
  assert.throws(() => checkAiTarget(target, { ...state, session: { id: 'other' } }), /changed/);
});
test('mirror only marked triangle, reuse compatible seam and keep another geoset untouched', () => {
  const doc = createStarterDocument(),
    g = doc.model.Geosets[0];
  Object.assign(g, {
    Vertices: new Float32Array([0, 0, 0, 2, 0, 0, 0, 2, 0]),
    Normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
    Faces: new Uint16Array([0, 1, 2]),
    VertexGroup: new Uint8Array([0, 0, 0]),
    TVertices: [new Float32Array([0, 0, 1, 0, 0, 1])],
  });
  delete g.Tangents;
  delete g.SkinWeights;
  const untouched = structuredClone(g);
  doc.model.Geosets.push(structuredClone(g));
  const result = mirrorSelection(doc.model, { 0: [0, 1, 2] }, { axis: 'x', plane: 0, weld: true });
  assert.equal(g.Vertices.length / 3, 4);
  assert.equal(g.Faces.length / 3, 2);
  assert.equal(result.details[0].weldedVertices, 2);
  assert.deepEqual(doc.model.Geosets[1], untouched);
  assert.deepEqual(Array.from(g.Vertices), [0, 0, 0, 2, 0, 0, 0, 2, 0, -2, 0, 0]);
  for (let i = 0; i < g.Faces.length; i += 3) {
    const [a, b, c] = g.Faces.slice(i, i + 3);
    const cross =
      (g.Vertices[b * 3] - g.Vertices[a * 3]) * (g.Vertices[c * 3 + 1] - g.Vertices[a * 3 + 1]) -
      (g.Vertices[b * 3 + 1] - g.Vertices[a * 3 + 1]) * (g.Vertices[c * 3] - g.Vertices[a * 3]);
    assert.ok(cross > 0, 'triangle winding retained');
  }
});
test('invalid generated model is rolled back by the owning document transaction', () => {
  const doc = createStarterDocument(),
    original = doc.serialize('mdx'),
    before = structuredClone(doc.model),
    after = structuredClone(before);
  after.Geosets[0].Faces[0] = 65000;
  const prepared = prepareAiEdit(before, after, { scope: ['/Geosets/0'] });
  assert.throws(() => doc.apply('Invalid AI edit', prepared.sections, m => applyAiEdit(m, prepared)));
  assert.deepEqual(doc.serialize('mdx'), original);
});

test('scope is checked after document normalization and failures preserve Undo', () => {
  const doc = openDocument(createStarterDocument().serialize('mdx'), 'scope.mdx'),
    original = doc.serialize('mdx'),
    history = doc.historyStats.undoSteps;
  const options = { scope: ['/Geosets/0/Faces'] };
  assert.throws(
    () =>
      doc.apply(
        'Narrow AI topology edit',
        ['Geosets'],
        model => {
          model.Geosets[0].Faces = new Uint16Array([...model.Geosets[0].Faces, 0, 1, 2]);
        },
        { validate: (after, before) => prepareAiEdit(before, after, options) },
      ),
    /scope.*PrimitiveCounts/,
  );
  assert.deepEqual(doc.serialize('mdx'), original);
  assert.equal(doc.historyStats.undoSteps, history);
});

test('AI edits may change numeric values but not the numeric array type', () => {
  const before = { Geosets: [{ VertexGroup: new Uint8Array([0, 1]), Faces: new Uint16Array([0, 1, 2]) }] };
  assert.throws(
    () =>
      prepareAiEdit(
        before,
        { Geosets: [{ VertexGroup: [0, 2], Faces: new Uint16Array([0, 1, 2]) }] },
        { scope: ['/Geosets'] },
      ),
    /array type of \/Geosets\/0\/VertexGroup/,
  );
  assert.throws(
    () =>
      prepareAiEdit(
        before,
        { Geosets: [{ VertexGroup: new Uint8Array([0, 1]), Faces: new Uint32Array([0, 1, 2]) }] },
        { scope: ['/Geosets/0'] },
      ),
    /keep it a Uint16Array/,
  );
  assert.equal(
    prepareAiEdit(
      before,
      { Geosets: [{ VertexGroup: new Uint8Array([0, 2]), Faces: new Uint16Array([0, 1, 2]) }] },
      { scope: ['/Geosets'] },
    ).changeCount,
    1,
  );
  // Removing an optional numeric array is not a type change.
  assert.equal(
    prepareAiEdit(before, { Geosets: [{ VertexGroup: new Uint8Array([0, 1]) }] }, { scope: ['/Geosets'] })
      .changeCount,
    1,
  );
});
