import test from 'node:test';
import assert from 'node:assert/strict';
import { createStarterDocument } from '../src/starter-model.js';
import { openDocument } from '../src/editor-document.js';
import { sanityProposals, runOptimizeStage } from '../src/optimizexl.js';
import { sampleTrack, sampleGeosetAnimation } from '../src/animation.js';
const key=(Frame,value)=>({Frame,Vector:new Float32Array(value)});
const track=(values,type=1)=>({LineType:type,GlobalSeqId:null,Keys:values.map(([f,v])=>key(f,v))});
function document(edit=()=>{}) {
 const d=createStarterDocument();
 d.apply('Exact cleanup fixture',['Sequences','Geosets','GeosetAnims','Bones','Helpers','PivotPoints','GlobalSequences'],m=>{
  m.Sequences=[['Stand',[0,100]],['Walk',[200,300]]].map(([Name,Interval])=>({Name,Interval:new Uint32Array(Interval),BoundsRadius:128,MinimumExtent:new Float32Array([-64,-64,-64]),MaximumExtent:new Float32Array([64,64,64]),MoveSpeed:0,NonLooping:false,Rarity:0}));
  for(const g of m.Geosets)g.Anims=m.Sequences.map(()=>({BoundsRadius:g.BoundsRadius,MinimumExtent:new Float32Array(g.MinimumExtent),MaximumExtent:new Float32Array(g.MaximumExtent)}));
  m.GeosetAnims=[{GeosetId:0,Flags:2,Alpha:track([[0,[1]],[100,[1]],[200,[1]],[300,[1]]]),Color:new Float32Array([1,1,1]),_MdxDefaults:{Alpha:.5}}];
  edit(m);
 });return d;
}
const proposal=m=>sanityProposals(m).find(f=>f.kind==='exactCleanup');
const apply=d=>{const bytes=d.serialize('mdx'),m=openDocument(bytes,'before.mdx').model,fix=proposal(m);assert.ok(fix,'Exact redundancy must be offered for review');const r=runOptimizeStage(bytes,'sanity',{},fix);return {before:m,after:openDocument(r.bytes,'after.mdx').model,fix,result:r};};

test('exact endpoint cleanup is offered without changing established local reduction',()=>{
 const d=document(),bytes=d.serialize('mdx');
 assert.equal(runOptimizeStage(bytes,'animation',{position:0,rotation:0,scale:0}).saved,0);
 const {before,after,result}=apply(d);assert.ok(result.saved>0);
 assert.deepEqual(after.GeosetAnims[0].Alpha.Keys.map(k=>k.Frame),[0,200,300]);
 for(const s of before.Sequences)for(let f=s.Interval[0];f<=s.Interval[1];f++)assert.equal(sampleTrack(before.GeosetAnims[0].Alpha,f,{interval:s.Interval,fallback:1}),sampleTrack(after.GeosetAnims[0].Alpha,f,{interval:s.Interval,fallback:1}));
 assert.deepEqual(after.Sequences,before.Sequences);
 assert.equal(proposal(after),undefined,'Rescan is idempotent');
});

test('constant RGB conversion retains RGB ordering and static base',()=>{
 const rgb=[.25,.5,1],d=document(m=>{m.GeosetAnims[0].Color=track([[0,rgb],[100,rgb],[200,rgb],[300,rgb]]);m.GeosetAnims[0]._MdxDefaults.Color=new Float32Array(rgb);});
 const {before,after}=apply(d);assert.deepEqual(after.GeosetAnims[0].Color,new Float32Array(rgb));
 for(const sequence of [-1,0,1])assert.deepEqual(sampleGeosetAnimation(after,0,sequence===1?250:50,sequence),sampleGeosetAnimation(before,0,sequence===1?250:50,sequence));
});

