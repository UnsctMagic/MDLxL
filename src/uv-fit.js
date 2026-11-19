// UV Wrapper Fit: the selected triangles' UVs moved into an area marked on the texture (a polygon,
// a lasso or a magic-wand outline). Nothing is unwrapped and nothing is cut: the layout that is on
// the texture now is the start, and only its points move. Points on one UV spot count as one point,
// so what touches now still touches afterwards. Separate pieces keep their shape and are arranged
// in the area at one size per real surface. A single joined piece is placed the same way and then
// bent until it fills the area, every move checked so that no triangle turns over and nothing
// leaves the area.
import { WHOLE_TRIANGLE_ERROR, wholeSelectedTriangles } from './uv-unwrap.js';

export const AREA_ERROR = 'Mark an area with at least three corners.';
export const AREA_CROSSING_ERROR = "The area's outline crosses itself. Mark it again.";

const sub2 = (a, b) => [a[0] - b[0], a[1] - b[1]];
const cross2 = (a, b) => a[0] * b[1] - a[1] * b[0];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
/** Shoelace sum (x right, y down): positive runs clockwise on screen. */
const signedArea = polygon => { let sum = 0; for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) sum += polygon[j][0] * polygon[i][1] - polygon[i][0] * polygon[j][1]; return sum / 2; };
const insidePolygon = (polygon, x, y) => {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit;
  }
  return hit;
};
const segmentDistance = (p, a, b) => {
  const d = sub2(b, a), l = d[0] * d[0] + d[1] * d[1], t = l > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1]) / l)) : 0;
  return dist(p, [a[0] + d[0] * t, a[1] + d[1] * t]);
};
const segmentsCross = (a, b, c, d) => {
  const o1 = cross2(sub2(b, a), sub2(c, a)), o2 = cross2(sub2(b, a), sub2(d, a)), o3 = cross2(sub2(d, c), sub2(a, c)), o4 = cross2(sub2(d, c), sub2(b, c));
  return o1 * o2 < 0 && o3 * o4 < 0;
};

/** Douglas–Peucker on a closed outline. */
function simplifyClosed(points, tolerance) {
  if (points.length <= 8) return points;
  let far = 0; for (let i = 1; i < points.length; i++) if (dist(points[i], points[0]) > dist(points[far], points[0])) far = i;
  const keep = new Uint8Array(points.length); keep[0] = keep[far] = 1;
  const run = (from, to) => {
    const stack = [[from, to]];
    while (stack.length) {
      const [i, j] = stack.pop(); let best = -1, most = tolerance;
      for (let k = i + 1; k < j; k++) { const d = segmentDistance(points[k % points.length], points[i % points.length], points[j % points.length]); if (d > most) { most = d; best = k; } }
      if (best >= 0) { keep[best % points.length] = 1; stack.push([i, best], [best, j]); }
    }
  };
  run(0, far); run(far, points.length);
  return points.filter((_, i) => keep[i]);
}

/** The marked outline as a clean polygon: repeated points removed, very long lassos simplified,
 * never crossing itself. Points are [x, y] in any one unit (the caller's working space). */
export function cleanArea(points) {
  let polygon = [];
  const all = (points || []).map(p => Array.isArray(p) ? [+p[0], +p[1]] : [+p.x, +p.y]).filter(p => p.every(Number.isFinite));
  let low = [Infinity, Infinity], high = [-Infinity, -Infinity];
  for (const p of all) { low = [Math.min(low[0], p[0]), Math.min(low[1], p[1])]; high = [Math.max(high[0], p[0]), Math.max(high[1], p[1])]; }
  const span = Math.hypot(high[0] - low[0], high[1] - low[1]);
  if (!(span > 0)) throw Error(AREA_ERROR);
  for (const p of all) if (!polygon.length || dist(p, polygon[polygon.length - 1]) > span * 1e-6) polygon.push(p);
  while (polygon.length > 1 && dist(polygon[0], polygon[polygon.length - 1]) <= span * 1e-6) polygon.pop();
  if (polygon.length > 256) polygon = simplifyClosed(polygon, span * .0005);
  if (polygon.length < 3) throw Error(AREA_ERROR);
  for (let i = 0; i < polygon.length; i++) for (let j = i + 2; j < polygon.length; j++) {
    if (i === 0 && j === polygon.length - 1) continue;
    if (segmentsCross(polygon[i], polygon[(i + 1) % polygon.length], polygon[j], polygon[(j + 1) % polygon.length])) throw Error(AREA_CROSSING_ERROR);
  }
  if (Math.abs(signedArea(polygon)) <= span * span * 1e-6) throw Error(AREA_ERROR);
  return signedArea(polygon) < 0 ? polygon.reverse() : polygon;
}

/** Outer outline of the largest patch of a mask (> 127 is in), holes filled, in pixel-corner
 * coordinates (0 to width, 0 to height), simplified within 0.7 pixel. Null when the mask is empty. */
export function maskOutline(mask, width, height) {
  const inside = index => mask[index] > 127, component = new Int32Array(width * height).fill(-1);
  let best = -1, bestSize = 0, label = 0;
  const queue = new Int32Array(width * height);
  for (let start = 0; start < width * height; start++) {
    if (!inside(start) || component[start] >= 0) continue;
    let head = 0, tail = 0, size = 0; queue[tail++] = start; component[start] = label;
    while (head < tail) {
      const p = queue[head++], x = p % width; size++;
      for (const q of [x > 0 ? p - 1 : -1, x + 1 < width ? p + 1 : -1, p >= width ? p - width : -1, p + width < width * height ? p + width : -1])
        if (q >= 0 && inside(q) && component[q] < 0) { component[q] = label; queue[tail++] = q; }
    }
    if (size > bestSize) { bestSize = size; best = label; }
    label++;
  }
  if (best < 0) return null;
  // Everything the outside cannot reach belongs to the patch (holes filled).
  const outside = new Uint8Array((width + 2) * (height + 2)), W = width + 2, H = height + 2, filled = p => { const x = p % W - 1, y = Math.floor(p / W) - 1; return x >= 0 && y >= 0 && x < width && y < height && component[y * width + x] === best; };
  let head = 0, tail = 0; queue[0] = 0; const wide = new Int32Array(W * H); wide[tail++] = 0; outside[0] = 1;
  while (head < tail) {
    const p = wide[head++], x = p % W;
    for (const q of [x > 0 ? p - 1 : -1, x + 1 < W ? p + 1 : -1, p >= W ? p - W : -1, p + W < W * H ? p + W : -1])
      if (q >= 0 && !outside[q] && !filled(q)) { outside[q] = 1; wide[tail++] = q; }
  }
  const isIn = (x, y) => x >= 0 && y >= 0 && x < width && y < height && !outside[(y + 1) * W + x + 1];
  // Pixel edges with the patch on their right (x right, y down), walked into one loop.
  const next = new Map(), key = (x, y) => y * (width + 1) + x, add = (x, y, to) => { const k = key(x, y); if (!next.has(k)) next.set(k, []); next.get(k).push(to); };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (!isIn(x, y)) continue;
    if (!isIn(x, y - 1)) add(x, y, [x + 1, y]);
    if (!isIn(x + 1, y)) add(x + 1, y, [x + 1, y + 1]);
    if (!isIn(x, y + 1)) add(x + 1, y + 1, [x, y + 1]);
    if (!isIn(x - 1, y)) add(x, y + 1, [x, y]);
  }
  // Start on the topmost row (that loop is the outer outline). Where the outline touches itself at a
  // corner it turns towards the patch, so the walk stays one loop.
  let start = null;
  for (let y = 0; y < height && !start; y++) for (let x = 0; x < width && !start; x++) if (isIn(x, y)) start = [x, y];
  const loop = [start], used = new Set();
  for (let guard = 0; guard < 4 * (width + 1) * (height + 1); guard++) {
    const here = loop[loop.length - 1], previous = loop[loop.length - 2] || [here[0] - 1, here[1]], heading = sub2(here, previous);
    const options = (next.get(key(here[0], here[1])) || []).filter(to => !used.has(key(here[0], here[1]) + '>' + key(to[0], to[1])));
    if (!options.length) break;
    const step = options.reduce((best, to) => cross2(heading, sub2(to, here)) > cross2(heading, sub2(best, here)) ? to : best);
    used.add(key(here[0], here[1]) + '>' + key(step[0], step[1]));
    if (step[0] === start[0] && step[1] === start[1]) break;
    loop.push(step);
  }
  return simplifyClosed(loop, .7);
}

// ---------------------------------------------------------------------------------------------
// Pieces: what is selected, as it lies on the texture now.

const TURN = Math.PI / 12;
const transform4 = (m, v) => [0, 1, 2, 3].map(row => m[row] * v[0] + m[4 + row] * v[1] + m[8 + row] * v[2] + m[12 + row] * v[3]);
const validMatrix = m => m?.length === 16 && Array.from(m).every(Number.isFinite);
function pointTriangleDistance(px, py, ax, ay, bx, by, cx, cy) {
  const d1 = (bx - ax) * (py - ay) - (by - ay) * (px - ax), d2 = (cx - bx) * (py - by) - (cy - by) * (px - bx), d3 = (ax - cx) * (py - cy) - (ay - cy) * (px - cx);
  if ((d1 >= 0 && d2 >= 0 && d3 >= 0) || (d1 <= 0 && d2 <= 0 && d3 <= 0)) { if (d1 || d2 || d3) return 0; }
  const p = [px, py];
  return Math.min(segmentDistance(p, [ax, ay], [bx, by]), segmentDistance(p, [bx, by], [cx, cy]), segmentDistance(p, [cx, cy], [ax, ay]));
}

