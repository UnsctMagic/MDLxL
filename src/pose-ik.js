import { Quaternion, Vector3 } from 'three';
import { allNodes, sampleNodeMatrices, sampleTrack } from './animation.js';
import { movementBoneVertexCenter } from './movement-selection.js';
import { poseRecognitionEvidence, inferPoseBranches } from './pose-recognition.js';
import { constrainMovementVector, applyMovementTransform, movementParentMatrix, movementProperties, prepareMovementPose, sampleMovement } from './movement.js';

// POSE controls are editor-session identities. Only the resulting native keys
// pass through Movement's transactional writer; no controller enters the rig.
const v3 = value => value?.isVector3 ? value.clone() : new Vector3().fromArray(value);
const finite = value => {
  if (!value) return false;
  for (let i = 0; i < value.length; i++) if (!Number.isFinite(value[i])) return false;
  return true;
};
const transformNodes = model => [...(model.Bones || []), ...(model.Helpers || [])];
const options = (model, frame, sequence, globalTime) => ({ interval: model.Sequences?.[sequence]?.Interval, globalSequences: model.GlobalSequences, globalTime });

function hierarchy(model, ids) {
  const nodes = allNodes(model), byId = new Map(nodes.map(node => [node.ObjectId, node]));
  if (new Set(ids).size !== ids.length || ids.some(id => !byId.has(id))) throw new Error('Choose distinct nodes from this model.');
  for (const id of ids) {
    const seen = new Set(); let node = byId.get(id);
    while (node) {
      if (seen.has(node.ObjectId)) throw new Error('POSE cannot use a cyclic hierarchy.');
      seen.add(node.ObjectId);
      if (node.Flags & 120) throw new Error('POSE cannot use billboarding joints or ancestors.');
      if (node.Flags & 7) throw new Error('POSE cannot use non-default inherited transforms: this preview renderer does not reproduce those flags.');
      if (!finite(node.PivotPoint || model.PivotPoints?.[node.ObjectId])) throw new Error('A POSE joint has a missing or invalid pivot.');
      if (node.Parent == null || node.Parent < 0) break;
      node = byId.get(node.Parent);
      if (!node) throw new Error('A POSE joint has a missing parent.');
    }
  }
  return byId;
}

export const poseChainIds = chain => chain?.joints || [chain?.root, chain?.middle, chain?.end];

export function validatePoseChain(model, chain) {
  const ids = poseChainIds(chain), byId = hierarchy(model, ids);
  if (chain.grip && (chain.grip.length !== 3 || !finite(chain.grip))) throw new Error('The limb grip must be a finite point.');
  const joints = new Set(transformNodes(model).map(node => node.ObjectId));
  if (!joints.has(chain.root) || !joints.has(chain.middle)) throw new Error('The upper joint and elbow / knee must be Bone or Helper nodes.');
  if (ids.length < 3 || ids[1] !== chain.middle || ids[0] !== chain.root || ids.at(-1) !== chain.end || ids.slice(1).some((id, i) => chain.joints ? !descendantOf(model, id, ids[i]) : byId.get(id).Parent !== ids[i])) throw new Error('POSE requires two adjacent parent links. Include intervening helpers; joints are never skipped.');
  return ids.map(id => byId.get(id));
}

/** Build a user-picked chain along the existing hierarchy; excluded helpers
 * still inherit normally but do not receive their own IK rotation keys. */
export function poseChainBetween(model, root, end, excluded = []) {
  if (root == null || end == null) throw new Error('Choose both Start and End.');
  const byId = new Map(allNodes(model).map(node => [node.ObjectId, node])), path = [], seen = new Set();
  let node = byId.get(end);
  while (node && !seen.has(node.ObjectId)) {
    path.unshift(node.ObjectId); seen.add(node.ObjectId);
    if (node.ObjectId === root) break;
    node = byId.get(node.Parent);
  }
  if (path[0] !== root) throw new Error('Start must be above End in the same bone branch.');
  const joints = path.filter(id => id === root || id === end || !excluded.includes(id));
  if (joints.length < 3) throw new Error('Keep at least one bending joint between Start and End.');
  const chain = { root, middle: joints[1], end, joints };
  validatePoseChain(model, chain);
  return chain;
}

export function suggestPoseChain(model, endpoint) {
  const nodes = allNodes(model), byId = new Map(nodes.map(node => [node.ObjectId, node])), end = byId.get(endpoint);
  let middle = byId.get(end?.Parent), root = byId.get(middle?.Parent);
  // Mesh pivots are not always anatomical joints. A lower-leg joint plus its
  // skinned foot still form a rigid chain through intervening mesh nodes.
  const ancestors = []; let ancestor = middle;
  while (ancestor && !ancestors.includes(ancestor)) { ancestors.push(ancestor); ancestor = byId.get(ancestor.Parent); }
  const knee = ancestors.find(node => /(?:leg2|calf|shin|knee)(?:$|[ _.-])/i.test(node.Name));
  if (knee && !/hoof/i.test(end?.Name || '') && !ancestors.some(node => /leg3/i.test(node.Name))) {
    middle = knee; root = byId.get(knee.Parent);
  }
  let chain = { root: root?.ObjectId, middle: middle?.ObjectId, end: end?.ObjectId };
  if (middle && root && end && end.Parent !== middle.ObjectId) chain.joints = [root.ObjectId, middle.ObjectId, end.ObjectId];
  if (/hoof/i.test(end?.Name || '')) {
    const joints = [end.ObjectId]; let node = byId.get(end.Parent);
    while (node && /(?:leg[0-9]*|calf|shin|knee|thigh)(?:$|[ _.-])/i.test(node.Name)) { joints.unshift(node.ObjectId); node = byId.get(node.Parent); }
    if (joints.length >= 3) chain = { root: joints[0], middle: joints[1], end: endpoint, joints, label: 'Hoof' };
  }
  if (!chain.joints) {
    const upper = ancestors.find(node => /(?:arm1|upperarm|thigh|leg1)(?:$|[ _.-])/i.test(node.Name));
    if (upper && upper !== root) {
      const links = ancestors.slice(0, ancestors.indexOf(upper) + 1).reverse().map(node => node.ObjectId).concat(endpoint);
      if (links.length > 3) chain = { ...chain, root: links[0], middle: links[1], joints: links };
    }
  }
  validatePoseChain(model, chain); return chain;
}

/** Extend an endpoint suggestion through its unbranched limb, stopping at the
 * first shared body joint. Uses native links and authored articulation. */
export function suggestPickedPoseChain(model, endpoint) {
  const chain = suggestPoseChain(model, endpoint), nodes = transformNodes(model);
  const byId = new Map(nodes.map(node => [node.ObjectId, node]));
  const children = new Map();
  for (const node of nodes) { const list = children.get(node.Parent) || []; list.push(node); children.set(node.Parent, list); }
  const links = poseChainIds(chain).slice(), seen = new Set(links);
  let parent = byId.get(byId.get(links[0])?.Parent);
  while (parent && !seen.has(parent.ObjectId)) {
    const branches = (children.get(parent.ObjectId) || []).filter(node => node.Rotation?.Keys?.length || children.get(node.ObjectId)?.length);
    if (branches.length !== 1 || ['Body','Pelvis','Chest'].includes(poseNodeRole(parent))) break;
    links.unshift(parent.ObjectId); seen.add(parent.ObjectId); parent = byId.get(parent.Parent);
  }
  const result = { ...chain, root: links[0], middle: links[1], joints: links };
  validatePoseChain(model, result); return result;
}

/** Offer a repair for chains started at a common pelvis/body. Never silently
 * alter an existing handle, and never treat overlapping bend joints as safe. */
export function separatePoseChains(model, draft, existing) {
  const overlaps = existing.filter(chain => poseChainIds(chain).some(id => poseChainIds(draft).includes(id)));
  if (!overlaps.length) return null;
  const chains = [draft, ...overlaps], count = new Map();
  for (const chain of chains) for (const id of poseChainIds(chain)) count.set(id, (count.get(id) || 0) + 1);
  try {
    const trimmed = chains.map(chain => {
      const ids = poseChainIds(chain), start = ids.findIndex(id => count.get(id) === 1), joints = ids.slice(start);
      if (start < 0 || joints.length < 3 || joints.some(id => count.get(id) > 1)) throw new Error('No separate limb');
      const result = { ...chain, root: joints[0], middle: joints[1], joints };
      validatePoseChain(model, result); return result;
    });
    return { draft: trimmed[0], replacements: trimmed.slice(1) };
  } catch { return null; }
}

