import test from 'node:test';
import assert from 'node:assert/strict';
import {GLOBAL_LOOKS,findLook,newStack,partFrame,withIceVariation} from '../src/global-animation-looks.js';
import {createDemoDocument,openDocument} from '../src/editor-document.js';
import {compileAnimation,readAnimationStack} from '../src/global-animation-model.js';
test('new Lightning blade contains only the two requested surfaces and starts as an overlay',()=>{
 const look=findLook('lightning-blade');assert.deepEqual(look.layers.map(l=>l.label),['Storm steel','Blade arcs']);
 assert.equal(look.asOverlay,true);
 const doc=createDemoDocument(),base=doc.model.Geosets[0].MaterialID,s=newStack(look,partFrame(doc.model.Geosets[0]),'empty');
 compileAnimation(doc.model,0,s);assert.equal(doc.model.Geosets[0].MaterialID,base);assert.equal(doc.model.ParticleEmitters2.length,0);
 for(const ext of ['mdx','mdl']){const m=openDocument(doc.serialize(ext),'empty.'+ext).model;assert.equal(m.ParticleEmitters2.length,0);assert.equal(readAnimationStack(m,0).asOverlay,true);}
});
test('new Ice skin uses white ice and mist while old dark finish data stays editable',()=>{
 const doc=createDemoDocument(),frame=partFrame(doc.model.Geosets[0]),s=newStack(findLook('ice-skin'),frame,'ice');
 assert.equal(s.iceVariation,'white');assert.ok(s.layers.some(l=>l.image?.endsWith('North_Snow.blp')));assert.ok(s.layers.some(l=>l.kind==='mist'));
 for(const variant of ['dark','white']){
  const next=withIceVariation(s,frame,variant);compileAnimation(doc.model,0,next);
  for(const ext of ['mdx','mdl']){const m=openDocument(doc.serialize(ext),'ice.'+ext).model;assert.equal(readAnimationStack(m,0).iceVariation,variant);assert.ok(m.ParticleEmitters2.length>0);}
 }
});