/** The selected triangles once each (a two-sided face drawn twice counts once), split into islands:
 * triangles joined through shared points. `xy` holds every point's starting spot in working space.
 * A triangle is [point, point, point, and the three geoset points its real shape is read from]. */
function islandsOf(tris, xy, geoset) {
  const P = geoset.Vertices, parent = new Map();
  const find = i => { let r = i; while (parent.get(r) !== r) r = parent.get(r); while (parent.get(i) !== r) { const n = parent.get(i); parent.set(i, r); i = n; } return r; };
  for (const t of tris) { for (let k = 0; k < 3; k++) if (!parent.has(t[k])) parent.set(t[k], t[k]); parent.set(find(t[0]), find(t[1])); parent.set(find(t[0]), find(t[2])); }
  const byRoot = new Map();
  for (const t of tris) {
    const root = find(t[0]);
    if (!byRoot.has(root)) byRoot.set(root, { verts: [], tris: [], area: 0, surface: 0, plus: 0, minus: 0 });
    if (t[0] === t[1] || t[1] === t[2] || t[0] === t[2]) continue;
    const island = byRoot.get(root); island.tris.push(t);
    const a = t[3], b = t[4], c = t[5], e1 = [P[b * 3] - P[a * 3], P[b * 3 + 1] - P[a * 3 + 1], P[b * 3 + 2] - P[a * 3 + 2]], e2 = [P[c * 3] - P[a * 3], P[c * 3 + 1] - P[a * 3 + 1], P[c * 3 + 2] - P[a * 3 + 2]];
    island.surface += Math.hypot(e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]) / 2;
  }
  for (const v of parent.keys()) byRoot.get(find(v)).verts.push(v);
  const islands = [...byRoot.values()];
  for (const island of islands) measure(island, xy);
  return islands;
}
function uniqueTriangles(list) {
  const seen = new Set(), out = [];
  for (const t of list) { const key = [t[0], t[1], t[2]].sort((x, y) => x - y).join(','); if (!seen.has(key)) { seen.add(key); out.push(t); } }
  return out;
}
function measure(island, xy) {
  island.plus = island.minus = 0;
  for (const [a, b, c] of island.tris) {
    const d = ((xy[b * 2] - xy[a * 2]) * (xy[c * 2 + 1] - xy[a * 2 + 1]) - (xy[b * 2 + 1] - xy[a * 2 + 1]) * (xy[c * 2] - xy[a * 2])) / 2;
    if (d > 0) island.plus += d; else island.minus -= d;
  }
  island.area = island.plus + island.minus;
}

/** An island with no size on the texture borrows its shape from the current view (or, without a
 * view, from its own flattest side). */
function shapeCollapsed(island, geoset, xy, viewMatrix, projectionMatrix) {
  const P = geoset.Vertices, spots = new Map();
  if (validMatrix(viewMatrix) && validMatrix(projectionMatrix)) for (const v of island.verts) {
    const clip = transform4(projectionMatrix, transform4(viewMatrix, [P[v * 3], P[v * 3 + 1], P[v * 3 + 2], 1]));
    if (!Number.isFinite(clip[3]) || Math.abs(clip[3]) < 1e-8) { spots.clear(); break; }
    spots.set(v, [clip[0] / clip[3], -clip[1] / clip[3]]);
  }
  const apply = () => { for (const [v, p] of spots) { xy[v * 2] = p[0]; xy[v * 2 + 1] = p[1]; } measure(island, xy); };
  if (spots.size) { apply(); if (island.area > 1e-12) return; }
  const normal = [0, 0, 0];
  for (const [a, b, c] of island.tris) {
    const e1 = [P[b * 3] - P[a * 3], P[b * 3 + 1] - P[a * 3 + 1], P[b * 3 + 2] - P[a * 3 + 2]], e2 = [P[c * 3] - P[a * 3], P[c * 3 + 1] - P[a * 3 + 1], P[c * 3 + 2] - P[a * 3 + 2]];
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], side = n[0] * normal[0] + n[1] * normal[1] + n[2] * normal[2] < 0 ? -1 : 1;
    for (let k = 0; k < 3; k++) normal[k] += side * n[k];
  }
  const len = Math.hypot(...normal) || 1, n = normal.map(x => x / len), axis = Math.abs(n[0]) < .9 ? [1, 0, 0] : [0, 1, 0];
  const u = [axis[1] * n[2] - axis[2] * n[1], axis[2] * n[0] - axis[0] * n[2], axis[0] * n[1] - axis[1] * n[0]], ul = Math.hypot(...u) || 1, right = u.map(x => x / ul);
  const up = [n[1] * right[2] - n[2] * right[1], n[2] * right[0] - n[0] * right[2], n[0] * right[1] - n[1] * right[0]];
  for (const v of island.verts) spots.set(v, [P[v * 3] * right[0] + P[v * 3 + 1] * right[1] + P[v * 3 + 2] * right[2], P[v * 3] * up[0] + P[v * 3 + 1] * up[1] + P[v * 3 + 2] * up[2]]);
  apply();
}

/** Islands lying on top of each other on the texture (mirrored halves sharing one painted spot)
 * move as one piece. Returns groups of island numbers. */
function stackedGroups(islands, xy) {
  const parent = islands.map((_, i) => i), find = i => { while (parent[i] !== i) i = parent[i] = parent[parent[i]]; return i; };
  let low = [Infinity, Infinity], high = [-Infinity, -Infinity];
  const sized = islands.map(island => island.area > 1e-12);
  islands.forEach((island, i) => { if (sized[i]) for (const v of island.verts) { low = [Math.min(low[0], xy[v * 2]), Math.min(low[1], xy[v * 2 + 1])]; high = [Math.max(high[0], xy[v * 2]), Math.max(high[1], xy[v * 2 + 1])]; } });
  const cell = Math.max(high[0] - low[0], high[1] - low[1]) / 160;
  if (!(cell > 0)) return islands.map((_, i) => [i]);
  const wide = Math.ceil((high[0] - low[0]) / cell) + 1, owners = new Map(), counts = islands.map(() => 0), shared = new Map();
  islands.forEach((island, i) => {
    if (!sized[i]) return;
    const mine = new Set();
    for (const [a, b, c] of island.tris) {
      const ax = xy[a * 2], ay = xy[a * 2 + 1], bx = xy[b * 2], by = xy[b * 2 + 1], cx = xy[c * 2], cy = xy[c * 2 + 1];
      const x0 = Math.floor((Math.min(ax, bx, cx) - low[0]) / cell), x1 = Math.floor((Math.max(ax, bx, cx) - low[0]) / cell), y0 = Math.floor((Math.min(ay, by, cy) - low[1]) / cell), y1 = Math.floor((Math.max(ay, by, cy) - low[1]) / cell);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++)
        if (pointTriangleDistance(low[0] + (x + .5) * cell, low[1] + (y + .5) * cell, ax, ay, bx, by, cx, cy) === 0) mine.add(y * wide + x);
    }
    counts[i] = mine.size;
    for (const k of mine) { if (!owners.has(k)) owners.set(k, []); owners.get(k).push(i); }
  });
  for (const list of owners.values()) for (let p = 0; p < list.length; p++) for (let q = p + 1; q < list.length; q++) { const key = list[p] * islands.length + list[q]; shared.set(key, (shared.get(key) || 0) + 1); }
  for (const [key, both] of shared) { const i = Math.floor(key / islands.length), j = key % islands.length; if (both > .5 * Math.min(counts[i], counts[j])) parent[find(i)] = find(j); }
  const groups = new Map();
  islands.forEach((_, i) => { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(i); });
  return [...groups.values()];
}

// ---------------------------------------------------------------------------------------------
// Arranging: every piece keeps its shape. One shared size (texture per real surface) is grown until
// the pieces no longer fit, on a grid of squares that lie wholly inside the area.

function areaGrid(polygon) {
  let low = [Infinity, Infinity], high = [-Infinity, -Infinity];
  for (const p of polygon) { low = [Math.min(low[0], p[0]), Math.min(low[1], p[1])]; high = [Math.max(high[0], p[0]), Math.max(high[1], p[1])]; }
  const size = Math.abs(signedArea(polygon));
  let cell = Math.sqrt(size / 9000);
  while ((high[0] - low[0]) / cell * ((high[1] - low[1]) / cell) > 400000) cell *= 1.25;
  const W = Math.max(1, Math.ceil((high[0] - low[0]) / cell)), H = Math.max(1, Math.ceil((high[1] - low[1]) / cell)), blocked = new Uint8Array(W * H).fill(1), n = polygon.length;
  const reach = cell * .7072;
  let free = 0, sumX = 0, sumY = 0;
  for (let y = 0; y < H; y++) {
    const py = low[1] + (y + .5) * cell;
    for (let x = 0; x < W; x++) {
      const px = low[0] + (x + .5) * cell;
      if (!insidePolygon(polygon, px, py)) continue;
      let clear = true;
      for (let i = 0, j = n - 1; i < n && clear; j = i++) {
        const a = polygon[j], b = polygon[i];
        if (Math.min(a[0], b[0]) - reach > px || Math.max(a[0], b[0]) + reach < px || Math.min(a[1], b[1]) - reach > py || Math.max(a[1], b[1]) + reach < py) continue;
        if (segmentDistance([px, py], a, b) < reach) clear = false;
      }
      if (clear) { blocked[y * W + x] = 0; free++; sumX += x + .5; sumY += y + .5; }
    }
  }
  return { low, cell, W, H, blocked, free, centre: free ? [sumX / free, sumY / free] : [W / 2, H / 2], size };
}

