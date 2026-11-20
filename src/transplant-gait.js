import { allNodes, nodePivot } from './animation.js';

const legs = (rig, side) => Object.values(rig.parts).filter(p => p.limbKind === 'leg' && p.side === side);

// Front and rear are positions on the animal. Numbered part labels vary between rigs.
function ordered(rig, model, side) {
  const front = rig.facing;
  const along = p => {
    const id = p.line?.[0] ?? p.joints[0], pos = nodePivot(model, model.Nodes[id], id);
    return pos[0] * front[0] + pos[1] * front[1];
  };
  return legs(rig,side).sort((a,b)=>along(a)-along(b));
}

export function transplantGait(own, donor, ownRig, donorRig, choice) {
  const assignments = new Map();
  if (!choice || !ownRig.ok || !donorRig.ok) return assignments;
  for (const side of ['L','R']) {
    const mine = ordered(ownRig,own,side), theirs = ordered(donorRig,donor,side);
    if (!mine.length || !theirs.length || mine.length === theirs.length) continue;
    const other = ordered(donorRig,donor,side === 'L' ? 'R' : 'L');
    for (const [index, part] of mine.entries()) {
      let source = theirs[Math.min(index,theirs.length-1)];
      const additional = index >= theirs.length;
      const reflected = additional && choice === 'diagonal' && index % 2 === 1 && other.length > 0;
      if (reflected) source = other[Math.min(index,other.length-1)];
      if (mine.length === 1 && choice === 'front') source = theirs.at(-1);
      assignments.set(part.key,{from:source.key,copy:additional,reflected});
    }
    // Use a spare foreleg only when the recipient arm has no actual donor arm.
    const armKey = 'arm'+side;
    if (choice === 'back-and-arms' && theirs.length > mine.length && ownRig.parts[armKey] && !donorRig.parts[armKey])
      assignments.set(armKey,{from:theirs.at(-1).key});
  }
  return assignments;
}

// Two feet can share a donor's cadence but need separate pivots. Copy just the chain
// between its first and last joints, including intermediate carriers. Each copy
// goes through the normal limb placement, posture, skin, and MDX serialization.
export function duplicateGaitChains(model, rig, entries, assignments) {
  if (![...assignments.values()].some(a => a.copy)) return rig;
  const nodes = new Map(allNodes(model).map(n=>[n.ObjectId,n]));
  let next = Math.max(...nodes.keys())+1;
  const parts = {...rig.parts};
  for (const entry of entries) {
    const spec=assignments.get(entry.key);
    if (!spec?.copy) continue;
    const source=entry.theirs, first=source.joints[0], wanted=new Set(source.joints);
    for (const id of source.joints) {
      const between = new Set();
      let at = id;
      while (at !== first && nodes.has(at) && !between.has(at)) {
        between.add(at);
        at = nodes.get(at).Parent;
      }
      if (at === first) for (const joint of between) wanted.add(joint);
    }
    const ids=new Map([...wanted].map(id=>[id,next++]));
    const sameSide = rig.parts['leg'+entry.own.side];
    const anchor=spec.reflected && sameSide ? nodes.get(sameSide.joints[0]).Parent : nodes.get(first).Parent;
    const length = Math.hypot(rig.facing[0],rig.facing[1]) || 1;
    const nx=-rig.facing[1]/length, ny=rig.facing[0]/length;
    const rootP=nodePivot(model,nodes.get(first),first);
    const otherId=sameSide?.joints[0] ?? first, otherP=nodePivot(model,nodes.get(otherId),otherId);
    const mid=((rootP[0]+otherP[0])*nx+(rootP[1]+otherP[1])*ny)/2;
    const reflect=(v,origin=0)=>{
      const twice=2*(v[0]*nx+v[1]*ny-origin);
      v[0]-=twice*nx; v[1]-=twice*ny;
    };
    for (const [id,newId] of ids) {
      const original=nodes.get(id), copy=structuredClone(original);
      copy.ObjectId=newId;
      copy.Name=String(original.Name || 'Leg').slice(0,54)+' '+entry.key;
      copy.Parent=id===first ? anchor : ids.get(original.Parent) ?? original.Parent;
      copy.PivotPoint=new Float32Array(nodePivot(model,original,id));
      if (spec.reflected) {
        reflect(copy.PivotPoint,mid);
        for(const field of ['Translation','Rotation']) for(const key of copy[field]?.Keys || [])
          for(const v of [key.Vector,key.InTan,key.OutTan]) if(v) {
            reflect(v);
            if(field==='Rotation') {v[0]*=-1; v[1]*=-1; v[2]*=-1;}
          }
      }
      const collection=model.Bones.includes(original)?model.Bones:model.Helpers;
      collection.push(copy);
      model.Nodes[newId]=copy;
      model.PivotPoints[newId]=copy.PivotPoint;
    }
    const remap=id=>ids.get(id) ?? id;
    const part=Object.assign(Object.create(source),{key:entry.key,side:entry.own.side,joints:source.joints.map(remap),line:source.line?.map(remap),marker:remap(source.marker),anchor});
    entry.theirs=part;
    parts[entry.key]=part;
  }
  return Object.assign(Object.create(rig),{parts});
}
