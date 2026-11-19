// UV Wrapper Fit (src/uv-fit.js): the selected triangles' UVs are moved into a marked area. Nothing
// is cut and nothing is added: only existing points move. Checked on real models from the
// permanent test-model collection, against three marks (an oblique quad, an L and a crescent).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { parseCompatibleMdx } from '../src/mdx-compatibility.js';
import { WHOLE_TRIANGLE_ERROR } from '../src/uv-unwrap.js';
import { AREA_CROSSING_ERROR, AREA_ERROR, cleanArea, fitUVs, maskOutline } from '../src/uv-fit.js';
const { fixturePath } = createRequire(import.meta.url)('./helpers/fixtures.cjs');

const models = new Map();
function geosetOf(fixture, index) {
  const file = fixturePath(fixture);
  if (!file || !fs.existsSync(file)) return null;
  if (!models.has(file)) { const bytes = fs.readFileSync(file); models.set(file, parseCompatibleMdx(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))); }
  return models.get(file).Geosets[index];
}
const everyPoint = geoset => Array.from({ length: geoset.Vertices.length / 3 }, (_, i) => i);
/** Point groups joined through triangles, most points first. */
function joinedPoints(geoset) {
  const faces = geoset.Faces, parent = everyPoint(geoset), find = i => { while (parent[i] !== i) i = parent[i] = parent[parent[i]]; return i; };
  for (let c = 0; c < faces.length; c += 3) { parent[find(faces[c])] = find(faces[c + 1]); parent[find(faces[c])] = find(faces[c + 2]); }
  const groups = new Map();
  for (let c = 0; c < faces.length; c++) { const root = find(faces[c]); if (!groups.has(root)) groups.set(root, new Set()); groups.get(root).add(faces[c]); }
  return [...groups.values()].map(set => [...set]).sort((a, b) => b.length - a.length);
}
function boxOf(uv, points) {
  const low = [Infinity, Infinity], high = [-Infinity, -Infinity];
  for (const v of points) { low[0] = Math.min(low[0], uv[v * 2]); low[1] = Math.min(low[1], uv[v * 2 + 1]); high[0] = Math.max(high[0], uv[v * 2]); high[1] = Math.max(high[1], uv[v * 2 + 1]); }
  return [low, high];
}
/** The three marks, inside the box the selection takes up now. */
function marksIn([low, high]) {
  const at = (x, y) => [low[0] + x * (high[0] - low[0]), low[1] + y * (high[1] - low[1])], degrees = Math.PI / 180, crescent = [];
  for (let i = 0; i < 16; i++) { const a = (47.2 + (312.8 - 47.2) * i / 15) * degrees; crescent.push(at(.5 + .5 * Math.cos(a), .5 + .5 * Math.sin(a))); }
  for (let i = 1; i < 12; i++) { const a = (293.6 + (66.4 - 293.6) * i / 12) * degrees; crescent.push(at(.68 + .4 * Math.cos(a), .5 + .4 * Math.sin(a))); }
  return { quad: [at(.1, .05), at(.95, .2), at(.85, .95), at(.05, .75)], L: [at(0, 0), at(1, 0), at(1, .45), at(.45, .45), at(.45, 1), at(0, 1)], crescent };
}
const insideMark = (mark, x, y) => { let hit = false; for (let i = 0, j = mark.length - 1; i < mark.length; j = i++) { const a = mark[i], b = mark[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit; } return hit; };
const toEdge = (mark, x, y) => { let least = Infinity; for (let i = 0, j = mark.length - 1; i < mark.length; j = i++) { const a = mark[j], b = mark[i], dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l)) : 0; least = Math.min(least, Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t)); } return least; };