/** The squares a piece touches at this size and turn (never fewer than it really covers). */
function footprint(piece, scale, angle, cell, maxW, maxH) {
  const cos = Math.cos(angle) * scale, sin = Math.sin(angle) * scale, count = piece.q.length / 2, pts = new Float64Array(count * 2);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < count; i++) {
    const x = piece.q[i * 2] * cos - piece.q[i * 2 + 1] * sin, y = piece.q[i * 2] * sin + piece.q[i * 2 + 1] * cos;
    pts[i * 2] = x; pts[i * 2 + 1] = y; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  // Half a square of air on every side, so the squares can be trusted.
  x0 -= cell * .25; y0 -= cell * .25;
  const w = Math.floor((x1 - x0) / cell + .25) + 1, h = Math.floor((y1 - y0) / cell + .25) + 1;
  if (w > maxW || h > maxH) return null;
  const mark = new Uint8Array(w * h), reach = cell * .7072, tris = piece.tris;
  for (let t = 0; t < tris.length; t += 3) {
    const ax = pts[tris[t] * 2] - x0, ay = pts[tris[t] * 2 + 1] - y0, bx = pts[tris[t + 1] * 2] - x0, by = pts[tris[t + 1] * 2 + 1] - y0, cx = pts[tris[t + 2] * 2] - x0, cy = pts[tris[t + 2] * 2 + 1] - y0;
    const cx0 = Math.max(0, Math.floor((Math.min(ax, bx, cx) - reach) / cell)), cx1 = Math.min(w - 1, Math.floor((Math.max(ax, bx, cx) + reach) / cell)), cy0 = Math.max(0, Math.floor((Math.min(ay, by, cy) - reach) / cell)), cy1 = Math.min(h - 1, Math.floor((Math.max(ay, by, cy) + reach) / cell));
    for (let y = cy0; y <= cy1; y++) for (let x = cx0; x <= cx1; x++)
      if (!mark[y * w + x] && pointTriangleDistance((x + .5) * cell, (y + .5) * cell, ax, ay, bx, by, cx, cy) <= reach) mark[y * w + x] = 1;
  }
  const cells = [];
  for (let i = 0; i < mark.length; i++) if (mark[i]) cells.push(i);
  // Far-apart squares first: a spot that does not fit is rejected after a few looks.
  const order = new Int32Array(cells.length * 2), stride = Math.max(1, Math.floor(cells.length * .618) | 1);
  let step = stride; while (cells.length > 1 && gcd(step, cells.length) !== 1) step++;
  for (let i = 0, k = 0; i < cells.length; i++, k = (k + step) % cells.length) { order[i * 2] = cells[k] % w; order[i * 2 + 1] = Math.floor(cells[k] / w); }
  return { pts, x0, y0, w, h, order };
}
const gcd = (a, b) => { while (b) [a, b] = [b, a % b]; return a; };

function arrange(pieces, grid, scale, angles, centred) {
  const { W, H, cell } = grid, blocked = grid.blocked.slice(), placed = new Array(pieces.length);
  const order = pieces.map((_, i) => i).sort((a, b) => pieces[b].size - pieces[a].size);
  for (const index of order) {
    const piece = pieces[index];
    let found = null;
    for (const angle of angles) {
      const print = footprint(piece, scale * piece.ratio, angle, cell, W, H);
      if (!print) continue;
      const { w, h, order: cells } = print, total = cells.length / 2;
      let best = Infinity;
      for (let oy = 0; oy + h <= H; oy++) for (let ox = 0; ox + w <= W; ox++) {
        let fits = true;
        for (let k = 0; k < total; k++) if (blocked[(oy + cells[k * 2 + 1]) * W + ox + cells[k * 2]]) { fits = false; break; }
        if (!fits) continue;
        if (!centred) { found = { print, ox, oy, angle }; oy = H; break; }
        const d = (ox + w / 2 - grid.centre[0]) ** 2 + (oy + h / 2 - grid.centre[1]) ** 2;
        if (d < best) { best = d; found = { print, ox, oy, angle }; }
      }
      if (found) break;
    }
    if (!found) return null;
    const { print, ox, oy, angle } = found, cells = print.order;
    for (let k = 0; k < cells.length; k += 2) blocked[(oy + cells[k + 1]) * W + ox + cells[k]] = 1;
    placed[index] = { angle, scale: scale * piece.ratio, x: grid.low[0] + ox * cell - print.x0, y: grid.low[1] + oy * cell - print.y0 };
  }
  return placed;
}

/** Largest shared size at which every piece fits, and where each piece goes. */
function largestArrangement(pieces, grid, angles, centred, atLeast = 0) {
  const full = Math.sqrt(grid.size / pieces.reduce((sum, piece) => sum + piece.size * piece.ratio * piece.ratio, 0));
  let low = 0, high = full * 1.05, best = null;
  if (atLeast) { best = arrange(pieces, grid, atLeast, angles, centred); if (!best) return null; low = atLeast; }
  else for (let scale = high / 1.5, tries = 0; tries < 40 && !best; tries++, scale /= 1.5) { best = arrange(pieces, grid, scale, angles, centred); if (best) low = scale; else high = scale; }
  if (!best) return null;
  for (let i = 0; i < 9 && high > low * 1.004; i++) {
    const middle = Math.sqrt(low * high), result = arrange(pieces, grid, middle, angles, centred);
    if (result) { best = result; low = middle; } else high = middle;
  }
  return { scale: low, placed: best };
}

// ---------------------------------------------------------------------------------------------
// Bending: a joined piece starts from its arranged spot (its own layout, moved, turned and sized)
// and is bent until it fills the area. First its outline is laid round the area's edge and every
// point carried along (layRound). Then the points settle: each triangle pulls towards its real 3D
// shape at the size that would fill the area, so stretch is shared out evenly, while the outline's
// points are held gently to their spots on the edge. Points move one at a time, and a move counts
// only when every triangle keeps the side it started on and the piece stays in the area. Where
// the outline cannot be laid round, the piece swells from where it lies, like a balloon.

// OVERFILL: aim a little larger than fits, so the piece presses into corners. EDGE_PULL: hold of
// the outline's points on their spots while settling. DRAW: pull of every point towards its spot
// while being walked there. MEND: how flat a triangle may get before mending pushes it back.
const OVERFILL = 1.2, EDGE_PULL = 200, DRAW = 4000, MEND = 1e-3;

