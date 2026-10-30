import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ModelRenderer } from 'war3-model';
import { Quaternion, Vector3 } from 'three';
import { createStarterDocument } from '../src/starter-model.js';
import { openDocument, createNode } from '../src/editor-document.js';
import { sampleTrack, sampleNodeMatrices, skinGeoset } from '../src/animation.js';
import { exactLinearQuaternion, sequenceWorldBudget } from '../src/optimizexl-world-animation.js';
import { runOptimizeStage, simpleSettings, dimensions, sanityProposals } from '../src/optimizexl.js';
import { OptimizeXLSession } from '../src/optimizexl-session.js';
const key=(Frame,Vector,cubic=false)=>({Frame,Vector:new Float32Array(Vector),...(cubic?{InTan:new Float32Array(Vector),OutTan:new Float32Array(Vector)}:{})});
const track=(Keys,LineType=1)=>({LineType,GlobalSeqId:null,Keys});
function fixture(edit=()=>{}){
 const doc=createStarterDocument();doc.apply('World reduction fixture',['Sequences','Geosets','Bones','Helpers','PivotPoints','GlobalSequences'],m=>{
  const sequence=m.Sequences[0];m.Sequences=[{...sequence,Name:'arbitrary',Interval:new Uint32Array([0,100]),MinimumExtent:new Float32Array(3),MaximumExtent:new Float32Array(3),BoundsRadius:0,MoveSpeed:0,NonLooping:false,Rarity:0}];
  m.Geosets.forEach(g=>{g.Anims=[];});
  m.Bones[0].Translation=track(Array.from({length:21},(_,i)=>key(i*5,[i/2,.05*Math.sin(i/5),0])));
  edit(m);
 });return doc.serialize('mdx');
}
function compare(a,b,step=1){
 let max=0,endpoints=0;
 for(let si=0;si<a.Sequences.length;si++){const [start,end]=a.Sequences[si].Interval;
  for(let frame=start;frame<=end;frame+=step){
   const ma=sampleNodeMatrices(a,frame,si,17),mb=sampleNodeMatrices(b,frame,si,17);
   a.Geosets.forEach((g,gi)=>{
    const before=skinGeoset(g,ma,new Float64Array(g.Vertices.length)),after=skinGeoset(b.Geosets[gi],mb,new Float64Array(g.Vertices.length));
    for(let i=0;i<before.length;i+=3){const e=Math.hypot(...before.subarray(i,i+3).map((v,j)=>v-after[i+j]));max=Math.max(max,e);if(frame===start||frame===end)endpoints=Math.max(endpoints,e);}
   });
  }
 }return {max,endpoints};
}
test('quaternion cubic-to-linear identity holds for Hermite and Bezier, antipodes and varying axes',()=>{
 for(const LineType of [2,3])for(let variant=0;variant<8;variant++){
  const t=track(Array.from({length:4},(_,i)=>key(i*31,new Quaternion().setFromAxisAngle(new Vector3(variant+1,i+1,2).normalize(),(i-1)*.6).toArray().map(v=>variant%2&&i%2?-v:v),true)),LineType);
  const linear=exactLinearQuaternion(t);assert.ok(linear);assert.equal(linear.LineType,1);
  for(let frame=0;frame<=93;frame+=.125){const o={interval:[0,93],quaternion:true,fallback:[0,0,0,1]},a=sampleTrack(t,frame,o),b=sampleTrack(linear,frame,o);assert.ok(a.every((v,i)=>Math.abs(v-b[i])<1e-12));}
 }
 const bad=track([key(0,[0,0,0,1],true),key(50,[0,0,.5,Math.sqrt(.75)],true)],2);bad.Keys[0].OutTan[1]=.1;assert.equal(exactLinearQuaternion(bad),null);
 assert.equal(exactLinearQuaternion(track([key(0,[1,0,0],true),key(10,[2,0,0],true)],2)),null);
});
test('equal-value Hermite vector controls produce a real excursion and do not share the quaternion rule',()=>{
 const t=track([key(0,[1,0,0],true),key(100,[1,0,0],true)],2);
 const mid=sampleTrack(t,25,{interval:[0,100],fallback:[0,0,0]});assert.notEqual(mid[0],1);
 const bytes=fixture(m=>m.Bones[0].Translation=t),a=openDocument(bytes,'a.mdx').model;
 const result=runOptimizeStage(bytes,'animation',{mode:'world',worldTolerance:0}),b=openDocument(result.bytes,'b.mdx').model;
 assert.deepEqual(b.Bones[0].Translation,a.Bones[0].Translation);
});
test('world reduction spends one bound across parent/child chains and preserves exact endpoints',()=>{
 const bytes=fixture(m=>{const child=createNode(m,'Bone');child.Parent=m.Bones[0].ObjectId;child.Translation=structuredClone(m.Bones[0].Translation);m.Geosets[0].Groups=[[child.ObjectId]];});
 const a=openDocument(bytes,'a.mdx').model,result=runOptimizeStage(bytes,'animation',{mode:'world',worldTolerance:1}),b=openDocument(result.bytes,'b.mdx').model;
 assert.ok(result.saved>0);assert.ok(result.stats.keys>0);const error=compare(a,b,.5);
 assert.ok(error.max<=result.animationMetrics.sequences[0].budget+1e-6);assert.equal(error.endpoints,0);
});
test('budgets follow measured motion and model scale, independent of labels and timestamps',()=>{
 assert.equal(sequenceWorldBudget(.01,100,2),.5);assert.equal(sequenceWorldBudget(2,100,2),2);
 assert.equal(sequenceWorldBudget(.3,100,2)*2,sequenceWorldBudget(.6,200,4));
 const bytes=fixture(m=>m.Sequences.push({...structuredClone(m.Sequences[0]),Name:'same arbitrary',Interval:new Uint32Array([200,300])}));
 const a=openDocument(bytes,'a.mdx').model,result=runOptimizeStage(bytes,'animation',simpleSettings('animation',100,a,'world'));
 assert.ok(result.animationMetrics.sequences[0].budget>result.animationMetrics.sequences[1].budget);
});
test('subtle speech-like cycles survive a large world budget',()=>{
 const bytes=fixture(m=>m.Bones[0].Translation=track([key(0,[0,0,0]),key(25,[.001,0,0]),key(50,[0,0,0]),key(75,[.001,0,0]),key(100,[0,0,0])]));
 const a=openDocument(bytes,'a.mdx').model,result=runOptimizeStage(bytes,'animation',{mode:'world',worldTolerance:100}),b=openDocument(result.bytes,'b.mdx').model;
 assert.deepEqual(b.Bones[0].Translation,a.Bones[0].Translation);assert.equal(compare(a,b).max,0);
});
test('a long-reach weapon is bounded at its skinned tip',()=>{
 const bytes=fixture(m=>{m.Geosets[0].Vertices[0]=10000;m.Bones[0].Rotation=track(Array.from({length:21},(_,i)=>key(i*5,[0,0,Math.sin((i*.01+.0005*Math.sin(i))/2),Math.cos((i*.01+.0005*Math.sin(i))/2)])));});
 const a=openDocument(bytes,'a.mdx').model,result=runOptimizeStage(bytes,'animation',{mode:'world',worldTolerance:.5}),b=openDocument(result.bytes,'b.mdx').model;
 assert.ok(compare(a,b,.5).max<=result.animationMetrics.sequences[0].budget+1e-5);
});
test('globals, globally influenced local tracks, overlaps and exclusions stay protected',()=>{
 for(const kind of ['global','global-child','overlap','excluded']){
  const bytes=fixture(m=>{
   if(kind==='global'){m.GlobalSequences=[100];m.Bones[0].Translation.GlobalSeqId=0;}
   if(kind==='global-child'){const child=createNode(m,'Bone');child.Parent=m.Bones[0].ObjectId;child.Rotation=track([key(0,[0,0,0,1]),key(100,[0,0,1,0])]);child.Rotation.GlobalSeqId=0;m.GlobalSequences=[100];m.Geosets[0].Groups=[[child.ObjectId]];}
   if(kind==='overlap')m.Sequences.push({...structuredClone(m.Sequences[0]),Interval:new Uint32Array([90,200])});
  });
  const a=openDocument(bytes,'a.mdx').model,result=runOptimizeStage(bytes,'animation',{mode:'world',worldTolerance:10,...(kind==='excluded'?{excludedGeosets:[0]}:{})}),b=openDocument(result.bytes,'b.mdx').model;
  assert.deepEqual(b.Bones[0].Translation,a.Bones[0].Translation,kind);
 }
});
test('zero strength representation cleanup is opt-in and leaves local mode byte-identical',()=>{
 const bytes=fixture(m=>{delete m.Bones[0].Translation;m.Bones[0].Rotation=track([key(0,[0,0,0,1],true),key(100,[0,0,.6,.8],true)],2);});
 const a=openDocument(bytes,'a.mdx').model,local=runOptimizeStage(bytes,'animation',simpleSettings('animation',0,a)),world=runOptimizeStage(bytes,'animation',simpleSettings('animation',0,a,'world'));
 assert.deepEqual(local.bytes,bytes);assert.equal(world.animationMetrics.exactLinearTracks,1);assert.equal(world.saved,64);
 assert.equal(compare(a,openDocument(world.bytes,'b.mdx').model).endpoints,0);
});
test('approval, rescans, Back and a batch of other stages retain ownership and original bytes',()=>{
 const bytes=fixture(),session=new OptimizeXLSession(bytes),a=openDocument(bytes,'a.mdx').model,settings=simpleSettings('animation',100,a,'world');
 const result=runOptimizeStage(bytes,'animation',settings);session.propose(result,0);session.approve('animation',settings);
 const scan=()=>sanityProposals(openDocument(session.accepted,'approved.mdx').model);
 assert.deepEqual(scan(),scan());const second=runOptimizeStage(result.bytes,'animation',settings);assert.ok(second.bytes.length<=result.bytes.length);
 let batch=result.bytes;for(const stage of ['duplicates','unused'])batch=runOptimizeStage(batch,stage,simpleSettings(stage,0,openDocument(batch,'b.mdx').model)).bytes;
 assert.equal(compare(a,openDocument(batch,'b.mdx').model).endpoints,0);session.back();assert.deepEqual(session.accepted,bytes);assert.deepEqual(session.before,bytes);
});
test('private Fx regression is opt-in and skips cleanly without the private input', {skip:!process.env.MDLXL_FX_MODEL||!fs.existsSync(process.env.MDLXL_FX_MODEL)},()=>{
 const bytes=fs.readFileSync(process.env.MDLXL_FX_MODEL),m=openDocument(bytes,'private.mdx').model,result=runOptimizeStage(bytes,'animation',simpleSettings('animation',100,m,'world'));
 assert.ok(result.saved>0);assert.equal(compare(m,openDocument(result.bytes,'b.mdx').model).endpoints,0);
});

