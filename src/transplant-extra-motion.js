import { nodePivot, sampleNodeMatrices } from './animation.js';
import { Vector3 } from 'three';

const family = s => s.Name.trim().toLowerCase().replace(/\s*[-\d]+\s*$/,'').trim();
export function motionFamilies(model, node) {
  const active = new Map();
  for (const sequence of model.Sequences || []) {
    const name = family(sequence), [a,b] = sequence.Interval;
    const moves = ['Rotation','Translation','Scaling'].some(property => {
      const keys = (node[property]?.Keys || []).filter(k => k.Frame >= a && k.Frame <= b);
      return keys.length > 1 && keys.some(k => k.Vector.some((v,j) => Math.abs(v-keys[0].Vector[j]) > 1e-4));
    });
    active.set(name, !!active.get(name) || moves);
  }
  return active;
}
export function missedMotion(own, donor) {
  let wanted=0, missed=0;
  for (const [name, moving] of own) if (moving && donor.has(name)) {
    wanted++;
    if (!donor.get(name)) missed++;
  }
  return wanted ? missed / wanted : 0;
}

// Compare a material point and two offsets so rotation about the same pivot
// still distinguishes a shoulder plate that follows the arm from chest skin.
export function nativeShoulderCarrier(model, node, rig, tree, samples) {
  const chest = rig.parts.chest;
  if (!chest || !chest.joints.includes(node.Parent)) return null;
  const pivot = new Vector3().fromArray(nodePivot(model,node)), h=rig.hipHeight;
  const arms = Object.values(rig.parts).filter(p => p.limbKind==='arm');
  const probes=[pivot,pivot.clone().add(new Vector3(.15*h,0,0)),pivot.clone().add(new Vector3(0,0,.15*h))];
  function drift(id){let first=null,worst=0;
    for(const w of samples()){if(!w.has(id)||!w.has(node.ObjectId))continue;
      const rel=w.get(id).clone().invert().multiply(w.get(node.ObjectId));
      const p=probes.map(q=>q.clone().applyMatrix4(rel));first??=p;
      worst=Math.max(worst,...p.map((q,j)=>q.distanceTo(first[j])))}return worst}
  for (const arm of arms) {
    const id=arm.joints[0], shoulder=new Vector3().fromArray(nodePivot(model,tree.byId.get(id)));
    if(pivot.distanceTo(shoulder)>.35*arm.length)continue;
    if(drift(id)<.8*drift(node.Parent))return id;
  }
  return null;
}
