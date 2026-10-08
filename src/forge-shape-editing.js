import { Vector2, ShapeUtils } from 'three';
import { TRIANGLE_ICON_UV } from './forge-primitives.js';

const add = (a, b) => a.map((v, i) => v + b[i]);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const mul = (a, n) => a.map(v => v * n);
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = a => mul(a, 1 / (Math.hypot(...a) || 1));
export const forgeEdgeKey = (a, b) => a < b ? `${a}:${b}` : `${b}:${a}`;
const triangleNormal = (shape, ids) => cross(sub(shape.vertices[ids[1]], shape.vertices[ids[0]]), sub(shape.vertices[ids[2]], shape.vertices[ids[0]]));
export const forgeFaceNormal = (shape, face) => unit(face.triangles.reduce((n, t) => add(n, triangleNormal(shape, t.vertices)), [0, 0, 0]));

function boundaryEdges(faces) {
  const edges = new Map();
  for (const face of faces) for (let i = 0; i < face.vertices.length; i++) {
    const a = face.vertices[i], b = face.vertices[(i + 1) % face.vertices.length], key = forgeEdgeKey(a, b);
    if (edges.has(key)) edges.delete(key); else edges.set(key, [a, b]);
  }
  return [...edges.values()];
}

// Keep corner UVs separate from position topology. Warcraft primitives use
// separate vertices at UV/normal seams; editing a side must still move its
// connected neighbors without welding or replacing those texture coordinates.
export function createForgeShape(mesh, { id = 1, name = 'Shape', texturePath } = {}) {
  const vertices = [], faces = [], welded = new Map();
  const bounds = [[Infinity, -Infinity], [Infinity, -Infinity], [Infinity, -Infinity]];
  for (const g of mesh.geosets) for (let i = 0; i < g.Vertices.length; i++) { const b = bounds[i % 3]; b[0] = Math.min(b[0], g.Vertices[i]); b[1] = Math.max(b[1], g.Vertices[i]); }
  const epsilon = Math.max(1, ...bounds.map(b => b[1] - b[0])) * 1e-7;
  let nextFaceId = 1;
  for (const g of mesh.geosets) {
    const ids = Array.from({ length: g.Vertices.length / 3 }, (_, i) => {
      const p = Array.from(g.Vertices.slice(i * 3, i * 3 + 3)), key = p.map(v => Math.round(v / epsilon)).join(':');
      if (!welded.has(key)) { welded.set(key, vertices.length); vertices.push(p); }
      return welded.get(key);
    });
    for (let i = 0; i < g.Faces.length; i += 3) {
      const source = Array.from(g.Faces.slice(i, i + 3)), corners = source.map(v => ids[v]);
      if (new Set(corners).size < 3) continue;
      faces.push({ id: nextFaceId++, vertices: corners, triangles: [{ vertices: corners, uv: source.flatMap(v => Array.from(g.TVertices[0].slice(v * 2, v * 2 + 2))), normals: source.flatMap(v => Array.from(g.Normals.slice(v * 3, v * 3 + 3))) }] });
    }
  }
  const shape = { id, name, texturePath, vertices, faces, nextFaceId };
  // Recognize rectangular pairs as selectable sides, retaining both triangles
  // and their original UVs. Do not dissolve grid cells or curved surfaces.
  const adjacency = new Map(), used = new Set(), pairs = new Map();
  for (const face of faces) for (let k = 0; k < 3; k++) {
    const key = forgeEdgeKey(face.vertices[k], face.vertices[(k + 1) % 3]);
    if (!adjacency.has(key)) adjacency.set(key, []); adjacency.get(key).push(face);
  }
  for (const pair of adjacency.values()) {
    if (pair.length !== 2 || pair.some(f => used.has(f.id))) continue;
    const [a, b] = pair;
    if (dot(forgeFaceNormal(shape, a), forgeFaceNormal(shape, b)) < 1 - 1e-6) continue;
    const edges = boundaryEdges(pair), loop = edges.length === 4 ? [edges[0][0]] : [];
    for (let k = 0; k < 4 && loop.length; k++) { const edge = edges.find(e => e[0] === loop.at(-1)); if (!edge) break; loop.push(edge[1]); }
    if (loop.length !== 5 || loop[0] !== loop[4] || new Set(loop.slice(0, 4)).size !== 4) continue;
    loop.pop();
    if (loop.some((v, i) => Math.abs(dot(unit(sub(vertices[loop[(i + 3) % 4]], vertices[v])), unit(sub(vertices[loop[(i + 1) % 4]], vertices[v])))) > 1e-5)) continue;
    // Uniform-color regions (Thumper's eyes/armor) keep their own boundaries.
    const uniform = f => f.triangles[0].uv.every((v, i, uv) => Math.abs(v - uv[i % 2]) < 1e-6);
    if ((uniform(a) || uniform(b)) && a.triangles[0].uv.some((v, i) => Math.abs(v - b.triangles[0].uv[i]) > 1e-6)) continue;
    used.add(a.id); used.add(b.id); pairs.set(a.id, { ...a, vertices: loop, triangles: [...a.triangles, ...b.triangles] });
  }
  shape.faces = faces.flatMap(f => pairs.has(f.id) ? [pairs.get(f.id)] : used.has(f.id) ? [] : [f]);
  // Circular caps are triangle fans. Present a connected planar fan as one
  // face while retaining its interior vertices and original triangle UVs.
  const remaining = new Map(shape.faces.filter(f => f.vertices.length === 3).map(f => [f.id, f])), visited = new Set(), fans = new Map(), merged = new Set();
  for (const seed of remaining.values()) {
    if (visited.has(seed.id)) continue;
    const component = [], queue = [seed], normal = forgeFaceNormal(shape, seed);
    while (queue.length) {
      const face = queue.pop(); if (visited.has(face.id)) continue; visited.add(face.id); component.push(face);
      for (let k = 0; k < 3; k++) for (const neighbor of adjacency.get(forgeEdgeKey(face.vertices[k], face.vertices[(k + 1) % 3])) || []) {
        if (!remaining.has(neighbor.id) || visited.has(neighbor.id) || dot(normal, forgeFaceNormal(shape, neighbor)) < 1 - 1e-6) continue;
        const constant = f => f.triangles[0].uv.every((v, i, uv) => Math.abs(v - uv[i % 2]) < 1e-6);
        if ((constant(seed) || constant(neighbor)) && seed.triangles[0].uv.some((v, i) => Math.abs(v - neighbor.triangles[0].uv[i]) > 1e-6)) continue;
        queue.push(neighbor);
      }
    }
    if (component.length < 2) continue;
    const edges = boundaryEdges(component), loop = edges.length ? [edges[0][0]] : [];
    for (let k = 0; k < edges.length && loop.length; k++) { const edge = edges.find(e => e[0] === loop.at(-1)); if (!edge) break; loop.push(edge[1]); if (edge[1] === loop[0]) break; }
    if (loop.length !== edges.length + 1 || loop[0] !== loop.at(-1) || new Set(loop.slice(0, -1)).size !== edges.length) continue;
    loop.pop(); component.forEach(f => merged.add(f.id)); fans.set(seed.id, { ...seed, vertices: loop, triangles: component.flatMap(f => f.triangles) });
  }
  shape.faces = shape.faces.flatMap(f => fans.has(f.id) ? [fans.get(f.id)] : merged.has(f.id) ? [] : [f]);
  return shape;
}

