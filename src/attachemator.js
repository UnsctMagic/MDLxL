import { isWeaponName, nameSide } from './rig-names.js';
export { nameSide } from './rig-names.js';
import { Matrix4, Vector3 } from 'three';
import { nodePivot, sampleNodeMatrices, sampleGeosetAnimation, skinGeoset } from './animation.js';
import { suggestPoseRig, poseChainIds, poseNodeRole } from './pose-ik.js';
import { createRigNode } from './bone-tools.js';
import { nodeIndex } from './node-hierarchy.js';
import { vertexBoneWeights } from './part-bones.js';

// Attachemator places Warcraft III's standard attachment points the way the
// game's own SD unit models do. The rules below were measured on the 417 SD
// unit models of the installed game (docs/ATTACHEMATOR.md):
// - Origin sits at the model origin and Overhead straight above it at the top
//   of the unit; neither has a parent.
// - Head, Chest, Hands and Feet hang on the matching bone. Hands sit in the
//   palm, feet on the ground under the foot, the head in the middle of the head
//   and the chest just above the chest joint.
// - Four-legged animals use the Hand points on their front paws; a mount's
//   rear hooves get the Rear foot points; flyers without arms use wing tips.
// - Weapon sits out on the weapon mesh the unit holds, else on the right hand,
//   and on the jaws for beasts without hands.
// Everything is measured in the unit's Stand pose, then stored in the parent's
// bind space so the point follows its bone in every animation.

export const ATTACHMENT_POINTS = Object.freeze([
  { key: 'origin', name: 'Origin Ref', tip: 'The unit\'s base on the ground. Auras, shadows and many spell effects use it. It has no parent.' },
  { key: 'overhead', name: 'OverHead Ref', tip: 'Just above the unit\'s head. Buff icons such as Bloodlust\'s and other overhead effects use it. It has no parent.' },
  { key: 'head', name: 'Head Ref', tip: 'Middle of the head, attached to the head bone. Hats, crowns and head effects follow it.' },
  { key: 'chest', name: 'Chest Ref', tip: 'Middle of the upper body, attached to the chest bone. Many hit and buff effects use it.' },
  { key: 'hand left', name: 'Hand Left Ref', tip: 'In the left palm, attached to the left hand. Four-legged animals use the front left paw.' },
  { key: 'hand right', name: 'Hand Right Ref', tip: 'In the right palm, attached to the right hand. Four-legged animals use the front right paw.' },
  { key: 'foot left', name: 'Foot Left Ref', tip: 'On the ground under the left foot, attached to the foot bone.' },
  { key: 'foot right', name: 'Foot Right Ref', tip: 'On the ground under the right foot, attached to the foot bone.' },
  { key: 'foot left rear', name: 'Foot Left Rear Ref', tip: 'Under the rear left foot of a mount or many-legged unit.' },
  { key: 'foot right rear', name: 'Foot Right Rear Ref', tip: 'Under the rear right foot of a mount or many-legged unit.' },
  { key: 'weapon', name: 'Weapon Ref', tip: 'Out on the weapon the unit holds, so weapon effects and enchantments show there. Beasts without hands use the jaws.' },
]);

const STANDARD = new Map(ATTACHMENT_POINTS.map(point => [point.key, point]));
/** "Head - Ref", "OverHead Ref " and "Foot Right  Ref" all name standard points. */
export const attachmentKey = name => String(name || '').toLowerCase().replace(/\bref\b/g, ' ').replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
const NOT_A_WEAPON = /shield|hand|arm|finger|thumb|wrist|elbow|axel|axle|backpack/i;

/** The animation Attachemator measures: the plainest Stand, else the first one. */
export function attachematorStandSequence(model) {
  const sequences = model.Sequences || [];
  // "Stand" first, then "Stand - 1", "Stand -2" and so on.
  const plain = sequences.map((sequence, index) => ({ index, match: String(sequence.Name || '').match(/^\s*stand\s*(?:-?\s*(\d+))?\s*$/i) })).filter(item => item.match)
    .sort((a, b) => Number(a.match[1] ?? -1) - Number(b.match[1] ?? -1))[0];
  if (plain) return plain.index;
  const stand = sequences.findIndex(sequence => /^\s*stand/i.test(sequence.Name || '') && !/portrait|alternate|channel|work|lumber|gold|victory|hit|swim|defend|morph/i.test(sequence.Name || ''));
  if (stand >= 0) return stand;
  return sequences.findIndex(sequence => !/portrait|death|decay|dissipate/i.test(sequence.Name || ''));
}