test('cubic vector refitting keeps endpoints and its world bound, and commits only a smaller representation',()=>{
 const bytes=fixture(m=>m.Bones[0].Translation=track(Array.from({length:21},(_,i)=>key(i*5,[i/2,.02*Math.sin(i/5),0],true)),3));
 const a=openDocument(bytes,'a.mdx').model,result=runOptimizeStage(bytes,'animation',{mode:'world',worldTolerance:1}),b=openDocument(result.bytes,'b.mdx').model;
 assert.equal(result.animationMetrics.linearTracks,1);assert.ok(result.saved>0);
 const error=compare(a,b,.25);assert.ok(error.max<=result.animationMetrics.sequences[0].budget+1e-6);assert.equal(error.endpoints,0);
});

test('world exact prerequisites reuse unused-key ownership, preserve setup/global records and remove only constant terminal holds',()=>{
 const bytes=fixture(m=>m.Bones[0].Translation=track([key(0,[0,0,0]),key(40,[1,0,0]),key(70,[1,0,0]),key(100,[1,0,0]),key(200,[9,0,0])]));
 const a=openDocument(bytes,'a.mdx').model,result=runOptimizeStage(bytes,'animation',{mode:'world',worldTolerance:0}),b=openDocument(result.bytes,'b.mdx').model;
 assert.equal(result.animationMetrics.unusedLocalKeys,1);assert.ok(result.animationMetrics.terminalKeys>0);assert.deepEqual(b.Bones[0].Translation.Keys.map(k=>k.Frame),[0,40]);assert.equal(compare(a,b).max,0);
 const curve=fixture(m=>m.Bones[0].Translation=track([key(0,[1,0,0],true),key(100,[1,0,0],true)],2));
 assert.equal(runOptimizeStage(curve,'animation',{mode:'world',worldTolerance:0}).animationMetrics.terminalKeys,0,'equal Hermite tangents are real motion');
});

