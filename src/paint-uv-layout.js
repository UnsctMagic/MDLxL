// Layout for New base coat. Reads like a layout an artist would draw: whole
// pieces that stay joined, cut at real edges, upright, packed large to small.
// Edit the texture never comes here; the skin's own UVs stay as they are.
import { applyAtlasToGeoset, packCharts, trianglesOverlap } from './paint-uv-atlas.js';

const EPSILON = 1e-9;
/** Normals further apart than this always stay in separate pieces. */
const HARD_EDGE_COSINE = Math.cos(90 * Math.PI / 180);
/** A piece may turn this far from its average facing before it is cut. */
const CONE_COSINE = Math.cos(90 * Math.PI / 180);
/** Largest accepted one-way distortion of a flattened triangle. */
const MAX_STRETCH = 3;
/** Share of a piece's surface allowed to exceed MAX_STRETCH. */
const STRETCH_ALLOWANCE = .04;
/** Mirror matching tolerance, as a share of the model's largest dimension. */
const MIRROR_TOLERANCE = .004;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const length = a => Math.hypot(a[0], a[1], a[2]);
const point = (values, index) => [values[index * 3], values[index * 3 + 1], values[index * 3 + 2]];

/** Faces and their surroundings. Authored UV seams duplicate vertices, so faces
 * are joined by position; the source layout never decides where pieces end. */
function meshOf(geoset, geosetIndex) {
  const faceCount = geoset.Faces.length / 3, ids = new Map(), welded = new Int32Array(geoset.Vertices.length / 3), positions = [];
  for (let vertex = 0; vertex < welded.length; vertex++) {
    const p = point(geoset.Vertices, vertex), key = `${p[0].toFixed(3)},${p[1].toFixed(3)},${p[2].toFixed(3)}`;
    let id = ids.get(key); if (id === undefined) { id = positions.length; ids.set(key, id); positions.push(p); }
    welded[vertex] = id;
  }
  const faces = []; let outward = 0;
  for (let face = 0; face < faceCount; face++) {
    const corners = [Number(geoset.Faces[face * 3]), Number(geoset.Faces[face * 3 + 1]), Number(geoset.Faces[face * 3 + 2])], w = corners.map(v => welded[v]);
    const product = cross(sub(positions[w[1]], positions[w[0]]), sub(positions[w[2]], positions[w[0]])), size = length(product);
    faces.push({ id: face, corners, welded: w, normal: size > EPSILON ? product.map(v => v / size) : [0, 0, 1], area: size / 2, links: [] });
    if (geoset.Normals?.length) for (const v of corners) outward += dot([geoset.Normals[v * 3], geoset.Normals[v * 3 + 1], geoset.Normals[v * 3 + 2]], product);
  }
  const edges = new Map();
  for (const face of faces) for (let side = 0; side < 3; side++) {
    const a = face.welded[side], b = face.welded[(side + 1) % 3]; if (a === b) continue;
    const key = a < b ? `${a}:${b}` : `${b}:${a}`; let list = edges.get(key); if (!list) edges.set(key, list = []);
    list.push({ face, a, b });
  }
  for (const list of edges.values()) {
    // Two-sided sheets put four faces on one edge. Join only faces that run the
    // edge in opposite directions, closest facing first, so a sheet's two sides
    // never fold together.
    const pairs = [];
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (list[i].a === list[j].b) pairs.push([dot(list[i].face.normal, list[j].face.normal), i, j]);
    pairs.sort((x, y) => y[0] - x[0]);
    const used = new Set();
    for (const [cosine, i, j] of pairs) {
      if (used.has(i) || used.has(j)) continue; used.add(i); used.add(j);
      const size = length(sub(positions[list[i].a], positions[list[i].b]));
      list[i].face.links.push({ face: list[j].face, cosine, size }); list[j].face.links.push({ face: list[i].face, cosine, size });
    }
  }
  // Winding differs between tools; the authored normals say which side is out.
  return { geoset, geosetIndex, positions, faces, flip: outward < 0 };
}

function averageNormal(faces) {
  const sum = [0, 0, 0]; for (const face of faces) for (let axis = 0; axis < 3; axis++) sum[axis] += face.normal[axis] * Math.max(face.area, EPSILON);
  const size = length(sum); return size > EPSILON ? sum.map(v => v / size) : faces[0].normal;
}

