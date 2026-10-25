/** SD Kitbash: the moves Warcraft modellers make with native models, on the editor's
 * own part, mesh and UV code. Find a part (a piece) in a game model, take it, fit it in
 * place of another part so it inherits that part's bones, add it to a bone, remove a part,
 * reshape a part without touching its UVs (its own paint keeps fitting), repaint a part
 * from a palette area of another sheet, tint it, and get a frame to build new sd-kit
 * shapes onto a part. IDs are zero-based; a selection is { [geosetIndex]: vertexIds }.
 *
 * Recipes (mdlxl_script edits; a game model is loaded first with mdlxl_assets { source: 'game',
 * action: 'search', query } then { action: 'reference', id, signature }, and read as references[id].model):
 *   const bash = await api.module('sd-kitbash'), know = await api.module('sd-knowledge');
 *   const grunt = references[gruntId].model, thrall = references[thrallId].model;
 *   // 1. Base: copy the Grunt into the open model (scope: bash.BASE_SCOPE, spelled out in the call).
 *   bash.adopt(model, grunt);
 *   // 2. Find parts in the box of parts, or list a model's pieces and pick by bone, size and place:
 *   const head = know.findParts('grunt head')[0], tusks = know.partsOf('grunt').filter(p => p.kind === 'horn');
 *   const oldHead = bash.select(model, head, ...tusks);
 *   bash.pieces(thrall, { bone: 'head' });   // [{ geoset, piece, triangles, size, center, bone }]
 *   // 3. Swap: Thrall's head in place of the Grunt's, fitted by the neck joint both share; it follows the Grunt's head bones.
 *   const part = bash.take(thrall, bash.select(thrall, know.findParts('thrall head')[0]));
 *   const newHead = bash.replace(model, oldHead, bash.fit(part, model, oldHead, { from: thrall, bone: 'Bone_Head' }));
 *   // 4. Add a helmet to the new head, reshape it (UVs untouched), repaint it from a looked-at palette area:
 *   const helm = bash.add(model, bash.fit(helmPart, model, newHead.selection, { from: footman, bone: ['Box02', 'Bone_Head'], scale: 1.12, lift: 9 }), { attach: newHead.selection });
 *   bash.reshape(model, helm.selection, { scale: [1.12, 1.22, 0.8], pivot: 'bottom' });
 *   bash.repaint(model, helm.selection, { sheet: 'Textures\\InfernalCannon.blp', uv: [0.487, 0.008, 0.737, 0.168], size: [256, 256] });
 *   // 5. Remove a part: bash.remove(model, selection). Tint: bash.setTint(model, geoset, [r, g, b]).
 *   // 6. New shapes on a part: kit.builder({ frame: bash.anchor(model, sel) }) builds in the part's own frame
 *   //    (+Z along the part from its base end), and b.commit(model, { attach: sel }) binds them to its bones.
 * Check a swap with a capture and with mdlxl_sample over an attack: the new part keeps its distance to the old part's bone.
 */
import { collectPart, commitPart, partRgbSnapshot, transformPart } from './bits-and-parts.js';
import { adaptPasteFormat } from './paste-format.js';
import { deleteVertices, transformVertices } from './editor-commands.js';
import { deleteGeoset, recalculateExtents } from './editor-document.js';
import { detachFaces } from './mesh-tools.js';
import { attachGeosets, boneId, fitIslands } from './sd-kit.js';

const quant = v => Math.round(v * 1e5);

/** The geoset's pieces: faces that share an edge (positions matched to 0.00001 units),
 * in order of their first face, the way the SD research numbered parts (c1 = piece 0). */