test('native renderer also evaluates self-controlled quaternion cubics as linear',()=>{
 for(const LineType of [2,3]){
  const bytes=fixture(m=>{delete m.Bones[0].Translation;m.Bones[0].Rotation=track([key(0,[0,0,0,1],true),key(50,[.3,.4,0,Math.sqrt(.75)],true),key(100,[0,0,.6,.8],true)],LineType);});
  const model=openDocument(bytes,'a.mdx').model,linear=structuredClone(model);linear.Bones[0].Rotation=exactLinearQuaternion(model.Bones[0].Rotation);
  const a=new ModelRenderer(model),b=new ModelRenderer(linear);
  for(let frame=0;frame<=100;frame+=.25){
   for(const renderer of [a,b]){renderer.setSequence(0);renderer.setFrame(frame);renderer.updateNode(renderer.rendererData.rootNode);}
   a.rendererData.nodes[0].matrix.forEach((v,i)=>assert.ok(Math.abs(v-b.rendererData.nodes[0].matrix[i])<1e-6));
  }
 }
});
test('small scale and quaternion cycles stay within their component protection',()=>{
 for(const property of ['Scaling','Rotation']){
  const bytes=fixture(m=>{delete m.Bones[0].Translation;m.Bones[0][property]=track([0,25,50,75,100].map((f,i)=>key(f,property==='Scaling'?[1+(i%2)*.001,1,1]:[0,0,Math.sin((i%2)*.0005),Math.cos((i%2)*.0005)])));});
  const a=openDocument(bytes,'a.mdx').model,result=runOptimizeStage(bytes,'animation',{mode:'world',worldTolerance:100}),b=openDocument(result.bytes,'b.mdx').model;
  assert.deepEqual(b.Bones[0][property],a.Bones[0][property]);
 }
});
test('camera-facing or anchored skin chains stay under exact cleanup only',()=>{
 for(const flag of [8,16,32,64,128]){
  const bytes=fixture(m=>m.Bones[0].Flags|=flag),a=openDocument(bytes,'a.mdx').model,result=runOptimizeStage(bytes,'animation',{mode:'world',worldTolerance:10}),b=openDocument(result.bytes,'b.mdx').model;
  assert.deepEqual(b.Bones[0].Translation,a.Bones[0].Translation);
 }
});

