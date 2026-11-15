// Measured experiments only; no application import, production rule or hidden tolerance.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {ModelRenderer} from 'war3-model';
import {openDocument} from '../../src/editor-document.js';
import {sampleTrack,sampleNodeMatrices,skinGeoset,sampleGeosetAnimation,worldPivot,allNodes} from '../../src/animation.js';
import {compareMotion,motionTable} from '../../src/ai-motion-compare.js';
import {sanityProposals} from '../../src/optimizexl.js';
import {load,check,inventory,removeKeys,patchBytes,hash,at,json} from './optimizexl-unused-study-lib.mjs';
export const angle=(a,b)=>{const na=Math.hypot(...a),nb=Math.hypot(...b);if(!na||!nb)return NaN;const dot=Math.min(1,Math.abs(a.reduce((s,v,i)=>s+v*b[i],0)/(na*nb)));return 2*Math.acos(dot)*180/Math.PI;};
export const keyId=c=>`${c.path.join('.')}:${c.frame}`;
function samples(lo,hi,step,extra=[]){const out=[];for(let f=lo;f<=hi;f+=step)out.push(f);out.push(hi,...extra.filter(f=>f>=lo&&f<=hi));return [...new Set(out)].sort((a,b)=>a-b);}
export function localDifference(before,after,target){
 const baseline=at(before,target.path),changed=at(after,target.path),[lo,hi]=target.interval,options={interval:[lo,hi],fallback:[0,0,0,1],quaternion:true};
 let max=0,angular=0,worstFrame=lo;const minA=[Infinity,Infinity,Infinity,Infinity],maxA=minA.map(()=>-Infinity),minB=[...minA],maxB=[...maxA];
 const frames=samples(target.neighbors[0],target.neighbors.at(-1),.25,baseline.Keys.map(k=>k.Frame));
 for(const frame of frames){const a=sampleTrack(baseline,frame,options),b=sampleTrack(changed,frame,options),d=Math.max(...a.map((v,i)=>Math.abs(v-b[i])));if(d>max){max=d;worstFrame=frame;}angular=Math.max(angular,angle(a,b));for(let j=0;j<4;j++){minA[j]=Math.min(minA[j],a[j]);maxA[j]=Math.max(maxA[j],a[j]);minB[j]=Math.min(minB[j],b[j]);maxB[j]=Math.max(maxB[j],b[j]);}}
 return {key:keyId(target),samples:frames.length,maxComponent:max,maxAngleDegrees:angular,worstFrame,sourceRange:maxA.map((v,j)=>v-minA[j]),afterRange:maxB.map((v,j)=>v-minB[j]),lostFraction:maxA.map((v,j)=>v-minA[j]>1e-6?Math.max(0,1-(maxB[j]-minB[j])/(v-minA[j])):null)};
}
function nativeChannels(before,after,targets){
 const a=new ModelRenderer(structuredClone(before)),b=new ModelRenderer(structuredClone(after)),paths=[...new Map(targets.map(c=>[c.path.join('.'),c.path])).values()],rows=[];
 for(let sequence=0;sequence<before.Sequences.length;sequence++){
  const interval=before.Sequences[sequence].Interval;assert.ok(interval[1]>=interval[0]);a.setSequence(sequence);b.setSequence(sequence);
  const frames=samples(...interval,.25,paths.flatMap(p=>at(before,p).Keys.map(k=>k.Frame))),records=paths.map(p=>({path:p,maxComponent:0,maxAngleDegrees:0,frame:interval[0]}));
  for(const frame of frames){a.setFrame(frame);b.setFrame(frame);for(const row of records){const x=a.interp.quat(new Float32Array(4),at(before,row.path)),y=b.interp.quat(new Float32Array(4),at(after,row.path));if(x===null||y===null){assert.equal(x,y);continue;}const d=Math.max(...Array.from(x,(v,i)=>Math.abs(v-y[i])));if(d>row.maxComponent){row.maxComponent=d;row.frame=frame;}row.maxAngleDegrees=Math.max(row.maxAngleDegrees,angle(Array.from(x),Array.from(y)));}}
  rows.push({sequence,name:before.Sequences[sequence].Name,samples:frames.length,records});
 }
 return rows;
}
function fullGeometry(before,after,sequence,targets){
 const interval=before.Sequences[sequence].Interval,frames=samples(...interval,1),rows=before.Geosets.map((g,geoset)=>({geoset,max:0,visibleMax:0,hiddenMax:0,maxVelocityDifference:0,worst:null,bindExtent:extent(g.Vertices)}));
 const nonMesh=[...new Map(targets.flatMap(c=>c.dependency?.nonMesh||[]).map(n=>[n.id,n])).values()].map(n=>({...n,maxPivotDistance:0,frame:interval[0]}));
 let previous=null,endpoints=[];const buffers=[before,after].map(m=>m.Geosets.map(g=>[new Float64Array(g.Vertices.length),new Float64Array(g.Vertices.length)]));
 for(let fi=0;fi<frames.length;fi++){
  const frame=frames[fi],am=sampleNodeMatrices(before,frame,sequence),bm=sampleNodeMatrices(after,frame,sequence);let frameMax=0;
  for(let gi=0;gi<before.Geosets.length;gi++){
   const x=skinGeoset(before.Geosets[gi],am,buffers[0][gi][fi%2]),y=skinGeoset(after.Geosets[gi],bm,buffers[1][gi][fi%2]),row=rows[gi],visible=sampleGeosetAnimation(before,gi,frame,sequence).alpha>=.01||sampleGeosetAnimation(after,gi,frame,sequence).alpha>=.01;
   for(let j=0;j<x.length;j+=3){const d=Math.hypot(x[j]-y[j],x[j+1]-y[j+1],x[j+2]-y[j+2]);assert.ok(Number.isFinite(d),'Non-finite skinned difference');frameMax=Math.max(frameMax,d);if(d>row.max){row.max=d;row.worst={frame,vertex:j/3};}if(visible)row.visibleMax=Math.max(row.visibleMax,d);else row.hiddenMax=Math.max(row.hiddenMax,d);
    if(previous!==null){const px=buffers[0][gi][(fi-1)%2],py=buffers[1][gi][(fi-1)%2],dt=frame-previous;row.maxVelocityDifference=Math.max(row.maxVelocityDifference,Math.hypot((x[j]-px[j]-y[j]+py[j])/dt,(x[j+1]-px[j+1]-y[j+1]+py[j+1])/dt,(x[j+2]-px[j+2]-y[j+2]+py[j+2])/dt));}
   }
  }
  for(const n of nonMesh){const d=worldPivot(before,n.id,am).distanceTo(worldPivot(after,n.id,bm));if(d>n.maxPivotDistance){n.maxPivotDistance=d;n.frame=frame;}}
  if(fi===0||fi===frames.length-1)endpoints.push(frameMax);previous=frame;
 }
 return {sequence,name:before.Sequences[sequence].Name,samples:frames.length,endpoints,geosets:rows,nonMesh};
}
export function extent(values){const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(let i=0;i<values.length;i++){lo[i%3]=Math.min(lo[i%3],values[i]);hi[i%3]=Math.max(hi[i%3],values[i]);}return values.length?Math.max(...hi.map((v,j)=>v-lo[j])):0;}
export function experiment(item,{allMotion=true}={}){
 const {source,bytes,model:before}=load(item),originalChecker=check(bytes),inv=inventory(before,originalChecker),catalog=sanityProposals(before);
 const structural=catalog.filter(p=>!p.inspectionOnly&&(p.kind==='sequenceTimeline'||p.kind==='checker'&&['keyOrder','negativeKeys','emptyTracks','globalReference','parent','helperSkin','unskinnedBone','boneReference','geosetAnimReference','timeline','vertexAttachment'].includes(p.rule)));
 const owners=c=>catalog.filter(p=>!p.inspectionOnly&&(p.path?.join('.')===c.path.join('.')||p.tracks?.some(t=>t.path?.join('.')===c.path.join('.'))));
 const blocked=inv.eligible.map(c=>({...c,existingOwners:owners(c).map(p=>p.id)})).filter(c=>c.existingOwners.length||structural.length);
 const targets=inv.eligible.filter(c=>!owners(c).length&&!structural.length);
 const common={relativePath:item.relativePath,sha256:item.sha256,version:before.Version,originalChecker:{...originalChecker,findings:originalChecker.findings},unresolved:inv.candidates.length,coarseEligible:inv.eligible.length,blocked,structural:structural.map(p=>p.id),targets};
 if(!targets.length)return {...common,status:'no-experiment',reason:inv.eligible.length?'existing-owners-or-structural-repairs':'no-eligible-unresolved-local-linear-rotation',sourceUnchanged:hash(source)===item.sha256};
 const expected=removeKeys(before,targets),candidate=patchBytes(bytes,targets),after=openDocument(candidate,'study.mdx').model;
 assert.deepEqual(after,expected,'Only listed keys may change');
 const fixed=targets.map(c=>keyId(c));assert.equal(new Set(fixed).size,fixed.length);
 let forward=bytes,reverse=bytes;for(const c of targets)forward=patchBytes(forward,[c]);for(const c of [...targets].reverse())reverse=patchBytes(reverse,[c]);assert.deepEqual(forward,candidate);assert.deepEqual(reverse,candidate);
 const changedChecker=check(candidate),remaining=inventory(after,changedChecker);
 const introduced=changedChecker.findings.filter(f=>['error','severe','warning'].includes(f.type)&&!originalChecker.findings.some(x=>json(x)===json(f)));
 const individual=targets.map(c=>localDifference(before,removeKeys(before,[c]),c)),combined=targets.map(c=>localDifference(before,after,c));
 const report={...common,status:'experiment',removed:targets.length,bytesSaved:bytes.length-candidate.length,candidateSHA256:hash(candidate),checkerAfter:changedChecker,newStructuralFindings:introduced,fieldsPreserved:true,bothDeletionOrdersEqual:true,remainingEligible:remaining.eligible.map(c=>({path:c.path,frame:c.frame,sequence:c.sequence})),individual,combined,cameraDependent:targets.some(c=>c.dependency?.cameraDependent),globalInfluence:targets.some(c=>c.dependency?.globalInfluence)};
 if(allMotion){report.native=nativeChannels(before,after,targets);report.motion=[];report.fullGeometry=[];
  for(let sequence=0;sequence<before.Sequences.length;sequence++){
   const owned=motionTable(compareMotion(before,after,{sequences:[sequence],step:1}));assert.deepEqual(owned.changedTopology,[]);report.motion.push(owned.sequences[0]);
   const full=fullGeometry(before,after,sequence,targets);report.fullGeometry.push(full);
   assert.ok(full.endpoints.every(x=>x===0),'Local interior deletion changes an endpoint');
   console.log(JSON.stringify({model:item.relativePath,sequence:before.Sequences[sequence].Name,max:Math.max(0,...full.geosets.map(g=>g.max)),remaining:remaining.eligible.length}));
  }
 }
 report.sourceUnchanged=hash(fs.readFileSync(load(item).filename))===item.sha256;assert.ok(report.sourceUnchanged);
 return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'))){
 const [manifestPath,indexFile,output,indexArg]=process.argv.slice(2),items=JSON.parse(fs.readFileSync(indexFile,'utf8').replace(/^\uFEFF/,'')),item=items[Number(indexArg)];
 fs.mkdirSync(output,{recursive:true});let report;
 try{report=experiment(item);}catch(e){report={...item,status:'error',error:e.message,stack:e.stack};}
 fs.writeFileSync(path.join(output,item.sha256+'.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({finished:item.relativePath,status:report.status,error:report.error}));if(report.status==='error')process.exitCode=1;
}
