// Transfer (XFER): copy animation from a donor onto the open model's own bones,
// per body part. Contract: docs/agent-tasks/transfer-xl.md. Pure module: no DOM,
// no React. The open model keeps its bones, pivots, skin and animations; the
// transfer only writes one new animation's keys.
import { Matrix3, Matrix4, Quaternion, Vector3 } from 'three';
import { allNodes, composeNodeMatrices, isGlobalTrack, keysInInterval, nodePivot, sampleTrack, skinGeoset, visitTracks } from './animation.js';
import { nodeIndex } from './node-hierarchy.js';
import { poseChainIds, poseNodeRole, suggestPoseBody, suggestPoseRig } from './pose-ik.js';
import { poseLimbStart, poseSkinFlatness } from './pose-recognition.js';
import { createSequence, standSequenceIndex } from './sequence-editor.js';
import { makeKey } from './animation-tracks.js';
import { trackValueError } from './optimizexl-animation.js';
import { extentsExclusions } from './model-extents.js';
import { box, finish, include, sequenceSampler } from './optimizexl-bounds.js';
import { geosetAlphaTrack, geosetVisibleIn } from './geoset-extras.js';
import { isWeaponName, nameTokens } from './rig-names.js';

export const TRANSFER_PART_LABELS = Object.freeze({
  hips: 'Hips', chest: 'Chest', head: 'Head', armL: 'Left arm', armR: 'Right arm',
  legL: 'Left leg', legR: 'Right leg', wingL: 'Left wing', wingR: 'Right wing', tail: 'Tail',
});
/** "Left arm", or "Left arm 2" for an extra limb of that kind. */
export function transferPartLabel(key) {
  const [, stem, number] = String(key).match(/^(.*?)(\d*)$/);
  return `${TRANSFER_PART_LABELS[stem] || stem}${number ? ` ${number}` : ''}`;
}
const TRUNK_ORDER = ['hips', 'chest', 'head'];
const swapSide = key => key.replace(/^(arm|leg|wing)([LR])/, (_, kind, side) => kind + (side === 'L' ? 'R' : 'L'));

// ---------------------------------------------------------------- maths
const UP = Object.freeze(new Vector3(0, 0, 1));
const v3 = value => new Vector3().fromArray(value);
const mul = (...qs) => qs.reduce((a, b) => a.multiply(b), new Quaternion());
const inv = q => q.clone().invert();
const axisAngle = (axis, radians) => new Quaternion().setFromAxisAngle(axis, radians);
const mirrorQ = q => new Quaternion(-q.x, q.y, -q.z, q.w);
const mirrorV = v => new Vector3(v.x, -v.y, v.z);
const DEG = Math.PI / 180;
function rotationOf(matrix) {
  const q = new Quaternion(); matrix.decompose(new Vector3(), q, new Vector3()); return q.normalize();
}
/** q to the power w (w may exceed 1), along the shortest arc. */
function qPow(q, w) {
  const sign = q.w < 0 ? -1 : 1, x = q.x * sign, y = q.y * sign, z = q.z * sign, s = Math.hypot(x, y, z);
  if (s < 1e-12) return new Quaternion();
  const half = Math.atan2(s, q.w * sign) * w, k = Math.sin(half) / s;
  return new Quaternion(x * k, y * k, z * k, Math.cos(half));
}
function slerpW(a, b, w) {
  if (w === 1) return b.clone();
  if (w === 0) return a.clone();
  return a.clone().multiply(qPow(inv(a).multiply(b), w)).normalize();
}
const arc = (from, to) => from && to && from.lengthSq() > 1e-12 && to.lengthSq() > 1e-12 ? new Quaternion().setFromUnitVectors(from.clone().normalize(), to.clone().normalize()) : new Quaternion();
const smooth = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);

// ---------------------------------------------------------------- per-model caches
// One entry per model object: node lookups, the rig, and dense samples keyed by
// "sequence:frame". Models are read only; clearTransferCache after editing one.
const cache = new WeakMap();
function modelInfo(model) {
  let info = cache.get(model);
  if (!info) {
    const nodes = allNodes(model), tree = nodeIndex(model, nodes);
    info = { nodes, ids: nodes.map(node => node.ObjectId), byId: tree.byId, tree, joints: new Set([...(model.Bones || []), ...(model.Helpers || [])].map(node => node.ObjectId)), samples: new Map(), rigs: new Map(), skeletons: new Map() };
    cache.set(model, info);
  }
  return info;
}
/** Forget the cached rig and samples, for a model that was edited in place. */
export function clearTransferCache(model) { cache.delete(model); }

const REST = { t: new Vector3(), r: new Quaternion(), s: new Vector3(1, 1, 1) };
/** Local TRS and world matrices of every node at a whole frame (sequence -1 = rest pose). */
function sampleAt(model, sequence, frame) {
  const info = modelInfo(model), f = Math.round(frame), key = `${sequence}:${f}`;
  let sample = info.samples.get(key);
  if (sample) return sample;
  const interval = model.Sequences?.[sequence]?.Interval, local = new Map();
  const options = { interval, globalSequences: model.GlobalSequences, globalTime: f };
  for (const node of info.nodes) local.set(node.ObjectId, !interval ? REST : {
    t: v3(sampleTrack(node.Translation, f, { ...options, fallback: [0, 0, 0] })),
    r: new Quaternion().fromArray(sampleTrack(node.Rotation, f, { ...options, fallback: [0, 0, 0, 1], quaternion: true })).normalize(),
    s: v3(sampleTrack(node.Scaling, f, { ...options, fallback: [1, 1, 1] })),
  });
  const world = composeNodeMatrices(model, info.ids, node => local.get(node.ObjectId), info.byId);
  sample = { local, world, rot: new Map(), pos: new Map() };
  if (info.samples.size >= 2000) info.samples.clear(); // about 50 MB; slider changes keep adding frames
  info.samples.set(key, sample);
  return sample;
}
function worldRot(sample, id) {
  let q = sample.rot.get(id);
  if (!q) sample.rot.set(id, q = rotationOf(sample.world.get(id) || new Matrix4()));
  return q;
}
function worldPos(model, sample, id) {
  let p = sample.pos.get(id);
  if (!p) sample.pos.set(id, p = v3(nodePivot(model, modelInfo(model).byId.get(id), id)).applyMatrix4(sample.world.get(id) || new Matrix4()));
  return p;
}

// ---------------------------------------------------------------- rig
/** Body parts of a model, read once per model object and skeleton with POSE
 * recognition. A model with separate skeletons (a hero's demon form, a death
 * copy) uses the one the animation moves: `sequence` is the animation in use
 * (the taken one for a donor, the body animation for the open model); without
 * it the model's Stand decides. */
export function transferRig(model, { sequence, actor, mainArms = false } = {}) {
  const info = modelInfo(model);
  if (info.pose === undefined) {
    info.pose = readPose(model);
    const pose = info.pose.pose;
    if (pose?.body != null) {
      completeTransferLimbs(model, info, pose);
      // A separately rooted rider can win the POSE body vote. Find the walking
      // skeleton under its feet before assigning animation keys to either actor.
      const under = id => info.tree.isAncestor(id, pose.body);
      const riderLegs = pose.chains.filter(chain => legChain(chain) && under(chain.root));
      const outside = pose.chains.filter(chain => legChain(chain) && info.tree.root(chain.root) !== info.tree.root(pose.body));
      if (riderLegs.length === 2 && outside.length === 4 && pose.chains.some(chain => armChain(chain) && under(chain.root))
          && outside.every(chain => info.tree.root(chain.root) === info.tree.root(outside[0].root))) {
        const walker = suggestPoseBody(model, outside, info.tree), si = defaultSequence(model);
        const ref = sampleAt(model, si, model.Sequences[si]?.Interval[0] ?? 0), pos = id => worldPos(model, ref, id);
        if (Math.max(...outside.map(chain => pos(chain.end).z)) < Math.min(...riderLegs.map(chain => pos(chain.end).z))
            && seatedAssemblies(model, info, walker, pos, si).some(item => info.tree.isAncestor(pose.body, item.top))) pose.body = walker;
      }
    }
  }
  if (!info.pose.pose) return info.rigs.get(null) || (info.rigs.set(null, failedRig(info.pose.error)), info.rigs.get(null));
  const skeleton = skeletonFor(model, info, Number.isInteger(sequence) && model.Sequences?.[sequence]?.Interval ? sequence : defaultSequence(model));
  // 'both' is the plain reading; 'seated' and 'walker' read one of two creatures alone and
  // fall back to 'both' on a model that is a single creature.
  const wanted = actor === 'seated' || actor === 'walker' ? actor : 'both';
  const key = mainArms ? `${skeleton}:${wanted}:mainArms` : wanted === 'both' ? skeleton : `${skeleton}:${wanted}`;
  if (!info.rigs.has(key)) {
    const rig = readRig(model, info, skeleton, wanted, mainArms);
    info.rigs.set(key, rig.actor === wanted || wanted === 'both' ? rig : transferRig(model, { sequence }));
  }
  return info.rigs.get(key);
}

// Fill paired articulated feet and wings missed by the handle reader. Both
// sides must agree on the same socket and motion-bearing skeleton.
function completeTransferLimbs(model, info, pose) {
  const {tree, joints} = info;
  const transforms = [...joints].map(id => tree.byId.get(id));
  const path = (ids, kind, label) => ({key:'limb:' + ids.at(-1), root:ids[0], middle:ids[1],
    end:ids.at(-1), joints:ids, kind, label, short:ids.length < 3});
  if (!pose.chains.some(legChain)) {
    const feet = ['L','R'].map(side => {
      const foot = transforms.find(n => n.Name.trim().toUpperCase() === side+'F');
      if (!foot) return null;
      const line = tree.ancestors(foot.ObjectId).filter(id => new RegExp('^'+side+'L[0-9]*$', 'i').test(tree.byId.get(id).Name));
      if (!line.length || tree.parentOf(foot.ObjectId) !== line[0]) return null;
      return [...line.reverse(), foot.ObjectId];
    });
    if (feet.every(Boolean) && tree.parentOf(feet[0][0]) === tree.parentOf(feet[1][0])
        && feet.every(ids => tree.byId.get(ids.at(-1)).PivotPoint[2] < tree.byId.get(ids[0]).PivotPoint[2]))
      for (const ids of feet) pose.chains.push(path(ids, 'leg', 'Foot'));
  }
  if (pose.chains.some(chain => chain.label === 'Wing')) return;
  const descendants = id => transforms.filter(n => n.ObjectId !== id && tree.isAncestor(n.ObjectId,id));
  const wings = [];
  for (const root of transforms) {
    if (!root.Rotation?.Keys?.length || !root.PivotPoint) continue;
    const ids = [root.ObjectId], x = root.PivotPoint[0], y = root.PivotPoint[1], z = root.PivotPoint[2];
    const named = /^wing[\s_.-]*[lr]/i.test(root.Name);
    let width = 0;
    while (ids.length < 10) {
      const children = (tree.children.get(ids.at(-1)) ?? []).filter(n => joints.has(n.ObjectId) && n.Rotation?.Keys?.length
          && !ids.includes(n.ObjectId) && Math.abs(n.PivotPoint[1] - y) > width + 1e-3);
      const next = children.sort((a,b) => Math.abs(b.PivotPoint[1]-y) - Math.abs(a.PivotPoint[1]-y))[0];
      if (!next) break;
      ids.push(next.ObjectId);
      width = Math.abs(next.PivotPoint[1] - y);
    }
    if (ids.length < 3) continue;
    const end = tree.byId.get(ids.at(-1)).PivotPoint;
    if (width < 1.3 * Math.hypot(end[0]-x, end[2]-z) || /hand|leg|arm|foot|cape|cloth/i.test(root.Name)) continue;
    const existing = pose.chains.find(chain => poseChainIds(chain).some(id => ids.includes(id)));
    if (existing && (existing.kind === 'leg' || existing.cloth)) continue;
    wings.push({root,ids,width,named,existing,sign:Math.sign(end[1]-y)});
  }
  for (const a of wings) {
    const b = wings.find(w => w.sign === -a.sign && w.root.Parent === a.root.Parent &&
      Math.min(a.width,w.width) > .7*Math.max(a.width,w.width) &&
      a.sign*(a.root.PivotPoint[1]-w.root.PivotPoint[1]) > 0);
    if (!b) continue;
    if (![a,b].every(w => w.named || (poseSkinFlatness(model,{descendants},w.ids) ?? 1) < .30)) continue;
    for (const w of [a,b]) {
      if (w.existing) w.existing.label = 'Wing';
      else pose.chains.push(path(w.ids, 'arm', 'Wing'));
    }
    // A separate rider's arms can be the only handles found before reading
    // the mount's wings. Both actors then live under the wing socket.
    if (tree.isAncestor(pose.body,a.root.Parent) && pose.body !== a.root.Parent)
      pose.body = a.root.Parent;
    break;
  }
}

function defaultSequence(model) {
  const sequences = model.Sequences || [];
  let sequence = standSequenceIndex(model);
  if (sequence < 0 && sequences.length) sequence = 0;
  return sequences[sequence]?.Interval ? sequence : -1;
}
function readPose(model) {
  const sequence = defaultSequence(model), frame = sequence >= 0 ? model.Sequences[sequence].Interval[0] : 0;
  // Short limbs (one or two joints, too short for a POSE handle) are limbs here like any chain.
  try { const pose = suggestPoseRig(model, frame, Math.max(sequence, 0)); return { pose: pose.stubs ? { ...pose, chains: [...pose.chains, ...pose.stubs] } : pose }; } catch (error) { return { error: `The rig could not be read: ${error.message}` }; }
}
// POSE's chains as Transfer reads them. A chain the shared recogniser marks as hanging cloth
// (`cloth`, see suggestPoseRig) is no limb: never an arm, never a part. For the search for a
// seated creature alone it still counts as a leg that hangs (never one that walks): strips astride
// a walker, on a subtree with arms of its own, have the shape of a rider (see seatLegs in readRig).
const armChain = chain => chain.kind === 'arm' && chain.label !== 'Wing' && !chain.cloth;
const legChain = chain => chain.kind === 'leg' && chain.label !== 'Wing';
const hangingChain = chain => legChain(chain) || chain.cloth === true;
const failedRig = sentence => ({ ok: false, reference: { sequence: -1, frame: 0 }, body: null, parts: {}, hipHeight: 0, ground: 0, weaponSide: null, facing: [1, 0, 0], problems: [sentence] });

/** A model is not always one creature under one bone. The walking assembly (the
 * body joint's own subtree) gives hips and legs; when it has no arms of its own,
 * the upper body may be another assembly that sits on it: a rider on a mount, a
 * torso on a walker. This finds those assemblies by structure and place alone,
 * never by name: the tops of subtrees outside the body's that hold an arm (not a
 * wing) whose root stands over the walker (inside its floor plan grown by 30%,
 * not below its body joint by more than a quarter of its height), in the pose
 * `pos` gives. Each is `{ top, arms }`. */
function seatedAssemblies(model, info, body, pos, sequence) {
  const { tree, joints } = info, { pose } = info.pose, arm = armChain, leg = legChain;
  if (body == null) return [];
  // A walker with arms of its own (a two-legged mount with forelimbs) is ridden only by an
  // assembly that also has legs, a pair astride, every one clear of the ground, drawn in the
  // same animation as the walker, and only when no rider is nested under the walker already.
  // A second skeleton in the same place (another form, a hidden copy) is not a rider.
  const armed = pose.chains.some(chain => arm(chain) && tree.isAncestor(chain.root, body));
  const outside = pose.chains.filter(chain => arm(chain) && !tree.isAncestor(chain.root, body));
  if (!outside.length) return [];
  const walker = [...joints].filter(id => tree.isAncestor(id, body)).map(pos);
  if (!walker.length) return [];
  const lo = new Vector3(Infinity, Infinity, Infinity), hi = new Vector3(-Infinity, -Infinity, -Infinity);
  for (const p of walker) { lo.min(p); hi.max(p); }
  const padX = Math.max(0.3 * (hi.x - lo.x), 0.1 * (hi.z - lo.z)), padY = Math.max(0.3 * (hi.y - lo.y), 0.1 * (hi.z - lo.z)), floor = pos(body).z - 0.25 * (hi.z - lo.z);
  const over = p => p.x >= lo.x - padX && p.x <= hi.x + padX && p.y >= lo.y - padY && p.y <= hi.y + padY && p.z >= floor;
  // The top of an arm's own assembly: its highest ancestor that the body does not hang from.
  const topOf = id => { let top = id; for (const ancestor of tree.ancestors(id, true)) { if (tree.isAncestor(body, ancestor)) break; top = ancestor; } return top; };
  const found = new Map();
  for (const chain of outside) { if (!over(pos(chain.root))) continue; const top = topOf(chain.root); if (!found.has(top)) found.set(top, { top, arms: [] }); found.get(top).arms.push(chain); }
  if (!armed) return [...found.values()];
  const feet = pose.chains.filter(chain => leg(chain) && tree.isAncestor(chain.root, body)).map(chain => pos(chain.end).z);
  if (!feet.length) return [];
  const lowest = Math.min(...feet), clear = lowest + 0.15 * (hi.z - Math.min(lo.z, lowest)), middle = pos(body).y;
  if (feet.some(z => z > clear) || !drawnIn(model, info, body, sequence)) return [];
  return [...found.values()].filter(item => {
    const ends = pose.chains.filter(chain => hangingChain(chain) && tree.isAncestor(chain.root, item.top)).map(chain => pos(chain.end)), sides = ends.map(end => Math.sign(end.y - middle));
    return ends.length && ends.every(end => end.z > clear) && sides.includes(1) && sides.includes(-1) && drawnIn(model, info, item.top, sequence);
  });
}
/** Whether skin on the joints under `top` is drawn in an animation: some geoset with a vertex
 * weighted to one of them shows in it. */
function drawnIn(model, info, top, sequence) {
  const item = model.Sequences?.[sequence];
  if (!item?.Interval) return true;
  const under = id => info.tree.isAncestor(id, top);
  return (model.Geosets || []).some((geoset, index) => {
    const alpha = geosetAlphaTrack(model, index);
    if (!(isGlobalTrack(alpha) || geosetVisibleIn(model, alpha, item, item.Interval))) return false;
    const count = (geoset.Vertices?.length || 0) / 3, skin = geoset.SkinWeights;
    if (skin?.length >= count * 8 && count) { for (let v = 0; v < count; v++) for (let i = 0; i < 4; i++) if (skin[v * 8 + 4 + i] > 0 && under(skin[v * 8 + i])) return true; return false; }
    return (geoset.Groups || []).some(group => Array.from(group).some(under));
  });
}
/** The skeleton a joint belongs to: its hierarchy root, except that an assembly
 * seated on the body (see seatedAssemblies, read in the model's Stand) belongs to
 * the body's skeleton even when it hangs from a root of its own. */
function skeletonRoot(model, info, id) {
  const { pose } = info.pose, root = info.tree.root(id);
  if (!pose || pose.body == null) return root;
  if (!info.seatedRoots) {
    const sequence = defaultSequence(model), ref = sampleAt(model, sequence, sequence >= 0 ? model.Sequences[sequence].Interval[0] : 0);
    info.seatedRoots = new Set(seatedAssemblies(model, info, pose.body, id => worldPos(model, ref, id), sequence).map(item => info.tree.root(item.top)));
  }
  return info.seatedRoots.has(root) ? info.tree.root(pose.body) : root;
}
/** Rotation keys a skeleton (a hierarchy root) carries inside one animation. */
function skeletonKeys(model, info, root, sequence) {
  const interval = model.Sequences?.[sequence]?.Interval;
  if (!interval) return 0;
  let count = 0;
  for (const id of info.joints) {
    const track = info.byId.get(id).Rotation;
    if (track?.Keys && skeletonRoot(model, info, id) === root && !isGlobalTrack(track, model)) count += keysInInterval(track, interval).length;
  }
  return count;
}
/** Among separate skeletons with limbs, the one with the most Rotation keys in
 * the animation; the POSE body's skeleton when none moves. */
function skeletonFor(model, info, sequence) {
  const { pose } = info.pose, key = `skeleton:${sequence}`;
  if (info.skeletons.has(key)) return info.skeletons.get(key);
  const roots = [...new Set(pose.chains.map(chain => skeletonRoot(model, info, chain.root)))];
  let best = pose.body != null ? info.tree.root(pose.body) : roots[0] ?? null, most = best == null ? -1 : skeletonKeys(model, info, best, sequence);
  for (const root of roots) { const count = skeletonKeys(model, info, root, sequence); if (count > most) { best = root; most = count; } }
  info.skeletons.set(key, best);
  return best;
}

