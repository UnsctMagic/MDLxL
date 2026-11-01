import test from 'node:test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createDemoDocument,openDocument} from '../src/editor-document.js';
import {GLOBAL_LOOKS,makeLayer,LAYER_CHOICES,newStack,partFrame} from '../src/global-animation-looks.js';
import {animationPart,compileAnimation,readAnimationStack,FX_SECTIONS} from '../src/global-animation-model.js';
import {fxData} from '../src/global-animation-data.js';
import {visitTracks} from '../src/animation.js';

function fixture(real=false){
 const doc=real?openDocument(fs.readFileSync(new URL('./fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx',import.meta.url)),'knight.mdx'):createDemoDocument(),g=doc.model.Geosets[0],frame=partFrame(g);
 return {doc,frame,donors:{rune:{Geosets:[structuredClone(g)],Materials:[{Layers:[{TextureID:0}]}],Textures:[{Image:LAYER_CHOICES.find(l=>l.type==='Rune').image}]}}};
}
for(const look of GLOBAL_LOOKS)test(look.name+' uses persistent global tracks and reopens as editable MDX and MDL',()=>{
 const {doc,frame,donors}=fixture(look.impact),model=doc.model;
 const old=structuredClone(model.Sequences);
 const before={geos:model.Geosets.length,nodes:model.Nodes.filter(Boolean).length,mats:model.Materials.length};
 const draft=newStack(look,frame,'sample');
 const apply=stack=>doc.apply('Apply '+look.name,FX_SECTIONS,m=>compileAnimation(m,0,stack,donors));
 apply(draft);
 if(look.id==='fly-swarm')assert.ok(model.ParticleEmitters2.every(p=>p.FilterMode===0),'native alpha blend must preserve dark wings and transparent atlas corners');
 assert.deepEqual(model.Sequences,old);
 let total=0;
 for(const record of [...model.Materials,...model.TextureAnims,...model.Nodes.filter(Boolean)].filter(v=>v._FxTag)){
  visitTracks(record,t=>{if(look.impact)assert.equal(t.GlobalSeqId,null,'impacts use the selected local Attack');else assert.equal(model.GlobalSequences[t.GlobalSeqId],draft.loop);total++;});
 }
 assert.ok(total);
 for(const format of ['mdx','mdl']){
  const file=openDocument(doc.serialize(format),'unit.'+format);
  assert.equal(file.readOnly,false);
  assert.deepEqual(fxData(file.model),fxData(model));
  for(const [i,g] of file.model.Geosets.entries())if(g._FxTag)assert.equal(animationPart(file.model,i),0,'selecting a visible FX layer reopens its original part');
  const lengths=m=>[m.Geosets.length,m.Bones.length,m.ParticleEmitters2.length,m.RibbonEmitters.length,m.Materials.length,m.TextureAnims.length,m.GlobalSequences.length];
  const counts=lengths(file.model);
  const changed=structuredClone(file.model.Geosets[0]._FxStack);changed.loop+=307;
  file.apply('Retune',FX_SECTIONS,m=>compileAnimation(m,0,changed,donors));
  assert.deepEqual(lengths(file.model),counts);
  assert.equal(file.model.Geosets[0]._FxStack.loop,changed.loop);
  const free={...changed,layers:[]};file.apply('Remove layers',FX_SECTIONS,m=>compileAnimation(m,0,free,donors));
  assert.equal(file.model.Geosets.length,before.geos);assert.equal(file.model.Nodes.filter(Boolean).length,before.nodes);assert.equal(file.model.Materials.length,before.mats);
 }
 doc.undo();assert.equal(model.Geosets[0]._FxStack,undefined);assert.deepEqual(model.Sequences,old);
});
test('shared authored clock, independent ribbon ends and externally edited emitter survive another layer edit',()=>{
 const {doc,frame,donors}=fixture(),m=doc.model;
 const s=newStack(GLOBAL_LOOKS[0],frame,'blade');m.GlobalSequences.push(s.loop);
 s.layers.push(makeLayer(LAYER_CHOICES.at(-1),frame,'copper',24));s.layers.at(-1).lower*=.4;
 let graph=compileAnimation(m,0,s,donors),r=m.Nodes[graph.layers[24].id];
 assert.ok(r.HeightAbove>2*r.HeightBelow);const flames=graph.layers[s.layers[1].id].ids.map(id=>m.Nodes[id]);
 assert.equal(flames.length,s.layers[1].count);assert.ok(flames.every(n=>(n.Flags&524288)===0));assert.ok(Math.abs(frame.axis.dot(frame.at(s.layers[1].upper).sub(frame.at(-s.layers[1].lower))))>frame.length*.97);
 flames[0].Speed=99;const mid=flames[Math.floor(flames.length/2)];mid.LifeSpan=.91;
 assert.equal(readAnimationStack(m,0).layers[1].lasts,.91);
 const surface=m.Geosets[graph.layers[s.layers[0].id].geoset];
 const nativeLayer=m.Materials[surface.MaterialID].Layers[0];nativeLayer.Alpha=.33;
 m.TextureAnims[nativeLayer.TVertexAnimId].Translation.Keys[1].Vector[0]=3;
 const changed=readAnimationStack(m,0);assert.equal(changed.layers[0].strength,.33);assert.equal(changed.layers[0].speed,3);
 changed.layers[0].strength=.32;
 compileAnimation(m,0,changed,donors);assert.equal(m.Nodes[flames[0].ObjectId].Speed,99);
 compileAnimation(m,0,{...s,layers:[]},donors);assert.ok(m.GlobalSequences.includes(s.loop));
});

