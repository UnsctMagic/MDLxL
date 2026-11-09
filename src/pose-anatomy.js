import { Vector3 } from 'three';
import { allNodes, nodePivot } from './animation.js';
import { nodeIndex } from './node-hierarchy.js';
import { poseGeometryEvidence } from './pose-geometry.js';
import { inferPoseHeads, inferPoseReplacements } from './pose-heads.js';
import { poseAssemblyEvidence } from './pose-assemblies.js';
import { poseLimbRootEvidence } from './pose-limb-roots.js';
import { poseTorsoStations, inferPoseTorso } from './pose-torso.js';

const clamp = value => Math.max(0, Math.min(1, value));
const size = shape => Math.max(shape?.radius || 0, 1e-6);
const mass = shape => shape?.mass || 0;
const crossSectionRoundness = shape => shape?.eigenvalues?.[1] > 0 ? Math.sqrt(shape.eigenvalues[2] / shape.eigenvalues[1]) : 0;
const distanceToShape = (point, shape) => shape?.min ? point.distanceTo(point.clone().clamp(shape.min, shape.max)) : 0;
const rounded = value => Math.round(value * 1e6) / 1e6;

/** Analyse the native joint graph together with the surface it deforms. The
 * result is independent of node labels and object ordering. Candidates compete
 * on geometric evidence; symmetry and animation are never prerequisites. */
