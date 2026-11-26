// XFER look check: measures the drawn skin of a transplant result clip by clip against
//  - the donor (same clip): whole-unit bob and shake, part twitch, height and floor over time, and
//  - the original unit (same mesh, same vertex order, its own clips): skin that moved there but stays still,
//    skin that tears or squashes beyond anything the unit does, held pieces (weapon, shield, pads) that come off.
// No bone names and no case ids: only what the viewer sees (skinned, visible, non-additive geosets).
// measurePair returns raw numbers; verdict.mjs turns them into reasons with the tuned limits.
import { sampleNodeMatrices, skinGeoset, sampleGeosetAnimation } from './animation.js';
import { geosetMaterialLayers, hasOnlyAdditiveLayers } from './geoset-extras.js';


export const LIMITS = { tearLen: 2.0, crushLen: 0.4, edgeFloor: 0.012, contactRest: 0.03, pieceMin: 12, cellMin: 0.04 };

const SKIP = /death|decay|dissipate|portrait|birth/i;
function prepare(model) {
  const geos = model.Geosets || [];
  const solid = geos.map(g => !hasOnlyAdditiveLayers(geosetMaterialLayers(model, g)) && g.Vertices?.length >= 9 && g.Faces?.length >= 3);
  const seqs = model.Sequences || [];
  const stand = Math.max(0, seqs.findIndex(s => /^stand/i.test(s.Name.trim())));
  const shown = gi => solid[gi] && (!seqs.length || sampleGeosetAnimation(model, gi, seqs[stand].Interval[0], stand).alpha > 0.001);
  let body = geos.map((_, gi) => shown(gi)); if (!body.some(Boolean)) body = solid.slice();
  // bind-pose box of the shown skin
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  geos.forEach((g, gi) => { if (!body[gi]) return; const V = g.Vertices; for (let i = 0; i < V.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], V[i + k]); hi[k] = Math.max(hi[k], V[i + k]); } });
  const H = Math.max(hi[2] - lo[2], 1e-3), span = [hi[0] - lo[0] || 1, hi[1] - lo[1] || 1, H];
  // edges with modelled length, pieces (connected by faces), grid cell per vertex (3 back..front x 3 low..high)
  const parts = geos.map((g, gi) => {
    if (!solid[gi]) return null;
    const n = g.Vertices.length / 3, V = g.Vertices, F = g.Faces;
    const seen = new Set(), edges = [];
    const up = new Int32Array(n).map((_, i) => i), find = i => { while (up[i] !== i) i = up[i] = up[up[i]]; return i; };
    for (let f = 0; f + 2 < F.length; f += 3) for (const [a, b] of [[F[f], F[f + 1]], [F[f + 1], F[f + 2]], [F[f + 2], F[f]]]) {
      if (a >= n || b >= n) continue;
      up[find(a)] = find(b);
      const k = a < b ? a * n + b : b * n + a; if (seen.has(k)) continue; seen.add(k);
      const L = Math.hypot(V[3 * a] - V[3 * b], V[3 * a + 1] - V[3 * b + 1], V[3 * a + 2] - V[3 * b + 2]);
      if (L > LIMITS.edgeFloor * H) edges.push(a, b, L);
    }
    // weld: vertices on the same spot belong to the same piece (many models store loose triangles)
    const q = 0.002 * H, spot = new Map();
    for (let i = 0; i < n; i++) { const k = Math.round(V[3 * i] / q) + ',' + Math.round(V[3 * i + 1] / q) + ',' + Math.round(V[3 * i + 2] / q); if (spot.has(k)) up[find(i)] = find(spot.get(k)); else spot.set(k, i); }
    const piece = new Int32Array(n); for (let i = 0; i < n; i++) piece[i] = find(i);
    const cell = new Uint8Array(n);
    for (let i = 0; i < n; i++) { const x = Math.min(2, Math.floor(3 * (V[3 * i] - lo[0]) / span[0])), z = Math.min(2, Math.floor(3 * (V[3 * i + 2] - lo[2]) / H)); cell[i] = Math.max(0, x) * 3 + Math.max(0, z); }
    return { n, edges: Float64Array.from(edges), piece, cell };
  });
  return { model, solid, H, lo, parts, contacts: contactPairs(geos, parts, solid, H) };
}