test('own texture drifts within painted unit atlases and scrolls a complete tile on repeating textures',()=>{
 for(const flags of [0,3]){
  const {doc,frame}=fixture(),m=doc.model,geo=m.Geosets[0];
  const native=m.Materials[geo.MaterialID].Layers.at(-1);
  m.Textures[native.TextureID].Flags=flags;
  const draft=newStack(GLOBAL_LOOKS.find(l=>l.id==='moving-own'),frame,'skin');
  draft.layers[0].direction=90;draft.layers[0].speed=2;
  const result=compileAnimation(m,0,draft),surface=m.Geosets[result.layers[1].geoset];
  const layer=m.Materials[surface.MaterialID].Layers[0],motion=m.TextureAnims[layer.TVertexAnimId].Translation.Keys;
  if(flags===0){
   assert.deepEqual(surface.TVertices[0],geo.TVertices[0]);
   assert.equal(motion.length,9);
   assert.ok(motion[1].Vector[1]>.005&&motion[1].Vector[1]<.025);
   assert.deepEqual(motion[0].Vector,motion.at(-1).Vector);
  }else{
   assert.equal(motion.length,2);assert.equal(motion.at(-1).Vector[0],2);
  }
 }
});
test('an FX edge drops as it ages, and the newest points still touch the part',async()=>{
 const {NativeParticleSimulation}=await import('../app/particle-preview-adapter.js');
 const {doc,frame,donors}=fixture(),edge=makeLayer(LAYER_CHOICES.at(-1),frame,'copper',1);
 const stack={...newStack(GLOBAL_LOOKS[0],frame,'blade'),layers:[edge]};
 edge.gravity=80;edge.lasts=1.5;compileAnimation(doc.model,0,stack,donors);
 const simulate=gravity=>{
  const m=structuredClone(doc.model);m.RibbonEmitters[0].Gravity=gravity;
  const sim=new NativeParticleSimulation(m);sim.advance(650);return sim.snapshot().ribbons[0];
 };
 const falling=simulate(80),level=simulate(0),last=(level.creationTimes.length-1)*6;
 assert.ok(last>6);assert.ok(level.vertices[2]-falling.vertices[2]>8);
 assert.ok(Math.abs(level.vertices[last+2]-falling.vertices[last+2])<.1);
});
test('emission on separated parts of a curved blade stays on its selected triangles',()=>{
 const geo={Vertices:Float32Array.from([-10,-1,0,-10,1,0,-8,0,0, 8,4,0,10,5,0,10,3,0]),Faces:Uint16Array.from([0,1,2,3,4,5])};
 const frame=partFrame(geo),surface=frame.surfaceAt(0);
 assert.ok(Math.abs(surface.x)>=8,'the middle crosses an empty gap between the two faces');
 assert.ok(frame.surfaceAt(frame.length).distanceTo(frame.at(frame.length))<.001,'an explicitly extended end is respected');
});
test('saving without the layer list keeps every native emitter, clock and material in either format',async()=>{
 const {removeEditorData}=await import('../src/editor-data.js');
 const {doc,frame,donors}=fixture(),stack=newStack(GLOBAL_LOOKS[0],frame,'sword');
 doc.apply('Flame',FX_SECTIONS,m=>compileAnimation(m,0,stack,donors));
 for(const format of ['mdx','mdl']){
  const bytes=doc.serialize(format),stripped=removeEditorData(bytes,format);
  assert.ok(stripped.removedBytes>0);
  const a=openDocument(bytes,'sword.'+format).model,b=openDocument(stripped.bytes,'sword.'+format).model;
  assert.equal(fxData(b),null);assert.deepEqual(b.GlobalSequences,a.GlobalSequences);
  assert.deepEqual(b.ParticleEmitters2.map(p=>p.EmissionRate),a.ParticleEmitters2.map(p=>p.EmissionRate));
  assert.deepEqual(b.Materials.map(m=>m.Layers),a.Materials.map(m=>m.Layers));
 }
});

