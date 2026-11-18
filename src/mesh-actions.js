import { deleteGeoset, recalculateNormals } from './editor-document.js';
import { transformVertices, deleteVertices, addTriangle } from './editor-commands.js';
import { detachFaces, extrudeFaces } from './mesh-tools.js';
import { collapseVertices, weldSelectedVertices, uncoupleVertices, deleteSelectedFaces, averageSelectedNormals } from './classic-mesh.js';

// The vertex editor's mesh tools as one edit of a model, shared by the editor on
// screen and by AI jobs on a model tab that is not showing (or on their private copy).
export const MESH_ACTIONS = Object.freeze([
  'Delete vertices', 'Create triangle', 'Delete triangles', 'Uncouple', 'Collapse', 'Weld',
  'Smooth normals', 'Restore normals', 'Mirror', 'Extrude', 'Detach', 'Reverse normals', 'Rotate normals',
]);

// The mean position of the marked vertices: the pivot Collapse, Weld and Mirror use.
export function selectionCentroid(model, selection) {
  const centroid = [0, 0, 0];
  const count = Object.values(selection).reduce((sum, ids) => sum + ids.length, 0);
  for (const [gi, ids] of Object.entries(selection))
    for (const id of ids) for (let axis = 0; axis < 3; axis++) centroid[axis] += model.Geosets[gi].Vertices[id * 3 + axis] / (count || 1);
  return centroid;
}

// The workplane's normal axis: XY -> z, YZ -> x, otherwise (XZ) y.
export const workplaneAxis = workplane => (workplane === 'xy' ? 2 : workplane === 'yz' ? 0 : 1);

// Applies `name` to the marked vertices (`selection`: vertex IDs per geoset index) of
// `m`, changing it in place. Returns the selection to show afterwards per geoset and
// the geoset indices that were removed.
export function applyMeshAction(m, name, selection, { axis = 1, centroid = selectionCentroid(m, selection), uncoupleNuke = false, normalAngle = 90 } = {}) {
  const updated = {}, removedGeosets = [];
  for (const [key, ids] of Object.entries(selection).sort((a, b) => Number(b[0]) - Number(a[0]))) {
    if (!ids.length) continue; const gi = Number(key), g = m.Geosets[gi]; let outcome;
    if (name === 'Delete vertices') { if (ids.length === g.Vertices.length / 3) { deleteGeoset(m, gi); removedGeosets.push(gi); } else deleteVertices(g, ids); }
    else if (name === 'Create triangle') addTriangle(g, ids);
    else if (name === 'Delete triangles') outcome = deleteSelectedFaces(g, ids);
    else if (name === 'Uncouple') outcome = uncoupleVertices(g, ids, { nuke: uncoupleNuke });
    else if (name === 'Collapse') outcome = collapseVertices(g, ids, centroid);
    else if (name === 'Weld') outcome = weldSelectedVertices(g, ids, centroid);
    else if (name === 'Smooth normals') outcome = averageSelectedNormals(g, ids);
    else if (name === 'Restore normals') recalculateNormals(g);
    else if (name === 'Mirror') { const scale = [1, 1, 1]; scale[axis] = -1; transformVertices(g, ids, [0, 0, 0], scale, [0, 0, 0], centroid); }
    else if (name === 'Extrude') { const delta = [0, 0, 0]; delta[axis] = 10; outcome = { selection: extrudeFaces(g, ids, delta) }; }
    else if (name === 'Detach') { const added = detachFaces(m, gi, ids); updated[added] = Array.from({ length: m.Geosets[added].Vertices.length / 3 }, (_, i) => i); }
    else if (name === 'Reverse normals') { const picked = new Set(ids); for (const id of ids) { for (let a = 0; a < 3; a++) g.Normals[id * 3 + a] *= -1; if (g.Tangents) g.Tangents[id * 4 + 3] *= -1; } for (let i = 0; i < g.Faces.length; i += 3) if ([0, 1, 2].every(a => picked.has(g.Faces[i + a]))) [g.Faces[i + 1], g.Faces[i + 2]] = [g.Faces[i + 2], g.Faces[i + 1]]; }
    else if (name === 'Rotate normals') { const a = (axis + 1) % 3, b = (axis + 2) % 3, angle = normalAngle * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle); for (const id of ids) for (const [array, stride] of [[g.Normals, 3], [g.Tangents, 4]]) if (array?.length) { const x = array[id * stride + a], y = array[id * stride + b]; array[id * stride + a] = x * c - y * s; array[id * stride + b] = x * s + y * c; } }
    if (outcome?.selection) updated[gi] = outcome.selection;
  }
  return { updated, removedGeosets };
}