// Pairs of distinct pieces that touch in the modelled mesh. Each pair keeps up to 24 touching vertices per side.
function contactPairs(geos, parts, solid, H) {
  const pieces = new Map();
  geos.forEach((g, gi) => { if (!parts[gi]) return; const p = parts[gi]; for (let i = 0; i < p.n; i++) { const k = gi + ':' + p.piece[i]; if (!pieces.has(k)) pieces.set(k, []); pieces.get(k).push(gi, i); } });
  const big = [...pieces].filter(([, v]) => v.length / 2 >= LIMITS.pieceMin);
  if (big.length < 2 || big.length > 600) return [];
  const r = LIMITS.contactRest * H, cellOf = (x) => Math.floor(x / r), grid = new Map(), id = new Map(big.map(([k], i) => [k, i]));
  for (const [k, v] of big) for (let j = 0; j < v.length; j += 2) { const V = geos[v[j]].Vertices, i = v[j + 1]; const key = cellOf(V[3 * i]) + ',' + cellOf(V[3 * i + 1]) + ',' + cellOf(V[3 * i + 2]); if (!grid.has(key)) grid.set(key, []); grid.get(key).push(id.get(k), v[j], i); }
  const touch = new Map();
  for (const [k, v] of big) { const a = id.get(k); for (let j = 0; j < v.length; j += 2) { const gi = v[j], i = v[j + 1], V = geos[gi].Vertices; const cx = cellOf(V[3 * i]), cy = cellOf(V[3 * i + 1]), cz = cellOf(V[3 * i + 2]);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) { const list = grid.get((cx + dx) + ',' + (cy + dy) + ',' + (cz + dz)); if (!list) continue;
      for (let q = 0; q < list.length; q += 3) { const b = list[q]; if (b <= a) continue; const W = geos[list[q + 1]].Vertices, w = list[q + 2];
        if (Math.hypot(V[3 * i] - W[3 * w], V[3 * i + 1] - W[3 * w + 1], V[3 * i + 2] - W[3 * w + 2]) > r) continue;
        const key = a + '|' + b; if (!touch.has(key)) touch.set(key, { a: new Map(), b: new Map() }); const t = touch.get(key);
        if (t.a.size < 24) t.a.set(gi + ':' + i, [gi, i]); if (t.b.size < 24) t.b.set(list[q + 1] + ':' + w, [list[q + 1], w]); } } } }
  return [...touch].filter(([, t]) => t.a.size >= 2 && t.b.size >= 2).map(([key, t]) => ({ key, a: [...t.a.values()], b: [...t.b.values()] }));
}

const baseName = s => s.trim().toLowerCase().replace(/\s*\([^)]*\)\s*$/, '');

// Samples one clip at n evenly spaced moments; returns per-sample skinned positions for geosets shown all clip long.
function sampleClip(P, si, n) {
  const { model } = P, s = model.Sequences[si], [a, b] = s.Interval, len = Math.max(b - a, 1);
  const frames = Array.from({ length: n }, (_, k) => a + Math.round(len * k / (n - 1)));
  const vis = P.solid.map((ok, gi) => ok && frames.filter(f => sampleGeosetAnimation(model, gi, f, si).alpha > 0.001).length >= 0.9 * n);
  const pos = frames.map(f => { const M = sampleNodeMatrices(model, f, si); return model.Geosets.map((g, gi) => vis[gi] ? skinGeoset(g, M) : null); });
  return { frames, vis, pos, len, dt: len / (n - 1) / 1000 };
}

