// Private teaching inputs are read as data. Never import scripts from their folders.
// node test/manual/optimizexl-world-budget.mjs <original.mdx> <accepted.mdx> <output-dir>
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { openDocument } from '../../src/editor-document.js';
import { runOptimizeStage, simpleSettings, dimensions } from '../../src/optimizexl.js';
import { canonicalizeSerializedNodeOrder } from '../../src/node-id-order.js';
import { sampleNodeMatrices, skinGeoset, allNodes } from '../../src/animation.js';
const [input,reference,out]=process.argv.slice(2);
if(!input||!reference||!out)throw Error('Supply private original, accepted reference and output directory.');
fs.mkdirSync(out,{recursive:true});
const source=fs.readFileSync(input),accepted=fs.readFileSync(reference),before=openDocument(source,'original.mdx').model;
const canonicalBefore=structuredClone(before);canonicalizeSerializedNodeOrder(canonicalBefore,{preserveUnusedPivots:true});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),size=dimensions(before);
const report={source:{bytes:source.length,sha256:hash(source)},size,sampleStepMs:1,mean:'mean over all vertices and millisecond frames; meanFrameMax also recorded',candidates:[]};
function pose(model,frame,sequence){
 const matrices=sampleNodeMatrices(model,frame,sequence,0);
 return model.Geosets.map(g=>skinGeoset(g,matrices,new Float64Array(g.Vertices.length)));
}
function measure(bytes){
 const after=openDocument(bytes,'candidate.mdx').model,rows=[];
 assert.equal(after.Geosets.length,before.Geosets.length);
 for(let si=0;si<before.Sequences.length;si++){
  const [start,end]=before.Sequences[si].Interval;
  let max=0,at=start,sum=0,sumVertex=0,vertexCount=0,endpointStart=0,endpointEnd=0,peakVelocityError=0,peakSpeed=0,previousBefore,previousAfter;
  for(let frame=start;frame<=end;frame++){
   const a=pose(before,frame,si),b=pose(after,frame,si);let frameMax=0;
   for(let gi=0;gi<a.length;gi++)for(let i=0;i<a[gi].length;i+=3){
    const error=Math.hypot(a[gi][i]-b[gi][i],a[gi][i+1]-b[gi][i+1],a[gi][i+2]-b[gi][i+2]);frameMax=Math.max(frameMax,error);sumVertex+=error;vertexCount++;
    if(previousBefore){
     const dx=a[gi][i]-previousBefore[gi][i],dy=a[gi][i+1]-previousBefore[gi][i+1],dz=a[gi][i+2]-previousBefore[gi][i+2];
     peakSpeed=Math.max(peakSpeed,Math.hypot(dx,dy,dz));
     peakVelocityError=Math.max(peakVelocityError,Math.hypot(dx-b[gi][i]+previousAfter[gi][i],dy-b[gi][i+1]+previousAfter[gi][i+1],dz-b[gi][i+2]+previousAfter[gi][i+2]));
    }
   }
   if(frameMax>max){max=frameMax;at=frame;}sum+=frameMax;
   if(frame===start)endpointStart=frameMax;if(frame===end)endpointEnd=frameMax;
   previousBefore=a;previousAfter=b;
  }
  console.log('measured '+si+' '+before.Sequences[si].Name+' max '+max);
  let keyBytes=0;
  for(const node of allNodes(after))for(const property of ['Translation','Rotation','Scaling']){
   const track=node[property];if(!track?.Keys||track.GlobalSeqId!=null&&track.GlobalSeqId!==-1&&track.GlobalSeqId!==0xffffffff)continue;
   keyBytes+=track.Keys.filter(k=>k.Frame>=start&&k.Frame<=end).length*(4+(property==='Rotation'?4:3)*4*(track.LineType>=2?3:1));
  }
  rows.push({keyBytes,sequence:si,name:before.Sequences[si].Name,samples:end-start+1,max,at,meanFrameMax:sum/(end-start+1),mean:sumVertex/vertexCount,maxPercent:100*max/size,meanPercent:100*sumVertex/vertexCount/size,endpointStart,endpointEnd,peakVelocityError,peakSpeed});
 }
 return rows;
}
function nodeAnimationBytes(model){
 let bytes=0;for(const node of allNodes(model))for(const property of ['Translation','Rotation','Scaling']){
  const t=node[property];if(t?.Keys)bytes+=16+t.Keys.length*(4+(property==='Rotation'?4:3)*4*(t.LineType>=2?3:1));
 }return bytes;
}
function save(){fs.writeFileSync(path.join(out,'fx-world-budget.json'),JSON.stringify(report,null,2));}
const previousReport=process.env.MDLXL_FX_RESUME==='1'&&fs.existsSync(path.join(out,'fx-world-budget.json'))?JSON.parse(fs.readFileSync(path.join(out,'fx-world-budget.json'))):null;
if(previousReport)assert.equal(previousReport.source.sha256,report.source.sha256);
function add(name,bytes,stats={},milliseconds=0){
 const previous=previousReport?.candidates.find(c=>c.name===name&&c.sha256===hash(bytes));
 if(previous)for(const row of previous.animations){
  const model=openDocument(bytes,'measured.mdx').model,[start,end]=before.Sequences[row.sequence].Interval;
  row.keyBytes=allNodes(model).reduce((sum,node)=>sum+['Translation','Rotation','Scaling'].reduce((n,p)=>{
   const t=node[p];return n+(!t?.Keys||t.GlobalSeqId!=null&&t.GlobalSeqId!==-1&&t.GlobalSeqId!==0xffffffff?0:t.Keys.filter(k=>k.Frame>=start&&k.Frame<=end).length*(4+(p==='Rotation'?4:3)*4*(t.LineType>=2?3:1)));
  },0),0);
 }
 if(previous?.animations.every(a=>Number.isInteger(a.keyBytes))&&['accepted-animation-reference','local-100'].includes(name)){report.candidates.push(previous);save();console.log('reused identical measured bytes: '+name);return;}
 const model=openDocument(bytes,'candidate.mdx').model;
 if(name!=='accepted-animation-reference'){
  for(const collection of ['Geosets','GeosetAnims','Materials','Textures','Sequences','Cameras'])assert.deepEqual(model[collection],canonicalBefore[collection],collection);
  for(const node of allNodes(model)){const original=allNodes(canonicalBefore).find(n=>n.ObjectId===node.ObjectId);for(const property of Object.keys(original).filter(p=>!['Translation','Rotation','Scaling'].includes(p)))assert.deepEqual(node[property],original[property],property);}
 }
 const animationRecordBytes=nodeAnimationBytes(model),animationOnlyEquivalentBytes=source.length-nodeAnimationBytes(before)+animationRecordBytes;
 if(name!=='accepted-animation-reference')assert.equal(animationOnlyEquivalentBytes,bytes.length,'only node TRS and existing exact cleanup may change size');
 const row={animationRecordBytes,animationOnlyEquivalentBytes,name,bytes:bytes.length,saved:source.length-bytes.length,savedPercent:100*(source.length-bytes.length)/source.length,sha256:hash(bytes),milliseconds,stats,animations:measure(bytes)};
 if(name.startsWith('world-')){
  const reference=report.candidates.find(c=>c.name==='accepted-animation-reference');
  for(const animation of row.animations){
   assert.equal(animation.endpointStart,0);assert.equal(animation.endpointEnd,0);
   assert.ok(animation.max<=stats.sequences[animation.sequence].budget+1e-9,'direct mesh budget');
   assert.ok(animation.max<=reference.animations[animation.sequence].max+1e-9,'accepted per-animation maximum');
  }
 }
 report.candidates.push(row);save();console.log('recorded '+name+' '+row.bytes+' bytes, '+row.savedPercent.toFixed(2)+'% saved');
}
add('accepted-animation-reference',accepted);
let tick=performance.now();const old=runOptimizeStage(source,'animation',simpleSettings('animation',100,before));add('local-100',old.bytes,old.stats,performance.now()-tick);
for(const strength of [100,60,80]){
 console.log('starting world '+strength);
 tick=performance.now();const candidate=runOptimizeStage(source,'animation',simpleSettings('animation',strength,before,'world'));
 fs.writeFileSync(path.join(out,'world-'+strength+'.mdx'),candidate.bytes);
 console.log('reduced world '+strength+' '+candidate.afterBytes+' bytes in '+Math.round(performance.now()-tick)+' ms');
 add('world-'+strength,candidate.bytes,candidate.animationMetrics,performance.now()-tick);
}
assert.equal(hash(fs.readFileSync(input)),report.source.sha256);
console.log('Private source unchanged; '+path.join(out,'fx-world-budget.json'));
