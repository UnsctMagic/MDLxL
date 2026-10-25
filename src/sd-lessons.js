/**
 * SD Brain's lessons: the owner's corrections of real results, as rules the art director and
 * the builder read on every request, and as checks the review runs by itself. A result that
 * fails a lesson check cannot pass review. Lessons the owner adds in the AI chat are saved in
 * the profile (electron/ai-service.cjs) and read the same way.
 *
 *   sdLessonChecks({ before, model, request, previewed, references }) → [{ name, passed, actual, expected }]
 */
import { partModels, partsOf, guessCategory } from './sd-knowledge.js';
import { pieces } from './sd-kitbash.js';

export { SD_LESSONS, lessonsText } from './sd-lesson-rules.js';

// ---- checks ---------------------------------------------------------------------------------
const lower = s => String(s || '').toLowerCase();
const baseName = s => lower(s).replaceAll('/', '\\').split('\\').pop().replace(/\.(blp|dds|tga|png)$/, '');
const diffuse = (model, g) => {
  const layers = model.Materials?.[g.MaterialID]?.Layers || [];
  for (let i = layers.length - 1; i >= 0; i--) { const t = typeof layers[i].TextureID === 'number' ? model.Textures?.[layers[i].TextureID] : null; if (t?.Image && !t.ReplaceableId) return lower(t.Image); }
  return '';
};
const hidden = (model, gi) => (model.GeosetAnims || []).some(a => a.GeosetId === gi && typeof a.Alpha === 'number' && a.Alpha === 0);
const nodeNames = model => { const m = new Map(); for (const n of [...(model.Bones || []), ...(model.Helpers || [])]) m.set(n.ObjectId, n.Name); return m; };
const vertexBones = (model, g, v, names) => (g.Groups?.[g.VertexGroup?.[v]] || []).map(id => names.get(id)).filter(Boolean);
const uvSig = (model, g, f) => {
  const U = g.TVertices?.[0], F = g.Faces;
  return diffuse(model, g) + '|' + [0, 1, 2].map(k => { const v = F[f * 3 + k]; return U ? `${U[v * 2].toFixed(3)},${U[v * 2 + 1].toFixed(3)}` : ''; }).sort().join(';');
};
const fullSig = (model, g, f) => {
  const V = g.Vertices, F = g.Faces;
  return uvSig(model, g, f) + '|' + [0, 1, 2].map(k => { const v = F[f * 3 + k]; return [V[v * 3], V[v * 3 + 1], V[v * 3 + 2]].map(x => x.toFixed(1)).join(','); }).sort().join(';');
};
function triangles(model, fn, { skipHidden = true } = {}) {
  const out = [];
  (model?.Geosets || []).forEach((g, gi) => { if (skipHidden && hidden(model, gi)) return; for (let f = 0; f < (g.Faces?.length || 0) / 3; f++) out.push(fn(model, g, f, gi)); });
  return out;
}
const bbox = points => {
  if (!points.length) return null;
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const p of points) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], p[a]); hi[a] = Math.max(hi[a], p[a]); }
  return { lo, hi, size: hi.map((h, a) => h - lo[a]) };
};

/** Which listed Blizzard model a document still is: every listed piece in place with its triangle count. */
export function identifyBase(model) {
  if (!model?.Geosets?.length) return null;
  const cache = new Map(), piecesOf = gi => cache.get(gi) || cache.set(gi, pieces(model, { geoset: gi, order: 'file', withVertices: true, limit: Infinity })).get(gi);
  // Several models can match a few small pieces (the Captain's three parts sit on the Footman too):
  // the model with the most listed pieces in place wins.
  let best = null;
  for (const m of partModels()) {
    const parts = partsOf(m.id);
    if (parts.length < 3 || (best && parts.length <= best.parts.length)) continue;
    if (parts.every(p => p.geoset < model.Geosets.length && piecesOf(p.geoset).find(x => x.piece === p.piece)?.triangles === p.triangles)) best = { id: m.id, name: m.name, parts, piecesOf };
  }
  return best;
}
// A loaded reference: by its pieces, or by its file name when its listed pieces are in place.
function referenceBase(ref) {
  const found = identifyBase(ref.model);
  if (found) return found;
  const file = baseName(ref.name).replace(/\.mdx?$/, '');
  const m = partModels().find(x => baseName(x.path).replace(/\.mdx?$/, '') === file);
  if (!m) return null;
  const cache = new Map(), piecesOf = gi => cache.get(gi) || cache.set(gi, pieces(ref.model, { geoset: gi, order: 'file', withVertices: true, limit: Infinity })).get(gi);
  const parts = partsOf(m.id).filter(p => p.geoset < (ref.model.Geosets?.length || 0) && piecesOf(p.geoset).find(x => x.piece === p.piece)?.triangles === p.triangles);
  return parts.length ? { id: m.id, name: m.name, parts, piecesOf } : null;
}
const FACE = /\b(face|eye|eyes|moustache|mustache|beard|jaw|mouth|nose)\b/i, HELM = /\b(helm|helmet|plume|crest|hat|hood|crown|visor|horn|horns)\b/i;

