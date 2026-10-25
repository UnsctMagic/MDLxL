/** SD Ruin: broken walls and rubble the way Blizzard builds its ruins, on the editor's model JSON.
 * Measured in the game: the Lordaeron stone walls (doodads\lordaeronsummer\terrain\stonewall0\stonewall00-04)
 * are 16-38 triangles, 218-335 long, 62-78 thick, 110 tall (pillars 134, their tops 191; a Footman is 98):
 * a battered slab whose stones, arches and moss are painted on Textures\Doodads1.blp (about 0.65 texture
 * pixels per unit), never modelled. Ruins and rubble are a few flat-cut blocks in the same kind of stone
 * paint (rubble chunks 4-14 triangles each). Native wall and ruin doodads: 16-214 triangles, 3-22 KB, one
 * bone, one or two sheets, one Stand (destructible walls add Death). This kit makes them as MDX 800 doodads.
 *
 * Recipe (mdlxl_script edit; load the native wall first with mdlxl_assets { source: 'game', action: 'search',
 * query: 'stonewall02' } then { action: 'reference', id, signature }; it is read as references[id].model;
 * stonewall02 stands between two pillars, stonewall04 is a plain stretch):
 *   const ruin = await api.module('sd-ruin');
 *   // One go: adopt the wall, break it, crenellate what stands, scatter rubble, make it a doodad.
 *   const report = ruin.brokenCastleWall(model, { base: references[wallId].model, seed: 3 });  // scale: 1.3 for a taller wall
 *   // No native wall at hand: ruin.brokenCastleWall(model, { length: 300, height: 150, seed: 3 }) builds one in native paint.
 *   // Step by step on any wall (the open model, after bash.adopt or kitWall):
 *   const wall = ruin.wallPiece(model);                        // the long slab: { [geoset]: vertexIds }
 *   const cut = ruin.breakWall(model, wall, { from: 0.3, to: 0.7, low: 0.3, jaggedness: 0.6, seed: 3 });
 *   ruin.crenellate(model, cut);                                // merlons on the parts still standing
 *   ruin.rubble(model, cut, { count: 7, seed: 3 });             // fallen stones at the breach
 *   ruin.makeDoodad(model, { name: 'BrokenCastleWall' });       // one Stand, no death effects, unused sheets gone
 *   ruin.doodadReport(model);                                   // triangles, sheets, size, checks against the natives
 * breakWall line: [[s, z], ...] fractions of the wall's length and of its height above ground, z >= 1 meaning
 * intact; without one a stepped break is made from from/to/low/jaggedness/seed. Paint: { sheet, uv, size } areas
 * you looked at; WALL_PAINT holds the looked-at Doodads1 areas (face, cap, stone, bricks).
 */
import { adopt, pieces } from './sd-kitbash.js';
import { deleteNode, recalculateExtents } from './editor-document.js';
import { transformVertices } from './editor-commands.js';
import { createSequence, deleteSequence } from './sequence-editor.js';
import { commitForge } from './forge.js';

const BS = String.fromCharCode(92);
/** Looked-at areas of Textures\Doodads1.blp (256 x 256), the Lordaeron stone wall sheet. */
export const WALL_PAINT = Object.freeze({
  sheet: `Textures${BS}Doodads1.blp`, size: [256, 256],
  face: [0, 0.605, 0.25, 0.995], // the wall's front: light cap edge, dark arch panel, stone courses, moss at the foot
  cap: [0.004, 0.609, 0.246, 0.648], // light cap stones laid on the wall's top
  stone: [0.004, 0.858, 0.246, 0.938], // plain grey stone courses: broken tops, cut ends, merlons, rubble
  bricks: [0.004, 0.506, 0.084, 0.598], // light bricks left of the window
  end: [0.056, 0.605, 0.142, 0.995], // the strip Blizzard maps on the wall's ends
});
/** A WALL_PAINT area as a paint region: { sheet, uv, size }. */
export const wallPaint = name => {
  if (!WALL_PAINT[name] || name === 'sheet' || name === 'size') throw Error(`Wall paint is one of face, cap, stone, bricks, end.`);
  return { sheet: WALL_PAINT.sheet, uv: WALL_PAINT[name].slice(), size: WALL_PAINT.size.slice() };
};
/** The native walls and ruins measured in the game (model file only, MDX as shipped). */
export const NATIVE_WALLS = Object.freeze([
  { path: 'doodads\\lordaeronsummer\\terrain\\stonewall0\\stonewall04.mdx', what: 'Lordaeron stone wall, plain', triangles: 16, kb: 3.5, size: [62, 218, 135], sheets: ['Textures\\Doodads1.blp'], sequences: ['Stand', 'Death'] },
  { path: 'doodads\\lordaeronsummer\\terrain\\stonewall0\\stonewall00.mdx', what: 'Lordaeron stone wall, one pillar', triangles: 26, kb: 4.3, size: [76, 273, 220], sheets: ['Textures\\Doodads1.blp'], sequences: ['Stand', 'Death'] },
  { path: 'doodads\\lordaeronsummer\\terrain\\stonewall0\\stonewall02.mdx', what: 'Lordaeron stone wall between two pillars', triangles: 38, kb: 5.3, size: [78, 335, 220], sheets: ['Textures\\Doodads1.blp'], sequences: ['Stand', 'Death'] },
  { path: 'doodads\\lordaeronsummer\\props\\rubblestonewall\\rubblestonewall.mdx', what: 'Lordaeron rubble stone wall (broken wall prop)', triangles: 50, kb: 4.4, size: [149, 146, 82], sheets: ['Textures\\Doodads0.blp'], sequences: ['Stand'] },
  { path: 'doodads\\ruins\\terrain\\ruinswall0\\ruinswall01.mdx', what: 'Sunken ruins wall', triangles: 41, kb: 4.7, size: [98, 295, 172], sheets: ['Textures\\RuinsWalls.blp'], sequences: ['Stand', 'Death'] },
  { path: 'doodads\\barrens\\structures\\ruinedwall\\ruinedwall.mdx', what: 'Barrens ruined wall', triangles: 46, kb: 4.0, size: [42, 139, 73], sheets: ['Textures\\BarrensNatural.blp'], sequences: ['Stand'] },
  { path: 'doodads\\ruins\\structures\\ruinsarchwaybroken00\\ruinsarchwaybroken00.mdx', what: 'Broken ruins archway', triangles: 208, kb: 13.5, size: [325, 915, 401], sheets: ['Textures\\RuinsWalls.blp'], sequences: ['Stand'] },
  { path: 'doodads\\lordaeronsummer\\terrain\\gate\\gate.mdx', what: 'Lordaeron gate with towers', triangles: 214, kb: 22.0, size: [110, 670, 326], sheets: ['Textures\\Doodads1.blp', 'Textures\\Doodads0.blp'], sequences: ['stand', 'Stand Hit', 'Death Alternate', 'death'] },
  { path: 'doodads\\barrens\\structures\\ruinedchunk\\ruinedchunk0.mdx', what: 'Barrens rubble chunks (2)', triangles: 28, kb: 3.0, size: [63, 63, 34], sheets: ['Textures\\BarrensNatural.blp'], sequences: ['Stand'] },
  { path: 'doodads\\ashenvale\\structures\\ashenrubble\\ashenrubble1.mdx', what: 'Ashenvale rubble (4 pieces)', triangles: 40, kb: 4.4, size: [86, 104, 35], sheets: ['Textures\\AshenStructures.blp'], sequences: ['Stand'] },
]);
/** What a wall or ruin doodad should stay within, from NATIVE_WALLS and the Footman (98 tall). */
export const DOODAD_RANGE = Object.freeze({ triangles: [16, 260], kb: [2, 30], height: [60, 400], length: [100, 950], sheets: 3 });

