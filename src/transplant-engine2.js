// XFER engine 2 (docs/agent-tasks/xfer-engine2.md): poses instead of joint turns.
// Engine 1 copies each donor joint's local turn onto this model's fitted skeleton, which reproduces the donor's pose only
// when both bodies are built alike. Engine 2 runs after it, on its result, and re-poses the limbs every moment, region by
// region (`regions`: left arm, right arm, left leg, right leg, weapon; each 1 or 2, else the suggestion):
// 1. each limb bone of an engine 2 region points the way the donor's matching bone points;
// 2. the limb end is aimed at the donor's spot scaled to this body: a foot from the hip centre (forward and up by the leg
//    length ratio; sideways the donor's leg spread from its hip socket, scaled by the leg ratio, from this model's own
//    socket or the donor's socket spacing scaled by the leg ratio, whichever is wider), a hand from the shoulder centre
//    (arm length ratio), a second hand holding the weapon with the weapon hand from that hand; the knee or elbow bends in
//    the donor's bend plane (two-bone solve, pose-ik.js), easing off before the limb is fully straight;
// 3. with both legs on engine 2 the body stands as high above the ground as the donor's, times the leg length ratio, and
//    travels by the same ratio, so a planted donor foot stays planted;
// 4. a limb end (hand, foot) keeps engine 1's world turn, which is the donor's: what the hand holds keeps the donor's angle.
//    The arm's region decides where its hand goes. The weapon region decides only how the weapon sits in the hand: engine 1
//    keeps the hand's turn, engine 2 turns the hand so the weapon points the way the donor's weapon points.
// Spine and head turn as engine 1 turns them in both engines. Bone lengths never change (rotations only, plus the body's
// position), so the mesh keeps its shape and regions meet without tearing. Every region on 1 leaves engine 1's result as is.
// Written keys are linear and dense (every 1/30 s and every key of the limb and the joints above it), so nothing between
// two keys swings against the parent's curve.
import { Quaternion, Vector3 } from 'three';
import { allNodes, isGlobalTrack, nodePivot, sampleNodeMatrices, sampleTrack } from './animation.js';
import { solveTwoBone } from './pose-ik.js';

const v3 = value => new Vector3().fromArray(value);
const rotationOf = matrix => { const q = new Quaternion(); matrix.decompose(new Vector3(), q, new Vector3()); return q.normalize(); };
const arc = (from, to) => from.lengthSq() > 1e-12 && to.lengthSq() > 1e-12 ? new Quaternion().setFromUnitVectors(from.clone().normalize(), to.clone().normalize()) : new Quaternion();
const mid = points => points.reduce((sum, p) => sum.add(p), new Vector3()).divideScalar(Math.max(1, points.length));
const clamp01 = x => Math.max(0, Math.min(1, x));
const KINDS = new Set(['leg', 'arm', 'tail', 'wing']);
const STEP = 1000 / 30;

/** The regions a person picks an engine for, in the order the picker shows them. */
export const ENGINE_REGIONS = ['armL', 'armR', 'legL', 'legR', 'weapon'];

const chainLength = (ids, pivot) => ids.slice(1).reduce((sum, id, i) => sum + pivot(id).distanceTo(pivot(ids[i])), 0);
const pivotOf = model => { const byId = new Map(allNodes(model).map(n => [n.ObjectId, n])); return id => v3(nodePivot(model, byId.get(id), id)); };

/** Proportions of two bodies from their rigs at rest: leg and arm length ratios (this model over the donor) and the ratio
 * of the hip socket spacing. */
