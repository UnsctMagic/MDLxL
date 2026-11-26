// XFER engine 2 (docs/agent-tasks/xfer-engine2.md): poses instead of joint turns.
// Engine 1 copies each donor joint's local turn onto this model's fitted skeleton, which reproduces the donor's pose only
// when both bodies are built alike. Engine 2 runs after it, on its result, and re-poses the paired limbs every moment:
// 1. each limb bone points the way the donor's matching bone points (directions, read in model space, so in body space
//    too: the body joint turns as the donor's);
// 2. the limb end is aimed at the donor's spot scaled to this body: a foot from the hip centre (forward and up by the leg
//    length ratio, sideways by the larger of the hip width and leg length ratios, in the donor's heading), a hand from the shoulder centre (arm length
//    ratio); the knee or elbow bends in the donor's bend plane (two-bone solve, pose-ik.js);
// 3. the body stands as high above the ground as the donor's, times the leg length ratio, and travels by the same ratio,
//    so a planted donor foot stays planted;
// 4. a limb end (hand, foot) keeps engine 1's world turn, which is the donor's: what the hand holds keeps the donor's angle.
// Bone lengths never change (rotations only, plus the body's position), so the mesh keeps its shape.
import { Quaternion, Vector3 } from 'three';
import { allNodes, isGlobalTrack, nodePivot, sampleNodeMatrices, sampleTrack } from './animation.js';
import { solveTwoBone } from './pose-ik.js';

const v3 = value => new Vector3().fromArray(value);
const rotationOf = matrix => { const q = new Quaternion(); matrix.decompose(new Vector3(), q, new Vector3()); return q.normalize(); };
const arc = (from, to) => from.lengthSq() > 1e-12 && to.lengthSq() > 1e-12 ? new Quaternion().setFromUnitVectors(from.clone().normalize(), to.clone().normalize()) : new Quaternion();
const mid = points => points.reduce((sum, p) => sum.add(p), new Vector3()).divideScalar(Math.max(1, points.length));
const KINDS = new Set(['leg', 'arm', 'tail', 'wing']);
const STEP = 1000 / 30, GAP = 100;

/**
 * Re-pose the result `M` of engine 1. `D` is the donor as engine 1 read it (reflected when mirrored), `limbs` the paired
 * limbs ({own, theirs} rig parts: theirs holds donor joint ids), `donorMap` donor id -> result id, `rigA` / `rigB` the donor's
 * and this model's rigs. Changes M's rotation keys of the limb joints and the position keys of its parentless joints.
 * Returns a short report.
 */
