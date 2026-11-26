import { Matrix4, Quaternion, Triangle, Vector3 } from 'three';
import { nodePivot, sampleGeosetAnimation, sampleNodeMatrices, sampleTrack, skinGeoset } from './animation.js';
import { sameKindSequence, transferRig } from './anim-transfer.js';
import { bindVertices } from './editor-commands.js';
import { physicalSurfaceComponents } from './geoset-operations.js';
import { geosetMaterialLayers, isAdditiveLayer } from './geoset-extras.js';
import { readHeldItem } from './held-item.js';
import { nodeIndex } from './node-hierarchy.js';
import { vertexBones } from './part-bones.js';
import { isWeaponName } from './rig-names.js';
import { standSequenceIndex } from './sequence-editor.js';
import { solveTwoBone } from './pose-ik.js';
import { rewriteTrack } from './transplant-floor.js';
import { similarity } from './transplant-native-cloth.js';

const vector = () => new Vector3();
const at = (values, v) => vector().fromArray(values, 3*v);
const mean = points => points.reduce((sum,p) => sum.add(p), vector()).divideScalar(points.length);
const pointKey = p => p.toArray().map(n => Math.round(1000*n)).join(',');
const weaponWord = name => isWeaponName(name, ['totum','crossbow','barrel','axhandle','xbow']);
const excluded = /shield|buckler|quiver|arrow|bolt|projectile|bullet|muzzleflash|finger|thumb|cloth|plane|cape|hair|wing/i;
const finite = p => p.toArray().every(Number.isFinite);

