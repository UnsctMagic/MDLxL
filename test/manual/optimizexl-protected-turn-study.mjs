// Offline research only. Never imported by the application or its optimizer.
// Measures what deleting OptimizeXL's protected (remaining) Hive-similar keys
// would do in world space, for every node TRS track in the frozen corpus.
// Usage:
//   node optimizexl-protected-turn-study.mjs one <manifest> <outDir> <sha256>
//   node optimizexl-protected-turn-study.mjs run <manifest> <outDir> [workers]
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {Vector3,Quaternion} from 'three';
import {visitTracks,allNodes,sampleTrack,compileTrackSampler,composeNodeMatrices,skinGeoset,worldPivot,sampleGeosetAnimation,NODE_COLLECTION_KEYS} from '../../src/animation.js';
import {redundantTrackProposals} from '../../src/optimizexl-redundant-tracks.js';
import {optimizexlLocalTrack} from '../../src/optimizexl-format.js';
import {hiveTrackPath} from '../../src/optimizexl-diagnostics.js';
import {nodeIndex} from '../../src/node-hierarchy.js';
import {vertexBones} from '../../src/part-bones.js';
import {dimensions} from '../../src/optimizexl.js';
import {sequenceWorldBudget} from '../../src/optimizexl-world-animation.js';
import {load,check,at} from './optimizexl-unused-study-lib.mjs';

const TRS=['Translation','Rotation','Scaling'],FALLBACK={Translation:[0,0,0],Rotation:[0,0,0,1],Scaling:[1,1,1]};
const NON_MESH=['Attachments','ParticleEmitters','ParticleEmitters2','ParticleEmitterPopcorns','RibbonEmitters','Lights','EventObjects','CollisionShapes'];
const angleDeg=(a,b)=>{const na=Math.hypot(...a),nb=Math.hypot(...b);if(!na||!nb)return NaN;const d=Math.min(1,Math.abs(a.reduce((s,v,i)=>s+v*b[i],0)/(na*nb)));return 2*Math.acos(d)*180/Math.PI;};
function localDelta(prop,a,b){
 if(prop==='Rotation')return angleDeg(Array.from(a),Array.from(b));
 if(prop==='Translation')return Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
 let m=0;for(let i=0;i<3;i++){const d=Math.abs(a[i])>1e-9?Math.abs(b[i]/a[i]-1):Math.abs(b[i]-a[i]);m=Math.max(m,d);}return m;
}
function diag(points){const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(const p of points)for(let i=0;i<3;i++){lo[i]=Math.min(lo[i],p[i]);hi[i]=Math.max(hi[i],p[i]);}return points.length?Math.hypot(hi[0]-lo[0],hi[1]-lo[1],hi[2]-lo[2]):0;}