export function engine2Pose(M, D, { limbs, donorMap, rigA, rigB }) {
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
    const lenM = ids.slice(1).reduce((s, id, i) => s + pM(id).distanceTo(pM(ids[i])), 0);
    const lenD = donor.slice(1).reduce((s, id, i) => s + pD(id).distanceTo(pD(donor[i])), 0);
    if (!(lenM > 1e-6 && lenD > 1e-6)) continue;
    chains.push({ key: theirs.key, kind: theirs.limbKind, side: theirs.side, donor, ids, ratio: lenM / lenD });
  }
  const legs = chains.filter(c => c.kind === 'leg'), arms = chains.filter(c => c.kind === 'arm');
  if (!chains.length) return { chains: 0 };
  const average = (list, fallback) => list.length ? list.reduce((s, c) => s + c.ratio, 0) / list.length : fallback;
  const sizeRatio = rigA.hipHeight > 0 ? rigB.hipHeight / rigA.hipHeight : 1;
  const legRatio = average(legs, sizeRatio), armRatio = average(arms, legRatio);
  // Hip width: the two outermost leg sockets of each side, at rest.
  const width = (list, pivot) => {
    const left = list.filter(c => c.side === 'L').map(c => pivot(c)), right = list.filter(c => c.side === 'R').map(c => pivot(c));
    return left.length && right.length ? mid(left).distanceTo(mid(right)) : 0;
  };
  const widthM = width(legs, c => pM(c.ids[0])), widthD = width(legs, c => pD(c.donor[0]));
  // Sideways never narrower than the leg ratio: a narrow-hipped body under a wide-hipped donor keeps the donor's stance
  // for its height (feet apart as a share of hip height), not the donor's stance shrunk to its hips.
  const widthRatio = Math.max(legRatio, widthM > 1e-6 && widthD > 1e-6 ? widthM / widthD : legRatio);
  const groundM = rigB.ground, groundD = rigA.ground;
  const restHipM = legs.length ? mid(legs.map(c => pM(c.ids[0]))) : null, restHipD = legs.length ? mid(legs.map(c => pD(c.donor[0]))) : null;
  // The body moves as a whole: every parentless joint (the body joint and loose donor joints) by the same amount.
  const roots = [...(M.Bones || []), ...(M.Helpers || [])].filter(n => (n.Parent == null || n.Parent < 0) && !(n.Translation?.Keys?.length && isGlobalTrack(n.Translation, M)));
  const chainOf = new Map(chains.flatMap(c => c.ids.map((id, k) => [id, { chain: c, k }])));

  const donorSequences = (D.Sequences || []).filter(s => s.Interval);
  const writes = new Map(); // node -> property -> [{interval, frames, values}]
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
    const frames = momentFrames(M, [...chainOf.keys(), ...roots.map(n => n.ObjectId)], a, z);
    const rotations = new Map(chains.flatMap(c => c.ids.map(id => [id, []]))), shifts = roots.map(() => []);
    for (const f of frames) {
      const WD = sampleNodeMatrices(D, donorFrame(f), donorIndex), WM = sampleNodeMatrices(M, f, index);
      const posD = id => pD(id).applyMatrix4(WD.get(id)), posM = id => pM(id).applyMatrix4(WM.get(id));
      // The body: hip centre as high as the donor's above the ground, travelling by the leg ratio.
      let delta = new Vector3(), hipD = null, hipM = null, heading = new Quaternion();
      if (legs.length) {
        hipD = mid(legs.map(c => posD(c.donor[0])));
        const nowM = mid(legs.map(c => posM(c.ids[0])));
        hipM = new Vector3(restHipM.x + legRatio * (hipD.x - restHipD.x), restHipM.y + legRatio * (hipD.y - restHipD.y), groundM + legRatio * (hipD.z - groundD));
        delta = hipM.clone().sub(nowM);
        const hipsJoint = byD.get(legs[0].donor[0])?.Parent;
        const forward = new Vector3(1, 0, 0).applyQuaternion(hipsJoint != null && WD.get(hipsJoint) ? rotationOf(WD.get(hipsJoint)) : new Quaternion());
        heading = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.atan2(forward.y, forward.x));
      }
      roots.forEach((n, i) => shifts[i].push(delta));
      const shoulderD = arms.length ? mid(arms.map(c => posD(c.donor[0]))) : null, shoulderM = arms.length ? mid(arms.map(c => posM(c.ids[0]).add(delta))) : null;
      const world = new Map(); // result id -> new world turn
      for (const chain of chains) {
        const { ids, donor } = chain, n = ids.length - 1;
        const P = ids.map(id => posM(id)), Q = ids.map(id => rotationOf(WM.get(id)));
        // Each bone's offset in its joint's frame (through any joints between two chain joints).
        const off = ids.slice(0, n).map((_, k) => P[k + 1].clone().sub(P[k]).applyQuaternion(Q[k].clone().invert()));
        const turn = Q.map(q => q.clone()), at = [P[0].clone().add(delta)];
        for (let k = 0; k < n; k++) {
          const want = posD(donor[k + 1]).sub(posD(donor[k]));
          turn[k] = arc(off[k].clone().applyQuaternion(Q[k]), want).multiply(Q[k]);
          at.push(at[k].clone().add(off[k].clone().applyQuaternion(turn[k])));
        }
        // The end on the donor's spot, scaled to this body.
        let target = null;
        if (chain.kind === 'leg' && hipD) {
          const local = posD(donor[n]).sub(hipD).applyQuaternion(heading.clone().invert());
          local.set(local.x * legRatio, local.y * widthRatio, local.z * legRatio);
          target = hipM.clone().add(local.applyQuaternion(heading));
        } else if (chain.kind === 'arm' && shoulderD) target = shoulderM.clone().add(posD(donor[n]).sub(shoulderD).multiplyScalar(armRatio));
        if (target && n >= 2) {
          const r = n - 2; // the last three joints bend
          const lengths = [off[r].length(), off[r + 1].length()];
          const pose = { root: at[r], middle: at[r + 1], end: at[r + 2], lengths, tolerance: 1e-4 * (lengths[0] + lengths[1]), rotations: [turn[r], turn[r + 1], turn[r + 2]] };
          const dRoot = posD(donor[r]), dEnd = posD(donor[r + 2]), dMid = posD(donor[r + 1]), line = dEnd.clone().sub(dRoot).normalize();
          const bend = dMid.clone().sub(dRoot); bend.addScaledVector(line, -bend.dot(line));
          const pole = bend.length() > 0.02 * dRoot.distanceTo(dMid) ? at[r].clone().add(bend) : null;
          try {
            const solved = solveTwoBone(pose, target, pole);
            turn[r] = arc(at[r + 1].clone().sub(at[r]), solved.middle.clone().sub(at[r])).multiply(turn[r]);
            turn[r + 1] = arc(off[r + 1].clone().applyQuaternion(turn[r + 1]), solved.end.clone().sub(solved.middle)).multiply(turn[r + 1]);
          } catch { /* a degenerate limb keeps its directions */ }
        } else if (target && n === 1) {
          turn[0] = arc(off[0].clone().applyQuaternion(turn[0]), target.clone().sub(at[0])).multiply(turn[0]);
        }
        turn[n] = Q[n]; // the end keeps the donor's turn
        ids.forEach((id, k) => world.set(id, turn[k]));
      }
      // World turns to local ones: a chain joint's parent turn is the new one when the parent moved with a chain.
      const newWorld = id => {
        if (world.has(id)) return world.get(id);
        const node = byM.get(id), parent = node?.Parent;
        if (parent == null || parent < 0 || !byM.has(parent)) return rotationOf(WM.get(id));
        const before = rotationOf(WM.get(parent));
        const local = before.clone().invert().multiply(rotationOf(WM.get(id)));
        return newWorld(parent).clone().multiply(local);
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
    roots.forEach((node, i) => {
      if (!legs.length) return;
      const values = frames.map((f, k) => v3(sampleTrack(node.Translation, f, { interval: [a, z], globalSequences: M.GlobalSequences, fallback: [0, 0, 0] })).add(shifts[i][k]).toArray());
      queue(node, 'Translation', [a, z], frames, values);
    });
  });
  for (const [node, props] of writes) for (const [property, list] of Object.entries(props)) writeKeys(M, node, property, list);
  return { chains: chains.length, legRatio, widthRatio, armRatio, moments };
}