export function forgeShapeEdges(shape) {
  const edges = new Map();
  for (const face of shape.faces) for (let i = 0; i < face.vertices.length; i++) {
    const a = face.vertices[i], b = face.vertices[(i + 1) % face.vertices.length]; edges.set(forgeEdgeKey(a, b), [a, b]);
  }
  return edges;
}

export function forgeSelectionVertices(shape, selected = [], mode = 'Faces') {
  if (!selected.length) return [];
  if (mode === 'Vertices') return selected.filter(id => Number.isInteger(id) && shape.vertices[id]);
  if (mode === 'Shape') return [...new Set(shape.faces.flatMap(f => f.triangles.flatMap(t => t.vertices)))];
  if (mode === 'Edges') { const edges = forgeShapeEdges(shape); return [...new Set(selected.flatMap(key => edges.get(key) || []))]; }
  return [...new Set(shape.faces.filter(f => selected.includes(f.id)).flatMap(f => f.triangles.flatMap(t => t.vertices)))];
}

export function forgeSelectionCenter(shapes, selection, mode) {
  const points = shapes.flatMap(s => forgeSelectionVertices(s, selection[s.id], mode).map(id => s.vertices[id]));
  return points.length ? mul(points.reduce(add, [0, 0, 0]), 1 / points.length) : [0, 0, 0];
}

