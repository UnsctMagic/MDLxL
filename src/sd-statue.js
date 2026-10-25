/** SD Statue: a game model frozen in a strong pose and made into a clean Warcraft III SD statue
 * doodad: one root bone, one Stand (a sinking Death only for a destructible), a hand-painted stone,
 * marble or bronze texture baked for the model's own UV islands (top light, dark undersides, worn
 * ridges, cracks, a little moss or patina), and an sd-kit pedestal it stands on. Native statue
 * doodads (measured in the game) are 164-699 triangles, 8-37 KB, one or two bones, one texture,
 * Stand only (Stand + a sinking Death when destructible) and 180-475 units tall; a Footman is 98.
 *
 * Recipe: one mdlxl_script edit in an empty SD model (MDX 800), scope bash.BASE_SCOPE (the whole
 * model), the creature loaded first with mdlxl_assets as a reference (Red Dragon: its bones are named,
 * its wings solid; skeletal or alpha-card creatures like the Frost Wyrm make poorer stone):
 *   const statue = await api.module('sd-statue'), bash = await api.module('sd-kitbash');
 *   bash.adopt(model, references[dragonId].model);           // the creature becomes the open model
 *   const pose = statue.choosePose(model)[0];                // best silhouette; never Stand or the bind pose
 *   statue.bakePose(model, { ...pose, name: 'DragonStatue' }); // frozen mesh on one bone, one Stand
 *   statue.addPedestal(model, { shape: 'octagon' });         // carved plinth under its feet
 *   const paint = statue.paintStatueTexture(model, { material: 'stone', size: 512, name: 'DragonStatue' });
 *   assets.push(...paint.assets);                            // the painted TGA travels with the model
 *   return statue.statueReport(model);                       // triangles, size, height in Footmen, checks
 * Then look at it (capture) before calling it done. choosePose(model, { sequences: ['Spell'] }) limits
 * the search; bakePose(model, { sequence: 'Attack', at: 0.4, rear: 15 }) takes a pose by hand; height
 * (units) resizes; material 'marble', 'bronze', 'sandstone' or 'darkStone' changes the stone. A
 * destructible statue: bakePose(model, { ...pose, death: true }).
 */
import { allNodes, sampleGeosetAnimation, sampleNodeMatrices, sampleTrack, skinGeoset, skinGeosetNormals } from './animation.js';
import { createNode, MODEL_COUNT_FIELDS, recalculateExtents } from './editor-document.js';
import { encodeForgeTga } from './forge.js';
import { normalizeVersionFields } from './model-version.js';
import { builder } from './sd-kit.js';

/** Numbers of the game's own statue doodads, for checks and for the AI's sense of scale. */
export const NATIVE_STATUES = Object.freeze({
  triangles: [164, 699], kb: [8, 37], bones: [1, 2], textures: 1, height: [181, 476], footman: 98,
  sequences: 'Stand only; Stand + Death (sinking into the ground) when the statue is destructible',
  examples: 'Ruins Statue1 190 tris 8 KB; Ruins Statue0 164 tris 11 KB; City Knight Statue 316 tris 14 KB; Azshara Statue 699 tris 37 KB',
});

/** Palettes in SD hand-painted style: shadows lean cool, lights warm. accent paints crevices and
 * upward faces (moss on stone and marble, verdigris on bronze). */
