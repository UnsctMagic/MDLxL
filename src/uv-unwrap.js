// UV Wrapper Box Projection, Cylinder Projection and Unwrap (docs/agent-tasks/uv-new-tools.md).
// Each works on whole selected triangles of the UV Wrapper's combined canvas and returns one UV per
// triangle corner. splitUVCorners then gives a point a copy only where its corners need two UV spots.
import { copyVertexAttribute } from './uv-tools.js';

const finiteIndex = value => Number.isSafeInteger(value) && value >= 0;
/** Corner UVs closer than this are one UV spot. */
const SAME_SPOT = 1e-6;
const VIEW_ERROR = 'Rotate the live preview before projecting.';
const PROJECT_ERROR = 'The selected vertices cannot be projected from this view.';
export const WHOLE_TRIANGLE_ERROR = 'Select all three vertices of at least one triangle.';
/** Uncouple's own wording (owner's note: same error as Uncouple). */
export const POINT_LIMIT_ERROR = 'UV uncoupling would exceed the 65536-vertex geoset limit. Split the geoset first.';
const STRUCTURE_ERROR = 'The UV map changed structure before the edit could be applied.';
const POINT_LIMIT = 65536;

const transform4 = (matrix, vector) => [0, 1, 2, 3].map(row => matrix[row] * vector[0] + matrix[4 + row] * vector[1] + matrix[8 + row] * vector[2] + matrix[12 + row] * vector[3]);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const length = a => Math.hypot(a[0], a[1], a[2]);
const position = (geoset, index) => [geoset.Vertices[index * 3], geoset.Vertices[index * 3 + 1], geoset.Vertices[index * 3 + 2]];

/** Combined-canvas corner offsets of the triangles whose three corners are all selected. */
export function wholeSelectedTriangles(faces, indices) {
  const selected = new Set(Array.from(indices || []).filter(finiteIndex)), triangles = [];
  for (let corner = 0; corner + 2 < (faces?.length || 0); corner += 3)
    if (selected.has(faces[corner]) && selected.has(faces[corner + 1]) && selected.has(faces[corner + 2])) triangles.push(corner);
  return triangles;
}

/** The live preview's view as Project from Current View reads it: view-space positions plus the UV
 * per view unit along screen right (`su`) and screen up (`sv`, V grows downward). */
function viewSpace(geoset, points, viewMatrix, projectionMatrix) {
  if (![viewMatrix, projectionMatrix].every(matrix => matrix?.length === 16 && Array.from(matrix).every(Number.isFinite))) throw Error(VIEW_ERROR);
  const view = new Map(), low = [Infinity, Infinity, Infinity], high = [-Infinity, -Infinity, -Infinity];
  for (const index of points) {
    const p = transform4(viewMatrix, [...position(geoset, index), 1]).slice(0, 3);
    view.set(index, p);
    for (let axis = 0; axis < 3; axis++) { low[axis] = Math.min(low[axis], p[axis]); high[axis] = Math.max(high[axis], p[axis]); }
  }
  const centre = [0, 1, 2].map(axis => (low[axis] + high[axis]) / 2);
  const screen = p => { const clip = transform4(projectionMatrix, [...p, 1]); if (!Number.isFinite(clip[3]) || Math.abs(clip[3]) < 1e-8) throw Error(PROJECT_ERROR); return [(clip[0] / clip[3] + 1) / 2, (1 - clip[1] / clip[3]) / 2]; };
  const origin = screen(centre), su = screen([centre[0] + 1, centre[1], centre[2]])[0] - origin[0], sv = origin[1] - screen([centre[0], centre[1] + 1, centre[2]])[1];
  if (!(Number.isFinite(su) && Number.isFinite(sv) && su > 0 && sv > 0)) throw Error(PROJECT_ERROR);
  return { view, low, high, centre, su, sv, pfcv: p => screen(p) };
}

function trianglePoints(faces, triangles) {
  const points = new Set();
  for (const corner of triangles) for (let k = 0; k < 3; k++) points.add(faces[corner + k]);
  return [...points];
}

