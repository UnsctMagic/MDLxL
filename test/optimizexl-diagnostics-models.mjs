import fs from 'node:fs';import { sanityTest } from './helpers/hive.mjs';import assert from 'node:assert/strict';
import { comparePoses } from './helpers/pose-compare.mjs';
import {openDocument} from '../src/editor-document.js';
import {sanityProposals,runOptimizeStage} from '../src/optimizexl.js';
import {classifyHiveFindings} from '../src/optimizexl-diagnostics.js';
import {flattenHiveFindings} from '../app/optimizexl-hive.js';
const hive=bytes=>{const r=sanityTest(bytes);return {...r,findings:flattenHiveFindings(r.nodes)};};
const at=(m,p)=>p.reduce((v,k)=>v[k],m);
for(const path of process.argv.slice(2)){
  const source=new Uint8Array(fs.readFileSync(path)),before=openDocument(source,'x.mdx').model,h=hive(source),fixes=sanityProposals(before).filter(f=>!f.inspectionOnly);
  if(!h.unused){assert.equal(fixes.length,0);console.log(JSON.stringify({file:path,clean:true,newRepairs:0}));continue;}
  assert.equal(h.unused,5);const coverage=classifyHiveFindings(h.findings,fixes);assert.equal(coverage.length,5);assert.ok(coverage.every(f=>f.status==='preview'));
  assert.equal(fixes.reduce((s,f)=>s+f.frames.length,0),5);
  const batch={kind:'batch',stage:'sanity',entries:fixes.map(fix=>({fix,settings:{}}))},result=runOptimizeStage(source,'sanity',{},batch),after=openDocument(result.bytes,'x.mdx').model;
  const clean=hive(result.bytes);assert.equal(clean.errors+clean.severe+clean.warnings+clean.unused,0);
  assert.deepEqual(sanityProposals(after),[]);
  for(const order of [fixes,[...fixes].reverse()]){
    let bytes=source;for(const old of order){const f=sanityProposals(openDocument(bytes,'x.mdx').model).find(f=>f.id===old.id);bytes=runOptimizeStage(bytes,'sanity',{},f).bytes;}
    assert.deepEqual(bytes,result.bytes,'Approval order and batch produce identical bytes');
  }
  const paths=[...new Map(fixes.map(f=>[f.path.join('.'),f.path])).values()];let samples=0,maxComponentError=0;
  comparePoses(before, after, ({ a, b }) => {
      for(const p of paths){const x=a.interp.quat(new Float32Array(4),at(before,p)),y=b.interp.quat(new Float32Array(4),at(after,p));
      if(x===null||y===null)assert.equal(x,y);else for(let j=0;j<4;j++)maxComponentError=Math.max(maxComponentError,Math.abs(x[j]-y[j]));samples++;
      }
  });
  assert.ok(maxComponentError<.000001);
  for(const p of paths){const frames=new Set(fixes.filter(f=>f.path.join('.')===p.join('.')).flatMap(f=>f.frames));assert.deepEqual(at(after,p).Keys,at(before,p).Keys.filter(k=>!frames.has(k.Frame)));at(after,p.slice(0,-1))[p.at(-1)]=at(before,p);}
  assert.deepEqual(after,before);assert.deepEqual(new Uint8Array(fs.readFileSync(path)),source);
  console.log(JSON.stringify({file:path,removed:5,hive:{errors:clean.errors,severe:clean.severe,warnings:clean.warnings,unused:clean.unused},samples,maxComponentError,saved:result.saved,orderIndependent:true,otherDataUnchanged:true,sourceUnchanged:true}));
}
