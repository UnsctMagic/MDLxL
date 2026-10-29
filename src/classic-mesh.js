/** MDLVis geometry commands. Invoke within EditorDocument.apply for undo. */
import { geosetBounds } from './editor-document.js';
import { checkedVertexSelection, gatherStreams } from './mesh-tools.js';
const LIMIT = 65536;

function centerOf(g, selected, supplied) {
  const center = supplied === undefined ? [0, 0, 0] : Array.from(supplied);
  if (supplied === undefined) for (const i of selected) for (let axis = 0; axis < 3; axis++) center[axis] += g.Vertices[i * 3 + axis] / selected.length;
  if (center.length !== 3 || center.some((v) => !Number.isFinite(v) || !Number.isFinite(Math.fround(v)))) throw new Error('The selection center must contain three finite model coordinates.');
  return center;
}


/** C: put selected positions at their arithmetic center without merging streams. */
export function collapseVertices(geoset, indices, center) {
  const { selected } = checkedVertexSelection(geoset, indices);
  center = centerOf(geoset, selected, center);
  const vertices = geoset.Vertices.slice();
  for (const i of selected) vertices.set(center, i * 3);
  const extents = geosetBounds(vertices);
  geoset.Vertices = vertices; Object.assign(geoset, extents);
  return { selection: selected, center };
}

/**
 * B: merge all selected vertices, regardless of distance or UV/normal/rig seams.
 * Original b_weldClick retains the last selected vertex's attributes at the
 * common center. Keep this explicit behavior separate from tolerance welding.
 */
export function weldSelectedVertices(geoset, indices, center) {
  const { count, selected } = checkedVertexSelection(geoset, indices);
  center = centerOf(geoset, selected, center);
  const retained = selected.at(-1), removed = new Set(selected.slice(0, -1));
  const kept = Array.from({ length: count }, (_, i) => i).filter((i) => !removed.has(i));
  const remap = new Int32Array(count).fill(-1);
  kept.forEach((old, i) => { remap[old] = i; });
  const target = remap[retained], faces = [];
  for (let i = 0; i < geoset.Faces.length; i += 3) {
    const a = removed.has(geoset.Faces[i]) ? target : remap[geoset.Faces[i]];
    const b = removed.has(geoset.Faces[i + 1]) ? target : remap[geoset.Faces[i + 1]];
    const c = removed.has(geoset.Faces[i + 2]) ? target : remap[geoset.Faces[i + 2]];
    // The old implementation missed triangles with only two equal corners.
    if (a !== b && b !== c && a !== c) faces.push(a, b, c);
  }
  if (geoset.Faces.length && !faces.length) throw new Error('This weld would remove every triangle. Delete the geoset instead.');
  const streams = gatherStreams(geoset, kept); streams.Vertices.set(center, target * 3);
  const extents = geosetBounds(streams.Vertices), removedFaces = (geoset.Faces.length - faces.length) / 3;
  Object.assign(geoset, streams, extents, { Faces: new Uint16Array(faces) });
  return { selection: [target], merged: removed.size, removedFaces, retainedVertex: target };
}

/**
 * U: give every face corner using a selected vertex an independent vertex.
 * Keep the first use and append copies for later uses; copy every SD/HD stream.
 * Inset each selected corner toward its opposite edge so independent vertices
 * can be seen and picked. Keep all resulting corners selected, as in MDLVis.
 */
