import { Ray, Triangle, Vector3 } from 'three';
import { geosetSkinMatrix, inheritedParentMatrix, isGlobalTrack, nodePivot, sampleNodeMatrices, sampleTrack, skinGeoset } from './animation.js';
import { geosetAlphaTrack, geosetMaterialLayers, hasOnlyAdditiveLayers } from './geoset-extras.js';
import { vertexBones } from './part-bones.js';

const v = () => new Vector3();
const smooth = value => { const x = Math.max(0,Math.min(1,value)); return x*x*(3-2*x); };

// Select actual solid faces. A weapon may share a geoset with the wielder,
// and a glow plane below the weapon can be much nearer a hand than the shaft.
function solidFaces(model, accepts, stand, blended = false) {
  const faces = [];
  for (const [gi,g] of model.Geosets.entries()) {
    if (hasOnlyAdditiveLayers(geosetMaterialLayers(model,g))) continue;
    const interval = model.Sequences[stand].Interval;
    if (sampleTrack(geosetAlphaTrack(model,gi),interval[0],{interval,globalSequences:model.GlobalSequences,fallback:1}) < 0.001) continue;
    const members = Array.from({length:g.Vertices.length/3},(_,i) => {
      const ids = vertexBones(g,i);
      return ids.length && (blended ? ids.some(accepts) : ids.every(accepts));
    });
    for (let f=0; f<g.Faces.length; f+=3) {
      const indices = [g.Faces[f],g.Faces[f+1],g.Faces[f+2]];
      if (indices.every(i=>members[i])) faces.push({gi,indices});
    }
  }
  return faces;
}

function triangle(vertices, indices) {
  return new Triangle(...indices.map(i=>v().fromArray(vertices,3*i)));
}

function nearest(triangles, palm) {
  let best = null;
  for (const face of triangles) {
    if (face.getArea() < 1e-8) continue;
    const point = face.closestPointToPoint(palm,v()), gap = point.distanceTo(palm);
    if (!best || gap < best.gap) best = {face,point,gap};
  }
  return best;
}

function palmGap(hand, shaft) {
  let best = Infinity;
  const ray = new Ray(), hit = v(), direction = v();
  for (const palmFace of hand) for (const poleFace of shaft) {
    if (palmFace.getArea()<1e-8 || poleFace.getArea()<1e-8) continue;
    for (const [a,b] of [[palmFace,poleFace],[poleFace,palmFace]]) {
      const points = [a.a,a.b,a.c];
      for (let i=0; i<3; i++) {
        const p = points[i], end = points[(i+1)%3];
        best = Math.min(best,p.distanceToSquared(b.closestPointToPoint(p,hit)));
        direction.subVectors(end,p);
        const length = direction.length();
        if (length<1e-8) continue;
        ray.set(p,direction.divideScalar(length));
        if (ray.intersectTriangle(b.a,b.b,b.c,false,hit) && p.distanceToSquared(hit)<=length*length) return 0;
      }
    }
  }
  return Math.sqrt(best);
}