/** Everything the task promises, measured on one result. `aspect` is the texture's width over height. */
function measure(geoset, selection, source, result, mark, aspect = 1) {
  const faces = geoset.Faces, P = geoset.Vertices, chosen = new Set(selection), whole = [], inTriangle = new Set();
  for (let c = 0; c < faces.length; c += 3) if (chosen.has(faces[c]) && chosen.has(faces[c + 1]) && chosen.has(faces[c + 2])) { whole.push([faces[c], faces[c + 1], faces[c + 2]]); for (let k = 0; k < 3; k++) inTriangle.add(faces[c + k]); }
  let strayed = 0, outside = 0, folded = 0, flattened = 0, apart = 0, unfinite = 0;
  for (let i = 0; i < source.length / 2; i++) {
    if (!Number.isFinite(result[i * 2]) || !Number.isFinite(result[i * 2 + 1])) unfinite++;
    if (!inTriangle.has(i) && (source[i * 2] !== result[i * 2] || source[i * 2 + 1] !== result[i * 2 + 1])) strayed++;
  }
  // Inside the mark, within a hundredth of a pixel of a 1024 texture.
  for (const v of inTriangle) if (!insideMark(mark, result[v * 2], result[v * 2 + 1]) && toEdge(mark, result[v * 2], result[v * 2 + 1]) > 1e-5) outside++;
  // Points on exactly one UV spot (a seam's two copies) are still on one spot.
  const spots = new Map();
  for (const v of inTriangle) { const key = source[v * 2] + ',' + source[v * 2 + 1]; if (!spots.has(key)) spots.set(key, v); else { const first = spots.get(key); if (result[first * 2] !== result[v * 2] || result[first * 2 + 1] !== result[v * 2 + 1]) apart++; } }
  const twice = (uv, [a, b, c]) => (uv[b * 2] - uv[a * 2]) * (uv[c * 2 + 1] - uv[a * 2 + 1]) - (uv[b * 2 + 1] - uv[a * 2 + 1]) * (uv[c * 2] - uv[a * 2]);
  for (const t of whole) {
    // A triangle thinner than a fiftieth of a pixel on a 1024 texture has no side a float can hold.
    const [a, b, c] = t, long = Math.max(Math.hypot(source[b * 2] - source[a * 2], source[b * 2 + 1] - source[a * 2 + 1]), Math.hypot(source[c * 2] - source[a * 2], source[c * 2 + 1] - source[a * 2 + 1]), Math.hypot(source[c * 2] - source[b * 2], source[c * 2 + 1] - source[b * 2 + 1]));
    const was = twice(source, t), now = twice(result, t);
    if (Math.abs(was) <= 2e-5 * long) continue;
    if (was * now < 0) folded++;
    if (now === 0) flattened++;
  }
  // Stretch of a triangle: its longest over its shortest scale from the model's surface to the
  // texture's pixels. The 90th percentile by surface; a plain move and even resize leaves it as it was.
  const stretch = uv => {
    const list = [], seen = new Set(); let total = 0;
    for (const [a, b, c] of whole) {
      const key = [a, b, c].sort((x, y) => x - y).join(); if (seen.has(key)) continue; seen.add(key);
      const e1 = [0, 1, 2].map(k => P[b * 3 + k] - P[a * 3 + k]), e2 = [0, 1, 2].map(k => P[c * 3 + k] - P[a * 3 + k]), l1 = Math.hypot(...e1), surface = Math.hypot(e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]);
      if (!(surface > 1e-9)) continue;
      const x2 = (e1[0] * e2[0] + e1[1] * e2[1] + e1[2] * e2[2]) / l1, y2 = surface / l1, d1 = [(uv[b * 2] - uv[a * 2]) * aspect, uv[b * 2 + 1] - uv[a * 2 + 1]], d2 = [(uv[c * 2] - uv[a * 2]) * aspect, uv[c * 2 + 1] - uv[a * 2 + 1]];
      const j00 = d1[0] / l1, j01 = (d2[0] - d1[0] * x2 / l1) / y2, j10 = d1[1] / l1, j11 = (d2[1] - d1[1] * x2 / l1) / y2, E = j00 * j00 + j10 * j10, G = j01 * j01 + j11 * j11, F = j00 * j01 + j10 * j11, root = Math.sqrt((E - G) ** 2 + 4 * F * F), high = Math.sqrt((E + G + root) / 2), low = Math.sqrt(Math.max(0, (E + G - root) / 2));
      list.push([low > 1e-9 * high ? high / low : 1e9, surface]); total += surface;
    }
    list.sort((p, q) => p[0] - q[0]);
    let run = 0; for (const [value, surface] of list) { run += surface; if (run >= .9 * total) return value; }
    return 1;
  };
  // Share of the mark the triangles cover, and how much of them lies outside it, counted on a grid.
  const [low, high] = boxOf(mark.flat(), mark.map((_, i) => i)), N = 240, grid = new Uint8Array(N * N);
  for (const [a, b, c] of whole) {
    const X = [a, b, c].map(v => (result[v * 2] - low[0]) / (high[0] - low[0]) * N), Y = [a, b, c].map(v => (result[v * 2 + 1] - low[1]) / (high[1] - low[1]) * N);
    for (let y = Math.max(0, Math.floor(Math.min(...Y))); y <= Math.min(N - 1, Math.floor(Math.max(...Y))); y++) for (let x = Math.max(0, Math.floor(Math.min(...X))); x <= Math.min(N - 1, Math.floor(Math.max(...X))); x++) {
      const px = x + .5, py = y + .5, d1 = (X[1] - X[0]) * (py - Y[0]) - (Y[1] - Y[0]) * (px - X[0]), d2 = (X[2] - X[1]) * (py - Y[1]) - (Y[2] - Y[1]) * (px - X[1]), d3 = (X[0] - X[2]) * (py - Y[2]) - (Y[0] - Y[2]) * (px - X[2]);
      if ((d1 >= 0 && d2 >= 0 && d3 >= 0) || (d1 <= 0 && d2 <= 0 && d3 <= 0)) grid[y * N + x] = 1;
    }
  }
  let area = 0, covered = 0, spilled = 0;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const within = insideMark(mark, low[0] + (x + .5) / N * (high[0] - low[0]), low[1] + (y + .5) / N * (high[1] - low[1])); if (within) { area++; if (grid[y * N + x]) covered++; } else if (grid[y * N + x]) spilled++; }
  return { points: inTriangle.size, triangles: whole.length, strayed, outside, folded, flattened, apart, unfinite, coverage: covered / area, spill: spilled / area, before: stretch(source), after: stretch(result) };
}