// ---- small vector and random helpers ------------------------------------------------------------
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => Math.hypot(a[0], a[1], a[2]);
const norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/** A repeatable random stream (mulberry32): the same seed gives the same ruin. */
function random(seed = 1) {
  let a = (Number(seed) * 2654435761) >>> 0 || 1;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---- selections and the wall's own frame ------------------------------------------------------------
const allIds = g => Array.from({ length: g.Vertices.length / 3 }, (_, v) => v);
/** A target as { [geoset]: vertexIds }: a geoset index, a selection, or nothing (every geoset). */
function asSelection(model, target) {
  if (target == null) return Object.fromEntries((model.Geosets || []).map((g, i) => [i, allIds(g)]));
  if (Number.isInteger(target)) { if (!model.Geosets?.[target]) throw Error(`No geoset ${target}.`); return { [target]: allIds(model.Geosets[target]) }; }
  if (typeof target === 'object' && !Array.isArray(target)) return Object.fromEntries(Object.entries(target).filter(([k]) => model.Geosets?.[k]).map(([k, ids]) => [k, Array.from(ids)]));
  throw Error('Give the wall as a geoset index or a selection { [geoset]: vertexIds }.');
}
/** Triangles whose three corners are selected: [{ g, f, v: [a, b, c] }]. */
function selectedTriangles(model, selection) {
  const out = [];
  for (const [k, ids] of Object.entries(selection)) {
    const g = model.Geosets[k], set = new Set(ids), F = g.Faces;
    for (let f = 0; f < F.length; f += 3) if (set.has(F[f]) && set.has(F[f + 1]) && set.has(F[f + 2])) out.push({ g: Number(k), f: f / 3, v: [F[f], F[f + 1], F[f + 2]] });
  }
  return out;
}
const position = (g, v) => [g.Vertices[v * 3], g.Vertices[v * 3 + 1], g.Vertices[v * 3 + 2]];
const toLocal = (frame, p) => { const d = sub(p, frame.origin); return [dot(d, frame.along), dot(d, frame.across), p[2]]; };
const toWorld = (frame, s, t, z) => [frame.origin[0] + frame.along[0] * s + frame.across[0] * t, frame.origin[1] + frame.along[1] * s + frame.across[1] * t, z];

// Probes through the wall: where a line along one local axis enters and leaves the selected surface.
function prober(model, tris, frame) {
  const local = tris.map(({ g, v }) => v.map(i => toLocal(frame, position(model.Geosets[g], i))));
  // Only faces that turn toward the probe count: a face it grazes (the top, for a probe across) gives no answer.
  const facing = local.map(([p, q, r]) => norm(cross(sub(q, p), sub(r, p))));
  const hits = (a, b, free, x, y) => {
    const out = [];
    for (const [k, P] of local.entries()) {
      if (Math.abs(facing[k][free]) < 0.25) continue;
      const [p, q, r] = P, d = (q[a] - p[a]) * (r[b] - p[b]) - (r[a] - p[a]) * (q[b] - p[b]);
      if (Math.abs(d) < 1e-6) continue;
      const w1 = ((x - p[a]) * (r[b] - p[b]) - (r[a] - p[a]) * (y - p[b])) / d, w2 = ((q[a] - p[a]) * (y - p[b]) - (x - p[a]) * (q[b] - p[b])) / d, w0 = 1 - w1 - w2, e = -1e-4;
      if (w0 >= e && w1 >= e && w2 >= e) out.push(w0 * p[free] + w1 * q[free] + w2 * r[free]);
    }
    return out;
  };
  return {
    /** The wall's front and back (t) at length s and height z, or null. */
    across(s, z) { const h = hits(0, 2, 1, s, z); return h.length >= 2 ? [Math.min(...h), Math.max(...h)] : null; },
    /** The highest surface above (s, t). */
    top(s, t) { const h = hits(0, 1, 2, s, t); return h.length ? Math.max(...h) : null; },
  };
}

/** The wall's own frame: along its length (s), across its thickness (t) and up (z), with its top line and
 * its foot sampled along it (pre-break, for crenellate and rubble), and the s ranges other pieces block
 * (pillars and towers beside the wall). target: geoset index or selection (default: wallPiece). */
export function wallFrame(model, target) {
  const selection = asSelection(model, target ?? wallPiece(model)), tris = selectedTriangles(model, selection);
  if (!tris.length) throw Error('The wall selection has no whole triangles.');
  const pts = [];
  for (const [k, ids] of Object.entries(selection)) for (const v of ids) pts.push(position(model.Geosets[k], v));
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  let xx = 0, yy = 0, xy = 0;
  for (const p of pts) { xx += (p[0] - cx) ** 2; yy += (p[1] - cy) ** 2; xy += (p[0] - cx) * (p[1] - cy); }
  const angle = 0.5 * Math.atan2(2 * xy, xx - yy);
  let along = [Math.cos(angle), Math.sin(angle), 0];
  if (Math.abs(along[0]) >= Math.abs(along[1]) ? along[0] < 0 : along[1] < 0) along = mul(along, -1);
  const frame = { origin: [cx, cy, 0], along, across: [-along[1], along[0], 0] };
  const local = pts.map(p => toLocal(frame, p)), range = a => [Math.min(...local.map(p => p[a])), Math.max(...local.map(p => p[a]))];
  const [s0, s1] = range(0), [t0, t1] = range(1), [z0, z1] = range(2), ground = Math.max(z0, 0);
  Object.assign(frame, { s0, s1, t0, t1, z0, top: z1, ground, length: s1 - s0, thickness: t1 - t0, height: z1 - ground, selection });
  const probe = prober(model, tris, frame), n = 32, eps = Math.min(0.5, frame.length / 400);
  frame.topLine = []; frame.footLine = [];
  for (let i = 0; i <= n; i++) {
    const s = clamp(s0 + (frame.length * i) / n, s0 + eps, s1 - eps), mid = probe.across(s, ground + 1) || [t0, t1];
    const z = probe.top(s, (mid[0] + mid[1]) / 2) ?? z1, at = probe.across(s, z - 0.5) || probe.across(s, z - 2) || mid;
    frame.topLine.push([s, z, at[0], at[1]]); frame.footLine.push([s, mid[0], mid[1]]);
  }
  // Other pieces that reach the wall's top beside it (pillars, towers): no merlons there.
  frame.blocked = [];
  const chosen = new Set(Object.entries(selection).flatMap(([k, ids]) => ids.map(v => `${k}:${v}`)));
  for (const p of pieces(model, { withVertices: true, limit: 500 })) {
    if (p.vertices.every(v => chosen.has(`${p.geoset}:${v}`))) continue;
    const L = p.vertices.map(v => toLocal(frame, position(model.Geosets[p.geoset], v)));
    const lo = a => Math.min(...L.map(q => q[a])), hi = a => Math.max(...L.map(q => q[a]));
    if (hi(2) > ground + frame.height * 0.6 && hi(1) > t0 && lo(1) < t1 && hi(0) > s0 - 1 && lo(0) < s1 + 1) frame.blocked.push([lo(0), hi(0)]);
  }
  return frame;
}
const sampleLine = (line, s, k) => {
  if (s <= line[0][0]) return line[0][k];
  for (let i = 1; i < line.length; i++) if (s <= line[i][0]) { const a = line[i - 1], b = line[i], t = (s - a[0]) / (b[0] - a[0] || 1); return lerp(a[k], b[k], t); }
  return line.at(-1)[k];
};
/** The wall's top height at length s (from the frame's top line). */
export const topAt = (frame, s) => sampleLine(frame.topLine, s, 1);

/** The wall piece of a model: the piece that runs furthest along the ground (a pillar or tower is
 * taller than long). Returns its selection { [geoset]: vertexIds }. */
export function wallPiece(model) {
  const list = pieces(model, { withVertices: true, limit: 500 }).filter(p => p.triangles >= 4);
  if (!list.length) throw Error('The model has no pieces to break.');
  const span = p => Math.hypot(p.size[0], p.size[1]) * Math.min(1, p.size[2] / Math.max(1, Math.hypot(p.size[0], p.size[1])) + 0.5);
  const best = list.sort((a, b) => span(b) - span(a))[0];
  return { [best.geoset]: best.vertices };
}

// ---- the break line ---------------------------------------------------------------------------------
/** A stepped break outline in the wall's frame: [[s, z], ...] by length s and height z (model units),
 * z = Infinity where the wall stays whole. Breaks follow stone courses: risers are vertical, treads
 * nearly flat, block-sized and varied, never a smooth curve. from/to: where the breach starts and ends
 * (fractions of the length; 0 or 1 breaks the end down), low: the lowest height left (fraction of the
 * height above ground), jaggedness 0-1, seed, block: course height (default a sixth of the height, at most eight steps). */
export function breakLine(frame, { from = 0.3, to = 0.75, low = 0.4, jaggedness = 0.6, seed = 1, block } = {}) {
  if (!(to > from)) throw Error('A break needs to > from.');
  const r = random(seed), J = clamp(Number(jaggedness), 0, 1), H = frame.height, g = frame.ground;
  const sa = frame.s0 + clamp(from, 0, 1) * frame.length, sb = frame.s0 + clamp(to, 0, 1) * frame.length, W = sb - sa;
  const openStart = from <= 0.001, openEnd = to >= 0.999, zLow = g + clamp(low, 0.05, 0.95) * H;
  // Courses about a sixth of the height, but no more than eight steps in all: the doodad stays low-poly.
  const B = Number(block) > 0 ? Number(block) : Math.max(clamp(H / 6, 6, 28), (2 * (frame.top - zLow)) / 8);
  const vary = k => 1 + (r() * 2 - 1) * k * J;
  const ceiling = s => topAt(frame, s) - B * 0.45, floor = g + H * 0.08;
  const pts = [];
  // A flank of n treads from height z0 to z1 between s0 and s1, risers at each change.
  const flank = (s0, s1, z0, z1, n) => {
    const w = Array.from({ length: n }, () => vary(0.6)), total = w.reduce((a, b) => a + b, 0);
    let s = s0;
    for (let k = 0; k < n; k++) {
      const run = ((s1 - s0) * w[k]) / total, z = (n === 1 ? z0 : lerp(z0, z1, k / (n - 1))) + (k && k < n - 1 ? (r() * 2 - 1) * 0.3 * B * J : 0);
      const tilt = (r() * 2 - 1) * 0.22 * B * J, za = clamp(z - tilt / 2, floor, ceiling(s)), zb = clamp(z + tilt / 2, floor, ceiling(s + run));
      pts.push([s, za], [s + run, zb]);
      s += run;
    }
  };
  const left = openStart ? 0 : W * (0.3 + 0.15 * r()), right = openEnd ? 0 : W * (0.26 + 0.14 * r());
  // One tread per course: risers about one block high.
  const steps = (zTop, zBottom) => Math.max(1, Math.round((zTop - zBottom) / B) + 1);
  if (!openStart) {
    pts.push([sa, Infinity]);
    const z0 = ceiling(sa) - B * (0.5 + 0.6 * r());
    flank(sa, sa + left, z0, zLow + B * 0.6, steps(z0, zLow));
  }
  // The floor of the breach: one or two low treads with a notch.
  const fa = sa + left, fb = sb - right, floorSteps = fb - fa > B * 4 ? 2 : 1;
  flank(fa, fb, zLow + B * 0.25 * vary(1), zLow - B * 0.2 * vary(1), floorSteps);
  if (!openEnd) {
    const z1 = ceiling(sb) - B * (0.4 + 0.6 * r());
    flank(sb - right, sb, zLow + B * 0.6, z1, steps(z1, zLow));
    pts.push([sb, Infinity]);
  }
  // Join equal-height neighbours, drop zero-length treads.
  const out = [];
  for (const p of pts) { const q = out.at(-1); if (q && Math.abs(q[0] - p[0]) < 1e-6 && Math.abs(q[1] - p[1]) < 1e-6) continue; out.push(p); }
  return out;
}
/** A line given in fractions ([[s, z], ...], s of the length, z of the height above ground, z >= 1 intact) in model units. */
function lineFromFractions(frame, line) {
  if (!Array.isArray(line) || line.length < 2 || line.some(p => !Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite))) throw Error('line is [[s, z], ...] with at least two points, fractions of the wall.');
  const out = [];
  for (const [s, z] of line) out.push([frame.s0 + clamp(s, 0, 1) * frame.length, z >= 1 ? Infinity : frame.ground + clamp(z, 0, 1) * frame.height]);
  for (let i = 1; i < out.length; i++) if (out[i][0] < out[i - 1][0]) throw Error('line points go along the wall: s must not decrease.');
  // A slope into "intact" becomes a vertical riser at the cut point.
  const fixed = [out[0]];
  for (let i = 1; i < out.length; i++) {
    const a = fixed.at(-1), b = out[i];
    if (a[1] === Infinity && b[1] !== Infinity && b[0] > a[0]) fixed.push([b[0], Infinity]);
    if (b[1] === Infinity && a[1] !== Infinity && b[0] > a[0]) fixed.push([a[0], Infinity]);
    fixed.push(b);
  }
  return fixed;
}
// Treads: segments with a length; risers: equal-s neighbours.
function treads(line) {
  const out = [];
  for (let i = 1; i < line.length; i++) if (line[i][0] - line[i - 1][0] > 1e-6) out.push({ sa: line[i - 1][0], za: line[i - 1][1], sb: line[i][0], zb: line[i][1] });
  return out;
}
function lineRange(line, a, b) {
  let lo = Infinity, hi = -Infinity;
  const take = z => { lo = Math.min(lo, z); hi = Math.max(hi, z); };
  for (const p of line) if (p[0] >= a - 1e-6 && p[0] <= b + 1e-6) take(p[1]);
  for (const t of treads(line)) for (const s of [a, b]) if (s >= t.sa && s <= t.sb) take(t.za === Infinity ? Infinity : lerp(t.za, t.zb, (s - t.sa) / (t.sb - t.sa)));
  if (a < line[0][0] || b > line.at(-1)[0]) take(Infinity);
  return [lo, hi];
}

