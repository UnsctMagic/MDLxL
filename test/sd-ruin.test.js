import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { openDocument } from '../src/editor-document.js';
import { createSequence } from '../src/sequence-editor.js';
import * as ruin from '../src/sd-ruin.js';

const blank = () => openDocument(new TextEncoder().encode('Version { FormatVersion 800, }\nModel "Wall" { BlendTime 150, }\n'), 'Wall.mdl');
const triangles = model => model.Geosets.reduce((s, g) => s + g.Faces.length / 3, 0);
/** A wall built from native paint in a fresh MDX 800 document. */
function kitDoc(options = { length: 320, height: 150, thickness: 62 }) {
  const doc = blank();
  let wall;
  doc.apply('Wall', [], model => { wall = ruin.kitWall(model, options); });
  return { doc, wall };
}
const inside = (uv, [u0, v0, u1, v1]) => uv[0] >= u0 - 1e-4 && uv[0] <= u1 + 1e-4 && uv[1] >= v0 - 1e-4 && uv[1] <= v1 + 1e-4;
const local = (frame, p) => [(p[0] - frame.origin[0]) * frame.along[0] + (p[1] - frame.origin[1]) * frame.along[1], (p[0] - frame.origin[0]) * frame.across[0] + (p[1] - frame.origin[1]) * frame.across[1], p[2]];
// Open edges above the ground that no other open edge seals (a T-junction run): light would pass there.
function unsealed(model, minZ = 0.5) {
  const edges = new Map(), q = v => Math.round(v * 20) / 20, key = p => p.map(q).join(',');
  for (const g of model.Geosets) {
    const P = v => [g.Vertices[v * 3], g.Vertices[v * 3 + 1], g.Vertices[v * 3 + 2]];
    for (let f = 0; f < g.Faces.length; f += 3) for (let e = 0; e < 3; e++) {
      const a = P(g.Faces[f + e]), b = P(g.Faces[f + ((e + 1) % 3)]), ka = key(a), kb = key(b), k = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      (edges.get(k) || edges.set(k, { n: 0, a, b }).get(k)).n++;
    }
  }
  const open = [...edges.values()].filter(e => e.n === 1 && Math.hypot(e.a[0] - e.b[0], e.a[1] - e.b[1], e.a[2] - e.b[2]) > 0.05);
  const on = (p, e) => { const d = [0, 1, 2].map(i => e.b[i] - e.a[i]), l2 = d.reduce((s, x) => s + x * x, 0), t = [0, 1, 2].reduce((s, i) => s + (p[i] - e.a[i]) * d[i], 0) / l2; return t > -1e-3 && t < 1 + 1e-3 && Math.hypot(...[0, 1, 2].map(i => e.a[i] + d[i] * t - p[i])) < 0.05; };
  return open.filter(e => Math.max(e.a[2], e.b[2]) > minZ && ![0.02, 0.25, 0.5, 0.75, 0.98].every(t => { const p = e.a.map((x, i) => x + (e.b[i] - x) * t); return p[2] < minZ || open.some(o => o !== e && on(p, o)); }));
}

test('SD Ruin break line: stone-course steps (vertical risers, nearly flat treads), repeatable by seed', () => {
  const { doc, wall } = kitDoc(), frame = ruin.wallFrame(doc.model, wall.selection);
  assert.ok(Math.abs(frame.length - 320) < 0.5 && Math.abs(frame.height - 150) < 0.5, 'the frame runs along the wall');
  const line = ruin.breakLine(frame, { from: 0.3, to: 0.7, low: 0.3, jaggedness: 0.6, seed: 3 });
  assert.equal(line[0][1], Infinity); assert.equal(line.at(-1)[1], Infinity);
  const risers = line.slice(1).filter((p, i) => Math.abs(p[0] - line[i][0]) < 1e-6).length, cut = line.filter(p => p[1] !== Infinity);
  assert.ok(risers >= 5, `stepped, not a smooth curve (${risers} risers)`);
  for (let i = 1; i < line.length; i++) if (line[i][0] - line[i - 1][0] > 1e-6 && line[i][1] !== Infinity) assert.ok(Math.abs((line[i][1] - line[i - 1][1]) / (line[i][0] - line[i - 1][0])) < 0.6, 'treads stay nearly level');
  assert.ok(Math.min(...cut.map(p => p[1])) < frame.ground + frame.height * 0.45 && Math.max(...cut.map(p => p[1])) < frame.top, 'breaks down to the low part, never above the top');
  assert.deepEqual(ruin.breakLine(frame, { seed: 3, from: 0.3, to: 0.7, low: 0.3 }), line);
  assert.notDeepEqual(ruin.breakLine(frame, { seed: 4, from: 0.3, to: 0.7, low: 0.3 }), line);
});