function readRig(model, info, skeleton, wanted = 'both', mainArms = false) {
  const { tree, byId, joints } = info, problems = [], sequences = model.Sequences || [], { pose } = info.pose;
  const roleOf = id => pose.roles?.[id] || poseNodeRole(byId.get(id));
  // The body of this skeleton: POSE's body, else the joint that drives all its limbs.
  let body = pose.body != null && tree.root(pose.body) === skeleton ? pose.body : null;
  const own = pose.chains.filter(chain => skeletonRoot(model, info, chain.root) === skeleton);
  if (body == null && own.length) {
    try { body = suggestPoseBody(model, own.filter(chain => !chain.short), tree); body = tree.ancestors(body, true).find(id => roleOf(id) === 'Body' && !/death|portrait/i.test(byId.get(id).Name)) ?? body; } catch { body = null; }
  }
  // A body that drives none of this skeleton's limbs only carries the name (a still skin bone called "Body" beside
  // the helper that moves the creature): the body is then the joint the legs hang from (the limbs, with no leg).
  let rebased = false;
  const limbsHere = own.filter(chain => !chain.cloth && chain.label !== 'Chain');
  if (body != null && limbsHere.length && !limbsHere.some(chain => chain.root !== body && tree.isAncestor(chain.root, body))) {
    const hung = limbsHere.filter(chain => joints.has(tree.parentOf(chain.root))), legsHere = hung.filter(legChain), basis = legsHere.length ? legsHere : hung;
    const driver = basis.length ? tree.ancestors(basis[0].root).find(id => joints.has(id) && basis.every(chain => chain.root !== id && tree.isAncestor(chain.root, id))) : undefined;
    if (driver != null) { body = driver; rebased = true; }
  }
  // Reference pose: the first frame of this skeleton's own Stand (the plain
  // Stand when this skeleton moves most in it), else of an animation it moves
  // most in, else the plain Stand, else rest.
  const plain = defaultSequence(model), dominant = s => skeletonFor(model, info, s) === skeleton && skeletonKeys(model, info, skeleton, s) > 0;
  const indices = sequences.map((_, i) => i).filter(i => sequences[i]?.Interval);
  let sequence = plain >= 0 && dominant(plain) ? plain
    : indices.find(i => /^\s*stand/i.test(sequences[i].Name || '') && !/portrait/i.test(sequences[i].Name || '') && dominant(i))
      ?? indices.find(i => !/portrait|death|decay|dissipate/i.test(sequences[i].Name || '') && dominant(i)) ?? plain;
  const frame = sequence >= 0 ? sequences[sequence].Interval[0] : 0;
  const reference = { sequence, frame };
  const fail = sentence => ({ ...failedRig(sentence), reference, problems: [...problems, sentence] });
  if (body == null || !joints.has(body)) return fail('No body bone was found, so this model has no parts to transfer.');
  const ref = sampleAt(model, sequence, frame), pos = id => worldPos(model, ref, id).clone();
  // Two creatures in one model, by structure and place only. The walker is the
  // body joint's subtree with the legs that reach the ground. The seated one is
  // either a separate assembly that sits on it (seatedAssemblies; of several, a
  // rider and its death copy, the one that turns most in the reference animation),
  // or a creature nested under the body: one subtree with an arm and a leg of its
  // own that hangs clear of the ground (over 15% of the walker's height above its
  // lowest foot). Arms on a walking body without such legs (a centaur), or limbs
  // that join the walker's trunk separately (a dragon), are one creature.
  const turning = top => { const interval = sequences[sequence]?.Interval; let count = 0; if (interval) for (const id of joints) { const track = byId.get(id).Rotation; if (track?.Keys && tree.isAncestor(id, top) && !isGlobalTrack(track, model)) count += keysInInterval(track, interval).length; } return count; };
  // A seated creature's own chains. Legs hang from the hips: when everything that hangs from it
  // like a leg is hanging cloth (strips on the chest; the rig carries the shared recogniser's
  // answer), its legs are the pair of plain chains that hang, one each side, from a hip joint the
  // joint its arms hang from hangs from. `found` is that pair.
  const seatLegs = tops => {
    const seated = id => tops.some(top => tree.isAncestor(id, top)), chains = pose.chains.filter(chain => seated(chain.root));
    const arms = chains.filter(armChain), read = chains.filter(hangingChain), allCloth = read.length > 0 && read.every(chain => chain.cloth === true);
    const chestOf = arms.length ? tree.ancestors(arms[0].root).find(id => seated(id) && arms.every(chain => tree.isAncestor(chain.root, id))) : null;
    if (chestOf == null || !allCloth) return { chains, cloth: allCloth, found: null };
    const claimed = new Set(chains.flatMap(poseChainIds)), children = id => [...joints].filter(other => tree.parentOf(other) === id).sort((a, b) => pos(a).z - pos(b).z);
    for (const hip of tree.ancestors(chestOf).filter(seated)) {
      const found = children(hip).filter(id => !tree.isAncestor(chestOf, id) && !claimed.has(id)).map(root => {
        const middle = children(root)[0], end = middle == null ? null : children(middle)[0];
        return end != null && pos(end).z < pos(root).z ? { root, middle, end, joints: [root, middle, end], kind: 'leg', key: `limb:${end}` } : null;
      }).filter(Boolean);
      if (found.length === 2 && Math.sign(pos(found[0].root).y - pos(hip).y) * Math.sign(pos(found[1].root).y - pos(hip).y) < 0) return { chains: [...chains.filter(chain => !read.includes(chain)), ...found], cloth: true, found };
    }
    return { chains, cloth: true, found: null };
  };
  const apart = seatedAssemblies(model, info, body, pos, sequence).filter(item => skeletonRoot(model, info, item.top) === skeleton).sort((a, b) => turning(b.top) - turning(a.top))[0];
  let seatTops = apart ? [apart.top] : [];
  if (!apart) {
    const legs = pose.chains.filter(chain => legChain(chain) && tree.isAncestor(chain.root, body)), below = [...joints].filter(id => tree.isAncestor(id, body)).map(id => pos(id).z);
    const lowest = Math.min(...legs.map(chain => pos(chain.end).z)), tall = Math.max(...below) - Math.min(...below, lowest);
    const grounded = chain => pos(chain.end).z <= lowest + 0.15 * tall;
    // Hanging cloth under the body hangs with the legs that do not reach the ground; it never walks.
    const walking = legs.filter(grounded), hanging = pose.chains.filter(chain => hangingChain(chain) && tree.isAncestor(chain.root, body) && !grounded(chain));
    // A forelimb read as an arm that reaches the ground walks too (a four-footed mount).
    const forelimbs = pose.chains.filter(chain => armChain(chain) && tree.isAncestor(chain.root, body) && grounded(chain));
    const carriesWalking = id => walking.some(chain => tree.isAncestor(chain.root, id)) || forelimbs.some(chain => tree.isAncestor(chain.root, id));
    const topOf = id => { let top = id; for (const ancestor of tree.ancestors(id, true)) { if (ancestor === body || carriesWalking(ancestor)) break; top = ancestor; } return top; };
    const freeArms = pose.chains.filter(chain => armChain(chain) && tree.isAncestor(chain.root, body) && !carriesWalking(chain.root));
    // One creature of its own: a single subtree that holds a hanging leg and an arm (a rider's
    // own root). Forelimbs and raised or dangling legs that join the walker's trunk at
    // different places (a dragon, a spider-bodied creature) are that walker's own limbs.
    // Its hanging legs come as a pair, one each side of the walker's middle (a rider astride).
    const middle = pos(body).y, astride = top => { const sides = hanging.filter(chain => tree.isAncestor(chain.root, top)).map(chain => Math.sign(pos(chain.end).y - middle)); return sides.includes(1) && sides.includes(-1); };
    const tops = [...new Set(hanging.map(chain => topOf(chain.root)))].filter(top => astride(top) && freeArms.some(chain => tree.isAncestor(chain.root, top)));
    const size = top => pose.chains.filter(chain => tree.isAncestor(chain.root, top)).length;
    // One creature's own subtree holds no wings and one line of neck and head joints. A rider
    // that hangs from its mount's chest (a dragon's, with the wings, neck and head beside it)
    // would take all of that along: the seat is then narrowed to the rider's own root, the
    // highest joint above its legs and arms whose subtree is still one creature's.
    const heads = (pose.nodes || []).filter(id => joints.has(id) && ['Neck', 'Head'].includes(roleOf(id)) && tree.isAncestor(id, body));
    const oneCreature = top => !pose.chains.some(chain => chain.label === 'Wing' && tree.isAncestor(chain.root, top))
      && heads.filter(id => tree.isAncestor(id, top)).every((a, _, list) => list.every(b => tree.isAncestor(a, b) || tree.isAncestor(b, a)));
    // Upward from a creature's joint to its own root: through joints that add no limb, neck, head or tail of another.
    const tails = [...joints].filter(id => roleOf(id) === 'Tail' && tree.isAncestor(id, body));
    const adds = (id, seat) => [...pose.chains.map(chain => chain.root), ...heads, ...tails].some(other => tree.isAncestor(other, id) && !tree.isAncestor(other, seat));
    const ownRoot = (from, stop) => { let seat = from; for (const id of tree.ancestors(from)) { if (stop(id) || adds(id, seat)) break; seat = id; } return seat; };
    const narrowed = top => {
      if (oneCreature(top)) return top;
      const leg = hanging.find(chain => tree.isAncestor(chain.root, top));
      const core = tree.ancestors(leg.root, true).find(id => tree.isAncestor(id, top) && astride(id) && freeArms.some(chain => tree.isAncestor(chain.root, id)));
      return core != null && oneCreature(core) ? ownRoot(core, id => !tree.isAncestor(id, top)) : top;
    };
    if (walking.length && tops.length) seatTops = [narrowed(tops.sort((a, b) => size(b) - size(a))[0])];
    // Hanging legs that are all hanging cloth, with no real pair of legs under a hip, make no rider:
    // one creature with strips on its chest. The two-heads rule still reads it.
    if (seatTops.length) { const legs = seatLegs(seatTops); if (legs.cloth && !legs.found) seatTops = []; }
    // Or two heads: the subtree that holds the arms has a head of its own, and the walker has
    // another head outside it (a rider on a dragon). One head (a centaur) is one creature, and
    // so is a neck the arms hang from (the front of a four-legged body with a torso on it).
    if (!seatTops.length && walking.length && freeArms.length) {
      // The smallest subtree that holds every such arm and a head; another head must lie outside it.
      const holdsArms = id => freeArms.every(chain => tree.isAncestor(chain.root, id));
      const seat = tree.ancestors(freeArms[0].root, true).find(id => id !== body && !carriesWalking(id) && holdsArms(id) && heads.some(head => tree.isAncestor(head, id)));
      if (seat != null && oneCreature(seat) && heads.some(head => !tree.isAncestor(head, seat) && !tree.isAncestor(seat, head))) {
        seatTops = [ownRoot(seat, id => id === body || carriesWalking(id))];
      }
    }
  }
  // A weighted riding boot may end at the shin. Both thighs still belong
  // to the seated waist, even when only one foot produced a POSE handle.
  let shortRiderLegs = [];
  if (seatTops.length===1) {
    const waist = tree.parentOf(seatTops[0]);
    if (/rider.*(?:waist|hip|pelvis)/i.test(byId.get(waist)?.Name || '')) {
      const thighs=(tree.children.get(waist) || []).filter(n=>/thigh|upper.?leg/i.test(n.Name));
      if (thighs.length===2 && (pos(thighs[0].ObjectId).y-pos(waist).y)*(pos(thighs[1].ObjectId).y-pos(waist).y)<0) {
        seatTops=[waist];
        shortRiderLegs=thighs.filter(n=>!pose.chains.some(c=>tree.isAncestor(c.end,n.ObjectId))).flatMap(n=>{
          const shin=(tree.children.get(n.ObjectId)||[]).find(c=>/shin|lower.?leg/i.test(c.Name));
          return shin?[{root:n.ObjectId,middle:shin.ObjectId,end:shin.ObjectId,joints:[n.ObjectId,shin.ObjectId],short:true,kind:'leg',key:'limb:'+shin.ObjectId}]:[];
        });
      }
    }
  }
  const seatedId = id => seatTops.some(top => tree.isAncestor(id, top));
  const walkerBody = body;
  const seatedChains = seatTops.length ? [...seatLegs(seatTops).chains,...shortRiderLegs] : [];
  // The recogniser's own upper body of this creature (a Reforged turret over its pelvis, `uppers`) is no rider.
  const carried = seatTops.length > 0 && seatTops.every(top => (pose.uppers?.[body] || []).includes(tree.root(top)));
  let actor = seatTops.length && !carried ? wanted : 'both';
  if (actor === 'seated') {
    // The seated creature read alone: its own body joint drives its limbs.
    let own = null;
    try { own = suggestPoseBody(model, seatedChains.filter(chain => !chain.short), tree); own = tree.ancestors(own, true).find(id => seatedId(id) && roleOf(id) === 'Body') ?? own; } catch { own = null; }
    if (own != null && joints.has(own) && seatedId(own)) body = own; else actor = 'both';
  }
  const ridden = actor === 'both' ? seatedId : () => false;
  const under = actor === 'seated' ? seatedId : actor === 'walker' ? id => tree.isAncestor(id, walkerBody) && !seatedId(id) : id => tree.isAncestor(id, walkerBody) || seatedId(id);
  const byDepth = (a, b) => tree.depth(a) - tree.depth(b);
  // 'both': the walker's limbs and, of the seated creature, the arms (with the
  // chest and head below them); its legs stay put. 'seated' and 'walker': that
  // creature's own limbs only.
  // Hanging cloth is no limb in any reading: its joints stay outside the parts, as a cape's do.
  const chains = (actor === 'seated' ? seatedChains : pose.chains.filter(chain => actor === 'walker' ? tree.isAncestor(chain.root, walkerBody) && !seatedId(chain.root)
    : seatedId(chain.root) ? armChain(chain) : tree.isAncestor(chain.root, walkerBody))).filter(chain => !chain.cloth && !(rebased && poseChainIds(chain).includes(walkerBody)));
  const limbIds = new Set(chains.flatMap(poseChainIds));
  const controls = (pose.nodes || []).filter(id => under(id) && joints.has(id) && !limbIds.has(id));
  // Upper and lower body: a trunk joint that carries a leg walks with the hips
  // (a horse body's chest, a Pit Lord's front neck). Chest is the Spine/Chest
  // joints that lead to the arms; head is the Neck/Head joints that hang from
  // that chest, so a mount's own neck and head stay on the body animation.
  const carriesLeg = id => chains.some(chain => chain.kind === 'leg' && chain.label !== 'Wing' && tree.isAncestor(chain.root, id));
  const arms = chains.filter(chain => chain.kind === 'arm' && chain.label !== 'Wing');
  const hips = [body, ...controls.filter(id => !ridden(id) && (roleOf(id) === 'Pelvis' || ['Spine', 'Chest', 'Neck', 'Head'].includes(roleOf(id)) && carriesLeg(id)))];
  // With a seated creature read together with its walker, the chest and head are the seated one's.
  const upper = id => actor !== 'both' || !seatTops.length || seatedId(id);
  const chest = controls.filter(id => ['Spine', 'Chest'].includes(roleOf(id)) && !carriesLeg(id) && upper(id) && (!arms.length || arms.some(chain => tree.isAncestor(chain.root, id))));
  const head = controls.filter(id => ['Neck', 'Head'].includes(roleOf(id)) && !carriesLeg(id) && upper(id) && (!chest.length || chest.some(c => tree.isAncestor(id, c))));
  const trunk = { hips: [...new Set(hips)].sort(byDepth), chest: chest.sort(byDepth), head: head.sort(byDepth) };
  const trunkIds = new Set(Object.values(trunk).flat());
  const nearestTrunk = (id, exclude = []) => tree.ancestors(id).find(a => trunkIds.has(a) && !exclude.includes(a)) ?? null;
  const parts = {};
  for (const key of TRUNK_ORDER) {
    const ids = trunk[key];
    if (!ids.length) continue;
    const marker = ids.at(-1);
    parts[key] = { key, kind: 'trunk', side: null, joints: ids, anchor: key === 'hips' ? null : nearestTrunk(ids[0], ids), marker, length: chainLength(ids.map(pos)), weapon: null };
  }
  // Limbs: the parent path from the chain's top to its last Bone/Helper, extended
  // upward through ancestors that carry only this limb and are not trunk joints.
  const bodyPos = pos(body), limbs = [];
  const chainsBelow = id => chains.filter(chain => tree.isAncestor(chain.root, id)).length;
  for (const chain of chains) {
    const ids = poseChainIds(chain), endJoint = tree.ancestors(chain.end, true).find(id => joints.has(id));
    const path = tree.ancestors(endJoint, true);
    const top = path.indexOf(ids[0]);
    if (top < 0) continue;
    const limb = path.slice(0, top + 1).reverse().filter(id => joints.has(id));
    for (let parent = tree.parentOf(limb[0]); parent != null && joints.has(parent) && !trunkIds.has(parent) && chainsBelow(parent) === 1; parent = tree.parentOf(parent)) limb.unshift(parent);
    if (!limb.length) continue;
    const tip = chain.end !== endJoint ? pos(chain.end) : null;
    limbs.push({ kind: chain.label === 'Wing' ? 'wing' : chain.kind === 'leg' ? 'leg' : 'arm', joints: limb, tip, line: ids, short: chain.short === true });
  }
  // Tail: the path from the first non-trunk joint down to a Tail-role joint.
  for (const id of [...joints].filter(id => under(id) && !ridden(id) && roleOf(id) === 'Tail' && !limbIds.has(id))) {
    const path = [];
    // Never through a joint that also carries the trunk, an arm or a wing (the Far Seer's wolf waist carries its tail and the
    // rider's waist and chest: read into the tail, every donor tail took the wolf's back), nor through one that carries a leg
    // (cross-kind r2 A1: Undead Arthas's horse hangs its back legs and its tail from Bone Hor11; read into the tail, it took the
    // donor tail's turns with the hindquarters on it, and a wolf taking the horse stood its back up to 71 deg off).
    const carriesOther = at => at !== id && ([...trunkIds].some(t => tree.isAncestor(t, at)) || limbs.some(limb => limb.kind !== 'tail' && tree.isAncestor(limb.joints[0], at)));
    for (let at = id; at != null && joints.has(at) && !trunkIds.has(at) && !carriesOther(at); at = tree.parentOf(at)) path.unshift(at);
    if (path.length && !limbs.some(limb => limb.joints.some(j => path.includes(j)))) limbs.push({ kind: 'tail', joints: path, tip: null });
  }
  // Side is geometric: +Y of the body is left. Names are not trusted.
  for (const limb of limbs) {
    const root = pos(limb.joints[0]), end = limb.tip || pos(limb.joints.at(-1));
    const dy = Math.abs(root.y - bodyPos.y) > 0.5 ? root.y - bodyPos.y : end.y - bodyPos.y;
    limb.side = limb.kind === 'tail' ? null : dy >= 0 ? 'L' : 'R';
  }
  // Facing comes from the bind pivots: a Stand that turns the hips a little
  // (Footman 16 degrees, Lord of Change -14) must not read as a turned model.
  const bind = id => v3(nodePivot(model, byId.get(id), id));
  const legRoots = side => limbs.filter(limb => limb.kind === 'leg' && limb.side === side).map(limb => bind(limb.joints[0]));
  const armRoots = side => limbs.filter(limb => limb.kind === 'arm' && limb.side === side).map(limb => bind(limb.joints[0]));
  const pair = legRoots('L').length && legRoots('R').length ? [legRoots('L')[0], legRoots('R')[0]] : armRoots('L').length && armRoots('R').length ? [armRoots('L')[0], armRoots('R')[0]] : null;
  const across = pair ? pair[0].clone().sub(pair[1]).setZ(0) : null;
  const facing = across && across.lengthSq() > 1e-8 ? new Vector3(across.y, -across.x, 0).normalize() : new Vector3(1, 0, 0);
  // Extra limbs of a kind: legs back to front, arms and wings top to bottom.
  const order = (a, b) => a.kind === 'leg' ? pos(a.joints[0]).dot(facing) - pos(b.joints[0]).dot(facing) : pos(b.joints[0]).z - pos(a.joints[0]).z;
  const groups = new Map();
  for (const limb of limbs) { const k = limb.kind + (limb.side || ''); groups.set(k, [...(groups.get(k) || []), limb]); }
  // POSE keeps the authored arm pair first. Both sides must independently identify
  // that pair by its shoulder level and its terminal hand attachment.
  const preferred = new Set();
  if (mainArms && parts.chest && parts.head) {
    const chestZ = pos(parts.chest.joints[0]).z, headZ = pos(parts.head.marker).z;
    const handEnds = new Set((model.Attachments || []).filter(node => /^hand\s+(left|right)\s+ref\s*$/i.test(node.Name)).map(node => node.Parent));
    for (const side of ['armL', 'armR']) {
      const list = groups.get(side) || [];
      const matches = list.filter(limb => {
        const z = pos(limb.joints[0]).z;
        return z >= chestZ && z <= headZ && handEnds.has(limb.joints.at(-1));
      });
      if (list.length > 1 && matches.length === 1 && matches[0] === list[0]) preferred.add(matches[0]);
    }
  }
  const ranked = preferred.size === 2 ? (a, b) => Number(preferred.has(b)) - Number(preferred.has(a)) || order(a, b) : order;
  for (const [stem, list] of groups) list.sort(ranked).forEach((limb, i) => {
    const key = stem + (i ? i + 1 : ''), last = limb.joints.at(-1);
    const named = limb.kind === 'arm' && info.nodes.some(node => node.ObjectId !== last && tree.isAncestor(node.ObjectId, last) && isWeaponName(node.Name));
    const length = chainLength([...limb.joints.map(pos), ...(limb.tip ? [limb.tip] : [])]);
    parts[key] = { key, kind: 'limb', side: limb.side, joints: limb.joints, anchor: nearestTrunk(limb.joints[0]), marker: last, length, weapon: limb.kind === 'arm' ? weaponShape(model, info, ref, last, length, named) : null };
    Object.defineProperty(parts[key], 'tip', { value: limb.tip, enumerable: false });
    // The joints the limb's own line runs through (its top, its bend, its end).
    Object.defineProperty(parts[key], 'line', { value: limb.line || null, enumerable: false, writable: true });
    Object.defineProperty(parts[key], 'limbKind', { value: limb.kind, enumerable: false });
    Object.defineProperty(parts[key], 'named', { value: named, enumerable: false });
    if (limb.short) Object.defineProperty(parts[key], 'short', { value: true, enumerable: false });
  });
  // Which hand holds the weapon (automatic Mirror) stays a naming rule: a
  // geometric weapon is also found where no node is named (and none on a shield).
  const weapons = Object.values(parts).filter(part => part.named);
  let weaponSide = weapons.length === 1 ? weapons[0].side : null;
  if (weapons.length === 2) {
    // A named shield also counts as equipment. Resolve sword-and-shield handedness
    // only when the authored weapon attachment identifies the opposite hand.
    const references = (model.Attachments || []).filter(node => /^weapon\s+ref\s*$/i.test(node.Name));
    const holders = weapons.filter(part => references.some(ref => tree.isAncestor(ref.ObjectId, part.marker)));
    if (holders.length === 1) {
      const other = weapons.find(part => part !== holders[0]);
      const items = info.nodes.filter(node => tree.isAncestor(node.ObjectId, other.marker) && isWeaponName(node.Name));
      if (items.length && items.every(node => nameTokens(node.Name).includes('shield'))) weaponSide = holders[0].side;
    }
  }
  for (const part of Object.values(parts).filter(part => part.weapon)) part.weapon.grip = twoHandGrip(model, info, ref, part, Object.values(parts).filter(other => other.limbKind === 'arm' && other !== part));
  const legs = Object.values(parts).filter(part => part.limbKind === 'leg');
  const hipCentre = legs.length ? average(legs.map(part => pos(part.joints[0]))) : bodyPos;
  if (!Object.keys(parts).length) return fail('No body parts were recognised on this model.');
  // Size (rules 1 to 4 of docs/agent-tasks/xfer-transplant-fixes.md). Read alone, a rider or its mount keeps the plain numbers.
  const plainReading = actor === 'both', extent = plainReading ? bodyExtent(model, ref, sequence) : { size: 0, floor: null };
  const partJoints = new Set(Object.values(parts).flatMap(part => part.joints));
  for (const part of legs) Object.defineProperty(part, 'sole', { value: footSole(model, info, ref, part.marker, partJoints), enumerable: false });
  const ground = legs.length ? Math.min(...legs.map(part => pos(part.marker).z)) : extent.floor ?? Math.min(...Object.values(parts).flatMap(part => part.joints.map(id => pos(id).z)));
  // The hip height of short legs (one or two joints, the last one above the floor) is measured down to their soles, else
  // to their end references; `ground` stays the level of the leg ends, which the feet are placed by.
  const footLevel = part => part.short ? part.sole?.level ?? part.tip?.z ?? pos(part.marker).z : pos(part.marker).z;
  const floorLevel = legs.length ? Math.min(...legs.map(footLevel)) : ground;
  const hipMeasured = !plainReading || legs.length > 0 && hipCentre.z - floorLevel > 1e-3 && hipCentre.z - floorLevel >= HIP_MIN_SHARE * extent.size;
  const rig = { ok: true, reference, body, parts, hipHeight: hipMeasured || !(extent.size > 0) ? Math.max(1e-3, hipCentre.z - floorLevel) : Math.max(1e-3, HIP_SHARE * extent.size), ground, weaponSide, facing: facing.toArray(), problems };
  Object.defineProperty(rig, 'hipCentre', { value: hipCentre, enumerable: false });
  Object.defineProperty(rig, 'hipMeasured', { value: hipMeasured, enumerable: false });
  Object.defineProperty(rig, 'extent', { value: extent.size, enumerable: false });
  // Trunk length, hips to the middle of the shoulders: a size that does not depend on how the legs are folded.
  const shoulders = ['armL', 'armR'].map(key => parts[key]).filter(Boolean).map(part => pos(part.joints[0]));
  Object.defineProperty(rig, 'trunk', { value: shoulders.length === 2 ? shoulders[0].add(shoulders[1]).multiplyScalar(0.5).distanceTo(hipCentre) : 0, enumerable: false });
  // Which reading this is, and which the model offers (one creature: 'both' only).
  Object.defineProperty(rig, 'actor', { value: actor, enumerable: false });
  Object.defineProperty(rig, 'actors', { value: seatTops.length && !carried ? ['both', 'seated', 'walker'] : ['both'], enumerable: false });
  // The floor a weapon must stay above: the lowest foot vertex, else the ground.
  const soles = legs.map(part => part.sole?.level).filter(Number.isFinite);
  Object.defineProperty(rig, 'floor', { value: soles.length ? Math.min(...soles) : ground, enumerable: false });
  endAtMovingJoints(info, parts, pos);
  return rig;
}