// ---- painting new faces from a looked-at area --------------------------------------------------------
function region(paint) {
  const uv = paint?.uv, size = Array.isArray(paint?.size) && paint.size.length === 2 ? paint.size.map(Number) : [256, 256];
  if (!paint?.sheet || !Array.isArray(uv) || uv.length !== 4 || uv.some(v => !Number.isFinite(v) || v < 0 || v > 1) || !(uv[2] > uv[0] && uv[3] > uv[1])) throw Error('Paint is { sheet, uv: [u0, v0, u1, v1], size: [w, h] }, an area you looked at.');
  return { sheet: String(paint.sheet).replaceAll('/', BS), uv: uv.map(Number), size };
}
/** UVs for one flat face (points in order) at density pixels per unit, placed at a random spot of the area.
 * Upright faces keep the paint upright (stone courses stay level); flat ones may turn to fit. */
function paintFace(points, normal, paint, density, r) {
  const { uv: [u0, v0, u1, v1], size: [W, H] } = paint, rw = (u1 - u0) * W, rh = (v1 - v0) * H;
  const upright = Math.abs(normal[2]) < 0.7;
  let e1 = upright ? norm(cross([0, 0, 1], normal)) : norm(sub(points[1], points[0]));
  if (!(len(e1) > 0.5)) e1 = [1, 0, 0];
  const e2 = norm(cross(normal, e1));
  let loc = points.map(p => [dot(sub(p, points[0]), e1), -dot(sub(p, points[0]), e2)]);
  const box = () => { const xs = loc.map(q => q[0]), ys = loc.map(q => q[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)]; };
  let [x0, y0, w, h] = box();
  const fit = (a, b) => Math.min(1, rw / Math.max(1e-6, a * density), rh / Math.max(1e-6, b * density));
  if (!upright && fit(h, w) > fit(w, h) + 1e-3) { loc = loc.map(([x, y]) => [y, -x]); [x0, y0, w, h] = box(); }
  const k = fit(w, h) * density, ox = r() * Math.max(0, rw - w * k), oy = r() * Math.max(0, rh - h * k);
  return loc.map(([x, y]) => [u0 + (ox + (x - x0) * k) / W, v0 + (oy + (y - y0) * k) / H]);
}
/** Texture pixels per unit the selected triangles are painted at (Blizzard's walls: about 0.65). */
export function paintDensity(model, target) {
  const selection = asSelection(model, target);
  let px = 0, area = 0;
  for (const { g, v } of selectedTriangles(model, selection)) {
    const geo = model.Geosets[g], tex = textureSize(model, g), [a, b, c] = v.map(i => position(geo, i)), uv = v.map(i => [geo.TVertices[0][i * 2] * tex[0], geo.TVertices[0][i * 2 + 1] * tex[1]]);
    area += len(cross(sub(b, a), sub(c, a))) / 2;
    px += Math.abs((uv[1][0] - uv[0][0]) * (uv[2][1] - uv[0][1]) - (uv[2][0] - uv[0][0]) * (uv[1][1] - uv[0][1])) / 2;
  }
  return area > 0 && px > 0 ? Math.sqrt(px / area) : 0.65;
}
// Game sheets used by walls are 256 square; others are assumed so unless the paint says otherwise.
const textureSize = () => [256, 256];