function stats(P, S, perVertex = false) {
  const { H } = P, n = S.frames.length, gis = S.vis.flatMap((v, gi) => v ? [gi] : []);
  const res = { H, amp: {}, peak: {}, eMax: {}, eMin: {}, centre: [], height: [], low: [], tear: 0, tearAt: 0, crush: 0, crushAt: 0, twitch: 0, twitchAt: 0, cells: new Float64Array(9), cellN: new Float64Array(9), apart: 0, apartAt: 0 };
  if (!gis.length) return null;
  let total = 0;
  for (let t = 0; t < n; t++) {
    let sx = 0, sy = 0, sz = 0, c = 0, zl = Infinity, zh = -Infinity, over = 0, under = 0, edges = 0; const zs = [];
    for (const gi of gis) { const X = S.pos[t][gi], p = P.parts[gi]; for (let i = 0; i < p.n; i++) { sx += X[3 * i]; sy += X[3 * i + 1]; sz += X[3 * i + 2]; c++; zs.push(X[3 * i + 2]); }
      const E = p.edges; if (perVertex && !res.eMax[gi]) { res.eMax[gi] = new Float32Array(E.length / 3); res.eMin[gi] = new Float32Array(E.length / 3).fill(Infinity); } const eMx = res.eMax[gi], eMn = res.eMin[gi];
      for (let e = 0; e < E.length; e += 3) { const u = E[e], v = E[e + 1]; const L = Math.hypot(X[3 * u] - X[3 * v], X[3 * u + 1] - X[3 * v + 1], X[3 * u + 2] - X[3 * v + 2]) / E[e + 2]; edges++; if (eMx) { if (L > eMx[e / 3]) eMx[e / 3] = L; if (L < eMn[e / 3]) eMn[e / 3] = L; } if (L > LIMITS.tearLen) over++; else if (L < LIMITS.crushLen) under++; } }
    zs.sort((p, q) => p - q); zl = zs[Math.floor(0.02 * (zs.length - 1))]; zh = zs[Math.floor(0.98 * (zs.length - 1))];
    res.centre.push([sx / c / H, sy / c / H, sz / c / H]); res.height.push(+((zh - zl) / H).toFixed(4)); res.low.push(+(zl / H).toFixed(4)); total = c;
    if (edges) { if (over / edges > res.tear) { res.tear = over / edges; res.tearAt = t; } if (under / edges > res.crush) { res.crush = under / edges; res.crushAt = t; } }
  }
  // per-vertex: motion relative to the body centre (for cells) and peak acceleration (twitch)
  const peaks = [];
  for (const gi of gis) { const p = P.parts[gi]; if (perVertex) { res.amp[gi] = new Float32Array(p.n); res.peak[gi] = new Float32Array(p.n); }
    for (let i = 0; i < p.n; i++) {
      let mx = 0, my = 0, mz = 0; for (let t = 0; t < n; t++) { const X = S.pos[t][gi], C = res.centre[t]; mx += X[3 * i] / H - C[0]; my += X[3 * i + 1] / H - C[1]; mz += X[3 * i + 2] / H - C[2]; }
      mx /= n; my /= n; mz /= n; let v = 0;
      for (let t = 0; t < n; t++) { const X = S.pos[t][gi], C = res.centre[t]; v += (X[3 * i] / H - C[0] - mx) ** 2 + (X[3 * i + 1] / H - C[1] - my) ** 2 + (X[3 * i + 2] / H - C[2] - mz) ** 2; }
      res.cells[p.cell[i]] += Math.sqrt(v / n); res.cellN[p.cell[i]]++; if (perVertex) res.amp[gi][i] = Math.sqrt(v / n);
      let pk = 0, pkAt = 0; for (let t = 1; t + 1 < n; t++) { const A = S.pos[t - 1][gi], B = S.pos[t][gi], Cc = S.pos[t + 1][gi]; const acc = Math.hypot(A[3 * i] - 2 * B[3 * i] + Cc[3 * i], A[3 * i + 1] - 2 * B[3 * i + 1] + Cc[3 * i + 1], A[3 * i + 2] - 2 * B[3 * i + 2] + Cc[3 * i + 2]) / H / (S.dt * S.dt); if (acc > pk) { pk = acc; pkAt = t; } }
      peaks.push([pk, pkAt]); if (perVertex) res.peak[gi][i] = pk;
    } }
  peaks.sort((x, y) => x[0] - y[0]); const p95 = peaks[Math.floor(0.95 * (peaks.length - 1))]; res.twitch = p95[0]; res.twitchAt = p95[1];
  for (let k = 0; k < 9; k++) res.cells[k] = res.cellN[k] / total >= LIMITS.cellMin ? res.cells[k] / res.cellN[k] : NaN;
  // centre: vertical range and acceleration RMS
  const z = res.centre.map(c => c[2]); res.bob = Math.max(...z) - Math.min(...z);
  let acc = 0; for (let t = 1; t + 1 < n; t++) { const A = res.centre[t - 1], B = res.centre[t], C = res.centre[t + 1]; acc += ((A[0] - 2 * B[0] + C[0]) ** 2 + (A[1] - 2 * B[1] + C[1]) ** 2 + (A[2] - 2 * B[2] + C[2]) ** 2); }
  res.shake = Math.sqrt(acc / Math.max(1, n - 2)) / (S.dt * S.dt);
  res.S = perVertex ? S : null;
  // pieces that touch in the modelled mesh: largest extra gap
  for (const pair of P.contacts) {
    if (!pair.a.every(([gi]) => S.vis[gi]) || !pair.b.every(([gi]) => S.vis[gi])) continue;
    const gap = t => { let d = Infinity; for (const [ga, ia] of pair.a) { const X = S.pos[t][ga]; for (const [gb, ib] of pair.b) { const Y = S.pos[t][gb]; const q = (X[3 * ia] - Y[3 * ib]) ** 2 + (X[3 * ia + 1] - Y[3 * ib + 1]) ** 2 + (X[3 * ia + 2] - Y[3 * ib + 2]) ** 2; if (q < d) d = q; } } return Math.sqrt(d) / H; };
    for (let t = 0; t < n; t += 2) { const g = gap(t); if (g > res.apart) { res.apart = g; res.apartAt = t; } }
  }
  return res;
}