function proportions(model, rigB, donor, rigA) {
  const pB = pivotOf(model), pA = pivotOf(donor);
  const pairs = kind => Object.values(rigB.parts || {}).filter(part => part.limbKind === kind && rigA.parts?.[part.key]?.limbKind === kind)
    .map(part => [part, rigA.parts[part.key]]).filter(([own, theirs]) => chainLength(own.joints, pB) > 1e-6 && chainLength(theirs.joints, pA) > 1e-6);
  const ratio = list => list.length ? list.reduce((s, [own, theirs]) => s + chainLength(own.joints, pB) / chainLength(theirs.joints, pA), 0) / list.length : null;
  const legs = pairs('leg'), arms = pairs('arm');
  const spacing = (rig, pivot) => {
    const sockets = side => Object.values(rig.parts || {}).filter(part => part.limbKind === 'leg' && part.side === side).map(part => pivot(part.joints[0]));
    const left = sockets('L'), right = sockets('R');
    return left.length && right.length ? mid(left).distanceTo(mid(right)) : 0;
  };
  const leg = ratio(legs), arm = ratio(arms), wB = spacing(rigB, pB), wA = spacing(rigA, pA);
  return { leg, arm, width: wB > 1e-6 && wA > 1e-6 ? wB / wA : null, legs: legs.length > 0, arms: arms.map(([own]) => own.side),
    weapon: Object.values(rigA.parts || {}).some(part => part.weapon) || Object.values(rigB.parts || {}).some(part => part.weapon) };
}

/** The engine each region starts on, read from the two bodies' proportions: engine 2 where they differ enough for copied
 * joint turns to miss (hip spacing against leg length off by a quarter, arm against leg length off by a fifth), engine 1
 * where the bodies are built alike (near-twins come out like themselves). The weapon follows its arm.
 * Returns { suggested: {region: 1|2}, present: [regions this pair has] }. */
export function suggestEngineRegions(model, rigB, donor, rigA) {
  if (!rigB?.ok || !rigA?.ok) return { suggested: {}, present: [] };
  const p = proportions(model, rigB, donor, rigA), off = (a, b, limit) => a != null && b != null && Math.abs(Math.log(a / b)) > Math.log(limit);
  const legs = p.legs && (off(p.width, p.leg, 1.25)) ? 2 : 1;
  const arms = off(p.arm, p.leg ?? (rigA.hipHeight > 0 ? rigB.hipHeight / rigA.hipHeight : null), 1.2) ? 2 : 1;
  const present = [], suggested = {};
  for (const side of ['L', 'R']) if (p.arms.includes(side)) { present.push('arm' + side); suggested['arm' + side] = arms; }
  if (p.legs) for (const side of ['L', 'R']) if (Object.values(rigB.parts).some(part => part.limbKind === 'leg' && part.side === side)) { present.push('leg' + side); suggested['leg' + side] = legs; }
  if (p.weapon && p.arms.length) { present.push('weapon'); suggested.weapon = arms; }
  return { suggested, present };
}

/**
 * Re-pose the result `M` of engine 1. `D` is the donor as engine 1 read it (reflected when mirrored), `limbs` the paired
 * limbs ({own, theirs} rig parts: theirs holds donor joint ids), `donorMap` donor id -> result id, `rigA` / `rigB` the donor's
 * and this model's rigs, `model` this model, `regions` the engine per region (missing ones: the suggestion). Changes M's
 * rotation keys of the engine 2 limbs and, with both legs on engine 2, the position keys of its parentless joints.
 */
