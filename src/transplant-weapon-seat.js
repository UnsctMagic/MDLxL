import { Matrix4, Quaternion, Triangle, Vector3 } from 'three';
import { nodePivot, sampleGeosetAnimation, sampleNodeMatrices, sampleTrack, skinGeoset } from './animation.js';
import { bindVertices } from './editor-commands.js';
import { physicalSurfaceComponents } from './geoset-operations.js';
import { geosetMaterialLayers, isAdditiveLayer } from './geoset-extras.js';
import { readHeldItem } from './held-item.js';
import { nodeIndex } from './node-hierarchy.js';
import { vertexBones } from './part-bones.js';
import { isWeaponName } from './rig-names.js';
import { standSequenceIndex } from './sequence-editor.js';

const vector = () => new Vector3();
const at = (values, v) => vector().fromArray(values, 3*v);
const mean = points => points.reduce((sum,p) => sum.add(p), vector()).divideScalar(points.length);
const pointKey = p => p.toArray().map(n => Math.round(1000*n)).join(',');
const weaponWord = name => isWeaponName(name, ['totum','crossbow','barrel','axhandle','xbow']);
const excluded = /shield|buckler|quiver|arrow|bolt|projectile|bullet|muzzleflash|finger|thumb|cloth|plane|cape|hair|wing/i;
const finite = p => p.toArray().every(Number.isFinite);

function pose(model, sequence) {
  const frame = model.Sequences[sequence].Interval[0];
  const world = sampleNodeMatrices(model, frame, sequence), skin = new Map();
  function point(gi, v) {
    if (!skin.has(gi)) skin.set(gi, skinGeoset(model.Geosets[gi], world));
    return at(skin.get(gi), v);
  }
  return {frame, sequence, world, point};
}

// The longest principal direction describes the shaft. The other two describe
// roll about it. Work on distinct material positions so UV seams add no weight.
function shape(points) {
  points = [...new Map(points.map(p => [pointKey(p),p])).values()];
  if (points.length < 3) return null;
  const center = mean(points), offsets = points.map(p => p.clone().sub(center));
  const covariance = new Matrix4().set(0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,1);
  for (const p of offsets) {
    const a = p.toArray();
    for (let i=0;i<3;i++) for (let j=0;j<3;j++) covariance.elements[4*i+j] += a[i]*a[j];
  }
  const seeds = [new Vector3(1,0,0),new Vector3(0,1,0),new Vector3(0,0,1)];
  function principal(perpendicular) {
    function step(p) {
      p.applyMatrix4(covariance);
      if (perpendicular) p.addScaledVector(perpendicular,-p.dot(perpendicular));
      return p;
    }
    const v = seeds.map(p => step(p.clone())).sort((a,b) => b.lengthSq()-a.lengthSq())[0].normalize();
    for (let i=0;i<18;i++) step(v).normalize();
    return v;
  }
  const axis = principal(), wide = principal(axis);
  if (wide.lengthSq()<.9 || axis.lengthSq()<.9) return null;
  const extents = dir => {
    let min=Infinity,max=-Infinity;
    for (const p of offsets) {
      const t=p.dot(dir);
      min=Math.min(min,t);
      max=Math.max(max,t);
    }
    return [min,max];
  };
  const [lo,hi] = extents(axis), [left,right] = extents(wide);
  return {center,axis,wide,length:hi-lo,width:right-left,lo,hi};
}

function contacts(model, reading, parts, palm) {
  let best = null, distance = Infinity;
  const nearest = vector(), bary = vector();
  for (const {gi,faces} of parts) {
    for (let i=0;i<faces.length;i+=3) {
      const ids = faces.slice(i,i+3);
      const tri = new Triangle(...ids.map(v => reading.point(gi,v)));
      if (tri.getArea()<1e-7) continue;
      tri.closestPointToPoint(palm,nearest);
      const gap = nearest.distanceToSquared(palm);
      if (gap >= distance) continue;
      distance = gap;
      tri.getBarycoord(nearest,bary);
      const source = vector();
      ids.forEach((v,j) => source.addScaledVector(at(model.Geosets[gi].Vertices,v),bary.getComponent(j)));
      best = {world:nearest.clone(),source,gap:Math.sqrt(gap)};
    }
  }
  return best;
}