function startTriangles(geoset, indices) {
  const faces = geoset?.Faces, count = (geoset?.Vertices?.length || 0) / 3;
  const valid = Array.from(indices || []).filter(index => finiteIndex(index) && index < count);
  const triangles = wholeSelectedTriangles(faces, valid);
  if (!triangles.length) throw Error(WHOLE_TRIANGLE_ERROR);
  return { faces, triangles, points: trianglePoints(faces, triangles) };
}

/** Same anchoring as Project from Current View: the result's centre (each point and copy once)
 * lands on the current UV centre of the points it changes. */
function anchor(faces, corners, points, source) {
  const sourceCentre = [0, 0];
  for (const index of points) { sourceCentre[0] += source[index * 2] / points.length; sourceCentre[1] += source[index * 2 + 1] / points.length; }
  const spots = [];
  for (const [, groups] of groupCorners(faces, corners)) for (const group of groups) spots.push(group);
  const resultCentre = [0, 0];
  for (const spot of spots) { resultCentre[0] += spot.u / spots.length; resultCentre[1] += spot.v / spots.length; }
  const du = sourceCentre[0] - resultCentre[0], dv = sourceCentre[1] - resultCentre[1];
  for (const uv of corners.values()) { uv[0] += du; uv[1] += dv; }
  return corners;
}

// One corner's UV per point and spot; `corners` is a Map corner → [u, v].
function groupCorners(faces, corners) {
  const byPoint = new Map();
  for (const [corner, [u, v]] of corners) {
    const point = faces[corner];
    let groups = byPoint.get(point); if (!groups) byPoint.set(point, groups = []);
    let group = groups.find(item => Math.abs(item.u - u) <= SAME_SPOT && Math.abs(item.v - v) <= SAME_SPOT);
    if (!group) groups.push(group = { u, v, corners: [] });
    group.corners.push(corner);
  }
  return byPoint;
}

// Box sides in view space: [axis, sign]. Each side is laid out as seen from outside the box,
// unfolded around the front: right, then back to its right, left before it, top above, bottom below.
const SIDES = [[2, 1, 'front'], [2, -1, 'back'], [0, 1, 'right'], [0, -1, 'left'], [1, 1, 'top'], [1, -1, 'bottom']];
function boxLayout(side, p, low, high) {
  const [x0, y0, z0] = low, [x1, y1, z1] = high, [x, y, z] = p;
  if (side === 'right') return [x1 + (z1 - z), y];
  if (side === 'back') return [x1 + (z1 - z0) + (x1 - x), y];
  if (side === 'left') return [x0 - (z1 - z), y];
  if (side === 'top') return [x, y1 + (z1 - z)];
  if (side === 'bottom') return [x, y0 - (z1 - z)];
  return [x, y];
}

/** Box Projection. Each whole selected triangle goes to the side of the live preview's view its
 * normal points to most and is projected flat from that side at Project from Current View's scale.
 * Returns Map corner → [u, v] on the combined canvas. */
export function boxProjectUVCorners(geoset, indices, viewMatrix, projectionMatrix, source = geoset?.TVertices?.[0]) {
  const { faces, triangles, points } = startTriangles(geoset, indices);
  const space = viewSpace(geoset, points, viewMatrix, projectionMatrix), corners = new Map();
  for (const corner of triangles) {
    const p = [0, 1, 2].map(k => space.view.get(faces[corner + k])), normal = cross(sub(p[1], p[0]), sub(p[2], p[0]));
    let best = SIDES[0], strength = -Infinity;
    for (const side of SIDES) { const value = normal[side[0]] * side[1]; if (value > strength + 1e-12) { strength = value; best = side; } }
    for (let k = 0; k < 3; k++) {
      const [X, Y] = boxLayout(best[2], p[k], space.low, space.high);
      corners.set(corner + k, [space.su * X, -space.sv * Y]);
    }
  }
  return anchor(faces, corners, points, source);
}

/** Cylinder Projection. The axis is the live preview's screen vertical through the centre of the
 * selected points; U is the angle around it times the average radius, V the height, both at Project
 * from Current View's scale. Front is in the middle and the seam directly behind; a triangle across
 * the seam keeps its corners on one side. */
