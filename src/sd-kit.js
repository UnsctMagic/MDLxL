/** SD Kit: solid Warcraft III SD parts from a few shape calls, in native game paint or hand-painted.
 * Each shape is a closed solid, smooth-shaded inside (smooth: 0 keeps facets); hard breaks come from
 * separate pieces, the HQSD way. commit() maps native parts onto their game texture areas and packs
 * painted parts into one texture painted like SD: light from above, dark creases, bright rims, a
 * limited palette. Z is up; units face +X. Rotations are degrees, applied X, Y, then Z.
 *
 * Paint: native: { sheet, uv: [u0, v0, u1, v1] (top-left origin), size?: [w, h] pixels, tint?: [r, g, b],
 * team?: true } is a palette area you looked at first (mdlxl_assets preview); each UV island of the part
 * is fitted into it, long side along its long side. Or material: an SD_MATERIALS name painted by the kit.
 *
 * Recipes (sizes in Warcraft units; a Footman is 98 tall, a held sword 80-120 long):
 *   const kit = await api.module('sd-kit'), b = kit.builder();
 *   // HQSD sword standing on its pommel: a slab blade with a separate thin bright edge (points, hooked tip,
 *   // back teeth; kit.corners(outline) shows no square steps), a pointed guard with a layered trim, grip, pommel.
 *   const blade = kit.shapes.pointedBlade(20, 84, { tip: 0.27, flare: 0.22, hook: 0.3, teeth: 3, toothDepth: 5 });
 *   b.edged({ outline: blade, depth: 4, at: [0, 0, 31], rotate: [90, 0, 90], native: darkIron, edge: { native: brightSteel, width: 3 } });
 *   const guard = [[-17, 2.5], [-11, -0.5], [-5, -3], [0, -8], [5, -3], [11, -0.5], [17, 2.5], [10, 4.5], [3, 3.6], [0, 6.5], [-3, 3.6], [-10, 4.5]];
 *   b.extrude({ outline: guard, depth: 6, bevel: 1, at: [0, 0, 28], rotate: [90, 0, 90], native: darkIron });
 *   b.trim({ outline: guard, width: 1.6, depth: 7.2, at: [0, 0, 28], rotate: [90, 0, 90], native: goldStrip });
 *   b.emblem({ shape: 'skull', width: 7, height: 7.5, radius: 3.3, z: 29, bevel: 0, native: skullPaint });
 *   b.lathe({ profile: [[2.5, 7], [2.9, 15], [2.6, 25]], segments: 5, native: leatherWrap });
 *   b.spike({ from: [0, 0, 7], to: [0, 0, -7], radius: 3.4, sides: 4, native: ivory });
 *   // Chalice: hollow cup (profile up the outside, back down the inside), rim spikes, an eye set in the bowl.
 *   b.lathe({ profile: [[13,0],[12,4],[4,9],[3,24],[12,38],[16,52],[14,52],[11,44],[0,34]], material: 'blackIron', pattern: 'runes', patternMaterial: 'fire', patternAt: [45, 50] });
 *   for (const a of kit.angles(7)) b.spike({ from: kit.around(15, a, 50), to: kit.around(19, a, 62), radius: 2, material: 'blackIron' });
 *   b.emblem({ shape: 'almond', width: 11, height: 6, radius: 12.5, angle: 0, z: 40, tilt: 15, material: 'fire', pattern: 'slitEye' });
 *   // Shield: extrude kit.shapes.shield(w, h) facing +X, a trim on the same outline, a boss or emblem.
 *   // Helmet: a lathe dome (profile from the brim up), a crest extrude, horns as spikes, a trim at the brim.
 *   // Saw points along any outline: kit.serrate(outline, from, to, { teeth, depth }).
 *   return b.commit(model, { name: 'BrutalSword' });
 *
 * On a part of the open model (a new hilt on Frostmourne, horns on a helmet): kit.builder({ frame })
 * with frame = (await api.module('sd-kitbash')).anchor(model, selection) builds in that part's own
 * frame (+Z along it from its base end, +X its face), and b.commit(model, { attach: selection }) binds
 * the new pieces to that part's bones; { bone: 'hand' } binds them to a bone.
 */
import { bindToSelection } from './bits-and-parts.js';
import { deleteNode } from './editor-document.js';
import { commitForge, encodeForgeTga } from './forge.js';
import { applyMaterialPreset } from './material-presets.js';

export const SD_MATERIALS = Object.freeze({
  iron: { dark: '#16171b', mid: '#4b4e55', light: '#8f939b', edge: '#dfe3ea' , metal: true },
  blackIron: { dark: '#100c0c', mid: '#3e3532', light: '#7d6c64', edge: '#d2b8a6' , metal: true },
  steel: { dark: '#1d2228', mid: '#69727b', light: '#b3bcc5', edge: '#f4f8fc' , metal: true },
  gold: { dark: '#3a1c02', mid: '#9c6510', light: '#f2c443', edge: '#fffbd0', metal: true },
  bronze: { dark: '#241003', mid: '#74421a', light: '#cf9346', edge: '#fff0c0', metal: true },
  silver: { dark: '#2f343c', mid: '#8f97a3', light: '#d3d9e3', edge: '#ffffff' , metal: true },
  wood: { dark: '#2a1607', mid: '#6d421f', light: '#a8703a', edge: '#d9a566' },
  darkWood: { dark: '#170b05', mid: '#432713', light: '#704423', edge: '#a26c3d' },
  leather: { dark: '#231309', mid: '#683d1d', light: '#9a6232', edge: '#c99159' },
  cloth: { dark: '#2a0607', mid: '#7a1a1a', light: '#b8382c', edge: '#e2735a' },
  stone: { dark: '#28282c', mid: '#67676e', light: '#a0a0a8', edge: '#d4d4dc' },
  darkStone: { dark: '#121214', mid: '#38373c', light: '#5f5d64', edge: '#94919a' },
  bone: { dark: '#45391f', mid: '#a49373', light: '#ded1b0', edge: '#fffbea' },
  fire: { dark: '#5c0b00', mid: '#e1420b', light: '#ffa31f', edge: '#fff2a6', glow: true },
  fel: { dark: '#0b2a04', mid: '#3c9f10', light: '#9cf03c', edge: '#f2ffc4', glow: true },
  arcane: { dark: '#1b0b42', mid: '#6b3dd0', light: '#b291ff', edge: '#f2eaff', glow: true },
  frost: { dark: '#0a2a49', mid: '#3c89cf', light: '#a2d8ff', edge: '#ffffff', glow: true },
  holy: { dark: '#5a3a06', mid: '#e0a830', light: '#ffe58a', edge: '#ffffff', glow: true },
  ruby: { dark: '#2b0005', mid: '#8b0a15', light: '#da303d', edge: '#ffb4b4' },
  emerald: { dark: '#002812', mid: '#0a7a38', light: '#36d070', edge: '#c8ffd8' },
  sapphire: { dark: '#020c38', mid: '#123fa8', light: '#4c8cf0', edge: '#d4e6ff' },
  amethyst: { dark: '#1c0630', mid: '#5e1e8c', light: '#a65ad8', edge: '#f0d4ff' },
});
export const SD_PATTERNS = ['none', 'grain', 'rivets', 'runes', 'engraved', 'scratches', 'wrap', 'slitEye', 'gem', 'flames'];

const V = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: a => Math.hypot(a[0], a[1], a[2]),
  norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
};
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const rgb = hex => { const m = /^#?([0-9a-f]{6})$/i.exec(String(hex)); if (!m) throw Error(`Use #rrggbb colours, not ${hex}.`); const n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const finiteVector = (v, name) => { if (!Array.isArray(v) || v.length !== 3 || v.some(n => !Number.isFinite(n))) throw Error(`${name} must be three numbers.`); return v; };

/** Angles in degrees for count evenly spaced copies around Z, starting at offset. */
export const angles = (count, offset = 0) => Array.from({ length: count }, (_, i) => offset + (360 * i) / count);
/** A point at radius and angle (degrees) around the Z axis, at height z. */
export const around = (radius, angle, z = 0) => [radius * Math.cos((angle * Math.PI) / 180), radius * Math.sin((angle * Math.PI) / 180), z];

/** 2D outlines (x right, y up) for extrude. */
export const shapes = {
  almond: (w, h, n = 10) => [...Array.from({ length: n }, (_, i) => { const t = Math.PI * (i / n); return [-Math.cos(t) * w / 2, Math.sin(t) * h / 2]; }), ...Array.from({ length: n }, (_, i) => { const t = Math.PI * (i / n); return [Math.cos(t) * w / 2, -Math.sin(t) * h / 2]; })],
  circle: (r, n = 10) => Array.from({ length: n }, (_, i) => [r * Math.cos((2 * Math.PI * i) / n), r * Math.sin((2 * Math.PI * i) / n)]),
  star: (outer, inner, points = 5) => Array.from({ length: points * 2 }, (_, i) => { const r = i % 2 ? inner : outer, a = Math.PI / 2 + (Math.PI * i) / points; return [r * Math.cos(a), r * Math.sin(a)]; }),
  diamond: (w, h) => [[0, -h / 2], [w / 2, 0], [0, h / 2], [-w / 2, 0]],
  rect: (w, h) => [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]],
  shield: (w, h) => [[-w / 2, h / 2], [w / 2, h / 2], [w / 2, -h * 0.05], [w * 0.3, -h * 0.35], [0, -h / 2], [-w * 0.3, -h * 0.35], [-w / 2, -h * 0.05]],
  skull: (w, h) => [[-w * 0.5, h * 0.15], [-w * 0.42, h * 0.42], [-w * 0.15, h * 0.5], [w * 0.15, h * 0.5], [w * 0.42, h * 0.42], [w * 0.5, h * 0.15], [w * 0.32, -h * 0.12], [w * 0.28, -h * 0.5], [-w * 0.28, -h * 0.5], [-w * 0.32, -h * 0.12]],
  /** A crossguard: a bar of width and height whose ends sweep up by sweep. */
  crossguard: (w, h, sweep = h) => [[-w / 2, h * 0.1 + sweep], [-w * 0.42, -h * 0.2 + sweep * 0.4], [-w * 0.14, -h / 2], [w * 0.14, -h / 2], [w * 0.42, -h * 0.2 + sweep * 0.4], [w / 2, h * 0.1 + sweep], [w * 0.4, h * 0.5 + sweep * 0.2], [w * 0.12, h / 2], [-w * 0.12, h / 2], [-w * 0.4, h * 0.5 + sweep * 0.2]],
  /** A blade: width at the base, length along +y, tip length as a fraction. */
  blade: (width, length, tip = 0.25) => [[-width / 2, 0], [width / 2, 0], [width / 2, length * (1 - tip)], [0, length], [-width / 2, length * (1 - tip)]],
  /** A blade with real points, no square steps: base width at y = 0 (inside the guard), a point of
   * tip x length, flare widens it toward the point, waist narrows its middle, hook leans the point
   * back (-x), teeth puts that many spikes on the back edge. Counter-clockwise, ready for edged or extrude. */
  pointedBlade: (width, length, { tip = 0.3, flare = 0, waist = 0, hook = 0, teeth = 0, toothDepth = width * 0.3 } = {}) => {
    // The base narrows into the guard so even its corners are not square steps.
    const w = width / 2, h = length * (1 - tip);
    const loop = [[-w * 0.8, 0], [w * 0.8, 0], [w, h * 0.12], [w * (1 - waist), h * 0.5], [w * (1 + flare), h], [-w * hook, length], [-w * (1 + flare * 0.5), h * (1 - tip * 0.3)], [-w * (1 - waist), h * 0.5], [-w, h * 0.12]];
    return teeth > 0 ? serrate(loop, 6, 7, { teeth, depth: toothDepth, rake: -0.7 }) : loop;
  },
  /** Spiked crown band: count teeth across width, height h, tooth height t. */
  crown: (width, h, t, count = 5) => [[-width / 2, 0], [width / 2, 0], ...Array.from({ length: count * 2 + 1 }, (_, i) => [width / 2 - (width * i) / (count * 2), h + (i % 2 ? t : 0)])],
};

