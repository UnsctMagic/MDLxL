import { deleteGeoset, recalculateNormals } from './editor-document.js';
import { transformVertices, deleteVertices, addTriangle } from './editor-commands.js';
import { detachFaces, extrudeFaces } from './mesh-tools.js';
import { cutTriangles } from './edge-cut.js';
import { separateGeosetsByLoosePart, nuclearSeparateGeosets, mergeSimilarGeosets, geosetMergeConflicts, deleteFreeVertices, nuclearWeldVertices } from './geoset-operations.js';
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
// the geoset indices that were removed. Optional: `pivot` [x, y, z] (Collapse, Weld and
// Mirror turn around it instead of the marked vertices' centre), `distance` (Extrude,
// default 10 units) and `normalAngle` degrees (Rotate normals, default 90).
export function applyMeshAction(m, name, selection, { axis = 1, pivot, centroid = pivot ?? selectionCentroid(m, selection), uncoupleNuke = false, normalAngle = 90, distance = 10 } = {}) {
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
    else if (name === 'Extrude') { const delta = [0, 0, 0]; delta[axis] = distance; outcome = { selection: extrudeFaces(g, ids, delta) }; }
    else if (name === 'Detach') { const added = detachFaces(m, gi, ids); updated[added] = Array.from({ length: m.Geosets[added].Vertices.length / 3 }, (_, i) => i); }
    else if (name === 'Reverse normals') { const picked = new Set(ids); for (const id of ids) { for (let a = 0; a < 3; a++) g.Normals[id * 3 + a] *= -1; if (g.Tangents) g.Tangents[id * 4 + 3] *= -1; } for (let i = 0; i < g.Faces.length; i += 3) if ([0, 1, 2].every(a => picked.has(g.Faces[i + a]))) [g.Faces[i + 1], g.Faces[i + 2]] = [g.Faces[i + 2], g.Faces[i + 1]]; }
    else if (name === 'Rotate normals') { const a = (axis + 1) % 3, b = (axis + 2) % 3, angle = normalAngle * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle); for (const id of ids) for (const [array, stride] of [[g.Normals, 3], [g.Tangents, 4]]) if (array?.length) { const x = array[id * stride + a], y = array[id * stride + b]; array[id * stride + a] = x * c - y * s; array[id * stride + b] = x * s + y * c; } }
    if (outcome?.selection) updated[gi] = outcome.selection;
  }
  return { updated, removedGeosets };
}

// The sidebar's geoset operations (Separate by loose parts, Nuclear, Merge geosets, Nuclear Weld,
// Delete free vertices) and the Cut tool. The model logic lives in geoset-operations.js and
// edge-cut.js; what is here is what the editor does with its marked vertices and checked
// geosets afterwards, shared by the editor on screen and by AI jobs on hidden model tabs.
export const GEOSET_ACTIONS = Object.freeze({
  'Separate by loose parts': { label: 'Seperate by Loose parts', sections: ['Geosets', 'GeosetAnims', 'Gliders', 'Info'], needs: 'marked', run: (m, { marked }) => separateGeosetsByLoosePart(m, marked), none: 'The selected vertices contain no parts to separate.' },
  'Nuclear separation': { label: 'Nuclear Seperation', sections: ['Geosets', 'GeosetAnims', 'Gliders', 'Info'], needs: 'marked', run: (m, { marked }) => nuclearSeparateGeosets(m, marked), none: 'The selected vertices contain no parts to separate.' },
  'Merge geosets': { label: 'Merge geosets', sections: ['Geosets', 'GeosetAnims', 'Bones', 'Gliders', 'Info'], needs: 'marked', run: (m, { marked, resolutions }) => mergeSimilarGeosets(m, marked, resolutions), none: 'No geosets share compatible materials and RGB.' },
  'Delete free vertices': { label: 'Delete free vertices', sections: ['Geosets', 'GeosetAnims', 'Bones', 'Gliders', 'Info'], needs: 'checked', run: (m, { checked }) => deleteFreeVertices(m, checked), none: 'No free vertices found in selected geosets.' },
  'Nuclear Weld': { label: 'Nuclear Weld', sections: ['Geosets', 'GeosetAnims', 'Bones', 'Gliders', 'Info'], needs: 'marked', run: (m, { marked }) => nuclearWeldVertices(m, marked), none: 'Nuclear Weld found no selected vertices on the same spot.' },
});
export const CUT_ACTION = 'Cut';

