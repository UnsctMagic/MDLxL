// Builds src/sd-knowledge-data.js, SD Brain's knowledge pack, from the SD research
// volume (PR #302, D:/Codex/sd-research). Only directly reviewed evidence goes in:
// texture regions with reviewed labels, directly annotated construction families,
// category norms, faction profiles, painting observations and the study chapters.
// Candidates, transfers and pending labels stay out. No texture pixels or mesh
// geometry are written; regions are UV rectangles on game texture paths.
//
//   node scripts/sd-knowledge/build-pack.mjs [--research D:/Codex/sd-research] [--textures <casc-texture-index.json>]
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2), arg = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const research = arg('--research', 'D:/Codex/sd-research');
const textureIndex = arg('--textures', 'D:/Codex/mdlxl-sd-rulebook-20261024/work/casc-texture-index.json');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const study = path.join(research, 'study'), data = path.join(study, 'data');
const read = name => JSON.parse(fs.readFileSync(path.join(data, name), 'utf8'));
const round = (v, d = 4) => Math.round(v * 10 ** d) / 10 ** d;
const key = p => String(p || '').replaceAll('/', '\\').toLowerCase().replace(/\.(blp|dds|tga)$/, '');

// Game texture paths: anything the installed game ships. Custom LowPolyWorks paint stays out.
const nativeTextures = new Set(JSON.parse(fs.readFileSync(textureIndex, 'utf8')).names.map(n => key(n.slice(n.lastIndexOf(':') + 1))));
const native = p => nativeTextures.has(key(p));

// Model names and the owner's (UnsanctionedMagic) models.
const lpwModels = read('lpw-models.json');
const lpwName = new Map(lpwModels.map(m => [m.id, m.name]));
const owner = new Set(lpwModels.filter(m => (m.authors || []).some(a => /unsanct/i.test(a.name))).map(m => m.id));
const nativeName = p => path.basename(String(p || '').replaceAll('\\', '/'), '.mdx');