function bend(piece, start, polygon, grid, geoset) {
  const tris = piece.tris, real = piece.real, count = start.length / 2, triCount = tris.length / 3, P = geoset.Vertices;
  const inv = new Float64Array(triCount * 4), weight = new Float64Array(triCount), kind = new Int8Array(triCount), x = Float64Array.from(start);
  let surface = 0;
  for (let t = 0; t < triCount; t++) {
    const a = real[t * 3] * 3, b = real[t * 3 + 1] * 3, c = real[t * 3 + 2] * 3;
    const e1 = [P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]], e2 = [P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]], l1 = Math.hypot(...e1);
    const twice = Math.hypot(e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]);
    if (!(l1 > 0) || !(twice > 1e-12 * l1 * l1) || !(twice > 0)) continue;
    const x2 = (e1[0] * e2[0] + e1[1] * e2[1] + e1[2] * e2[2]) / l1, y2 = twice / l1;
    inv[t * 4] = 1 / l1; inv[t * 4 + 1] = -x2 / (l1 * y2); inv[t * 4 + 3] = 1 / y2; weight[t] = twice / 2; surface += twice / 2; kind[t] = 1;
  }
  if (!(surface > 0)) return null;
  // Layers lying on each other share the room: the size aimed for is the area over what the piece
  // covers, a little more than fills it, so that it presses into the corners.
  let flat = 0;
  for (let t = 0; t < triCount; t++) { const a = tris[t * 3] * 2, b = tris[t * 3 + 1] * 2, c = tris[t * 3 + 2] * 2; flat += Math.abs((x[b] - x[a]) * (x[c + 1] - x[a + 1]) - (x[b + 1] - x[a + 1]) * (x[c] - x[a])) / 2; }
  const covered = coveredArea(tris, x), layers = flat > 0 && covered > 0 ? Math.max(1, flat / covered) : 1;
  const size = Math.sqrt(grid.size * layers / surface) * OVERFILL;
  for (let t = 0; t < triCount; t++) { for (let k = 0; k < 4; k++) inv[t * 4 + k] /= size; weight[t] /= surface; }
  const jac = (t, out) => {
    const i0 = tris[t * 3] * 2, i1 = tris[t * 3 + 1] * 2, i2 = tris[t * 3 + 2] * 2, e1x = x[i1] - x[i0], e1y = x[i1 + 1] - x[i0 + 1], e2x = x[i2] - x[i0], e2y = x[i2 + 1] - x[i0 + 1];
    out[0] = e1x * inv[t * 4] + e2x * inv[t * 4 + 2]; out[1] = e1x * inv[t * 4 + 1] + e2x * inv[t * 4 + 3]; out[2] = e1y * inv[t * 4] + e2y * inv[t * 4 + 2]; out[3] = e1y * inv[t * 4 + 1] + e2y * inv[t * 4 + 3];
  };
  const J = new Float64Array(4), side = new Int8Array(triCount);
  for (let t = 0; t < triCount; t++) {
    if (!kind[t]) continue;
    jac(t, J); const det = J[0] * J[3] - J[1] * J[2];
    // A triangle with no size on the texture has no side to keep; it is only pulled into shape.
    if (Math.abs(det) < 1e-9) kind[t] = 2; else side[t] = det > 0 ? 1 : -1;
  }
  // Which triangles each point belongs to, and the piece's outline.
  const fan = Array.from({ length: count }, () => []), edgeUse = new Map(), realOf = new Int32Array(count);
  for (let t = 0; t < triCount; t++) for (let k = 0; k < 3; k++) {
    fan[tris[t * 3 + k]].push(t); realOf[tris[t * 3 + k]] = real[t * 3 + k];
    const a = tris[t * 3 + k], b = tris[t * 3 + (k + 1) % 3], c = tris[t * 3 + (k + 2) % 3], low = Math.min(a, b), high = Math.max(a, b), key = low * count + high;
    const turn = (x[high * 2] - x[low * 2]) * (x[c * 2 + 1] - x[low * 2 + 1]) - (x[high * 2 + 1] - x[low * 2 + 1]) * (x[c * 2] - x[low * 2]);
    edgeUse.set(key, (edgeUse.get(key) || 0) | (turn > 0 ? 1 : turn < 0 ? 2 : 0));
  }
  // An edge is on the outline when its triangles all lie on one side of it: the piece's rim, and
  // any line it is folded along. Triangles keep their side, so this never changes.
  const outline = [], rim = Array.from({ length: count }, () => []);
  for (const [key, sides] of edgeUse) if (sides !== 3) { const a = Math.floor(key / count), b = key % count; rim[a].push(b); rim[b].push(a); outline.push(a, b); }
  const cross4 = (ax, ay, bx, by, cx, cy, dx, dy) => {
    const o1 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax), o2 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax), o3 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx), o4 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
    return o1 * o2 < 0 && o3 * o4 < 0;
  };
  // The outline may not run through itself, when it does not already.
  let guardOutline = outline.length <= 1200;
  for (let i = 0; i < outline.length && guardOutline; i += 2) for (let j = i + 2; j < outline.length; j += 2) {
    const a = outline[i], b = outline[i + 1], c = outline[j], d = outline[j + 1];
    if (a !== c && a !== d && b !== c && b !== d && cross4(x[a * 2], x[a * 2 + 1], x[b * 2], x[b * 2 + 1], x[c * 2], x[c * 2 + 1], x[d * 2], x[d * 2 + 1])) { guardOutline = false; break; }
  }
  const n = polygon.length, { low, cell, W, H, blocked } = grid, span = Math.sqrt(grid.size), slack = span * .004, hair = span * 2e-4;
  const inside = (px, py) => {
    const gx = Math.floor((px - low[0]) / cell), gy = Math.floor((py - low[1]) / cell);
    return (gx >= 0 && gy >= 0 && gx < W && gy < H && !blocked[gy * W + gx]) || insidePolygon(polygon, px, py);
  };
  /** True well inside the area (a quick look that never says yes wrongly). */
  const roomy = (px, py) => {
    const gx = Math.floor((px - low[0]) / cell), gy = Math.floor((py - low[1]) / cell);
    return gx >= 0 && gy >= 0 && gx < W && gy < H && !blocked[gy * W + gx];
  };
  /** Nearest spot on the area's edge: [squared distance, x, y]. */
  const near = [0, 0, 0];
  const nearest = (px, py) => {
    let best = Infinity;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const a = polygon[j], b = polygon[i], ex = b[0] - a[0], ey = b[1] - a[1], l = ex * ex + ey * ey, t = l > 0 ? Math.max(0, Math.min(1, ((px - a[0]) * ex + (py - a[1]) * ey) / l)) : 0;
      const qx = a[0] + ex * t, qy = a[1] + ey * t, d = (px - qx) * (px - qx) + (py - qy) * (py - qy);
      if (d < best) { best = d; near[1] = qx; near[2] = qy; }
    }
    near[0] = best;
    return near;
  };
  /** How far outside the area the straight line between two points inside it runs. */
  const outsideBy = (ax, ay, bx, by) => {
    let crosses = false;
    for (let i = 0, j = n - 1; i < n && !crosses; j = i++) crosses = cross4(ax, ay, bx, by, polygon[j][0], polygon[j][1], polygon[i][0], polygon[i][1]);
    if (!crosses) return 0;
    let worst = 0;
    for (let k = 1; k < 8; k++) { const px = ax + (bx - ax) * k / 8, py = ay + (by - ay) * k / 8; if (!inside(px, py)) worst = Math.max(worst, Math.sqrt(nearest(px, py)[0])); }
    return worst;
  };
  /** How far along (dx, dy) the first wall is, and which wall. */
  const wall = (px, py, dx, dy) => {
    let far = Infinity, hit = -1;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const a = polygon[j], b = polygon[i], ex = b[0] - a[0], ey = b[1] - a[1], den = dx * ey - dy * ex;
      if (!den) continue;
      const t = ((a[0] - px) * ey - (a[1] - py) * ex) / den, u = ((a[0] - px) * dy - (a[1] - py) * dx) / den;
      if (t > 0 && u >= 0 && u <= 1 && t < far) { far = t; hit = i; }
    }
    return [far, hit];
  };
  // Pull of one point's triangles (and of the spot the point is being drawn to, if any): value
  // and slope. Infinity when a triangle would turn over.
  const draw = new Float64Array(count);
  let drawn = null, mending = false;
  const pull = (v, grad) => {
    let energy = 0; if (grad) grad[0] = grad[1] = 0;
    for (const t of fan[v]) {
      if (!kind[t]) continue;
      jac(t, J);
      const a = J[0], b = J[1], c = J[2], d = J[3], m0 = inv[t * 4], m1 = inv[t * 4 + 1], m2 = inv[t * 4 + 2], m3 = inv[t * 4 + 3];
      let g0, g1, g2, g3;
      if (kind[t] === 1) {
        const det = a * d - b * c, norm = a * a + b * b + c * c + d * d;
        if (mending && !(det * side[t] > MEND)) {
          // Turned over or squeezed flat while mending: pushed back towards its own side.
          const short = MEND - det * side[t], k = -2e8 * side[t] * short;
          energy += weight[t] * (8 / (MEND * MEND) + 1e8 * short * short);
          if (!grad) continue;
          g0 = k * d; g1 = -k * c; g2 = -k * b; g3 = k * a;
        } else {
          if (!(det * side[t] > 1e-10)) return Infinity;
          const back = 1 / (det * det), f = 2 * (1 + back), h = 2 * norm * back / det;
          energy += weight[t] * norm * (1 + back);
          if (!grad) continue;
          g0 = f * a - h * d; g1 = f * b + h * c; g2 = f * c + h * b; g3 = f * d - h * a;
        }
      } else {
        const s0 = a * a + c * c - 1, s1 = a * b + c * d, s3 = b * b + d * d - 1;
        energy += weight[t] * (s0 * s0 + 2 * s1 * s1 + s3 * s3);
        if (!grad) continue;
        g0 = 4 * (a * s0 + b * s1); g1 = 4 * (a * s1 + b * s3); g2 = 4 * (c * s0 + d * s1); g3 = 4 * (c * s1 + d * s3);
      }
      const e1x = g0 * m0 + g1 * m1, e1y = g2 * m0 + g3 * m1, e2x = g0 * m2 + g1 * m3, e2y = g2 * m2 + g3 * m3, w = weight[t];
      if (tris[t * 3 + 1] === v) { grad[0] += w * e1x; grad[1] += w * e1y; }
      else if (tris[t * 3 + 2] === v) { grad[0] += w * e2x; grad[1] += w * e2y; }
      else { grad[0] -= w * (e1x + e2x); grad[1] -= w * (e1y + e2y); }
    }
    if (drawn && draw[v] > 0) {
      const dx = x[v * 2] - drawn[v * 2], dy = x[v * 2 + 1] - drawn[v * 2 + 1], k = draw[v] / grid.size;
      energy += k * (dx * dx + dy * dy);
      if (grad) { grad[0] += 2 * k * dx; grad[1] += 2 * k * dy; }
    }
    return energy;
  };
  const allowed = (v, fromX, fromY) => {
    const px = x[v * 2], py = x[v * 2 + 1];
    if (!inside(px, py)) return false;
    for (const other of rim[v]) {
      const ox = x[other * 2], oy = x[other * 2 + 1], out = outsideBy(px, py, ox, oy);
      if (out > slack && out > outsideBy(fromX, fromY, ox, oy)) return false;
      if (guardOutline) for (let i = 0; i < outline.length; i += 2) {
        const c = outline[i], d = outline[i + 1];
        if (c !== v && d !== v && c !== other && d !== other && cross4(px, py, ox, oy, x[c * 2], x[c * 2 + 1], x[d * 2], x[d * 2 + 1])) return false;
      }
    }
    return true;
  };
  /** Try the move (dx, dy) and shorter ones; keeps the first that lowers the pull. Returns its length. */
  const tryMove = (v, dx, dy, before, first, walls) => {
    const px = x[v * 2], py = x[v * 2 + 1];
    for (let step = first, tries = 0; tries < 8; tries++, step /= 2) {
      x[v * 2] = px + dx * step; x[v * 2 + 1] = py + dy * step;
      if (pull(v, null) < before && (!walls || allowed(v, px, py))) return step * Math.hypot(dx, dy);
    }
    x[v * 2] = px; x[v * 2 + 1] = py;
    return 0;
  };
  const g = [0, 0], gx = [0, 0], gy = [0, 0], typical = Math.sqrt(grid.size / Math.max(1, triCount));
  /** Let the points settle. `held` points stay; without `walls` the area's edge is not looked at. */
  const settle = (sweeps, held, walls) => {
    for (let sweep = 0; sweep < sweeps; sweep++) {
      let moved = 0;
      for (let turn = 0; turn < count; turn++) {
        const v = sweep % 2 ? count - 1 - turn : turn, px = x[v * 2], py = x[v * 2 + 1];
        if (!fan[v].length || (held && held[v])) continue;
        const before = pull(v, g);
        if (!Number.isFinite(before) || (!g[0] && !g[1])) continue;
        let reach = 0;
        for (const t of fan[v]) for (let k = 0; k < 3; k++) { const o = tris[t * 3 + k]; if (o !== v) reach = Math.max(reach, Math.hypot(x[o * 2] - px, x[o * 2 + 1] - py)); }
        reach = Math.max(reach, typical * 1e-3);
        // Newton step from the slope's own change; plain downhill where that is not a bowl.
        const h = reach * 1e-5;
        x[v * 2] = px + h; const okX = Number.isFinite(pull(v, gx)); x[v * 2] = px;
        x[v * 2 + 1] = py + h; const okY = Number.isFinite(pull(v, gy)); x[v * 2 + 1] = py;
        let dx, dy;
        const hxx = (gx[0] - g[0]) / h, hyy = (gy[1] - g[1]) / h, hxy = ((gx[1] - g[1]) + (gy[0] - g[0])) / (2 * h), det = hxx * hyy - hxy * hxy;
        if (okX && okY && hxx > 0 && det > 1e-12 * hxx * hyy) { dx = -(hyy * g[0] - hxy * g[1]) / det; dy = -(hxx * g[1] - hxy * g[0]) / det; }
        else { const len = Math.hypot(g[0], g[1]); dx = -g[0] / len * reach * .25; dy = -g[1] / len * reach * .25; }
        const length = Math.hypot(dx, dy);
        if (length > reach * .5) { dx *= reach * .5 / length; dy *= reach * .5 / length; }
        let first = 1.5, hit = -1;
        if (walls && !roomy(px + dx * first, py + dy * first)) {
          const [far, index] = wall(px, py, dx, dy);
          if (far < first / .96) { first = far * .96; hit = index; }
        }
        let went = tryMove(v, dx, dy, before, first, walls);
        if (hit >= 0) {
          // Against a wall: the rest of the move slides along it.
          const a = polygon[(hit + n - 1) % n], b = polygon[hit], ex = b[0] - a[0], ey = b[1] - a[1], along = (dx * ex + dy * ey) / (ex * ex + ey * ey);
          const sx = ex * along, sy = ey * along;
          if (Math.hypot(sx, sy) > reach * 1e-7) {
            const now = pull(v, null), [far] = wall(x[v * 2], x[v * 2 + 1], sx, sy);
            went += tryMove(v, sx, sy, now, Math.min(1, far * .96), walls);
          }
        }
        moved = Math.max(moved, went);
      }
      if (moved < typical * 1e-3) break;
    }
  };

  /** Bend the whole layout so that its outline lies round the area's edge. The outline is what the
   * layout covers (layers and folds included), read as a picture. Its way round is matched to the
   * area's way round, each corner of the area taking the layout point nearest it. Then both shapes
   * are spread onto the same disc (each as a fine net of triangles with its rim round the disc's
   * edge, which cannot fold), and every point goes through the disc from the one shape into the
   * other. False, with nothing moved, when triangles would turn over or the result cuts across a
   * hollow of the area. */
  const layRound = () => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < count; i++) { x0 = Math.min(x0, x[i * 2]); y0 = Math.min(y0, x[i * 2 + 1]); x1 = Math.max(x1, x[i * 2]); y1 = Math.max(y1, x[i * 2 + 1]); }
    const px = Math.max(x1 - x0, y1 - y0) / 220;
    if (!(px > 0)) return false;
    x0 -= px * 4; y0 -= px * 4;
    const mw = Math.ceil((x1 - x0) / px) + 4, mh = Math.ceil((y1 - y0) / px) + 4, mask = new Uint8Array(mw * mh);
    for (let t = 0; t < triCount; t++) {
      const ax = (x[tris[t * 3] * 2] - x0) / px, ay = (x[tris[t * 3] * 2 + 1] - y0) / px, bx = (x[tris[t * 3 + 1] * 2] - x0) / px, by = (x[tris[t * 3 + 1] * 2 + 1] - y0) / px, cx = (x[tris[t * 3 + 2] * 2] - x0) / px, cy = (x[tris[t * 3 + 2] * 2 + 1] - y0) / px;
      for (let y = Math.max(0, Math.floor(Math.min(ay, by, cy) - 2)); y <= Math.min(mh - 1, Math.floor(Math.max(ay, by, cy) + 2)); y++) for (let xx = Math.max(0, Math.floor(Math.min(ax, bx, cx) - 2)); xx <= Math.min(mw - 1, Math.floor(Math.max(ax, bx, cx) + 2)); xx++)
        if (!mask[y * mw + xx] && pointTriangleDistance(xx + .5, y + .5, ax, ay, bx, by, cx, cy) <= 1.6) mask[y * mw + xx] = 255;
    }
    let shape = maskOutline(mask, mw, mh);
    if (!shape || shape.length < 3) return false;
    shape = shape.map(p => [x0 + p[0] * px, y0 + p[1] * px]);
    if (signedArea(shape) < 0) shape.reverse();
    const lengths = poly => { const sum = new Float64Array(poly.length + 1); for (let i = 0; i < poly.length; i++) sum[i + 1] = sum[i] + dist(poly[i], poly[(i + 1) % poly.length]); const total = sum[poly.length]; for (let i = 0; i <= poly.length; i++) sum[i] /= total; return sum; };
    const onto = (poly, sum, share) => {
      share -= Math.floor(share);
      let i = 0; while (i < poly.length - 1 && sum[i + 1] <= share) i++;
      const a = poly[i], b = poly[(i + 1) % poly.length], f = sum[i + 1] > sum[i] ? (share - sum[i]) / (sum[i + 1] - sum[i]) : 0;
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, i, f];
    };
    const shapeSum = lengths(shape), edge = lengths(polygon);
    // Start of the round trip: where the outline, as it lies now, is nearest the area's edge.
    let shift = 0, least = Infinity;
    const mine = Array.from({ length: 120 }, (_, i) => onto(shape, shapeSum, i / 120)), theirs = Array.from({ length: 360 }, (_, i) => onto(polygon, edge, i / 360));
    for (let k = 0; k < 180; k++) {
      let cost = 0;
      for (let i = 0; i < 120; i++) { const p = mine[i], q = theirs[(i * 3 + k * 2) % 360]; cost += (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2; }
      if (cost < least) { least = cost; shift = k / 180; }
    }
    // The layout's own points on its outline, by how far round they are.
    const rimPoints = [];
    for (let v = 0; v < count; v++) {
      if (!fan[v].length) continue;
      let best = Infinity, where = 0;
      for (let i = 0; i < shape.length; i++) {
        const a = shape[i], b = shape[(i + 1) % shape.length], ex = b[0] - a[0], ey = b[1] - a[1], l = ex * ex + ey * ey, t = l > 0 ? Math.max(0, Math.min(1, ((x[v * 2] - a[0]) * ex + (x[v * 2 + 1] - a[1]) * ey) / l)) : 0, d = Math.hypot(x[v * 2] - a[0] - ex * t, x[v * 2 + 1] - a[1] - ey * t);
        if (d < best) { best = d; where = shapeSum[i] + (shapeSum[i + 1] - shapeSum[i]) * t; }
      }
      if (best <= px * 3.2) rimPoints.push({ v, share: where });
    }
    if (rimPoints.length < 3) return false;
    // Corners of the area take the outline point nearest them, sharpest corners first, never out of order.
    const corners = [];
    for (let i = 0; i < n; i++) {
      const a = polygon[(i + n - 1) % n], b = polygon[i], c = polygon[(i + 1) % n], turn = Math.atan2((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]), (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]));
      if (Math.abs(turn) >= Math.PI / 7.2) corners.push({ where: edge[i], weight: Math.abs(turn) * (turn < 0 ? 2 : 1) });
    }
    corners.sort((p, q) => q.weight - p.weight);
    const anchors = [];
    for (const corner of corners) {
      let pick = null, gap = Infinity;
      for (const point of rimPoints) { const d = Math.abs(point.share + shift - corner.where - Math.round(point.share + shift - corner.where)); if (d < gap) { gap = d; pick = point; } }
      const where = corner.where + Math.round(pick.share + shift - corner.where);
      const trial = [...anchors, { share: pick.share, where, v: pick.v }].sort((p, q) => p.share - q.share);
      let ordered = trial.every((anchor, i) => !i || (anchor.where > trial[i - 1].where && anchor.share > trial[i - 1].share + 1e-9)) && trial[trial.length - 1].where - trial[0].where < 1;
      if (ordered && !anchors.some(anchor => anchor.v === pick.v)) { anchors.length = 0; anchors.push(...trial); }
    }
    /** How far round the area a share of the way round the outline lands. */
    const across = share => {
      share -= Math.floor(share);
      if (!anchors.length) return share + shift;
      if (anchors.length === 1) return share + anchors[0].where - anchors[0].share;
      let k = anchors.findIndex(anchor => anchor.share > share); if (k < 0) k = anchors.length;
      const from = anchors[(k + anchors.length - 1) % anchors.length], to = anchors[k % anchors.length];
      const s0 = from.share - (k === 0 ? 1 : 0), s1 = to.share + (k === anchors.length ? 1 : 0), w0 = from.where - (k === 0 ? 1 : 0), w1 = to.where + (k === anchors.length ? 1 : 0);
      return w0 + (share - s0) / (s1 - s0) * (w1 - w0);
    };
    // The outline and the area's edge as two rings of matching points.
    const stops = [];
    for (let i = 0; i < 72; i++) stops.push([i / 72, 0]);
    for (let i = 0; i < shape.length; i++) stops.push([shapeSum[i], 1]);
    for (const anchor of anchors) stops.push([anchor.share - Math.floor(anchor.share), 2]);
    // Every corner of the area is on the ring: found by halving, since `across` only ever climbs.
    for (let i = 0; i < n; i++) {
      const base = across(0); let want = edge[i]; while (want < base) want += 1; while (want >= base + 1) want -= 1;
      let lo = 0, hi = 1; for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2; let value = across(mid); if (value < base - 1e-12) value += 1; if (value < want) lo = mid; else hi = mid; }
      stops.push([Math.min(lo, 1 - 1e-12), 2]);
    }
    // Stops a hair apart become one, the area's corners first.
    stops.sort((p, q) => p[0] - q[0]);
    const ring = [];
    let rank = -1;
    for (const [share, grade] of stops) {
      if (ring.length && share - ring[ring.length - 1] < 5e-4) { if (grade > rank) { ring[ring.length - 1] = share; rank = grade; } continue; }
      ring.push(share); rank = grade;
    }
    if (ring.length > 1 && ring[0] + 1 - ring[ring.length - 1] < 5e-4) ring.pop();
    const from = ring.map(s => onto(shape, shapeSum, s)), to = ring.map(s => onto(polygon, edge, across(s)));
    const disc = ring.map(s => [Math.cos(2 * Math.PI * s), Math.sin(2 * Math.PI * s)]);
    const here = spreadOnDisc(from, disc), there = spreadOnDisc(to, disc);
    if (!here || !there) return false;
    const target = new Float64Array(count * 2), onRim = new Uint8Array(count);
    for (const point of rimPoints) onRim[point.v] = 1;
    for (let v = 0; v < count; v++) {
      const d = throughNet(x[v * 2], x[v * 2 + 1], here.tris, here.points, here.disc), p = throughNet(d[0], d[1], there.tris, there.disc, there.points);
      target[v * 2] = p[0]; target[v * 2 + 1] = p[1];
    }
    // Walk every point to its spot, settling in between; a step is taken only as far as it stays
    // inside the area and no triangle turns over.
    const keep = Float64Array.from(x);
    // Often the new spots are sound as they are: then every point simply goes there. A few
    // triangles turned over there are first pushed back. Failing that, all points go the same share
    // of the way, as far as is sound, and are drawn on from there one by one.
    const sound = () => {
      for (let v = 0; v < count; v++) if (!inside(x[v * 2], x[v * 2 + 1])) return false;
      for (let t = 0; t < triCount; t++) if (kind[t] === 1) { jac(t, J); if (!((J[0] * J[3] - J[1] * J[2]) * side[t] > 1e-10)) return false; }
      for (let i = 0; i < outline.length; i += 2) if (outsideBy(x[outline[i] * 2], x[outline[i] * 2 + 1], x[outline[i + 1] * 2], x[outline[i + 1] * 2 + 1]) > slack * 2.5) return false;
      return true;
    };
    const soundAt = share => { for (let i = 0; i < x.length; i++) x[i] = keep[i] + (target[i] - keep[i]) * share; return sound(); };
    if (!soundAt(1)) {
      let within = true;
      for (let v = 0; v < count; v++) {
        if (inside(x[v * 2], x[v * 2 + 1])) continue;
        const [, qx, qy] = nearest(x[v * 2], x[v * 2 + 1]), back = [qx + (qx - x[v * 2]) * .01, qy + (qy - x[v * 2 + 1]) * .01];
        if (inside(back[0], back[1])) { x[v * 2] = back[0]; x[v * 2 + 1] = back[1]; } else within = false;
      }
      draw.fill(DRAW / count); drawn = target;
      if (within) { mending = true; settle(80, null, true); mending = false; }
      const mended = within && sound();
      if (!mended) {
        let far = 0;
        for (let share = .5, step = .25, tries = 0; tries < 10; tries++, step /= 2) { if (soundAt(share)) { far = share; share += step; } else share -= step; }
        soundAt(far);
        settle(Math.max(40, Math.min(300, Math.round(90000 / count))), null, true);
      }
    }
    // A straight run between two outline points may cut across a hollow of the area: those points step back in.
    for (let pass = 0; pass < 30; pass++) {
      let fixed = true;
      for (let i = 0; i < outline.length; i += 2) {
        const a = outline[i], b = outline[i + 1], ax = x[a * 2], ay = x[a * 2 + 1], bx = x[b * 2], by = x[b * 2 + 1];
        if (outsideBy(ax, ay, bx, by) <= slack) continue;
        fixed = false;
        let worst = 0, wx = 0, wy = 0;
        for (let k = 1; k < 8; k++) { const qx = ax + (bx - ax) * k / 8, qy = ay + (by - ay) * k / 8; if (inside(qx, qy)) continue; const [d, ex, ey] = nearest(qx, qy); if (d > worst) { worst = d; wx = ex - qx; wy = ey - qy; } }
        for (const v of [a, b]) {
          const qx = x[v * 2], qy = x[v * 2 + 1];
          x[v * 2] = qx + wx * .7; x[v * 2 + 1] = qy + wy * .7;
          if (!Number.isFinite(pull(v, null)) || !inside(x[v * 2], x[v * 2 + 1])) { x[v * 2] = qx; x[v * 2 + 1] = qy; }
        }
      }
      if (fixed) break;
    }
    // From here on only the outline's points are drawn to their spots, and gently: the inside is free
    // to even out, and a corner triangle squeezed flat against a straight edge can open again.
    draw.fill(0); drawn = target;
    for (const point of rimPoints) draw[point.v] = EDGE_PULL / rimPoints.length;
    return true;
  };

  layRound();
  settle(Math.max(60, Math.min(900, Math.round(100000 / count))), null, true);
  return x;
}