function pose(model, sequence, phase = 0) {
  const [start,end] = model.Sequences[sequence].Interval;
  const frame = Math.round(start + phase*(end-start));
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

// Of the item's two longest directions, the one its own Attack keeps pointing
// along the body's facing. Read on the bone carrying most of the item.
function aimedAxis(model, rig, surfaces, reading) {
  const front = new Vector3(...(rig.facing || [1,0,0])).setZ(0);
  if (front.lengthSq()<1e-6) return null;
  front.normalize();
  const points = surfaces.flatMap(p => p.vertices.map(v => reading.point(p.gi,v)));
  const whole = shape(points);
  if (!whole) return null;
  const counts = new Map();
  for (const p of surfaces) for (const v of p.vertices) for (const id of vertexBones(model.Geosets[p.gi],v)) counts.set(id,(counts.get(id)||0)+1);
  const carrier = [...counts].sort((a,b) => b[1]-a[1])[0]?.[0];
  const rest = carrier!=null && reading.world.get(carrier);
  if (!rest || Math.abs(rest.determinant())<1e-8) return null;
  const toLocal = rest.clone().invert();
  const dirs = [whole.axis,whole.wide].map(d => d.clone().transformDirection(toLocal));
  const scores = [0,0];
  let n = 0;
  for (const [i,seq] of model.Sequences.entries()) {
    if (!/^attack/i.test(seq.Name.trim())) continue;
    for (const phase of [.2,.4,.6,.8]) {
      const m = pose(model,i,phase).world.get(carrier);
      if (!m || Math.abs(m.determinant())<1e-8) continue;
      dirs.forEach((d,k) => { scores[k] += d.clone().transformDirection(m).dot(front); });
      n++;
    }
  }
  if (!n) return null;
  const k = Math.abs(scores[0])>=Math.abs(scores[1]) ? 0 : 1;
  if (Math.abs(scores[k])/n<.5) return null;
  const axis = (k ? whole.wide : whole.axis).clone();
  if (scores[k]<0) axis.negate();
  const wide = (k ? whole.axis : whole.wide).clone();
  let lo=Infinity,hi=-Infinity,left=Infinity,right=-Infinity;
  for (const p of points) {
    const d=p.clone().sub(whole.center), t=d.dot(axis), s=d.dot(wide);
    lo=Math.min(lo,t); hi=Math.max(hi,t); left=Math.min(left,s); right=Math.max(right,s);
  }
  return {center:whole.center,axis,wide,length:hi-lo,width:right-left,lo,hi,aimed:true,carrier};
}

// The widest direction across a given shaft, measured on every point of the item.
function rolled(geometry, points) {
  points = [...new Map(points.map(p => [pointKey(p),p])).values()];
  if (!geometry || points.length<3) return geometry;
  const center = mean(points), axis = geometry.axis;
  const flat = points.map(p => { const d = p.clone().sub(center); return d.addScaledVector(axis,-d.dot(axis)); });
  let wide = null, best = -1;
  for (const seed of [new Vector3(1,0,0),new Vector3(0,1,0),new Vector3(0,0,1)]) {
    const v = seed.clone().addScaledVector(axis,-seed.dot(axis));
    if (v.lengthSq()<1e-6) continue;
    v.normalize();
    for (let i=0;i<24;i++) {
      const next = vector();
      for (const d of flat) next.addScaledVector(d,d.dot(v));
      next.addScaledVector(axis,-next.dot(axis));
      if (next.lengthSq()<1e-12) break;
      v.copy(next.normalize());
    }
    const spread = flat.reduce((s,d) => s+d.dot(v)**2,0);
    if (spread>best) { best=spread; wide=v; }
  }
  if (!wide) return geometry;
  let left=Infinity,right=-Infinity;
  for (const d of flat) { const t=d.dot(wide); left=Math.min(left,t); right=Math.max(right,t); }
  return {...geometry,wide,width:right-left};
}

export function contacts(model, reading, parts, palm) {
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
      best = {world:nearest.clone(),source,gap:Math.sqrt(gap),gi,ids,weights:bary.toArray()};
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
  if (!shape.aimed && (Math.abs(toward) > .045*shape.length ? toward < 0 : (Math.abs(local.z)>.35 ? local.z : local.x)<0)) axis.negate();
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

export function readWeapon(model, rig) {
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
    // A launcher points at its target while it shoots: in the model's own
    // Attack, the stock is the item direction that stays forward, muzzle first.
    const aim = launcher ? aimedAxis(model,rig,surfaces,reading) : null;
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
      candidates.push({...group,hand,geometry,axisParts,launcher,score,contact,marked,named,aim});
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
  // When a narrow stock gives the shaft, its own cross-section cannot say which
  // way the weapon lies. The whole item does: crossbow limbs lie across it.
  for (const item of items) if (item.aim) { item.geometry=item.aim; item.axisParts=item.parts; }
  for (const item of items) if (item.axisParts!==item.parts)
    item.geometry=rolled(item.geometry,item.parts.flatMap(p => p.vertices.map(v => reading.point(p.gi,v))));
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
  for (const item of items) nativeGrip(model,item,reading);
  return {items,hands,reading,tree};
}

// Track the same material point across the authored clips. A palm passing a
// blade for one frame is weaker evidence than contact throughout the motion.
const activeClip = name => /^(stand|walk|attack)\b/i.test(name.trim());
const palmAt = (hand, frame) => mean(hand.patch.map(({gi,v}) => frame.point(gi,v)));
const contactAt = (hit, frame) => hit.ids.reduce((p,v,i) =>
  p.addScaledVector(frame.point(hit.gi,v),hit.weights[i]),vector());
function nativeGrip(model,item,reading) {
  if (!item.hand.patch.length) return;
  const samples = [];
  for (const [i,seq] of model.Sequences.entries()) {
    if (!activeClip(seq.Name)) continue;
    for (const phase of [0,.25,.5,.75,1]) {
      const frame = pose(model,i,phase);
      if (!item.parts.some(p => sampleGeosetAnimation(model,p.gi,frame.frame,i).alpha>.25)) continue;
      samples.push({frame,palm:palmAt(item.hand,frame),stand:/^stand/i.test(seq.Name)});
    }
  }
  if (!samples.length) return;
  let best = item.contact, error = Infinity;
  for (const {frame,palm} of samples) {
    const candidate = contacts(model,frame,item.parts,palm);
    if (!candidate) continue;
    const distance = samples.reduce((sum,s) => sum+contactAt(candidate,s.frame).distanceTo(s.palm),0);
    if (distance<error) { best=candidate; error=distance; }
  }
  item.contact = {...best,world:contactAt(best,reading)};
  const vertices = item.axisParts.flatMap(p => p.vertices.map(v => ({gi:p.gi,v})));
  const projection = ref => reading.point(ref.gi,ref.v).dot(item.geometry.axis);
  vertices.sort((a,b) => projection(a)-projection(b));
  // Average each end ring so one off-axis corner cannot turn a blade.
  const lo=projection(vertices[0]),hi=projection(vertices.at(-1)),band=.08*(hi-lo);
  const ends=[vertices.filter(v=>projection(v)<=lo+band),vertices.filter(v=>projection(v)>=hi-band)];
  const elevated=samples.filter(s=>s.stand).map(s=>{
    const [a,b]=ends.map(end=>endAt(end,s.frame));
    return (b.z-a.z)/Math.max(1e-6,b.distanceTo(a));
  }).sort((a,b)=>a-b);
  // A support palm on a launcher leads the trigger hand toward the muzzle.
  // Otherwise the far end from the persistent native grip is the striking end.
  const votes=samples.map(({frame,palm})=>{
    const [a,b]=ends.map(end=>endAt(end,frame));
    if(item.launcher && item.support?.hand.patch.length)
      return palmAt(item.support.hand,frame).sub(palm).dot(b.sub(a).normalize());
    return b.distanceTo(palm)-a.distanceTo(palm);
  }).sort((a,b)=>a-b);
  const upright=elevated[Math.floor(elevated.length/2)] ?? 0;
  const vote=votes[Math.floor(votes.length/2)];
  if (!item.geometry.aimed && (!item.launcher && Math.abs(upright)>.65 && Math.abs(vote)<.5*item.geometry.length ? upright : vote)<0) ends.reverse();
  item.ends=ends;
  const fractions=samples.map(({frame,palm})=>{
    const [base,head]=ends.map(end=>endAt(end,frame));
    const shaft=head.sub(base);
    return palm.clone().sub(base).dot(shaft)/Math.max(1e-8,shaft.lengthSq());
  }).sort((a,b)=>a-b);
  item.fraction=Math.max(0,Math.min(1,fractions[Math.floor(fractions.length/2)]));
}
function endAt(refs,frame){return mean(refs.map(({gi,v})=>frame.point(gi,v)));}
function shaftAt(item,frame) {
  const [a,b]=item.ends.map(end=>endAt(end,frame));
  return b.sub(a).normalize();
}
function gripFit(own,result,donor,item,wanted,hand,palm,turn,anchor) {
  if (!item.ends || !wanted.ends) return null;
  const ends=item.ends.map(end=>mean(end.map(({gi,v})=>at(own.Geosets[gi].Vertices,v))));
  const length=ends[1].distanceTo(ends[0]);
  if (length<1e-5) return null;
  const axis=ends[1].clone().sub(ends[0]).normalize();
  const grip=item.contact.source.clone();
  const level=ends[0].dot(axis)+wanted.fraction*length;
  grip.addScaledVector(axis,level-grip.dot(axis));
  // Intersect the native mesh with the donor grip plane. The nearest point
  // on that section is an actual point on the shaft, including curved handles.
  let closest=null,gap=Infinity;
  for(const {gi,faces} of item.parts)for(let i=0;i<faces.length;i+=3){
    const cut=[], points=faces.slice(i,i+3).map(v=>at(own.Geosets[gi].Vertices,v));
    for(let j=0;j<3;j++){
      const a=points[j],b=points[(j+1)%3],da=a.dot(axis)-level,db=b.dot(axis)-level;
      if(da*db<=0 && Math.abs(da-db)>1e-8)cut.push(a.clone().lerp(b,da/(da-db)));
    }
    if(cut.length<2)continue;
    const segment=cut[1].clone().sub(cut[0]);
    const t=Math.max(0,Math.min(1,grip.clone().sub(cut[0]).dot(segment)/Math.max(1e-8,segment.lengthSq())));
    const q=cut[0].addScaledVector(segment,t),d=q.distanceToSquared(grip);
    if(d<gap){gap=d;closest=q;}
  }
  if(closest)grip.copy(closest);
  const observations=[];
  for (const [i,seq] of donor.Sequences.entries()) {
    if (!activeClip(seq.Name)) continue;
    const out=result.Sequences.findIndex(s=>s.Name===seq.Name && s.Interval[0]===seq.Interval[0]);
    if(out<0) continue;
    for(const phase of [0,.25,.5,.75,1]) {
      const df=pose(donor,i,phase), rf=pose(result,out,phase), matrix=rf.world.get(hand);
      if (!matrix || Math.abs(matrix.determinant())<1e-7 ||
          sampleGeosetAnimation(donor,wanted.parts[0].gi,df.frame,i).alpha<.25 ||
          sampleGeosetAnimation(result,item.parts[0].gi,rf.frame,out).alpha<.25) continue;
      const direction=shaftAt(wanted,df);
      if(direction.lengthSq()<.9) continue;
      observations.push({rf,matrix,direction, palm:palmAt(palm,rf)});
    }
  }
  if(!observations.length) return null;
  const local=mean(observations.map(o=>o.direction.clone().transformDirection(o.matrix.clone().invert())));
  if(local.lengthSq()>1e-6) turn.premultiply(new Quaternion().setFromUnitVectors(axis.clone().applyQuaternion(turn),local.normalize()));
  anchor.copy(mean(observations.map(o=>o.palm.clone().applyMatrix4(o.matrix.clone().invert()))));
  let before=0,after=0;
  for(const o of observations){
    const previous=shaftAt(item,o.rf);
    before+=previous.angleTo(o.direction)+contactAt(item.contact,o.rf).distanceTo(o.palm)/length;
    after+=axis.clone().applyQuaternion(turn).transformDirection(o.matrix).angleTo(o.direction)+
      anchor.clone().applyMatrix4(o.matrix).distanceTo(o.palm)/length;
  }
  return {grip,before:before/observations.length,after:after/observations.length};
}

// Compare the same authored actions in a common body frame, including the
// material endpoints: skeletal landmarks alone cannot distinguish two stocks
// pointing opposite ways on hands that occupy the same spot.
export function animationMirror(own,donor,rigB,rigA) {
  if(!rigA?.ok || !rigB?.ok || !(rigA.hipHeight>0 && rigB.hipHeight>0)) return null;
  const action = /^(stand|walk|attack)(?:\s*-?\s*\d+)?$/i;
  const b=readWeapon(own,rigB)?.items, a=readWeapon(donor,rigA)?.items;
  if(b?.length!==1 || a?.length!==1 || !b[0].ends || !a[0].ends) return null;
  function landmarks(model,rig,item,frame) {
    const pivot=id=>at(nodePivot(model,model.Nodes[id],id),0).applyMatrix4(frame.world.get(id));
    const origin=pivot(rig.body);
    const front=new Vector3(...rig.facing).setZ(0).normalize();
    const local=p=>{
      p.sub(origin).divideScalar(rig.hipHeight);
      return new Vector3(p.x*front.x+p.y*front.y,p.y*front.x-p.x*front.y,p.z);
    };
    const points={};
    for(const key of ['head','chest','armL','armR','legL','legR']){
      const part=rig.parts[key];
      if(!part || !frame.world.has(part.marker))continue;
      points[key]=local(pivot(part.marker));
    }
    points.grip=local(contactAt(item.contact,frame));
    points.headEnd=points.grip.clone().add(local(endAt(item.ends[1],frame)).sub(local(endAt(item.ends[0],frame))).normalize());
    return points;
  }
  const sums=[0,0]; let count=0;
  for(const [i,seq] of donor.Sequences.entries()){
    if(!action.test(seq.Name.trim()))continue;
    const j=sameKindSequence(own,seq.Name);
    if(j==null)continue;
    for(const phase of [0,.25,.5,.75,1]){
      const x=landmarks(own,rigB,b[0],pose(own,j,phase)),y=landmarks(donor,rigA,a[0],pose(donor,i,phase));
      for(const [key,point] of Object.entries(x)){
        const opposite=key.replace(/[LR]$/,s=>s==='L'?'R':'L');
        if(!y[key]||!y[opposite])continue;
        sums[0]+=point.distanceToSquared(y[key]);
        const mirrored=y[opposite].clone();mirrored.y=-mirrored.y;
        sums[1]+=point.distanceToSquared(mirrored);count++;
      }
    }
  }
  if(!count)return null;
  const errors=sums.map(s=>Math.sqrt(s/count));
  return {plain:errors[0],reflected:errors[1],mirror:errors[1]<errors[0],
    close:Math.min(...errors)<.65 && Math.min(...errors)<.9*Math.max(...errors)};
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
    const storedShape = item.axisParts!==item.parts
      ? rolled(shape(points),item.parts.flatMap(p => p.vertices.map(v => at(own.Geosets[p.gi].Vertices,v))))
      : shape(points);
    if (!storedShape) return null;
    // Transport the measured Stand frame back to stored space through the
    // carrier. For articulated items use the stored surface's own rigid frame.
    const skinIds=new Set(item.axisParts.flatMap(p => [...p.ids]));
    const oldCarrier = item.geometry.aimed ? source.reading.world.get(item.geometry.carrier)
      : skinIds.size===1 && source.reading.world.get([...skinIds][0]);
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
    const fit=gripFit(own,result,donor,item,wanted,hand,palm,turn,destination);
    if (fit) plantFoot(result,own,donor,item,wanted,target,stand,si,hand,turn,destination,fit);
    moves.push({item,wanted,hand,turn,destination,fit});
  }
  const report = [];
  for (const {item,wanted,hand,turn,destination,fit} of moves) {
    // Ammunition and other pieces that ride only on the weapon's own bones
    // (a loaded bolt card) are part of the same rigid object: they move with it.
    if (!item.isHand) {
      const ids=new Set(item.parts.flatMap(p => [...p.ids])), taken=new Set(item.parts.map(p => p.gi));
      for (const [gi,g] of own.Geosets.entries()) {
        if (taken.has(gi) || !g.Faces?.length || !result.Geosets[gi] || result.Geosets[gi].Vertices.length!==g.Vertices.length) continue;
        const count=g.Vertices.length/3, all=Array.from({length:count},(_,v)=>v);
        if (count && all.every(v => { const b=vertexBones(g,v); return b.length && b.every(id => ids.has(id)); }))
          item.parts.push({gi,vertices:all,faces:g.Faces,ids:new Set(all.flatMap(v => vertexBones(g,v)))});
      }
    }
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
        at(native.Vertices,v).sub(fit?.grip ?? item.contact.source).applyQuaternion(turn).add(destination).toArray(g.Vertices,v*3);
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
    report.push({standFrame:stand.frame,donorStandFrame:target.reading.frame,sourceGrip:(fit?.grip ?? item.contact.source).toArray(),
      gripFraction:wanted.fraction, before:fit?.before, after:fit?.after,
      donorGripInHand:wanted.contact.world.clone().applyMatrix4(target.reading.world.get(wanted.hand.id).clone().invert()).toArray(),
      donorAxisInHand:new Vector3(1,0,0).applyQuaternion(wanted.handBasis).toArray(),
      donorFaceInHand:new Vector3(0,0,1).applyQuaternion(wanted.handBasis).toArray(),
      secondPalmToShaft:shaftDistance ?? null,carrier:item.carrier,donorCarrier:wanted.carrier,donorHand:wanted.hand.id,hand,side:wanted.hand.arm.key,
      vertices:item.parts.reduce((n,p) => n+p.vertices.length,0),donorSupportGap:wanted.support?.gap ?? null,secondPalmDistance:supportGap ?? null});
  }
  for (const move of moves) {
    const held = holdSupport(result,donor,rigA,donorMap,limbEntries,source,target,move);
    if (held) report.find(r => r.carrier===move.item.carrier && r.hand===move.hand).support = held;
  }
  return report.length ? report : null;
}

// Where the donor's other palm holds its shaft, the result's other palm holds
// the seated shaft at the same place along it (CP14, owner 24 Nov 2026: "the
// hands are still not gripping the shaft ... during walk"). The two-bone arm
// solve moves the upper arm and forearm only; arms already on the shaft and
// moments when the donor lets go keep their motion.
// The lowest visible point of a pose, leaving out the given parts (the item itself).
function lowestVisible(model,frame,skip) {
  const omit=new Map();
  for (const p of skip) { if (!omit.has(p.gi)) omit.set(p.gi,new Set()); for (const v of p.vertices) omit.get(p.gi).add(v); }
  let low=Infinity;
  for (const [gi,g] of model.Geosets.entries()) {
    if (!g.Faces?.length || sampleGeosetAnimation(model,gi,frame.frame,frame.sequence).alpha<.25) continue;
    const out=omit.get(gi);
    for (let v=0;v<g.Vertices.length/3;v++) if (!out?.has(v)) low=Math.min(low,frame.point(gi,v).z);
  }
  return low;
}
// A staff whose foot rests on the ground in the donor's Stand rests on the
// ground here too (owner 24 Nov 2026, case 28: "holding his staff too high -
// look at his original own pose"). The grip slides along the shaft until the
// seated foot reaches this model's ground in Stand.
function plantFoot(result,own,donor,item,wanted,target,stand,si,hand,turn,destination,fit) {
  if (!item.ends || !wanted.ends) return;
  const df=target.reading, [da,db]=wanted.ends.map(end => endAt(end,df));
  const donorAxis=db.clone().sub(da);
  if (donorAxis.length()<1e-5 || donorAxis.clone().normalize().z<.5) return;
  const donorGround=lowestVisible(donor,df,wanted.parts), donorTop=Math.max(da.z,db.z);
  if (!(da.z-donorGround<.06*Math.max(1e-5,donorTop-donorGround))) return;
  const ends=item.ends.map(end => mean(end.map(({gi,v}) => at(own.Geosets[gi].Vertices,v))));
  const axis=ends[1].clone().sub(ends[0]), length=axis.length();
  if (length<1e-5) return;
  axis.normalize();
  const world=stand.world.get(hand);
  const place=p => p.clone().sub(fit.grip).applyQuaternion(turn).add(destination).applyMatrix4(world);
  const foot=place(ends[0]), up=place(ends[0].clone().add(axis)).sub(foot);
  if (up.z<.3) return;
  const ground=lowestVisible(result,stand,item.parts);
  if (!Number.isFinite(ground)) return;
  const along=(foot.z-ground)/up.z;
  const level=fit.grip.clone().sub(ends[0]).dot(axis)+along;
  const clamped=Math.max(.05*length,Math.min(.95*length,level));
  fit.grip.addScaledVector(axis,clamped-fit.grip.clone().sub(ends[0]).dot(axis));
  fit.planted={footAbove:foot.z-ground,fraction:clamped/length};
}

const ON_SHAFT = .12, OFF_SHAFT = .3, ALREADY = .1;
// The point of the item's surface, at fraction t from base to head, nearest the palm.
function surfaceAt(frame,parts,base,head,t,palm) {
  const axis=head.clone().sub(base), length2=Math.max(1e-8,axis.lengthSq()), band=.05;
  const tri=new Triangle(), nearest=vector();
  let best=null,gap=Infinity;
  for (const {gi,faces} of parts) for (let i=0;i<faces.length;i+=3) {
    const ps=[0,1,2].map(j => frame.point(gi,faces[i+j]));
    tri.set(...ps);
    if (tri.getArea()<1e-7) continue;
    tri.closestPointToPoint(palm,nearest);
    const f=nearest.clone().sub(base).dot(axis)/length2;
    if (Math.abs(f-t)>band) continue;
    const d=nearest.distanceToSquared(palm);
    if (d<gap) { gap=d; best=nearest.clone(); }
  }
  return best;
}
// perClip (plan step 7, Two-hand grip): instead of the donor's Stand reading two hands, each animation is treated when the
// donor's other palm is on its weapon (within ON_SHAFT) in at least TWO_HANDED_SHARE of its sampled moments.
export const TWO_HANDED_SHARE = .3;
function holdSupport(result,donor,rigA,donorMap,limbEntries,source,target,{item,wanted},{perClip=false}={}) {
  if (!item.ends || !wanted.ends || !perClip && !wanted.support) return null;
  const donorOther = target.hands.find(h => h!==wanted.hand && h.patch?.length);
  if (!donorOther) return null;
  const paired = limbEntries.find(e => e.theirs.marker===donorOther.arm.marker)?.own;
  const ownOther = source.hands.find(h => h.arm.marker===paired?.marker);
  if (!ownOther?.patch?.length) return null;
  const joints = donorOther.arm.joints.slice(-3).map(id => donorMap[id] ?? null);
  if (joints.length<3 || joints.some(id => id==null || !result.Nodes[id])) return null;
  const nodes = joints.map(id => result.Nodes[id]);
  const reach = donorOther.arm.length;
  const segment = (a,b,p) => {
    const ab=b.clone().sub(a), t=Math.max(0,Math.min(1,p.clone().sub(a).dot(ab)/Math.max(1e-8,ab.lengthSq())));
    return {t,point:a.clone().addScaledVector(ab,t)};
  };
  let moments=0, before=0, after=0;
  for (const [di,seq] of donor.Sequences.entries()) {
    const si = result.Sequences.findIndex(s => s.Name===seq.Name && s.Interval[0]===seq.Interval[0] && s.Interval[1]===seq.Interval[1]);
    if (si<0 || /^(death|decay|dissipate|portrait)/i.test(seq.Name.trim())) continue;
    const [a,z] = seq.Interval, times = new Set([a,z]);
    for (let f=a; f<z; f+=33) times.add(Math.round(f));
    for (const n of nodes) for (const k of n.Rotation?.Keys || []) if (k.Frame>=a && k.Frame<=z) times.add(k.Frame);
    const frames = [...times].sort((x,y) => x-y), values = [new Map(),new Map()];
    // First the wanted pull at each moment, then a smooth blend over neighbouring
    // moments, so the arm eases on and off the shaft instead of snapping.
    const wants = frames.map(frame => {
      const phase = z>a ? (frame-a)/(z-a) : 0;
      const df = pose(donor,di,phase), rf = pose(result,si,phase);
      const [da,db] = wanted.ends.map(end => endAt(end,df));
      const dpalm = palmAt(donorOther,df), touch = contacts(donor,df,wanted.parts,dpalm);
      if (!touch) return {rf,weight:0,shift:vector(),off:0,on:false};
      const donorGrip = segment(da,db,touch.world), gap = touch.gap/reach;
      const on = gap<=ON_SHAFT;
      const contact = gap<=ON_SHAFT ? 1 : gap>=OFF_SHAFT ? 0 : (OFF_SHAFT-gap)/(OFF_SHAFT-ON_SHAFT);
      if (!contact) return {rf,weight:0,shift:vector(),off:0,on};
      const [ra,rb] = item.ends.map(end => endAt(end,rf)), rpalm = palmAt(ownOther,rf);
      const spot = surfaceAt(rf,item.parts,ra,rb,donorGrip.t,rpalm);
      if (!spot) return {rf,weight:0,shift:vector(),off:0,on};
      const off = rpalm.distanceTo(spot)/reach;
      const need = off<=ALREADY*.4 ? 0 : off>=ALREADY ? 1 : (off-ALREADY*.4)/(ALREADY*.6);
      return {rf,weight:contact*need,shift:spot.sub(rpalm),off,on};
    });
    if (perClip && wants.filter(w => w.on).length < TWO_HANDED_SHARE*wants.length) continue;
    if (!wants.some(w => w.weight>0)) continue;
    const SPAN = 4;
    const eased = wants.map((_,k) => {
      let weight=0, total=0;
      const shift=vector();
      for (let j=Math.max(0,k-SPAN); j<=Math.min(wants.length-1,k+SPAN); j++) {
        const fall = 1-Math.abs(j-k)/(SPAN+1);
        weight += fall*wants[j].weight; total += fall;
        shift.addScaledVector(wants[j].shift,fall*wants[j].weight);
      }
      const sum = wants.slice(Math.max(0,k-SPAN),k+SPAN+1).reduce((n,w,i) => n+(1-Math.abs(Math.max(0,k-SPAN)+i-k)/(SPAN+1))*w.weight,0);
      return {weight:weight/total, shift:sum>1e-6 ? shift.divideScalar(sum) : shift};
    });
    for (const [k,frame] of frames.entries()) {
      const {rf,off} = wants[k], {weight,shift} = eased[k];
      if (weight<1e-3) { for (let i=0;i<2;i++) values[i].set(frame, v => v); continue; }
      const [root,middle,end] = nodes.map(n => vector().fromArray(nodePivot(result,n,n.ObjectId)).applyMatrix4(rf.world.get(n.ObjectId)));
      const lengths = [root.distanceTo(middle),middle.distanceTo(end)];
      if (Math.min(...lengths)<1e-5) { for (let i=0;i<2;i++) values[i].set(frame, v => v); continue; }
      const goal = end.clone().addScaledVector(shift,weight);
      // Never lock the arm straight: near full reach a tiny change of target
      // swings the elbow. Ease the reach toward 97% of the arm's length.
      const full = lengths[0]+lengths[1], soft = .88*full, cap = .97*full, far = root.distanceTo(goal);
      if (far>soft) goal.sub(root).setLength(soft+(cap-soft)*(1-Math.exp(-(far-soft)/(cap-soft)))).add(root);
      const solved = solveTwoBone({root,middle,end,lengths,tolerance:1e-5},goal);
      const turn = (from,to) => new Quaternion().setFromUnitVectors(from.normalize(),to.normalize());
      const deltas = [turn(middle.clone().sub(root),solved.middle.clone().sub(root)),turn(end.clone().sub(middle),solved.end.clone().sub(solved.middle))];
      let parentDelta = new Quaternion();
      for (let i=0;i<2;i++) {
        const parent = rotation(rf.world.get(nodes[i].Parent) || new Matrix4());
        const local = parent.clone().invert().multiply(parentDelta.clone().invert()).multiply(deltas[i]).multiply(parent);
        values[i].set(frame, v => local.clone().multiply(new Quaternion().fromArray(v)).normalize().toArray());
        parentDelta = deltas[i];
      }
      if (wants[k].weight>0) { moments++; before+=off; after+=Math.max(0,off-shift.length()*weight/reach); }
    }
    if (values[0].size) for (let i=0;i<2;i++) rewriteTrack(result,nodes[i],si,frames,values[i],'Rotation');
  }
  return moments ? {moments,palmGapBefore:before/moments,palmGapAfter:after/moments} : null;
}

/** Two-hand grip (plan step 7): the result's other hand onto the model's weapon wherever it is (seated on the hand or riding
 * the donor's weapon bone), in each animation where the donor holds its weapon with both hands (holdSupport perClip).
 * Items are paired as seatWeapon pairs them; an item on bones the user keeps is left alone. -> [{carrier, ...}] or null */
export function secondHandOnWeapon(result, own, donor, rigB, rigA, donorMap, limbEntries, keep) {
  const source = readWeapon(own,rigB), target = source && readWeapon(donor,rigA);
  if (!target) return null;
  const matched = new Set(), report = [];
  for (const item of source.items) {
    if (item.parts.some(p => [...p.ids].some(id => source.tree.ancestors(id,true).some(ancestor => keep.has(ancestor))))) continue;
    const available = target.items.filter(t => !matched.has(t));
    if (!available.length) break;
    const wanted = available.find(t => t.hand.arm.key===item.hand.arm.key) ?? available[0];
    matched.add(wanted);
    const held = holdSupport(result,donor,rigA,donorMap,limbEntries,source,target,{item,wanted},{perClip:true});
    if (held) report.push({carrier:item.carrier,...held});
  }
  return report.length ? report : null;
}

/** How often the result's other hand holds the weapon where the donor's does (plan step 7): over the moments where the
 * donor's other palm is on its weapon (within ON_SHAFT), the share where the result's other palm is within 0.2 arm of the
 * model's weapon. `donor` as built (mirrored when the build was). -> { share, moments, clips: [{name, donorOn, share}] }
 * or null without both weapons and a second hand on each. */
export function secondHandShare(own, donor, mesh) {
  const rigOf = m => transferRig(m,{sequence:Math.max(0,standSequenceIndex(m))});
  const source = readWeapon(own,rigOf(own)), target = source && readWeapon(donor,rigOf(donor));
  const item = source?.items?.[0];
  if (!item || !target?.items?.length) return null;
  const wanted = target.items.find(t => t.hand.arm.key===item.hand.arm.key) ?? target.items[0];
  const donorOther = target.hands.find(h => h!==wanted.hand && h.patch?.length);
  const ownOther = source.hands.find(h => h!==item.hand && h.patch?.length && h.arm.side===donorOther?.arm.side) ?? source.hands.find(h => h!==item.hand && h.patch?.length);
  if (!donorOther || !ownOther) return null;
  const clips = [];
  let moments = 0, held = 0;
  for (const [di,seq] of donor.Sequences.entries()) {
    const si = mesh.Sequences.findIndex(s => s.Name===seq.Name && s.Interval[0]===seq.Interval[0] && s.Interval[1]===seq.Interval[1]);
    if (si<0 || /^(death|decay|dissipate|portrait)/i.test(seq.Name.trim()) || !(seq.Interval[1]>seq.Interval[0])) continue;
    const [a,z] = seq.Interval, times = new Set([a,z]);
    for (let f=a; f<z; f+=33) times.add(Math.round(f));
    let samples = 0, on = 0, kept = 0;
    for (const frame of times) {
      const phase = (frame-a)/(z-a), df = pose(donor,di,phase);
      samples++;
      const touch = contacts(donor,df,wanted.parts,palmAt(donorOther,df));
      if (!touch || touch.gap/donorOther.arm.length > ON_SHAFT) continue;
      on++;
      const rf = pose(mesh,si,phase), mine = contacts(mesh,rf,item.parts.filter(p => p.faces?.length),palmAt(ownOther,rf));
      if (mine && mine.gap/ownOther.arm.length <= .2) kept++;
    }
    if (!on) continue;
    clips.push({name:seq.Name.trim(),donorOn:on/samples,share:kept/on});
    moments += on; held += kept;
  }
  return {share:moments ? held/moments : null,moments,clips};
}

// ------------------------------------------------------------ the weapon stays in the hand (plan step 9)
// The donor holds its weapon at full strength at a palm gap of HELD_FULL arm or less, not at all from HELD_NONE (the same
// on/off fade as the second hand); the result may sit as far out as the donor's gap or the model's own Stand grip, plus
// GRIP_SLACK. Death, Decay, Dissipate and Portrait are left alone, as by the second hand.
export const HELD_FULL = .15, HELD_NONE = .30, GRIP_SLACK = .03;
const HAND_SKIP = /^(death|decay|dissipate|portrait)/i;
const heldStrength = gap => gap<=HELD_FULL ? 1 : gap>=HELD_NONE ? 0 : (HELD_NONE-gap)/(HELD_NONE-HELD_FULL);
const gripGap = (model, frame, hand, parts) => {
  const c = contacts(model,frame,parts.filter(p => p.faces?.length),palmAt(hand,frame));
  return c ? {gap:c.gap/hand.arm.length,world:c.world} : null;
};
// The model's own grip gap at its first Stand moment (how it holds its weapon).
const ownGripGap = (own, item) => { const si = standSequenceIndex(own); return si<0 ? 0 : gripGap(own,pose(own,si,0),item.hand,item.parts)?.gap ?? 0; };
function pairedWeapon(own, donor, rigB, rigA) {
  const source = readWeapon(own,rigB), target = source && readWeapon(donor,rigA);
  const item = source?.items?.[0];
  if (!item?.hand?.patch?.length || !target?.items?.length) return null;
  const wanted = target.items.find(t => t.hand.arm.key===item.hand.arm.key) ?? target.items[0];
  return wanted.hand?.patch?.length ? {source,target,item,wanted} : null;
}

/** Per donated animation (Death, Decay, Dissipate, Portrait left out), at 16 moments: the donor's grip-palm gap to its
 * weapon and the result's (`mesh`), in arm lengths, and the model's own Stand grip gap. `donor` as built (mirrored when
 * the build was). -> { ownGrip, clips: [{ name, rows: [{ donorGap, resultGap }] }] } or null without both weapons. */
export function handGapRows(own, donor, mesh) {
  const rigOf = m => transferRig(m,{sequence:Math.max(0,standSequenceIndex(m))});
  const pair = pairedWeapon(own,donor,rigOf(own),rigOf(donor));
  if (!pair) return null;
  const {item,wanted} = pair, clips = [];
  for (const [di,seq] of donor.Sequences.entries()) {
    const si = mesh.Sequences.findIndex(s => s.Name===seq.Name && s.Interval[0]===seq.Interval[0] && s.Interval[1]===seq.Interval[1]);
    if (si<0 || HAND_SKIP.test(seq.Name.trim()) || !(seq.Interval[1]>seq.Interval[0])) continue;
    const rows = [];
    for (let k=0;k<16;k++) {
      const phase = k/15, d = gripGap(donor,pose(donor,di,phase),wanted.hand,wanted.parts), r = gripGap(mesh,pose(mesh,si,phase),item.hand,item.parts);
      if (d && r) rows.push({donorGap:d.gap,resultGap:r.gap});
    }
    if (rows.length) clips.push({name:seq.Name.trim(),rows});
  }
  return {ownGrip:ownGripGap(own,item),clips};
}

/** Does the weapon leave the hand during an attack (plan step 9, decision 18)? Attack animations only; allowance = the
 * larger of the donor's gap and the model's own Stand grip gap, plus GRIP_SLACK; the weapon starts the animation within
 * the allowance, and over the moments where the donor holds its weapon (gap HELD_FULL or less) at least a tenth exceed the
 * allowance by 0.15 or more. Pure. -> { clip, share, excess } (excess: the largest over the held moments of the worst
 * qualifying attack) or null. */
export function leavesHand({ ownGrip = 0, clips = [] } = {}) {
  let found = null;
  for (const {name,rows} of clips) {
    if (!/^attack/i.test(name) || !rows.length) continue;
    const allowance = row => Math.max(row.donorGap,ownGrip)+GRIP_SLACK;
    if (rows[0].resultGap > allowance(rows[0])) continue;
    const held = rows.filter(row => row.donorGap<=HELD_FULL);
    if (!held.length) continue;
    const over = held.filter(row => row.resultGap-allowance(row) >= .15).length/held.length;
    if (over < .1) continue;
    const excess = Math.max(...held.map(row => row.resultGap-allowance(row)));
    if (!found || excess > found.excess) found = {clip:name,share:over,excess};
  }
  return found;
}
/** The largest excess over the held moments of one attack (by name) in a reading: to compare a build with and without. */
export function attackExcess({ ownGrip = 0, clips = [] } = {}, clip) {
  const rows = clips.find(c => c.name===clip)?.rows.filter(row => row.donorGap<=HELD_FULL) || [];
  return rows.length ? Math.max(...rows.map(row => row.resultGap-Math.max(row.donorGap,ownGrip)-GRIP_SLACK)) : null;
}

/** Weapon in hand (plan step 9): while the donor holds its weapon, the model's weapon is moved toward the palm by what it
 * sits further out than the donor's (or the model's own grip), eased as the second hand eases, written as Translation keys
 * on the one bone that carries the weapon and nothing else. Where the donor lets go, the weapon may leave as far as the
 * donor's. Not with Seat (a seated weapon is on the hand already). -> { moments, gapBefore, gapAfter } or null */
export function keepInHand(result, own, donor, rigB, rigA, donorMap, limbEntries, keep) {
  const pair = pairedWeapon(own,donor,rigB,rigA);
  if (!pair) return null;
  const {source,item,wanted} = pair;
  if (item.parts.some(p => [...p.ids].some(id => source.tree.ancestors(id,true).some(ancestor => keep.has(ancestor))))) return null;
  // The one result bone that carries the weapon, and only the weapon.
  const carriers = new Set(), mine = new Set(item.parts.flatMap(p => p.vertices.map(v => p.gi+':'+v)));
  for (const p of item.parts) for (const v of p.vertices) for (const id of vertexBones(result.Geosets[p.gi],v)) carriers.add(id);
  if (carriers.size!==1) return null;
  const [carrier] = carriers, node = result.Nodes[carrier];
  if (!node) return null;
  for (const [gi,g] of result.Geosets.entries()) for (let v=0; v<g.Vertices.length/3; v++)
    if (!mine.has(gi+':'+v) && vertexBones(g,v).includes(carrier)) return null;
  const ownGrip = ownGripGap(own,item), reach = item.hand.arm.length;
  let moments=0, before=0, after=0;
  for (const [di,seq] of donor.Sequences.entries()) {
    const si = result.Sequences.findIndex(s => s.Name===seq.Name && s.Interval[0]===seq.Interval[0] && s.Interval[1]===seq.Interval[1]);
    if (si<0 || HAND_SKIP.test(seq.Name.trim())) continue;
    const [a,z] = seq.Interval, times = new Set([a,z]);
    for (let f=a; f<z; f+=33) times.add(Math.round(f));
    for (const prop of ['Translation','Rotation']) for (const k of node[prop]?.Keys || []) if (k.Frame>=a && k.Frame<=z) times.add(k.Frame);
    const frames = [...times].sort((x,y) => x-y);
    const wants = frames.map(frame => {
      const phase = z>a ? (frame-a)/(z-a) : 0, df = pose(donor,di,phase), rf = pose(result,si,phase);
      const d = gripGap(donor,df,wanted.hand,wanted.parts), r = gripGap(result,rf,item.hand,item.parts);
      if (!d || !r) return {rf,weight:0,shift:vector(),excess:0};
      const excess = r.gap-(Math.max(d.gap,ownGrip)+GRIP_SLACK), strength = heldStrength(d.gap);
      if (excess<=0 || !strength) return {rf,weight:0,shift:vector(),excess:0};
      const toward = palmAt(item.hand,rf).sub(r.world);
      return {rf,weight:strength,shift:toward.lengthSq()>1e-12 ? toward.normalize().multiplyScalar(excess*reach) : vector(),excess};
    });
    if (!wants.some(w => w.weight>0)) continue;
    const SPAN = 4;
    const eased = wants.map((_,k) => {
      let weight=0, total=0;
      const shift=vector();
      for (let j=Math.max(0,k-SPAN); j<=Math.min(wants.length-1,k+SPAN); j++) {
        const fall = 1-Math.abs(j-k)/(SPAN+1);
        weight += fall*wants[j].weight; total += fall;
        shift.addScaledVector(wants[j].shift,fall*wants[j].weight);
      }
      const sum = wants.slice(Math.max(0,k-SPAN),k+SPAN+1).reduce((n,w,i) => n+(1-Math.abs(Math.max(0,k-SPAN)+i-k)/(SPAN+1))*w.weight,0);
      return {weight:weight/total, shift:sum>1e-6 ? shift.divideScalar(sum) : shift};
    });
    const values = new Map();
    for (const [k,frame] of frames.entries()) {
      const {rf,excess} = wants[k], {weight,shift} = eased[k];
      if (weight<1e-3) { values.set(frame, v => v); continue; }
      // The world shift taken into the carrier's parent frame.
      const parent = rf.world.get(node.Parent) || new Matrix4(), back = parent.clone().invert();
      const pivot = vector().fromArray(nodePivot(result,node,carrier)).applyMatrix4(rf.world.get(carrier));
      const local = pivot.clone().add(shift.clone().multiplyScalar(weight)).applyMatrix4(back).sub(pivot.clone().applyMatrix4(back));
      values.set(frame, v => [v[0]+local.x,v[1]+local.y,v[2]+local.z]);
      if (wants[k].weight>0) { moments++; before+=excess; after+=Math.max(0,excess-shift.length()*weight/reach); }
    }
    if (values.size) rewriteTrack(result,node,si,frames,values,'Translation');
  }
  return moments ? {moments,gapBefore:before/moments,gapAfter:after/moments} : null;
}

// ------------------------------------------------------------ is there something for Seat to repair? (plan step 6)
// Readers ported from the Fable review helpers (gapsum, plane, roll). `weapon` is readWeapon(own): its item and palm
// patches use the model's vertex numbers, which are valid on a transplant result of that model.
const GRIP_CLIPS = /^(stand|walk|attack)/i;
const median = xs => { const s = [...xs].sort((a,b) => a-b); return s.length ? s[s.length>>1] : null; };
const endPoints = (item, point) => item.ends.map(end => mean(end.map(({gi,v}) => point(gi,v))));

/** How `mesh` holds the model's weapon over its Stand, Walk and Attack animations (7 moments each, weapon shown): the
 * nearest palm's gap to the weapon surface in arm lengths (median, largest) and its place along the shaft (median, 0 butt
 * to 1 head). Null without a weapon or a palm patch. */
export function gripReading(weapon, mesh) {
  const item = weapon?.items?.[0];
  if (!item) return null;
  const gaps = [], places = [];
  for (const [si,s] of mesh.Sequences.entries()) {
    if (!GRIP_CLIPS.test(String(s.Name).trim()) || !(s.Interval[1] > s.Interval[0])) continue;
    for (let k=0;k<7;k++) {
      const f = Math.round(s.Interval[0] + (s.Interval[1]-s.Interval[0])*k/6);
      if (!item.parts.some(p => sampleGeosetAnimation(mesh,p.gi,f,si).alpha > .25)) continue;
      const world = sampleNodeMatrices(mesh,f,si), skin = new Map();
      const point = (gi,v) => { if (!skin.has(gi)) skin.set(gi,skinGeoset(mesh.Geosets[gi],world)); return at(skin.get(gi),v); };
      const reading = {world,frame:f,sequence:si,point};
      let best = null;
      for (const hand of weapon.hands.filter(h => h.patch?.length)) {
        const palm = mean(hand.patch.map(({gi,v}) => point(gi,v)));
        const c = contacts(mesh,reading,item.parts.filter(p => p.faces?.length),palm);
        if (c && (!best || c.gap/hand.arm.length < best.gap)) best = {gap:c.gap/hand.arm.length,world:c.world};
      }
      if (!best) continue;
      gaps.push(best.gap);
      if (item.ends) {
        const [a,b] = endPoints(item,point);
        places.push(best.world.clone().sub(a).dot(b.clone().sub(a))/Math.max(1e-8,b.distanceToSquared(a)));
      }
    }
  }
  return gaps.length ? {gap:median(gaps),gapMax:Math.max(...gaps),place:median(places)} : null;
}

// The shaft (butt to head) and the widest direction across it, at one moment.
function weaponLineAt(mesh, item, si, phase) {
  const {point} = pose(mesh,si,phase);
  return lineOf(item,point);
}
function lineOf(item, point) {
  const [b,h] = endPoints(item,point), axis = h.clone().sub(b).normalize();
  const points = item.parts.flatMap(p => p.vertices.map(v => point(p.gi,v))), centre = mean(points.map(p => p.clone()));
  const across = points.map(p => { const d = p.clone().sub(centre); return d.addScaledVector(axis,-d.dot(axis)); });
  let wide = new Vector3(1,.37,.21); wide.addScaledVector(axis,-wide.dot(axis)).normalize();
  for (let i=0;i<40;i++) { const n = vector(); for (const d of across) n.addScaledVector(d,d.dot(wide)); if (n.lengthSq() < 1e-12) break; wide = n.normalize(); }
  const thin = new Vector3().crossVectors(axis,wide).normalize();
  const spread = dir => Math.sqrt(across.reduce((sum,d) => sum + d.dot(dir)**2,0)/across.length);
  return {axis,wide,points,flat:spread(wide)/Math.max(1e-6,spread(thin))};
}

/** Median angle (deg) between the result's shaft and the donor's, world space, at 40% of each Stand, Walk and Attack the
 * two share (same name and start). `donor` is the donor as built (mirrored when the build was). Null without both ends. */
export function shaftAngle(result, weapon, donor, donorWeapon) {
  const item = weapon?.items?.[0], theirs = donorWeapon?.items?.[0];
  if (!item?.ends || !theirs?.ends) return null;
  const angles = [];
  for (const [di,s] of donor.Sequences.entries()) {
    if (!GRIP_CLIPS.test(String(s.Name).trim()) || !(s.Interval[1] > s.Interval[0])) continue;
    const si = result.Sequences.findIndex(x => x.Name === s.Name && x.Interval[0] === s.Interval[0]);
    if (si < 0) continue;
    angles.push(weaponLineAt(donor,theirs,di,.4).axis.angleTo(weaponLineAt(result,item,si,.4).axis)*180/Math.PI);
  }
  return median(angles);
}

/** How Seat moved the weapon from the plain result to the seated one at the first Stand moment: the rigid fit of its
 * vertices split into the turn of the shaft and the roll about it (deg, roll folded to 0-90: a blade has no front), and
 * `flat`, the weapon's widest cross-section spread over its thinnest. Null without a weapon, its ends or a Stand. */
export function weaponTurn(plain, seated, weapon) {
  const item = weapon?.items?.[0], si = standSequenceIndex(plain);
  if (!item?.ends || si < 0 || standSequenceIndex(seated) !== si) return null;
  const before = weaponLineAt(plain,item,si,0), after = weaponLineAt(seated,item,si,0);
  const matrix = similarity(before.points,after.points);
  if (!matrix) return null;
  const rotation = new Quaternion(), scale = vector(), offset = vector();
  matrix.decompose(offset,rotation,scale);
  const axis = before.axis, turned = axis.clone().applyQuaternion(rotation);
  const along = rotation.x*axis.x + rotation.y*axis.y + rotation.z*axis.z;
  const twist = new Quaternion(axis.x*along,axis.y*along,axis.z*along,rotation.w);
  const roll = twist.lengthSq() > 1e-12 ? 2*Math.acos(Math.min(1,Math.abs(twist.normalize().w)))*180/Math.PI : 0;
  return {turn:axis.angleTo(turned)*180/Math.PI,roll:Math.min(roll,180-roll),flat:before.flat};
}

/** The roll (deg, folded to 0-90) about the shaft between the model's own grip and the weapon as it sits in `mesh` (plan
 * step 6 fix): the grip hand's skin (palm patch and the vertices bound to the arm's last joint) is fitted from the model's
 * first Stand moment onto the same vertices of `mesh` at its first Stand moment; the model's own weapon is carried through
 * that fit and compared with the weapon in `mesh`. Null without a weapon, its ends, a hand skin or a Stand. */
export function rollFromOwn(own, weapon, mesh) {
  const item = weapon?.items?.[0], hand = item?.hand, si = standSequenceIndex(own), sm = standSequenceIndex(mesh);
  if (!item?.ends || !hand?.arm || si < 0 || sm < 0) return null;
  const last = hand.arm.joints.at(-1), skin = new Map((hand.patch || []).map(({gi,v}) => [gi+':'+v,{gi,v}]));
  own.Geosets.forEach((g,gi) => { for (let v=0;v<g.Vertices.length/3;v++) { const bones = vertexBones(g,v); if (bones.length && bones.every(id => id===last)) skin.set(gi+':'+v,{gi,v}); } });
  if (skin.size < 3) return null;
  const mine = pose(own,si,0), theirs = pose(mesh,sm,0), refs = [...skin.values()];
  const fit = similarity(refs.map(({gi,v}) => mine.point(gi,v)),refs.map(({gi,v}) => theirs.point(gi,v)));
  if (!fit) return null;
  const carried = lineOf(item,(gi,v) => mine.point(gi,v).applyMatrix4(fit)), shown = lineOf(item,theirs.point);
  const across = carried.wide.clone().addScaledVector(shown.axis,-carried.wide.dot(shown.axis));
  if (across.lengthSq() < 1e-12) return null;
  return Math.acos(Math.min(1,Math.abs(across.normalize().dot(shown.wide))))*180/Math.PI;
}

// The fixed numbers of plan step 6 (what they mean, not fitted): an end handle, a visible slide, a blade turned on its side,
// a shaft roughly like the donor's, the margin of "holds it as its own animations do".
export const SEAT_WITHHELD = Object.freeze({ gapMargin: .05, placeMargin: .08, shaftDegrees: 35, endHandle: .25, slide: .10, flat: 2, rollDegrees: 45 });

/** Seat weapon is withheld (a reason) when all three hold: (1) the plain result already holds the weapon as the model's own
 * animations do and points it within 35 deg of the donor's shaft (a flat weapon also rolled less than 45 deg from the
 * model's own grip), (2) Seat slides the hand off an end handle or leaves a flat weapon rolled 45 deg or more from the
 * model's own grip, (3) Seat gains no second hand. Otherwise null (Seat may be suggested). Pure.
 * numbers: { own, plain, seated: gripReading-like { gapMax, place }, shaft, flat, rollPlain, rollSeated (rollFromOwn), support } */
export function seatWithheld({ own, plain, seated, shaft, flat, rollPlain, rollSeated, support } = {}, limits = SEAT_WITHHELD) {
  if (!own || !plain || !seated || shaft == null) return null;
  const isFlat = flat != null && flat >= limits.flat;
  const holds = plain.gapMax <= own.gapMax + limits.gapMargin && own.place != null && plain.place != null &&
    Math.abs(plain.place - own.place) <= limits.placeMargin && shaft < limits.shaftDegrees &&
    (!isFlat || rollPlain != null && rollPlain < limits.rollDegrees);
  if (!holds || support) return null;
  if (own.place < limits.endHandle && seated.place != null && seated.place - own.place >= limits.slide) return 'slides the hand off the handle';
  if (isFlat && rollSeated != null && rollSeated >= limits.rollDegrees) return 'rolls the blade';
  return null;
}