// Region mask → largest axis-aligned rectangle fully inside the real UV islands.
const GRID = 128;
function innerRect(triangles, flags) {
  const mask = new Uint8Array(GRID * GRID);
  for (let t of triangles) {
    // Tiled UVs: move a triangle into the unit square when its texture repeats on that axis.
    const us = [t[0], t[2], t[4]], vs = [t[1], t[3], t[5]];
    const du = flags & 1 ? Math.floor(Math.min(...us)) : 0, dv = flags & 2 ? Math.floor(Math.min(...vs)) : 0;
    t = [t[0] - du, t[1] - dv, t[2] - du, t[3] - dv, t[4] - du, t[5] - dv];
    const [ax, ay, bx, by, cx, cy] = t.map(v => v * GRID), det = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
    if (Math.abs(det) < 1e-9) continue;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(GRID - 1, Math.ceil(Math.max(ax, bx, cx)));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), y1 = Math.min(GRID - 1, Math.ceil(Math.max(ay, by, cy)));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      // A cell counts only when its whole square is painted: test its four corners.
      const inside = [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]].every(([px, py]) => {
        const l1 = ((bx - px) * (cy - py) - (cx - px) * (by - py)) / det, l2 = ((cx - px) * (ay - py) - (ax - px) * (cy - py)) / det;
        return l1 >= -1e-6 && l2 >= -1e-6 && 1 - l1 - l2 >= -1e-6;
      });
      if (inside) mask[y * GRID + x] = 1;
    }
  }
  // Cells covered by the union of several triangles: mark cells whose centre is inside any triangle
  // and whose neighbours agree, so seams between triangles do not split the rectangle.
  const centre = new Uint8Array(GRID * GRID);
  for (let t of triangles) {
    const us = [t[0], t[2], t[4]], vs = [t[1], t[3], t[5]];
    const du = flags & 1 ? Math.floor(Math.min(...us)) : 0, dv = flags & 2 ? Math.floor(Math.min(...vs)) : 0;
    t = [t[0] - du, t[1] - dv, t[2] - du, t[3] - dv, t[4] - du, t[5] - dv];
    const [ax, ay, bx, by, cx, cy] = t.map(v => v * GRID), det = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
    if (Math.abs(det) < 1e-9) continue;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(GRID - 1, Math.ceil(Math.max(ax, bx, cx)));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), y1 = Math.min(GRID - 1, Math.ceil(Math.max(ay, by, cy)));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5, l1 = ((bx - px) * (cy - py) - (cx - px) * (by - py)) / det, l2 = ((cx - px) * (ay - py) - (ax - px) * (cy - py)) / det;
      if (l1 >= 0 && l2 >= 0 && 1 - l1 - l2 >= 0) centre[y * GRID + x] = 1;
    }
  }
  const solid = new Uint8Array(GRID * GRID);
  for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) {
    const i = y * GRID + x;
    if (mask[i]) { solid[i] = 1; continue; }
    if (!centre[i]) continue;
    const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => { const X = x + dx, Y = y + dy; return X >= 0 && Y >= 0 && X < GRID && Y < GRID && centre[Y * GRID + X]; }).length;
    if (n === 4) solid[i] = 1;
  }
  // Largest rectangle of solid cells (histogram method).
  const heights = new Array(GRID).fill(0); let best = { area: 0 };
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) heights[x] = solid[y * GRID + x] ? heights[x] + 1 : 0;
    const stack = [];
    for (let x = 0; x <= GRID; x++) {
      const h = x < GRID ? heights[x] : 0;
      while (stack.length && heights[stack.at(-1)] >= h) {
        const top = stack.pop(), height = heights[top], left = stack.length ? stack.at(-1) + 1 : 0, area = height * (x - left);
        if (area > best.area) best = { area, x0: left, x1: x, y0: y - height + 1, y1: y + 1 };
      }
      stack.push(x);
    }
  }
  return best.area ? [best.x0 / GRID, best.y0 / GRID, best.x1 / GRID, best.y1 / GRID] : null;
}

// --- Texture regions with reviewed labels -------------------------------------------------
// Texture sizes: from the owner sheet inventory and the native-resolution pixel measurements.
const sizes = new Map();
for (const s of read('lpw-owner-material-sheets.json')) if (s.width && s.height) sizes.set(key(s.texturePath), [s.width, s.height]);
for (const r of read('lpw-region-pixel-measurements.json')) if (r.dimensions) sizes.set(key(r.texturePath), r.dimensions);
const pixels = new Map(read('lpw-region-pixel-measurements.json').map(r => [r.componentId + '|' + key(r.texturePath), r]));
const reuse = new Map(read('lpw-reuse-owner-parts.json').map(r => [r.componentId + '|' + key(r.texturePath), r]));
const db = new DatabaseSync(path.join(research, 'data/uv-library.sqlite'), { readOnly: true });
const regions = [], seen = new Set();
let skippedCustom = 0, skippedNoRect = 0;
for (const row of db.prepare("select payload from regions where label is not null and label != '' order by id").all()) {
  const r = JSON.parse(row.payload);
  if (!native(r.texturePath)) { skippedCustom++; continue; }
  const tris = typeof r.uvTriangles === 'string' ? JSON.parse(r.uvTriangles) : r.uvTriangles;
  const inner = innerRect(tris || [], r.textureFlags || 0);
  if (!inner) { skippedNoRect++; continue; }
  const lpw = r.source === 'lowpolyworks', px = pixels.get(r.partId + '|' + key(r.texturePath)), own = reuse.get(r.partId + '|' + key(r.texturePath));
  const team = (r.materialLayers || []).some(l => (l.textureSlots || []).some(s => s.replaceableId === 1));
  const colour = r.authoredColour || own?.authoredColour, tint = colour?.tintEnabled && colour.sampleRgb && colour.sampleRgb.some(v => Math.abs(v - 1) > 0.02) ? colour.sampleRgb.map(v => round(v, 3)) : null;
  const region = {
    sheet: r.texturePath,
    label: String(r.label).trim(),
    tags: (r.materialTags || []).map(String),
    from: lpw ? (owner.has(r.modelId) ? 'owner' : 'lowpolyworks') : 'blizzard',
    model: lpw ? lpwName.get(r.modelId) || r.modelId : nativeName(r.modelPath),
    part: r.partId,
    tris: r.triangles ?? r.meshTriangles ?? null,
    uv: inner.map(v => round(v)),
    bounds: (r.uvBounds || []).map(v => round(v)),
    cover: round(px?.atlasPixelFraction ?? r.sampledCoverage64 ?? 0, 4),
    ...(sizes.has(key(r.texturePath)) ? { size: sizes.get(key(r.texturePath)) } : {}),
  };
  if (tint) region.tint = tint;
  if (team) region.team = true;
  if (px && px.alphaBelow128Fraction > 0.05) region.alpha = round(px.alphaBelow128Fraction, 3);
  if (r.textureFlags) region.wrap = r.textureFlags;
  const id = [key(region.sheet), region.label.toLowerCase(), region.uv.join(',')].join('|');
  if (seen.has(id)) continue;
  seen.add(id); regions.push(region);
}

