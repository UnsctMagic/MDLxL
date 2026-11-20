import { Quaternion, Vector3 } from 'three';
import { nodeIndex } from './node-hierarchy.js';
import { nodePivot, sampleNodeMatrices, skinGeoset } from './animation.js';
import { vertexBoneWeights } from './part-bones.js';
import { geosetAlphaTrack, geosetVisibleIn } from './geoset-extras.js';
import { standSequenceIndex } from './sequence-editor.js';

// A positional neck fit has no face direction for a one-joint skull. Measure
// its visible front and back in Stand, then put the same skin in the donor's
// head frame. Donor animation keys stay intact through every sequence.
export function fitHeadSkin(result, own, donor, ownRig, donorRig, resultHead) {
  const ownHead = ownRig.parts.head?.marker, donorHead = donorRig.parts.head?.marker;
  if (resultHead == null || ownHead == null || donorHead == null) return null;
  const ref = m => {
    const si = standSequenceIndex(m), seq = m.Sequences[si];
    return seq && {seq, matrices:sampleNodeMatrices(m,seq.Interval[0],si)};
  };
  const a = ref(donor), b = ref(own), r = ref(result);
  if (!a || !b || !r || !r.matrices.has(resultHead)) return null;
  const cranial = (m, rig, head, pose) => {
    const tree = nodeIndex(m), points = [], facing = new Vector3().fromArray(rig.facing);
    const descendants = new Set([...tree.byId.keys()].filter(id => tree.isAncestor(id,head)));
    for (const [gi,g] of m.Geosets.entries()) {
      if (!geosetVisibleIn(m,geosetAlphaTrack(m,gi),pose.seq)) continue;
      const vertices = skinGeoset(g,pose.matrices);
      for (let vi=0; vi<vertices.length/3; vi++) {
        const share = vertexBoneWeights(g,vi).reduce((n,[id,w]) => n+(descendants.has(id) ? w : 0),0);
        if (share > 0) {
          const p = new Vector3().fromArray(vertices,3*vi);
          points.push({gi,vi,share,p,forward:p.dot(facing)});
        }
      }
    }
    return points.sort((x,y) => x.forward-y.forward);
  };
  const body = cranial(own,ownRig,ownHead,b), target = cranial(donor,donorRig,donorHead,a);
  if (body.length < 8 || target.length < 8) return null;
  const direction = (points, position) => {
    const count = Math.ceil(points.length/5), axis = new Vector3();
    for (let i=0; i<count; i++) axis.add(position(points.at(-1-i))).sub(position(points[i]));
    return axis.divideScalar(count);
  };
  const posed = new Map();
  const actual = direction(body,({gi,vi}) => {
    if (!posed.has(gi)) posed.set(gi,skinGeoset(result.Geosets[gi],r.matrices));
    return new Vector3().fromArray(posed.get(gi),vi*3);
  });
  const desired = direction(target,p => p.p);
  const matrix = r.matrices.get(resultHead);
  if (Math.abs(matrix.determinant()) < 1e-9 || actual.lengthSq() < 1e-5 || desired.lengthSq() < 1e-5) return null;
  const inverse = matrix.clone().invert();
  const turn = new Quaternion().setFromUnitVectors(actual.transformDirection(inverse),desired.transformDirection(inverse));
  if (Math.abs(turn.w) > 1-1e-8) return null;
  const pivot = new Vector3().fromArray(nodePivot(result,result.Nodes[resultHead],resultHead));
  const tree = nodeIndex(result), under = new Set([...tree.byId.keys()].filter(id => tree.isAncestor(id,resultHead)));
  for (const g of result.Geosets) {
    for (let vi=0; vi<g.Vertices.length/3; vi++) {
      const share = vertexBoneWeights(g,vi).reduce((n,[id,w])=>n+(under.has(id)?w:0),0);
      if (!share) continue;
      const q = share >= 1-1e-6 ? turn : new Quaternion().slerp(turn,share);
      const p = new Vector3().fromArray(g.Vertices,vi*3).sub(pivot).applyQuaternion(q).add(pivot);
      g.Vertices.set(p.toArray(),vi*3);
      for (const [values,stride] of [[g.Normals,3],[g.Tangents,4]]) if (values?.length >= (vi+1)*stride)
        values.set(new Vector3().fromArray(values,vi*stride).applyQuaternion(q).toArray(),vi*stride);
    }
  }
  for (const id of under) {
    if (id === resultHead) continue;
    const n = result.Nodes[id], p = new Vector3().fromArray(nodePivot(result,n,id)).sub(pivot).applyQuaternion(turn).add(pivot);
    n.PivotPoint = new Float32Array(p.toArray());
    result.PivotPoints[id] = n.PivotPoint;
  }
  return 2*Math.acos(Math.min(1,Math.abs(turn.w)))*180/Math.PI;
}
