// Private fixtures and repaired models remain outside Git.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ModelRenderer} from 'war3-model';
import {openDocument} from '../src/editor-document.js';
import {sanityProposals,runOptimizeStage} from '../src/optimizexl.js';
import {assertRoundTripFields} from '../src/model-optimizer.js';
import {classifyHiveFindings} from '../src/optimizexl-diagnostics.js';
import {flattenHiveFindings} from '../app/optimizexl-hive.js';
vm.runInThisContext(fs.readFileSync(new URL('../public/vendor/hive-viewer-5.12.0.js',import.meta.url),'utf8'));
const hash=b=>createHash('sha256').update(b).digest('hex'),local=t=>t.GlobalSeqId==null||t.GlobalSeqId===-1||t.GlobalSeqId===0xffffffff;
const hive=bytes=>{const m=new ModelViewer.parsers.mdlx.Model();m.load(bytes.slice().buffer);const r=ModelViewer.utils.mdlx.sanityTest(m);return {errors:r.errors,severe:r.severe,warnings:r.warnings,unused:r.unused,findings:flattenHiveFindings(r.nodes)};};
function entries(m){const out=[];function walk(v,path=[]){if(!v||typeof v!=='object'||ArrayBuffer.isView(v))return;
  if(v.Keys){out.push({track:v,path});return;}for(const [k,x]of Object.entries(v))if(k!=='Nodes')walk(x,[...path,k]);}walk(m);return out;}
const at=(m,p)=>p.reduce((v,k)=>v[k],m);
for(const file of process.argv.slice(2)){
  const source=new Uint8Array(fs.readFileSync(file)),before=openDocument(source,'x.mdx').model,all=sanityProposals(before);
  const fixes=all.filter(f=>!f.inspectionOnly);assert.ok(fixes.length);assert.ok(fixes.every(f=>['visibilityInterpolation','sequenceTimeline'].includes(f.kind)));
  const result=runOptimizeStage(source,'sanity',{}, {kind:'batch',stage:'sanity',entries:fixes.map(fix=>({fix}))});
  const after=openDocument(result.bytes,'x.mdx').model,originalCheck=hive(source),check=hive(result.bytes);
  assert.equal(check.errors+check.severe+check.warnings,0);
  assert.equal(check.unused,originalCheck.unused,'Authored facial turns remain visible checker notices');
  assert.ok(sanityProposals(after).every(f=>f.inspectionOnly));
  assert.ok(classifyHiveFindings(check.findings,sanityProposals(after)).every(f=>f.status==='manual'&&/authored turn/.test(f.reason)));
  for(const order of [fixes,[...fixes].reverse()]){let bytes=source;
    for(const old of order){const current=sanityProposals(openDocument(bytes,'x.mdx').model).find(f=>f.id===old.id);bytes=runOptimizeStage(bytes,'sanity',{},current).bytes;}
    assert.deepEqual(bytes,result.bytes);
  }
  const projected=structuredClone(after),intervals=after.Sequences.map(s=>Array.from(s.Interval));
  const undo=frame=>{const i=intervals.findIndex(([lo,hi])=>frame>=lo&&frame<=hi);return i<0?frame:frame+before.Sequences[i].Interval[0]-intervals[i][0];};
  for(const {track}of entries(projected))if(local(track)){for(const k of track.Keys)k.Frame=undo(k.Frame);track.Keys.sort((a,b)=>a.Frame-b.Frame);}
  for(const e of projected.EventObjects)if(local(e))e.EventTrack=new e.EventTrack.constructor(Array.from(e.EventTrack,undo).sort((a,b)=>a-b));
  projected.Sequences.forEach((s,i)=>{assert.equal(s.Name,before.Sequences[i].Name);assert.equal(s.Interval[1]-s.Interval[0],before.Sequences[i].Interval[1]-before.Sequences[i].Interval[0]);s.Interval=before.Sequences[i].Interval;});
  for(const f of fixes)if(f.kind==='visibilityInterpolation')at(projected,f.path).LineType=at(before,f.path).LineType;
  assertRoundTripFields(before,projected);
  const a=new ModelRenderer(structuredClone(before)),b=new ModelRenderer(structuredClone(after)),tracks=entries(before);
  let samples=0,maxComponentError=0;
  const sample=(renderer,t,p)=>p==='Rotation'?renderer.interp.quat(new Float32Array(4),t):t.Keys[0]?.Vector.length===3?renderer.interp.vec3(new Float32Array(3),t):renderer.interp.num(t);
  for(let si=0;si<before.Sequences.length;si++){
    a.setSequence(si);b.setSequence(si);const [lo,hi]=before.Sequences[si].Interval,offset=after.Sequences[si].Interval[0]-lo;
    for(let frame=lo;frame<=hi;frame+=.25){a.setFrame(frame);b.setFrame(frame+offset);
      a.rendererData.globalSequencesFrames=before.GlobalSequences.map(d=>(frame-lo)%d);b.rendererData.globalSequencesFrames=[...a.rendererData.globalSequencesFrames];
      for(const {track,path}of tracks){const x=sample(a,track,path.at(-1)),y=sample(b,at(after,path),path.at(-1));
        if(x==null||y==null)assert.equal(x,y);else if(typeof x==='number')maxComponentError=Math.max(maxComponentError,Math.abs(x-y));
        else maxComponentError=Math.max(maxComponentError,...Array.from(x,(v,i)=>Math.abs(v-y[i])));samples++;
      }
    }
  }
  assert.equal(maxComponentError,0,'Every native sampled channel is exactly equal');
  assert.deepEqual(new Uint8Array(fs.readFileSync(file)),source);
  if(process.env.MDLXL_FORMAT_OUTPUT)fs.writeFileSync(process.env.MDLXL_FORMAT_OUTPUT,result.bytes);
  console.log(JSON.stringify({file,inputSHA256:hash(source),outputSHA256:hash(result.bytes),bytes:result.bytes.length,beforeHive:originalCheck,afterHive:check,repairs:fixes.map(f=>f.kind),samples,maxComponentError,indicesAndDurationsPreserved:true,allOtherFieldsUnchanged:true,bothApprovalOrdersMatch:true,sourceUnchanged:true},null,2));
}