/** A fine net of triangles over a shape (its ring of edge points plus points sprinkled inside),
 * spread onto a disc: the ring's points go to the given spots round the disc's edge and every
 * inside point settles in the middle of its neighbours. With the edge round a disc such a net
 * cannot fold, so the shape and the disc match spot for spot. Null when the shape cannot be netted. */
function spreadOnDisc(ring, edgeSpots) {
  const R = ring.length, pts = ring.map(p => [p[0], p[1]]);
  const turn = (a, b, c) => (pts[b][0] - pts[a][0]) * (pts[c][1] - pts[a][1]) - (pts[b][1] - pts[a][1]) * (pts[c][0] - pts[a][0]);
  const size = Math.abs(signedArea(pts));
  if (!(size > 0)) return null;
  // Ears off the ring, fattest allowed first.
  const left = pts.map((_, i) => i), tris = [];
  for (const least of [1e-3, 0]) {
    for (let cut = true; cut && left.length > 3;) {
      cut = false;
      for (let i = 0; i < left.length && left.length > 3; i++) {
        const a = left[(i + left.length - 1) % left.length], b = left[i], c = left[(i + 1) % left.length], twice = turn(a, b, c);
        if (!(twice > 1e-14 * size) || twice < least * Math.max((pts[a][0] - pts[c][0]) ** 2 + (pts[a][1] - pts[c][1]) ** 2, (pts[a][0] - pts[b][0]) ** 2 + (pts[a][1] - pts[b][1]) ** 2, (pts[b][0] - pts[c][0]) ** 2 + (pts[b][1] - pts[c][1]) ** 2)) continue;
        let clear = true;
        for (let k = 0; k < left.length && clear; k++) { const p = left[k]; if (p !== a && p !== b && p !== c && turn(a, b, p) >= 0 && turn(b, c, p) >= 0 && turn(c, a, p) >= 0) clear = false; }
        if (!clear) continue;
        tris.push([a, b, c]); left.splice(i, 1); cut = true; i--;
      }
    }
  }
  if (left.length !== 3 || !(turn(left[0], left[1], left[2]) > 0)) return null;
  tris.push([left[0], left[1], left[2]]);
  // Swap edges until no triangle's circle holds a neighbour's far point (well-shaped triangles).
  const span = 1 << 16, sideOf = new Map(), key = (a, b) => a * span + b;
  const note = t => { const [a, b, c] = tris[t]; sideOf.set(key(a, b), t); sideOf.set(key(b, c), t); sideOf.set(key(c, a), t); };
  tris.forEach((_, t) => note(t));
  const far = (t, a, b) => tris[t].find(v => v !== a && v !== b);
  const settleEdges = stack => {
    for (let guard = 0; stack.length && guard < 200000; guard++) {
      const [a, b] = stack.pop(), t1 = sideOf.get(key(a, b)), t2 = sideOf.get(key(b, a));
      if (t1 === undefined || t2 === undefined) continue;
      const c = far(t1, a, b), d = far(t2, a, b);
      if (!(turn(a, d, c) > 0) || !(turn(d, b, c) > 0)) continue;
      const ax = pts[a][0] - pts[d][0], ay = pts[a][1] - pts[d][1], bx = pts[b][0] - pts[d][0], by = pts[b][1] - pts[d][1], cx = pts[c][0] - pts[d][0], cy = pts[c][1] - pts[d][1];
      const within = (ax * ax + ay * ay) * (bx * cy - cx * by) - (bx * bx + by * by) * (ax * cy - cx * ay) + (cx * cx + cy * cy) * (ax * by - bx * ay);
      if (!(within > 1e-12 * size * size)) continue;
      sideOf.delete(key(a, b)); sideOf.delete(key(b, a));
      tris[t1] = [a, d, c]; tris[t2] = [d, b, c]; note(t1); note(t2);
      stack.push([a, d], [d, b], [b, c], [c, a]);
    }
  };
  settleEdges(tris.flatMap(([a, b, c]) => [[a, b], [b, c], [c, a]]));
  // Points sprinkled inside, each splitting the triangle it falls in.
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of ring) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  const gap = Math.sqrt(size / 260);
  for (let row = 0, y = y0 + gap / 2; y < y1; y += gap * .866, row++) for (let x = x0 + (row % 2 ? gap * .75 : gap * .25); x < x1; x += gap) {
    if (!insidePolygon(ring, x, y)) continue;
    let room = Infinity;
    for (let i = 0, j = R - 1; i < R && room > gap * .45; j = i++) room = Math.min(room, segmentDistance([x, y], ring[j], ring[i]));
    if (room <= gap * .45) continue;
    const p = pts.length; pts.push([x, y]);
    let home = -1;
    for (let t = 0; t < tris.length && home < 0; t++) { const [a, b, c] = tris[t]; if (turn(a, b, p) > 0 && turn(b, c, p) > 0 && turn(c, a, p) > 0) home = t; }
    if (home < 0) { pts.pop(); continue; }
    const [a, b, c] = tris[home];
    tris[home] = [a, b, p]; note(home); tris.push([b, c, p]); note(tris.length - 1); tris.push([c, a, p]); note(tris.length - 1);
    settleEdges([[a, b], [b, c], [c, a]]);
  }
  // Onto the disc.
  const count = pts.length, disc = new Float64Array(count * 2), next = pts.map(() => new Set());
  for (const [a, b, c] of tris) { next[a].add(b).add(c); next[b].add(a).add(c); next[c].add(a).add(b); }
  for (let i = 0; i < R; i++) { disc[i * 2] = edgeSpots[i][0]; disc[i * 2 + 1] = edgeSpots[i][1]; }
  const around = next.map(set => Int32Array.from(set));
  for (let pass = 0; pass < 4000; pass++) {
    let moved = 0;
    for (let i = R; i < count; i++) {
      let sx = 0, sy = 0; for (const j of around[i]) { sx += disc[j * 2]; sy += disc[j * 2 + 1]; }
      const nx = disc[i * 2] + 1.6 * (sx / around[i].length - disc[i * 2]), ny = disc[i * 2 + 1] + 1.6 * (sy / around[i].length - disc[i * 2 + 1]);
      moved = Math.max(moved, Math.abs(nx - disc[i * 2]), Math.abs(ny - disc[i * 2 + 1])); disc[i * 2] = nx; disc[i * 2 + 1] = ny;
    }
    if (moved < 1e-13) break;
  }
  for (const [a, b, c] of tris) if (!((disc[b * 2] - disc[a * 2]) * (disc[c * 2 + 1] - disc[a * 2 + 1]) - (disc[b * 2 + 1] - disc[a * 2 + 1]) * (disc[c * 2] - disc[a * 2]) > 0)) return null;
  return { tris: Int32Array.from(tris.flat()), points: Float64Array.from(pts.flat()), disc };
}

