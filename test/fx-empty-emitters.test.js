import test from 'node:test';
import assert from 'node:assert/strict';
import {GLOBAL_LOOKS,findLook,newStack,partFrame,withIceVariation,makeLayer} from '../src/global-animation-looks.js';
import {createDemoDocument,openDocument} from '../src/editor-document.js';
import {compileAnimation,readAnimationStack} from '../src/global-animation-model.js';
test('new Lightning blade restores the previous surface defaults with an empty emitter choice',()=>{
 const look=findLook('lightning-blade');assert.deepEqual(look.layers.map(l=>l.label),['Storm steel','Forked arcs','Blade arcs']);
 assert.equal(look.asOverlay,undefined);assert.deepEqual(look.layers.filter(l=>l.enabled!==false).map(l=>l.label),['Storm steel','Blade arcs']);
 const doc=createDemoDocument(),base=doc.model.Geosets[0].MaterialID,s=newStack(look,partFrame(doc.model.Geosets[0]),'empty');
 compileAnimation(doc.model,0,s);assert.notEqual(doc.model.Geosets[0].MaterialID,base);assert.equal(doc.model.Materials[doc.model.Geosets[0].MaterialID].Layers[0].Alpha,0);assert.equal(doc.model.ParticleEmitters2.length,0);
 for(const ext of ['mdx','mdl']){const m=openDocument(doc.serialize(ext),'empty.'+ext).model;assert.equal(m.ParticleEmitters2.length,0);assert.equal(readAnimationStack(m,0).asOverlay,undefined);}
});
test('new Ice skin uses white ice without mist while added mist and old dark finishes stay editable',()=>{
 const doc=createDemoDocument(),frame=partFrame(doc.model.Geosets[0]),s=newStack(findLook('ice-skin'),frame,'ice');
 assert.equal(s.iceVariation,'white');assert.ok(s.layers.some(l=>l.image?.endsWith('North_Snow.blp')));assert.ok(!s.layers.some(l=>l.kind==='mist'));
 s.layers.push(makeLayer(findLook('ice-skin').layers.find(l=>l.kind==='mist'),frame,'glacier',3));
 for(const variant of ['dark','white']){
  const next=withIceVariation(s,frame,variant);compileAnimation(doc.model,0,next);
  for(const ext of ['mdx','mdl']){const m=openDocument(doc.serialize(ext),'ice.'+ext).model;assert.equal(readAnimationStack(m,0).iceVariation,variant);assert.ok(m.ParticleEmitters2.length>0);}
 }
});