// --- Whole sheets the owner draws from --------------------------------------------------------
const sheets = read('lpw-owner-material-sheets.json').filter(s => native(s.texturePath)).map(s => ({
  sheet: s.texturePath, size: [s.width, s.height], contents: s.observedContents || [],
  models: [...new Set((s.sourceModels || []).map(id => lpwName.get(id) || id))],
}));

// --- Directly annotated construction families -------------------------------------------------
const corners = m => (m.crossSections || []).map(c => c.polygonCorners);
const families = read('part-families.json').map(f => {
  const direct = f.members.filter(m => m.semanticStatus === 'direct visual annotation' && m.source !== 'hive');
  const compact = m => ({ model: m.modelName || lpwName.get(m.modelId) || m.modelId, from: m.source === 'blizzard' ? 'blizzard' : owner.has(m.modelId) ? 'owner' : 'lowpolyworks', label: m.label, tris: m.triangles, positions: m.distinctPositions, shape: m.shapeClass, sections: corners(m), materials: m.materials || [], textures: m.textures || [] });
  const blizzard = direct.filter(m => m.source === 'blizzard').map(compact);
  // Many owner members repeat a construction; keep a spread across their triangle counts.
  const lpw = direct.filter(m => m.source !== 'blizzard').sort((a, b) => a.triangles - b.triangles);
  const step = Math.max(1, lpw.length / 24), spread = [];
  for (let i = 0; i < lpw.length && spread.length < 24; i += step) spread.push(compact(lpw[Math.floor(i)]));
  return { family: f.family, count: direct.length, models: f.modelCount, members: [...blizzard, ...spread] };
}).filter(f => f.members.length);

// --- Category norms ----------------------------------------------------------------------------
const norms = read('category-norms.json');
const pick = s => s && { p10: s.p10, median: s.median, p90: s.p90 };
const categories = norms.groups.filter(g => g.count >= 3).map(g => ({
  group: g.group, source: g.source, category: g.category, count: g.count,
  bodyTriangles: pick(g.metrics.sampleBodyTrianglesLod0), fileTriangles: pick(g.metrics.wholeFileTriangles),
  sheets: pick(g.metrics.diffuseSheets), kib: g.metrics.bytes && { p10: round(g.metrics.bytes.p10 / 1024, 1), median: round(g.metrics.bytes.median / 1024, 1), p90: round(g.metrics.bytes.p90 / 1024, 1) },
  heightFootman: pick(g.metrics.rawBodyHeightFootman), bones: pick(g.metrics.bones), geosets: pick(g.metrics.geosets),
  share: Object.fromEntries(['teamColor', 'heroGlow', 'birth', 'death', 'decay', 'withAttachments'].map(k => [k, round((g[k] || 0) / g.count, 2)])),
}));

