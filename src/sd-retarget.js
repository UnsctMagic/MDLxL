/** SD Retarget: give a unit another unit's animations, the way an SD modeller re-keys a Footman
 * with Grom Hellscream's two-handed swing. Pure functions on war3-model JSON models, like the
 * rest of src/. The target keeps its own mesh, rig, sequence slots and every sequence that is not
 * replaced (Death, Decay, Portrait, Spell...); only the chosen sequences get new, sparse keys.
 *
 * How it works. Warcraft III bones have no rest rotation: a vertex is skinned in model space and
 * a bone's keys rotate it about its pivot. Two units' meshes rest differently (arms hang at other
 * angles), so copying keys one to one would point limbs the wrong way. Instead each target bone
 * gets the source bone's WORLD rotation, corrected by a fixed rest offset: limbs (upper/lower arms
 * and legs) are aimed so the target limb points where the source limb points; the body, head,
 * hands and feet copy the source's world turn from their own rest (both rest upright, feet flat).
 * Root and other moving pivots move by the source's displacement scaled by the leg-length ratio;
 * the root is lifted or lowered so the lowest foot contact matches the source. A source that holds
 * its weapon in the other hand is mirrored (left/right swapped, Y reflected). Values are sampled
 * at 30 per second plus the source's key times, then reduced to the fewest linear keys within
 * 0.5 degrees / 0.2 units (Blizzard's own rotation keys are linear too). Tracks keep their
 * interpolation type, so the target's untouched sequences play exactly as before.
 * Timing: an idle keeps the source's pace (its slot takes the source's length; later sequences
 * move along, keys unchanged), an attack keeps the target's length (the game's attack timing), a
 * walk is stretched or shrunk until its planted feet move at the target's old ground speed.
 *
 * Blizzard's two-handers (Paladin, Arthas, Grom Hellscream) hold the weapon with both hands in Attack
 * and Stand Ready and rest it in one hand in plain Stand; findWielders measures exactly that.
 *
 * Recipe (the builder AI; game models are loaded with mdlxl_assets and read as references[id].model):
 *   const rt = await api.module('sd-retarget'), bash = await api.module('sd-kitbash'), know = await api.module('sd-knowledge');
 *   // 1. Pick a source that really holds its weapon with both hands (twoHanded, attack.offHeld, stance):
 *   const ranked = rt.findWielders([{ name: 'paladin', model: paladin }, { name: 'hellscream', model: grom }, { name: 'tauren', model: tauren }]);
 *   // 2. Base: the Footman as MDX 800 without his sword and shield: the box-of-parts pieces plus every small
 *   //    piece on their bones and child bones (shield back, sword glints) and the sword prop shown in Decay ('handle').
 *   bash.adopt(model, footman);
 *   bash.remove(model, rt.heldGear(model, know.partsOf('footman').filter(p => /sword|shield/i.test(p.label)), { extraBones: ['handle'] }));
 *   // 3. Motion: every Stand, Walk and Attack from the closest-named source sequence; a Defend stance from the
 *   //    source's two-handed Stand Ready.
 *   const motion = rt.retargetAnimations(model, grom, { pairs: { 'Stand Defend': 'Stand Ready' } });
 *   // 4. Weapon: Gorehowl, held where Grom holds it, off hand kept on the haft by IK, resting on (not in) the ground.
 *   //    A weapon from another model than the motion source (Gorehowl on the Paladin's swing): { align: true }.
 *   const axe = bash.take(grom, bash.select(grom, ...know.partsOf('hellscream').filter(p => /gorehowl/i.test(p.label))));
 *   const grip = rt.attachTwoHanded(model, axe, motion);   // grip.sequences[i].offHand: units from the haft
 *   // 5. Check the numbers, then look: capture Attack, Walk and Stand frames beside the source.
 *   const checks = rt.measureRetarget(model, grom, motion, { original: footman });   // feet, strays, seams, untouched
 */
import { Matrix4, Quaternion, Vector3 } from 'three';
import { allNodes, sampleGeosetAnimation, sampleNodeMatrices, sampleTrack, skinGeoset } from './animation.js';
import { animXLRig, suggestAnimXLBones } from './anim-xl.js';
import { createNode, deleteNode, recalculateExtents } from './editor-document.js';
import { attachGeosets } from './sd-kit.js';
import { commitPart } from './bits-and-parts.js';
import { pieces as modelPieces } from './sd-kitbash.js';

const I4 = new Matrix4();
const v3 = a => new Vector3(a?.[0] || 0, a?.[1] || 0, a?.[2] || 0);
const mirrorQ = q => new Quaternion(-q.x, q.y, -q.z, q.w);
const mirrorV = v => new Vector3(v.x, -v.y, v.z);
const rotationOf = m => { const p = new Vector3(), q = new Quaternion(), s = new Vector3(); m.decompose(p, q, s); return q.normalize(); };
const angleDeg = (a, b) => (2 * Math.acos(Math.min(1, Math.abs(a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w))) * 180) / Math.PI;
const smoothstep = (a, b, x) => { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
const median = list => { if (!list.length) return NaN; const s = [...list].sort((a, b) => a - b); return s[s.length >> 1]; };
const r1 = n => Math.round(n * 10) / 10, r2 = n => Math.round(n * 100) / 100;
const isGlobal = (track, model) => Number.isInteger(track?.GlobalSeqId) && track.GlobalSeqId >= 0 && model.GlobalSequences?.[track.GlobalSeqId] > 0;
const keysIn = (track, a, b) => (track?.Keys || []).filter(k => k.Frame >= a && k.Frame <= b);

/** The selection of held gear to remove before a weapon swap: the given box-of-parts pieces (sd-knowledge
 * partsOf entries, or any { geoset, piece } list) plus every piece under maxTriangles skinned mostly to
 * their bones, to those bones' child bones (glint cards) or to extraBones (by name). */
export function heldGear(model, parts, { extraBones = [], maxTriangles = 40 } = {}) {
  const ix = nodeIndex(model), all = modelPieces(model, { order: 'file', limit: 100000 });
  const bones = new Set(), names = new Set(extraBones.map(n => String(n).toLowerCase()));
  for (const p of parts) { const hit = all.find(x => x.geoset === p.geoset && x.piece === p.piece) || all.find(x => x.triangles === p.triangles && x.bone === p.bone); if (hit?.boneId != null) bones.add(hit.boneId); }
  for (const id of [...bones]) for (const d of ix.descendants(id)) bones.add(d);
  for (const n of ix.nodes) if (names.has(String(n.Name).toLowerCase())) { bones.add(n.ObjectId); for (const d of ix.descendants(n.ObjectId)) bones.add(d); }
  const out = {};
  for (const p of all) if (bones.has(p.boneId) && p.triangles <= maxTriangles) out[p.geoset] = [...new Set([...(out[p.geoset] || []), ...modelPieces(model, { geoset: p.geoset, order: 'file', withVertices: true, limit: 100000 })[p.piece].vertices])].sort((a, b) => a - b);
  return out;
}

/** Node lookups shared by the helpers below. */
function nodeIndex(model) {
  const nodes = allNodes(model), byId = new Map(nodes.map(n => [n.ObjectId, n])), children = new Map(), depths = new Map();
  for (const n of nodes) { if (!children.has(n.Parent)) children.set(n.Parent, []); children.get(n.Parent).push(n.ObjectId); }
  const depth = id => {
    if (depths.has(id)) return depths.get(id);
    let d = 0; const seen = new Set([id]);
    for (let p = byId.get(id)?.Parent; byId.has(p) && !seen.has(p); p = byId.get(p).Parent) { seen.add(p); d++; }
    depths.set(id, d); return d;
  };
  const order = [...nodes].sort((a, b) => depth(a.ObjectId) - depth(b.ObjectId) || a.ObjectId - b.ObjectId);
  const pivot = id => v3(byId.get(id)?.PivotPoint || model.PivotPoints?.[id]);
  const isAncestor = (a, id) => { const seen = new Set(); for (let p = byId.get(id)?.Parent; byId.has(p) && !seen.has(p); p = byId.get(p).Parent) { if (p === a) return true; seen.add(p); } return false; };
  const descendants = id => { const out = [], stack = [...(children.get(id) || [])]; while (stack.length) { const c = stack.pop(); out.push(c); stack.push(...(children.get(c) || [])); } return out; };
  const attachments = new Set((model.Attachments || []).map(a => a.ObjectId));
  const path = (from, to) => { const out = []; const seen = new Set(); for (let p = byId.get(to)?.Parent; byId.has(p) && p !== from && !seen.has(p); p = byId.get(p).Parent) { seen.add(p); out.unshift(p); } return out; };
  return { nodes, byId, children, order, pivot, depth, isAncestor, descendants, attachments, path };
}

/** Bones that move one vertex: classic matrix groups or HD weights. */
const vertexBones = (g, v) => {
  const skin = g.SkinWeights;
  if (skin?.length >= (v + 1) * 8) return [0, 1, 2, 3].filter(s => skin[v * 8 + 4 + s] > 0).map(s => skin[v * 8 + s]);
  return g.Groups?.[g.VertexGroup?.[v]] || [];
};
const effectGeoset = (model, g) => {
  const layers = model.Materials?.[g.MaterialID]?.Layers || [];
  return !layers.length || layers.every(l => (l.FilterMode || 0) >= 3) || layers.some(l => model.Textures?.[l.TextureID]?.ReplaceableId === 2);
};

/** The unit's weapon: the bone that carries it (by name, AnimXL's heavy bones or a Weapon Ref
 * attachment), its solid triangles (glow cards and billboards left out), the arm side holding it
 * ('L' = +Y, the unit's left; 'R' = -Y) and its long axis in bind space. null without a weapon. */
export function weaponOf(model, ix = nodeIndex(model)) {
  const candidates = new Set();
  try { for (const id of suggestAnimXLBones(model).heavyIds) candidates.add(id); } catch { /* names only */ }
  for (const a of model.Attachments || []) if (/weapon/i.test(a.Name || '') && ix.byId.has(a.Parent)) candidates.add(a.Parent);
  const named = /weapon|sword|axe|hammer|blade|mace|staff|spear|club|glaive|halberd|scythe|tot[eu]m|cleaver|lance|katana|polearm|flail/i;
  for (const n of ix.nodes) if (!ix.attachments.has(n.ObjectId) && named.test(n.Name || '') && !/hand|arm|ref\b/i.test(n.Name || '')) candidates.add(n.ObjectId);
  const top = [...candidates].filter(id => ![...candidates].some(other => other !== id && ix.isAncestor(other, id)));
  const roles = rigRoles(model, ix);
  const stand = Math.max(0, (model.Sequences || []).findIndex(s => /^stand/i.test(s.Name || '')));
  let best = null;
  for (const bone of top) {
    const nodes = new Set([bone, ...ix.descendants(bone)].filter(id => !ix.attachments.has(id) && !((ix.byId.get(id)?.Flags || 0) & 120)));
    // Hands and arms found under a "weapon" bone are not the weapon.
    for (const arm of Object.values(roles.arms)) for (const id of [arm.upper, arm.lower, arm.hand]) nodes.delete(id);
    const triangles = [];
    (model.Geosets || []).forEach((g, gi) => {
      if (effectGeoset(model, g) || !g.Faces?.length) return;
      if (model.Sequences?.[stand] && sampleGeosetAnimation(model, gi, model.Sequences[stand].Interval[0], stand).alpha < 0.1) return;
      const own = v => { const b = vertexBones(g, v); return b.length && b.every(id => nodes.has(id)); };
      for (let f = 0; f < g.Faces.length; f += 3) if (own(g.Faces[f]) && own(g.Faces[f + 1]) && own(g.Faces[f + 2])) triangles.push([gi, g.Faces[f], g.Faces[f + 1], g.Faces[f + 2]]);
    });
    const arm = Object.entries(roles.arms).find(([, a]) => [a.upper, a.lower, a.hand].some(id => id != null && (id === bone || ix.isAncestor(id, bone))));
    // A bone carrying the Weapon Ref is the weapon (the Tauren Chieftain's back totem is not).
    const ref = (model.Attachments || []).some(a => /weapon/i.test(a.Name || '') && (a.Parent === bone || ix.isAncestor(bone, a.Parent)));
    const better = !best || (ref && triangles.length && !best.ref) || ((ref || !best.ref || !best.triangles.length) && triangles.length > best.triangles.length);
    if (better) best = { bone, name: ix.byId.get(bone)?.Name, nodes: [...nodes], triangles, side: arm?.[0] ?? null, ref };
  }
  if (!best) return null;
  // The node most of the weapon is skinned to (its frame is the weapon's frame) and the long axis.
  const count = new Map(), points = [];
  for (const [gi, ...vs] of best.triangles) for (const v of vs) { const g = model.Geosets[gi]; for (const id of vertexBones(g, v)) count.set(id, (count.get(id) || 0) + 1); points.push(v3([g.Vertices[v * 3], g.Vertices[v * 3 + 1], g.Vertices[v * 3 + 2]])); }
  best.frameNode = [...count].sort((a, b) => b[1] - a[1])[0]?.[0] ?? best.bone;
  best.axis = points.length >= 3 ? longAxis(points) : null;
  return best;
}

/** Longest principal axis of points: { center, dir, lo, hi } (segment center + dir * [lo, hi]). */
function longAxis(points) {
  const c = points.reduce((s, p) => s.add(p), new Vector3()).multiplyScalar(1 / points.length);
  const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const p of points) { const d = [p.x - c.x, p.y - c.y, p.z - c.z]; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i][j] += d[i] * d[j]; }
  let v = [1, 0.37, 0.21];
  for (let it = 0; it < 100; it++) { const w = [0, 1, 2].map(i => C[i][0] * v[0] + C[i][1] * v[1] + C[i][2] * v[2]); const l = Math.hypot(...w) || 1; v = w.map(x => x / l); }
  const dir = v3(v), proj = points.map(p => p.clone().sub(c).dot(dir));
  return { center: c, dir, lo: Math.min(...proj), hi: Math.max(...proj) };
}