function rotation(deg = [0, 0, 0]) {
  const [x, y, z] = finiteVector(deg, 'rotate').map(v => (v * Math.PI) / 180);
  const cx = Math.cos(x), sx = Math.sin(x), cy = Math.cos(y), sy = Math.sin(y), cz = Math.cos(z), sz = Math.sin(z);
  // R = Rz * Ry * Rx (X first).
  return [
    [cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx],
    [sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx],
    [-sy, cy * sx, cy * cx],
  ];
}
const apply = (m, v) => [m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2], m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2], m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2]];
/** Rotation taking +Z to direction d. */
function towards(d) {
  const z = V.norm(d), helper = Math.abs(z[2]) > 0.95 ? [1, 0, 0] : [0, 0, 1];
  const x = V.norm(V.cross(helper, z)), y = V.cross(z, x);
  return [[x[0], y[0], z[0]], [x[1], y[1], z[1]], [x[2], y[2], z[2]]];
}

function signedArea(loop) { let s = 0; for (let i = 0; i < loop.length; i++) { const p = loop[i], q = loop[(i + 1) % loop.length]; s += p[0] * q[1] - p[1] * q[0]; } return s / 2; }
function triangulate(loop) {
  const index = loop.map((_, i) => i), out = [];
  const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const inside = (p, a, b, c) => cross(a, b, p) >= 0 && cross(b, c, p) >= 0 && cross(c, a, p) >= 0;
  let guard = 0;
  while (index.length > 3 && guard++ < 10000) {
    let clipped = false;
    for (let i = 0; i < index.length; i++) {
      const a = index[(i + index.length - 1) % index.length], b = index[i], c = index[(i + 1) % index.length];
      if (cross(loop[a], loop[b], loop[c]) <= 1e-9) continue;
      if (index.some(k => k !== a && k !== b && k !== c && inside(loop[k], loop[a], loop[b], loop[c]))) continue;
      out.push([a, b, c]); index.splice(i, 1); clipped = true; break;
    }
    if (!clipped) break;
  }
  if (index.length === 3) out.push(index.slice());
  return out;
}
function inset(loop, d) {
  return loop.map((p, i) => {
    const a = loop[(i + loop.length - 1) % loop.length], c = loop[(i + 1) % loop.length];
    const e1 = [p[0] - a[0], p[1] - a[1]], e2 = [c[0] - p[0], c[1] - p[1]];
    const l1 = Math.hypot(...e1) || 1, l2 = Math.hypot(...e2) || 1;
    const n1 = [-e1[1] / l1, e1[0] / l1], n2 = [-e2[1] / l2, e2[0] / l2];
    let b = [n1[0] + n2[0], n1[1] + n2[1]]; const bl = Math.hypot(...b) || 1; b = [b[0] / bl, b[1] / bl];
    const s = Math.min(3, 1 / Math.max(0.2, b[0] * n1[0] + b[1] * n1[1]));
    return [p[0] + b[0] * d * s, p[1] + b[1] * d * s];
  });
}

/** One part: positions, normals, triangles and UV islands in world-size units. */
class Part {
  constructor(material, options = {}) {
    this.native = options.native ? nativeRegion(options.native) : null;
    if (!material && !this.native) throw Error('Give each part a material (an SD_MATERIALS name or {dark, mid, light, edge}) or a native texture region.');
    this.material = material; this.pattern = options.pattern || 'none'; this.patternMaterial = options.patternMaterial || null;
    this.detail = clamp(Number(options.detail ?? 1), 0.25, 4);
    this.patternAt = options.patternAt ? options.patternAt.map(Number) : null;
    if (this.patternAt && (this.patternAt.length !== 2 || !this.patternAt.every(Number.isFinite))) throw Error('patternAt must be [fromZ, toZ].');
    if (!SD_PATTERNS.includes(this.pattern)) throw Error(`Pattern must be one of ${SD_PATTERNS.join(', ')}.`);
    this.p = []; this.n = []; this.uv = []; this.island = []; this.tris = []; this.islands = 0; this.islandDetail = {};
  }
  vertex(p, n, uv, island) { this.p.push(p); this.n.push(V.norm(n)); this.uv.push(uv); this.island.push(island); return this.p.length - 1; }
  tri(a, b, c) { const area = V.len(V.cross(V.sub(this.p[b], this.p[a]), V.sub(this.p[c], this.p[a]))); if (area > 1e-9) this.tris.push([a, b, c]); }
  newIsland() { return this.islands++; }
  place({ at = [0, 0, 0], rotate = [0, 0, 0], scale = 1 } = {}, pre = null) {
    const s = Array.isArray(scale) ? finiteVector(scale, 'scale') : [scale, scale, scale];
    if (s.some(v => !Number.isFinite(v) || v === 0)) throw Error('scale must be nonzero.');
    const r = pre ? [[1, 0, 0], [0, 1, 0], [0, 0, 1]] : rotation(rotate); finiteVector(at, 'at');
    const mirrored = s[0] * s[1] * s[2] < 0;
    this.p = this.p.map(p => V.add(apply(r, apply(pre || [[1, 0, 0], [0, 1, 0], [0, 0, 1]], [p[0] * s[0], p[1] * s[1], p[2] * s[2]])), at));
    this.n = this.n.map(n => V.norm(apply(r, apply(pre || [[1, 0, 0], [0, 1, 0], [0, 0, 1]], [n[0] / s[0], n[1] / s[1], n[2] / s[2]]))));
    if (mirrored) this.tris = this.tris.map(([a, b, c]) => [a, c, b]);
    return this;
  }
  /** Wind every triangle to face along its vertex normals. */
  orient() {
    this.tris = this.tris.map(([a, b, c]) => {
      const g = V.cross(V.sub(this.p[b], this.p[a]), V.sub(this.p[c], this.p[a])), n = V.add(V.add(this.n[a], this.n[b]), this.n[c]);
      return V.dot(g, n) < 0 ? [a, c, b] : [a, b, c];
    });
    return this;
  }
  /** Smooth shading inside the piece, the way Blizzard and the owner light a part: each vertex
   * normal averages the faces around its position (weighted by their corner angle) whose normal
   * lies within angle degrees of the vertex's own; sharper turns stay hard. Hard breaks between
   * materials come from separate pieces. 0 keeps every face flat. The builder's own normals stay
   * in n0, where the painter looks for its painted creases. */
  smooth(angle = 100) {
    this.n0 = this.n.map(n => n.slice());
    if (!(angle > 0)) return this;
    const key = p => `${Math.round(p[0] * 1e4)},${Math.round(p[1] * 1e4)},${Math.round(p[2] * 1e4)}`, at = new Map();
    for (const tri of this.tris) {
      const f = V.norm(V.cross(V.sub(this.p[tri[1]], this.p[tri[0]]), V.sub(this.p[tri[2]], this.p[tri[0]])));
      tri.forEach((v, j) => {
        const e1 = V.norm(V.sub(this.p[tri[(j + 1) % 3]], this.p[v])), e2 = V.norm(V.sub(this.p[tri[(j + 2) % 3]], this.p[v]));
        const k = key(this.p[v]);
        (at.get(k) || at.set(k, []).get(k)).push({ f, w: Math.acos(clamp(V.dot(e1, e2), -1, 1)) });
      });
    }
    const cos = Math.cos((angle * Math.PI) / 180);
    this.n = this.p.map((p, v) => {
      const own = this.n0[v];
      let s = [0, 0, 0];
      for (const { f, w } of at.get(key(p)) || []) if (V.dot(f, own) >= cos) s = V.add(s, V.mul(f, w));
      return V.len(s) > 1e-9 ? V.norm(s) : own;
    });
    return this;
  }
}