// An independently animated pole can slide between the donor's palms. When
// the bow and donor start in different hands, placing the bow once in Stand
// leaves it orbiting both hands in Attack. The grip is a material point of the
// bow. Place that point at the donor's solid-shaft contact on the fitted hand;
// all rotations, scales, visibility and the motion of an explicitly loose copy
// still come from the donor.
export function fitIndependentBowGrip({model,own,donor,ownStand,stand,ownBones,ownHand,
  preferred,arms,donorWeapon,resultWeapon,ownTree,donorTree,hipHeight}) {
  const bone = model.Nodes[resultWeapon];
  if (ownStand < 0 || stand < 0 || !bone || arms.length !== 2 || !arms.some(a=>a.id===preferred) ||
      isGlobalTrack(bone.Translation,model) || isGlobalTrack(bone.Rotation,model)) return;
  const donorFaces = solidFaces(donor,id=>id===donorWeapon,stand);
  const ownFaces = solidFaces(own,id=>ownBones.has(id),ownStand);
  if (!donorFaces.length || !ownFaces.length) return;
  const palm = (m,model,id) => v().fromArray(nodePivot(model,model.Nodes[id],id)).applyMatrix4(m.get(id));
  const ref = sampleNodeMatrices(own,own.Sequences[ownStand].Interval[0],ownStand);
  const ownSkin = new Map();
  const referenceTriangle = ({gi,indices}) => {
    if (!ownSkin.has(gi)) ownSkin.set(gi,skinGeoset(own.Geosets[gi],ref));
    return triangle(ownSkin.get(gi),indices);
  };
  const ownTriangles = ownFaces.map(referenceTriangle);
  const grip = nearest(ownTriangles,palm(ref,own,ownHand));
  if (!grip) return;
  const {gi,indices} = ownFaces[ownTriangles.indexOf(grip.face)];
  const resultGeo = model.Geosets[gi];
  if (!indices.every(i => { const ids=vertexBones(resultGeo,i); return ids.length && ids.every(id=>id===resultWeapon); })) return;
  const bary = grip.face.getBarycoord(grip.point,v()).toArray();
  const bindGrip = indices.reduce((p,i,j)=>p.addScaledVector(v().fromArray(resultGeo.Vertices,i*3),bary[j]),v());
  // A wrist pivot can stand outside the actual fingers. Locate a material
  // point on each fitted palm, including triangles with blended finger skin.
  const palms = new Map(), donorPalms = new Map();
  for (const arm of arms) {
    if (arm.own==null) return;
    const faces = solidFaces(own,id=>!ownBones.has(id) && ownTree.isAncestor(id,arm.own),ownStand,true);
    const triangles = faces.map(referenceTriangle);
    const anchor = nearest(triangles,arm.own===ownHand ? grip.point : palm(ref,own,arm.own));
    if (!anchor) return;
    const face = faces[triangles.indexOf(anchor.face)];
    palms.set(arm.id,{...face,bary:anchor.face.getBarycoord(anchor.point,v()).toArray()});
    const surface = solidFaces(donor,id=>donorTree.isAncestor(id,arm.id),stand,true);
    if (!surface.length) return;
    donorPalms.set(arm.id,surface);
  }
  const shaft = donorFaces.map(({gi,indices})=>triangle(donor.Geosets[gi].Vertices,indices));
  const contacts = matrices => {
    const weapon = matrices.get(donorWeapon);
    const posed = shaft.map(t => new Triangle(...[t.a,t.b,t.c].map(p=>p.clone().applyMatrix4(weapon))));
    const skin = new Map();
    return arms.map(arm => {
      const c = nearest(posed,palm(matrices,donor,arm.id));
      if (!c) return null;
      const hand = donorPalms.get(arm.id).map(({gi,indices}) => {
        if (!skin.has(gi)) skin.set(gi,skinGeoset(donor.Geosets[gi],matrices));
        return triangle(skin.get(gi),indices);
      });
      return {...arm,gap:palmGap(hand,posed),wrist:c.gap};
    });
  };
  const initial = contacts(sampleNodeMatrices(donor,donor.Sequences[stand].Interval[0],stand));
  if (initial.some(x=>!x)) return;
  const [first,other] = initial.sort((a,b)=>a.gap-b.gap);
  if (first.id===preferred || first.gap > 0.2*hipHeight || other.gap-first.gap < 0.2*hipHeight) return;

  const keys = new Map(), hands = new Map();
  const reach = 0.16*hipHeight;
  for (const [si,seq] of model.Sequences.entries()) {
    const interval = seq.Interval;
    if (!interval || !donor.Sequences[si]?.Interval) continue;
    const [lo,hi] = interval, frames = new Set([lo,hi]);
    // A second palm can brush a shaft during a two-handed wind-up. Use the
    // hand that keeps carrying it through this clip, until that palm lets go.
    const support = arms.map(arm=>({id:arm.id,held:0,gap:0,wrist:0}));
    for (let i=0; i<9; i++) {
      const phase = lo+(hi-lo)*(i+0.5)/9;
      for (const [j,contact] of contacts(sampleNodeMatrices(donor,phase,si)).entries()) {
        if (!contact) continue;
        if (contact.gap<=reach) support[j].held++;
        support[j].gap+=Math.min(contact.gap,hipHeight);
        support[j].wrist+=Math.min(contact.wrist,hipHeight);
      }
    }
    support.sort((a,b)=>b.held-a.held || a.gap-b.gap || a.wrist-b.wrist || Number(b.id===preferred)-Number(a.id===preferred));
    const carrying = support[0].id;
    for (let t=lo; t<hi; t+=1000/40) frames.add(Math.round(t));
    // Animations can teleport between adjacent integer keys.
    for (const m of [donor,model]) for (const node of m.Nodes) {
      for (const prop of ['Translation','Rotation','Scaling']) for (const k of node?.[prop]?.Keys || []) {
        if (k.Frame>=lo && k.Frame<=hi) frames.add(k.Frame);
      }
    }
    let previousHand = null;
    for (const frame of [...frames].sort((a,b)=>a-b)) {
      let holdingHand = -1;
      const t = v().fromArray(sampleTrack(bone.Translation,frame,{interval,globalSequences:model.GlobalSequences,fallback:[0,0,0]}));
      const c = contacts(sampleNodeMatrices(donor,frame,si));
      if (c.every(Boolean)) {
        const [primary,second] = c[0].id===carrying ? c : [c[1],c[0]];
        const near = Math.min(primary.gap,second.gap);
        // Keep the carrying hand when both palms contact the shaft. As it
        // leaves the shaft, the other hand takes the weapon. Beyond both palms
        // the original independent donor flight remains in force.
        const primaryShare = 1-smooth((primary.gap-Math.max(reach,second.gap))/reach);
        const held = 1-smooth((near-reach)/reach);
        if (held>=0.5) holdingHand = primaryShare>=0.5 ? primary.result : second.result;
        if (held>0) {
          const m = sampleNodeMatrices(model,frame,si);
          const target = a => {
            const face = palms.get(a.id), geo = model.Geosets[face.gi];
            return face.indices.reduce((p,i,j)=>p.addScaledVector(v().fromArray(geo.Vertices,i*3)
              .applyMatrix4(geosetSkinMatrix(geo,i,m)),face.bary[j]),v());
          };
          const wanted = target(second).lerp(target(primary),primaryShare);
          const actual = bindGrip.clone().applyMatrix4(m.get(resultWeapon));
          const parent = m.get(bone.Parent);
          const basis = parent && inheritedParentMatrix(parent,bone.Flags);
          if (!basis || Math.abs(basis.determinant())>1e-8) {
            if (basis) {
              const inv = basis.clone().invert();
              wanted.applyMatrix4(inv); actual.applyMatrix4(inv);
            }
            t.addScaledVector(wanted.sub(actual),held);
          }
        }
      }
      if (holdingHand!==previousHand) hands.set(frame,{Frame:frame,Vector:[holdingHand]});
      previousHand=holdingHand;
      keys.set(frame,{Frame:frame,Vector:new Float32Array(t.toArray())});
    }
  }
  if (!keys.size) return null;
  bone.Translation = {LineType:1,Keys:[...keys.values()].sort((a,b)=>a.Frame-b.Frame)};
  return {LineType:0,Keys:[...hands.values()].sort((a,b)=>a.Frame-b.Frame)};
}
