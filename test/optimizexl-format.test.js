import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { ModelRenderer } from 'war3-model';
import { createStarterDocument } from '../src/starter-model.js';
import { createNode, openDocument } from '../src/editor-document.js';
import { sanityProposals, runOptimizeStage } from '../src/optimizexl.js';
import { classifyHiveFindings } from '../src/optimizexl-diagnostics.js';
import { flattenHiveFindings } from '../app/optimizexl-hive.js';
vm.runInThisContext(fs.readFileSync(new URL('../public/vendor/hive-viewer-5.12.0.js',import.meta.url),'utf8'));
const key=(Frame,Vector)=>({Frame,Vector:new Float32Array(Vector)});
const track=(Keys,GlobalSeqId=null)=>({LineType:1,GlobalSeqId,Keys});
const hive=bytes=>{const m=new ModelViewer.parsers.mdlx.Model();m.load(bytes.slice().buffer);const r=ModelViewer.utils.mdlx.sanityTest(m);return {...r,findings:flattenHiveFindings(r.nodes)};};
function fixture(){
  const d=createStarterDocument();d.apply('Format fixture',['Sequences','Geosets','Bones','GlobalSequences','EventObjects','ParticleEmitters2','PivotPoints'],m=>{
    const s={MinimumExtent:new Float32Array(3),MaximumExtent:new Float32Array(3),BoundsRadius:0,MoveSpeed:0,NonLooping:false,Rarity:0};
    m.Sequences=[[100,200],[700,800],[300,500]].map((Interval,i)=>({...structuredClone(s),Name:['Stand','Death','Attack'][i],Interval:new Uint32Array(Interval)}));
    for(const g of m.Geosets)g.Anims=m.Sequences.map((_,i)=>({...structuredClone(g.Anims[0]),BoundsRadius:10+i}));
    m.GlobalSequences=[100];
    m.Bones[0].Translation=track([key(0,[9,8,7]),key(100,[0,0,0]),key(200,[1,2,3]),key(300,[4,5,6]),key(500,[7,8,9]),key(700,[10,11,12]),key(800,[13,14,15])]);
    m.Bones[0].Rotation=track([key(0,[0,0,0,1]),key(100,[0,0,1,0])],0);
    const e=createNode(m,'ParticleEmitter2');e.Visibility=track([key(100,[0]),key(200,[0]),key(300,[1]),key(500,[1]),key(700,[0]),key(800,[0])]);
    const event=createNode(m,'EventObject');event.Name='SNDXTest';event.EventTrack=new Uint32Array([0,150,350,450,750]);event.GlobalSeqId=null;
    const global=createNode(m,'EventObject');global.Name='SNDXClock';global.EventTrack=new Uint32Array([0,50]);global.GlobalSeqId=0;
  });return d;
}
const supported=m=>sanityProposals(m).filter(f=>['visibilityInterpolation','sequenceTimeline'].includes(f.kind));

test('actual order and visibility diagnostics route to exact format repairs; native local and global playback survive',()=>{
  const source=fixture().serialize('mdx'),before=openDocument(source,'x.mdx').model,fixes=supported(before);
  assert.equal(fixes.length,2);
  const findings=hive(source).findings.filter(f=>/starts before|Interpolation type/.test(f.message));
  assert.equal(findings.length,2);assert.ok(classifyHiveFindings(findings,fixes).every(f=>f.status==='preview'));
  const bytes=runOptimizeStage(source,'sanity',{}, {kind:'batch',stage:'sanity',entries:fixes.map(fix=>({fix}))}).bytes;
  const after=openDocument(bytes,'x.mdx').model;
  assert.ok(!hive(bytes).findings.some(f=>/starts before|Interpolation type/.test(f.message)));
  assert.deepEqual(supported(after),[]);
  const a=new ModelRenderer(structuredClone(before)),b=new ModelRenderer(structuredClone(after));
  for(let si=0;si<before.Sequences.length;si++){
    a.setSequence(si);b.setSequence(si);const old=before.Sequences[si].Interval,now=after.Sequences[si].Interval;
    assert.equal(old[1]-old[0],now[1]-now[0]);
    for(let elapsed=0;elapsed<=old[1]-old[0];elapsed+=.25){a.setFrame(old[0]+elapsed);b.setFrame(now[0]+elapsed);
      assert.deepEqual(a.interp.vec3(new Float32Array(3),before.Bones[0].Translation),b.interp.vec3(new Float32Array(3),after.Bones[0].Translation));
      assert.equal(a.interp.animVectorVal(before.ParticleEmitters2[0].Visibility,1),b.interp.animVectorVal(after.ParticleEmitters2[0].Visibility,1));
    }
  }
  assert.deepEqual(after.Sequences.map(s=>s.Name),before.Sequences.map(s=>s.Name));
  assert.deepEqual(after.Geosets,before.Geosets);assert.deepEqual(after.Bones[0].Rotation,before.Bones[0].Rotation);
  assert.deepEqual(after.EventObjects[1],before.EventObjects[1]);
  assert.deepEqual(Array.from(after.EventObjects[0].EventTrack),[0,150,750,851,951]);
  assert.deepEqual(after.Bones[0].Translation.Keys[0],before.Bones[0].Translation.Keys[0]);
});

