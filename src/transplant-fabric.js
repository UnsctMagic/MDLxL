import { Matrix4, Quaternion, Vector3 } from 'three';
import { geosetSkinMatrix, isGlobalTrack, nodePivot, sampleNodeMatrices, skinGeoset } from './animation.js';
import { corpseAndBackgroundGeosets, geosetMaterialLayers, isAdditiveLayer } from './geoset-extras.js';
import { vertexBones } from './part-bones.js';

const props = ['Rotation','Translation','Scaling'];
const moving = n => props.some(k => n[k]?.Keys?.length > 1);
const mean = a => a.reduce((v,p) => v.add(p),new Vector3()).divideScalar(a.length);
const pivot = (m,id) => new Vector3().fromArray(nodePivot(m,m.Nodes[id],id));
const pose = (m,r) => sampleNodeMatrices(m,r.reference.frame,r.reference.sequence);
const under = (tree,root) => [...tree.byId.keys()].filter(id => tree.isAncestor(id,root));

function surface(m,world) {
  const hidden = corpseAndBackgroundGeosets(m), vertices = [];
  for (const [gi,g] of m.Geosets.entries()) {
    if (hidden.has(gi) || !geosetMaterialLayers(m,g).some(l=>!isAdditiveLayer(l))) continue;
    const points = skinGeoset(g,world);
    for (let v=0; v<points.length/3; v++) {
      const ids = vertexBones(g,v);
      if (ids.length) vertices.push({g,v,ids,p:new Vector3().fromArray(points,v*3)});
    }
  }
  return vertices;
}

// A tail is read by POSE. Independent skirt controls sit around the lower body,
// outside its limbs, and carry skin near the hem via unanimated mesh children.
function hems(m,r,t,world) {
  if (r.parts.tail) {
    // POSE can also name a trailing hood or head ornament as a tail. A
    // pelvic chain must actually branch from the hips before any other part.
    const root=r.parts.tail.joints[0], hips=new Set([r.body,...(r.parts.hips?.joints || [])]);
    const bodyParts=new Set(Object.entries(r.parts).filter(([key])=>key!=='tail').flatMap(([,p])=>p.joints));
    const host=t.ancestors(root).find(id=>bodyParts.has(id));
    if(!hips.has(host))return [];
    // A static weighted socket may be the pelvis itself. Its moving children
    // do not establish that the skin on the socket is free to swing.
    if(!moving(t.byId.get(root)) && surface(m,world).some(v=>v.ids.includes(root)))return [];
    return [{root,host,tail:true}];
  }
  const body=r.body, base=t.parentOf(body);
  if (base==null) return [];
  const candidates=(t.children.get(base)||[]).filter(n=>n.ObjectId!==body && moving(n) &&
    (t.children.get(n.ObjectId)||[]).some(child=>m.Bones.includes(child) && !moving(child)));
  if(candidates.length<3)return [];
  const hip=pivot(m,body).applyMatrix4(world.get(body)), h=r.hipHeight, skin=surface(m,world);
  const panels=[];
  for(const node of candidates) {
    const ids=new Set(under(t,node.ObjectId));
    if([...ids].some(id=>id!==node.ObjectId && moving(t.byId.get(id))))continue;
    const points=skin.filter(v=>v.ids.some(id=>ids.has(id))).map(v=>v.p);
    if(points.length<3)continue;
    const c=mean(points);
    if(c.z>hip.z-.55*h || (c.x>hip.x && Math.abs(c.y-hip.y)<.35*h))continue;
    if(!points.some(p=>p.x<hip.x-.2*h))continue;
    panels.push({root:node.ObjectId,centre:c});
  }
  return panels.length>=3 && panels.some(p=>p.centre.y>hip.y) && panels.some(p=>p.centre.y<hip.y) ? panels : [];
}