function context(model){
 const nodes=allNodes(model),tree=nodeIndex(model,nodes),byId=tree.byId,collectionOf=new Map();
 for(const key of NODE_COLLECTION_KEYS)for(const n of model[key]||[])if(n&&Number.isInteger(n.ObjectId)&&(!collectionOf.has(n.ObjectId)||collectionOf.get(n.ObjectId)==='Nodes'))collectionOf.set(n.ObjectId,key);
 const verts=[];// global index -> {g,v,bones}
 const influenced=new Map();
 model.Geosets.forEach((g,gi)=>{for(let v=0;v<g.Vertices.length/3;v++){const bones=vertexBones(g,v),index=verts.length;verts.push({g:gi,v,bones});const marked=new Set();for(const b of bones)for(const a of tree.ancestors(b,true))marked.add(a);for(const a of marked){if(!influenced.has(a))influenced.set(a,[]);influenced.get(a).push(index);}}});
 const descMemo=new Map(),descendants=id=>{if(!descMemo.has(id))descMemo.set(id,nodes.filter(n=>tree.isAncestor(n.ObjectId,id)).map(n=>n.ObjectId));return descMemo.get(id);};
 return {model,nodes,tree,byId,collectionOf,verts,influenced,descendants,size:dimensions(model),peaks:new Map(),compiled:new Map(),allIds:nodes.map(n=>n.ObjectId)};
}
// Per-geoset submeshes holding only the listed global vertex indices.
function subMeshes(ctx,list){
 const byG=new Map();for(const i of list){const {g}=ctx.verts[i];if(!byG.has(g))byG.set(g,[]);byG.get(g).push(i);}
 return [...byG].map(([gi,indices])=>{const src=ctx.model.Geosets[gi],V=new Float32Array(indices.length*3),hd=src.SkinWeights?.length>=src.Vertices.length/3*8;
  const mesh={Vertices:V};if(hd)mesh.SkinWeights=new Uint8Array(indices.length*8);else{mesh.Groups=[];mesh.VertexGroup=[];}
  indices.forEach((gl,k)=>{const v=ctx.verts[gl].v;V[k*3]=src.Vertices[v*3];V[k*3+1]=src.Vertices[v*3+1];V[k*3+2]=src.Vertices[v*3+2];
   if(hd)mesh.SkinWeights.set(src.SkinWeights.subarray(v*8,v*8+8),k*8);else{mesh.Groups.push(Array.from(src.Groups?.[src.VertexGroup?.[v]]||[]));mesh.VertexGroup.push(k);}});
  return {geoset:gi,indices,mesh,a:[new Float64Array(V.length),new Float64Array(V.length)],b:[new Float64Array(V.length),new Float64Array(V.length)]};});
}
function poser(ctx,byId,ids){
 const t=new Vector3(),r=new Quaternion(),s=new Vector3(),out={t,r,s};
 return (domain,time)=>{
  if(!domain.global){
   // Sequence domains: compiled shared samplers (same arithmetic as sampleTrack).
   let cache=ctx.compiled.get(domain.key);if(!cache)ctx.compiled.set(domain.key,cache=new WeakMap());
   return composeNodeMatrices(ctx.model,ids,node=>{
    let s=cache.get(node);
    if(!s){s=TRS.map(p=>node[p]?compileTrackSampler(node[p],{interval:domain.interval,globalSequences:ctx.model.GlobalSequences,fallback:FALLBACK[p],quaternion:p==='Rotation'}):()=>FALLBACK[p]);cache.set(node,s);}
    t.fromArray(s[0](time));r.fromArray(s[1](time));s.length&&out.s.fromArray(s[2](time));return out;},byId);
  }
  const frame=domain.interval[0],globalTime=time,options={interval:domain.interval,globalSequences:ctx.model.GlobalSequences,globalTime};
  return composeNodeMatrices(ctx.model,ids,node=>{
   t.fromArray(sampleTrack(node.Translation,frame,{...options,fallback:FALLBACK.Translation}));
   r.fromArray(sampleTrack(node.Rotation,frame,{...options,fallback:FALLBACK.Rotation,quaternion:true}));
   s.fromArray(sampleTrack(node.Scaling,frame,{...options,fallback:FALLBACK.Scaling}));return out;},byId);
 };
}
// Domain: a sequence (interval) or a global sequence (time 0..duration with
// every sequence track held at the first frame of sequence 0).
function domainOf(ctx,plan){
 const m=ctx.model;
 if(plan.globalSequence!=null)return {key:'g'+plan.globalSequence,global:true,interval:Array.from(m.Sequences[0]?.Interval||[0,0]),span:[0,m.GlobalSequences[plan.globalSequence]]};
 const interval=Array.from(m.Sequences[plan.sequence].Interval);return {key:'s'+plan.sequence,global:false,interval,span:interval,sequence:plan.sequence};
}
// Per-vertex peak speed (units/ms) of the ORIGINAL model over the domain, all vertices.
function peaks(ctx,domain){
 if(ctx.peaks.has(domain.key))return ctx.peaks.get(domain.key);
 const pose=poser(ctx,ctx.byId,ctx.allIds),peak=new Float64Array(ctx.verts.length),bufs=ctx.model.Geosets.map(g=>[new Float64Array(g.Vertices.length),new Float64Array(g.Vertices.length)]);
 const offsets=[];let o=0;for(const g of ctx.model.Geosets){offsets.push(o);o+=g.Vertices.length/3;}
 const [lo,hi]=domain.span;let meshPeak=0;
 for(let f=Math.ceil(lo),k=0;f<=Math.floor(hi);f++,k++){
  const M=pose(domain,f);
  ctx.model.Geosets.forEach((g,gi)=>{const cur=skinGeoset(g,M,bufs[gi][k%2]);if(k){const prev=bufs[gi][(k-1)%2],off=offsets[gi];for(let j=0;j<cur.length;j+=3){const d=Math.hypot(cur[j]-prev[j],cur[j+1]-prev[j+1],cur[j+2]-prev[j+2]);if(d>peak[off+j/3])peak[off+j/3]=d;if(d>meshPeak)meshPeak=d;}}});
 }
 const result={peak,meshPeak,frames:Math.floor(hi)-Math.ceil(lo)+1};ctx.peaks.set(domain.key,result);return result;
}
// Measure deleting `deleted` frames (inside the domain) from node[prop].
function measure(ctx,node,prop,track,domain,deleted){
 const [dlo,dhi]=domain.span,inDomain=k=>k.Frame>=dlo&&k.Frame<=dhi,keys=track.Keys.filter(inDomain),kept=keys.filter(k=>!deleted.has(k.Frame));
 let segments=[];for(const d of deleted){const prev=[...kept].reverse().find(k=>k.Frame<d),next=kept.find(k=>k.Frame>d);segments.push([prev?prev.Frame:dlo,next?next.Frame:dhi]);}
 segments.sort((a,b)=>a[0]-b[0]);const merged=[];for(const s of segments){const last=merged.at(-1);if(last&&s[0]<=last[1])last[1]=Math.max(last[1],s[1]);else merged.push([...s]);}
 const modTrack={...track,Keys:track.Keys.filter(k=>!(inDomain(k)&&deleted.has(k.Frame)))},modNode={...node,[prop]:modTrack},byIdMod=new Map(ctx.byId);byIdMod.set(node.ObjectId,modNode);
 const id=node.ObjectId,list=ctx.influenced.get(id)||[],desc=ctx.descendants(id),nonMesh=desc.filter(d=>NON_MESH.includes(ctx.collectionOf.get(d)));
 const ids=[...new Set([...list.flatMap(i=>ctx.verts[i].bones),...nonMesh,id])];
 const chain=new Set(ids.flatMap(x=>ctx.tree.ancestors(x,true)));
 const cameraDependent=[...chain].some(x=>(ctx.byId.get(x)?.Flags||0)&0xF8);
 const poseA=poser(ctx,ctx.byId,ids),poseB=poser(ctx,byIdMod,ids),meshes=subMeshes(ctx,list),pk=peaks(ctx,domain);
 const options={interval:domain.global?null:domain.interval,globalSequences:ctx.model.GlobalSequences,fallback:FALLBACK[prop],quaternion:prop==='Rotation'};
 const sample=(t,f)=>domain.global?sampleTrack(t,0,{...options,globalTime:f}):sampleTrack(t,f,{...options,globalTime:f});
 let maxDisp=0,worst=null,maxRatio=0,ratioWorst=null,maxDv=0,staticChanged=0,maxLocal=0,frames=0;const pivots=nonMesh.map(n=>({id:n,name:ctx.byId.get(n)?.Name,collection:ctx.collectionOf.get(n),max:0,frame:null}));
 for(const [a,b] of merged){
  let k=0;
  for(let f=Math.ceil(a);f<=Math.floor(b);f++,k++){
   frames++;const MA=poseA(domain,f),MB=poseB(domain,f);
   maxLocal=Math.max(maxLocal,localDelta(prop,sample(track,f),sample(modTrack,f)));
   for(const sm of meshes){
    const xa=skinGeoset(sm.mesh,MA,sm.a[k%2]),xb=skinGeoset(sm.mesh,MB,sm.b[k%2]),pa=sm.a[(k+1)%2],pb=sm.b[(k+1)%2];
    for(let j=0,v=0;j<xa.length;j+=3,v++){
     const d=Math.hypot(xa[j]-xb[j],xa[j+1]-xb[j+1],xa[j+2]-xb[j+2]);
     if(d>maxDisp){maxDisp=d;worst={frame:f,geoset:sm.geoset,vertex:ctx.verts[sm.indices[v]].v};}
     if(k){const dv=Math.hypot(xa[j]-pa[j]-xb[j]+pb[j],xa[j+1]-pa[j+1]-xb[j+1]+pb[j+1],xa[j+2]-pa[j+2]-xb[j+2]+pb[j+2]),p=pk.peak[sm.indices[v]];
      if(dv>maxDv)maxDv=dv;
      if(p>1e-12){const r=dv/p;if(r>maxRatio){maxRatio=r;ratioWorst={frame:f,geoset:sm.geoset,vertex:ctx.verts[sm.indices[v]].v,peak:p,dv};}}else if(dv>1e-9)staticChanged++;}
    }
   }
   for(const p of pivots){const d=worldPivot(ctx.model,p.id,MA,ctx.byId.get(p.id)).distanceTo(worldPivot(ctx.model,p.id,MB,modNode.ObjectId===p.id?modNode:ctx.byId.get(p.id)));if(d>p.max){p.max=d;p.frame=f;}}
  }
 }
 let turnAtKey=0;for(const d of deleted){const orig=keys.find(k=>k.Frame===d);if(orig)turnAtKey=Math.max(turnAtKey,localDelta(prop,orig.Vector,sample(modTrack,d)));}
 const bindPoints=list.map(i=>{const {g,v}=ctx.verts[i],V=ctx.model.Geosets[g].Vertices;return [V[v*3],V[v*3+1],V[v*3+2]];}),bboxDiagonal=diag(bindPoints),pivot=node.PivotPoint||ctx.model.PivotPoints?.[node.ObjectId]||[0,0,0];
 // A single-point part has no bbox: fall back to its lever (farthest bind vertex from the node pivot).
 const pivotReach=bindPoints.reduce((m,p)=>Math.max(m,Math.hypot(p[0]-pivot[0],p[1]-pivot[1],p[2]-pivot[2])),0),partSize=bboxDiagonal>1e-6?bboxDiagonal:pivotReach,partSizeSource=bboxDiagonal>1e-6?"bbox-diagonal":"pivot-reach";
 let worstVisible=null;if(worst){try{worstVisible=sampleGeosetAnimation(ctx.model,worst.geoset,domain.global?domain.interval[0]:worst.frame,domain.global?0:domain.sequence,worst.frame).alpha>=.01;}catch{}}
 return {segments:merged,frames,vertices:list.length,partSize,partSizeSource,bboxDiagonal,pivotReach,maxUnits:maxDisp,partPct:partSize>0?maxDisp/partSize*100:null,modelPct:maxDisp/ctx.size*100,worst,worstVisible,
  turnAtKey,maxLocal,maxSpeedChange:maxDv,speedChangePctOfPeak:maxRatio*100,partPeakSpeed:list.reduce((m,i)=>Math.max(m,pk.peak[i]),0),speedChangePctOfPartPeak:(()=>{const pp=list.reduce((m,i)=>Math.max(m,pk.peak[i]),0);return pp>1e-12?maxDv/pp*100:null;})(),speedWorst:ratioWorst,staticVerticesChanged:staticChanged,
  meshPeakSpeed:pk.meshPeak,worldBudgetAtMaxStrength:sequenceWorldBudget(pk.meshPeak,ctx.size,ctx.size*.01),
  nonMeshPivots:pivots,nonMeshMax:pivots.reduce((m,p)=>Math.max(m,p.max),0),cameraDependent,meshCameraDependent:[...new Set(list.flatMap(i=>ctx.verts[i].bones).flatMap(x=>ctx.tree.ancestors(x,true)))].some(x=>(ctx.byId.get(x)?.Flags||0)&0xF8)};
}