/** The moments to key in [a, z]: every key frame of the given nodes there, both ends, and more where two are over GAP ms apart. */
function momentFrames(M, ids, a, z) {
  const set = new Set([a, z]);
  for (const id of ids) {
    const node = M.Nodes[id];
    for (const property of ['Rotation', 'Translation']) for (const key of node?.[property]?.Keys || []) if (key.Frame > a && key.Frame < z) set.add(key.Frame);
  }
  const sorted = [...set].sort((x, y) => x - y), out = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i] - sorted[i - 1];
    if (gap > GAP) { const parts = Math.ceil(gap / STEP); for (let k = 1; k < parts; k++) out.push(Math.round(sorted[i - 1] + gap * k / parts)); }
    out.push(sorted[i]);
  }
  return [...new Set(out)].sort((x, y) => x - y);
}

/** Replace a track's keys inside each listed interval by the given ones (keeping keys elsewhere); a missing track is made
 * linear, with a key holding the old value at the start of every other animation so those stay as they were. */
function writeKeys(M, node, property, list) {
  const fallback = property === 'Rotation' ? [0, 0, 0, 1] : [0, 0, 0];
  const old = node[property]?.Keys ? node[property] : null;
  const type = old ? (old.LineType === 0 ? 1 : old.LineType) : 1, curved = type === 2 || type === 3;
  const inside = (f, [a, z]) => f >= a && f <= z;
  let keys = old ? old.Keys.filter(k => !list.some(item => inside(k.Frame, item.interval))) : [];
  if (!old) for (const sequence of M.Sequences || []) {
    const iv = sequence.Interval;
    if (iv && !list.some(item => item.interval[0] === iv[0] && item.interval[1] === iv[1]) && !keys.some(k => k.Frame === iv[0])) keys.push({ Frame: iv[0], Vector: new Float32Array(fallback) });
  }
  if (old && old.LineType === 0) {
    // A stepped track turned linear: its other keys are held one millisecond before the next one.
    const sorted = [...keys].sort((x, y) => x.Frame - y.Frame), held = [];
    for (let i = 0; i + 1 < sorted.length; i++) if (sorted[i + 1].Frame - sorted[i].Frame > 1 && !list.some(item => inside(sorted[i + 1].Frame - 1, item.interval))) held.push({ Frame: sorted[i + 1].Frame - 1, Vector: new Float32Array(sorted[i].Vector) });
    keys.push(...held);
  }
  for (const { frames, values } of list) frames.forEach((f, i) => {
    const key = { Frame: f, Vector: new Float32Array(values[i]) };
    if (curved) { key.InTan = new Float32Array(values[i]); key.OutTan = new Float32Array(values[i]); }
    keys.push(key);
  });
  keys = keys.sort((x, y) => x.Frame - y.Frame).filter((k, i, all) => i === 0 || all[i - 1].Frame !== k.Frame);
  if (curved) for (const k of keys) { k.InTan ||= new Float32Array(k.Vector); k.OutTan ||= new Float32Array(k.Vector); }
  node[property] = { ...(old || {}), LineType: type, GlobalSeqId: old?.GlobalSeqId ?? null, Keys: keys };
}

