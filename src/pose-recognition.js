import { isClothName, isWeaponName, nameLimbTop, nameRegion } from './rig-names.js';
import { Matrix4, Quaternion, Vector3 } from 'three';
import { allNodes, nodePivot, sampleNodeMatrices } from './animation.js';
import { poseNodeRole } from './pose-ik.js';
import { standSequenceIndex } from './sequence-editor.js';
import { movementBoneVertexCenter } from './movement-selection.js';
import { nodeIndex } from './node-hierarchy.js';
import { vertexBones } from './part-bones.js';

// Recognition evidence is computed from the authored model, once per setup.
// No filenames, node IDs, training assets, or edited preview poses are consulted.
export function poseRecognitionEvidence(model, { clues = true } = {}) {
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
  // Motion is a clue only when the unit has any; an unanimated unit is read without it.
  const animated = nodes.some(node => profiles.get(node.ObjectId)?.swing > .01);
  const moving = node => !animated || profiles.get(node.ObjectId)?.swing > .01;
  const supported = node => !!profiles.get(node.ObjectId)?.skin || descendants(node.ObjectId).some(child => profiles.get(child.ObjectId)?.skin);
  const articulated = node => moving(node) || descendants(node.ObjectId).some(moving);
  const links = id => (children.get(id) || []).filter(articulated);
  // The real-motion versions: searching for unnamed limbs always needs actual motion.
  const realMoving = node => profiles.get(node.ObjectId)?.swing > .01;
  const realArticulated = node => realMoving(node) || descendants(node.ObjectId).some(realMoving);
  const strict = { moving: realMoving, articulated: realArticulated, links: id => (children.get(id) || []).filter(realArticulated) };
  // Without the added clues, motion is read strictly (as the classic rig does).
  const pivot = node => new Vector3().fromArray(nodePivot(model, node));
  // Compare mirror geometry about the common branch point. Facing may be X or Y.
  const mirrorError = (a, b, origin, span) => Math.min(...[0, 1].map(axis => {
    const av = a.clone().sub(origin), bv = b.clone().sub(origin);
    if (av.getComponent(axis) * bv.getComponent(axis) >= 0) return Infinity;
    av.setComponent(axis, -av.getComponent(axis)); return av.distanceTo(bv) / Math.max(span, 1e-6);
  }));
  return { nodes, byId, children, tree, profiles, descendants, animated, moving: clues ? moving : realMoving, supported, articulated: clues ? articulated : realArticulated, links: clues ? links : strict.links, strict, pivot, mirrorError };
}

const excludedExtra = /cloth|cape|banner|hair|beard|finger|thumb|reins?|chain|decoration|jaw|lip|eye|brow/i;
/** Names that never start or continue an inferred limb branch. */
export const poseExcludedBranchName = name => isWeaponName(name) || excludedExtra.test(name);

// Eigenvalues (descending) of a symmetric 3x3 matrix by Jacobi rotations.
function eigenvalues3(matrix) {
  const a = matrix.map(row => row.slice());
  for (let sweep = 0; sweep < 60; sweep++) {
    if (a[0][1] ** 2 + a[0][2] ** 2 + a[1][2] ** 2 < 1e-24) break;
    for (const [p, q] of [[0, 1], [0, 2], [1, 2]]) {
      if (Math.abs(a[p][q]) < 1e-30) continue;
      const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]), t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < 3; k++) { const akp = a[k][p], akq = a[k][q]; a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq; }
      for (let k = 0; k < 3; k++) { const apk = a[p][k], aqk = a[q][k]; a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk; }
    }
  }
  return [a[0][0], a[1][1], a[2][2]].sort((x, y) => y - x);
}

/** How sheet-like the skin on some joints is: sqrt(l3 / l2) of the eigenvalues
 * of the covariance of the rest-pose vertices bound (any nonzero weight) to those
 * joints or their descendant joints. Near 0 is a sheet (a wing), near 1 a tube.
 * Null with fewer than 8 vertices or no second spread. */