// ---- writing triangles back into geosets --------------------------------------------------------------
const sheetOf = (model, gi) => { const g = model.Geosets[gi], l = model.Materials?.[g.MaterialID]?.Layers?.[0], t = l && model.Textures?.[l.TextureID]; return t?.Image ? String(t.Image).replaceAll('/', BS).toLowerCase() : null; };
/** A geoset painted with sheet bound like geoset like (same bones): the same one when it shows that sheet. */
function geosetFor(model, sheet, like) {
  const key = sheet.toLowerCase();
  if (sheetOf(model, like) === key) return like;
  const groups = JSON.stringify(model.Geosets[like].Groups);
  const found = model.Geosets.findIndex((g, i) => sheetOf(model, i) === key && JSON.stringify(g.Groups) === groups && (model.Materials[g.MaterialID]?.Layers?.length === 1));
  if (found >= 0) return found;
  let textureId = model.Textures.findIndex(t => String(t.Image).replaceAll('/', BS).toLowerCase() === key);
  if (textureId < 0) textureId = model.Textures.push({ Image: sheet, ReplaceableId: 0, Flags: 0 }) - 1;
  const materialId = model.Materials.push({ PriorityPlane: 0, RenderMode: 0, Layers: [{ FilterMode: 0, Shading: 0, TextureID: textureId, TVertexAnimId: null, CoordId: 0, Alpha: 1 }] }) - 1;
  const base = model.Geosets[like], g = {
    Vertices: new Float32Array(0), Normals: new Float32Array(0), TVertices: [new Float32Array(0)], Faces: new Uint16Array(0), VertexGroup: new Uint8Array(0),
    Groups: structuredClone(base.Groups), TotalGroupsCount: base.TotalGroupsCount ?? base.Groups.flat().length, MaterialID: materialId, SelectionGroup: 0, Unselectable: false,
    Anims: (model.Sequences || []).map(() => ({ MinimumExtent: new Float32Array(3), MaximumExtent: new Float32Array(3), BoundsRadius: 0 })),
  };
  if ('LevelOfDetail' in base) g.LevelOfDetail = 0;
  const index = model.Geosets.push(g) - 1;
  if (model.Info) model.Info.NumGeosets = model.Geosets.length;
  return index;
}
/** Replace a geoset's triangles: keep (original face indices), plus new vertices { p, n, uv, from } and
 * triangles over them; unused vertices go. Per-vertex data not given is copied from vertex from. */
function rewrite(g, keep, verts, tris) {
  const n0 = g.Vertices.length / 3, n = n0 + verts.length, sets = g.TVertices.length || 1;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = Array.from({ length: sets }, () => new Float32Array(n * 2)), G = new Uint8Array(n);
  P.set(g.Vertices); N.set(g.Normals?.length === n0 * 3 ? g.Normals : new Float32Array(n0 * 3)); U.forEach((u, k) => u.set(g.TVertices[k] || new Float32Array(n0 * 2))); G.set(g.VertexGroup || new Uint8Array(n0));
  const extra = ['SkinWeights', 'Tangents'].filter(key => g[key]?.length).map(key => [key, g[key].length / n0, new g[key].constructor(n * (g[key].length / n0))]);
  for (const [key, w, arr] of extra) arr.set(g[key]);
  verts.forEach((v, i) => {
    const k = n0 + i, from = v.from ?? 0;
    P.set(v.p, k * 3); N.set(norm(v.n), k * 3); U.forEach((u, s) => u.set(s === 0 ? v.uv : [g.TVertices[s]?.[from * 2] ?? v.uv[0], g.TVertices[s]?.[from * 2 + 1] ?? v.uv[1]], k * 2));
    G[k] = v.group ?? G[from];
    for (const [key, w, arr] of extra) arr.set(g[key].subarray(from * w, from * w + w), k * w);
  });
  const faces = [...keep.flatMap(f => [g.Faces[f * 3], g.Faces[f * 3 + 1], g.Faces[f * 3 + 2]]), ...tris.flatMap(t => t.map(i => n0 + i))];
  // Compact: only vertices a triangle uses stay.
  const used = new Int32Array(n).fill(-1);
  let count = 0;
  for (const v of faces) if (used[v] < 0) used[v] = count++;
  if (count > 65535) throw Error('Too many vertices for one Warcraft geoset.');
  const order = new Int32Array(count);
  used.forEach((to, from) => { if (to >= 0) order[to] = from; });
  const pick = (src, w) => { const out = new src.constructor(count * w); order.forEach((from, to) => out.set(src.subarray(from * w, from * w + w), to * w)); return out; };
  g.Vertices = pick(P, 3); g.Normals = pick(N, 3); g.TVertices = U.map(u => pick(u, 2)); g.VertexGroup = pick(G, 1);
  for (const [key, w, arr] of extra) g[key] = pick(arr, w);
  g.Faces = Uint16Array.from(faces.map(v => used[v]));
  g.PrimitiveTypes = Uint32Array.of(4); g.PrimitiveCounts = Uint32Array.of(g.Faces.length);
  return g;
}
/** Append flat faces ({ points, normal, uv }) to the geoset painted with paint.sheet beside geoset like. */
function appendFaces(model, like, faces, paint) {
  if (!faces.length) return { geoset: null, triangles: 0 };
  const gi = geosetFor(model, paint.sheet, like), g = model.Geosets[gi], verts = [], tris = [];
  const group = model.Geosets[like].VertexGroup?.[0] ?? 0;
  for (const face of faces) {
    const base = verts.length;
    face.points.forEach((p, i) => verts.push({ p, n: face.normal, uv: face.uv[i], group: gi === like ? group : 0, from: 0 }));
    if (face.tris) for (const t of face.tris) tris.push(t.map(i => base + i));
    else for (let i = 1; i < face.points.length - 1; i++) tris.push([base, base + i, base + i + 1]);
  }
  rewrite(g, Array.from({ length: g.Faces.length / 3 }, (_, f) => f), verts, tris);
  return { geoset: gi, triangles: tris.length };
}
/** A flat face from its corners, wound to face outward (toward want). */
function face(points, want, paint, density, r) {
  let normal = norm(cross(sub(points[1], points[0]), sub(points[points.length - 1], points[0])));
  if (points.length > 3) { const n2 = norm(cross(sub(points[2], points[1]), sub(points[0], points[1]))); if (len(add(normal, n2)) < 0.1) normal = n2; }
  if (dot(normal, want) < 0) { points = points.slice().reverse(); normal = mul(normal, -1); }
  if (!(len(normal) > 0.5)) normal = norm(want);
  return { points, normal, uv: paintFace(points, normal, paint, density, r) };
}

// ---- breaking ---------------------------------------------------------------------------------------
/** Break a wall: cut its mesh along a stepped outline, remove what stood above it, and close the cut with
 * stone faces painted from a looked-at stone area at the wall's own paint density, so the broken top reads
 * solid from every side. target: a geoset index or selection (default: wallPiece). Options: line (fractions,
 * see the header) or from, to, low, jaggedness, seed, block for breakLine; stone: paint area for the cut
 * (default WALL_PAINT.stone when the wall wears Doodads1, else the wall's own sheet must be given).
 * Returns { frame, line, triangles: { removed, cut, faces }, geosets, density, stone, seed }; pass it to
 * crenellate and rubble. */
