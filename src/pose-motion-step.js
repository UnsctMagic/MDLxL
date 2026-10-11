import { Vector3 } from 'three';
import { allNodes, sampleGeosetAnimation, skinGeoset } from './animation.js';
import { samplePoseChain } from './pose-ik.js';

const smooth = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const EPS = 1e-7;
const soleOffset = (points, orientation) => { let lowest = Infinity; for (const point of points) lowest = Math.min(lowest, point.clone().applyQuaternion(orientation).z); return -lowest; };

/** Step uses the editor's visible XY ground plane. The caller supplies the
 * already filtered actor chains; this helper never discovers another rig.
 * Knee bends infer sparse stride direction. Dense gaits retain their own
 * per-foot clearance phases, including creatures with opposing knee bends. */
export function preparePoseMotionStep({ model, chains, anchors, sequence, groundHeight = 0, preservePath = false }) {
  if (!Number.isFinite(groundHeight)) throw new Error('Ground height must be a finite number.');
  const legs = chains.filter(item => item.chain.kind === 'leg');
  if (legs.length < 2) return { available: false, reason: 'Step needs at least two mapped legs on the visible character.' };
  const forward = new Vector3(); let bendMagnitude = 0;
  for (const item of legs) for (const pose of item.poses.slice(0, -1)) {
    const axis = pose.end.clone().sub(pose.root).normalize();
    const bend = pose.middle.clone().sub(pose.root); bend.addScaledVector(axis, -bend.dot(axis)); bend.z = 0;
    if (bend.length() > pose.lengths.reduce((a, b) => a + b, 0) * .015) { forward.add(bend); bendMagnitude += bend.length(); }
  }
  let confidence = forward.length() / Math.max(bendMagnitude, EPS), directionSource = 'knee bends';
  const nodes = allNodes(model), byId = new Map(nodes.map(node => [node.ObjectId, node]));
  const prepared = [];
  for (const item of legs) {
    const end = item.chain.end, descendants = new Set([end]);
    for (const node of nodes) {
      let current = node, seen = new Set();
      while (current && !seen.has(current.ObjectId)) { seen.add(current.ObjectId); if (current.ObjectId === end) { descendants.add(node.ObjectId); break; } current = byId.get(current.Parent); }
    }
    const points = [], pose = item.poses[0], inverse = pose.rotations.at(-1).clone().invert();
    for (const [index, geo] of (model.Geosets || []).entries()) {
      if (sampleGeosetAnimation(model, index, anchors[0], sequence).alpha <= .05) continue;
      const posed = skinGeoset(geo, pose.matrices), count = geo.Vertices.length / 3;
      for (let vertex = 0; vertex < count; vertex++) {
        let weight = 0;
        if (geo.SkinWeights?.length === count * 8) { for (let slot = 0; slot < 4; slot++) if (descendants.has(geo.SkinWeights[vertex * 8 + slot])) weight += geo.SkinWeights[vertex * 8 + slot + 4] / 255; }
        else { const group = geo.Groups?.[geo.VertexGroup?.[vertex]] || []; weight = group.filter(id => descendants.has(id)).length / Math.max(1, group.length); }
        if (weight >= .5) points.push(new Vector3().fromArray(posed, vertex * 3).sub(pose.end).applyQuaternion(inverse));
      }
    }
    if (!points.length) return { available: false, reason: 'Step needs visible geometry on each mapped foot.' };
    prepared.push({ chain: item.chain, poses: item.poses, length: pose.lengths.reduce((a, b) => a + b, 0), points });
  }
  if (preservePath) {
    const supportDirection = new Vector3(); let magnitude = 0;
    for (const leg of prepared) {
      const samples = Array.from({ length: 33 }, (_, i) => samplePoseChain(model, leg.chain, anchors[0] + (anchors.at(-1) - anchors[0]) * i / 32, sequence));
      const heights = samples.map(pose => pose.end.z - soleOffset(leg.points, pose.rotations.at(-1))), low = Math.min(...heights), high = Math.max(...heights);
      leg.clearance = { low, high, span: high - low };
      for (let i = 1; i < samples.length - 1; i++) if (heights[i] <= low + Math.max(leg.length * .025, (high - low) * .18)) {
        const before = samples[i - 1], after = samples[i + 1];
        const direction = before.end.clone().sub(before.root).sub(after.end.clone().sub(after.root)); direction.z = 0;
        supportDirection.add(direction); magnitude += direction.length();
      }
    }
    const supportConfidence = supportDirection.length() / Math.max(magnitude, EPS);
    if (supportConfidence > .45) { forward.copy(supportDirection); confidence = supportConfidence; directionSource = 'low foot trajectories'; }
  }
  if (!preservePath && (forward.lengthSq() < EPS || confidence < .3)) return { available: false, reason: 'Step cannot infer a consistent stride direction from these poses.' };
  if (preservePath && !prepared.some(leg => leg.clearance.span > leg.length * .03)) return { available: false, reason: 'Step needs a visible lifting and supporting phase in this detailed walk.' };
  forward.normalize();
  if (preservePath) directionSource = 'authored foot clearance';
  for (const leg of prepared) leg.segments = leg.poses.slice(1).map((b, index) => {
    const a = leg.poses[index], travel = b.end.clone().sub(b.root).sub(a.end.clone().sub(a.root)).dot(forward);
    return { a, b, travel, moving: Math.abs(travel) > leg.length * .08, swing: travel > 0 };
  });
  if (!preservePath && !prepared.some(leg => leg.segments.some(segment => segment.moving))) return { available: false, reason: 'Step needs forward and backward stride poses.' };
  return { available: true, forward, confidence, directionSource, legs: prepared, groundHeight, preservePath, length: prepared.reduce((sum, leg) => sum + leg.length, 0) / prepared.length };
}