/** A limb whose last joint is a still skin carrier (no keys, no joint below it) beside one joint under the same parent
 * that moves ends at the moving joint: the Ghoul's forearm skin bone `Wrist1` (pivot parked in its chest) beside its hand
 * `Bone_Hand_R`, a murloc's or kobold's wrist mesh beside its hand, a tail's `Geo_Tail1` beside `Bone_Tail2`. POSE takes the
 * first by its name, so the forearm would point into the chest. The numbers measured above (ground, soles, hip height,
 * weapon) keep the joints they were measured on. Changes `parts` in place (R2: this was the transplant's own reading). */
function endAtMovingJoints(info, parts, pos) {
  const { byId, joints, nodes } = info;
  const keyed = node => ['Translation', 'Rotation', 'Scaling'].some(property => node?.[property]?.Keys?.length);
  const jointsUnder = id => nodes.filter(node => node.Parent === id && joints.has(node.ObjectId));
  const used = new Set(Object.values(parts).flatMap(part => part.joints)), moved = [];
  for (const part of Object.values(parts)) {
    if (part.kind !== 'limb' || part.joints.length < 2) continue;
    const endId = part.joints.at(-1), end = byId.get(endId), parent = part.joints.at(-2);
    if (!end || end.Parent !== parent || keyed(end) || jointsUnder(endId).length) continue;
    const moving = jointsUnder(parent).filter(node => node !== end && keyed(node) && !used.has(node.ObjectId));
    if (moving.length === 1) moved.push([part, endId, moving[0].ObjectId]);
  }
  for (const [part, endId, id] of moved) {
    part.joints = [...part.joints.slice(0, -1), id];
    part.marker = id;
    part.length = chainLength([...part.joints.map(pos), ...(part.tip ? [part.tip] : [])]);
    if (part.line?.at(-1) === endId) part.line = [...part.line.slice(0, -1), id];
  }
}

// A hip height counts as measured from this share of the body extent up; a body that does not
// stand on legs gets this share of its extent as a stand-in. Library figures: docs/agent-tasks/xfer-transplant-fixes.md.
const HIP_MIN_SHARE = 0.05, HIP_SHARE = 0.26, EXTENT_TRIM = 0.02;
/** The body's extent in the reference pose: the diagonal of the box around the visible skinned mesh, each axis
 * between its 2nd and 98th percentile; `floor` is that lower height. Geosets hidden in the reference animation are
 * left out; when that leaves nothing, every geoset counts. -> { size, floor } ({ size: 0, floor: null } without a mesh). */
function bodyExtent(model, ref, sequence) {
  const item = model.Sequences?.[sequence];
  const read = visibleOnly => {
    const axes = [[], [], []];
    (model.Geosets || []).forEach((geoset, index) => {
      if (!geoset.Vertices?.length) return;
      if (visibleOnly && item?.Interval) { const alpha = geosetAlphaTrack(model, index); if (!(isGlobalTrack(alpha) || geosetVisibleIn(model, alpha, item, item.Interval))) return; }
      const points = skinGeoset(geoset, ref.world);
      for (let i = 0; i + 2 < points.length; i += 3) if (Number.isFinite(points[i] + points[i + 1] + points[i + 2])) { axes[0].push(points[i]); axes[1].push(points[i + 1]); axes[2].push(points[i + 2]); }
    });
    return axes;
  };
  let axes = read(true);
  if (!axes[0].length) axes = read(false);
  if (!axes[0].length) return { size: 0, floor: null };
  for (const axis of axes) axis.sort((a, b) => a - b);
  const at = (axis, share) => axis[Math.min(axis.length - 1, Math.floor(axis.length * share))];
  return { size: Math.hypot(...axes.map(axis => at(axis, 1 - EXTENT_TRIM) - at(axis, EXTENT_TRIM))), floor: at(axes[2], EXTENT_TRIM) };
}

/** Vertices skinned only to `end` and the nodes below it, in the reference pose. */
function vertexPointsBelow(model, info, ref, end) {
  const points = [];
  for (const geoset of model.Geosets || []) {
    const count = (geoset.Vertices?.length || 0) / 3, skin = geoset.SkinWeights, picked = [];
    for (let v = 0; v < count; v++) {
      const hd = skin?.length >= (v + 1) * 8;
      const bones = hd ? [0, 1, 2, 3].filter(i => skin[v * 8 + 4 + i] > 0).map(i => skin[v * 8 + i]) : Array.from(geoset.Groups?.[geoset.VertexGroup?.[v]] || []);
      if (bones.length && bones.every(id => info.tree.isAncestor(id, end))) picked.push(v);
    }
    if (!picked.length) continue;
    const skinned = skinGeoset(geoset, ref.world);
    for (const v of picked) points.push(new Vector3(skinned[v * 3], skinned[v * 3 + 1], skinned[v * 3 + 2]));
  }
  return points;
}
/** Principal axes of a point cloud, longest first (Jacobi on the covariance). */
function principalAxes(points, centre) {
  const a = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], v = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (const p of points) { const d = [p.x - centre.x, p.y - centre.y, p.z - centre.z]; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) a[i][j] += d[i] * d[j]; }
  for (let sweep = 0; sweep < 30; sweep++) for (const [p, q] of [[0, 1], [0, 2], [1, 2]]) {
    if (Math.abs(a[p][q]) < 1e-12) continue;
    const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]), t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
    for (let k = 0; k < 3; k++) { const akp = a[k][p], akq = a[k][q]; a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq; }
    for (let k = 0; k < 3; k++) { const apk = a[p][k], aqk = a[q][k]; a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk; }
    for (let k = 0; k < 3; k++) { const vkp = v[k][p], vkq = v[k][q]; v[k][p] = c * vkp - s * vkq; v[k][q] = s * vkp + c * vkq; }
  }
  return [0, 1, 2].map(i => ({ value: a[i][i], axis: new Vector3(v[0][i], v[1][i], v[2][i]).normalize() })).sort((x, y) => y.value - x.value).map(e => e.axis);
}
/** An arm's weapon: the vertices skinned only at or below its end joint, when
 * they reach further than 0.6 of the arm's length. A held shield is as long as
 * that too, so the shape must also be a bar (longest extent at least 1.8 times
 * the next) unless a node below the hand is named as a weapon (the Kurgan's
 * hammer has a wide head). Kept in the end joint's reference space: the axis
 * ends (`butt` at the hand's end, `tip` the far end), the length and up to
 * twelve outline points. */
function weaponShape(model, info, ref, end, armLength, named) {
  const points = vertexPointsBelow(model, info, ref, end);
  if (points.length < 3) return null;
  const centre = average(points.map(p => p.clone())), axes = principalAxes(points, centre);
  const span = axis => { let lo = Infinity, hi = -Infinity; for (const p of points) { const d = p.clone().sub(centre).dot(axis); lo = Math.min(lo, d); hi = Math.max(hi, d); } return [lo, hi]; };
  const [lo, hi] = span(axes[0]), [lo2, hi2] = span(axes[1]), length = hi - lo;
  if (!(length > 0.6 * armLength) || !(named || length >= 1.8 * (hi2 - lo2))) return null;
  const toEnd = (ref.world.get(end) || new Matrix4()).clone().invert(), hand = worldPos(model, ref, end);
  let butt = centre.clone().addScaledVector(axes[0], lo), tip = centre.clone().addScaledVector(axes[0], hi);
  if (butt.distanceTo(hand) > tip.distanceTo(hand)) [butt, tip] = [tip, butt];
  const [a, b, c] = axes, outline = [];
  for (const direction of [a, b, c, a.clone().add(b), a.clone().sub(b), a.clone().add(c)]) for (const sign of [1, -1]) {
    const d = direction.clone().multiplyScalar(sign);
    const far = points.reduce((best, p) => p.dot(d) > best.dot(d) ? p : best, points[0]);
    if (!outline.some(p => p.distanceToSquared(far) < 1e-6)) outline.push(far);
  }
  const local = p => p.clone().applyMatrix4(toEnd).toArray();
  return { length, butt: local(butt), tip: local(tip), outline: outline.map(local), grip: null };
}
/** Two hands on one weapon. A hand is on the weapon when its wrist is no further
 * from the butt-tip line than the weapon hand's own wrist plus a fifth of its
 * forearm (a wrist sits a hand's width off the handle it holds). The model holds
 * its weapon with both hands when that is so in its reference pose, else in the
 * first frame of its Stand Ready (the combat stance), else in most frames of one
 * of its Attack animations; the Kurgan Warlord stands one-handed and readies
 * two-handed. The grip is where that hand holds the weapon, in the weapon hand's
 * space (the mean over the frames that hold). */
function twoHandGrip(model, info, ref, part, others) {
  const forearmOf = other => { const joints = other.joints.map(id => worldPos(model, ref, id)); return other.tip ? other.tip.distanceTo(joints.at(-1)) : joints.length > 1 ? joints.at(-1).distanceTo(joints.at(-2)) : 0; };
  const forearms = new Map(others.map(other => [other, forearmOf(other)]));
  const holds = sample => {
    const toWorld = sample.world.get(part.marker) || new Matrix4(), butt = v3(part.weapon.butt).applyMatrix4(toWorld), tip = v3(part.weapon.tip).applyMatrix4(toWorld), line = tip.clone().sub(butt);
    const offLine = p => p.distanceTo(butt.clone().addScaledVector(line, Math.max(0, Math.min(1, p.clone().sub(butt).dot(line) / line.lengthSq()))));
    const own = offLine(worldPos(model, sample, part.marker));
    let best = null;
    for (const other of others) {
      const hand = worldPos(model, sample, other.marker), distance = offLine(hand), forearm = forearms.get(other);
      if (forearm > 0 && distance <= own + forearm / 5 && (!best || distance < best.distance)) best = { arm: other.key, distance, point: hand.clone().applyMatrix4(toWorld.clone().invert()) };
    }
    return best;
  };
  const found = grips => grips.length && { arm: grips[0].arm, point: average(grips.map(grip => grip.point)).toArray() };
  const first = holds(ref);
  if (first) return found([first]);
  const sequences = model.Sequences || [], named = pattern => sequences.map((sequence, index) => ({ sequence, index })).filter(({ sequence }) => sequence?.Interval && pattern.test(sequence.Name || ''));
  for (const { sequence, index } of named(/^\s*stand\s+ready/i)) { const grip = holds(sampleAt(model, index, sequence.Interval[0])); if (grip) return found([grip]); }
  for (const { sequence, index } of named(/^\s*attack/i)) {
    const [from, to] = sequence.Interval, grips = [];
    for (let k = 0; k <= 10; k++) { const grip = holds(sampleAt(model, index, from + (to - from) * k / 10)); if (grip) grips.push(grip); }
    const arm = grips.length > 5 && grips[0].arm;
    if (arm && grips.filter(grip => grip.arm === arm).length > 5) return found(grips.filter(grip => grip.arm === arm));
  }
  return null;
}
function chainLength(points) { let total = 0; for (let i = 1; i < points.length; i++) total += points[i].distanceTo(points[i - 1]); return total; }
function average(points) { return points.reduce((sum, p) => sum.add(p), new Vector3()).divideScalar(points.length); }

/** The sole of a foot: the vertices skinned only to the foot joint and the nodes
 * it carries that belong to no other part, kept in the foot joint's frame, and
 * the reference ground level (the lowest of them in the reference pose). */
function footSole(model, info, ref, foot, partJoints) {
  const own = new Set(info.ids.filter(id => info.tree.isAncestor(id, foot) && (id === foot || !partJoints.has(id))));
  const points = [];
  for (const geoset of model.Geosets || []) {
    const count = (geoset.Vertices?.length || 0) / 3, skin = geoset.SkinWeights, picked = [];
    for (let v = 0; v < count; v++) {
      const hd = skin?.length >= (v + 1) * 8;
      const bones = hd ? [0, 1, 2, 3].filter(i => skin[v * 8 + 4 + i] > 0).map(i => skin[v * 8 + i]) : Array.from(geoset.Groups?.[geoset.VertexGroup?.[v]] || []);
      if (bones.length && bones.every(id => own.has(id))) picked.push(v);
    }
    if (!picked.length) continue;
    const skinned = skinGeoset(geoset, ref.world);
    for (const v of picked) points.push(new Vector3(skinned[v * 3], skinned[v * 3 + 1], skinned[v * 3 + 2]));
  }
  if (!points.length) return null;
  // Every such vertex is checked: a foot that rolls brings its toes, not the
  // reference sole, to the floor (the Ghoul's toes in the Footman's walk).
  points.sort((a, b) => a.z - b.z);
  const toFoot = (ref.world.get(foot) || new Matrix4()).clone().invert();
  return { level: points[0].z, points: points.map(p => p.clone().applyMatrix4(toFoot)) };
}

/** Defaults of one taken part; the caller fills `source` and `sequence`. Every
 * part starts in the open model's own stance (Pose 0, "Mine"). */
export function defaultTransferPart(recipientRig, partKey, wholeBody = false) {
  return {
    source: null, sequence: null, from: null, flip: false, amount: 1, match: 0,
    offset: [0, 0, 0], start: 0, speed: 1, loop: null, blend: wholeBody ? 0 : 150, plant: true, travel: 1,
    fixes: [], grip: null, clear: null, aim: null,
    range: 0, follow: 0, avoid: 0, hang: 0, clip: null, frame: 0, stance: 0,
  };
}

/** The parts "Take whole body" takes: every part of the open model the donor
 * has (on either side). When the two walk on a different number of legs, hips
 * and legs stay on the body animation, and `reason` says so. */
export function transferWholeBody(recipientRig, donorRig) {
  const legs = rig => Object.keys(rig?.parts || {}).filter(key => /^leg/.test(key));
  const pairs = rig => Math.max(legs(rig).filter(key => /^legL/.test(key)).length, legs(rig).filter(key => /^legR/.test(key)).length);
  const lower = pairs(recipientRig) !== pairs(donorRig);
  const parts = Object.keys(recipientRig?.parts || {}).filter(key => (donorRig?.parts?.[key] || donorRig?.parts?.[swapSide(key)]) && !(lower && (key === 'hips' || /^leg/.test(key))));
  return { parts, reason: lower ? 'Hips and legs keep the body animation: the two models stand on a different number of legs.' : null };
}

// ---------------------------------------------------------------- learned from the model's own animations
// What the open model's own animations say about it, read once per rig: how far
// each joint ever turns (range), which loose joints turn with a limb and by how
// much (followers: shoulder pads, plates, volume helpers), which loose chains
// hang from the trunk with keys of their own (cloaks, hair, belts), and how big
// the trunk and each held thing are (shapes). Death, decay, dissipate, portrait
// and birth animations are left out: a unit that falls over there still "stays
// upright" everywhere else.
const OWN_SKIP = /death|decay|dissipate|portrait|birth|morph/i;
const RANGE_MARGIN = 5 * DEG / 2, RANGE_KNEE = 10 * DEG / 2; // half angles, as logQ gives them
// Arm guard: a point counts as inside below this share of the level the model's own poses show
// (the shapes are rough ellipsoids), and one shoulder turns at most this far for it.
const GUARD_LEVEL = 0.8, GUARD_MOST = 30 * DEG;
const firstWord = name => String(name || '').trim().split(/[\s\-_]+/)[0].toLowerCase();
/** The model's own animation of the same kind as `name` (exact name, else the
 * same first word, a plain "Attack" or "Attack - 2" before "Attack Slam"). */
export function sameKindSequence(model, name) {
  const list = (model.Sequences || []).map((sequence, index) => ({ index, sequence, name: String(sequence.Name || '').trim() })).filter(item => item.sequence.Interval);
  const wanted = String(name || '').trim().toLowerCase(), word = firstWord(name);
  const exact = list.find(item => item.name.toLowerCase() === wanted);
  if (exact) return exact.index;
  // A dying animation is the same kind only of a dying one: "Cinematic Walk" is no "Cinematic death" (the Dread Lord's
  // only Cinematic animation; taken as its kind, the transplant showed his corpse through the Aspiring Hero's walk).
  const dying = text => /death|decay|dissipate/i.test(text);
  const same = list.filter(item => word && firstWord(item.name) === word && (!dying(item.name) || dying(wanted)));
  return (same.find(item => /^[a-z]+(\s*-?\s*\d+)?$/i.test(item.name)) || same[0])?.index ?? null;
}
const percentile = (values, share) => { const sorted = [...values].sort((a, b) => a - b); return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * share))] : 0; };
/** An ellipsoid around a point cloud, in the cloud's own space: principal axes,
 * radii at the 92nd percentile so a horn or a spike does not inflate it. */
function ellipsoidOf(points) {
  if (points.length < 8) return null;
  const centre = average(points), axes = principalAxes(points, centre);
  const radii = axes.map(axis => Math.max(1e-3, percentile(points.map(p => Math.abs(p.clone().sub(centre).dot(axis))), 0.92)));
  return { centre, axes, radii };
}
function ownMotion(model, rig) {
  const info = modelInfo(model);
  info.own ||= new Map();
  if (info.own.has(rig)) return info.own.get(rig);
  const { tree, byId, joints } = info, ref = sampleAt(model, rig.reference.sequence, rig.reference.frame);
  const parts = Object.values(rig.parts || {}), partOf = new Map();
  for (const part of parts) for (const id of part.joints) partOf.set(id, part);
  const sequences = (model.Sequences || []).filter(sequence => sequence.Interval && !OWN_SKIP.test(sequence.Name || ''));
  const inOwn = track => !!track?.Keys && !isGlobalTrack(track, model) && sequences.some(sequence => keysInInterval(track, sequence.Interval).length > 0);
  const home = id => tree.ancestors(id).find(a => partOf.has(a)) ?? null;
  const loose = rig.body == null ? [] : [...joints].filter(id => !partOf.has(id) && id !== rig.body && tree.isAncestor(id, rig.body) && inOwn(byId.get(id).Rotation) && home(id) != null);
  // Dense own frames, at most about 240: local turns of part joints, world turns of every joint used.
  const total = sequences.reduce((sum, sequence) => sum + sequence.Interval[1] - sequence.Interval[0], 0), step = Math.max(66, total / 240);
  const wanted = new Set([...partOf.keys(), ...loose]), frames = [];
  (model.Sequences || []).forEach((sequence, index) => {
    if (!sequences.includes(sequence)) return;
    for (let f = sequence.Interval[0]; f <= sequence.Interval[1]; f += step) {
      const sample = sampleAt(model, index, f), local = new Map(), world = new Map();
      for (const id of wanted) { world.set(id, worldRot(sample, id).clone()); if (partOf.has(id)) local.set(id, sample.local.get(id).r.clone()); }
      frames.push({ local, world, move: rig.body == null ? null : sample.local.get(rig.body).t.clone() });
    }
  });
  // Range: the box around every own local turn of a joint, in the principal axes of those turns.
  const range = new Map();
  if (frames.length) for (const id of partOf.keys()) {
    const start = ref.local.get(id).r.clone(), startInv = inv(start), points = frames.map(frame => logQ(startInv.clone().multiply(frame.local.get(id))));
    const centre = average(points), axes = principalAxes(points, centre), lo = [0, 0, 0], hi = [0, 0, 0];
    for (const p of points) axes.forEach((axis, j) => { const x = p.clone().sub(centre).dot(axis); lo[j] = Math.min(lo[j], x); hi[j] = Math.max(hi[j], x); });
    range.set(id, { ref: start, centre, axes, lo, hi });
  }
  const moves = frames.map(frame => frame.move).filter(Boolean);
  const moveRange = moves.length ? { lo: ['x', 'y', 'z'].map(a => Math.min(...moves.map(m => m[a]))), hi: ['x', 'y', 'z'].map(a => Math.max(...moves.map(m => m[a]))) } : null;
  // Followers: a loose joint whose own turn is a steady share of one limb joint's turn.
  const refInv = new Map([...wanted].map(id => [id, inv(worldRot(ref, id))]));
  const turn = (frame, id, anchor) => {
    const d = frame.world.get(id).clone().multiply(refInv.get(id));
    return anchor == null ? d : inv(frame.world.get(anchor).clone().multiply(refInv.get(anchor))).multiply(d);
  };
  const followers = [], chains = [], considered = [];
  const carries = id => [...partOf.keys()].some(joint => tree.isAncestor(joint, id));
  for (const id of loose) {
    const at = home(id), part = partOf.get(at);
    if (part.kind === 'limb' && at === part.marker) continue; // held by the hand or foot: a weapon, not a feature
    // Its own largest turn against the joint it hangs from: under 2 degrees it is not animated.
    const ownTurn = Math.max(0, ...frames.map(frame => logQ(turn(frame, id, at)).length())) * 2 / DEG;
    if (ownTurn < 2 && part.kind === 'trunk') continue;
    const limbs = parts.filter(limb => limb.kind === 'limb' && (limb === part || limb.anchor != null && partOf.get(limb.anchor) === part));
    let best = null;
    for (const limb of limbs) {
      const from = limb === part ? limb.joints.indexOf(at) : 0, anchor = limb.anchor;
      const mine = frames.map(frame => logQ(turn(frame, id, anchor)));
      const most = Math.max(0, ...mine.map(v => v.length())) * 2 / DEG;
      for (const driver of limb.joints.slice(from)) {
        let pr = 0, rr = 0, pp = 0;
        frames.forEach((frame, k) => { const r = logQ(turn(frame, driver, anchor)); pr += mine[k].dot(r); rr += r.lengthSq(); pp += mine[k].lengthSq(); });
        if (rr < 1e-9 || pp < 1e-9) continue;
        const share = pr / rr, fit = pr / Math.sqrt(rr * pp);
        if (!best || fit > best.fit) best = { id, driver, anchor, share, fit, most, part: limb.key, rigid: driver === at && share > 0.9 };
      }
    }
    if (best) considered.push({ ...best, ownTurn });
    if (best && best.fit >= 0.8 && best.share >= 0.1 && best.share <= 1.3 && best.most >= 4 && !best.rigid) followers.push(best);
    else if (part.kind === 'trunk' && !carries(id)) chains.push({ id, part: part.key });
  }
  const byDepth = (a, b) => tree.depth(a.id) - tree.depth(b.id);
  // Features: a loose joint with the loose joints below it (a gut with its helper bones, a cape's
  // chain, one shoulder guard), named by its top joint.
  const looseIds = new Set([...followers, ...chains].map(item => item.id)), featureOf = new Map();
  for (const id of looseIds) { let top = id; for (let parent = tree.parentOf(top); parent != null && looseIds.has(parent); parent = tree.parentOf(parent)) top = parent; featureOf.set(id, top); }
  const own = { range, moveRange, followers: followers.sort(byDepth), chains: chains.sort(byDepth), keyedLoose: new Set(loose), considered, featureOf };
  Object.defineProperty(own, 'shapes', { get() { return this._shapes ||= bodyShapes(model, info, rig, ref, partOf, this.keyedLoose, featureOf); }, enumerable: false });
  info.own.set(rig, own);
  return own;
}
/** A joint's local turn kept inside the model's own range: each principal
 * coordinate may pass its own extremes by 15% and 5 degrees, then eases to a
 * stop over 10 more. `strength` 1 keeps it fully, less blends. */
