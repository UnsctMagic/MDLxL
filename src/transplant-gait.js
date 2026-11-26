import { allNodes, globalSequenceId, nodePivot, sampleTrack } from './animation.js';
import { nodeIndex } from './node-hierarchy.js';

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

// An upper torso rooted over the forelegs of a single four-legged creature.
export function frontBodySupport(model, rig) {
  if (!rig.ok || rig.actors?.length > 1 || !rig.parts.chest || !rig.parts.armL || !rig.parts.armR) return null;
  const left = ordered(rig, model, 'L'), right = ordered(rig, model, 'R');
  if (left.length !== 2 || right.length !== 2) return null;
  const tree = nodeIndex(model);
  const carrier = tree.ancestors(left[1].joints[0]).find(id =>
    tree.isAncestor(right[1].joints[0], id) && tree.isAncestor(rig.parts.chest.joints[0], id)
    && ![left[0], right[0]].some(part => tree.isAncestor(part.joints[0], id)));
  return carrier == null ? null : { carrier, legs: [left[1], right[1]] };
}

/** True when this model has more legs than the donor on both sides (the donor has at least one on each): the front
 * legs are spare, and Mirror legs / Use arms apply. */
export function spareFrontLegs(own, donor, ownRig, donorRig) {
  return !!ownRig?.ok && !!donorRig?.ok && ['L','R'].every(side =>
    ordered(ownRig,own,side).length > ordered(donorRig,donor,side).length && ordered(donorRig,donor,side).length > 0);
}

/** `useArms`, `mirrorLegs`: the two front-leg checkboxes (transplant-autofix.js FRONT_LEG_KEYS); `legTiming` the
 * slider (0-100) shown with Mirror legs. Neither ticked: the spare front legs copy the back legs on their side. */
export function transplantGait(own, donor, ownRig, donorRig, choice, frontBody = null, { useArms = false, mirrorLegs = false, legTiming = 50 } = {}) {
  const assignments = new Map();
  if (!choice || !ownRig.ok || !donorRig.ok) return assignments;
  const spare = spareFrontLegs(own, donor, ownRig, donorRig);
  // Use arms: spare front legs take the donor's arms (owner, 26 Nov 2026, Cold One onto Snap Dragon: "why did the front
  // legs not become the arms of the beast? ... this is possible"): this model has no arm on either side, the donor has
  // both. Both sides or neither, so the body stays symmetric. The reverse of the foreleg rule below.
  const armsFromLegs = useArms && spare && ['L','R'].every(side => !ownRig.parts['arm'+side] && donorRig.parts['arm'+side]);
  // Mirror legs: the spare front legs take the mirrored opposite back leg (the diagonal gait), shifted in looping Walk
  // animations by the Leg timing slider: (legTiming - 50) % of the clip.
  const mirrored = mirrorLegs && spare;
  if (mirrored) choice = 'diagonal';
  const shift = mirrored ? (legTiming - 50) / 100 : 0;
  for (const side of ['L','R']) {
    const mine = ordered(ownRig,own,side), theirs = ordered(donorRig,donor,side);
    if (!mine.length || !theirs.length || mine.length === theirs.length) continue;
    const other = ordered(donorRig,donor,side === 'L' ? 'R' : 'L');
    for (const [index, part] of mine.entries()) {
      let source = theirs[Math.min(index,theirs.length-1)];
      const additional = index >= theirs.length;
      const reflected = additional && choice === 'diagonal' && index % 2 === 1 && other.length > 0;
      if (reflected) source = other[Math.min(index,other.length-1)];
      if (mine.length === 1 && (choice === 'front' || (frontBody && choice === 'back-and-arms' && ownRig.parts.armL && ownRig.parts.armR))) source = theirs.at(-1);
      assignments.set(part.key,{from:source.key,copy:additional,reflected,...(reflected && shift ? {shift} : {})});
    }
    if (armsFromLegs) assignments.set(mine.at(-1).key,{from:'arm'+side});
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
      // Mirror legs: the copy's motion in each looping Walk is shifted by the Leg timing slider.
      if (spec.shift) for (const s of model.Sequences || []) {
        if (!/^walk/i.test(String(s.Name).trim()) || s.NonLooping || !(s.Interval?.[1] > s.Interval?.[0])) continue;
        for (const field of ['Translation','Rotation','Scaling']) if (copy[field]?.Keys?.length && globalSequenceId(copy[field], model) === null)
          copy[field] = shiftLoopKeys(copy[field], s.Interval, spec.shift, { quaternion: field === 'Rotation' });
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

/** A track's keys inside one looping animation `interval` [a, b], moved `share` of the clip later (wrapping round):
 * a key at t goes to a + ((t - a + share * L) mod L). Keys are added at both ends, sampled from the original at the
 * wrapped time, so the loop closes. Keys outside the interval are kept. Pure: returns a new track. */
export function shiftLoopKeys(track, interval, share, { quaternion = false } = {}) {
  const [a, b] = interval, L = b - a, keys = track?.Keys || [];
  const wrapped = ((share % 1) + 1) % 1;
  if (!(L > 0) || !keys.length || wrapped === 0) return track;
  const inside = keys.filter(key => key.Frame >= a && key.Frame <= b);
  if (!inside.length) return track;
  const original = t => sampleTrack(track, t, { interval, quaternion, fallback: null });
  const cubic = track.LineType === 2 || track.LineType === 3;
  // A sampled end key has no authored tangents: flat ones (the value itself; for Hermite translation, zero slope).
  const endKey = frame => {
    const v = Float32Array.from(original(a + ((frame - a - wrapped * L) % L + L) % L));
    const key = { Frame: frame, Vector: v };
    if (cubic) {
      const flat = quaternion || track.LineType === 3 ? Float32Array.from(v) : new Float32Array(v.length);
      key.InTan = flat; key.OutTan = Float32Array.from(flat);
    }
    return key;
  };
  const moved = inside.filter(key => key.Frame < b).map(key => ({ ...key, Frame: Math.round(a + ((key.Frame - a + wrapped * L) % L)) }))
    .filter(key => key.Frame > a && key.Frame < b);
  const start = endKey(a), end = { ...endKey(b), Vector: Float32Array.from(start.Vector) };
  if (cubic) { end.InTan = Float32Array.from(start.InTan); end.OutTan = Float32Array.from(start.OutTan); }
  const byFrame = new Map(moved.map(key => [key.Frame, key]));
  const shifted = [start, ...[...byFrame.values()].sort((x, y) => x.Frame - y.Frame), end];
  return { ...track, Keys: [...keys.filter(key => key.Frame < a), ...shifted, ...keys.filter(key => key.Frame > b)] };
}