/** A spot carried from one laying of a net to the other: its place in the triangle it lies in (the
 * nearest one for a spot just off the net). */
function throughNet(px, py, tris, from, to) {
  let best = 0, least = Infinity;
  for (let t = 0; t < tris.length && least > 0; t += 3) {
    const d = pointTriangleDistance(px, py, from[tris[t] * 2], from[tris[t] * 2 + 1], from[tris[t + 1] * 2], from[tris[t + 1] * 2 + 1], from[tris[t + 2] * 2], from[tris[t + 2] * 2 + 1]);
    if (d < least) { least = d; best = t; }
  }
  const a = tris[best] * 2, b = tris[best + 1] * 2, c = tris[best + 2] * 2, e1x = from[b] - from[a], e1y = from[b + 1] - from[a + 1], e2x = from[c] - from[a], e2y = from[c + 1] - from[a + 1], det = e1x * e2y - e1y * e2x;
  let s = ((px - from[a]) * e2y - (py - from[a + 1]) * e2x) / det, t = (e1x * (py - from[a + 1]) - e1y * (px - from[a])) / det;
  // Just off the net: the nearest spot on it.
  s = Math.max(0, s); t = Math.max(0, t); if (s + t > 1) { const sum = s + t; s /= sum; t /= sum; }
  return [to[a] + s * (to[b] - to[a]) + t * (to[c] - to[a]), to[a + 1] + s * (to[b + 1] - to[a + 1]) + t * (to[c + 1] - to[a + 1])];
}