function clampLocal(limit, local, strength) {
  if (!limit || !(strength > 0)) return local;
  const v = logQ(inv(limit.ref).multiply(local)).sub(limit.centre), out = limit.centre.clone();
  let changed = false;
  for (let j = 0; j < 3; j++) {
    const x = v.dot(limit.axes[j]), margin = 0.15 * (limit.hi[j] - limit.lo[j]) + RANGE_MARGIN, lo = limit.lo[j] - margin, hi = limit.hi[j] + margin;
    const y = x > hi ? hi + RANGE_KNEE * Math.tanh((x - hi) / RANGE_KNEE) : x < lo ? lo - RANGE_KNEE * Math.tanh((lo - x) / RANGE_KNEE) : x;
    if (y !== x) changed = true;
    out.addScaledVector(limit.axes[j], y);
  }
  if (!changed) return local;
  const kept = limit.ref.clone().multiply(expQ(out)).normalize();
  return strength >= 1 ? kept : slerpW(local, kept, strength);
}
/** The body bone's own travel range, the same way: 15% and a little past its extremes, then a soft stop. */
function clampMove(limit, move, strength, size) {
  if (!limit || !(strength > 0)) return move;
  const out = move.clone(), knee = 0.06 * size;
  ['x', 'y', 'z'].forEach((axis, j) => {
    const x = move[axis], margin = 0.15 * (limit.hi[j] - limit.lo[j]) + 0.03 * size, lo = limit.lo[j] - margin, hi = limit.hi[j] + margin;
    out[axis] = x > hi ? hi + knee * Math.tanh((x - hi) / knee) : x < lo ? lo - knee * Math.tanh((lo - x) / knee) : x;
  });
  return strength >= 1 ? out : move.clone().lerp(out, strength);
}
/** Ellipsoids of the trunk (one per hips, chest and head joint, from the vertices
 * that ride it), each in its joint's reference space, plus each arm's own
 * thickness. Vertices on keyed loose joints (cloaks, pads) are left out: an arm
 * may pass a cloak. Held weapons and shields are not obstacles: as rough
 * ellipsoids they pushed arms the wrong way in the trials. */
function bodyShapes(model, info, rig, ref, partOf, keyedLoose, featureOf = new Map()) {
  const { tree } = info, clouds = new Map(), armClouds = new Map(), invRef = new Map();
  const local = (id, p) => { if (!invRef.has(id)) invRef.set(id, (ref.world.get(id) || new Matrix4()).clone().invert()); return p.clone().applyMatrix4(invRef.get(id)); };
  const homeOf = bone => { for (const id of tree.ancestors(bone, true)) { if (keyedLoose.has(id)) return null; if (partOf.has(id)) return id; } return null; };
  // The feature a bone rides (its nearest feature joint above, before any body part), else null.
  const featureTop = bone => { for (const id of tree.ancestors(bone, true)) { if (featureOf.has(id)) return featureOf.get(id); if (partOf.has(id)) return null; } return null; };
  const partHome = bone => tree.ancestors(bone, true).find(id => partOf.has(id)) ?? null;
  const skin = new Map(); // feature top -> { own: its vertices, shared: those also weighted to the body, points }
  for (const geoset of model.Geosets || []) {
    const count = (geoset.Vertices?.length || 0) / 3, weights = geoset.SkinWeights;
    if (!count) continue;
    const skinned = skinGeoset(geoset, ref.world), onFeature = new Map();
    for (let v = 0; v < count; v++) {
      const hd = weights?.length >= (v + 1) * 8;
      const bones = hd ? [0, 1, 2, 3].filter(i => weights[v * 8 + 4 + i] > 0).map(i => weights[v * 8 + i]) : Array.from(geoset.Groups?.[geoset.VertexGroup?.[v]] || []);
      if (!bones.length) continue;
      const point = new Vector3(skinned[v * 3], skinned[v * 3 + 1], skinned[v * 3 + 2]), homes = bones.map(homeOf);
      if (homes.some(id => id == null)) {
        // On loose joints. A vertex weighted to a feature and to the body is shared skin.
        const tops = [...new Set(bones.map(featureTop).filter(top => top != null))];
        for (const top of tops) { if (!skin.has(top)) skin.set(top, { own: 0, shared: 0, open: 0, points: [] }); const entry = skin.get(top); entry.own++; if (homes.some(id => id != null)) entry.shared++; entry.points.push(point); }
        if (tops.length) onFeature.set(v, tops);
        continue;
      }
      const part = partOf.get(homes[0]);
      if (homes.every(id => partOf.get(id).kind === 'trunk')) { if (!clouds.has(homes[0])) clouds.set(homes[0], []); clouds.get(homes[0]).push(local(homes[0], point)); }
      else if (part.limbKind === 'arm' && homes.every(id => partOf.get(id) === part)) { if (!armClouds.has(part.key)) armClouds.set(part.key, []); armClouds.get(part.key).push({ point, held: bones.every(bone => tree.isAncestor(bone, part.marker)) }); }
    }
    // Open edges: an edge with one face only, after welding vertices that share a place (a
    // texture seam doubles them). A feature vertex on one is at a free border: a hem, a rim.
    const faces = geoset.Faces || [], place = v => `${Math.round(skinned[v * 3] * 100)},${Math.round(skinned[v * 3 + 1] * 100)},${Math.round(skinned[v * 3 + 2] * 100)}`, edges = new Map();
    if (onFeature.size) {
      const edge = (a, b) => { const p = place(a), q = place(b); return p < q ? p + '|' + q : q + '|' + p; };
      for (let f = 0; f + 2 < faces.length; f += 3) for (const [a, b] of [[faces[f], faces[f + 1]], [faces[f + 1], faces[f + 2]], [faces[f + 2], faces[f]]]) { const key = edge(a, b); edges.set(key, (edges.get(key) || 0) + 1); }
      const free = new Set();
      for (let f = 0; f + 2 < faces.length; f += 3) for (const [a, b] of [[faces[f], faces[f + 1]], [faces[f + 1], faces[f + 2]], [faces[f + 2], faces[f]]]) if (edges.get(edge(a, b)) === 1) { free.add(a); free.add(b); }
      for (const [v, tops] of onFeature) if (free.has(v)) for (const top of tops) skin.get(top).open++;
    }
  }
  // A feature is body when it is a patch of the body's own skin: at least 40% of its vertices are
  // also weighted to body joints, or at least a quarter are and it is a closed patch (at most 30%
  // of them on an open edge of the mesh). A gut, a belly, a breathing chest: its surface then
  // counts toward the trunk joint it hangs from. A cape shares skin only at the shoulders and its
  // hem is open; a pauldron or a pack is skinned to its own joints alone. Measured: Nurgle
  // warrior's belly chain 0.59 shared, its cape 0.08; Slaanesh warrior's cape 0.33 shared with
  // 0.78 open; the Ogre's belly pieces 0.76 to 1.00 shared, closed; pauldrons 0.
  const features = new Map();
  for (const [top, entry] of skin) {
    const home = partHome(top), share = entry.shared / entry.own, body = entry.own >= 6 && (share >= 0.4 || share >= 0.25 && entry.open / entry.own <= 0.3) && home != null && partOf.get(home).kind === 'trunk';
    features.set(top, { joint: top, body, home: body ? home : null, shared: entry.shared / entry.own, open: entry.open / entry.own, size: entry.own });
    if (body) { if (!clouds.has(home)) clouds.set(home, []); for (const point of entry.points) clouds.get(home).push(local(home, point)); }
  }
  const trunk = [];
  for (const [joint, points] of clouds) { const shape = ellipsoidOf(points); if (shape) trunk.push({ joint, ...shape }); }
  const thickness = new Map();
  for (const part of Object.values(rig.parts)) {
    if (part.limbKind !== 'arm') continue;
    const cloud = armClouds.get(part.key) || [], line = part.joints.map(id => worldPos(model, ref, id));
    // Thickness: the median distance of the arm's own vertices from its bone line.
    const far = cloud.filter(item => !item.held).map(item => { let best = Infinity; for (let i = 1; i < line.length; i++) { const a = line[i - 1], ab = line[i].clone().sub(a), t = Math.max(0, Math.min(1, item.point.clone().sub(a).dot(ab) / Math.max(1e-9, ab.lengthSq()))); best = Math.min(best, item.point.distanceTo(a.clone().addScaledVector(ab, t))); } return best; }).filter(Number.isFinite);
    thickness.set(part.key, far.length ? percentile(far, 0.5) : 0.06 * part.length);
  }
  return { trunk, thickness, features };
}
/** How deep a point sits in an ellipsoid whose joint has world matrix `matrix`:
 * `level` is 1 on the surface and 0 at the centre (padded by `pad`). `out(to)`
 * gives the world move that brings the point out to level `to`. */
function depthIn(shape, matrix, point, pad) {
  const inverse = matrix.clone().invert(), q = point.clone().applyMatrix4(inverse), d = q.clone().sub(shape.centre);
  const u = shape.axes.map((axis, j) => d.dot(axis) / (shape.radii[j] + pad)), level = Math.hypot(...u);
  return { level, out: to => {
    const k = level > 1e-6 ? to / level : 0, target = shape.centre.clone();
    if (level > 1e-6) shape.axes.forEach((axis, j) => target.addScaledVector(axis, u[j] * k * (shape.radii[j] + pad))); else target.addScaledVector(shape.axes[2], to * (shape.radii[2] + pad));
    return target.applyMatrix4(matrix).sub(point);
  } };
}
/** Dilate (the longest vector within 80 ms either side) then blur (60 ms) a row of correction vectors. */
function smoothVectors(needs, times, looping) {
  const n = needs.length, first = times[0], span = times[n - 1] - first;
  const gap = (a, b) => { const d = Math.abs(times[a] - times[b]); return looping && span > 0 ? Math.min(d, span - d) : d; };
  const held = needs.map((_, k) => { let best = needs[k]; for (let j = 0; j < n; j++) if (gap(j, k) <= 80 && needs[j].lengthSq() > best.lengthSq()) best = needs[j]; return best; });
  return held.map((_, k) => { const sum = new Vector3(); let count = 0; for (let j = 0; j < n; j++) if (gap(j, k) <= 60) { sum.add(held[j]); count++; } return sum.divideScalar(count || 1); });
}

// ---------------------------------------------------------------- clocks
const CLOCK_EPS = 1e-6;
/** Frame and weight of a clip at result time t. Looping clips wrap (the last
 * frame of a whole loop maps to the clip's first frame); others clamp and ramp. */
function clockAt(clock, t) {
  const { first, length, looping } = clock;
  if (looping) {
    const x = (t - clock.start) * clock.rate;
    let phase = length > 0 ? x - length * Math.floor(x / length + 1e-9) : 0;
    if (phase < 0) phase = 0;
    return { frame: first + phase, w: clock.amount };
  }
  const elapsed = t - clock.start, x = elapsed * clock.rate;
  const frame = first + Math.max(0, Math.min(length, x));
  if (x < -CLOCK_EPS || x > length + CLOCK_EPS) return { frame, w: 0 };
  const span = length / clock.rate, ramp = clock.blend > 0 ? smooth(Math.min(1, elapsed / clock.blend, (span - elapsed) / clock.blend)) : 1;
  return { frame, w: clock.amount * ramp };
}