test('SD Ruin breakWall removes what stood above the line and closes the cut with native stone paint', () => {
  const { doc, wall } = kitDoc(), before = triangles(doc.model);
  let cut;
  doc.apply('Break', [], model => { cut = ruin.breakWall(model, wall.selection, { from: 0.3, to: 0.7, low: 0.3, seed: 3 }); });
  const model = doc.model, g = model.Geosets[cut.geosets[0]], frame = cut.frame;
  const height = s => { let h = -Infinity, inLine = false; for (let i = 0; i < cut.line.length; i++) { const [a, z] = cut.line[i], b = cut.line[i + 1]; if (Math.abs(a - s) < 1e-3) { h = Math.max(h, z); inLine = true; } if (b && s > a && s < b[0]) { h = Math.max(h, z === Infinity ? Infinity : z + ((b[1] - z) * (s - a)) / (b[0] - a)); inLine = true; } } return inLine ? h : Infinity; };
  for (let v = 0; v < g.Vertices.length / 3; v++) {
    const [s, , z] = local(frame, [g.Vertices[v * 3], g.Vertices[v * 3 + 1], g.Vertices[v * 3 + 2]]);
    assert.ok(z <= height(s) + 0.05, `nothing stands above the break (vertex ${v} at s ${s.toFixed(1)}, z ${z.toFixed(1)})`);
  }
  assert.ok(cut.triangles.cut > 0 && cut.triangles.faces >= 10, 'the wall was cut and the cut closed');
  assert.deepEqual(unsealed(model), [], 'the broken top is solid from every side: no open edge above the ground');
  const stone = ruin.WALL_PAINT.stone, uv = g.TVertices[0];
  const painted = Array.from({ length: g.Faces.length / 3 }, (_, f) => [0, 1, 2].every(k => inside([uv[g.Faces[f * 3 + k] * 2], uv[g.Faces[f * 3 + k] * 2 + 1]], stone))).filter(Boolean).length;
  assert.ok(painted >= cut.triangles.faces, 'the cut faces wear the looked-at stone area');
  assert.equal(model.Geosets.length, 1, 'one geoset, one sheet: the stone comes from the wall\'s own sheet');
  assert.ok(triangles(model) > before && triangles(model) < before + 150);
  assert.ok(cut.density > 0.3 && cut.density < 1.2, `painted at the wall's own density (${cut.density.toFixed(2)} px per unit)`);
});

test('SD Ruin breakWall follows a line given in fractions, and a break may take the wall\'s end down', () => {
  const { doc, wall } = kitDoc();
  let cut;
  doc.apply('Break end', [], model => { cut = ruin.breakWall(model, wall.selection, { line: [[0, 0.4], [0.15, 0.4], [0.15, 0.6], [0.3, 0.62], [0.3, 1]] }); });
  const frame = cut.frame, g = doc.model.Geosets[0];
  const atStart = Array.from({ length: g.Vertices.length / 3 }, (_, v) => local(frame, [g.Vertices[v * 3], g.Vertices[v * 3 + 1], g.Vertices[v * 3 + 2]])).filter(p => p[0] < frame.s0 + 1);
  assert.ok(atStart.length && Math.max(...atStart.map(p => p[2])) <= frame.ground + 0.4 * frame.height + 0.05, 'the end is broken down to 40%');
  assert.deepEqual(unsealed(doc.model), []);
  assert.throws(() => ruin.breakWall(doc.model, 0, { line: [[0.5, 0.2], [0.2, 0.3]] }), /must not decrease/);
});

