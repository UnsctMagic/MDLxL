import { isWeaponName } from './rig-names.js';
import { Quaternion, Vector3 } from 'three';
import { nodePivot } from './animation.js';
import { movementBoneVertexCenter } from './movement-selection.js';
import { nodeIndex } from './node-hierarchy.js';

// Recognition evidence is computed from the authored model, once per setup.
// No filenames, node IDs, training assets, or edited preview poses are consulted.
export function poseRecognitionEvidence(model) {
  const nodes = [...(model.Bones || []), ...(model.Helpers || [])], tree = nodeIndex(model, nodes), { byId, children } = tree;
  const profiles = new Map();
  const rigidSkinModel = { ...model, Geosets: (model.Geosets || []).filter(geo => !geo.SkinWeights?.length).map(geo => ({ ...geo, Groups: (geo.Groups || []).map(ids => ids.length === 1 ? ids : []) })) };
  for (const node of nodes) {
    let swing = 0, clips = 0;
    for (const sequence of model.Sequences || []) {
      const keys = (node.Rotation?.Keys || []).filter(key => key.Frame >= sequence.Interval[0] && key.Frame <= sequence.Interval[1]);
      if (keys.length < 2) continue;
      const first = new Quaternion().fromArray(keys[0].Vector).normalize();
      const angle = Math.max(...keys.map(key => first.angleTo(new Quaternion().fromArray(key.Vector).normalize())));
      if (Number.isFinite(angle)) { swing = Math.max(swing, angle); if (angle > .01) clips++; }
    }
    const skin = movementBoneVertexCenter(model, node.ObjectId, new Map());
    profiles.set(node.ObjectId, { swing, clips, skin: skin?.center || null, rigidSkin: movementBoneVertexCenter(rigidSkinModel, node.ObjectId, new Map())?.center || null });
  }
  const descendants = id => {
    const result = [], pending = [...(children.get(id) || [])], seen = new Set([id]);
    while (pending.length) { const node = pending.pop(); if (seen.has(node.ObjectId)) continue; seen.add(node.ObjectId); result.push(node); pending.push(...(children.get(node.ObjectId) || [])); }
    return result;
  };
  const moving = node => profiles.get(node.ObjectId)?.swing > .01;
  const supported = node => !!profiles.get(node.ObjectId)?.skin || descendants(node.ObjectId).some(child => profiles.get(child.ObjectId)?.skin);
  const articulated = node => moving(node) || descendants(node.ObjectId).some(moving);
  const links = id => (children.get(id) || []).filter(articulated);
  const pivot = node => new Vector3().fromArray(nodePivot(model, node));
  // Compare mirror geometry about the common branch point. Facing may be X or Y.
  const mirrorError = (a, b, origin, span) => Math.min(...[0, 1].map(axis => {
    const av = a.clone().sub(origin), bv = b.clone().sub(origin);
    if (av.getComponent(axis) * bv.getComponent(axis) >= 0) return Infinity;
    av.setComponent(axis, -av.getComponent(axis)); return av.distanceTo(bv) / Math.max(span, 1e-6);
  }));
  return { nodes, byId, children, tree, profiles, descendants, moving, supported, articulated, links, pivot, mirrorError };
}

/** Unknown branches need both real articulation and a skinned, symmetric peer.
 * Long repeated branches remain generic chains; they are not called feet merely
 * because they point down. This also leaves tiny fingers and rigid props alone. */
