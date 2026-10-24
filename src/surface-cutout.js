/** Local surface partitioning. Planning never mutates the document; Apply belongs
 * in one EditorDocument transaction. No texture inference or global welding. */
import { booleanContours, cross, signedArea, triangulateContours } from './forge-geometry.js';
import { gather, updateBounds } from './mesh-tools.js';
import { allNodes, sampleNodeMatrices, skinGeoset } from './animation.js';

const plans = new WeakMap();
const serial = value => JSON.stringify(value);
const fingerprint = value => {
  const text = serial(value); let a = 2166136261, b = 5381;
  for (let i = 0; i < text.length; i++) { a = Math.imul(a ^ text.charCodeAt(i), 16777619); b = Math.imul(b, 33) ^ text.charCodeAt(i); }
  return text.length + '-' + (a >>> 0).toString(16) + '-' + (b >>> 0).toString(16);
};
const edgeKey = (a, b) => a < b ? a + ':' + b : b + ':' + a;
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const pointAt = (array, id, stride = 2) => Array.from(array.subarray(id * stride, (id + 1) * stride));
const barycentric = (p, triangle) => {
  const [a, b, c] = triangle, area = cross(a, b, c);
  return [cross(p, b, c) / area, cross(a, p, c) / area, cross(a, b, p) / area];
};
const segmentDistance = (p, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
  return distance(p, [a[0] + t * dx, a[1] + t * dy]);
};
function intersects(a, b, c, d, epsilon = 1e-12) {
  const ab = [cross(a, b, c), cross(a, b, d)], cd = [cross(c, d, a), cross(c, d, b)];
  if (ab[0] * ab[1] < -epsilon * epsilon && cd[0] * cd[1] < -epsilon * epsilon) return true;
  return Math.min(segmentDistance(a, c, d), segmentDistance(b, c, d), segmentDistance(c, a, b), segmentDistance(d, a, b)) <= epsilon;
}
function validateLoop(loop) {
  if (loop.length < 3 || Math.abs(signedArea(loop)) < 1e-12) throw Error('Draw a closed outline with at least three distinct corners.');
  for (let i = 0; i < loop.length; i++) for (let j = i + 1; j < loop.length; j++) {
    if (j === i + 1 || i === 0 && j === loop.length - 1) continue;
    if (intersects(loop[i], loop[(i + 1) % loop.length], loop[j], loop[(j + 1) % loop.length])) throw Error('The outline crosses itself. Draw a simple closed outline.');
  }
}
function insideLoop(p, loop) {
  let inside = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const a = loop[i], b = loop[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
/** True when a (possibly collapsed) triangle lies in or touches the outline. */
function reachesLoop(points, loop, epsilon) {
  if (points.some(p => insideLoop(p, loop))) return true;
  return points.some((a, k) => loop.some((c, n) => intersects(a, points[(k + 1) % 3], c, loop[(n + 1) % loop.length], epsilon)));
}
function boundaryDistance(p, loop) {
  return Math.min(...loop.map((a, i) => segmentDistance(p, a, loop[(i + 1) % loop.length])));
}
function simplifyArc(points, tolerance) {
  if (points.length <= 2) return points;
  let maximum = 0, index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const value = segmentDistance(points[i], points[0], points.at(-1));
    if (value > maximum) { maximum = value; index = i; }
  }
  if (maximum <= tolerance) return [points[0], points.at(-1)];
  return [...simplifyArc(points.slice(0, index + 1), tolerance).slice(0, -1), ...simplifyArc(points.slice(index), tolerance)];
}
/** Both directions, with a Lipschitz error bound on every sampled segment. */
function contourError(a, b, tolerance) {
  let maximum = 0;
  for (const [from, to] of [[a, b], [b, a]]) for (let i = 0; i < from.length; i++) {
    const p = from[i], q = from[(i + 1) % from.length], length = distance(p, q);
    const steps = Math.max(1, Math.ceil(length / Math.max(tolerance / 4, 1e-5)));
    if (steps > 65536) return Infinity;
    for (let n = 0; n <= steps; n++) {
      const sample = [p[0] + (q[0] - p[0]) * n / steps, p[1] + (q[1] - p[1]) * n / steps];
      maximum = Math.max(maximum, boundaryDistance(sample, to) + length / steps / 2);
      if (maximum > tolerance) return maximum;
    }
  }
  return maximum;
}
export function surfaceCutoutContours(points, { textureSize = [256, 256], tolerance = .5, corners = 0, maximumCorners = 32, pinned = false } = {}) {
  if (!Array.isArray(points) || points.some(p => p?.length !== 2 || !p.every(Number.isFinite))) throw Error('The outline needs finite UV coordinates.');
  if (!textureSize.every(n => Number.isFinite(n) && n > 0) || !(tolerance > 0) || !Number.isInteger(maximumCorners) || maximumCorners < 3 || maximumCorners > 256) throw Error('Invalid outline size, tolerance or complexity budget.');
  const raw = [];
  for (const p of points) if (!raw.length || distance(p, raw.at(-1)) > 1e-10) raw.push(p.slice());
  if (raw.length > 1 && distance(raw[0], raw.at(-1)) < 1e-10) raw.pop();
  if (raw.length > 4096) throw Error('The outline has too many samples. Draw a shorter outline.');
  validateLoop(raw);
  const native = raw.map(p => p.map((v, i) => v * textureSize[i]));
  const candidates = [], seen = new Set();
  const record = current => {
    if (current.length < 3 || current.length > maximumCorners || corners && current.length !== corners || seen.has(serial(current))) return;
    try { validateLoop(current); } catch { return; }
    const error = current === native ? 0 : contourError(native, current, tolerance);
    if (error <= tolerance) { seen.add(serial(current)); candidates.push({ points: current.map(p => p.map((v, i) => v / textureSize[i])), error }); }
  };
  record(native);
  if (!pinned) {
    let opposite = 1;
    for (let i = 2; i < native.length; i++) if (distance(native[i], native[0]) > distance(native[opposite], native[0])) opposite = i;
    for (const fraction of [.05, .125, .25, .5, .75, 1]) {
      const a = simplifyArc(native.slice(0, opposite + 1), tolerance * fraction);
      const b = simplifyArc([...native.slice(opposite), native[0]], tolerance * fraction);
      record([...a.slice(0, -1), ...b.slice(0, -1)]);
    }
  }
  if (!candidates.length) throw Error('The corner budget cannot follow this outline within the texel tolerance. Increase Corners or tolerance.');
  return candidates;
}

function validateGeoset(g, uvSet) {
  const count = g?.Vertices?.length / 3;
  if (!Number.isInteger(count) || count < 3 || count > 65536) throw Error('The source has invalid vertex data.');
  if (g.SkinWeights?.length) throw Error('HD skinning is read-only for surface cutouts.');
  for (const [name, stride] of [['Vertices', 3], ['Normals', 3], ['VertexGroup', 1], ...(g.Tangents ? [['Tangents', 4]] : [])]) {
    if (!ArrayBuffer.isView(g[name]) || g[name].length !== count * stride || g[name].some(n => !Number.isFinite(n))) throw Error('Invalid source stream: ' + name);
  }
  if (!Array.isArray(g.TVertices) || !g.TVertices[uvSet] || g.TVertices.some(uv => !ArrayBuffer.isView(uv) || uv.length !== count * 2 || uv.some(n => !Number.isFinite(n)))) throw Error('The source has invalid UV streams.');
  if (!ArrayBuffer.isView(g.Faces) || g.Faces.length % 3 || g.Faces.some(i => i >= count)) throw Error('The source has invalid triangles.');
  if (!Array.isArray(g.Groups) || g.Groups.length > 256 || g.VertexGroup.some(i => !g.Groups[i])) throw Error('The source has invalid classic bindings.');
}
function binding(g, id) {
  const group = g.Groups[g.VertexGroup[id]], counts = new Map();
  for (const bone of group) counts.set(bone, (counts.get(bone) || 0) + 1);
  return serial([...counts].sort((a, b) => a[0] - b[0]).map(([bone, n]) => [bone, n / group.length]));
}
function makeDomain(g, uvSet, contour, textureSize) {
  const uv = g.TVertices[uvSet], triangles = [];
  const low = contour[0].map((_, axis) => Math.min(...contour.map(p => p[axis] * textureSize[axis])));
  let dimension = Math.max(...contour.map(p => Math.max(...p.map((v, axis) => Math.abs(v * textureSize[axis] - low[axis])))), 1e-6);
  const box = [0, 1].map(axis => [Math.min(...contour.map(p => p[axis])), Math.max(...contour.map(p => p[axis]))]);
  for (let index = 0; index < g.Faces.length / 3; index++) {
    const ids = pointAt(g.Faces, index, 3), points = ids.map(id => pointAt(uv, id));
    const nearby = [0, 1].every(axis => Math.max(...points.map(p => p[axis])) >= box[axis][0] && Math.min(...points.map(p => p[axis])) <= box[axis][1]);
    if (nearby) for (const p of points) dimension = Math.max(dimension, ...p.map((v, axis) => Math.abs(v * textureSize[axis] - low[axis])));
    triangles.push({ index, ids, points, nearby });
  }
  const local = p => p.map((v, axis) => v * textureSize[axis] - low[axis]);
  const loop = contour.map(local), epsilon = dimension * 4 / 1048576;
  if (loop.some((p, i) => distance(p, loop[(i + 1) % loop.length]) < epsilon * 8)) throw Error('The contour is too small for the local cutting precision.');
  for (const t of triangles) t.local = t.points.map(local);
  const clip = (subject, operation) => booleanContours(subject, [loop], operation, dimension);
  return { triangles, loop, dimension, epsilon, clip };
}
function resolveTriangles(domain, target) {
  if (target.seedTriangles?.length) {
    const combined = new Map();
    for (const seedTriangle of new Set(target.seedTriangles)) for (const [index, triangle] of resolveTriangles(domain, { ...target, seedTriangles: undefined, seedTriangle })) combined.set(index, triangle);
    return combined;
  }
  const { triangles, clip, dimension, loop, epsilon } = domain, eligible = target.eligibleTriangleIndices == null ? null : new Set(target.eligibleTriangleIndices);
  const candidates = new Map();
  const explicit = target.triangleIndices == null ? null : new Set(target.triangleIndices);
  for (const index of [...(explicit || []), ...(eligible || []), ...(target.seedTriangle == null ? [] : [target.seedTriangle])]) {
    if (!Number.isInteger(index) || !triangles[index]) throw Error('The selected source triangle no longer exists.');
  }
  for (const t of triangles) {
    if (!t.nearby || explicit && !explicit.has(t.index) || eligible && !eligible.has(t.index)) continue;
    if (Math.abs(cross(...t.local)) < dimension * dimension * 1e-14) {
      // UV-degenerate faces cannot be lifted. Block only when the face lies in or
      // touches the outline; one clear of it stays untouched in the source.
      if (reachesLoop(t.local, loop, epsilon)) throw Error('A target UV triangle is degenerate. Choose a nondegenerate UV surface.');
      continue;
    }
    const inside = clip([t.local], 'keep');
    if (Math.abs(inside.reduce((sum, loop) => sum + signedArea(loop), 0)) > dimension * dimension * 1e-13) candidates.set(t.index, { ...t, inside });
  }
  if (explicit || !candidates.size) return candidates;
  if (target.seedTriangle != null) {
    if (!candidates.has(target.seedTriangle)) throw Error('Pick a surface inside the drawn outline in the live model preview.');
    const edges = new Map();
    for (const t of candidates.values()) for (let k = 0; k < 3; k++) {
      const key = edgeKey(t.ids[k], t.ids[(k + 1) % 3]);
      if (!edges.has(key)) edges.set(key, []); edges.get(key).push(t.index);
    }
    const selected = new Set([target.seedTriangle]), queue = [target.seedTriangle];
    for (const index of queue) {
      const t = candidates.get(index);
      for (let k = 0; k < 3; k++) for (const neighbor of edges.get(edgeKey(t.ids[k], t.ids[(k + 1) % 3]))) if (!selected.has(neighbor)) { selected.add(neighbor); queue.push(neighbor); }
    }
    for (const index of candidates.keys()) if (!selected.has(index)) candidates.delete(index);
  }
  // A connected folded UV sheet is still ambiguous. A precise seed may isolate a
  // disconnected repeat, but never authorizes overlapping faces on the same sheet.
  const list = [...candidates.values()];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const overlap = booleanContours(list[i].inside, list[j].inside, 'keep', dimension);
    if (Math.abs(overlap.reduce((sum, loop) => sum + signedArea(loop), 0)) > dimension * dimension * 1e-11) throw Error('Overlapping UV instances: pick the intended surface in the live model preview.');
  }
  return candidates;
}