export const STATUE_MATERIALS = Object.freeze({
  stone: { dark: '#232529', mid: '#67655f', light: '#a9a395', edge: '#e0d9c6', accent: { dark: '#1c2410', mid: '#3d4d1e', light: '#64773a' } },
  darkStone: { dark: '#121316', mid: '#3c3c42', light: '#6c6a70', edge: '#a9a4a0', accent: { dark: '#18230d', mid: '#3a531a', light: '#62802c' } },
  sandstone: { dark: '#3a2a18', mid: '#8c7350', light: '#c9ae7c', edge: '#efdcb0', accent: { dark: '#2a3412', mid: '#5a6e24', light: '#8ea044' } },
  marble: { dark: '#4a4a52', mid: '#a7a6a8', light: '#dcd9d2', edge: '#fbf8f0', accent: { dark: '#2e3a1c', mid: '#5f7438', light: '#8fa35a' }, veins: true },
  bronze: { dark: '#2a1406', mid: '#7a4a1c', light: '#c48b45', edge: '#f6dca0', accent: { dark: '#163a32', mid: '#2f7a66', light: '#62b8a0' }, metal: true },
});

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => Math.hypot(a[0], a[1], a[2]);
const norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const rgb = hex => { const n = parseInt(String(hex).replace('#', ''), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const at3 = (array, i) => [array[i * 3], array[i * 3 + 1], array[i * 3 + 2]];

// ---------------------------------------------------------------------------------------------
// Poses

function sequenceIndex(model, sequence) {
  const seqs = model.Sequences || [];
  if (Number.isInteger(sequence)) { if (!seqs[sequence]) throw Error(`There is no animation ${sequence}.`); return sequence; }
  const s = String(sequence ?? '').trim().toLowerCase();
  let i = seqs.findIndex(q => String(q.Name || '').trim().toLowerCase() === s);
  if (i < 0 && s) i = seqs.findIndex(q => String(q.Name || '').toLowerCase().includes(s));
  if (i < 0) throw Error(`No animation named like ${sequence}. Animations: ${seqs.map(q => q.Name).join(', ')}.`);
  return i;
}
/** { sequence, frame } from a sequence (index or name) and a frame (ms) or at (0..1 through it). */
function resolvePose(model, { sequence, frame, at } = {}) {
  const index = sequenceIndex(model, sequence), [a, b] = model.Sequences[index].Interval;
  const f = frame != null ? Number(frame) : a + (b - a) * clamp(Number(at ?? 0.5));
  if (!Number.isFinite(f) || f < a || f > b) throw Error(`frame must lie inside ${model.Sequences[index].Name} (${a}-${b}).`);
  return { sequence: index, frame: Math.round(f) };
}

/** Geosets a statue keeps at a pose: shown at that frame and solid (not additive, modulate or
 * team-glow effect cards, nor layers faded out at that frame). */
export function statueGeosets(model, { sequence = -1, frame = 0 } = {}) {
  const interval = model.Sequences?.[sequence]?.Interval;
  return (model.Geosets || []).map((_, i) => i).filter(i => {
    const g = model.Geosets[i];
    if (!g.Faces?.length || !g.Vertices?.length) return false;
    if (sequence >= 0 && sampleGeosetAnimation(model, i, frame, sequence).alpha < 0.05) return false;
    const layers = model.Materials?.[g.MaterialID]?.Layers || [];
    if (!layers.length) return true;
    const effect = layer => layer.FilterMode >= 3 || model.Textures?.[layer.TextureID]?.ReplaceableId === 2;
    const faded = layer => (typeof layer.Alpha === 'number' ? layer.Alpha : sampleTrack(layer.Alpha, frame, { interval, globalSequences: model.GlobalSequences, fallback: 1 })) < 0.05;
    return !layers.every(l => effect(l) || faded(l));
  });
}

/** Rotation of the whole posed figure: rear (degrees, nose up about Y: the creature rears back onto
 * its hind legs and tail, as rearing statues do) then turn (degrees about Z). */
function figureRotation(rear = 0, turn = 0) {
  const a = (-Number(rear) * Math.PI) / 180, b = (Number(turn) * Math.PI) / 180;
  if (!Number.isFinite(a) || !Number.isFinite(b)) throw Error('rear and turn must be numbers (degrees).');
  const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
  return p => { const x = p[0] * ca + p[2] * sa, z = -p[0] * sa + p[2] * ca; return [x * cb - p[1] * sb, x * sb + p[1] * cb, z]; };
}

/** The posed mesh at a frame: per kept geoset its posed positions and normals (Float32Arrays).
 * rear and turn (degrees) rotate the whole figure afterwards (see bakePose). */
export function posedMesh(model, pose = {}) {
  const { sequence, frame } = resolvePose(model, pose), matrices = sampleNodeMatrices(model, frame, sequence, frame);
  const kept = pose.geosets ?? statueGeosets(model, { sequence, frame }), rotate = figureRotation(pose.rear ?? 0, pose.turn ?? 0);
  const turned = array => { for (let i = 0; i < array.length; i += 3) array.set(rotate([array[i], array[i + 1], array[i + 2]]), i); return array; };
  return {
    sequence, frame,
    geosets: kept.map(index => {
      const g = model.Geosets[index];
      if (!g.Normals?.length) throw Error(`Geoset ${index} has no normals.`);
      return { index, positions: turned(skinGeoset(g, matrices)), normals: turned(skinGeosetNormals(g, matrices)) };
    }),
  };
}

const PARTS = [['wing', /wing|feather|membrane/i], ['head', /head|jaw|skull|mouth|teeth|tongue|horn|eye/i], ['neck', /neck/i], ['tail', /tail/i], ['leg', /leg|foot|feet|thigh|shin|calf|toe|claw|knee|arm|hand|finger|paw|hoof/i]];
/** The body part of every node, by its name or else its parent's: wing, head, neck, tail, leg or
 * body. Rigs without such names (numbered bones) get wings and head from the bind pose: bones whose
 * vertices lie far out to the sides of a wide creature are wings, the bone furthest forward the head. */
function nodeParts(model, kept = []) {
  const byId = new Map(allNodes(model).map(n => [n.ObjectId, n])), memo = new Map(), guessed = new Map();
  const named = PARTS.map(([p]) => p).filter(p => [...byId.values()].some(n => PARTS.find(([q]) => q === p)[1].test(n.Name || '')));
  if (!named.includes('wing') || !named.includes('head')) {
    const sums = new Map(), all = [];
    for (const i of kept) {
      const g = model.Geosets[i];
      for (let v = 0; v < g.Vertices.length / 3; v++) {
        const p = at3(g.Vertices, v), b = vertexBones(g, v)[0];
        all.push(p);
        if (b == null) continue;
        const s = sums.get(b) || sums.set(b, { n: 0, y: 0, x: 0 }).get(b); s.n++; s.y += p[1]; s.x += p[0];
      }
    }
    if (all.length) {
      const span = k => Math.max(...all.map(p => p[k])) - Math.min(...all.map(p => p[k])), cy = mean(all.map(p => p[1]));
      const wide = span(1) > Math.max(span(0), span(2)) * 0.9;
      const means = [...sums].map(([b, s]) => ({ b, y: s.y / s.n - cy, x: s.x / s.n }));
      if (!named.includes('wing') && wide) for (const m of means) if (Math.abs(m.y) > span(1) * 0.22) guessed.set(m.b, 'wing');
      if (!named.includes('head') && means.length) { const front = means.filter(m => !guessed.has(m.b)).sort((a, b) => b.x - a.x)[0]; if (front) guessed.set(front.b, 'head'); }
    }
  }
  const part = (id, depth = 0) => {
    if (memo.has(id)) return memo.get(id);
    const node = byId.get(id);
    if (!node || depth > 64) return 'body';
    const hit = PARTS.find(([, re]) => re.test(node.Name || ''));
    const result = hit ? hit[0] : guessed.get(id) ?? (node.Parent != null && node.Parent >= 0 && node.Parent !== id ? part(node.Parent, depth + 1) : 'body');
    memo.set(id, result);
    return result;
  };
  return part;
}
const vertexBones = (g, v) => { const skin = g.SkinWeights; return skin?.length >= (v + 1) * 8 ? [0, 1, 2, 3].filter(k => skin[v * 8 + 4 + k]).sort((a, b) => skin[v * 8 + 4 + b] - skin[v * 8 + 4 + a]).map(k => skin[v * 8 + k]) : g.Groups?.[g.VertexGroup?.[v]] || []; };
function vertexParts(model, g, part) {
  const count = g.Vertices.length / 3, out = new Array(count);
  for (let v = 0; v < count; v++) {
    const tally = new Map();
    for (const id of vertexBones(g, v)) { const p = part(id); if (p !== 'body') tally.set(p, (tally.get(p) || 0) + 1); }
    out[v] = tally.size ? [...tally].sort((a, b) => b[1] - a[1])[0][0] : 'body';
  }
  return out;
}
/** Steps between two nodes in the hierarchy (helpers included): neighbouring joints are 1 to 4 apart. */
function treeDistance(model) {
  const byId = new Map(allNodes(model).map(n => [n.ObjectId, n])), chains = new Map();
  const chain = id => {
    if (chains.has(id)) return chains.get(id);
    const out = [];
    for (let at = id, guard = 0; at != null && at >= 0 && byId.has(at) && guard < 128; at = byId.get(at).Parent, guard++) out.push(at);
    chains.set(id, out);
    return out;
  };
  return (a, b) => {
    if (a === b) return 0;
    const ca = chain(a), cb = chain(b), ib = new Map(cb.map((id, i) => [id, i]));
    for (let i = 0; i < ca.length; i++) if (ib.has(ca[i])) return i + ib.get(ca[i]);
    return Infinity;
  };
}

// Cells covered by triangles projected with project(p) -> [x, y]; small triangles mark their centre.
function silhouette(points, tris, project, cell) {
  const cells = new Set(), P = points.map(project);
  for (const [a, b, c] of tris) {
    const A = P[a], B = P[b], C = P[c];
    const det = (B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1]);
    cells.add(Math.floor((A[0] + B[0] + C[0]) / 3 / cell) * 100003 + Math.floor((A[1] + B[1] + C[1]) / 3 / cell));
    if (Math.abs(det) < 1e-9) continue;
    const x0 = Math.floor(Math.min(A[0], B[0], C[0]) / cell), x1 = Math.floor(Math.max(A[0], B[0], C[0]) / cell);
    const y0 = Math.floor(Math.min(A[1], B[1], C[1]) / cell), y1 = Math.floor(Math.max(A[1], B[1], C[1]) / cell);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const q = [(x + 0.5) * cell, (y + 0.5) * cell];
      const l1 = ((B[0] - q[0]) * (C[1] - q[1]) - (C[0] - q[0]) * (B[1] - q[1])) / det, l2 = ((C[0] - q[0]) * (A[1] - q[1]) - (A[0] - q[0]) * (C[1] - q[1])) / det;
      if (l1 >= 0 && l2 >= 0 && l1 + l2 <= 1) cells.add(x * 100003 + y);
    }
  }
  return cells.size * cell * cell;
}

function segmentHits(p, q, a, b, c) {
  const d = sub(q, p), e1 = sub(b, a), e2 = sub(c, a), h = cross(d, e2), det = dot(e1, h);
  if (Math.abs(det) < 1e-12) return false;
  const f = 1 / det, s = sub(p, a), u = f * dot(s, h);
  if (u < 0 || u > 1) return false;
  const qv = cross(s, e1), v = f * dot(d, qv);
  if (v < 0 || u + v > 1) return false;
  const t = f * dot(e2, qv);
  return t > 1e-4 && t < 1 - 1e-4;
}
/** Pairs of triangles that cut through each other, share no corner (positions welded) and hang on
 * bones that are not neighbouring joints (apart(a, b), by triangle): a foot in a thigh, a wing
 * through the body. A jaw closing into its own head is not counted. */
function intersections(points, tris, keys, cell, apart = () => true) {
  const grid = new Map(), boxes = tris.map(t => { const lo = [0, 1, 2].map(k => Math.min(...t.map(v => points[v][k]))), hi = [0, 1, 2].map(k => Math.max(...t.map(v => points[v][k]))); return { lo, hi }; });
  boxes.forEach(({ lo, hi }, i) => {
    for (let x = Math.floor(lo[0] / cell); x <= Math.floor(hi[0] / cell); x++) for (let y = Math.floor(lo[1] / cell); y <= Math.floor(hi[1] / cell); y++) for (let z = Math.floor(lo[2] / cell); z <= Math.floor(hi[2] / cell); z++) {
      const k = `${x},${y},${z}`; (grid.get(k) || grid.set(k, []).get(k)).push(i);
    }
  });
  const seen = new Set();
  let count = 0;
  for (const list of grid.values()) for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j], id = a < b ? a * 1e6 + b : b * 1e6 + a;
    if (seen.has(id)) continue;
    seen.add(id);
    const A = boxes[a], B = boxes[b];
    if ([0, 1, 2].some(k => A.lo[k] > B.hi[k] || B.lo[k] > A.hi[k])) continue;
    const ta = tris[a], tb = tris[b];
    if (!apart(a, b) || ta.some(v => tb.some(w => keys[v] === keys[w]))) continue;
    const pa = ta.map(v => points[v]), pb = tb.map(v => points[v]);
    let hit = false;
    for (let e = 0; e < 3 && !hit; e++) hit = segmentHits(pa[e], pa[(e + 1) % 3], ...pb) || segmentHits(pb[e], pb[(e + 1) % 3], ...pa);
    if (hit) count++;
  }
  return count;
}