function geosetPieces(model, index) {
  const g = model.Geosets?.[index];
  if (!g?.Faces?.length) return [];
  const V = g.Vertices, F = g.Faces, faces = F.length / 3, parent = Int32Array.from({ length: faces }, (_, i) => i);
  const find = i => { while (parent[i] !== i) i = parent[i] = parent[parent[i]]; return i; };
  const key = v => `${quant(V[v * 3])},${quant(V[v * 3 + 1])},${quant(V[v * 3 + 2])}`;
  const keys = Array.from({ length: V.length / 3 }, (_, v) => key(v)), edges = new Map();
  for (let f = 0; f < faces; f++)
    for (let e = 0; e < 3; e++) {
      const a = keys[F[f * 3 + e]], b = keys[F[f * 3 + ((e + 1) % 3)]], k = a < b ? a + '|' + b : b + '|' + a;
      const other = edges.get(k);
      if (other === undefined) edges.set(k, f);
      else { const x = find(f), y = find(other); if (x !== y) parent[Math.max(x, y)] = Math.min(x, y); }
    }
  const groups = new Map();
  for (let f = 0; f < faces; f++) { const r = find(f); (groups.get(r) || groups.set(r, []).get(r)).push(f); }
  return [...groups.values()].sort((a, b) => a[0] - b[0]).map((list, piece) => {
    const ids = [...new Set(list.flatMap(f => [F[f * 3], F[f * 3 + 1], F[f * 3 + 2]]))].sort((a, b) => a - b);
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const v of ids) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], V[v * 3 + a]); hi[a] = Math.max(hi[a], V[v * 3 + a]); }
    const bones = new Map();
    for (const v of ids) {
      const skin = g.SkinWeights?.length ? Array.from(g.SkinWeights.subarray(v * 8, v * 8 + 4)).filter((_, s) => g.SkinWeights[v * 8 + 4 + s] > 0) : null;
      for (const b of skin || g.Groups?.[g.VertexGroup?.[v]] || []) bones.set(b, (bones.get(b) || 0) + 1);
    }
    const boneId = [...bones].sort((a, b) => b[1] - a[1])[0]?.[0];
    const r = n => Math.round(n * 10) / 10;
    return {
      geoset: index, piece, triangles: list.length, vertices: ids,
      center: lo.map((l, a) => r((l + hi[a]) / 2)), size: lo.map((l, a) => r(hi[a] - l)), min: lo.map(r), max: hi.map(r),
      boneId: boneId ?? null, bone: boneId == null ? null : nodeName(model, boneId), bones: [...bones.keys()].map(b => nodeName(model, b)).filter(Boolean),
    };
  });
}
const nodeName = (model, id) => (model.Nodes?.[id] || [...(model.Bones || []), ...(model.Helpers || [])].find(n => n.ObjectId === id))?.Name || null;

/** Every piece of the model (or of one geoset), largest first unless order: 'file'.
 * Filter with bone (part of the dominant bone's name, e.g. 'head', 'hand'), minTriangles,
 * or near: [x, y, z]. Without vertices unless withVertices. */