/** Amounts are 0..1. Feet/orientations and body displacement are world space.
 * Native IK applies these targets; this helper does not write keys. Dense mode
 * requires current sampled poses and keeps their detailed trajectories.
 * Exact anchors always return the original endpoints and zero body response. */
export function samplePoseMotionStep(prepared, { index, u, progress = u, timing = 0, follow = 0, body = 0, contacts = true, poses = null }) {
  if (!prepared.available) return { feet: [], displacement: new Vector3(), available: false, reason: prepared.reason };
  const anchor = u <= 0 || u >= 1, pulse = Math.sin(Math.PI * Math.max(0, Math.min(1, u))) ** 2;
  const feet = prepared.legs.map(leg => {
    const { a, b } = leg.segments[index];
    let { moving, swing } = leg.segments[index];
    const t = anchor ? Math.max(0, Math.min(1, u)) : swing ? u + (smooth(u) - u) * timing : progress;
    const current = !anchor && prepared.preservePath ? poses?.get(leg.chain.key) : null;
    if (!anchor && prepared.preservePath && !current) throw new Error('Step needs the current foot paths for this detailed animation.');
    const position = current ? current.end.clone() : a.end.clone().lerp(b.end, t);
    const orientation = current ? current.rotations.at(-1).clone() : a.rotations.at(-1).clone().slerp(b.rotations.at(-1), t);
    const offset = soleOffset(leg.points, orientation);
    let support = moving && !swing, supportWeight = support ? 1 : 0;
    if (!anchor && prepared.preservePath) {
      const height = position.z - offset - prepared.groundHeight;
      const lifted = smooth((position.z - offset - leg.clearance.low) / Math.max(leg.clearance.span * .5, leg.length * .05));
      const nearGround = 1 - smooth(Math.abs(height) / (leg.length * .12));
      moving = leg.clearance.span > leg.length * .03;
      swing = moving && lifted > .5;
      support = moving && lifted < .5 && nearGround > .05;
      supportWeight = moving ? nearGround * (1 - lifted) : 0;
      if (moving) position.z += leg.length * .055 * follow * pulse * lifted;
      if (contacts && moving) position.z -= height * smooth(u / .22) * smooth((1 - u) / .22) * nearGround * (1 - lifted);
    } else if (!anchor && moving) {
      if (swing) position.z += leg.length * .24 * follow * pulse;
      else if (contacts) {
        const height = position.z - offset - prepared.groundHeight;
        const planted = smooth(u / .22) * smooth((1 - u) / .22);
        position.z += (prepared.groundHeight + offset - position.z) * planted;
      }
    }
    return { chain: leg.chain, position, orientation: orientation.toArray(), swing: moving && swing, support, supportWeight, soleOffset: offset };
  });
  const supportWeight = Math.max(0, ...feet.map(foot => foot.supportWeight));
  const displacement = new Vector3(0, 0, anchor ? 0 : -prepared.length * (prepared.preservePath ? .035 : .055) * body * pulse * supportWeight);
  return { available: true, feet, displacement };
}