// ---- the original recipient (same mesh, same vertex order): how this unit's own skin moves in its own clips
const fam = name => name.trim().toLowerCase().split(/[s-]+/)[0];
const gapOf = (S, t, pair) => { let d = Infinity; for (const [ga, ia] of pair.a) { const X = S.pos[t][ga]; if (!X) return NaN; for (const [gb, ib] of pair.b) { const Y = S.pos[t][gb]; if (!Y) return NaN; const q = (X[3 * ia] - Y[3 * ib]) ** 2 + (X[3 * ia + 1] - Y[3 * ib + 1]) ** 2 + (X[3 * ia + 2] - Y[3 * ib + 2]) ** 2; if (q < d) d = q; } } return Math.sqrt(d); };
function nativeReference(P, { maxMoments, clipKinds, debug }) {
  const seqs = P.model.Sequences || [], clips = [];
  const band = P.parts.map(p => p && { hi: new Float32Array(p.edges.length / 3).fill(1), lo: new Float32Array(p.edges.length / 3).fill(1), peak: new Float32Array(p.n) });
  const keepPos = [];
  for (const [si, s] of seqs.entries()) {
    const name = s.Name.trim(); if (SKIP.test(name) || clipKinds && !clipKinds.test(name) || /alternate|morph/i.test(name) && clips.length > 6) continue;
    const len = Math.max(1, s.Interval[1] - s.Interval[0]), n = momentCount(len, maxMoments);
    const S = sampleClip(P, si, n), st = stats(P, S, true); if (!st) continue;
    for (const gi of Object.keys(st.amp)) { const b = band[gi]; const mx = st.eMax[gi], mn = st.eMin[gi]; for (let e = 0; e < mx.length; e++) { if (mx[e] > b.hi[e]) b.hi[e] = mx[e]; if (mn[e] < b.lo[e]) b.lo[e] = mn[e]; } const pk = st.peak[gi]; for (let i = 0; i < pk.length; i++) if (pk[i] > b.peak[i]) b.peak[i] = pk[i]; }
    for (let t = 0; t < n; t += 3) { const F = S.pos[t]; F.fam = fam(name); keepPos.push(F); }
    clips.push({ name, fam: fam(name), amp: st.amp, height: st.height });
  }
  const stand = clips.find(c => c.fam === 'stand') || clips[0];
  const Hs = stand ? [...stand.height].sort((a, b) => a - b)[stand.height.length >> 1] * P.H : P.H;
  const pairs = heldPieces(P, keepPos, Hs, debug);
  return { P, clips, band, pairs, Hs };
}