test('different unanimated bases, missing domains and genuine curves keep their tracks',()=>{
 const rgb=[.25,.5,1];
 for(const kind of ['base','missing','spline']){
  const d=document(m=>{const a=m.GeosetAnims[0];a.Color=track(kind==='missing'?[[0,rgb],[100,rgb]]:[[0,rgb],[100,rgb],[200,rgb],[300,rgb]]);a._MdxDefaults.Color=new Float32Array(kind==='base'?[1,1,1]:rgb);if(kind==='spline'){a.Color.LineType=2;for(const k of a.Color.Keys){k.InTan=new Float32Array([1,1,1]);k.OutTan=new Float32Array([1,1,1]);}}});
  const {before,after}=apply(d);assert.ok(after.GeosetAnims[0].Color.Keys,kind+' must retain an animated representation');
  for(let si=-1;si<2;si++)for(const f of si<0?[0]:[...Array(101)].map((_,i)=>before.Sequences[si].Interval[0]+i))assert.deepEqual(sampleGeosetAnimation(before,0,f,si),sampleGeosetAnimation(after,0,f,si));
 }
});

test('white colour tracks missing from an animation stay animated (game default there is black)',()=>{
 // mdx-m3-viewer (KGAC default vec3 0,0,0) shows a Color track's empty animation black, unlike a static colour.
 const white=[1,1,1],d=document(m=>{const a=m.GeosetAnims[0];a.Color=track([[0,white],[100,white]]);a._MdxDefaults.Color=new Float32Array(white);});
 const {after,fix}=apply(d);
 assert.ok(!fix.tracks.some(t=>t.path.join('.')==='GeosetAnims.0.Color'),'no static colour conversion is offered');
 assert.deepEqual(after.GeosetAnims[0].Color.Keys.map(k=>k.Frame),[0,100]);
});

test('only actual identity transform tracks become implicit defaults',()=>{
 const d=document(m=>{m.Bones[0].Scaling=track([[0,[1,1,1]],[100,[1,1,1]],[200,[1,1,1]],[300,[1,1,1]]]);m.Bones[0].Translation=track([[0,[2,0,0]],[100,[2,0,0]],[200,[2,0,0]],[300,[2,0,0]]]);});
 const {after}=apply(d);assert.equal(after.Bones[0].Scaling,undefined);assert.ok(after.Bones[0].Translation?.Keys);
});

test('non-unit quaternion boundary keys stay authored and step rotation can reduce',()=>{
 for(const type of [0,1]){
  const d=document(m=>{m.Bones[0].Rotation=track([[0,[0,0,.3,.9]],[100,[0,0,.3,.9]],[200,[0,0,.3,.9]],[300,[0,0,.3,.9]]],type);});
  const {before,after}=apply(d);assert.deepEqual(after.Bones[0].Rotation.Keys.map(k=>k.Frame),type===0?[0,200,300]:[0,100,200,300]);
  for(const s of before.Sequences)for(let f=s.Interval[0];f<=s.Interval[1];f++){const options={interval:s.Interval,fallback:[0,0,0,1],quaternion:true};assert.deepEqual(sampleTrack(after.Bones[0].Rotation,f,options),sampleTrack(before.Bones[0].Rotation,f,options));}
 }
});

test('sequence gaps, globals and overlapping ranges are not guessed across',()=>{
 for(const kind of ['gap','global','overlap']){
  const d=document(m=>{if(kind==='gap')m.GeosetAnims[0].Alpha.Keys.splice(2,0,key(150,[.3]));if(kind==='global'){m.GlobalSequences=[400];m.GeosetAnims[0].Alpha.GlobalSeqId=0;}if(kind==='overlap')m.Sequences[1].Interval=new Uint32Array([90,300]);});
  const m=openDocument(d.serialize('mdx'),'x.mdx').model,fix=proposal(m);assert.ok(!fix?.tracks.some(t=>t.path.join('.')==='GeosetAnims.0.Alpha'),kind);
 }
});

