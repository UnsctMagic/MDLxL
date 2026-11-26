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
//    The weapon region decides where the weapon hand goes: engine 1's spot, or the donor's spot scaled (engine 2).
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
  const pick = { ...suggested };
  for (const key of ENGINE_REGIONS) if (regions?.[key] === 1 || regions?.[key] === 2) pick[key] = regions[key];
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
    chains.push({ key: theirs.key, kind: theirs.limbKind, side: theirs.side, donor, ids, ratio: lenM / lenD, lenD, weapon: !!theirs.weapon || !!rigA.parts?.[theirs.key]?.weapon });
  }
  const legs = chains.filter(c => c.kind === 'leg'), arms = chains.filter(c => c.kind === 'arm');
  const both = (a, b) => pick[a] === 2 && pick[b] === 2 ? 2 : 1;
  const regionOf = chain => {
    if (chain.kind === 'leg') return chain.side === 'L' || chain.side === 'R' ? pick['leg' + chain.side] ?? 1 : both('legL', 'legR');
    if (chain.kind === 'arm' || chain.kind === 'wing') return chain.side === 'L' || chain.side === 'R' ? pick['arm' + chain.side] ?? 1 : both('armL', 'armR');
    return both('legL', 'legR'); // a tail goes with the lower body
  };
  for (const chain of chains) { chain.engine = regionOf(chain); chain.group = byD.get(chain.donor[0])?.Parent ?? -1; }
  // The weapon arm: the main pair's first (a mount's forelimb read as a second pair of arms can carry a weapon reading too).
  const weaponArm = arms.find(c => c.weapon && /^arm[LR]?$/.test(c.key)) ?? arms.find(c => c.weapon) ?? null, weaponEngine = pick.weapon ?? weaponArm?.engine ?? 1;
  for (const chain of chains) chain.moves = chain.engine === 2 || (chain === weaponArm && weaponEngine === 2);
  const shiftBody = legs.length > 0 && legs.every(c => c.engine === 2);
  const report = { chains: chains.length, regions: pick, suggested };
  if (!chains.some(c => c.moves)) return report;
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
  const roots = shiftBody ? [...(M.Bones || []), ...(M.Helpers || [])].filter(n => (n.Parent == null || n.Parent < 0) && !(n.Translation?.Keys?.length && isGlobalTrack(n.Translation, M))) : [];
  const moving = chains.filter(c => c.moves);
  // Key moments: the limbs' and every joint above them.
  const watched = new Set(roots.map(n => n.ObjectId));
  for (const chain of moving) for (const id of chain.ids) for (let at = id; at != null && at >= 0 && byM.has(at) && !watched.has(at); at = byM.get(at).Parent) watched.add(at);

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
    const [da, dz] = D.Sequences[donorIndex].Interval;
    const donorFrame = f => da + (f - a) * (dz - da) / (z - a);
    const frames = momentFrames(M, watched, a, z);
    const rotations = new Map(moving.flatMap(c => c.ids.map(id => [id, []]))), shifts = [];
    const bends = new Map(); // chain -> last bend direction (keeps a straight limb from flipping its knee)
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
      const weaponSpot = weaponArm ? (weaponEngine === 2 ? handTarget(weaponArm) : posM(weaponArm.ids.at(-1)).add(delta)) : null;
      const world = new Map();
      for (const chain of moving) {
        const { ids, donor } = chain, n = ids.length - 1;
        const P = ids.map(id => posM(id)), Q = ids.map(id => rotationOf(WM.get(id)));
        const off = ids.slice(0, n).map((_, k) => P[k + 1].clone().sub(P[k]).applyQuaternion(Q[k].clone().invert()));
        const turn = Q.map(q => q.clone()), at = [P[0].clone().add(delta)];
        for (let k = 0; k < n; k++) {
          if (chain.engine === 2) turn[k] = arc(off[k].clone().applyQuaternion(Q[k]), posD(donor[k + 1]).sub(posD(donor[k]))).multiply(Q[k]);
          at.push(at[k].clone().add(off[k].clone().applyQuaternion(turn[k])));
        }
        let target = null;
        if (chain.kind === 'leg' && hipD) {
          const local = posD(donor[n]).sub(hipD).applyQuaternion(heading.clone().invert());
          const sign = chain.side === 'L' ? 1 : chain.side === 'R' ? -1 : 0;
          local.set(local.x * legRatio, sign * halfOut + legRatio * (local.y - sign * halfD), local.z * legRatio);
          target = hipM.clone().add(local.applyQuaternion(heading));
        } else if (chain.kind === 'arm') {
          target = chain === weaponArm ? weaponSpot.clone() : handTarget(chain);
          // A second hand on the weapon: from the weapon hand's spot, as far as the donor's two hands are apart (scaled),
          // blended in as the donor's hands come together so the grip never snaps on or off.
          if (weaponArm && chain !== weaponArm && chain.group === weaponArm.group) {
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
          const steady = direction && last ? last.clone().lerp(direction, strong).normalize() : direction ?? last;
          if (steady) bends.set(chain, steady.clone());
          const pose = { root: at[r], middle: at[r + 1], end: at[r + 2], lengths, tolerance: 1e-4 * outer, rotations: [turn[r], turn[r + 1], turn[r + 2]] };
          if (Math.min(...lengths) < 0.15 * Math.max(...lengths)) {
            // One of the two bones is nearly nothing (a hand joint fitted onto its forearm): a bend there is unsteady, so the
            // whole limb swings from its root toward the spot instead.
            const swing = arc(at[r + 2].clone().sub(at[r]), target.clone().sub(at[r]));
            turn[r] = swing.clone().multiply(turn[r]); turn[r + 1] = swing.clone().multiply(turn[r + 1]);
          } else try {
            const solved = solveTwoBone(pose, target, steady ? at[r].clone().add(steady) : null);
            turn[r] = arc(at[r + 1].clone().sub(at[r]), solved.middle.clone().sub(at[r])).multiply(turn[r]);
            turn[r + 1] = arc(off[r + 1].clone().applyQuaternion(turn[r + 1]), solved.end.clone().sub(solved.middle)).multiply(turn[r + 1]);
          } catch { /* a degenerate limb keeps its directions */ }
        } else if (target && n === 1) {
          turn[0] = arc(off[0].clone().applyQuaternion(turn[0]), target.clone().sub(at[0])).multiply(turn[0]);
        }
        turn[n] = Q[n];
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

/** Replace a track's keys inside each listed interval by the given ones. The track becomes linear: a curved or stepped
 * track's other animations are sampled every 1/30 s (and at their keys) so they move as before; a missing track gets a
 * key holding the old value at the start of every other animation. */
function writeKeys(M, node, property, list) {
  const fallback = property === 'Rotation' ? [0, 0, 0, 1] : [0, 0, 0];
  const old = node[property]?.Keys ? node[property] : null;
  const inside = (f, [a, z]) => f >= a && f <= z;
  const ours = sequence => list.some(item => item.interval[0] === sequence.Interval[0] && item.interval[1] === sequence.Interval[1]);
  let keys = [];
  if (old && old.LineType === 1) keys = old.Keys.filter(k => !list.some(item => inside(k.Frame, item.interval))).map(k => ({ Frame: k.Frame, Vector: new Float32Array(k.Vector) }));
  else if (old) {
    for (const sequence of M.Sequences || []) {
      if (!sequence.Interval || ours(sequence)) continue;
      const [a, z] = sequence.Interval;
      const frames = new Set(old.Keys.filter(k => inside(k.Frame, [a, z])).map(k => k.Frame));
      if (!frames.size) continue;
      frames.add(a); frames.add(z);
      if (old.LineType !== 0) for (let f = a + STEP; f < z; f += STEP) frames.add(Math.round(f));
      else for (const k of old.Keys) if (k.Frame > a && k.Frame <= z && k.Frame - 1 > a) frames.add(k.Frame - 1); // a step held until the next key
      for (const f of [...frames].sort((x, y) => x - y)) keys.push({ Frame: f, Vector: new Float32Array(sampleTrack(old, f, { interval: [a, z], globalSequences: M.GlobalSequences, fallback, quaternion: property === 'Rotation' })) });
    }
  } else for (const sequence of M.Sequences || []) if (sequence.Interval && !ours(sequence)) keys.push({ Frame: sequence.Interval[0], Vector: new Float32Array(fallback) });
  for (const { frames, values } of list) frames.forEach((f, i) => keys.push({ Frame: f, Vector: new Float32Array(values[i]) }));
  keys = keys.sort((x, y) => x.Frame - y.Frame).filter((k, i, all) => i === 0 || all[i - 1].Frame !== k.Frame);
  node[property] = { LineType: 1, GlobalSeqId: old?.GlobalSeqId ?? null, Keys: keys };
}
