import test from 'node:test';import assert from 'node:assert/strict';
import {GLOBAL_LOOKS,findLook,newStack,partFrame} from '../src/global-animation-looks.js';
import {createDemoDocument} from '../src/editor-document.js';
test('the fifth owner round exposes the consolidated skins and selected defaults',()=>{
 const names=GLOBAL_LOOKS.map(l=>l.name);
 for(const removed of ['White ice','Lava skin','Lava fissures','Oathfire','Buried coals','Basalt kiln'])assert.ok(!names.includes(removed),removed+' is retired from the library');
 assert.equal(findLook('fissures').group,'Skins');assert.equal(findLook('fissures').name,'Fissures skin');
 const seam=findLook('sort-basalt').layers.find(l=>l.label==='Heat seams');assert.equal(seam.strength,.4);assert.deepEqual(seam.tint,[82/255,34/255,16/255]);
 const ice=findLook('ice-skin');assert.ok(ice.layers.some(l=>l.kind==='mist'));
 const arcs=findLook('lightning-blade').layers.find(l=>l.powerArcs);assert.ok(arcs,'lightning uses blade-bound branches');
 assert.ok(!findLook('lightning-blade').layers.some(l=>l.kind==='crackle'&&l.enabled!==false));
 const soul=findLook('sort-soul').layers.find(l=>l.label==='Soul seal');assert.deepEqual(soul.uvMatrix,[0,1.10305,-1.14151,0,1.07555,-.16473]);
});

import {ICE_VARIANTS,withIceVariation} from '../src/global-animation-looks.js';
import {compileAnimation,readAnimationStack,FX_SECTIONS} from '../src/global-animation-model.js';
import {openDocument} from '../src/editor-document.js';
test('changing ice finish preserves extra layers and native mist through both formats',()=>{
 const doc=createDemoDocument(),frame=partFrame(doc.model.Geosets[0]);
 let s=newStack(findLook('ice-skin'),frame,'ice');s.layers.push({...s.layers[2],id:20,enabled:false});
 for(const variant of ['white','dark']){
  s=withIceVariation(s,frame,variant);
  assert.equal(s.layers.find(l=>l.id===20).enabled,false);assert.equal(s.layers.filter(l=>l.kind==='mist').length,2);
  doc.apply('Finish',FX_SECTIONS,m=>compileAnimation(m,0,s));
  for(const format of ['mdx','mdl']){
   const saved=openDocument(doc.serialize(format),'ice.'+format).model,read=readAnimationStack(saved,0);
   assert.equal(read.iceVariation,variant);assert.equal(read.layers.find(l=>l.kind==='mist'&&l.enabled).id,3);
   assert.ok(saved.ParticleEmitters2.some(p=>p.Name.startsWith('FX Falling mist')));
  }
 }
});
test('blade arcs retain the source skin and separate native quiet and flash timing',()=>{
 const doc=createDemoDocument(),original=structuredClone(doc.model.Geosets[0]);
 const s=newStack(findLook('lightning-blade'),partFrame(original),'power'),l=s.layers.find(l=>l.powerArcs);
 doc.apply('Power',FX_SECTIONS,m=>compileAnimation(m,0,s));
 assert.ok(!doc.model.ParticleEmitters2.some(p=>p.Name.startsWith('FX Blade crackle')));
 for(const ext of ['mdx','mdl']){
  const m=openDocument(doc.serialize(ext),'power.'+ext).model;
  const g=m.Geosets.find(g=>g._FxTag==='power/'+l.id+'/shape');assert.deepEqual(g.Vertices,original.Vertices);assert.deepEqual(g.Groups,original.Groups);
  const mat=m.Materials[g.MaterialID].Layers[0],alpha=mat.Alpha;
  assert.equal(m.GlobalSequences[alpha.GlobalSeqId],3250);assert.equal(alpha.LineType,0);
  assert.equal(alpha.Keys.filter(k=>k.Vector[0]>0).length,3);assert.equal(alpha.Keys.at(-1).Vector[0],0);
  assert.ok(alpha.Keys.filter(k=>k.Vector[0]>0).every(k=>k.Frame<250));
  const motion=m.TextureAnims[mat.TVertexAnimId].Translation;assert.equal(motion.GlobalSeqId,alpha.GlobalSeqId);
  assert.equal(readAnimationStack(m,0).layers.find(l=>l.powerArcs).burstGap,3);
 }
});