export function poseNodeRole(node) {
  const name = String(node?.Name || '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/(left|right)(hand|foot|wrist|ankle)/ig, '$1 $2').toLowerCase();
  if (/chain|rein|guard|camera|over\s*head|cloth|cape|banner/.test(name)) return node?.Name || 'Object';
  if (/(?:^|[\s_.-])(?:hand|wrist)(?=$|[\s_0-9.\-])|(?:^|[\s_.-])[lr]ah$/.test(name)) return 'Hand';
  if (/hoof/.test(name)) return 'Hoof';
  if (/(?:^|[\s_.-])(?:foot|ankle|toe)(?=$|[\s_0-9.\-])/.test(name)) return 'Foot';
  if (/(?:pelvis|hips?)(?=$|[\s_0-9.\-])/.test(name)) return 'Pelvis';
  if (/chest|thorax/.test(name)) return 'Chest';
  if (/neck/.test(name)) return 'Neck';
  if (/(?:^|[\s_.-])wings?(?=$|[\s_0-9.\-])/.test(name)) return 'Wing';
  if (/head/.test(name)) return 'Head';
  if (/spine/.test(name)) return 'Spine';
  if (/(?:^|[\s_.-])tail(?=$|[\s_0-9.\-])/.test(name)) return 'Tail';
  if (/(?:root|body|abdomen)(?=$|[\s_0-9.\-])/.test(name)) return 'Body';
  return node?.Name || 'Object';
}

export const poseRole = (model, config, id, nodes) => config.roles?.[id] || poseNodeRole((nodes || allNodes(model)).find(node => node.ObjectId === id));

/** Anatomy names locate candidates; hierarchy and skinned geometry resolve the
 * control, including mounted rigs and feet below unnamed mesh children. */
export function suggestPoseRig(model, frame, sequence) {
  const nodes = allNodes(model), transforms = transformNodes(model), byId = new Map(nodes.map(node => [node.ObjectId, node]));
  const joints = new Set(transforms.map(node => node.ObjectId)), chains = [], unavailable = [];
  const roles = {}, children = new Map(), evidence = poseRecognitionEvidence(model);
  for (const node of transforms) { const siblings = children.get(node.Parent) || []; siblings.push(node); children.set(node.Parent, siblings); }
  const rootOf = node => { const seen = new Set(); while (byId.has(node?.Parent) && !seen.has(node.ObjectId)) { seen.add(node.ObjectId); node = byId.get(node.Parent); } return node?.ObjectId; };
  // Native attachment references often name an otherwise anonymous rig. Prefer
  // its real joint, not the offset attachment (or a mesh's arbitrary pivot).
  for (const ref of model.Attachments || []) {
    const role = poseNodeRole(ref), parent = byId.get(ref.Parent);
    if (!parent || !joints.has(parent.ObjectId) || !['Head', 'Hand', 'Foot'].includes(role)) continue;
    // A hull can carry imported hand/foot references on the same rigid mesh.
    if ((model.Attachments || []).some(other => other.Parent === ref.Parent && ['Hand','Foot'].includes(poseNodeRole(other)) && poseNodeRole(other) !== role)) continue;
    if (['Head', 'Hand', 'Foot', 'Hoof'].includes(poseNodeRole(parent))) continue;
    if (role === 'Head') {
      if (poseNodeRole(byId.get(parent.Parent)) === 'Chest' || !transforms.some(node => rootOf(node) === rootOf(parent) && poseNodeRole(node) === 'Head')) roles[parent.ObjectId] = role;
      continue;
    }
    if (/(?:arm2|forearm|leg2|leg3|calf|shin|knee)(?:$|[ _.-])/i.test(parent.Name)) continue;
    // Keep an already named wrist/ankle in this branch. A ref can be mounted on
    // a forearm or weapon rather than on the anatomical end joint.
    if (transforms.some(node => evidence.moving(node) && rootOf(node) === rootOf(parent) && (poseNodeRole(node) === role || role === 'Foot' && poseNodeRole(node) === 'Hoof') && (descendantOf(model, node.ObjectId, parent.ObjectId) || descendantOf(model, parent.ObjectId, node.ObjectId)))) continue;
    const distance = node => v3(node.PivotPoint).distanceTo(v3(ref.PivotPoint));
    const next = (children.get(parent.ObjectId) || []).filter(node => evidence.moving(node) && (children.get(node.ObjectId) || []).length).sort((a,b) => distance(a) - distance(b))[0];
    const end = next && distance(next) < distance(parent) * .98 ? next : parent;
    roles[end.ObjectId] = role;
  }
  const roleOf = node => roles[node?.ObjectId] || poseNodeRole(node);
  // Process real ancestors before their mesh children. A pairwise ancestor
  // comparator is not transitive when unrelated limbs sit between the two.
  const depthOf = node => { const seen = new Set(); let depth = 0; while (byId.has(node?.Parent) && !seen.has(node.ObjectId)) { seen.add(node.ObjectId); node = byId.get(node.Parent); depth++; } return depth; };
  const candidates = nodes.filter(node => ['Hand', 'Foot', 'Hoof'].includes(roleOf(node)))
    .filter(node => joints.has(node.ObjectId) || !(model.Attachments || []).some(other => other.Parent === node.Parent && ['Hand','Foot'].includes(poseNodeRole(other)) && poseNodeRole(other) !== roleOf(node)))
    .filter(node => !/wrist/i.test(node.Name) || !transforms.some(child => descendantOf(model, child.ObjectId, node.ObjectId) && /hand/i.test(child.Name) && roleOf(child) === 'Hand'))
    .sort((a, b) => Number(joints.has(b.ObjectId)) - Number(joints.has(a.ObjectId)) || depthOf(a) - depthOf(b));
  // A rider's boots may have generic mesh names. Locate the lowest descendant
  // pivot beneath each named knee, backed by geometry rather than a model ID.
  for (const knee of transforms.filter(node => /(?:leg2|calf|shin|knee)(?:$|[ _.-])/i.test(node.Name))) {
    if (candidates.some(node => descendantOf(model, node.ObjectId, knee.ObjectId))) continue;
    const pivot = v3(knee.PivotPoint || model.PivotPoints[knee.ObjectId]);
    const feet = transforms.filter(node => node.ObjectId !== knee.ObjectId && descendantOf(model, node.ObjectId, knee.ObjectId) && movementBoneVertexCenter(model, node.ObjectId, new Map()))
      .filter(node => v3(node.PivotPoint || model.PivotPoints[node.ObjectId]).z < pivot.z - 1e-4)
      .sort((a, b) => a.PivotPoint[2] - b.PivotPoint[2]);
    if (feet[0]) candidates.push(feet[0]);
  }
  for (const node of candidates) {
    try {
      // Prefer the actual hand/hoof over its child attachment marker.
      if (chains.some(chain => descendantOf(model, node.ObjectId, chain.end))) continue;
      const chain = { ...suggestPoseChain(model, node.ObjectId), kind: roleOf(node) === 'Hand' ? 'arm' : 'leg', key: `limb:${node.ObjectId}` };
      if (['Body','Pelvis'].includes(roleOf(byId.get(chain.root))) || roleOf(byId.get(chain.root)) === 'Chest' && /arm|thigh|leg1/i.test(byId.get(chain.middle)?.Name)) continue;
      if (chains.some(existing => poseChainIds(chain).some(id => poseChainIds(existing).includes(id)))) continue;
      // Mapping is structural and must not lose a hoof at an authored scale key.
      // Some imports attach a rigid boot mesh straight to the shin and leave
      // its mesh origin near the torso. Grip its skin, retaining the authored
      // pivot and hierarchy; the endpoint adapter compensates native keys.
      const skin = evidence.profiles.get(node.ObjectId)?.rigidSkin;
      const parent = byId.get(node.Parent);
      if (parent && skin && !/^bone[ _]|^helper/i.test(node.Name) && !(children.get(node.ObjectId) || []).length && skin.distanceTo(v3(node.PivotPoint)) > v3(node.PivotPoint).distanceTo(v3(parent.PivotPoint)) * .7) chain.grip = skin.toArray();
      const pivots = poseChainIds(chain).map(id => v3(id === chain.end && chain.grip || byId.get(id).PivotPoint));
      if (pivots.slice(1).some((point, i) => point.distanceTo(pivots[i]) < 1e-7)) throw new Error('Choose joints with nonzero segment lengths.');
      chains.push(chain);
    } catch (cause) { unavailable.push({ id: node.ObjectId, reason: cause.message }); }
  }
  const occupied = new Set(chains.flatMap(poseChainIds));
  for (const branch of inferPoseBranches(evidence, roleOf, occupied)) {
    if (branch.ids.some(id => occupied.has(id))) continue;
    const horseLimb = branch.kind === 'leg' && /horse|equine/i.test(byId.get(rootOf(byId.get(branch.ids[0])))?.Name || '');
    const chain = { root: branch.ids[0], middle: branch.ids[1], end: branch.ids.at(-1), joints: branch.ids, kind: branch.kind, key: `limb:${branch.ids.at(-1)}`, ...(branch.label || horseLimb ? { label: branch.label || 'Hoof' } : {}) };
    try { validatePoseChain(model, chain); chains.push(chain); branch.ids.forEach(id => occupied.add(id)); } catch { /* Unsupported native inheritance remains available through bone editing. */ }
  }
  const bodies = transforms.filter(node => roleOf(node) === 'Body' && !/death|portrait/i.test(node.Name));
  const groups = new Map();
  for (const chain of chains) { const key = rootOf(byId.get(chain.root)), group = groups.get(key) || []; group.push(chain); groups.set(key, group); }
  const actors = [];
  for (const limbs of groups.values()) {
    let body;
    try { body = suggestPoseBody(model, limbs); } catch { continue; }
    // The arm junction is a chest, not a whole-body translation root. Ascend
    // to the authored body driver so skirts, robes and spine travel together.
    let ancestor = byId.get(body);
    while (ancestor) { if (bodies.includes(ancestor)) { body = ancestor.ObjectId; break; } ancestor = byId.get(ancestor.Parent); }
    if (roleOf(byId.get(body)) === 'Chest' && !bodies.some(node => node.ObjectId === body)) body = rootOf(byId.get(body));
    roles[body] = 'Body';
    const arms = limbs.filter(chain => chain.kind === 'arm' && chain.label !== 'Chain');
    if (arms.length >= 2) {
      try { const chest = suggestPoseBody(model, arms); if (chest !== body && !['Body','Pelvis'].includes(roleOf(byId.get(chest)))) roles[chest] = 'Chest'; } catch { /* Separate shoulders remain native bones. */ }
    }
    const positions = limbs.flatMap(chain => poseChainIds(chain).map(id => v3(byId.get(id).PivotPoint)));
    const lo = new Vector3(Infinity,Infinity,Infinity), hi = lo.clone().negate(); positions.forEach(p => { lo.min(p); hi.max(p); });
    actors.push({ body, limbs, span: lo.distanceTo(hi) });
  }
  // Numbered SD helper rigs may have an extra ankle or upper limb. Continue
  // through those actual links up to the body's branching joint, rather than
  // silently dropping the first segment to force a two-bone template.
  for (const chain of chains) {
    const links = poseChainIds(chain).slice(); let parent = byId.get(byId.get(links[0])?.Parent);
    while (parent && /^(?:bone|helper)(?:[ _-]*any)?[ _-]*[0-9]+$/i.test(parent.Name) && !['Body','Pelvis','Chest'].includes(roleOf(parent))) { links.unshift(parent.ObjectId); parent = byId.get(parent.Parent); }
    if (links.length !== poseChainIds(chain).length) {
      const extended = { ...chain, root: links[0], middle: links[1], joints: links };
      try { validatePoseChain(model,extended); if (links.slice(1).some((id, i) => v3(byId.get(id).PivotPoint).distanceTo(v3(byId.get(links[i]).PivotPoint)) < 1e-7)) throw new Error('Coincident joint'); Object.assign(chain,extended); } catch { /* Keep the already validated endpoint chain. */ }
    }
  }
  actors.sort((a,b) => b.span - a.span);
  const structuralRoots = transforms.filter(node => !byId.has(node.Parent) && evidence.supported(node) && evidence.articulated(node)).sort((a,b) => evidence.descendants(b.ObjectId).filter(evidence.supported).length - evidence.descendants(a.ObjectId).filter(evidence.supported).length);
  let body = actors[0]?.body ?? bodies[0]?.ObjectId ?? transforms.find(node => roleOf(node) === 'Pelvis')?.ObjectId ?? structuralRoots[0]?.ObjectId ?? null;
  // Keep authored global motion intact. A local descendant carrying the same
  // complete assembly is the usable body driver (for example a rocking hull).
  while (byId.get(body)?.Translation?.GlobalSeqId != null) {
    const links = (children.get(body) || []).filter(evidence.supported);
    if (links.length !== 1) break;
    body = links[0].ObjectId;
  }
  const followers = {}, carriers = {}, bodyNode = byId.get(body);
  if (bodyNode) {
    // Explicit seat/saddle anchors connect separately animated riders without
    // reparenting, changing skin weights, or rewriting their authored keys.
    const seats = transforms.filter(node => /(?:saddle|seat).*anchor|anchor.*(?:saddle|seat)/i.test(node.Name) && descendantOf(model,node.ObjectId,body));
    for (const actor of actors.slice(1)) {
      const rider = byId.get(actor.body);
      const seat = seats.slice().sort((a,b) => v3(a.PivotPoint).distanceTo(v3(rider.PivotPoint)) - v3(b.PivotPoint).distanceTo(v3(rider.PivotPoint)))[0];
      if (seat && actor.limbs.length >= 2) carriers[actor.body] = seat.ObjectId;
    }
    if (/horse|mount/i.test(bodyNode.Name)) {
      const carried = transforms.filter(node => node.ObjectId !== body && node.Parent === bodyNode.Parent && /horse|mount/i.test(node.Name) && poseNodeRole(node) === 'Body' && v3(node.PivotPoint).distanceTo(v3(bodyNode.PivotPoint)) < 1e-3 &&
        bodies.some(rider => rider.ObjectId !== body && descendantOf(model, rider.ObjectId, node.ObjectId)));
      if (carried.length) followers[body] = carried.map(node => node.ObjectId);
    }
    // Detached reins are authored independently like the rider. Carry those
    // explicit accessories with the seat; unrelated effects/debris stay alone.
    if (Object.keys(carriers).length) for (const node of transforms) if (!byId.has(node.Parent) && /^(?:chain|reins?)[ _.-]/i.test(node.Name)) carriers[node.ObjectId] = seats[0].ObjectId;
  }
  for (const actor of actors) {
    const armEnds = actor.limbs.filter(chain => chain.kind === 'arm');
    for (const chain of armEnds) {
      const end = byId.get(chain.end), peers = children.get(end.Parent) || [];
      if (peers.filter(peer => v3(peer.PivotPoint).distanceTo(v3(end.PivotPoint)) < .01).length >= 3) chain.label = 'Wing';
    }
    // A long, unbranched rear spine opposite the chest is a tail. Skin child
    // pivots are ignored; helpers with their own joints define the articulation.
    const chest = transforms.find(node => roleOf(node) === 'Chest' && descendantOf(model,node.ObjectId,actor.body));
    if (!chest) continue;
    const origin = v3(byId.get(actor.body).PivotPoint), forward = v3(chest.PivotPoint).sub(origin);
    for (const first of transforms.filter(node => node.Parent === actor.body || ['Pelvis','Body'].includes(roleOf(byId.get(node.Parent) || {})) && descendantOf(model, node.ObjectId, actor.body))) {
      if (poseNodeRole(first) !== first.Name || actor.limbs.some(chain => descendantOf(model,chain.end,first.ObjectId))) continue;
      const tail = [first]; let next = first;
      while (true) { const links = evidence.links(next.ObjectId); if (links.length !== 1) break; next = links[0]; tail.push(next); }
      if (tail.length >= 3 && v3(next.PivotPoint).sub(origin).dot(forward) < 0) roles[next.ObjectId] = 'Tail';
    }
  }
  // A named wing can identify its unnamed mirrored partner when both branches
  // own skin and articulate in existing clips. Small face/accessory joints do
  // not satisfy the shared chest attachment and mirrored mesh evidence.
  for (const wing of transforms.filter(node => roleOf(node) === 'Wing' && evidence.moving(node))) {
    const parent = byId.get(wing.Parent), skin = evidence.profiles.get(wing.ObjectId)?.skin;
    if (!parent || !skin) continue;
    const span = skin.distanceTo(v3(parent.PivotPoint));
    const peer = (children.get(wing.Parent) || []).filter(node => node !== wing && evidence.moving(node) && evidence.profiles.get(node.ObjectId)?.skin && !chains.some(chain => poseChainIds(chain).includes(node.ObjectId)))
      .map(node => ({ node, error: evidence.mirrorError(skin, evidence.profiles.get(node.ObjectId).skin, v3(parent.PivotPoint), span) + evidence.mirrorError(v3(wing.PivotPoint), v3(node.PivotPoint), v3(parent.PivotPoint), span) }))
      .sort((a,b) => a.error - b.error)[0];
    if (peer?.error < .25) roles[peer.node.ObjectId] = 'Wing';
  }
  const controls = transforms.filter(node => ['Head','Neck','Chest','Spine','Pelvis','Body','Tail','Wing'].includes(roleOf(node)) && !/death|portrait/i.test(node.Name))
    // One anatomical head can own a separately named mesh with an arbitrary
    // pivot. Expose the controlling joint, not a second tearing mesh handle.
    .filter(node => !(roleOf(node) === 'Head' && roleOf(byId.get(node.Parent) || {}) === 'Head'))
    .filter(node => !(roleOf(node) === roleOf(byId.get(node.Parent) || {}) && !evidence.links(node.ObjectId).length && !/^bone[ _]/i.test(node.Name)))
    .filter(node => !model.Geosets?.length || evidence.supported(node) && (roles[node.ObjectId] || /^bone[ _]/i.test(node.Name) || evidence.articulated(node) || !byId.has(node.Parent)))
    .filter(node => roleOf(node) !== 'Tail' || !(children.get(node.ObjectId) || []).some(child => roleOf(child) === 'Tail' && evidence.moving(child)))
    .map(node => node.ObjectId).filter(id => id !== body);
  return { chains, body, nodes: controls, roles, followers, carriers, unavailable };
}

function rigidRotation(matrix) {
  if (!matrix || !finite(matrix.elements) || matrix.determinant() <= 1e-18) throw new Error('POSE requires a finite, nonsingular, positive transform.');
  const e = matrix.elements, axes = [0, 4, 8].map(offset => new Vector3(e[offset], e[offset + 1], e[offset + 2])), lengths = axes.map(axis => axis.length());
  const largest = Math.max(...lengths);
  // Authored SD quaternions are often rounded decimal values. The evaluator
  // preserves them; allow their small matrix roundoff, never authored scale.
  if (Math.min(...lengths) <= 1e-10 || lengths.some(length => Math.abs(length - largest) > largest * 2e-2) || axes.some((axis, i) => axes.some((other, j) => i !== j && Math.abs(axis.dot(other)) > largest * largest * 2e-2))) throw new Error('POSE supports positive uniform scale; nonuniform scale, reflection and shear are unsupported.');
  const rotation = new Quaternion(); matrix.decompose(new Vector3(), rotation, new Vector3()); return rotation.normalize();
}

function poseMatrixDistortion(matrix) {
  const e=matrix.elements, lengths=[0,4,8].map(i=>Math.hypot(e[i],e[i+1],e[i+2]));
  return (Math.max(...lengths)-Math.min(...lengths))/Math.max(...lengths);
}

function sampled(model, frame, sequence, globalTime) {
  if (!model.Sequences?.[sequence]?.Interval || !Number.isFinite(frame) || !Number.isFinite(globalTime)) throw new Error('Choose a local animation pose before using POSE.');
  return sampleNodeMatrices(model, frame, sequence, globalTime);
}
function point(model, node, matrices) { return v3(node.PivotPoint || model.PivotPoints[node.ObjectId]).applyMatrix4(matrices.get(node.ObjectId)); }
function chainPoint(model, chain, node, matrices) { return node.ObjectId === chain.end && chain.grip ? v3(chain.grip).applyMatrix4(matrices.get(node.ObjectId)) : point(model, node, matrices); }

// Share one read-only sampled pose across handles. This context is deliberately
// scoped to a synchronous overlay/solve, never retained across edits or frames.
export function createPoseSample(model, frame, sequence, globalTime = frame, validatedTracks = new WeakMap()) {
  return { matrices: sampled(model, frame, sequence, globalTime), byId: new Map(allNodes(model).map(node => [node.ObjectId, node])), checked: new Set(), validatedTracks };
}

export function samplePoseChain(model, chain, frame, sequence, globalTime = frame, sample = createPoseSample(model, frame, sequence, globalTime)) {
  const nodes = validatePoseChain(model, chain), { matrices, byId, checked, validatedTracks } = sample;
  // Validate ancestry even when a descendant's effective matrix happens to
  // cancel an unsupported scale. No stripped flags or hidden rig repairs.
  for (const node of nodes) {
    let ancestor = node;
    const validAncestors = [];
    while (ancestor && !checked.has(ancestor.ObjectId)) {
      for (const [property, fallback, quaternion] of [['Translation', [0, 0, 0], false], ['Rotation', [0, 0, 0, 1], true], ['Scaling', [1, 1, 1], false]]) {
        const track = ancestor[property];
        if (track?.Keys && validatedTracks.get(track) !== fallback.length) {
          if (track.Keys.some(key => !finite(key.Vector) || key.Vector.length !== fallback.length || quaternion && Math.hypot(...key.Vector) < 1e-12)) throw new Error('A POSE ancestor has an invalid transform key.');
          validatedTracks.set(track, fallback.length);
        }
        const value = sampleTrack(track, frame, { ...options(model, frame, sequence, globalTime), fallback, quaternion });
        if (!finite(value) || value.length !== fallback.length || quaternion && Math.hypot(...value) < 1e-12) throw new Error('A sampled POSE transform is invalid.');
        if (property === 'Scaling' && (value.some(component => component <= 1e-10) || value.some(component => Math.abs(component - value[0]) > Math.abs(value[0]) * 1e-5))) throw new Error('POSE supports positive uniform scale only.');
      }
      rigidRotation(matrices.get(ancestor.ObjectId)); validAncestors.push(ancestor.ObjectId); ancestor = byId.get(ancestor.Parent);
    }
    // Only mark a path after its entire ancestry passed; a failed sibling
    // must not let another handle skip the same malformed ancestor.
    for (const id of validAncestors) checked.add(id);
  }
  const points = nodes.map(node => chainPoint(model, chain, node, matrices)), root = points[0], middle = points[1], end = points.at(-1);
  const lengths = points.slice(1).map((point, i) => point.distanceTo(points[i]));
  // Classic MDX rotations can be coarsely quantized (e.g. 0.9960938 for w).
  // Track scale was checked above. Bound their actual matrix distortion rather
  // than rejecting a normal SD rig as if it had an authored nonuniform scale.
  let distortion = 0;
  for (const node of nodes) distortion = Math.max(distortion, poseMatrixDistortion(matrices.get(node.ObjectId)));
  const tolerance = Math.max(1e-7, lengths.reduce((a,b) => a+b, 0) * Math.max(2e-5, distortion * 2));
  if (!finite(points.flatMap(point => point.toArray())) || Math.min(...lengths) <= 1e-7) throw new Error('Choose joints with nonzero segment lengths.');
  const rotations = [nodes[0], nodes[1], nodes.at(-1)].map(node => rigidRotation(matrices.get(node.ObjectId)));
  return { root, middle, end, points, lengths, tolerance, distortion, rotations, matrices };
}

function perpendicular(direction, candidate, fallback) {
  const project = vector => vector.clone().addScaledVector(direction, -vector.dot(direction));
  let result = candidate && project(candidate);
  if (!result || result.lengthSq() < 1e-12) result = fallback && project(fallback);
  if (!result || result.lengthSq() < 1e-12) {
    const axis = [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)].sort((a, b) => Math.abs(a.dot(direction)) - Math.abs(b.dot(direction)))[0];
    result = project(axis);
  }
  return result.normalize();
}