export function breakWall(model, target, options = {}) {
  const frame = options.frame || wallFrame(model, target), selection = frame.selection;
  const line = options.line ? lineFromFractions(frame, options.line) : breakLine(frame, options);
  const stone = region(options.stone || wallPaint('stone'));
  const tris = selectedTriangles(model, selection), probe = prober(model, tris, frame);
  const density = options.density || paintDensity(model, selection), r = random((options.seed ?? 1) * 7 + 3);
  const fine = line, slabs = [];
  for (const t of treads(fine)) {
    const last = slabs.at(-1);
    if (t.za === Infinity && last?.intact && Math.abs(last.sb - t.sa) < 1e-6) last.sb = t.sb;
    else slabs.push({ ...t, intact: t.za === Infinity });
  }
  // Beyond the line the wall stands whole (a line that starts or ends at the wall's end needs no such part).
  if (fine[0][0] > frame.s0 + 1e-3) slabs.unshift({ sa: -Infinity, sb: fine[0][0], intact: true });
  if (fine.at(-1)[0] < frame.s1 - 1e-3) slabs.push({ sa: fine.at(-1)[0], sb: Infinity, intact: true });
  const counts = { removed: 0, cut: 0, faces: 0 }, byGeoset = new Map();
  for (const tri of tris) {
    const g = model.Geosets[tri.g], verts = tri.v.map(i => ({ p: position(g, i), n: [g.Normals[i * 3], g.Normals[i * 3 + 1], g.Normals[i * 3 + 2]], uv: [g.TVertices[0][i * 2], g.TVertices[0][i * 2 + 1]], from: i }));
    const ss = verts.map(v => toLocal(frame, v.p)[0]), zs = verts.map(v => v.p[2]), [hLo, hHi] = lineRange(fine, Math.min(...ss), Math.max(...ss));
    const entry = byGeoset.get(tri.g) || byGeoset.set(tri.g, { drop: new Set(), verts: [], tris: [] }).get(tri.g);
    if (Math.max(...zs) <= hLo + 1e-4) continue;
    entry.drop.add(tri.f);
    if (Math.min(...zs) >= hHi - 1e-4) { counts.removed++; continue; }
    counts.cut++;
    // A face across the wall at one length (an end) belongs to one slab: where the line stands highest there.
    const flat = Math.max(...ss) - Math.min(...ss) < 1e-4, at = ss[0], zAt = slab => (slab.intact ? Infinity : lerp(slab.za, slab.zb, (at - slab.sa) / (slab.sb - slab.sa)));
    const own = flat ? slabs.filter(slab => at >= slab.sa - 1e-6 && at <= slab.sb + 1e-6).sort((x, y) => zAt(y) - zAt(x))[0] : null;
    for (const slab of flat ? [own].filter(Boolean) : slabs) {
      if (!flat && (slab.sb <= Math.min(...ss) || slab.sa >= Math.max(...ss))) continue;
      let poly = verts;
      if (slab.sa > -Infinity) poly = clip(poly, v => toLocal(frame, v.p)[0] - slab.sa);
      if (slab.sb < Infinity) poly = clip(poly, v => slab.sb - toLocal(frame, v.p)[0]);
      if (!slab.intact) poly = clip(poly, v => lerp(slab.za, slab.zb, (toLocal(frame, v.p)[0] - slab.sa) / (slab.sb - slab.sa)) - v.p[2]);
      if (poly.length < 3 || area(poly) < 1e-3) continue;
      const base = entry.verts.length;
      entry.verts.push(...poly);
      for (let i = 1; i < poly.length - 1; i++) if (area([poly[0], poly[i], poly[i + 1]]) > 1e-4) entry.tris.push([base, base + i, base + i + 1]);
    }
  }
  // Corners the cut left on the wall's faces, in the wall's frame: the stone faces run through every one,
  // so they meet the wall without slivers even where its faces bend.
  const corners = [...byGeoset.values()].flatMap(e => e.verts.map(v => toLocal(frame, v.p)));
  for (const [gi, e] of byGeoset) {
    const g = model.Geosets[gi];
    rewrite(g, Array.from({ length: g.Faces.length / 3 }, (_, f) => f).filter(f => !e.drop.has(f)), e.verts, e.tris);
  }
  // Close the cut: a stone face on every tread and riser, from the wall's front to its back.
  const capFaces = [], first = Number(Object.keys(selection)[0]), mid = (frame.t0 + frame.t1) / 2;
  const across = (s, z) => probe.across(s, z) || probe.across(s, z - 0.5) || probe.across(s + 0.3, z) || probe.across(s - 0.3, z);
  const cap = (points, key, want) => {
    const uniq = [];
    for (const q of points) if (q && !uniq.some(u => Math.hypot(u[0] - q[0], u[1] - q[1], u[2] - q[2]) < 0.02)) uniq.push(q);
    if (uniq.length < 3) return;
    // The outline in order around its middle (a cut face is a near-rectangle, so the angle orders it).
    const cx = uniq.reduce((s, q) => s + key(q), 0) / uniq.length, cy = uniq.reduce((s, q) => s + q[1], 0) / uniq.length;
    const loop = uniq.sort((a, b) => Math.atan2(a[1] - cy, key(a) - cx) - Math.atan2(b[1] - cy, key(b) - cx));
    const pts = loop.map(q => toWorld(frame, ...q)), flat = loop.map(q => [key(q), q[1]]);
    let tris = earClip(flat);
    if (!tris) tris = loop.slice(2).map((_, i) => [0, i + 1, i + 2]);
    const oriented = tris.filter(t => len(cross(sub(pts[t[1]], pts[t[0]]), sub(pts[t[2]], pts[t[0]]))) > 1e-4).map(t => (dot(cross(sub(pts[t[1]], pts[t[0]]), sub(pts[t[2]], pts[t[0]])), want) < 0 ? [t[0], t[2], t[1]] : t));
    if (oriented.length) capFaces.push({ points: pts, normal: want, tris: oriented, uv: paintFace(pts, want, stone, density, r) });
  };
  const on = (q, s0, s1, z) => q[0] >= s0 - 1e-3 && q[0] <= s1 + 1e-3 && Math.abs(q[2] - z(q[0])) < 1e-3;
  // The cut's own corners first; a probed corner only where the cut left none near it.
  const withEnds = (found, ends) => [...found, ...ends.filter(e => e && !found.some(c => Math.hypot(c[0] - e[0], c[1] - e[1], c[2] - e[2]) < 0.5))];
  for (const t of treads(fine)) {
    if (t.za === Infinity || t.zb === Infinity) continue;
    const z = s => lerp(t.za, t.zb, (s - t.sa) / (t.sb - t.sa)), a = across(t.sa, t.za), b = across(t.sb, t.zb);
    const ends = [a && [t.sa, a[0], t.za], a && [t.sa, a[1], t.za], b && [t.sb, b[0], t.zb], b && [t.sb, b[1], t.zb]];
    const dir = norm(add(mul(frame.along, t.sb - t.sa), [0, 0, t.zb - t.za])), want = norm(cross(dir, frame.across));
    cap(withEnds(corners.filter(q => on(q, t.sa, t.sb, z)), ends), q => q[0], want[2] < 0 ? mul(want, -1) : want);
  }
  for (let i = 1; i < fine.length; i++) {
    const [s, za] = fine[i - 1], zb = fine[i][1];
    if (Math.abs(fine[i][0] - s) > 1e-6 || za === zb) continue;
    const lo = Math.min(za, zb), hi = Math.min(Math.max(za, zb), probe.top(s, mid) ?? topAt(frame, s));
    if (!(hi - lo > 0.5)) continue;
    const a = across(s, lo), b = across(s, hi - 0.01) || across(s, hi - 1);
    const ends = [a && [s, a[0], lo], a && [s, a[1], lo], b && [s, b[0], hi], b && [s, b[1], hi]];
    // The riser shows on the side that fell: it faces toward the lower tread.
    cap(withEnds(corners.filter(q => Math.abs(q[0] - s) < 1e-3 && q[2] >= lo - 1e-3 && q[2] <= hi + 1e-3), ends), q => q[2], za > zb ? frame.along : mul(frame.along, -1));
  }
  const capped = appendFaces(model, first, capFaces, stone);
  counts.faces = capped.triangles;
  finish(model);
  return { frame, line: fine, triangles: counts, geosets: [...new Set([...byGeoset.keys(), capped.geoset].filter(i => i != null))], density, stone, seed: options.seed ?? 1, like: first };
}
/** Triangles of a simple 2D outline (either winding) by ear clipping; corners lying on an edge are kept, so
 * neighbouring faces meet them without T-junction gaps. null when the outline cannot be clipped. */
function earClip(points) {
  let signed = 0;
  for (let i = 0; i < points.length; i++) { const p = points[i], q = points[(i + 1) % points.length]; signed += p[0] * q[1] - q[0] * p[1]; }
  const P = signed < 0 ? points.map(([x, y]) => [x, -y]) : points, cr = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const idx = P.map((_, i) => i), out = [];
  while (idx.length > 3) {
    let clipped = false;
    for (let i = 0; i < idx.length && !clipped; i++) {
      const a = idx[(i + idx.length - 1) % idx.length], b = idx[i], c = idx[(i + 1) % idx.length];
      if (cr(P[a], P[b], P[c]) <= 1e-9) continue;
      if (idx.some(k => k !== a && k !== b && k !== c && cr(P[a], P[b], P[k]) > -1e-9 && cr(P[b], P[c], P[k]) > -1e-9 && cr(P[c], P[a], P[k]) > -1e-9)) continue;
      out.push([a, b, c]); idx.splice(i, 1); clipped = true;
    }
    if (!clipped) return null;
  }
  if (cr(P[idx[0]], P[idx[1]], P[idx[2]]) > 1e-9) out.push(idx.slice());
  return out;
}
const area = poly => { let s = [0, 0, 0]; for (let i = 1; i < poly.length - 1; i++) s = add(s, cross(sub(poly[i].p, poly[0].p), sub(poly[i + 1].p, poly[0].p))); return len(s) / 2; };
/** Sutherland-Hodgman: the part of a convex polygon where f >= 0, corners interpolated (position, normal, uv). */
function clip(poly, f) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], fa = f(a), fb = f(b), ina = fa >= -1e-6, inb = fb >= -1e-6;
    if (ina) out.push(a);
    if (ina !== inb && Math.abs(fa - fb) > 1e-12) {
      const t = clamp(fa / (fa - fb), 0, 1);
      out.push({ p: a.p.map((x, k) => lerp(x, b.p[k], t)), n: norm(a.n.map((x, k) => lerp(x, b.n[k], t))), uv: [lerp(a.uv[0], b.uv[0], t), lerp(a.uv[1], b.uv[1], t)], from: t < 0.5 ? a.from : b.from });
    }
  }
  // Drop corners that repeat.
  return out.filter((p, i) => len(sub(p.p, out[(i + 1) % out.length].p)) > 1e-5);
}