// ---------------------------------------------------------------- build
// Hips held down for a planted foot stay down this long (ms) with no donor foot down, then ease back over HELD_DROP_FADE.
const HELD_DROP_HOLD = 150, HELD_DROP_FADE = 300;
/** Dense local motion of every driven joint. Pure: inputs are never changed. */
export function buildTransfer(recipient, sources, recipe, options = {}) {
  const step = options.step ?? 1000 / 30, problems = [];
  const baseIndex = recipe?.base?.sequence, baseSeq = recipient.Sequences?.[baseIndex];
  if (!baseSeq?.Interval) throw new Error('Choose a body animation first.');
  const rigB = transferRig(recipient, { sequence: baseIndex, actor: recipe?.base?.actor }), infoB = modelInfo(recipient), byIdB = infoB.byId;
  const modelOf = id => id === 'self' ? recipient : sources?.get?.(id);
  const refB = sampleAt(recipient, rigB.reference.sequence, rigB.reference.frame);
  // Read from the model's own animations, only when a taken part asks for it.
  let ownData = null;
  const ownOf = () => ownData ||= ownMotion(recipient, rigB);

  // Taken parts, each with its donor, mapping and constant rotations.
  const taken = [];
  // A part may carry more clips after its first (`next`): each is an entry of its own.
  const clips = Object.entries(recipe.parts || {}).flatMap(([key, part]) => [part, ...(Array.isArray(part?.next) ? part.next : [])].map((clip, index) => [key, clip, index]));
  for (const [key, part, clipIndex] of clips) {
    const own = rigB.parts[key];
    if (!own) { problems.push(`This model has no ${transferPartLabel(key).toLowerCase()}.`); continue; }
    const donor = modelOf(part.source), seq = donor?.Sequences?.[part.sequence];
    if (!seq?.Interval) { problems.push(`${transferPartLabel(key)}: choose an animation to take it from.`); continue; }
    const rigA = transferRig(donor, { sequence: part.sequence, actor: recipe.sources?.[part.source]?.actor, mainArms: options.mainArms });
    const auto = donor !== recipient && !!rigA.weaponSide && !!rigB.weaponSide && rigA.weaponSide !== rigB.weaponSide;
    const whole = recipe.sources?.[part.source]?.mirror ?? auto;
    // Other side: the donor's opposite limb, mirrored so it bends the right way.
    const from = part.from ?? (whole ? swapSide(key) : key), fromKey = part.flip ? swapSide(from) : from, theirs = rigA.parts[fromKey];
    const mirror = whole !== !!part.flip;
    if (!theirs) { problems.push(`${transferPartLabel(key)}: the donor has no ${transferPartLabel(fromKey).toLowerCase()}, so it keeps the body animation.`); continue; }
    const entry = prepareTaken({ key, part, own, theirs, donor, seq, sequence: part.sequence, rigA, rigB, refB, mirror, recipient, kneeToKnee: !!options.kneeToKnee });
    entry.clipIndex = clipIndex;
    // The clip before this one in the same part hands over to it (see the hold in pass 1).
    const before = clipIndex ? taken.findLast(other => other.key === key) : null;
    if (before) before.then = entry;
    taken.push(entry);
  }
  const sameKey = entry => drivenOrder.filter(other => other.key === entry.key), firstOfKey = (entry, index, list) => list.findIndex(other => other.key === entry.key) === index;
  // The state of a part at one moment: of its clip that weighs most just then.
  const active = (entries, states) => { let best = null; for (const entry of entries) { const state = states.get(entry); if (state && (!best || state.w > best.w)) best = state; } return best; };
  // Features kept by the recipe (`features[topJointId].keep`), whatever the part's own `follow` says.
  const keeps = recipe.features || {}, anyKept = Object.values(keeps).some(feature => share(feature?.keep) > 0);
  for (const entry of taken) { const kind = entry.follow > 0 || anyKept ? sameKindSequence(recipient, entry.seq.Name) : null; entry.kind = kind != null && kind !== baseIndex ? kind : null; }
  const drivenOrder = [...taken].sort((a, b) => (TRUNK_ORDER.indexOf(a.key) + 1 || 9) - (TRUNK_ORDER.indexOf(b.key) + 1 || 9) || infoB.tree.depth(a.own.joints[0]) - infoB.tree.depth(b.own.joints[0]));
  // A part that takes the donor's stance, and a limb on such a part with Pose toward Theirs, ride on the donor's
  // anchor movement instead of this model's (which now also holds the stance), so they turn and point as the donor's do.
  for (const entry of taken) { const anchor = entry.own.kind === 'limb' && entry.own.anchor != null ? taken.find(other => other.stance > 0 && other.own.joints.includes(entry.own.anchor)) : null; entry.onStance = entry.stance > 0 ? entry.stance : anchor ? entry.match * anchor.stance : 0; }

  // Length and loops. A taken clip that plays once sets the length (its latest
  // end) and the result plays once; looping clips then run at their own speed
  // and are cut. When every taken clip loops, they play whole loops inside the
  // result: the longest clip when the body animation loops too, else the body
  // animation's length. A body animation that plays once is fitted to the
  // result, first frame to first frame and last to last, so untaken parts
  // (wings, cloth) finish their own action with the taken one.
  const baseLength = baseSeq.Interval[1] - baseSeq.Interval[0];
  const takenOnce = taken.some(entry => !entry.looping), nonLooping = !!baseSeq.NonLooping || takenOnce;
  let length = recipe.length;
  if (!(Number.isFinite(length) && length > 0)) {
    if (!taken.length) length = baseLength;
    else if (takenOnce) length = Math.max(...taken.filter(e => !e.looping).map(e => e.start + e.length / e.speed));
    else if (baseSeq.NonLooping) length = baseLength;
    else length = Math.max(baseLength, ...taken.map(e => e.length / e.speed));
    // When the hips are taken the whole body follows their clip: the result is a whole number of its loops (the
    // nearest to the length above), so it plays at its own Speed and the body animation is fitted to it instead.
    // Before, the clip was fitted to the body animation: the Shadow Hunter's 800 ms walk over a 1,167 ms Stand
    // played at 0.69 of its speed, over the Footman's 1,500 ms Stand at 1.07.
    const hipsClip = taken.find(e => e.key === 'hips' && e.clipIndex === 0);
    if (!takenOnce && hipsClip?.looping && hipsClip.length > 0) { const period = hipsClip.length / hipsClip.speed; length = period * Math.max(1, Math.round(length / period)); }
  }
  length = Math.max(1, Math.round(length));
  const loopRate = (clipLength, speed) => takenOnce ? speed : Math.max(1, Math.round(length / (clipLength / speed))) * clipLength / length;
  const baseClock = { first: baseSeq.Interval[0], length: baseLength, looping: !baseSeq.NonLooping, start: 0, rate: baseSeq.NonLooping ? baseLength / length : loopRate(baseLength, 1), amount: 1, blend: 0, sequence: baseIndex };
  for (const entry of taken) entry.clock = { first: entry.first, length: entry.length, looping: entry.looping, start: entry.start, rate: entry.looping ? loopRate(entry.length, entry.speed) : entry.speed, amount: entry.amount, blend: entry.looping ? 0 : entry.blend };

  // options.times evaluates chosen moments only (the aim solver); the lift is
  // then that moment's own need, without easing.
  const times = [];
  if (options.times) times.push(...options.times);
  else {
    for (let t = 0; t < length - 0.5; t += step) { const f = Math.round(t); if (f !== times.at(-1)) times.push(f); }
    times.push(length);
  }
  const n = times.length;

  // Driven joints: every joint of a taken part except global-sequence ones.
  const tracks = new Map(), driven = [];
  for (const entry of taken) for (const id of entry.own.joints) {
    if (isGlobalTrack(byIdB.get(id)?.Rotation, recipient)) { problems.push(`${byIdB.get(id).Name} turns on a global sequence, so it is left as it is.`); entry.skip.add(id); continue; }
    if (!tracks.has(id)) { tracks.set(id, { Rotation: new Float32Array(n * 4) }); driven.push(id); }
  }
  // A chest or head whose first joint the donor moves by position keys in this animation: its
  // shift beyond riding its anchor is carried too (see the rotation transfer).
  for (const entry of taken) {
    const mine = entry.own.joints[0], theirs = entry.theirs.joints[0], track = modelInfo(entry.donor).byId.get(theirs)?.Translation;
    // Only for a rider read alone, for now: turned on for every donor it changed 15 of the 32
    // recorded transfers (any donor with position keys on its chest), which is the owner's call.
    entry.shifts = entry.rigA.actor === 'seated' && entry.own.kind === 'trunk' && entry.key !== 'hips' && !entry.skip.has(mine) && !!track?.Keys && !isGlobalTrack(track, entry.donor) && keysInInterval(track, entry.seq.Interval).length > 1 && !isGlobalTrack(byIdB.get(mine)?.Translation, recipient);
    if (entry.shifts) { const out = tracks.get(mine); if (out && !out.Translation) out.Translation = new Float32Array(n * 3); }
  }
  const hips = taken.find(entry => entry.key === 'hips');
  const moveBody = hips && !isGlobalTrack(byIdB.get(rigB.body)?.Translation, recipient);
  if (moveBody) tracks.get(rigB.body) ? tracks.get(rigB.body).Translation = new Float32Array(n * 3) : (tracks.set(rigB.body, { Translation: new Float32Array(n * 3) }), driven.push(rigB.body));
  const hipsOf = leg => taken.find(entry => entry.key === 'hips' && entry.donor === leg.donor && entry.sequence === leg.sequence && entry.clipIndex === leg.clipIndex) || taken.find(entry => entry.key === 'hips' && entry.donor === leg.donor && entry.sequence === leg.sequence);
  // A seated creature's feet stand on nothing: legs taken from a rider read alone are not planted.
  const plantLegs = hips ? drivenOrder.filter(e => e.own.limbKind === 'leg' && e.part.plant !== false && e.rigA.actor !== 'seated' && hipsOf(e)) : [];
  for (const leg of plantLegs) leg.hips = hipsOf(leg);

  // Weapon arms: point like theirs (aim), stay above the floor (clear), both
  // hands on the weapon (grip). Each is off when its recipe field says so.
  const aimOf = entry => !entry.theirs.weapon ? 0 : entry.part.aim == null ? (entry.looping ? 0 : 1) : Math.max(0, Math.min(1, Number(entry.part.aim) || 0));
  const weaponArms = drivenOrder.filter(entry => entry.own.weapon).filter(firstOfKey).map(entry => {
    const detected = entry.own.weapon.grip, wanted = entry.part.grip ?? !!detected;
    const otherKey = detected?.arm ?? Object.keys(rigB.parts).find(key => /^arm/.test(key) && rigB.parts[key] !== entry.own && rigB.parts[key].side !== entry.own.side);
    const other = wanted && otherKey ? rigB.parts[otherKey] : null;
    return {
      // Point like theirs: automatic (null) is on for a clip that plays once (an
      // attack reads) and off for a looping one (a stand keeps its own grip).
      entry, entries: sameKey(entry), clear: entry.part.clear !== false,
      grip: other ? { part: other, point: v3(detected?.point ?? entry.own.weapon.butt), joints: other.joints.filter(id => !isGlobalTrack(byIdB.get(id)?.Rotation, recipient)), reach: chainLength(other.joints.map(id => worldPos(recipient, refB, id))) } : null,
      need: new Float64Array(n), axis: [], shape: [],
    };
  });
  for (const arm of weaponArms) if (arm.grip) for (const id of arm.grip.joints) if (!tracks.has(id)) { tracks.set(id, { Rotation: new Float32Array(n * 4) }); driven.push(id); }

  // Loose joints of taken parts that follow (recipe `follow`): pads and plates keep
  // their learned share of a limb joint's turn; cloaks, hair and belts take the
  // model's own animation of the same kind as the taken one, fitted to its time.
  const looseFollowers = [], looseChains = [];
  if (anyKept || drivenOrder.some(entry => entry.follow > 0)) {
    const free = id => !isGlobalTrack(byIdB.get(id)?.Rotation, recipient);
    // A feature's own switch decides for its joints; without one, the part's `follow` does.
    const keptOf = id => { const feature = keeps[ownOf().featureOf.get(id)]; return feature && feature.keep != null ? share(feature.keep) : null; };
    for (const item of ownOf().followers) { const entries = drivenOrder.filter(e => e.key === item.part), keep = keptOf(item.id); if (entries.length && free(item.id) && (keep ?? entries[0].follow) > 0) looseFollowers.push({ ...item, entry: entries[0], entries, keep }); }
    for (const item of ownOf().chains) { const entries = drivenOrder.filter(e => e.key === item.part && e.kind != null), keep = keptOf(item.id); if (entries.length && free(item.id) && (keep ?? entries[0].follow) > 0) looseChains.push({ ...item, entry: entries[0], entries, keep }); }
    for (const item of [...looseFollowers, ...looseChains]) if (!tracks.has(item.id)) { tracks.set(item.id, { Rotation: new Float32Array(n * 4) }); driven.push(item.id); }
  }
  const chainIds = new Set(looseChains.map(item => item.id));
  // Joints outside every part that the donor has too: a weapon, a shield, a wheel or a pad of the same name, on a
  // parent of the same name, hanging from the part the donor's hangs from and in the same place on it (within a tenth
  // of the hip height). They take the donor joint's own turn against its parent, so a model taking its own attack, or
  // one of its family's, swings its sword and shield and spins its wheels as there. Before, they kept the body
  // animation (a Footman given its own Attack - 1 whole: shield 39, sword 22 degrees off). A feature switch or the
  // part's follow, where they move a joint, still decide for it.
  const shared = [];
  {
    const handled = new Set([...tracks.keys()]), partOfB = new Map();
    for (const part of Object.values(rigB.parts)) for (const id of part.joints) partOfB.set(id, part);
    const upTo = (tree, of, id) => tree.ancestors(id).find(a => of.has(a));
    const pin = (model, info, a, b) => v3(nodePivot(model, info.byId.get(a), a)).sub(v3(nodePivot(model, info.byId.get(b), b)));
    // Per clip: a clip added after another may come from another donor, with joints of its own.
    for (const entry of drivenOrder) {
      const infoA = modelInfo(entry.donor), partOfA = new Map(), nameA = new Map(), mine = new Set();
      for (const part of Object.values(entry.rigA.parts)) for (const id of part.joints) partOfA.set(id, part);
      for (const id of infoA.joints) { if (partOfA.has(id)) continue; const parent = infoA.tree.parentOf(id), key = infoA.byId.get(id).Name + '|' + (parent == null ? '' : infoA.byId.get(parent)?.Name); nameA.set(key, nameA.has(key) ? null : id); }
      for (const id of infoB.joints) {
        if (partOfB.has(id) || handled.has(id) || mine.has(id) || isGlobalTrack(byIdB.get(id)?.Rotation, recipient)) continue;
        const up = upTo(infoB.tree, partOfB, id); if (up == null || partOfB.get(up) !== entry.own) continue;
        const parent = infoB.tree.parentOf(id), theirs = nameA.get(byIdB.get(id).Name + '|' + (parent == null ? '' : byIdB.get(parent)?.Name));
        if (theirs == null) continue;
        const upA = upTo(infoA.tree, partOfA, theirs); if (upA == null || partOfA.get(upA) !== entry.theirs) continue;
        // Only where something turns: the donor's joint has keys in its animation, or this one in the body animation.
        const keyed = (model, node, interval) => !!node?.Rotation?.Keys && keysInInterval(node.Rotation, interval).length > 0;
        if (!keyed(entry.donor, infoA.byId.get(theirs), entry.seq.Interval) && !keyed(recipient, byIdB.get(id), baseSeq.Interval)) continue;
        if (pin(recipient, infoB, id, up).distanceTo(entry.convertV(pin(entry.donor, infoA, theirs, upA)).multiplyScalar(entry.scale)) > 0.1 * rigB.hipHeight) continue;
        shared.push({ id, theirs, entry });
        mine.add(id);
      }
    }
    for (const item of shared) if (!tracks.has(item.id)) { tracks.set(item.id, { Rotation: new Float32Array(n * 4) }); driven.push(item.id); }
  }
  const sharedOf = new Map();
  for (const item of shared) sharedOf.set(item.entry, [...(sharedOf.get(item.entry) || []), item]);
  const refTurnInv = new Map(), refInvOf = id => { if (!refTurnInv.has(id)) refTurnInv.set(id, inv(worldRot(refB, id))); return refTurnInv.get(id); };
  // Arms kept out of the body (recipe `avoid`): the trunk's hips, chest and head.
  const pointOf = (id, world) => v3(nodePivot(recipient, byIdB.get(id), id)).applyMatrix4(world(id));
  const armPoints = (part, world) => { const points = []; let previous = pointOf(part.joints[0], world); for (const id of part.joints.slice(1)) { const p = pointOf(id, world); points.push(previous.clone().lerp(p, 0.5), p); previous = p; } return points; };
  const keptHomes = anyKept ? new Set([...ownOf().shapes.features].filter(([top, feature]) => feature.body && share(keeps[top]?.keep) > 0).map(([, feature]) => feature.home)) : new Set();
  const keptSolid = keptHomes.size ? ownOf().shapes.trunk.filter(shape => keptHomes.has(shape.joint)) : [];
  const guards = drivenOrder.filter(entry => (entry.avoid > 0 || keptSolid.length) && entry.own.limbKind === 'arm' && entry.own.joints.length > 1 && !entry.skip.has(entry.own.joints[0])).filter(firstOfKey).map(entry => {
    const shapes = ownOf().shapes, obstacles = entry.avoid > 0 ? shapes.trunk : keptSolid, pad = shapes.thickness.get(entry.key) || 0;
    const levels = world => armPoints(entry.own, world).map(p => obstacles.map(o => depthIn(o, world(o.joint), p, pad).level));
    return { entry, obstacles, pad, levels, refLevels: levels(id => refB.world.get(id) || new Matrix4()), need: [], strength: Math.max(entry.avoid, keptSolid.length ? 1 : 0), entries: sameKey(entry), gripped: weaponArms.some(arm => arm.grip?.part === entry.own) };
  });

  // Limbs an IK solve places after the transfer (a planted leg, the arm that grips
  // the weapon): the range limit leaves them alone, the solve needs their freedom.
  const placed = new Set([...plantLegs, ...drivenOrder.filter(entry => weaponArms.some(arm => arm.grip?.part === entry.own))]);

  // Pass 1, per sample: the transfer itself, then the weapon's aim, then how far
  // the weapon arm must lift to keep the weapon above the floor.
  const poses = [];
  // How far the hips came down for a planted foot at the last moment a donor foot stood on the ground (see below).
  let heldDrop = 0, heldFor = 0, lastT = null;
  const poseTools = (base, over) => {
    const lookup = node => over.get(node.ObjectId) || base.local.get(node.ObjectId);
    const world = id => composeNodeMatrices(recipient, [id], lookup, byIdB).get(id);
    const parentRot = id => { const parent = infoB.tree.parentOf(id); return parent == null ? new Quaternion() : rotationOf(world(parent)); };
    const setWorld = (id, worldRotation) => {
      const current = over.get(id) || base.local.get(id), local = inv(parentRot(id)).multiply(worldRotation).normalize();
      if (current.r.dot(local) < 0) local.set(-local.x, -local.y, -local.z, -local.w);
      over.set(id, { t: current.t, r: local, s: current.s });
    };
    return { world, parentRot, setWorld };
  };
  // A result that loops runs from the first moment a donor foot is down, round to the one before it, so the hips held
  // down at the end of the cycle are the ones its start continues from (the seam stays closed).
  let startAt = 0;
  if (!nonLooping && moveBody && plantLegs.length && !options.times) {
    const down = k => plantLegs.some(entry => { const { frame, w } = clockAt(entry.clock, times[k]); return w > 0 && worldPos(entry.donor, sampleAt(entry.donor, entry.sequence, frame), entry.theirs.marker).z <= entry.rigA.ground + 0.125 * entry.rigA.hipHeight; });
    startAt = Math.max(0, times.findIndex((_, k) => down(k)));
  }
  for (let step = 0; step < n; step++) {
    const k = (startAt + step) % n;
    const t = times[k], base = sampleAt(recipient, baseIndex, clockAt(baseClock, t).frame);
    const over = new Map(), { world, parentRot, setWorld } = poseTools(base, over);
    const setRotation = (id, worldRotation, w, limit = 0) => {
      const own = base.local.get(id);
      let local = inv(parentRot(id)).multiply(worldRotation).normalize();
      if (limit > 0) local = clampLocal(ownOf().range.get(id), local, limit);
      const from = over.get(id)?.r || own.r;
      if (from.dot(local) < 0) local.set(-local.x, -local.y, -local.z, -local.w);
      over.set(id, { t: over.get(id)?.t || own.t, r: slerpW(from, local, w), s: own.s });
    };
    const states = new Map();
    // Rotation transfer, parts in hierarchy order.
    for (const entry of drivenOrder) {
      let { frame, w } = clockAt(entry.clock, t);
      if (entry.then && t >= entry.clock.start && t <= entry.then.clock.start + (entry.then.clock.blend || 0) && clockAt(entry.then.clock, t).w > 0) w = Math.max(w, entry.amount);
      if (!(w > 0)) continue;
      const donorSample = sampleAt(entry.donor, entry.sequence, frame), offset = entry.offsetAt(t, length, !nonLooping);
      const dA = entry.theirs.anchor == null ? new Quaternion() : worldRot(donorSample, entry.theirs.anchor).clone().multiply(entry.refAnchorA);
      const dB = entry.own.anchor == null ? new Quaternion() : rotationOf(world(entry.own.anchor)).multiply(entry.refAnchorB);
      states.set(entry, { donorSample, w, offset, dA, dB, frame, entry });
      const deltaOf = j => entry.convert(inv(dA).multiply(worldRot(donorSample, entry.theirs.joints[j])).multiply(entry.refInvA[j]));
      // A joint paired with the donor's line across several joints: the first of those joints' turn,
      // then the swing that brings that line to where the donor's joints now put it.
      const lineOf = i => {
        const turn = deltaOf(entry.map[i]), [a, b] = entry.chordEnds[i];
        const now = entry.convertV(worldPos(entry.donor, donorSample, b).clone().sub(worldPos(entry.donor, donorSample, a)).applyQuaternion(inv(dA)));
        return mul(arc(entry.chordRef[i].clone().applyQuaternion(turn), now), turn);
      };
      const spread = entry.spread ? deltaOf(entry.theirs.joints.length - 1) : null;
      const frameB = entry.onStance > 0 ? dB.clone().slerp(entry.convert(dA), entry.onStance) : dB;
      entry.own.joints.forEach((id, i) => {
        if (entry.skip.has(id)) return;
        const turned = spread ? qPow(spread, entry.spread[i]) : entry.map[i] < 0 ? new Quaternion() : entry.chordRef[i] ? lineOf(i) : deltaOf(entry.map[i]);
        // In the limb's own frame: the donor's turn is carried over as a turn of this limb from its own
        // rest direction, so a twist along the donor's bone stays a twist along this one.
        const delta = entry.frame && entry.own.kind === 'limb' ? mul(inv(entry.toTheirs[i]), turned, entry.toTheirs[i]) : turned;
        setRotation(id, mul(frameB, offset, delta, entry.align[i], entry.refRotB[i]), w, placed.has(entry) ? 0 : entry.range);
      });
      // Shared joints hanging from this part (a waist under the hips, a sword under the hand), set before the parts
      // below them read their parents.
      for (const item of sharedOf.get(entry) || []) {
        const local = donorSample.local.get(item.theirs)?.r, own = base.local.get(item.id);
        if (!local || !own) continue;
        const to = entry.mirror ? mirrorQ(local) : local.clone(), from = over.get(item.id)?.r || own.r;
        if (from.dot(to) < 0) to.set(-to.x, -to.y, -to.z, -to.w);
        over.set(item.id, { t: over.get(item.id)?.t || own.t, r: slerpW(from, to, w), s: own.s });
      }
      // Shift: how far the donor part's first joint sits from where riding its anchor would put
      // it, compared with the reference pose, scaled to this model and added to its own joint.
      if (entry.shifts) {
        const a = entry.theirs.joints[0], b = entry.own.joints[0], anchorA = entry.theirs.anchor, anchorB = entry.own.anchor;
        const now = worldPos(entry.donor, donorSample, a).clone().sub(anchorA == null ? new Vector3() : worldPos(entry.donor, donorSample, anchorA));
        const extra = now.sub(entry.refShiftA.clone().applyQuaternion(dA)).applyQuaternion(inv(dA));
        const want = entry.convertV(extra).multiplyScalar(entry.scale).applyQuaternion(dB);
        const parent = infoB.tree.parentOf(b), linear = new Matrix3().setFromMatrix4(parent == null ? new Matrix4() : world(parent)).invert();
        // From this model's reference place for the joint, not on top of the body animation's own shift.
        const own = over.get(b) || base.local.get(b), target = refB.local.get(b).t.clone().add(want.applyMatrix3(linear));
        over.set(b, { ...own, t: own.t.clone().lerp(target, Math.min(1, w)) });
      }
      // Hips travel: move the body bone so the hip centre follows the donor's.
      if (entry.key === 'hips' && moveBody) {
        const body = rigB.body, current = hipCentreOf(recipient, rigB, id => world(id));
        const donorCentre = hipCentreOf(entry.donor, entry.rigA, id => donorSample.world.get(id));
        const target = rigB.hipCentre.clone().add(entry.convertV(donorCentre.sub(entry.rigA.hipCentre)).multiplyScalar((entry.part.travel ?? 1) * entry.scale));
        const parent = infoB.tree.parentOf(body), linear = new Matrix3().setFromMatrix4(parent == null ? new Matrix4() : world(parent));
        const move = target.sub(current).applyMatrix3(linear.invert()).multiplyScalar(w);
        const own = over.get(body) || base.local.get(body), moved = own.t.clone().add(move);
        const kept = entry.range > 0 ? clampMove(ownOf().moveRange, moved, entry.range, rigB.hipHeight) : moved;
        // What the range limit took off the travel, in world space: planted feet shift by the same.
        if (kept !== moved) states.get(entry).held = kept.clone().sub(moved).applyMatrix3(linear.clone().invert()); // linear holds the inverse here
        over.set(body, { ...own, t: kept });
      }
    }
    // Planted feet: aim each leg's end on the donor foot's scaled path.
    const plants = [];
    for (const entry of plantLegs) {
      const state = states.get(entry), hipState = states.get(entry.hips);
      if (!state || !hipState) continue;
      const donorEnd = worldPos(entry.donor, state.donorSample, entry.theirs.marker);
      const planted = entry.refEndB.clone().add(entry.convertV(donorEnd.clone().sub(entry.refEndA)).multiplyScalar(entry.hips.scale));
      if (hipState.held) planted.add(hipState.held);
      const own = worldPos(recipient, base, entry.own.marker);
      const target = own.clone().lerp(planted, Math.min(1, state.w));
      target.sub(entry.refRootB).applyQuaternion(state.offset).add(entry.refRootB);
      // The donor's foot stands on its ground just now (within an eighth of its hip height).
      plants.push({ entry, target, joints: entry.own.joints.filter(id => !entry.skip.has(id)), grounded: donorEnd.z <= entry.rigA.ground + 0.125 * entry.rigA.hipHeight, w: Math.min(1, state.w) });
    }
    // A foot that stands on the ground in the donor stays on the ground here. A donor with long bent legs (a
    // hoofed walker) strides further and lifts its hips higher than straighter legs can follow, and the leg
    // would run out of length. Such a foot is first brought within the stride native walks use (0.70 of the
    // leg's length from under the hip: 9 in 10 of 178 native two-leg walks stay under it), then the hips come
    // down as far as the leg needs. A foot the leg already reaches is left as it is.
    // Between such moments (no donor foot on the ground: the flight of a run, a hop) the hips stay as far down as at the
    // last one, easing back after 150 ms over 300 ms when no foot comes down (a fall, a leap). Before, they went back up by the whole
    // drop at once: a Footman taking the Shadow Hunter's Walk leapt from 50 to 140 units for one frame four times a cycle.
    if (lastT != null) heldFor += Math.max(0, t - lastT >= 0 ? t - lastT : t + (times[n - 1] - lastT));
    lastT = t;
    if (moveBody && plants.length) {
      let drop = 0;
      if (!plants.some(plant => plant.grounded)) drop = heldDrop * (1 - smooth(Math.min(1, Math.max(0, heldFor - HELD_DROP_HOLD) / HELD_DROP_FADE)));
      else for (const plant of plants) {
        const { target, joints, grounded, w } = plant;
        if (!grounded || joints.length < 2) continue;
        const points = joints.map(id => v3(nodePivot(recipient, byIdB.get(id), id)).applyMatrix4(world(id))), reach = 0.999 * chainLength(points); // the length solveLimb can give the leg
        if (target.distanceTo(points[0]) <= reach) continue;
        const flat = Math.hypot(target.x - points[0].x, target.y - points[0].y), stride = Math.min(flat, 0.7 * reach);
        if (flat > stride) { const pull = 1 - w * (1 - stride / flat); target.x = points[0].x + (target.x - points[0].x) * pull; target.y = points[0].y + (target.y - points[0].y) * pull; }
        drop = Math.max(drop, w * (points[0].z - target.z - Math.sqrt(reach * reach - stride * stride)));
      }
      if (plants.some(plant => plant.grounded)) { heldDrop = drop; heldFor = 0; }
      if (drop > 1e-4) {
        const body = rigB.body, parent = infoB.tree.parentOf(body), linear = new Matrix3().setFromMatrix4(parent == null ? new Matrix4() : world(parent)).invert();
        const own = over.get(body) || base.local.get(body);
        over.set(body, { ...own, t: own.t.clone().add(new Vector3(0, 0, -drop).applyMatrix3(linear)) });
      }
    }
    for (const { entry, target, joints } of plants) {
      solveLimb(recipient, joints, target, { world, over, base, parentRot });
      if (entry.own.sole && !entry.skip.has(entry.own.marker)) liftSole(recipient, entry.own.marker, entry.own.sole, { world, over, base, parentRot });
    }
    for (const arm of weaponArms) {
      const end = arm.entry.own.marker;
      // Point the weapon like theirs: turn the hand so its butt-to-tip axis turns
      // toward where the donor's points, relative to each one's chest.
      for (const entry of arm.entries) {
        const state = states.get(entry), aim = aimOf(entry);
        if (!state || !(aim > 0) || entry.skip.has(end)) continue;
        const hand = rotationOf(world(end)), axis = v3(entry.own.weapon.tip).sub(v3(entry.own.weapon.butt)).applyQuaternion(hand);
        const theirs = v3(entry.theirs.weapon.tip).sub(v3(entry.theirs.weapon.butt)).applyQuaternion(worldRot(state.donorSample, entry.theirs.marker));
        const target = entry.convertV(theirs.applyQuaternion(inv(state.dA))).applyQuaternion(state.dB);
        setWorld(end, qPow(arc(axis, target), aim * aimEase(entry.clock, t) * Math.min(1, state.w)).multiply(hand));
      }
      const { entry } = arm;
      if (arm.clear && !entry.skip.has(entry.own.joints[0])) [arm.need[k], arm.axis[k], arm.shape[k]] = weaponLift(recipient, entry.own, rigB.floor, world);
    }
    poses[k] = { base, over, states };
  }

  // The lift eases in and out: the largest need within 80 ms either side, a
  // limit on how fast it may change, then a 60 ms blur.
  // The axis a lift turns about follows the weapon's lowest point, which can be the other end of the weapon a sample
  // later (a staff across the floor, an arm turned by Point weapon like theirs): turning about each sample's own axis
  // swung the arm one way and back in one frame (109 degrees a step, Flame Lord taking a Baron's Spell). Each sample
  // turns about its own axis and those around it (within 120 ms) weighed by their needs, and its need is measured
  // again about that axis, so the weapon still clears the floor wherever a turn about it can.
  for (const arm of weaponArms) if (arm.clear) {
    if (arm.need.some(v => v > 0)) {
      arm.axis = liftAxes(arm.need, arm.axis, times, !nonLooping);
      arm.need = Float64Array.from(arm.need, (_, k) => arm.shape[k] ? liftAbout(arm.shape[k], rigB.floor, arm.axis[k]) : 0);
    }
    arm.lift = smoothLift(arm.need, times, !nonLooping);
  }
  const liftArm = (arm, k, tools) => {
    const root = arm.entry.own.joints[0];
    if (arm.clear && arm.lift[k] > 1e-6 && arm.axis[k]) tools.setWorld(root, axisAngle(arm.axis[k], arm.lift[k]).multiply(rotationOf(tools.world(root))));
  };
  // The gripping arm is placed by the solve, which keeps the arm's twist and the plane its elbow bends in from the pose
  // it starts from. Started from the transferred pose, which can point 90 degrees and more away from the grip and turn
  // fast, the elbow folded the other way from one moment to the next (Hellscream taking the Archnathid's attack:
  // its bend plane 131 degrees in one 33 ms step). It starts from its own solve of the moment before (the hand keeps
  // its own turn); a looping result first solves its last moments so its start continues from its end.
  const gripArm = (arm, state, tools, base, over) => {
    if (arm.grip && !state) arm.grip.last = null;
    if (!arm.grip || !state) return;
    const { entry } = arm, { world, parentRot } = tools;
    const handWorld = world(entry.own.marker), hand = v3(nodePivot(recipient, byIdB.get(arm.grip.part.marker), arm.grip.part.marker)).applyMatrix4(world(arm.grip.part.marker));
    // Out of the arm's reach, the hand slides along the shaft to the nearest point it reaches.
    const shoulder = v3(nodePivot(recipient, byIdB.get(arm.grip.joints[0]), arm.grip.joints[0])).applyMatrix4(world(arm.grip.joints[0]));
    const shaft = v3(entry.own.weapon.tip).sub(v3(entry.own.weapon.butt)).applyQuaternion(rotationOf(handWorld)).normalize();
    // Too near the shoulder (the shaft passing through it), it slides out to GRIP_NEAR of the reach: folding the arm
    // up to there bent every joint to the limit and the elbow turned over from one moment to the next.
    const target = slideOutOfShoulder(slideInReach(arm.grip.point.clone().applyMatrix4(handWorld), shaft, shoulder, arm.grip.reach * 0.98), shaft, shoulder, arm.grip.reach * GRIP_NEAR);
    // (Weighed by the grip: as the clip fades out, the start eases back to the transferred pose the arm then keeps.)
    if (arm.grip.last) { const end = arm.grip.joints.at(-1), held = rotationOf(world(end)), w = Math.min(1, state.w); arm.grip.joints.slice(0, -1).forEach((id, i) => tools.setWorld(id, slerpW(rotationOf(world(id)), arm.grip.last[i], w))); tools.setWorld(end, held); }
    solveLimb(recipient, arm.grip.joints, hand.lerp(target, Math.min(1, state.w)), { world, over, base, parentRot });
    arm.grip.last = arm.grip.joints.map(id => rotationOf(world(id)));
  };
  // Arm guard, per sample, on the pose as it will be after the weapon lift: how
  // far the arm must turn at its shoulder to come out of the trunk. Only a point
  // clearly deeper than the same arm sits in the body animation and in the
  // reference pose counts. An arm that grips the other arm's weapon is placed by
  // that grip and is not turned.
  if (guards.length) for (let k = 0; k < n; k++) {
    const { base, over, states } = poses[k], scratch = new Map(over), tools = poseTools(base, scratch), baseWorld = id => base.world.get(id) || new Matrix4();
    for (const arm of weaponArms) liftArm(arm, k, tools);
    for (const guard of guards) {
      const { entry, obstacles, pad } = guard, state = active(guard.entries, states), root = entry.own.joints[0];
      let total = new Quaternion();
      if (state && !guard.gripped && obstacles.length) {
        const baseLevels = guard.levels(baseWorld);
        for (let pass = 0; pass < 4; pass++) {
          const shoulder = pointOf(root, tools.world);
          let worst = null;
          armPoints(entry.own, tools.world).forEach((p, i) => obstacles.forEach((o, j) => {
            const allowed = GUARD_LEVEL * Math.min(1, baseLevels[i][j], guard.refLevels[i][j]), depth = depthIn(o, tools.world(o.joint), p, pad);
            if (depth.level >= allowed - 0.02) return;
            const move = depth.out(allowed);
            if (!worst || move.lengthSq() > worst.move.lengthSq()) worst = { move, at: p };
          }));
          if (!worst) break;
          const lever = worst.at.clone().sub(shoulder), omega = lever.clone().cross(worst.move).divideScalar(Math.max(1e-6, lever.lengthSq())), angle = Math.min(omega.length(), 15 * DEG);
          if (angle < 1e-5) break;
          const turn = axisAngle(omega.normalize(), angle), next = turn.clone().multiply(total), size = logQ(next).length() * 2;
          if (size > GUARD_MOST) break;
          tools.setWorld(root, turn.clone().multiply(rotationOf(tools.world(root))));
          total = next;
        }
      }
      const need = logQ(total);
      guard.need.push(entry.own.anchor == null ? need : need.applyQuaternion(inv(rotationOf(tools.world(entry.own.anchor)))));
    }
  }
  for (const guard of guards) guard.turn = smoothVectors(guard.need, times, !nonLooping);
  const guardArm = (guard, k, state, tools) => {
    const v = guard.turn[k], { entry } = guard;
    if (!state || v.lengthSq() < 1e-10) return;
    const root = entry.own.joints[0], out = entry.own.anchor == null ? v.clone() : v.clone().applyQuaternion(rotationOf(tools.world(entry.own.anchor)));
    tools.setWorld(root, expQ(out.multiplyScalar(Math.min(1, state.w) * guard.strength)).multiply(rotationOf(tools.world(root))));
  };

  // Pass 2, per sample: lift the weapon arm, put the other hand back on its grip,
  // and record the driven joints.
  // With a guard: every lift, then the guards, then the grips (the order the guard measured).
  // Without one: each weapon arm's lift and grip together, as before.
  const placeArms = (k, base, over, states) => {
    const tools = poseTools(base, over);
    if (guards.length) {
      for (const arm of weaponArms) liftArm(arm, k, tools);
      for (const guard of guards) guardArm(guard, k, active(guard.entries, states), tools);
      for (const arm of weaponArms) gripArm(arm, active(arm.entries, states), tools, base, over);
    } else for (const arm of weaponArms) { liftArm(arm, k, tools); gripArm(arm, active(arm.entries, states), tools, base, over); }
    return tools;
  };
  if (!nonLooping && weaponArms.some(arm => arm.grip)) for (let k = Math.max(1, n - 6); k < n; k++) placeArms(k, poses[k].base, new Map(poses[k].over), poses[k].states);
  for (let k = 0; k < n; k++) {
    const { base, over, states } = poses[k], { world, parentRot, setWorld } = placeArms(k, base, over, states);
    const blendLocal = (id, local, w) => { const own = base.local.get(id); if (own.r.dot(local) < 0) local.set(-local.x, -local.y, -local.z, -local.w); over.set(id, { t: own.t, r: slerpW(own.r, local, w), s: own.s }); };
    for (const item of looseChains) {
      const state = active(item.entries, states);
      if (!state || !(state.w > 0)) continue;
      const interval = recipient.Sequences[state.entry.kind].Interval, part = state.entry.length > 0 ? (state.frame - state.entry.first) / state.entry.length : 0;
      const theirs = sampleAt(recipient, state.entry.kind, interval[0] + part * (interval[1] - interval[0]));
      let local = theirs.local.get(item.id).r.clone();
      // Hang: the chain's first joint keeps the world angle it has in that animation.
      if (state.entry.hang > 0 && !chainIds.has(infoB.tree.parentOf(item.id))) local = slerpW(local, inv(parentRot(item.id)).multiply(worldRot(theirs, item.id)).normalize(), state.entry.hang);
      blendLocal(item.id, local, Math.min(1, state.w) * (item.keep ?? state.entry.follow));
    }
    for (const item of looseFollowers) {
      const state = active(item.entries, states);
      if (!state || !(state.w > 0)) continue;
      const turnOf = id => rotationOf(world(id)).multiply(refInvOf(id)), anchor = item.anchor == null ? new Quaternion() : turnOf(item.anchor);
      const target = mul(anchor, qPow(inv(anchor).multiply(turnOf(item.driver)), item.share), worldRot(refB, item.id));
      blendLocal(item.id, inv(parentRot(item.id)).multiply(target).normalize(), Math.min(1, state.w) * (item.keep ?? state.entry.follow));
    }
    options.probe?.({ k, world, states, entries: drivenOrder, own: ownData });
    for (const id of driven) {
      const value = over.get(id) || base.local.get(id), out = tracks.get(id);
      if (out.Rotation) {
        const q = value.r, at = k * 4, prev = k ? out.Rotation.subarray(at - 4, at) : null;
        const sign = prev && prev[0] * q.x + prev[1] * q.y + prev[2] * q.z + prev[3] * q.w < 0 ? -1 : 1;
        out.Rotation.set([q.x * sign, q.y * sign, q.z * sign, q.w * sign], at);
      }
      if (out.Translation) out.Translation.set([value.t.x, value.t.y, value.t.z], k * 3);
    }
  }

  // Timing and naming come from the hips' donor animation when hips are taken.
  const moveSpeed = hips ? (hips.seq.MoveSpeed || 0) * hips.scale * (hips.part.travel ?? 1) : baseSeq.MoveSpeed || 0;
  const first = taken[0];
  const suggestedName = uniqueSequenceName(recipient, first ? first.seq.Name : baseSeq.Name);
  return { length, times, tracks, driven, nonLooping, moveSpeed, suggestedName, problems, baseClock };
}