test('batch equals both individual orders; stale format plans and duplicate selection fail',()=>{
  const source=fixture().serialize('mdx'),fixes=supported(openDocument(source,'x.mdx').model);
  const expected=runOptimizeStage(source,'sanity',{}, {kind:'batch',stage:'sanity',entries:fixes.map(fix=>({fix}))}).bytes;
  for(const order of [fixes,[...fixes].reverse()]){let bytes=source;
    for(const old of order){const fix=supported(openDocument(bytes,'x.mdx').model).find(f=>f.id===old.id);bytes=runOptimizeStage(bytes,'sanity',{},fix).bytes;}
    assert.deepEqual(bytes,expected);
  }
  const d=fixture();d.model.Bones[0].Translation.Keys[1].Vector[0]=10;
  assert.throws(()=>runOptimizeStage(d.serialize('mdx'),'sanity',{},fixes.find(f=>f.kind==='sequenceTimeline')),/finding changed/);
  assert.throws(()=>runOptimizeStage(source,'sanity',{}, {kind:'batch',stage:'sanity',entries:[{fix:fixes[0]},{fix:fixes[0]}]}),/selected twice/);
});

test('timeline repairs compose with existing opening and redundant key owners in either approval order',()=>{
  const d=fixture();d.model.Bones[0].Translation.Keys=d.model.Bones[0].Translation.Keys.filter(k=>k.Frame!==300);
  d.model.Bones[0].Translation.Keys.push(key(400,[5,6,7]));d.model.Bones[0].Translation.Keys.sort((a,b)=>a.Frame-b.Frame);
  d.model.Bones[0].Scaling=track([key(300,[1,1,1]),key(400,[1,1,1]),key(500,[1,1,1])]);
  const source=d.serialize('mdx'),fixes=sanityProposals(openDocument(source,'x.mdx').model).filter(f=>!f.inspectionOnly);
  assert.ok(fixes.some(f=>f.kind==='openingTrack'));assert.ok(fixes.some(f=>f.kind==='redundantTracks'));
  const expected=runOptimizeStage(source,'sanity',{}, {kind:'batch',stage:'sanity',entries:fixes.map(fix=>({fix}))}).bytes;
  for(const order of [fixes,[...fixes].reverse()]){let bytes=source;
    for(const old of order){const fix=sanityProposals(openDocument(bytes,'x.mdx').model).find(f=>f.id===old.id);assert.ok(fix);bytes=runOptimizeStage(bytes,'sanity',{},fix).bytes;}
    assert.deepEqual(bytes,expected);
  }
});