/** Grow pieces from the largest faces. A piece stops at a hard edge or when it
 * has turned too far from where it started facing. */
function growPieces(faces) {
  const unassigned = new Set(faces), order = [...faces].sort((a, b) => b.area - a.area || a.id - b.id), pieces = [];
  for (const seed of order) {
    if (!unassigned.has(seed)) continue;
    const piece = [seed], frontier = new Set(); unassigned.delete(seed);
    const sum = seed.normal.map(v => v * Math.max(seed.area, EPSILON));
    const openNeighbours = face => { for (const link of face.links) if (unassigned.has(link.face) && link.cosine >= HARD_EDGE_COSINE) frontier.add(link.face); };
    openNeighbours(seed);
    while (frontier.size) {
      const size = length(sum), mean = sum.map(v => v / (size || 1));
      let best = null, bestScore = -Infinity;
      for (const face of frontier) {
        const facing = dot(face.normal, mean);
        if (facing < CONE_COSINE) continue;
        let joined = 0, around = 0;
        for (const link of face.links) { around += link.size; if (piece.includes(link.face)) joined += link.size; }
        const score = facing + .35 * joined / Math.max(around, EPSILON);
        if (score > bestScore || (score === bestScore && face.id < best.id)) { best = face; bestScore = score; }
      }
      if (!best) break;
      frontier.delete(best); unassigned.delete(best); piece.push(best);
      for (let axis = 0; axis < 3; axis++) sum[axis] += best.normal[axis] * Math.max(best.area, EPSILON);
      openNeighbours(best);
    }
    pieces.push(piece);
  }
  return pieces;
}

/** Least-squares conformal flattening, seeded with a flat projection. */
function flatten(mesh, faces) {
  const normal = averageNormal(faces), helper = Math.abs(normal[2]) < .9 ? [0, 0, 1] : [1, 0, 0];
  const right = cross(helper, normal), rightSize = length(right), axisU = right.map(v => v / (rightSize || 1)), axisV = cross(normal, axisU);
  const index = new Map(), ids = [];
  for (const face of faces) for (const id of face.welded) if (!index.has(id)) { index.set(id, ids.length); ids.push(id); }
  const count = ids.length, solution = new Float64Array(count * 2);
  ids.forEach((id, i) => { solution[i * 2] = dot(mesh.positions[id], axisU); solution[i * 2 + 1] = dot(mesh.positions[id], axisV); });
  let pinA = 0, pinB = 0, far = -1;
  for (let i = 0; i < count; i++) for (let j = i + 1; j < count; j++) { const d = (solution[i * 2] - solution[j * 2]) ** 2 + (solution[i * 2 + 1] - solution[j * 2 + 1]) ** 2; if (d > far) { far = d; pinA = i; pinB = j; } }
  if (count > 3 && faces.length > 1) {
    const rows = [];
    for (const face of faces) {
      if (face.area < EPSILON || new Set(face.welded).size < 3) continue;
      const a = sub(mesh.positions[face.welded[1]], mesh.positions[face.welded[0]]), b = sub(mesh.positions[face.welded[2]], mesh.positions[face.welded[0]]);
      const ex = a.map(v => v / length(a)), ey = cross(face.normal, ex), z = [[0, 0], [length(a), 0], [dot(b, ex), dot(b, ey)]], weight = 1 / Math.sqrt(2 * face.area);
      rows.push({ v: face.welded.map(id => index.get(id)), wr: [0, 1, 2].map(j => (z[(j + 2) % 3][0] - z[(j + 1) % 3][0]) * weight), wi: [0, 1, 2].map(j => (z[(j + 2) % 3][1] - z[(j + 1) % 3][1]) * weight) });
    }
    const pinned = new Uint8Array(count * 2); pinned[pinA * 2] = pinned[pinA * 2 + 1] = pinned[pinB * 2] = pinned[pinB * 2 + 1] = 1;
    const apply = (x, out) => {
      out.fill(0);
      for (const { v, wr, wi } of rows) {
        let re = 0, im = 0;
        for (let j = 0; j < 3; j++) { re += wr[j] * x[v[j] * 2] - wi[j] * x[v[j] * 2 + 1]; im += wi[j] * x[v[j] * 2] + wr[j] * x[v[j] * 2 + 1]; }
        for (let j = 0; j < 3; j++) { out[v[j] * 2] += wr[j] * re + wi[j] * im; out[v[j] * 2 + 1] += wr[j] * im - wi[j] * re; }
      }
    };
    const size = count * 2, ax = new Float64Array(size), residual = new Float64Array(size), direction = new Float64Array(size), aDirection = new Float64Array(size);
    apply(solution, ax);
    let rr = 0; for (let i = 0; i < size; i++) { residual[i] = pinned[i] ? 0 : -ax[i]; direction[i] = residual[i]; rr += residual[i] ** 2; }
    const start = rr || 1;
    for (let step = 0; step < Math.min(4000, size * 6) && rr > start * 1e-14 && rr > 1e-18; step++) {
      apply(direction, aDirection);
      let dAd = 0; for (let i = 0; i < size; i++) { if (pinned[i]) aDirection[i] = 0; dAd += direction[i] * aDirection[i]; }
      if (Math.abs(dAd) < 1e-30) break;
      const alpha = rr / dAd; let next = 0;
      for (let i = 0; i < size; i++) { solution[i] += alpha * direction[i]; residual[i] -= alpha * aDirection[i]; next += residual[i] ** 2; }
      const beta = next / rr; rr = next;
      for (let i = 0; i < size; i++) direction[i] = residual[i] + beta * direction[i];
    }
  }
  return placeUpright(mesh, faces, ids, index, solution, normal);
}