function headParts(base) {
  const face = base.parts.filter(p => (p.kind === 'head' || FACE.test(p.label)) && !HELM.test(p.label));
  const head = base.parts.filter(p => p.kind === 'head' || p.kind === 'helmet' || FACE.test(p.label) || HELM.test(p.label));
  return { face, head };
}
function pieceTriangles(model, base, part) {
  const piece = base.piecesOf(part.geoset).find(x => x.piece === part.piece);
  if (!piece) return [];
  const g = model.Geosets[part.geoset], set = new Set(piece.vertices), out = [];
  for (let f = 0; f < g.Faces.length / 3; f++) if ([0, 1, 2].every(k => set.has(g.Faces[f * 3 + k]))) out.push({ g, f });
  return out;
}

// Share of one model's face triangles (by paint and UVs, wherever they moved) present in the result.
function faceKept(source, base, have) {
  const { face } = headParts(base), left = new Map(have);
  const wanted = face.flatMap(p => pieceTriangles(source, base, p)).map(({ g, f }) => uvSig(source, g, f));
  let kept = 0;
  for (const s of wanted) if (left.get(s) > 0) { kept++; left.set(s, left.get(s) - 1); }
  return { face, total: wanted.length, share: wanted.length ? kept / wanted.length : 0 };
}
// Ray from p toward +X (the unit's front) against triangle a, b, c (Möller–Trumbore).
function hitsFront(p, a, b, c) {
  const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const h = [0, -e2[2], e2[1]], det = e1[0] * h[0] + e1[1] * h[1] + e1[2] * h[2];
  if (Math.abs(det) < 1e-9) return false;
  const s = [p[0] - a[0], p[1] - a[1], p[2] - a[2]], u = (s[0] * h[0] + s[1] * h[1] + s[2] * h[2]) / det;
  if (u < 0 || u > 1) return false;
  const q = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]], v = q[0] / det;
  if (v < 0 || u + v > 1) return false;
  return (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) / det > 0.3;
}
const corners = (m, g, f) => [0, 1, 2].map(k => { const v = g.Faces[f * 3 + k]; return [g.Vertices[v * 3], g.Vertices[v * 3 + 1], g.Vertices[v * 3 + 2]]; });
// Share of the face, seen from the front, that other pieces cover: in the starting model (its own
// visor already hides some of it) and in the result.
function faceCovered(before, model, base) {
  const { face } = headParts(base), faceTris = face.flatMap(p => pieceTriangles(before, base, p));
  const faceSigs = new Set(faceTris.map(({ g, f }) => uvSig(before, g, f)));
  const points = faceTris.flatMap(({ g, f }) => {
    const [a, b, c] = corners(before, g, f), n = [[1 / 3, 1 / 3], [0.6, 0.2], [0.2, 0.6], [0.2, 0.2]];
    return n.map(([u, v]) => [0, 1, 2].map(i => a[i] + (b[i] - a[i]) * u + (c[i] - a[i]) * v));
  });
  const covering = m => {
    const blockers = [];
    (m.Geosets || []).forEach((g, gi) => { if (hidden(m, gi)) return; for (let f = 0; f < g.Faces.length / 3; f++) if (!faceSigs.has(uvSig(m, g, f))) blockers.push(corners(m, g, f)); });
    return points.map(p => blockers.some(([a, b, c]) => hitsFront(p, a, b, c)));
  };
  // What matters is the part of the face that showed before: the eyes, nose and moustache in the visor's opening.
  const was = covering(before), now = covering(model), shown = was.map(c => !c), count = shown.filter(Boolean).length;
  return { shown: points.length ? count / points.length : 0, hidden: count ? now.filter((c, i) => c && shown[i]).length / count : 0 };
}
function faceCheck(before, model, base, references) {
  const own = faceKept(before, base, new Map());
  if (!own.face.length) return null;
  const have = new Map();
  for (const s of triangles(model, uvSig)) have.set(s, (have.get(s) || 0) + 1);
  const kept = faceKept(before, base, have);
  // Another unit's whole face in its place (Thrall's head on a Grunt) also keeps a face; the same
  // unit loaded again is not another face.
  const donor = kept.share >= 0.8 ? null : references.map(r => ({ r, b: referenceBase(r) })).filter(x => x.b && x.b.id !== base.id).map(x => ({ name: x.b.name, ...faceKept(x.r.model, x.b, have) })).find(x => x.total && x.share >= 0.8);
  const seen = kept.share >= 0.8 ? faceCovered(before, model, base) : { shown: 0, hidden: 0 };
  return {
    name: `Lesson keep-face: the ${base.name}'s face (${own.face.map(p => p.label).join(', ')}) is still there and visible from the front, or another unit's whole face replaced it`,
    passed: (kept.share >= 0.8 && seen.hidden <= 0.25) || !!donor,
    actual: donor
      ? `face replaced by the ${donor.name}'s face`
      : `${Math.round(kept.share * 100)}% of its ${kept.total} face triangles remain; of the face that showed before (${Math.round(seen.shown * 100)}%), ${Math.round(seen.hidden * 100)}% is now hidden`,
    expected: 'at least 80% kept and at most 25% of the visible face newly hidden: fit gear around the face, never remove or cover it',
  };
}