// Geoset numbers after a geoset was removed or merged: result.oldToNew maps old to new.
export const remapGeosetSet = (set, result) => new Set([...set].map(index => result.oldToNew[index]).filter(index => index !== undefined));
// Marked vertices after Merge geosets (vertices move up by the merged geoset's offset).
export function remapMergedSelection(previous, result) {
  const next = {};
  for (const [oldIndex, vertices] of Object.entries(previous)) {
    const newIndex = result.oldToNew[oldIndex];
    if (newIndex === undefined) continue;
    (next[newIndex] ||= []).push(...vertices.map(vertex => vertex + result.vertexOffsets[oldIndex]));
  }
  return next;
}
// Marked vertices after Delete free vertices (vertex numbers shift per geoset).
export function remapDeletedSelection(previous, result) {
  const next = {};
  for (const [oldIndex, vertices] of Object.entries(previous)) {
    const newIndex = result.oldToNew[oldIndex];
    if (newIndex === undefined) continue;
    const vertexMap = result.vertexMaps[oldIndex];
    const remapped = vertices.map(vertex => vertexMap ? vertexMap[vertex] : vertex).filter(Number.isInteger);
    if (remapped.length) next[newIndex] = [...new Set(remapped)];
  }
  return next;
}
// Marked vertices after Nuclear Weld: the welded geosets show the result, the rest renumber.
export function remapWeldedSelection(previous, result, marked) {
  const remap = index => result.oldToNew[index], next = {};
  for (const [index, ids] of Object.entries(previous)) if (!(index in marked) && remap(index) != null && !(remap(index) in result.selection)) next[remap(index)] = ids;
  return { ...next, ...result.selection };
}
// Marked vertices after Separate: the split geosets give up their marks to their new parts.
export function remapSeparatedSelection(previous, result) {
  const next = { ...previous };
  for (const index of result.touched) delete next[index];
  return { ...next, ...result.selection };
}

// Runs one geoset operation on `m` as the editor does and returns the state to show afterwards
// ({ selection, selectable, activeGeoset }), or throws the editor's own message when nothing applied.
// `state`: { selection (marked vertices per geoset), selectable (checked geoset numbers), activeGeoset }.
export function applyGeosetAction(m, name, state, { resolutions } = {}) {
  const action = GEOSET_ACTIONS[name];
  if (!action) throw Error('Unknown geoset operation: ' + name);
  const marked = state.selection, checked = state.selectable;
  if (name === 'Merge geosets' && !resolutions) {
    const review = geosetMergeConflicts(m, marked);
    if (!review.groups.length) throw Error(action.none);
    if (review.conflicts.length) throw Error('These geosets differ in ' + review.conflicts.length + ' way(s) the editor asks about before merging; use mdlxl_script with geoset-operations.geosetMergeConflicts and mergeSimilarGeosets(model, marked, resolutions).');
  }
  const result = action.run(m, { marked, checked, resolutions });
  if (result === false) throw Error(action.none);
  const { selectable, activeGeoset } = state;
  if (name === 'Separate by loose parts' || name === 'Nuclear separation')
    return { result, selection: remapSeparatedSelection(marked, result), selectable: new Set([...selectable, ...result.geosetIndices]), activeGeoset: result.geosetIndices[0] ?? activeGeoset };
  const base = { selectable: remapGeosetSet(selectable, result), activeGeoset: result.oldToNew[activeGeoset] ?? -1 };
  if (name === 'Merge geosets') return { result, ...base, selection: remapMergedSelection(marked, result) };
  if (name === 'Delete free vertices') return { result, ...base, selection: remapDeletedSelection(marked, result) };
  return { result, ...base, selection: remapWeldedSelection(marked, result, marked) };
}

// The Cut tool's edit: returns the marked vertices to show (the new point), or null to leave them.
export function applyCut(m, request) {
  const outcome = cutTriangles(m, request);
  return outcome?.selection?.length ? { geosetIndex: request.geosetIndex, selection: outcome.selection } : null;
}