export function cylinderProjectUVCorners(geoset, indices, viewMatrix, projectionMatrix, source = geoset?.TVertices?.[0]) {
  const { faces, triangles, points } = startTriangles(geoset, indices);
  const space = viewSpace(geoset, points, viewMatrix, projectionMatrix), corners = new Map();
  const [cx, , cz] = space.centre, polar = new Map();
  let radius = 0;
  for (const index of points) {
    const [x, , z] = space.view.get(index), dx = x - cx, dz = z - cz, r = Math.hypot(dx, dz);
    polar.set(index, { angle: Math.atan2(dx, dz), r }); radius += r / points.length;
  }
  const near = Math.max(radius, 1e-9) * 1e-9;
  for (const corner of triangles) {
    const ids = [0, 1, 2].map(k => faces[corner + k]), angles = ids.map(id => polar.get(id).angle), round = ids.map(id => polar.get(id).r > near);
    const known = angles.filter((_, k) => round[k]);
    if (known.length && Math.max(...known) - Math.min(...known) > Math.PI) for (let k = 0; k < 3; k++) if (angles[k] < 0) angles[k] += 2 * Math.PI;
    // A point on the axis has no angle of its own: it takes its triangle's.
    const middle = known.length ? angles.filter((_, k) => round[k]).reduce((sum, value) => sum + value, 0) / known.length : 0;
    for (let k = 0; k < 3; k++) {
      const angle = round[k] ? angles[k] : middle, y = space.view.get(ids[k])[1];
      corners.set(corner + k, [space.su * angle * radius, -space.sv * y]);
    }
  }
  return anchor(faces, corners, points, source);
}

// ---------------------------------------------------------------------------------------------
// Unwrap: least-squares conformal maps (Lévy et al. 2002) per connected piece.

/** Sparse symmetric system for one piece, solved by preconditioned conjugate gradients. */
function lscm(nodes, triangles, positions, pins) {
  const n = nodes.length, local = new Map(nodes.map((node, index) => [node, index]));
  const pinned = new Map(pins.map(([node, u, v]) => [local.get(node), [u, v]]));
  const free = [], slot = new Int32Array(n).fill(-1);
  for (let i = 0; i < n; i++) if (!pinned.has(i)) { slot[i] = free.length; free.push(i); }
  const size = free.length * 2, rows = Array.from({ length: size }, () => new Map()), rhs = new Float64Array(size);
  const add = (row, column, value) => rows[row].set(column, (rows[row].get(column) || 0) + value);
  for (const [a, b, c] of triangles) {
    const p = [a, b, c].map(node => positions.get(node)), e1 = sub(p[1], p[0]), e3 = sub(p[2], p[0]);
    const normal = cross(e1, e3), twice = length(normal);
    if (!(twice > 0)) continue;
    const x1 = length(e1), axis = e1.map(value => value / x1), side = cross(normal, axis).map(value => value / twice);
    // The mirrored second axis gives the UV the orientation Project from Current View gives a front face.
    const z = [[0, 0], [x1, 0], [dot(e3, axis), -dot(e3, side)]], scale = 1 / Math.sqrt(twice);
    const w = [0, 1, 2].map(j => { const next = z[(j + 2) % 3], previous = z[(j + 1) % 3]; return [(next[0] - previous[0]) * scale, (next[1] - previous[1]) * scale]; });
    const ids = [a, b, c].map(node => local.get(node));
    // Two rows of the least-squares matrix: real and imaginary part of sum W_j U_j.
    for (const part of [0, 1]) {
      const coefficients = [];
      for (let j = 0; j < 3; j++) {
        const [re, im] = w[j];
        coefficients.push([ids[j], 0, part ? im : re], [ids[j], 1, part ? re : -im]);
      }
      let constant = 0;
      const variables = [];
      for (const [node, axisIndex, value] of coefficients) {
        if (pinned.has(node)) constant += value * pinned.get(node)[axisIndex];
        else variables.push([slot[node] * 2 + axisIndex, value]);
      }
      for (const [row, a1] of variables) {
        rhs[row] -= a1 * constant;
        for (const [column, a2] of variables) add(row, column, a1 * a2);
      }
    }
  }
  const index = [], value = [], start = new Int32Array(size + 1), diagonal = new Float64Array(size);
  for (let row = 0; row < size; row++) {
    start[row] = index.length;
    for (const [column, entry] of rows[row]) { index.push(column); value.push(entry); if (column === row) diagonal[row] = entry; }
  }
  start[size] = index.length;
  const columns = Int32Array.from(index), entries = Float64Array.from(value);
  const multiply = (vector, output) => { for (let row = 0; row < size; row++) { let sum = 0; for (let k = start[row]; k < start[row + 1]; k++) sum += entries[k] * vector[columns[k]]; output[row] = sum; } };
  const x = new Float64Array(size), r = Float64Array.from(rhs), z = new Float64Array(size), p = new Float64Array(size), q = new Float64Array(size);
  const precondition = () => { for (let i = 0; i < size; i++) z[i] = diagonal[i] > 0 ? r[i] / diagonal[i] : r[i]; };
  precondition(); p.set(z);
  let rz = 0; for (let i = 0; i < size; i++) rz += r[i] * z[i];
  const target = Math.max(1e-30, rhs.reduce((sum, entry) => sum + entry * entry, 0) * 1e-24);
  for (let iteration = 0; iteration < Math.max(200, size * 4); iteration++) {
    let rr = 0; for (let i = 0; i < size; i++) rr += r[i] * r[i];
    if (rr <= target) break;
    multiply(p, q);
    let pq = 0; for (let i = 0; i < size; i++) pq += p[i] * q[i];
    if (!(pq > 0)) break;
    const alpha = rz / pq;
    for (let i = 0; i < size; i++) { x[i] += alpha * p[i]; r[i] -= alpha * q[i]; }
    precondition();
    let next = 0; for (let i = 0; i < size; i++) next += r[i] * z[i];
    const beta = next / rz; rz = next;
    for (let i = 0; i < size; i++) p[i] = z[i] + beta * p[i];
  }
  const result = new Map();
  for (let i = 0; i < n; i++) result.set(nodes[i], pinned.has(i) ? pinned.get(i).slice() : [x[slot[i] * 2], x[slot[i] * 2 + 1]]);
  return result;
}

