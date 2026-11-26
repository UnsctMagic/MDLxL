import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { openDocument, deleteGeoset } from '../src/editor-document.js';
import { transformVertices, deleteVertices } from '../src/editor-commands.js';
import { detachFaces, extrudeFaces } from '../src/mesh-tools.js';
import { collapseVertices, weldSelectedVertices, uncoupleVertices, averageSelectedNormals } from '../src/classic-mesh.js';
import { applyMeshAction, selectionCentroid, workplaneAxis, MESH_ACTIONS } from '../src/mesh-actions.js';
const { fixturePath } = createRequire(import.meta.url)('./helpers/fixtures.cjs');

// The vertex editor's mesh tools moved into src/mesh-actions.js so AI jobs can run them
// on a model tab that is not showing. On the real Footman shield they must give exactly
// what each tool gave before the move.
const file = fixturePath('citadel-footman');
const skip = !file || !fs.existsSync(file) ? 'private test model not on this machine: citadel-footman' : false;
const footman = () => openDocument(fs.readFileSync(file), 'Footman.mdx').model;
// The owner's recorded Footman shield selection (geoset 0): strap, rim and boss.
const shield = [...Array.from({ length: 7 }, (_, i) => 225 + i), ...Array.from({ length: 14 }, (_, i) => 253 + i), ...Array.from({ length: 10 }, (_, i) => 425 + i)];

test('the shared mesh tools match the per-tool code they replaced on the Footman shield', { skip }, () => {
  const selection = { 0: shield };
  const centroid = selectionCentroid(footman(), selection);
  const cases = {
    Weld: g => weldSelectedVertices(g, shield, centroid),
    Collapse: g => collapseVertices(g, shield, centroid),
    Uncouple: g => uncoupleVertices(g, shield, { nuke: false }),
    'Smooth normals': g => averageSelectedNormals(g, shield),
    Mirror: g => transformVertices(g, shield, [0, 0, 0], [1, -1, 1], [0, 0, 0], centroid),
    Extrude: g => extrudeFaces(g, shield, [0, 10, 0]),
    'Delete vertices': g => deleteVertices(g, shield),
  };
  for (const [name, direct] of Object.entries(cases)) {
    const expected = footman(), actual = footman();
    direct(expected.Geosets[0]);
    applyMeshAction(actual, name, selection, { axis: workplaneAxis('xz'), centroid });
    assert.deepEqual(actual.Geosets[0], expected.Geosets[0], name);
  }
  // Detach makes a new geoset, which becomes the selection.
  const expected = footman(), actual = footman();
  const added = detachFaces(expected, 0, shield);
  const { updated } = applyMeshAction(actual, 'Detach', selection, { axis: 1, centroid });
  assert.deepEqual(actual.Geosets, expected.Geosets);
  assert.deepEqual(Object.keys(updated), [String(added)]);
  // Deleting every vertex of a geoset removes the geoset.
  const whole = footman(), copy = footman();
  const all = Array.from({ length: whole.Geosets[0].Vertices.length / 3 }, (_, i) => i);
  deleteGeoset(copy, 0);
  assert.deepEqual(applyMeshAction(whole, 'Delete vertices', { 0: all }).removedGeosets, [0]);
  assert.equal(whole.Geosets.length, copy.Geosets.length);
  assert.ok(MESH_ACTIONS.includes('Weld') && MESH_ACTIONS.includes('Reverse normals'));
});
