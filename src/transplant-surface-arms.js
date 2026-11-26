import { Matrix4,Quaternion,Vector3 } from 'three';
import { inheritedParentMatrix,isGlobalTrack,nodePivot,sampleGeosetAnimation,sampleNodeMatrices,skinGeoset } from './animation.js';
import { vertexBones } from './part-bones.js';
import { rewriteTrack } from './transplant-floor.js';

function fingers(model,rig,tree,part) {
  const reference=rig.reference,world=sampleNodeMatrices(model,reference.frame,reference.sequence);
  const shoulder=new Vector3().fromArray(nodePivot(model,model.Nodes[part.joints[0]])).applyMatrix4(world.get(part.joints[0]));
  const points=[];
  for(const [gi,g] of model.Geosets.entries()) {
    if(sampleGeosetAnimation(model,gi,reference.frame,reference.sequence).alpha<.5) continue;
    const verts=skinGeoset(g,world);
    for(let i=0;i<verts.length/3;i++){
      const ids=vertexBones(g,i);
      if(!ids.some(id=>tree.isAncestor(id,part.marker)) || ids.some(id=>tree.ancestors(id,true).some(j=>/weapon|axe|sword/i.test(model.Nodes[j].Name)))) continue;
      points.push({gi,i,d:new Vector3().fromArray(verts,3*i).distanceToSquared(shoulder)});
    }
  }
  return points.sort((a,b)=>b.d-a.d).slice(0,Math.min(points.length,Math.max(3,Math.ceil(points.length*.08))));
}

function direction(model,world,joint,sites){
  const cache=new Map(),v=new Vector3();
  for(const {gi,i} of sites){
    if(!cache.has(gi))cache.set(gi,skinGeoset(model.Geosets[gi],world));
    v.add(new Vector3().fromArray(cache.get(gi),3*i));
  }
  return v.divideScalar(sites.length).sub(new Vector3().fromArray(nodePivot(model,model.Nodes[joint])).applyMatrix4(world.get(joint)));
}

// A POSE wrist can end before the hand's visible reach. Align the skinned
// hand from the shoulder for multipart fists or long finger chains.
export function fitArmSurfaces(result,own,donor,rigB,rigA,treeB,treeA,entries,donorMap,trackMode = null) {
  for(const entry of entries) {
    if(entry.own.limbKind!=='arm' || entry.theirs.limbKind!=='arm')continue;
    const ownSites=fingers(own,rigB,treeB,entry.own),sourceSites=fingers(donor,rigA,treeA,entry.theirs);
    if(!ownSites.length || !sourceSites.length)continue;
    const shoulder=entry.theirs.joints[0],id=donorMap[shoulder],node=result.Nodes[id];
    if(!node || isGlobalTrack(node.Rotation,result))continue;
    for(const [si,s] of result.Sequences.entries()){
      if(!s.Interval || !/^(walk|stand|attack|spell)/i.test(s.Name))continue;
      const [a,b]=s.Interval,times=new Set([a,b]);
      for(let k=1;a+Math.round(k*1000/60)<b;k++)times.add(a+Math.round(k*1000/60));
      for(const k of node.Rotation?.Keys||[])if(k.Frame>=a&&k.Frame<=b)times.add(k.Frame);
      const turns=new Map(),frames=[...times].sort((x,y)=>x-y);
      for(const f of frames){
        const w=sampleNodeMatrices(result,f,si),d=sampleNodeMatrices(donor,f,si);
        const from=direction(result,w,id,ownSites),to=direction(donor,d,shoulder,sourceSites);
        if(from.lengthSq()<1e-5 || to.lengthSq()<1e-5)continue;
        const parent=inheritedParentMatrix(w.get(node.Parent)||new Matrix4(),node.Flags);
        if(Math.abs(parent.determinant())<1e-8)continue;
        const inverse=parent.clone().invert();
        const q=new Quaternion().setFromUnitVectors(from.transformDirection(inverse),to.transformDirection(inverse));
        if(Math.abs(q.w)<1-1e-8)turns.set(f,v=>q.clone().multiply(new Quaternion().fromArray(v)).normalize().toArray());
      }
      if(turns.size)rewriteTrack(result,node,si,frames,turns,'Rotation',trackMode);
    }
  }
}