test('timeline relocation composes with the existing cubic representation owner',()=>{
  const d=fixture();d.model.Sequences[1].Interval.set([2700,2800]);d.model.Sequences[2].Interval.set([300,2300]);
  for(const t of [d.model.Bones[0].Translation,d.model.ParticleEmitters2[0].Visibility])for(const k of t.Keys)if(k.Frame>=700)k.Frame+=2000;
  d.model.EventObjects[0].EventTrack=new Uint32Array([0,150,350,450,2750]);
  const n=createNode(d.model,'Helper');
  n.Translation=track([key(300,[0,0,0]),key(1000,[0,0,0]),key(1600,[0,0,0]),key(2300,[0,0,5])]);n.Translation.LineType=3;
  for(const k of n.Translation.Keys){k.InTan=new Float32Array(k.Vector);k.OutTan=new Float32Array(k.Vector);}
  n.Translation.Keys[0].OutTan[2]=1;
  const source=d.serialize('mdx'),fixes=sanityProposals(openDocument(source,'x.mdx').model).filter(f=>!f.inspectionOnly);
  assert.ok(fixes.some(f=>f.kind==='splineResample'));
  const expected=runOptimizeStage(source,'sanity',{}, {kind:'batch',stage:'sanity',entries:fixes.map(fix=>({fix}))}).bytes;
  for(const order of [fixes,[...fixes].reverse()]){let bytes=source;
    for(const old of order){const current=sanityProposals(openDocument(bytes,'x.mdx').model).find(f=>f.id===old.id);assert.ok(current);bytes=runOptimizeStage(bytes,'sanity',{},current).bytes;}
    assert.deepEqual(bytes,expected);
  }
});

test('overlaps, shared boundaries, unused records entering moved domains, malformed and exhausted timelines stay manual',()=>{
  const cases=[m=>m.Sequences[2].Interval.set([150,350]),m=>m.Sequences[2].Interval.set([200,500]),
    m=>m.Bones[0].Translation.Keys.push(key(900,[0,0,0])),m=>m.EventObjects[0].EventTrack=new Uint32Array([150,900]),
    m=>m.Sequences[1].Interval.set([0x7fffff00,0x7ffffffe]),m=>m.Sequences[2].Interval.set([500,300]),
    m=>m.Bones[0].Translation.Keys[2].Frame=100];
  for(const change of cases){const m=fixture().model;change(m);m.Bones[0].Translation.Keys.sort((a,b)=>a.Frame-b.Frame);
    assert.ok(!supported(m).some(f=>f.kind==='sequenceTimeline'));
  }
});

test('constant global visibility is exact; fades, cubic curves and stale visibility evidence are not converted',()=>{
  const d=fixture();const t=d.model.ParticleEmitters2[0].Visibility;
  const old=supported(d.model).find(f=>f.kind==='visibilityInterpolation');t.Keys[1].Vector[0]=.5;
  assert.ok(!supported(d.model).some(f=>f.kind==='visibilityInterpolation'));
  assert.throws(()=>runOptimizeStage(d.serialize('mdx'),'sanity',{},old),/finding changed/);
  t.Keys=[key(0,[.7]),key(100,[.7])];t.GlobalSeqId=0;
  assert.ok(supported(d.model).some(f=>f.kind==='visibilityInterpolation'));
  t.LineType=3;for(const k of t.Keys){k.InTan=new Float32Array([0]);k.OutTan=new Float32Array([1]);}
  assert.ok(!supported(d.model).some(f=>f.kind==='visibilityInterpolation'));
});

test('small genuine extrema survive Hive cleanup and spline resampling while roundoff and constant cleanup retain their owner',()=>{
  for(const type of [1,3])for(const property of ['Translation','Scaling','Rotation']){
    const d=fixture();d.model.Sequences.sort((a,b)=>a.Interval[0]-b.Interval[0]);
    const base=property==='Rotation'?[0,0,0,1]:[1,1,1],turn=[...base];turn[0]+=.0005;
    const t=track([key(100,base),key(150,turn),key(200,base)]);t.LineType=type;
    if(type===3)for(const k of t.Keys){k.InTan=new Float32Array(k.Vector);k.OutTan=new Float32Array(k.Vector);}
    d.model.Bones[0][property]=t;const fixes=sanityProposals(d.model).filter(f=>f.path?.join('.')===`Bones.0.${property}`);
    assert.ok(fixes.some(f=>f.kind==='redundantTracks'&&f.inspectionOnly&&f.preservedTurns.includes(150)));
    assert.ok(!fixes.some(f=>f.kind==='splineResample'));
    turn[0]=base[0];t.Keys[1].Vector=new Float32Array(turn);t.LineType=1;
    assert.ok(sanityProposals(d.model).some(f=>f.path?.join('.')===`Bones.0.${property}`&&f.kind==='redundantTracks'&&!f.inspectionOnly));
  }
});