function headSizeCheck(before, model, base, references = []) {
  const donors = references.map(r => ({ model: r.model, base: referenceBase(r) })).filter(d => d.base && d.model?.Geosets);
  let boneSet, reference;
  if (base) {
    const { head } = headParts(base);
    boneSet = new Set(head.map(p => p.bone).filter(Boolean));
    reference = bbox(head.flatMap(p => base.piecesOf(p.geoset).find(x => x.piece === p.piece)?.vertices.map(v => { const V = before.Geosets[p.geoset].Vertices; return [V[v * 3], V[v * 3 + 1], V[v * 3 + 2]]; }) || []));
  } else {
    boneSet = new Set([...nodeNames(before).values()].filter(n => /head/i.test(n)));
  }
  if (!boneSet.size) return null;
  const bound = m => { const names = nodeNames(m), pts = []; (m.Geosets || []).forEach((g, gi) => { if (hidden(m, gi)) return; for (let v = 0; v < g.Vertices.length / 3; v++) if (vertexBones(m, g, v, names).some(n => boneSet.has(n))) pts.push([g.Vertices[v * 3], g.Vertices[v * 3 + 1], g.Vertices[v * 3 + 2]]); }); return bbox(pts); };
  reference ||= bound(before);
  const after = bound(model);
  if (!reference || !after) return null;
  const ratio = after.size.map((s, a) => s / Math.max(reference.size[a], 1e-3)), limit = [1.6, 1.6, 2];
  // Gear taken whole from a unit keeps that unit's own proportions (the Captain's wings are twice his
  // helm's width): allow up to a tenth beyond the widest loaded unit's own head gear.
  for (const r of donors) {
    const own = r.base && headParts(r.base).head;
    if (!own?.length) continue;
    const ownBones = new Set(own.map(p => p.bone).filter(Boolean)), names = nodeNames(r.model), pts = [];
    (r.model.Geosets || []).forEach((g, gi) => { if (hidden(r.model, gi)) return; for (let v = 0; v < g.Vertices.length / 3; v++) if (vertexBones(r.model, g, v, names).some(n => ownBones.has(n))) pts.push([g.Vertices[v * 3], g.Vertices[v * 3 + 1], g.Vertices[v * 3 + 2]]); });
    const gear = bbox(pts), head = bbox(own.flatMap(p => r.base.piecesOf(p.geoset).find(x => x.piece === p.piece)?.vertices.map(v => { const V = r.model.Geosets[p.geoset].Vertices; return [V[v * 3], V[v * 3 + 1], V[v * 3 + 2]]; }) || []));
    if (gear && head) for (let a = 0; a < 3; a++) limit[a] = Math.max(limit[a], (gear.size[a] / Math.max(head.size[a], 1e-3)) * 1.1);
  }
  const worst = ratio.map((r, a) => r / limit[a]), axis = worst.indexOf(Math.max(...worst));
  return { name: 'Lesson head-gear-size: head gear stays close to the head\'s outline from every side', passed: worst.every(w => w <= 1), actual: `head gear is ${ratio.map(r => r.toFixed(2)).join(' × ')} the original head (front-back × side × height)`, expected: `at most ${limit.map(l => l.toFixed(1)).join(' × ')}${worst[axis] > 1 ? `; ${['front to back', 'side to side', 'in height'][axis]} is too large` : ''}` };
}