/** Analytical geometry only. The adapter below verifies the result through
 * Warcraft's pivot/hierarchy evaluator after each changed joint. */
export function solveTwoBone(pose, target, pole, bendMemory) {
  target = v3(target);
  if (!finite(target.toArray()) || pole && !finite(v3(pole).toArray())) throw new Error('POSE target must be finite.');
  const { root, middle, end, lengths: [a, b], tolerance } = pose;
  const offset = target.clone().sub(root), distance = offset.length();
  let direction = distance > tolerance ? offset.divideScalar(distance) : end.clone().sub(root).normalize();
  if (direction.lengthSq() < .5) direction = middle.clone().sub(root).normalize();
  // The current elbow/knee is the authority. Memory only resolves a genuinely
  // straight/folded chain; ordinary FK edits cannot pull toward an old bend.
  const sampledDirection = end.clone().sub(root).normalize();
  if (sampledDirection.lengthSq() < .5) sampledDirection.copy(middle).sub(root).normalize();
  const sampledBend = middle.clone().sub(root), projectedBend = sampledBend.clone().addScaledVector(sampledDirection, -sampledBend.dot(sampledDirection));
  const transport = new Quaternion().setFromUnitVectors(sampledDirection, direction);
  const fallback = bendMemory ? v3(bendMemory) : new Vector3(0, 0, 1).applyQuaternion(pose.rotations?.[0] || new Quaternion());
  const bend = perpendicular(direction, pole ? v3(pole).sub(root) : projectedBend.lengthSq() > tolerance * tolerance ? projectedBend.applyQuaternion(transport) : null, fallback.applyQuaternion(transport));
  const inner = Math.abs(a - b), outer = a + b;
  const reach = Math.max(Math.max(inner, tolerance * .1), Math.min(outer, distance));
  const along = (a * a - b * b + reach * reach) / (2 * reach), height = Math.sqrt(Math.max(0, a * a - along * along));
  return { middle: root.clone().addScaledVector(direction, along).addScaledVector(bend, height), end: root.clone().addScaledVector(direction, reach), bend, clamped: distance < inner - tolerance || distance > outer + tolerance };
}

