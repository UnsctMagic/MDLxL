import {Matrix4,Quaternion,Vector3} from 'three';
import {nodePivot,sampleNodeMatrices} from './animation.js';
import {vertexBones} from './part-bones.js';
import {solveTwoBone} from './pose-ik.js';
import {rewriteTrack} from './transplant-floor.js';

const V=()=>new Vector3();
const point=(m,id,w)=>V().fromArray(nodePivot(m,m.Nodes[id],id)).applyMatrix4(w.get(id));
const frame=(m,si)=>sampleNodeMatrices(m,m.Sequences[si].Interval[0],si);
function ends(points,palm){
  if(points.length<3)return null;
  const sorted=points.slice().sort((a,b)=>a.distanceToSquared(palm)-b.distanceToSquared(palm));
  const mean=group=>group.reduce((v,p)=>v.add(p),V()).multiplyScalar(1/group.length);
  const grip=mean(sorted.slice(0,Math.max(2,Math.ceil(sorted.length*.05))));
  sorted.sort((a,b)=>b.distanceToSquared(grip)-a.distanceToSquared(grip));
  return [grip,mean(sorted.slice(0,Math.max(2,Math.ceil(sorted.length*.025))))];
}
function geometry(m,tree,root,w){
 const pts=[];
 for(const g of m.Geosets)for(let i=0;i<g.Vertices.length/3;i++){const bs=vertexBones(g,i);if(bs.length===1&&tree.isAncestor(bs[0],root)&&w.has(bs[0]))pts.push(V().fromArray(g.Vertices,i*3).applyMatrix4(w.get(bs[0])))}
 return pts;
}
const dir=([a,b])=>b.clone().sub(a).normalize();
function nearestArm(m,rig,w,p){return Object.values(rig.parts).filter(a=>a.limbKind==='arm'&&w.has(a.marker)).sort((a,b)=>point(m,a.marker,w).distanceToSquared(p)-point(m,b.marker,w).distanceToSquared(p))[0]}
function shaftFraction(p,a,b){const ab=b.clone().sub(a);return p.clone().sub(a).dot(ab)/Math.max(1e-8,ab.lengthSq())}
function palm(m,arm){return m.Attachments?.find(a=>a.Parent===arm.marker&&/hand/i.test(a.Name))?.ObjectId??arm.marker}
function secondGrip(m,arm,rig,carrier,local){
 const free=Object.values(rig.parts).find(p=>p.limbKind==='arm'&&p.side!==arm.side);if(!free)return null;
 const poses=m.Sequences.map((s,i)=>[s,i]).filter(([s])=>/^stand ready|^walk|^attack/i.test(s.Name));let held=[];
 for(const [s,i]of poses){let ratios=[];for(const t of [0,.25,.5,.75]){let w=sampleNodeMatrices(m,Math.round(s.Interval[0]+t*(s.Interval[1]-s.Interval[0])),i);
 const [a,b]=local.map(p=>p.clone().applyMatrix4(w.get(carrier))),hand=point(m,palm(m,free),w),f=shaftFraction(hand,a,b);
 if(f>.04&&f<.98&&hand.distanceTo(a.clone().lerp(b,f))<.15*free.length)ratios.push(f)}
 if(ratios.length>=3)held.push(...ratios)}
 return held.length?held.sort((a,b)=>a-b)[held.length>>1]:null;
}
export function orientHeldSurface({model,own,donor,rigA,rigB,treeA,donorWeapon,donorMap,weaponVertices,remap,ownHand,donorStand,resultStand}){
 if(!weaponVertices.length||ownHand==null||donorWeapon==null||donorStand<0||resultStand<0)return;
 const old=frame(own,rigB.reference.sequence),d=frame(donor,donorStand),r=frame(model,resultStand),id=donorMap[donorWeapon];
 const arm=Object.values(rigB.parts).find(a=>a.limbKind==='arm'&&a.marker===ownHand);if(!arm||!r.has(id))return;
 const indices=weaponVertices.map(([g,v])=>[model.Geosets.indexOf(g),v]),unique=Array.from(new Map(indices.map(t=>[t.join('/'),t])).values());
 const pos=(m,g,v,w)=>{let geo=m.Geosets[g],bs=vertexBones(geo,v);if(bs.length!==1||!w.has(bs[0]))return null;return V().fromArray(geo.Vertices,v*3).applyMatrix4(w.get(bs[0]))};
 const nativePoints=unique.map(([g,v])=>pos(own,g,v,old)).filter(Boolean),native=ends(nativePoints,point(own,ownHand,old));if(!native)return;
 const resultHand=remap.get(weaponVertices[0][2]);if(!r.has(resultHand))return;
 let da=Object.values(rigA.parts).find(a=>a.limbKind==='arm'&&treeA.isAncestor(donorWeapon,a.marker));
 da??=nearestArm(donor,rigA,d,point(donor,donorWeapon,d));if(!da)return;
 let pts=geometry(donor,treeA,donorWeapon,d);if(pts.length<3)pts=geometry(donor,treeA,da.marker,d);
 const donorAxis=ends(pts,point(donor,da.marker,d)),resultAxis=ends(unique.map(([g,v])=>pos(model,g,v,r)).filter(Boolean),point(model,resultHand,r));if(!donorAxis||!resultAxis)return;
 const from=dir(resultAxis),to=dir(donorAxis),angle=from.angleTo(to),inv=r.get(id).clone().invert();
 const srcCarrier=vertexBones(own.Geosets[unique[0][0]],unique[0][1])[0];
 const local=(ax,w)=>ax.map(p=>p.clone().applyMatrix4(w.clone().invert()));
 const frac=secondGrip(own,arm,rigB,srcCarrier,local(native,old.get(srcCarrier)))??secondGrip(donor,da,rigA,donorWeapon,local(donorAxis,d.get(donorWeapon)));
 // A central grip makes either end of a symmetric bar equivalent.
 if (angle>Math.PI/2 && nativePoints.some(p=>p.clone().sub(native[0]).dot(dir(native))<-.55*native[0].distanceTo(native[1])))to.negate();
 if(from.angleTo(to)>Math.PI/6){const turn=new Quaternion().setFromUnitVectors(from,to),g=resultAxis[0],delta=new Matrix4().makeTranslation(g.x,g.y,g.z).multiply(new Matrix4().makeRotationFromQuaternion(turn)).multiply(new Matrix4().makeTranslation(-g.x,-g.y,-g.z));const affine=inv.clone().multiply(delta).multiply(r.get(id));
 for(const [gi,v]of unique){let geo=model.Geosets[gi];if(vertexBones(geo,v)[0]!==id)continue;geo.Vertices.set(V().fromArray(geo.Vertices,v*3).applyMatrix4(affine).toArray(),v*3);if(geo.Normals?.length===geo.Vertices.length)geo.Normals.set(V().fromArray(geo.Normals,v*3).transformDirection(affine).toArray(),v*3)}
 resultAxis[1].applyMatrix4(delta)}
 if(frac==null)return;
 const free=Object.values(rigA.parts).find(a=>a.limbKind==='arm'&&a.side!==da.side);if(!free||free.joints.length<3)return;
 const chain=free.joints.slice(-3).map(j=>donorMap[j]),mark=donorMap[palm(donor,free)]??chain[2];if(chain.some(j=>!model.Nodes[j])||!model.Nodes[mark])return;
 const anchor=resultAxis[0].clone().lerp(resultAxis[1],frac).applyMatrix4(inv);
 for(const [si,s]of model.Sequences.entries()){if(!/^(walk|attack|stand ready|spell)/i.test(s.Name))continue;
 const [a,b]=s.Interval,times=new Set([a,b]);for(let f=a;f<b;f+=33)times.add(f);for(let j of [id,...chain])for(let k of model.Nodes[j].Rotation?.Keys||[])if(k.Frame>=a&&k.Frame<=b)times.add(k.Frame);
 const frames=[...times].sort((x,y)=>x-y),tracks=[new Map(),new Map()];
 for(const f of frames){const w=sampleNodeMatrices(model,f,si),[root,middle,end]=[chain[0],chain[1],mark].map(j=>point(model,j,w));let target=anchor.clone().applyMatrix4(w.get(id));if(end.distanceTo(target)<.05*free.length)continue;let lengths=[root.distanceTo(middle),middle.distanceTo(end)];if(Math.min(...lengths)<1e-4)continue;
 const sol=solveTwoBone({root,middle,end,lengths,tolerance:1e-6},target);let upper=new Quaternion();for(let j=0;j<2;j++){let n=model.Nodes[chain[j]],wr=new Quaternion().setFromRotationMatrix(new Matrix4().extractRotation(w.get(chain[j]))),p=w.get(n.Parent),pr=p?new Quaternion().setFromRotationMatrix(new Matrix4().extractRotation(p)):new Quaternion();
 let u=(j?end.clone().sub(middle):middle.clone().sub(root)).applyQuaternion(upper).normalize(),v=(j?sol.end.clone().sub(sol.middle):sol.middle.clone().sub(root)).normalize(),q=new Quaternion().setFromUnitVectors(u,v);
 let local=pr.premultiply(upper).invert().multiply(q).multiply(upper).multiply(wr).normalize().toArray();tracks[j].set(f,()=>local);upper.premultiply(q)}}
 tracks.forEach((tr,j)=>{if(tr.size)rewriteTrack(model,model.Nodes[chain[j]],si,frames,tr)})}
}
