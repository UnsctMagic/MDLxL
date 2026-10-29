// Private examples stay outside Git; this audit accepts arbitrary model paths.
import fs from 'node:fs';
import { sanityTest } from './helpers/hive.mjs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ModelRenderer} from 'war3-model';
import {openDocument} from '../src/editor-document.js';
import {assertRoundTripFields} from '../src/model-optimizer.js';
import {sanityProposals,runOptimizeStage} from '../src/optimizexl.js';
import {classifyHiveFindings} from '../src/optimizexl-diagnostics.js';
import {flattenHiveFindings} from '../app/optimizexl-hive.js';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const chunks=bytes=>{const result=new Map(),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);for(let i=4;i<bytes.length;){const name=String.fromCharCode(...bytes.slice(i,i+4)),size=view.getUint32(i+4,true);result.set(name,bytes.slice(i,i+8+size));i+=8+size;}return result;};
const hive=bytes=>{const r=sanityTest(bytes);return {...r,findings:flattenHiveFindings(r.nodes)};};
for(const path of process.argv.slice(2)){
 const source=new Uint8Array(fs.readFileSync(path)),before=openDocument(source,'input.mdx').model,check=hive(source),proposals=sanityProposals(before),fix=proposals.find(f=>f.kind==='bounds');
 assert.ok(fix?.targets.every(t=>t.sequenceExtents),'Use a model with only table-size extent defects for this exact field audit');
 assert.ok(classifyHiveFindings(check.findings,proposals).filter(f=>f.kind==='sequenceExtents').every(f=>f.status==='preview'));
 const candidate=runOptimizeStage(source,'sanity',{},fix).bytes,after=openDocument(candidate,'after.mdx').model,clean=hive(candidate);
 const originalChunks=chunks(source),candidateChunks=chunks(candidate);assert.deepEqual([...candidateChunks.keys()],[...originalChunks.keys()]);for(const [name,data]of originalChunks)if(name!=='GEOS')assert.deepEqual(candidateChunks.get(name),data,`${name} must stay byte-identical`);
 assert.deepEqual(clean.findings,check.findings.filter(f=>!f.message.startsWith('Number of sequence extents')),'Other diagnostics, including protected turns, stay unchanged');
 assert.ok(!sanityProposals(after).some(f=>f.kind==='bounds'));
 assert.deepEqual(runOptimizeStage(source,'sanity',{}, {kind:'batch',stage:'sanity',entries:[{fix}]}).bytes,candidate);
 const a=new ModelRenderer(structuredClone(before)),b=new ModelRenderer(structuredClone(after));let poses=0;
 for(let si=0;si<before.Sequences.length;si++){
  a.setSequence(si);b.setSequence(si);const [lo,hi]=before.Sequences[si].Interval;
  for(let i=0;i<=32;i++){
   const frame=lo+(hi-lo)*i/32;a.setFrame(frame);b.setFrame(frame);
   before.GlobalSequences.forEach((duration,j)=>{a.rendererData.globalSequencesFrames[j]=b.rendererData.globalSequencesFrames[j]=duration>0?(frame-lo)%duration:0;});
   a.updateNode(a.rendererData.rootNode);b.updateNode(b.rendererData.rootNode);
   assert.deepEqual(a.rendererData.nodes.filter(Boolean).map(n=>n.matrix),b.rendererData.nodes.filter(Boolean).map(n=>n.matrix));poses++;
  }
 }
 const projected=structuredClone(after);for(const t of fix.targets){assert.equal(after.Geosets[t.geoset].Anims.length,before.Sequences.length);projected.Geosets[t.geoset].Anims=before.Geosets[t.geoset].Anims;}
 assertRoundTripFields(before,projected);assert.deepEqual(fs.readFileSync(path),Buffer.from(source));
 if(process.env.MDLXL_BOUNDS_AFTER)fs.writeFileSync(process.env.MDLXL_BOUNDS_AFTER,candidate,{flag:'wx'});
 console.log(JSON.stringify({file:path,source:{bytes:source.length,sha256:hash(source)},after:{bytes:candidate.length,sha256:hash(candidate)},tablesRebuilt:fix.targets.length,sequences:before.Sequences.length,beforeHive:{errors:check.errors,severe:check.severe,warnings:check.warnings,unused:check.unused},afterHive:{errors:clean.errors,severe:clean.severe,warnings:clean.warnings,unused:clean.unused},nativePoses:poses,otherFieldsUnchanged:true,nonGeosetChunksByteIdentical:true,sourceUnchanged:true,remaining:classifyHiveFindings(clean.findings,sanityProposals(after))}));
}