test('water crosses duplicated atlas seams continuously and retains a translucent painted underlay',()=>{
 const {doc}=fixture(),m=doc.model,g=m.Geosets[0],base=g.MaterialID;
 // Duplicate vertices occupy the same place but unrelated corners of the source atlas.
 const count=g.Vertices.length/3;
 g.Vertices=Float32Array.from([...g.Vertices,...g.Vertices]);
 g.Normals=Float32Array.from([...g.Normals,...g.Normals]);
 g.TVertices=[Float32Array.from([...g.TVertices[0],...Array.from(g.TVertices[0],v=>v*.03+.7)])];
 g.VertexGroup=Uint8Array.from([...g.VertexGroup,...g.VertexGroup]);
 g.Faces=Uint16Array.from([...g.Faces,...Array.from(g.Faces,v=>v+count)]);g.PrimitiveCounts=Uint32Array.from([g.Faces.length]);
 const original=structuredClone(m.Materials[base]);
 const s=newStack(GLOBAL_LOOKS.find(l=>l.id==='water-skin'),partFrame(g),'water');
 const result=compileAnimation(m,0,s);
 assert.deepEqual(m.Materials[base],original,'the authored material stays intact');
 const underlay=m.Materials[g.MaterialID].Layers[0];
 assert.equal(underlay.FilterMode,2);assert.ok(underlay.Alpha>0&&underlay.Alpha<.3);
 const surfaces=s.layers.map(l=>m.Geosets[result.layers[l.id].geoset]);
 for(const surface of surfaces){
  const uv=surface.TVertices[0];
  for(let i=0;i<count*2;i++)assert.equal(uv[i],uv[count*2+i],'a shared position samples the same moving water across an atlas seam');
  const layer=m.Materials[surface.MaterialID].Layers[0];assert.ok(layer.Alpha<.6);
 }
 const a=surfaces[0].TVertices[0],b=surfaces[1].TVertices[0];
 assert.notDeepEqual(a,b,'the two currents cross instead of following one direction');
 for(const format of ['mdx','mdl']){
  const reopened=openDocument(doc.serialize(format),'water.'+format).model;
  assert.equal(readAnimationStack(reopened,0).layers.length,2);
 }
});

test('runes remain on the exact selected triangles and their authored skin weights',()=>{
 const {doc,frame}=fixture(),m=doc.model,source=structuredClone(m.Geosets[0]);
 const stack=newStack(GLOBAL_LOOKS.find(l=>l.id==='rune-blade'),frame,'rune');
 const result=compileAnimation(m,0,stack),shape=m.Geosets[result.layers[1].geoset];
 assert.deepEqual(shape.Vertices,source.Vertices);assert.deepEqual(shape.Faces,source.Faces);
 assert.deepEqual(shape.Groups,source.Groups);assert.deepEqual(shape.VertexGroup,source.VertexGroup);
 assert.equal(m.Bones.filter(n=>n._FxTag?.startsWith('rune/')).length,0,'no aura pivot or ring geometry');
 const layer=m.Materials[shape.MaterialID].Layers[0];assert.equal(layer.TVertexAnimId,null);assert.ok(layer.Alpha.GlobalSeqId>=0);
});