/** What each bone does in a biped rig: { root, pelvis, spine: [top..bottom], chest, neck: [..], head,
 * clavicle: {L, R}, arms: {L|R: { upper, lower, hand, palm }}, legs: {L|R: { upper, lower, foot, sole }},
 * legLength, armLength }. Built on AnimXL's rig reading (POSE chains), sides from the pivots
 * (+Y is the unit's left), so misnamed bones (the Footman's left hand is "Bone_Hand_R") still work. */
export function rigRoles(model, ix = nodeIndex(model)) {
  const stand = Math.max(0, (model.Sequences || []).findIndex(s => /^stand/i.test(s.Name || '')));
  let rig = { arms: [], legs: [], torso: [], body: null };
  try { rig = animXLRig(model, stand); } catch { /* names only */ }
  const side = id => (ix.pivot(id).y >= 0 ? 'L' : 'R');
  const keyed = c => [c.root, c.middle, c.end].reduce((s, id) => s + (ix.byId.get(id)?.Rotation?.Keys?.length || 0), 0);
  const bySide = chains => { const out = {}; for (const c of chains) { const s = side(c.end); if (!out[s] || keyed(c) > keyed(out[s])) out[s] = c; } return out; };
  const arms = {}, legs = {};
  for (const [s, c] of Object.entries(bySide(rig.arms))) {
    const hand = ix.attachments.has(c.end) ? null : c.end;
    arms[s] = { upper: c.root, lower: c.middle, hand, palm: palmOf(model, ix, c, hand) };
  }
  for (const [s, c] of Object.entries(bySide(rig.legs))) legs[s] = { upper: c.root, lower: c.middle, foot: c.end, sole: soleOf(model, ix, c.end) };
  const common = ids => { ids = ids.filter(id => id != null); if (!ids.length) return null; let at = ix.byId.get(ids[0])?.Parent; while (ix.byId.has(at) && !ids.every(id => ix.isAncestor(at, id))) at = ix.byId.get(at).Parent; return ix.byId.has(at) ? at : null; };
  const pelvis = common(Object.values(legs).map(l => l.upper));
  const chest = common(Object.values(arms).map(a => a.upper));
  let root = pelvis != null && chest != null ? (pelvis === chest || ix.isAncestor(pelvis, chest) ? pelvis : ix.isAncestor(chest, pelvis) ? chest : common([pelvis, chest])) : pelvis ?? chest;
  if (root == null) root = rig.body ?? null;
  const clavicle = {};
  for (const [s, a] of Object.entries(arms)) { const between = chest != null ? ix.path(chest, a.upper) : []; if (between.length) clavicle[s] = between[0]; }
  // Head: the Head role under the chest (POSE / AnimXL reading, then names).
  const headLike = id => /head/i.test(ix.byId.get(id)?.Name || '') && !/ref|hair|pony|helm|plume/i.test(ix.byId.get(id)?.Name || '');
  let head = (rig.torso || []).find(id => headLike(id) && (chest == null || ix.isAncestor(chest, id)));
  if (head == null && chest != null) head = ix.descendants(chest).filter(id => !ix.attachments.has(id) && headLike(id)).sort((a, b) => ix.depth(a) - ix.depth(b))[0];
  const neck = head != null && chest != null ? ix.path(chest, head) : [];
  const spine = chest != null && root != null && chest !== root ? [chest, ...ix.path(root, chest).reverse()] : chest != null ? [chest] : [];
  const length = chain => chain.reduce((s, id, i) => (i ? s + ix.pivot(chain[i - 1]).distanceTo(ix.pivot(id)) : 0), 0);
  const legLength = median(Object.values(legs).map(l => length([l.upper, l.lower, l.foot])));
  const armLength = median(Object.values(arms).map(a => ix.pivot(a.upper).distanceTo(ix.pivot(a.lower)) + ix.pivot(a.lower).distanceTo(a.palm.rest)));
  return { root, pelvis, chest, spine, neck, head: head ?? null, clavicle, arms, legs, legLength, armLength };
}

/** The middle of a hand: its own vertices (a hand bone that carries the fist), else a Hand Ref
 * attachment on that arm, else the end of the arm. { node, rest, vertices? }; world point at a pose
 * from palmAt(). */
function palmOf(model, ix, chain, hand) {
  const weaponish = /weapon|sword|axe|hammer|blade|mace|staff|spear|club|tot[eu]m|shield/i;
  if (hand != null) {
    const own = new Set([hand, ...ix.descendants(hand).filter(id => !weaponish.test(ix.byId.get(id)?.Name || '') && !ix.attachments.has(id))]);
    // Drop descendants that themselves hold a weapon subtree (the Footman's sword hangs below the fist bone).
    for (const id of [...own]) if (ix.descendants(id).some(d => weaponish.test(ix.byId.get(d)?.Name || ''))) { if (id !== hand) for (const d of ix.descendants(id)) own.delete(d); }
    const vertices = [];
    (model.Geosets || []).forEach((g, gi) => { if (effectGeoset(model, g)) return; for (let v = 0; v < g.Vertices.length / 3; v++) { const b = vertexBones(g, v); if (b.length && b.every(id => own.has(id))) vertices.push([gi, v]); } });
    if (vertices.length >= 6) {
      const rest = vertices.reduce((s, [gi, v]) => s.add(v3(model.Geosets[gi].Vertices.subarray(v * 3, v * 3 + 3))), new Vector3()).multiplyScalar(1 / vertices.length);
      // Only a compact fist counts: a hand bone that also moves the forearm or a shield is not a palm.
      const spread = Math.max(...vertices.map(([gi, v]) => v3(model.Geosets[gi].Vertices.subarray(v * 3, v * 3 + 3)).distanceTo(rest)));
      if (spread < 16) return { node: hand, rest, vertices, kind: 'hand mesh' };
    }
  }
  const ref = (model.Attachments || []).find(a => /hand/i.test(a.Name || '') && [chain.middle, hand, chain.end].some(id => id != null && (a.ObjectId === id || a.Parent === id || ix.isAncestor(id, a.Parent))));
  if (ref) return { node: ref.ObjectId, rest: ix.pivot(ref.ObjectId), kind: 'hand ref' };
  return { node: chain.end, rest: ix.pivot(chain.end), kind: 'arm end' };
}
function soleOf(model, ix, foot) {
  const ref = (model.Attachments || []).find(a => /foot/i.test(a.Name || '') && (a.Parent === foot || ix.isAncestor(foot, a.Parent)));
  return ref ? { node: ref.ObjectId, rest: ix.pivot(ref.ObjectId) } : { node: foot, rest: ix.pivot(foot) };
}
function palmAt(model, palm, matrices) {
  if (!palm.vertices) return palm.rest.clone().applyMatrix4(matrices.get(palm.node) || I4);
  const sum = new Vector3(), m = new Matrix4();
  for (const [gi, v] of palm.vertices) {
    const g = model.Geosets[gi], bones = vertexBones(g, v), p = v3(g.Vertices.subarray(v * 3, v * 3 + 3)), acc = new Vector3();
    for (const id of bones) acc.add(p.clone().applyMatrix4(matrices.get(id) || m));
    sum.add(acc.multiplyScalar(1 / Math.max(1, bones.length)));
  }
  return sum.multiplyScalar(1 / palm.vertices.length);
}