export function engine2Pose(M, D, { limbs, donorMap, rigA, rigB, model, regions = null }) {
  const { suggested } = suggestEngineRegions(model, rigB, D, rigA);
  const valid = source => Object.fromEntries(ENGINE_REGIONS.filter(key => source?.[key] === 1 || source?.[key] === 2).map(key => [key, source[key]]));
  const pick = { ...suggested, ...valid(regions) };
  // `regions.animations`: {animation name: regions} for animations that use their own choice (the rest use `pick`).
  const perAnimation = Object.fromEntries(Object.entries(regions?.animations || {}).map(([name, value]) => [name.trim().toLowerCase(), { ...pick, ...valid(value) }]));
  const pickFor = name => perAnimation[String(name || '').trim().toLowerCase()] ?? pick;
  const byM = new Map(allNodes(M).map(n => [n.ObjectId, n])), byD = new Map(allNodes(D).map(n => [n.ObjectId, n]));
  const pM = id => v3(nodePivot(M, byM.get(id), id)), pD = id => v3(nodePivot(D, byD.get(id), id));
  const editable = id => { const n = byM.get(id); return !!n && !(n.Rotation?.Keys?.length && isGlobalTrack(n.Rotation, M)); };
  const chains = [];
  for (const { own, theirs } of limbs) {
    if (!KINDS.has(theirs.limbKind) || own.limbKind !== theirs.limbKind) continue;
    const donor = theirs.joints.filter(id => byD.has(id) && donorMap[id] != null && byM.has(donorMap[id]));
    if (donor.length < 2 || donor.length !== theirs.joints.length) continue;
    const ids = donor.map(id => donorMap[id]);
    if (!ids.every(editable)) continue;
    const lenM = chainLength(ids, pM), lenD = chainLength(donor, pD);
    if (!(lenM > 1e-6 && lenD > 1e-6)) continue;
    const held = rigA.parts?.[theirs.key]?.weapon ? rigA.parts[theirs.key] : theirs.weapon ? theirs : null;
    chains.push({ key: theirs.key, kind: theirs.limbKind, side: theirs.side, donor, ids, ratio: lenM / lenD, lenD, weapon: !!held,
      // the weapon's line (butt to tip, at rest) in this model and in the donor, and the donor joint that carries the donor's
      ownLine: own.weapon?.butt && own.weapon?.tip ? v3(own.weapon.tip).sub(v3(own.weapon.butt)) : null,
      donorLine: held?.weapon?.butt && held.weapon.tip ? v3(held.weapon.tip).sub(v3(held.weapon.butt)) : null, donorHand: held?.marker ?? null });
  }
  const legs = chains.filter(c => c.kind === 'leg'), arms = chains.filter(c => c.kind === 'arm');
  for (const chain of chains) {
    chain.group = byD.get(chain.donor[0])?.Parent ?? -1;
    // Alike grips: the two weapons lie within 60 degrees of each other in the hand at rest (either way along the handle).
    // Otherwise they are held another way, and turning the hand to match turned the weapon into the body (a hammer, pair 31).
    chain.gripAlike = !!(chain.ownLine && chain.donorLine) && Math.min(chain.ownLine.angleTo(chain.donorLine), Math.PI - chain.ownLine.angleTo(chain.donorLine)) <= Math.PI / 3;
    // Engine 1 gives each joint the donor's turn. One fixed turn per bone, taken at rest, from this model's bone onto the
    // donor's then points it the way the donor's bone points in every moment. Fixed, so it never jumps (a turn worked out
    // anew each moment flipped where it was large: wings on a mount's forelimbs).
    chain.rest = chain.ids.slice(0, -1).map((id, k) => arc(pM(chain.ids[k + 1]).sub(pM(id)), pD(chain.donor[k + 1]).sub(pD(chain.donor[k]))));
    // The same for the weapon in the hand: this model's weapon line onto the donor's (the nearer way along the handle).
    if (chain.gripAlike) chain.grip = arc(chain.ownLine, chain.ownLine.dot(chain.donorLine) < 0 ? chain.donorLine.clone().negate() : chain.donorLine);
  }
  // The weapon arm: the main pair's first (a mount's forelimb read as a second pair of arms can carry a weapon reading too);
  // else the arm holding this model's weapon while the donor's hand is empty.
  const weaponArm = arms.find(c => c.weapon && /^arm[LR]?$/.test(c.key)) ?? arms.find(c => c.weapon) ?? arms.find(c => c.ownLine) ?? null;
  const topOf = id => { let at = id; while (byM.get(at)?.Parent != null && byM.get(at).Parent >= 0 && byM.has(byM.get(at).Parent)) at = byM.get(at).Parent; return at; };
  // One choice of regions: each chain's engine, the weapon's, whether the body moves, and the joints to key.
  const configure = choice => {
    const both = (a, b) => choice[a] === 2 && choice[b] === 2 ? 2 : 1;
    const regionOf = chain => {
      if (chain.kind === 'leg') return chain.side === 'L' || chain.side === 'R' ? choice['leg' + chain.side] ?? 1 : both('legL', 'legR');
      if (chain.kind === 'arm' || chain.kind === 'wing') return chain.side === 'L' || chain.side === 'R' ? choice['arm' + chain.side] ?? 1 : both('armL', 'armR');
      return both('legL', 'legR'); // a tail goes with the lower body
    };
    for (const chain of chains) chain.engine = regionOf(chain);
    const weaponEngine = choice.weapon ?? weaponArm?.engine ?? 1;
    // The arm's own box decides where the arm and hand go; the weapon box only how the weapon sits in the hand.
    for (const chain of chains) chain.moves = chain.engine === 2 || (chain === weaponArm && weaponEngine === 2 && !!chain.ownLine);
    const shiftBody = legs.length > 0 && legs.every(c => c.engine === 2);
    // The body moves by its top joint: the parentless joint the legs hang from. Other parentless joints (a hero glow, a
    // portrait backdrop, a loose plane) stay as engine 1 has them; moving them with the body made them bob.
    const roots = shiftBody ? [...new Set(legs.map(c => topOf(c.ids[0])))].map(id => byM.get(id)).filter(n => n && !(n.Translation?.Keys?.length && isGlobalTrack(n.Translation, M))) : [];
    const moving = chains.filter(c => c.moves);
    const watched = new Set(roots.map(n => n.ObjectId));
    for (const chain of moving) for (const id of chain.ids) for (let at = id; at != null && at >= 0 && byM.has(at) && !watched.has(at); at = byM.get(at).Parent) watched.add(at);
    return { weaponEngine, shiftBody, roots, moving, watched };
  };
  const report = { chains: chains.length, regions: pick, suggested, ...(Object.keys(perAnimation).length ? { animations: Object.keys(perAnimation) } : {}) };
  if (![pick, ...Object.values(perAnimation)].some(choice => configure(choice).moving.length)) return report;
  const average = (list, fallback) => list.length ? list.reduce((s, c) => s + c.ratio, 0) / list.length : fallback;
  const sizeRatio = rigA.hipHeight > 0 ? rigB.hipHeight / rigA.hipHeight : 1;
  const legRatio = average(legs, sizeRatio), armRatio = average(arms, legRatio);
  const width = (list, pivot) => {
    const left = list.filter(c => c.side === 'L').map(c => pivot(c)), right = list.filter(c => c.side === 'R').map(c => pivot(c));
    return left.length && right.length ? mid(left).distanceTo(mid(right)) : 0;
  };
  // Half the hip socket spacing; a leg spreads sideways from the wider of this model's own socket and the donor's socket
  // scaled by the leg ratio (a narrow-hipped body under a wide-hipped donor keeps the donor's stance for its height; a
  // wide-hipped body keeps its own hips and the donor's leg spread from them).
  const halfM = width(legs, c => pM(c.ids[0])) / 2, halfD = width(legs, c => pD(c.donor[0])) / 2, halfOut = Math.max(halfM, legRatio * halfD);
  const groundM = rigB.ground, groundD = rigA.ground;
  const restHipM = legs.length ? mid(legs.map(c => pM(c.ids[0]))) : null, restHipD = legs.length ? mid(legs.map(c => pD(c.donor[0]))) : null;

  const donorSequences = (D.Sequences || []).filter(s => s.Interval);
  const writes = new Map();
  const queue = (node, property, interval, frames, values) => {
    if (!writes.has(node)) writes.set(node, {});
    (writes.get(node)[property] ||= []).push({ interval, frames, values });
  };
  let moments = 0;
  M.Sequences.forEach((sequence, index) => {
    const [a, z] = sequence.Interval || [];
    const donorIndex = D.Sequences.indexOf(donorSequences[index]);
    if (!(z > a) || donorIndex < 0) return;
    const { weaponEngine, shiftBody, roots, moving, watched } = configure(pickFor(sequence.Name));
    if (!moving.length) return;
    const [da, dz] = D.Sequences[donorIndex].Interval;
    const donorFrame = f => da + (f - a) * (dz - da) / (z - a);
    const frames = momentFrames(M, watched, a, z);
    const rotations = new Map(moving.flatMap(c => c.ids.map(id => [id, []]))), shifts = [];
    const bends = new Map(); // chain -> last bend direction (keeps a straight limb from flipping its knee)
    // An empty donor hand flaps (a walk swings it loosely); a weapon this model holds in it flapped with it. With the weapon
    // on engine 2 the wrist holds its average turn of this animation instead.
    let steadyWrist = null;
    const hand = weaponArm?.ids.at(-1), handParent = hand != null ? byM.get(hand)?.Parent : null;
    if (weaponArm && weaponEngine === 2 && weaponArm.ownLine && !weaponArm.donorLine && handParent === weaponArm.ids.at(-2)) {
      const sum = new Quaternion(0, 0, 0, 0);
      let first = null;
      for (const f of frames) {
        const W = sampleNodeMatrices(M, f, index), local = rotationOf(W.get(handParent)).invert().multiply(rotationOf(W.get(hand)));
        first ||= local.clone();
        if (local.dot(first) < 0) local.set(-local.x, -local.y, -local.z, -local.w);
        sum.set(sum.x + local.x, sum.y + local.y, sum.z + local.z, sum.w + local.w);
      }
      if (sum.lengthSq() > 1e-12) steadyWrist = sum.normalize();
    }
    for (const f of frames) {
      const WD = sampleNodeMatrices(D, donorFrame(f), donorIndex), WM = sampleNodeMatrices(M, f, index);
      const posD = id => pD(id).applyMatrix4(WD.get(id)), posM = id => pM(id).applyMatrix4(WM.get(id));
      let delta = new Vector3(), hipD = null, hipM = null, heading = new Quaternion();
      if (legs.length) {
        hipD = mid(legs.map(c => posD(c.donor[0])));
        const nowM = mid(legs.map(c => posM(c.ids[0])));
        hipM = shiftBody ? new Vector3(restHipM.x + legRatio * (hipD.x - restHipD.x), restHipM.y + legRatio * (hipD.y - restHipD.y), groundM + legRatio * (hipD.z - groundD)) : nowM;
        delta = hipM.clone().sub(nowM);
        const hipsJoint = byD.get(legs[0].donor[0])?.Parent;
        const forward = new Vector3(1, 0, 0).applyQuaternion(hipsJoint != null && WD.get(hipsJoint) ? rotationOf(WD.get(hipsJoint)) : new Quaternion());
        heading = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.atan2(forward.y, forward.x));
      }
      shifts.push(delta);
      // Shoulder centres per group of arms hanging from one joint (a rider's arms and its mount's forelimbs are two groups).
      const shoulders = new Map();
      for (const chain of arms) {
        const group = shoulders.get(chain.group) || shoulders.set(chain.group, { d: [], m: [], ratios: [] }).get(chain.group);
        group.d.push(posD(chain.donor[0])); group.m.push(posM(chain.ids[0]).add(delta)); group.ratios.push(chain.ratio);
      }
      const scaleOf = chain => { const r = shoulders.get(chain.group).ratios; return r.reduce((x, y) => x + y, 0) / r.length; };
      const handTarget = chain => { const group = shoulders.get(chain.group); return mid(group.m).add(posD(chain.donor.at(-1)).sub(mid(group.d)).multiplyScalar(scaleOf(chain))); };
      // The weapon hand's spot: engine 1's (moved with the body) or the donor's scaled.
      const weaponSpot = weaponArm ? (weaponArm.engine === 2 ? handTarget(weaponArm) : posM(weaponArm.ids.at(-1)).add(delta)) : null;
      const world = new Map();
      for (const chain of moving) {
        const { ids, donor } = chain, n = ids.length - 1;
        const P = ids.map(id => posM(id)), Q = ids.map(id => rotationOf(WM.get(id)));
        const off = ids.slice(0, n).map((_, k) => P[k + 1].clone().sub(P[k]).applyQuaternion(Q[k].clone().invert()));
        const turn = Q.map(q => q.clone()), at = [P[0].clone().add(delta)];
        for (let k = 0; k < n; k++) {
          if (chain.engine === 2) turn[k] = Q[k].clone().multiply(chain.rest[k]);
          at.push(at[k].clone().add(off[k].clone().applyQuaternion(turn[k])));
        }
        let target = null;
        if (chain.kind === 'leg' && hipD) {
          const local = posD(donor[n]).sub(hipD).applyQuaternion(heading.clone().invert());
          const sign = chain.side === 'L' ? 1 : chain.side === 'R' ? -1 : 0;
          local.set(local.x * legRatio, sign * halfOut + legRatio * (local.y - sign * halfD), local.z * legRatio);
          target = hipM.clone().add(local.applyQuaternion(heading));
        } else if (chain.kind === 'arm') {
          // Only the main pair of arms reaches for spots; a second pair (a mount's forelimbs) keeps its bone directions.
          target = chain.engine !== 2 || !/^arm[LR]?$/.test(chain.key) && chain !== weaponArm ? null : chain === weaponArm ? weaponSpot.clone() : handTarget(chain);
          // A second hand on the weapon: from the weapon hand's spot, as far as the donor's two hands are apart (scaled),
          // blended in as the donor's hands come together so the grip never snaps on or off.
          if (target && weaponArm && chain !== weaponArm && chain.group === weaponArm.group) {
            const apart = posD(donor[n]).sub(posD(weaponArm.donor.at(-1))), share = clamp01((0.45 * chain.lenD - apart.length()) / (0.2 * chain.lenD));
            if (share > 0) target.lerp(weaponSpot.clone().add(apart.multiplyScalar(scaleOf(chain))), share);
          }
        }
        if (target && n >= 2) {
          const r = n - 2;
          const lengths = [off[r].length(), off[r + 1].length()], outer = lengths[0] + lengths[1];
          // Ease off before full stretch: the knee or elbow never snaps straight.
          const reach = target.clone().sub(at[r]), distance = reach.length(), knee = 0.9 * outer, soft = 0.08 * outer;
          if (distance > knee && distance > 1e-9) target = at[r].clone().add(reach.multiplyScalar((knee + soft * (1 - Math.exp(-(distance - knee) / soft))) / distance));
          const dRoot = posD(donor[r]), dEnd = posD(donor[r + 2]), dMid = posD(donor[r + 1]), line = dEnd.clone().sub(dRoot).normalize();
          const bend = dMid.clone().sub(dRoot); bend.addScaledVector(line, -bend.dot(line));
          const strong = clamp01((bend.length() / Math.max(1e-9, dRoot.distanceTo(dMid)) - 0.02) / 0.08);
          const last = bends.get(chain);
          const direction = bend.lengthSq() > 1e-18 ? bend.normalize() : last ?? null;
          // The bend direction turns at most a little per moment, less while the donor's limb is nearly straight (its bend
          // direction is unreliable then); a reversal through straight never flips the knee or elbow to the other side.
          let steady = direction ?? last;
          if (direction && last) {
            const angle = last.angleTo(direction), limit = (5 + 25 * strong) * Math.PI / 180;
            steady = angle <= limit ? direction.clone() : last.clone().applyQuaternion(new Quaternion().setFromAxisAngle(new Vector3().crossVectors(last, direction).lengthSq() > 1e-12 ? new Vector3().crossVectors(last, direction).normalize() : new Vector3(0, 0, 1), limit));
          }
          if (steady) bends.set(chain, steady.clone());
          const pose = { root: at[r], middle: at[r + 1], end: at[r + 2], lengths, tolerance: 1e-4 * outer, rotations: [turn[r], turn[r + 1], turn[r + 2]] };
          if (Math.min(...lengths) < 0.15 * Math.max(...lengths)) {
            // One of the two bones is nearly nothing (a hand joint fitted onto its forearm): a bend there is unsteady, so the
            // whole limb swings from its root toward the spot instead.
            const swing = arc(at[r + 2].clone().sub(at[r]), target.clone().sub(at[r]));
            turn[r] = swing.clone().multiply(turn[r]); turn[r + 1] = swing.clone().multiply(turn[r + 1]);
          } else try {
            const solved = solveTwoBone(pose, target, steady ? at[r].clone().add(steady) : null, steady);
            turn[r] = arc(at[r + 1].clone().sub(at[r]), solved.middle.clone().sub(at[r])).multiply(turn[r]);
            turn[r + 1] = arc(off[r + 1].clone().applyQuaternion(turn[r + 1]), solved.end.clone().sub(solved.middle)).multiply(turn[r + 1]);
          } catch { /* a degenerate limb keeps its directions */ }
        } else if (target && n === 1) {
          turn[0] = arc(off[0].clone().applyQuaternion(turn[0]), target.clone().sub(at[0])).multiply(turn[0]);
        }
        turn[n] = Q[n];
        // Weapon on engine 2, alike grips: the hand turns by the fixed grip turn, so the weapon points the way the donor's does.
        if (chain === weaponArm && weaponEngine === 2 && chain.grip) {
          turn[n] = Q[n].clone().multiply(chain.grip);
        } else if (chain === weaponArm && steadyWrist) turn[n] = turn[n - 1].clone().multiply(steadyWrist);
        ids.forEach((id, k) => world.set(id, turn[k]));
      }
      const newWorld = id => {
        if (world.has(id)) return world.get(id);
        const parent = byM.get(id)?.Parent;
        if (parent == null || parent < 0 || !byM.has(parent)) return rotationOf(WM.get(id));
        return newWorld(parent).clone().multiply(rotationOf(WM.get(parent)).invert().multiply(rotationOf(WM.get(id))));
      };
      for (const [id, list] of rotations) {
        const parent = byM.get(id).Parent;
        const parentTurn = parent == null || parent < 0 || !byM.has(parent) ? new Quaternion() : newWorld(parent);
        const local = parentTurn.clone().invert().multiply(world.get(id)).normalize();
        const last = list[list.length - 1];
        if (last && local.dot(last) < 0) local.set(-local.x, -local.y, -local.z, -local.w);
        list.push(local);
      }
      moments++;
    }
    for (const [id, list] of rotations) queue(byM.get(id), 'Rotation', [a, z], frames, list.map(q => q.toArray()));
    for (const node of roots) {
      const values = frames.map((f, k) => v3(sampleTrack(node.Translation, f, { interval: [a, z], globalSequences: M.GlobalSequences, fallback: [0, 0, 0] })).add(shifts[k]).toArray());
      queue(node, 'Translation', [a, z], frames, values);
    }
  });
  for (const [node, props] of writes) for (const [property, list] of Object.entries(props)) writeKeys(M, node, property, list);
  return { ...report, legRatio, armRatio, moments };
}