function setWorldRotation(model, node, desired, matrices, frame, sequence, globalTime) {
  const parentRotation = rigidRotation(movementParentMatrix(node, matrices));
  const local = parentRotation.invert().multiply(desired).normalize();
  const reference = new Quaternion().fromArray(sampleTrack(node.Rotation, frame, { ...options(model, frame, sequence, globalTime), fallback: [0, 0, 0, 1], quaternion: true })).normalize();
  if (local.dot(reference) < 0) local.set(-local.x, -local.y, -local.z, -local.w);
  const change = { id: node.ObjectId, property: 'Rotation', value: local.toArray() };
  const prepared = prepareMovementPose(model, [change], frame, sequence);
  for (const item of prepared) node[item.property] = item.track;
  return change;
}

// An imported mesh origin may be far from its visible endpoint. Rotate that
// endpoint around its grip using ordinary native Translation compensation.
// The model's pivot, parent, geometry and weights are never rewritten.
function orientChainEnd(model, chain, node, desired, matrices, frame, sequence, globalTime) {
  const grip = chain.grip && chainPoint(model, chain, node, matrices);
  const changes = [setWorldRotation(model, node, desired, matrices, frame, sequence, globalTime)];
  if (grip) {
    const delta = grip.sub(chainPoint(model, chain, node, sampled(model, frame, sequence, globalTime)));
    const inverse = movementParentMatrix(node, matrices).clone().invert();
    const local = delta.applyMatrix4(inverse).sub(new Vector3().applyMatrix4(inverse));
    const change = { id: node.ObjectId, property: 'Translation', value: v3(sampleMovement(model, node, 'Translation', frame, sequence)).add(local).toArray() };
    for (const item of prepareMovementPose(model, [change], frame, sequence)) node[item.property] = item.track;
    changes.push(change);
  }
  return changes;
}