// Loose pieces (weapon, shield, pads, separate arms) and the skin that holds them: for each piece that is not the
// largest, the 12 vertices of other pieces that stay closest to it through every sampled moment of the unit's own clips.
// A piece counts as held when that skin never drifts more than 4% of the standing height from it.
const boneKey = (g, i) => (g.Groups?.[g.VertexGroup?.[i]] || []).slice().sort((x, y) => x - y).join(',');
function heldPieces(P, frames, Hs, debug) {
  const geos = P.model.Geosets, pieces = new Map();
  geos.forEach((g, gi) => { const p = P.parts[gi]; if (!p) return; for (let i = 0; i < p.n; i++) { const k = gi + ':' + p.piece[i]; if (!pieces.has(k)) pieces.set(k, []); pieces.get(k).push([gi, i]); } });
  const list = [...pieces].sort((a, b) => b[1].length - a[1].length), out = [];
  const usable = frames.filter(F => F.some(Boolean));
  if (!usable.length) return out;
  const at = (F, gi, i) => F[gi] ? [F[gi][3 * i], F[gi][3 * i + 1], F[gi][3 * i + 2]] : null;
  for (const [key, verts] of list.slice(0, 40)) {
    if (verts.length < LIMITS.pieceMin) continue;
    const sub = verts.filter((_, j) => j % Math.ceil(verts.length / 40) === 0);
    // candidates: other-piece vertices within 15% of height of the piece in the modelled mesh, bound to other bones
    // than the piece (skin on the same bones is part of the same item: a hilt, a guard)
    const own = new Set(verts.map(([gi, i]) => boneKey(geos[gi], i)));
    const F0 = usable[0], A0 = sub.map(([gi, i]) => at(F0, gi, i)); if (A0.some(x => !x)) continue;
    const cands = [];
    for (const [k2, v2] of list) { if (k2 === key) continue; for (const [gj, u] of v2) { if (own.has(boneKey(geos[gj], u))) continue; const q = at(F0, gj, u); if (!q) continue; let d = Infinity; for (const p of A0) d = Math.min(d, Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])); if (d < 0.15 * Hs) cands.push([gj, u]); } }
    if (!cands.length) continue;
    // 85th percentile over the unit's own moments (a throw or a sheathe in one clip does not cancel the hold)
    const series = cands.map(() => []);
    for (const F of usable) { const A = sub.map(([gi, i]) => at(F, gi, i)); if (A.some(x => !x)) continue;
      cands.forEach(([gj, u], c) => { const q = at(F, gj, u); if (!q) return; let d = Infinity; for (const a of A) d = Math.min(d, (a[0] - q[0]) ** 2 + (a[1] - q[1]) ** 2 + (a[2] - q[2]) ** 2); series[c].push(d); }); }
    const lv = series.map(v => { if (v.length < usable.length * 0.8) return [Infinity, Infinity]; v.sort((x, y) => x - y); const hi = Math.sqrt(v[Math.floor(0.85 * (v.length - 1))]); return [hi, hi - Math.sqrt(v[Math.floor(0.05 * (v.length - 1))])]; });
    const worst = lv.map(x => x[0]);
    // holder: the steadiest close skin (a low-poly hand may never touch its sword, but it keeps the same distance)
    const order = cands.map((_, c) => c).filter(c => lv[c][1] <= 0.08 * Hs).sort((x, y) => worst[x] - worst[y]).slice(0, 12);
    if (order.length < 4) continue;
    const gap = worst[order[order.length - 1]];
    debug?.("piece", key, verts.length, "holder gap %H", (100 * gap / Hs).toFixed(1));
    if (gap > 0.15 * Hs) continue;
    const pair = { a: sub, b: order.map(c => cands[c]) }, famMax = {};
    for (const F of usable) { let d = Infinity; for (const [ga, ia] of pair.a) { const X = F[ga]; if (!X) { d = NaN; break; } for (const [gb, ib] of pair.b) { const Y = F[gb]; if (!Y) { d = NaN; break; } d = Math.min(d, Math.hypot(X[3 * ia] - Y[3 * ib], X[3 * ia + 1] - Y[3 * ib + 1], X[3 * ia + 2] - Y[3 * ib + 2])); } } if (Number.isFinite(d)) famMax[F.fam] = Math.max(famMax[F.fam] ?? 0, d); }
    out.push({ pair, gap, famMax, size: verts.length });
  }
  return out;
}