// ---- crenellations ----------------------------------------------------------------------------------
/** Merlons on the parts of a wall's top still standing (not over the breach, not where a pillar stands).
 * cut: the breakWall result (or { frame, line } of an unbroken wall: line [[s0, Infinity], [s1, Infinity]]).
 * merlon: [width, height] (default 0.16 and 0.2 of the wall's height), gap: the crenel between them,
 * side/top: paint areas (default WALL_PAINT stone and cap). The first merlon stands flush at the break. */
export function crenellate(model, cut, { merlon, gap, side, top, seed } = {}) {
  const frame = cut.frame || cut, H = frame.height, line = cut.line || [[frame.s0, Infinity], [frame.s1, Infinity]];
  const [mw, mh] = Array.isArray(merlon) ? merlon.map(Number) : [clamp(H * 0.16, 10, 30), clamp(H * 0.2, 10, 36)], cw = Number(gap) > 0 ? Number(gap) : mw * 0.7;
  const sidePaint = region(side || wallPaint('stone')), topPaint = region(top || wallPaint('cap')), density = cut.density || 0.65, r = random((seed ?? cut.seed ?? 1) * 13 + 5);
  // Standing stretches: outside the cut part of the line, minus blocked (pillar) spans.
  const cutS = line.filter(p => p[1] !== Infinity).map(p => p[0]), standing = [];
  const lo = cutS.length ? Math.min(...cutS) : Infinity, hi = cutS.length ? Math.max(...cutS) : -Infinity;
  if (lo > frame.s0) standing.push([frame.s0, Math.min(lo, frame.s1), 'end']);
  if (hi < frame.s1) standing.push([Math.max(hi, frame.s0), frame.s1, 'start']);
  if (!cutS.length) standing.splice(0, standing.length, [frame.s0, frame.s1, 'none']);
  const spans = [];
  for (const [a, b, flush] of standing) {
    let parts = [[a, b]];
    for (const [x, y] of frame.blocked || []) parts = parts.flatMap(([p, q]) => (y <= p || x >= q ? [[p, q]] : [[p, x], [y, q]].filter(([m, n]) => n - m > 1)));
    for (const [p, q] of parts) spans.push({ a: p, b: q, flush: (flush === 'end' && Math.abs(q - Math.min(lo, frame.s1)) < 1e-3) ? 'end' : (flush === 'start' && Math.abs(p - Math.max(hi, frame.s0)) < 1e-3) ? 'start' : 'none' });
  }
  const faces = [];
  let count = 0;
  for (const { a, b, flush } of spans) {
    const n = Math.floor((b - a + cw) / (mw + cw));
    if (n < 1) continue;
    const used = n * mw + (n - 1) * cw, start = flush === 'start' ? a : flush === 'end' ? b - used : a + (b - a - used) / 2;
    for (let k = 0; k < n; k++) {
      // Set a little into the wall's top, so no seam shows under a merlon on a sloping top.
      const m0 = start + k * (mw + cw), m1 = m0 + mw, z0 = topAt(frame, m0) - mh * 0.06, z1 = topAt(frame, m1) - mh * 0.06;
      const t0 = sampleLine(frame.topLine, m0, 2), t1 = sampleLine(frame.topLine, m0, 3), u0 = sampleLine(frame.topLine, m1, 2), u1 = sampleLine(frame.topLine, m1, 3);
      const P = (s, t, z) => toWorld(frame, s, t, z), h = mh * (1 + (r() * 2 - 1) * 0.06);
      const c = { a: P(m0, t0, z0), b: P(m0, t1, z0), c: P(m1, u1, z1), d: P(m1, u0, z1), A: P(m0, t0, z0 + h), B: P(m0, t1, z0 + h), C: P(m1, u1, z1 + h), D: P(m1, u0, z1 + h) };
      const out = mul(frame.across, -1);
      faces.push({ paint: sidePaint, f: face([c.a, c.d, c.D, c.A], out, sidePaint, density, r) });
      faces.push({ paint: sidePaint, f: face([c.b, c.B, c.C, c.c], frame.across, sidePaint, density, r) });
      faces.push({ paint: sidePaint, f: face([c.a, c.A, c.B, c.b], mul(frame.along, -1), sidePaint, density, r) });
      faces.push({ paint: sidePaint, f: face([c.d, c.c, c.C, c.D], frame.along, sidePaint, density, r) });
      faces.push({ paint: topPaint, f: face([c.A, c.D, c.C, c.B], [0, 0, 1], topPaint, density, r) });
      count++;
    }
  }
  const like = cut.like ?? Number(Object.keys(frame.selection)[0]);
  let triangles = 0;
  const geosets = [];
  for (const p of [sidePaint, topPaint].filter((p, i, all) => all.findIndex(q => q.sheet.toLowerCase() === p.sheet.toLowerCase()) === i)) {
    const result = appendFaces(model, like, faces.filter(f => f.paint.sheet.toLowerCase() === p.sheet.toLowerCase()).map(f => f.f), p);
    triangles += result.triangles; if (result.geoset != null) geosets.push(result.geoset);
  }
  finish(model);
  return { merlons: count, triangles, geosets, merlon: [mw, mh], gap: cw };
}

// ---- rubble -----------------------------------------------------------------------------------------
/** A few low-poly stone chunks (4-10 triangles each: blocks, wedges, shards; varied, flat-cut, sunk into the
 * ground) at the foot of a breach, on both sides, plus one resting on the breach floor. cut: the breakWall
 * result (or a wallFrame and line). count, seed, size (default a fifth of the wall's height), spread (1 = the
 * breach's width), stone: paint area (default WALL_PAINT.stone), onTop: chunks on the broken top (default 1). */