/** Interior angle (degrees) at each point of a closed outline: under 70 reads as a point, 80–100
 * as a square step. SD outlines use points and slants; square steps read as pre-Warcraft blocks. */
export function corners(outline) {
  let loop = outline.map(p => [Number(p[0]), Number(p[1])]);
  if (signedArea(loop) < 0) loop = loop.reverse();
  const angles = loop.map((p, i) => {
    const a = loop[(i + loop.length - 1) % loop.length], c = loop[(i + 1) % loop.length];
    const u = [a[0] - p[0], a[1] - p[1]], v = [c[0] - p[0], c[1] - p[1]];
    const inner = (Math.atan2(v[0] * u[1] - v[1] * u[0], u[0] * v[0] + u[1] * v[1]) * 180) / Math.PI;
    return Math.round(inner < 0 ? inner + 360 : inner);
  });
  return { angles, acute: angles.filter(a => a < 70).length, square: angles.filter(a => a >= 80 && a <= 100).length, reflexSquare: angles.filter(a => a >= 260 && a <= 280).length };
}

/** Turn the outline's points from..to (indices, going forward) into a saw of teeth points pushed out
 * by depth: back spikes, serrations, jagged crests. rake leans each point along the outline (a fraction
 * of a tooth; negative leans back toward from) so the points are hooks, not square steps. Returns a new outline. */
export function serrate(outline, from, to, { teeth = 4, depth = 3, rake = 0.8 } = {}) {
  let loop = outline.map(p => [Number(p[0]), Number(p[1])]);
  if (signedArea(loop) < 0) throw Error('Give serrate a counter-clockwise outline (kit.shapes outlines are).');
  const n = loop.length, path = [];
  for (let i = from; ; i = (i + 1) % n) { path.push(loop[i]); if (i === to || path.length > n) break; }
  const lengths = [0];
  for (let k = 1; k < path.length; k++) lengths.push(lengths[k - 1] + Math.hypot(path[k][0] - path[k - 1][0], path[k][1] - path[k - 1][1]));
  const total = lengths.at(-1), at = d => {
    let k = 1; while (k < path.length - 1 && lengths[k] < d) k++;
    const t = (d - lengths[k - 1]) / (lengths[k] - lengths[k - 1] || 1), a = path[k - 1], b = path[k];
    const e = [b[0] - a[0], b[1] - a[1]], l = Math.hypot(...e) || 1;
    return { p: [a[0] + e[0] * t, a[1] + e[1] * t], out: [e[1] / l, -e[0] / l] };
  };
  const saw = [], tooth = total / teeth;
  for (let k = 1; k < teeth * 2; k++) {
    const { p, out } = at(k % 2 ? Math.min(total, Math.max(0, (total * k) / (teeth * 2) + rake * tooth * 0.5)) : (total * k) / (teeth * 2));
    saw.push(k % 2 ? [p[0] + out[0] * depth, p[1] + out[1] * depth] : p);
  }
  const result = [];
  for (let i = 0; i < n; i++) {
    const inside = from <= to ? i > from && i < to : i > from || i < to;
    if (inside) continue;
    result.push(loop[i]);
    if (i === from) result.push(...saw);
  }
  return result;
}

/** Revolve a [radius, z] profile around the local Z axis. Ends with a radius close themselves; sharp turns stay hard edges. */
function lathePart(o) {
  const segments = Math.round(o.segments ?? 10);
  if (!Number.isInteger(segments) || segments < 3 || segments > 64) throw Error('segments must be 3–64.');
  let profile = (o.profile || []).map(([r, z]) => [Math.max(0, Number(r)), Number(z)]);
  if (profile.length < 2 || profile.some(p => !p.every(Number.isFinite))) throw Error('profile needs at least two [radius, z] points.');
  if (profile[0][0] > 1e-4) profile.unshift([0, profile[0][1]]);
  if (profile.at(-1)[0] > 1e-4) profile.push([0, profile.at(-1)[1]]);
  const part = new Part(o.material, o), island = part.newIsland(), sharp = o.sharp ?? 40;
  part.kind = 'lathe';
  const top = profile.reduce((best, p, k) => (p[1] > profile[best][1] + 1e-6 ? k : best), 0);
  const hollow = top < profile.length - 2 && profile.at(-1)[1] < profile[top][1] - 1e-3;
  const inner = hollow ? part.newIsland() : island;
  if (hollow) part.islandDetail[inner] = 0.45;
  const segNormal = k => { const dr = profile[k + 1][0] - profile[k][0], dz = profile[k + 1][1] - profile[k][1], l = Math.hypot(dr, dz) || 1; return [dz / l, -dr / l]; };
  const lengths = [0]; for (let k = 1; k < profile.length; k++) lengths.push(lengths[k - 1] + Math.hypot(profile[k][0] - profile[k - 1][0], profile[k][1] - profile[k - 1][1]));
  const circumference = 2 * Math.PI * Math.max(...profile.map(p => p[0]));
  const ring = (k, n2, isl) => Array.from({ length: segments + 1 }, (_, j) => {
    const a = (2 * Math.PI * j) / segments, c = Math.cos(a), s = Math.sin(a), [r, z] = profile[k];
    return part.vertex([r * c, r * s, z], [n2[0] * c, n2[0] * s, n2[1]], [(circumference * j) / segments, lengths[k]], isl);
  });
  for (let k = 0; k < profile.length - 1; k++) {
    const n = segNormal(k), prev = k > 0 ? segNormal(k - 1) : n, next = k < profile.length - 2 ? segNormal(k + 1) : n;
    const angle = (a, b) => (Math.acos(clamp(a[0] * b[0] + a[1] * b[1], -1, 1)) * 180) / Math.PI;
    const n0 = angle(prev, n) > sharp ? n : V.norm([prev[0] + n[0], prev[1] + n[1], 0]).slice(0, 2);
    const n1 = angle(n, next) > sharp ? n : V.norm([n[0] + next[0], n[1] + next[1], 0]).slice(0, 2);
    const isl = hollow && k >= top ? inner : island, a = ring(k, n0, isl), b = ring(k + 1, n1, isl);
    for (let j = 0; j < segments; j++) { part.tri(a[j], b[j], b[j + 1]); part.tri(a[j], b[j + 1], a[j + 1]); }
  }
  return part;
}
/** Extrude a 2D outline (x right, y up) along local Z, front facing +Z, with an optional bevel. */
function extrudePart(o) {
  let loop = (o.outline || []).map(p => [Number(p[0]), Number(p[1])]);
  if (loop.length < 3 || loop.some(p => !p.every(Number.isFinite))) throw Error('outline needs at least three [x, y] points.');
  if (signedArea(loop) < 0) loop = loop.reverse();
  const depth = Number(o.depth ?? 2), bevel = clamp(Number(o.bevel ?? 0), 0, depth / 2);
  if (!(depth > 0)) throw Error('depth must be positive.');
  const part = new Part(o.material, o), front = part.newIsland(), side = part.newIsland();
  const inner = bevel > 0 ? inset(loop, bevel) : loop, tris = triangulate(inner), zf = depth / 2, zb = -depth / 2;
  if (!tris.length) throw Error('The outline could not be filled; use a simple, non-crossing outline.');
  const minX = Math.min(...loop.map(p => p[0])), minY = Math.min(...loop.map(p => p[1]));
  const faceUv = p => [p[0] - minX, p[1] - minY];
  const f = inner.map(p => part.vertex([p[0], p[1], zf], [0, 0, 1], faceUv(p), front));
  // The back reuses the front's texture space, the usual SD saving.
  const k = inner.map(p => part.vertex([p[0], p[1], zb], [0, 0, -1], faceUv(p), front));
  for (const [a, b, c] of tris) { part.tri(f[a], f[b], f[c]); part.tri(k[a], k[c], k[b]); }
  let u = 0;
  const wall = (outerZ0, outerZ1, loopA, loopB, z0, z1, flat) => {
    for (let i = 0; i < loop.length; i++) {
      const j = (i + 1) % loop.length, e = [loop[j][0] - loop[i][0], loop[j][1] - loop[i][1]], l = Math.hypot(...e) || 1, n = [e[1] / l, -e[0] / l, flat];
      const v = [part.vertex([loopA[i][0], loopA[i][1], z0], n, [u, outerZ0], side), part.vertex([loopA[j][0], loopA[j][1], z0], n, [u + l, outerZ0], side), part.vertex([loopB[j][0], loopB[j][1], z1], n, [u + l, outerZ1], side), part.vertex([loopB[i][0], loopB[i][1], z1], n, [u, outerZ1], side)];
      part.tri(v[0], v[1], v[2]); part.tri(v[0], v[2], v[3]); u += l;
    }
  };
  if (bevel > 0) {
    wall(0, bevel * 1.4, loop, inner, zf - bevel, zf, 0.7); u = 0;
    wall(bevel * 1.4, bevel * 1.4 + depth - 2 * bevel, loop, loop, zf - bevel, zb + bevel, 0); u = 0;
    wall(bevel * 1.4 + depth - 2 * bevel, bevel * 2.8 + depth - 2 * bevel, loop, inner, zb + bevel, zb, -0.7);
  } else wall(0, depth, loop, loop, zf, zb, 0);
  return part;
}
function tubePart(path, radii, o) {
  const sides = Math.round(o.sides ?? 5);
  if (sides < 3 || sides > 24) throw Error('sides must be 3–24.');
  const part = new Part(o.material, o), island = part.newIsland(), rings = [];
  let length = 0;
  for (let k = 0; k < path.length; k++) {
    if (k) length += V.len(V.sub(path[k], path[k - 1]));
    const d = V.norm(V.sub(path[Math.min(k + 1, path.length - 1)], path[Math.max(k - 1, 0)])), m = towards(d);
    rings.push(Array.from({ length: sides + 1 }, (_, j) => {
      const a = (2 * Math.PI * j) / sides, local = [Math.cos(a), Math.sin(a), 0], n = apply(m, local);
      return part.vertex(V.add(path[k], V.mul(n, radii[k])), radii[k] < 1e-4 ? d : n, [(2 * Math.PI * radii[0] * j) / sides, length], island);
    }));
  }
  for (let k = 0; k < rings.length - 1; k++) for (let j = 0; j < sides; j++) { part.tri(rings[k][j], rings[k + 1][j], rings[k + 1][j + 1]); part.tri(rings[k][j], rings[k + 1][j + 1], rings[k][j + 1]); }
  return { part, rings };
}