function pivotOf(model, node) { return new Vector3().fromArray(nodePivot(model, node)); }

/** The standing unit: posed vertices, bones per vertex, and the rig as POSE reads it. */
function measureUnit(model) {
  const sequence = attachematorStandSequence(model), frame = sequence >= 0 ? model.Sequences[sequence].Interval[0] : 0;
  const matrices = sampleNodeMatrices(model, frame, sequence, frame);
  const attachmentIds = new Set((model.Attachments || []).map(node => node.ObjectId));
  // POSE must read the skeleton itself; existing (possibly wrong) refs would
  // otherwise vouch for their own placement.
  const bare = { ...model, Attachments: [], Nodes: (model.Nodes || []).map(node => node && !attachmentIds.has(node.ObjectId) ? node : undefined) };
  const transforms = [...(model.Bones || []), ...(model.Helpers || [])];
  const tree = nodeIndex(model, transforms), { byId, children } = tree;
  const vertices = [];
  const geosets = (model.Geosets || []).map((geoset, index) => ({ geoset, index })).filter(({ geoset }) => geoset.Vertices?.length);
  let shown = geosets.filter(({ index }) => sequence < 0 || sampleGeosetAnimation(model, index, frame, sequence, frame).alpha > .01);
  if (!shown.length) shown = geosets;
  for (const { geoset } of shown) {
    const posed = skinGeoset(geoset, matrices), count = geoset.Vertices.length / 3;
    for (let vertex = 0; vertex < count; vertex++) {
      const bones = vertexBoneWeights(geoset, vertex);
      vertices.push({ point: new Vector3(posed[vertex * 3], posed[vertex * 3 + 1], posed[vertex * 3 + 2]), bones });
    }
  }
  const low = new Vector3(Infinity, Infinity, Infinity), high = low.clone().negate();
  for (const { point } of vertices) { low.min(point); high.max(point); }
  if (!vertices.length) { low.set(-25, -25, 0); high.set(25, 25, 100); }
  let rig = null;
  try { rig = suggestPoseRig(bare, frame, sequence); } catch { rig = null; }
  const world = id => byId.has(id) ? pivotOf(model, byId.get(id)).applyMatrix4(matrices.get(id) || new Matrix4()) : new Vector3();
  return { sequence, frame, matrices, byId, children, tree, transforms, vertices, low, high, height: Math.max(high.z - low.z, 1), rig, world };
}

/** Bones that move a part's own mesh: the node and its children, stopping at
 * other recognized parts (an arm under the chest, a weapon under the hand). */
function ownMesh(unit, id, claimed) {
  const nodes = new Set([id]), pending = [...(unit.children.get(id) || [])];
  while (pending.length) {
    const node = pending.pop();
    if (claimed.has(node.ObjectId) || nodes.has(node.ObjectId)) continue;
    nodes.add(node.ObjectId); pending.push(...(unit.children.get(node.ObjectId) || []));
  }
  return unit.vertices.filter(vertex => vertex.bones.reduce((sum, [bone, weight]) => sum + (nodes.has(bone) ? weight : 0), 0) >= .5).map(vertex => vertex.point);
}
const centroid = points => points.reduce((sum, point) => sum.add(point), new Vector3()).divideScalar(Math.max(points.length, 1));