function solveChainOnClone(model, chain, frame, sequence, target, { pole, orientation, bendMemory, strict = false, globalTime = frame, validatedTracks = new WeakMap() } = {}) {
  if (orientation && (!finite(orientation) || orientation.length !== 4 || Math.hypot(...orientation) < 1e-12)) throw new Error('POSE endpoint orientation must be a finite quaternion.');
  const pose = samplePoseChain(model, chain, frame, sequence, globalTime, createPoseSample(model, frame, sequence, globalTime, validatedTracks));
  if (poseChainIds(chain).length > 3 || pose.distortion > 2e-4) return solveExtendedChain(model, chain, pose, frame, sequence, target, { pole, orientation, strict, bendMemory, globalTime, validatedTracks });
  const geometry = solveTwoBone(pose, target, pole, bendMemory);
  if (!pole && v3(target).distanceToSquared(pose.end) < 1e-20 && (!orientation || 1 - Math.abs(new Quaternion().fromArray(orientation).normalize().dot(pose.rotations[2])) < 1e-12)) return { changes: [], bend: geometry.bend.toArray(), clamped: false, pose };
  if (strict && geometry.clamped) throw new Error('Pinned foot is out of reach. Move the body closer; this preview is rejected.');
  const nodes = validatePoseChain(model, chain), changes = [];
  const swing = (from, to) => new Quaternion().setFromUnitVectors(from.normalize(), to.normalize());
  const rootRotation = swing(pose.middle.clone().sub(pose.root), geometry.middle.clone().sub(pose.root)).multiply(pose.rotations[0]);
  changes.push(setWorldRotation(model, nodes[0], rootRotation, pose.matrices, frame, sequence, globalTime));
  let matrices = sampled(model, frame, sequence, globalTime), currentMiddle = point(model, nodes[1], matrices), currentEnd = chainPoint(model, chain, nodes[2], matrices);
  if (currentMiddle.distanceTo(geometry.middle) > pose.tolerance * 4) throw new Error('This hierarchy does not preserve rigid limb motion. No pose was applied.');
  const middleRotation = swing(currentEnd.sub(currentMiddle), geometry.end.clone().sub(currentMiddle)).multiply(rigidRotation(matrices.get(chain.middle)));
  changes.push(setWorldRotation(model, nodes[1], middleRotation, matrices, frame, sequence, globalTime));
  matrices = sampled(model, frame, sequence, globalTime);
  const endpointRotation = orientation ? new Quaternion().fromArray(orientation).normalize() : pose.rotations[2];
  changes.push(...orientChainEnd(model, chain, nodes[2], endpointRotation, matrices, frame, sequence, globalTime));
  const result = samplePoseChain(model, chain, frame, sequence, globalTime, createPoseSample(model, frame, sequence, globalTime, validatedTracks));
  if (result.root.distanceTo(pose.root) > pose.tolerance || result.end.distanceTo(geometry.end) > pose.tolerance * 4 || result.lengths.some((length, i) => Math.abs(length - pose.lengths[i]) > pose.tolerance * 4) || 1 - Math.abs(result.rotations[2].dot(endpointRotation)) > 1e-7) throw new Error('POSE verification failed. The limb remains unchanged.');
  return { changes, bend: geometry.bend.toArray(), clamped: geometry.clamped, pose: result };
}

// FABRIK keeps all of a horse leg's native segments. The native evaluator is
// the final authority, including the small errors from quantized SD rotations.
function solveExtendedChain(model, chain, pose, frame, sequence, target, { pole, orientation, strict, bendMemory, globalTime, validatedTracks }) {
  const nodes = validatePoseChain(model, chain), goal = v3(target), points = pose.points.map(point => point.clone());
  const total = pose.lengths.reduce((a,b) => a+b,0), inner = Math.max(0, 2*Math.max(...pose.lengths)-total);
  const distance = goal.distanceTo(points[0]), clamped = distance > total + pose.tolerance || distance < inner - pose.tolerance;
  if (strict && clamped) throw new Error('Pinned foot is out of reach.');
  const direction = goal.clone().sub(points[0]).normalize();
  const rememberedBend = perpendicular(direction, pose.middle.clone().sub(pose.root), bendMemory && v3(bendMemory));
  if (distance < total - pose.tolerance && points.slice(1,-1).every(point => point.clone().sub(points[0]).cross(direction).length() < pose.tolerance)) {
    let along=0; const height=Math.sqrt(Math.max(0,total*total-distance*distance))*.25;
    for(let i=1;i<points.length-1;i++){along+=pose.lengths[i-1];points[i].addScaledVector(rememberedBend,Math.sin(Math.PI*along/total)*height);}
  }
  if (pole) {
    const axis = points.at(-1).clone().sub(points[0]).normalize(), from = perpendicular(axis, points[1].clone().sub(points[0])), to = perpendicular(axis, v3(pole).sub(points[0]));
    const turn = new Quaternion().setFromAxisAngle(axis, Math.atan2(axis.dot(from.clone().cross(to)), from.dot(to)));
    for (let i=1;i<points.length-1;i++) points[i].sub(points[0]).applyQuaternion(turn).add(points[0]);
  }
  if (distance >= total) {
    const direction = goal.clone().sub(points[0]).normalize();
    for (let i=1;i<points.length;i++) points[i].copy(points[i-1]).addScaledVector(direction,pose.lengths[i-1]);
  } else {
    const root = points[0].clone();
    for (let sweep=0;sweep<48;sweep++) {
      points.at(-1).copy(goal);
      for (let i=points.length-2;i>=0;i--) { const direction=points[i].clone().sub(points[i+1]); if(direction.lengthSq()<1e-16) direction.copy(pose.points[i]).sub(pose.points[i+1]); points[i].copy(points[i+1]).addScaledVector(direction.normalize(),pose.lengths[i]); }
      points[0].copy(root);
      for (let i=1;i<points.length;i++) { const direction=points[i].clone().sub(points[i-1]); if(direction.lengthSq()<1e-16) direction.copy(pose.points[i]).sub(pose.points[i-1]); points[i].copy(points[i-1]).addScaledVector(direction.normalize(),pose.lengths[i-1]); }
      if(points.at(-1).distanceTo(goal)<Math.max(1e-6,total*1e-6)) break;
    }
  }
  for (let i=0;i<nodes.length-1;i++) {
    const matrices=sampled(model,frame,sequence,globalTime), origin=point(model,nodes[i],matrices);
    const from=chainPoint(model,chain,nodes[i+1],matrices).sub(origin), to=points[i+1].clone().sub(points[i]);
    if(from.lengthSq()>1e-16&&to.lengthSq()>1e-16) setWorldRotation(model,nodes[i],new Quaternion().setFromUnitVectors(from.normalize(),to.normalize()).multiply(rigidRotation(matrices.get(nodes[i].ObjectId))),matrices,frame,sequence,globalTime);
  }
  const desired = orientation ? new Quaternion().fromArray(orientation).normalize() : pose.rotations[2];
  const endpointChanges=orientChainEnd(model,chain,nodes.at(-1),desired,sampled(model,frame,sequence,globalTime),frame,sequence,globalTime);
  const result=samplePoseChain(model,chain,frame,sequence,globalTime,createPoseSample(model,frame,sequence,globalTime,validatedTracks));
  if(strict && result.end.distanceTo(goal)>Math.max(pose.tolerance*8,total*1e-3)) throw new Error('Move closer to the pinned foot.');
  const solvedDirection=result.end.clone().sub(result.root).normalize(), bend=perpendicular(solvedDirection,result.middle.clone().sub(result.root),rememberedBend);
  return { changes:[...nodes.slice(0,-1).map(node=>({id:node.ObjectId,property:'Rotation',value:sampleMovement(model,node,'Rotation',frame,sequence)})),...endpointChanges], bend:bend.toArray(), clamped, pose:result };
}

// A shallow model with detached node/track records is sufficient: solvers never
// mutate geometry, pivots, resources, intervals or the model's editor metadata.
export function posePreviewModel(model) {
  const copy = { ...model }, copies = new Map();
  for (const key of ['Nodes', 'Bones', 'Helpers', 'Attachments', 'EventObjects', 'CollisionShapes', 'ParticleEmitters', 'ParticleEmitters2', 'ParticleEmitterPopcorns', 'Lights', 'RibbonEmitters']) if (model[key]) copy[key] = model[key].map(node => {
    if (!node) return node;
    if (!copies.has(node)) copies.set(node, { ...node });
    return copies.get(node);
  });
  return copy;
}

export function solvePoseLimb(model, chain, frame, sequence, target, settings = {}) {
  return solveChainOnClone(posePreviewModel(model), chain, frame, sequence, target, settings);
}

/** Turn the limb's bending plane around its fixed root and endpoint. Rotating
 * the native root carries every intermediate joint, including long SD chains;
 * the endpoint's orientation is restored through the existing native writer. */