/** A band between an outer and an inner line (2D, x right, y up, thickness along local Z): outerHalf
 * thick at the outer line, innerHalf at the inner one (a cutting edge thins outward; a trim keeps one
 * thickness). closed joins the ends; an open band gets end caps. One long island runs along the band. */
function bandPart(outer, inner, { closed = false, innerHalf, outerHalf, innerWall = true, ...o }) {
  const part = new Part(o.material, o), face = part.newIsland(), rim = part.newIsland(), m = outer.length;
  if (m < 2 || inner.length !== m) throw Error('A band needs matching outer and inner lines of at least two points.');
  const along = [0];
  for (let k = 1; k <= m; k++) { const a = outer[k - 1], b = outer[k % m]; along.push(along[k - 1] + (k < m || closed ? Math.hypot(b[0] - a[0], b[1] - a[1]) : 0)); }
  const across = outer.map((p, k) => Math.hypot(p[0] - inner[k][0], p[1] - inner[k][1])), w = Math.max(...across);
  const P = (p, z) => [p[0], p[1], z];
  // Each face gets the normal it should face (want); orient() then winds it to match.
  const quad = (pts, uvs, island, want) => {
    let n = V.norm(V.cross(V.sub(pts[1], pts[0]), V.sub(pts[3], pts[0])));
    if (V.len(n) < 1e-9 || !Number.isFinite(n[0])) n = V.norm(want);
    if (V.dot(n, want) < 0) n = V.mul(n, -1);
    const v = pts.map((p, i) => part.vertex(p, n, uvs[i], island));
    part.tri(v[0], v[1], v[2]); part.tri(v[0], v[2], v[3]);
  };
  const outward = (k, j) => { const d = [outer[k][0] + outer[j][0] - inner[k][0] - inner[j][0], outer[k][1] + outer[j][1] - inner[k][1] - inner[j][1], 0]; return V.len(d) > 1e-9 ? V.norm(d) : [1, 0, 0]; };
  const r0 = 2 * outerHalf + 1;
  for (let k = 0; k < (closed ? m : m - 1); k++) {
    const j = (k + 1) % m, u0 = along[k], u1 = along[k + 1], out = outward(k, j);
    quad([P(inner[k], innerHalf), P(inner[j], innerHalf), P(outer[j], outerHalf), P(outer[k], outerHalf)], [[u0, across[k]], [u1, across[j]], [u1, 0], [u0, 0]], face, [0, 0, 1]);
    quad([P(outer[k], -outerHalf), P(outer[j], -outerHalf), P(inner[j], -innerHalf), P(inner[k], -innerHalf)], [[u0, 0], [u1, 0], [u1, across[j]], [u0, across[k]]], face, [0, 0, -1]);
    if (outerHalf > 1e-4) quad([P(outer[k], outerHalf), P(outer[j], outerHalf), P(outer[j], -outerHalf), P(outer[k], -outerHalf)], [[u0, 0], [u1, 0], [u1, 2 * outerHalf], [u0, 2 * outerHalf]], rim, out);
    if (innerWall) quad([P(inner[k], -innerHalf), P(inner[j], -innerHalf), P(inner[j], innerHalf), P(inner[k], innerHalf)], [[u0, r0], [u1, r0], [u1, r0 + 2 * innerHalf], [u0, r0 + 2 * innerHalf]], rim, V.mul(out, -1));
  }
  if (!closed)
    for (const [k, j] of [[0, 1], [m - 1, m - 2]]) {
      const d = V.norm([outer[k][0] - outer[j][0], outer[k][1] - outer[j][1], 0]), u = along.at(-1) + 1 + (k ? w + 1 : 0);
      quad([P(inner[k], innerHalf), P(outer[k], outerHalf), P(outer[k], -outerHalf), P(inner[k], -innerHalf)], [[u, 0], [u + w, 0], [u + w, 2 * outerHalf + 0.5], [u, 2 * innerHalf]], rim, d);
    }
  part.kind = 'band';
  return part;
}

// Inward direction at outline point i of a counter-clockwise loop: the miter of the two
// neighbouring edges' inward normals, scaled to keep width from both (capped at 3x).
function miter(loop, i, width) {
  const n = loop.length, p = loop[i], a = loop[(i + n - 1) % n], c = loop[(i + 1) % n];
  const inward = (s, t) => { const d = [t[0] - s[0], t[1] - s[1]], l = Math.hypot(...d) || 1; return [-d[1] / l, d[0] / l]; };
  const n1 = inward(a, p), n2 = inward(p, c), b = [n1[0] + n2[0], n1[1] + n2[1]], bl = Math.hypot(...b) || 1, u = [b[0] / bl, b[1] / bl];
  const s = Math.min(3, 1 / Math.max(0.2, u[0] * n1[0] + u[1] * n1[1]));
  return [p[0] + u[0] * width * s, p[1] + u[1] * width * s];
}
// Where the edge band ends on the outline, its inner point slides along the next (non-edge)
// outline edge, so the body outline stays simple and the band keeps its width.
function slide(loop, i, toward, along, width) {
  const p = loop[i], q = loop[toward], b = [q[0] - p[0], q[1] - p[1]], bl = Math.hypot(...b) || 1, d = [b[0] / bl, b[1] / bl];
  const e = loop[along], el = Math.hypot(e[0] - p[0], e[1] - p[1]) || 1, sign = along === (i + 1) % loop.length ? 1 : -1;
  const n = sign > 0 ? [-(e[1] - p[1]) / el, (e[0] - p[0]) / el] : [(e[1] - p[1]) / el, -(e[0] - p[0]) / el];
  const s = Math.min(3 * width, width / Math.max(0.2, d[0] * n[0] + d[1] * n[1]), bl * 0.45);
  return [p[0] + d[0] * s, p[1] + d[1] * s];
}

const ccw = outline => { const loop = (outline || []).map(p => [Number(p[0]), Number(p[1])]); if (loop.length < 3 || loop.some(p => !p.every(Number.isFinite))) throw Error('outline needs at least three [x, y] points.'); return signedArea(loop) < 0 ? loop.reverse() : loop; };
const paintOf = (o, what) => { if (!o || (!o.material && !o.native)) throw Error(`Give the ${what} its own paint: material (an SD material) or native (a palette area), in contrast to the body.`); return o; };

/** A builder of SD parts. frame (from sd-kitbash anchor) places everything in a part's own frame:
 * local +Z runs along that part from its base, +X is its face normal, +Y its side. */