test('stale exact plans are refused and disjoint selected fixes match individual approval',()=>{
 const d=document(),{before,fix,result}=apply(d);
 const changed=document(m=>{m.GeosetAnims[0].Alpha.Keys[1].Vector[0]=.4;});
 assert.throws(()=>runOptimizeStage(changed.serialize('mdx'),'sanity',{},fix),/changed|stale/i);
 const other=sanityProposals(before).find(f=>f.kind==='checker'&&f.rule==='origin');
 if(other){const bytes=d.serialize('mdx');const together=runOptimizeStage(bytes,'sanity',{}, {kind:'batch',stage:'sanity',entries:[{fix,settings:{}},{fix:other,settings:{}}]});const alone=runOptimizeStage(result.bytes,'sanity',{},sanityProposals(openDocument(result.bytes,'x.mdx').model).find(f=>f.id===other.id));assert.deepEqual(together.bytes,alone.bytes);}
});

test('exact cleanup respects excluded geosets and shared node dependencies',()=>{
 const d=document(m=>{m.Bones[0].Scaling=track([[0,[1,1,1]],[100,[1,1,1]],[200,[1,1,1]],[300,[1,1,1]]]);}),bytes=d.serialize('mdx'),before=openDocument(bytes,'x.mdx').model,fix=proposal(before);assert.ok(fix);
 const after=runOptimizeStage(bytes,'sanity',{excludedGeosets:[0]},fix);
 assert.deepEqual(openDocument(after.bytes,'x.mdx').model.GeosetAnims,before.GeosetAnims);assert.deepEqual(openDocument(after.bytes,'x.mdx').model.Bones,before.Bones);
});

test('collapsed triangle cleanup preserves surviving attributes, additive duplicates and old unused points',()=>{
 const d=document(m=>{const g=m.Geosets[0],n=g.Vertices.length/3;
  g.Vertices=new Float32Array([...g.Vertices,...g.Vertices.slice(0,3),99,99,99]);g.Normals=new Float32Array([...g.Normals,0,0,-1,0,1,0]);g.TVertices=g.TVertices.map(uv=>new Float32Array([...uv,.1,.9,0,0]));g.VertexGroup=new Uint8Array([...g.VertexGroup,g.VertexGroup[0],g.VertexGroup[0]]);
  g.Faces=new Uint16Array([...g.Faces,0,n,1,...g.Faces.slice(0,3)]);g.PrimitiveTypes=Uint32Array.of(4);g.PrimitiveCounts=Uint32Array.of(g.Faces.length);m.Materials[g.MaterialID].Layers[0].FilterMode=3;
 });
 const {before,after}=apply(d),a=after.Geosets[0],b=before.Geosets[0];assert.equal(a.Faces.length,b.Faces.length-3);assert.equal(a.Vertices.length,b.Vertices.length-3);assert.deepEqual([...a.Vertices.slice(-3)],[99,99,99],'preexisting unused vertex stays with its old owner');
 assert.deepEqual([...a.Faces.slice(-3)],[...a.Faces.slice(0,3)],'intentional additive duplicate remains');assert.deepEqual(a.Anims,b.Anims);assert.deepEqual(a.MinimumExtent,b.MinimumExtent);assert.equal(a.MaterialID,b.MaterialID);assert.equal(a.PrimitiveCounts[0],a.Faces.length);
 const record=(g,i)=>[...g.Vertices.slice(i*3,i*3+3),...g.Normals.slice(i*3,i*3+3),...g.TVertices.flatMap(t=>Array.from(t.slice(i*2,i*2+2))),...g.Groups[g.VertexGroup[i]]];
 const oldFaces=Array.from(b.Faces).filter((_,i)=>Math.floor(i/3)!==b.Faces.length/3-2);assert.deepEqual(Array.from(a.Faces,i=>record(a,i)),oldFaces.map(i=>record(b,i)));
});

test('coincident points with different influence multiplicity remain animated geometry',()=>{
 const d=document(m=>{const g=m.Geosets[0],n=g.Vertices.length/3;g.Vertices=new Float32Array([...g.Vertices,...g.Vertices.slice(0,3)]);g.Normals=new Float32Array([...g.Normals,...g.Normals.slice(0,3)]);g.TVertices=g.TVertices.map(uv=>new Float32Array([...uv,...uv.slice(0,2)]));g.Groups.push([...g.Groups[g.VertexGroup[0]],...g.Groups[g.VertexGroup[0]]]);g.TotalGroupsCount=g.Groups.reduce((n,v)=>n+v.length,0);g.VertexGroup=new Uint8Array([...g.VertexGroup,g.Groups.length-1]);g.Faces=new Uint16Array([...g.Faces,0,n,1]);g.PrimitiveTypes=Uint32Array.of(4);g.PrimitiveCounts=Uint32Array.of(g.Faces.length);});
 const {before,after}=apply(d);assert.deepEqual(after.Geosets,before.Geosets);
});


