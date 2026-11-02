import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as looks from '../src/global-animation-looks.js';
import {openDocument} from '../src/editor-document.js';
import {compileAnimation} from '../src/global-animation-model.js';

// Captured from makeLayer at 676aaf6f on this checked-in, real Knight model.
const baseline=JSON.parse(fs.readFileSync(new URL('./fixtures/fx-emitter-defaults-676aaf6f.json',import.meta.url)));
const fixture=()=>openDocument(fs.readFileSync(new URL('./fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx',import.meta.url)),'knight.mdx');
const hash=layer=>createHash('sha256').update(JSON.stringify(layer)).digest('hex');
for(const look of looks.GLOBAL_LOOKS)test(look.name+' starts with its intended particle defaults and offers its original emitters first',()=>{
 const doc=fixture(),frame=looks.partFrame(doc.model.Geosets[0]),stack=looks.newStack(look,frame,'empty');
 const own=look.layers.filter(spec=>spec.type==='Particles'),choices=looks.emitterChoices(look);
 const emitterOnly=own.length>0&&own.length===look.layers.length;
 assert.deepEqual(stack.layers,look.layers.flatMap((spec,i)=>spec.type==='Particles'&&!emitterOnly?[]:emitterOnly&&i>0?[]:[looks.makeLayer(spec,frame,look.palette,i+1)]),'only emitter-only presets start with exactly their first own emitter');
 assert.equal(stack.layers.filter(l=>l.type==='Particles').length,emitterOnly?1:0,look.name+' has its intended Particles default');
 assert.deepEqual(choices.slice(0,own.length).map(c=>c.spec),own,'own emitters retain their order and full specifications');
 assert.deepEqual(choices.slice(0,own.length).map(c=>c.label),own.map((spec,i)=>spec.label+(i===0?' (recommended)':'')));
 assert.equal(choices.filter(c=>c.label.endsWith(' (recommended)')).length,own.length?1:0);
 const rest=choices.slice(own.length);
 assert.deepEqual(rest.map(c=>c.spec),looks.LAYER_CHOICES.filter(s=>s.type==='Particles'&&!own.some(o=>o.label===s.label&&o.image===s.image&&o.kind===s.kind&&o.stamp===s.stamp&&o.nativeSurface?.id===s.nativeSurface?.id)),'other ingredients keep their existing order and values');
 assert.deepEqual(rest.map(c=>c.label),rest.map(c=>c.spec.menuLabel||c.spec.label));
 for(const [i,reference] of baseline[look.id].entries())assert.equal(hash(looks.makeLayer(choices[i].spec,frame,look.palette,reference.id)),reference.hash,reference.label+' has the exact pre-change values and fit');
 const count=doc.model.ParticleEmitters2.length;
 compileAnimation(doc.model,0,stack);
 assert.equal(doc.model.ParticleEmitters2.length>count,emitterOnly,'emitter nodes are allocated only for emitter-only presets');
 for(const reference of baseline[look.id].slice(emitterOnly?1:0)){
  const tag=stack.owner+'/'+reference.id+'/';
  assert.ok(doc.model.Nodes.every(node=>!node?._FxTag?.startsWith(tag)),'no particle bone or helper allocated');
  assert.ok(doc.model.Textures.every(texture=>!texture._FxTag?.startsWith(tag)),'no particle texture allocated');
 }
});

test('retired impacts retain their original particle layers',()=>{
 const doc=fixture(),frame=looks.partFrame(doc.model.Geosets[0]),look=looks.findLook('iron-hit');
 assert.deepEqual(looks.newStack(look,frame,'impact').layers,look.layers.map((s,i)=>looks.makeLayer(s,frame,look.palette,i+1)));
});