// Long, hanging skinned branches on the trunk. Reject the main limbs and
// anything with hand or weapon attachments. Split a flared skirt at its forks.
function fabric(m,r,t,world) {
  if(r.parts.tail || !r.parts.chest || r.actors?.length>1)return [];
  const skin=surface(m,world), pelvis=pivot(m,r.body).applyMatrix4(world.get(r.body)),h=r.hipHeight;
  const trunk=new Set([r.body,...t.ancestors(r.parts.chest.marker,true)]);
  const anatomy=new Set(Object.entries(r.parts).filter(([k,p])=>['head','armL','armR'].includes(k)||p.limbKind==='leg').flatMap(([,p])=>p.joints));
  for(const n of m.Attachments||[])if(/hand|weapon/i.test(n.Name))anatomy.add(n.ObjectId);
  const found=[];
  function strip(root) {
    const ids=new Set(under(t,root));
    const points=skin.filter(v=>v.ids.every(id=>ids.has(id)));
    const active=[...ids].filter(id=>moving(t.byId.get(id)) && points.some(v=>v.ids.some(j=>t.isAncestor(j,id))));
    if(active.length<2 || points.length<8)return;
    const start=pivot(m,root).applyMatrix4(world.get(root));
    const ordered=points.sort((a,b)=>b.p.distanceToSquared(start)-a.p.distanceToSquared(start));
    const tips=ordered.slice(0,Math.max(3,Math.ceil(ordered.length*.12))), end=mean(tips.map(v=>v.p));
    if(start.z-end.z<.48*h || end.z>pelvis.z-.3*h)return;
    return {root,host:t.parentOf(root),points,tips,start,end,active};
  }
  for(const host of trunk)for(const child of t.children.get(host)||[]) {
    const root=child.ObjectId;
    if(trunk.has(root)||[...anatomy].some(j=>t.isAncestor(j,root)))continue;
    const branches=(t.children.get(root)||[]).map(n=>strip(n.ObjectId)).filter(Boolean);
    if(branches.length>=3 && branches.some(b=>b.end.y>pelvis.y+.2*h) && branches.some(b=>b.end.y<pelvis.y-.2*h)) {
      found.push(branches);continue;
    }
    const branch=strip(root);
    if(!branch)continue;
    const ys=branch.points.map(v=>v.p.y);
    if(branch.end.x<pelvis.x-.15*h && branch.start.x<pelvis.x && Math.max(...ys)-Math.min(...ys)>.4*h)
      found.push([branch]);
  }
  return found.length===1 ? found[0] : [];
}

function landmarks(b,u) {
  const length=b.start.distanceTo(b.end), n=Math.max(3,Math.ceil(.12*b.points.length));
  return [...b.points].sort((a,c)=>Math.abs(a.p.distanceTo(b.start)/length-u)-Math.abs(c.p.distanceTo(b.start)/length-u)).slice(0,n);
}
function regionCentre(points,world) {
  return mean(points.map(({g,v})=>new Vector3().fromArray(g.Vertices,v*3).applyMatrix4(geosetSkinMatrix(g,v,world))));
}
function rotation(from,to) {
  return from.lengthSq()>1e-7 && to.lengthSq()>1e-7 ? new Quaternion().setFromUnitVectors(from.clone().normalize(),to.clone().normalize()) : new Quaternion();
}
function orbit(q,p) {
  return new Matrix4().makeRotationFromQuaternion(q).setPosition(p.clone().sub(p.clone().applyQuaternion(q)));
}