/** Closest point on triangle abc to p (Ericson). */
function closestOnTriangle(p, a, b, c) {
  const ab = b.clone().sub(a), ac = c.clone().sub(a), ap = p.clone().sub(a);
  const d1 = ab.dot(ap), d2 = ac.dot(ap); if (d1 <= 0 && d2 <= 0) return a.clone();
  const bp = p.clone().sub(b), d3 = ab.dot(bp), d4 = ac.dot(bp); if (d3 >= 0 && d4 <= d3) return b.clone();
  const vc = d1 * d4 - d3 * d2; if (vc <= 0 && d1 >= 0 && d3 <= 0) return a.clone().add(ab.multiplyScalar(d1 / (d1 - d3)));
  const cp = p.clone().sub(c), d5 = ab.dot(cp), d6 = ac.dot(cp); if (d6 >= 0 && d5 <= d6) return c.clone();
  const vb = d5 * d2 - d1 * d6; if (vb <= 0 && d2 >= 0 && d6 <= 0) return a.clone().add(ac.multiplyScalar(d2 / (d2 - d6)));
  const va = d3 * d6 - d5 * d4; if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) return b.clone().add(c.clone().sub(b).multiplyScalar((d4 - d3) / (d4 - d3 + (d5 - d6))));
  const denom = 1 / (va + vb + vc); return a.clone().add(ab.multiplyScalar(vb * denom)).add(ac.multiplyScalar(vc * denom));
}
/** Distance from a point to the weapon's posed surface (its triangles at these matrices). */
function weaponDistance(model, weapon, matrices, point, skinned = new Map()) {
  let best = Infinity;
  for (const [gi, a, b, c] of weapon.triangles) {
    if (!skinned.has(gi)) skinned.set(gi, skinGeoset(model.Geosets[gi], matrices));
    const P = skinned.get(gi), V = i => new Vector3(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
    best = Math.min(best, closestOnTriangle(point, V(a), V(b), V(c)).distanceTo(point));
  }
  return best;
}
/** Where a world point sits along the weapon's long axis, in the weapon's bind space. */
function gripOnAxis(weapon, matrices, point) {
  const local = point.clone().applyMatrix4((matrices.get(weapon.frameNode) || I4).clone().invert());
  const { center, dir, lo, hi } = weapon.axis, t = Math.max(lo, Math.min(hi, local.clone().sub(center).dot(dir)));
  return center.clone().add(dir.clone().multiplyScalar(t));
}

const frameTimes = (interval, fps = 30) => { const [a, b] = Array.from(interval), out = []; for (let t = a; t < b; t += 1000 / fps) out.push(Math.round(t)); out.push(b); return [...new Set(out)]; };

/** Hand-to-weapon distances through one sequence: per frame the distance of each hand's palm to
 * the posed weapon surface. { frames: [{ t, L, R }], weapon, main, off }. */
export function measureGrip(model, sequenceIndex, { weapon, roles, fps = 30 } = {}) {
  const ix = nodeIndex(model);
  roles ||= rigRoles(model, ix); weapon ||= weaponOf(model, ix);
  if (!weapon?.triangles.length) return null;
  const seq = model.Sequences[sequenceIndex], frames = [];
  for (const t of frameTimes(seq.Interval, fps)) {
    const m = sampleNodeMatrices(model, t, sequenceIndex), skinned = new Map(), row = { t };
    const hidden = new Set(weapon.triangles.map(x => x[0]).filter(gi => sampleGeosetAnimation(model, gi, t, sequenceIndex).alpha < 0.1));
    const visible = { ...weapon, triangles: weapon.triangles.filter(x => !hidden.has(x[0])) };
    for (const [s, arm] of Object.entries(roles.arms)) row[s] = visible.triangles.length ? weaponDistance(model, visible, m, palmAt(model, arm.palm, m), skinned) : Infinity;
    frames.push(row);
  }
  const sides = Object.keys(roles.arms), main = weapon.side || sides.sort((a, b) => median(frames.map(f => f[a])) - median(frames.map(f => f[b])))[0];
  return { frames, weapon, main, off: sides.find(s => s !== main) ?? null };
}

const sequenceKind = name => String(name || '').trim().split(/[\s\-_]+/)[0].toLowerCase();

/** Rank candidate units by how truly they hold their weapon with both hands. models: [{ name, model }].
 * A hand "holds" when its palm is within `within` units of the weapon surface (default: a quarter
 * of that unit's forearm and hand, 6-10 units on a hero). Blizzard's two-handers keep both hands on
 * the weapon in Attack and in a combat stance (Stand Ready) and rest it in one hand in plain Stand,
 * so: twoHanded = the off hand holds in at least 75% of the plain attacks' frames (Attack, Attack - 2;
 * slams and spins are listed but not pooled) and in 90% of some stand (the stance).
 * Returns, best first: { name, weapon, main, twoHanded, score, attack: { offHeld, offMedian, offMax,
 * mainMedian, mainHeld, frames }, stance: { name, offHeld, offMedian }, stand: {...plain stands},
 * sequences: [{ name, offHeld, offMedian, mainMedian }] }. */
export function findWielders(models, { within, fps = 30 } = {}) {
  const out = [], plain = name => String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').slice(1).every(w => /^\d+$/.test(w));
  for (const { name, model } of models) {
    const ix = nodeIndex(model), roles = rigRoles(model, ix), weapon = weaponOf(model, ix);
    const entry = { name, weapon: weapon?.name ?? null, weaponTriangles: weapon?.triangles.length || 0, twoHanded: false, score: 0, sequences: [] };
    if (!weapon?.triangles.length || Object.keys(roles.arms).length < 2) { out.push({ ...entry, note: !weapon ? 'no weapon found' : 'needs two arms' }); continue; }
    const forearm = median(Object.values(roles.arms).map(a => ix.pivot(a.lower).distanceTo(a.palm.rest)));
    const limit = within ?? Math.max(4, 0.25 * forearm);
    let main = weapon.side;
    const grips = [];
    (model.Sequences || []).forEach((seq, i) => {
      const kind = sequenceKind(seq.Name);
      if (kind !== 'attack' && kind !== 'stand') return;
      const g = measureGrip(model, i, { weapon, roles, fps });
      if (g) grips.push({ seq, kind, g });
    });
    // A free weapon (not under a hand) belongs to the hand that stays closest in the attacks.
    if (!main && grips.length) { const att = grips.filter(x => x.kind === 'attack'); const pool = (att.length ? att : grips).flatMap(x => x.g.frames); main = Object.keys(roles.arms).sort((a, b) => median(pool.map(f => f[a])) - median(pool.map(f => f[b])))[0]; }
    const off = Object.keys(roles.arms).find(s => s !== main);
    const summary = list => { const m = list.flatMap(x => x.g.frames.map(f => f[main])), o = list.flatMap(x => x.g.frames.map(f => f[off])); return o.length ? { offHeld: r2(o.filter(d => d <= limit).length / o.length), offMedian: r1(median(o)), offMax: r1(Math.max(...o)), mainMedian: r1(median(m)), mainHeld: r2(m.filter(d => d <= limit).length / m.length), frames: o.length } : null; };
    for (const { seq, g } of grips) {
      const m = g.frames.map(f => f[main]), o = g.frames.map(f => f[off]);
      entry.sequences.push({ name: seq.Name, frames: o.length, offHeld: r2(o.filter(d => d <= limit).length / o.length), offMedian: r1(median(o)), mainMedian: r1(median(m)) });
    }
    const attacks = grips.filter(x => x.kind === 'attack'), plainAttacks = attacks.filter(x => plain(x.seq.Name));
    entry.main = main; entry.off = off; entry.within = r1(limit);
    entry.attack = summary(plainAttacks.length ? plainAttacks : attacks);
    entry.stand = summary(grips.filter(x => x.kind === 'stand' && plain(x.seq.Name)));
    const stance = entry.sequences.filter(s => sequenceKind(s.name) === 'stand').sort((a, b) => b.offHeld - a.offHeld || b.frames - a.frames)[0];
    entry.stance = stance ? { name: stance.name, offHeld: stance.offHeld, offMedian: stance.offMedian } : null;
    const a = entry.attack?.offHeld ?? 0, s = stance?.offHeld ?? 0, mainHeld = entry.attack?.mainHeld ?? 0;
    entry.score = r2((0.7 * a + 0.3 * s) * (mainHeld >= 0.5 ? 1 : 0.5));
    entry.twoHanded = a >= 0.75 && s >= 0.9 && mainHeld >= 0.5;
    out.push(entry);
  }
  return out.sort((a, b) => b.score - a.score);
}

/** Pair target sequences with the closest-named source sequences. spec: { 'Stand - 1': 'Stand' },
 * [['Stand - 1', 'Stand']], a list of target names, or nothing (every Stand, Walk and Attack).
 * overrides { targetName: sourceName } change single pairs of that list (e.g. a Footman's
 * 'Stand Defend' from the source's two-handed 'Stand Ready'). */
export function pairSequences(target, source, spec, overrides) {
  if (overrides && Object.keys(overrides).length) {
    const base = new Map(pairSequences(target, source, spec));
    for (const [t, s] of pairSequences(target, source, overrides)) base.set(t, s);
    return [...base].sort((x, y) => x[0] - y[0]);
  }
  const words = n => String(n || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
  const key = n => { const w = words(n); return { kind: w[0], num: w.find(x => /^\d+$/.test(x)), quals: w.slice(1).filter(x => !/^\d+$/.test(x)) }; };
  const score = (t, s) => {
    if (words(t).join(' ') === words(s).join(' ')) return 10;
    const a = key(t), b = key(s);
    if (a.kind !== b.kind) return -1;
    let sc = 1;
    if (a.quals.join(' ') === b.quals.join(' ')) sc += 3; else if (!b.quals.length) sc += 1; else if (b.quals.some(q => a.quals.includes(q))) sc += 2; else sc -= 0.5;
    if (a.num && a.num === b.num) sc += 1; else if (!b.num) sc += 0.5;
    return sc;
  };
  const find = (list, name) => { const i = list.findIndex(s => s.Name === name); return i >= 0 ? i : list.findIndex(s => words(s.Name).join(' ') === words(name).join(' ')); };
  const best = name => { let at = -1, top = 0; source.Sequences.forEach((s, i) => { const sc = score(name, s.Name); if (sc > top) { top = sc; at = i; } }); return at; };
  let pairs;
  if (!spec) pairs = target.Sequences.map((s, i) => [i, ['stand', 'walk', 'attack'].includes(key(s.Name).kind) ? best(s.Name) : -1]);
  else if (Array.isArray(spec)) pairs = spec.map(p => (Array.isArray(p) ? [find(target.Sequences, p[0]), find(source.Sequences, p[1])] : [find(target.Sequences, p), best(p)]));
  else pairs = Object.entries(spec).map(([t, s]) => [find(target.Sequences, t), find(source.Sequences, s)]);
  const missing = pairs.filter(([t, s]) => t < 0 || s < 0);
  if (spec && missing.length) throw Error(`Unknown sequence in ${JSON.stringify(spec)}. Target: ${target.Sequences.map(s => s.Name).join(', ')}. Source: ${source.Sequences.map(s => s.Name).join(', ')}.`);
  return pairs.filter(([t, s]) => t >= 0 && s >= 0);
}

/** A rotation turning a rest direction pair (dir plus the forward axis for roll) onto another. */
function basis(d, ref = new Vector3(1, 0, 0)) {
  const x = d.clone().normalize();
  let y = ref.clone().sub(x.clone().multiplyScalar(ref.dot(x)));
  if (y.lengthSq() < 1e-4) { const alt = Math.abs(x.z) < 0.9 ? new Vector3(0, 0, 1) : new Vector3(0, 1, 0); y = alt.sub(x.clone().multiplyScalar(alt.dot(x))); }
  y.normalize();
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, new Vector3().crossVectors(x, y)));
}