test('SD Ruin crenellate stands merlons on the parts still standing, flush with the break', () => {
  const { doc, wall } = kitDoc();
  let cut, crenels;
  doc.apply('Break and crenellate', [], model => { cut = ruin.breakWall(model, wall.selection, { from: 0.35, to: 0.65, low: 0.3, seed: 2 }); crenels = ruin.crenellate(model, cut); });
  assert.ok(crenels.merlons >= 4, `${crenels.merlons} merlons`);
  assert.equal(crenels.triangles, crenels.merlons * 10, 'a merlon is five faces, no hidden bottom');
  const g = doc.model.Geosets[0], frame = cut.frame, cutS = cut.line.filter(p => p[1] !== Infinity).map(p => p[0]);
  for (let v = 0; v < g.Vertices.length / 3; v++) {
    const [s, , z] = local(frame, [g.Vertices[v * 3], g.Vertices[v * 3 + 1], g.Vertices[v * 3 + 2]]);
    if (z > frame.top + 0.5) assert.ok(s <= Math.min(...cutS) + 1e-3 || s >= Math.max(...cutS) - 1e-3, 'no merlon over the breach');
  }
  const top = Math.max(...Array.from({ length: g.Vertices.length / 3 }, (_, v) => g.Vertices[v * 3 + 2]));
  assert.ok(top > frame.top + crenels.merlon[1] * 0.8 && top < frame.top + crenels.merlon[1] * 1.1, 'merlons rise a merlon above the wall');
  const whole = kitDoc();
  let full;
  whole.doc.apply('Crenellate', [], model => { full = ruin.crenellate(model, ruin.wallFrame(model, whole.wall.selection)); });
  const [mw] = full.merlon;
  assert.equal(full.merlons, Math.floor((320 + full.gap) / (mw + full.gap)), 'an unbroken wall is crenellated end to end');
});

test('SD Ruin rubble: a few varied low-poly stones at the breach, sunk into the ground, in native stone paint', () => {
  const { doc, wall } = kitDoc();
  let cut, fallen;
  doc.apply('Rubble', [], model => { cut = ruin.breakWall(model, wall.selection, { seed: 5 }); const t = triangles(model); fallen = ruin.rubble(model, cut, { count: 6, seed: 5 }); fallen.before = t; });
  assert.equal(fallen.chunks, 7, 'six on the ground and one on the broken top');
  assert.ok(fallen.triangles >= fallen.chunks * 4 && fallen.triangles <= fallen.chunks * 10, `a handful of triangles each (${fallen.triangles})`);
  const g = doc.model.Geosets[0], uv = g.TVertices[0], stone = ruin.WALL_PAINT.stone, frame = cut.frame;
  const added = Array.from({ length: fallen.triangles }, (_, k) => fallen.before + k);
  for (const f of added) for (let k = 0; k < 3; k++) assert.ok(inside([uv[g.Faces[f * 3 + k] * 2], uv[g.Faces[f * 3 + k] * 2 + 1]], stone), 'rubble wears the stone area');
  const zs = added.flatMap(f => [0, 1, 2].map(k => g.Vertices[g.Faces[f * 3 + k] * 3 + 2]));
  assert.ok(Math.min(...zs) < 0 && Math.min(...zs) > -frame.height * 0.3, 'set into the ground, not buried');
  const cutS = cut.line.filter(p => p[1] !== Infinity).map(p => p[0]), mid = (Math.min(...cutS) + Math.max(...cutS)) / 2;
  const ss = added.flatMap(f => [0, 1, 2].map(k => local(frame, [g.Vertices[g.Faces[f * 3 + k] * 3], g.Vertices[g.Faces[f * 3 + k] * 3 + 1], 0])[0]));
  assert.ok(ss.every(s => Math.abs(s - mid) < frame.length * 0.45), 'the stones lie at the breach');
  assert.deepEqual(ruin.rubble(structuredClone(doc.model), cut, { count: 6, seed: 5 }).triangles, ruin.rubble(structuredClone(doc.model), cut, { count: 6, seed: 5 }).triangles, 'repeatable by seed');
});