export function inferPoseBranches(evidence, roleOf, occupied) {
  const { nodes, children, profiles, moving, supported, links, pivot, mirrorError } = evidence, result = [];
  const excludedExtra = /cloth|cape|banner|hair|beard|finger|thumb|reins?|chain|decoration|jaw|lip|eye|brow/i;
  const excluded = name => isWeaponName(name) || excludedExtra.test(name);
  for (const parent of nodes) {
    if (excluded(parent.Name) || ['Hand','Foot','Hoof','Head','Tail'].includes(roleOf(parent)) || roleOf(parent) === 'Chest' && (children.get(parent.ObjectId) || []).some(node => occupied.has(node.ObjectId))) continue;
    const paths = [];
    for (const first of links(parent.ObjectId)) {
      if (excluded(first.Name) || occupied.has(first.ObjectId) || !moving(first)) continue;
      const path = [first], seen = new Set([first.ObjectId]); let next = first;
      while (path.length < 12) {
        const children = links(next.ObjectId);
        if (children.length !== 1 || seen.has(children[0].ObjectId) || occupied.has(children[0].ObjectId) || excluded(children[0].Name)) break;
        next = children[0]; if (pivot(next).distanceTo(pivot(path.at(-1))) < 1e-5) break;
        path.push(next); seen.add(next.ObjectId);
      }
      if (path.length < 3 || !supported(next) || path.some(node => occupied.has(node.ObjectId) || ['Body','Chest','Pelvis','Head'].includes(roleOf(node)))) continue;
      const length = path.slice(1).reduce((sum, node, i) => sum + pivot(node).distanceTo(pivot(path[i])), 0);
      const origin = pivot(parent), end = pivot(next);
      if (length < 1e-4 || path.filter(moving).length < 2) continue;
      // A joint centered far outside its own mesh is usually an imported mesh
      // origin, not an endpoint. Geometry must support the proposed branch.
      const skin = profiles.get(next.ObjectId).skin;
      if (skin && skin.distanceTo(end) > length * .8) continue;
      paths.push({ path, length, origin, end });
    }
    for (const item of paths) {
      const peer = paths.find(other => other !== item && Math.min(item.length, other.length) / Math.max(item.length, other.length) > .65 && mirrorError(item.end, other.end, item.origin, Math.max(item.length, other.length)) < .4 && mirrorError(pivot(item.path[0]), pivot(other.path[0]), item.origin, Math.max(item.length, other.length)) < .25);
      if (!peer) continue;
      const down = item.end.z < pivot(item.path[0]).z - item.length * .5;
      const repeated = paths.length > 4;
      result.push({ ids: item.path.map(node => node.ObjectId), kind: down && !repeated ? 'leg' : 'arm', ...(repeated ? { label: 'Chain' } : {}) });
    }
  }
  // Among anonymous branches on one actor, ground limbs end substantially
  // lower than its hands. Do not label lowered arms as feet solely by slope.
  const rootOf = evidence.tree.root;
  for (const branch of result.filter(branch => branch.kind === 'leg')) {
    const group = result.filter(other => rootOf(other.ids[0]) === rootOf(branch.ids[0]));
    const bottom = Math.min(...group.map(other => pivot(evidence.byId.get(other.ids.at(-1))).z));
    const start = pivot(evidence.byId.get(branch.ids[0])), end = pivot(evidence.byId.get(branch.ids.at(-1)));
    if (end.z > bottom + start.distanceTo(end) * .3) branch.kind = 'arm';
  }
  return result;
}

/** A name is a strong clue, never a veto over the skeleton. Returns role overrides
 * `{ ObjectId: role }` for names the skeleton contradicts:
 * a mirrored pair of siblings that each carry a limb is no central trunk part
 * (they become ordinary joints and the shared parent takes the pair's name), and
 * a body, pelvis, chest or spine hanging below a head is no trunk part. */
export function poseNameConflicts(model, evidence, nameRole, roles = {}) {
  const { nodes, byId, children, pivot, mirrorError } = evidence, out = {};
  const roleOf = node => roles[node.ObjectId] || nameRole(node);
  const below = new Map();
  for (const node of [...nodes, ...(model.Attachments || [])]) { if (node.Parent == null) continue; const list = below.get(node.Parent) || []; list.push(node); below.set(node.Parent, list); }
  // Limb ends at least two levels below a node, with a joint in between.
  const limbKinds = node => {
    const kinds = new Set(), seen = new Set([node.ObjectId]); let level = [node], depth = 0;
    while (level.length && depth < 16) {
      const next = []; depth++;
      for (const item of level) for (const child of below.get(item.ObjectId) || []) {
        if (seen.has(child.ObjectId)) continue; seen.add(child.ObjectId); next.push(child);
        if (depth >= 2) { const role = roleOf(child); if (role === 'Hand') kinds.add('arm'); else if (role === 'Foot' || role === 'Hoof') kinds.add('leg'); }
      }
      level = next;
    }
    return kinds;
  };
  const trunk = ['Pelvis', 'Body', 'Chest'], keep = ['Head', 'Neck', 'Chest', 'Spine', 'Pelvis', 'Body', 'Tail', 'Wing', 'Hand', 'Foot', 'Hoof'];
  for (const [parentId, siblings] of children) {
    const parent = byId.get(parentId); if (!parent) continue;
    const group = siblings.filter(node => trunk.includes(nameRole(node)));
    for (let i = 0; i < group.length; i++) for (let j = i + 1; j < group.length; j++) {
      const a = group[i], b = group[j], role = nameRole(a);
      if (nameRole(b) !== role) continue;
      const span = Math.max(pivot(a).distanceTo(pivot(parent)), pivot(b).distanceTo(pivot(parent)));
      if (!(mirrorError(pivot(a), pivot(b), pivot(parent), span) < .25)) continue;
      const ka = limbKinds(a), kb = limbKinds(b);
      if (![...ka].some(kind => kb.has(kind))) continue;
      for (const node of [a, b]) out[node.ObjectId] = node.Name || 'Object';
      if (!keep.includes(nameRole(parent)) && roles[parentId] === undefined) out[parentId] = role;
    }
  }
  for (const node of nodes) {
    if (out[node.ObjectId] !== undefined || !['Body', 'Pelvis', 'Chest', 'Spine'].includes(nameRole(node))) continue;
    let up = byId.get(node.Parent);
    for (let guard = 0; up && guard < 64; guard++, up = byId.get(up.Parent)) if (roleOf(up) === 'Head') { out[node.ObjectId] = 'Object'; break; }
  }
  return out;
}