export function uncoupleVertices(geoset, indices) {
  const { count, selected } = checkedVertexSelection(geoset, indices);
  const chosen = new Set(selected), occurrences = new Uint32Array(count);
  let added = 0;
  for (const i of geoset.Faces) if (chosen.has(i) && occurrences[i]++ > 0) added++;
  if (count + added > LIMIT) throw new Error('Uncoupling would exceed the 65536-vertex geoset limit. Split the geoset first.');
  if (!occurrences.some(Boolean)) return { selection: selected, added: 0 };
  occurrences.fill(0);
  const sources = Array.from({ length: count }, (_, i) => i), faces = geoset.Faces.slice(), selection = [...selected];
  for (let i = 0; i < faces.length; i++) {
    const source = faces[i];
    if (chosen.has(source) && occurrences[source]++ > 0) {
      const next = sources.length; sources.push(source); faces[i] = next; selection.push(next);
    }
  }
  const streams = gatherStreams(geoset, sources);
  // Same inward-corner operation as TransferTriangle, with a stable, bounded
  // inset instead of the legacy zoom formula that can collapse/extrapolate.
  // Read every neighbour from the pre-edit mesh to avoid order-dependent skew.
  const inset = 0.2;
  for (let offset = 0; offset < faces.length; offset += 3) for (let corner = 0; corner < 3; corner++) {
    const source = geoset.Faces[offset + corner];
    if (!chosen.has(source)) continue;
    const left = geoset.Faces[offset + (corner + 1) % 3], right = geoset.Faces[offset + (corner + 2) % 3];
    for (let axis = 0; axis < 3; axis++) streams.Vertices[faces[offset + corner] * 3 + axis] =
      (1 - inset) * geoset.Vertices[source * 3 + axis] + inset / 2 * geoset.Vertices[left * 3 + axis] + inset / 2 * geoset.Vertices[right * 3 + axis];
  }
  const extents = geosetBounds(streams.Vertices);
  Object.assign(geoset, streams, extents, { Faces: faces });
  return { selection, added };
}

/** Delete complete selected triangles, retaining loose vertices and all streams. */
export function deleteSelectedFaces(geoset, indices) {
  const { selected } = checkedVertexSelection(geoset, indices), chosen = new Set(selected), faces = [];
  for (let i = 0; i < geoset.Faces.length; i += 3) if (![0, 1, 2].every((a) => chosen.has(geoset.Faces[i + a]))) faces.push(geoset.Faces[i], geoset.Faces[i + 1], geoset.Faces[i + 2]);
  const removedFaces = (geoset.Faces.length - faces.length) / 3;
  if (removedFaces) geoset.Faces = new Uint16Array(faces);
  return { selection: selected, removedFaces };
}

/** Bake the normalized average into selected normals; keep tangent orthogonality. */
export function averageSelectedNormals(geoset, indices) {
  const { selected } = checkedVertexSelection(geoset, indices), normal = [0, 0, 0];
  for (const i of selected) for (let axis = 0; axis < 3; axis++) normal[axis] += geoset.Normals[i * 3 + axis] / selected.length;
  const length = Math.hypot(...normal);
  if (length < 1e-10) throw new Error('Selected normals cancel each other out. Select normals facing a common direction.');
  for (let axis = 0; axis < 3; axis++) normal[axis] /= length;
  const normals = geoset.Normals.slice(), tangents = geoset.Tangents?.length ? geoset.Tangents.slice() : null;
  for (const i of selected) {
    normals.set(normal, i * 3);
    if (tangents) {
      const tangent = Array.from(tangents.subarray(i * 4, i * 4 + 3));
      const projection = tangent.reduce((sum, v, axis) => sum + v * normal[axis], 0);
      for (let axis = 0; axis < 3; axis++) tangent[axis] -= projection * normal[axis];
      let tangentLength = Math.hypot(...tangent);
      if (tangentLength < 1e-10) {
        const axis = Math.abs(normal[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
        const dot = axis.reduce((sum, v, a) => sum + v * normal[a], 0);
        for (let a = 0; a < 3; a++) tangent[a] = axis[a] - dot * normal[a];
        tangentLength = Math.hypot(...tangent);
      }
      for (let axis = 0; axis < 3; axis++) tangents[i * 4 + axis] = tangent[axis] / tangentLength;
    }
  }
  geoset.Normals = normals; if (tangents) geoset.Tangents = tangents;
  return { selection: selected };
}