export function builder({ frame = null } = {}) {
  const parts = [];
  const push = (part, o = {}) => { parts.push(part.orient().smooth(o.smooth ?? 100)); return api; };
  const add = (part, placement) => push(part.place(placement), placement);
  const api = {
    parts,
    /** Solid of revolution: cups, bowls, stems, bases, handles, helmets, bottles, columns. profile: [[radius, z], ...] bottom to top; go back down inside for a hollow cup. */
    lathe: o => add(lathePart(o), o),
    /** Flat outline with thickness: blades, plates, wings, feathers, signs, teeth. kit.shapes has ready outlines. */
    extrude: o => add(extrudePart(o), o),
    /** An emblem, eye, gem setting or plaque set into a round surface: it faces outward at angle (degrees around Z, 0 = +X front),
     * centred at height z on a surface radius from the axis, tilted up by tilt degrees, sunk in so no gap shows.
     * shape: almond, circle, diamond, star, shield, skull, or an outline. width and height in units; depth defaults to a quarter of the smaller. */
    emblem: o => {
      // Flush, not a protruding block: depth is at most 40% of the smaller side.
      const w = Number(o.width ?? 8), h = Number(o.height ?? w), depth = Math.min(Number(o.depth ?? Math.min(w, h) * 0.25), Math.min(w, h) * 0.4);
      if (!(w > 0 && h > 0 && depth > 0)) throw Error('emblem needs positive width, height and depth.');
      const outlines = { almond: () => shapes.almond(w, h), circle: () => shapes.circle(Math.min(w, h) / 2, 10), diamond: () => shapes.diamond(w, h), star: () => shapes.star(Math.min(w, h) / 2, Math.min(w, h) / 4.5), shield: () => shapes.shield(w, h), skull: () => shapes.skull(w, h) };
      const outline = Array.isArray(o.outline) ? o.outline : (outlines[o.shape || 'almond'] || (() => { throw Error(`emblem shape must be one of ${Object.keys(outlines).join(', ')}, or give an outline.`); }))();
      const a = (Number(o.angle ?? 0) * Math.PI) / 180, t = (Number(o.tilt ?? 0) * Math.PI) / 180, r = Number(o.radius ?? 10), z = Number(o.z ?? 0);
      const out = [Math.cos(a) * Math.cos(t), Math.sin(a) * Math.cos(t), Math.sin(t)], up = [-Math.cos(a) * Math.sin(t), -Math.sin(a) * Math.sin(t), Math.cos(t)], side = V.cross(up, out);
      const basis = [[side[0], up[0], out[0]], [side[1], up[1], out[1]], [side[2], up[2], out[2]]];
      const at = V.add([Math.cos(a) * r, Math.sin(a) * r, z], V.mul(out, -depth * 0.1));
      return push(extrudePart({ bevel: depth * 0.3, detail: 2, ...o, outline, depth }).place({ at }, basis), o);
    },
    /** Sword or axe blade standing along +Z from at: diamond cross-section (flat faces facing +X and -X meet at a ridge),
     * width across Y, a point of tip x length. taper narrows the width toward the point. */
    blade: o => {
      const L = Number(o.length ?? 60), w = Number(o.width ?? 9), t = Number(o.thickness ?? w * 0.3), tip = clamp(Number(o.tip ?? 0.22), 0.05, 0.9), taper = clamp(Number(o.taper ?? 0.85), 0.2, 1.5);
      if (!(L > 0 && w > 0 && t > 0)) throw Error('blade needs positive length, width and thickness.');
      const part = new Part(o.material, o), face = part.newIsland(), cap = part.newIsland(), h = L * (1 - tip);
      const section = (z, s) => [[0, -w * s / 2, z], [t * s / 2, 0, z], [0, w * s / 2, z], [-t * s / 2, 0, z]];
      const lo = section(0, 1), hi = section(h, taper), point = [0, 0, L];
      const uvOf = p => [p[1] + w / 2, L - p[2]];
      const quad = (a, b, c, d) => {
        const n = V.norm(V.cross(V.sub(b, a), V.sub(d, a))), v = [a, b, c, d].map(p => part.vertex(p, n, uvOf(p), face));
        part.tri(v[0], v[1], v[2]); part.tri(v[0], v[2], v[3]);
      };
      const tri = (a, b, c, isl = face) => { const n = V.norm(V.cross(V.sub(b, a), V.sub(c, a))), v = [a, b, c].map(p => part.vertex(p, n, isl === face ? uvOf(p) : [p[0] + t, p[1] + w], isl)); part.tri(v[0], v[1], v[2]); };
      for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; quad(lo[i], lo[j], hi[j], hi[i]); tri(hi[i], hi[j], point); }
      tri(lo[0], lo[2], lo[1], cap); tri(lo[0], lo[3], lo[2], cap);
      return push(part.place(o), o);
    },
    /** Rectangular block with optional bevel. size: [x, y, z]. */
    box: o => { const [x, y, z] = finiteVector(o.size || [], 'size'); const part = extrudePart({ ...o, outline: shapes.rect(x, y), depth: z }); return add(part, o); },
    /** Tapered horn, spike, claw or tooth from 'from' to 'to'; bend pushes the middle sideways. */
    spike: o => {
      const from = finiteVector(o.from, 'from'), to = finiteVector(o.to, 'to'), bend = o.bend ? finiteVector(o.bend, 'bend') : [0, 0, 0], r = Number(o.radius ?? 1), steps = 4;
      const path = Array.from({ length: steps + 1 }, (_, k) => { const t = k / steps; return V.add(V.add(V.mul(from, 1 - t), V.mul(to, t)), V.mul(bend, 4 * t * (1 - t))); });
      const radii = path.map((_, k) => r * Math.pow(1 - k / steps, 0.85));
      const { part, rings } = tubePart(path, radii, { sides: 4, ...o });
      const d = V.norm(V.sub(path[1], path[0])), c = part.vertex(from, V.mul(d, -1), [0, -r], 0);
      for (let j = 0; j < rings[0].length - 1; j++) part.tri(c, rings[0][j + 1], rings[0][j]);
      return push(part, o);
    },
    /** Band or ring around local Z: rims, bands, collars, bracelets. */
    ring: o => {
      const R = Number(o.radius), t = Number(o.thickness ?? 1), sides = Math.round(o.sides ?? 4);
      const profile = Array.from({ length: sides + 1 }, (_, i) => { const a = Math.PI / sides + (2 * Math.PI * i) / sides; return [R + t * Math.cos(a), t * Math.sin(a) * (o.height ?? 1)]; });
      return add(lathePart({ ...o, profile, sharp: 30 }), o);
    },
    /** Gem, orb, knob or stud. */
    sphere: o => {
      const r = Number(o.radius ?? 2), rings = Math.round(o.rings ?? 4);
      const profile = Array.from({ length: rings + 1 }, (_, i) => { const a = -Math.PI / 2 + (Math.PI * i) / rings; return [r * Math.cos(a), r * Math.sin(a)]; });
      return add(lathePart({ segments: 8, ...o, profile, sharp: o.faceted ? 1 : 80 }), o);
    },
    /** HQSD blade: a slab body in its own paint plus a separate thin cutting edge in a contrasting paint
     * (edge: { material | native, width, from, to, depth, thin }) that runs along the outline from
     * edge.from to edge.to (default: everything but the base) and thins to a line at the outside.
     * outline: x across, y along the blade from its base (kit.shapes.pointedBlade); depth: body thickness. */
    edged: o => {
      const loop = ccw(o.outline || shapes.pointedBlade(Number(o.width ?? 12), Number(o.length ?? 60))), n = loop.length, e = paintOf(o.edge, 'edge');
      paintOf(o, 'blade body');
      const depth = Number(o.depth ?? 4), xs = loop.map(p => p[0]), width = Number(e.width ?? Math.max(1.2, (Math.max(...xs) - Math.min(...xs)) * 0.2));
      // The base is the outline's lowest edge; by default the cutting edge is all the rest.
      let base = 0;
      loop.forEach((p, i) => { if (p[1] + loop[(i + 1) % n][1] < loop[base][1] + loop[(base + 1) % n][1]) base = i; });
      // closed: an edge all the way round (a disc or a star blade).
      const closed = !!e.closed, from = closed ? 0 : e.from ?? (base + 1) % n, to = closed ? n - 1 : e.to ?? base, path = [];
      for (let i = from; ; i = (i + 1) % n) { path.push(i); if (i === to || path.length >= n) break; }
      const inner = path.map((i, k) => (!closed && k === 0 ? slide(loop, i, (i + n - 1) % n, (i + 1) % n, width) : !closed && k === path.length - 1 ? slide(loop, i, (i + 1) % n, (i + n - 1) % n, width) : miter(loop, i, width)));
      const body = loop.map((p, i) => (path.includes(i) ? inner[path.indexOf(i)] : p));
      const placement = { at: o.at, rotate: o.rotate, scale: o.scale };
      add(extrudePart({ ...o, edge: undefined, outline: body, depth, bevel: Number(o.bevel ?? 0) }), placement);
      // The edge's inner face lies against the body's wall, unseen, so it is left out.
      return add(bandPart(path.map(i => loop[i]), inner, { ...e, closed, innerWall: false, innerHalf: Number(e.depth ?? depth * 0.85) / 2, outerHalf: Number(e.thin ?? depth * 0.12) / 2 }), { ...placement, smooth: e.smooth ?? o.smooth });
    },
    /** A layered trim: a rim band in its own paint following an outline (the same outline as the plate it
     * sits on), width wide, depth thick (deeper than the plate so it stands proud of both faces),
     * overhang past the plate's edge. from/to (outline indices) make an open trim along part of it. */
    trim: o => {
      const loop = ccw(o.outline), n = loop.length, width = Number(o.width ?? 2.5), depth = Number(o.depth ?? 5), over = Number(o.overhang ?? 0.4);
      paintOf(o, 'trim');
      const outer = inset(loop, -over), inner = inset(loop, width), path = [];
      if (o.from == null) path.push(...loop.keys());
      else for (let i = o.from; ; i = (i + 1) % n) { path.push(i); if (i === (o.to ?? o.from) || path.length >= n) break; }
      return add(bandPart(path.map(i => outer[i]), path.map(i => inner[i]), { ...o, closed: o.from == null, innerHalf: depth / 2, outerHalf: depth / 2 }), o);
    },
    /** Pack and paint the painted parts into one texture and geoset; map native parts onto their game texture regions.
     * attach: a selection of an existing part whose bones the new geosets take (nearest vertex), or bone: a bone name or id. */
    commit: (model, options = {}) => commitParts(model, parts, { frame, ...options }),
  };
  return api;
}

function nativeRegion(region) {
  const sheet = String(region?.sheet || '').trim(), uv = region?.uv;
  if (!sheet) throw Error('native needs sheet, the game texture path.');
  if (!Array.isArray(uv) || uv.length !== 4 || uv.some(v => !Number.isFinite(v) || v < 0 || v > 1) || !(uv[2] > uv[0] && uv[3] > uv[1]))
    throw Error('native needs uv: [u0, v0, u1, v1] inside 0..1 with u1 > u0 and v1 > v0.');
  const tint = region.tint == null ? null : Array.from(region.tint, Number);
  if (tint && (tint.length !== 3 || tint.some(v => !Number.isFinite(v) || v < 0 || v > 1))) throw Error('native tint must be three values from 0 to 1.');
  const size = Array.isArray(region.size) && region.size.length === 2 ? region.size.map(Number) : [1, 1];
  return { sheet, uv: uv.map(Number), tint, team: !!region.team, alpha: Number(region.alpha) || 0, size };
}

function commitParts(model, parts, options = {}) {
  if (!parts.length) throw Error('Add at least one part before commit.');
  const painted = parts.filter(p => !p.native), native = parts.filter(p => p.native), hadDummy = dummyBone(model);
  let result = painted.length ? commitSd(model, painted, options) : { model, assets: [], triangles: 0, texture: null, geoset: null };
  if (native.length) {
    const nativeResult = commitNative(model, native, options);
    result = { ...result, triangles: result.triangles + nativeResult.triangles, texture: result.texture ?? nativeResult.textures[0], geoset: result.geoset ?? nativeResult.geosets[0], native: nativeResult };
  }
  const geosets = [...(result.geoset != null && painted.length ? [result.geoset] : []), ...(result.native?.geosets || [])];
  attachGeosets(model, geosets, { ...options, keepDummy: hadDummy });
  return { ...result, geosets };
}