const edgeKey = (a, b, count) => a < b ? a * count + b : b * count + a;

/** Edge-connected groups of triangles (indices into `triangles`). */
function edgeComponents(triangles, count) {
  const parent = triangles.map((_, index) => index), find = i => { while (parent[i] !== i) i = parent[i] = parent[parent[i]]; return i; };
  const owner = new Map();
  triangles.forEach((triangle, index) => {
    for (let k = 0; k < 3; k++) {
      const key = edgeKey(triangle[k], triangle[(k + 1) % 3], count), first = owner.get(key);
      if (first === undefined) owner.set(key, index); else parent[find(index)] = find(first);
    }
  });
  const groups = new Map();
  triangles.forEach((_, index) => { const root = find(index); if (!groups.has(root)) groups.set(root, []); groups.get(root).push(index); });
  return [...groups.values()];
}

function edgeUses(triangles, members, count) {
  const uses = new Map();
  for (const index of members) { const t = triangles[index]; for (let k = 0; k < 3; k++) { const key = edgeKey(t[k], t[(k + 1) % 3], count); uses.set(key, (uses.get(key) || 0) + 1); } }
  return uses;
}

function farthestPair(nodes, positions) {
  const list = [...nodes];
  if (list.length < 2) return list.length ? [list[0], list[0]] : null;
  let best = [list[0], list[1]], distance = -1;
  if (list.length <= 3000) {
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const d = length(sub(positions.get(list[i]), positions.get(list[j])));
      if (d > distance) { distance = d; best = [list[i], list[j]]; }
    }
    return best;
  }
  const far = from => list.reduce((pick, node) => length(sub(positions.get(node), positions.get(from))) > length(sub(positions.get(pick), positions.get(from))) ? node : pick, from);
  const a = far(list[0]); return [a, far(a)];
}

/** One flattened piece in Project-from-Current-View screen units (X right, Y down, view units):
 * conformal shape, 3D area, rotated (never mirrored) to best match the same points' projection and
 * centred where that projection puts them. */