function planGeoset(model, target, contour, options) {
  const g = model.Geosets?.[target.geosetIndex], uvSet = target.uvSet ?? 0;
  validateGeoset(g, uvSet);
  if (target.materialId != null && target.materialId !== g.MaterialID) throw Error('The source material changed.');
  const domain = makeDomain(g, uvSet, contour, options.textureSize);
  const selected = resolveTriangles(domain, target);
  if (!selected.size) return null;
  const { triangles, loop, dimension, epsilon, clip } = domain;
  const originalCount = g.Vertices.length / 3, records = new Map(), splits = new Map(), provenance = [], mixed = [];
  const generated = [], remainder = [], extracted = [], faceProvenance = [];
  const register = (t, raw) => {
    // Restore authoritative input corners/intersections after Clipper's integer lattice.
    const choices = t.local.map((point, corner) => ({ point, id: 'v:' + t.ids[corner] }));
    for (let n = 0; n < loop.length; n++) choices.push({ point: loop[n], id: 'f:' + t.index + ':c:' + n });
    for (let k = 0; k < 3; k++) {
      const a = t.local[k], b = t.local[(k + 1) % 3];
      for (let n = 0; n < loop.length; n++) {
        const c = loop[n], d = loop[(n + 1) % loop.length], r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]], denominator = r[0] * s[1] - r[1] * s[0];
        if (Math.abs(denominator) < dimension * dimension * 1e-15) continue;
        const q = [c[0] - a[0], c[1] - a[1]], u = (q[0] * s[1] - q[1] * s[0]) / denominator, v = (q[0] * r[1] - q[1] * r[0]) / denominator;
        if (u >= -1e-10 && u <= 1 + 1e-10 && v >= -1e-10 && v <= 1 + 1e-10) choices.push({ point: [a[0] + u * r[0], a[1] + u * r[1]] });
      }
    }
    choices.sort((a, b) => distance(a.point, raw) - distance(b.point, raw));
    const nearest = choices[0];
    if (distance(nearest.point, raw) > epsilon * 2) throw Error('A cut intersection exceeded the local precision bound.');
    let p = nearest.point, weights = barycentric(p, t.local), key = nearest.id;
    const corner = weights.findIndex(w => Math.abs(w - 1) < 1e-9);
    if (corner >= 0) { key = 'v:' + t.ids[corner]; p = t.local[corner]; weights = [0, 0, 0]; weights[corner] = 1; }
    else {
      const zero = weights.findIndex(w => Math.abs(w) < 1e-9);
      if (zero >= 0) {
        const corners = [0, 1, 2].filter(k => k !== zero).sort((a, b) => t.ids[a] - t.ids[b]);
        const [a, b] = corners, parameter = weights[b] / (weights[a] + weights[b]), edge = edgeKey(t.ids[a], t.ids[b]);
        key = 'e:' + edge + ':' + parameter.toFixed(10);
        weights = [0, 0, 0]; weights[a] = 1 - parameter; weights[b] = parameter;
        p = t.local[a].map((v, axis) => v * (1 - parameter) + t.local[b][axis] * parameter);
        if (!splits.has(edge)) splits.set(edge, new Map());
        splits.get(edge).set(key, { key, parameter, point: p });
      }
    }
    if (!key) throw Error('The cut produced a point with no source provenance.');
    if (!records.has(key)) {
      const participants = weights.map((w, i) => ({ w, id: t.ids[i] })).filter(p => p.w > 1e-9);
      const uniform = participants.every(p => binding(g, p.id) === binding(g, participants[0].id));
      if (!uniform && options.rigPolicy !== 'approximate') throw Error('Mixed bone bindings at geoset ' + (target.geosetIndex + 1) + ', triangle ' + t.index + '. Strict preservation cannot insert this vertex. Review Approximate existing rig.');
      const distributions = new Map();
      for (const participant of participants) {
        const key = binding(g, participant.id), entry = distributions.get(key) || { weight: 0, id: participant.id };
        entry.weight += participant.w; entry.id = Math.min(entry.id, participant.id); distributions.set(key, entry);
      }
      const dominant = [...distributions.values()].sort((a, b) => b.weight - a.weight || a.id - b.id)[0].id;
      if (g.Tangents && participants.some(p => g.Tangents[p.id * 4 + 3] !== g.Tangents[dominant * 4 + 3])) throw Error('The cut crosses incompatible tangent handedness.');
      const record = { key, point: p, original: corner >= 0 ? t.ids[corner] : null, group: g.VertexGroup[dominant], triangleIndex: t.index, ids: t.ids, weights, uniform };
      records.set(key, record);
      if (record.original == null) {
        record.sourceIndex = originalCount + generated.length; generated.push(record);
        provenance.push({ key, sourceGeosetIndex: target.geosetIndex, triangleIndex: t.index, barycentric: weights.slice(), sourceIndex: record.sourceIndex, deformation: uniform ? 'same-effective-transform' : 'reviewed-approximation' });
        if (!uniform) mixed.push(record);
      } else record.sourceIndex = record.original;
    }
    return records.get(key);
  };
  const regions = new Map();
  for (const t of selected.values()) {
    const outside = clip([t.local], 'remove');
    const make = loops => loops.map(points => points.map(p => register(t, p)));
    regions.set(t.index, { t, inside: make(t.inside), outside: make(outside) });
  }
  // Split every incident original edge, including authorized conformity neighbors.
  for (const t of triangles) {
    let needs = false;
    const boundary = [];
    for (let k = 0; k < 3; k++) {
      boundary.push({ point: t.local[k], original: t.ids[k], key: 'v:' + t.ids[k], sourceIndex: t.ids[k] });
      const edge = edgeKey(t.ids[k], t.ids[(k + 1) % 3]), points = [...(splits.get(edge)?.values() || [])];
      points.sort((a, b) => t.ids[k] < t.ids[(k + 1) % 3] ? a.parameter - b.parameter : b.parameter - a.parameter);
      for (const p of points) { needs = true; boundary.push(records.get(p.key)); }
    }
    if (needs && !regions.has(t.index)) {
      if (target.eligibleTriangleIndices && !target.eligibleTriangleIndices.includes(t.index)) throw Error('The cut needs a conformity split on a protected neighbor. Include that face before drawing.');
      if (Math.abs(cross(...t.local)) < dimension * dimension * 1e-14) throw Error('A conformity neighbor has degenerate UVs.');
      if (signedArea(boundary.map(r => r.point)) < 0) boundary.reverse();
      regions.set(t.index, { t, inside: [], outside: [boundary] });
    }
  }
  function triangulate(t, contours, destination, kind) {
    if (!contours.length) return;
    // Boolean cleaning may omit a collinear intersection; reinsert the shared
    // authoritative graph points into each loop before boundary-only triangulation.
    const expanded = contours.map(list => list.flatMap((a, k) => {
      const b = list[(k + 1) % list.length], between = [];
      for (const record of records.values()) if (record !== a && record !== b && record.key.startsWith('e:') && record.key.split(':').slice(1, 3).every(id => t.ids.includes(Number(id))) && segmentDistance(record.point, a.point, b.point) < dimension * 1e-10) {
        const length = distance(a.point, b.point), da = distance(a.point, record.point), db = distance(b.point, record.point);
        if (da > dimension * 1e-10 && db > dimension * 1e-10 && Math.abs(da + db - length) < dimension * 1e-9) between.push(record);
      }
      between.sort((p, q) => distance(a.point, p.point) - distance(a.point, q.point));
      return [a, ...between];
    }));
    const localRecords = expanded.flat(), mesh = triangulateContours(expanded.map(list => list.map(r => r.point)), dimension, 0, { support: false });
    const map = mesh.points.map(p => localRecords.find(r => distance(r.point, p) < dimension * 1e-10));
    if (map.some(r => !r)) throw Error('Triangulation inserted an unsupported interior point.');
    let area = 0;
    for (const triangle of mesh.triangles) {
      const result = triangle.map(i => map[i]), sign = cross(...result.map(r => r.point));
      if (Math.abs(sign) < dimension * dimension * 1e-14) throw Error('The cut produced a degenerate triangle.');
      if (sign * cross(...t.local) < 0) result.reverse();
      const centroid = [0, 1].map(axis => result.reduce((sum, r) => sum + r.point[axis] / 3, 0));
      if (barycentric(centroid, t.local).some(w => w < -1e-8)) throw Error('The cut left its source triangle.');
      area += Math.abs(sign) / 2;
      destination.push(result);
      faceProvenance.push({ kind, triangleIndex: t.index, outputTriangle: destination.length - 1 });
    }
    const expected = Math.abs(expanded.reduce((sum, list) => sum + signedArea(list.map(r => r.point)), 0));
    if (Math.abs(area - expected) > dimension * dimension * 1e-8) throw Error('The cut triangulation has incomplete coverage.');
  }
  for (const t of triangles) {
    const region = regions.get(t.index);
    if (!region) {
      remainder.push(t.ids.map(id => ({ original: id, sourceIndex: id, key: 'v:' + id })));
      faceProvenance.push({ kind: 'source', triangleIndex: t.index, outputTriangle: remainder.length - 1 }); continue;
    }
    const before = remainder.length, moved = extracted.length;
    triangulate(t, region.outside, remainder, 'source'); triangulate(t, region.inside, extracted, 'extracted');
    const covered = [...remainder.slice(before), ...extracted.slice(moved)].reduce((sum, f) => sum + Math.abs(cross(...f.map(r => r.point))) / 2, 0);
    if (Math.abs(covered - Math.abs(cross(...t.local)) / 2) > dimension * dimension * 1e-8) throw Error('The inside and outside do not partition the source.');
    const faces = [...remainder.slice(before), ...extracted.slice(moved)].map(face => face.map(r => r.point));
    for (let a = 0; a < faces.length; a++) for (let b = a + 1; b < faces.length; b++) {
      const overlap = booleanContours([faces[a]], [faces[b]], 'keep', dimension);
      if (Math.abs(overlap.reduce((sum, loop) => sum + signedArea(loop), 0)) > dimension * dimension * 1e-10) throw Error('The cut triangulation contains overlapping interiors.');
    }
  }
  if (!remainder.length) throw Error('Cutting every face would empty the source geoset. Select a smaller surface area.');
  const resultEdges = new Set();
  for (const face of [...remainder, ...extracted]) for (let k = 0; k < 3; k++) resultEdges.add(edgeKey(face[k].sourceIndex, face[(k + 1) % 3].sourceIndex));
  for (const edge of splits.keys()) if (resultEdges.has(edge)) throw Error('The cut left an unsplit incident edge.');
  if (originalCount + generated.length > 65536) throw Error('The cut exceeds the 65536-vertex geoset limit.');
  const interpolate = (array, stride, record) => Array.from({ length: stride }, (_, axis) => record.ids.reduce((sum, id, k) => sum + array[id * stride + axis] * record.weights[k], 0));
  const replacement = structuredClone(g);
  for (const [name, stride] of [['Vertices', 3], ['Normals', 3], ...(g.Tangents ? [['Tangents', 4]] : [])]) {
    const array = new g[name].constructor((originalCount + generated.length) * stride); array.set(g[name]);
    for (const record of generated) array.set(interpolate(g[name], stride, record), record.sourceIndex * stride);
    replacement[name] = array;
  }
  replacement.VertexGroup = new g.VertexGroup.constructor([...g.VertexGroup, ...generated.map(r => r.group)]);
  replacement.TVertices = g.TVertices.map(uv => {
    const result = new uv.constructor((originalCount + generated.length) * 2); result.set(uv);
    for (const record of generated) result.set(interpolate(uv, 2, record), record.sourceIndex * 2);
    return result;
  });
  replacement.Faces = new g.Faces.constructor(remainder.flatMap(face => face.map(r => r.sourceIndex)));
  const used = [...new Set(extracted.flatMap(face => face.map(r => r.sourceIndex)))], mapping = new Map(used.map((id, index) => [id, index]));
  const piece = { ...structuredClone(g), ...gather(replacement, used), Faces: new g.Faces.constructor(extracted.flatMap(face => face.map(r => mapping.get(r.sourceIndex)))) };
  if (used.length > 65536) throw Error('The extracted piece exceeds the vertex limit.');
  for (const result of [replacement, piece]) {
    result.PrimitiveTypes = Uint32Array.of(4); result.PrimitiveCounts = Uint32Array.of(result.Faces.length); updateBounds(result);
    for (const stream of [result.Vertices, result.Normals, ...result.TVertices, ...(result.Tangents ? [result.Tangents] : [])]) if (stream.some(n => !Number.isFinite(n))) throw Error('The cut exceeds vertex stream precision.');
  }
  const seamPairs = used.filter(id => remainder.some(face => face.some(r => r.sourceIndex === id))).map(id => ({ sourceIndex: id, pieceIndex: mapping.get(id) }));
  return { target, replacement, piece, provenance, faceProvenance, seamPairs, mixed, generated, affectedTriangles: [...regions.keys()].sort((a, b) => a - b), original: g };
}