const share = value => Math.max(0, Math.min(1, Number(value) || 0));
/** How much bigger the open model is than the donor. Hip height says it for two standing
 * creatures; a seated one's hip height depends on how its legs are folded, so with a rider read
 * alone on either side the trunks (hips to shoulders) are compared instead. */
function sizeRatio(rigB, rigA) {
  const seated = rigA.actor === 'seated' || rigB.actor === 'seated';
  return seated && rigA.trunk > 1e-3 && rigB.trunk > 1e-3 ? rigB.trunk / rigA.trunk : rigSizeRatio(rigB, rigA);
}
/** How much bigger one body is than another: hip heights when both stand on legs, else their extents. */
export function rigSizeRatio(rigB, rigA) {
  if (rigB.hipMeasured && rigA.hipMeasured) return rigB.hipHeight / rigA.hipHeight;
  return rigB.extent > 0 && rigA.extent > 0 ? rigB.extent / rigA.extent : rigB.hipHeight / rigA.hipHeight;
}
function prepareTaken({ key, part, own, theirs, donor, seq, sequence, rigA, rigB, refB, mirror, recipient, kneeToKnee = false }) {
  const refA = sampleAt(donor, rigA.reference.sequence, rigA.reference.frame);
  // Mirroring reflects the donor across the XZ plane; a facing difference over
  // 20 degrees turns the donor's motion by that yaw.
  const facingA = v3(rigA.facing), facingB = v3(rigB.facing);
  if (mirror) facingA.y = -facingA.y;
  let yaw = Math.atan2(facingB.y, facingB.x) - Math.atan2(facingA.y, facingA.x);
  yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
  const turn = Math.abs(yaw) > 20 * DEG ? axisAngle(UP, yaw) : new Quaternion(), turnInv = inv(turn);
  const convert = q => mul(turn, mirror ? mirrorQ(q) : q, turnInv);
  const convertV = v => (mirror ? mirrorV(v) : v.clone()).applyQuaternion(turn);
  const posA = id => worldPos(donor, refA, id), posB = id => worldPos(recipient, refB, id);
  // A limb's line runs through its top, bend and end. A joint between two of those whose pivot
  // lies far off that line (kept at the body's middle, say) is read as lying on it: its pivot
  // says where it turns, not where the limb is.
  const onLine = (part, points) => {
    if (part.kind !== 'limb' || !part.line) return points;
    const on = part.joints.map(id => part.line.includes(id)), out = points.map(p => p.clone());
    for (let i = 1; i < points.length - 1; i++) {
      if (on[i]) continue;
      let a = i - 1, b = i + 1; while (a >= 0 && !on[a]) a--; while (b < points.length && !on[b]) b++;
      if (a < 0 || b >= points.length) continue;
      const span = points[b].clone().sub(points[a]), direct = span.length();
      if (direct < 1e-6 || points[i].distanceTo(points[a]) + points[i].distanceTo(points[b]) <= 1.5 * direct) continue;
      out[i] = points[a].clone().addScaledVector(span, Math.max(0, Math.min(1, points[i].clone().sub(points[a]).dot(span) / (direct * direct))));
    }
    return out;
  };
  const pointsA = onLine(theirs, theirs.joints.map(posA)), pointsB = onLine(own, own.joints.map(posB));
  // The tip (an end attachment such as Hand Right Ref) counts toward arc length,
  // so a two-joint forearm still maps to the recipient's forearm.
  // Arms and legs pair by role, read in the rest pose (see limbPairing); other parts by distance.
  const infoA = modelInfo(donor), infoB = modelInfo(recipient);
  // The limb on the other side and the donor limb it takes from pair together with this one (see limbPairing).
  const partner = own.kind === 'limb' && swapSide(key) !== key ? { own: rigB.parts[swapSide(key)], theirs: rigA.parts[swapSide(theirs.key)] } : null;
  const pairing = limbPairing(own, theirs, { own: id => v3(nodePivot(recipient, infoB.byId.get(id), id)), theirs: id => convertV(v3(nodePivot(donor, infoA.byId.get(id), id))), ownName: id => infoB.byId.get(id)?.Name, theirName: id => infoA.byId.get(id)?.Name }, onLine, partner, { kneeToKnee });
  const map = pairing ? pairing.map : jointMap(own.tip ? [...pointsB, own.tip] : pointsB, theirs.tip ? [...pointsA, theirs.tip] : pointsA, pointsB.length, pointsA.length);
  // A joint that follows the donor's line across several donor joints: the two ends of that line, and the line in the reference pose.
  const chordEnds = map.map((j, i) => pairing && j >= 0 && pairing.until[i] > j + 1 && pairing.until[i] < pairing.ids.length ? [theirs.joints[j], pairing.ids[pairing.until[i]]] : null);
  const chordRef = chordEnds.map(ends => ends && convertV(posA(ends[1]).clone().sub(posA(ends[0]))));
  // Trunk parts with unequal counts share the donor part's whole turn by depth:
  // the deepest joint ends with all of it.
  const depths = own.joints.map(id => modelInfo(recipient).tree.depth(id)), top = Math.min(...depths), span = Math.max(...depths) - top + 1;
  const spread = own.kind === 'trunk' && own.joints.length !== theirs.joints.length ? depths.map(d => (d - top + 1) / span) : null;
  // Align: b's reference bone direction onto a's (in the converted donor space).
  // Two joints at the same place (a root and a pelvis stacked on each other) have no direction between them.
  const dirs = (points, tip, convertDir, size) => points.map((p, i) => {
    const next = points[i + 1] || tip;
    return next && next.distanceTo(p) > 0.02 * size ? convertDir(next.clone().sub(p)) : null;
  });
  // The hips are not lined up by the direction between their own joints: a root and a pelvis sit
  // where the rigger put them (measured over 699 bodies: that piece points up, sideways and down about
  // equally often), so lining it up with the donor's turns whole bodies over. Hips keep their own
  // stance at any Pose, as a one-joint hips part always did.
  const dirB = own.key === 'hips' ? pointsB.map(() => null) : dirs(pointsB, own.tip, v => v, rigB.hipHeight), dirA = dirs(pointsA, theirs.tip, convertV, rigA.hipHeight);
  // A joint with no direction of its own takes the one that follows it, the last one the one before.
  for (let j = dirA.length - 2; j >= 0; j--) if (!dirA[j] && dirA[j + 1]) dirA[j] = dirA[j + 1];
  for (let j = dirA.length - 1; j > 0; j--) if (!dirA[j]) dirA[j] = dirA[j - 1];
  const match = Math.max(0, Math.min(1, part.match ?? defaultTransferPart(rigB, key).match));
  const align = [], toTheirs = [];
  // What joint i lines up with: the donor's line across several joints, else its paired bone; nothing for an unpaired girdle piece.
  const theirDir = i => map[i] < 0 ? null : chordRef[i] || dirA[map[i]];
  own.joints.forEach((id, i) => { align.push(map[i] < 0 ? new Quaternion() : dirB[i] ? qPow(arc(dirB[i], theirDir(i)), match) : (align[i - 1] || new Quaternion()).clone()); });
  // The turn from this limb's rest direction to the donor's, joint by joint (for `frame`).
  own.joints.forEach((id, i) => { toTheirs.push(map[i] < 0 ? new Quaternion() : dirB[i] ? arc(dirB[i], theirDir(i)) : (toTheirs[i - 1] || new Quaternion()).clone()); });
  // Stance (recipe `stance`, trunk parts; off unless the recipe asks): the turn the donor's joint has from its
  // rest pose, in its reference pose, carried over to this joint, so the trunk stands as the donor's does (a
  // hunch, a lean) and not only moves as it does. Such a part rides on the donor's anchor movement, not on
  // this model's (see `onStance`), so its turn from the rest pose is the donor's whatever it hangs on here.
  const stance = own.kind === 'trunk' ? Math.max(0, Math.min(1, Number(part.stance) || 0)) : 0;
  if (stance > 0) {
    const restTurn = j => convert(worldRot(refA, theirs.joints[j])), deepest = theirs.joints.length - 1;
    own.joints.forEach((id, i) => { const target = spread ? qPow(restTurn(deepest), spread[i]) : restTurn(Math.max(0, map[i])); align[i] = align[i].clone().slerp(mul(target, inv(worldRot(refB, id))), stance); });
  }
  const looping = part.loop ?? !seq.NonLooping;
  // Trim: only the part of the donor animation between clip[0] and clip[1] (ms from its start).
  const whole = Math.max(0, seq.Interval[1] - seq.Interval[0]), cut = Array.isArray(part.clip) ? part.clip.map(Number) : [];
  const trim = [Number.isFinite(cut[0]) ? Math.max(0, Math.min(whole, cut[0])) : 0, Number.isFinite(cut[1]) ? Math.max(0, Math.min(whole, cut[1])) : whole];
  if (trim[1] <= trim[0]) { trim[0] = 0; trim[1] = whole; }
  const speed = part.speed > 0 ? part.speed : 1;
  const refRootB = posB(own.joints[0]).clone();
  const offset = partOffset(rigB, own, refB, recipient, part.offset);
  // Moment fixes: extra Raise / Turn / Roll (trunk: Lean / Turn / Tilt), full at
  // `time` and fading smoothly to nothing `width` ms either side.
  const fixes = (Array.isArray(part.fixes) ? part.fixes : []).filter(fix => Number.isFinite(Number(fix?.time)))
    .map(fix => ({ time: Number(fix.time), width: Number(fix.width) > 0 ? Number(fix.width) : 250, add: own.kind === 'trunk' ? [fix.raise, fix.roll, fix.turn] : [fix.raise, fix.turn, fix.roll] }));
  const base = (part.offset || [0, 0, 0]).map(value => Number(value) || 0);
  const offsetAt = (t, length, looping) => {
    if (!fixes.length) return offset;
    const degrees = base.slice();
    for (const fix of fixes) {
      let distance = Math.abs(t - fix.time);
      if (looping && length > 0) distance = Math.min(distance % length, length - distance % length);
      const weight = smooth(1 - distance / fix.width);
      if (weight > 0) fix.add.forEach((value, i) => { degrees[i] += weight * (Number(value) || 0); });
    }
    return degrees.every((value, i) => value === base[i]) ? offset : partOffset(rigB, own, refB, recipient, degrees);
  };
  return {
    key, part, own, theirs, donor, seq, sequence, rigA, looping, speed,
    start: Number(part.start) || 0, first: seq.Interval[0] + trim[0], length: Math.max(0, trim[1] - trim[0]),
    amount: Math.max(0, Math.min(1.5, part.amount ?? 1)), blend: Math.max(0, part.blend ?? 150),
    // Off unless the recipe asks: stay in the model's own range, loose joints follow, arm kept out of the body.
    range: share(part.range), follow: share(part.follow), avoid: share(part.avoid), hang: share(part.hang), frame: share(part.frame) > 0, toTheirs,
    scale: sizeRatio(rigB, rigA), convert, convertV, mirror, map, chordEnds, chordRef, spread, align, match, stance,
    offset, offsetAt,
    refAnchorA: theirs.anchor == null ? null : inv(worldRot(refA, theirs.anchor)),
    refAnchorB: own.anchor == null ? null : inv(worldRot(refB, own.anchor)),
    refInvA: theirs.joints.map(id => inv(worldRot(refA, id))),
    refRotB: own.joints.map(id => worldRot(refB, id).clone()),
    refEndA: posA(theirs.marker).clone(), refEndB: posB(own.marker).clone(), refRootB,
    // The donor part's first joint against its anchor in the reference pose (for the shift).
    refShiftA: posA(theirs.joints[0]).clone().sub(theirs.anchor == null ? new Vector3() : posA(theirs.anchor)),
    skip: new Set(),
  };
}

/** The open model's own features: its loose joints grouped under their top joint,
 * for the window's list. `id` is the top joint's ObjectId (the key of
 * `recipe.features`), `name` its own name, `part` the body part it hangs from or
 * turns with, `joints` the names of all its joints, `body` whether it shares skin with the body
 * (a gut: arms are then kept out of the trunk there). */
export function transferFeatures(model, { sequence, actor } = {}) {
  const rig = transferRig(model, { sequence, actor });
  if (!rig.ok) return [];
  const own = ownMotion(model, rig), info = modelInfo(model), name = id => info.byId.get(id)?.Name || String(id), found = new Map();
  for (const item of [...own.followers, ...own.chains]) {
    const top = own.featureOf.get(item.id);
    if (!found.has(top)) found.set(top, { id: top, name: name(top), part: item.part, joints: [], size: own.shapes.features.get(top)?.size ?? 0, body: !!own.shapes.features.get(top)?.body, shared: own.shapes.features.get(top)?.shared ?? 0, open: own.shapes.features.get(top)?.open ?? 0 });
    found.get(top).joints.push(name(item.id));
    if (item.id === top) found.get(top).part = item.part;
  }
  return [...found.values()];
}
/** Which parts of the open model have loose joints that can follow (recipe
 * `follow`), with their names: `{ armL: ['Pauldron_L'], chest: ['Cape 1', 'Cape 2'] }`.
 * `sequence` is the body animation (it picks the skeleton, as transferRig does). */
export function transferLooseParts(model, { sequence, actor } = {}) {
  const rig = transferRig(model, { sequence, actor });
  if (!rig.ok) return {};
  const own = ownMotion(model, rig), info = modelInfo(model), out = {};
  for (const item of [...own.followers, ...own.chains]) (out[item.part] ||= []).push(info.byId.get(item.id)?.Name || String(item.id));
  return out;
}

// ---------------------------------------------------------------- diagnostics
/** Numbers about one build, for tests and probes (never used by the window):
 * what was learned from the model's own animations, how far each part's joints
 * leave their own range (degrees past the allowed box, worst moment), and how
 * deep each arm goes into the trunk or a held thing (`level` 1 = at the surface,
 * less = inside; `allowed` is what the body animation and reference pose show). */
export function transferDiagnostics(recipient, sources, recipe) {
  const rig = transferRig(recipient, { sequence: recipe?.base?.sequence, actor: recipe?.base?.actor }), info = modelInfo(recipient), own = ownMotion(recipient, rig);
  const ref = sampleAt(recipient, rig.reference.sequence, rig.reference.frame), name = id => info.byId.get(id)?.Name;
  const pointOf = (id, world) => v3(nodePivot(recipient, info.byId.get(id), id)).applyMatrix4(world(id));
  const armPoints = (part, world) => { const points = []; let previous = pointOf(part.joints[0], world); for (const id of part.joints.slice(1)) { const p = pointOf(id, world); points.push(previous.clone().lerp(p, 0.5), p); previous = p; } return points; };
  const out = { followers: own.followers.map(item => ({ joint: name(item.id), driver: name(item.driver), part: item.part, share: item.share, fit: item.fit })), chains: own.chains.map(item => ({ joint: name(item.id), part: item.part })), considered: own.considered.map(item => ({ joint: name(item.id), driver: name(item.driver), share: item.share, fit: item.fit, most: item.most, rigid: item.rigid })), outside: {}, turn: {}, arms: {}, loose: {} };
  const arms = Object.values(rig.parts).filter(part => part.limbKind === 'arm' && part.joints.length > 1).map(part => {
    const obstacles = own.shapes.trunk, pad = own.shapes.thickness.get(part.key) || 0;
    const levels = world => armPoints(part, world).map(p => obstacles.map(o => depthIn(o, world(o.joint), p, pad).level));
    return { part, levels, obstacles, refLevels: levels(id => ref.world.get(id) || new Matrix4()) };
  });
  const looseIds = [...own.followers, ...own.chains].map(item => item.id), looseTurns = new Map(looseIds.map(id => [id, []]));
  const built0 = buildTransfer(recipient, sources, recipe, {});
  const built = buildTransfer(recipient, sources, recipe, { probe: ({ k, world }) => {
    for (const part of Object.values(rig.parts)) for (const id of part.joints) {
      const limit = own.range.get(id), parent = info.tree.parentOf(id);
      if (!limit) continue;
      const local = (parent == null ? new Quaternion() : inv(rotationOf(world(parent)))).multiply(rotationOf(world(id))), v = logQ(inv(limit.ref).multiply(local));
      out.turn[part.key] = Math.max(out.turn[part.key] || 0, v.length() * 2 / DEG);
      const d = v.clone().sub(limit.centre);
      for (let j = 0; j < 3; j++) { const x = d.dot(limit.axes[j]), margin = 0.15 * (limit.hi[j] - limit.lo[j]) + RANGE_MARGIN; out.outside[part.key] = Math.max(out.outside[part.key] || 0, (x - limit.hi[j] - margin) * 2 / DEG, (limit.lo[j] - margin - x) * 2 / DEG); }
    }
    for (const arm of arms) {
      const now = arm.levels(world), base = arm.levels(id => sampleAt(recipient, recipe.base.sequence, clockAt(built0.baseClock, built0.times[k]).frame).world.get(id) || new Matrix4());
      now.forEach((row, i) => row.forEach((level, j) => { const allowed = GUARD_LEVEL * Math.min(1, base[i][j], arm.refLevels[i][j]), deficit = allowed - level; if (!out.arms[arm.part.key] || deficit > out.arms[arm.part.key].deficit) out.arms[arm.part.key] = { deficit, level, allowed, moment: built0.times[k], inside: name(arm.obstacles[j].joint), point: i }; }));
    }
    for (const id of looseIds) looseTurns.get(id).push(rotationOf(world(id)));
  } });
  // How much each loose joint moves over the result (largest turn between any moment and the first).
  for (const id of looseIds) { const turns = looseTurns.get(id); out.loose[name(id)] = Math.max(0, ...turns.map(q => logQ(inv(turns[0]).multiply(q)).length() * 2 / DEG)); }
  out.length = built.length;
  return out;
}

// ---------------------------------------------------------------- aim (drag a hand or foot)
const AIM_LIMIT = 90;
/** World positions of a limb's root and end joint at result time `time`, from one
 * evaluation of that moment: `{ root: [x, y, z], end: [x, y, z] }`. */
export function transferEndPoint(recipient, sources, recipe, partKey, time) {
  const at = evaluateMoment(recipient, sources, recipe, partKey, time);
  return { root: at.root.toArray(), end: at.end.toArray() };
}
function evaluateMoment(recipient, sources, recipe, partKey, time) {
  const rig = transferRig(recipient, { sequence: recipe?.base?.sequence, actor: recipe?.base?.actor }), part = rig.parts[partKey];
  if (!part || part.kind !== 'limb') throw new Error('Aim works on arms, legs, wings and tails.');
  const byId = modelInfo(recipient).byId, at = id => v3(nodePivot(recipient, byId.get(id), id));
  let found = null;
  const built = buildTransfer(recipient, sources, recipe, { times: [Math.round(time)], probe: ({ world, states, entries }) => {
    const entry = entries.find(e => e.key === partKey), state = entry && states.get(entry);
    found = { root: at(part.joints[0]).applyMatrix4(world(part.joints[0])), end: at(part.marker).applyMatrix4(world(part.marker)), anchor: state?.dB || null };
  } });
  return { ...found, length: built.length, looping: !built.nonLooping };
}
/** Raise, Turn and Roll (degrees) that point direction `e` (in the offset's
 * input frame) along `g`. partOffset is Turn about up, then Raise about the
 * limb's horizontal raise axis, then Roll about its reference line. Raise sets the
 * height of the direction, Turn its bearing, and Roll stays as it is unless the
 * height cannot be reached: when the moving limb points along the raise axis
 * (an arm that hangs in its reference pose and swings forward in the attack),
 * Raise only twists it, so Roll then turns it off that axis first. Of the two
 * Raise answers the one that stays inside the sliders, then nearer `near`, wins. */