function flattenPiece(triangles, members, positions, screen, count) {
  const pieceTriangles = members.map(index => triangles[index]), nodes = [...new Set(pieceTriangles.flat())];
  const uses = edgeUses(triangles, members, count), boundary = new Set();
  for (const t of pieceTriangles) for (let k = 0; k < 3; k++) if (uses.get(edgeKey(t[k], t[(k + 1) % 3], count)) === 1) { boundary.add(t[k]); boundary.add(t[(k + 1) % 3]); }
  const [first, second] = farthestPair(boundary.size >= 2 ? boundary : nodes, positions);
  const span = length(sub(positions.get(first), positions.get(second))) || 1;
  const flat = lscm(nodes, pieceTriangles, positions, first === second ? [[first, 0, 0]] : [[first, 0, 0], [second, span, 0]]);
  let area3d = 0, area2d = 0;
  for (const [a, b, c] of pieceTriangles) {
    area3d += length(cross(sub(positions.get(b), positions.get(a)), sub(positions.get(c), positions.get(a)))) / 2;
    const [pa, pb, pc] = [a, b, c].map(node => flat.get(node));
    area2d += Math.abs((pb[0] - pa[0]) * (pc[1] - pa[1]) - (pb[1] - pa[1]) * (pc[0] - pa[0])) / 2;
  }
  const scale = area2d > 0 ? Math.sqrt(area3d / area2d) : 1;
  const centre = (map, list) => { const c = [0, 0]; for (const node of list) { const p = map(node); c[0] += p[0] / list.length; c[1] += p[1] / list.length; } return c; };
  const flatCentre = centre(node => flat.get(node), nodes), screenCentre = centre(screen, nodes);
  let along = 0, across = 0;
  for (const node of nodes) {
    const a = flat.get(node), b = screen(node), ax = (a[0] - flatCentre[0]) * scale, ay = (a[1] - flatCentre[1]) * scale, bx = b[0] - screenCentre[0], by = b[1] - screenCentre[1];
    along += ax * bx + ay * by; across += ax * by - ay * bx;
  }
  const angle = along || across ? Math.atan2(across, along) : 0, cos = Math.cos(angle), sin = Math.sin(angle), placed = new Map();
  for (const node of nodes) {
    const a = flat.get(node), ax = (a[0] - flatCentre[0]) * scale, ay = (a[1] - flatCentre[1]) * scale;
    placed.set(node, [screenCentre[0] + ax * cos - ay * sin, screenCentre[1] + ax * sin + ay * cos]);
  }
  return placed;
}

const bounds = layouts => {
  let low = Infinity, high = -Infinity;
  for (const layout of layouts) for (const [x] of layout.values()) { low = Math.min(low, x); high = Math.max(high, x); }
  return [low, high];
};

/** Unwrap. Whole selected triangles, joined through shared 3D positions, are flattened per piece
 * with LSCM. A piece without an open edge is cut along its outline in the live preview: triangles
 * facing the viewer, then the rest laid to their right with a 5% gap. Returns Map corner → [u, v]. */
