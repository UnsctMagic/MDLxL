/** Mesh edits are explicit commands. Run them inside EditorDocument.apply for undo. */
import { cross } from './vec.js';
import { geosetBounds } from './editor-document.js';
const LIMIT = 65536;
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const normalized = (a) => { const length = Math.hypot(...a); return length > 1e-12 ? a.map((v) => v / length) : [1, 0, 0]; };
const position = (g, i) => Array.from(g.Vertices.subarray(i * 3, i * 3 + 3));

// Each command family keeps its own wording. Mesh commands (weld, detach,
// extrude) use requireFaces: triangles must exist and any Tangents or
// SkinWeights array must be complete. Classic commands skip empty ones.
const SELECTION_CHECKS = {
  mesh: {
    vertices: 'The geoset has invalid vertex data.', noVertices: 'The geoset must contain 1–65536 vertices.', limit: 'The geoset must contain 1–65536 vertices.',
    size: name => `${name} does not match the vertex count.`, finite: name => `${name} contains non-finite values.`,
    uvSets: 'The geoset has invalid UV sets.', uv: 'A UV set does not match the vertices or contains invalid values.',
    faces: 'The geoset contains invalid triangle references.', groups: 'The geoset contains invalid matrix-group references.',
  },
  classic: {
    vertices: 'The geoset needs complete vertex coordinates.', noVertices: 'The geoset needs complete vertex coordinates.', limit: 'The geoset exceeds the 65536-vertex file-format limit.',
    size: name => `${name} does not match the vertices or contains invalid values.`, finite: name => `${name} does not match the vertices or contains invalid values.`,
    uvSets: 'Texture coordinates do not match the vertices.', uv: 'Texture coordinates do not match the vertices.',
    faces: 'The geoset contains invalid triangles.', groups: 'The geoset contains invalid vertex-group references.',
  },
};
const VERTEX_STREAMS = [['Vertices', 3], ['Normals', 3], ['VertexGroup', 1], ['Tangents', 4], ['SkinWeights', 8]];

/** Check a vertex selection and the geoset it belongs to; returns the vertex
 * count and the unique selected indices. streams: false checks the selection
 * only; message replaces both selection messages. */
export function checkedVertexSelection(g, indices, { requireFaces = false, allowEmpty = false, streams = true, message } = {}) {
  let count = (g?.Vertices?.length || 0) / 3;
  if (streams) {
    const check = SELECTION_CHECKS[requireFaces ? 'mesh' : 'classic'];
    if (!g || !ArrayBuffer.isView(g.Vertices) || g.Vertices.length % 3) throw new Error(check.vertices);
    if (!count) throw new Error(check.noVertices);
    if (count > LIMIT) throw new Error(check.limit);
    for (const [name, stride] of VERTEX_STREAMS) {
      const data = g[name];
      if (stride > 3 && (requireFaces ? data == null : !data?.length)) continue;
      if (!ArrayBuffer.isView(data) || data.length !== count * stride) throw new Error(check.size(name));
      if (data.some((v) => !Number.isFinite(v))) throw new Error(check.finite(name));
    }
    if (!Array.isArray(g.TVertices)) throw new Error(check.uvSets);
    if (g.TVertices.some((uv) => !ArrayBuffer.isView(uv) || uv.length !== count * 2 || uv.some((v) => !Number.isFinite(v)))) throw new Error(check.uv);
    if (!ArrayBuffer.isView(g.Faces) || requireFaces && !g.Faces.length || g.Faces.length % 3 || g.Faces.some((v) => !Number.isInteger(v) || v < 0 || v >= count)) throw new Error(check.faces);
    if (!Array.isArray(g.Groups) || g.VertexGroup.some((v) => !Number.isInteger(v) || !g.Groups[v])) throw new Error(check.groups);
  }
  if (indices != null && typeof indices[Symbol.iterator] !== 'function') throw new Error(message || 'Select vertices first.');
  const selected = [...new Set(indices ?? [])];
  if (!selected.length && !allowEmpty) throw new Error(message || 'Select vertices first.');
  if (selected.some((i) => !Number.isInteger(i) || i < 0 || i >= count)) throw new Error(message || 'Vertex selection is out of range.');
  return { count, selected };
}
const validate = (g, indices) => checkedVertexSelection(g, indices, { requireFaces: true });