/** How much room a layout takes up, layers on each other counted once. */
function coveredArea(tris, spots) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < spots.length; i += 2) { x0 = Math.min(x0, spots[i]); y0 = Math.min(y0, spots[i + 1]); x1 = Math.max(x1, spots[i]); y1 = Math.max(y1, spots[i + 1]); }
  const cell = Math.max(x1 - x0, y1 - y0) / 200;
  if (!(cell > 0)) return 0;
  const w = Math.ceil((x1 - x0) / cell) + 1, h = Math.ceil((y1 - y0) / cell) + 1, mark = new Uint8Array(w * h);
  let covered = 0;
  for (let t = 0; t < tris.length; t += 3) {
    const ax = spots[tris[t] * 2] - x0, ay = spots[tris[t] * 2 + 1] - y0, bx = spots[tris[t + 1] * 2] - x0, by = spots[tris[t + 1] * 2 + 1] - y0, cx = spots[tris[t + 2] * 2] - x0, cy = spots[tris[t + 2] * 2 + 1] - y0;
    for (let y = Math.floor(Math.min(ay, by, cy) / cell); y <= Math.floor(Math.max(ay, by, cy) / cell); y++) for (let x = Math.floor(Math.min(ax, bx, cx) / cell); x <= Math.floor(Math.max(ax, bx, cx) / cell); x++)
      if (!mark[y * w + x] && pointTriangleDistance((x + .5) * cell, (y + .5) * cell, ax, ay, bx, by, cx, cy) === 0) { mark[y * w + x] = 1; covered++; }
  }
  return covered * cell * cell;
}

/** Carry a point through the bend of the piece it lies on: its spot in the nearest triangle. */
function carry(px, py, tris, from, to) {
  let best = -1, least = Infinity;
  for (let t = 0; t < tris.length && least > 0; t += 3) {
    const d = pointTriangleDistance(px, py, from[tris[t] * 2], from[tris[t] * 2 + 1], from[tris[t + 1] * 2], from[tris[t + 1] * 2 + 1], from[tris[t + 2] * 2], from[tris[t + 2] * 2 + 1]);
    if (d < least) { least = d; best = t; }
  }
  const a = tris[best] * 2, b = tris[best + 1] * 2, c = tris[best + 2] * 2, e1x = from[b] - from[a], e1y = from[b + 1] - from[a + 1], e2x = from[c] - from[a], e2y = from[c + 1] - from[a + 1], det = e1x * e2y - e1y * e2x;
  if (!det) return null;
  const s = ((px - from[a]) * e2y - (py - from[a + 1]) * e2x) / det, t = (e1x * (py - from[a + 1]) - e1y * (px - from[a])) / det;
  return [to[a] + s * (to[b] - to[a]) + t * (to[c] - to[a]), to[a + 1] + s * (to[b + 1] - to[a + 1]) + t * (to[c + 1] - to[a + 1])];
}

// ---------------------------------------------------------------------------------------------

/** UV Wrapper Fit: move the selected triangles' UVs into the marked area. The current layout is the
 * start: its islands, seams and shared points stay as they are, and only points move. Separate
 * pieces keep their shape and are arranged in the area, sized by their real surface. A single
 * joined piece is placed the same way and then bent until it fills the area. Returns a copy of
 * `source` in which only the selected triangles' points have moved.
 * `area` is the mark in UV coordinates; `aspect` is the texture's width over its height. */
