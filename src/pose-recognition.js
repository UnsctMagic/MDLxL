import { Quaternion, Vector3 } from 'three';
import { movementBoneVertexCenter } from './movement-selection.js';

// Recognition evidence is computed from the authored model, once per setup.
// No filenames, node IDs, training assets, or edited preview poses are consulted.
export function poseRecognitionEvidence(model) {
  const nodes = [...(model.Bones || []), ...(model.Helpers || [])], byId = new Map(nodes.map(node => [node.ObjectId, node]));
  const children = new Map(), profiles = new Map();
  for (const node of nodes) { const list = children.get(node.Parent) || []; list.push(node); children.set(node.Parent, list); }
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
    profiles.set(node.ObjectId, { swing, clips, skin: skin?.center || null });
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
  const pivot = node => new Vector3().fromArray(node.PivotPoint || model.PivotPoints?.[node.ObjectId] || [0, 0, 0]);
  // Compare mirror geometry about the common branch point. Facing may be X or Y.
  const mirrorError = (a, b, origin, span) => Math.min(...[0, 1].map(axis => {
    const av = a.clone().sub(origin), bv = b.clone().sub(origin);
    if (av.getComponent(axis) * bv.getComponent(axis) >= 0) return Infinity;
    av.setComponent(axis, -av.getComponent(axis)); return av.distanceTo(bv) / Math.max(span, 1e-6);
  }));
  return { nodes, byId, children, profiles, descendants, moving, supported, articulated, links, pivot, mirrorError };
}

/** Unknown branches need both real articulation and a skinned, symmetric peer.
 * Long repeated branches remain generic chains; they are not called feet merely
 * because they point down. This also leaves tiny fingers and rigid props alone. */
export function inferPoseBranches(evidence, roleOf, occupied) {
  const { nodes, children, profiles, moving, supported, links, pivot, mirrorError } = evidence, result = [];
  const excluded = /cloth|cape|banner|hair|beard|finger|thumb|weapon|sword|axe|reins?|chain|decoration|jaw|lip|eye|brow/i;
  for (const parent of nodes) {
    if (excluded.test(parent.Name) || ['Hand','Foot','Hoof','Head','Tail'].includes(roleOf(parent)) || roleOf(parent) === 'Chest' && (children.get(parent.ObjectId) || []).some(node => occupied.has(node.ObjectId))) continue;
    const paths = [];
    for (const first of links(parent.ObjectId)) {
      if (excluded.test(first.Name) || occupied.has(first.ObjectId) || !moving(first)) continue;
      const path = [first], seen = new Set([first.ObjectId]); let next = first;
      while (path.length < 12) {
        const children = links(next.ObjectId);
        if (children.length !== 1 || seen.has(children[0].ObjectId) || occupied.has(children[0].ObjectId) || excluded.test(children[0].Name)) break;
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
  const rootOf = id => { const seen = new Set(); while (evidence.byId.has(evidence.byId.get(id)?.Parent) && !seen.has(id)) { seen.add(id); id = evidence.byId.get(id).Parent; } return id; };
  for (const branch of result.filter(branch => branch.kind === 'leg')) {
    const group = result.filter(other => rootOf(other.ids[0]) === rootOf(branch.ids[0]));
    const bottom = Math.min(...group.map(other => pivot(evidence.byId.get(other.ids.at(-1))).z));
    const start = pivot(evidence.byId.get(branch.ids[0])), end = pivot(evidence.byId.get(branch.ids.at(-1)));
    if (end.z > bottom + start.distanceTo(end) * .3) branch.kind = 'arm';
  }
  return result;
}
