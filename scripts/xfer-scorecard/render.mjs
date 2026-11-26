// Claude CP14 viewer: flat-shaded software render of donor / own / result frames into one PNG.
// node out/claude-cp14/render.mjs <case-id> <out.png> [--seq Attack,Walk] [--n 6] [--toggles a,b] [--mirror true|false] [--yaw 30] [--save result.mdx]
import fs from 'node:fs';
import zlib from 'node:zlib';
import { Vector3 } from 'three';
import { openDocument } from '../../src/editor-document.js';
import { sampleNodeMatrices, skinGeoset } from '../../src/animation.js';
import { transplantSkeleton, mirrorModel } from '../../src/skeleton-transplant.js';
import { transplantRepairOptions } from '../../src/transfer-window.js';
import { repairFlags } from '../../src/transplant-autofix.js';
import { surfaceVisible } from '../../scripts/xfer-review/surface-review.mjs';
import { vertexBones } from '../../src/part-bones.js';

const args = process.argv.slice(2);
const [caseId, outPng] = args;
const opt = (name, fallback) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : fallback; };
const manifest = opt('manifest', 'D:/Claude/MDLxL/TestBuilds/transfer-xl-35/cases-weapons13.json');
const sheet = JSON.parse(fs.readFileSync(manifest)).cases;
const row = sheet.find(c => c.id === caseId || c.id === 'reasonable-' + caseId);
if (!row) throw new Error('no case ' + caseId);
const load = path => openDocument(fs.readFileSync(path), path).model;
const after = row.variants.find(v => v.id === 'after').transplant;
const donor = load(after.donor), own = load(after.recipient);
const toggles = opt('toggles', null);
const keys = toggles == null ? (row.suggestion?.suggested || []).filter(k => k !== 'donorPose') : toggles.split(',').filter(Boolean);
const mirrorArg = opt('mirror', null);
const keepArg = opt('keep', null);
const legTimingArg = opt('leg-timing', null); // Mirror legs' Leg timing slider (0-100), with --toggles ...mirrorLegs
const options = { ...after.options, ...(keepArg ? { keep: keepArg.split(',').map(Number) } : {}), ...(mirrorArg == null ? {} : { mirror: mirrorArg === 'auto' ? null : mirrorArg === 'true' }), ...(legTimingArg == null ? {} : { legTiming: Number(legTimingArg) }), autoFix: keys.length ? repairFlags(keys) : false };
const t0 = Date.now();
const made = transplantSkeleton(load(after.recipient), load(after.donor), transplantRepairOptions(own, donor, options));
const result = made.model || made.result || made;
console.error('transplant', Date.now() - t0, 'ms keys', keys.join(','), 'mirror', options.mirror);
if (opt('save')) { const { generateCompatibleMdx } = await import('../../src/mdx-compatibility.js'); fs.writeFileSync(opt('save'), Buffer.from(generateCompatibleMdx(result))); }

const seqNames = opt('seq', 'Attack,Walk').split(',');
const n = +opt('n', 6), yaw = +opt('yaw', 35) * Math.PI / 180, size = +opt('size', 220);
const findSeq = (m, name) => { const l = name.toLowerCase(); let i = m.Sequences.findIndex(s => s.Name.trim().toLowerCase() === l); if (i < 0) i = m.Sequences.findIndex(s => s.Name.trim().toLowerCase().startsWith(l)); return i; };
const hue = i => { const h = (i * 0.618034) % 1, f = k => { const x = (k + h * 6) % 6; return Math.max(0, Math.min(1, Math.abs(x - 3) - 1)); }; return [f(5), f(3), f(1)].map(c => 70 + c * 170); };

