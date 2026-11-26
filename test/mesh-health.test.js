import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { openDocument } from '../src/editor-document.js';
import { meshHealth } from '../src/mesh-health.js';

const { fixturePath } = createRequire(import.meta.url)('./helpers/fixtures.cjs');
const file = fixturePath('citadel-footman');
const skip = !fs.existsSync(file) && 'test model not on this machine';
const load = () => openDocument(fs.readFileSync(file), 'Footman.mdx').model;
// An interior edge of geoset 0: two triangles share it on welded positions.
function sharedEdge(geoset) {
  const seen = new Map();
  for (let t = 0; t < geoset.Faces.length / 3; t++) for (let e = 0; e < 3; e++) {
    const a = geoset.Faces[t * 3 + e], b = geoset.Faces[t * 3 + (e + 1) % 3], key = Math.min(a, b) + ',' + Math.max(a, b);
    if (seen.has(key)) return { a, b, t, other: seen.get(key), c: geoset.Faces[t * 3 + (e + 2) % 3] };
    seen.set(key, t);
  }
  throw Error('no shared edge');
}
const append = (geoset, ...triangles) => { geoset.Faces = Uint16Array.from([...geoset.Faces, ...triangles.flat()]); };
const addVertex = (geoset, position) => {
  const id = geoset.Vertices.length / 3;
  geoset.Vertices = Float32Array.from([...geoset.Vertices, ...position]);
  geoset.Normals = Float32Array.from([...geoset.Normals, 0, 0, 1]);
  geoset.TVertices = geoset.TVertices.map(uv => Float32Array.from([...uv, 0, 0]));
  geoset.VertexGroup = Uint8Array.from([...geoset.VertexGroup, geoset.VertexGroup[0]]);
  return id;
};

test('mesh health of the Footman, and each planted defect counts once', { skip }, () => {
  const base = meshHealth(load());
  assert.equal(base.vertexLimit, 7432);
  assert.equal(base.geosets.length, 5);
  const g0 = base.geosets[0];
  assert.equal(g0.vertices, 447); assert.equal(g0.triangles, 288);
  assert.ok(g0.islands >= 1 && g0.indexedIslands >= g0.islands, 'UV seams split indexed islands, not welded ones');
  assert.equal(g0.overVertexLimit, false);

  const measure = change => { const model = load(); change(model.Geosets[0]); return meshHealth(model, { geosets: [0] }).geosets[0]; };
  const hole = measure(g => { g.Faces = Uint16Array.from([...g.Faces.slice(0, sharedEdge(g).t * 3), ...g.Faces.slice(sharedEdge(g).t * 3 + 3)]); });
  assert.ok(hole.borderEdges >= g0.borderEdges + 1, `removing a triangle opens border edges: ${g0.borderEdges} -> ${hole.borderEdges}`);
  const degenerate = measure(g => { const { a, b } = sharedEdge(g); append(g, [a, a, b]); });
  assert.equal(degenerate.degenerate, g0.degenerate + 1);
  const duplicate = measure(g => append(g, Array.from(g.Faces.slice(0, 3))));
  assert.equal(duplicate.duplicates, g0.duplicates + 1);
  const fin = measure(g => { const { a, b } = sharedEdge(g); const far = addVertex(g, [500, 500, 500]); append(g, [a, b, far]); });
  assert.equal(fin.nonManifoldEdges, g0.nonManifoldEdges + 1, 'a third triangle on an edge');
  const tee = measure(g => {
    // Split one triangle at the midpoint of its shared edge; the neighbour keeps the long edge.
    const { a, b, c, t } = sharedEdge(g), mid = addVertex(g, [0, 1, 2].map(k => (g.Vertices[a * 3 + k] + g.Vertices[b * 3 + k]) / 2));
    const faces = Array.from(g.Faces); faces.splice(t * 3, 3, a, mid, c, mid, b, c); g.Faces = Uint16Array.from(faces);
  });
  assert.ok(tee.tJunctions >= g0.tJunctions + 1, `T-junctions ${g0.tJunctions} -> ${tee.tJunctions}`);
  const loose = measure(g => addVertex(g, [1, 2, 3]));
  assert.equal(loose.looseVertices, g0.looseVertices + 1);
});