/** Same scale everywhere, seen from outside, with the model's up as image up. */
function placeUpright(mesh, faces, ids, index, solution, normal) {
  let flatArea = 0, worldArea = 0;
  for (const face of faces) {
    const [a, b, c] = face.welded.map(id => index.get(id));
    flatArea += (solution[b * 2] - solution[a * 2]) * (solution[c * 2 + 1] - solution[a * 2 + 1]) - (solution[c * 2] - solution[a * 2]) * (solution[b * 2 + 1] - solution[a * 2 + 1]);
    worldArea += face.area;
  }
  flatArea /= 2;
  const reversed = flatArea < 0, scale = Math.sqrt(worldArea / Math.max(Math.abs(flatArea), EPSILON));
  const flat = ids.map((_, i) => [solution[i * 2] * scale * (mesh.flip ? -1 : 1), solution[i * 2 + 1] * scale * (reversed ? -1 : 1)]);
  const centre = flat.reduce((sum, p) => [sum[0] + p[0] / flat.length, sum[1] + p[1] / flat.length], [0, 0]);
  const gradient = axis => {
    const mean = ids.reduce((sum, id) => sum + mesh.positions[id][axis] / ids.length, 0);
    let xx = 0, xy = 0, yy = 0, xz = 0, yz = 0;
    flat.forEach((p, i) => { const x = p[0] - centre[0], y = p[1] - centre[1], z = mesh.positions[ids[i]][axis] - mean; xx += x * x; xy += x * y; yy += y * y; xz += x * z; yz += y * z; });
    const det = xx * yy - xy * xy; if (Math.abs(det) < EPSILON) return [0, 0];
    return [(yy * xz - xy * yz) / det, (xx * yz - xy * xz) / det];
  };
  // Parts lying flat have no up; their forward edge goes to the top instead.
  let up = gradient(2); if (Math.hypot(up[0], up[1]) < .35) up = gradient(0);
  const size = Math.hypot(up[0], up[1]) || 1, ux = up[0] / size || 0, uy = size === 1 && !up[0] && !up[1] ? 1 : up[1] / size;
  const coordinates = new Map(), pointsByWeld = new Map();
  ids.forEach((id, i) => {
    const x = flat[i][0] - centre[0], y = flat[i][1] - centre[1];
    // Rotate up onto +flat Y, then store image coordinates (Y runs down).
    pointsByWeld.set(id, [x * uy - y * ux, -(x * ux + y * uy)]);
  });
  squareUp(pointsByWeld);
  const triangles = [];
  let minU = Infinity, minV = Infinity, maxU = -Infinity, maxV = -Infinity;
  for (const face of faces) {
    triangles.push(face.welded.map(id => pointsByWeld.get(id)));
    for (const vertex of face.corners) if (!coordinates.has(vertex)) coordinates.set(vertex, pointsByWeld.get(face.welded[face.corners.indexOf(vertex)]));
  }
  for (const p of pointsByWeld.values()) { minU = Math.min(minU, p[0]); minV = Math.min(minV, p[1]); maxU = Math.max(maxU, p[0]); maxV = Math.max(maxV, p[1]); }
  return { geosetIndex: mesh.geosetIndex, faces: faces.map(face => face.id), pieceFaces: faces, flip: mesh.flip, coordinates, triangles, minU, minV, width: Math.max(EPSILON, maxU - minU), height: Math.max(EPSILON, maxV - minV), projection: -1, normal };
}