export function forgeSelectionNormal(shapes, selection) {
  return unit(shapes.reduce((n, s) => add(n, s.faces.filter(f => selection[s.id]?.includes(f.id)).reduce((v, f) => add(v, forgeFaceNormal(s, f)), [0, 0, 0])), [0, 0, 0]));
}

function quad(shape, ids) {
  return { id: shape.nextFaceId++, vertices: ids, triangles: [[ids[0], ids[1], ids[2]], [ids[0], ids[2], ids[3]]].map(vertices => ({ vertices, uv: [...TRIANGLE_ICON_UV] })) };
}

function detachedCap(source, selected) {
  const shape = structuredClone(source), faces = shape.faces.filter(f => selected.includes(f.id)), edges = boundaryEdges(faces), copies = new Map();
  if (!faces.length) throw Error('Select faces to extend.');
  if (!edges.length) throw Error('Select an open region of faces to extend.');
  for (const id of new Set(faces.flatMap(f => f.triangles.flatMap(t => t.vertices)))) { copies.set(id, shape.vertices.length); shape.vertices.push([...shape.vertices[id]]); }
  for (const face of faces) {
    face.vertices = face.vertices.map(id => copies.get(id));
    face.triangles = face.triangles.map(t => ({ ...t, normals: undefined, vertices: t.vertices.map(id => copies.get(id)) }));
  }
  for (const [a, b] of edges) shape.faces.push(quad(shape, [a, b, copies.get(b), copies.get(a)]));
  return { shape, copies, edges };
}

export function extrudeForgeFaces(source, selected, translation) {
  if (translation.some(v => !Number.isFinite(v))) throw Error('Use a finite extrusion distance.');
  if (Math.hypot(...translation) < 1e-8) return source;
  const { shape, copies } = detachedCap(source, selected);
  for (const id of copies.values()) shape.vertices[id] = add(shape.vertices[id], translation);
  return shape;
}