// Parts built in a part's frame (sd-kitbash anchor) are painted upright in their own space and placed on commit.
const framed = frame => {
  if (!frame) return { place: p => p, turn: n => n };
  const { origin, normal, side, axis } = frame;
  if (![origin, normal, side, axis].every(v => Array.isArray(v) && v.length === 3)) throw Error('frame needs origin, normal, side and axis (use sd-kitbash anchor).');
  const map = v => [0, 1, 2].map(a => normal[a] * v[0] + side[a] * v[1] + axis[a] * v[2]);
  return { place: p => V.add(origin, map(p)), turn: n => V.norm(map(n)) };
};

const dummyBone = model => (model.Bones || []).find(b => b.Name === 'DummyBone') || null;
/** A bone's ObjectId by name (case-insensitive: the whole name first, then part of it) or by id. */
export function boneId(model, bone) {
  if (Number.isInteger(bone)) return bone;
  const b = String(bone).toLowerCase(), nodes = [...(model.Bones || []), ...(model.Helpers || [])];
  const hit = nodes.find(n => n.Name?.toLowerCase() === b) || nodes.find(n => n.Name?.toLowerCase().includes(b));
  if (!hit) throw Error(`No bone named like ${bone}. Bones: ${(model.Bones || []).map(n => n.Name).join(', ')}.`);
  return hit.ObjectId;
}
/** Bind new geosets to an existing part: attach (a selection: each vertex takes the bones of the
 * nearest selected vertex, as a replacement part does) or bone (a name or id, rigid). The editor's
 * import anchor bone is removed again when it was new and nothing uses it. */
export function attachGeosets(model, indices, { attach, bone, keepDummy = true } = {}) {
  if (!indices.length || (!attach && bone == null)) return;
  if (attach) bindToSelection(model, indices, attach);
  else {
    const id = boneId(model, bone);
    for (const i of indices) {
      const g = model.Geosets[i], count = g.Vertices.length / 3;
      g.Groups = [[id]]; g.TotalGroupsCount = 1; g.VertexGroup = new Uint8Array(count);
      if (g.SkinWeights?.length) for (let v = 0; v < count; v++) g.SkinWeights.set([id, 0, 0, 0, 255, 0, 0, 0], v * 8);
    }
  }
  const dummy = dummyBone(model);
  if (dummy && !keepDummy && !(model.Geosets || []).some(g => (g.Groups || []).some(group => group.includes(dummy.ObjectId)))) deleteNode(model, dummy.ObjectId);
}

/** Fit UV islands into a native region: each island keeps its shape and is scaled into the region,
 * turned so its long side runs along the region's long side (region.size in pixels decides which
 * side is long and keeps painted detail unstretched). uvs: [[u, v]] per vertex; island: the island
 * index of each vertex; count: the number of islands. Returns the new [u, v] per vertex. */
export function fitIslands(uvs, island, count, region) {
  const n = nativeRegion(region), [u0, v0, u1, v1] = n.uv, inset = 0.04, rw = (u1 - u0) * (1 - inset * 2), rh = (v1 - v0) * (1 - inset * 2);
  const pw = rw * n.size[0], ph = rh * n.size[1], out = new Array(uvs.length);
  for (let i = 0; i < count; i++) {
    const verts = uvs.map((_, k) => (island[k] === i ? k : -1)).filter(k => k >= 0);
    if (!verts.length) continue;
    const xs = verts.map(k => uvs[k][0]), ys = verts.map(k => uvs[k][1]);
    const x0 = Math.min(...xs), y0 = Math.min(...ys), w = Math.max(...xs) - x0 || 1e-3, h = Math.max(...ys) - y0 || 1e-3;
    const rot = (w >= h) !== (pw >= ph), iw = rot ? h : w, ih = rot ? w : h, s = Math.min(pw / iw, ph / ih);
    const cu = (pw - iw * s) / 2, cv = (ph - ih * s) / 2;
    for (const k of verts) {
      const a = uvs[k][0] - x0, b = uvs[k][1] - y0, [x, y] = rot ? [b, w - a] : [a, b];
      out[k] = [u0 + (u1 - u0) * inset + (cu + x * s) / n.size[0], v0 + (v1 - v0) * inset + (cv + y * s) / n.size[1]];
    }
  }
  return out.map(uv => uv || [(u0 + u1) / 2, (v0 + v1) / 2]);
}

// Native parts: each island keeps its shape and is fitted into the region, long side along
// the region's long side. One geoset per sheet and colour, like an SD model's material groups.
function commitNative(model, parts, { frame } = {}) {
  const { place, turn } = framed(frame);
  const groups = new Map();
  for (const part of parts) {
    const n = part.native, k = [n.sheet.toLowerCase(), n.tint?.join(',') || '', n.team ? 'team' : '', n.alpha > 0.05 ? 'alpha' : ''].join('|');
    (groups.get(k) || groups.set(k, { n, parts: [] }).get(k)).parts.push(part);
  }
  const geosets = [], textures = [];
  let triangles = 0;
  for (const { n, parts: list } of groups.values()) {
    const Vertices = [], Normals = [], uvs = [], Faces = [];
    for (const part of list) {
      // Each part keeps its own area of the shared sheet.
      const base = Vertices.length / 3, local = fitIslands(part.uv, part.island, part.islands, part.native);
      part.p.forEach((p, k) => { Vertices.push(...place(p)); Normals.push(...turn(part.n[k])); uvs.push(...local[k]); });
      for (const t of part.tris) Faces.push(base + t[0], base + t[1], base + t[2]);
    }
    if (Vertices.length / 3 > 65535) throw Error('Too many vertices for one Warcraft geoset.');
    const committed = commitForge(model, { geosets: [{ Vertices: new Float32Array(Vertices), Normals: new Float32Array(Normals), TVertices: [new Float32Array(uvs)], Faces: new Uint16Array(Faces) }] }, { texturePath: n.sheet });
    const index = committed.geosetIndices[0], materialId = model.Geosets[index].MaterialID, layer = model.Materials[materialId].Layers[0];
    // Opaque paint renders like Blizzard props; alpha paint either cuts out or shows team colour beneath.
    layer.FilterMode = n.alpha > 0.05 && !n.team ? 1 : 0; layer.Shading = 0;
    if (n.team) applyMaterialPreset(model, materialId, 'Team Color');
    if (n.tint) model.GeosetAnims.push({ GeosetId: index, Flags: 2, Alpha: 1, Color: new Float32Array(n.tint) });
    if (model.Info) model.Info.NumGeosetAnims = model.GeosetAnims.length;
    geosets.push(index); textures.push(n.sheet); triangles += Faces.length / 3;
  }
  return { geosets, textures, triangles };
}

function material(spec) {
  const m = typeof spec === 'string' ? SD_MATERIALS[spec] : spec;
  if (!m) throw Error(`Unknown SD material ${spec}. Use one of ${Object.keys(SD_MATERIALS).join(', ')} or {dark, mid, light, edge, glow}.`);
  return { dark: rgb(m.dark), mid: rgb(m.mid), light: rgb(m.light), edge: rgb(m.edge || m.light), glow: !!m.glow, metal: !!m.metal };
}
function ramp(m, t) {
  const c = t < 0.5 ? [m.dark, m.mid, t / 0.5] : t < 0.88 ? [m.mid, m.light, (t - 0.5) / 0.38] : [m.light, m.edge, clamp((t - 0.88) / 0.3)];
  return [0, 1, 2].map(i => mix(c[0][i], c[1][i], c[2]));
}
// Smooth value noise: broad painted variation, never per-pixel grain.
function noise3(seed) {
  const h = (x, y, z) => { let n = (x * 374761393 + y * 668265263 + z * 2147483647 + seed * 144665) | 0; n = (n ^ (n >>> 13)) * 1274126177; return ((n ^ (n >>> 16)) >>> 0) / 4294967295; };
  return (x, y, z) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
    const s = t => t * t * (3 - 2 * t), u = s(xf), v = s(yf), w = s(zf);
    const lerp2 = (dz) => mix(mix(h(xi, yi, zi + dz), h(xi + 1, yi, zi + dz), u), mix(h(xi, yi + 1, zi + dz), h(xi + 1, yi + 1, zi + dz), u), v);
    return mix(lerp2(0), lerp2(1), w);
  };
}

function pack(parts, width, height) {
  const islands = [];
  for (const [pi, part] of parts.entries())
    for (let i = 0; i < part.islands; i++) {
      const verts = part.uv.map((uv, k) => (part.island[k] === i ? k : -1)).filter(k => k >= 0);
      if (!verts.length) continue;
      const xs = verts.map(k => part.uv[k][0]), ys = verts.map(k => part.uv[k][1]);
      const w = Math.max(...xs) - Math.min(...xs) || 0.01, h = Math.max(...ys) - Math.min(...ys) || 0.01;
      // Tall islands lie on their side so rows pack tightly.
      const rot = h > w * 1.25;
      islands.push({ pi, i, verts, rot, x0: Math.min(...xs), y0: Math.min(...ys), w: rot ? h : w, h: rot ? w : h, detail: part.detail * (part.islandDetail[i] ?? 1) });
    }
  const pad = 3;
  const tryPack = scale => {
    let x = pad, y = pad, row = 0;
    const placed = [];
    for (const s of [...islands].sort((a, b) => b.h * b.detail - a.h * a.detail)) {
      const w = Math.ceil(s.w * scale * s.detail) + pad, h = Math.ceil(s.h * scale * s.detail) + pad;
      if (w > width - pad) return null;
      if (x + w > width) { x = pad; y += row; row = 0; }
      if (y + h > height) return null;
      placed.push({ ...s, px: x, py: y, s: scale * s.detail }); x += w; row = Math.max(row, h);
    }
    return placed;
  };
  let lo = 0.01, hi = 1000, best = null;
  for (let k = 0; k < 40; k++) { const mid = Math.sqrt(lo * hi), r = tryPack(mid); if (r) { best = r; lo = mid; } else hi = mid; }
  if (!best) throw Error('The parts could not be packed into the texture; use fewer or simpler parts.');
  return best;
}