export function updateBounds(g) {
  Object.assign(g, geosetBounds(g.Vertices));
}

/** Copy the vertex streams a geoset has (UVs, positions, normals, groups,
 * tangents, skin weights) for these vertices, keeping each typed array type. */
export function gatherStreams(g, indices) {
  const take = (data, stride) => {
    const out = new data.constructor(indices.length * stride);
    for (let i = 0; i < indices.length; i++) out.set(data.subarray(indices[i] * stride, indices[i] * stride + stride), i * stride);
    return out;
  };
  const result = { TVertices: g.TVertices.map((uv) => take(uv, 2)) };
  for (const [name, stride] of VERTEX_STREAMS) if (g[name]?.length) result[name] = take(g[name], stride);
  return result;
}

function completeFaces(g, selected) {
  const set = new Set(selected), chosen = [], rest = [];
  for (let i = 0; i < g.Faces.length; i += 3) {
    const face = Array.from(g.Faces.subarray(i, i + 3));
    if (face.every((v) => set.has(v))) chosen.push(face); else rest.push(face);
  }
  if (!chosen.length) throw new Error('Select all three vertices of at least one triangle.');
  for (const face of chosen) if (new Set(face).size !== 3) throw new Error('Selected faces contain degenerate triangles.');
  return { chosen, rest, used: [...new Set(chosen.flat())].sort((a, b) => a - b) };
}

function attributeKey(g, index) {
  const parts = [g.VertexGroup[index]];
  for (const [array, stride] of [[g.Normals, 3], ...g.TVertices.map((uv) => [uv, 2]), ...(g.Tangents != null ? [[g.Tangents, 4]] : []), ...(g.SkinWeights != null ? [[g.SkinWeights, 8]] : [])]) {
    parts.push(...array.subarray(index * stride, index * stride + stride));
  }
  return parts.join(',');
}