/** Pairs of target and source bones by role, with each pair's rest correction C (target world
 * rotation = source world rotation × C). mirror swaps left and right. Extra pairs by name:
 * mapping { targetBoneName: sourceBoneName } (copied as a world turn). */
export function mapBones(target, source, { mirror = false, mapping = {} } = {}) {
  const T = nodeIndex(target), S = nodeIndex(source), tr = rigRoles(target, T), sr = rigRoles(source, S);
  const other = s => (mirror ? { L: 'R', R: 'L' }[s] : s);
  const sDir = (from, to) => { const d = to.clone().sub(from); return mirror ? mirrorV(d) : d; };
  const pairs = [], used = new Set();
  const add = (role, t, s, kind, aim) => {
    if (t == null || s == null || used.has(t)) return;
    used.add(t);
    let C = new Quaternion();
    if (kind === 'aim') C = basis(sDir(aim.s[0], aim.s[1])).multiply(basis(aim.t[1].clone().sub(aim.t[0])).invert());
    pairs.push({ role, target: t, source: s, kind, C, targetName: T.byId.get(t)?.Name, sourceName: S.byId.get(s)?.Name });
  };
  add('root', tr.root, sr.root, 'turn');
  if (tr.pelvis !== tr.root && sr.pelvis !== sr.root) add('pelvis', tr.pelvis, sr.pelvis, 'turn');
  const ts = tr.spine.filter(id => id !== tr.root), ss = sr.spine.filter(id => id !== sr.root);
  ts.forEach((id, i) => add(i ? `spine ${i}` : 'chest', id, ss[i], 'turn'));
  tr.neck.forEach((id, i) => add(`neck ${i}`, id, sr.neck[i], 'turn'));
  add('head', tr.head, sr.head, 'turn');
  for (const s of ['L', 'R']) {
    const ta = tr.arms[s], sa = sr.arms[other(s)];
    add(`clavicle ${s}`, tr.clavicle[s], sr.clavicle[other(s)], 'turn');
    if (ta && sa) {
      const tEnd = ta.hand != null ? T.pivot(ta.hand) : ta.palm.rest, sEnd = sa.hand != null ? S.pivot(sa.hand) : sa.palm.rest;
      add(`upper arm ${s}`, ta.upper, sa.upper, 'aim', { t: [T.pivot(ta.upper), T.pivot(ta.lower)], s: [S.pivot(sa.upper), S.pivot(sa.lower)] });
      add(`lower arm ${s}`, ta.lower, sa.lower, 'aim', { t: [T.pivot(ta.lower), tEnd], s: [S.pivot(sa.lower), sEnd] });
      if (ta.hand != null && sa.hand != null) { add(`hand ${s}`, ta.hand, sa.hand, 'turn'); const lower = pairs.find(p => p.target === ta.lower), hand = pairs.find(p => p.target === ta.hand); if (lower && hand) hand.C = lower.C.clone(); }
    }
    const tl = tr.legs[s], sl = sr.legs[other(s)];
    if (tl && sl) {
      add(`upper leg ${s}`, tl.upper, sl.upper, 'aim', { t: [T.pivot(tl.upper), T.pivot(tl.lower)], s: [S.pivot(sl.upper), S.pivot(sl.lower)] });
      add(`lower leg ${s}`, tl.lower, sl.lower, 'aim', { t: [T.pivot(tl.lower), T.pivot(tl.foot)], s: [S.pivot(sl.lower), S.pivot(sl.foot)] });
      add(`foot ${s}`, tl.foot, sl.foot, 'turn');
    }
  }
  for (const [tn, sn] of Object.entries(mapping)) {
    const t = T.nodes.find(n => n.Name === tn)?.ObjectId, s = S.nodes.find(n => n.Name === sn)?.ObjectId;
    if (t == null || s == null) throw Error(`mapping: no bone ${t == null ? tn : sn}.`);
    used.delete(t); const at = pairs.findIndex(p => p.target === t); if (at >= 0) pairs.splice(at, 1);
    add(`named ${tn}`, t, s, 'turn');
  }
  return { pairs, targetRoles: tr, sourceRoles: sr };
}

/** WC3 forward kinematics (as animation.js sampleNodeMatrices) where decide(node, parentMatrix)
 * may return a local { rotation, translation } that replaces the node's own keys at this frame. */
function pose(model, ix, frame, sequenceIndex, decide) {
  const interval = model.Sequences?.[sequenceIndex]?.Interval, options = { interval, globalSequences: model.GlobalSequences || [], globalTime: frame };
  const world = new Map();
  for (const node of ix.order) {
    const id = node.ObjectId;
    let parent = ix.byId.has(node.Parent) ? world.get(node.Parent) : null;
    if (parent && node.Flags & 7) {
      const p = new Vector3(), q = new Quaternion(), s = new Vector3();
      parent.decompose(p, q, s);
      if (node.Flags & 1) p.set(0, 0, 0); if (node.Flags & 2) q.identity(); if (node.Flags & 4) s.set(1, 1, 1);
      parent = new Matrix4().compose(p, q, s);
    }
    const own = decide?.(node, parent || I4);
    const translation = own?.translation?.clone() ?? v3(sampleTrack(node.Translation, frame, { ...options, fallback: [0, 0, 0] }));
    const rotation = own?.rotation?.clone() ?? new Quaternion().fromArray(sampleTrack(node.Rotation, frame, { ...options, fallback: [0, 0, 0, 1], quaternion: true }));
    const scale = v3(sampleTrack(node.Scaling, frame, { ...options, fallback: [1, 1, 1] }));
    const pivot = ix.pivot(id), m = new Matrix4().compose(translation, rotation, scale);
    const rotated = pivot.clone().applyMatrix4(m).sub(translation);
    m.setPosition(translation.clone().add(pivot).sub(rotated));
    if (parent) m.premultiply(parent);
    world.set(id, m);
  }
  return world;
}

/** Fewest samples whose linear (slerp) interpolation stays within tolerance of every sample. */
function reduceKeys(times, values, tolerance, quaternion) {
  const n = times.length, keep = [0];
  const within = (a, c) => {
    for (let i = a + 1; i < c; i++) {
      const u = (times[i] - times[a]) / (times[c] - times[a]);
      if (quaternion ? angleDeg(values[a].clone().slerp(values[c], u), values[i]) > tolerance : values[a].clone().lerp(values[c], u).distanceTo(values[i]) > tolerance) return false;
    }
    return true;
  };
  for (let a = 0; a < n - 1;) { let c = a + 1; while (c + 1 < n && within(a, c + 1)) c++; keep.push(c); a = c; }
  return keep;
}

/** Replace a track's keys inside [a, b] with reduced keys; the track keeps its interpolation type
 * (rotation tangents equal the keys, translation tangents make straight segments, as Blizzard's). */
function writeTrack(node, property, a, b, times, values, tolerance, model) {
  const quaternion = property === 'Rotation';
  const track = node[property];
  if (isGlobal(track, model)) return { skipped: 'global sequence track' };
  const flat = !quaternion && values.every(v => v.length() < 1e-3);
  const others = (track?.Keys || []).filter(k => k.Frame < a || k.Frame > b);
  if (flat) { if (track?.Keys) track.Keys = others; return { keys: 0 }; }
  const keep = reduceKeys(times, values, tolerance, quaternion);
  const lineType = track?.Keys ? track.LineType ?? 1 : 1;
  const value = i => Float32Array.from(quaternion ? values[i].toArray() : values[i].toArray());
  const keys = keep.map((i, k) => {
    const key = { Frame: times[i], Vector: value(i) };
    if (lineType >= 2) {
      if (quaternion) { key.InTan = value(i); key.OutTan = value(i); }
      else {
        const prev = k ? values[keep[k - 1]] : values[i], next = k < keep.length - 1 ? values[keep[k + 1]] : values[i], cur = values[i];
        if (lineType === 2) { key.InTan = Float32Array.from(cur.clone().sub(prev).toArray()); key.OutTan = Float32Array.from(next.clone().sub(cur).toArray()); }
        else { key.InTan = Float32Array.from(cur.clone().sub(cur.clone().sub(prev).multiplyScalar(1 / 3)).toArray()); key.OutTan = Float32Array.from(cur.clone().add(next.clone().sub(cur).multiplyScalar(1 / 3)).toArray()); }
      }
    }
    return key;
  });
  if (!track?.Keys) node[property] = { LineType: lineType, GlobalSeqId: null, Keys: keys };
  else {
    track.Keys = [...others, ...keys].sort((x, y) => x.Frame - y.Frame);
    if (track.LineType === 0) track.LineType = 1;
    // Blizzard's Hermite rotation keys mostly carry tangents equal to the key, which plays exactly
    // as linear: when every key of the track does, store it linear (no tangents, 32 bytes less a key).
    const same = (a, b) => a && b && a.length === b.length && Array.prototype.every.call(a, (x, i) => Math.abs(x - b[i]) < 1e-6);
    if (quaternion && track.LineType >= 2 && track.Keys.every(k => same(k.InTan, k.Vector) && same(k.OutTan, k.Vector))) {
      track.LineType = 1;
      for (const k of track.Keys) { delete k.InTan; delete k.OutTan; }
    }
  }
  return { keys: keys.length };
}

/** Move every non-global key and event time through f (bones, geoset animations, materials,
 * emitters, events); sequences are left to the caller. */