function commitSd(model, parts, { name = 'SDProp', size = 256, pathName, frame } = {}) {
  if (!parts.length) throw Error('Add at least one part before commit.');
  const [width, height] = Array.isArray(size) ? size : [size, size];
  if (![width, height].every(n => [64, 128, 256, 512, 1024].includes(n))) throw Error('size must be 64, 128, 256, 512 or 1024 (or [width, height]).');
  const placed = pack(parts, width, height);
  const uvOf = new Map();
  for (const s of placed)
    for (const k of s.verts) {
      const [u, v] = parts[s.pi].uv[k], a = (u - s.x0) * s.s, b = (v - s.y0) * s.s;
      uvOf.set(s.pi + ':' + k, s.rot ? [s.px + b, s.py + a] : [s.px + a, s.py + b]);
    }
  const all = parts.flatMap(p => p.p), zs = all.map(p => p[2]);
  const zmin = Math.min(...zs), zmax = Math.max(...zs), extent = Math.max(zmax - zmin, ...[0, 1].map(i => Math.max(...all.map(p => p[i])) - Math.min(...all.map(p => p[i])))) || 1;
  const boxes = parts.map(p => { const lo = [0, 1, 2].map(i => Math.min(...p.p.map(v => v[i]))), hi = [0, 1, 2].map(i => Math.max(...p.p.map(v => v[i]))); return { lo, hi }; });
  const key = V.norm([0.45, -0.35, 0.82]), wobble = noise3(7), stroke = noise3(13);
  // Glowing parts paint their light onto nearby surfaces, the way SD textures fake it.
  const glows = parts.flatMap((p, i) => {
    const m = material(p.material);
    if (!m.glow) return [];
    const { lo, hi } = boxes[i];
    return [{ i, color: m.light, center: [0, 1, 2].map(c => (lo[c] + hi[c]) / 2), radius: Math.max(1, ...[0, 1, 2].map(c => (hi[c] - lo[c]) / 2)) }];
  });
  const color = new Float32Array(width * height * 3), owner = new Int32Array(width * height).fill(-1), glowMask = new Uint8Array(width * height);
  const edgeAt = new Float32Array(width * height).fill(1e9), creaseAt = new Float32Array(width * height).fill(1e9);
  const islandIndex = new Map();
  for (const s of placed) for (const k of s.verts) islandIndex.set(s.pi + ':' + k, s);
  const islandOf = (pi, k) => islandIndex.get(pi + ':' + k);
  for (const [pi, part] of parts.entries()) {
    const m = material(part.material), pm = part.patternMaterial ? material(part.patternMaterial) : null;
    // Creases: hard or open edges get painted highlights (convex) or dark lines (concave).
    const keyOf = p => p.map(v => Math.round(v * 1000)).join(','), edges = new Map();
    part.tris.forEach((t, ti) => { for (let e = 0; e < 3; e++) { const a = t[e], b = t[(e + 1) % 3], ka = keyOf(part.p[a]), kb = keyOf(part.p[b]), id = ka < kb ? ka + '|' + kb : kb + '|' + ka; (edges.get(id) || edges.set(id, []).get(id)).push({ ti, a, b, c: t[(e + 2) % 3] }); } });
    const flags = new Map();
    for (const list of edges.values()) {
      if (list.length === 1) { flags.set(list[0].ti + ':' + list[0].a, 1); continue; }
      const [x, y] = list, fn = t => { const [a, b, c] = part.tris[t]; return V.norm(V.cross(V.sub(part.p[b], part.p[a]), V.sub(part.p[c], part.p[a]))); };
      const n1 = fn(x.ti), n2 = fn(y.ti), angle = (Math.acos(clamp(V.dot(n1, n2), -1, 1)) * 180) / Math.PI;
      // Painted creases follow the builder's own hard edges, not the smoothed shading normals.
      const n0 = part.n0 || part.n, hard = keyOf(n0[x.a].map(v => v * 10)) !== keyOf(n0[y.b].map(v => v * 10)) || keyOf(n0[x.b].map(v => v * 10)) !== keyOf(n0[y.a].map(v => v * 10));
      if (!hard || angle < 20) continue;
      const convex = V.dot(V.sub(part.p[y.c], part.p[x.a]), n1) < 0 ? 1 : -1;
      flags.set(x.ti + ':' + x.a, convex); flags.set(y.ti + ':' + y.a, convex);
    }
    const lo = boxes[pi].lo, hi = boxes[pi].hi, center = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
    part.tris.forEach((t, ti) => {
      const uv = t.map(k => uvOf.get(pi + ':' + k)), [A, B, C] = uv;
      const det = (B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1]);
      if (Math.abs(det) < 1e-9) return;
      const triEdges = [0, 1, 2].map(e => ({ flag: flags.get(ti + ':' + t[e]) || 0, a: uv[e], b: uv[(e + 1) % 3] })).filter(e => e.flag);
      const x0 = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0])) - 1), x1 = Math.min(width - 1, Math.ceil(Math.max(A[0], B[0], C[0])) + 1);
      const y0 = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1])) - 1), y1 = Math.min(height - 1, Math.ceil(Math.max(A[1], B[1], C[1])) + 1);
      for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) {
        const q = [px + 0.5, py + 0.5];
        let l1 = ((B[0] - q[0]) * (C[1] - q[1]) - (C[0] - q[0]) * (B[1] - q[1])) / det, l2 = ((C[0] - q[0]) * (A[1] - q[1]) - (A[0] - q[0]) * (C[1] - q[1])) / det, l3 = 1 - l1 - l2;
        const tol = -0.75 / Math.max(1, Math.sqrt(Math.abs(det)));
        if (l1 < tol || l2 < tol || l3 < tol) continue;
        const i = py * width + px;
        if (owner[i] >= 0 && Math.min(l1, l2, l3) < 0) continue;
        [l1, l2, l3] = [l1, l2, l3].map(v => Math.max(0, v)); const sum = l1 + l2 + l3; l1 /= sum; l2 /= sum; l3 /= sum;
        const P = [0, 1, 2].map(c => part.p[t[0]][c] * l1 + part.p[t[1]][c] * l2 + part.p[t[2]][c] * l3);
        const N = V.norm([0, 1, 2].map(c => part.n[t[0]][c] * l1 + part.n[t[1]][c] * l2 + part.n[t[2]][c] * l3));
        let shade;
        if (m.glow) shade = 0.62 + 0.3 * Math.max(0, V.dot(N, key)) + 0.12 * (wobble(P[0] / extent * 6, P[1] / extent * 6, P[2] / extent * 6) - 0.5);
        else {
          const light = 0.2 + 0.72 * Math.max(0, V.dot(N, key)) + 0.2 * (N[2] * 0.5 + 0.5);
          const height01 = (P[2] - zmin) / (zmax - zmin || 1);
          let occlusion = 0.74 + 0.34 * height01;
          // Inside a hollow (a cup's inner wall) light falls off with depth.
          const radial = V.norm([P[0] - center[0], P[1] - center[1], 0]);
          if (V.dot(N, radial) < -0.35) occlusion *= 0.55 + 0.4 * smooth(lo[2], hi[2], P[2]);
          // Contact shadow where another part touches or covers this one.
          for (const [oi, box] of boxes.entries()) {
            if (oi === pi) continue;
            const margin = extent * 0.03, inside = [0, 1, 2].every(c => P[c] > box.lo[c] - margin && P[c] < box.hi[c] + margin);
            if (inside) occlusion *= 0.72;
          }
          shade = light * occlusion;
          // Painted metal sheen: a bright vertical streak where a surface turns toward the light.
          if (m.metal) {
            const h = V.norm([N[0], N[1], 0]), kh = V.norm([key[0], key[1], 0]);
            shade += 0.32 * Math.pow(Math.max(0, V.dot(h, kh)), 10) * (1 - Math.abs(N[2])) * occlusion;
          }
          shade += 0.14 * (wobble(P[0] / extent * 5, P[1] / extent * 5, P[2] / extent * 5) - 0.5);
          shade += 0.06 * (stroke(P[0] / extent * 3, P[1] / extent * 3, P[2] / extent * 22) - 0.5);
        }
        const k = i * 3, c = ramp(m, clamp(shade, 0, 1.15));
        if (!m.glow)
          for (const g of glows) {
            if (g.i === pi) continue;
            const d = V.len(V.sub(P, g.center)), reach = g.radius * 3.6;
            if (d >= reach) continue;
            const facing = Math.max(0.25, V.dot(N, V.norm(V.sub(g.center, P))) * 0.5 + 0.5), f = Math.pow(1 - d / reach, 1.6) * 0.8 * facing;
            for (let ch = 0; ch < 3; ch++) c[ch] = mix(c[ch], Math.max(c[ch], g.color[ch]), f);
          }
        color[k] = c[0]; color[k + 1] = c[1]; color[k + 2] = c[2]; owner[i] = pi; if (m.glow) glowMask[i] = 1;
        for (const e of triEdges) {
          const ex = e.b[0] - e.a[0], ey = e.b[1] - e.a[1], l = ex * ex + ey * ey || 1, s = clamp(((q[0] - e.a[0]) * ex + (q[1] - e.a[1]) * ey) / l), d = Math.hypot(q[0] - e.a[0] - s * ex, q[1] - e.a[1] - s * ey);
          if (e.flag > 0) edgeAt[i] = Math.min(edgeAt[i], d); else creaseAt[i] = Math.min(creaseAt[i], d);
        }
        if (part.pattern !== 'none') patternPixel(part, pm || m, m, q, islandOf(pi, t[0]), P, N, color, k, center, lo, hi);
      }
    });
  }
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    let r = color[i * 3], g = color[i * 3 + 1], b = color[i * 3 + 2];
    if (owner[i] >= 0) {
      const m = material(parts[owner[i]].material);
      const e = 1 - smooth(0.4, 2.2, edgeAt[i]), d = 1 - smooth(0.3, 1.6, creaseAt[i]);
      if (e > 0) { r = mix(r, m.edge[0], e * 0.75); g = mix(g, m.edge[1], e * 0.75); b = mix(b, m.edge[2], e * 0.75); }
      if (d > 0 && !glowMask[i]) { r = mix(r, m.dark[0] * 0.6, d * 0.7); g = mix(g, m.dark[1] * 0.6, d * 0.7); b = mix(b, m.dark[2] * 0.6, d * 0.7); }
    }
    data.set([clamp(Math.round(r), 0, 255), clamp(Math.round(g), 0, 255), clamp(Math.round(b), 0, 255), 255], i * 4);
  }
  dilate(data, owner, width, height, 4);
  // One geoset: the packed UVs in 0..1 with the texture's top-left origin.
  const Vertices = [], Normals = [], uvs = [], Faces = [], { place, turn } = framed(frame);
  for (const [pi, part] of parts.entries()) {
    const base = Vertices.length / 3;
    part.p.forEach((p, k) => { Vertices.push(...place(p)); Normals.push(...turn(part.n[k])); const [u, v] = uvOf.get(pi + ':' + k); uvs.push(u / width, v / height); });
    for (const t of part.tris) Faces.push(base + t[0], base + t[1], base + t[2]);
  }
  if (Vertices.length / 3 > 65535) throw Error('Too many vertices for one Warcraft geoset.');
  const safe = String(name).replace(/[^A-Za-z0-9_-]+/g, '') || 'SDProp', used = new Set((model.Textures || []).map(t => String(t.Image).toLowerCase()));
  let texturePath = pathName || `MDLxL_Forge\\SD_${safe}.tga`;
  for (let n = 2; used.has(texturePath.toLowerCase()); n++) texturePath = `MDLxL_Forge\\SD_${safe}_${n}.tga`;
  const mesh = { geosets: [{ Vertices: new Float32Array(Vertices), Normals: new Float32Array(Normals), TVertices: [new Float32Array(uvs)], Faces: new Uint16Array(Faces) }] };
  const committed = commitForge(model, mesh, { texturePath });
  // Opaque painted texture: plain None blending renders and sorts like Blizzard props.
  const layer = model.Materials[model.Geosets[committed.geosetIndices[0]].MaterialID].Layers[0];
  layer.FilterMode = 0; layer.Shading = 0;
  const image = { width, height, data };
  return { model, assets: [{ name: texturePath, bytes: encodeForgeTga(image), source: 'forge' }, ...committed.extraAssets], triangles: Faces.length / 3, texture: texturePath, geoset: committed.geosetIndices[0] };
}