const rows = [];
function check(t, name, geoset, selection, { arranged = false, source = geoset.TVertices[0], aspect = 1 } = {}) {
  for (const [shape, mark] of Object.entries(marksIn(boxOf(source, selection)))) {
    const untouched = Float32Array.from(source), started = performance.now();
    const result = fitUVs(geoset, selection, null, null, source, mark, aspect), ms = performance.now() - started, m = measure(geoset, selection, source, result, mark, aspect);
    rows.push({ piece: name, mark: shape, points: m.points, triangles: m.triangles, 'cover %': +(m.coverage * 100).toFixed(1), 'outside %': +(m.spill * 100).toFixed(1), 'p90 stretch before': +m.before.toFixed(2), after: +m.after.toFixed(2), folded: m.folded, ms: Math.round(ms) });
    const where = `${name}, ${shape}`;
    assert.ok(result instanceof Float32Array && result !== source, `${where}: a new array`);
    assert.equal(result.length, source.length, `${where}: same length`);
    assert.deepEqual(source, untouched, `${where}: the source is left alone`);
    assert.equal(m.unfinite, 0, `${where}: every value is a number`);
    assert.equal(m.strayed, 0, `${where}: no point outside the selected triangles moved`);
    assert.equal(m.outside, 0, `${where}: every moved point is inside the mark`);
    assert.equal(m.apart, 0, `${where}: points that shared a UV spot still share one`);
    assert.equal(m.folded, 0, `${where}: no triangle turned over`);
    assert.equal(m.flattened, 0, `${where}: no triangle squeezed to nothing`);
    assert.ok(m.coverage > .05, `${where}: the pieces take up room in the mark (${(m.coverage * 100).toFixed(1)}%)`);
    assert.ok(m.spill < .02, `${where}: triangles stay in the mark (${(m.spill * 100).toFixed(1)}% outside)`);
    // Separate pieces are only moved, turned and resized, so their stretch is what a plain resize gives.
    if (arranged) assert.ok(m.after <= m.before * 1.001 + 1e-3, `${where}: stretch ${m.after} is no worse than the plain resize's ${m.before}`);
  }
}
test.after(() => { if (rows.length) console.table(rows); });

test('Fit: Nurgle knight piece (geoset 46), whole', t => {
  const geoset = geosetOf('uv-fit-nurgle', 46); if (!geoset) return t.skip('model file missing');
  check(t, 'Nurgle 46 whole', geoset, everyPoint(geoset));
});
test('Fit: Bretonnian archer piece (geoset 11), whole and one quad', t => {
  const geoset = geosetOf('uv-fit-archer', 11); if (!geoset) return t.skip('model file missing');
  check(t, 'Archer 11 whole', geoset, everyPoint(geoset));
  check(t, 'Archer 11 one quad', geoset, joinedPoints(geoset)[0]);
});
test('Fit: orc piece (geoset 5), whole (separate pieces) and its largest piece', t => {
  const geoset = geosetOf('uv-fit-orc', 5); if (!geoset) return t.skip('model file missing');
  check(t, 'Orc 5 whole', geoset, everyPoint(geoset), { arranged: true });
  check(t, 'Orc 5 largest', geoset, joinedPoints(geoset)[0]);
});
test('Fit: Footman body (geoset 0), whole (many pieces) and two single pieces', t => {
  const geoset = geosetOf('footman', 0); if (!geoset) return t.skip('model file missing');
  check(t, 'Footman 0 whole', geoset, everyPoint(geoset), { arranged: true });
  check(t, 'Footman 0 largest', geoset, joinedPoints(geoset)[0]);
  check(t, 'Footman 0 second', geoset, joinedPoints(geoset)[1]);
});
test('Fit: a dense piece of the Reforged Footman runs on a click', t => {
  const geoset = geosetOf('forge-hd-footman', 0); if (!geoset) return t.skip('model file missing');
  const piece = joinedPoints(geoset).find(points => points.length <= 300);
  check(t, 'HD Footman 0 piece', geoset, piece);
  for (const row of rows.filter(row => row.piece === 'HD Footman 0 piece')) assert.ok(row.ms < 1500, `${row.mark}: ${row.ms} ms for ${row.triangles} triangles`);
});