function readHands(model, rig, tree, reading) {
  const hands = [];
  for (const arm of Object.values(rig.parts).filter(p => p.limbKind==='arm')) {
    const terminal = arm.marker;
    const refs = (model.Attachments || []).filter(n => /hand.*ref/i.test(n.Name));
    const ref = refs.find(n => n.Parent===terminal) ?? refs.find(n => tree.isAncestor(n.Parent,terminal));
    const id = ref?.Parent ?? terminal;
    if (!reading.world.has(id)) continue;
    const landmark = ref || tree.byId.get(terminal);
    const stored = vector().fromArray(nodePivot(model,landmark,landmark.ObjectId));
    const palm = stored.clone().applyMatrix4(reading.world.get(landmark.ObjectId));
    hands.push({arm,id,stored,palm});
  }
  return hands;
}

function palmPatch(model, tree, parts, hand, omit) {
  const ids = new Set([...hand.arm.joints.slice(-2),hand.id]);
  const distinct = new Map(), fallback = new Map();
  for (const part of parts) {
    if (omit.has(part)) continue;
    const g = model.Geosets[part.gi];
    for (const v of part.vertices) {
      const bones = vertexBones(g,v);
      const stored = at(g.Vertices,v), key = pointKey(stored);
      const hit = {gi:part.gi,v,d:stored.distanceToSquared(hand.stored)};
      if (!fallback.has(key)) fallback.set(key,hit);
      if (bones.some(id => ids.has(id) || tree.parentOf(id)===hand.id || ids.has(tree.parentOf(id)) && /hand|finger|thumb/i.test(tree.byId.get(id)?.Name)) &&
          !distinct.has(key)) distinct.set(key,hit);
    }
  }
  return [...(distinct.size>=3 ? distinct : fallback).values()].sort((a,b) => a.d-b.d).slice(0,5);
}

function oriented(shape, grip, handWorld) {
  const axis = shape.axis.clone(), wide = shape.wide.clone();
  const toward = (shape.lo+shape.hi)/2 + shape.center.clone().sub(grip).dot(axis);
  const inHand = handWorld.clone().invert();
  const local = axis.clone().transformDirection(inHand);
  if (Math.abs(toward) > .045*shape.length ? toward < 0 : (Math.abs(local.z)>.35 ? local.z : local.x)<0) axis.negate();
  const face = vector().crossVectors(axis,wide).normalize();
  const normal = face.clone().transformDirection(inHand);
  const dominant = normal.toArray().reduce((a,b) => Math.abs(b)>Math.abs(a)?b:a,0);
  if (dominant < 0) face.negate();
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(axis, vector().crossVectors(face,axis), face));
}

// Some launchers store the loaded arrow as a separate pair of crossed cards
// on the stock bone. Both cards show the same narrow strip of the texture.
function ammunitionCards(geoset, components, tree) {
  if (components.length!==2 || components.some(p => p.faces.length!==6 || p.vertices.length!==4)) return false;
  const ids = new Set(components.flatMap(p => p.vertices.flatMap(v => vertexBones(geoset,v))));
  if (ids.size!==1 || !tree.ancestors([...ids][0],true).some(id => /rifle|crossbow|xbow|musket|gun/i.test(tree.byId.get(id)?.Name))) return false;
  const uv = geoset.TVertices?.[0];
  if (!uv) return false;
  const chart = part => part.vertices.map(v => [uv[2*v],uv[2*v+1]].join(',')).sort().join('|');
  if (chart(components[0])!==chart(components[1])) return false;
  const cards = components.map(p => {
    const g=shape(p.vertices.map(v => at(geoset.Vertices,v)));
    if (!g || g.length<4*g.width) return null;
    const [a,b,c]=p.faces.slice(0,3).map(v=>at(geoset.Vertices,v));
    return {...g,normal:new Triangle(a,b,c).getNormal(vector())};
  });
  return cards.every(Boolean) && Math.abs(cards[0].normal.dot(cards[1].normal))<.25 &&
    Math.abs(cards[0].axis.dot(cards[1].axis))>.97 && cards[0].center.distanceTo(cards[1].center)<cards[0].width;
}