function compareNative(N, R, Sr, st, name, debug) {
  const H = N.P.H, out = {};
  const nc = N.clips.find(c => c.name.toLowerCase() === name.toLowerCase()) || N.clips.find(c => c.fam === fam(name));
  // frozen / flailing skin against the unit's own clip of the same kind
  if (nc) { let moving = 0, still = 0, wild = 0, all = 0;
    for (const gi of Object.keys(st.amp)) { const a = st.amp[gi], b = nc.amp[gi]; if (!b) continue; for (let i = 0; i < a.length; i++) { all++; if (b[i] >= 0.04) { moving++; if (a[i] < 0.3 * b[i]) still++; } if (a[i] > 2.5 * b[i] + 0.08) wild++; } }
    // regions = skin on the same bones in the unit's own rig (a cloak, a tail, one leg)
    const reg = new Map();
    for (const gi of Object.keys(st.amp)) { const a = st.amp[gi], b = nc.amp[gi], g = N.P.model.Geosets[gi]; if (!b) continue; for (let i = 0; i < a.length; i++) { const k = boneKey(g, i); let x = reg.get(k); if (!x) reg.set(k, x = { n: 0, mov: 0, still: 0 }); x.n++; if (b[i] >= 0.04) { x.mov++; if (a[i] < 0.3 * b[i]) x.still++; } } }
    let regionStill = 0, regionShare = 0; for (const x of reg.values()) if (x.n >= 0.02 * all && x.mov >= 0.5 * x.n) { const f = x.still / x.mov; if (f > regionStill) { regionStill = f; regionShare = x.n / all; } }
    out.regionStill = regionStill; out.regionShare = regionShare;
    out.natClip = nc.name; out.moving = moving / Math.max(1, all); out.still = moving ? still / moving : 0; out.stillOfAll = still / Math.max(1, all); out.wild = wild / Math.max(1, all); }
  // twitch and tear against the unit's own worst moment in any clip
  let tw = 0, vs = 0, tear = 0, crush = 0, es = 0;
  for (const gi of Object.keys(st.amp)) { const b = N.band[gi]; if (!b) continue; const pk = st.peak[gi]; for (let i = 0; i < pk.length; i++) { vs++; if (pk[i] > 3 * b.peak[i] + 40) tw++; }
    const mx = st.eMax[gi], mn = st.eMin[gi]; for (let e = 0; e < mx.length; e++) { es++; if (mx[e] > 1.5 * b.hi[e]) tear++; if (mn[e] < 0.6 * b.lo[e]) crush++; } }
  out.twitch = tw / Math.max(1, vs); out.tear = tear / Math.max(1, es); out.crush = crush / Math.max(1, es);
  // pieces that stay together in every clip of the unit's own animation
  let apart = 0, apartAt = 0, apartSize = 0;
  for (const { pair, gap, famMax } of N.pairs) { const ref = Math.max(gap, famMax[fam(name)] ?? gap); for (let t = 0; t < Sr.frames.length; t++) { const g = gapOf(Sr, t, pair); if (!Number.isFinite(g)) continue; const extra = (g - ref) / N.Hs; if (extra > apart) { apart = extra; apartAt = t; apartSize = Math.min(pair.a.length, pair.b.length); } } }
  if (debug) for (const { pair, gap, size } of N.pairs) { let mx = -1, fin = 0; for (let t = 0; t < Sr.frames.length; t++) { const g = gapOf(Sr, t, pair); if (Number.isFinite(g)) { fin++; mx = Math.max(mx, g); } } debug("held", size, "native", (gap / N.Hs).toFixed(3), "result max", (mx / N.Hs).toFixed(3), "finite", fin); }
  out.apart = apart; out.apartAt = apartAt; out.pairs = N.pairs.length;
  return out;
}