export function unwrapUVCorners(geoset, indices, viewMatrix, projectionMatrix, source = geoset?.TVertices?.[0]) {
  const { faces, triangles: starts, points } = startTriangles(geoset, indices);
  const space = viewSpace(geoset, points, viewMatrix, projectionMatrix);
  // Points at one 3D position are one node, so UV splits and hard edges do not cut a piece.
  const nodeOf = new Map(), positions = new Map(), viewOf = new Map(), byPosition = new Map();
  for (const index of points) {
    const p = position(geoset, index), key = p.join(',');
    let node = byPosition.get(key);
    if (node === undefined) { node = byPosition.size; byPosition.set(key, node); positions.set(node, p); viewOf.set(node, space.view.get(index)); }
    nodeOf.set(index, node);
  }
  const count = byPosition.size + 1, solid = [], solidStarts = [], flatStarts = [];
  for (const corner of starts) {
    const triangle = [0, 1, 2].map(k => nodeOf.get(faces[corner + k]));
    const [a, b, c] = triangle.map(node => positions.get(node));
    if (new Set(triangle).size === 3 && length(cross(sub(b, a), sub(c, a))) > 0) { solid.push(triangle); solidStarts.push(corner); }
    else flatStarts.push(corner);
  }
  const screen = node => { const p = viewOf.get(node); return [p[0], -p[1]]; };
  const facing = triangle => { const [a, b, c] = triangle.map(node => viewOf.get(node)); return cross(sub(b, a), sub(c, a))[2] > 0; };
  // One sheet: an open edge and a single outline loop. LSCM lays a sheet flat; a tube or a piece
  // with holes needs a cut first.
  const sheet = (list, members) => {
    const uses = edgeUses(list, members, count), parent = new Map(), find = node => { while (parent.get(node) !== node) { parent.set(node, parent.get(parent.get(node))); node = parent.get(node); } return node; };
    for (const index of members) for (let k = 0; k < 3; k++) {
      const a = list[index][k], b = list[index][(k + 1) % 3];
      if (uses.get(edgeKey(a, b, count)) !== 1) continue;
      for (const node of [a, b]) if (!parent.has(node)) parent.set(node, node);
      parent.set(find(a), find(b));
    }
    return parent.size > 0 && new Set([...parent.keys()].map(find)).size === 1;
  };
  const flipped = (list, members, placed) => members.some(index => { const [a, b, c] = list[index].map(node => placed.get(node)); return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) > 0; });
  const side = triangle => { const [a, b, c] = triangle.map(node => viewOf.get(node)), normal = cross(sub(b, a), sub(c, a)); let best = 0; SIDES.forEach(([axis, sign], index) => { if (normal[axis] * sign > normal[SIDES[best][0]] * SIDES[best][1] + 1e-12) best = index; }); return best; };
  // A part of a cut that still is not a sheet, or still folds over, is cut once more by the box
  // side its triangles face (as in Box Projection); each of those pieces is laid flat on its own.
  const layPart = (list, members, last) => {
    if (sheet(list, members) || last) {
      const placed = flattenPiece(list, members, positions, screen, count);
      if (last || !flipped(list, members, placed)) return [{ members, placed }];
    }
    const groups = new Map();
    for (const index of members) { const key = side(list[index]); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(index); }
    return [...groups.values()].flatMap(group => {
      const local = group.map(index => list[index]);
      return edgeComponents(local, count).flatMap(part => layPart(local, part, true).map(item => ({ members: item.members.map(i => group[i]), placed: item.placed })));
    });
  };
  const layoutOf = new Map(); // solid triangle index → its piece's placed nodes
  for (const members of edgeComponents(solid, count)) {
    if (sheet(solid, members)) {
      const placed = flattenPiece(solid, members, positions, screen, count);
      if (!flipped(solid, members, placed)) { for (const index of members) layoutOf.set(index, placed); continue; }
    }
    // Closed, a tube or a piece LSCM folds over: cut along the outline seen from the live preview.
    const parts = [members.filter(index => facing(solid[index])), members.filter(index => !facing(solid[index]))].map(part => {
      if (!part.length) return [];
      const local = part.map(index => solid[index]);
      return edgeComponents(local, count).flatMap(group => layPart(local, group, false).map(item => ({ members: item.members.map(i => part[i]), placed: item.placed })));
    });
    const [front, back] = parts;
    if (front.length && back.length) {
      const [frontLow, frontHigh] = bounds(front.map(item => item.placed)), [backLow] = bounds(back.map(item => item.placed));
      const shift = frontHigh + (frontHigh - frontLow) * .05 - backLow;
      for (const item of back) for (const p of item.placed.values()) p[0] += shift;
    }
    for (const item of [...front, ...back]) for (const index of item.members) layoutOf.set(index, item.placed);
  }
  const corners = new Map();
  solidStarts.forEach((corner, index) => {
    const placed = layoutOf.get(index);
    for (let k = 0; k < 3; k++) { const [X, Y] = placed.get(solid[index][k]); corners.set(corner + k, [space.su * X, space.sv * Y]); }
  });
  // A flat triangle has no shape of its own: its corners join a placed neighbour at the same node.
  const nodeUV = new Map();
  for (const [corner, uv] of corners) { const node = nodeOf.get(faces[corner]); if (!nodeUV.has(node)) nodeUV.set(node, uv); }
  for (const corner of flatStarts) for (let k = 0; k < 3; k++) {
    const node = nodeOf.get(faces[corner + k]), uv = nodeUV.get(node), [X, Y] = screen(node);
    corners.set(corner + k, uv ? uv.slice() : [space.su * X, space.sv * Y]);
  }
  return anchor(faces, corners, points, source);
}