function studyModel(item){
 const started=Date.now(),{model,bytes}=load(item);
 let checker=null,checkerError=null;try{checker=check(bytes);}catch(e){checkerError=String(e.message).slice(0,200);}
 const entries=[];visitTracks(model,(track,{path})=>entries.push({track,path}));
 if(process.env.STUDY_DEBUG)console.log('checked',(Date.now()-started)/1000);const plans=redundantTrackProposals(model,entries);if(process.env.STUDY_DEBUG)console.log('plans',(Date.now()-started)/1000);
 const real=checker?new Set(checker.findings.filter(f=>f.type==='unused'&&/^Track \d+ at frame \d+ has (roughly|exactly) the same value/.test(f.message)).map(f=>`${hiveTrackPath(f.path)}:${/at frame (\d+)/.exec(f.message)[1]}`)):null;
 const checkerSimilar=real?real.size:null;
 const ctx=context(model),keyRows=[],trackRows=[],unsupported=[];
 for(const p of plans){
  const confirmed=p.remaining.filter(f=>!real||real.has(`${p.path.join('.')}:${f}`));if(!confirmed.length)continue;
  const prop=p.path.at(-1),base={model:item.relativePath,sha256:item.sha256,version:model.Version,path:p.path,property:prop,checkerThrew:!!checkerError};
  if(!(NODE_COLLECTION_KEYS.includes(p.path[0])&&p.path.length===3&&TRS.includes(prop))){for(const f of confirmed)unsupported.push({...base,frame:f,reason:'not-node-trs',collection:p.path[0]});continue;}
  const node=at(model,p.path.slice(0,-1)),track=node[prop],domain=domainOf(ctx,p);
  const dkeys=track.Keys.filter(k=>k.Frame>=domain.span[0]&&k.Frame<=domain.span[1]);
  const flags={global:p.globalSequence!=null,overlap:!domain.global&&model.Sequences.some((s,i)=>i!==p.sequence&&s.Interval[0]<=domain.interval[1]&&s.Interval[1]>=domain.interval[0]),
   cubic:track.LineType>=2,nonUnitQuaternion:prop==='Rotation'&&dkeys.some(k=>['Vector',...(track.LineType>=2?['InTan','OutTan']:[])].some(c=>k[c]&&Math.abs(Math.hypot(...k[c])-1)>1e-5)),
   invalidKeyOrder:dkeys.some((k,i)=>!Number.isInteger(k.Frame)||i&&k.Frame<=dkeys[i-1].Frame),notVersion800:model.Version!==800,checkerThrew:!!checkerError};
  const nodeInfo={nodeName:node.Name,collection:p.path[0],objectId:node.ObjectId,sequenceName:domain.global?`Global sequence ${p.globalSequence+1}`:model.Sequences[p.sequence].Name,lineType:track.LineType};
  for(const f of confirmed){
   try{const m=measure(ctx,node,prop,track,domain,new Set([f]));flags.billboarded=m.cameraDependent;
    keyRows.push({...base,...nodeInfo,frame:f,authoredTurn:p.preservedTurns.includes(f),flags:{...flags,billboarded:m.cameraDependent},...m});
    if(keyRows.length%100===0)console.log(JSON.stringify({keys:keyRows.length,seconds:(Date.now()-started)/1000,peaks:ctx.peaks.size}));}
   catch(e){unsupported.push({...base,...nodeInfo,frame:f,reason:'measure-error',error:String(e.message).slice(0,200)});}
  }
  // Cumulative: delete every confirmed protected key plus the owner's own
  // deletions, then rescan this track/domain until no Hive-similar notice remains.
  try{
   let cur=track,deleted=new Set(),rounds=0,ownerDeleted=0,rescanAdded=0,toDelete=[...confirmed,...p.frames];ownerDeleted+=p.frames.length;
   while(toDelete.length&&rounds<64){rounds++;for(const f of toDelete)deleted.add(f);cur={...track,Keys:track.Keys.filter(k=>!(k.Frame>=domain.span[0]&&k.Frame<=domain.span[1]&&deleted.has(k.Frame)))};
    const again=redundantTrackProposals(model,[{track:cur,path:p.path}]).find(q=>q.globalSequence===p.globalSequence&&(p.globalSequence!=null||q.sequence===p.sequence));
    toDelete=again?[...again.frames,...again.remaining].filter(f=>!deleted.has(f)):[];if(again){ownerDeleted+=again.frames.length;rescanAdded+=again.remaining.length;}}
   const m=measure(ctx,node,prop,track,domain,deleted);
   trackRows.push({...base,...nodeInfo,protectedKeys:confirmed.length,protectedFrames:confirmed,deletedTotal:deleted.size,deletedFrames:[...deleted].sort((a,b)=>a-b),ownerDeleted,rescanAddedRemaining:rescanAdded,rounds,stable:!toDelete.length,flags:{...flags,billboarded:m.cameraDependent},...m});
  }catch(e){unsupported.push({...base,...nodeInfo,frame:null,reason:'cumulative-error',error:String(e.message).slice(0,200)});}
 }
 return {...item,status:'ok',version:model.Version,checkerError,checkerSimilar,modelSize:ctx.size,sequences:model.Sequences.length,vertices:ctx.verts.length,
  noticeTotal:plans.reduce((s,p)=>s+p.noticed.length,0),remainingTotal:plans.reduce((s,p)=>s+p.remaining.length,0),keys:keyRows,tracks:trackRows,unsupported,seconds:(Date.now()-started)/1000};
}