function chooseParts(unit) {
  const { rig, byId, tree, world, height } = unit, descendantOf = tree.isAncestor;
  const chains = (rig?.chains || []).filter(chain => byId.has(chain.end));
  const claimed = new Set([...chains.flatMap(poseChainIds), ...Object.keys(rig?.roles || {}).map(Number), ...(rig?.nodes || []), rig?.body].filter(id => id != null));
  const weapons = unit.transforms.filter(node => isWeaponName(node.Name) && !NOT_A_WEAPON.test(node.Name || '') && !claimed.has(node.ObjectId));
  weapons.forEach(node => claimed.add(node.ObjectId));
  const mesh = new Map(), meshOf = id => { if (!mesh.has(id)) mesh.set(id, ownMesh(unit, id, claimed)); return mesh.get(id); };
  // Alternate bodies (a second copy of the rig in the same place) keep the copy
  // the Stand pose actually shows.
  // A numbered copy (Hoof_Rear_R01) loses to the original it duplicates.
  const copy = id => /\d+\s*$/.test(byId.get(id)?.Name || '') ? 1 : 0;
  const better = (a, b) => copy(a.end) - copy(b.end) || meshOf(b.end).length - meshOf(a.end).length || a.end - b.end;
  const unique = list => list.filter(chain => !list.some(other => other !== chain && world(other.end).distanceTo(world(chain.end)) < height * .02 && better(other, chain) < 0));
  const named = (id, name) => (rig?.roles?.[id] || poseNodeRole(byId.get(id))) === name;
  // Limbs of a spare body that the Stand animation hides do not count.
  const shown = chains.filter(chain => poseChainIds(chain).some(id => meshOf(id).length));
  const limbs = unique((shown.length ? shown : chains).filter(chain => chain.label !== 'Chain' || chain.kind === 'leg' || !named(chain.end, 'Hand')));
  // Feet are the limbs reaching lowest; a rider's dangling legs and a
  // flyer's wing tips are not, even when the wings hang below the feet.
  const lowest = Math.min(...limbs.filter(chain => chain.kind === 'leg' || chain.label === 'Chain').map(chain => world(chain.end).z));
  let legs = !Number.isFinite(lowest) ? [] : limbs.filter(chain => (chain.kind === 'leg' || chain.label === 'Chain' || chain.label === undefined && !named(chain.end, 'Hand')) && world(chain.end).z <= lowest + height * .2);
  const arms = limbs.filter(chain => !legs.includes(chain) && chain.label !== 'Chain');
  const side = chain => world(chain.end).y >= 0 ? 'left' : 'right';
  // A wrist band can end the POSE chain while the real hand hangs beside it.
  for (const chain of arms) if (/wrist/i.test(byId.get(chain.end)?.Name || '')) {
    const hand = unit.transforms.find(node => /hand/i.test(node.Name || '') && named(node.ObjectId, 'Hand') && descendantOf(node.ObjectId, chain.middle) && !claimed.has(node.ObjectId));
    if (hand) Object.assign(chain, { end: hand.ObjectId, joints: [...poseChainIds(chain).slice(0, -1), hand.ObjectId] });
  }
  const handScore = chain => (named(chain.end, 'Hand') ? 4 : 0) + (chain.label === 'Wing' ? -2 : 0) + (meshOf(chain.end).length ? 1 : 0);
  const pick = (list, which) => list.filter(chain => side(chain) === which).sort((a, b) => handScore(b) - handScore(a) || Math.abs(world(a.end).y) - Math.abs(world(b.end).y))[0];
  // POSE may skip an arm it cannot bend; a bone named hand, wrist or forearm
  // still marks where that hand is.
  const namedHand = which => {
    const taken = new Set([...legs, ...arms].flatMap(poseChainIds));
    const score = node => /hand/i.test(node.Name) ? 3 : /wrist/i.test(node.Name) ? 2 : 1;
    const found = unit.transforms.filter(node => !taken.has(node.ObjectId) && !claimed.has(node.ObjectId) && (named(node.ObjectId, 'Hand') || /forearm|lower ?arm|arm2|arm_?0?2(?![0-9])/i.test(node.Name || '')) && (world(node.ObjectId).y >= 0) === (which === 'left'))
      .sort((a, b) => score(b) - score(a) || meshOf(b.ObjectId).length - meshOf(a.ObjectId).length)[0];
    return found ? { end: found.ObjectId, middle: found.Parent, root: byId.get(found.Parent)?.Parent ?? found.Parent, joints: [found.Parent, found.ObjectId].filter(id => id != null), forearm: !named(found.ObjectId, 'Hand') } : null;
  };
  // A mount's front hooves can be named "hand" (Reforged riders). A hand
  // standing on the ground while a rider's hand exists higher up is a hoof.
  const grounded = chain => world(chain.end).z <= lowest + height * .2;
  for (const which of ['left', 'right']) {
    const low = arms.filter(chain => side(chain) === which && grounded(chain));
    if (!low.length || arms.some(chain => side(chain) === which && !grounded(chain) && named(chain.end, 'Hand'))) { if (low.length) for (const chain of low) { arms.splice(arms.indexOf(chain), 1); legs.push(chain); } continue; }
    const taken = new Set([...legs, ...arms].flatMap(poseChainIds));
    const higher = unit.transforms.some(node => !taken.has(node.ObjectId) && /hand/i.test(node.Name || '') && named(node.ObjectId, 'Hand') && (world(node.ObjectId).y >= 0) === (which === 'left') && world(node.ObjectId).z > lowest + height * .35);
    if (higher) for (const chain of low) { arms.splice(arms.indexOf(chain), 1); legs.push(chain); }
  }
  let hands = { left: pick(arms, 'left'), right: pick(arms, 'right') };
  if (hands.left || hands.right || !legs.length) { hands.left ||= namedHand('left'); hands.right ||= namedHand('right'); }
  hands = namedSides(hands, byId);
  // Feet come in mirrored pairs, front to back. A second figure elsewhere in
  // the model has no mirrored partner and is left out.
  const rows = which => legs.filter(chain => side(chain) === which);
  const left = rows('left'), right = rows('right'), pairs = [];
  const cost = (a, b) => Math.abs(world(a.end).x - world(b.end).x) + Math.abs(world(a.end).y + world(b.end).y) + Math.abs(world(a.end).z - world(b.end).z);
  const options = left.flatMap(a => right.map(b => ({ a, b, cost: cost(a, b) + (copy(a.end) + copy(b.end)) * height * .05 }))).sort((a, b) => a.cost - b.cost);
  const used = new Set();
  for (const { a, b, cost: gap } of options) if (!used.has(a) && !used.has(b) && (!pairs.length || gap < Math.max(height * .35, options[0].cost * 2))) { used.add(a); used.add(b); pairs.push(namedSides({ left: a, right: b }, byId)); }
  if (!pairs.length) pairs.push({ left: left[0], right: right[0] });
  pairs.sort((a, b) => Math.max(...[a.left, a.right].filter(Boolean).map(chain => world(chain.end).x)) < Math.max(...[b.left, b.right].filter(Boolean).map(chain => world(chain.end).x)) ? 1 : -1);
  // Four-legged animals carry the Hand points on their front paws.
  if (!hands.left && !hands.right && pairs.length >= 2) { const front = pairs.shift(); hands = { left: front.left, right: front.right, paw: true }; }
  let feet = pairs[0] || {}, rear = pairs.length >= 2 ? pairs.at(-1) : {};
  // Reforged rigs name their attachment joints outright: bone_hand_left,
  // bone_leg_left (the foot), and mount_bone_* on a rider's mount.
  const marker = name => unit.transforms.find(node => String(node.Name || '').toLowerCase() === name);
  const as = node => node && { end: node.ObjectId, middle: node.Parent, root: byId.get(node.Parent)?.Parent ?? node.Parent, joints: [node.Parent, node.ObjectId].filter(value => value != null) };
  const marked = prefix => ({ left: as(marker(prefix + 'left')), right: as(marker(prefix + 'right')) });
  const both = pair => pair.left && pair.right;
  const riderHands = marked('bone_hand_'), riderFeet = marked('bone_leg_'), mountFront = marked('mount_bone_hand_'), mountRear = marked('mount_bone_leg_');
  if (both(riderHands)) hands = riderHands;
  else if (both(mountFront)) hands = { ...mountFront, paw: true };
  if (both(riderHands) && both(mountFront)) { feet = mountFront; rear = both(mountRear) ? mountRear : {}; }
  else if (both(riderFeet)) { feet = riderFeet; if (both(mountRear)) rear = mountRear; }
  else if (both(mountRear)) { feet = mountRear; rear = {}; }
  const actorOf = chain => chain ? byId.get(chain.root)?.Parent : null;
  const handActor = actorOf(hands.left) ?? actorOf(hands.right);
  const role = name => unit.transforms.filter(node => (rig?.roles?.[node.ObjectId] || poseNodeRole(node)) === name && !/death|portrait/i.test(node.Name || ''))
    .sort((a, b) => Number(/alternate/i.test(a.Name || '')) - Number(/alternate/i.test(b.Name || '')));
  const nearActor = list => list.filter(node => handActor != null && (descendantOf(handActor, node.ObjectId) || descendantOf(node.ObjectId, handActor) || tree.root(node.ObjectId) === tree.root(handActor)));
  const highest = list => list.slice().sort((a, b) => world(b.ObjectId).z - world(a.ObjectId).z || meshOf(b.ObjectId).length - meshOf(a.ObjectId).length)[0];
  const plain = list => list.some(node => !/alternate/i.test(node.Name || '')) ? list.filter(node => !/alternate/i.test(node.Name || '')) : list;
  const heads = plain(role('Head')).filter(node => role('Head').every(other => other === node || !descendantOf(node.ObjectId, other.ObjectId)));
  const head = marker('bone_head') || highest(nearActor(heads)) || highest(heads);
  const chests = plain(role('Chest'));
  const chest = marker('bone_chest') || (handActor != null && chests.find(node => [hands.left, hands.right].some(chain => chain && descendantOf(chain.root, node.ObjectId)))) || highest(nearActor(chests)) || highest(chests) || (rig?.body != null && byId.get(rig.body)) || null;
  const realHand = chain => !!chain && (named(chain.end, 'Hand') || !!chain.forearm);
  // Most weapons are plain meshes (Cylinder02, Mesh33) parented under a hand.
  // A hand's child whose mesh reaches well past the hand is what it holds.
  if (!hands.paw) for (const chain of [hands.right, hands.left].filter(realHand)) {
    const grip = world(chain.end), pending = [...(unit.children.get(chain.end) || [])];
    while (pending.length) {
      const node = pending.shift();
      if (claimed.has(node.ObjectId)) continue;
      // Look past finger and hand meshes to what they hold.
      if (NOT_A_WEAPON.test(node.Name || '')) { pending.push(...(unit.children.get(node.ObjectId) || [])); continue; }
      const own = ownMesh(unit, node.ObjectId, claimed);
      if (own.length && Math.max(...own.map(point => point.distanceTo(grip))) > height * .22) { weapons.push(node); claimed.add(node.ObjectId); }
    }
  }
  mesh.clear();
  // Ships, wagons and critters without named parts still have a body bone that
  // carries the mesh; points Blizzard cannot name a bone for hang on it.
  const everything = new Set();
  const roots = unit.transforms.filter(node => !byId.has(node.Parent)).map(node => ({ node, mesh: ownMesh(unit, node.ObjectId, everything).length })).sort((a, b) => b.mesh - a.mesh);
  const body = (rig?.body != null && byId.get(rig.body)) || (roots[0]?.mesh ? roots[0].node : null);
  return { hands, feet, rear, head, chest, weapons, meshOf, claimed, realHand, body, grounded: chain => Number.isFinite(lowest) && grounded(chain) };
}
/** Blizzard follows the bone names when a whole pair is named the other way
 * round from where the mesh is, so Attachemator does too. */
