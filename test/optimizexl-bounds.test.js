import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {ModelRenderer} from 'war3-model';
import {createStarterDocument} from '../src/starter-model.js';
import {openDocument} from '../src/editor-document.js';
import {runOptimizeStage,sanityProposals} from '../src/optimizexl.js';
import {classifyHiveFindings} from '../src/optimizexl-diagnostics.js';
import {flattenHiveFindings} from '../app/optimizexl-hive.js';
vm.runInThisContext(fs.readFileSync(new URL('../public/vendor/hive-viewer-5.12.0.js',import.meta.url),'utf8'));
const hive=bytes=>{const m=new ModelViewer.parsers.mdlx.Model();m.load(bytes.slice().buffer);const r=ModelViewer.utils.mdlx.sanityTest(m);return {...r,findings:flattenHiveFindings(r.nodes)};};
const extent=()=>({MinimumExtent:new Float32Array([-999,-999,-999]),MaximumExtent:new Float32Array([999,999,999]),BoundsRadius:2000});
const key=(Frame,Vector)=>({Frame,Vector:new Float32Array(Vector)});
test('invalid animated bounds repair survives save/reopen and contains moving geometry',()=>{
 const doc=createStarterDocument();doc.apply('fixture',['Sequences','Bones','Geosets'],m=>{
  m.Sequences=[{Name:'Death',Interval:new Uint32Array([0,1000]),MinimumExtent:new Float32Array([1e30,1e30,1e30]),MaximumExtent:new Float32Array([-1e30,-1e30,-1e30]),BoundsRadius:1,MoveSpeed:0,NonLooping:true,Rarity:0}];
  m.Bones[0].Translation={LineType:1,GlobalSeqId:null,Keys:[{Frame:0,Vector:new Float32Array(3)},{Frame:1000,Vector:new Float32Array([100,0,0])}]};
  m.Geosets[0].Anims=[extent()];
 });
 const bytes=doc.serialize('mdx'),before=openDocument(bytes,'before.mdx').model,fix=sanityProposals(before).find(p=>p.kind==='bounds');assert.ok(fix);
 const after=openDocument(runOptimizeStage(bytes,'sanity',{},fix).bytes,'after.mdx').model;
 assert.ok(after.Sequences[0].MaximumExtent[0]>=Math.max(...before.Geosets[0].Vertices.filter((_,i)=>i%3===0))+100);
 assert.deepEqual(after.Geosets,before.Geosets);assert.deepEqual(after.Bones,before.Bones);assert.deepEqual(after.Sequences[0].Interval,before.Sequences[0].Interval);assert.equal(sanityProposals(after).filter(p=>p.kind==='bounds').length,0);
});

function tableFixture(counts=[1,3,2],intervals=[[100,200],[400,500]]){
 const doc=createStarterDocument();doc.apply('Extent tables',['Sequences','Geosets','Bones'],m=>{
  m.Sequences=intervals.map((Interval,i)=>({...extent(),Name:`Animation ${i}`,Interval:new Uint32Array(Interval),MoveSpeed:0,NonLooping:false,Rarity:0}));
  m.Geosets=counts.map(count=>({...structuredClone(m.Geosets[0]),Anims:Array.from({length:count},extent)}));
  m.Bones[0].Translation={LineType:1,GlobalSeqId:null,Keys:intervals.flatMap(([lo,hi],i)=>[key(lo,[i*200,0,0]),key(hi,[i*200+100,0,0])]).sort((a,b)=>a.Frame-b.Frame)};
 });return doc;
}

for(const count of [0,1,3,5])test(`rebuild ${count} extents for two animations from current animated geometry`,()=>{
 const source=tableFixture([count,2]).serialize('mdx'),before=openDocument(source,'x.mdx').model,fix=sanityProposals(before).find(f=>f.kind==='bounds');
 assert.equal(fix.targets.length,1);assert.ok(fix.targets[0].sequenceExtents);
 const findings=hive(source).findings.filter(f=>f.message.startsWith('Number of sequence extents'));
 assert.equal(findings.length,1);assert.equal(classifyHiveFindings(findings,[fix])[0].status,'preview');
 const bytes=runOptimizeStage(source,'sanity',{},fix).bytes,after=openDocument(bytes,'x.mdx').model;
 assert.equal(after.Geosets[0].Anims.length,2);assert.deepEqual(after.Geosets[1],before.Geosets[1]);
 assert.ok(!hive(bytes).findings.some(f=>f.message.startsWith('Number of sequence extents')));
 assert.ok(!sanityProposals(after).some(f=>f.kind==='bounds'));
 const renderer=new ModelRenderer(structuredClone(before));
 for(let si=0;si<2;si++){
  const e=after.Geosets[0].Anims[si],offset=si*200;
  assert.ok(e.MinimumExtent[0]<-32+offset);assert.ok(e.MaximumExtent[0]>132+offset);
  renderer.setSequence(si);
  // Every sampled native node matrix remains identical; only extent metadata
  // changes, including when missing records cannot be matched by index.
  const other=new ModelRenderer(structuredClone(after));other.setSequence(si);
  for(let frame=before.Sequences[si].Interval[0];frame<=before.Sequences[si].Interval[1];frame+=.25){
   renderer.setFrame(frame);other.setFrame(frame);renderer.updateNode(renderer.rendererData.rootNode);other.updateNode(other.rendererData.rootNode);
   assert.deepEqual(renderer.rendererData.nodes.filter(Boolean).map(n=>n.matrix),other.rendererData.nodes.filter(Boolean).map(n=>n.matrix));
  }
 }
 after.Geosets[0].Anims=before.Geosets[0].Anims;assert.deepEqual(after,before);
});