export function swivelPoseLimb(model, chain, frame, sequence, radians, globalTime = frame, bendMemory) {
  if (!Number.isFinite(radians)) throw new Error('Bend needs a finite angle.');
  const copy = posePreviewModel(model), pose = samplePoseChain(copy, chain, frame, sequence, globalTime);
  const angle = radians % (Math.PI * 2);
  if (Math.abs(angle) < 1e-12) return { changes: [], pose };
  const axis = pose.end.clone().sub(pose.root);
  // A completely folded limb has no root-to-end direction. Use a stable axis
  // perpendicular to its first segment; its coincident endpoint stays fixed.
  if (axis.lengthSq() < pose.tolerance * pose.tolerance) axis.copy(perpendicular(pose.middle.clone().sub(pose.root).normalize(), new Vector3(0, 0, 1).applyQuaternion(pose.rotations[0])));
  axis.normalize();
  const turn = new Quaternion().setFromAxisAngle(axis, angle), nodes = validatePoseChain(copy, chain);
  const projected = pose.middle.clone().sub(pose.root); projected.addScaledVector(axis, -projected.dot(axis));
  const fallback = bendMemory ? v3(bendMemory) : perpendicular(axis, new Vector3(0, 0, 1).applyQuaternion(pose.rotations[0]), new Vector3(1, 0, 0).applyQuaternion(pose.rotations[0]));
  const bend = perpendicular(axis, projected.lengthSq() > pose.tolerance * pose.tolerance ? projected : null, fallback);
  const desiredBend = bend.clone().applyQuaternion(turn);
  const changes = [setWorldRotation(copy, nodes[0], turn.clone().multiply(pose.rotations[0]), pose.matrices, frame, sequence, globalTime)];
  // Use the existing native-evaluated solver for rounded SD rotations, just
  // as endpoint Move does. Their sampled matrices are only approximately rigid.
  if (pose.distortion > 2e-4) {
    const pole = pose.middle.clone().addScaledVector(bend, Math.max(...pose.lengths) * .45).sub(pose.root).applyQuaternion(turn).add(pose.root);
    return solveChainOnClone(copy, chain, frame, sequence, pose.end, { pole, orientation: pose.rotations[2].toArray(), bendMemory: desiredBend, strict: true, globalTime });
  }
  changes.push(...orientChainEnd(copy, chain, nodes.at(-1), pose.rotations[2], sampled(copy, frame, sequence, globalTime), frame, sequence, globalTime));
  const result = samplePoseChain(copy, chain, frame, sequence, globalTime);
  if (result.root.distanceTo(pose.root) > pose.tolerance * 4 || result.end.distanceTo(pose.end) > pose.tolerance * 4 || result.lengths.some((length, index) => Math.abs(length - pose.lengths[index]) > pose.tolerance * 4) || 1 - Math.abs(result.rotations[2].dot(pose.rotations[2])) > 1e-7) throw new Error('This limb cannot keep its endpoint fixed while bending.');
  return { changes, pose: result, bend: desiredBend.toArray() };
}

export function turnPoseEndpoint(model, chain, frame, sequence, rotation, globalTime = frame) {
  const copy = posePreviewModel(model), pose = samplePoseChain(copy, chain, frame, sequence, globalTime), nodes = validatePoseChain(copy, chain);
  const delta = new Quaternion().fromArray(rotation);
  if (!finite(delta.toArray()) || delta.lengthSq() < 1e-12) throw new Error('Turn needs a finite rotation.');
  return { changes: orientChainEnd(copy, chain, nodes.at(-1), delta.normalize().multiply(pose.rotations[2]), pose.matrices, frame, sequence, globalTime) };
}

export function validatePoseBody(model, bodyId, legs) {
  const byId = hierarchy(model, [bodyId]);
  const used = new Set();
  for (const chain of legs) {
    const nodes = validatePoseChain(model, chain);
    for (const node of nodes) { if (used.has(node.ObjectId)) throw new Error('Pinned legs must have separate joint chains.'); used.add(node.ObjectId); }
    let child = nodes[0], parent = byId.get(child.Parent);
    while (parent) {
      if (child.Flags & 1) throw new Error('This leg disables inherited translation from the body. Choose a body that drives the leg roots.');
      if (parent.ObjectId === bodyId) break;
      child = parent; parent = byId.get(parent.Parent);
    }
    if (!parent) throw new Error('Choose a body node whose hierarchy drives every configured leg root.');
  }
  return byId.get(bodyId);
}

export function suggestPoseBody(model, legs) {
  if (!legs.length) throw new Error('No limb roots are mapped yet. Choose a body node directly.');
  const byId = new Map(allNodes(model).map(node => [node.ObjectId, node])), seen = new Set();
  let parent = byId.get(byId.get(legs[0].root)?.Parent);
  while (parent && !seen.has(parent.ObjectId)) {
    seen.add(parent.ObjectId);
    try { validatePoseBody(model, parent.ObjectId, legs); return parent.ObjectId; } catch { parent = byId.get(parent.Parent); }
  }
  throw new Error('No shared Bone or Helper ancestor drives these legs.');
}

export function solvePoseBody(model, bodyId, pinnedLegs, frame, sequence, displacement, globalTime = frame) {
  return solvePoseNode(model, bodyId, pinnedLegs, frame, sequence, { mode: 'move', space: 'world', values: v3(displacement).toArray() }, globalTime);
}

function descendantOf(model, id, ancestor) {
  const byId = new Map(allNodes(model).map(node => [node.ObjectId, node])), visited = new Set();
  let node = byId.get(id);
  while (node && !visited.has(node.ObjectId)) {
    if (node.ObjectId === ancestor) return true;
    visited.add(node.ObjectId); node = byId.get(node.Parent);
  }
  return false;
}

export function poseAffectedPins(model, config, id) {
  return config.chains.filter(chain => config.pins.includes(chain.key) && chain.end !== id && descendantOf(model, chain.end, id));
}

const upperBodyRoles = new Set(['Spine', 'Chest', 'Neck', 'Head', 'Tail', 'Wing']);

/** A handle grips the part, while its native marker remains at the joint.
 * Use the existing skin centroid reader, including SD mesh children below a
 * helper. The grip is a fixed model-space point, never a new rig node. */
export function poseControlGrip(model, id, nodes = allNodes(model)) {
  const node = nodes.find(node => node.ObjectId === id);
  const pivot = v3(node.PivotPoint || model.PivotPoints[id]), identity = new Map();
  const centers = [node, ...nodes.filter(child => child.Parent === id && !upperBodyRoles.has(poseNodeRole(child)))]
    .map(child => movementBoneVertexCenter(model, child.ObjectId, identity)?.center).filter(Boolean);
  if (centers.length) {
    const center = centers.reduce((sum, center) => sum.add(center), new Vector3()).divideScalar(centers.length);
    if (center.distanceToSquared(pivot) > 1e-8) return center;
  }
  const child = nodes.find(child => child.Parent === id && upperBodyRoles.has(poseNodeRole(child)));
  if (child) {
    const toward = v3(child.PivotPoint || model.PivotPoints[child.ObjectId]);
    if (toward.distanceToSquared(pivot) > 1e-8) return pivot.clone().lerp(toward, .5);
  }
  const parent = nodes.find(parent => parent.ObjectId === node.Parent);
  const direction = parent ? pivot.clone().sub(v3(parent.PivotPoint || model.PivotPoints[parent.ObjectId])).multiplyScalar(.5) : new Vector3(0, 0, 1);
  if (direction.lengthSq() < 1e-8) direction.set(0, 0, 1);
  return pivot.add(direction);
}

export function poseNodeControl(model, config, target, mode = 'move') {
  const id = target?.kind === 'body' ? config.body : target?.id, nodes = allNodes(model), byId = new Map(nodes.map(node => [node.ObjectId, node]));
  const node = byId.get(id), joints = [];
  if (!node || target?.marker || !['move', 'rotate'].includes(mode)) return { joints, heads: [] };
  if (mode === 'move' && id !== config.body && (config.nodes || []).includes(id) && (upperBodyRoles.has(poseRole(model, config, id)) || poseRole(model, config, id) === 'Body')) {
    const transforms = new Set(transformNodes(model).map(node => node.ObjectId)), visited = new Set();
    let joint = node; const pending = [];
    const limbJoints = new Set(config.chains.flatMap(chain => [chain.root, chain.middle, chain.end]));
    while (joint && joint.ObjectId !== config.body && transforms.has(joint.ObjectId) && !visited.has(joint.ObjectId) && !limbJoints.has(joint.ObjectId) && (!['Body', 'Pelvis'].includes(poseRole(model, config, joint.ObjectId)) || joint.ObjectId === id)) {
      pending.unshift(joint.ObjectId);
      if (upperBodyRoles.has(poseRole(model, config, joint.ObjectId)) || joint.ObjectId === id) { joints.unshift(...pending); pending.length = 0; }
      visited.add(joint.ObjectId); joint = byId.get(joint.Parent);
    }
    if (joint && (joint.ObjectId === config.body || ['Body','Pelvis'].includes(poseRole(model,config,joint.ObjectId)))) joints.unshift(...pending);
  }
  let driver = joints[0] ?? id;
  if (poseRole(model, config, id) === 'Pelvis') {
    let parent = byId.get(node.Parent);
    while (parent) {
      if (parent.ObjectId === config.body || poseRole(model, config, parent.ObjectId) === 'Body') { driver = parent.ObjectId; break; }
      parent = byId.get(parent.Parent);
    }
  }
  if (poseRole(model, config, id) === 'Pelvis' && config.carriers?.[driver] != null) { joints.push(id); driver = id; }
  const followers = [...(config.followers?.[driver] || [])], carriers = config.carriers || {};
  for (let added = true; added;) {
    added = false;
    for (const [key, anchor] of Object.entries(carriers)) {
      const follower = Number(key);
      if (follower !== driver && !followers.includes(follower) && [driver,...followers].some(root => descendantOf(model,anchor,root))) { followers.push(follower); added = true; }
    }
  }
  const heads = (config.nodes || []).filter(head => head !== id && poseRole(model, config, head) === 'Head' && [driver, ...followers].some(root => descendantOf(model, head, root)));
  return { joints, heads, driver, followers, carriers };
}

