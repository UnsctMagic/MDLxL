// Optional private-fixture proof. Inputs and geometry stay outside the repository.
// node test/optimizexl-constant-models.mjs input.mdx [input2.mdx ...]
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ModelRenderer} from 'war3-model';
import {Matrix4} from 'three';
import {openDocument} from '../src/editor-document.js';
import {sanityProposals,runOptimizeStage} from '../src/optimizexl.js';
import {allNodes,skinGeoset} from '../src/animation.js';
const hash=b=>createHash('sha256').update(b).digest('hex');
const pose=(r,frame)=>{r.setFrame(frame);r.updateNode(r.rendererData.rootNode);const matrices=new Map(r.rendererData.nodes.filter(Boolean).map(n=>[n.node.ObjectId,new Matrix4().fromArray(n.matrix)]));return r.rendererData.model.Geosets.map(g=>skinGeoset(g,matrices));};
const files=process.argv.slice(2);if(!files.length)throw Error('Supply private input model paths.');
for(const file of files){
 const original=new Uint8Array(fs.readFileSync(file));
 // Existing zero-strength reduction retains endpoint keys. The new explicit
 // proposal should compact constants left by that accepted operation.
 const cleaned=runOptimizeStage(original,'animation',{position:0,rotation:0,scale:0});
 const before=openDocument(cleaned.bytes,'before.mdx').model;
 const fixes=sanityProposals(before).filter(f=>f.kind==='constantTransform');
 const result=fixes.length?runOptimizeStage(cleaned.bytes,'sanity',{}, {kind:'batch',stage:'sanity',entries:fixes.map(fix=>({fix,settings:{}}))}):{bytes:cleaned.bytes,saved:0};
 const after=openDocument(result.bytes,'after.mdx').model;
 assert.deepEqual(after.Sequences,before.Sequences);assert.deepEqual(after.Geosets,before.Geosets);assert.deepEqual(after.Materials,before.Materials);assert.deepEqual(after.Textures,before.Textures);
 assert.ok(!sanityProposals(after).some(f=>f.kind==='constantTransform'),'No repeated constant-compaction proposal');
 const a=new ModelRenderer(structuredClone(before)),b=new ModelRenderer(structuredClone(after));let samples=0,vertices=0,maxError=0,maxRoundoffRatio=0;
 for(const [si,s]of before.Sequences.entries()){
  const [lo,hi]=s.Interval,keys=[...new Set(allNodes(before).flatMap(n=>['Translation','Rotation','Scaling'].flatMap(p=>(n[p]?.Keys||[]).filter(k=>k.Frame>=lo&&k.Frame<=hi).map(k=>k.Frame))))].sort((x,y)=>x-y);
  const frames=[...new Set([...keys,...keys.slice(1).map((f,i)=>(f+keys[i])/2),...Array.from({length:Math.ceil((hi-lo)/33)+1},(_,i)=>Math.min(hi,lo+i*33))])].sort((x,y)=>x-y);
  a.setSequence(si);b.setSequence(si);
  for(const frame of frames){const pa=pose(a,frame),pb=pose(b,frame);let magnitude=1;for(const stream of pa)for(const v of stream)magnitude=Math.max(magnitude,Math.abs(v));samples++;for(let gi=0;gi<pa.length;gi++){vertices+=pa[gi].length/3;for(let j=0;j<pa[gi].length;j++){const delta=Math.abs(pa[gi][j]-pb[gi][j]);maxError=Math.max(maxError,delta);maxRoundoffRatio=Math.max(maxRoundoffRatio,delta/(2**-23*magnitude));}}}
 }
 assert.ok(maxRoundoffRatio<=8,'Mathematically constant native interpolation may differ only within Float32 roundoff');
 assert.deepEqual(new Uint8Array(fs.readFileSync(file)),original);
 console.log(JSON.stringify({model:file.split(/[\\/]/).at(-1),inputSha256:hash(original),inputBytes:original.length,afterExistingExactReduction:cleaned.bytes.length,afterConstantCompaction:result.bytes.length,additionalSaved:result.saved,proposals:fixes.length,sequences:before.Sequences.length,nativePoseSamples:samples,posedVertices:vertices,maxNativeComponentError:maxError,maxFloat32RoundoffRatio:maxRoundoffRatio,outputSha256:hash(result.bytes)}));
}