function dilate(data, owner, width, height, passes) {
  const filled = Uint8Array.from(owner, o => (o >= 0 ? 1 : 0));
  for (let p = 0; p < passes; p++) {
    const next = filled.slice();
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = y * width + x; if (filled[i]) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const j = ny * width + nx; if (!filled[j]) continue;
        data.copyWithin(i * 4, j * 4, j * 4 + 4); next[i] = 1; break;
      }
    }
    filled.set(next);
  }
}

// Rune strokes in a unit cell (x right, y down), drawn inside a margin.
const RUNES = [
  [[0.5, 0.12, 0.5, 0.88], [0.5, 0.16, 0.74, 0.38], [0.5, 0.4, 0.74, 0.62]],
  [[0.3, 0.12, 0.7, 0.88], [0.7, 0.12, 0.3, 0.88]],
  [[0.5, 0.12, 0.74, 0.5], [0.74, 0.5, 0.5, 0.88], [0.5, 0.88, 0.26, 0.5], [0.26, 0.5, 0.5, 0.12]],
  [[0.5, 0.12, 0.5, 0.88], [0.5, 0.12, 0.27, 0.36], [0.5, 0.12, 0.73, 0.36]],
  [[0.3, 0.12, 0.3, 0.88], [0.7, 0.12, 0.7, 0.88], [0.3, 0.14, 0.7, 0.5], [0.7, 0.14, 0.3, 0.5]],
  [[0.36, 0.12, 0.66, 0.4], [0.66, 0.4, 0.34, 0.6], [0.34, 0.6, 0.64, 0.88]],
  [[0.5, 0.12, 0.5, 0.88], [0.28, 0.3, 0.72, 0.62]],
];
// Painted motifs. Bands (runes, engraved, rivets) sit at patternAt [fromZ, toZ]
// in world height (default: the middle of the part) and run around the part.
function patternPixel(part, pm, m, q, island, P, N, color, k, center, lo, hi) {
  if (!island) return;
  const pattern = part.pattern, pw = island.w * island.s, ph = island.h * island.s, pu = (q[0] - island.px) / pw, pv = (q[1] - island.py) / ph;
  // Patterns work in the island's own orientation, also when it was packed on its side.
  const [u, v, w, h] = island.rot ? [pv, pu, ph, pw] : [pu, pv, pw, ph];
  const set = (c, a) => { color[k] = mix(color[k], c[0], a); color[k + 1] = mix(color[k + 1], c[1], a); color[k + 2] = mix(color[k + 2], c[2], a); };
  const [z0, z1] = part.patternAt || [mix(lo[2], hi[2], 0.62), mix(lo[2], hi[2], 0.74)];
  const radial = [P[0] - center[0], P[1] - center[1]], r = Math.hypot(...radial) || 1;
  const outward = (N[0] * radial[0] + N[1] * radial[1]) / r > 0.25;
  const bandV = (P[2] - z0) / (z1 - z0 || 1), bandH = Math.abs(z1 - z0) || 1;
  // Distance around the part in world units, so glyphs keep their size.
  const around = part.kind === 'lathe' ? (Math.atan2(radial[1], radial[0]) + Math.PI) * r : u * w / island.s;
  if (pattern === 'grain') { const s = Math.sin(u * 40 + Math.sin(v * 9) * 2.5); if (s > 0.6) set(m.dark, 0.35 * (s - 0.6) / 0.4); }
  else if (pattern === 'rivets') {
    if (!outward || bandV < -0.2 || bandV > 1.2) return;
    const spacing = bandH * 1.6, cu = ((around / spacing) % 1 + 1) % 1, d = Math.hypot((cu - 0.5) * spacing, (bandV - 0.5) * bandH);
    if (d < bandH * 0.32) set(d < bandH * 0.16 ? pm.edge : pm.dark, d < bandH * 0.16 ? 0.9 : 0.75);
  } else if (pattern === 'runes' || pattern === 'engraved') {
    if (!outward || bandV < 0 || bandV > 1) return;
    // Angular runes: a stave with branches, from a small fixed set, evenly spaced.
    const cellW = bandH * 0.75, cu = around / cellW, cell = Math.floor(cu), lu = cu - cell, lv = 1 - bandV;
    const glyph = RUNES[(((cell * 7919) % RUNES.length) + RUNES.length) % RUNES.length];
    let d = 1e9;
    for (const [ax, ay, bx, by] of glyph) {
      const ex = (bx - ax) * cellW, ey = (by - ay) * bandH, px = (lu - ax) * cellW, py = (lv - ay) * bandH;
      const l = ex * ex + ey * ey || 1, t = clamp((px * ex + py * ey) / l);
      d = Math.min(d, Math.hypot(px - t * ex, py - t * ey));
    }
    const width = bandH * 0.075;
    if (d < width) set(pattern === 'runes' ? pm.light : m.dark, pattern === 'runes' ? 0.95 : 0.8);
    else if (d < width * 2.2) set(pattern === 'runes' ? pm.mid : m.edge, pattern === 'runes' ? 0.55 * (1 - (d - width) / (width * 1.2)) : 0.25);
  } else if (pattern === 'scratches') {
    const spacing = 7, qx = (u * w * 0.8 + v * h * 0.35) / spacing, line = qx - Math.floor(qx), seg = Math.floor(v * h / 10), id = Math.floor(qx);
    const keep = Math.sin(id * 91.7 + seg * 47.3) * 43758.5453; if (line < 0.08 && keep - Math.floor(keep) > 0.72) set(m.edge, 0.3);
  } else if (pattern === 'wrap') {
    // Diagonal bands of a wrapped grip: dark grooves, a light top on each band.
    const period = Math.max(1.5, r * 1.1), f = (((P[2] + around * 0.35) / period) % 1 + 1) % 1;
    if (f < 0.14) set(m.dark, 0.85); else if (f < 0.32) set(m.light, 0.5 * (1 - (f - 0.14) / 0.18));
  }
  else if (pattern === 'slitEye') {
    // A burning iris with a black vertical slit, brightest at the pupil.
    const x = (u - 0.5) * 2, y = (v - 0.5) * 2, rr = Math.hypot(x, y * 1.15), slit = Math.abs(x) - 0.07 * (1 - y * y);
    set(ramp(pm, clamp(1.05 - rr * 0.75)), 0.92);
    if (slit < 0) set([8, 2, 2], 1); else if (slit < 0.08) set(pm.edge, 0.85 * (1 - slit / 0.08));
  } else if (pattern === 'gem') { const x = u - 0.35, y = v - 0.3, d = Math.hypot(x, y); set(ramp(pm, clamp(1.1 - d * 1.6)), 0.7); if (d < 0.1) set(pm.edge, 0.9); }
  else if (pattern === 'flames') { const f = v + 0.25 * Math.sin(u * 18) * (1 - v); if (f < 0.55) set(ramp(pm, clamp(1 - f * 1.4)), 0.85 * (1 - f / 0.55)); }
}
