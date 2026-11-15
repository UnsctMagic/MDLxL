// Derived variants of the accepted real Lahmian model, never saved as user assets.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {openDocument} from '../../src/editor-document.js';
import {visitTracks,allNodes,sampleNodeMatrices,skinGeoset,sampleGeosetAnimation} from '../../src/animation.js';
import {vertexBones} from '../../src/part-bones.js';
import {changeVertexBinding} from '../../src/bone-tools.js';
import {ensureGeosetAnimation} from '../../src/geoset-animation-defaults.js';
import {load,patchBytes,hash,check,inventory,removeKeys} from './optimizexl-unused-study-lib.mjs';
import {localDifference,keyId,extent} from './optimizexl-unused-deep.mjs';
const [out]=process.argv.slice(2);fs.mkdirSync(out,{recursive:true});
const ref={relativePath:'optimizexl-lahmian-unused/WH_VC_LahmianVampire01.mdx',sha256:'7301332715e50dfadf5ce9a049a8cd262bd6a1ba387ea394c22ccda69db54488'};
const {source,bytes,model:original}=load(ref),five=[[12,8033],[34,20517],[104,31409],[105,31409],[105,35934]].map(([bone,frame])=>({path:['Bones',bone,'Rotation'],frame}));
const accepted=patchBytes(bytes,five);assert.equal(hash(accepted),'22dad1df7374ef013f8da6814246bfa0d3c8461fb08759cee5cb853edf8f6301');
const si=12,[lo,hi]=original.Sequences[si].Interval,mid=(lo+hi)/2,name=original.Bones[104].Name;
const quaternion=x=>new Float32Array([x,0,0,Math.sqrt(1-x*x)]),key=(Frame,x)=>({Frame,Vector:quaternion(x)});
function base(m){const node=m.Bones.find(n=>n.Name===name);node.Rotation={LineType:1,GlobalSeqId:null,Keys:[key(lo,0),key(mid,.0005),key(hi,0)]};return node;}
function scale(m,s){for(const g of m.Geosets)g.Vertices=Float32Array.from(g.Vertices,v=>v*s);const pivots=new Set([...m.PivotPoints,...allNodes(m).map(n=>n.PivotPoint).filter(Boolean)]);for(const p of pivots)for(let i=0;i<3;i++)p[i]*=s;visitTracks(m,(t,{property})=>{if(property==='Translation')for(const k of t.Keys)for(const p of ['Vector','InTan','OutTan'])if(k[p])for(let j=0;j<k[p].length;j++)k[p][j]*=s;});}
const definitions=[
 ['intentional-small-loop',(m,n)=>{},'counterexample'],
 ['uneven-one-ms-rise',(m,n)=>{n.Rotation.Keys[1].Frame=lo+1;},'counterexample'],
 ['adjacent-small-turns',(m,n)=>{n.Rotation.Keys=[key(lo,0),key(lo+100,.0005),key(lo+200,-.00025),key(hi,0)];},'counterexample'],
 ['constant-track',(m,n)=>{for(const k of n.Rotation.Keys)k.Vector=quaternion(0);},'existing-owner'],
 ['monotonic-similar-values',(m,n)=>{n.Rotation.Keys=[key(lo,0),key(mid,.00025),key(hi,.0005)];},'existing-owner'],
 ['non-unit-quaternions',(m,n)=>{for(const k of n.Rotation.Keys)k.Vector[3]=1.01;},'unsupported'],
 ['global-domain',(m,n)=>{n.Rotation.GlobalSeqId=m.GlobalSequences.push(hi+1)-1;},'unsupported'],
 ['overlapping-sequences',(m,n)=>{m.Sequences[11].Interval=new Uint32Array([lo,hi]);},'unsupported'],
 ['cubic-controls',(m,n)=>{n.Rotation.LineType=3;for(const k of n.Rotation.Keys){k.InTan=new Float32Array(k.Vector);k.OutTan=quaternion(.02);}},'unsupported'],
 ['boundary-only-keys',(m,n)=>{n.Rotation.Keys=[key(lo,0),key(hi,0)];},'no-interior'],
 ['negated-quaternion-track',(m,n)=>{for(const k of n.Rotation.Keys)k.Vector=Float32Array.from(k.Vector,x=>-x);},'equivalent-representation'],
 ['negated-middle-only',(m,n)=>{n.Rotation.Keys[1].Vector=Float32Array.from(n.Rotation.Keys[1].Vector,x=>-x);},'checker-blind-spot'],
 ['rename-all',(m,n)=>{allNodes(m).forEach((n,i)=>n.Name=`Node ${i}`);m.Sequences.forEach((s,i)=>s.Name=`Animation ${i}`);},'invariance'],
 ['reverse-bone-array',(m,n)=>{m.Bones.reverse();},'invariance'],
 ['uniform-scale-0.01',(m,n)=>scale(m,.01),'scale-covariance'],
 ['uniform-scale-100',(m,n)=>scale(m,100),'scale-covariance'],
 ['camera-dependent-node',(m,n)=>{n.Flags|=8;},'dependency-risk'],
 ['global-parent-influence',(m,n)=>{const parent=allNodes(m).find(x=>x.ObjectId===n.Parent);parent.Rotation={LineType:1,GlobalSeqId:m.GlobalSequences.push(1000)-1,Keys:[key(0,0),key(500,.01),key(1000,0)]};},'dependency-risk'],
 ['nonmesh-child',(m,n)=>{const e=m.ParticleEmitters2[0]||m.Attachments[0];assert.ok(e);e.Parent=n.ObjectId;},'dependency-risk'],
 ['long-descendant-chain',(m,n)=>{let parent=n;for(let i=0;i<12;i++){const node={Name:`Study child ${i}`,ObjectId:m.PivotPoints.length,Parent:parent.ObjectId,Flags:0};m.PivotPoints.push(new Float32Array([i*100,0,0]));m.Helpers.push(node);parent=node;}const e=m.ParticleEmitters2[0]||m.Attachments[0];e.Parent=parent.ObjectId;},'dependency-risk'],
 ['hidden-reappearing-skirt',(m,n)=>{const gi=m.Geosets.findIndex(g=>Array.from({length:g.Vertices.length/3},(_,v)=>vertexBones(g,v).includes(n.ObjectId)).some(Boolean));assert.ok(gi>=0);const g=ensureGeosetAnimation(m,gi);g.Alpha={LineType:0,GlobalSeqId:null,Keys:[{Frame:lo,Vector:new Float32Array([0])},{Frame:mid+1,Vector:new Float32Array([1])},{Frame:hi,Vector:new Float32Array([1])}]};},'visibility-risk'],
 ['large-lever-arm',(m,n)=>{let count=0;for(const g of m.Geosets)for(let v=0;v<g.Vertices.length/3;v++)if(vertexBones(g,v).includes(n.ObjectId)){g.Vertices[v*3+1]+=10000;count++;}assert.ok(count);},'counterexample'],
 ['blended-skin',(m,n)=>{const g=m.Geosets.find(g=>Array.from({length:g.Vertices.length/3},(_,v)=>vertexBones(g,v).includes(n.ObjectId)).some(Boolean));const v=Array.from({length:g.Vertices.length/3},(_,v)=>v).find(v=>vertexBones(g,v).includes(n.ObjectId));changeVertexBinding(m,g,[v],n.ObjectId,'hard');changeVertexBinding(m,g,[v],m.Bones[0].ObjectId,'soft');},'dependency-risk']
];
const reports=[];
for(const [label,change,expectation] of definitions){
 const d=openDocument(accepted,'derived.mdx');d.apply('Study derived copy',['Bones','Helpers','Sequences','Geosets','GeosetAnims','GlobalSequences','PivotPoints','Attachments','ParticleEmitters2'],m=>{const n=base(m);change(m,n);});
 const serialized=d.serialize('mdx'),m=openDocument(serialized,'derived.mdx').model,h=check(serialized),inv=inventory(m,h),targets=inv.eligible;
 const row={label,expectation,candidateKeys:targets.length,unresolved:inv.candidates.map(c=>({path:c.path,frame:c.frame,reasons:c.reasons,dependency:c.dependency})),checker:{errors:h.errors,severe:h.severe,warnings:h.warnings,unused:h.unused}};
 if(targets.length){const after=removeKeys(m,targets);row.local=targets.map(c=>localDifference(m,after,c));row.geometry=[];
  for(const c of targets){const frame=c.frame,am=sampleNodeMatrices(m,frame,c.sequence),bm=sampleNodeMatrices(after,frame,c.sequence),pa=sampleNodeMatrices(m,frame-.25,c.sequence),pb=sampleNodeMatrices(after,frame-.25,c.sequence);let max=0,maxVelocityDifference=0,hiddenMax=0;
   for(let gi=0;gi<m.Geosets.length;gi++){const a=skinGeoset(m.Geosets[gi],am),b=skinGeoset(after.Geosets[gi],bm),oldA=skinGeoset(m.Geosets[gi],pa),oldB=skinGeoset(after.Geosets[gi],pb),hidden=sampleGeosetAnimation(m,gi,frame,c.sequence).alpha<.01;
    for(let i=0;i<a.length;i+=3){const delta=Math.hypot(a[i]-b[i],a[i+1]-b[i+1],a[i+2]-b[i+2]);max=Math.max(max,delta);if(hidden)hiddenMax=Math.max(hiddenMax,delta);maxVelocityDifference=Math.max(maxVelocityDifference,Math.hypot(a[i]-oldA[i]-b[i]+oldB[i],a[i+1]-oldA[i+1]-b[i+1]+oldB[i+1],a[i+2]-oldA[i+2]-b[i+2]+oldB[i+2])/.25);}}
   row.geometry.push({frame,max,hiddenMax,maxVelocityDifference});
  }
 }
 if(['existing-owner','unsupported','no-interior'].includes(expectation))assert.equal(targets.length,0,`${label} must not enter unresolved linear rotation experiment`);
 reports.push(row);console.log(JSON.stringify({case:label,eligible:targets.length,maximumLoss:Math.max(0,...(row.local||[]).flatMap(x=>x.lostFraction.filter(v=>v!==null)))}));
}
const baseline=reports.find(x=>x.label==='intentional-small-loop');assert.equal(baseline.candidateKeys,1);assert.equal(baseline.local[0].lostFraction[0],1,'Deleting small genuine loop erases 100% of its authored X excursion');
for(const label of ['rename-all','reverse-bone-array','uniform-scale-0.01','uniform-scale-100','negated-quaternion-track'])assert.equal(reports.find(x=>x.label===label).candidateKeys,baseline.candidateKeys,`${label}: eligibility must not depend on identity or scale`);
assert.ok(reports.find(x=>x.label==='camera-dependent-node').unresolved.some(x=>x.dependency?.cameraDependent));
assert.ok(reports.find(x=>x.label==='global-parent-influence').unresolved.some(x=>x.dependency?.globalInfluence));
assert.ok(reports.find(x=>x.label==='nonmesh-child').unresolved.some(x=>x.dependency?.nonMesh.length));
assert.ok(reports.find(x=>x.label==='long-descendant-chain').unresolved.some(x=>x.dependency?.descendants>=13));
const hidden=reports.find(x=>x.label==='hidden-reappearing-skirt');assert.ok(hidden.geometry.some(g=>g.hiddenMax>0),'Hidden motion must actually be measured on influenced geometry');
assert.ok(reports.find(x=>x.label==='large-lever-arm').geometry[0].max>100*baseline.geometry[0].max,'Identical small rotation must expose a large world movement when reach increases');
assert.ok(reports.find(x=>x.label==='blended-skin').unresolved.some(x=>x.dependency?.blended>0));
assert.ok(reports.find(x=>x.label==='uneven-one-ms-rise').geometry[0].maxVelocityDifference>100*baseline.geometry[0].maxVelocityDifference,'Same position tolerance can conceal very different velocity changes');
assert.equal(hash(source),ref.sha256);fs.writeFileSync(path.join(out,'derived-cases.json'),JSON.stringify({cases:reports.length,source:ref,rows:reports,conclusion:'Value similarity, a sub-.001 component difference and identity-invariant eligibility do not establish disposable motion.',sourceUnchanged:true},null,2));