function aimAngles(rig, part, ref, model, e, g, roll, near) {
  const forward = v3(rig.facing), left = UP.clone().cross(forward).normalize();
  const root = worldPos(model, ref, part.joints[0]), end = part.tip || worldPos(model, ref, part.marker);
  const line = end.clone().sub(root), flat = line.clone().setZ(0);
  const bearing = flat.length() < line.length() * Math.sin(15 * DEG) || flat.lengthSq() < 1e-12
    ? (part.side === 'R' ? left.clone().negate() : part.side === 'L' ? left.clone() : forward.clone()) : flat.normalize();
  const raiseAxis = bearing.clone().cross(UP).normalize(), side = raiseAxis.clone().cross(UP), axis = line.lengthSq() > 1e-12 ? line.clone().normalize() : null;
  const goal = g.clone().normalize(), direction = e.clone().normalize();
  const rollBy = degrees => axis ? direction.clone().applyQuaternion(axisAngle(axis, degrees * DEG)) : direction.clone();
  const reach = v => Math.hypot(v.dot(UP), v.dot(side));
  if (axis && reach(rollBy(roll)) < Math.abs(goal.z) - 1e-6) {
    // Roll so the direction is as far from the raise axis as it can be.
    const along = axis.clone().multiplyScalar(direction.dot(axis)), across = direction.clone().sub(along), turned = axis.clone().cross(across);
    const A = along.dot(raiseAxis), B = across.dot(raiseAxis), C = turned.dot(raiseAxis), R = Math.hypot(B, C);
    if (R > 1e-9) {
      const delta = Math.atan2(C, B), spread = Math.acos(Math.max(-1, Math.min(1, -A / R)));
      const best = [delta + spread, delta - spread].map(c => Math.atan2(Math.sin(c), Math.cos(c)) / DEG)
        .reduce((x, y) => Math.abs(y - roll) < Math.abs(x - roll) ? y : x);
      roll = Math.round(best * 100) / 100;
    }
  }
  const rolled = rollBy(roll);
  // Height after Raise: p cos a - q sin a, p along up and q along raiseAxis x up.
  const p = rolled.dot(UP), q = rolled.dot(side), radius = Math.hypot(p, q), phase = Math.atan2(q, p);
  const ratio = radius > 1e-9 ? Math.max(-1, Math.min(1, goal.z / radius)) : 1;
  const answers = [Math.acos(ratio) - phase, -Math.acos(ratio) - phase].map(a => {
    const raise = Math.atan2(Math.sin(a), Math.cos(a)), raised = rolled.clone().applyQuaternion(axisAngle(raiseAxis, raise)).setZ(0), wanted = goal.clone().setZ(0);
    const turn = raised.lengthSq() > 1e-12 && wanted.lengthSq() > 1e-12 ? Math.atan2(raised.clone().cross(wanted).z, raised.dot(wanted)) : 0;
    return [raise / DEG, turn / DEG];
  });
  const outside = ([r, t]) => Math.max(0, Math.abs(r) - AIM_LIMIT) + Math.max(0, Math.abs(t) - AIM_LIMIT);
  const [raise, turn] = answers.reduce((x, y) => outside(y) < outside(x) - 1e-9 || (Math.abs(outside(y) - outside(x)) <= 1e-9 && Math.abs(y[0] - near) < Math.abs(x[0] - near)) ? y : x);
  return [raise, turn, roll];
}
/** Aim a limb so its end joint points at `point` (world) at result time `time`.
 * scope 'whole' returns `{ offset: [raise, turn, roll], clamped }`, the part's new
 * constant offset; scope 'moment' returns `{ fix: { time, raise, turn, roll, width },
 * index, clamped }`, a moment fix on top of the offset and the other fixes (an
 * existing fix within its width of `time` is returned updated, `index` says which;
 * -1 is a new fix). The recipe is not changed. */
export function transferAim(recipient, sources, recipe, partKey, time, point, { scope = 'whole' } = {}) {
  const rig = transferRig(recipient, { sequence: recipe?.base?.sequence, actor: recipe?.base?.actor }), part = rig.parts[partKey], taken = recipe?.parts?.[partKey];
  if (!part || part.kind !== 'limb' || !taken) throw new Error('Take an arm, leg, wing or tail before aiming it.');
  const ref = sampleAt(recipient, rig.reference.sequence, rig.reference.frame), target = v3(point);
  const base = (taken.offset || [0, 0, 0]).map(value => Number(value) || 0);
  const fixes = Array.isArray(taken.fixes) ? taken.fixes : [];
  const first = evaluateMoment(recipient, sources, recipe, partKey, time), { length, looping } = first;
  const near = fix => { let d = Math.abs(time - Number(fix.time)); if (looping && length > 0) d = Math.min(d % length, length - d % length); return d; };
  const index = scope === 'moment' ? fixes.findIndex(fix => near(fix) < (Number(fix.width) > 0 ? Number(fix.width) : 250)) : -1;
  // Degrees the part effectively has at `time` from the offset and the fixes.
  const effective = r => {
    const degrees = base.slice();
    fixes.forEach((fix, i) => { if (i === index) return; const weight = smooth(1 - near(fix) / (Number(fix.width) > 0 ? Number(fix.width) : 250)); degrees[0] += weight * (Number(fix.raise) || 0); degrees[1] += weight * (Number(fix.turn) || 0); degrees[2] += weight * (Number(fix.roll) || 0); });
    return degrees;
  };
  const others = effective();
  const held = index >= 0 ? [Number(fixes[index].raise) || 0, Number(fixes[index].turn) || 0, Number(fixes[index].roll) || 0] : [0, 0, 0];
  let answer = scope === 'moment' ? held : base.slice(), clamped = false;
  const recipeWith = values => {
    const parts = { ...recipe.parts };
    if (scope === 'moment') {
      const list = fixes.slice(), fix = { time, raise: values[0], turn: values[1], roll: values[2], width: Number(fixes[index]?.width) > 0 ? Number(fixes[index].width) : 250 };
      if (index >= 0) list[index] = fix; else list.push(fix);
      parts[partKey] = { ...taken, fixes: list };
    } else parts[partKey] = { ...taken, offset: values };
    return { ...recipe, parts };
  };
  // Two passes: the analytic step, then one correction from where it landed.
  for (let pass = 0; pass < 2; pass++) {
    const now = pass || (scope === 'moment' && index >= 0) ? evaluateMoment(recipient, sources, recipeWith(answer), partKey, time) : first;
    if (!now?.end) break;
    const from = now.end.clone().sub(now.root), to = target.clone().sub(now.root);
    if (from.angleTo(to) < 1 * DEG) break;
    const degrees = scope === 'moment' ? others.map((v, i) => v + answer[i]) : answer;
    // The offset sits inside the anchor's change (W = dB O X): in the offset's
    // own frame the end points along e = O^-1 dB^-1 from and must point along g = dB^-1 to.
    const anchor = now.anchor || new Quaternion(), current = partOffset(rig, part, ref, recipient, degrees);
    const e = from.clone().applyQuaternion(inv(anchor)).applyQuaternion(inv(current)), g = to.clone().applyQuaternion(inv(anchor));
    const [raise, turn, roll] = aimAngles(rig, part, ref, recipient, e, g, degrees[2], degrees[0]);
    const want = [raise, turn, roll].map((v, i) => scope === 'moment' ? v - others[i] : v);
    answer = want.map(v => { const c = Math.max(-AIM_LIMIT, Math.min(AIM_LIMIT, v)); if (Math.abs(c - v) > 1e-6) clamped = true; return Math.round(c * 100) / 100; });
  }
  if (scope === 'moment') return { fix: { time, raise: answer[0], turn: answer[1], roll: answer[2], width: Number(fixes[index]?.width) > 0 ? Number(fixes[index].width) : 250 }, index, clamped };
  return { offset: answer, clamped };
}

/** Recipient joint i -> donor joint index: one to one when counts match, else
 * nearest arc-length fraction along the reference pose (first and last fixed). */
export function jointMap(ownPath, theirPath, ownCount, theirCount) {
  if (ownCount === theirCount) return Array.from({ length: ownCount }, (_, i) => i);
  const own = ownPath, theirs = theirPath;
  const fractions = points => {
    const cumulative = [0];
    for (let i = 1; i < points.length; i++) cumulative.push(cumulative[i - 1] + points[i].distanceTo(points[i - 1]));
    const total = cumulative.at(-1);
    return cumulative.map((c, i) => total > 1e-9 ? c / total : points.length > 1 ? i / (points.length - 1) : 0);
  };
  const a = fractions(own).slice(0, ownCount), b = fractions(theirs).slice(0, theirCount);
  return a.map((f, i) => {
    if (i === 0) return 0;
    if (i === ownCount - 1) return theirCount - 1;
    let best = 0;
    b.forEach((g, j) => { if (Math.abs(g - f) < Math.abs(b[best] - f)) best = j; });
    return best;
  });
}

/** Which donor joint each joint of an arm or leg takes its turn from, by role instead of by
 * distance. Both limbs are read in their rest pose (`rest.own(id)`, `rest.theirs(id)`: positions,
 * the donor's already mirrored and turned to this model's facing; a joint off its limb's line is
 * read as lying on it, see onLine). A limb that ends in an attachment (a hand reference) counts
 * that point as its end.
 * - Each limb is split where it really starts (`poseLimbStart`): joints above are girdle pieces
 *   (collar, shoulder), the rest is the limb itself (upper part, bends, end).
 * - Girdle pairs with girdle, by place along it. A girdle piece the donor has no counterpart for
 *   takes no turn (-1): it stays as it is on its anchor.
 * - The limb's first joint pairs with the donor limb's first, its end with the donor's end. Where
 *   POSE's handle chain is the whole limb on both models (top, bend, end), bend pairs with bend.
 *   With the same number of joints the rest pair in order. Otherwise every way of pairing the
 *   joints in order is tried, and the one whose stretches point most alike in the rest pose wins
 *   (the place along the limb settles limbs that hang straight).
 * - The two limbs of a left/right pair are paired together (`partner`: this model's limb on the other
 *   side and the donor limb it takes from): every way is scored on both and the lower sum wins, so
 *   the two legs of one model never pair differently (a near tie flipped one knee onto the donor's
 *   hock, XFER row 10, Lord of Change donors).
 * - A leg's bend goes to the donor leg's knee (its first joint below the top that bends in the rest
 *   pose) where the donor's leg has more joints, unless the stretch above the bend points over 20
 *   degrees further off there than at the best other joint: the straight-shin rule then straightens
 *   the donor's hock, not its knee.
 * `until[i]` indexes `ids` (the donor's joints, then its end point if that is an attachment): the
 * donor joint or point where the stretch joint i takes ends. More than one on from `map[i]` means
 * joint i follows the donor's line across those joints, not one donor bone.
 * Returns null when either limb's top and end are not known: the caller pairs by distance. */
const KNEE_BEND = 10, KNEE_MARGIN = 20;
function limbPairing(own, theirs, rest, onLine, partner = null, { kneeToKnee = false } = {}) {
  // An arm supporting a four-legged transplant still begins at the POSE
  // shoulder. A clavicle above it cannot serve as the donor's first leg bone.
  const armSupportsBody = kneeToKnee && own.limbKind === 'arm' && theirs.limbKind === 'leg';
  if (!['arm', 'leg'].includes(own.limbKind) || (own.limbKind !== theirs.limbKind && !armSupportsBody)) return null;
  const read = (part, at, name) => {
    const line = part.line || [];
    if (line.length < 3 || !part.joints.includes(line[0])) return null;
    const end = part.joints.includes(line.at(-1)) ? null : part.tip ? line.at(-1) : undefined;
    if (end === undefined || end === null && line.at(-1) !== part.joints.at(-1)) return null;
    const ids = end == null ? part.joints : [...part.joints, end], points = [...onLine(part, part.joints.map(at)), ...(end == null ? [] : [at(end)])];
    const top = ids.indexOf(line[0]), start = poseLimbStart(points, ids.map(name), top, ids.length - 1, part.limbKind);
    // The handle chain is the whole limb (top, bend, end) when the limb starts at its top.
    return { ids, points, start, bend: line.length === 3 && start === top ? ids.indexOf(line[1]) - start : -1 };
  };
  const b = read(own, rest.own, rest.ownName), a = read(theirs, rest.theirs, rest.theirName);
  if (!b || !a) return null;
  const n = b.ids.length, m = a.ids.length, sB = b.start, sA = a.start, map = new Array(n).fill(0), until = new Array(n).fill(1);
  if (sB > 0 && sA > 0) { const girdle = jointMap(b.points.slice(0, sB + 1), a.points.slice(0, sA + 1), sB + 1, sA + 1); for (let i = 0; i < sB; i++) map[i] = Math.min(girdle[i], sA - 1); }
  else for (let i = 0; i < sB; i++) map[i] = -1;
  for (let i = 0; i < sB; i++) until[i] = map[i] < 0 ? 0 : i + 1 < sB ? Math.max(map[i] + 1, map[i + 1]) : sA;
  // The limb itself: p joints here, q on the donor, counted from each limb's own first joint.
  const p = n - sB, q = m - sA, B = b.points.slice(sB), A = a.points.slice(sA);
  const pinned = b.bend > 0 && a.bend > 0 && b.bend < p - 1 && a.bend < q - 1;
  let pick = Array.from({ length: p }, (_, t) => Math.min(t, q - 1));
  if (p > 1 && q > 1 && (p !== q || pinned && pick[b.bend] !== a.bend)) {
    const lengths = points => points.slice(1).map((point, i) => point.distanceTo(points[i])), total = list => list.reduce((sum, value) => sum + value, 0) || 1;
    // The cost of one way of pairing (f: donor joint per joint here, counted from each limb's first) on one pair of limbs.
    const scorer = (B, A) => {
      const lenB = lengths(B), sumB = total(lenB), placeB = lenB.reduce((list, value) => [...list, list.at(-1) + value / sumB], [0]);
      const lenA = lengths(A), sumA = total(lenA), placeA = lenA.reduce((list, value) => [...list, list.at(-1) + value / sumA], [0]);
      return f => {
        let sum = 0;
        for (let t = 0; t < p - 1; t++) {
          let next = q - 1; for (let u = t + 1; u < p - 1; u++) if (f[u] > f[t]) { next = f[u]; break; }
          sum += lenB[t] / sumB * B[t + 1].clone().sub(B[t]).angleTo(A[next].clone().sub(A[f[t]])) / DEG;
          if (t) sum += 60 * Math.abs(placeB[t] - placeA[f[t]]);
        }
        return sum;
      };
    };
    // The donor leg's knee: its first joint below the top whose rest pose bends (-1: none, or not a leg with more joints).
    const kneeOf = A => { for (let j = 1; j < q - 1; j++) if (A[j].clone().sub(A[j - 1]).angleTo(A[j + 1].clone().sub(A[j])) / DEG > KNEE_BEND) return j; return -1; };
    const kneeRule = own.limbKind === 'leg' && b.bend > 0 && b.bend < p - 1 && !pinned && q > p;
    const sides = [{ B, A, cost: scorer(B, A), knee: kneeRule ? kneeOf(A) : -1 }];
    // The other side's pair of limbs, read the same way; only when it has the same joints in the same roles.
    if (partner?.own && partner?.theirs && partner.own !== own && partner.theirs !== theirs && partner.own.limbKind === own.limbKind && partner.theirs.limbKind === theirs.limbKind) {
      const pb = read(partner.own, rest.own, rest.ownName), pa = read(partner.theirs, rest.theirs, rest.theirName);
      if (pb && pa && pb.ids.length === n && pa.ids.length === m && pb.start === sB && pa.start === sA && pb.bend === b.bend && pa.bend === a.bend) {
        const PB = pb.points.slice(sB), PA = pa.points.slice(sA), knee = kneeRule ? kneeOf(PA) : -1;
        if (knee === sides[0].knee) sides.push({ B: PB, A: PA, cost: scorer(PB, PA), knee });
      }
    }
    const cost = f => sides.reduce((sum, side) => sum + side.cost(f), 0);
    const search = keep => {
      let best = Infinity, found = null;
      const walk = f => {
        if (f.length === p - 1) { if (!keep(f)) return; const value = cost(f); if (value < best - 1e-9) { best = value; found = [...f, q - 1]; } return; }
        // Bend with bend; what lies above this limb's bend stays above the donor's.
        for (let j = f.at(-1); j <= q - 2; j++) if (!pinned || (f.length < b.bend ? j < a.bend : f.length > b.bend || j === a.bend)) walk([...f, j]);
      };
      walk([0]);
      return found;
    };
    pick = search(() => true) || pick;
    const knee = sides[0].knee;
    if (knee > 0 && pick[b.bend] !== knee) {
      const atKnee = search(f => f[b.bend] === knee);
      // The stretch above the bend (top -> bend here, top -> the paired joint there), worst over both sides.
      const thigh = f => Math.max(...sides.map(side => side.B[b.bend].clone().sub(side.B[0]).angleTo(side.A[f[b.bend]].clone().sub(side.A[0])) / DEG));
      // `kneeToKnee` (the transplant: its bind pose is re-posed into the donor's, so the rest directions do not matter): the
      // bend always takes the knee (H9: the Skeleton Orc's straight thigh slants back, nearer the Tauren's hip-to-hock).
      if (atKnee && (kneeToKnee || thigh(atKnee) <= thigh(pick) + KNEE_MARGIN)) pick = atKnee;
    }
  }
  for (let t = 0; t < p; t++) map[sB + t] = sA + pick[t];
  for (let t = 0; t < p; t++) { let next = m - 1; for (let u = t + 1; u < p; u++) if (pick[u] > pick[t]) { next = sA + pick[u]; break; } until[sB + t] = t === p - 1 ? m : Math.max(next, map[sB + t] + 1); }
  // Turns come from the donor's joints only: its end point (an attachment) gives none. A limb
  // here that ends in an attachment has no hand joint of its own: its last joint takes the
  // donor's last joint's turn (what holds the weapon keeps the hand's turn), as before.
  const joints = theirs.joints.length, last = own.joints.length - 1;
  if (n > own.joints.length) { map[last] = joints - 1; until[last] = joints; }
  return { map: map.slice(0, own.joints.length).map(j => Math.min(j, joints - 1)), until: until.slice(0, own.joints.length), ids: a.ids };
}

/** The constant user offset (degrees) as one world rotation from the reference pose. */
function partOffset(rig, part, ref, model, degrees = [0, 0, 0]) {
  const [a, b, c] = (degrees || [0, 0, 0]).map(value => (Number(value) || 0) * DEG);
  if (!a && !b && !c) return new Quaternion();
  const forward = v3(rig.facing), left = UP.clone().cross(forward).normalize();
  if (part.kind === 'trunk') return mul(axisAngle(UP, c), axisAngle(left, a), axisAngle(forward, b));
  const root = worldPos(model, ref, part.joints[0]), end = part.tip || worldPos(model, ref, part.marker);
  const line = end.clone().sub(root), flat = line.clone().setZ(0);
  const bearing = flat.length() < line.length() * Math.sin(15 * DEG) || flat.lengthSq() < 1e-12
    ? (part.side === 'R' ? left.clone().negate() : part.side === 'L' ? left.clone() : forward.clone()) : flat.normalize();
  const raiseAxis = bearing.clone().cross(UP).normalize();
  return mul(axisAngle(UP, b), axisAngle(raiseAxis, a), line.lengthSq() > 1e-12 ? axisAngle(line.normalize(), c) : new Quaternion());
}

function hipCentreOf(model, rig, matrixOf) {
  const at = id => v3(nodePivot(model, modelInfo(model).byId.get(id), id)).applyMatrix4(matrixOf(id) || new Matrix4());
  const legs = Object.values(rig.parts).filter(part => part.limbKind === 'leg');
  return legs.length ? average(legs.map(part => at(part.joints[0]))) : at(rig.body);
}

/** How far (radians) and about which axis the arm must turn up about its root so
 * that no outline point of its weapon is below the floor. */
function weaponLift(model, part, floor, world) {
  const end = world(part.marker), rootId = part.joints[0], root = v3(nodePivot(model, modelInfo(model).byId.get(rootId), rootId)).applyMatrix4(world(rootId));
  const points = part.weapon.outline.map(p => v3(p).applyMatrix4(end).sub(root));
  const lowest = points.reduce((a, b) => b.z < a.z ? b : a);
  const flat = lowest.clone().setZ(0);
  const axis = flat.lengthSq() > 1e-8 ? flat.normalize().cross(UP).normalize() : new Vector3(0, 1, 0);
  const shape = { points, z: root.z };
  return [liftAbout(shape, floor, axis), axis, shape];
}
/** How far (radians) the weapon of `shape` (outline points about the arm's root, the root's height) must turn up about
 * `axis` so that no point of it is below the floor. */
function liftAbout({ points, z }, floor, axis) {
  const heightAt = angle => { const q = axisAngle(axis, angle); return Math.min(...points.map(p => p.clone().applyQuaternion(q).z)) + z; };
  if (heightAt(0) >= floor) return 0;
  let lo = 0, hi = Math.PI / 2;
  if (heightAt(hi) < floor) {
    // A quarter turn does not clear the floor either (a long weapon whose other end comes down as the
    // arm turns, or one that lies on the ground): the first turn up that clears it, searched from below,
    // else the turn that brings the weapon highest, the smallest of equals. Before, this was always the
    // full quarter turn, even where it brought the weapon no higher (an arm flung up in a Death).
    const step = 3 * DEG;
    let best = 0, bestHeight = heightAt(0);
    for (let a = step; a < hi - 1e-9; a += step) {
      const h = heightAt(a);
      if (h >= floor) { lo = a - step; hi = a; for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (heightAt(mid) >= floor) hi = mid; else lo = mid; } return hi; }
      if (h > bestHeight + 1e-6) { best = a; bestHeight = h; }
    }
    if (heightAt(hi) > bestHeight + 1e-6) best = hi;
    return best;
  }
  for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (heightAt(mid) >= floor) hi = mid; else lo = mid; }
  return hi;
}
function liftAxes(need, axis, times, looping) {
  const n = need.length, first = times[0], span = times[n - 1] - first;
  const gap = (a, b) => { const d = Math.abs(times[a] - times[b]); return looping && span > 0 ? Math.min(d, span - d) : d; };
  return Array.from({ length: n }, (_, k) => {
    const sum = new Vector3();
    for (let j = 0; j < n; j++) { const g = gap(j, k); if (g <= 120 && need[j] > 0 && axis[j]) sum.addScaledVector(axis[j], need[j] * (1 - g / 150)); }
    return sum.lengthSq() > 1e-12 ? sum.normalize() : axis[k];
  });
}
/** Lift over time. A result that plays once starts and ends in the model's own
 * stance: the lift is the bare need at the first and last sample, and rises (and
 * falls) at most 400 degrees a second, so a weapon that dips right after the
 * start may briefly stay under the floor. Inside, the largest need within 80 ms
 * either side holds it up, a deeper dip later on starts the lift as early as the
 * limit needs to meet it (and is not blurred back below it there), and a 60 ms blur
 * (narrowing toward the ends) takes off the corners. A looping result smooths across its seam instead, at most
 * 170 degrees a second, never below the need. */
