import { forgeTangents } from './geoset-tangents.js';
import { sdNormalTargets } from './sd-normals.js';

const vector = (a, id) => Array.from(a.subarray(id * 3, id * 3 + 3));
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
const unit = v => { const length = Math.hypot(...v); return length > 1e-12 ? v.map(n => n / length) : null; };
const finite = a => a && Array.from(a).every(Number.isFinite);

/** Capture only the selected geosets. All previews start from these source bytes. */
export function captureNormalSelection(model, selection) {
  const geosets = [], min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  let count = 0, unshadedCount = 0;
  for (const [key, picked] of Object.entries(selection)) {
    const index = Number(key), g = model.Geosets?.[index], ids = [...new Set(picked)];
    if (!ids.length) continue;
    if (!Number.isInteger(index) || !g || !g.Vertices?.length || g.Vertices.length % 3 ||
        !finite(g.Vertices) || g.Normals?.length !== g.Vertices.length || !finite(g.Normals))
      throw new Error('NormalsXL needs finite positions and one normal for each vertex.');
    const vertexCount = g.Vertices.length / 3;
    if (ids.some(id => !Number.isInteger(id) || id < 0 || id >= vertexCount))
      throw new Error('The normal selection is out of date. Select the vertices again.');
    if (!g.Faces || g.Faces.length % 3 || Array.from(g.Faces).some(id => !Number.isInteger(id) || id < 0 || id >= vertexCount))
      throw new Error('NormalsXL cannot use invalid triangle indices.');
    if (g.Tangents?.length && (g.Tangents.length !== vertexCount * 4 || !finite(g.Tangents) ||
        g.TVertices?.[0]?.length !== vertexCount * 2 || !finite(g.TVertices[0])))
      throw new Error('NormalsXL needs valid tangents and UVs to update this geoset.');
    for (const id of ids) for (let axis = 0; axis < 3; axis++) {
      const value = g.Vertices[id * 3 + axis];
      min[axis] = Math.min(min[axis], value); max[axis] = Math.max(max[axis], value);
    }
    const layers = model.Materials?.[g.MaterialID]?.Layers;
    if (layers?.length && layers.every(layer => layer.Shading & 1)) unshadedCount += ids.length;
    count += ids.length;
    geosets.push({ index, ids, Vertices: g.Vertices.slice(), Normals: g.Normals.slice(), Faces: g.Faces.slice(), VertexGroup: g.VertexGroup?.slice(), Groups: g.Groups?.map(ids => [...ids]),
      ...(g.Tangents?.length ? { Tangents: g.Tangents.slice(), TVertices: [g.TVertices[0].slice()] } : {}) });
  }
  if (!count) throw new Error('Select visible vertices before opening NormalsXL.');
  const center = min.map((n, axis) => (n + max[axis]) / 2);
  let radius = 0;
  for (const g of geosets) for (const id of g.ids) radius = Math.max(radius, Math.hypot(...vector(g.Vertices, id).map((v, axis) => v - center[axis])));
  return { geosets, center, radius: Math.max(radius, 1), count, unshadedCount };
}

function blendDirection(before, target, strength) {
  const old = unit(before);
  if (!old || strength === 1) return target;
  const cosine = Math.max(-1, Math.min(1, dot(old, target)));
  if (cosine > 1 - 1e-10) return unit(old.map((v, axis) => v * (1 - strength) + target[axis] * strength));
  let tangent = unit(target.map((v, axis) => v - cosine * old[axis]));
  if (!tangent) {
    // Opposite directions have no unique rotation arc. Pick a stable perpendicular.
    const axis = old.reduce((best, value, i) => Math.abs(value) < Math.abs(old[best]) ? i : best, 0);
    tangent = unit(old.map((v, i) => (i === axis ? 1 : 0) - old[axis] * v));
  }
  const angle = Math.acos(cosine) * strength;
  return unit(old.map((v, axis) => v * Math.cos(angle) + tangent[axis] * Math.sin(angle)));
}