const mean = list => (list.length ? list.reduce((s, v) => s + v, 0) / list.length : 0);
/** Measures of one pose (the mesh already posed): spread, wings, head, support and clashes. */
function poseMeasures(points, tris, parts, keys, S, knownClashes = null, apart) {
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]), zs = points.map(p => p[2]);
  const lo = [Math.min(...xs), Math.min(...ys), Math.min(...zs)], hi = [Math.max(...xs), Math.max(...ys), Math.max(...zs)], H = hi[2] - lo[2] || 1;
  const of = name => points.filter((_, i) => parts[i] === name);
  const body = of('body').length ? of('body') : points, bodyZ = mean(body.map(p => p[2])), bodyC = [mean(body.map(p => p[0])), mean(body.map(p => p[1]))];
  const wings = of('wing'), head = of('head');
  let wingSpan = 0, wingsUp = 0;
  if (wings.length) {
    wingSpan = (Math.max(...wings.map(p => p[1])) - Math.min(...wings.map(p => p[1]))) / S;
    const far = wings.map(p => ({ p, d: Math.hypot(p[0] - bodyC[0], p[1] - bodyC[1]) })).sort((a, b) => b.d - a.d).slice(0, Math.max(1, Math.round(wings.length * 0.25)));
    wingsUp = (mean(far.map(f => f.p[2])) - bodyZ) / S;
  }
  const headUp = head.length ? (mean(head.map(p => p[2])) - bodyZ) / S : 0;
  // Standing: the lowest points are feet (a tail or belly will do), right below the weight.
  const band = points.map((p, i) => i).filter(i => points[i][2] <= lo[2] + H * 0.08);
  const support = band.length ? mean(band.map(i => ({ leg: 1, tail: 0.6, body: 0.4 })[parts[i]] ?? 0)) : 0;
  const weight = [mean(points.map(p => p[0])), mean(points.map(p => p[1]))], feet = [mean(band.map(i => points[i][0])), mean(band.map(i => points[i][1]))];
  const balance = 1 - clamp(Math.hypot(weight[0] - feet[0], weight[1] - feet[1]) / (0.25 * S));
  const cell = S / 48, views = [p => [p[1], p[2]], p => [p[0], p[2]], p => { const x = (p[0] - p[1]) * Math.SQRT1_2, y = (p[0] + p[1]) * Math.SQRT1_2; return [y, p[2] * 0.83 - x * 0.56]; }];
  const area = mean(views.map(v => silhouette(points, tris, v, cell))) / (S * S);
  // A rigid rotation changes no clashes, so a reared copy reuses the count.
  return { height: H / S, wingSpan, wingsUp, headUp, support, balance, area, clashes: knownClashes ?? intersections(points, tris, keys, S / 14, apart) };
}

/** Score poses of the model's animations for a statue: a big silhouette (wings spread, raised),
 * the head up, standing on legs or tail rather than a wing tip, and limbs not cutting through each
 * other. Each frame is also tried reared back (rears, degrees nose up), as flying creatures are
 * set on a plinth. Stand, Death, Decay and Portrait animations are left out unless named in
 * sequences. Returns poses best first: [{ sequence, name, frame, at, rear, score, measures }],
 * each ready for bakePose. */
export function choosePose(model, { sequences, samples = 16, top = 8, rears = [0, 15, 30, 45] } = {}) {
  const all = model.Sequences || [];
  if (!all.length) throw Error('The model has no animations to choose a pose from.');
  const skip = /stand|death|decay|dissipate|portrait|sleep|birth|morph/i;
  const indices = sequences ? sequences.map(s => sequenceIndex(model, s)) : all.map((_, i) => i).filter(i => !skip.test(all[i].Name || ''));
  if (!indices.length) throw Error('No animation to choose a pose from; name some in sequences.');
  const kept = statueGeosets(model, { sequence: indices[0], frame: all[indices[0]].Interval[0] }), part = nodeParts(model, kept);
  const tris = [], parts = [], keys = [], bones = [], distance = treeDistance(model);
  let base = 0;
  for (const i of kept) {
    const g = model.Geosets[i];
    vertexParts(model, g, part).forEach(p => parts.push(p));
    for (let v = 0; v < g.Vertices.length / 3; v++) { keys.push(at3(g.Vertices, v).map(n => Math.round(n * 100)).join(',')); bones.push(vertexBones(g, v)[0] ?? -1); }
    for (let f = 0; f < g.Faces.length; f += 3) tris.push([base + g.Faces[f], base + g.Faces[f + 1], base + g.Faces[f + 2]]);
    base += g.Vertices.length / 3;
  }
  const triBone = tris.map(t => bones[t[0]]), apart = (a, b) => distance(triBone[a], triBone[b]) > 4;
  const flat = mesh => mesh.geosets.flatMap(m => Array.from({ length: m.positions.length / 3 }, (_, v) => at3(m.positions, v)));
  const bind = kept.flatMap(i => Array.from({ length: model.Geosets[i].Vertices.length / 3 }, (_, v) => at3(model.Geosets[i].Vertices, v)));
  const S = len(sub([0, 1, 2].map(k => Math.max(...bind.map(p => p[k]))), [0, 1, 2].map(k => Math.min(...bind.map(p => p[k]))))) || 1;
  const baseline = poseMeasures(bind, tris, parts, keys, S, null, apart);
  const results = [];
  const round = v => Math.round(v * 1000) / 1000;
  for (const sequence of indices) {
    const [a, b] = all[sequence].Interval;
    for (let k = 0; k < samples; k++) {
      const at = samples > 1 ? k / (samples - 1) : 0.5, frame = Math.round(a + (b - a) * at);
      const plain = flat(posedMesh(model, { sequence, frame, geosets: kept }));
      const moved = Math.sqrt(mean(plain.map((p, i) => dot(sub(p, bind[i]), sub(p, bind[i]))))) / S;
      let clashes = null;
      for (const rear of rears) {
        const rotate = figureRotation(rear), points = rear ? plain.map(rotate) : plain;
        const m = poseMeasures(points, tris, parts, keys, S, clashes, apart);
        clashes = m.clashes;
        const clash = Math.max(0, m.clashes - baseline.clashes) / Math.max(1, tris.length * 0.01);
        // Wings spread and raised, head up, a big silhouette; standing on legs or tail; not the
        // bind pose; few new clashes; rearing only as far as it helps.
        const score = 0.9 * (m.area / (baseline.area || 1)) + 1.0 * m.wingSpan + 1.6 * m.wingsUp + 2.4 * m.headUp + 0.6 * m.height + 0.8 * m.support + 1.2 * m.balance + 0.6 * Math.min(1, moved / 0.08) - 0.35 * clash - 0.006 * rear;
        results.push({ sequence, name: all[sequence].Name, frame, at: round(at), rear, score: round(score), measures: { ...Object.fromEntries(Object.entries(m).map(([key, v]) => [key, round(v)])), clashes: m.clashes - baseline.clashes, moved: round(moved) } });
      }
    }
  }
  results.sort((x, y) => y.score - x.score);
  // One pose per stretch of an animation: neighbouring frames of the same moment are near copies.
  const picked = [];
  for (const r of results) if (!picked.some(p => p.sequence === r.sequence && Math.abs(p.at - r.at) < 0.2)) picked.push(r);
  return picked.slice(0, top);
}

// ---------------------------------------------------------------------------------------------
// Bake

function lowestBandCenter(points, fraction = 0.1) {
  const zs = points.map(p => p[2]), lo = Math.min(...zs), H = Math.max(...zs) - lo || 1;
  const band = points.filter(p => p[2] <= lo + H * fraction);
  return { center: [mean(band.map(p => p[0])), mean(band.map(p => p[1]))], band, lo, H };
}
function forEachVertex(model, fn) { for (const g of model.Geosets || []) for (let v = 0; v < g.Vertices.length / 3; v++) fn(g, v); }
function modelPoints(model) { const out = []; forEachVertex(model, (g, v) => out.push(at3(g.Vertices, v))); return out; }
function moveModel(model, offset, scale = 1) {
  forEachVertex(model, (g, v) => { for (let k = 0; k < 3; k++) g.Vertices[v * 3 + k] = g.Vertices[v * 3 + k] * scale + offset[k]; });
}
const extent = info => ({ MinimumExtent: new Float32Array(info.MinimumExtent), MaximumExtent: new Float32Array(info.MaximumExtent), BoundsRadius: info.BoundsRadius });
function refreshExtents(model, sink = 0) {
  recalculateExtents(model);
  const still = extent(model.Info);
  for (const g of model.Geosets) g.Anims = (model.Sequences || []).map(s => (/death/i.test(s.Name) && sink ? { ...extent(g), MinimumExtent: new Float32Array([g.MinimumExtent[0], g.MinimumExtent[1], g.MinimumExtent[2] - sink]) } : extent(g)));
  for (const s of model.Sequences || []) Object.assign(s, still, /death/i.test(s.Name) && sink ? { MinimumExtent: new Float32Array([still.MinimumExtent[0], still.MinimumExtent[1], still.MinimumExtent[2] - sink]) } : {});
  if (sink) model.Info.MinimumExtent = new Float32Array([still.MinimumExtent[0], still.MinimumExtent[1], still.MinimumExtent[2] - sink]);
}

