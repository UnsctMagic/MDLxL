import { Matrix4, Vector3 } from 'three';
import { nodePivot, sampleNodeMatrices, skinGeoset } from '../../src/animation.js';
import { vertexBoneWeights } from '../../src/part-bones.js';
import { surfaceVisible } from './surface-review.mjs';

const identity = new Matrix4();

function handClouds(data) {
  const arms = Object.values(data.rig.parts).filter(part => part.limbKind === 'arm');
  if (arms.length !== 2 || data.stand < 0) return [];
  const frame = data.model.Sequences[data.stand].Interval[0];
  const matrices = sampleNodeMatrices(data.model, frame, data.stand);
  const props = new Set(data.props.flatMap(prop => prop.points.map(p => p.gi + '/' + p.vi)));
  const skin = new Map();
  return arms.map(arm => {
    const cloud = (data.pieces.get(arm.key) || []).filter(p => !props.has(p.gi + '/' + p.vi) && surfaceVisible(data.model, p.gi, frame, data.stand));
    const distal = cloud.reduce((last, p) => Math.max(last, p.ordinal), -1);
    const shoulderId = arm.joints[0];
    const shoulder = new Vector3().fromArray(nodePivot(data.model, data.nodes.get(shoulderId))).applyMatrix4(matrices.get(shoulderId) || identity);
    const points = cloud.filter(p => p.ordinal === distal).map(p => {
      if (!skin.has(p.gi)) skin.set(p.gi, skinGeoset(data.model.Geosets[p.gi], matrices));
      const position = new Vector3().fromArray(skin.get(p.gi), p.vi * 3);
      return { ...p, reach: position.distanceToSquared(shoulder) };
    }).sort((a, b) => b.reach - a.reach);
    // The terminal segment sometimes carries the whole forearm. Its far end
    // supplies a material landmark even when the rig has no separate hand.
    return points.slice(0, Math.ceil(points.length / 3));
  });
}

// The centroid of skinned points can be evaluated exactly from weighted
// coordinate sums per bone. Visibility is still evaluated per geoset and time.
function compileHand(model, points) {
  const groups = new Map();
  for (const {gi, vi} of points) {
    const geo = model.Geosets[gi];
    if (!geo || vi * 3 + 2 >= geo.Vertices.length) throw Error('Recipient hand vertex missing in transplant');
    if (!groups.has(gi)) groups.set(gi, { gi, count: 0, bones: new Map() });
    const group = groups.get(gi);
    const weights = vertexBoneWeights(geo, vi);
    if (!weights.length) continue;
    group.count++;
    for (const [id, w] of weights) {
      if (!group.bones.has(id)) group.bones.set(id, [0, 0, 0, 0]);
      const sum = group.bones.get(id);
      for (let k = 0; k < 3; k++) sum[k] += w * geo.Vertices[3 * vi + k];
      sum[3] += w;
    }
  }
  return [...groups.values()];
}

function reader(model, clouds, chestId, facing) {
  const chestNode = model.Nodes[chestId];
  const pivot = new Vector3().fromArray(nodePivot(model, chestNode));
  const lateral = new Vector3(-facing[1], facing[0], 0).normalize();
  const hands = clouds.map(cloud => compileHand(model, cloud));
  const chest = new Matrix4(), centroid = new Vector3();
  return (si, frame) => {
    const matrices = sampleNodeMatrices(model, frame, si), transform = matrices.get(chestId);
    if (!transform || Math.abs(transform.determinant()) < 1e-9) return null;
    chest.copy(transform).invert();
    const visibility = new Map(), distances = [];
    for (const hand of hands) {
      centroid.set(0, 0, 0);
      let count = 0;
      for (const {gi, bones, count: vertices} of hand) {
        if (!visibility.has(gi)) visibility.set(gi, surfaceVisible(model, gi, frame, si));
        if (!visibility.get(gi)) continue;
        count += vertices;
        for (const [id, [x, y, z, w]] of bones) {
          const e = (matrices.get(id) || identity).elements;
          centroid.x += e[0]*x + e[4]*y + e[8]*z + e[12]*w;
          centroid.y += e[1]*x + e[5]*y + e[9]*z + e[13]*w;
          centroid.z += e[2]*x + e[6]*y + e[10]*z + e[14]*w;
        }
      }
      if (!count) return null;
      distances.push(Math.abs(centroid.divideScalar(count).applyMatrix4(chest).sub(pivot).dot(lateral)));
    }
    return distances.sort((a, b) => a-b);
  };
}

export function measureFistClearance(own, donor, result, report, include = () => true) {
  const ownChest = own.rig.parts.chest?.marker, donorChest = donor.rig.parts.chest?.marker;
  const resultChest = report.donorNodes?.[donorChest];
  const oc = handClouds(own), dc = handClouds(donor);
  if (ownChest == null || donorChest == null || resultChest == null || oc.length !== 2 || dc.length !== 2 || [...oc,...dc].some(c => c.length < 3))
    return { available: false, reason: 'Two hand surfaces and mapped chest required' };
  const sourceAt = reader(donor.model, dc, donorChest, donor.rig.facing);
  const resultAt = reader(result, oc, resultChest, donor.rig.facing);
  const ownRest = reader(own.model, oc, ownChest, own.rig.facing)(own.stand, own.model.Sequences[own.stand].Interval[0]);
  const donorRest = sourceAt(donor.stand, donor.model.Sequences[donor.stand].Interval[0]);
  if (!ownRest || !donorRest || Math.min(...ownRest, ...donorRest) < 1e-5) return {available:false,reason:'No separated visible hands in reference stance'};
  const clips = [];
  for (const [si, seq] of donor.model.Sequences.entries()) {
    if (!include(seq)) continue;
    const [first, last] = seq.Interval;
    let comparable = 0, donorOpen = 0, belowBand = 0, worst = null;
    for (let f=first; f<=last; f+=2) {
      const d = sourceAt(si, f), r = resultAt(si, f);
      if (!d || !r) continue;
      comparable++;
      // Use the smaller of the two lateral distances. A mirrored rig can
      // reverse left and right. A deliberate donor cross-body pose is exempt.
      const sourceFraction = d[0] / donorRest[0];
      if (sourceFraction < .8) continue;
      donorOpen++;
      const resultFraction = r[0] / ownRest[0];
      if (resultFraction < .8) belowBand++;
      if (!worst || resultFraction < worst.resultFraction) worst = {ms:f-first, resultFraction, sourceFraction, distance:r[0]};
    }
    clips.push({sequence:seq.Name.trim(), comparable, donorOpen, belowBand, worst});
  }
  return {available:true, ownRest, donorRest, clips};
}