export function poseControlPoint(model, config, id, matrices, nodes = allNodes(model)) {
  const node = nodes.find(node => node.ObjectId === id);
  const grip = id !== config.body && (upperBodyRoles.has(poseRole(model, config, id, nodes)) || poseRole(model, config, id, nodes) === 'Body') && (config.nodes || []).includes(id);
  return (grip ? poseControlGrip(model, id, nodes) : v3(node.PivotPoint || model.PivotPoints[id])).applyMatrix4(matrices.get(id));
}

// Solve only rotations on the existing upper-body links. Damped coordinate
// descent shares a drag through the neck/spine without translating a joint or
// imposing anatomical angle limits. Geometry iterations stay off the model;
// the final rotations go through the same native adapter as limb IK.
function solveConnectedOnClone(model, joints, grip, target, frame, sequence, globalTime) {
  const byId = hierarchy(model, joints), matrices = sampled(model, frame, sequence, globalTime);
  const nodes = joints.map(id => byId.get(id)), points = nodes.map(node => point(model, node, matrices));
  const checked = new Set();
  for (let node of nodes) while (node && !checked.has(node.ObjectId)) {
    checked.add(node.ObjectId);
    const scale = sampleTrack(node.Scaling, frame, { ...options(model, frame, sequence, globalTime), fallback: [1, 1, 1] });
    if (!finite(scale) || scale.some(value => value <= 1e-10 || Math.abs(value - scale[0]) > Math.abs(scale[0]) * 1e-5)) throw new Error('Connected posing requires positive uniform scale.');
    node = byId.get(node.Parent);
  }

  points.push(grip.clone().applyMatrix4(matrices.get(joints.at(-1))));
  const start = points.map(point => point.clone()), rotations = nodes.map(node => rigidRotation(matrices.get(node.ObjectId)));
  const distortion = Math.max(...nodes.map(node => poseMatrixDistortion(matrices.get(node.ObjectId))));
  const tolerance = Math.max(1e-6, points.slice(1).reduce((sum, point, i) => sum + point.distanceTo(points[i]), 0) * Math.max(2e-5, distortion * 2));
  if (points.at(-1).distanceTo(target) <= tolerance * .01) return;
  for (let iteration = 0; iteration < 32; iteration++) {
    for (let i = joints.length - 1; i >= 0; i--) {
      const from = points.at(-1).clone().sub(points[i]), to = target.clone().sub(points[i]);
      if (from.lengthSq() < 1e-16 || to.lengthSq() < 1e-16) continue;
      const swing = new Quaternion().slerp(new Quaternion().setFromUnitVectors(from.normalize(), to.normalize()), .65);
      for (let j = i + 1; j < points.length; j++) points[j].sub(points[i]).applyQuaternion(swing).add(points[i]);
      for (let j = i; j < rotations.length; j++) rotations[j].premultiply(swing).normalize();
    }
    if (points.at(-1).distanceTo(target) < tolerance) break;
  }
  for (let i = 0; i < nodes.length; i++) setWorldRotation(model, nodes[i], rotations[i], sampled(model, frame, sequence, globalTime), frame, sequence, globalTime);
  const after = sampled(model, frame, sequence, globalTime), actual = nodes.map(node => point(model, node, after));
  actual.push(grip.clone().applyMatrix4(after.get(joints.at(-1))));
  if (actual.some((point, i) => point.distanceTo(points[i]) > tolerance * 8) || actual.slice(1).some((point, i) => Math.abs(point.distanceTo(actual[i]) - start[i + 1].distanceTo(start[i])) > tolerance * 8)) throw new Error('This upper-body hierarchy cannot preserve connected motion.');
}

// Automatic targets belong to ancestors of a complete limb. Selecting a limb's
// own joints still permits ordinary FK; explicit pins retain their constraint.
export function poseNodeConstraints(model, config, id, mode = 'move', target = config.target) {
  const control = poseNodeControl(model, config, target, mode);
  id = control.driver ?? control.joints[0] ?? id;
  const drivers = [id, ...(control.followers || [])];
  const pinned = new Set(drivers.flatMap(id => poseAffectedPins(model, config, id)).map(chain => chain.key));
  return config.chains.filter(chain => pinned.has(chain.key) ||
    ['move', 'rotate'].includes(mode) && chain.root !== id && descendantOf(model, chain.root, id))
    .map(chain => ({ chain, pinned: pinned.has(chain.key), bendLocal: config.bends?.[chain.key], target: config.targets?.[chain.key] }));
}

// Reuse an unreachable automatic goal only while its sampled pose still matches.
// FK edits, Undo, scrubbing and changed mappings therefore rebase from native data.
function matchesPoseTarget(target, chain, pose, frame, sequence) {
  return target?.frame === frame && target.sequence === sequence &&
    poseChainIds(chain).length === target.joints.length && poseChainIds(chain).every((id, i) => id === target.joints[i]) &&
    [pose.root, pose.middle, pose.end].every((point, i) => point.distanceTo(v3(target.points[i])) <= pose.tolerance * .1) &&
    pose.rotations.every((rotation, i) => 1 - Math.abs(rotation.dot(new Quaternion().fromArray(target.rotations[i]))) < 1e-9);
}

export function withPoseResult(config, result) {
  return { ...config,
    bends: { ...config.bends, ...Object.fromEntries((result.bends || []).map(bend => [bend.key, bend.local])) },
    targets: { ...config.targets, ...Object.fromEntries((result.targets || []).map(target => [target.key, target])) },
  };
}

// First intersection along a body translation, including an inner reach limit.
// Keeping the valid prefix makes continued dragging stay at the boundary.
function reachFraction(relative, delta, inner, outer) {
  const a = delta.lengthSq(); if (a < 1e-20) return 1;
  const b = 2 * relative.dot(delta), distance = relative.length();
  const roots = radius => { const c = relative.lengthSq() - radius * radius, d = b * b - 4 * a * c; return d < 0 ? null : [(-b - Math.sqrt(d)) / (2 * a), (-b + Math.sqrt(d)) / (2 * a)]; };
  const far = roots(Math.max(outer, distance)), near = inner > 1e-8 ? roots(Math.min(inner, distance)) : null;
  let fraction = far ? Math.max(0, far[1]) : 1;
  if (near && near[0] >= 0 && near[1] > near[0]) fraction = Math.min(fraction, near[0]);
  return Math.min(1, fraction);
}

/** Ancestor moves solve affected limbs toward their current endpoint poses.
 * Automatic targets yield at reach; only explicit pins limit the body move. */