function retimeFrames(model, f) {
  const seen = new Set();
  const visit = value => {
    if (!value || typeof value !== 'object' || ArrayBuffer.isView(value) || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value.Keys) && !isGlobal(value, model)) for (const k of value.Keys) if (typeof k?.Frame === 'number') k.Frame = f(k.Frame);
    if (ArrayBuffer.isView(value.EventTrack)) value.EventTrack = Uint32Array.from(Array.from(value.EventTrack, f));
    for (const child of Object.values(value)) visit(child);
  };
  for (const [key, value] of Object.entries(model)) if (key !== 'Sequences') visit(value);
}
/** Stretch or shrink one sequence slot [a, b] to [a, b2]: everything inside moves proportionally. */
export function retimeInterval(model, a, b, b2) {
  retimeFrames(model, t => (t >= a && t <= b ? Math.round(a + ((t - a) * (b2 - a)) / Math.max(1, b - a)) : t));
}
/** Give sequence i a new length: its keys and events stretch or shrink, and every later sequence
 * (with its keys and events) moves by the difference, so nothing overlaps and nothing else changes. */
export function resizeSequence(model, i, length) {
  const seq = model.Sequences[i], [a, b] = Array.from(seq.Interval), delta = Math.round(length) - (b - a);
  if (!delta) return 0;
  if (delta > 0) retimeFrames(model, t => (t > b ? t + delta : t));
  retimeInterval(model, a, b, a + Math.round(length));
  if (delta < 0) retimeFrames(model, t => (t > b ? t + delta : t));
  for (const other of model.Sequences) if (other !== seq && other.Interval[0] > b) other.Interval = Uint32Array.from([other.Interval[0] + delta, other.Interval[1] + delta]);
  seq.Interval = Uint32Array.from([a, a + Math.round(length)]);
  return delta;
}

/** Recompute the sequences' and geosets' extents from the posed mesh (sampled every 33 ms). */
export function updateSequenceBounds(model, sequenceIndices) {
  for (const si of sequenceIndices) {
    const seq = model.Sequences[si], all = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
    const boxes = model.Geosets.map(() => ({ min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }));
    for (const t of frameTimes(seq.Interval, 30)) {
      const m = sampleNodeMatrices(model, t, si);
      model.Geosets.forEach((g, gi) => { const P = skinGeoset(g, m); for (let i = 0; i < P.length; i++) { const a = i % 3; for (const b of [boxes[gi], all]) { b.min[a] = Math.min(b.min[a], P[i]); b.max[a] = Math.max(b.max[a], P[i]); } } });
    }
    const finish = b => ({ MinimumExtent: new Float32Array(b.min), MaximumExtent: new Float32Array(b.max), BoundsRadius: Math.hypot(...b.max.map((v, a) => (v - b.min[a]) / 2)) });
    if (Number.isFinite(all.min[0])) Object.assign(seq, finish(all));
    model.Geosets.forEach((g, gi) => { if (Array.isArray(g.Anims) && g.Anims.length === model.Sequences.length && Number.isFinite(boxes[gi].min[0])) g.Anims[si] = finish(boxes[gi]); });
  }
}

/** Copy the chosen source sequences' motion onto the target's rig, in place (the target's own
 * sequence slots; other sequences keep their keys and only move in time when a slot changes
 * length). Options: sequences and pairs (see pairSequences: which target sequences, and single
 * overrides), mirror ('auto': when the source holds its weapon in the other hand), scale (default:
 * target leg length ÷ source leg length), ground (match the lowest foot contact, default true),
 * timing ({ stand: 'source', attack: 'target', walk: 'ground' }: keep the source's length, the
 * target's length, or the target's ground speed), mapping (extra { targetBone: sourceBone }),
 * fps (30), angleTolerance (0.5°), distanceTolerance (0.2 units), mainHand ('L' | 'R', the target's
 * weapon hand when it has no weapon left). Returns what attachTwoHanded and measureRetarget need,
 * plus per sequence: source, timing, length before/after, keys written, ground lift. */
export function retargetAnimations(target, source, options = {}) {
  const { sequences, ground = true, fps = 30, angleTolerance = 0.5, distanceTolerance = 0.2, mapping } = options;
  const T = nodeIndex(target), S = nodeIndex(source);
  const tWeapon = weaponOf(target, T), sWeapon = weaponOf(source, S);
  const mainT = options.mainHand || tWeapon?.side || 'R', mainS = sWeapon?.side || 'R';
  const mirror = options.mirror === undefined || options.mirror === 'auto' ? mainT !== mainS : !!options.mirror;
  const { pairs, targetRoles, sourceRoles } = mapBones(target, source, { mirror, mapping });
  if (!pairs.some(p => p.role === 'root')) throw Error('No root bone found in one of the rigs; pass mapping.');
  const scale = options.scale ?? (targetRoles.legLength > 0 && sourceRoles.legLength > 0 ? targetRoles.legLength / sourceRoles.legLength : 1);
  const sides = mirror ? { L: 'R', R: 'L' } : { L: 'L', R: 'R' };
  const report = { mirror, scale: r2(scale), mainHand: mainT, sourceMainHand: mainS, pairs: pairs.map(p => ({ role: p.role, target: p.targetName, source: p.sourceName, kind: p.kind })), sequences: [] };
  const transfer = (ti, si) => {
    const tSeq = target.Sequences[ti], sSeq = source.Sequences[si];
    const [c, d] = Array.from(sSeq.Interval);
    const [a, b] = Array.from(tSeq.Interval);
    const toSource = t => c + ((t - a) * (d - c)) / Math.max(1, b - a), toTarget = s => Math.round(a + ((s - c) * (b - a)) / Math.max(1, d - c));
    const times = new Set(frameTimes([a, b], fps));
    for (const p of pairs) for (const prop of ['Rotation', 'Translation']) for (const k of keysIn(S.byId.get(p.source)?.[prop], c, d)) times.add(toTarget(k.Frame));
    const list = [...times].filter(t => t >= a && t <= b).sort((x, y) => x - y);
    const moves = new Set(pairs.filter(p => p.role === 'root' || keysIn(S.byId.get(p.source)?.Translation, c, d).length || keysIn(T.byId.get(p.target)?.Translation, a, b).length).map(p => p.target));
    const rot = new Map(pairs.map(p => [p.target, []])), pos = new Map([...moves].map(id => [id, []]));
    const soles = { t: [], s: [] };
    for (const t of list) {
      const Ms = sampleNodeMatrices(source, toSource(t), si), want = new Map();
      for (const p of pairs) {
        const m = Ms.get(p.source); if (!m) continue;
        const q = rotationOf(m), w = { q: (mirror ? mirrorQ(q) : q).multiply(p.C) };
        if (moves.has(p.target)) {
          const piv = S.pivot(p.source), parent = Ms.get(S.byId.get(p.source)?.Parent) || I4;
          const delta = piv.clone().applyMatrix4(m).sub(piv.clone().applyMatrix4(parent)).multiplyScalar(scale);
          w.delta = mirror ? mirrorV(delta) : delta;
        }
        want.set(p.target, w);
      }
      const Mt = pose(target, T, t, ti, (node, parent) => {
        const w = want.get(node.ObjectId); if (!w) return null;
        const rotation = rotationOf(parent).invert().multiply(w.q);
        let translation = new Vector3();
        if (w.delta) { const piv = T.pivot(node.ObjectId), at = piv.clone().applyMatrix4(parent).add(w.delta); translation = at.applyMatrix4(parent.clone().invert()).sub(piv); }
        return { rotation, translation };
      });
      for (const p of pairs) {
        const q = rotationOf(Mt.get(p.target)), parent = Mt.get(T.byId.get(p.target)?.Parent);
        let local = parent ? rotationOf(parent).invert().multiply(q) : q;
        const prev = rot.get(p.target).at(-1);
        if (prev && prev.dot(local) < 0) local = new Quaternion(-local.x, -local.y, -local.z, -local.w);
        rot.get(p.target).push(local);
        if (moves.has(p.target)) {
          const piv = T.pivot(p.target), par = parent || I4;
          pos.get(p.target).push(piv.clone().applyMatrix4(Mt.get(p.target)).applyMatrix4(par.clone().invert()).sub(piv));
        }
      }
      for (const s of ['L', 'R']) {
        const tl = targetRoles.legs[s], sl = sourceRoles.legs[sides[s]];
        if (tl) soles.t.push(tl.sole.rest.clone().applyMatrix4(Mt.get(tl.sole.node) || I4).z - tl.sole.rest.z);
        if (sl) soles.s.push((sl.sole.rest.clone().applyMatrix4(Ms.get(sl.sole.node) || I4).z - sl.sole.rest.z) * scale);
      }
    }
    // Ground: the lowest foot contact lands where the source's (scaled) does.
    let lift = 0;
    const rootId = pairs.find(p => p.role === 'root').target;
    if (ground && soles.t.length && soles.s.length && !T.byId.has(T.byId.get(rootId)?.Parent)) {
      lift = Math.min(...soles.s) - Math.min(...soles.t);
      if (Math.abs(lift) > 0.05) for (const v of pos.get(rootId)) v.z += lift; else lift = 0;
    }
    const written = { rotation: 0, translation: 0, skipped: [] };
    for (const p of pairs) {
      const node = T.byId.get(p.target), r = writeTrack(node, 'Rotation', a, b, list, rot.get(p.target), angleTolerance, target);
      if (r.skipped) written.skipped.push(`${node.Name} rotation: ${r.skipped}`); else written.rotation += r.keys;
      if (moves.has(p.target)) { const tr = writeTrack(node, 'Translation', a, b, list, pos.get(p.target), distanceTolerance * Math.max(scale, 0.5), target); if (tr.skipped) written.skipped.push(`${node.Name} translation: ${tr.skipped}`); else written.translation += tr.keys; }
    }
    const sourceKeys = pairs.reduce((s, p) => s + keysIn(S.byId.get(p.source)?.Rotation, c, d).length + keysIn(S.byId.get(p.source)?.Translation, c, d).length, 0);
    return ({ index: ti, target: tSeq.Name, sourceIndex: si, source: sSeq.Name, interval: [a, b], sourceInterval: [c, d], timeScale: r2((b - a) / Math.max(1, d - c)), samples: list.length, times: list, keys: written.rotation + written.translation, rotationKeys: written.rotation, translationKeys: written.translation, sourceKeys, lift: r2(lift), skipped: written.skipped });
  };
  // Timing per kind: an idle keeps the source's own pace (its slot takes the source's length and
  // later sequences move along), an attack keeps the target's length (the game's attack timing), a
  // walk keeps the target's ground speed so the feet stay planted at the unit's old walk rate.
  const timing = { stand: 'source', attack: 'target', walk: 'ground', ...(options.timing || {}) };
  for (const [ti, si] of pairSequences(target, source, sequences, options.pairs)) {
    const tSeq = target.Sequences[ti], sSeq = source.Sequences[si], mode = timing[sequenceKind(tSeq.Name)] ?? 'target';
    const from = tSeq.Interval[1] - tSeq.Interval[0];
    const before = mode === 'ground' ? footContact(target, T, targetRoles, ti) : null;
    if (mode === 'source' || (mode === 'ground' && !(before?.groundSpeed > 1))) resizeSequence(target, ti, sSeq.Interval[1] - sSeq.Interval[0]);
    let entry = transfer(ti, si);
    if (mode === 'ground' && before?.groundSpeed > 1) {
      // Measured on the result, then resized so the planted feet move at the old ground speed.
      const now = footContact(target, T, targetRoles, ti), length = tSeq.Interval[1] - tSeq.Interval[0];
      if (now?.groundSpeed > 1) {
        const wanted = Math.round((length * now.groundSpeed) / before.groundSpeed);
        if (Math.abs(wanted - length) > 5) { resizeSequence(target, ti, wanted); entry = transfer(ti, si); }
        entry.groundSpeed = { original: before.groundSpeed, final: footContact(target, T, targetRoles, ti)?.groundSpeed };
      }
    }
    entry.timing = mode; entry.length = { before: from, after: tSeq.Interval[1] - tSeq.Interval[0], source: sSeq.Interval[1] - sSeq.Interval[0] };
    report.sequences.push(entry);
  }
  // Intervals may have moved: record the final slots.
  for (const e of report.sequences) { const iv = Array.from(target.Sequences[e.index].Interval); if (iv[0] !== e.interval[0] || iv[1] !== e.interval[1]) { const [a, b] = e.interval; e.times = e.times.map(t => iv[0] + Math.round(((t - a) * (iv[1] - iv[0])) / Math.max(1, b - a))); e.interval = iv; } }
  updateSequenceBounds(target, report.sequences.map(s => s.index));
  Object.defineProperty(report, 'source', { value: source, enumerable: false });
  Object.defineProperty(report, 'mapping', { value: { pairs, targetRoles, sourceRoles, sourceWeapon: sWeapon, sides }, enumerable: false });
  return report;
}