function measureMotion(model, edits) {
  const schedule = [{ sequenceIndex: -1, frame: 0, globalTime: 0 }];
  for (let sequenceIndex = 0; sequenceIndex < (model.Sequences?.length || 0); sequenceIndex++) {
    const [from, to] = model.Sequences[sequenceIndex].Interval, frames = new Set(Array.from({ length: 9 }, (_, i) => from + (to - from) * i / 8));
    for (const node of allNodes(model)) for (const field of ['Translation', 'Rotation', 'Scaling']) for (const key of node[field]?.Keys || []) if (key.Frame >= from && key.Frame <= to && node[field].GlobalSeqId == null) frames.add(key.Frame);
    for (const frame of [...frames].sort((a, b) => a - b)) schedule.push({ sequenceIndex, frame, globalTime: frame });
    for (const duration of model.GlobalSequences || []) for (let i = 0; i < 8; i++) schedule.push({ sequenceIndex, frame: from + (to - from) * i / 8, globalTime: duration * i / 8 });
  }
  let maximumError = 0;
  for (const sample of schedule) {
    const matrices = sampleNodeMatrices(model, sample.frame, sample.sequenceIndex, sample.globalTime);
    for (const edit of edits) {
      const before = skinGeoset(edit.original, matrices), after = skinGeoset(edit.replacement, matrices);
      for (const record of edit.generated) {
        const expected = [0, 1, 2].map(axis => record.ids.reduce((sum, id, i) => sum + before[id * 3 + axis] * record.weights[i], 0));
        maximumError = Math.max(maximumError, Math.hypot(...expected.map((v, axis) => v - after[record.sourceIndex * 3 + axis])));
      }
    }
  }
  // Retain the authored animated boxes; expand them by the observed deviation.
  // This is sampled evidence, never a continuous-animation guarantee.
  for (const edit of edits) for (const result of [edit.replacement, edit.piece]) for (const extent of result.Anims || []) {
    if (extent.MinimumExtent?.some((v, axis) => v > extent.MaximumExtent[axis])) continue;
    for (let axis = 0; axis < 3; axis++) { extent.MinimumExtent[axis] -= maximumError; extent.MaximumExtent[axis] += maximumError; }
    extent.BoundsRadius += maximumError * Math.sqrt(3);
  }
  return { maximumError, schedule };
}