// --- Faction profiles -----------------------------------------------------------------------------
const wc = read('warcraft-faction-profiles.json');
const factions = [
  ...wc.profiles.map(p => ({ id: p.id, title: p.title, kind: 'warcraft', models: p.models.map(m => ({ name: nativeName(m.path) || m.name, bodyTriangles: m.bodyTriangles, fileTriangles: m.wholeFileTriangles, heightFootman: m.rawHeightFootman, sheets: m.texturePaths })), observations: (p.observations || []).map(String) })),
  ...read('lpw-faction-profiles.json').map(p => ({ id: 'lpw-' + p.army, title: p.title, kind: 'lowpolyworks', observations: p.observations.map(o => `${o.finding} (${(o.sourceModels || []).map(id => lpwName.get(id) || id).join(', ')})`), limits: p.limits })),
];

// --- Painting observations of the custom LowPolyWorks sheets ----------------------------------------
const painting = read('lpw-custom-paint-observations.json').map(p => ({ sheet: p.texturePath, size: p.dimensions, models: (p.modelIds || []).map(id => lpwName.get(id) || id), tags: p.visualMaterialTags || [], observation: p.observation }));

// --- Study chapters, without pictures and local links --------------------------------------------------
const chapters = [];
// Picture sections and capture paths only make sense beside the local research folder.
const clean = text => text
  .split(/\n(?=## )/).filter(section => !/^## [^\n]*(picture|traceable sources)/i.test(section)).join('\n')
  .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
  .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  .replace(/D:\/Codex\/sd-research\/[^\s|)]*/g, '')
  .split('\n').filter(line => !/^(Source records:|- `[^`]+` — four angles|Exact component measurements|Exact values and complete)/.test(line.trim()) && !/(captures|pictures)\/|\.(webp|jpg|png)\b/.test(line))
  .join('\n').replace(/\| \[?view\]? \|/g, '|').replace(/\n{3,}/g, '\n\n').trim();
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.md') ? [path.join(dir, e.name)] : []);
for (const file of [path.join(study, 'FINDINGS.md'), ...walk(path.join(study, 'subjects')).sort()]) {
  const text = clean(fs.readFileSync(file, 'utf8').replace(/^﻿/, '')), title = (text.match(/^#\s+(.+)$/m) || [, path.basename(file, '.md')])[1].trim();
  const id = path.relative(study, file).replaceAll('\\', '/').replace(/^subjects\//, '').replace(/\.md$/, '');
  if (/(^|\/)index$/.test(id) || text.length < 400) continue;
  chapters.push({ id: id === 'FINDINGS' ? 'findings' : id, title, text });
}

const coverage = read('checkpoint-coverage.json');
const pack = {
  schema: 1,
  source: 'SD research volume 1 (PR #302, branch codex/sd-research); directly reviewed evidence only',
  footmanHeight: norms.footmanReference?.height ?? 98.258,
  coverage,
  regions, sheets, families, categories, factions, painting, chapters,
};
const out = path.join(root, 'src/sd-knowledge-data.js');
fs.writeFileSync(out, `// Generated by scripts/sd-knowledge/build-pack.mjs from the SD research volume. Do not edit by hand.\nexport default ${JSON.stringify(pack)};\n`);
console.log(JSON.stringify({ regions: regions.length, skippedCustom, skippedNoRect, sheets: sheets.length, families: families.length, familyMembers: families.reduce((n, f) => n + f.members.length, 0), categories: categories.length, factions: factions.length, painting: painting.length, chapters: chapters.length, kib: Math.round(fs.statSync(out).size / 1024) }));