function surfaceDirections(g) {
  const sums = new Float64Array(g.Vertices.length);
  // All incident triangles contribute, including triangles crossing the selection boundary.
  for (let offset = 0; offset < g.Faces.length; offset += 3) {
    const ids = Array.from(g.Faces.subarray(offset, offset + 3)), a = vector(g.Vertices, ids[0]);
    const b = vector(g.Vertices, ids[1]).map((v, i) => v - a[i]), c = vector(g.Vertices, ids[2]).map((v, i) => v - a[i]);
    const n = [b[1] * c[2] - b[2] * c[1], b[2] * c[0] - b[0] * c[2], b[0] * c[1] - b[1] * c[0]];
    for (const id of ids) for (let axis = 0; axis < 3; axis++) sums[id * 3 + axis] += n[axis];
  }
  return sums;
}

/** Preview changes without touching the document, positions, triangles or unselected normals. */
export function previewNormals(snapshot, { mode = 'outward', center = snapshot.center, strength = 1, weighting = 'equal', creaseAngle = 60 } = {}) {
  if (!['outward', 'inward', 'surface', 'sd', 'seams', 'smooth'].includes(mode) || !Array.isArray(center) || center.length !== 3 || !finite(center) ||
      !Number.isFinite(strength) || strength < 0 || strength > 1) throw new Error('Invalid normalizer settings.');
  const sd = ['sd', 'seams', 'smooth'].includes(mode) ? sdNormalTargets(snapshot, { mode, weighting, creaseAngle }) : null;
  let changed = 0, unresolved = 0;
  const geosets = snapshot.geosets.map(g => {
    const normals = g.Normals.slice(), touched = [];
    const surface = mode === 'surface' && strength > 0 ? surfaceDirections(g) : null;
    for (const id of g.ids) {
      if (strength === 0 || mode === 'seams' && !sd.seamIds.get(g.index).has(id)) continue;
      const target = sd ? unit(vector(sd.directions.get(g.index), id)) : surface ? unit(vector(surface, id)) :
        unit(vector(g.Vertices, id).map((v, axis) => (v - center[axis]) * (mode === 'inward' ? -1 : 1)));
      if (!target) { unresolved++; continue; }
      const next = blendDirection(vector(g.Normals, id), target, strength);
      if (next.every((v, axis) => Math.abs(v - g.Normals[id * 3 + axis]) <= 1e-7)) continue;
      normals.set(next, id * 3);
      if (next.some((_, axis) => normals[id * 3 + axis] !== g.Normals[id * 3 + axis])) touched.push(id);
    }
    changed += touched.length;
    const tangents = g.Tangents?.slice();
    if (tangents && touched.length) {
      const rebuilt = forgeTangents({ ...g, Normals: normals });
      for (const id of touched) tangents.set(rebuilt.subarray(id * 4, id * 4 + 4), id * 4);
    }
    return { index: g.index, ids: g.ids, normals, tangents };
  });
  return { geosets, changed, unresolved, count: snapshot.count, joinedVertices: sd?.joinedVertices || 0, seamGroups: sd?.seamGroups || 0 };
}

/** Commit the already-previewed streams in the caller's single document transaction. */
export function applyNormalPreview(model, preview) {
  for (const entry of preview.geosets) {
    const g = model.Geosets?.[entry.index];
    if (g?.Normals?.length !== entry.normals.length || (entry.tangents && g.Tangents?.length !== entry.tangents.length))
      throw new Error('The model changed. Open NormalsXL again.');
  }
  for (const entry of preview.geosets) {
    const g = model.Geosets[entry.index];
    for (const id of entry.ids) {
      g.Normals.set(entry.normals.subarray(id * 3, id * 3 + 3), id * 3);
      if (entry.tangents) g.Tangents.set(entry.tangents.subarray(id * 4, id * 4 + 4), id * 4);
    }
  }
  return preview.changed;
}