/** The moments to key in [a, z]: every 1/30 s, both ends, and every key frame of the given nodes there. */
function momentFrames(M, ids, a, z) {
  const set = new Set([a, z]);
  for (let f = a + STEP; f < z; f += STEP) set.add(Math.round(f));
  for (const id of ids) {
    const node = M.Nodes[id];
    for (const property of ['Rotation', 'Translation', 'Scaling']) for (const key of node?.[property]?.Keys || []) if (key.Frame > a && key.Frame < z) set.add(key.Frame);
  }
  return [...set].sort((x, y) => x - y);
}

/** Replace a track's keys inside each listed interval by the given ones; keys of every other animation stay exactly as they
 * are. A curved track stays curved: the new keys get tangents that move in straight steps between them (a rotation's
 * tangents are its own value; a position's are the steps to its neighbours). A stepped track becomes linear, each of its
 * other keys held until one millisecond before the next. A missing track becomes linear, with a key holding the rest value
 * at the start of every other animation. */
function writeKeys(M, node, property, list) {
  const fallback = property === 'Rotation' ? [0, 0, 0, 1] : [0, 0, 0];
  const old = node[property]?.Keys ? node[property] : null;
  const inside = (f, [a, z]) => f >= a && f <= z;
  const ours = sequence => list.some(item => item.interval[0] === sequence.Interval[0] && item.interval[1] === sequence.Interval[1]);
  const type = old && (old.LineType === 2 || old.LineType === 3) ? old.LineType : 1;
  const copy = k => ({ ...k, Vector: new Float32Array(k.Vector), ...(k.InTan ? { InTan: new Float32Array(k.InTan) } : {}), ...(k.OutTan ? { OutTan: new Float32Array(k.OutTan) } : {}) });
  let keys = [];
  if (old && old.LineType !== 0) keys = old.Keys.filter(k => !list.some(item => inside(k.Frame, item.interval))).map(copy);
  else if (old) {
    for (const sequence of M.Sequences || []) {
      if (!sequence.Interval || ours(sequence)) continue;
      const [a, z] = sequence.Interval, inner = old.Keys.filter(k => inside(k.Frame, [a, z]));
      if (!inner.length) continue;
      const frames = new Set(inner.map(k => k.Frame));
      for (const k of inner) if (k.Frame - 1 > a && !frames.has(k.Frame - 1)) frames.add(k.Frame - 1); // a step held until the next key
      for (const f of [...frames].sort((x, y) => x - y)) keys.push({ Frame: f, Vector: new Float32Array(sampleTrack(old, f, { interval: [a, z], globalSequences: M.GlobalSequences, fallback, quaternion: property === 'Rotation' })) });
    }
  } else for (const sequence of M.Sequences || []) if (sequence.Interval && !ours(sequence)) keys.push({ Frame: sequence.Interval[0], Vector: new Float32Array(fallback) });
  for (const { frames, values } of list) frames.forEach((f, i) => {
    const key = { Frame: f, Vector: new Float32Array(values[i]) };
    if (type !== 1) {
      if (property === 'Rotation') { key.InTan = new Float32Array(values[i]); key.OutTan = new Float32Array(values[i]); }
      else {
        const before = values[i - 1] ?? values[i], after = values[i + 1] ?? values[i];
        const stepIn = values[i].map((v, c) => v - before[c]), stepOut = after.map((v, c) => v - values[i][c]);
        // Hermite takes the steps as tangents; Bezier takes control points a third of a step away.
        key.InTan = new Float32Array(type === 2 ? stepIn : values[i].map((v, c) => v - stepIn[c] / 3));
        key.OutTan = new Float32Array(type === 2 ? stepOut : values[i].map((v, c) => v + stepOut[c] / 3));
      }
    }
    keys.push(key);
  });
  keys = keys.sort((x, y) => x.Frame - y.Frame).filter((k, i, all) => i === 0 || all[i - 1].Frame !== k.Frame);
  if (type !== 1) for (const k of keys) { k.InTan ||= new Float32Array(k.Vector); k.OutTan ||= new Float32Array(k.Vector); }
  node[property] = { ...(old || {}), LineType: type, GlobalSeqId: old?.GlobalSeqId ?? null, Keys: keys };
}