/** Weld selected positions within epsilon only when all seam/rig attributes match exactly. */
export function weldVertices(geoset, indices, epsilon = 1e-5) {
  const { count, selected } = validate(geoset, indices);
  if (!Number.isFinite(epsilon) || epsilon < 0) throw new Error('Weld tolerance must be a non-negative finite number.');
  const representatives = new Map(), buckets = new Map();
  const exact = epsilon === 0;
  for (const index of [...selected].sort((a, b) => a - b)) {
    const p = position(geoset, index), attrs = attributeKey(geoset, index);
    const cell = exact ? p : p.map((v) => Math.floor(v / epsilon));
    if (!exact && cell.some((v) => !Number.isSafeInteger(v))) throw new Error('Weld tolerance is too small for these coordinates.');
    const offsets = exact ? [0] : [-1, 0, 1]; let found;
    for (const dx of offsets) for (const dy of offsets) for (const dz of offsets) {
      const candidates = buckets.get(`${cell[0] + dx}|${cell[1] + dy}|${cell[2] + dz}|${attrs}`) || [];
      for (const candidate of candidates) {
        const q = position(geoset, candidate);
        if ((exact ? p.every((v, axis) => v === q[axis]) : Math.hypot(...p.map((v, axis) => v - q[axis])) <= epsilon) && (found === undefined || candidate < found)) found = candidate;
      }
    }
    if (found !== undefined) representatives.set(index, found);
    else {
      representatives.set(index, index);
      const key = `${cell[0]}|${cell[1]}|${cell[2]}|${attrs}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(index);
    }
  }
  const removed = new Set([...representatives].filter(([old, representative]) => old !== representative).map(([old]) => old));
  if (!removed.size) return { merged: 0, selection: selected };
  const kept = Array.from({ length: count }, (_, i) => i).filter((i) => !removed.has(i));
  const remap = new Map(kept.map((old, i) => [old, i]));
  const faces = [];
  for (let i = 0; i < geoset.Faces.length; i += 3) {
    const face = Array.from(geoset.Faces.subarray(i, i + 3), (old) => remap.get(representatives.get(old) ?? old));
    if (new Set(face).size === 3) faces.push(...face);
  }
  if (!faces.length) throw new Error('This weld would remove every triangle from the geoset.');
  const streams = gatherStreams(geoset, kept);
  Object.assign(geoset, streams, { Faces: new Uint16Array(faces) }); updateBounds(geoset);
  return { merged: removed.size, selection: [...new Set(selected.map((old) => remap.get(representatives.get(old) ?? old)))] };
}

/** Detach triangles whose three vertices are selected; keep source loose vertices. */
export function detachFaces(model, geosetIndex, indices) {
  if (!Number.isInteger(geosetIndex) || !model?.Geosets?.[geosetIndex]) throw new Error('Select an existing geoset.');
  const geoset = model.Geosets[geosetIndex];
  const { count, selected } = validate(geoset, indices);
  const { chosen, rest, used } = completeFaces(geoset, selected);
  if (!rest.length) throw new Error('Detaching every face would leave an empty geoset. Duplicate the whole geoset instead.');
  const movedSet = new Set(used), remainingUsed = new Set(rest.flat());
  const kept = Array.from({ length: count }, (_, i) => i).filter((i) => !movedSet.has(i) || remainingUsed.has(i));
  const remapSource = new Map(kept.map((old, i) => [old, i]));
  const remapDetached = new Map(used.map((old, i) => [old, i]));
  const detached = Object.assign(structuredClone(geoset), gatherStreams(geoset, used), { Faces: new Uint16Array(chosen.flatMap((face) => face.map((i) => remapDetached.get(i)))) });
  if (own(detached, 'Name')) detached.Name = `${(detached.Name || 'Geoset').slice(0, 70)} detached`;
  const remaining = { ...gatherStreams(geoset, kept), Faces: new Uint16Array(rest.flatMap((face) => face.map((i) => remapSource.get(i)))) };
  updateBounds(detached); updateBounds(remaining);
  const newIndex = model.Geosets.length;
  const animations = (model.GeosetAnims || []).filter((a) => a.GeosetId === geosetIndex).map((a) => ({ ...structuredClone(a), GeosetId: newIndex }));
  Object.assign(geoset, remaining);
  model.Geosets.push(detached);
  (model.GeosetAnims ||= []).push(...animations);
  for (const bone of model.Bones || []) if (bone.GeosetId === geosetIndex) bone.GeosetId = null;
  if (model.Info) { model.Info.NumGeosets = model.Geosets.length; model.Info.NumGeosetAnims = model.GeosetAnims.length; }
  return newIndex;
}

/**
 * Extrude a selected face region. Existing/top attributes remain unchanged.
 * Walls have separate seam vertices, generated UV strips and matching normals /
 * tangents; matrix groups and skin weights follow their original endpoints.
 */
export function extrudeFaces(geoset, indices, delta = [0, 0, 10]) {
  const { count, selected } = validate(geoset, indices);
  if (!delta || delta.length !== 3 || Array.from(delta).some((v) => !Number.isFinite(v)) || Math.hypot(...delta) < 1e-8) throw new Error('Extrusion needs a non-zero vector with three finite values.');
  const { chosen, rest, used } = completeFaces(geoset, selected);
  const edges = new Map();
  for (const face of chosen) for (let j = 0; j < 3; j++) {
    const a = face[j], b = face[(j + 1) % 3], key = a < b ? `${a}:${b}` : `${b}:${a}`;
    if (!edges.has(key)) edges.set(key, []);
    edges.get(key).push([a, b]);
  }
  const boundary = [];
  for (const list of edges.values()) {
    if (list.length > 2) throw new Error('The selected region has a nonmanifold edge.');
    if (list.length === 2 && list[0][0] === list[1][0]) throw new Error('Selected faces have inconsistent winding on a shared edge.');
    if (list.length === 1) boundary.push(list[0]);
  }
  if (!boundary.length) throw new Error('Extrusion needs a face region with a boundary; a complete closed mesh has none.');
  const selectedSet = new Set(used), remainingUsed = new Set(rest.flat());
  const kept = Array.from({ length: count }, (_, i) => i).filter((i) => !selectedSet.has(i) || remainingUsed.has(i));
  const newCount = kept.length + used.length + boundary.length * 4;
  if (newCount > LIMIT) throw new Error('Extrusion would exceed the 65536-vertex geoset limit. Split the geoset first.');
  const walls = boundary.map(([a, b]) => {
    const pa = position(geoset, a), pb = position(geoset, b), edge = pb.map((v, i) => v - pa[i]);
    const lengthSquared = dot(edge, edge), normalCross = cross(edge, delta), area = Math.hypot(...normalCross);
    if (lengthSquared < 1e-16 || area <= Math.sqrt(lengthSquared) * Math.hypot(...delta) * 1e-8) throw new Error('Extrusion is parallel to a boundary edge or the boundary contains coincident vertices.');
    const normal = normalCross.map((v) => v / area), along = dot(delta, edge) / lengthSquared, height = area / lengthSquared;
    const uvs = geoset.TVertices.map((uv) => {
      const au = uv[a * 2], av = uv[a * 2 + 1];
      let du = uv[b * 2] - au, dv = uv[b * 2 + 1] - av;
      if (Math.hypot(du, dv) < 1e-8) { du = 1; dv = 0; }
      const ou = du * along - dv * height, ov = dv * along + du * height;
      return { values: [au, av, au + du, av + dv, au + du + ou, av + dv + ov, au + ou, av + ov], du, dv, ou, ov };
    });
    let tangent = [...normalized(edge), 1];
    if (uvs.length) {
      const { du, dv, ou, ov } = uvs[0], determinant = du * ov - dv * ou;
      const t = normalized(edge.map((v, i) => (v * ov - delta[i] * dv) / determinant));
      const bitangent = edge.map((v, i) => (delta[i] * du - v * ou) / determinant);
      tangent = [...t, dot(cross(normal, t), bitangent) < 0 ? -1 : 1];
    }
    return { a, b, normal, tangent, uvs };
  });
  const sourceIndices = [...kept, ...used, ...walls.flatMap(({ a, b }) => [a, b, b, a])];
  const data = gatherStreams(geoset, sourceIndices);
  const topMap = new Map(used.map((old, i) => [old, kept.length + i]));
  const keptMap = new Map(kept.map((old, i) => [old, i]));
  for (const index of topMap.values()) for (let axis = 0; axis < 3; axis++) data.Vertices[index * 3 + axis] += delta[axis];
  const faces = [...rest.flatMap((face) => face.map((i) => keptMap.get(i))), ...chosen.flatMap((face) => face.map((i) => topMap.get(i)))];
  for (const [wallIndex, wall] of walls.entries()) {
    const first = kept.length + used.length + wallIndex * 4;
    for (let j = 0; j < 4; j++) {
      if (j >= 2) for (let axis = 0; axis < 3; axis++) data.Vertices[(first + j) * 3 + axis] += delta[axis];
      data.Normals.set(wall.normal, (first + j) * 3);
      if (data.Tangents) data.Tangents.set(wall.tangent, (first + j) * 4);
    }
    for (let uv = 0; uv < data.TVertices.length; uv++) data.TVertices[uv].set(wall.uvs[uv].values, first * 2);
    faces.push(first, first + 1, first + 2, first, first + 2, first + 3);
  }
  if (data.Vertices.some((v) => !Number.isFinite(v))) throw new Error('Extruded coordinates exceed the supported floating-point range.');
  Object.assign(geoset, data, { Faces: new Uint16Array(faces) }); updateBounds(geoset);
  return [...topMap.values()];
}