const [mode,manifestPath,output,arg]=process.argv.slice(2);
if(mode){
 const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8').replace(/^ÃƒÂ¯Ã‚Â»Ã‚Â¿/,'')),unique=[...new Map(manifest.files.map(x=>[x.sha256,x])).values()].sort((a,b)=>a.sha256.localeCompare(b.sha256));
 const models=path.join(output,'models');fs.mkdirSync(models,{recursive:true});
 if(mode==='one'){
  const item=unique.find(x=>x.sha256===arg);let report;
  try{report=studyModel(item);}catch(e){report={...item,status:'error',error:String(e.message).slice(0,300),stack:e.stack};}
  fs.writeFileSync(path.join(models,item.sha256+'.json'),JSON.stringify(report));
 }else if(mode==='run'){
  const workers=Number(arg)||8,self=fileURLToPath(import.meta.url),started=Date.now();let cursor=0,complete=0;
  // Largest files first so the long tail finishes early.
  const queue=[...unique].sort((a,b)=>b.bytes-a.bytes);
  async function worker(){while(cursor<queue.length){const item=queue[cursor++],file=path.join(models,item.sha256+'.json');if(fs.existsSync(file)){complete++;continue;}
   await new Promise(resolve=>{const p=spawn(process.execPath,['--max-old-space-size=4096',self,'one',manifestPath,output,item.sha256],{windowsHide:true,stdio:['ignore','pipe','pipe']});let log='',timedOut=false;p.stdout.on('data',x=>log+=x);p.stderr.on('data',x=>log+=x);
    const timer=setTimeout(()=>{timedOut=true;p.kill();},45*60*1000);
    p.on('exit',code=>{clearTimeout(timer);if(!fs.existsSync(file))fs.writeFileSync(file,JSON.stringify({...item,status:'error',error:timedOut?'45-minute per-model timeout':`child exited ${code}`,log:log.slice(-2000)}));complete++;
     if(complete%25===0||complete===queue.length)console.log(JSON.stringify({complete,total:queue.length,elapsedSeconds:Math.round((Date.now()-started)/1000)}));resolve();});
   });}}
  await Promise.all(Array.from({length:workers},worker));
  console.log(JSON.stringify({done:true,elapsedSeconds:Math.round((Date.now()-started)/1000)}));
 }else throw Error('Use one or run');
}