/** Turn a piece that is nearly square to the image the rest of the way, so
 * boxy parts sit straight and pack tightly. Up stays within 30 degrees. */
function squareUp(points) {
  const all = [...points.values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (all.length < 3) return;
  const turn = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), chain = list => { const out = []; for (const p of list) { while (out.length > 1 && turn(out.at(-2), out.at(-1), p) <= 0) out.pop(); out.push(p); } out.pop(); return out; };
  const hull = [...chain(all), ...chain([...all].reverse())];
  let bestAngle = 0, bestArea = Infinity;
  const measure = angle => { const c = Math.cos(angle), s = Math.sin(angle); let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const p of hull) { const x = p[0] * c - p[1] * s, y = p[0] * s + p[1] * c; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return (x1 - x0) * (y1 - y0); };
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i], b = hull[(i + 1) % hull.length]; let angle = -Math.atan2(b[1] - a[1], b[0] - a[0]);
    while (angle > Math.PI / 4) angle -= Math.PI / 2; while (angle < -Math.PI / 4) angle += Math.PI / 2;
    if (Math.abs(angle) > Math.PI / 6) continue;
    const area = measure(angle); if (area < bestArea - EPSILON) { bestArea = area; bestAngle = angle; }
  }
  if (!bestAngle || bestArea >= measure(0)) return;
  const c = Math.cos(bestAngle), s = Math.sin(bestAngle);
  for (const p of points.values()) { const x = p[0] * c - p[1] * s, y = p[0] * s + p[1] * c; p[0] = x; p[1] = y; }
}

