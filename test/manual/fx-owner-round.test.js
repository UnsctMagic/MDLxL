import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {createRequire} from 'node:module';import {openDocument} from '../../src/editor-document.js';
import {GLOBAL_LOOKS,findLook,newStack,partFrame} from '../../src/global-animation-looks.js';
import {compileAnimation,readAnimationStack,FX_SECTIONS} from '../../src/global-animation-model.js';
const {testModel}=createRequire(import.meta.url)('../helpers/fixtures.cjs');
const fixture=()=>openDocument(fs.readFileSync(testModel('WH_WOC_WarriorSlaaneshDual01.mdx')),'slaanesh.mdx');
const stack=(doc,id)=>newStack(findLook(id),partFrame(doc.model.Geosets[28]),'owner-round');
test('Slaanesh weapon geoset emits from both independently animated weapons',()=>{
 const doc=fixture(),s=stack(doc,'flaming-sword');compileAnimation(doc.model,28,s);
 const flames=doc.model.ParticleEmitters2.filter(n=>n._FxTag?.startsWith(s.owner+'/2/'));
 assert.deepEqual([...new Set(flames.map(n=>n.Parent))].sort((a,b)=>a-b),[19,22],'both weapon bindings receive flames');
});
test('every particle life field survives re-edit and both file formats',()=>{
 const doc=fixture(),s=stack(doc,'flaming-sword');
 s.layers[1].native={SegmentColor:[[1,0,0],[0,1,0],[0,0,1]],Alpha:[12,128,240],ParticleScaling:[1,3,2]};
 doc.apply('FX',FX_SECTIONS,m=>compileAnimation(m,28,s));
 for(const format of ['mdx','mdl']){
  const m=openDocument(doc.serialize(format),'life.'+format).model,p=m.ParticleEmitters2.find(n=>n._FxTag?.startsWith(s.owner+'/2/'));
  assert.deepEqual(p.SegmentColor.map(v=>Array.from(v)),s.layers[1].native.SegmentColor);
  assert.deepEqual(Array.from(p.Alpha),[12,128,240]);assert.deepEqual(Array.from(p.ParticleScaling),[1,3,2]);
 }
});
test('a disabled FX layer creates no emitter and can be switched on after reopening',()=>{
 const doc=fixture(),s=stack(doc,'flaming-sword');s.layers[1].enabled=false;compileAnimation(doc.model,28,s);
 assert.equal(doc.model.ParticleEmitters2.filter(n=>n._FxTag?.startsWith(s.owner+'/2/')).length,0);
 const next=readAnimationStack(doc.model,28);next.layers[1].enabled=true;compileAnimation(doc.model,28,next);
 assert.ok(doc.model.ParticleEmitters2.some(n=>n._FxTag?.startsWith(s.owner+'/2/')));
});