function readWeapon(model, rig) {
  const si = standSequenceIndex(model);
  if (!rig.ok || si<0) return null;
  const reading = pose(model,si), tree = nodeIndex(model), hands = readHands(model,rig,tree,reading);
  if (!hands.length) return null;
  const legacy = readHeldItem(model,rig);
  const refs = (model.Attachments || []).filter(n => /^(weapon|sprite.*weapon)\b/i.test(n.Name));
  const joints = new Set(Object.values(rig.parts).flatMap(p => p.joints));
  const parts = [];
  for (const [gi,g] of model.Geosets.entries()) {
    if (!g.Faces?.length || sampleGeosetAnimation(model,gi,reading.frame,si).alpha<.25 ||
        !geosetMaterialLayers(model,g).some(layer => !isAdditiveLayer(layer) && sampleTrack(layer.Alpha,reading.frame,{
          interval:model.Sequences[si].Interval,globalSequences:model.GlobalSequences,globalTime:reading.frame,fallback:1})>.001)) continue;
    const components = physicalSurfaceComponents(g);
    if (ammunitionCards(g,components,tree)) continue;
    for (const part of components) {
      const ids = new Set(part.vertices.flatMap(v => vertexBones(g,v)));
      parts.push({...part,gi,ids});
    }
  }
  const groups = new Map();
  for (const part of parts) {
    if (!part.ids.size) continue;
    const ids = [...part.ids];
    const root = tree.ancestors(ids[0],true).find(id => ids.every(other => tree.isAncestor(other,id)));
    if (root == null || excluded.test(tree.byId.get(root)?.Name)) continue;
    const isHand = hands.some(h => h.id===root || h.arm.marker===root);
    if (joints.has(root) && !isHand || isHand && ids.length!==1) continue;
    const lineage = tree.ancestors(root,true);
    const carrier = lineage.find(id => !joints.has(id) && refs.some(r => r.Parent===id)) ??
      lineage.find(id => !joints.has(id) && weaponWord(tree.byId.get(id)?.Name) && !excluded.test(tree.byId.get(id)?.Name)) ?? root;
    const key = isHand ? part : carrier;
    if (!groups.has(key)) groups.set(key,{carrier,parts:[],isHand});
    groups.get(key).parts.push(part);
  }
  const candidates = [];
  for (const group of groups.values()) {
    const {carrier,parts:surfaces,isHand} = group, name = tree.byId.get(carrier)?.Name || '';
    const points = surfaces.flatMap(p => p.vertices.map(v => reading.point(p.gi,v)));
    let geometry = shape(points), axisParts = surfaces;
    if (!geometry) continue;
    const launcher = /rifle|gun|crossbow|xbow|musket|pistol/i.test(name);
    // The transverse limbs of a crossbow can be wider than its stock.
    // Choose a long, narrow solid stock near the hands as the axis witness.
    if (launcher && geometry.length<1.7*geometry.width) {
      const across = hands.length===2 && hands[1].palm.clone().sub(hands[0].palm).normalize();
      let bestStock = 0;
      for (const part of surfaces) {
        if (part.vertices.length<6) continue;
        const frame=shape(part.vertices.map(v => reading.point(part.gi,v)));
        if (!frame || frame.length<.48*geometry.length || frame.length<2.2*frame.width) continue;
        const gap=Math.min(...hands.map(h => contacts(model,reading,[part],h.palm)?.gap ?? Infinity));
        const score=frame.length/(1+gap)* (across ? 1+2*Math.abs(frame.axis.dot(across)) : 1);
        if (score>bestStock) { bestStock=score; axisParts=[part]; }
      }
      if (bestStock) geometry=shape(axisParts[0].vertices.map(v => reading.point(axisParts[0].gi,v)));
    }
    const marked = refs.some(r => r.Parent===carrier || isHand && tree.isAncestor(r.Parent,carrier)), named = weaponWord(name);
    for (const hand of hands) {
      const reach = hand.arm.length;
      const relativeLength = geometry.length/reach, elongation = geometry.length/Math.max(.01,geometry.width);
      const attached = tree.isAncestor(carrier,hand.id) || tree.isAncestor(carrier,hand.arm.marker);
      if (relativeLength<.43 || elongation<(marked && named && launcher ? .8 : marked||named ? 1.01 : 1.5)) continue;
      if (isHand && !attached || !marked && !named && legacy?.carrier!==carrier && !(attached && (hand.arm.weapon || refs.length>1))) continue;
      const contact = contacts(model,reading,surfaces,hand.palm);
      if (!contact || contact.gap>reach*(marked||named ? .92 : .48)) continue;
      const score = Math.min(3,relativeLength)*Math.min(3.5,elongation) /
        (1+4*contact.gap/reach) * (marked?2.2:1) * (named?1.8:1) * (attached?1.45:1) *
        (legacy?.carrier===carrier ? 1.3 : 1);
      candidates.push({...group,hand,geometry,axisParts,launcher,score,contact,marked,named});
    }
  }
  candidates.sort((a,b) => b.score-a.score);
  const best = candidates[0];
  if (!best) return null;
  // A dual-wield rig can name its two carriers identically apart from a number.
  // Require an item on each wrist, or two separate weapon attachments.
  const pairedName = id => String(tree.byId.get(id)?.Name || '').replace(/[0-9 _.-]/g,'').toLowerCase();
  const opposite = c => tree.parentOf(c.carrier)===c.hand.id && tree.parentOf(best.carrier)===best.hand.id;
  const second = candidates.find(c => c.hand!==best.hand && c.carrier!==best.carrier && c.score>.20*best.score &&
    (opposite(c) && pairedName(c.carrier)===pairedName(best.carrier) || c.marked && best.marked && refs.length>1));
  const items = second ? [best,second] : [best];
  for (const item of items) {
    if (!item.isHand) continue;
    // A hand-bound blade and hilt may use different materials. Include a
    // separately recognized adjoining piece only on the same hand.
    for (const extra of candidates.filter(c => c!==item && c.isHand && c.carrier===item.carrier && c.hand===item.hand)) {
      const distance = contacts(model,reading,extra.parts,item.contact.world)?.gap;
      if (distance<.16*item.hand.arm.length && !item.parts.includes(extra.parts[0]))
        item.parts=item.parts.concat(extra.parts);
    }
    item.axisParts=item.parts;
    item.geometry=shape(item.parts.flatMap(p => p.vertices.map(v => reading.point(p.gi,v))));
  }
  const omit = new Set(items.flatMap(c => c.parts));
  for (const h of hands) {
    h.patch = palmPatch(model,tree,parts,h,omit);
    if (h.patch.length) h.palm = mean(h.patch.map(p => reading.point(p.gi,p.v)));
  }
  for (const item of items) {
    const otherHand = hands.find(h => h!==item.hand);
    // On detached two-hand equipment, the trigger or butt is held behind the
    // supporting palm. An attachment to an actual wrist takes precedence.
    if (!second && otherHand && !tree.isAncestor(item.carrier,item.hand.id) && !item.isHand) {
      const g=item.geometry, mid=(g.lo+g.hi)/2;
      const fromMiddle=h => Math.abs(h.palm.clone().sub(g.center).dot(g.axis)-mid);
      const near=contacts(model,reading,item.parts,otherHand.palm);
      const projection = h => h.palm.clone().sub(g.center).dot(g.axis)*Math.sign(g.axis.x);
      const rearward = item.launcher && Math.abs(otherHand.palm.x-item.hand.palm.x)>.16*item.hand.arm.length
        ? otherHand.palm.x<item.hand.palm.x
        : item.launcher && Math.abs(g.axis.x)>.25 ? projection(otherHand)<projection(item.hand)-.08*g.length
        : fromMiddle(otherHand)>fromMiddle(item.hand)+.12*g.length;
      if (near && near.gap<.28*otherHand.arm.length && rearward) item.hand=otherHand;
    }
    item.contact = contacts(model,reading,item.parts,item.hand.palm);
    item.worldBasis = oriented(item.geometry,item.contact.world,reading.world.get(item.hand.id));
    item.handBasis = rotation(reading.world.get(item.hand.id)).invert().multiply(item.worldBasis);
    const other = hands.find(h => h!==item.hand);
    const support = !second && other && contacts(model,reading,item.parts,other.palm);
    if (support && support.gap<=.15*other.arm.length && support.world.distanceTo(item.contact.world)>.12*item.geometry.length)
      item.support = {hand:other,gap:support.gap};
  }
  return {items,hands,reading,tree};
}