export function rubble(model, cut, { count = 7, seed, size, spread = 1, stone, onTop = 1 } = {}) {
  const frame = cut.frame || cut, line = cut.line || [[frame.s0, frame.ground], [frame.s1, frame.ground]], H = frame.height;
  const paint = region(stone || cut.stone || wallPaint('stone')), density = cut.density || 0.65, r = random((seed ?? cut.seed ?? 1) * 31 + 11);
  const cutPts = line.filter(p => p[1] !== Infinity), sa = cutPts.length ? cutPts[0][0] : frame.s0, sb = cutPts.length ? cutPts.at(-1)[0] : frame.s1;
  const mid = (sa + sb) / 2, half = Math.max(frame.length * 0.08, ((sb - sa) / 2) * 0.8 * spread), S = Number(size) > 0 ? Number(size) : clamp(H / 5, 6, 36);
  const placed = [], faces = [];
  const chunk = (at, kind, dims, turn, tilt, raise = 0) => {
    const [w, d, h] = dims, j = () => (r() * 2 - 1) * 0.14;
    const base = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([x, y]) => [x * (1 + j()), y * (1 + j())]);
    let corners, list;
    if (kind === 'block') {
      const tops = base.map(([x, y]) => [x * (0.86 + r() * 0.1), y * (0.86 + r() * 0.1), h * (0.75 + r() * 0.35)]);
      corners = [...base.map(([x, y]) => [x, y, 0]), ...tops];
      list = [[4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
    } else if (kind === 'wedge') {
      const shift = (r() * 2 - 1) * d * 0.25, ridge = [[-w / 2 * 0.9, shift, h * (0.8 + r() * 0.3)], [w / 2 * 0.9, shift, h * (0.7 + r() * 0.3)]];
      corners = [...base.map(([x, y]) => [x, y, 0]), ...ridge];
      list = [[0, 1, 5, 4], [2, 3, 4, 5], [3, 0, 4], [1, 2, 5]];
    } else {
      corners = [...base.map(([x, y]) => [x, y, 0]), [(r() * 2 - 1) * w * 0.2, (r() * 2 - 1) * d * 0.2, h]];
      list = [[0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4]];
    }
    // Turn about Z, tip about the chunk's own long axis, sink a little into the ground.
    const ct = Math.cos(tilt), st = Math.sin(tilt), cz = Math.cos(turn), sz = Math.sin(turn);
    let pts = corners.map(([x, y, z]) => { const [y2, z2] = [y * ct - z * st, y * st + z * ct]; return [x * cz - y2 * sz, x * sz + y2 * cz, z2]; });
    // The open base goes wholly under the ground (or onto the stone it rests on): no gap shows beneath.
    const baseTop = Math.max(...pts.slice(0, 4).map(p => p[2])), drop = baseTop + h * (raise ? 0.22 : 0.06 + r() * 0.1);
    pts = pts.map(p => add(at, [p[0], p[1], p[2] - drop + raise]));
    const center = pts.reduce((s, p) => add(s, mul(p, 1 / pts.length)), [0, 0, 0]);
    for (const ids of list) {
      const q = ids.map(i => pts[i]), mid3 = q.reduce((s, p) => add(s, mul(p, 1 / q.length)), [0, 0, 0]);
      faces.push(face(q, norm(sub(mid3, center)), paint, density, r));
    }
  };
  const kinds = ['block', 'wedge', 'block', 'shard', 'wedge', 'block', 'shard', 'block', 'wedge'];
  for (let i = 0, tries = 0; i < count && tries < count * 40; tries++) {
    const big = i < Math.ceil(count / 3), k = (big ? 1.15 : 0.7) * (0.8 + r() * 0.4) * S;
    const dims = [k * (1.0 + r() * 0.45), k * (0.75 + r() * 0.3), k * (0.6 + r() * 0.3)];
    const s = clamp(mid + (r() + r() - 1) * half, frame.s0 + dims[0] * 0.3, frame.s1 - dims[0] * 0.3);
    const side = i % 2 ? 1 : -1, faceT = side > 0 ? sampleLine(frame.footLine, s, 2) : sampleLine(frame.footLine, s, 1);
    const t = faceT + side * (dims[1] * 0.3 + r() * k * 0.8);
    const at = toWorld(frame, s, t, frame.ground), rad = Math.max(dims[0], dims[1]) * 0.42;
    if (placed.some(p => Math.hypot(p.at[0] - at[0], p.at[1] - at[1]) < (p.rad + rad) * 0.8)) continue;
    placed.push({ at, rad });
    chunk(at, kinds[i % kinds.length], dims, r() * Math.PI * 2, (r() * 2 - 1) * 0.2);
    i++;
  }
  // Stones still lying on the broken top: on the longest low tread.
  const low = treads(line).filter(t => t.za !== Infinity && t.zb !== Infinity).sort((x, y) => (y.sb - y.sa) - (x.sb - x.sa)).slice(0, onTop);
  for (const t of low) {
    const s = lerp(t.sa, t.sb, 0.35 + r() * 0.3), z = lerp(t.za, t.zb, (s - t.sa) / (t.sb - t.sa)), th = sampleLine(frame.footLine, s, 2) - sampleLine(frame.footLine, s, 1);
    const k = Math.min(S * 0.8, (t.sb - t.sa) * 0.45, th * 0.5);
    if (k > 3) chunk(toWorld(frame, s, (sampleLine(frame.footLine, s, 1) + sampleLine(frame.footLine, s, 2)) / 2 + (r() * 2 - 1) * th * 0.12, 0), 'wedge', [k * 1.3, k * 0.9, k * 0.6], r() * Math.PI, 0, z + k * 0.12);
  }
  const result = appendFaces(model, cut.like ?? Number(Object.keys(frame.selection)[0]), faces, paint);
  finish(model);
  return { chunks: placed.length + low.length, triangles: result.triangles, geoset: result.geoset };
}

// ---- a wall from native paint -----------------------------------------------------------------------------
/** A Lordaeron-style stone wall along Y built in native paint the way Blizzard maps its walls: battered
 * front and back in sections of about 110 units, each wearing the whole face area (arch panel, stone
 * courses, moss foot), the cap stones on top, the end strip on the ends; sunk 20 below the ground.
 * length, height (above ground), thickness (at the foot), batter (how much narrower the top is, 0-0.6),
 * paint: { face, cap, end } areas (default WALL_PAINT). Returns { geoset, frame target }. */
export function kitWall(model, { length = 300, height = 150, thickness = 60, batter = 0.3, sunk = 20, paint = {} } = {}) {
  if (![length, height, thickness].every(v => Number.isFinite(v) && v > 0)) throw Error('kitWall needs a positive length, height and thickness.');
  const P = { face: region(paint.face || wallPaint('face')), cap: region(paint.cap || wallPaint('cap')), end: region(paint.end || wallPaint('end')) };
  const sections = Math.max(1, Math.round(length / 110)), y0 = -length / 2, tb = thickness / 2, tt = (thickness * (1 - clamp(batter, 0, 0.6))) / 2, zb = -sunk, zt = height;
  const verts = [], tris = [];
  const quad = (pts, uvs, n) => {
    const b = verts.length, flip = dot(cross(sub(pts[1], pts[0]), sub(pts[3], pts[0])), n) < 0;
    pts.forEach((p, i) => verts.push({ p, n, uv: uvs[i] }));
    tris.push(...(flip ? [[b, b + 2, b + 1], [b, b + 3, b + 2]] : [[b, b + 1, b + 2], [b, b + 2, b + 3]]));
  };
  const [fu0, fv0, fu1, fv1] = P.face.uv, [cu0, cv0, cu1, cv1] = P.cap.uv, [eu0, ev0, eu1, ev1] = P.end.uv;
  const slope = norm([tb - tt, 0, zt - zb]);
  for (let k = 0; k < sections; k++) {
    const a = y0 + (length * k) / sections, b = y0 + (length * (k + 1)) / sections;
    // Front (-X) and back (+X): the whole face area per section, upright.
    quad([[-tb, a, zb], [-tb, b, zb], [-tt, b, zt], [-tt, a, zt]], [[fu0, fv1], [fu1, fv1], [fu1, fv0], [fu0, fv0]], [-slope[2], 0, slope[0]]);
    quad([[tb, b, zb], [tb, a, zb], [tt, a, zt], [tt, b, zt]], [[fu0, fv1], [fu1, fv1], [fu1, fv0], [fu0, fv0]], [slope[2], 0, slope[0]]);
    // Top: the cap stones run along the wall.
    quad([[-tt, a, zt], [-tt, b, zt], [tt, b, zt], [tt, a, zt]], [[cu0, cv1], [cu1, cv1], [cu1, cv0], [cu0, cv0]], [0, 0, 1]);
  }
  quad([[tb, y0, zb], [-tb, y0, zb], [-tt, y0, zt], [tt, y0, zt]], [[eu0, ev1], [eu1, ev1], [eu1, ev0], [eu0, ev0]], [0, -1, 0]);
  quad([[-tb, -y0, zb], [tb, -y0, zb], [tt, -y0, zt], [-tt, -y0, zt]], [[eu0, ev1], [eu1, ev1], [eu1, ev0], [eu0, ev0]], [0, 1, 0]);
  const mesh = { Vertices: new Float32Array(verts.flatMap(v => v.p)), Normals: new Float32Array(verts.flatMap(v => norm(v.n))), TVertices: [new Float32Array(verts.flatMap(v => v.uv))], Faces: new Uint16Array(tris.flat()) };
  const hadBones = (model.Bones || []).length, committed = commitForge(model, { geosets: [mesh] }, { texturePath: P.face.sheet });
  const index = committed.geosetIndices[0], layer = model.Materials[model.Geosets[index].MaterialID].Layers[0];
  layer.FilterMode = 0; layer.Shading = 0;
  // A doodad's one bone carries the model's name, as Blizzard's do.
  if (!hadBones) { const bone = model.Bones.find(b => b.ObjectId === committed.boneId); if (bone) bone.Name = model.Info?.Name || 'Wall'; }
  finish(model);
  return { geoset: index, selection: { [index]: allIds(model.Geosets[index]) } };
}

// ---- doodad conventions ---------------------------------------------------------------------------
/** Make the model a placeable doodad as Blizzard ships them: one looping Stand (kept from the first stand
 * sequence, or made 3333 long), no Death, death dust or sounds (emitters and events go unless keepEffects),
 * no empty animation tracks, no unused sheets, bounds refreshed. name sets the model's name. */
export function makeDoodad(model, { name, keepEffects = false, length = 3333 } = {}) {
  const sequences = model.Sequences || [];
  let keep = sequences.findIndex(s => /^stand/i.test(s.Name || ''));
  for (let i = sequences.length - 1; i >= 0; i--) if (i !== keep) { deleteSequence(model, i); if (i < keep) keep--; }
  if (!model.Sequences?.length) { createSequence(model, length); keep = 0; }
  const stand = model.Sequences[0];
  stand.Name = 'Stand'; stand.NonLooping = false;
  if (!keepEffects) for (const key of ['ParticleEmitters', 'ParticleEmitters2', 'RibbonEmitters', 'EventObjects', 'ParticleEmitterPopcorns'])
    for (const node of [...(model[key] || [])]) { model.Nodes ||= []; deleteNode(model, node.ObjectId); }
  // Tracks the removed sequences emptied.
  const statics = { Alpha: 1, Color: null };
  const clean = (owner, isGeosetAnim) => {
    for (const [key, value] of Object.entries(owner)) {
      if (!value || typeof value !== 'object' || ArrayBuffer.isView(value) || !Array.isArray(value.Keys) || value.Keys.length) continue;
      if (isGeosetAnim && key === 'Color') owner.Color = new Float32Array([1, 1, 1]);
      else if (key in statics && statics[key] != null) owner[key] = statics[key];
      else delete owner[key];
    }
  };
  for (const key of ['Bones', 'Helpers', 'Attachments', 'Lights', 'Cameras', 'CollisionShapes']) for (const node of model[key] || []) clean(node, false);
  for (const anim of model.GeosetAnims || []) clean(anim, true);
  for (const material of model.Materials || []) for (const layer of material.Layers || []) clean(layer, false);
  pruneTextures(model);
  if (name) { model.Info ||= {}; model.Info.Name = String(name); }
  finish(model);
  return { sequence: 'Stand', interval: Array.from(model.Sequences[0].Interval) };
}
/** Drop sheets nothing uses any more (the death dust's clouds, for one), renumbering the rest. */
function pruneTextures(model) {
  const layers = (model.Materials || []).flatMap(m => m.Layers || []);
  if (layers.some(l => typeof l.TextureID === 'object' && l.TextureID)) return;
  const used = new Set([...layers.map(l => l.TextureID), ...['ParticleEmitters2', 'RibbonEmitters', 'ParticleEmitterPopcorns'].flatMap(k => (model[k] || []).map(e => e.TextureID))].filter(Number.isInteger));
  const map = new Map();
  model.Textures = (model.Textures || []).filter((t, i) => { if (!used.has(i)) return false; map.set(i, map.size); return true; });
  for (const l of layers) if (Number.isInteger(l.TextureID)) l.TextureID = map.get(l.TextureID) ?? 0;
  for (const k of ['ParticleEmitters2', 'RibbonEmitters', 'ParticleEmitterPopcorns']) for (const e of model[k] || []) if (Number.isInteger(e.TextureID)) e.TextureID = map.get(e.TextureID) ?? 0;
}
// Bounds of a static doodad: every sequence and geoset animation gets the model's own.
function finish(model) {
  if (!model.Info) return;
  recalculateExtents(model);
  const box = g => ({ MinimumExtent: Float32Array.from(g.MinimumExtent), MaximumExtent: Float32Array.from(g.MaximumExtent), BoundsRadius: g.BoundsRadius });
  for (const g of model.Geosets || []) g.Anims = (model.Sequences || []).map(() => box(g));
  for (const s of model.Sequences || []) Object.assign(s, box(model.Info));
}

// ---- checking --------------------------------------------------------------------------------------
/** The doodad's numbers next to the native walls: triangles, sheets, size (x, y, z), height above ground,
 * sequences, bones, file size (pass bytes, the saved MDX) and checks, each { name, passed, actual, expected }. */
export function doodadReport(model, { bytes } = {}) {
  const geosets = model.Geosets || [], triangles = geosets.reduce((s, g) => s + g.Faces.length / 3, 0);
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const g of geosets) for (let v = 0; v < g.Vertices.length / 3; v++) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], g.Vertices[v * 3 + a]); hi[a] = Math.max(hi[a], g.Vertices[v * 3 + a]); }
  const size = lo.map((l, a) => Math.round(hi[a] - l)), height = Math.round(hi[2] - Math.max(0, lo[2])), length = Math.max(size[0], size[1]);
  const sheets = [...new Set(geosets.map(g => (model.Materials[g.MaterialID]?.Layers || []).map(l => model.Textures[l.TextureID]?.Image || `replaceable ${model.Textures[l.TextureID]?.ReplaceableId}`)).flat())];
  const sequences = (model.Sequences || []).map(s => s.Name), kb = bytes ? Math.round((bytes.length / 1024) * 10) / 10 : null;
  const R = DOODAD_RANGE, checks = [
    { name: 'MDX 800', passed: model.Version === 800, actual: model.Version, expected: 800 },
    { name: 'One Stand sequence', passed: sequences.length === 1 && sequences[0] === 'Stand', actual: sequences.join(', ') || 'none', expected: 'Stand' },
    { name: 'Triangles in the native wall and ruin range', passed: triangles >= R.triangles[0] && triangles <= R.triangles[1], actual: triangles, expected: R.triangles.join('-') },
    { name: 'Native game sheets only', passed: sheets.length > 0 && sheets.length <= R.sheets && sheets.every(s => /\.blp$/i.test(s) && !/mdlxl_/i.test(s)), actual: sheets.join(', '), expected: `1-${R.sheets} game .blp sheets` },
    { name: 'Height next to a Footman (98)', passed: height >= R.height[0] && height <= R.height[1], actual: height, expected: R.height.join('-') },
    { name: 'Length like native walls', passed: length >= R.length[0] && length <= R.length[1], actual: length, expected: R.length.join('-') },
    { name: 'No emitters, sounds or lights', passed: !['ParticleEmitters', 'ParticleEmitters2', 'RibbonEmitters', 'EventObjects', 'Lights'].some(k => model[k]?.length), actual: ['ParticleEmitters2', 'EventObjects'].map(k => model[k]?.length || 0).join('/'), expected: 'none' },
  ];
  if (kb != null) checks.push({ name: 'File size like native walls', passed: kb >= R.kb[0] && kb <= R.kb[1], actual: `${kb} KB`, expected: `${R.kb.join('-')} KB` });
  return { triangles, geosets: geosets.length, sheets, size, height, length, sequences, bones: (model.Bones || []).length, kb, checks, passed: checks.every(c => c.passed) };
}