test('fresh scans do not revive consumed unused keys and stale checker batches are rejected',()=>{
 const bytes=fixture(m=>m.Bones[0].Translation.Keys.push(key(200,[7,0,0]))),a=openDocument(bytes,'a.mdx').model;
 const old=sanityProposals(a).find(f=>f.kind==='unusedLocalKeys');assert.ok(old);
 const result=runOptimizeStage(bytes,'animation',simpleSettings('animation',100,a,'world')),after=openDocument(result.bytes,'b.mdx').model;
 assert.ok(!sanityProposals(after).some(f=>f.id===old.id));
 assert.throws(()=>runOptimizeStage(result.bytes,'sanity',{}, {kind:'batch',stage:'sanity',entries:[{fix:old,settings:{}}]}),/changed|stale|no longer|current/i);
 assert.deepEqual(runOptimizeStage(result.bytes,'animation',{mode:'world',worldTolerance:0}).bytes,result.bytes,'exact rescan is stable after approval');
});

test('a non-unit rotation in an influence chain protects its other local transforms too',()=>{
 const bytes=fixture(m=>m.Bones[0].Rotation=track([key(0,[0,0,.5,2]),key(100,[0,0,.5,2])])),a=openDocument(bytes,'a.mdx').model;
 const result=runOptimizeStage(bytes,'animation',{mode:'world',worldTolerance:100}),b=openDocument(result.bytes,'b.mdx').model;
 assert.deepEqual(b.Bones[0].Translation,a.Bones[0].Translation);
});