/** Freeze the mesh in the pose at { sequence, frame | at } (choosePose gives one): kept geosets get
 * their posed positions and normals and bind to one root bone; every other node, the animation
 * tracks, emitters, attachments, events, collision shapes, cameras, geoset animations, effect
 * geosets and team-colour layers go; one Stand remains (death: true adds a Death that sinks the
 * statue into the ground, as the game's destructible statues do). rear (degrees) tips the figure
 * back onto hind legs and tail, turn (degrees) turns it about Z; it keeps facing +X otherwise.
 * The statue is centred over its feet and stands on z = 0; the format stays the document's (adopt the
 * creature into an MDX 800 model, as SD Brain does, so HD fields are cleared). scale or
 * height (units, the statue alone) resizes it. Returns { root, kept, triangles, height, removed }. */
export function bakePose(model, { sequence, frame, at, rear = 0, turn = 0, scale, height, death = false, name = 'Statue', geosets } = {}) {
  const pose = resolvePose(model, { sequence, frame, at });
  const kept = geosets ?? statueGeosets(model, pose), posed = posedMesh(model, { ...pose, rear, turn, geosets: kept });
  const removed = { geosets: model.Geosets.length - kept.length, nodes: allNodes(model).length, sequences: model.Sequences.length };
  for (const { index, positions, normals } of posed.geosets) {
    const g = model.Geosets[index];
    g.Vertices = positions; g.Normals = normals;
    delete g.SkinWeights; delete g.Tangents;
  }
  const keep = new Set(kept);
  model.Geosets = model.Geosets.filter((_, i) => keep.has(i));
  // Materials and textures the kept geosets use; team colour and glow layers go, faded alpha becomes static.
  const usedMaterials = [...new Set(model.Geosets.map(g => g.MaterialID))], interval = model.Sequences[pose.sequence].Interval;
  const textureMap = new Map(), textures = [], white = { Image: 'Textures\\white.blp', ReplaceableId: 0, Flags: 0 };
  const textureId = image => {
    const k = image.ReplaceableId > 0 ? 'white' : String(image.Image).toLowerCase();
    if (!textureMap.has(k)) { textureMap.set(k, textures.length); textures.push(image.ReplaceableId > 0 ? white : structuredClone(image)); }
    return textureMap.get(k);
  };
  model.Materials = usedMaterials.map(id => {
    const m = structuredClone(model.Materials[id]), all = m.Layers || [];
    // A statue shows no team colour or glow: those layers go; a skin blended over them becomes opaque.
    let layers = all.filter(l => !(model.Textures?.[l.TextureID]?.ReplaceableId > 0));
    if (!layers.length) layers = [{ ...(all[0] || {}), FilterMode: 0 }];
    if (layers.length < all.length && layers[0].FilterMode >= 2) layers[0].FilterMode = 0;
    m.Layers = layers.map(l => {
      const layer = { ...l, TVertexAnimId: null };
      if (layer.Alpha?.Keys) layer.Alpha = sampleTrack(layer.Alpha, pose.frame, { interval, globalSequences: model.GlobalSequences, fallback: 1 });
      delete layer._MdxTextureId; delete layer._MdxSlots;
      layer.TextureID = textureId(model.Textures?.[layer.TextureID] || white);
      return layer;
    });
    return m;
  });
  model.Textures = textures;
  for (const g of model.Geosets) g.MaterialID = usedMaterials.indexOf(g.MaterialID);
  model.TextureAnims = []; model.GeosetAnims = []; model.GlobalSequences = [];
  for (const key of ['Bones', 'Helpers', 'Attachments', 'EventObjects', 'CollisionShapes', 'ParticleEmitters', 'ParticleEmitters2', 'ParticleEmitterPopcorns', 'Lights', 'RibbonEmitters', 'Cameras', 'FaceFX', 'BindPoses', 'Gliders']) if (model[key]) model[key] = [];
  model.Nodes = []; model.PivotPoints = [];
  // The editor keeps a document's format; SD Brain models are MDX 800 (adopt a creature into one).
  if (model.Version === 800) normalizeVersionFields(model, 800);
  // Centre over the feet, stand on the ground, resize.
  const points = modelPoints(model), zs = points.map(p => p[2]), statueHeight = Math.max(...zs) - Math.min(...zs) || 1;
  const s = height != null ? Number(height) / statueHeight : Number(scale ?? 1);
  if (!(s > 0) || !Number.isFinite(s)) throw Error('scale and height must be positive numbers.');
  const { center, lo } = lowestBandCenter(points);
  moveModel(model, [-center[0] * s, -center[1] * s, -lo * s], s);
  const root = createNode(model, 'Bone');
  root.Name = String(name).replace(/[^A-Za-z0-9_ -]+/g, '') || 'Statue';
  for (const g of model.Geosets) {
    const count = g.Vertices.length / 3;
    g.Groups = [[root.ObjectId]]; g.TotalGroupsCount = 1; g.VertexGroup = new Uint8Array(count);
    g.Normals = g.Normals instanceof Float32Array ? g.Normals : new Float32Array(g.Normals);
  }
  const template = model.Sequences[pose.sequence];
  const makeSequence = (n, interval, nonLooping) => ({ ...structuredClone(template), Name: n, Interval: new Uint32Array(interval), NonLooping: nonLooping, MoveSpeed: 0, Rarity: 0, SyncPoint: 0, Flags: 0 });
  model.Sequences = [makeSequence('Stand', [0, 3333], false)];
  const finalHeight = statueHeight * s;
  let sink = 0;
  if (death) {
    // Like the game's Ruins Statue: one second, sinking 1.5 times its height with a slight topple.
    sink = Math.round(finalHeight * 1.5);
    model.Sequences.push(makeSequence('Death', [4333, 5333], true));
    root.Translation = { LineType: 1, GlobalSeqId: null, Keys: [{ Frame: 4333, Vector: new Float32Array([0, 0, 0]) }, { Frame: 5333, Vector: new Float32Array([0, 0, -sink]) }] };
    root.Rotation = { LineType: 1, GlobalSeqId: null, Keys: [[4333, [0, 0, 0, 1]], [4633, [-0.07, -0.13, -0.01, 0.99]], [4900, [0.27, 0.11, 0.04, 0.95]], [5333, [0, 0, 0, 1]]].map(([f, q]) => ({ Frame: f, Vector: new Float32Array(norm4(q)) })) };
  }
  for (const [field, key] of Object.entries(MODEL_COUNT_FIELDS)) model.Info[field] = model[key]?.length || 0;
  model.Info.Name = root.Name;
  model.Info.AnimationFile = '';
  refreshExtents(model, sink);
  return { root: root.ObjectId, kept, triangles: model.Geosets.reduce((n, g) => n + g.Faces.length / 3, 0), height: Math.round(finalHeight * 10) / 10, scale: s, removed, pose: { sequence: template.Name, frame: pose.frame } };
}
const norm4 = q => { const l = Math.hypot(...q) || 1; return q.map(v => v / l); };

// ---------------------------------------------------------------------------------------------
// Pedestal

/** A carved pedestal from sd-kit under the statue: its top covers the lowest part of the statue
 * (feet, tail) with a margin, and the statue is lifted to stand on it, sinking sink units into the
 * top so no gap shows. shape: octagon (default), round or square. height defaults to a sixth of the
 * statue. Everything is then centred on the pedestal. Returns { geosets, height, radius, triangles }. */