export function fabricMotion(own,donor,rigB,rigA,tB,tA,keep,jointTarget) {
  const output=new Map(), B=pose(own,rigB), targets=hems(own,rigB,tB,B);
  if(!targets.length)return output;
  const A=pose(donor,rigA), sources=fabric(donor,rigA,tA,A);
  if(!sources.length)return output;
  const skin=surface(own,B), hip=pivot(own,rigB.body).applyMatrix4(B.get(rigB.body));
  const pelvis=pivot(donor,rigA.body).applyMatrix4(A.get(rigA.body));
  const plans=[];
  for(const target of targets) {
    const ids=new Set(under(tB,target.root).filter(id=>own.Bones.includes(tB.byId.get(id))||own.Helpers?.includes(tB.byId.get(id))));
    if([...ids].some(id=>keep.has(id))||tB.ancestors(target.root).some(id=>keep.has(id)))return output;
    const skinHere=skin.filter(v=>v.ids.some(id=>ids.has(id)));
    if(!skinHere.length)return output;
    // Where the rim is supported by the rest of the garment, measured on
    // adjoining triangles. The body pivot may be well above that seam.
    const seam=[];
    if (!target.tail) for(const g of new Set(skinHere.map(v=>v.g))) {
      const indices=new Set(skinHere.filter(v=>v.g===g).map(v=>v.v)), adjacent=new Set();
      for(let i=0;i<g.Faces.length;i+=3) {
        const tri=g.Faces.subarray(i,i+3);
        if(tri.some(v=>indices.has(v))) for(const v of tri) if(!indices.has(v)) adjacent.add(v);
      }
      const points=skinGeoset(g,B);
      for(const v of adjacent) seam.push(new Vector3().fromArray(points,3*v));
    }
    const anchor=target.tail ? pivot(own,target.root).applyMatrix4(B.get(target.root)) : seam.length ? mean(seam) : hip;
    const end=mean([...skinHere].sort((a,b)=>b.p.distanceToSquared(anchor)-a.p.distanceToSquared(anchor)).slice(0,Math.max(3,Math.ceil(skinHere.length*.12))).map(v=>v.p));
    const dir=end.clone().sub(anchor), bearing=dir.clone().setZ(0).normalize();
    const score=b=>b.end.clone().sub(pelvis).setZ(0).normalize().dot(bearing);
    const b=[...sources].sort((a,c)=>score(c)-score(a))[0];
    // A single side panel cannot establish the motion of a centreline tail.
    // Use the bind geometry here: a complete cape can swing across the body.
    if(target.tail && sources.length===1 && Math.abs(pivot(own,target.root).y-pivot(own,rigB.body).y)<.15*rigB.hipHeight){
      const lower=[...b.points].sort((a,c)=>a.g.Vertices[a.v*3+2]-c.g.Vertices[c.v*3+2]).slice(0,Math.ceil(b.points.length/2));
      const centre=pivot(donor,rigA.body).y, margin=.03*rigA.hipHeight;
      if(!lower.some(v=>v.g.Vertices[v.v*3+1]<centre-margin) || !lower.some(v=>v.g.Vertices[v.v*3+1]>centre+margin))return output;
    }
    const tracks=b.active.flatMap(id=>props.map(k=>tA.byId.get(id)[k]).filter(tr=>tr?.Keys?.length>1));
    const clocks=new Set(tracks.map(tr=>isGlobalTrack(tr,donor)?tr.GlobalSeqId:null));
    if(clocks.size!==1)return output;
    const host=target.host ?? rigB.body;
    const donorHost=host===rigB.body ? rigA.body : jointTarget.get(host);
    if(donorHost==null)return output;
    const clock=[...clocks][0], reference=B.get(host).clone().invert();
    const sorted=[...ids].sort((a,c)=>tB.depth(a)-tB.depth(c));
    for(const id of sorted) {
      const node=tB.byId.get(id), parent=tB.parentOf(id);
      const p=pivot(own,id).applyMatrix4(B.get(id));
      const articulates=id===target.root || moving(node) && (tB.children.get(id)?.length || skinHere.some(v=>v.ids.includes(id))) && target.tail;
      const at=target.tail ? p : anchor;
      // Each joint sees the donor's remaining span to the tip. The local
      // rotation below subtracts the turn already supplied by its parent.
      const fraction=Math.min(.85,Math.max(0,at.clone().sub(anchor).dot(dir)/dir.lengthSq()));
      plans.push({id,parent:ids.has(parent)?parent:null,b,at,clock,tracks,donorHost,
        start:fraction>.08 ? landmarks(b,fraction) : null, end,articulates,
        slide:!target.tail && id===target.root && !!node.Translation?.Keys?.length,
        span:end.distanceTo(hip)/Math.max(1,b.end.distanceTo(b.start)),
        reference, bind:B.get(id), pivot:pivot(own,id), rest:articulates?end.clone().sub(at):null});
    }
  }
  const turns=new Map(), keys=new Map(plans.map(p=>[p.id,{Rotation:new Map(),Translation:new Map(),Scaling:new Map()}]));
  const sourceSpan=(p,world)=>{
    const from=p.start?regionCentre(p.start,world):pivot(donor,p.b.root).applyMatrix4(world.get(p.b.root));
    const diff=regionCentre(p.b.tips,world).sub(from);
    const inv=world.get(p.b.host);
    if(!inv || Math.abs(inv.determinant())<1e-9)return null;
    // Compare both poses in the donor host's standing axes.
    return diff.transformDirection(A.get(p.b.host).clone().multiply(inv.clone().invert()));
  };
  const clock=plans[0].clock;
  if(plans.some(p=>p.clock!==clock))return output;
  for(const p of plans)if(p.articulates){
    p.base=sourceSpan(p,A);
    if(!p.base || p.rest.lengthSq()<1e-7)return output;
    p.basis=rotation(p.base,p.rest);
  }
  const clips=clock==null ? donor.Sequences.map((s,si)=>({si,range:s.Interval})):
    [{si:rigA.reference.sequence,range:[0,donor.GlobalSequences[clock]]}];
  let animated=false;
  for(const {si,range} of clips) {
    if(!range)continue;
    const [a,z]=range,times=new Set([a,z]);
    if(plans.some(p=>p.tracks.some(tr=>tr.Keys.filter(k=>k.Frame>=a && k.Frame<=z).length>1)))
      for(let f=a+16;f<z;f+=16)times.add(f);
    for(const p of plans)for(const tr of p.tracks)for(const k of tr.Keys)if(k.Frame>=a&&k.Frame<=z)times.add(k.Frame);
    for(const f of [...times].sort((x,y)=>x-y)) {
      const world=sampleNodeMatrices(donor,clock==null?f:rigA.reference.frame,si,f);
      for(const p of plans) {
        const above=turns.get(p.parent)||new Matrix4();
        let transform=above;
        if(p.articulates) {
          const span=sourceSpan(p,world);
          if(!span)return new Map();
          const turn=rotation(p.base,span);
          if(turn.angleTo(new Quaternion())>.015)animated=true;
          const q=p.basis.clone().multiply(turn).multiply(p.basis.clone().invert());
          // Child origin follows the parent; its independent orientation bends the remaining length.
          transform=orbit(q,p.at);
          transform.setPosition(new Vector3().setFromMatrixPosition(transform).add(p.at.clone().applyMatrix4(above).sub(p.at)));
        }
        if(p.slide) {
          // Some garments have sliding hem controls rather than sewn hinges.
          // Carry the distal skin displacement in the host frame, in body-to-hem lengths.
          const space=A.get(p.b.host).clone().multiply(world.get(p.b.host).clone().invert());
          const tip=regionCentre(p.b.tips,world).applyMatrix4(space);
          const desired=p.end.clone().add(tip.sub(p.b.end).applyQuaternion(p.basis).multiplyScalar(p.span));
          transform.setPosition(new Vector3().setFromMatrixPosition(transform).add(desired.sub(p.end.clone().applyMatrix4(transform))));
        }
        turns.set(p.id,transform);
        const pose=p.reference.clone().multiply(transform).multiply(p.bind);
        const parent=p.parent==null?new Matrix4():p.reference.clone().multiply(above).multiply(B.get(p.parent));
        const local=parent.invert().multiply(pose), t=new Vector3(),q=new Quaternion(),s=new Vector3();
        local.decompose(t,q,s);
        t.copy(p.pivot).applyMatrix4(local).sub(p.pivot);
        const K=keys.get(p.id);
        if(p.last && q.dot(p.last)<0)q.set(-q.x,-q.y,-q.z,-q.w);
        p.last=q;
        for(const [name,val] of [['Rotation',q],['Translation',t],['Scaling',s]])K[name].set(f,{Frame:f,Vector:new Float32Array(val.toArray())});
      }
    }
  }
  if(!animated)return output;
  for(const p of plans){
    const tracks={};
    for(const k of props){
      const list=[...keys.get(p.id)[k].values()].sort((a,b)=>a.Frame-b.Frame), v=list[0].Vector;
      const same=(a,b)=>a.every((x,i)=>Math.abs(x-b[i])<1e-5);
      const identity=k==='Scaling'?[1,1,1]:k==='Translation'?[0,0,0]:[0,0,0,1];
      if(list.every(key=>same(key.Vector,v))){
        if(!same(v,identity))tracks[k]={LineType:0,GlobalSeqId:clock,Keys:list.filter(key=>clips.some(c=>c.range?.[0]===key.Frame))};
      } else tracks[k]={LineType:1,GlobalSeqId:clock,Keys:list};
    }
    output.set(p.id,{tracks,root:p.parent==null,host:p.donorHost,source:p.b.root,clock});
  }
  return output;
}