function rotation(matrix) {
  const q = new Quaternion();
  matrix.decompose(vector(),q,vector());
  return q.normalize();
}

export function seatWeapon(result, own, donor, rigB, rigA, donorMap, limbEntries, keep) {
  const source = readWeapon(own,rigB), target = source && readWeapon(donor,rigA);
  const si = standSequenceIndex(result);
  if (!target || si<0) return null;
  const stand = pose(result,si), moves = [], bones = new Set(result.Bones.map(n => n.ObjectId));
  const matched = new Set();
  for (const item of source.items) {
    if (item.parts.some(p => [...p.ids].some(id => source.tree.ancestors(id,true).some(ancestor => keep.has(ancestor))))) continue;
    const available = target.items.filter(t => !matched.has(t));
    if (!available.length) break;
    const wanted = available.find(t => t.hand.arm.key===item.hand.arm.key) ?? available[0];
    matched.add(wanted);
    const paired = limbEntries.find(e => e.theirs.marker===wanted.hand.arm.marker)?.own;
    const palm = source.hands.find(h => h.arm.marker===paired?.marker) ?? source.hands.find(h => h.arm.key===wanted.hand.arm.key);
    if (!palm?.patch.length) return null;
    const hand = donorMap[wanted.hand.id] ?? donorMap[wanted.hand.arm.marker];
    if (!bones.has(hand) && !result.Helpers.includes(result.Nodes[hand])) return null;
    if (hand==null || !stand.world.has(hand) || Math.abs(stand.world.get(hand).determinant())<1e-8) return null;
    const destination = mean(palm.patch.map(p => stand.point(p.gi,p.v))).applyMatrix4(stand.world.get(hand).clone().invert());
    const points = item.axisParts.flatMap(p => p.vertices.map(v => at(own.Geosets[p.gi].Vertices,v)));
    const storedShape = shape(points);
    if (!storedShape) return null;
    // Transport the measured Stand frame back to stored space through the
    // carrier. For articulated items use the stored surface's own rigid frame.
    const skinIds=new Set(item.axisParts.flatMap(p => [...p.ids]));
    const oldCarrier = skinIds.size===1 && source.reading.world.get([...skinIds][0]);
    const storedFrame = oldCarrier
      ? rotation(oldCarrier).invert().multiply(item.worldBasis)
      : oriented(storedShape,item.contact.source,new Matrix4());
    const targetFrame = rotation(target.reading.world.get(wanted.hand.id)).multiply(wanted.handBasis);
    const turn = rotation(stand.world.get(hand)).invert().multiply(targetFrame).multiply(storedFrame.invert()).normalize();
    if (!finite(destination) || !turn.toArray().every(Number.isFinite)) return null;
    for (const p of item.parts) {
      const g = result.Geosets[p.gi];
      if (!g || g.Vertices.length!==own.Geosets[p.gi].Vertices.length || g.VertexGroup?.length!==g.Vertices.length/3 ||
          g.Groups.length>=256 && !g.Groups.some(ids => ids.length===1 && ids[0]===hand) ||
          g.SkinWeights?.length && (g.SkinWeights.length!==g.Vertices.length/3*8 || hand>(result.Version>=1400?65535:255))) return null;
    }
    moves.push({item,wanted,hand,turn,destination});
  }
  const report = [];
  for (const {item,wanted,hand,turn,destination} of moves) {
    // Unreferenced duplicates at seams still belong to the stored weapon.
    const geosets = new Set(item.parts.map(p => p.gi));
    for (const gi of geosets) {
      const g=own.Geosets[gi], used=new Set(g.Faces), pieces=item.parts.filter(p => p.gi===gi);
      const material=new Set(pieces.flatMap(p => p.vertices.map(v => pointKey(at(g.Vertices,v)))));
      const ids=new Set(pieces.flatMap(p => [...p.ids]));
      const loose=[];
      for (let v=0;v<g.Vertices.length/3;v++) {
        if (!used.has(v) && vertexBones(g,v).every(id=>ids.has(id)) &&
            (material.has(pointKey(at(g.Vertices,v))) || !item.isHand && vertexBones(g,v).includes(item.carrier))) loose.push(v);
      }
      if (loose.length) item.parts.push({gi,vertices:loose,faces:[]});
    }
    if (!bones.has(hand)) {
      // Several MDX rigs animate a helper wrist with the hand mesh on a child.
      // Give that exact joint a BONE record without changing its ID, pivot or tracks.
      const node = result.Nodes[hand];
      result.Helpers.splice(result.Helpers.indexOf(node),1);
      Object.assign(node,{Flags:node.Flags | 256,GeosetId:null,GeosetAnimId:null});
      result.Bones.push(node);
      bones.add(hand);
    }
    for (const p of item.parts) {
      const g = result.Geosets[p.gi], native = own.Geosets[p.gi];
      bindVertices(result,g,p.vertices,hand);
      for (const v of p.vertices) {
        at(native.Vertices,v).sub(item.contact.source).applyQuaternion(turn).add(destination).toArray(g.Vertices,v*3);
        if (native.Normals?.length===native.Vertices.length) at(native.Normals,v).applyQuaternion(turn).toArray(g.Normals,v*3);
        if (native.Tangents?.length===native.Vertices.length/3*4)
          vector().fromArray(native.Tangents,v*4).applyQuaternion(turn).toArray(g.Tangents,v*4);
      }
    }
    const support = wanted.support && source.hands.find(h => h.arm.key===wanted.support.hand.arm.key);
    const updated = support?.patch.length && pose(result,si);
    const supportGap = updated ? contacts(result,updated,item.parts,mean(support.patch.map(p => updated.point(p.gi,p.v))))?.gap : null;
    const line = updated && shape(item.parts.flatMap(p => p.vertices.map(v => updated.point(p.gi,v))));
    const supportPalm = updated && mean(support.patch.map(p => updated.point(p.gi,p.v)));
    const shaftDistance = line && supportPalm.distanceTo(line.center.clone().addScaledVector(line.axis,
      Math.max(line.lo,Math.min(line.hi,supportPalm.clone().sub(line.center).dot(line.axis)))));
    report.push({standFrame:stand.frame,donorStandFrame:target.reading.frame,sourceGrip:item.contact.source.toArray(),
      donorGripInHand:wanted.contact.world.clone().applyMatrix4(target.reading.world.get(wanted.hand.id).clone().invert()).toArray(),
      donorAxisInHand:new Vector3(1,0,0).applyQuaternion(wanted.handBasis).toArray(),
      donorFaceInHand:new Vector3(0,0,1).applyQuaternion(wanted.handBasis).toArray(),
      secondPalmToShaft:shaftDistance ?? null,carrier:item.carrier,donorCarrier:wanted.carrier,donorHand:wanted.hand.id,hand,side:wanted.hand.arm.key,
      vertices:item.parts.reduce((n,p) => n+p.vertices.length,0),donorSupportGap:wanted.support?.gap ?? null,secondPalmDistance:supportGap ?? null});
  }
  return report.length ? report : null;
}