function transformCheck(before, model, references, request) {
  const kitbash = /\bkitbash/i.test(request) || ['unit', 'hero'].includes(guessCategory(request));
  if (!kitbash) return null;
  const result = triangles(model, fullSig);
  if (!result.length) return null;
  const candidates = [{ name: 'the starting model', model: before }, ...references].filter(r => r.model?.Geosets?.length);
  let best = null;
  for (const r of candidates) {
    const base = triangles(r.model, fullSig), baseSet = new Set(base), have = new Set(result);
    const survived = base.filter(s => have.has(s)).length, fromBase = result.filter(s => baseSet.has(s)).length;
    if (!best || fromBase > best.fromBase) best = { name: r.name, survived: survived / base.length, fromBase };
  }
  if (!best || !best.fromBase) return null;
  return { name: 'Lesson real-kitbash: the base is transformed, not a Blizzard unit with a few parts added', passed: best.survived < 0.7, actual: `${Math.round(best.survived * 100)}% of ${best.name} is still untouched (same shape, place and paint)`, expected: 'under 70%: replace or rebuild the gear, repaint body pieces, reshape the silhouette' };
}

const WEAPON_BONE = /(sword|axe|blade|weapon|hammer|mace|spear|lance|hilt|haft|club|staff|glaive|scythe|halberd|polearm|dagger|cleaver)/i;
function weaponTeamCheck(before, model, request) {
  if (/team ?col/i.test(request)) return null;
  const names = nodeNames(model), offending = [];
  (model.Geosets || []).forEach((g, gi) => {
    if (gi < (before?.Geosets?.length || 0) || hidden(model, gi)) return;
    const team = (model.Materials?.[g.MaterialID]?.Layers || []).some(l => typeof l.TextureID === 'number' && [1, 2].includes(model.Textures?.[l.TextureID]?.ReplaceableId));
    if (!team) return;
    // A weapon geoset: most of its vertices hang on weapon-named bones (a body with a club bone is not one).
    const count = g.Vertices.length / 3, bones = new Set();
    let onWeapon = 0;
    for (let v = 0; v < count; v++) { const b = vertexBones(model, g, v, names); if (b.some(n => WEAPON_BONE.test(n))) { onWeapon++; b.forEach(n => bones.add(n)); } }
    if (count && onWeapon / count >= 0.6) offending.push(`geoset ${gi} (${[...bones].filter(n => WEAPON_BONE.test(n)).join(', ')})`);
  });
  return { name: 'Lesson no-weapon-team: no team colour on new weapon pieces', passed: !offending.length, actual: offending.length ? `team colour on ${offending.join('; ')}` : 'none', expected: 'none unless the request asks for team colour' };
}

function previewCheck(before, model, previewed, references) {
  // A donor part or base keeps its own skin; only newly chosen paint needs a preview.
  const old = new Set([before, ...references.map(r => r.model)].flatMap(m => (m?.Textures || []).map(t => lower(t.Image))));
  const seen = new Set((previewed || []).map(p => { const m = /^model#(\d+)$/.exec(p); return baseName(m ? model.Textures?.[+m[1]]?.Image || before?.Textures?.[+m[1]]?.Image : p); }));
  const fresh = (model.Textures || []).filter(t => t.Image && !t.ReplaceableId && !/^mdlxl_forge[\\/]/i.test(t.Image) && !old.has(lower(t.Image)));
  const unseen = fresh.filter(t => !seen.has(baseName(t.Image))).map(t => t.Image);
  return { name: 'Lesson preview-paint: every newly used texture was previewed before use', passed: !unseen.length, actual: unseen.length ? `not previewed: ${unseen.join(', ')}` : `${fresh.length} new texture(s), all previewed`, expected: 'preview each sheet (mdlxl_assets action preview, with uv for the area) and choose by what it shows' };
}

/** The lesson checks for one review: before is the model the task started from, model the result,
 * request the user's words, previewed the textures previewed in this task (paths or model#id),
 * references the other open models [{ name, model }] (loaded bases and donors). */
export function sdLessonChecks({ before, model, request = '', previewed = [], references = [] } = {}) {
  const base = identifyBase(before), checks = [];
  if (base) checks.push(faceCheck(before, model, base, references));
  if (before?.Geosets?.length) checks.push(headSizeCheck(before, model, base, references));
  checks.push(transformCheck(before, model, references, request), weaponTeamCheck(before, model, request), previewCheck(before, model, previewed, references));
  return checks.filter(Boolean);
}
