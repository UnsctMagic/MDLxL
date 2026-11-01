import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openDocument} from '../src/editor-document.js';
import {GLOBAL_LOOKS,LAYER_CHOICES,findLook,newStack,partFrame,withLayerTexture,withParticleStrength} from '../src/global-animation-looks.js';
import {compileAnimation,readAnimationStack,FX_SECTIONS} from '../src/global-animation-model.js';

const kept=['basalt','briar','abyss','cairn','mosaic','buried','eclipse','ink','soul','thorn','astral','oath','tide','blood','rift'];
test('the fifteen accepted candidates are filed and their ingredients work in other looks',()=>{
 const filed=GLOBAL_LOOKS.filter(l=>l.id.startsWith('sort-'));
 assert.deepEqual(filed.map(l=>l.id),kept.map(id=>'sort-'+id));
 assert.ok(GLOBAL_LOOKS.every(l=>!['Impacts','sort'].includes(l.group)));
 for(const id of ['basalt','briar','cairn','mosaic','eclipse'])assert.equal(findLook('sort-'+id).asOverlay,true);
 assert.equal(findLook('sort-ink').layers.some(l=>l.label==='Ink seal'),false);
 assert.ok(LAYER_CHOICES.some(l=>l.label==='Ink seal'));
 for(const option of ['Mossy bark','Spores'])assert.equal(findLook('sort-briar').layers.find(l=>l.label===option).enabled,false);
 assert.ok(findLook('sort-prism'),'old saved stacks still reopen');
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

test('texture edits change the saved native reference for each ingredient family and leave its siblings alone',()=>{
 for(const [id,label] of [['sort-basalt','Black stone'],['sort-ink','Ink clouds'],['sort-oath','Oath mark'],['sort-briar','Pollen'],['frost-blade','Falling mist'],['poison-skin','Poison surface'],['sort-thorn','Thorn trail'],['water-skin','Water surface']]){
  const doc=knight(),m=doc.model,stack=newStack(findLook(id),partFrame(m.Geosets[0]),'picture'),image='Textures\\\\DemonRune5.blp';
  doc.apply('Start',FX_SECTIONS,model=>compileAnimation(model,0,stack));const change=readAnimationStack(m,0),before=structuredClone(change.layers);
  const i=change.layers.findIndex(l=>l.label===label);change.layers[i]=withLayerTexture(change.layers[i],image);
  doc.apply('Replace texture',FX_SECTIONS,model=>compileAnimation(model,0,change));
  for(const format of ['mdx','mdl']){
   const reopened=openDocument(doc.serialize(format),'reopen.'+format).model,read=readAnimationStack(reopened,0);
   assert.equal(read.layers[i].image,image,id);
   assert.deepEqual(read.layers.filter((_,n)=>n!==i).map(l=>l.image),before.filter((_,n)=>n!==i).map(l=>l.image),id);
   const prefix='picture/'+read.layers[i].id+'/',geometry=reopened.Geosets.find(g=>g._FxTag===prefix+'shape'),p=reopened.ParticleEmitters2.find(n=>n._FxTag?.startsWith(prefix)),r=reopened.RibbonEmitters.find(n=>n._FxTag?.startsWith(prefix));
   const tex=p?.TextureID??reopened.Materials[geometry?.MaterialID??r.MaterialID].Layers[0].TextureID;
   assert.equal(reopened.Textures[tex].Image,image,id);
   if(p){assert.equal(p.Rows,1,id);assert.equal(p.Columns,1,id);}
  }
 }
});

test('particle intensity scales only its own life-stage alpha and can return from zero after reopening',()=>{
 const doc=knight(),m=doc.model,s=newStack(findLook('flaming-sword'),partFrame(m.Geosets[0]),'opacity');
 doc.apply('Start',FX_SECTIONS,model=>compileAnimation(model,0,s));
 const change=readAnimationStack(m,0),l=change.layers[1],tag=change.owner+'/'+l.id+'/';
 const tracked=m.ParticleEmitters2.find(n=>n._FxTag?.startsWith(tag)),original=Array.from(tracked.Alpha),other=m.ParticleEmitters2.find(n=>n._FxTag&&!n._FxTag.startsWith(tag)),sibling=Array.from(other.Alpha);
 for(const level of [.4,0,1]){
  const draft=readAnimationStack(m,0);draft.layers[1]=withParticleStrength(draft.layers[1],tracked.Alpha,level);
  doc.apply('Intensity',FX_SECTIONS,model=>compileAnimation(model,0,draft));
  for(const fmt of ['mdl','mdx']){
   const model=openDocument(doc.serialize(fmt),'edit.'+fmt).model,layer=readAnimationStack(model,0).layers[1];
   assert.equal(layer.particleStrength,level);assert.deepEqual(layer.opacityBase,original);
   assert.deepEqual(Array.from(model.ParticleEmitters2.find(n=>n._FxTag?.startsWith(tag)).Alpha),original.map(v=>Math.round(v*level)));
   assert.deepEqual(Array.from(model.ParticleEmitters2.find(n=>n._FxTag===other._FxTag).Alpha),sibling);
  }
 }
});