export function insetForgeFaces(source, selected, distance) {
  if (!Number.isFinite(distance)) throw Error('Use a finite inset distance.');
  if (Math.abs(distance) < 1e-8) return source;
  const faces = source.faces.filter(f => selected.includes(f.id)), normal = forgeSelectionNormal([source], { [source.id]: selected });
  if (!faces.length || Math.hypot(...normal) < .5) throw Error('Select a flat region of faces to inset.');
  const origin = source.vertices[faces[0].vertices[0]], extent = Math.max(1, ...source.vertices.map(p => Math.hypot(...sub(p, origin))));
  if (faces.some(f => f.vertices.some(id => Math.abs(dot(sub(source.vertices[id], origin), normal)) > extent * 1e-5) || dot(forgeFaceNormal(source, f), normal) < .99999)) throw Error('Inset needs faces on the same plane.');
  const { shape, copies, edges } = detachedCap(source, selected), incoming = new Map(), outgoing = new Map();
  for (const [a, b] of edges) {
    if (outgoing.has(a) || incoming.has(b)) throw Error('Select a face region with a continuous border.');
    outgoing.set(a, b); incoming.set(b, a);
  }
  for (const [a, b] of edges) {
    const before = incoming.get(a); if (before === undefined) throw Error('Select a face region with a closed border.');
    const n1 = unit(cross(normal, sub(source.vertices[a], source.vertices[before]))), n2 = unit(cross(normal, sub(source.vertices[b], source.vertices[a]))), denominator = 1 + dot(n1, n2);
    if (denominator < 1e-7) throw Error('This border cannot be inset.');
    shape.vertices[copies.get(a)] = add(source.vertices[a], mul(add(n1, n2), distance / denominator));
  }
  // A large inset must not reverse/collapse its border or create bow ties.
  const horizontal = unit(sub(source.vertices[edges[0][1]], source.vertices[edges[0][0]])), vertical = cross(normal, horizontal);
  const projected = ids => ids.map(id => { const p = sub(shape.vertices[id], origin); return new Vector2(dot(p, horizontal), dot(p, vertical)); });
  for (const [a, b] of edges) if (dot(sub(shape.vertices[copies.get(b)], shape.vertices[copies.get(a)]), sub(source.vertices[b], source.vertices[a])) <= 1e-8) throw Error('Inset is too wide for the selected faces.');
  for (const face of shape.faces.filter(f => selected.includes(f.id))) if (!ShapeUtils.triangulateShape(projected(face.vertices), []).length) throw Error('Inset is too wide for the selected faces.');
  return shape;
}

export function transformForgeSelection(source, selected, mode, { translation = [0, 0, 0], scale = [1, 1, 1], quaternion = [0, 0, 0, 1], center = [0, 0, 0] } = {}) {
  if ([...translation, ...scale, ...quaternion, ...center].some(v => !Number.isFinite(v)) || scale.some(v => v <= 1e-5)) throw Error('Use finite transforms and a positive scale.');
  if (Math.hypot(...translation) < 1e-8 && scale.every(v => Math.abs(v - 1) < 1e-8) && Math.hypot(...quaternion.slice(0, 3)) < 1e-8) return source;
  const shape = structuredClone(source), ids = new Set(forgeSelectionVertices(shape, selected, mode)), [qx, qy, qz, qw] = quaternion;
  for (const id of ids) {
    const p = sub(shape.vertices[id], center).map((v, i) => v * scale[i]), q = [qx, qy, qz], uv = cross(q, p), uuv = cross(q, uv);
    shape.vertices[id] = add(add(add(p, mul(uv, 2 * qw)), mul(uuv, 2)), add(center, translation));
  }
  for (const face of shape.faces) if (face.vertices.some(id => ids.has(id))) face.triangles.forEach(t => { t.normals = undefined; });
  return shape;
}

export function forgeShapeMesh(shape) {
  const vertices = [], normals = [], uv = [], faceIds = [], vertexIds = [];
  for (const face of shape.faces) for (const t of face.triangles) {
    const n = unit(triangleNormal(shape, t.vertices));
    for (let k = 0; k < 3; k++) { vertices.push(...shape.vertices[t.vertices[k]]); vertexIds.push(t.vertices[k]); normals.push(...(t.normals?.slice(k * 3, k * 3 + 3) || n)); uv.push(...t.uv.slice(k * 2, k * 2 + 2)); }
    faceIds.push(face.id);
  }
  if (vertices.length / 3 > 65536) throw Error('This shape exceeds Warcraft III’s vertex limit.');
  const g = { Vertices: new Float32Array(vertices), Normals: new Float32Array(normals), TVertices: [new Float32Array(uv)], Faces: Uint16Array.from({ length: vertices.length / 3 }, (_, i) => i) };
  return { geosets: [g], vertexCount: vertices.length / 3, triangleCount: faceIds.length, faceIds, vertexIds };
}