function acceptable(chart) {
  const faces = chart.pieceFaces; let over = 0, total = 0;
  for (let i = 0; i < faces.length; i++) {
    const face = faces[i], [a, b, c] = chart.triangles[i], signed = ((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2;
    if (face.area < EPSILON) continue;
    total += face.area;
    // Image Y runs down, so a correctly facing triangle is negative here.
    if ((chart.flip ? -signed : signed) > face.area * 1e-3) return false;
    const stretch = triangleStretch(face, chart.triangles[i]);
    if (stretch > MAX_STRETCH) over += face.area;
  }
  if (over > total * STRETCH_ALLOWANCE) return false;
  return !selfOverlaps(chart);
}
function triangleStretch(face, flat) {
  // Singular values of the map from the triangle's own plane to the image.
  const [p, q, r] = flat, e1 = face.edge1, e2 = face.edge2;
  const det = e1[0] * e2[1] - e1[1] * e2[0]; if (Math.abs(det) < EPSILON) return 1;
  const d1 = [q[0] - p[0], q[1] - p[1]], d2 = [r[0] - p[0], r[1] - p[1]];
  const a = (d1[0] * e2[1] - d2[0] * e1[1]) / det, c = (d2[0] * e1[0] - d1[0] * e2[0]) / det, b = (d1[1] * e2[1] - d2[1] * e1[1]) / det, d = (d2[1] * e1[0] - d1[1] * e2[0]) / det;
  const E = a * a + b * b, G = c * c + d * d, F = a * c + b * d, root = Math.sqrt((E - G) ** 2 + 4 * F * F), high = Math.sqrt((E + G + root) / 2), low = Math.sqrt(Math.max(0, (E + G - root) / 2));
  return low > 1e-6 ? high / low : Infinity;
}
function selfOverlaps(chart) {
  const triangles = chart.triangles, cell = Math.max(chart.width, chart.height) / Math.max(4, Math.ceil(Math.sqrt(triangles.length))) || 1, grid = new Map();
  const seen = new Set();
  for (let i = 0; i < triangles.length; i++) {
    const t = triangles[i], x0 = Math.floor(Math.min(t[0][0], t[1][0], t[2][0]) / cell), x1 = Math.floor(Math.max(t[0][0], t[1][0], t[2][0]) / cell), y0 = Math.floor(Math.min(t[0][1], t[1][1], t[2][1]) / cell), y1 = Math.floor(Math.max(t[0][1], t[1][1], t[2][1]) / cell);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const key = `${x}:${y}`; let bucket = grid.get(key); if (!bucket) grid.set(key, bucket = []);
      for (const j of bucket) { const pair = j * triangles.length + i; if (seen.has(pair)) continue; seen.add(pair); if (trianglesOverlap(triangles[j], t)) return true; }
      bucket.push(i);
    }
  }
  return false;
}

function connectedParts(faces) {
  const inside = new Set(faces), parts = [];
  while (inside.size) {
    const first = inside.values().next().value, part = [first], queue = [first]; inside.delete(first);
    while (queue.length) for (const link of queue.pop().links) if (inside.has(link.face)) { inside.delete(link.face); part.push(link.face); queue.push(link.face); }
    parts.push(part);
  }
  return parts;
}

/** Split a piece that will not lie flat along the widest change in facing. */
function splitPiece(faces) {
  let first = faces[0], second = faces[0], lowest = Infinity;
  for (const a of faces) for (const b of faces) { const cosine = dot(a.normal, b.normal); if (cosine < lowest) { lowest = cosine; first = a; second = b; } }
  if (first === second) { const half = faces.length >> 1; return [faces.slice(0, half), faces.slice(half)]; }
  let meanA = first.normal, meanB = second.normal, groupA = [first], groupB = [second];
  for (let round = 0; round < 3; round++) {
    groupA = []; groupB = [];
    for (const face of faces) (dot(face.normal, meanA) >= dot(face.normal, meanB) ? groupA : groupB).push(face);
    if (!groupA.length || !groupB.length) { const half = faces.length >> 1; return [faces.slice(0, half), faces.slice(half)]; }
    meanA = averageNormal(groupA); meanB = averageNormal(groupB);
  }
  return [...connectedParts(groupA), ...connectedParts(groupB)];
}

function chartsOf(mesh, faces) {
  if (faces.length === 1) return [flatten(mesh, faces)];
  const chart = flatten(mesh, faces);
  if (acceptable(chart)) return [chart];
  return splitPiece(faces).flatMap(part => chartsOf(mesh, part));
}

/** Fold small leftovers into the neighbour they share most edge with, when the
 * result still lies flat. This removes most of the confetti growth leaves. */
function absorbSmall(mesh, charts) {
  const owner = new Map(); charts.forEach(chart => chart.pieceFaces.forEach(face => owner.set(face, chart)));
  const areaOf = chart => chart.pieceFaces.reduce((sum, face) => sum + face.area, 0);
  const total = charts.reduce((sum, chart) => sum + areaOf(chart), 0);
  const alive = new Set(charts);
  for (const chart of [...charts].sort((a, b) => areaOf(a) - areaOf(b))) {
    if (!alive.has(chart) || (chart.pieceFaces.length > 6 && areaOf(chart) > total * .02)) continue;
    const shared = new Map();
    for (const face of chart.pieceFaces) for (const link of face.links) {
      const other = owner.get(link.face); if (!other || other === chart) continue;
      shared.set(other, (shared.get(other) || 0) + link.size * (link.cosine >= HARD_EDGE_COSINE ? 1 : .15));
    }
    for (const [other] of [...shared].sort((a, b) => b[1] - a[1])) {
      const merged = flatten(mesh, [...other.pieceFaces, ...chart.pieceFaces]);
      if (!acceptable(merged)) continue;
      alive.delete(chart); alive.delete(other); alive.add(merged);
      merged.pieceFaces.forEach(face => owner.set(face, merged));
      break;
    }
  }
  return [...alive];
}

function prepareFaces(mesh) {
  for (const face of mesh.faces) {
    const a = sub(mesh.positions[face.welded[1]], mesh.positions[face.welded[0]]), b = sub(mesh.positions[face.welded[2]], mesh.positions[face.welded[0]]), size = length(a) || 1, ex = a.map(v => v / size), ey = cross(face.normal, ex);
    face.edge1 = [size, 0]; face.edge2 = [dot(b, ex), dot(b, ey)];
  }
}

/** For each face, the face that mirrors it across the model's left/right plane. */
function mirrorPartners(mesh, tolerance) {
  const key = p => `${Math.round(p[0] / tolerance)},${Math.round(p[1] / tolerance)},${Math.round(p[2] / tolerance)}`;
  const grid = new Map();
  mesh.positions.forEach((p, id) => { const k = key(p); grid.set(k, [...(grid.get(k) || []), id]); });
  const mirrorOf = mesh.positions.map(p => {
    const q = [p[0], -p[1], p[2]], base = q.map(v => Math.round(v / tolerance));
    let best = -1, bestDistance = tolerance * tolerance * 3;
    for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) for (const id of grid.get(`${base[0] + x},${base[1] + y},${base[2] + z}`) || []) {
      const d = sub(mesh.positions[id], q), squared = dot(d, d); if (squared <= bestDistance) { bestDistance = squared; best = id; }
    }
    return best;
  });
  const byCorners = new Map(); for (const face of mesh.faces) byCorners.set([...face.welded].sort((a, b) => a - b).join(':'), face);
  const partners = new Map();
  for (const face of mesh.faces) {
    const corners = face.welded.map(id => mirrorOf[id]); if (corners.includes(-1)) continue;
    const other = byCorners.get([...corners].sort((a, b) => a - b).join(':')); if (other) partners.set(face, { face: other, map: new Map(face.welded.map((id, i) => [id, corners[i]])) });
  }
  return partners;
}