function namedSides(pair, byId) {
  if (!pair.left || !pair.right) return pair;
  const vote = chain => { let score = 0; for (const id of poseChainIds(chain)) { const side = nameSide(byId.get(id)?.Name); score += side === 'left' ? 1 : side === 'right' ? -1 : 0; } return score; };
  return vote(pair.left) < 0 && vote(pair.right) > 0 ? { ...pair, left: pair.right, right: pair.left } : pair;
}

/** Where every standard point belongs: parent and world position in the Stand pose. */
function proposePoints(unit) {
  const { world, height, low, high } = unit, parts = chooseParts(unit), { meshOf } = parts;
  const result = new Map(), put = (key, parent, point, why) => result.set(key, { parent: parent ?? null, world: point, why });
  const middle = new Vector3((low.x + high.x) / 2, (low.y + high.y) / 2, 0);
  put('origin', null, new Vector3(0, 0, 0), 'At the model\'s origin, like every Blizzard unit.');
  put('overhead', null, new Vector3(0, 0, high.z + height * .07), 'Straight above the origin at the top of the unit.');
  const nodeName = id => unit.byId.get(id)?.Name || `#${id}`;
  if (parts.head) {
    const own = meshOf(parts.head.ObjectId), pivot = world(parts.head.ObjectId);
    put('head', parts.head.ObjectId, own.length ? centroid(own) : pivot, `Middle of the head, on ${nodeName(parts.head.ObjectId)}.`);
  } else {
    const upper = unit.vertices.map(vertex => vertex.point).filter(point => point.z > low.z + height * .6), front = Math.max(...upper.map(point => point.x)), back = Math.min(...upper.map(point => point.x));
    const nose = upper.filter(point => point.x >= front - (front - back) * .25);
    put('head', parts.body?.ObjectId, nose.length ? centroid(nose) : new Vector3(middle.x, middle.y, high.z - height * .12), parts.body ? `No head bone found: front top of the model, on ${nodeName(parts.body.ObjectId)}.` : 'No head bone found: front top of the model.');
  }
  if (parts.chest) {
    const own = meshOf(parts.chest.ObjectId), pivot = world(parts.chest.ObjectId);
    put('chest', parts.chest.ObjectId, own.length ? pivot.clone().lerp(centroid(own), .6) : pivot.clone().add(new Vector3(0, 0, height * .08)), `Upper body, on ${nodeName(parts.chest.ObjectId)}.`);
  } else put('chest', parts.body?.ObjectId, new Vector3(middle.x, middle.y, low.z + height * .62), 'No chest bone found: at chest height.');
  const ground = (chain, label) => {
    const own = meshOf(chain.end), pivot = world(chain.end), sole = own.length ? Math.min(...own.map(point => point.z)) : low.z;
    const above = own.length ? centroid(own) : pivot;
    return new Vector3(above.x, above.y, Math.min(sole, pivot.z));
  };
  const farEnd = (points, from) => { const reach = Math.max(...points.map(point => point.distanceTo(from))); return centroid(points.filter(point => point.distanceTo(from) >= reach * .6)); };
  const palm = chain => {
    const own = meshOf(chain.end), pivot = world(chain.end);
    // A forearm carries the hand at its far end.
    if (own.length && chain.forearm) return farEnd(own, pivot);
    if (own.length) return pivot.clone().lerp(centroid(own), 1.15);
    const before = world(chain.joints?.at(-2) ?? chain.middle);
    return pivot.clone().add(pivot.clone().sub(before).multiplyScalar(.25));
  };
  for (const which of ['left', 'right']) {
    const hand = parts.hands[which], foot = parts.feet[which], rear = parts.rear[which];
    const paw = !!hand && (parts.hands.paw || parts.grounded(hand));
    if (hand) put(`hand ${which}`, hand.end, paw ? ground(hand) : palm(hand), paw ? `On the ground under the front ${which} paw, on ${nodeName(hand.end)}.` : `In the ${which} palm, on ${nodeName(hand.end)}.`);
    else put(`hand ${which}`, parts.body?.ObjectId, new Vector3(middle.x, (which === 'left' ? high.y : low.y) * .8, low.z + height * .35), `No ${which} hand found: at hand height on the ${which} side.`);
    if (foot) put(`foot ${which}`, foot.end, ground(foot), `On the ground under the ${which} foot, on ${nodeName(foot.end)}.`);
    else if (!parts.hands.paw || !parts.hands[which]) put(`foot ${which}`, parts.body?.ObjectId, new Vector3(middle.x, (which === 'left' ? high.y : low.y) * .5, low.z), `No ${which} foot found: on the ground on the ${which} side.`);
    if (rear) put(`foot ${which} rear`, rear.end, ground(rear), `On the ground under the rear ${which} foot, on ${nodeName(rear.end)}.`);
  }
  // Weapon: the longest weapon mesh held in a hand, then a hand, then the jaws.
  const handsHeld = [parts.hands.right, parts.hands.left].filter(Boolean);
  const held = parts.weapons.map(node => {
    const own = meshOf(node.ObjectId), hand = handsHeld.find(chain => unit.tree.isAncestor(node.ObjectId, chain.end));
    if (!own.length) return null;
    const grip = hand ? world(hand.end) : world(node.ObjectId), reach = Math.max(...own.map(point => point.distanceTo(grip)));
    return { node, own, grip, reach, hand };
  }).filter(Boolean).sort((a, b) => Number(!!b.hand) - Number(!!a.hand) || b.reach - a.reach)[0];
  if (held) {
    const far = held.own.filter(point => point.distanceTo(held.grip) > held.reach * .3);
    put('weapon', held.node.ObjectId, centroid(far.length ? far : held.own), `Out on the weapon, on ${nodeName(held.node.ObjectId)}.`);
  } else if (handsHeld.some(parts.realHand) && !parts.hands.paw) {
    const hand = handsHeld.find(parts.realHand);
    put('weapon', hand.end, palm(hand), `No weapon mesh found: in the ${hand === parts.hands.right ? 'right' : 'left'} hand, on ${nodeName(hand.end)}.`);
  } else if (parts.head) {
    const own = meshOf(parts.head.ObjectId), front = own.length ? Math.max(...own.map(point => point.x)) : 0, span = own.length ? front - Math.min(...own.map(point => point.x)) : 0;
    const jaw = own.filter(point => point.x > front - span * .25);
    put('weapon', parts.head.ObjectId, jaw.length ? centroid(jaw) : world(parts.head.ObjectId), `No hands: at the jaws, on ${nodeName(parts.head.ObjectId)}.`);
  } else put('weapon', parts.body?.ObjectId, new Vector3(high.x * .8, middle.y, low.z + height * .4), 'No weapon or hands found: in front of the unit.');
  return result;
}