test('Slaanesh emission origins follow the shared skin evaluator in every sequence',async()=>{
 const {sampleNodeMatrices,geosetSkinMatrix}=await import('../../src/animation.js'),{Vector3}=await import('three');
 for(const index of [26,28]){
  const doc=fixture(),m=doc.model,g=m.Geosets[index],f=partFrame(g),s=newStack(GLOBAL_LOOKS[0],f,'positions');
  compileAnimation(m,index,s);
  for(const [seq,clip] of m.Sequences.entries())for(let step=0;step<=24;step++){
   const frame=clip.Interval[0]+(clip.Interval[1]-clip.Interval[0])*step/24,matrices=sampleNodeMatrices(m,frame,seq,frame);
   for(const n of m.ParticleEmitters2.filter(n=>n._FxTag?.startsWith('positions/2/source'))){
    const region=f.regions[Number(n._FxTag.match(/source(\d+)-/)[1])],point=new Vector3().fromArray(n.PivotPoint);
    const expected=point.clone().applyMatrix4(geosetSkinMatrix(g,region.vertices[0],matrices)),actual=point.clone().applyMatrix4(matrices.get(n.ObjectId));
    assert.ok(expected.distanceTo(actual)<.12,`geoset ${index+1} ${clip.Name} frame ${frame}: attachment drift ${expected.distanceTo(actual)}`);
   }
  }
 }
});
test('Recall seal ground starts disabled and impacts stay local to Attack at the weapon ends',async()=>{
 const {impactDefaults}=await import('../../src/global-animation-model.js');
 const doc=fixture(),m=doc.model,recall=stack(doc,'recall-seal');assert.ok(recall.layers.filter(l=>l.ground).every(l=>l.enabled===false));compileAnimation(m,28,recall);assert.equal(m.EventObjects.filter(n=>n._FxTag).length,0);
 const d=fixture(),s=stack(d,'iron-hit'),timing=impactDefaults(d.model,28);Object.assign(s,timing);compileAnimation(d.model,28,s);
 for(const n of d.model.ParticleEmitters2.filter(n=>n._FxTag)){
  assert.equal(n.EmissionRate.GlobalSeqId,null);assert.equal(n.Squirt,true);assert.ok(n.EmissionRate.Keys.some(k=>k.Frame===s.hit&&k.Vector[0]>0));
  for(const clip of d.model.Sequences)if(clip!==d.model.Sequences[s.sequence])assert.ok(n.EmissionRate.Keys.filter(k=>k.Frame>=clip.Interval[0]&&k.Frame<=clip.Interval[1]).every(k=>k.Vector[0]===0));
 }
});
test('glow intensity is continuous and restores its fractional strength',()=>{
 for(const strength of [0,.5,1,1.01,2.5,4]){
  const d=fixture(),s=stack(d,'glowing-skin');s.layers[0].strength=strength;compileAnimation(d.model,28,s);
  assert.ok(Math.abs(readAnimationStack(d.model,28).layers[0].strength-strength)<.0001);
 }
});

test('ordinary preview frame steps see the native Attack burst',async()=>{
 const {ModelRenderer}=await import('war3-model'),d=fixture(),s=stack(d,'iron-hit');compileAnimation(d.model,28,s);const m=d.model,seq=m.Geosets[28]._FxStack.sequence,native=new ModelRenderer(m);native.setSequence(seq);
 let seen=false;for(let elapsed=0;elapsed<1000;elapsed+=17){native.update(17);if(native.particlesController.emitters.some(e=>e.particles.length))seen=true;}
 assert.ok(seen,'the Attack burst is visible at normal frame intervals');
});

test('native infantry, hero and large-body seam bindings do not break FX fitting',()=>{
 for(const file of ['pose/Footman.mdx','corpus-sd/human__heropaladin.mdx','corpus-sd/undead__abomination.mdx']){
  const d=openDocument(fs.readFileSync(testModel(file)),file),g=d.model.Geosets[0],frame=partFrame(g);
  assert.ok(frame.regions.length>0,file);
  const s=newStack(GLOBAL_LOOKS.find(l=>l.id==='rune-blade'),frame,'native-seams');compileAnimation(d.model,0,s);
  for(const geo of d.model.Geosets.filter(g=>g._FxTag))assert.ok(geo.TVertices.every(uv=>uv.every(Number.isFinite)),file+' finite surface UVs');
 }
});

test('the shared falling mist saves the bright Freezing Breath cloud in each look',()=>{
 for(const id of ['frost-blade','frost-mist','ice-skin']){
  const doc=fixture(),s=stack(doc,id),mist=s.layers.find(l=>l.kind==='mist');
  doc.apply('FX',FX_SECTIONS,m=>compileAnimation(m,28,s));
  for(const format of ['mdx','mdl']){
   const m=openDocument(doc.serialize(format),'mist.'+format).model,emitters=m.ParticleEmitters2.filter(n=>n._FxTag?.startsWith(s.owner+'/'+mist.id+'/'));
   assert.ok(emitters.length,id+' contains mist');
   for(const p of emitters){
    assert.equal(p.FilterMode,1,id+' must brighten the surface, never darken it');
    assert.equal(m.Textures[p.TextureID].Image,'ReplaceableTextures\\Weather\\Clouds8x8.blp');
    assert.deepEqual([p.Rows,p.Columns],[8,8]);assert.deepEqual([...p.LifeSpanUVAnim],[0,12,1]);assert.deepEqual([...p.DecayUVAnim],[13,25,1]);
   }
  }
 }
});