/** Hold a two-handed weapon taken from the retarget's source (sd-kitbash take, still in the
 * source's bind space) the way the source holds it. The weapon is bound to a new bone under the
 * target's main hand, placed so the hand closes where the source's main hand grips the haft, and
 * keyed so it turns exactly as the source's weapon turns. Then the off hand is pulled onto the haft
 * (two-bone IK on the off arm, blended out when the source lets go). Options: scale (weapon size,
 * default target arm length ÷ source arm length), name (the bone), offHand (true), within (units:
 * the source's off hand counts as holding inside this distance), align (true when the part comes
 * from another model, e.g. Gorehowl on the Paladin's swing: it is laid onto the source weapon's haft,
 * head to head, striking side to striking side). Returns per sequence the main and off hand
 * distance to the posed weapon surface. */
export function attachTwoHanded(model, part, retarget, { scale, name = 'Bone_Weapon2H', offHand = true, within, align = false } = {}) {
  const map = retarget?.mapping, source = retarget?.source;
  if (!map || !source) throw Error('attachTwoHanded needs the result of retargetAnimations.');
  const S = nodeIndex(source), w = map.sourceWeapon;
  if (!w?.axis) throw Error('The source has no weapon to copy the grip from.');
  const { targetRoles: tr, sourceRoles: sr, sides, pairs } = map, mirror = retarget.mirror;
  const mainT = retarget.mainHand, offT = mainT === 'L' ? 'R' : 'L', mainS = sides[mainT], offS = sides[offT];
  const tMain = tr.arms[mainT], tOff = tr.arms[offT], sMain = sr.arms[mainS], sOff = sr.arms[offS];
  if (!tMain || !sMain) throw Error('Both rigs need a main arm.');
  const k = scale ?? (tr.armLength > 0 && sr.armLength > 0 ? tr.armLength / sr.armLength : retarget.scale);
  const forearm = S.pivot(sOff?.lower ?? sMain.lower).distanceTo((sOff ?? sMain).palm.rest), limit = within ?? Math.max(4, 0.25 * forearm);
  const M = q => (mirror ? mirrorQ(q) : q), Mv = v => (mirror ? mirrorV(v) : v);
  // 1. Grips in the source weapon's bind space, frame by frame, over the retargeted sequences.
  const samples = retarget.sequences.map(seq => seq.times.map(t => {
    const st = seq.sourceInterval[0] + ((t - seq.interval[0]) * (seq.sourceInterval[1] - seq.sourceInterval[0])) / Math.max(1, seq.interval[1] - seq.interval[0]);
    const m = sampleNodeMatrices(source, st, seq.sourceIndex), skinned = new Map();
    const mainP = palmAt(source, sMain.palm, m), offP = sOff ? palmAt(source, sOff.palm, m) : null;
    // The weapon's lowest point (the source stands on z = 0): the target's weapon may rest on the ground, not sink in.
    let low = Infinity;
    for (const [gi, ...vs] of w.triangles) { if (!skinned.has(gi)) skinned.set(gi, skinGeoset(source.Geosets[gi], m)); const P = skinned.get(gi); for (const v of vs) low = Math.min(low, P[v * 3 + 2]); }
    return { t, low, weaponQ: M(rotationOf(m.get(w.frameNode) || I4)), handQ: M(rotationOf(m.get(sMain.hand ?? sMain.lower) || I4)), main: gripOnAxis(w, m, mainP), off: offP && gripOnAxis(w, m, offP), offDistance: offP ? weaponDistance(source, w, m, offP, skinned) : Infinity, mainDistance: weaponDistance(source, w, m, mainP, skinned) };
  }));
  // A weapon from another model (align: true) is first laid onto the source weapon's haft.
  if (align) part = alignPart(part, w, source);
  const haft = align ? extentAlong(part, w.axis) : { lo: w.axis.lo, hi: w.axis.hi };
  const along = p => p.clone().sub(w.axis.center).dot(w.axis.dir), at = t => w.axis.center.clone().add(w.axis.dir.clone().multiplyScalar(Math.max(haft.lo, Math.min(haft.hi, t))));
  for (const s of samples.flat()) if (s.off) s.off = at(along(s.off));
  const flat = samples.flat(), held = flat.filter(s => s.mainDistance <= limit * 1.5);
  const g = at(median((held.length ? held : flat).map(s => along(s.main))));
  // 2. Rest placement: the source's grip at its first sampled frame, relative to the hand, seen
  // through the hand's rest correction (so untouched sequences hold it the same way).
  const handPair = pairs.find(p => p.target === (tMain.hand ?? tMain.lower));
  const ref = samples[0][0], B = (handPair?.C.clone() || new Quaternion()).invert().multiply(ref.handQ.clone().invert().multiply(ref.weaponQ));
  const h = tMain.palm.rest.clone();
  const place = p => h.clone().add(Mv(p.clone().sub(g)).multiplyScalar(k).applyQuaternion(B));
  const placed = structuredClone(part), det = mirror ? -1 : 1;
  for (const geo of placed.Geosets) {
    for (let v = 0; v < geo.Vertices.length / 3; v++) geo.Vertices.set(place(v3(geo.Vertices.subarray(v * 3, v * 3 + 3))).toArray(), v * 3);
    if (geo.Normals?.length) for (let v = 0; v < geo.Normals.length / 3; v++) geo.Normals.set(Mv(v3(geo.Normals.subarray(v * 3, v * 3 + 3))).applyQuaternion(B).normalize().toArray(), v * 3);
    if (det < 0) for (let f = 0; f < geo.Faces.length; f += 3) { const x = geo.Faces[f + 1]; geo.Faces[f + 1] = geo.Faces[f + 2]; geo.Faces[f + 2] = x; }
  }
  // 3. The weapon bone under the main hand, and the weapon's geometry bound to it.
  const hadDummy = (model.Bones || []).some(b => b.Name === 'DummyBone');
  // commitPart may renumber every node (bones first, then the rest): follow the ids the retarget
  // recorded by each node's collection, name and occurrence.
  const nodeKeys = () => { const out = new Map(), seen = new Map(); for (const key of ['Bones', 'Helpers', 'Attachments', 'EventObjects', 'CollisionShapes', 'ParticleEmitters', 'ParticleEmitters2', 'ParticleEmitterPopcorns', 'Lights', 'RibbonEmitters']) for (const n of model[key] || []) { const base = key + '|' + n.Name, k = seen.get(base) || 0; seen.set(base, k + 1); out.set(n.ObjectId, base + '|' + k); } return out; };
  const before = nodeKeys();
  const committed = commitPart(model, placed), indices = committed.geosetIndices;
  const after = new Map([...nodeKeys()].map(([id, k]) => [k, id])), remap = new Map([...before].map(([id, k]) => [id, after.get(k) ?? id]));
  if ([...remap].some(([a, b]) => a !== b)) remapRetarget(retarget, remap);
  const bone = createNode(model, 'Bone');
  Object.assign(bone, { Name: name, Parent: tMain.hand ?? tMain.lower });
  bone.PivotPoint.set(h.toArray());
  attachGeosets(model, indices, { bone: bone.ObjectId, keepDummy: hadDummy });
  // Bones the part brought along and no longer moves anything are dropped again.
  const usedIds = new Set(model.Geosets.flatMap(geo => (geo.Groups || []).flat()));
  for (const id of committed.boneIds || []) if (id !== bone.ObjectId && !usedIds.has(id) && !allNodes(model).some(n => n.Parent === id) && (model.Bones || []).some(b => b.ObjectId === id)) deleteNode(model, id);
  recalculateExtents(model);
  // 4. Weapon keys: world turn of the source weapon, relative to the target's main hand.
  const T = nodeIndex(model), handNode = tMain.hand ?? tMain.lower, Binv = B.clone().invert();
  const weaponPoints = indices.flatMap(gi => Array.from({ length: model.Geosets[gi].Vertices.length / 3 }, (_, v) => v3(model.Geosets[gi].Vertices.subarray(v * 3, v * 3 + 3)).sub(h)));
  // Ground: where the turned weapon would sink below the floor (the ground, or the source's own dip
  // scaled), it turns about the grip just enough to rest on the floor.
  const groundClamp = (world, grip, floor) => {
    let lift = 0;
    for (let pass = 0; pass < 4; pass++) {
      let lowest = null, lowZ = Infinity;
      for (const p of weaponPoints) { const z = grip.z + p.clone().applyQuaternion(world).z; if (z < lowZ) { lowZ = z; lowest = p; } }
      if (lowZ >= floor - 0.05) break;
      const d = lowest.clone().applyQuaternion(world), r = d.length(), want = Math.max(-1, Math.min(1, (floor - grip.z) / r));
      const flat = new Vector3(d.x, d.y, 0);
      if (flat.lengthSq() < 1e-6) flat.set(1, 0, 0);
      const aim = flat.normalize().multiplyScalar(Math.sqrt(1 - want * want)).add(new Vector3(0, 0, want));
      world = new Quaternion().setFromUnitVectors(d.normalize(), aim).multiply(world);
      lift = Math.max(lift, floor - lowZ);
    }
    return { world, lift };
  };
  const out = { scale: r2(k), grip: g.toArray().map(r1), bone: name, within: r1(limit), sequences: [] };
  retarget.sequences.forEach((seq, n) => {
    let lifted = 0;
    const qs = samples[n].map(s => {
      const m = sampleNodeMatrices(model, s.t, seq.index), hand = m.get(handNode);
      const { world, lift } = groundClamp(s.weaponQ.clone().multiply(Binv), h.clone().applyMatrix4(hand), Math.min(0, s.low * k));
      lifted = Math.max(lifted, lift);
      return rotationOf(hand).invert().multiply(world);
    });
    for (let i = 1; i < qs.length; i++) if (qs[i].dot(qs[i - 1]) < 0) qs[i].set(-qs[i].x, -qs[i].y, -qs[i].z, -qs[i].w);
    const r = writeTrack(bone, 'Rotation', seq.interval[0], seq.interval[1], seq.times, qs, 0.5, model);
    out.sequences.push({ target: seq.target, weaponKeys: r.keys || 0, ...(lifted > 0.05 ? { liftedOffGround: r1(lifted) } : {}) });
  });
  // 4b. Sequences left as they were (Death, Spell...): the weapon keeps its rest grip, except where
  // it would sink into the ground; only the new weapon bone gets keys there.
  const done = new Set(retarget.sequences.map(seq => seq.index));
  out.untouched = [];
  model.Sequences.forEach((seq, si) => {
    if (done.has(si) || /decay|dissipate/i.test(seq.Name || '')) return; // a decaying corpse sinks, its weapon with it
    const times = frameTimes(seq.Interval, 30);
    let lifted = 0;
    const qs = times.map(t => { const hand = sampleNodeMatrices(model, t, si).get(handNode), q = rotationOf(hand), { world, lift } = groundClamp(q.clone(), h.clone().applyMatrix4(hand), 0); lifted = Math.max(lifted, lift); return q.invert().multiply(world); });
    if (lifted <= 0.05) return;
    for (let i = 1; i < qs.length; i++) if (qs[i].dot(qs[i - 1]) < 0) qs[i].set(-qs[i].x, -qs[i].y, -qs[i].z, -qs[i].w);
    const r = writeTrack(bone, 'Rotation', seq.Interval[0], seq.Interval[1], times, qs, 0.5, model);
    out.untouched.push({ sequence: seq.Name, weaponKeys: r.keys || 0, liftedOffGround: r1(lifted) });
  });
  // 5. Off hand onto the haft: two-bone IK of the off arm toward the source's off grip (scaled).
  if (offHand && tOff && sOff) {
    const upper = T.byId.get(tOff.upper), lower = T.byId.get(tOff.lower);
    retarget.sequences.forEach((seq, n) => {
      const up = [], low = [];
      let reach = 0;
      for (const s of samples[n]) {
        const m = sampleNodeMatrices(model, s.t, seq.index);
        const weight = s.off ? 1 - smoothstep(limit, 2 * limit, s.offDistance) : 0;
        const S0 = T.pivot(tOff.upper).applyMatrix4(m.get(tOff.upper)), E = T.pivot(tOff.lower).applyMatrix4(m.get(tOff.lower)), P = palmAt(model, tOff.palm, m);
        let goal = weight > 0 ? place(s.off).applyMatrix4(m.get(bone.ObjectId)) : P.clone();
        // Out of reach (a shorter arm than the source's): slide the grip along the haft to the
        // nearest point the arm can reach, between the haft's ends.
        const reachLen = (E.distanceTo(S0) + P.distanceTo(E)) * 0.995;
        if (weight > 0 && goal.distanceTo(S0) > reachLen) {
          const w0 = place(at(haft.lo)).applyMatrix4(m.get(bone.ObjectId)), w1 = place(at(haft.hi)).applyMatrix4(m.get(bone.ObjectId));
          const dir = w1.clone().sub(w0), len = dir.length(); dir.normalize();
          const foot = w0.clone().add(dir.clone().multiplyScalar(S0.clone().sub(w0).dot(dir))), off = foot.distanceTo(S0);
          if (off < reachLen) {
            const half = Math.sqrt(reachLen * reachLen - off * off), at = goal.clone().sub(w0).dot(dir), center = foot.clone().sub(w0).dot(dir);
            const t = Math.max(0, Math.min(len, Math.max(center - half, Math.min(center + half, at))));
            goal = w0.clone().add(dir.multiplyScalar(t));
          }
        }
        const target = P.clone().lerp(goal, weight);
        const { r1: R1, r2: R2, miss } = twoBone(S0, E, P, target);
        reach = Math.max(reach, miss * weight);
        const qU = rotationOf(m.get(tOff.upper)), qL = rotationOf(m.get(tOff.lower)), qP = rotationOf(m.get(upper.Parent) || I4);
        const newU = R1.clone().multiply(qU), newL = R2.clone().multiply(R1).multiply(qL);
        let lu = qP.clone().invert().multiply(newU), ll = newU.clone().invert().multiply(newL);
        if (up.length && up.at(-1).dot(lu) < 0) lu.set(-lu.x, -lu.y, -lu.z, -lu.w);
        if (low.length && low.at(-1).dot(ll) < 0) ll.set(-ll.x, -ll.y, -ll.z, -ll.w);
        up.push(lu); low.push(ll);
      }
      writeTrack(upper, 'Rotation', seq.interval[0], seq.interval[1], seq.times, up, 0.5, model);
      writeTrack(lower, 'Rotation', seq.interval[0], seq.interval[1], seq.times, low, 0.5, model);
      out.sequences[n].unreached = r1(reach);
    });
  }
  // 6. Measure: both palms against the posed weapon, frame by frame.
  const weapon = { triangles: indices.flatMap(gi => { const f = model.Geosets[gi].Faces, list = []; for (let i = 0; i < f.length; i += 3) list.push([gi, f[i], f[i + 1], f[i + 2]]); return list; }) };
  retarget.sequences.forEach((seq, n) => {
    const main = [], off = [];
    samples[n].forEach(s => {
      const m = sampleNodeMatrices(model, s.t, seq.index), skinned = new Map();
      main.push(weaponDistance(model, weapon, m, palmAt(model, tMain.palm, m), skinned));
      if (tOff) off.push({ d: weaponDistance(model, weapon, m, palmAt(model, tOff.palm, m), skinned), sourceHeld: s.offDistance <= limit });
    });
    const heldOff = off.filter(o => o.sourceHeld).map(o => o.d), sourceHeldOff = samples[n].filter(s => s.offDistance <= limit).map(s => s.offDistance);
    Object.assign(out.sequences[n], {
      mainHand: { median: r1(median(main)), max: r1(Math.max(...main)) },
      // Off hand while the source holds with both hands; the source's own distances (its units) beside.
      offHand: heldOff.length ? { framesHeld: heldOff.length, frames: off.length, median: r1(median(heldOff)), max: r1(Math.max(...heldOff)), sourceMedian: r1(median(sourceHeldOff)), sourceMax: r1(Math.max(...sourceHeldOff)) } : { framesHeld: 0, frames: off.length },
      perFrame: samples[n].map((s, i) => ({ t: s.t, main: r1(main[i]), off: off[i] ? r1(off[i].d) : null, sourceOff: r1(s.offDistance), sourceHeld: off[i]?.sourceHeld ?? false })),
    });
  });
  updateSequenceBounds(model, retarget.sequences.map(s => s.index));
  out.geosets = indices;
  return out;
}