export function pieces(model, { geoset, bone, minTriangles = 0, near, order = 'size', withVertices = false, limit = 60 } = {}) {
  const indices = geoset == null ? (model.Geosets || []).map((_, i) => i) : [geoset];
  let list = indices.flatMap(i => geosetPieces(model, i)).filter(p => p.triangles >= minTriangles);
  if (bone) { const b = String(bone).toLowerCase(); list = list.filter(p => p.bones.some(n => n.toLowerCase().includes(b))); }
  if (near) list.sort((a, b) => dist(a.center, near) - dist(b.center, near));
  else if (order === 'size') list.sort((a, b) => b.triangles - a.triangles);
  return list.slice(0, limit).map(p => (withVertices ? p : { ...p, vertices: undefined, vertexCount: p.vertices.length }));
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** The vertex selection of one or more parts: box-of-parts entries from sd-knowledge findParts,
 * { geoset, piece } pairs or pieces from pieces(). Checks the triangle count when the entry has
 * one; a renumbered model is matched by triangles and place instead. */
export function select(model, ...entries) {
  const out = {};
  for (const entry of entries.flat()) {
    const list = geosetPieces(model, entry.geoset);
    let p = list[entry.piece];
    if (entry.triangles && p?.triangles !== entry.triangles) {
      const candidates = (model.Geosets || []).flatMap((_, i) => (i === entry.geoset ? list : geosetPieces(model, i))).filter(c => c.triangles === entry.triangles);
      p = entry.center ? candidates.sort((a, b) => dist(a.center, entry.center) - dist(b.center, entry.center))[0] : candidates[0];
    }
    if (!p) throw Error(`No piece ${entry.piece} with ${entry.triangles ?? 'any'} triangles in geoset ${entry.geoset}; list them with pieces(model).`);
    out[p.geoset] = [...new Set([...(out[p.geoset] || []), ...p.vertices])].sort((a, b) => a - b);
  }
  return out;
}

/** Bounds, center and long axis of a selection, in model space. */
export function measure(model, selection) {
  const pts = [];
  for (const [k, ids] of Object.entries(selection)) { const V = model.Geosets[k].Vertices; for (const v of ids) pts.push([V[v * 3], V[v * 3 + 1], V[v * 3 + 2]]); }
  if (!pts.length) throw Error('The selection is empty.');
  const lo = [0, 1, 2].map(a => Math.min(...pts.map(p => p[a]))), hi = [0, 1, 2].map(a => Math.max(...pts.map(p => p[a])));
  return { min: lo, max: hi, center: lo.map((l, a) => (l + hi[a]) / 2), size: lo.map((l, a) => hi[a] - l), points: pts };
}

/** A rigid copy of the selected part of a reference model (bits-and-parts collectPart), bind pose,
 * file space. It brings no animations: its colour and alpha are frozen as shown in the reference's
 * Stand (partRgbSnapshot), and a piece hidden there (an alternate weapon) is made visible. */
export function take(reference, selection) {
  const part = collectPart(reference, selection), stand = (reference.Sequences || []).findIndex(s => /^stand/i.test(s.Name || ''));
  const frozen = partRgbSnapshot(part, stand);
  for (const anim of frozen.GeosetAnims || []) if (!(anim.Alpha > 0.05)) anim.Alpha = 1;
  return frozen;
}

/** A node's pivot (bind position) by bone name or ObjectId. */
export function pivot(model, bone) {
  const id = boneId(model, bone), p = model.PivotPoints?.[id] || [...(model.Bones || []), ...(model.Helpers || [])].find(n => n.ObjectId === id)?.PivotPoint;
  if (!p) throw Error(`Bone ${bone} has no pivot.`);
  return Array.from(p);
}

/** Move (and scale) a taken part onto the selected target part. scale: 'match' fits the target's
 * size (default), 'keep' keeps the part's own size, a number multiplies the match, [x, y, z] sets
 * per-axis factors. lift raises it along Z; offset adds [x, y, z]; rotate turns it (degrees) first.
 * By a joint instead: from (the reference model the part came from) and bone (a bone name both
 * models share, like Bone_Head, or [fromBone, toBone]) put the part's joint on the target's joint,
 * keeping its own size unless scale is a number: right for heads, hands and weapons. */
export function fit(part, model, selection, { scale = 'match', lift = 0, offset = [0, 0, 0], rotate = [0, 0, 0], from: reference, bone } = {}) {
  if (bone != null) {
    if (!reference) throw Error('Fitting by a bone needs from: the reference model the part was taken from.');
    const [a, b] = Array.isArray(bone) ? bone : [bone, bone], p0 = pivot(reference, a), p1 = pivot(model, b), k = typeof scale === 'number' ? scale : 1;
    const turned = rotate.some(Boolean) ? transformPart(part, { rotation: rotate, pivot: p0 }) : part;
    const sized = k !== 1 ? transformPart(turned, { scale: [k, k, k], pivot: p0 }) : turned;
    return transformPart(sized, { translation: [0, 1, 2].map(i => p1[i] - p0[i] + offset[i] + (i === 2 ? lift : 0)) });
  }
  let source = rotate.some(Boolean) ? transformPart(part, { rotation: rotate }) : part;
  const all = Object.fromEntries(source.Geosets.map((g, i) => [i, Array.from({ length: g.Vertices.length / 3 }, (_, v) => v)]));
  const from = measure(source, all), to = measure(model, selection);
  const match = [0, 1, 2].map(a => (from.size[a] > 1e-6 ? to.size[a] / from.size[a] : 1)), uniform = Math.cbrt(match[0] * match[1] * match[2]) || 1;
  const s = scale === 'keep' ? [1, 1, 1] : Array.isArray(scale) ? scale : [0, 1, 2].map(() => uniform * (typeof scale === 'number' ? scale : 1));
  source = transformPart(source, { scale: s, pivot: from.center });
  const moved = measure(source, all);
  return transformPart(source, { translation: [0, 1, 2].map(a => to.center[a] - moved.center[a] + offset[a] + (a === 2 ? lift : 0)) });
}

/** Replace the selected part with a fitted one (bits-and-parts commitPart replacement): its
 * vertices take the bones of the nearest replaced vertices, so it moves with the base's animation. */
export function replace(model, selection, part) {
  const result = commitPart(model, part, { replacement: selection });
  return { ...result, selection: whole(model, result.geosetIndices) };
}

/** Add a part. attach: a selection whose bones it inherits (nearest vertex), or bone: a bone
 * name or ObjectId to bind it to rigidly. Without either it gets the editor's dummy bone. */
export function add(model, part, { attach, bone } = {}) {
  const hadDummy = (model.Bones || []).some(b => b.Name === 'DummyBone');
  const result = commitPart(model, part);
  attachGeosets(model, result.geosetIndices, { attach, bone, keepDummy: hadDummy });
  return { ...result, selection: whole(model, result.geosetIndices) };
}

/** Remove the selected part (its vertices and triangles; empty geosets go too). */
export function remove(model, selection) {
  for (const [k, ids] of Object.entries(selection).sort((a, b) => Number(b[0]) - Number(a[0]))) {
    const index = Number(k), g = model.Geosets[index];
    deleteVertices(g, ids);
    if (!g.Vertices.length || !g.Faces.length) deleteGeoset(model, index);
    else { g.PrimitiveTypes = Uint32Array.of(4); g.PrimitiveCounts = Uint32Array.of(g.Faces.length); }
  }
  recalculateExtents(model);
  return model;
}

/** Reshape the selected part by moving its vertices only: UVs stay, so its own paint still
 * fits (Blizzard's way: reshape, don't rebuild). scale [x, y, z] or a number, rotate degrees,
 * translate, pivot: [x, y, z], 'center' (default), 'bottom' or 'top'. taper narrows (<1) or
 * widens (>1) the part toward its top along Z; bend pushes its top sideways by [x, y]. */
export function reshape(model, selection, { scale = 1, rotate = [0, 0, 0], translate = [0, 0, 0], pivot = 'center', taper = 1, bend = [0, 0] } = {}) {
  const m = measure(model, selection);
  const p = Array.isArray(pivot) ? pivot : [m.center[0], m.center[1], pivot === 'bottom' ? m.min[2] : pivot === 'top' ? m.max[2] : m.center[2]];
  const s = typeof scale === 'number' ? [scale, scale, scale] : scale;
  for (const [k, ids] of Object.entries(selection)) {
    const g = model.Geosets[k];
    if (taper !== 1 || bend[0] || bend[1]) {
      const h = m.size[2] || 1;
      for (const v of ids) {
        const t = (g.Vertices[v * 3 + 2] - m.min[2]) / h, f = 1 + (taper - 1) * t;
        for (const a of [0, 1]) g.Vertices[v * 3 + a] = m.center[a] + (g.Vertices[v * 3 + a] - m.center[a]) * f + bend[a] * t * t;
      }
    }
    transformVertices(g, ids, translate, s, rotate, p);
  }
  recalculateExtents(model);
  return measure(model, selection);
}

/** Recolour the selected part from a palette area of another sheet: its triangles move into their
 * own geoset whose material shows region.sheet, and each of its UV islands is fitted into region.uv
 * (turned to the area's long side, aspect kept) as sd-kit does for native parts. Look at the area
 * first (mdlxl_assets preview with uv). tint [r, g, b] adds a geoset colour. Returns the new geoset. */
export function repaint(model, selection, region, { tint } = {}) {
  const entries = Object.entries(selection).filter(([, ids]) => ids.length);
  if (entries.length !== 1) throw Error('Repaint one geoset at a time: select a part inside a single geoset.');
  const [k, ids] = entries[0];
  let index = Number(k);
  const g = model.Geosets[index], set = new Set(ids);
  // A part that is only some of its geoset moves into a geoset of its own first (mesh-tools detachFaces).
  if (Array.from(g.Faces).some(v => !set.has(v))) index = detachFaces(model, index, ids);
  const target = model.Geosets[index], uv = target.TVertices[0];
  // Islands: vertices joined by shared triangles in UV space.
  const F = target.Faces, n = target.Vertices.length / 3, parent = Int32Array.from({ length: n }, (_, i) => i);
  const find = i => { while (parent[i] !== i) i = parent[i] = parent[parent[i]]; return i; };
  for (let f = 0; f < F.length; f += 3) for (const [a, b] of [[F[f], F[f + 1]], [F[f + 1], F[f + 2]]]) { const x = find(a), y = find(b); if (x !== y) parent[x] = y; }
  const island = Array.from({ length: n }, (_, v) => find(v)), roots = [...new Set(island)];
  const fitted = fitIslands(Array.from({ length: n }, (_, v) => [uv[v * 2], uv[v * 2 + 1]]), island.map(r => roots.indexOf(r)), roots.length, region);
  fitted.forEach(([u, v], i) => { uv[i * 2] = u; uv[i * 2 + 1] = v; });
  const sheet = String(region.sheet).replaceAll('/', '\\'), key = s => String(s).replaceAll('/', '\\').toLowerCase();
  let textureId = model.Textures.findIndex(t => key(t.Image) === key(sheet));
  if (textureId < 0) textureId = model.Textures.push({ Image: sheet, ReplaceableId: 0, Flags: 0 }) - 1;
  // One plain layer of the palette sheet: the part now wears that paint (opaque, or cut out by its alpha).
  const old = model.Materials[target.MaterialID];
  target.MaterialID = model.Materials.push({ PriorityPlane: old?.PriorityPlane || 0, RenderMode: 0, Layers: [{ FilterMode: region.alpha > 0.05 ? 1 : 0, Shading: 0, TextureID: textureId, TVertexAnimId: null, CoordId: 0, Alpha: 1 }] }) - 1;
  if (tint || region.tint) setTint(model, index, tint || region.tint);
  recalculateExtents(model);
  return { geoset: index, selection: whole(model, [index]), textureId, materialId: target.MaterialID };
}

/** Geoset colour (r, g, b from 0 to 1), the way Blizzard and the owner tint one paint many ways. */
export function setTint(model, geoset, rgb) {
  if (!Array.isArray(rgb) || rgb.length !== 3 || rgb.some(v => !Number.isFinite(v) || v < 0 || v > 1)) throw Error('Tint is [r, g, b] from 0 to 1.');
  model.GeosetAnims ||= [];
  let anim = model.GeosetAnims.find(a => a.GeosetId === geoset);
  if (!anim) anim = model.GeosetAnims[model.GeosetAnims.push({ GeosetId: geoset, Alpha: 1, Flags: 0 }) - 1];
  anim.Color = new Float32Array(rgb); anim.Flags = (anim.Flags || 0) | 2;
  if (model.Info) model.Info.NumGeosetAnims = model.GeosetAnims.length;
  return anim;
}

/** A frame on a part for building new sd-kit shapes onto it: origin at the part's base end,
 * axis along its longest side (toward its far end, or toward toward: [x, y, z] when given),
 * side and normal across it, with its length, width and thickness. Pass it to kit.builder({ frame }). */
export function anchor(model, selection, { toward, end = 'base' } = {}) {
  const { points, center } = measure(model, selection);
  const c = points.reduce((s, p) => s.map((v, a) => v + p[a] / points.length), [0, 0, 0]);
  const axes = principalAxes(points.map(p => p.map((v, a) => v - c[a])));
  let axis = axes[0];
  const proj = points.map(p => p.reduce((s, v, a) => s + (v - c[a]) * axis[a], 0));
  let lo = Math.min(...proj), hi = Math.max(...proj);
  // The base is the end nearer the model's middle (a hand-held weapon's hilt is nearer the body), unless told.
  const all = (model.Geosets || []).flatMap(g => Array.from({ length: g.Vertices.length / 3 }, (_, v) => [g.Vertices[v * 3], g.Vertices[v * 3 + 1], g.Vertices[v * 3 + 2]]));
  const mid = [0, 1, 2].map(a => (Math.min(...all.map(p => p[a])) + Math.max(...all.map(p => p[a]))) / 2);
  const towardFar = (toward || [0, 1, 2].map(a => 2 * c[a] - mid[a])).map((v, a) => v - c[a]);
  if (axis.reduce((s, v, a) => s + v * towardFar[a], 0) < 0) { axis = axis.map(v => -v); [lo, hi] = [-hi, -lo]; }
  const origin = c.map((v, a) => v + axis[a] * (end === 'base' ? lo : hi));
  const span = i => { const q = points.map(p => p.reduce((s, v, a) => s + (v - c[a]) * axes[i][a], 0)); return Math.max(...q) - Math.min(...q); };
  const normal = axes[2], side = cross(axis, normal);
  return { origin, axis, side, normal, center, length: hi - lo, width: span(1), thickness: span(2), selection };
}
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function principalAxes(rel) {
  const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const p of rel) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i][j] += p[i] * p[j];
  // Power iteration with deflation: three orthogonal axes, longest first.
  const out = [];
  let M = C.map(r => r.slice());
  for (let k = 0; k < 3; k++) {
    let v = k === 0 ? [1, 0.3, 0.2] : k === 1 ? [0.2, 1, 0.3] : cross(out[0], out[1]);
    if (k < 2) for (let it = 0; it < 64; it++) {
      let w = [0, 1, 2].map(i => M[i][0] * v[0] + M[i][1] * v[1] + M[i][2] * v[2]);
      for (const u of out) { const d = w[0] * u[0] + w[1] * u[1] + w[2] * u[2]; w = w.map((x, i) => x - d * u[i]); }
      const l = Math.hypot(...w) || 1; v = w.map(x => x / l);
    }
    const l = Math.hypot(...v) || 1; v = v.map(x => x / l);
    const lambda = [0, 1, 2].reduce((s, i) => s + v[i] * (M[i][0] * v[0] + M[i][1] * v[1] + M[i][2] * v[2]), 0);
    M = M.map((r, i) => r.map((x, j) => x - lambda * v[i] * v[j]));
    out.push(v);
  }
  return out;
}