export function addPedestal(model, { shape = 'octagon', height, radius, margin = 0.12, sink = 1.5 } = {}) {
  const root = (model.Bones || [])[0];
  if (!root) throw Error('Bake the pose first (bakePose): the pedestal binds to the statue\'s root bone.');
  const points = modelPoints(model), { center, band, lo, H } = lowestBandCenter(points, 0.06);
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]), span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const reach = Math.max(...band.map(p => Math.hypot(p[0] - center[0], p[1] - center[1])));
  const R = Number(radius ?? clamp(reach * (1 + margin) + H * 0.03, span * 0.2, span * 0.42));
  const h = Number(height ?? clamp(H / 6, 14, 60));
  if (!(R > 0 && h > 0)) throw Error('radius and height must be positive.');
  const sides = { octagon: 8, round: 14, square: 4 }[shape];
  if (!sides) throw Error('shape must be octagon, round or square.');
  // Plinth, base step, shaft and a top cornice, as carved bases are cut.
  const profile = [[R * 1.16, 0], [R * 1.16, h * 0.16], [R * 1.02, h * 0.22], [R * 0.93, h * 0.3], [R * 0.93, h * 0.72], [R * 1.0, h * 0.8], [R * 1.06, h * 0.86], [R * 1.06, h]];
  const b = builder();
  b.lathe({ profile, segments: sides, material: 'stone', at: [center[0], center[1], 0], rotate: [0, 0, shape === 'square' ? 45 : 180 / sides], smooth: shape === 'round' ? 60 : 30, sharp: 30 });
  moveModel(model, [0, 0, h - sink - lo]);
  const result = b.commit(model, { name: 'Pedestal', size: 128, bone: root.ObjectId });
  moveModel(model, [-center[0], -center[1], 0]);
  if (root.Translation?.Keys?.length) root.Translation.Keys.at(-1).Vector[2] = -Math.round((H + h) * 1.5);
  refreshExtents(model, deathSink(model));
  // The pedestal's own sd-kit paint (assets) serves until paintStatueTexture repaints the whole statue.
  return { geosets: result.geosets, height: h, radius: Math.round(R * 10) / 10, triangles: result.triangles, assets: result.assets };
}

// ---------------------------------------------------------------------------------------------
// Paint

function hash3(x, y, z, seed) { let n = (x * 374761393 + y * 668265263 + z * 1274126177 + seed * 144665) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967295; }
function valueNoise(seed) {
  return (x, y, z) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), u = smooth(0, 1, x - xi), v = smooth(0, 1, y - yi), w = smooth(0, 1, z - zi);
    const h = (a, b, c) => hash3(xi + a, yi + b, zi + c, seed);
    return mix(mix(mix(h(0, 0, 0), h(1, 0, 0), u), mix(h(0, 1, 0), h(1, 1, 0), u), v), mix(mix(h(0, 0, 1), h(1, 0, 1), u), mix(h(0, 1, 1), h(1, 1, 1), u), v), w);
  };
}
const fbm = (noise, p, octaves = 3) => { let s = 0, a = 0.5, f = 1, t = 0; for (let o = 0; o < octaves; o++) { s += a * noise(p[0] * f, p[1] * f, p[2] * f); t += a; a *= 0.5; f *= 2.03; } return s / t; };
/** Distance to the nearest cell wall (F2 - F1) of 3D cellular noise: thin lines where it is small. */
function cellular(seed) {
  return (x, y, z) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    let f1 = 9, f2 = 9;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
      const cx = xi + a + hash3(xi + a, yi + b, zi + c, seed), cy = yi + b + hash3(xi + a, yi + b, zi + c, seed + 1), cz = zi + c + hash3(xi + a, yi + b, zi + c, seed + 2);
      const d = Math.hypot(cx - x, cy - y, cz - z);
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
    }
    return f2 - f1;
  };
}
function ramp(m, t) {
  const c = t < 0.45 ? [m.dark, m.mid, t / 0.45] : t < 0.85 ? [m.mid, m.light, (t - 0.45) / 0.4] : [m.light, m.edge, clamp((t - 0.85) / 0.3)];
  return [0, 1, 2].map(i => mix(c[0][i], c[1][i], c[2]));
}
function palette(spec) {
  const m = typeof spec === 'string' ? STATUE_MATERIALS[spec] : spec;
  if (!m) throw Error(`Unknown statue material ${spec}. Use one of ${Object.keys(STATUE_MATERIALS).join(', ')} or {dark, mid, light, edge, accent}.`);
  const accent = m.accent || STATUE_MATERIALS.stone.accent;
  return { dark: rgb(m.dark), mid: rgb(m.mid), light: rgb(m.light), edge: rgb(m.edge || m.light), accent: { dark: rgb(accent.dark), mid: rgb(accent.mid), light: rgb(accent.light) }, metal: !!m.metal, veins: !!m.veins };
}

// Directional depth maps over the whole statue: a point is lit from d when nothing lies above it.
function depthMaps(tris, dirs, res) {
  return dirs.map(({ d, w }) => {
    const helper = Math.abs(d[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1], u = norm(cross(helper, d)), v = cross(d, u);
    let u0 = Infinity, v0 = Infinity, u1 = -Infinity, v1 = -Infinity;
    for (const t of tris) for (const p of t) { const a = dot(p, u), b = dot(p, v); u0 = Math.min(u0, a); v0 = Math.min(v0, b); u1 = Math.max(u1, a); v1 = Math.max(v1, b); }
    const cell = Math.max(u1 - u0, v1 - v0) / (res - 4) || 1, depth = new Float32Array(res * res).fill(-Infinity);
    const ox = u0 - cell * 2, oy = v0 - cell * 2;
    for (const t of tris) {
      const P = t.map(p => [(dot(p, u) - ox) / cell, (dot(p, v) - oy) / cell, dot(p, d)]);
      const det = (P[1][0] - P[0][0]) * (P[2][1] - P[0][1]) - (P[2][0] - P[0][0]) * (P[1][1] - P[0][1]);
      if (Math.abs(det) < 1e-9) continue;
      const x0 = Math.max(0, Math.floor(Math.min(P[0][0], P[1][0], P[2][0]))), x1 = Math.min(res - 1, Math.ceil(Math.max(P[0][0], P[1][0], P[2][0])));
      const y0 = Math.max(0, Math.floor(Math.min(P[0][1], P[1][1], P[2][1]))), y1 = Math.min(res - 1, Math.ceil(Math.max(P[0][1], P[1][1], P[2][1])));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const qx = x + 0.5, qy = y + 0.5;
        const l1 = ((P[1][0] - qx) * (P[2][1] - qy) - (P[2][0] - qx) * (P[1][1] - qy)) / det, l2 = ((P[2][0] - qx) * (P[0][1] - qy) - (P[0][0] - qx) * (P[2][1] - qy)) / det, l3 = 1 - l1 - l2;
        if (l1 < -0.02 || l2 < -0.02 || l3 < -0.02) continue;
        const z = l1 * P[0][2] + l2 * P[1][2] + l3 * P[2][2], i = y * res + x;
        if (z > depth[i]) depth[i] = z;
      }
    }
    return { d, w, u, v, ox, oy, cell, res, depth };
  });
}
// 0..1: how much of direction map's light reaches point p (3x3 samples, soft edges).
function lit(map, p, bias) {
  const x = (dot(p, map.u) - map.ox) / map.cell - 0.5, y = (dot(p, map.v) - map.oy) / map.cell - 0.5, z = dot(p, map.d) + bias;
  let sum = 0;
  for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
    const xi = Math.round(x) + a, yi = Math.round(y) + b;
    if (xi < 0 || yi < 0 || xi >= map.res || yi >= map.res) { sum++; continue; }
    if (map.depth[yi * map.res + xi] <= z) sum++;
  }
  return sum / 9;
}
function skyDirections(count = 26) {
  const dirs = [];
  for (let i = 0; i < count; i++) {
    const z = 0.12 + 0.88 * ((i + 0.5) / count), r = Math.sqrt(1 - z * z), a = i * 2.39996;
    dirs.push({ d: [r * Math.cos(a), r * Math.sin(a), z], w: z });
  }
  const total = dirs.reduce((s, x) => s + x.w, 0);
  return dirs.map(x => ({ ...x, w: x.w / total }));
}

// UV islands of one geoset: triangles joined by shared edges (same corners in space and in UV, so
// vertices split only for hard shading still join) whose UVs wind the same way (a mirrored half that
// shares the other half's paint becomes its own island). Triangles without UV area get their own
// island laid flat from their 3D shape.
function geosetIslands(g, uv, P) {
  const tris = [];
  for (let f = 0; f < g.Faces.length; f += 3) tris.push([g.Faces[f], g.Faces[f + 1], g.Faces[f + 2]]);
  const parent = tris.map((_, i) => i), find = i => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const area2 = t => (uv[t[1] * 2] - uv[t[0] * 2]) * (uv[t[2] * 2 + 1] - uv[t[0] * 2 + 1]) - (uv[t[2] * 2] - uv[t[0] * 2]) * (uv[t[1] * 2 + 1] - uv[t[0] * 2 + 1]);
  const sign = tris.map(t => { const a = area2(t); return Math.abs(a) < 1e-9 ? 0 : Math.sign(a); });
  const corner = v => `${P[v].map(n => Math.round(n * 100)).join(',')}|${Math.round(uv[v * 2] * 4096)},${Math.round(uv[v * 2 + 1] * 4096)}`;
  const edges = new Map();
  tris.forEach((t, i) => { if (!sign[i]) return; for (let e = 0; e < 3; e++) { const a = corner(t[e]), b = corner(t[(e + 1) % 3]), k = a < b ? a + '/' + b : b + '/' + a; (edges.get(k) || edges.set(k, []).get(k)).push(i); } });
  for (const list of edges.values()) for (let k = 1; k < list.length; k++) if (sign[list[k]] === sign[list[0]]) parent[find(list[k])] = find(list[0]);
  const groups = new Map();
  tris.forEach((t, i) => { const r = sign[i] ? find(i) : -1 - i; (groups.get(r) || groups.set(r, []).get(r)).push(i); });
  return { tris, islands: [...groups.values()], flat: [...groups.keys()].map(k => k < 0) };
}