test('new exact cleanup leaves cubic tracks with floating-point interpolation untouched',()=>{
 for(const type of [2,3]){
  const d=document(m=>{const a=m.GeosetAnims[0],rgb=[.3,.4,.9];a.Color=track([[0,rgb],[100,rgb],[200,rgb],[300,rgb]],type);a._MdxDefaults.Color=new Float32Array(rgb);for(const k of a.Color.Keys){k.InTan=new Float32Array(type===2?[0,0,0]:rgb);k.OutTan=new Float32Array(k.InTan);}});
  const {before,after}=apply(d);assert.deepEqual(after.GeosetAnims[0].Color,before.GeosetAnims[0].Color);
 }
});


test('timeline relocation owns track timestamps before cleanup; geometry composes in either order',()=>{
 const d=document(m=>{m.Sequences[0].Interval=new Uint32Array([700,800]);m.Sequences[1].Interval=new Uint32Array([0,100]);m.GeosetAnims[0].Alpha.Keys=track([[0,[1]],[100,[1]],[700,[1]],[800,[1]]]).Keys;const g=m.Geosets[0];g.Vertices.set(g.Vertices.slice(0,3),3);}),source=d.serialize('mdx'),catalog=sanityProposals(openDocument(source,'x.mdx').model);
 const cleanup=catalog.find(f=>f.kind==='exactCleanup'),timeline=catalog.find(f=>f.kind==='sequenceTimeline');assert.ok(cleanup);assert.ok(timeline);assert.deepEqual(cleanup.tracks,[],'relocation keeps track ownership until its timestamps are settled');assert.ok(cleanup.geosets.length);
 const batch=runOptimizeStage(source,'sanity',{}, {kind:'batch',stage:'sanity',entries:[{fix:timeline},{fix:cleanup}]}).bytes;
 for(const order of [[cleanup,timeline],[timeline,cleanup]]){let bytes=source;for(const old of order){const fix=sanityProposals(openDocument(bytes,'x.mdx').model).find(f=>f.id===old.id);assert.ok(fix);if(old===cleanup&&order[0]===timeline){assert.ok(fix.tracks.length);}bytes=runOptimizeStage(bytes,'sanity',{},fix).bytes;}const current=proposal(openDocument(bytes,'x.mdx').model);if(current)bytes=runOptimizeStage(bytes,'sanity',{},current).bytes;const remaining=proposal(openDocument(batch,'x.mdx').model);const expected=runOptimizeStage(batch,'sanity',{},remaining).bytes;assert.deepEqual(bytes,expected);}
});


test('structural checker repairs keep ownership before the new cleanup is offered',()=>{
 for(const kind of ['zeroFaces','duplicateGeosetAnims']){
  const d=document(m=>{if(kind==='zeroFaces'){const g=structuredClone(m.Geosets[0]);g.Faces=new Uint16Array();g.PrimitiveTypes=Uint32Array.of(4);g.PrimitiveCounts=Uint32Array.of(0);m.Geosets.push(g);}else m.GeosetAnims.push(structuredClone(m.GeosetAnims[0]));}),bytes=d.serialize('mdx'),before=openDocument(bytes,'x.mdx').model,repair=sanityProposals(before).find(f=>f.kind==='checker'&&f.rule===kind);assert.ok(repair);assert.equal(proposal(before),undefined,'structural remapping finishes before cleanup paths are captured');
  const after=runOptimizeStage(bytes,'sanity',{},repair);assert.ok(proposal(openDocument(after.bytes,'x.mdx').model),'cleanup becomes available after the existing repair');
 }
});
