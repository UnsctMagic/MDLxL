import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {createRequire} from 'node:module';import {openDocument} from '../../src/editor-document.js';
import {GLOBAL_LOOKS,newStack,partFrame} from '../../src/global-animation-looks.js';
import {compileAnimation,readAnimationStack,FX_SECTIONS} from '../../src/global-animation-model.js';
const {testModel}=createRequire(import.meta.url)('../helpers/fixtures.cjs');
const fixture=()=>openDocument(fs.readFileSync(testModel('WH_WOC_WarriorSlaaneshDual01.mdx')),'slaanesh.mdx');
const stack=(doc,id)=>newStack(GLOBAL_LOOKS.find(l=>l.id===id),partFrame(doc.model.Geosets[28]),'owner-round');
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