// ---------------------------------------------------------------------------------------------
// Committing corner UVs to the model.

/** Corner UVs of the combined canvas, per original geoset: [{ geosetIndex, uvSet, corners: [[corner, point, u, v]] }]. */
export function planUVCorners(combined, corners) {
  const plans = new Map(), faces = combined.geoset.Faces;
  for (const [corner, [u, v]] of corners) {
    const ref = combined.refs[faces[corner]], start = combined.faceStarts?.[ref?.geosetIndex];
    if (!ref || !Number.isInteger(start)) throw Error(STRUCTURE_ERROR);
    if (!plans.has(ref.geosetIndex)) plans.set(ref.geosetIndex, { geosetIndex: ref.geosetIndex, uvSet: ref.uvSet, corners: [] });
    plans.get(ref.geosetIndex).corners.push([corner - start, ref.vertexIndex, u, v]);
  }
  return [...plans.values()];
}

function groupGeosetCorners(faces, corners) {
  const map = new Map();
  for (const [corner, point, u, v] of corners) {
    if (!finiteIndex(corner) || faces?.[corner] !== point) throw Error(STRUCTURE_ERROR);
    map.set(corner, [u, v]);
  }
  return groupCorners(faces, map);
}

/** How many point copies splitUVCorners would add. */
export function uvCornerCopies(geoset, corners) {
  let copies = 0;
  for (const groups of groupGeosetCorners(geoset?.Faces, corners).values()) copies += groups.length - 1;
  return copies;
}

/** Give each listed corner its UV. A point whose corners need several UV spots keeps the first and
 * gets a copy (every point attribute copied, as Uncouple does) for each other spot, so the 3D model
 * is unchanged. Returns the created copies. */
export function splitUVCorners(geoset, uvSet, corners) {
  const count = geoset?.Vertices?.length / 3, uv = geoset?.TVertices?.[uvSet];
  if (!Number.isInteger(count) || uv?.length !== count * 2) throw Error(STRUCTURE_ERROR);
  const byPoint = groupGeosetCorners(geoset.Faces, corners), sources = Array.from({ length: count }, (_, index) => index);
  const faces = new Uint32Array(geoset.Faces), assignments = [], created = [];
  for (const [point, groups] of byPoint) {
    assignments.push([point, groups[0].u, groups[0].v]);
    for (const group of groups.slice(1)) {
      if (sources.length >= POINT_LIMIT) throw Error(POINT_LIMIT_ERROR);
      const copy = sources.length;
      sources.push(point); created.push(copy); assignments.push([copy, group.u, group.v]);
      for (const corner of group.corners) faces[corner] = copy;
    }
  }
  if (created.length) {
    geoset.Vertices = copyVertexAttribute(geoset.Vertices, sources, 3);
    geoset.Normals = copyVertexAttribute(geoset.Normals, sources, 3);
    geoset.VertexGroup = copyVertexAttribute(geoset.VertexGroup, sources, 1);
    geoset.TVertices = (geoset.TVertices || []).map(values => copyVertexAttribute(values, sources, 2));
    if (geoset.Tangents?.length) geoset.Tangents = copyVertexAttribute(geoset.Tangents, sources, 4);
    if (geoset.SkinWeights?.length) geoset.SkinWeights = copyVertexAttribute(geoset.SkinWeights, sources, 8);
    geoset.Faces = new Uint16Array(faces);
  } else geoset.TVertices[uvSet] = new Float32Array(uv);
  const target = geoset.TVertices[uvSet];
  for (const [index, u, v] of assignments) {
    if (![u, v].every(value => Number.isFinite(value) && Number.isFinite(Math.fround(value)))) throw Error('UV coordinates must be finite.');
    target[index * 2] = u; target[index * 2 + 1] = v;
  }
  return { added: created.length, created };
}