export const bones = model => (model.Bones || []).map(n => ({ id: n.ObjectId, name: n.Name, parent: n.Parent ?? -1 }));
export { boneId };

/** The model sections adopt may change: pass this as the scope of that mdlxl_script edit. */
export const BASE_SCOPE = ['/Info', '/Sequences', '/GlobalSequences', '/Textures', '/Materials', '/TextureAnims', '/Geosets', '/GeosetAnims', '/Bones', '/Lights', '/Helpers', '/Attachments', '/PivotPoints', '/ParticleEmitters', '/ParticleEmitters2', '/ParticleEmitterPopcorns', '/RibbonEmitters', '/Cameras', '/EventObjects', '/CollisionShapes', '/FaceFX', '/BindPoses'];

/** Copy a whole game model (or BITZ part) into the open model as the base to kitbash from, in the open
 * model's format (a game file opens as MDX 1800; an SD model stays MDX 800, with classic bindings). */
export function adopt(model, reference) {
  const copy = adaptPasteFormat(structuredClone(reference), model.Version || 800);
  for (const key of Object.keys(model)) if (!(key in copy) && key !== 'Version') delete model[key];
  Object.assign(model, copy, { Version: model.Version || 800 });
  return model;
}

const whole = (model, indices) => Object.fromEntries(indices.map(i => [i, Array.from({ length: model.Geosets[i].Vertices.length / 3 }, (_, v) => v)]));