export function analyzePoseAnatomy(model, { nameRole } = {}) {
  const transforms = [...(model.Bones || []), ...(model.Helpers || [])], nodes = allNodes(model), tree = nodeIndex(model, nodes), { byId } = tree;
  const geometry = poseGeometryEvidence(model, { nodes: transforms, tree: nodeIndex(model, transforms) });
  const helper = new Set((model.Helpers || []).map(node => node.ObjectId));
  const nativeChildren = geometry.children;
  const pivot = id => new Vector3().fromArray(nodePivot(model, byId.get(id)));
  const hasHelper = new Map();
  for (const node of transforms) hasHelper.set(node.ObjectId, transforms.some(other => helper.has(other.ObjectId) && mass(geometry.subtree.get(other.ObjectId))>0 && other.ObjectId !== node.ObjectId && tree.isAncestor(other.ObjectId, node.ObjectId)));
  // Imported SD skin nodes often have an arbitrary mesh origin below their
  // actual Helper joint. Fold only the surface adapter, retaining the authored
  // id for a possible endpoint and retaining every descendant joint.
  const helperCorridors=[...helper].filter(id=>(nativeChildren.get(id)||[]).some(child=>helper.has(child.ObjectId)));
  const importedSurfaceGraph=helperCorridors.length>0 && helperCorridors.filter(id=>!mass(geometry.profiles.get(id))&&(nativeChildren.get(id)||[]).some(child=>!helper.has(child.ObjectId)&&mass(geometry.profiles.get(child.ObjectId))>0)).length/helperCorridors.length>.5;
  const folded = new Map(), joints = new Set();
  const ordered = transforms.slice().sort((a,b) => tree.depth(a.ObjectId)-tree.depth(b.ObjectId));
  for (const node of ordered) {
    const id = node.ObjectId, parent = byId.get(node.Parent);
    const helperBackbone = parent && helper.has(parent.ObjectId) && (helper.has(parent.Parent) || (nativeChildren.get(parent.ObjectId) || []).some(child => helper.has(child.ObjectId)));
    const ownShape=geometry.profiles.get(id), ownPoint=pivot(id);
    const mismatch=ownShape?.center ? distanceToShape(ownPoint,ownShape)/size(ownShape) : 0;
    const continuation=(nativeChildren.get(id)||[]).some(child=>{const shape=geometry.profiles.get(child.ObjectId);return mass(shape)>0&&distanceToShape(pivot(child.ObjectId),shape)<size(shape)&&crossSectionRoundness(shape)>.3;});
    const owner=folded.get(node.Parent)??node.Parent, ownerShape=geometry.measure([owner,...(nativeChildren.get(owner)||[]).map(n=>n.ObjectId)]);
    const subordinate=folded.has(node.Parent) && (importedSurfaceGraph || size(ownShape)<size(ownerShape)*.5);
    if (!helper.has(id) && !hasHelper.get(id) && (helperBackbone && (mass(ownShape)>0 && (importedSurfaceGraph || mismatch>1)) || subordinate)) folded.set(id, owner);
    else joints.add(id);
  }
  const children = new Map(), parent = new Map(), shapes = new Map();
  for (const id of joints) {
    let at = byId.get(id).Parent; while (folded.has(at)) at = byId.get(at)?.Parent;
    parent.set(id, joints.has(at) ? at : null);
    if (!children.has(parent.get(id))) children.set(parent.get(id), []);
    children.get(parent.get(id)).push(id);
    // A surface adapter's held descendants are not all part of its joint.
    const own = [id, ...[...folded].filter(([child, owner]) => owner === id && byId.get(child)?.Parent === id).map(([child]) => child)];
    if(!mass(geometry.measure(own)))for(const child of nativeChildren.get(id)||[]){const shape=geometry.profiles.get(child.ObjectId);if(mass(shape)&&pivot(child.ObjectId).distanceTo(pivot(id))<size(shape)*.5)own.push(child.ObjectId);}
    shapes.set(id, geometry.measure(own));
  }
  const effectivePoint = id => pivot(id);
  const extentBelow = new Map();
  const depthBelow = (id, seen = new Set()) => {
    if (extentBelow.has(id)) return extentBelow.get(id);
    if (seen.has(id)) return 0; seen.add(id);
    const value = 1 + Math.max(0, ...(children.get(id) || []).map(child => depthBelow(child, new Set(seen))));
    extentBelow.set(id,value); return value;
  };
  joints.forEach(id=>depthBelow(id));
  const jointSurface = id => shapes.get(id) || geometry.profiles.get(id);
  const sheetEvidence=shape=>shape?.eigenvalues?.[0]>0?Math.sqrt(shape.eigenvalues[1]/shape.eigenvalues[0])*(1-crossSectionRoundness(shape)):0;
  const fanCache=new Map();
  const membraneFan=id=>{
    if(fanCache.has(id))return fanCache.get(id);
    const rays=(children.get(id)||[]).filter(child=>mass(jointSurface(child))>0);
    const coherent=rays.reduce((sum,child)=>sum+mass(jointSurface(child))*sheetEvidence(jointSurface(child)),0)/Math.max(rays.reduce((sum,child)=>sum+mass(jointSurface(child)),0),1e-5);
    const evidence=rays.length>1?.8*Math.sqrt(sheetEvidence(geometry.subtree.get(id))*coherent):0;
    fanCache.set(id,evidence);return evidence;
  };
  const continuity = (a,b) => {
    const sa = jointSurface(a), sb = jointSurface(b), pa = effectivePoint(a), pb = effectivePoint(b), d=pa.distanceTo(pb);
    const gap = distanceToShape(pb,sa) / Math.max(size(sa),d*.25,1e-5);
    const attachment=(model.Attachments||[]).some(node=>node.ObjectId===b);
    const support = attachment && sa?.center ? Math.exp(-distanceToShape(pb,sa)/size(sa)) : mass(sb)>0 ? Math.sqrt(clamp((crossSectionRoundness(sb)+.1)/.7)) : 1;
    const owners=id=>[id,...[...folded].filter(([,owner])=>owner===id).map(([child])=>child)];
    const shared=owners(a).reduce((sum,id)=>sum+owners(b).reduce((s,other)=>s+(geometry.surfaceLinks.get(id)?.get(other)||0),0),0);
    const connection=shared/(shared+Math.sqrt(mass(sa)*mass(sb))*.1+1e-5);
    return Math.exp(-gap*.35) * (.35+.65*support) * (mass(sa)>0&&mass(sb)>0?.9+.1*connection:1);
  };
  const viableChildren = id => children.get(id) || [];
  const junctions = new Set([...joints].filter(id=>viableChildren(id).filter(child=>depthBelow(child)>=2).length>=2));
  const endpointAdapters = id => {
    const result=[];
    for(const node of nodes) {
      if(node.ObjectId===id || !(node.Parent===id || folded.get(node.Parent)===id)) continue;
      if((model.Attachments||[]).includes(node)) result.push({id:node.ObjectId,point:pivot(node.ObjectId),attachment:true});
      else if(folded.get(node.ObjectId)===id) {
        const s=geometry.profiles.get(node.ObjectId); if(!s?.center) continue;
        const p=pivot(node.ObjectId), useGrip=distanceToShape(p,s)>size(s);
        result.push({id:node.ObjectId,point:useGrip?s.center:p,...(useGrip?{grip:s.center.toArray()}:{})});
      }
    }
    return result;
  };
  const paths=[];
  const origins=[...joints].filter(id=>viableChildren(id).length>1 || parent.get(id)==null);
  for(const origin of origins) for(const first of viableChildren(origin)) {
    const pending=[{ids:[first],points:[effectivePoint(first)],seen:new Set([origin,first])}];
    while(pending.length){
      const {ids,points,seen}=pending.pop(),at=ids.at(-1), next=viableChildren(at).filter(id=>!seen.has(id));
      const addPath=(pathIds,pathPoints,adapter)=>{
        const nativeIds=pathIds;
        const retained=[];
        for(let index=0;index<pathPoints.length;index++)if(!retained.length||pathPoints[index].distanceTo(pathPoints[retained.at(-1)])>1e-7)retained.push(index);
        pathIds=retained.map(index=>pathIds[index]);pathPoints=retained.map(index=>pathPoints[index]);
        const length=pathPoints.slice(1).reduce((sum,p,i)=>sum+p.distanceTo(pathPoints[i]),0);
        const surface=geometry.measure(nativeIds.flatMap(id=>[id,...[...folded].filter(([,owner])=>owner===id).map(([child])=>child)]));
        const firstShape=jointSurface(first),originPoint=pivot(origin);
        const edgeScores=pathIds.slice(1).map((id,i)=>continuity(pathIds[i],id));
        const confidence=edgeScores.length?edgeScores.reduce((a,b)=>a+b,0)/edgeScores.length*.85:0;
        const overlapPenalty=Math.max(0,...pathIds.slice(1).map((id,i)=>{const a=jointSurface(pathIds[i]),b=jointSurface(id);return a?.center&&b?.center ? .25*(1-clamp(a.center.distanceTo(b.center)*2/(size(a)+size(b)))):0;}));
        paths.push({origin,ids:pathIds,points:pathPoints,length,surface,firstShape,confidence,overlapPenalty,terminal:next.length===0,adapterPenalty:adapter?(adapter.attachment?(ids.length>=3?.15:.2*Math.max(0,...viableChildren(at).filter(child=>viableChildren(child).length>1).map(child=>continuity(at,child)))):.22+(next.length?.15:0)):0,...(adapter?.grip?{grip:adapter.grip}:{})});
      };
      addPath(ids,points);
      if(ids.length>=2)for(const adapter of endpointAdapters(at))if(!seen.has(adapter.id)&&adapter.point.distanceTo(points.at(-1))>1e-5)addPath([...ids,adapter.id],[...points,adapter.point],adapter);
      for(const child of next){const point=effectivePoint(child);pending.push({ids:[...ids,child],points:[...points,point],seen:new Set([...seen,child])});}
    }
  }
  const headAnalysis=inferPoseHeads({model,geometry,tree,joints,children,parent,paths,pivot,jointSurface,nameRole});
  const headSet=new Set(headAnalysis.heads.map(head=>head.id));
  let headPaths=headAnalysis.heads.map(head=>({...head.path,ids:[...head.neckIds,head.id],head:{...head,index:head.neckIds.length},origin:head.origin}));
  const branches=paths.filter(p=>p.ids.length>=3 && p.length>1e-6);
  const {roles:roleByOrigin,evidence:stationEvidence}=poseTorsoStations({tree,children,parent,junctions,geometry,pivot,jointSurface,heads:headAnalysis.heads});
  const lateralAxes=new Map();
  for(const origin of origins){
    const kids=viableChildren(origin),scores=[0,0],o=pivot(origin);
    for(const a of kids){const v=pivot(a).sub(o);for(const axis of [0,1])scores[axis]+=Math.max(0,...kids.filter(b=>b!==a).map(b=>{const w=pivot(b).sub(o),mirror=v.clone();mirror.setComponent(axis,-mirror.getComponent(axis));return Math.exp(-mirror.distanceTo(w)/Math.max(v.length(),w.length(),1e-5)*4);}));}
    lateralAxes.set(origin,scores[0]>scores[1]?0:1);
  }
  const candidates=[],tailMeasures=[];
  for(const p of branches){
    const start=p.points[0],end=p.points.at(-1), d=end.clone().sub(start), down=(start.z-end.z)/Math.max(start.distanceTo(end),1e-5);
    const sheets=p.ids.map(id=>jointSurface(id)).filter(shape=>mass(shape)>0).map(shape=>Math.sqrt((shape.eigenvalues[1]||0)/Math.max(shape.eigenvalues[0],1e-6))*(1-crossSectionRoundness(shape)));
    const membrane=sheets.length?sheets.reduce((a,b)=>a+b,0)/sheets.length:0;
    // A small flat foot patch does not make its whole descending chain a
    // membrane. Measure how much of the joint path the surface can span.
    const surfaceReach=clamp((p.surface.extent?.length()||0)/Math.max(p.length,1e-6));
    const wing=membrane*surfaceReach;
    let roleOrigin=p.origin;while(!roleByOrigin.has(roleOrigin)&&parent.get(roleOrigin)!=null)roleOrigin=parent.get(roleOrigin);
    const peerRoots=[...new Set(branches.filter(other=>other.origin===p.origin&&other.ids[0]!==p.ids[0]).map(other=>other.ids[0]))];
    const peerHeights=peerRoots.map(id=>pivot(id).z).sort((a,b)=>a-b);
    const peerLevel=peerHeights.length?peerHeights[Math.floor(peerHeights.length/2)]:start.z;
    const elevatedDeparture=clamp((start.z-peerLevel)/Math.max(start.distanceTo(pivot(p.origin)),1e-5));
    const roleScore=(roleByOrigin.get(roleOrigin)==='Chest'?1:-1)+2*elevatedDeparture;
    let kind=roleScore>0?'arm':'leg',label;
    if(wing>.35){kind='arm';label='Wing';}
    const distal=jointSurface(p.ids.at(-1)),proximal=jointSurface(p.ids[0]);
    const taperedTube=distal?.eigenvalues?.[0]>0?Math.sqrt((distal.eigenvalues[1]||0)/distal.eigenvalues[0]):1;
    if(!label&&p.ids.length>3&&taperedTube<.35&&mass(distal)<Math.max(...p.ids.slice(0,-1).map(id=>mass(jointSurface(id)))))label='Chain';
    const lateralAxis=lateralAxes.get(p.origin)??null;
    const peer=branches.filter(q=>q!==p&&q.origin===p.origin&&q.ids[0]!==p.ids[0]).reduce((best,q)=>{
      const origin=pivot(p.origin),v=p.points[0].clone().sub(origin),w=q.points[0].clone().sub(origin),endP=p.points.at(-1).clone().sub(origin),endQ=q.points.at(-1).clone().sub(origin),scale=Math.max(p.length,q.length,1e-6);
      const error=Math.min(...(lateralAxis==null?[0,1]:[lateralAxis]).map(axis=>{const mirror=endP.clone();mirror.setComponent(axis,-mirror.getComponent(axis));const rootMirror=v.clone();rootMirror.setComponent(axis,-rootMirror.getComponent(axis));return mirror.distanceTo(endQ)/scale+rootMirror.distanceTo(w)/scale;}));
      const similarity=Math.exp(-Math.abs(Math.log((p.length+1e-6)/(q.length+1e-6))));return Math.max(best,Math.exp(-error*4)*similarity);
    },0);
    const rootOffset=start.clone().sub(pivot(p.origin));
    const lateral=lateralAxis??(Math.abs(rootOffset.x)>Math.abs(rootOffset.y)?0:1);
    const midline=Math.exp(-Math.abs(rootOffset.getComponent(lateral))/Math.max(size(jointSurface(p.origin))*.4,1));
    const tail=(1-peer)*Math.sqrt(Math.max(0,1-down*down))*midline*clamp(p.length/Math.max(size(p.surface)*2,1e-6));
    const membraneCoverage=Math.sqrt(clamp(mass(geometry.subtree.get(p.ids.at(-1)))/Math.max(mass(geometry.subtree.get(p.ids[0])),1e-5)));
    const rootShape=geometry.subtree.get(p.origin),salience=p.length/(p.length+Math.sqrt(mass(rootShape))*.08+1e-6);
    const supported=(crossSectionRoundness(p.surface)+Math.sqrt((p.surface.eigenvalues?.[1]||0)/Math.max(p.surface.eigenvalues?.[0]||0,1e-6)))/2;
    const continuationDebt=Math.max(0,...viableChildren(p.ids.at(-1)).map(child=>{const a=jointSurface(p.ids.at(-1)),b=jointSurface(child);const novel=a?.center&&b?.center?clamp(a.center.distanceTo(b.center)/(size(a)+size(b))):0;const heading=p.points.at(-1).clone().sub(p.points.at(-2)).normalize(),forward=b?.center?clamp(b.center.clone().sub(p.points.at(-1)).normalize().dot(heading)):0;return continuity(p.ids.at(-1),child)*Math.sqrt(clamp(mass(b)/Math.max(mass(a),1e-5)))*(1-(b?.planar||0))*novel*forward;}));
    const finalId=p.ids.at(-1),previousId=p.ids.at(-2),owned=geometry.profiles.get(finalId);
    const ownedOffset=owned?.center?owned.center.clone().sub(p.points.at(-1)):new Vector3(),tangent=p.points.at(-1).clone().sub(p.points.at(-2)).normalize();
    const offAxis=ownedOffset.clone().addScaledVector(tangent,-ownedOffset.dot(tangent)).length();
    const directLink=geometry.surfaceLinks.get(finalId)?.get(previousId)||0;
    const endpointUncertainty=mass(jointSurface(finalId))>0||mass(jointSurface(previousId))===0||(model.Attachments||[]).some(node=>node.ObjectId===finalId)?0:.06;
    // A tip past a membrane fan moves only one ray. Account for the surface
    // left behind when comparing that tip with the fan's native control.
    const fanCoverage=Math.sqrt(clamp(mass(geometry.subtree.get(finalId))/Math.max(mass(geometry.subtree.get(previousId)),1e-5)));
    const lostFan=.2*membraneFan(previousId)*(1-fanCoverage);
    const accessoryEnd=.2*clamp(offAxis/Math.max(size(owned),1e-5))*clamp(owned?.linear||0)/(1+directLink/Math.max(mass(owned)*.05,1e-5));
    const independentBranches=new Set(branches.filter(other=>other.origin===p.origin&&other.ids[0]!==p.ids[0]).map(other=>other.ids[0])).size;
    const originSupport=clamp(independentBranches+headAnalysis.heads.filter(head=>head.origin===p.origin&&!p.ids.includes(head.id)).length);
    const quality=(.45*p.confidence+.35*peer+.2*clamp(supported+wing)) * salience - .1*(1-originSupport) - p.adapterPenalty - p.overlapPenalty - accessoryEnd - endpointUncertainty - lostFan - .75*wing*clamp(down)*(1-clamp(mass(p.firstShape)/Math.max(mass(p.surface)*.05,1e-5))) + (wing>.35?.5*membraneFan(p.ids.at(-1)):0) - (wing>.35?0:.2*continuationDebt) - (wing>.35 ? .5*p.ids.slice(2,-1).reduce((sum,id)=>sum+membraneFan(id),0) : 0);
    const torsoCrossing=(wing>.35?[]:p.ids.slice(0,-1)).filter(id=>junctions.has(id)).reduce((score,id)=>score+.12*clamp(viableChildren(id).length-1),0);
    const headCompetition=Math.max(0,...headAnalysis.heads.filter(head=>tree.isAncestor(p.ids.at(-1),head.id)||p.ids.includes(head.id)).map(head=>head.score));
    const rootAlternatives=poseLimbRootEvidence(p.ids,{origin:p.origin,pivot,jointSurface,points:p.points});
    const root=rootAlternatives.reduce((a,b)=>b.score>a.score?b:a);
    candidates.push({...p,reservationStart:p.ids[0],ids:p.ids.slice(root.index),points:p.points.slice(root.index),kind,label,tail,peer,quality:quality-torsoCrossing-headCompetition,headCompetition,wing,membraneCoverage,down,roleScore,originSupport,endpointUncertainty,rootEvidence:root});
  }
  // Compare how much of each native membrane branch the endpoint represents.
  // A small finger region must not displace a wrist controlling the same fan.
  for(const candidate of candidates.filter(item=>item.label==='Wing')){
    const coverage=Math.max(...candidates.filter(other=>other.label==='Wing'&&other.origin===candidate.origin&&other.reservationStart===candidate.reservationStart).map(other=>other.membraneCoverage));
    candidate.quality-=.2*(coverage-candidate.membraneCoverage);
  }
  // A branching membrane can be controlled at its fan root even when the
  // authored rig has fewer than three joints before its independent rays.
  for(const p of paths){
    const endpoint=p.ids.at(-1),rays=viableChildren(endpoint).filter(id=>mass(jointSurface(id))>0);
    if(rays.length<2)continue;
    const rootSupport=clamp(mass(jointSurface(p.ids[0]))/Math.max(mass(p.surface)*.05,1e-5));
    const direction=p.points.at(-1).clone().sub(p.points[0]),hanging=clamp(-direction.z/Math.max(direction.length(),1e-5));
    const coverage=Math.sqrt(clamp(mass(geometry.subtree.get(endpoint))/Math.max(mass(geometry.subtree.get(p.ids[0])),1e-5)));
    const wingEvidence=membraneFan(endpoint)*rootSupport-(1-rootSupport)*hanging;
    if(wingEvidence>.2)candidates.push({...p,kind:'wing-control',label:'Wing',quality:.37+(wingEvidence*(headPaths.some(head=>tree.isAncestor(head.head.id,p.origin))||!headPaths.length?1:.25)-.2)*coverage,tail:0});
  }  // Axial taper is evidence for an articulated tail even when the author used
  // only two controls. A foot broadens distally; a tapering surface narrows.
  for(const p of paths.filter(path=>path.ids.length>=2&&path.terminal)){
    const surfaces=p.ids.map(jointSurface),distal=surfaces.at(-1);
    const width=shape=>Math.sqrt(shape?.eigenvalues?.[1]||0)+Math.sqrt(shape?.eigenvalues?.[2]||0);
    const proximalWidth=Math.max(0,...surfaces.slice(0,-1).map(width));
    const taper=proximalWidth>0&&mass(distal)>0?clamp(1-width(distal)/proximalWidth):0;
    const o=pivot(p.origin),axis=lateralAxes.get(p.origin)??1,offset=p.points[0].clone().sub(o);
    const centered=Math.exp(-Math.max(...p.points.map(point=>Math.abs(point.clone().sub(o).getComponent(axis))))/Math.max(size(jointSurface(p.origin))*.4,1));
    const direction=p.points.at(-1).clone().sub(p.points[0]);
    const horizontal=Math.hypot(direction.x,direction.y)/Math.max(direction.length(),1e-5);
    const localHead=headAnalysis.heads.some(head=>head.id!==p.origin&&tree.isAncestor(head.id,p.origin)&&!headAnalysis.heads.some(owner=>tree.isAncestor(p.origin,owner.id)));
    const supportBranches=new Set(candidates.filter(candidate=>candidate.origin===p.origin&&candidate.quality>.37&&candidate.reservationStart!==p.ids[0]&&candidate.kind!=='tail').map(candidate=>candidate.reservationStart??candidate.ids[0])).size;
    const bodyEvidence=localHead?1:clamp(supportBranches/2);
    const crossedHead=Math.max(0,...headAnalysis.heads.filter(head=>p.ids.includes(head.id)).map(head=>head.score));
    const ancestorHeads=headAnalysis.heads.filter(head=>!p.ids.includes(head.id)&&tree.root(head.id)===tree.root(p.origin));
    const forward=ancestorHeads.reduce((v,head)=>{const delta=pivot(head.id).sub(pivot(head.origin)),weight=Math.hypot(delta.x,delta.y)/Math.max(delta.length(),1e-5);return v.addScaledVector((head.shape?.center||pivot(head.id)).clone().sub(o),weight*weight*head.score);},new Vector3());
    const opposite=clamp(-new Vector3(direction.x,direction.y,0).normalize().dot(new Vector3(forward.x,forward.y,0).normalize()));
    const axial=clamp(p.length/Math.max(size(p.surface)*2,1e-5));
    const sideBranches=new Set(p.ids.slice(0,-1).flatMap((id,index)=>viableChildren(id).filter(child=>!tree.isAncestor(p.ids[index+1],child))));
    const branchDebt=[...sideBranches].reduce((sum,id)=>sum+Math.max(0,...headAnalysis.heads.filter(head=>tree.isAncestor(head.id,id)).map(head=>head.score),...candidates.filter(candidate=>candidate.kind!=='tail'&&tree.isAncestor(candidate.reservationStart??candidate.ids[0],id)).map(candidate=>candidate.quality-.37)),0);
    const fanDebt=.5*p.ids.slice(0,-1).reduce((sum,id)=>sum+membraneFan(id),0);
    const tailEvidence=.8*centered*Math.max(taper,axial*opposite)*horizontal*(1-clamp(p.overlapPenalty*4))*bodyEvidence-.08-Math.max(crossedHead,2*crossedHead*crossedHead)-branchDebt-fanDebt;
    tailMeasures.push({ids:p.ids,origin:p.origin,centered,taper,horizontal,bodyEvidence,opposite,axial,overlap:p.overlapPenalty,branchDebt,fanDebt,tailEvidence});
    if(tailEvidence>0)candidates.push({...p,kind:'tail',tail:tailEvidence,quality:.37+tailEvidence});
  }
  const headUtilities=new Map();
  for(const head of headAnalysis.heads){
    const limbDirection=Math.max(0,...branches.filter(path=>path.origin===head.origin&&path.ids.includes(head.id)).map(path=>{const delta=path.points[path.ids.indexOf(head.id)].clone().sub(path.points[0]),length=Math.max(delta.length(),1e-5),axis=lateralAxes.get(head.origin)??1;return clamp(-delta.z/length)*(Math.abs(delta.getComponent(axis))/length)*path.confidence;}));
    const siblings=branches.filter(path=>path.origin===head.origin&&!tree.isAncestor(head.id,path.ids[0])&&!path.ids.includes(head.id));
    const siblingMass=Math.max(0,...siblings.map(path=>mass(path.surface)));
    const context=Math.max(0,...headAnalysis.heads.filter(other=>other!==head&&other.origin!==head.origin&&tree.isAncestor(head.origin,other.origin)).map(other=>other.score));
    const attachmentBranches=new Set(siblings.map(path=>path.ids[0])).size;
    const accessoryContext=context*Math.sqrt(siblingMass/Math.max(siblingMass+mass(head.shape),1e-5))/Math.max(1,attachmentBranches*attachmentBranches);
    const utility=Math.max(0,head.score-accessoryContext-limbDirection);headUtilities.set(head.id,utility);
    candidates.push({ids:[...head.neckIds,head.id],origin:head.origin,kind:'head',head,quality:.37+utility,tail:0,accessoryContext});
  }
  for(const candidate of candidates)if(candidate.headCompetition){const adjusted=Math.max(0,...headAnalysis.heads.filter(head=>tree.isAncestor(candidate.ids.at(-1),head.id)||candidate.ids.includes(head.id)).map(head=>headUtilities.get(head.id)||0));candidate.quality+=candidate.headCompetition-adjusted;}

  candidates.sort((a,b)=>b.quality-a.quality || tree.depth(a.ids[0])-tree.depth(b.ids[0]) || a.ids[0]-b.ids[0]);
  const byStart=new Map();
  for(const candidate of candidates){if(candidate.quality<=.37)continue;const start=candidate.reservationStart??candidate.ids[0],list=byStart.get(start)||[];list.push(candidate);byStart.set(start,list);}
  // Maximum-weight disjoint path cover. Two supported arms can collectively
  // beat one plausible path that incorrectly starts in their shared chest.
  // Taking a limb closes its endpoint subtree; held objects do not become a
  // second limb extending beyond the hand.
  const solutions=new Map(),active=new Set(),ambiguities=[];
  const nameSupport=items=>typeof nameRole==='function'?items.reduce((score,item)=>{const expected=item.kind==='head'?'Head':item.kind==='tail'?'Tail':item.label==='Wing'?'Wing':item.kind==='arm'?'Hand':'Foot';return score+(nameRole(byId.get(item.ids.at(-1)))===expected?1:0);},0):0;
  const solve=id=>{
    if(solutions.has(id))return solutions.get(id);
    if(active.has(id))return {score:0,items:[]};active.add(id);
    const offspring=tree.children.get(id)||[];
    let best={score:0,items:[]};for(const child of offspring){const result=solve(child.ObjectId);best.score+=result.score;best.items.push(...result.items);}
    for(const candidate of byStart.get(id)||[]){
      const score=candidate.quality-.37,items=[candidate];
      if(score>best.score+1e-10)best={score,items};
      else if(Math.abs(score-best.score)<=1e-10&&score>0){ambiguities.push({joint:id,score,alternatives:[best.items.map(c=>c.ids),items.map(c=>c.ids)]});if(nameSupport(items)>nameSupport(best.items))best={score,items};}
    }
    active.delete(id);solutions.set(id,best);return best;
  };
  const collect=()=>{const items=[];for(const root of tree.children.get(null)||[])items.push(...solve(root.ObjectId).items);return items;};
  let selectedAll=collect();
  // Resolve short axial alternatives within one grounded body. The upright
  // head of an elevated rider cannot turn its mount's forward head into a tail.
  const provisional=inferPoseTorso({model,tree,joints,children,parent,geometry,pivot,jointSurface,
    heads:selectedAll.filter(item=>item.kind==='head').map(item=>item.head),
    limbs:selectedAll.filter(item=>!['head','tail','wing-control'].includes(item.kind)),
    tails:selectedAll.filter(item=>item.kind==='tail'),nameRole});
  let axialAlternatives=0;
  for(const actor of provisional.actors)for(const head of actor.heads){
    const strength=item=>item.score*Math.max(0,item.evidence.skeletonUp);
    const others=actor.heads.filter(other=>other!==head&&strength(other)>strength(head));
    if(!others.length)continue;
    const at=pivot(head.origin),center=head.shape?.center||pivot(head.id),out=center.clone().sub(at);
    const forward=others.reduce((v,h)=>v.add(h.shape?.center||pivot(h.id)),new Vector3()).multiplyScalar(1/others.length).sub(at);
    const horizontal=Math.hypot(out.x,out.y)/Math.max(out.length(),1e-5);
    const opposite=clamp(-new Vector3(out.x,out.y,0).normalize().dot(new Vector3(forward.x,forward.y,0).normalize()));
    const lateral=lateralAxes.get(head.origin)??1,rootOffset=pivot(head.id).sub(at);
    const centered=Math.exp(-Math.abs(rootOffset.getComponent(lateral))/Math.max(size(jointSurface(head.origin))*.4,1));
    const tailEvidence=.5*opposite*horizontal*centered;
    if(tailEvidence<=0)continue;
    const candidate={ids:[...head.neckIds,head.id],origin:head.origin,kind:'tail',tail:tailEvidence,quality:.37+tailEvidence};
    candidates.push(candidate);const start=candidate.ids[0],list=byStart.get(start)||[];list.push(candidate);byStart.set(start,list);axialAlternatives++;
  }
  if(axialAlternatives){solutions.clear();active.clear();ambiguities.length=0;selectedAll=collect();}
  const tails=selectedAll.filter(item=>item.kind==='tail'),wingControls=selectedAll.filter(item=>item.kind==='wing-control');
  const selected=selectedAll.filter(item=>item.kind!=='head'&&item.kind!=='tail'&&item.kind!=='wing-control'),chosenHeads=selectedAll.filter(item=>item.kind==='head').map(item=>item.head);
  headSet.clear();chosenHeads.forEach(head=>headSet.add(head.id));
  headPaths=chosenHeads.map(head=>({...head.path,ids:[...head.neckIds,head.id],head:{...head,index:head.neckIds.length},origin:head.origin}));
  const roles=Object.fromEntries(nodes.map(node=>[node.ObjectId,'Object'])), controls=new Set();
  for(const head of headSet){roles[head]='Head';controls.add(head);const p=headPaths.find(p=>p.head.id===head);if(p){for(const id of p.ids.slice(0,p.head.index)){roles[id]='Neck';controls.add(id);}}}
  for(const part of headAnalysis.parts||[])if(headSet.has(part.owner))roles[part.id]=part.role;
  for(const wing of wingControls){const id=wing.ids.at(-1);roles[id]='Wing';controls.add(id);}
  for(const tail of tails){for(const id of tail.ids)roles[id]='Tail';const id=tail.ids.at(-1);controls.add(id);for(const [id,owner] of folded)if(tail.ids.includes(owner))roles[id]='Tail';}
  const torso=inferPoseTorso({model,tree,joints,children,parent,geometry,pivot,jointSurface,heads:chosenHeads,limbs:selected,tails,nameRole});
  const {actors,body}=torso;Object.assign(roles,torso.roles);torso.controls.forEach(id=>controls.add(id));
  for(const c of selected){
    const endpoint=c.ids.at(-1);roles[endpoint]=c.label==='Wing'?'Wing':c.kind==='arm'?'Hand':'Foot';
    if(c.label==='Wing'){for(const id of c.ids)roles[id]='Wing';for(const [id,owner] of folded)if(c.ids.includes(owner))roles[id]='Wing';}
  }
  // Without a surface, a terminal authored part is morphologically ambiguous.
  // Its label may resolve membership inside an already established assembly.
  if(typeof nameRole==='function')for(const node of nodes){
    if(roles[node.ObjectId]!=='Object'||mass(geometry.subtree.get(node.ObjectId))>0||nameRole(node)!=='Wing')continue;
    if(selected.some(limb=>tree.isAncestor(node.ObjectId,limb.ids.at(-1))))roles[node.ObjectId]='Wing';
  }
  if(body!=null)controls.delete(body);
  const chains=selected.map(c=>({ids:c.ids,kind:c.kind,...(c.label?{label:c.label}:c.kind==='leg'&&typeof nameRole==='function'&&nameRole(byId.get(c.ids.at(-1)))==='Hoof'?{label:'Hoof'}:{}),...(c.grip?{grip:c.grip}:{}),confidence:rounded(c.quality),evidence:{continuity:rounded(c.confidence),peer:rounded(c.peer),wing:rounded(c.wing),origin:c.origin}}));
  const replacements=inferPoseReplacements(model,{geometry,tree,roles});
  for(const pair of replacements){roles[pair.target]=roles[pair.source];controls.add(pair.target);}
  const assembledActors=actors.map(a=>({body:a.body,span:a.span,limbs:chains.filter(c=>a.limbs.some(p=>p.ids===c.ids))}));
  const assemblies=poseAssemblyEvidence(model,assembledActors,{geometry,tree});
  return {chains,body,roles,nodes:[...controls],actors:actors.map(a=>({body:a.body,span:a.span,limbs:chains.filter(c=>a.limbs.some(p=>p.ids===c.ids))})),followers:assemblies.followers,carriers:assemblies.carriers,analysis:{provisionalActors:provisional.actors.map(actor=>({body:actor.body,heads:actor.heads.map(head=>head.id),limbs:actor.limbs.map(limb=>limb.ids)})),tailMeasures,replacements,ambiguities,stations:[...stationEvidence],assemblies:assemblies.evidence,heads:headAnalysis.candidates.map(h=>({id:h.id,origin:h.origin,neckIds:h.neckIds,score:h.score,evidence:h.evidence})),candidates:candidates.map(c=>({ids:c.ids,origin:c.origin,kind:c.kind,label:c.label,quality:c.quality,wing:c.wing,tail:c.tail,confidence:c.confidence,overlap:c.overlapPenalty,peer:c.peer,roleScore:c.roleScore,originSupport:c.originSupport,endpointUncertainty:c.endpointUncertainty,rootEvidence:c.rootEvidence,headCompetition:c.headCompetition,accessoryContext:c.accessoryContext})),folded:[...folded]}};
}