test('SD Ruin makeDoodad keeps one looping Stand and drops what the death sequence left', () => {
  const { doc } = kitDoc();
  doc.apply('Sequences', [], model => {
    const a = createSequence(model, 667), b = createSequence(model, 2000);
    model.Sequences[a].Name = 'Stand'; model.Sequences[b].Name = 'Death'; model.Sequences[b].NonLooping = true;
    const [start] = model.Sequences[b].Interval;
    model.GeosetAnims.push({ GeosetId: 0, Flags: 0, Color: new Float32Array([1, 1, 1]), Alpha: { Keys: [{ Frame: start, Vector: [1] }, { Frame: start + 1800, Vector: [0] }], LineType: 0, GlobalSeqId: null } });
    model.Textures.push({ Image: 'ReplaceableTextures\\Weather\\Clouds8x8.blp', ReplaceableId: 0, Flags: 0 });
    ruin.makeDoodad(model, { name: 'RuinedWall' });
  });
  const m = doc.model;
  assert.deepEqual(m.Sequences.map(s => [s.Name, s.NonLooping]), [['Stand', false]]);
  assert.equal(m.GeosetAnims.at(-1).Alpha, 1, 'the emptied death fade is a plain 1 again');
  assert.deepEqual(m.Textures.map(t => t.Image), ['Textures\\Doodads1.blp'], 'the unused cloud sheet is gone');
  assert.equal(m.Info.Name, 'RuinedWall');
  assert.equal(m.Geosets[0].Anims.length, 1);
});

test('SD Ruin brokenCastleWall from native paint: an MDX 800 doodad in the native range that saves and reopens as MDX and MDL', () => {
  const doc = blank();
  let result;
  doc.apply('Broken castle wall', [], model => { result = ruin.brokenCastleWall(model, { length: 320, height: 150, thickness: 62, seed: 4 }); });
  assert.ok(result.merlons.merlons >= 3 && result.rubble.chunks >= 6 && result.cut.triangles.faces > 0);
  const mdx = doc.serialize('mdx'), again = openDocument(new Uint8Array(mdx), 'BrokenCastleWall.mdx');
  const report = ruin.doodadReport(again.model, { bytes: mdx });
  assert.ok(report.passed, JSON.stringify(report.checks.filter(c => !c.passed)));
  assert.equal(again.model.Version, 800);
  assert.deepEqual(report.sequences, ['Stand']);
  assert.deepEqual(report.sheets, ['Textures\\Doodads1.blp']);
  assert.ok(report.triangles >= 120 && report.triangles <= 260, `${report.triangles} triangles`);
  assert.ok(report.height > 98 * 1.4 && report.height < 98 * 2.5, `taller than a Footman (${report.height})`);
  const mdl = again.serialize('mdl'), fromMdl = openDocument(typeof mdl === 'string' ? new TextEncoder().encode(mdl) : new Uint8Array(mdl), 'BrokenCastleWall.mdl');
  assert.equal(triangles(fromMdl.model), report.triangles);
  assert.deepEqual(fromMdl.model.Sequences.map(s => s.Name), ['Stand']);
  assert.equal(fromMdl.model.Version, 800);
});

test('SD Ruin brokenCastleWall scale reshapes the wall about its ground before the break', () => {
  const height = scale => { const doc = blank(); doc.apply('Wall', [], model => ruin.brokenCastleWall(model, { length: 300, height: 150, scale, merlons: false, rubble: 0, line: [[0, 1], [1, 1]] })); return ruin.doodadReport(doc.model).height; };
  assert.equal(height(undefined), 150);
  assert.equal(height([1, 1, 1.3]), 195);
  assert.throws(() => height(0), /scale is a number/);
});