function mirrorCopy(mesh, chart, partners) {
  const coordinates = new Map(), faces = [];
  for (const face of chart.pieceFaces) {
    const partner = partners.get(face); faces.push(partner.face.id);
    face.corners.forEach((vertex, corner) => {
      const flatPoint = chart.coordinates.get(vertex), weldedTarget = partner.map.get(face.welded[corner]);
      partner.face.corners.forEach((other, otherCorner) => { if (partner.face.welded[otherCorner] === weldedTarget) coordinates.set(other, flatPoint); });
    });
  }
  return { ...chart, faces, coordinates, sharedWith: chart, pieceFaces: undefined };
}

function layoutMesh(mesh, mirror, tolerance) {
  prepareFaces(mesh);
  let working = mesh.faces, partners = null;
  const copies = [];
  if (mirror) {
    partners = mirrorPartners(mesh, tolerance);
    // Unwrap one side only. The other side reads the same pixels through its
    // partner faces, so the centre line needs no seam.
    const centroidY = face => (mesh.positions[face.welded[0]][1] + mesh.positions[face.welded[1]][1] + mesh.positions[face.welded[2]][1]) / 3;
    working = mesh.faces.filter(face => {
      const partner = partners.get(face);
      if (!partner || partner.face === face) { partners.delete(face); return true; }
      const mine = centroidY(face), theirs = centroidY(partner.face);
      if (mine === theirs) { partners.delete(face); return true; }
      return mine > theirs;
    });
  }
  const allowed = new Set(working);
  if (mirror) for (const face of working) face.links = face.links.filter(link => allowed.has(link.face));
  const pieces = connectedParts(working).flatMap(part => growPieces(part));
  const charts = absorbSmall(mesh, pieces.flatMap(faces => chartsOf(mesh, faces)));
  if (mirror) for (const chart of charts) {
    const paired = chart.pieceFaces.filter(face => partners.has(face));
    if (paired.length === chart.pieceFaces.length) copies.push(mirrorCopy(mesh, chart, partners));
    else if (paired.length) {
      // A piece touching unpaired geometry keeps its own pixels; its partner
      // faces get a separate unwrap so no triangle is ever left without UVs.
      const leftover = paired.map(face => partners.get(face).face), leftoverSet = new Set(leftover);
      for (const face of leftover) face.links = face.links.filter(link => leftoverSet.has(link.face));
      for (const part of connectedParts(leftover)) for (const faces of growPieces(part)) charts.push(...chartsOf(mesh, faces));
    }
  }
  return { charts, copies };
}