const momentCount = (length, limit) => Math.min(limit, Math.max(9, Math.round(length / 20) + 1));

/** A model-only look check. The donor and native reference can be reused across result builds. */
export function createLookCheck({ maxMoments = 121, clipKinds = null, debug = null } = {}) {
  const profile = { maxMoments, clipKinds, debug };
  let prepared = new WeakMap(), natives = new WeakMap(), referenceClips = new WeakMap();
  const preparedModel = model => {
    if (!prepared.has(model)) prepared.set(model, prepare(model));
    return prepared.get(model);
  };

  function measurePair(donor, result, { clips: only = null, native = null } = {}) {
    const D = preparedModel(donor), R = preparedModel(result);
    if (native && !natives.has(native)) natives.set(native, nativeReference(preparedModel(native), profile));
    const N = native ? natives.get(native) : null;
    if (!referenceClips.has(donor)) referenceClips.set(donor, new Map());
    const reference = referenceClips.get(donor);
    const dSeq = D.model.Sequences || [], clips = [];
    for (const [si, s] of (R.model.Sequences || []).entries()) {
      const name = s.Name.trim(); if (SKIP.test(name) || (clipKinds && !clipKinds.test(name)) || (only && !only.test(name))) continue;
      let di = dSeq.findIndex(x => x.Name.trim().toLowerCase() === name.toLowerCase());
      if (di < 0) di = dSeq.findIndex(x => baseName(x.Name) === baseName(name));
      if (di < 0) continue;
      const len = Math.max(1, s.Interval[1] - s.Interval[0]), n = momentCount(len, maxMoments);
      const Sr = sampleClip(R, si, n), r = stats(R, Sr, !!N);
      const key = di + ":" + n;
      if (!reference.has(key)) reference.set(key, stats(D, sampleClip(D, di, n)));
      const d = reference.get(key);
      if (!r || !d) continue;
      const keep = x => ({ bob: x.bob, shake: x.shake, twitch: x.twitch, twitchAt: x.twitchAt, tear: x.tear, tearAt: x.tearAt, crush: x.crush, crushAt: x.crushAt, apart: x.apart, apartAt: x.apartAt, cells: [...x.cells], height: x.height, low: x.low });
      clips.push({ name, len, n, r: keep(r), d: keep(d), nat: N ? compareNative(N, R, Sr, r, name, debug) : null });
    }
    return { H: R.H, contacts: R.contacts.length, native: N ? { Hs: N.Hs, pairs: N.pairs.length, clips: N.clips.length } : null, clips };
  }

  const forget = () => { prepared = new WeakMap(); natives = new WeakMap(); referenceClips = new WeakMap(); };
  return { prepare: preparedModel, measurePair, forget };
}