const partPoints = part => part.Geosets.flatMap(g => Array.from({ length: g.Vertices.length / 3 }, (_, v) => v3(g.Vertices.subarray(v * 3, v * 3 + 3))));
function extentAlong(part, axis) { const t = partPoints(part).map(p => p.clone().sub(axis.center).dot(axis.dir)); return { lo: Math.min(...t), hi: Math.max(...t) }; }
/** The weapon's head end (+1: toward axis.hi) and its striking direction: the head is the wider end,
 * the strike points from the haft to the head's farthest point (an axe's edge, a hammer's face). */
function headOf(points, axis) {
  const mid = (axis.lo + axis.hi) / 2, perp = p => { const r = p.clone().sub(axis.center); return r.sub(axis.dir.clone().multiplyScalar(r.dot(axis.dir))); };
  let hi = 0, lo = 0;
  for (const p of points) { const d = perp(p).length(); if (p.clone().sub(axis.center).dot(axis.dir) > mid) hi = Math.max(hi, d); else lo = Math.max(lo, d); }
  const sign = hi >= lo ? 1 : -1;
  let strike = new Vector3(), far = -1;
  for (const p of points) { if ((p.clone().sub(axis.center).dot(axis.dir) - mid) * sign <= 0) continue; const v = perp(p); if (v.length() > far) { far = v.length(); strike = v; } }
  return { sign, tip: axis.center.clone().add(axis.dir.clone().multiplyScalar(sign > 0 ? axis.hi : axis.lo)), strike: strike.normalize() };
}
/** Lay a weapon part from another model onto the source weapon: long axes on one line, heads at the
 * same end (so hands grip at the same distance from the head), striking sides the same way. */
function alignPart(part, weapon, source) {
  const pts = partPoints(part), pa = longAxis(pts), ph = headOf(pts, pa);
  const wpts = weapon.triangles.flatMap(([gi, ...vs]) => vs.map(v => v3(source.Geosets[gi].Vertices.subarray(v * 3, v * 3 + 3)))), wh = headOf(wpts, weapon.axis);
  const R = basis(weapon.axis.dir.clone().multiplyScalar(wh.sign), wh.strike).multiply(basis(pa.dir.clone().multiplyScalar(ph.sign), ph.strike).invert());
  const out = structuredClone(part);
  for (const g of out.Geosets) {
    for (let v = 0; v < g.Vertices.length / 3; v++) g.Vertices.set(v3(g.Vertices.subarray(v * 3, v * 3 + 3)).sub(ph.tip).applyQuaternion(R).add(wh.tip).toArray(), v * 3);
    if (g.Normals?.length) for (let v = 0; v < g.Normals.length / 3; v++) g.Normals.set(v3(g.Normals.subarray(v * 3, v * 3 + 3)).applyQuaternion(R).toArray(), v * 3);
  }
  return out;
}