export function poseSkinFlatness(model, evidence, ids) {
  const bound = new Set(ids);
  for (const id of ids) for (const node of evidence.descendants(id)) bound.add(node.ObjectId);
  const points = [];
  for (const geoset of model.Geosets || []) {
    const count = (geoset.Vertices?.length || 0) / 3;
    for (let vertex = 0; vertex < count; vertex++) if (vertexBones(geoset, vertex).some(bone => bound.has(bone))) points.push([geoset.Vertices[vertex * 3], geoset.Vertices[vertex * 3 + 1], geoset.Vertices[vertex * 3 + 2]]);
  }
  if (points.length < 8) return null;
  const mean = [0, 1, 2].map(i => points.reduce((sum, point) => sum + point[i], 0) / points.length);
  const cov = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const point of points) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) cov[i][j] += (point[i] - mean[i]) * (point[j] - mean[j]) / points.length;
  const [, l2, l3] = eigenvalues3(cov).map(value => Math.max(0, value));
  return l2 > 0 ? Math.sqrt(l3 / l2) : null;
}

/** Unknown branches need both real articulation and a skinned, symmetric peer.
 * Long repeated branches remain generic chains; they are not called feet merely
 * because they point down. This also leaves tiny fingers and rigid props alone. */
export function inferPoseBranches(evidence, roleOf, occupied, model = null, clues = true) {
  const { nodes, byId, children, profiles, supported, pivot, mirrorError } = evidence, { moving, links } = evidence.strict, result = [];
  // A weapon word excludes only what is held: a joint below a hand. Other names
  // (cloth, hair, fingers...) still exclude as before.
  const held = node => evidence.tree.ancestors(node.ObjectId).some(id => roleOf(byId.get(id)) === 'Hand');
  const excluded = node => clues ? (isWeaponName(node.Name) && held(node)) || excludedExtra.test(node.Name) : poseExcludedBranchName(node.Name);
  const oldExcluded = node => poseExcludedBranchName(node.Name);
  const unpaired = new Map(), emitted = new Set(), isNew = new Set();
  // A branch found only by the weapon-word or mirrored-sibling rules adds where
  // nothing exists: a joint already read as a body part by name keeps that.
  const partRoles = ['Head', 'Neck', 'Chest', 'Spine', 'Pelvis', 'Body', 'Tail', 'Wing'];
  const named = path => path.some(node => partRoles.includes(roleOf(node)));
  for (const parent of nodes) {
    if (excluded(parent) || ['Hand','Foot','Hoof','Head','Tail'].includes(roleOf(parent)) || roleOf(parent) === 'Chest' && (children.get(parent.ObjectId) || []).some(node => occupied.has(node.ObjectId))) continue;
    const paths = [];
    for (const first of links(parent.ObjectId)) {
      if (excluded(first) || occupied.has(first.ObjectId) || !moving(first)) continue;
      const path = [first], seen = new Set([first.ObjectId]); let next = first;
      while (path.length < 12) {
        const children = links(next.ObjectId);
        if (children.length !== 1 || seen.has(children[0].ObjectId) || occupied.has(children[0].ObjectId) || excluded(children[0])) break;
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
      paths.push({ path, length, origin, end, fresh: oldExcluded(parent) || path.some(oldExcluded) });
    }
    unpaired.set(parent.ObjectId, []);
    for (const item of paths) {
      const peer = paths.find(other => other !== item && Math.min(item.length, other.length) / Math.max(item.length, other.length) > .65 && mirrorError(item.end, other.end, item.origin, Math.max(item.length, other.length)) < .4 && mirrorError(pivot(item.path[0]), pivot(other.path[0]), item.origin, Math.max(item.length, other.length)) < .25);
      if (!peer) { unpaired.get(parent.ObjectId).push(item); continue; }
      if (item.fresh && named(item.path)) continue;
      const down = item.end.z < pivot(item.path[0]).z - item.length * .5;
      const repeated = paths.length > 4;
      result.push({ ids: item.path.map(node => node.ObjectId), kind: down && !repeated ? 'leg' : 'arm', ...(repeated ? { label: 'Chain' } : {}) });
      item.path.forEach(node => emitted.add(node.ObjectId));
      if (item.fresh) isNew.add(result.at(-1));
    }
  }
  // A mirrored partner may hang from the mirrored sibling joint (wings grow from
  // two shoulders, not from one parent).
  for (const parent of clues ? nodes : []) {
    const group = byId.get(parent.Parent);
    if (!group) continue;
    for (const first of unpaired.get(parent.ObjectId) || []) {
      if (first.path.some(node => emitted.has(node.ObjectId))) continue;
      for (const sibling of children.get(group.ObjectId) || []) {
        if (sibling === parent || !byId.has(sibling.ObjectId)) continue;
        const span = Math.max(pivot(parent).distanceTo(pivot(group)), pivot(sibling).distanceTo(pivot(group)));
        if (!(mirrorError(pivot(parent), pivot(sibling), pivot(group), span) < .25)) continue;
        const origin = pivot(group);
        const other = (unpaired.get(sibling.ObjectId) || []).find(item => !item.path.some(node => emitted.has(node.ObjectId)) && Math.min(first.length, item.length) / Math.max(first.length, item.length) > .65 && mirrorError(first.end, item.end, origin, Math.max(first.length, item.length)) < .4 && mirrorError(pivot(first.path[0]), pivot(item.path[0]), origin, Math.max(first.length, item.length)) < .25);
        if (!other || named(first.path) || named(other.path)) continue;
        for (const item of [first, other]) {
          const down = item.end.z < pivot(item.path[0]).z - item.length * .5;
          result.push({ ids: item.path.map(node => node.ObjectId), kind: down ? 'leg' : 'arm' });
          isNew.add(result.at(-1));
          item.path.forEach(node => emitted.add(node.ObjectId));
        }
        break;
      }
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
  // Hands that hang down are no feet: a branch that hangs from the joint its head or neck also hangs from (a chest), and
  // ends higher above the lowest skinned joint of its skeleton than the branch is long, is an arm (R2: the Steam Tank
  // commander's arms over the tank's wheels; a four-legged body's front legs reach its lowest joints and stay legs).
  if (clues) for (const branch of result.filter(branch => branch.kind === 'leg')) {
    const first = byId.get(branch.ids[0]), parent = byId.get(first?.Parent);
    if (!parent || !(children.get(parent.ObjectId) || []).some(node => ['Head', 'Neck'].includes(roleOf(node)))) continue;
    const top = rootOf(branch.ids[0]), skinned = nodes.filter(node => rootOf(node.ObjectId) === top && supported(node));
    const bottom = Math.min(...skinned.map(node => pivot(node).z)), start = pivot(first), end = pivot(byId.get(branch.ids.at(-1)));
    const length = branch.ids.slice(1).reduce((sum, id, i) => sum + pivot(byId.get(id)).distanceTo(pivot(byId.get(branch.ids[i]))), 0);
    if (Number.isFinite(bottom) && end.z > bottom + Math.max(length, start.distanceTo(end))) branch.kind = 'arm';
  }
  // A branch the names alone would have hidden, whose skin is a sheet, is a wing.
  if (model) for (const branch of isNew) if (branch.kind === 'arm') {
    const flat = poseSkinFlatness(model, evidence, branch.ids);
    if (flat != null && flat < .3) branch.label = 'Wing';
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
        if (depth >= 2) { const role = roleOf(child), kind = role === 'Hand' ? 'arm' : role === 'Foot' || role === 'Hoof' ? 'leg' : null; if (kind && !kinds.has(kind)) { kinds.add(kind); (kinds.depths ||= {})[kind] = depth; } }
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
      const shared = [...ka].filter(kind => kb.has(kind));
      if (!shared.length) continue;
      // Below a holder that never moves (a mesh pivot), whatever its name, a pair
      // that is not the limb's own top joint (its hand or foot lies more than two
      // joints below) is the moving trunk and keeps its names.
      if (!evidence.moving(parent) && shared.every(kind => Math.min(ka.depths[kind], kb.depths[kind]) > 2)) continue;
      for (const node of [a, b]) out[node.ObjectId] = node.Name || 'Object';
      if (!keep.includes(nameRole(parent)) && roles[parentId] === undefined) out[parentId] = role;
    }
  }
  for (const node of nodes) {
    if (out[node.ObjectId] !== undefined || !['Body', 'Pelvis', 'Chest', 'Spine'].includes(nameRole(node))) continue;
    let up = byId.get(node.Parent);
    for (let guard = 0; up && guard < 64; guard++, up = byId.get(up.Parent)) if (roleOf(up) === 'Head') { out[node.ObjectId] = 'Object'; break; }
  }
  // In a single file of same-named hand (or foot) joints, the one that moves and
  // carries the matching attachment is the end; the joints above it are ordinary.
  const kindOf = node => { const role = nameRole(node); return role === 'Hand' ? 'Hand' : role === 'Foot' || role === 'Hoof' ? 'Foot' : null; };
  const jointKids = (node, kind) => (children.get(node.ObjectId) || []).filter(child => kindOf(child) === kind);
  for (const attachment of model.Attachments || []) {
    const end = byId.get(attachment.Parent), kind = end && kindOf(end);
    if (!kind || kindOf(attachment) !== kind) continue;
    const run = [end];
    for (let up = byId.get(end.Parent); up && kindOf(up) === kind && jointKids(up, kind).length === 1 && run.length < 64 && !run.includes(up); up = byId.get(up.Parent)) run.unshift(up);
    if (run.length < 2 || !run.every(evidence.moving)) continue;
    // Only at the trunk: a foot with legs above it is already the limb end.
    const grand = byId.get(byId.get(run[0].Parent)?.Parent);
    if (grand && !['Chest', 'Pelvis', 'Body', 'Spine', 'Neck', 'Head'].includes(roles[grand.ObjectId] || nameRole(grand))) continue;
    for (const node of run.slice(0, -1)) if (out[node.ObjectId] === undefined && roles[node.ObjectId] === undefined) out[node.ObjectId] = node.Name || 'Object';
  }
  return out;
}

/** Clues add, none removes: part handles the names did not give but the skeleton
 * shows. Only joints without any role are named, so nothing found earlier changes.
 * Pelvis: the joint two or more legs hang from, unless a pelvis already sits
 * next to it or it is a front junction (a head lies beyond it and either no arm
 * hangs from it or a leg-only junction sits beside or above it). Neck: a moving
 * joint strictly between an outermost head and the first trunk part, body or
 * limb-carrying joint above it. Returns `{ ObjectId: 'Pelvis' | 'Neck' }`. */
export function posePartGaps({ evidence, tree, chains, roles, roleOf, body, chainIds, excluded = () => false }) {
  const { nodes, byId, children, descendants, moving } = evidence, out = {};
  const named = ['Head', 'Neck', 'Chest', 'Spine', 'Pelvis', 'Body', 'Tail', 'Wing', 'Hand', 'Foot', 'Hoof', 'Object'];
  const roleNow = id => out[id] || roleOf(byId.get(id));
  const hasRole = id => excluded(byId.get(id)) || roles[id] !== undefined || out[id] !== undefined || named.includes(roleOf(byId.get(id)));
  const limbJoints = new Set(chains.flatMap(chainIds));
  const legRoots = chains.filter(chain => chain.kind === 'leg' && chain.label !== 'Chain').map(chain => chainIds(chain)[0]);
  const armRoots = chains.filter(chain => chain.kind === 'arm' && !chain.label).map(chain => chainIds(chain)[0]);
  const hasHead = id => descendants(id).some(node => roleNow(node.ObjectId) === 'Head');
  const junctions = nodes.filter(joint => legRoots.filter(root => byId.get(root)?.Parent === joint.ObjectId).length >= 2);
  for (const joint of junctions) {
    const id = joint.ObjectId;
    if (id === body || limbJoints.has(id) || hasRole(id)) continue;
    if (tree.ancestors(id).some(up => roleNow(up) === 'Pelvis') || (children.get(id) || []).some(child => roleNow(child.ObjectId) === 'Pelvis')) continue;
    const below = descendants(id).map(node => node.ObjectId);
    if (hasHead(id) && (!armRoots.some(root => below.includes(root)) || junctions.some(other => other.ObjectId !== id && !hasHead(other.ObjectId) && (other.Parent === joint.Parent || tree.ancestors(id).includes(other.ObjectId))))) continue;
    out[id] = 'Pelvis';
  }
  const stops = ['Chest', 'Spine', 'Pelvis', 'Body'], limbRoots = new Set(chains.map(chain => chainIds(chain)[0]));
  const carriesLimb = id => descendants(id).some(node => limbRoots.has(node.ObjectId));
  for (const head of nodes) {
    if (roleNow(head.ObjectId) !== 'Head' || tree.ancestors(head.ObjectId).some(up => roleNow(up) === 'Head')) continue;
    const between = [];
    let trunk = false;
    for (const up of tree.ancestors(head.ObjectId)) {
      if (up === body || stops.includes(roleNow(up)) || carriesLimb(up)) { trunk = true; break; }
      between.push(up);
    }
    if (!trunk) continue;
    for (const id of between) if (!hasRole(id) && !limbJoints.has(id) && moving(byId.get(id))) out[id] = 'Neck';
  }
  return out;
}

// The poses poseLimbOrCloth reads, kept with the evidence they belong to (one
// snapshot of the model, as the evidence is).
const limbOrClothPoses = new WeakMap();
function limbOrClothPose(model, evidence, sequence) {
  const sequences = model.Sequences || [];
  let stand = Number.isInteger(sequence) && sequences[sequence]?.Interval ? sequence : standSequenceIndex(model);
  if (!(stand >= 0 && sequences[stand]?.Interval)) stand = sequences.findIndex(item => item?.Interval);
  let byStand = limbOrClothPoses.get(evidence);
  if (!byStand) limbOrClothPoses.set(evidence, byStand = new Map());
  if (byStand.has(stand)) return byStand.get(stand);
  const byId = new Map(allNodes(model).map(node => [node.ObjectId, node]));
  const bind = id => new Vector3().fromArray(nodePivot(model, byId.get(id), id));
  const reference = stand >= 0 ? sampleNodeMatrices(model, sequences[stand].Interval[0], stand) : null;
  const walk = sequences.findIndex(item => item?.Interval && /^\s*walk/i.test(item.Name || ''));
  const steps = walk < 0 ? null : Array.from({ length: 16 }, (_, i) => { const [a, z] = sequences[walk].Interval; return sampleNodeMatrices(model, a + (z - a) * i / 16, walk); });
  const at = (id, matrices) => bind(id).applyMatrix4(matrices?.get(id) || reference?.get(id) || new Matrix4());
  const result = { byId, bind, reference, steps, at };
  byStand.set(stand, result);
  return result;
}

/** Whether a chain the rig reads as a leg is a limb or hanging cloth, from several clues.
 * -> { kind: 'limb' | 'cloth' | 'unsure', score, clues: { attach, flat, reach, phase, name } }
 * Clues (cloth positive, limb negative), measured over a real corpus first
 * (docs/agent-tasks/recognition-limb-or-cloth.md, part A):
 * - attach: the chain hangs from the joint the arms hang from (the nearest common
 *   ancestor of the arms' roots on its skeleton) while another leg does not: +2.
 * - flat: its skin is a sheet (`poseSkinFlatness` under .3): +2; a tube (over .5): -2.
 * - reach: its end, in the first frame of Stand, reaches the floor (within 5% of the
 *   skeleton's height of its lowest leg end): -2; stops short (over 15%) while
 *   another leg reaches it: +1.
 * - phase: in Walk, its end swings forward with its mirrored partner's (correlation
 *   over .5): +1; against it (under -.5): -2.
 * - name: a cloth word: +2; a leg, foot or hoof name: -3.
 * `cloth` needs a score of 3 or more from at least two clues that agree; 0 or less is
 * `limb`; between is `unsure`, which every caller treats as `limb` (today's reading).
 * `suggestPoseRig` asks this for every leg and carries a `cloth` answer on the chain.
 * `sequence` is the Stand to read the floor in (default: the model's Stand). */
export function poseLimbOrCloth(model, rig, chain, { evidence, sequence } = {}) {
  evidence ||= poseRecognitionEvidence(model);
  const { tree } = evidence, { byId, bind, reference, steps, at } = limbOrClothPose(model, evidence, sequence);
  const idsOf = item => item?.joints || [item?.root, item?.middle, item?.end];
  // A chain the rig already carries as cloth (`suggestPoseRig`) is measured with the legs and is
  // none of the arms, so the answer is the same on a rig read before or after it was marked.
  const leg = item => item.kind === 'leg' && item.label !== 'Wing' || item.cloth === true, arm = item => item.kind === 'arm' && item.label !== 'Wing' && !item.cloth;
  const skeleton = tree.root(chain.root), legs = (rig.chains || []).filter(item => leg(item) && tree.root(item.root) === skeleton);
  if (!legs.includes(chain)) legs.push(chain);
  const lengthOf = item => { const ids = idsOf(item); let sum = 0; for (let i = 1; i < ids.length; i++) sum += bind(ids[i]).distanceTo(bind(ids[i - 1])); return sum; };
  const commonAncestor = ids => { if (!ids.length) return null; for (const id of tree.ancestors(ids[0])) if (ids.every(other => other !== id && tree.isAncestor(other, id))) return id; return null; };
  // Attach: under the arms' joint, while another leg of this skeleton is not (not a flat rig).
  const armRoots = (rig.chains || []).filter(item => arm(item) && tree.root(item.root) === skeleton).map(item => item.root);
  const junction = armRoots.length >= 2 ? commonAncestor(armRoots) : null;
  const underJunction = item => junction != null && item.root !== junction && tree.isAncestor(item.root, junction);
  const attach = junction == null || legs.every(underJunction) ? null : underJunction(chain) ? 1 : 0;
  const ids = idsOf(chain), flat = poseSkinFlatness(model, evidence, ids);
  // Reach: height above the skeleton's lowest leg end, over the skeleton's joint height.
  let reach = null, othersReach = false;
  if (reference) {
    const heights = evidence.nodes.filter(node => tree.root(node.ObjectId) === skeleton).map(node => at(node.ObjectId, reference).z);
    const height = Math.max(...heights) - Math.min(...heights), ends = new Map(legs.map(item => [item, at(item.end, reference).z])), lowest = Math.min(...ends.values());
    const reachOf = item => (ends.get(item) - lowest) / height;
    if (height > 1e-6) { reach = reachOf(chain); othersReach = legs.some(item => item !== chain && reachOf(item) < .05); }
  }
  // Phase: the forward swing of this end against its mirrored partner's, in Walk.
  let phase = null;
  if (steps) {
    const length = lengthOf(chain);
    let partner = null, best = Infinity;
    for (const other of legs) {
      if (other === chain) continue;
      const otherLength = lengthOf(other);
      if (Math.min(length, otherLength) / Math.max(length, otherLength) <= .65) continue;
      const origin = commonAncestor([chain.root, other.root]);
      if (origin == null) continue;
      const span = Math.max(length, otherLength), error = evidence.mirrorError(bind(chain.end), bind(other.end), bind(origin), span) + evidence.mirrorError(bind(chain.root), bind(other.root), bind(origin), span);
      if (error < .4 && error < best) { best = error; partner = other; }
    }
    if (partner) {
      const swing = item => steps.map(matrices => at(item.end, matrices).sub(at(item.root, matrices)));
      const a = swing(chain), b = swing(partner), moves = list => Math.max(...list.map(p => p.distanceTo(list[0])));
      if (moves(a) >= .05 * length && moves(b) >= .05 * lengthOf(partner)) {
        const x = a.map(p => p.x), y = b.map(p => p.x), mx = x.reduce((s, v) => s + v, 0) / x.length, my = y.reduce((s, v) => s + v, 0) / y.length;
        let sxy = 0, sxx = 0, syy = 0;
        for (let i = 0; i < x.length; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
        phase = sxx < 1e-12 || syy < 1e-12 ? null : sxy / Math.sqrt(sxx * syy);
      }
    }
  }
  const roleOf = id => rig.roles?.[id] || poseNodeRole(byId.get(id));
  const name = ids.some(id => nameRegion(byId.get(id)?.Name) === 'leg' || ['Foot', 'Hoof'].includes(roleOf(id))) ? 'limb' : ids.some(id => isClothName(byId.get(id)?.Name)) ? 'cloth' : null;
  const parts = [];
  if (attach === 1) parts.push(2);
  if (flat != null) parts.push(flat < .3 ? 2 : flat > .5 ? -2 : 0);
  if (reach != null) parts.push(reach < .05 ? -2 : reach > .15 && othersReach ? 1 : 0);
  if (phase != null) parts.push(phase > .5 ? 1 : phase < -.5 ? -2 : 0);
  if (name) parts.push(name === 'cloth' ? 2 : -3);
  const score = parts.reduce((sum, value) => sum + value, 0), agree = parts.filter(value => value > 0).length;
  return { kind: score >= 3 && agree >= 2 ? 'cloth' : score <= 0 ? 'limb' : 'unsure', score, clues: { attach, flat, reach, phase, name } };
}

/** Where a limb itself starts among the joints that lead to it. A handle chain is the last three
 * joints (top, bend, end); a joint above its top is either a piece of the girdle (collar,
 * shoulder, hip) or the limb's own upper part (a thigh above a hock chain, an upper arm above a
 * split forearm). `points` are the joints' rest positions from the trunk outward, `names` their
 * names, `top` and `end` the indices of the chain's top and end, `kind` 'arm' or 'leg'.
 * Returns the index of the limb's first joint (`top` or less).
 * Clues per joint above, measured over 1,200 models (docs/agent-tasks/xfer-both-ways.md):
 * - length: its length against the limb below it; .45 or more: +2, else -2.
 * - line: it lies along the limb (within 35 degrees of the line to the end): +1; over 60: -1.
 * - name: an upper-arm or thigh word: +1; a collar or shoulder word: -1.
 * Part of the limb needs a score of 2 or more from at least two clues that agree; anything
 * else stays above the limb (the reading before this rule). No single clue decides. */
export function poseLimbStart(points, names, top, end, kind) {
  let start = top;
  while (start > 0) {
    const from = points[start], segment = from.clone().sub(points[start - 1]);
    let reach = 0;
    for (let j = start; j < end; j++) reach += points[j + 1].distanceTo(points[j]);
    if (!(reach > 1e-6) || segment.length() < 1e-6) break;
    const angle = segment.angleTo(points[end].clone().sub(from)) * 180 / Math.PI, says = nameLimbTop(names[start - 1], kind);
    const clues = [segment.length() / reach >= .45 ? 2 : -2, angle < 35 ? 1 : angle > 60 ? -1 : 0, says === 'limb' ? 1 : says === 'girdle' ? -1 : 0];
    if (clues.reduce((sum, value) => sum + value, 0) < 2 || clues.filter(value => value > 0).length < 2) break;
    start--;
  }
  return start;
}