/** Paint one hand-painted statue texture for the whole model (statue and pedestal) and put it on
 * every geoset: the model's own UV islands are kept in shape but each gets its own place (mirrored
 * or shared paint is split so each side carries its own light), and every texel is painted from
 * the posed surface under it: top light with soft shadows and occlusion from the whole statue,
 * darker undersides and crevices, worn bright ridges, cracks, and moss (patina on bronze) on
 * upward faces in the hollows. Two-sided faces (wing membranes) are doubled so each side is lit
 * on its own. material: stone, darkStone, sandstone, marble, bronze or a palette. size: 256 or 512.
 * cutout (optional): the original skin as { width, height, data } RGBA, so alpha-cut parts (tattered
 * wing edges) keep their holes. detail: texel density per geoset index ({ 3: 0.5 }); addPedestal's
 * pedestal gets 0.55 by itself. Replaces every material and texture; no team colour.
 * Returns { assets, texture, image, size, islands, triangles, coverage }. */
export function paintStatueTexture(model, { material = 'stone', size = 512, name = 'Statue', seed = 7, cutout = null, moss = 0.35, cracks = 0.5, wear = 0.6, grime = 0.5, scales = 0.5, doubleSided = true, detail = null, light = [0.45, -0.35, 0.82] } = {}) {
  const [width, height] = Array.isArray(size) ? size : [size, size];
  if (![width, height].every(n => [128, 256, 512, 1024].includes(n))) throw Error('size must be 256 or 512 (128 and 1024 also work).');
  if (!model.Geosets?.length) throw Error('The model has no geosets to paint.');
  const pal = palette(material), key = norm(light);
  // Which geosets were alpha-cut and two-sided in their old materials.
  const old = model.Geosets.map(g => model.Materials?.[g.MaterialID]?.Layers || []);
  const alphaCut = old.map(ls => !!cutout && ls.some(l => l.FilterMode === 1));
  const twoSided = old.map(ls => ls.some(l => (l.Shading & 16) !== 0));
  // Texel density per geoset: the plain pedestal (addPedestal's paint) gets less than the figure.
  const weight = model.Geosets.map((g, gi) => Number(detail?.[gi] ?? (old[gi].some(l => /SD_Pedestal/i.test(model.Textures?.[l.TextureID]?.Image || '')) ? 0.55 : 1)));
  // Rebuild every geoset from its islands: one new vertex per island corner.
  const pieces = [];
  model.Geosets.forEach((g, gi) => {
    let faces = Array.from(g.Faces), count = g.Vertices.length / 3;
    const P = Array.from({ length: count }, (_, v) => at3(g.Vertices, v)), N = Array.from({ length: count }, (_, v) => norm(at3(g.Normals, v)));
    const UV = Array.from(g.TVertices?.[0] || new Float32Array(count * 2)), VG = Array.from(g.VertexGroup || new Uint8Array(count));
    if (doubleSided && twoSided[gi]) {
      for (let v = 0; v < count; v++) { P.push(P[v]); N.push(mul(N[v], -1)); UV.push(UV[v * 2], UV[v * 2 + 1]); VG.push(VG[v]); }
      for (let f = 0, n = faces.length; f < n; f += 3) faces.push(faces[f] + count, faces[f + 2] + count, faces[f + 1] + count);
      count *= 2;
    }
    const { tris, islands, flat } = geosetIslands({ Faces: faces }, UV, P);
    islands.forEach((list, k) => {
      const corners = [...new Set(list.flatMap(t => tris[t]))], local = new Map(corners.map((v, i) => [v, i]));
      let coords;
      if (flat[k]) {
        const t = tris[list[0]], e1 = sub(P[t[1]], P[t[0]]), n = norm(cross(e1, sub(P[t[2]], P[t[0]]))), ax = norm(e1), ay = cross(n, ax);
        coords = corners.map(v => [dot(sub(P[v], P[t[0]]), ax), dot(sub(P[v], P[t[0]]), ay)]);
      } else {
        let a3 = 0, a2 = 0;
        for (const t of list) { const [a, b, c] = tris[t]; a3 += len(cross(sub(P[b], P[a]), sub(P[c], P[a]))); a2 += Math.abs((UV[b * 2] - UV[a * 2]) * (UV[c * 2 + 1] - UV[a * 2 + 1]) - (UV[c * 2] - UV[a * 2]) * (UV[b * 2 + 1] - UV[a * 2 + 1])); }
        const s = Math.sqrt(a3 / (a2 || 1e-9));
        coords = corners.map(v => [UV[v * 2] * s, UV[v * 2 + 1] * s]);
      }
      // Turn the island to its smallest bounding box, so long diagonal islands pack tightly.
      let best = { area: Infinity, angle: 0 };
      for (let deg = 0; deg < 180; deg += 5) {
        const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a), xr = coords.map(p => p[0] * c - p[1] * s), yr = coords.map(p => p[0] * s + p[1] * c);
        const area = (Math.max(...xr) - Math.min(...xr)) * (Math.max(...yr) - Math.min(...yr));
        if (area < best.area - 1e-9) best = { area, angle: a };
      }
      if (best.angle) { const c = Math.cos(best.angle), s = Math.sin(best.angle); coords = coords.map(p => [p[0] * c - p[1] * s, p[0] * s + p[1] * c]); }
      const xs = coords.map(c => c[0]), ys = coords.map(c => c[1]);
      pieces.push({ gi, corners, local, coords, tris: list.map(t => tris[t].map(v => local.get(v))), x0: Math.min(...xs), y0: Math.min(...ys), w: Math.max(Math.max(...xs) - Math.min(...xs), 0.5), h: Math.max(Math.max(...ys) - Math.min(...ys), 0.5), P, N, UV, VG });
    });
  });
  // Shelf-pack the islands at one texel density, as large as fits.
  const pad = width >= 512 ? 4 : 3;
  for (const p of pieces) p.rot = p.h > p.w * 1.25;
  const tryPack = scale => {
    let x = pad, y = pad, row = 0;
    const placed = [];
    for (const p of [...pieces].sort((a, b) => (b.rot ? b.w : b.h) * weight[b.gi] - (a.rot ? a.w : a.h) * weight[a.gi])) {
      const k = scale * weight[p.gi], w = Math.max(2, Math.ceil((p.rot ? p.h : p.w) * k)) + pad, h = Math.max(2, Math.ceil((p.rot ? p.w : p.h) * k)) + pad;
      if (w > width - pad) return null;
      if (x + w > width) { x = pad; y += row; row = 0; }
      if (y + h > height) return null;
      placed.push({ p, px: x, py: y }); x += w; row = Math.max(row, h);
    }
    return placed;
  };
  let lo = 0.001, hi = 1000, best = null, density = 0;
  for (let k = 0; k < 44; k++) { const s = Math.sqrt(lo * hi), r = tryPack(s); if (r) { best = r; density = s; lo = s; } else hi = s; }
  if (!best) throw Error('The islands could not be packed; use a larger size.');
  for (const { p, px, py } of best) { const k = density * weight[p.gi]; p.pix = p.coords.map(([x, y]) => { const a = (x - p.x0) * k, b = (y - p.y0) * k; return p.rot ? [px + b, py + a] : [px + a, py + b]; }); }
  // The whole statue in world space for light, shadow and occlusion.
  const world = pieces.flatMap(p => p.tris.map(t => t.map(c => p.P[p.corners[c]])));
  const all = world.flat(), zmin = Math.min(...all.map(p => p[2])), zmax = Math.max(...all.map(p => p[2])), Hs = zmax - zmin || 1;
  const sizeAll = Math.max(Hs, ...[0, 1].map(k => Math.max(...all.map(p => p[k])) - Math.min(...all.map(p => p[k]))));
  const sky = depthMaps(world, skyDirections(), 192), sun = depthMaps(world, [{ d: key, w: 1 }], 512)[0];
  const bias = sizeAll / 120;
  // Curvature at every welded position: positive on ridges, negative in hollows.
  const wkey = p => p.map(v => Math.round(v * 20)).join(',');
  const curv = new Map(), fnorm = new Map(), nbr = new Map();
  for (const t of world) {
    const n = cross(sub(t[1], t[0]), sub(t[2], t[0]));
    for (let e = 0; e < 3; e++) {
      const k = wkey(t[e]); fnorm.set(k, add(fnorm.get(k) || [0, 0, 0], n));
      const list = nbr.get(k) || nbr.set(k, []).get(k); list.push(t[(e + 1) % 3], t[(e + 2) % 3]);
    }
  }
  for (const [k, list] of nbr) {
    const n = norm(fnorm.get(k)), p = k.split(',').map(v => Number(v) / 20);
    let s = 0, l = 0;
    for (const q of list) { const d = sub(p, q), dl = len(d); if (dl > 1e-6) { s += dot(n, d) / dl; l++; } }
    curv.set(k, l ? s / l : 0);
  }
  // Sharp convex edges (worn bright) and concave ones (dark seams), by welded edge.
  const edgeFaces = new Map();
  world.forEach((t, ti) => { for (let e = 0; e < 3; e++) { const a = wkey(t[e]), b = wkey(t[(e + 1) % 3]), k = a < b ? a + '|' + b : b + '|' + a; (edgeFaces.get(k) || edgeFaces.set(k, []).get(k)).push({ ti, c: t[(e + 2) % 3] }); } });
  const edgeKind = new Map();
  for (const [k, list] of edgeFaces) {
    if (list.length !== 2) continue;
    const fn = ti => norm(cross(sub(world[ti][1], world[ti][0]), sub(world[ti][2], world[ti][0])));
    const n1 = fn(list[0].ti), n2 = fn(list[1].ti), angle = (Math.acos(clamp(dot(n1, n2), -1, 1)) * 180) / Math.PI;
    if (angle < 28) continue;
    const convex = dot(sub(list[1].c, list[0].c), n1) < 0;
    edgeKind.set(k, (convex ? 1 : -1) * smooth(28, 75, angle));
  }
  const noise = valueNoise(seed), noise2 = valueNoise(seed + 31), cells = cellular(seed + 101), cells2 = cellular(seed + 202);
  const unit = sizeAll / 100; // the statue is 100 of these across
  const color = new Uint8Array(width * height * 4), owner = new Int32Array(width * height).fill(-1);
  let ti = -1;
  for (const piece of pieces) {
    const cutImage = alphaCut[piece.gi] ? cutout : null, plain = weight[piece.gi] < 1 ? 0.5 : 1, scaly = plain === 1 && !twoSided[piece.gi] ? scales : 0;
    for (const t of piece.tris) {
      ti++;
      const A = piece.pix[t[0]], B = piece.pix[t[1]], C = piece.pix[t[2]], det = (B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1]);
      if (Math.abs(det) < 1e-9) continue;
      const Pw = t.map(c => piece.P[piece.corners[c]]), Nw = t.map(c => piece.N[piece.corners[c]]), Kw = Pw.map(p => curv.get(wkey(p)) || 0);
      const uvOld = t.map(c => [piece.UV[piece.corners[c] * 2], piece.UV[piece.corners[c] * 2 + 1]]);
      const faceN = norm(cross(sub(Pw[1], Pw[0]), sub(Pw[2], Pw[0])));
      const edges = [0, 1, 2].map(e => { const a = wkey(Pw[e]), b = wkey(Pw[(e + 1) % 3]); return { kind: edgeKind.get(a < b ? a + '|' + b : b + '|' + a) || 0, a: [A, B, C][e], b: [A, B, C][(e + 1) % 3] }; }).filter(e => e.kind);
      const x0 = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0])) - 1), x1 = Math.min(width - 1, Math.ceil(Math.max(A[0], B[0], C[0])) + 1);
      const y0 = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1])) - 1), y1 = Math.min(height - 1, Math.ceil(Math.max(A[1], B[1], C[1])) + 1);
      const tol = -0.8 / Math.max(1, Math.sqrt(Math.abs(det)));
      for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) {
        const q = [px + 0.5, py + 0.5];
        let l1 = ((B[0] - q[0]) * (C[1] - q[1]) - (C[0] - q[0]) * (B[1] - q[1])) / det, l2 = ((C[0] - q[0]) * (A[1] - q[1]) - (A[0] - q[0]) * (C[1] - q[1])) / det, l3 = 1 - l1 - l2;
        if (l1 < tol || l2 < tol || l3 < tol) continue;
        const i = py * width + px;
        if (owner[i] >= 0 && Math.min(l1, l2, l3) < 0) continue;
        [l1, l2, l3] = [l1, l2, l3].map(v => Math.max(0, v)); const sum = l1 + l2 + l3; l1 /= sum; l2 /= sum; l3 /= sum;
        const P = [0, 1, 2].map(k => Pw[0][k] * l1 + Pw[1][k] * l2 + Pw[2][k] * l3);
        let N = norm([0, 1, 2].map(k => Nw[0][k] * l1 + Nw[1][k] * l2 + Nw[2][k] * l3));
        if (dot(N, faceN) < -0.2) N = faceN;
        const k = Kw[0] * l1 + Kw[1] * l2 + Kw[2] * l3, h01 = (P[2] - zmin) / Hs, s = mul(P, 1 / unit);
        // Light: sun with soft shadow, sky occlusion, bounce from below, darker toward the ground.
        const off = add(P, mul(N, bias * 0.6));
        const ndl = Math.max(0, dot(N, key)), sunLit = ndl > 0 ? lit(sun, off, bias) : 0;
        let skyLit = 0;
        for (const m of sky) if (dot(N, m.d) > 0) skyLit += m.w * lit(m, off, bias) * (0.35 + 0.65 * dot(N, m.d));
        skyLit = clamp(skyLit * 1.7);
        let shade = 0.1 + 0.52 * ndl * sunLit + 0.42 * skyLit * (0.55 + 0.45 * (N[2] * 0.5 + 0.5)) + 0.05 * clamp(-N[2]);
        shade *= 0.8 + 0.2 * smooth(0, 0.35, h01);
        // Painted stone: broad blotches and a little stroke texture, never per-pixel grain.
        const blot = fbm(noise, mul(s, 0.09)), stroke = noise2(s[0] * 0.45, s[1] * 0.45, s[2] * 1.2);
        shade += 0.2 * (blot - 0.5) + 0.07 * (stroke - 0.5);
        const ridge = smooth(0.06, 0.32, k), hollow = smooth(0.04, 0.3, -k);
        shade += wear * 0.22 * ridge * (0.6 + 0.4 * noise(s[0] * 0.8, s[1] * 0.8, s[2] * 0.8)) - grime * 0.22 * hollow;
        // Carved scales on the figure (not on wing membranes or the pedestal): grooves with a lit lip.
        if (scaly > 0) { const g = cells2(s[0] * 0.3, s[1] * 0.3, s[2] * 0.3); shade += g < 0.14 ? -scaly * 0.22 * (1 - g / 0.14) : g < 0.26 ? scaly * 0.07 * ndl : 0; }
        let c = ramp(pal, clamp(shade * 0.9, 0, 1.1));
        // Cool shadows, warm light, as SD painters do.
        const cool = clamp(0.55 - shade) * 0.35;
        c = [c[0] * (1 - cool * 0.35), c[1] * (1 - cool * 0.15), c[2] * (1 + cool * 0.25)];
        if (pal.veins) {
          const vein = Math.abs(Math.sin((s[0] + s[2] * 0.6) * 0.35 + 6 * fbm(noise2, mul(s, 0.05))));
          if (vein < 0.05) c = c.map((v, j) => mix(v, pal.dark[j] * 1.4, 0.35 * (1 - vein / 0.05)));
        }
        // Moss (patina on bronze) in patches: on upward faces low down, in hollows and sheltered nooks.
        const patchy = smooth(0.5, 0.66, fbm(noise2, mul(s, 0.12)));
        const accentAmount = moss * patchy * (smooth(0.35, 0.85, N[2]) * (0.3 + 0.7 * (1 - smooth(0.1, 0.6, h01))) * 0.8 + hollow * 0.6 + (1 - skyLit) * 0.25);
        const patina = pal.metal ? moss * (hollow * 1.1 + (1 - skyLit) * 0.4) + accentAmount * 0.5 : accentAmount;
        if (patina > 0.02) { const a = ramp({ dark: pal.accent.dark, mid: pal.accent.mid, light: pal.accent.light, edge: pal.accent.light }, clamp(shade * 0.95 + 0.05)); c = c.map((v, j) => mix(v, a[j], clamp(patina * 1.4))); }
        // Rain streaks of grime running down from hollows, and dirt near the ground.
        const streak = noise(s[0] * 0.9, s[1] * 0.9, s[2] * 0.06), dirt = grime * (0.35 * plain * smooth(0.55, 0.85, streak) * (1 - Math.abs(N[2])) + 0.3 * (1 - smooth(0.0, 0.12, h01)));
        c = c.map((v, j) => mix(v, pal.dark[j] * 0.8, clamp(dirt) * 0.5));
        // Cracks: a few separate dark lines (pieces of cellular-noise walls) in patches, each with a
        // light lip on the lit side, so they read as cut into the stone.
        if (cracks > 0) {
          const patch = fbm(noise, add(mul(s, 0.04), [3.1, 7.7, 1.3])), gate = plain * smooth(0.64 - cracks * 0.14, 0.72 - cracks * 0.14, patch);
          const keep = smooth(0.48, 0.56, noise2(s[0] * 0.16 + 11.3, s[1] * 0.16 + 2.9, s[2] * 0.16 + 5.1));
          if (gate * keep > 0.01) {
            const f = cells(s[0] * 0.085, s[1] * 0.085, s[2] * 0.085), w = 0.035 + 0.035 * gate;
            if (f < w) c = c.map((v, j) => mix(v, pal.dark[j] * 0.4, gate * keep * (1 - f / w) * 0.95));
            else if (f < w * 2.2) c = c.map((v, j) => mix(v, pal.edge[j], gate * keep * 0.3 * (0.3 + ndl)));
          }
        }
        // Worn bright edges on ridges, dark seams in creases.
        for (const e of edges) {
          const ex = e.b[0] - e.a[0], ey = e.b[1] - e.a[1], l = ex * ex + ey * ey || 1, tt = clamp(((q[0] - e.a[0]) * ex + (q[1] - e.a[1]) * ey) / l), d = Math.hypot(q[0] - e.a[0] - tt * ex, q[1] - e.a[1] - tt * ey);
          const near = 1 - smooth(0.4, 1.8, d);
          if (near <= 0) continue;
          if (e.kind > 0) c = c.map((v, j) => mix(v, pal.edge[j], near * e.kind * wear * 0.6 * (0.5 + 0.5 * clamp(N[2] + 0.6)) * (0.55 + 0.45 * noise2(s[0], s[1], s[2]))));
          else c = c.map((v, j) => mix(v, pal.dark[j] * 0.6, near * -e.kind * grime * 0.8));
        }
        let alpha = 255;
        if (cutImage) {
          const u = uvOld[0][0] * l1 + uvOld[1][0] * l2 + uvOld[2][0] * l3, v = uvOld[0][1] * l1 + uvOld[1][1] * l2 + uvOld[2][1] * l3;
          const sx = clamp(Math.floor(u * cutImage.width), 0, cutImage.width - 1), sy = clamp(Math.floor(v * cutImage.height), 0, cutImage.height - 1);
          alpha = cutImage.data[(sy * cutImage.width + sx) * 4 + 3] >= 128 ? 255 : 0;
        }
        color.set([clamp(Math.round(c[0]), 0, 255), clamp(Math.round(c[1]), 0, 255), clamp(Math.round(c[2]), 0, 255), alpha], i * 4);
        owner[i] = ti;
      }
    }
  }
  const coverage = owner.reduce((n, o) => n + (o >= 0 ? 1 : 0), 0) / owner.length;
  dilate(color, owner, width, height, pad + 4);
  // New geosets on the packed UVs, one stone material (an alpha-cut copy where holes were kept).
  const geosets = model.Geosets.map((g, gi) => {
    const mine = pieces.filter(p => p.gi === gi), V = [], Nn = [], U = [], VG = [], F = [];
    for (const p of mine) {
      const base = V.length / 3;
      p.corners.forEach((v, c) => { V.push(...p.P[v]); Nn.push(...p.N[v]); U.push(p.pix[c][0] / width, p.pix[c][1] / height); VG.push(p.VG[v] ?? 0); });
      for (const t of p.tris) F.push(base + t[0], base + t[1], base + t[2]);
    }
    if (V.length / 3 > 65535) throw Error('Too many vertices for one Warcraft geoset.');
    return { ...g, Vertices: new Float32Array(V), Normals: new Float32Array(Nn), TVertices: [new Float32Array(U)], VertexGroup: new Uint8Array(VG), Faces: new Uint16Array(F), MaterialID: alphaCut[gi] ? 1 : 0 };
  });
  const safe = String(name).replace(/[^A-Za-z0-9_-]+/g, '') || 'Statue', texture = `MDLxL_Forge\\SD_${safe}.tga`;
  const layer = filter => ({ FilterMode: filter, Shading: 0, TextureID: 0, TVertexAnimId: null, CoordId: 0, Alpha: 1 });
  model.Textures = [{ Image: texture, ReplaceableId: 0, Flags: 0 }];
  model.Materials = [{ PriorityPlane: 0, RenderMode: 0, Layers: [layer(0)] }, ...(alphaCut.some(Boolean) ? [{ PriorityPlane: 0, RenderMode: 0, Layers: [layer(1)] }] : [])];
  model.TextureAnims = [];
  model.Geosets = geosets;
  refreshExtents(model, deathSink(model));
  const image = { width, height, data: color };
  return { assets: [{ name: texture, bytes: encodeForgeTga(image), source: 'forge' }], texture, image, size: [width, height], islands: pieces.length, triangles: geosets.reduce((n, g) => n + g.Faces.length / 3, 0), coverage: Math.round(coverage * 1000) / 1000, texelsPerUnit: Math.round(density * 100) / 100 };
}
const deathSink = model => { const keys = (model.Bones || [])[0]?.Translation?.Keys; return keys?.length ? -keys.at(-1).Vector[2] : 0; };