test('one bounds owner covers mismatched tables and invalid records without overlapping writes',()=>{
 const doc=tableFixture();doc.model.Geosets[0].Anims[0].BoundsRadius=-1;
 doc.model.Geosets[1].Anims[2].MinimumExtent[0]=Infinity;
 doc.model.Geosets[2].Anims[1].BoundsRadius=-1;
 const source=doc.serialize('mdx'),before=openDocument(source,'x.mdx').model,fix=sanityProposals(before).find(f=>f.kind==='bounds');
 assert.deepEqual(fix.targets.map(t=>t.path),[['Geosets',0,'Anims'],['Geosets',1,'Anims'],['Geosets',2,'Anims',1]]);
 assert.ok(classifyHiveFindings(hive(source).findings,[fix]).filter(f=>/extent|radius/i.test(f.message)).every(f=>f.status==='preview'));
 const after=openDocument(runOptimizeStage(source,'sanity',{},fix).bytes,'x.mdx').model;
 assert.ok(!sanityProposals(after).some(f=>f.kind==='bounds'));assert.deepEqual(after.Geosets[2].Anims[0],before.Geosets[2].Anims[0]);
});

test('matching tables stay unchanged and models with no animations discard only stray extent records',()=>{
 const doc=tableFixture([2]);assert.ok(!sanityProposals(doc.model).some(f=>f.kind==='bounds'));
 const empty=tableFixture([3],[]),source=empty.serialize('mdx'),before=openDocument(source,'x.mdx').model,fix=sanityProposals(before).find(f=>f.kind==='bounds');
 const after=openDocument(runOptimizeStage(source,'sanity',{},fix).bytes,'x.mdx').model;
 assert.deepEqual(after.Geosets[0].Anims,[]);after.Geosets[0].Anims=before.Geosets[0].Anims;assert.deepEqual(after,before);
});

test('extent findings cannot route a different geoset and stale or duplicate table proposals fail',()=>{
 const doc=tableFixture([1]),fix=sanityProposals(doc.model).find(f=>f.kind==='bounds');
 const fake={type:'warning',path:'/Geoset 10',message:'Number of sequence extents (1) does not match the number of sequences (2)'};
 assert.equal(classifyHiveFindings([fake],[fix])[0].status,'manual');
 const source=doc.serialize('mdx');assert.throws(()=>runOptimizeStage(source,'sanity',{}, {kind:'batch',stage:'sanity',entries:[{fix},{fix}]}),/twice/);
 doc.model.Geosets[0].Anims.push(extent());assert.throws(()=>runOptimizeStage(doc.serialize('mdx'),'sanity',{},fix),/bounds finding changed/);
 const moved=tableFixture([1]);moved.model.Sequences[0].Interval[0]++;
 assert.throws(()=>runOptimizeStage(moved.serialize('mdx'),'sanity',{},fix),/bounds finding changed/);
});

test('table repair composes with opening, unused, exact redundant keys and timeline relocation',()=>{
 const doc=tableFixture([1],[[100,200],[700,800],[400,500]]);
 doc.model.Bones[0].Translation.Keys=[key(110,[0,0,0]),key(200,[100,0,0]),key(250,[9,8,7]),key(400,[400,0,0]),key(500,[500,0,0]),key(700,[200,0,0]),key(800,[300,0,0])];
 doc.model.Bones[0].Scaling={LineType:1,GlobalSeqId:null,Keys:[key(100,[1,1,1]),key(150,[1,1,1]),key(200,[1,1,1])]};
 // General checker repairs (names, Origin point, Stand/Death) are covered in
 // optimizexl-checker-repairs.test.js; this composes the key and table repairs.
 const source=doc.serialize('mdx'),fixes=sanityProposals(openDocument(source,'x.mdx').model).filter(f=>!f.inspectionOnly&&f.kind!=='checker');
 for(const kind of ['bounds','openingTrack','unusedLocalKeys','redundantTracks','sequenceTimeline'])assert.ok(fixes.some(f=>f.kind===kind),kind);
 const batch=runOptimizeStage(source,'sanity',{}, {kind:'batch',stage:'sanity',entries:fixes.map(fix=>({fix}))}).bytes;
 for(const order of [fixes,[...fixes].reverse()]){
  let bytes=source;for(const old of order){const fix=sanityProposals(openDocument(bytes,'x.mdx').model).find(f=>f.id===old.id);assert.ok(fix,old.id);bytes=runOptimizeStage(bytes,'sanity',{},fix).bytes;}
  assert.deepEqual(bytes,batch);
 }
 const checked=hive(batch);assert.deepEqual(checked.findings.filter(f=>/sequence extents|starts before|Missing opening|same value|not in any sequence/.test(f.message)),[]);
 assert.deepEqual(sanityProposals(openDocument(batch,'x.mdx').model).filter(f=>f.kind!=='checker'),[]);
});