export function planSurfaceCutout(model, request) {
  if ((model.Version ?? 800) !== 800) throw Error('Surface cutout currently supports classic MDX800 models.');
  if (!request.targets?.length) throw Error('Pick a source surface first.');
  if (new Set(request.targets.map(t => t.geosetIndex)).size !== request.targets.length) throw Error('Combine reviewed triangles for the same source into one target.');
  const options = { textureSize: [256, 256], rigPolicy: 'strict', rgb: 'preserve', ...request };
  if (!['strict', 'approximate'].includes(options.rigPolicy) || !['preserve', 'untinted'].includes(options.rgb)) throw Error('Choose a supported rig and RGB policy.');
  const contours = surfaceCutoutContours(request.contour, { textureSize: options.textureSize, ...request.outline });
  const candidates = [], errors = [];
  for (const contour of contours) {
    try {
      const edits = request.targets.map(target => planGeoset(model, target, contour.points, options)).filter(Boolean);
      const delta = edits.reduce((sum, e) => sum + (e.replacement.Faces.length + e.piece.Faces.length - e.original.Faces.length) / 3, 0);
      candidates.push({ edits, contour, delta, records: edits.reduce((sum, e) => sum + e.generated.length + e.piece.Vertices.length / 3, 0) });
    } catch (error) { errors.push(error); }
  }
  if (!candidates.length) throw errors[0] || Error('No valid cut candidate.');
  candidates.sort((a, b) => a.delta - b.delta || a.records - b.records || a.contour.error - b.contour.error);
  const chosen = candidates[0], needsApproximation = chosen.edits.some(e => e.mixed.length);
  const motion = needsApproximation ? measureMotion(model, chosen.edits) : null;
  const plan = {
    contour: chosen.contour.points, revision: request.revision, documentToken: request.documentToken,
    edits: chosen.edits.map(({ original, generated, mixed, ...edit }) => edit),
    statistics: { contourCorners: chosen.contour.points.length, extractedTriangles: chosen.edits.reduce((sum, e) => sum + e.piece.Faces.length / 3, 0), affectedTrianglesBefore: chosen.edits.reduce((sum, e) => sum + e.affectedTriangles.length, 0), affectedTrianglesAfter: chosen.edits.reduce((sum, e) => sum + e.affectedTriangles.length, 0) + chosen.delta, netTriangleIncrease: chosen.delta, newStoredVertexRecords: chosen.records, maximumContourErrorTexels: chosen.contour.error, generatedInteriorSupportVertices: 0 },
    motion, needsApproximation, status: chosen.edits.length ? 'ready' : 'empty',
  };
  plan.planFingerprint = fingerprint(plan);
  plans.set(plan, { before: serial(model), payload: serial(plan), options: { rgb: options.rgb }, originalCount: model.Geosets.length });
  return plan;
}