/** Follow renumbered target nodes in a retarget result (in place). */
function remapRetarget(retarget, remap) {
  const f = id => (id == null ? id : remap.get(id) ?? id), { pairs, targetRoles: r } = retarget.mapping;
  for (const p of pairs) p.target = f(p.target);
  for (const key of ['root', 'pelvis', 'chest', 'head']) r[key] = f(r[key]);
  r.spine = r.spine.map(f); r.neck = r.neck.map(f);
  for (const s of Object.keys(r.clavicle)) r.clavicle[s] = f(r.clavicle[s]);
  for (const a of Object.values(r.arms)) { a.upper = f(a.upper); a.lower = f(a.lower); a.hand = f(a.hand); a.palm.node = f(a.palm.node); }
  for (const l of Object.values(r.legs)) { l.upper = f(l.upper); l.lower = f(l.lower); l.foot = f(l.foot); l.sole.node = f(l.sole.node); }
}

/** Two-bone IK: rotations R1 (about the shoulder) and R2 (about the moved elbow) that bring the
 * end point P to the target, bending in the plane of the current elbow. miss: distance left over. */
function twoBone(S0, E, P, target) {
  const a = E.distanceTo(S0), b = P.distanceTo(E), toT = target.clone().sub(S0), d = Math.min(Math.max(toT.length(), Math.abs(a - b) + 1e-3), a + b - 1e-3);
  const u = toT.clone().normalize();
  let v = E.clone().sub(S0); v.sub(u.clone().multiplyScalar(v.dot(u)));
  if (v.lengthSq() < 1e-8) v = new Vector3(0, 0, -1).sub(u.clone().multiplyScalar(-u.z));
  v.normalize();
  const cos = Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d))), alpha = Math.acos(cos);
  const E2 = S0.clone().add(u.clone().multiplyScalar(a * Math.cos(alpha))).add(v.multiplyScalar(a * Math.sin(alpha)));
  const r1 = new Quaternion().setFromUnitVectors(E.clone().sub(S0).normalize(), E2.clone().sub(S0).normalize());
  const P1 = E2.clone().add(P.clone().sub(E).applyQuaternion(r1));
  const r2 = new Quaternion().setFromUnitVectors(P1.clone().sub(E2).normalize(), target.clone().sub(E2).normalize());
  const reached = E2.clone().add(P1.clone().sub(E2).applyQuaternion(r2));
  return { r1, r2, miss: reached.distanceTo(target) };
}

/** Checks for a retarget, in target units: foot ground contact and sliding in each Walk, how far
 * each mapped bone strays from the scaled source pose (exploded limbs), loop seams, key counts.
 * options.original: the target before the retarget (compares Walk ground speed). */
export function measureRetarget(target, source, retarget, { original } = {}) {
  const T = nodeIndex(target), S = nodeIndex(source), { pairs, targetRoles: tr, sourceRoles: sr, sides } = retarget.mapping;
  const rootT = pairs.find(p => p.role === 'root'), k = retarget.scale, out = { sequences: [] };
  for (const seq of retarget.sequences) {
    const entry = { target: seq.target, source: seq.source, keys: seq.keys, sourceKeys: seq.sourceKeys, samples: seq.samples };
    // Strays: each mapped bone relative to the root, against the source (scaled, mirrored).
    let worst = { d: 0 };
    const step = Math.max(1, Math.floor(seq.times.length / 15));
    for (let i = 0; i < seq.times.length; i += step) {
      const t = seq.times[i], st = seq.sourceInterval[0] + ((t - seq.interval[0]) * (seq.sourceInterval[1] - seq.sourceInterval[0])) / Math.max(1, seq.interval[1] - seq.interval[0]);
      const mt = sampleNodeMatrices(target, t, seq.index), ms = sampleNodeMatrices(source, st, seq.sourceIndex);
      const at = (ix, m, id) => ix.pivot(id).applyMatrix4(m.get(id) || I4);
      const rt = at(T, mt, rootT.target), rs = at(S, ms, rootT.source);
      for (const p of pairs) {
        let rel = at(S, ms, p.source).sub(rs).multiplyScalar(k); if (retarget.mirror) rel = mirrorV(rel);
        const d = at(T, mt, p.target).sub(rt).distanceTo(rel);
        if (d > worst.d) worst = { d, bone: p.targetName, role: p.role, t };
      }
    }
    entry.maxStray = { units: r1(worst.d), bone: worst.bone, role: worst.role, frame: worst.t };
    // Loop seam: the posed mesh at the first and last frame of a looping sequence.
    if (!target.Sequences[seq.index].NonLooping) {
      const [a, b] = seq.interval, ma = sampleNodeMatrices(target, a, seq.index), mb = sampleNodeMatrices(target, b, seq.index);
      let seam = 0;
      for (const g of target.Geosets) { const A = skinGeoset(g, ma), B2 = skinGeoset(g, mb); for (let i = 0; i < A.length; i += 3) seam = Math.max(seam, Math.hypot(A[i] - B2[i], A[i + 1] - B2[i + 1], A[i + 2] - B2[i + 2])); }
      entry.loopSeam = r2(seam);
    }
    if (sequenceKind(seq.target) === 'walk') {
      entry.feet = footContact(target, T, tr, seq.index);
      const sFeet = footContact(source, S, sr, seq.sourceIndex);
      entry.sourceFeet = sFeet && { ...sFeet, groundSpeedScaled: r1(sFeet.groundSpeed * k * (seq.sourceInterval[1] - seq.sourceInterval[0]) / Math.max(1, seq.interval[1] - seq.interval[0])), note: 'source units; groundSpeedScaled: at the target size and timing' };
      if (original) { const oi = original.Sequences.findIndex(s => s.Name === seq.target); if (oi >= 0) { const o = footContact(original, nodeIndex(original), rigRoles(original), oi); entry.originalFeet = o && { ...o, moveSpeed: original.Sequences[oi].MoveSpeed, length: original.Sequences[oi].Interval[1] - original.Sequences[oi].Interval[0] }; } }
      entry.length = seq.interval[1] - seq.interval[0];
    }
    out.sequences.push(entry);
  }
  out.totalKeys = keyTotal(target);
  // Untouched sequences (Death, Decay...): the same keys, at most moved in time.
  if (original) {
    const replaced = new Set(retarget.sequences.map(s => s.target)), byName = new Map(allNodes(target).map(n => [n.Name, n]));
    out.untouched = original.Sequences.filter(s => !replaced.has(s.Name)).map(os => {
      const ns = target.Sequences.find(s => s.Name === os.Name);
      if (!ns) return { sequence: os.Name, missing: true };
      const [a, b] = Array.from(os.Interval), c = ns.Interval[0], differ = [];
      let tracks = 0;
      for (const n of allNodes(original)) {
        const m = byName.get(n.Name);
        if (!m) continue;
        for (const p of ['Translation', 'Rotation', 'Scaling']) {
          const k1 = keysIn(n[p], a, b), k2 = keysIn(m[p], c, c + (b - a));
          if (!k1.length && !k2.length) continue;
          tracks++;
          const same = k1.length === k2.length && k1.every((k, i) => k2[i].Frame - c === k.Frame - a && Array.from(k.Vector).every((v, j) => Math.abs(v - k2[i].Vector[j]) < 1e-4));
          if (!same) differ.push(`${n.Name} ${p}`);
        }
      }
      return { sequence: os.Name, moved: c - a, length: [b - a, ns.Interval[1] - c], tracks, differ };
    });
  }
  return out;
}
const keyTotal = model => allNodes(model).reduce((s, n) => s + ['Translation', 'Rotation', 'Scaling'].reduce((x, p) => x + (n[p]?.Keys?.length || 0), 0), 0);

/** Foot contact in one sequence: per foot the planted share, how far below the ground it goes, the
 * planted foot's backward speed (the walk's ground speed, units per second) and how much it slides
 * off that steady speed while planted (units over a step, and sideways). */
function footContact(model, ix, roles, sequenceIndex) {
  const seq = model.Sequences[sequenceIndex], feet = Object.values(roles.legs);
  if (!feet.length) return null;
  const times = frameTimes(seq.Interval, 100), tracks = feet.map(() => []), band = Math.max(1.5, 0.07 * (roles.legLength || 0));
  for (const t of times) { const m = sampleNodeMatrices(model, t, sequenceIndex); feet.forEach((l, i) => tracks[i].push(l.sole.rest.clone().applyMatrix4(m.get(l.sole.node) || I4))); }
  // Planted runs: consecutive samples near the foot's lowest point. The ground speed is the
  // duration-weighted backward slope of the planted feet (least squares over each run).
  const per = feet.map((l, i) => {
    const P = tracks[i], gaps = P.map(p => p.z - l.sole.rest.z), low = Math.min(...gaps), planted = gaps.map(g => g <= low + band), runs = [];
    for (let j = 0; j < P.length;) {
      if (!planted[j]) { j++; continue; }
      let e = j; while (e + 1 < P.length && planted[e + 1]) e++;
      if (e - j >= 2) {
        const ts = times.slice(j, e + 1).map(t => t / 1000), xs = P.slice(j, e + 1).map(p => p.x), mt = ts.reduce((s, x) => s + x, 0) / ts.length, mx = xs.reduce((s, x) => s + x, 0) / xs.length;
        const slope = ts.reduce((s, t, k) => s + (t - mt) * (xs[k] - mx), 0) / Math.max(1e-9, ts.reduce((s, t) => s + (t - mt) ** 2, 0));
        const ys = P.slice(j, e + 1).map(p => p.y);
        runs.push({ ts, xs, slope, duration: ts.at(-1) - ts[0], side: Math.max(...ys) - Math.min(...ys) });
      }
      j = e + 1;
    }
    return { planted: r2(planted.filter(Boolean).length / P.length), lowest: r1(low), runs };
  });
  const runs = per.flatMap(f => f.runs), weight = runs.reduce((s, r) => s + r.duration, 0);
  const groundSpeed = weight > 0 ? -runs.reduce((s, r) => s + r.slope * r.duration, 0) / weight : 0;
  // Slide: how far a planted foot strays from moving back steadily at the ground speed.
  const slide = f => Math.max(0, ...f.runs.map(r => { const rest = r.xs.map((x, k) => x + groundSpeed * (r.ts[k] - r.ts[0])); return Math.max(...rest) - Math.min(...rest); }));
  return { groundSpeed: r1(groundSpeed), feet: per.map(f => ({ planted: f.planted, lowest: f.lowest, slide: r1(slide(f)), sideSlide: r1(Math.max(0, ...f.runs.map(r => r.side))) })) };
}