/** The plan: one row per standard point, matched to the model's existing refs. */
export function planAttachments(model) {
  const unit = measureUnit(model), proposed = proposePoints(unit);
  const existing = new Map(), others = [];
  for (const node of model.Attachments || []) {
    const key = attachmentKey(node.Name);
    if (STANDARD.has(key) && !existing.has(key)) existing.set(key, node); else others.push(node);
  }
  const tolerance = unit.height * .02;
  const rows = [];
  for (const point of ATTACHMENT_POINTS) {
    const proposal = proposed.get(point.key), current = existing.get(point.key);
    if (!proposal) { if (current) others.push(current); continue; }
    const parentMatrix = proposal.parent != null ? unit.matrices.get(proposal.parent) : null;
    const inverse = parentMatrix && Math.abs(parentMatrix.determinant()) > 1e-12 ? parentMatrix.clone().invert() : new Matrix4();
    const pivot = proposal.world.clone().applyMatrix4(inverse);
    const row = { key: point.key, name: current?.Name ?? point.name, tip: point.tip, why: proposal.why, parent: proposal.parent, pivot: pivot.toArray().map(round), id: current?.ObjectId ?? null };
    if (current) {
      const currentWorld = pivotOf(model, current).applyMatrix4(unit.matrices.get(current.ObjectId) || new Matrix4());
      row.currentParent = current.Parent ?? null;
      row.moves = currentWorld.distanceTo(proposal.world);
      row.reparent = (current.Parent ?? null) !== (proposal.parent ?? null) && !(current.Parent == null && proposal.parent == null);
      row.state = row.reparent || row.moves > tolerance ? 'change' : 'right';
      row.animated = !!(current.Translation?.Keys?.length || current.Rotation?.Keys?.length || current.Scaling?.Keys?.length);
    } else row.state = 'new';
    rows.push(row);
  }
  // Every other point is listed as it is, so it can be moved or re-attached by hand.
  for (const node of others) rows.push({ key: `ref:${node.ObjectId}`, name: node.Name, tip: 'Not a standard point. It stays as it is unless you move it or change its bone.', parent: node.Parent ?? null, currentParent: node.Parent ?? null, pivot: Array.from(pivotOf(model, node).toArray()), id: node.ObjectId, state: 'other' });
  return { rows, others: others.map(node => node.Name), sequence: unit.sequence, frame: unit.frame, height: unit.height };
}
const round = value => Math.round(value * 1e4) / 1e4;

/** Applies the chosen rows. `pivots` and `parents` hold the user's own spots and bones by key. */
export function applyAttachmentPlan(model, rows, { chosen, pivots = {}, parents = {} } = {}) {
  let changed = 0;
  const ids = {};
  for (const row of rows) {
    if (row.id != null) ids[row.key] = row.id;
    const edited = !!pivots[row.key] || row.key in parents;
    if ((row.state === 'right' || row.state === 'other') && !edited || chosen && !chosen.has(row.key)) continue;
    const pivot = new Float32Array(pivots[row.key] || row.pivot);
    let node = row.id != null ? (model.Attachments || []).find(item => item.ObjectId === row.id) : null;
    if (row.id != null && !node) throw new Error(`${row.name} is no longer in the model. Open Attachemator again.`);
    if (!node) { node = createRigNode(model, 'Attachment'); node.Name = row.name; }
    node.Parent = row.key in parents ? parents[row.key] : row.parent ?? null;
    model.PivotPoints ||= [];
    model.PivotPoints[node.ObjectId] = node.PivotPoint = pivot;
    ids[row.key] = node.ObjectId;
    changed++;
  }
  return { changed, ids };
}