function checked(model, plan) {
  const state = plans.get(plan);
  if (!state || state.before !== serial(model) || state.payload !== serial(plan)) throw Error('The model or cut preview changed. Draw the outline again.');
  return state;
}
function commit(model, plan, state) {
  const selection = {}, changedGeosetIndices = [], addedGeosetIndices = [];
  for (const edit of plan.edits) {
    const sourceIndex = edit.target.geosetIndex, nextIndex = model.Geosets.length;
    model.Geosets[sourceIndex] = structuredClone(edit.replacement); model.Geosets.push(structuredClone(edit.piece));
    for (const source of (model.GeosetAnims || []).filter(a => a.GeosetId === sourceIndex)) {
      const anim = { ...structuredClone(source), GeosetId: nextIndex };
      if (state.options.rgb === 'untinted') {
        anim.Color = new Float32Array([1, 1, 1]); anim.Flags &= ~2;
        if (anim._MdxDefaults) anim._MdxDefaults.Color = new Float32Array([1, 1, 1]);
      }
      model.GeosetAnims.push(anim);
    }
    for (const source of (model.Gliders || []).filter(a => a.GeosetId === sourceIndex)) model.Gliders.push({ ...structuredClone(source), GeosetId: nextIndex });
    for (const bone of model.Bones || []) if (bone.GeosetId === sourceIndex) bone.GeosetId = null;
    selection[nextIndex] = Array.from({ length: edit.piece.Vertices.length / 3 }, (_, i) => i);
    changedGeosetIndices.push(sourceIndex); addedGeosetIndices.push(nextIndex);
  }
  if (plan.edits.length && model.Info) { model.Info.NumGeosets = model.Geosets.length; model.Info.NumGeosetAnims = model.GeosetAnims?.length || 0; }
  return { selection, changedGeosetIndices, addedGeosetIndices };
}
export function previewSurfaceCutout(model, plan) {
  const state = checked(model, plan), result = structuredClone(model);
  commit(result, plan, state); return result;
}
export function applySurfaceCutoutPlan(model, plan, { acceptApproximation = false } = {}) {
  const state = checked(model, plan);
  if (plan.needsApproximation && !acceptApproximation) throw Error('Review the measured motion deviation and accept Approximate existing rig before applying.');
  if (!plan.edits.length) return false;
  return commit(model, plan, state);
}