function largestDimension(model, indices) {
  let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const index of indices) { const v = model.Geosets[index].Vertices; for (let i = 0; i < v.length; i += 3) for (let axis = 0; axis < 3; axis++) { lo[axis] = Math.min(lo[axis], v[i + axis]); hi[axis] = Math.max(hi[axis], v[i + axis]); } }
  return Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2], 1);
}

/** Glows and shockwaves blend over the game, and corpse gore only shows briefly;
 * the unit itself should get the pixels. Filter modes alone cannot tell: some
 * units draw their whole body with an additive-alpha layer, so size counts too. */
function roomFor(model, geoset) {
  const layers = model.Materials?.[geoset.MaterialID]?.Layers || [];
  const image = layer => typeof layer.TextureID === 'number' ? model.Textures?.[layer.TextureID]?.Image || '' : '';
  if (layers.length && geoset.Faces.length <= 24 && layers.every(layer => Number(layer.FilterMode) >= 3)) return .25;
  if (layers.length && layers.every(layer => /gutz/i.test(image(layer)))) return .35;
  return 1;
}
function shrink(chart, share) {
  const seen = new Set();
  for (const point of chart.coordinates.values()) { if (seen.has(point)) continue; seen.add(point); point[0] *= share; point[1] *= share; }
  chart.minU *= share; chart.minV *= share; chart.width *= share; chart.height *= share;
}

/** Build the New base coat layout. `mirror` lets left and right share pixels. */
export function createPaintLayout(model, geosetIndices, resolution = 512, { mirror = false } = {}) {
  if (![256, 512, 1024, 2048].includes(Number(resolution))) throw Error('Fresh paint textures must be 256, 512, 1024 or 2048 pixels.');
  const indices = [...new Set(geosetIndices)].sort((a, b) => a - b), charts = [], copies = [], tolerance = largestDimension(model, indices) * MIRROR_TOLERANCE;
  for (const index of indices) {
    const geoset = model?.Geosets?.[index];
    if (!geoset?.Vertices?.length || !geoset?.Faces?.length) throw Error(`Geoset ${index + 1} has no paintable triangles.`);
    const result = layoutMesh(meshOf(geoset, index), mirror, tolerance), share = roomFor(model, geoset);
    if (share !== 1) { result.charts.forEach(chart => shrink(chart, share)); for (const copy of result.copies) Object.assign(copy, { minU: copy.sharedWith.minU, minV: copy.sharedWith.minV, width: copy.sharedWith.width, height: copy.sharedWith.height }); }
    charts.push(...result.charts); copies.push(...result.copies);
  }
  if (!charts.length) throw Error('This model has no paintable triangles.');
  // Wide gutters keep pieces apart once the game shrinks the texture. Fall back
  // to a narrow one only when a very detailed model would lose real resolution.
  const wide = Math.max(2, Math.round(resolution / 128)), packedNarrow = packCharts(charts, resolution, 1, { upright: true }), packedWide = packCharts(charts, resolution, wide, { upright: true });
  const useWide = packedWide.scale >= packedNarrow.scale * .9, packed = useWide ? packedWide : packedNarrow, padding = useWide ? wide : 1;
  for (const copy of copies) packed.placements.set(copy, packed.placements.get(copy.sharedWith));
  const all = [...charts, ...copies], Geosets = [...model.Geosets], coordIds = {}, byGeoset = new Map(); let addedVertices = 0;
  for (const chart of all) { let list = byGeoset.get(chart.geosetIndex); if (!list) byGeoset.set(chart.geosetIndex, list = []); list.push(chart); }
  for (const index of indices) { const result = applyAtlasToGeoset(model.Geosets[index], byGeoset.get(index), packed, resolution, padding); Geosets[index] = result.geoset; coordIds[index] = result.coordId; addedVertices += result.addedVertices; }
  return { model: { ...model, Geosets }, coordIds, chartCount: charts.length, sharedCharts: copies.length, addedVertices, padding };
}
