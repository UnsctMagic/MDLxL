import { Vector3 } from 'three';
import { allNodes, nodePivot, sampleNodeMatrices } from './animation.js';
import { nodeIndex } from './node-hierarchy.js';

const median = values => {
  const sorted = values.filter(Number.isFinite).sort((a,b) => a-b);
  return sorted.length ? sorted[Math.floor(sorted.length/2)] : 0;
};
const saturation = value => Math.max(0, Math.min(1, value));

/** Recover relationships between independently authored actor assemblies.
 * Contact, elevation and relative native trajectories contribute together.
 * Names and animation labels are deliberately absent. Existing ancestry needs
 * no carrier; a proposed relation only supplies the existing POSE follower API.
 */
export function poseAssemblyEvidence(model, actors, { geometry, tree = nodeIndex(model) } = {}) {
  const followers = {}, carriers = {}, evidence = [];
  if (actors.length < 2) return { followers, carriers, evidence };
  const nodes = allNodes(model), { byId } = tree;
  const transforms = [...(model.Bones || []), ...(model.Helpers || [])];
  const point = id => new Vector3().fromArray(nodePivot(model, byId.get(id)));
  const actorIds = new Set(actors.map(actor => actor.body));
  const shape = actor => geometry?.subtree.get(actor.body);
  const extent = actor => Math.max(shape(actor)?.extent.length() || actor.span || 0, 1e-6);
  const positions = [new Map(nodes.map(node => [node.ObjectId, point(node.ObjectId)]))];
  // Equally sample each authored interval. The robust residual tolerates a
  // dismount/death clip without depending on any sequence's name or index.
  for (let sequence = 0; sequence < (model.Sequences || []).length; sequence++) {
    const interval = model.Sequences[sequence].Interval;
    if (!interval || !Number.isFinite(interval[0]) || !Number.isFinite(interval[1])) continue;
    for (const frame of [interval[0], (interval[0] + interval[1]) / 2]) {
      const matrices = sampleNodeMatrices(model, frame, sequence, frame);
      positions.push(new Map(nodes.map(node => [node.ObjectId, point(node.ObjectId).applyMatrix4(matrices.get(node.ObjectId))])));
    }
  }
  const relativeMotion = (a,b,scale) => {
    const offsets = positions.map(sample => sample.get(a).clone().sub(sample.get(b))).filter(offset => offset.toArray().every(Number.isFinite));
    const center = new Vector3(...[0,1,2].map(axis => median(offsets.map(offset => offset.getComponent(axis)))));
    return median(offsets.map(offset => offset.distanceTo(center))) / Math.max(scale,1e-6);
  };
  const endpoint = chain => chain.ids?.at(-1) ?? chain.end;
  const lower = actor => {
    const feet = actor.limbs.filter(chain => chain.kind === 'leg').map(endpoint).filter(id => byId.has(id));
    if (feet.length) return median(feet.map(id => point(id).z));
    return shape(actor)?.min?.z ?? point(actor.body).z;
  };
  const proposals = [];
  for (const rider of actors) for (const host of actors) {
    if (host === rider || tree.isAncestor(rider.body,host.body) || tree.isAncestor(host.body,rider.body)) continue;
    const riderSize = extent(rider), hostSize = extent(host), seat = point(rider.body);
    const hostShape = shape(host), reference = hostShape?.center || point(host.body);
    const elevation = saturation((lower(rider)-lower(host)) / Math.max(riderSize*.25,1e-6));
    const overlap = hostShape?.min ? Math.exp(-seat.distanceTo(seat.clone().clamp(hostShape.min,hostShape.max)) / Math.max(riderSize*.25,1e-6)) : Math.exp(-seat.distanceTo(reference)/hostSize);
    const scaleEvidence = hostSize/(hostSize+riderSize);
    // A duplicated, coincident native driver above a second body represents an
    // authored shared carrier, while each body keeps its own local controls.
    for (const ancestor of tree.ancestors(rider.body)) {
      if (actorIds.has(ancestor) || tree.root(ancestor) === tree.root(host.body)) continue;
      const distance = point(ancestor).distanceTo(point(host.body));
      const tolerance = Math.max(hostSize,riderSize)*1e-7;
      if (distance > tolerance || point(ancestor).distanceTo(seat) <= tolerance) continue;
      const residual = relativeMotion(ancestor,host.body,Math.max(hostSize,riderSize));
      const score = .45*Math.exp(-residual*8)+.25*elevation+.2*overlap+.1*scaleEvidence;
      proposals.push({rider:rider.body,host:host.body,driver:ancestor,anchor:host.body,score,kind:'coincident-driver',elevation,overlap,residual});
    }
    for (const anchor of transforms) {
      if (!tree.isAncestor(anchor.ObjectId,host.body)) continue;
      const distance = seat.distanceTo(point(anchor.ObjectId));
      const contact = Math.exp(-distance / Math.max(riderSize*.15,1e-6));
      const residual = relativeMotion(rider.body,anchor.ObjectId,riderSize);
      const coherence = Math.exp(-residual*4);
      const score = .45*contact+.2*elevation+.15*overlap+.15*coherence+.05*scaleEvidence;
      proposals.push({rider:rider.body,host:host.body,driver:rider.body,anchor:anchor.ObjectId,score,kind:'contact',contact,elevation,overlap,residual});
    }
  }
  // Compare the best carrier with the independent-assembly hypothesis. This
  // confidence boundary combines all observations, not a name/shape veto.
  const assigned = new Set();
  proposals.sort((a,b) => b.score-a.score || point(a.anchor).distanceTo(point(a.rider))-point(b.anchor).distanceTo(point(b.rider)));
  for (const candidate of proposals) {
    if (assigned.has(candidate.rider)) continue;
    evidence.push(candidate);
    if (candidate.score <= .72) continue;
    // Relationships always point to an assembly that has not been carried by
    // this rider; composing followers cannot create a new cycle.
    const reaches = (at,target,seen=new Set()) => {
      if (at === target) return true;
      if (seen.has(at)) return false; seen.add(at);
      const anchor = carriers[at];
      return anchor != null && actors.some(actor => tree.isAncestor(anchor,actor.body) && reaches(actor.body,target,seen));
    };
    if (reaches(candidate.host,candidate.rider)) continue;
    if (candidate.kind === 'coincident-driver') {
      (followers[candidate.host] ||= []).push(candidate.driver);
    } else carriers[candidate.driver] = candidate.anchor;
    assigned.add(candidate.rider);
  }
  return { followers, carriers, evidence };
}