function dilate(data, owner, width, height, passes) {
  const filled = Uint8Array.from(owner, o => (o >= 0 ? 1 : 0));
  for (let p = 0; p < passes; p++) {
    const next = filled.slice();
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (filled[i]) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const j = ny * width + nx;
        if (!filled[j]) continue;
        data.copyWithin(i * 4, j * 4, j * 4 + 4); next[i] = 1; break;
      }
    }
    filled.set(next);
  }
  for (let i = 0; i < owner.length; i++) if (!filled[i]) data.set([0, 0, 0, 255], i * 4);
}

// ---------------------------------------------------------------------------------------------
// Checks

/** The statue's numbers beside the game's own statues: triangles, bones, sequences, textures,
 * size in units and in Footmen, format and an estimate of the MDX size. */
export function statueReport(model) {
  const points = modelPoints(model), size = [0, 1, 2].map(k => Math.round(Math.max(...points.map(p => p[k])) - Math.min(...points.map(p => p[k]))));
  const triangles = (model.Geosets || []).reduce((n, g) => n + g.Faces.length / 3, 0), vertices = points.length;
  const kb = Math.round((vertices * 33 + triangles * 6 + (model.Geosets || []).length * 220 + (model.Sequences || []).length * 132 + 1800) / 102.4) / 10;
  const checks = {
    triangles: triangles >= NATIVE_STATUES.triangles[0] * 0.6 && triangles <= NATIVE_STATUES.triangles[1] * 1.3,
    oneBone: (model.Bones || []).length <= 2 && !(model.Helpers || []).length,
    oneTexture: (model.Textures || []).length === 1 && !(model.Textures || []).some(t => t.ReplaceableId),
    standOnly: (model.Sequences || []).some(s => s.Name === 'Stand') && (model.Sequences || []).every(s => /^(stand|death)$/i.test(s.Name)),
    noEffects: !['Attachments', 'ParticleEmitters', 'ParticleEmitters2', 'RibbonEmitters', 'EventObjects', 'CollisionShapes', 'Lights'].some(k => model[k]?.length),
    sd: model.Version === 800,
    onGround: Math.abs(Math.min(...points.map(p => p[2]))) < 0.5,
  };
  return { triangles, vertices, geosets: (model.Geosets || []).length, bones: (model.Bones || []).length, sequences: (model.Sequences || []).map(s => s.Name), textures: (model.Textures || []).map(t => t.Image), size, footmen: Math.round((size[2] / NATIVE_STATUES.footman) * 100) / 100, version: model.Version, estimatedKB: kb, native: NATIVE_STATUES, checks, passed: Object.values(checks).every(Boolean) };
}