test('Fit: a texture twice as wide as high', t => {
  const geoset = geosetOf('footman', 0); if (!geoset) return t.skip('model file missing');
  check(t, 'Footman 0 largest, 2:1', geoset, joinedPoints(geoset)[0], { aspect: 2 });
  check(t, 'Footman 0 whole, 2:1', geoset, everyPoint(geoset), { arranged: true, aspect: 2 });
});

test('Fit: a piece with no size on the texture gets a shape', t => {
  const geoset = geosetOf('footman', 0); if (!geoset) return t.skip('model file missing');
  const piece = joinedPoints(geoset)[0], source = Float32Array.from(geoset.TVertices[0]);
  for (const v of piece) { source[v * 2] = .4; source[v * 2 + 1] = .6; }
  const mark = [[.2, .2], [.7, .25], [.65, .8], [.25, .7]], twice = (uv, a, b, c) => (uv[b * 2] - uv[a * 2]) * (uv[c * 2 + 1] - uv[a * 2 + 1]) - (uv[b * 2 + 1] - uv[a * 2 + 1]) * (uv[c * 2] - uv[a * 2]);
  const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  for (const view of [null, identity]) {
    const result = fitUVs(geoset, piece, view, view, source, mark), chosen = new Set(piece);
    let size = 0;
    for (let c = 0; c < geoset.Faces.length; c += 3) if (chosen.has(geoset.Faces[c])) size += Math.abs(twice(result, geoset.Faces[c], geoset.Faces[c + 1], geoset.Faces[c + 2]));
    assert.ok(size > .01, `the piece has size on the texture (${size})`);
    for (const v of piece) assert.ok(insideMark(mark, result[v * 2], result[v * 2 + 1]) || toEdge(mark, result[v * 2], result[v * 2 + 1]) <= 1e-5, 'inside the mark');
    for (let i = 0; i < source.length / 2; i++) if (!chosen.has(i)) assert.ok(result[i * 2] === source[i * 2] && result[i * 2 + 1] === source[i * 2 + 1], 'other points stay');
  }
});

test('Fit: marks given as {x, y} work like [u, v]; bad marks and selections say why', t => {
  const geoset = geosetOf('footman', 0); if (!geoset) return t.skip('model file missing');
  const piece = joinedPoints(geoset)[1], mark = [[.2, .2], [.7, .25], [.65, .8], [.25, .7]];
  assert.deepEqual(fitUVs(geoset, piece, null, null, undefined, mark.map(([x, y]) => ({ x, y }))), fitUVs(geoset, piece, null, null, geoset.TVertices[0], mark));
  assert.throws(() => fitUVs(geoset, piece, null, null, undefined, [[0, 0], [1, 1]]), { message: AREA_ERROR });
  assert.throws(() => fitUVs(geoset, piece, null, null, undefined, null), { message: AREA_ERROR });
  assert.throws(() => fitUVs(geoset, piece, null, null, undefined, [[0, 0], [1, 1], [1, 0], [0, 1]]), { message: AREA_CROSSING_ERROR });
  assert.throws(() => fitUVs(geoset, piece.slice(0, 1), null, null, undefined, mark), { message: WHOLE_TRIANGLE_ERROR });
  assert.throws(() => fitUVs(geoset, [], null, null, undefined, mark), { message: WHOLE_TRIANGLE_ERROR });
});

test('Fit: the wand outline of a painted block is its outer edge', () => {
  const width = 12, height = 10, mask = new Uint8Array(width * height);
  for (let y = 2; y < 8; y++) for (let x = 3; x < 9; x++) mask[y * width + x] = 255;
  mask[4 * width + 5] = 0; // a hole inside is filled
  const outline = cleanArea(maskOutline(mask, width, height));
  let twice = 0; for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) twice += outline[j][0] * outline[i][1] - outline[i][0] * outline[j][1];
  assert.equal(Math.abs(twice) / 2, 36);
  assert.equal(maskOutline(new Uint8Array(width * height), width, height), null);
});