export function fitUVs(geoset, indices, viewMatrix, projectionMatrix, source = geoset?.TVertices?.[0], area, aspect = 1) {
  const points = (geoset?.Vertices?.length || 0) / 3, faces = geoset?.Faces;
  if (!source || source.length < points * 2) throw Error('The UV map changed structure before the edit could be applied.');
  const wide = aspect > 0 && Number.isFinite(aspect) ? aspect : 1;
  const raw = uniqueTriangles(wholeSelectedTriangles(faces, indices).map(c => [faces[c], faces[c + 1], faces[c + 2], faces[c], faces[c + 1], faces[c + 2]]).filter(t => t[0] !== t[1] && t[1] !== t[2] && t[0] !== t[2] && t.every(v => v < points)));
  if (!raw.length) throw Error(WHOLE_TRIANGLE_ERROR);
  const polygon = cleanArea((area || []).map(p => Array.isArray(p) ? [p[0] * wide, +p[1]] : [p?.x * wide, +p?.y]));
  const xy = new Float64Array(source.length);
  for (let i = 0; i < source.length; i += 2) { xy[i] = source[i] * wide; xy[i + 1] = source[i + 1]; }

  // Points on one UV spot are one point here (a hard edge's two copies, a mirrored half on the same
  // paint): they move together, so what touches on the texture now still touches afterwards.
  const used = [...new Set(raw.flatMap(t => t.slice(0, 3)))], spot = sameSpots(used, source);
  const welded = uniqueTriangles(raw.map(t => [spot.get(t[0]), spot.get(t[1]), spot.get(t[2]), t[0], t[1], t[2]]));
  const islands = [];
  let apart = 0;
  for (const island of islandsOf(welded, xy, geoset)) {
    if (island.area > 1e-12) { islands.push(island); continue; }
    // No size on the texture: its points are taken apart again and shaped from the view.
    const own = new Set(island.verts), loose = raw.filter(t => own.has(spot.get(t[0])));
    const flat = { verts: [...new Set(loose.flatMap(t => t.slice(0, 3)))], tris: loose };
    shapeCollapsed(flat, geoset, xy, viewMatrix, projectionMatrix);
    apart += 1000;
    for (const v of flat.verts) { spot.set(v, v); xy[v * 2] += apart; }
    islands.push(...islandsOf(loose, xy, geoset));
  }

  // One piece per stack of islands, in its own frame: centred, at one texture unit per unit of surface.
  const ratios = islands.filter(island => island.area > 1e-12 && island.surface > 0).map(island => Math.sqrt(island.surface / island.area)).sort((a, b) => a - b);
  const usual = ratios.length ? ratios[ratios.length >> 1] : 1;
  const pieces = stackedGroups(islands, xy).map(group => {
    const members = group.map(i => islands[i]).sort((a, b) => b.area - a.area), verts = members.flatMap(island => island.verts), at = new Map(verts.map((v, i) => [v, i]));
    const size = members.reduce((sum, island) => sum + island.area, 0), surface = members.reduce((sum, island) => sum + island.surface, 0);
    let cx = 0, cy = 0; for (const v of verts) { cx += xy[v * 2] / verts.length; cy += xy[v * 2 + 1] / verts.length; }
    const q = new Float64Array(verts.length * 2); verts.forEach((v, i) => { q[i * 2] = xy[v * 2] - cx; q[i * 2 + 1] = xy[v * 2 + 1] - cy; });
    const all = members.flatMap(island => island.tris);
    return { members, verts, at, q, tris: Int32Array.from(all.flatMap(t => [at.get(t[0]), at.get(t[1]), at.get(t[2])])), real: Int32Array.from(all.flatMap(t => t.slice(3))), leadTris: members[0].tris.length, size: Math.max(size, 1e-12), ratio: size > 1e-12 && surface > 0 ? Math.sqrt(surface / size) : usual };
  });

  const grid = areaGrid(polygon), out = new Float32Array(source);
  const spotsOf = (piece, place) => {
    const cos = Math.cos(place.angle) * place.scale, sin = Math.sin(place.angle) * place.scale, spots = new Float64Array(piece.q.length);
    for (let i = 0; i < spots.length; i += 2) { spots[i] = piece.q[i] * cos - piece.q[i + 1] * sin + place.x; spots[i + 1] = piece.q[i] * sin + piece.q[i + 1] * cos + place.y; }
    return spots;
  };
  const finish = () => {
    const owner = new Map();
    for (const piece of pieces) {
      for (const v of piece.verts) owner.set(v, piece);
      // Each point's own turn and size after the move, read from its largest triangle.
      piece.best = new Int32Array(piece.verts.length).fill(-1);
      const most = new Float64Array(piece.verts.length);
      for (let t = 0; t < piece.tris.length; t += 3) {
        const a = piece.tris[t] * 2, b = piece.tris[t + 1] * 2, c = piece.tris[t + 2] * 2, twice = Math.abs((piece.q[b] - piece.q[a]) * (piece.q[c + 1] - piece.q[a + 1]) - (piece.q[b + 1] - piece.q[a + 1]) * (piece.q[c] - piece.q[a]));
        for (let k = 0; k < 3; k++) if (twice > most[piece.tris[t + k]]) { most[piece.tris[t + k]] = twice; piece.best[piece.tris[t + k]] = t; }
      }
    }
    for (const v of used) {
      const lead = spot.get(v), piece = owner.get(lead), at = piece.at.get(lead), i = at * 2;
      let px = piece.spots[i], py = piece.spots[i + 1];
      if (v !== lead) {
        // A point a hair away from the spot it shares keeps that hair, turned and sized as its
        // surroundings were.
        const dx = xy[v * 2] - xy[lead * 2], dy = xy[v * 2 + 1] - xy[lead * 2 + 1], t = piece.best[at];
        let m0 = Math.cos(piece.place.angle) * piece.place.scale, m2 = Math.sin(piece.place.angle) * piece.place.scale, m1 = -m2, m3 = m0;
        if (t >= 0) {
          const a = piece.tris[t] * 2, b = piece.tris[t + 1] * 2, c = piece.tris[t + 2] * 2, q = piece.q, to = piece.spots;
          const e1x = q[b] - q[a], e1y = q[b + 1] - q[a + 1], e2x = q[c] - q[a], e2y = q[c + 1] - q[a + 1], det = e1x * e2y - e1y * e2x;
          const f1x = to[b] - to[a], f1y = to[b + 1] - to[a + 1], f2x = to[c] - to[a], f2y = to[c + 1] - to[a + 1];
          if (det) { m0 = (f1x * e2y - f2x * e1y) / det; m1 = (f2x * e1x - f1x * e2x) / det; m2 = (f1y * e2y - f2y * e1y) / det; m3 = (f2y * e1x - f1y * e2x) / det; }
        }
        const ox = px + m0 * dx + m1 * dy, oy = py + m2 * dx + m3 * dy;
        if (insidePolygon(polygon, ox, oy)) { px = ox; py = oy; }
      }
      out[v * 2] = px / wide; out[v * 2 + 1] = py;
    }
    // A sliver between two such points must not end up turned over: then they share one spot outright.
    for (const t of raw) {
      const [a, b, c] = t, was = (source[b * 2] - source[a * 2]) * (source[c * 2 + 1] - source[a * 2 + 1]) - (source[b * 2 + 1] - source[a * 2 + 1]) * (source[c * 2] - source[a * 2]), now = (out[b * 2] - out[a * 2]) * (out[c * 2 + 1] - out[a * 2 + 1]) - (out[b * 2 + 1] - out[a * 2 + 1]) * (out[c * 2] - out[a * 2]);
      if (was * now < 0) for (const v of [a, b, c]) { const lead = spot.get(v); if (lead !== v) { out[v * 2] = out[lead * 2]; out[v * 2 + 1] = out[lead * 2 + 1]; } }
    }
    return out;
  };
  const gather = () => {
    // An area thinner than anything can be laid in: everything gathers at one spot inside it.
    const inside = insideSpot(polygon);
    for (const piece of pieces) { piece.place = { angle: 0, scale: 0, x: inside[0], y: inside[1] }; piece.spots = spotsOf(piece, piece.place); }
    return finish();
  };
  if (!grid.free) return gather();

  // Unturned unless turning clearly gains room.
  let plan = largestArrangement(pieces, grid, [0], pieces.length === 1);
  if (plan && pieces.length === 1) {
    for (let k = 1; k < 24; k++) {
      const angle = k <= 12 ? k * TURN : (k - 24) * TURN, turned = largestArrangement(pieces, grid, [angle], true, plan.scale * (plan.turned ? 1.03 : 1.2));
      if (turned) plan = { ...turned, turned: true };
    }
  } else if (plan) plan = largestArrangement(pieces, grid, [0, Math.PI / 2], false, plan.scale * 1.15) || plan;
  if (!plan) return gather();
  pieces.forEach((piece, i) => { piece.place = plan.placed[i]; piece.spots = spotsOf(piece, piece.place); });

  if (pieces.length === 1) {
    const piece = pieces[0], lead = piece.members[0], leadCount = lead.verts.length, leadTris = piece.tris.subarray(0, piece.leadTris * 3);
    {
      const start = piece.spots.slice(0, leadCount * 2), bent = bend({ tris: leadTris, real: piece.real }, start, polygon, grid, geoset);
      if (bent) {
        const spots = Float64Array.from(piece.spots); spots.set(bent);
        const linked = new Uint8Array(piece.verts.length); for (const i of leadTris) linked[i] = 1;
        let sound = true;
        for (let i = 0; i < piece.verts.length && sound; i++) {
          if (linked[i]) continue;
          const moved = carry(piece.spots[i * 2], piece.spots[i * 2 + 1], leadTris, start, bent);
          if (!moved || !insidePolygon(polygon, moved[0], moved[1])) sound = false; else { spots[i * 2] = moved[0]; spots[i * 2 + 1] = moved[1]; }
        }
        const turnedOver = t => {
          const a = piece.tris[t] * 2, b = piece.tris[t + 1] * 2, c = piece.tris[t + 2] * 2, was = (piece.spots[b] - piece.spots[a]) * (piece.spots[c + 1] - piece.spots[a + 1]) - (piece.spots[b + 1] - piece.spots[a + 1]) * (piece.spots[c] - piece.spots[a]), now = (spots[b] - spots[a]) * (spots[c + 1] - spots[a + 1]) - (spots[b + 1] - spots[a + 1]) * (spots[c] - spots[a]);
          return was * now <= 0 && Math.abs(was) > 1e-14;
        };
        for (let t = leadTris.length; t < piece.tris.length && sound; t += 3) if (turnedOver(t)) sound = false;
        if (sound) piece.spots = spots;
      }
    }
  }
  return finish();
}

/** Which points share a UV spot: each point's lead (the first point found on that spot). */
function sameSpots(verts, uv) {
  const reach = 1e-4, cells = new Map(), lead = new Map();
  for (const v of verts) {
    const x = uv[v * 2], y = uv[v * 2 + 1], gx = Math.floor(x / reach), gy = Math.floor(y / reach);
    let found = -1;
    for (let oy = -1; oy <= 1 && found < 0; oy++) for (let ox = -1; ox <= 1 && found < 0; ox++)
      for (const other of cells.get((gx + ox) + ',' + (gy + oy)) || []) if (Math.abs(uv[other * 2] - x) <= reach && Math.abs(uv[other * 2 + 1] - y) <= reach) { found = other; break; }
    if (found < 0) { found = v; const key = gx + ',' + gy; if (!cells.has(key)) cells.set(key, []); cells.get(key).push(v); }
    lead.set(v, found);
  }
  return lead;
}

/** A point inside the polygon (the middle of its fattest corner triangle). */
function insideSpot(polygon) {
  let best = polygon[0], most = -1;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[(i + polygon.length - 1) % polygon.length], b = polygon[i], c = polygon[(i + 1) % polygon.length], mid = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3];
    if (!insidePolygon(polygon, mid[0], mid[1])) continue;
    let room = Infinity; for (let k = 0, j = polygon.length - 1; k < polygon.length; j = k++) room = Math.min(room, segmentDistance(mid, polygon[j], polygon[k]));
    if (room > most) { most = room; best = mid; }
  }
  return best;
}