function smoothLift(need, times, looping) {
  const n = need.length, held = new Float64Array(n), deep = new Uint8Array(n), first = times[0], last = times[n - 1], span = last - first;
  const gap = (a, b) => { const d = Math.abs(times[a] - times[b]); return looping && span > 0 ? Math.min(d, span - d) : d; };
  const room = k => looping ? Infinity : Math.min(times[k] - first, last - times[k]);
  for (let k = 0; k < n; k++) for (let j = 0; j < n; j++) if (gap(j, k) <= Math.min(80, room(k))) held[k] = Math.max(held[k], need[j]);
  const rate = (looping ? 170 : 400) * DEG / 1000;
  if (looping) {
    for (let pass = 0; pass < 2; pass++) {
      for (let k = 0; k < n; k++) { const p = (k - 1 + n) % n; held[k] = Math.max(held[k], held[p] - rate * gap(k, p)); }
      for (let k = n - 1; k >= 0; k--) { const q = (k + 1) % n; held[k] = Math.max(held[k], held[q] - rate * gap(k, q)); }
    }
  } else {
    // A deep dip is met in time: the lift starts as early as its rise at the limit needs.
    for (let k = 0; k < n; k++) for (let j = 0; j < n; j++) { const early = need[j] - rate * gap(j, k); if (early > held[k] + 1e-9) { held[k] = early; deep[j] = 1; } }
    held[0] = need[0]; held[n - 1] = need[n - 1];
    // Rise and fall no faster than the limit from the two ends inward.
    for (let k = 1; k < n; k++) held[k] = Math.min(held[k], held[k - 1] + rate * (times[k] - times[k - 1]));
    for (let k = n - 2; k >= 0; k--) held[k] = Math.min(held[k], held[k + 1] + rate * (times[k + 1] - times[k]));
  }
  return Array.from(held, (_, k) => {
    const radius = Math.min(60, room(k));
    let sum = 0, count = 0;
    for (let j = 0; j < n; j++) if (gap(j, k) <= radius) { sum += held[j]; count++; }
    // At such a dip the blur does not take the lift back below the need the limits reach.
    return looping ? Math.max(sum / count, need[k]) : deep[k] ? Math.max(sum / count, Math.min(need[k], held[k])) : sum / count;
  });
}

/** In a clip that plays once the aim eases in over its first 150 ms and out over
 * its last (a quarter of a shorter clip), so the result starts and ends with the
 * model's own grip. */
function aimEase(clock, t) {
  if (clock.looping) return 1;
  const span = clock.length / clock.rate, elapsed = t - clock.start, edge = Math.min(150, span / 4);
  return edge > 0 ? smooth(Math.min(1, elapsed / edge, (span - elapsed) / edge)) : 1;
}

/** The point on the line `point + s * along` nearest `point` (smallest |s|) that
 * lies within `reach` of `centre`; the line's closest point when none does. */
/** The point slid along `along` (unit) to the nearest place at least `near` from `centre`. */
function slideOutOfShoulder(point, along, centre, near) {
  const offset = point.clone().sub(centre), b = offset.dot(along), c = offset.lengthSq() - near * near;
  if (c >= 0) return point;
  const root = Math.sqrt(b * b - c), s = Math.abs(-b - root) < Math.abs(-b + root) ? -b - root : -b + root;
  return point.clone().addScaledVector(along, s);
}
// The gripping hand stays at least this share of its arm's length from the arm's first joint.
const GRIP_NEAR = 0.35;
function slideInReach(point, along, centre, reach) {
  const offset = point.clone().sub(centre), b = offset.dot(along), c = offset.lengthSq() - reach * reach;
  if (c <= 0) return point;
  const disc = b * b - c;
  if (disc < 0) return point.clone().addScaledVector(along, -b);
  const roots = [-b - Math.sqrt(disc), -b + Math.sqrt(disc)], s = Math.abs(roots[0]) < Math.abs(roots[1]) ? roots[0] : roots[1];
  return point.clone().addScaledVector(along, s);
}

/** Leg solve: scale every interior bend about its own axis by one factor until
 * the root-to-end distance matches, aim the first joint at the target, and give
 * the end joint back its world rotation. Works for any joint count. */
function solveLimb(model, ids, target, { world, over, base, parentRot }) {
  if (ids.length < 2) return;
  const byId = modelInfo(model).byId;
  const matrices = ids.map(world), rotations = matrices.map(rotationOf);
  const points = ids.map((id, i) => v3(nodePivot(model, byId.get(id), id)).applyMatrix4(matrices[i]));
  const segments = points.slice(1).map((p, i) => p.clone().sub(points[i]));
  const bends = segments.slice(1).map((out, i) => {
    const incoming = segments[i], angle = incoming.angleTo(out), axis = incoming.clone().cross(out);
    return angle > 1e-4 && axis.lengthSq() > 1e-12 ? { axis: axis.normalize(), angle } : null;
  });
  const reach = segments.reduce((sum, s) => sum + s.length(), 0), want = target.clone().sub(points[0]);
  const distance = Math.min(want.length(), reach * 0.999);
  const turns = factor => {
    const list = [new Quaternion()];
    bends.forEach((bend, i) => list.push(list[i].clone().multiply(bend ? axisAngle(bend.axis, (factor - 1) * bend.angle) : new Quaternion())));
    return list;
  };
  const endOf = list => segments.reduce((p, s, i) => p.add(s.clone().applyQuaternion(list[i])), points[0].clone());
  const reachAt = factor => endOf(turns(factor)).distanceTo(points[0]);
  let factor = 1;
  const active = bends.filter(Boolean);
  if (active.length) {
    let lo = 0, hi = Math.min(...active.map(bend => (Math.PI - 0.05) / bend.angle));
    if (reachAt(hi) >= distance) factor = hi;
    else if (reachAt(lo) <= distance) factor = lo;
    else for (let i = 0; i < 40; i++) { factor = (lo + hi) / 2; if (reachAt(factor) > distance) lo = factor; else hi = factor; }
  }
  const list = turns(factor), aim = arc(endOf(list).sub(points[0]), want);
  const end = rotations.at(-1).clone();
  ids.forEach((id, i) => {
    const desired = i === ids.length - 1 ? end : mul(aim, list[i] || list.at(-1), rotations[i]);
    const own = base.local.get(id), current = over.get(id) || own;
    const local = inv(parentRot(id)).multiply(desired).normalize();
    if (current.r.dot(local) < 0) local.set(-local.x, -local.y, -local.z, -local.w);
    over.set(id, { t: current.t, r: local, s: current.s });
  });
}

/** Feet above the ground: when the sole of a planted foot dips below its own
 * reference level, turn the foot joint about its pivot by the least angle that
 * lifts the lowest sole point back, until the whole sole is up. */
function liftSole(model, foot, sole, { world, over, base, parentRot }) {
  const pivotLocal = v3(nodePivot(model, modelInfo(model).byId.get(foot), foot));
  for (let pass = 0; pass < 6; pass++) {
    const matrix = world(foot), points = sole.points.map(p => p.clone().applyMatrix4(matrix));
    const lowest = points.reduce((a, b) => b.z < a.z ? b : a);
    if (lowest.z >= sole.level - 1e-3) return;
    const pivot = pivotLocal.clone().applyMatrix4(matrix), arm = lowest.clone().sub(pivot), axis = arm.clone().cross(UP);
    if (axis.lengthSq() < 1e-10 || pivot.z < sole.level) return;
    axis.normalize();
    const lift = axis.clone().cross(arm), heightAt = angle => pivot.z + arm.z * Math.cos(angle) + lift.z * Math.sin(angle);
    let lo = 0, hi = Math.PI / 2;
    if (heightAt(hi) < sole.level) lo = hi;
    else for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (heightAt(mid) >= sole.level) hi = mid; else lo = mid; }
    const turned = axisAngle(axis, Math.max(lo, hi) + 1e-4).multiply(rotationOf(matrix));
    const current = over.get(foot) || base.local.get(foot), local = inv(parentRot(foot)).multiply(turned).normalize();
    if (current.r.dot(local) < 0) local.set(-local.x, -local.y, -local.z, -local.w);
    over.set(foot, { t: current.t, r: local, s: current.s });
  }
}

function uniqueSequenceName(model, name) {
  const taken = new Set((model.Sequences || []).map(sequence => sequence.Name));
  if (!taken.has(name)) return name;
  const stem = String(name).replace(/\s*-\s*\d+\s*$/, '');
  for (let n = 2; ; n++) if (!taken.has(`${stem} - ${n}`)) return `${stem} - ${n}`;
}

// ---------------------------------------------------------------- write
// Cubic keys (line types 2 and 3) get tangents fitted to the motion's rate of
// change at each end of their segment, so a key placed mid-curve continues the
// curve instead of flattening it. Rates are per ms: a vector for Translation,
// the quaternion log (half-angle vector, in the key's own frame) for Rotation.
function logQ(q) {
  const sign = q.w < 0 ? -1 : 1, v = new Vector3(q.x * sign, q.y * sign, q.z * sign), s = v.length();
  return s < 1e-12 ? v.set(0, 0, 0) : v.multiplyScalar(Math.atan2(s, q.w * sign) / s);
}
function expQ(v) {
  const s = v.length();
  if (s < 1e-12) return new Quaternion();
  const k = Math.sin(s) / s;
  return new Quaternion(v.x * k, v.y * k, v.z * k, Math.cos(s));
}
/** Set a.OutTan and b.InTan for the segment a..b (frames apart) from end rates. */
function fitSegment(a, b, rateA, rateB, lineType, rotation) {
  if (lineType < 2) return;
  const span = b.Frame - a.Frame, typed = (template, value) => ArrayBuffer.isView(template) ? new template.constructor(value) : Array.from(value);
  if (rotation) {
    // The sampler's squad: tangents act through slerp(OutTan_a, InTan_b) weighted 2t(1-t).
    const qa = new Quaternion().fromArray(a.Vector).normalize(), qb = new Quaternion().fromArray(b.Vector).normalize();
    if (qa.dot(qb) < 0) qb.set(-qb.x, -qb.y, -qb.z, -qb.w);
    const step = logQ(inv(qa).multiply(qb));
    const out = qa.clone().multiply(expQ(rateA.clone().multiplyScalar(span).sub(step).multiplyScalar(0.5)));
    const into = qb.clone().multiply(expQ(step.clone().sub(rateB.clone().multiplyScalar(span)).multiplyScalar(0.5)));
    a.OutTan = typed(a.OutTan || a.Vector, out.toArray()); b.InTan = typed(b.InTan || b.Vector, into.toArray());
  } else if (lineType === 2) {
    a.OutTan = typed(a.OutTan || a.Vector, rateA.map(v => v * span)); b.InTan = typed(b.InTan || b.Vector, rateB.map(v => v * span));
  } else {
    a.OutTan = typed(a.OutTan || a.Vector, rateA.map((v, i) => a.Vector[i] + v * span / 3)); b.InTan = typed(b.InTan || b.Vector, rateB.map((v, i) => b.Vector[i] - v * span / 3));
  }
}
/** Rate of change per ms of a sampled value: side +1 looks ahead, -1 behind, 0 both. */
function rateOf(sample, frame, rotation, side, h = 0.5) {
  const ahead = side >= 0 ? h : 0, behind = side <= 0 ? h : 0;
  const a = sample(frame - behind), b = sample(frame + ahead), span = ahead + behind;
  if (rotation) { const qa = new Quaternion().fromArray(a), qb = new Quaternion().fromArray(b); if (qa.dot(qb) < 0) qb.set(-qb.x, -qb.y, -qb.z, -qb.w); return logQ(inv(qa).multiply(qb)).divideScalar(span); }
  return b.map((v, i) => (v - a[i]) / span);
}

const ROTATION_TOLERANCE = 0.5, TRANSLATION_TOLERANCE = 0.2;
/** Greedy longest-run reduction of dense values, checked with the real sampler
 * on the track's own line type. First and last frames are always keys. */
function reduceDense(frames, values, width, lineType, property) {
  const rotation = property === 'Rotation', tolerance = rotation ? ROTATION_TOLERANCE : TRANSLATION_TOLERANCE;
  const vals = frames.map((_, i) => Array.from(values.subarray(i * width, i * width + width)));
  const rates = lineType < 2 ? [] : frames.map((_, i) => denseRate(vals, frames, i, rotation));
  const segment = (i, j) => {
    const a = makeKey(frames[i], vals[i], lineType, property), b = makeKey(frames[j], vals[j], lineType, property);
    if (lineType >= 2) fitSegment(a, b, rates[i], rates[j], lineType, rotation);
    return [a, b];
  };
  const fits = (i, j) => {
    const track = { LineType: lineType, Keys: segment(i, j) }, options = { interval: [frames[i], frames[j]], fallback: rotation ? [0, 0, 0, 1] : [0, 0, 0], quaternion: rotation };
    for (let k = i + 1; k < j; k++) if (trackValueError(vals[k], sampleTrack(track, frames[k], options), rotation) > tolerance) return false;
    return true;
  };
  const keys = [makeKey(frames[0], vals[0], lineType, property)];
  for (let i = 0; i < frames.length - 1;) {
    let j = i + 1;
    while (j + 1 < frames.length && fits(i, j + 1)) j++;
    const [a, b] = segment(i, j);
    if (a.OutTan) keys.at(-1).OutTan = a.OutTan;
    keys.push(b); i = j;
  }
  return keys;
}
/** Rate at dense sample i: slope at i of a least-squares cubic through up to two
 * neighbours on each side (rotations in the log map around sample i). */
function denseRate(vals, frames, i, rotation) {
  const lo = Math.max(0, i - 2), hi = Math.min(frames.length - 1, i + 2), q = rotation && new Quaternion().fromArray(vals[i]);
  const xs = [], ys = [];
  for (let j = lo; j <= hi; j++) {
    xs.push(frames[j] - frames[i]);
    ys.push(rotation ? logQ(inv(q).multiply(new Quaternion().fromArray(vals[j]))).toArray() : vals[j]);
  }
  const degree = Math.min(3, xs.length - 1), size = degree + 1, scale = Math.max(...xs.map(Math.abs)) || 1;
  // Normal equations on x / scale for conditioning; the slope is a1 / scale.
  const matrix = Array.from({ length: size }, (_, r) => Array.from({ length: size }, (_, c) => xs.reduce((sum, x) => sum + (x / scale) ** (r + c), 0)));
  const slope = ys[0].map((_, component) => {
    const rhs = Array.from({ length: size }, (_, r) => xs.reduce((sum, x, k) => sum + (x / scale) ** r * ys[k][component], 0));
    return solveLinear(matrix.map(row => row.slice()), rhs)[1] / scale;
  });
  return rotation ? new Vector3().fromArray(slope) : slope;
}
function solveLinear(a, b) {
  const n = b.length;
  for (let c = 0; c < n; c++) {
    let pivot = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[pivot][c])) pivot = r;
    [a[c], a[pivot]] = [a[pivot], a[c]]; [b[c], b[pivot]] = [b[pivot], b[c]];
    if (Math.abs(a[c][c]) < 1e-12) continue;
    for (let r = c + 1; r < n; r++) { const f = a[r][c] / a[c][c]; for (let k = c; k < n; k++) a[r][k] -= f * a[c][k]; b[r] -= f * b[c]; }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) { if (Math.abs(a[r][r]) < 1e-12) continue; let s = b[r]; for (let k = r + 1; k < n; k++) s -= a[r][k] * x[k]; x[r] = s / a[r][r]; }
  return x;
}

/** The node tracks the transfer writes into one animation: each the node's whole
 * track with only that interval's keys replaced by the reduced built motion. */
export function transferNodeTracks(model, sequenceIndex, built) {
  const interval = model.Sequences?.[sequenceIndex]?.Interval;
  if (!interval) throw new Error('Choose the animation to write the transfer into.');
  const byId = modelInfo(model).byId, start = interval[0], end = interval[1];
  const frames = built.times.map(t => start + t), result = [];
  for (const id of built.driven) {
    const node = byId.get(id), dense = built.tracks.get(id);
    for (const property of ['Rotation', 'Translation']) {
      if (!dense?.[property] || isGlobalTrack(node[property], model)) continue;
      const existing = node[property]?.Keys ? node[property] : null, lineType = existing?.LineType ?? 1;
      const ours = reduceDense(frames, dense[property], property === 'Rotation' ? 4 : 3, lineType, property);
      const outside = (existing?.Keys || []).filter(k => k.Frame < start || k.Frame > end);
      result.push({ id, property, track: { ...(existing || { GlobalSeqId: null }), LineType: lineType, Keys: [...outside, ...ours].sort((a, b) => a.Frame - b.Frame) } });
    }
  }
  return result;
}

/** The Rotation and Translation tracks of `ids` as applyTransfer leaves an undriven
 * node: the recipient's own track with the body animation copied into the new
 * animation at `start`. A preview that drove these nodes earlier puts them back with
 * this, without rebuilding its model. The recipient is not changed. */
export function transferRestoreTracks(recipient, start, built, ids) {
  const byId = modelInfo(recipient).byId, holder = { Sequences: recipient.Sequences, GlobalSequences: recipient.GlobalSequences, Nodes: [] }, result = [];
  for (const id of ids) {
    const node = byId.get(id);
    if (!node) continue;
    for (const property of ['Rotation', 'Translation']) {
      const own = node[property];
      if (own?.Keys && isGlobalTrack(own, recipient)) continue;
      const track = own?.Keys ? structuredClone(own) : own;
      if (track?.Keys) holder.Nodes.push({ [property]: track });
      result.push({ id, property, track });
    }
  }
  if (holder.Nodes.length) copyBodyAnimation(holder, built.baseClock, start, built.length);
  return result;
}

/** Result time t -> body animation frame, the build's own clock. */
const baseFrame = (clock, t) => clockAt(clock, t).frame;
const like = (template, value) => ArrayBuffer.isView(template) ? new template.constructor(value) : Array.from(value);

/** Copy the body animation into [start, start + length]: every non-global track's
 * keys time-mapped by the base clock, plus sampled keys at loop seams and ends. */
export function copyBodyAnimation(model, clock, start, length) {
  const base = model.Sequences[clock.sequence], [bs, be] = base.Interval;
  const period = clock.looping ? clock.length / clock.rate : Infinity;
  const loops = clock.looping && clock.length > 0 ? Math.ceil(length / period - 1e-9) : 1;
  const seams = [];
  for (let m = 1; m < loops; m++) seams.push(Math.round(m * period));
  const mapFrame = (f, m) => (m * period || 0) + (f - bs) / clock.rate;
  // Stray keys that already sit past the last animation (some repaired models
  // have them) would play inside the new one; they belong to no animation.
  const outside = frame => frame < start || frame > start + length;
  visitTracks(model, (track, { owner, property }) => {
    if (isGlobalTrack(track, model)) return;
    if (Array.isArray(owner)) property = null;
    if (!track.Keys.every(key => outside(key.Frame))) track.Keys = track.Keys.filter(key => outside(key.Frame));
    const inside = keysInInterval(track, base.Interval);
    if (!inside.length) return;
    // A camera's Rotation is its roll, one number: only a four-value Rotation is a quaternion.
    const template = inside[0], width = template.Vector?.length ?? 1, rotation = property === 'Rotation' && width === 4;
    if (property === 'Rotation' && !rotation) property = null;
    const keys = new Map(), sampleBase = f => sampleTrack(track, f, { interval: base.Interval, globalSequences: model.GlobalSequences, fallback: rotation ? [0, 0, 0, 1] : new Array(width).fill(0), quaternion: rotation });
    for (let m = 0; m < loops; m++) for (const key of inside) {
      const t = mapFrame(key.Frame, m);
      if (t > length + 1e-6) continue;
      const copy = { Frame: start + Math.round(t), Vector: like(key.Vector, key.Vector) };
      if (key.InTan) copy.InTan = like(key.InTan, key.InTan);
      if (key.OutTan) copy.OutTan = like(key.OutTan, key.OutTan);
      keys.set(copy.Frame, { key: copy, base: key.Frame });
    }
    const sampled = t => {
      const frame = start + Math.round(t);
      if (keys.has(frame)) return;
      const at = baseFrame(clock, t), key = makeKey(frame, sampleBase(at), track.LineType, property);
      keys.set(frame, { key: { Frame: frame, Vector: like(template.Vector, key.Vector), ...(key.InTan ? { InTan: like(template.InTan || key.InTan, key.InTan), OutTan: like(template.OutTan || key.OutTan, key.OutTan) } : {}) }, base: at, sampled: true });
    };
    sampled(0); sampled(length);
    for (const seam of seams) { if (seam - 1 > 0) sampled(seam - 1); sampled(seam); }
    const list = [...keys.values()].sort((a, b) => a.key.Frame - b.key.Frame);
    // A sampled key cuts a cubic segment: refit the tangents on both sides of it
    // to the body animation's own rate, so the curve carries on through the cut.
    if (track.LineType >= 2) {
      const scale = clock.rate, rate = (entry, side) => { const r = rateOf(sampleBase, entry.base, rotation, side); return rotation ? r.multiplyScalar(scale) : r.map(v => v * scale); };
      list.forEach((entry, i) => {
        if (!entry.sampled) return;
        if (list[i - 1]) fitSegment(list[i - 1].key, entry.key, rate(list[i - 1], 1), rate(entry, -1), track.LineType, rotation);
        if (list[i + 1]) fitSegment(entry.key, list[i + 1].key, rate(entry, 1), rate(list[i + 1], -1), track.LineType, rotation);
      });
    }
    track.Keys = [...track.Keys, ...list.map(entry => entry.key)].sort((a, b) => a.Frame - b.Frame);
  }, {
    skip: ['Keys', 'EventTrack', 'Interval', 'Anims'],
    event(node) {
      if (isGlobalTrack(node, model)) return;
      const frames = Array.from(node.EventTrack).filter(outside), copies = new Set();
      for (let m = 0; m < loops; m++) for (const f of frames) if (f >= bs && f <= be) { const t = mapFrame(f, m); if (t <= length + 1e-6) copies.add(start + Math.round(t)); }
      const combined = [...frames, ...copies].sort((a, b) => a - b);
      node.EventTrack = ArrayBuffer.isView(node.EventTrack) ? new node.EventTrack.constructor(combined) : combined;
    },
  });
}

/** The new animation's extents from its sampled motion, as Calculate extents does. */
export function newSequenceExtents(model, index) {
  const sequence = model.Sequences[index], excluded = extentsExclusions(model), boxes = sequenceSampler(model, { includeGlobalKeys: true })(index), total = box();
  (model.Geosets || []).forEach((geoset, i) => {
    if (geoset.Anims?.length > index) geoset.Anims[index] = finish(boxes[i]);
    const alpha = geosetAlphaTrack(model, i);
    if (!excluded.has(i) && geoset.Vertices?.length && Number.isFinite(boxes[i].min[0]) && (isGlobalTrack(alpha) || geosetVisibleIn(model, alpha, sequence, sequence.Interval))) { include(total, boxes[i].min); include(total, boxes[i].max); }
  });
  if (Number.isFinite(total.min[0])) Object.assign(sequence, finish(total));
}

/** Add the built transfer to `model` as one new animation. Mutates the model;
 * the caller wraps it in the document's undo step. */
export function applyTransfer(model, built, recipe, { name, extents = true } = {}) {
  const index = createSequence(model, built.length, { name: name ?? built.suggestedName, nonLooping: built.nonLooping, extents: 'ifPresent' });
  const sequence = model.Sequences[index];
  sequence.MoveSpeed = built.moveSpeed;
  copyBodyAnimation(model, { ...built.baseClock, sequence: recipe?.base?.sequence ?? built.baseClock.sequence }, sequence.Interval[0], built.length);
  const byId = modelInfo(model).byId;
  for (const { id, property, track } of transferNodeTracks(model, index, built)) byId.get(id)[property] = track;
  if (extents) newSequenceExtents(model, index);
  return { sequenceIndex: index };
}

/** A private copy with the transfer applied: geoset vertex data is shared, all
 * that applyTransfer writes is copied. Preview and commit share one code path. */
export function transferPreviewModel(recipient, built, recipe) {
  const { Geosets, ...rest } = recipient;
  const model = structuredClone(rest);
  model.Geosets = (Geosets || []).map(geoset => ({ ...geoset, ...(geoset.Anims ? { Anims: structuredClone(geoset.Anims) } : {}) }));
  // The preview does not show extents, so it skips that sampling pass.
  const { sequenceIndex } = applyTransfer(model, built, recipe, { extents: false });
  return { model, sequenceIndex };
}