test('SD Ruin doodadReport flags what a doodad must not be', () => {
  const { doc } = kitDoc();
  const report = ruin.doodadReport(doc.model);
  assert.equal(report.passed, false, 'a wall without a Stand is not a doodad yet');
  assert.match(report.checks.find(c => !c.passed).name, /Stand/);
  assert.throws(() => ruin.wallPaint('sheet'), /Wall paint is one of/);
});

// The native wall: Blizzard's Lordaeron stone wall between two pillars, from the installed game.
const game = 'D:/Warcraft III', bridge = new URL('../electron/casc/CascBridge-0.9.0.exe', import.meta.url);
async function gameModels(paths) {
  const { CascReader } = createRequire(import.meta.url)('../electron/casc.cjs');
  const casc = new CascReader(game, new URL('../electron', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
  try { await casc.ready; const out = {}; for (const p of paths) out[p] = await casc.read('war3.w3mod:' + p); return out; } finally { casc.process.kill(); }
}
const noGame = !(fs.existsSync(game) && fs.existsSync(bridge)) && 'needs the installed game';
test('SD Ruin on the native stone wall: break between the pillars, pillars untouched, a doodad in the native range', { skip: noGame }, async () => {
  const walls = ruin.NATIVE_WALLS.filter(w => /stonewall0[24]/.test(w.path)), files = await gameModels(walls.map(w => w.path));
  for (const w of walls) {
    const native = openDocument(new Uint8Array(files[w.path]), 'native.mdx').model;
    assert.equal(triangles(native), w.triangles, `${w.path} measured as the game has it`);
    assert.deepEqual(native.Sequences.map(s => s.Name), w.sequences);
  }
  const base = openDocument(new Uint8Array(files[walls.find(w => /stonewall02/.test(w.path)).path]), 'stonewall02.mdx').model;
  const pillarTops = m => m.Geosets.reduce((s, g) => { let n = 0; for (let f = 0; f < g.Faces.length; f += 3) if (Math.max(...[0, 1, 2].map(k => g.Vertices[g.Faces[f + k] * 3 + 2])) > 180) n++; return s + n; }, 0);
  const doc = blank();
  let result;
  doc.apply('Broken castle wall', [], model => { result = ruin.brokenCastleWall(model, { base, seed: 3 }); });
  const mdx = doc.serialize('mdx'), again = openDocument(new Uint8Array(mdx), 'BrokenCastleWall.mdx'), report = ruin.doodadReport(again.model, { bytes: mdx });
  assert.ok(report.passed, JSON.stringify(report.checks.filter(c => !c.passed)));
  assert.deepEqual(report.sheets, ['Textures\\Doodads1.blp'], 'native paint only, on the wall\'s own sheet');
  assert.equal(pillarTops(again.model), pillarTops(base), 'both pillars keep their tops');
  assert.ok(result.merlons.merlons >= 2 && result.rubble.chunks >= 6);
  assert.equal(again.model.ParticleEmitters2?.length || 0, 0, 'the destructible\'s death dust is gone');
  assert.ok(report.kb < 30 && report.triangles <= 260, `${report.triangles} triangles, ${report.kb} KB`);
  // The cut alone leaves no new open edge: only Blizzard's own (the wall's end inside a pillar).
  const cutOnly = blank();
  cutOnly.apply('Cut', [], model => { ruin.brokenCastleWall(model, { base, seed: 3, merlons: false, rubble: 0 }); });
  const baseDoc = blank();
  baseDoc.apply('Base', [], model => { ruin.brokenCastleWall(model, { base, seed: 3, merlons: false, rubble: 0, line: [[0, 1], [1, 1]] }); });
  assert.equal(unsealed(cutOnly.model).length, unsealed(baseDoc.model).length);
  const mdl = again.serialize('mdl'), fromMdl = openDocument(typeof mdl === 'string' ? new TextEncoder().encode(mdl) : new Uint8Array(mdl), 'BrokenCastleWall.mdl');
  assert.equal(triangles(fromMdl.model), report.triangles);
});