const focus = opt('focus', null) == null ? null : new Set(opt('focus').split(',').map(Number));
const highlight = opt('highlight', null) && new RegExp(opt('highlight'), 'i');
function frameTris(m, si, tick) {
  const mats = sampleNodeMatrices(m, tick, si, tick), tris = [];
  m.Geosets.forEach((g, gi) => {
    if (!surfaceVisible(m, gi, tick, si)) return;
    const p = skinGeoset(g, mats), F = g.Faces, col = focus && m !== donor ? (focus.has(gi) ? [255, 40, 40] : [200, 200, 200]) : hue(gi);
    const og = m !== donor && own.Geosets[gi]?.Vertices.length === g.Vertices.length ? own.Geosets[gi] : null;
    const lit = k => highlight && og && vertexBones(og, k).some(id => highlight.test(own.Nodes[id]?.Name || ''));
    for (let i = 0; i < F.length; i += 3) tris.push([F[i], F[i + 1], F[i + 2]].map(k => [p[k * 3], p[k * 3 + 1], p[k * 3 + 2]]).concat([[F[i], F[i + 1], F[i + 2]].some(lit) ? [255, 230, 0] : col]));
  });
  return tris;
}
// camera: WC3 x forward, y left, z up. View from front-right at yaw.
const cy = Math.cos(yaw), sy = Math.sin(yaw);
const view = ([x, y, z]) => [-x * sy + y * cy, z, x * cy + y * sy]; // [screen x, screen y, depth toward camera]
function bounds(models) {
  let lo = [1e9, 1e9], hi = [-1e9, -1e9];
  for (const [m, si] of models) { if (si < 0) continue; const [a, b] = m.Sequences[si].Interval;
    for (let j = 0; j < 3; j++) for (const t of frameTris(m, si, Math.round(a + (b - a) * j / 2))) for (const v of t.slice(0, 3)) { const [sx, sy2] = view(v); lo = [Math.min(lo[0], sx), Math.min(lo[1], sy2)]; hi = [Math.max(hi[0], sx), Math.max(hi[1], sy2)]; } }
  return { lo, hi };
}
const usedMirror = transplantRepairOptions(own, donor, options).mirror === true;
const panels = [['Donor', usedMirror ? mirrorModel(donor) : donor], ['Own', own], ['Result', result]];
const rows = seqNames.map(name => panels.map(([label, m]) => [label, m, findSeq(m, name)]));
const W = size * n, H = size * rows.length * 3;
const img = new Uint8Array(W * H * 3).fill(235), zb = new Float32Array(W * H).fill(-1e30);
const light = new Vector3(0.4, 0.3, 0.85).normalize();
function raster(tris, ox, oy, scale, cx, cyc) {
  for (const t of tris) {
    const v = t.slice(0, 3).map(view);
    const a = new Vector3(...t[0]), b = new Vector3(...t[1]), c = new Vector3(...t[2]);
    const nrm = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    const vn = new Vector3(...view(nrm.toArray())).normalize();
    const shade = 0.35 + 0.65 * Math.abs(vn.dot(light));
    const P = v.map(([x, y, z]) => [ox + size / 2 + (x - cx) * scale, oy + size / 2 - (y - cyc) * scale, z]);
    const minX = Math.max(ox, Math.floor(Math.min(...P.map(p => p[0])))), maxX = Math.min(ox + size - 1, Math.ceil(Math.max(...P.map(p => p[0]))));
    const minY = Math.max(oy, Math.floor(Math.min(...P.map(p => p[1])))), maxY = Math.min(oy + size - 1, Math.ceil(Math.max(...P.map(p => p[1]))));
    const [p0, p1, p2] = P, den = (p1[1] - p2[1]) * (p0[0] - p2[0]) + (p2[0] - p1[0]) * (p0[1] - p2[1]);
    if (Math.abs(den) < 1e-9) continue;
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const w0 = ((p1[1] - p2[1]) * (x - p2[0]) + (p2[0] - p1[0]) * (y - p2[1])) / den, w1 = ((p2[1] - p0[1]) * (x - p2[0]) + (p0[0] - p2[0]) * (y - p2[1])) / den, w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const z = w0 * p0[2] + w1 * p1[2] + w2 * p2[2], k = y * W + x;
      if (z <= zb[k]) continue; zb[k] = z;
      for (let ch = 0; ch < 3; ch++) img[k * 3 + ch] = Math.min(255, t[3][ch] * shade);
    }
  }
}
rows.forEach((row3, r) => {
  const bx = bounds(row3.map(([, m, si]) => [m, si]));
  const span = Math.max(bx.hi[0] - bx.lo[0], bx.hi[1] - bx.lo[1]) * 1.05, scale = size / span, cx = (bx.lo[0] + bx.hi[0]) / 2, cyc = (bx.lo[1] + bx.hi[1]) / 2;
  row3.forEach(([, m, si], p) => {
    if (si < 0) return;
    const [a, b] = m.Sequences[si].Interval;
    const phases = opt('phase') ? opt('phase').split(',').map(Number) : null;
    for (let j = 0; j < n; j++) raster(frameTris(m, si, Math.round(a + (b - a) * (phases ? phases[j] ?? phases.at(-1) : j / n))), j * size, (r * 3 + p) * size, scale, cx, cyc);
  });
});
for (let r = 0; r < rows.length * 3; r++) for (let x = 0; x < W; x++) { const k = (r * size) * W + x; img[k * 3] = 120; img[k * 3 + 1] = 120; img[k * 3 + 2] = 120; }
const raw = Buffer.alloc((W * 3 + 1) * H);
for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; Buffer.from(img.buffer, y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1); }
const crcT = new Uint32Array(256).map((_, i) => { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = buf => { let c = 0xffffffff; for (const b of buf) c = crcT[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
fs.writeFileSync(outPng, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.error('rows', rows.map(r => r.map(([l, m, si]) => l + ':' + (si >= 0 ? m.Sequences[si].Name.trim() : '-')).join(' ')).join(' | '));