test('unchecked ingredients are absent from MDX and MDL after disabling a previously applied look',()=>{
 for(const look of ['frost-blade','fly-swarm','recall-seal','iron-hit']){
  const doc=fixture(),s=stack(doc,look),base=doc.model,counts=m=>[m.ParticleEmitters2.length,m.RibbonEmitters.length,m.Bones.length,m.Geosets.length,m.Materials.length,m.Textures.length,m.TextureAnims.length,m.GlobalSequences.length,m.EventObjects.length],original=counts(base);
  s.layers.forEach(l=>l.enabled=true);doc.apply('All on',FX_SECTIONS,m=>compileAnimation(m,28,s));
  const off=readAnimationStack(base,28);off.layers.forEach(l=>l.enabled=false);doc.apply('All off',FX_SECTIONS,m=>compileAnimation(m,28,off));
  for(const format of ['mdl','mdx']){const m=openDocument(doc.serialize(format),'off.'+format).model;assert.deepEqual(counts(m),original,look+' off has no extra native records');assert.ok(readAnimationStack(m,28).layers.every(l=>!l.enabled));}
 }
});

test('default weapon sparks and embers are visible concurrently on both weapons',async()=>{
 const {ModelRenderer}=await import('war3-model');
 for(const [id,kind] of [['lightning-blade','crackle'],['flaming-sword','embers'],['rising-embers','embers']]){
  const d=fixture(),s=stack(d,id),layer=s.layers.find(l=>l.kind===kind);compileAnimation(d.model,28,s);const native=new ModelRenderer(d.model);native.setSequence(0);let visible=0;
  for(let i=0;i<120;i++){native.update(17);const parts=[19,22].map(id=>native.particlesController.emitters.filter(e=>e.props.Parent===id&&e.props._FxTag?.startsWith(s.owner+'/'+layer.id+'/')).reduce((n,e)=>n+e.particles.length,0));if(i>=40&&parts.every(n=>n>=2))visible++;}
  assert.ok(visible>=60,id+' must show multiple particles on both blades at its default; frames: '+visible+'/80');
 }
});
test('Attack contact uses the same striking surface from the helmet or either blade',async()=>{
 const d=fixture(),m=d.model;
 for(const seq of m.Sequences.keys()){if(!/^attack/i.test(m.Sequences[seq].Name))continue;
  const poses=[];for(const part of [0,26,28]){const model=structuredClone(m),s=stack(d,'iron-hit');s.sequence=seq;s.hit=undefined;compileAnimation(model,part,s);
   const emitters=model.ParticleEmitters2.filter(n=>n._FxTag);assert.equal(emitters.length,s.layers.filter(l=>l.enabled&&!l.stamp).length,'one burst source per layer, not per clicked skin binding');
   assert.ok([19,22].includes(emitters[0].Parent),'contact is on an attacking weapon');poses.push(emitters.map(n=>[n.Parent,...n.PivotPoint]));}
  assert.deepEqual(poses[0],poses[1]);assert.deepEqual(poses[1],poses[2]);
 }
});

test('Phoenix quill feathers have clear corners with their native particle blend',async()=>{
 const {CascReader}=createRequire(import.meta.url)('../../electron/casc.cjs');
 const {thumbnailPixels}=await import('../../src/texture-thumbnail.js');
 const feather=findLook('sort-phoenix').layers.find(l=>l.type==='Particles');
 const reader=new CascReader(process.env.MDLVIS_GAME_DATA||'D:/Warcraft III',process.cwd());
 try{
  const bytes=await reader.read(feather.image);assert.ok(bytes,feather.image);
  const {width,height,data}=thumbnailPixels({name:feather.image,bytes});
  for(const pixel of [0,width-1,(height-1)*width,width*height-1]){
   const [r,g,b,a]=data.slice(pixel*4,pixel*4+4);
   assert.ok(feather.nativeSpec.filter===0?a<8:Math.max(r,g,b)<8,'native feather corner must disappear in the chosen blend');
  }
 }finally{reader.close();}
});
