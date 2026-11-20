import { Triangle, Vector3 } from 'three';
import { inheritedParentMatrix, isGlobalTrack, nodePivot, sampleNodeMatrices, sampleTrack, skinGeoset } from './animation.js';
import { geosetAlphaTrack, geosetMaterialLayers, hasOnlyAdditiveLayers } from './geoset-extras.js';
import { vertexBones } from './part-bones.js';

const v = () => new Vector3();
const smooth = value => { const x = Math.max(0,Math.min(1,value)); return x*x*(3-2*x); };

// Select actual solid faces. A weapon may share a geoset with the wielder,
// and a glow plane below the weapon can be much nearer a hand than the shaft.
function solidFaces(model, accepts, stand) {
  const faces = [];
  for (const [gi,g] of model.Geosets.entries()) {
    if (hasOnlyAdditiveLayers(geosetMaterialLayers(model,g))) continue;
    const interval = model.Sequences[stand].Interval;
    if (sampleTrack(geosetAlphaTrack(model,gi),interval[0],{interval,globalSequences:model.GlobalSequences,fallback:1}) < 0.001) continue;
    const members = Array.from({length:g.Vertices.length/3},(_,i) => {
      const ids = vertexBones(g,i);
      return ids.length && ids.every(accepts);
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

// An independently animated pole can slide between the donor's palms. When
// the bow and donor start in different hands, placing the bow once in Stand
// leaves it orbiting both hands in Attack. The grip is a material point of the
// bow. Place that point at the donor's solid-shaft contact on the fitted hand;
// all rotations, scales, visibility and the motion of an explicitly loose copy
// still come from the donor.
export function fitIndependentBowGrip({model,own,donor,ownStand,stand,ownBones,ownHand,
  preferred,arms,donorWeapon,resultWeapon,size,hipHeight}) {
  const bone = model.Nodes[resultWeapon];
  if (ownStand < 0 || stand < 0 || !bone || arms.length !== 2 || !arms.some(a=>a.id===preferred) ||
      isGlobalTrack(bone.Translation,model)) return;
  const donorFaces = solidFaces(donor,id=>id===donorWeapon,stand);
  const ownFaces = solidFaces(own,id=>ownBones.has(id),ownStand);
  if (!donorFaces.length || !ownFaces.length) return;
  const palm = (m,model,id) => v().fromArray(nodePivot(model,model.Nodes[id],id)).applyMatrix4(m.get(id));
  const ref = sampleNodeMatrices(own,own.Sequences[ownStand].Interval[0],ownStand);
  const ownSkin = new Map();
  const ownTriangles = ownFaces.map(({gi,indices}) => {
    if (!ownSkin.has(gi)) ownSkin.set(gi,skinGeoset(own.Geosets[gi],ref));
    return triangle(ownSkin.get(gi),indices);
  });
  const grip = nearest(ownTriangles,palm(ref,own,ownHand));
  if (!grip) return;
  const {gi,indices} = ownFaces[ownTriangles.indexOf(grip.face)];
  const resultGeo = model.Geosets[gi];
  if (!indices.every(i => { const ids=vertexBones(resultGeo,i); return ids.length && ids.every(id=>id===resultWeapon); })) return;
  const bary = grip.face.getBarycoord(grip.point,v()).toArray();
  const bindGrip = indices.reduce((p,i,j)=>p.addScaledVector(v().fromArray(resultGeo.Vertices,i*3),bary[j]),v());
  const shaft = donorFaces.map(({gi,indices})=>triangle(donor.Geosets[gi].Vertices,indices));
  const contacts = matrices => {
    const weapon = matrices.get(donorWeapon);
    const posed = shaft.map(t => new Triangle(...[t.a,t.b,t.c].map(p=>p.clone().applyMatrix4(weapon))));
    return arms.map(arm => {
      const hand = palm(matrices,donor,arm.id);
      const c = nearest(posed,hand);
      return c && {...arm,hand,point:c.point,gap:c.gap};
    });
  };
  const initial = contacts(sampleNodeMatrices(donor,donor.Sequences[stand].Interval[0],stand));
  if (initial.some(x=>!x)) return;
  const [first,other] = initial.sort((a,b)=>a.gap-b.gap);
  if (first.id===preferred || first.gap > 0.2*hipHeight || other.gap-first.gap < 0.2*hipHeight) return;

  const keys = new Map();
  for (const [si,seq] of model.Sequences.entries()) {
    const interval = seq.Interval;
    if (!interval || !donor.Sequences[si]?.Interval) continue;
    const [lo,hi] = interval, frames = new Set([lo,hi]);
    for (let t=lo; t<hi; t+=1000/40) frames.add(Math.round(t));
    // Animations can teleport between adjacent integer keys.
    for (const m of [donor,model]) for (const node of m.Nodes) {
      for (const prop of ['Translation','Rotation','Scaling']) for (const k of node?.[prop]?.Keys || []) {
        if (k.Frame>=lo && k.Frame<=hi) frames.add(k.Frame);
      }
    }
    for (const frame of [...frames].sort((a,b)=>a-b)) {
      const t = v().fromArray(sampleTrack(bone.Translation,frame,{interval,globalSequences:model.GlobalSequences,fallback:[0,0,0]}));
      const c = contacts(sampleNodeMatrices(donor,frame,si));
      if (c.every(Boolean)) {
        const [primary,second] = c[0].id===preferred ? c : [c[1],c[0]];
        const near = Math.min(primary.gap,second.gap);
        // Keep the source bow hand when both palms contact the shaft. As it
        // leaves the shaft, the other hand takes the weapon. Beyond both palms
        // the original independent donor flight remains in force.
        const reach = 0.16*hipHeight;
        const primaryShare = 1-smooth((primary.gap-Math.max(reach,second.gap))/reach);
        const held = 1-smooth((near-reach)/reach);
        if (held>0) {
          const m = sampleNodeMatrices(model,frame,si);
          const target = a=>palm(m,model,a.result).addScaledVector(a.point.clone().sub(a.hand),size);
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
      keys.set(frame,{Frame:frame,Vector:new Float32Array(t.toArray())});
    }
  }
  if (keys.size) bone.Translation = {LineType:1,Keys:[...keys.values()].sort((a,b)=>a.Frame-b.Frame)};
}