export function solvePoseNode(model, id, constraints, frame, sequence, change, globalTime = frame) {
  const validatedTracks = new WeakMap();
  const poseAt = (source, chain) => samplePoseChain(source, chain, frame, sequence, globalTime, createPoseSample(source, frame, sequence, globalTime, validatedTracks));
  const node = allNodes(model).find(node => node.ObjectId === id), property = movementProperties[change.mode];
  if (!node || !property) throw new Error('Select an object and a Movement tool.');
  const values = change.values || ['X', 'Y', 'Z'].map(axis => axis === change.axis ? change.amount : change.mode === 'scale' ? 1 : 0);
  if (values.length !== 3 || !finite(values)) throw new Error('Enter finite X, Y, and Z values.');
  const control = change.control || { joints: [], heads: [] }, driver = control.driver ?? control.joints[0] ?? id, followers = control.followers || [];
  if (!control.joints.length) id = driver;
  const initialMatrices = control.joints.length || control.heads.length ? sampled(model, frame, sequence, globalTime) : null;
  const grip = control.joints.length ? poseControlGrip(model, id) : null;
  let offset = v3(values);
  if (grip && change.space === 'local') offset.applyQuaternion(rigidRotation(initialMatrices.get(id)));
  offset.fromArray(constrainMovementVector(offset.toArray(), change));
  const headRotations = control.heads.map(id => ({ id, rotation: rigidRotation(initialMatrices.get(id)) }));
  const used = new Set(), captured = constraints.filter(pin => [driver, ...followers].some(root => pin.chain.end !== root && descendantOf(model, pin.chain.end, root))).map(pin => {
    for (const joint of poseChainIds(pin.chain)) { if (used.has(joint)) throw new Error('Limb controls must have separate joint chains.'); used.add(joint); }
    const pose = poseAt(model, pin.chain);
    const target = pin.pinned === false && matchesPoseTarget(pin.target, pin.chain, pose, frame, sequence) ? pin.target : null;
    return { ...pin, pinned: pin.pinned !== false, pose, position: v3(pin.position || target?.position || pose.end), orientation: pin.orientation || target?.orientation || pose.rotations[2].toArray() };
  });
  const fixed = captured.filter(pin => pin.pinned);
  const reachBounds = pose => { const outer = pose.lengths.reduce((a,b) => a+b,0); return [Math.max(0, 2 * Math.max(...pose.lengths) - outer), outer]; };
  const transformed = fraction => {
    const copy = posePreviewModel(model), target = allNodes(copy).find(item => item.ObjectId === id);
    if (grip) {
      const goal = grip.clone().applyMatrix4(initialMatrices.get(id)).addScaledVector(offset, fraction);
      solveConnectedOnClone(copy, control.joints, grip, goal, frame, sequence, globalTime);
    } else {
      // Ordinary Movement owns these tracks in-place; detach just its channels.
      for (const channel of Object.values(movementProperties)) if (target[channel]) target[channel] = structuredClone(target[channel]);
      const scaled = values.map(value => change.mode === 'scale' ? 1 + (value - 1) * fraction : value * fraction);
      applyMovementTransform(copy, [id], frame, sequence, { ...change, values: scaled });
    }
    if (followers.length) {
      const before = sampled(model, frame, sequence, globalTime);
      for (const follower of followers) {
        const anchor = control.carriers?.[follower] ?? id, after = sampled(copy, frame, sequence, globalTime);
        const delta = after.get(anchor).clone().multiply(before.get(anchor).clone().invert());
        const carried = allNodes(copy).find(node => node.ObjectId === follower);
        for (const channel of ['Translation', 'Rotation']) if (carried[channel]) carried[channel] = structuredClone(carried[channel]);
        const origin = point(model, carried, before), goal = origin.clone().applyMatrix4(delta);
        applyMovementTransform(copy, [follower], frame, sequence, { mode: 'move', space: 'world', values: goal.sub(origin).toArray() });
        setWorldRotation(copy, carried, rigidRotation(delta).multiply(rigidRotation(before.get(follower))), sampled(copy, frame, sequence, globalTime), frame, sequence, globalTime);
      }
    }
    return copy;
  };
  const reachable = copy => fixed.every(pin => {
    const pose = poseAt(copy, pin.chain), distance = pose.root.distanceTo(pin.position);
    return distance <= reachBounds(pose)[1] + pose.tolerance * .1 && distance >= reachBounds(pose)[0] - pose.tolerance * .1;
  });
  let fraction = 1, copy = transformed(1), blockingKeys = [];
  if (fixed.length) {
    let linear = change.mode === 'move' && !grip;
    const poses = fixed.map(pin => poseAt(copy, pin.chain));
    linear &&= poses.every((pose, i) => pose.lengths.every((length, j) => Math.abs(length - fixed[i].pose.lengths[j]) < pose.tolerance));
    if (linear) for (let i = 0; i < fixed.length; i++) {
      const pin = fixed[i], delta = poses[i].root.clone().sub(pin.pose.root);
      const boundary = reachFraction(pin.pose.root.clone().sub(pin.position), delta, ...reachBounds(pin.pose));
      if (boundary < fraction - 1e-7) { fraction = boundary; blockingKeys = [pin.chain.key]; }
      else if (boundary < 1 && Math.abs(boundary - fraction) <= 1e-7) blockingKeys.push(pin.chain.key);
      fraction = Math.min(fraction, boundary);
    }
    else {
      // Rotated/scaled ancestry follows the existing transform, not a linear
      // substitute. Locate its first reach boundary without running IK loops.
      let previous = 0;
      for (let step = 1; step <= 8; step++) {
        const next = step / 8;
        if (!reachable(next === 1 ? copy : transformed(next))) {
          let low = previous, high = next;
          for (let iteration = 0; iteration < 20; iteration++) { const middle = (low + high) / 2; if (reachable(transformed(middle))) low = middle; else high = middle; }
          fraction = low;
          const beyond = transformed(high);
          blockingKeys = fixed.filter(pin => {
            const pose = poseAt(beyond, pin.chain), distance = pose.root.distanceTo(pin.position), [inner, outer] = reachBounds(pose);
            return distance > outer + pose.tolerance * .1 || distance < inner - pose.tolerance * .1;
          }).map(pin => pin.chain.key);
          break;
        }
        previous = next;
      }
    }
    if (fraction < 1) copy = transformed(Math.max(0, fraction * (1 - 1e-7)));
  }
  const byId = new Map(allNodes(copy).map(node => [node.ObjectId, node])), target = byId.get(id);
  const changes = grip ? control.joints.map(id => ({ id, property: 'Rotation', value: sampleMovement(copy, byId.get(id), 'Rotation', frame, sequence) })) : [{ id, property, value: sampleMovement(copy, target, property, frame, sequence) }], bends = [];
  for (const id of followers) for (const property of ['Translation', 'Rotation']) changes.push({ id, property, value: sampleMovement(copy, byId.get(id), property, frame, sequence) });
  if (change.rotateOnOwnAxis && change.mode === 'rotate') changes.push({ id, property: 'Translation', value: sampleMovement(copy, target, 'Translation', frame, sequence) });
  for (const pin of captured) {
    let result;
    try { result = solveChainOnClone(copy, pin.chain, frame, sequence, pin.position, { orientation: pin.orientation, bendMemory: pin.bendLocal && v3(pin.bendLocal).applyQuaternion(pin.pose.rotations[0]), strict: pin.pinned, globalTime, validatedTracks }); }
    catch (cause) { if (pin.pinned) cause.blockingKeys = [pin.chain.key]; throw cause; }
    changes.push(...result.changes); bends.push({ key: pin.chain.key, local: v3(result.bend).applyQuaternion(result.pose.rotations[0].clone().invert()).toArray() });
  }
  for (const head of headRotations) changes.push(setWorldRotation(copy, byId.get(head.id), head.rotation, sampled(copy, frame, sequence, globalTime), frame, sequence, globalTime));
  for (const pin of fixed) {
    const after = poseAt(copy, pin.chain);
    if (after.end.distanceTo(pin.position) > pin.pose.tolerance * 4 || 1 - Math.abs(after.rotations[2].dot(new Quaternion().fromArray(pin.orientation))) > 1e-7) throw Object.assign(new Error('This transform cannot retain the pins.'), { blockingKeys: [pin.chain.key] });
  }
  const targets = captured.filter(pin => !pin.pinned).map(pin => {
    const pose = poseAt(copy, pin.chain);
    return { key: pin.chain.key, frame, sequence, joints: poseChainIds(pin.chain),
      position: pin.position.toArray(), orientation: pin.orientation,
      points: [pose.root, pose.middle, pose.end].map(point => point.toArray()), rotations: pose.rotations.map(rotation => rotation.toArray()) };
  });
  const unique = [...new Map(changes.map(item => [`${item.id}:${item.property}`, item])).values()];
  // Validate ownership against the original tracks, after all compensations.
  const prepared = prepareMovementPose(model, unique, frame, sequence, change.restrictions);
  return { changes: unique.filter(item => prepared.some(track => track.id === item.id && track.property === item.property)), bends, targets, limited: fraction < 1, fraction, blockingKeys };
}

const chainTrackScope = chain => [...poseChainIds(chain).map(id => ({ id, property: 'Rotation' })), ...(chain.grip ? [{ id: chain.end, property: 'Translation' }] : [])];

export function poseTrackScope(config, target, mode, model) {
  if (!target) return [];
  if (target.kind === 'body' || target.kind === 'node') {
    const id = target.kind === 'body' ? config.body : target.id;
    const control = model ? poseNodeControl(model, config, target, mode) : { joints: [], heads: [] };
    const direct = control.joints.length ? control.joints.map(id => ({ id, property: 'Rotation' })) : [{ id: control.driver ?? id, property: movementProperties[mode] || 'Translation' },  ];
    direct.push(...(control.followers || []).flatMap(id => ['Translation','Rotation'].map(property => ({ id, property }))));
    const pins = model ? poseNodeConstraints(model, config, id, mode, target).map(item => item.chain) : config.chains.filter(chain => config.pins.includes(chain.key));
    return [...new Map([...direct, ...control.heads.map(id => ({ id, property: 'Rotation' })), ...pins.flatMap(chainTrackScope)].map(item => [`${item.id}:${item.property}`, item])).values()];
  }
  const chain = config.chains.find(item => item.key === target.key);
  if (chain && mode === 'scale') return [{ id: chain.end, property: 'Scaling' }];
  return chain ? mode === 'rotate' && target.kind !== 'bend' ? chainTrackScope(chain).filter(item => item.id === chain.end) : chainTrackScope(chain) : [];
}
