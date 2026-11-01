import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openDocument} from '../src/editor-document.js';
import {GLOBAL_LOOKS,LAYER_CHOICES,findLook,newStack,partFrame} from '../src/global-animation-looks.js';
import {compileAnimation,readAnimationStack,FX_SECTIONS} from '../src/global-animation-model.js';

test('the owner can audition thirty distinct native candidates without the retired Impacts folder',()=>{
 const candidates=GLOBAL_LOOKS.filter(look=>look.group==='sort');
 assert.equal(candidates.length,30);
 assert.equal(new Set(candidates.map(look=>look.name)).size,30);
 assert.equal(GLOBAL_LOOKS.some(look=>look.group==='Impacts'),false);
 for(const type of ['Rune','Glow','Particles'])assert.ok(LAYER_CHOICES.filter(choice=>choice.type===type).length>=3);
});

const knight=()=>openDocument(fs.readFileSync(new URL('./fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx',import.meta.url)),'knight.mdx');
test('overlay preserves the source material, mesh and authored visibility in MDX and MDL',()=>{
 const doc=knight(),m=doc.model,g=m.Geosets[0],base=g.MaterialID;
 const original={material:structuredClone(m.Materials[base]),uv:structuredClone(g.TVertices),groups:structuredClone(g.Groups)};
 const draft=newStack(findLook('lava-skin'),partFrame(g),'overlay-test');
 draft.asOverlay=true;draft.layers[0].strength=.37;
 doc.apply('Overlay',FX_SECTIONS,model=>compileAnimation(model,0,draft));
 assert.equal(g.MaterialID,base);assert.deepEqual(m.Materials[base],original.material);assert.deepEqual(g.TVertices,original.uv);
 const generated=m.Geosets.find(v=>v._FxTag==='overlay-test/1/shape');assert.ok(generated);
 assert.deepEqual(generated.Faces,g.Faces);assert.deepEqual(generated.Groups,original.groups);
 const layer=m.Materials[generated.MaterialID].Layers[0];assert.equal(layer.FilterMode,2);assert.equal(layer.Alpha,.37);
 assert.deepEqual(m.GeosetAnims.find(a=>m.Geosets[a.GeosetId]===generated).Alpha,m.GeosetAnims.find(a=>a.GeosetId===0)?.Alpha??1);
 for(const format of ['mdx','mdl']){
  const reopened=openDocument(doc.serialize(format),'overlay.'+format),model=reopened.model,stack=readAnimationStack(model,0);
  assert.equal(stack.asOverlay,true);const count=model.Geosets.length;
  stack.asOverlay=false;reopened.apply('Replace',FX_SECTIONS,m=>compileAnimation(m,0,stack));
  assert.equal(model.Materials[model.Geosets[0].MaterialID].Layers[0].Alpha,0);assert.equal(model.Geosets.length,count);
  assert.deepEqual(model.Geosets[0].TVertices,original.uv);
  reopened.undo();assert.equal(model.Geosets[0].MaterialID,base);assert.equal(readAnimationStack(model,0).asOverlay,true);
 }
 doc.undo();assert.equal(m.Geosets[0]._FxStack,undefined);assert.equal(m.Geosets.some(g=>g._FxTag),false);
});

test('models with a retired Attack effect retain their native emitters and timing on reopen',()=>{
 const doc=knight(),g=doc.model.Geosets[0],stack=newStack(findLook('iron-hit'),partFrame(g),'legacy-hit');
 doc.apply('Existing impact',FX_SECTIONS,m=>compileAnimation(m,0,stack));
 for(const format of ['mdx','mdl']){
  const m=openDocument(doc.serialize(format),'legacy.'+format).model;
  assert.equal(readAnimationStack(m,0).look,'iron-hit');assert.ok(m.ParticleEmitters2.some(p=>p._FxTag&&p.EmissionRate.Keys.some(k=>k.Vector[0]>0)));
 }
});