// ---- the recipe -------------------------------------------------------------------------------------
/** A broken castle wall in one go. base: a native wall model (preferred; NATIVE_WALLS lists them, stonewall02
 * by default in the recipe) adopted into the model, or none to build one with kitWall from native paint
 * (length, height, thickness). scale (a number or [x, y, z]) reshapes the adopted wall about its ground
 * centre first, its own paint stretching with it (keep it within 0.8-1.4). Then breakWall (from, to, low,
 * jaggedness, seed, line), crenellate (merlons: false to skip, or its options), rubble (rubble: count, 0 to
 * skip) and makeDoodad (name). Returns the steps' results and doodadReport. The model should be empty or the
 * base itself; everything in it becomes the doodad. */
export function brokenCastleWall(model, { base, wall, name = 'BrokenCastleWall', from = 0.3, to = 0.7, low = 0.3, jaggedness = 0.6, seed = 1, line, merlons = true, rubble: chunks = 7, stone, scale, ...kit } = {}) {
  if (base) adopt(model, base);
  else { model.Info ||= {}; model.Info.Name = name; kitWall(model, kit); }
  if (scale != null) {
    const k = typeof scale === 'number' ? [scale, scale, scale] : Array.from(scale, Number);
    if (k.length !== 3 || k.some(v => !(v > 0.2 && v < 5))) throw Error('scale is a number or [x, y, z] between 0.2 and 5.');
    for (const g of model.Geosets) transformVertices(g, allIds(g), [0, 0, 0], k, [0, 0, 0], [0, 0, 0]);
    for (const p of model.PivotPoints || []) if (p?.length === 3) for (let a = 0; a < 3; a++) p[a] *= k[a];
  }
  makeDoodad(model, { name });
  const target = wall || wallPiece(model);
  const cut = breakWall(model, target, { from, to, low, jaggedness, seed, line, stone });
  const crenels = merlons ? crenellate(model, cut, typeof merlons === 'object' ? merlons : {}) : null;
  const fallen = chunks > 0 ? rubble(model, cut, { count: chunks, seed, stone }) : null;
  finish(model);
  return { cut: { line: cut.line, triangles: cut.triangles, density: cut.density }, merlons: crenels, rubble: fallen, report: doodadReport(model) };
}
