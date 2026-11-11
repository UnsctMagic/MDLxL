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
for(const look of looks.GLOBAL_LOOKS.filter(l=>l.layers.length))test(look.name+' starts with its intended particle defaults and offers its original emitters first',()=>{
 const doc=fixture(),frame=looks.partFrame(doc.model.Geosets[0]),stack=looks.newStack(look,frame,'empty');
 const same=(a,b)=>a.label===b.label&&a.image===b.image&&a.kind===b.kind,choices=looks.emitterChoices(look);
 const own=(look.variations?look.variations.flatMap(v=>v.layers):look.layers).filter((spec,i,all)=>spec.type==='Particles'&&all.findIndex(o=>o.type==='Particles'&&same(o,spec))===i);
 const emitterOnly=look.layers.length>0&&look.layers.every(spec=>spec.type==='Particles');
 // An emitter starts when the look marks it, or when the whole preset is one emitter.
 const starts=(spec,i)=>spec.type!=='Particles'||spec.starts||emitterOnly&&i===0;
 assert.deepEqual(stack.layers,look.layers.flatMap((spec,i)=>starts(spec,i)?[looks.makeLayer(spec,frame,look.palette,i+1)]:[]),'only emitter-only presets and marked emitters start');
 assert.equal(stack.layers.filter(l=>l.type==='Particles').length,look.layers.filter((spec,i)=>spec.type==='Particles'&&starts(spec,i)).length,look.name+' has its intended Particles default');
 assert.deepEqual(choices.slice(0,own.length).map(c=>c.spec),own,'own emitters retain their order and full specifications');
 assert.deepEqual(choices.slice(0,own.length).map(c=>c.label),own.map((spec,i)=>spec.label+(i===0?' (recommended)':'')));
 assert.equal(choices.filter(c=>c.label.endsWith(' (recommended)')).length,own.length?1:0);
 const rest=choices.slice(own.length);
 assert.deepEqual(rest.map(c=>c.spec),looks.LAYER_CHOICES.filter(s=>s.type==='Particles'&&!own.some(o=>o.label===s.label&&o.image===s.image&&o.kind===s.kind&&o.stamp===s.stamp&&o.nativeSurface?.id===s.nativeSurface?.id)),'other ingredients keep their existing order and values');
 assert.deepEqual(rest.map(c=>c.label),rest.map(c=>c.spec.menuLabel||c.spec.label));
 for(const [i,reference] of baseline[look.id].entries())assert.equal(hash(looks.makeLayer(choices[i].spec,frame,look.palette,reference.id)),reference.hash,reference.label+' has the exact pre-change values and fit');
 const count=doc.model.ParticleEmitters2.length;
 compileAnimation(doc.model,0,stack);
 assert.equal(doc.model.ParticleEmitters2.length>count,stack.layers.some(l=>l.type==='Particles'),'emitter nodes are allocated only for emitters that start');
 for(const reference of baseline[look.id].filter(reference=>!stack.layers.some(l=>l.label===reference.label))){
  const tag=stack.owner+'/'+reference.id+'/';
  assert.ok(doc.model.Nodes.every(node=>!node?._FxTag?.startsWith(tag)),'no particle bone or helper allocated');
  assert.ok(doc.model.Textures.every(texture=>!texture._FxTag?.startsWith(tag)),'no particle texture allocated');
 }
});

test('retired impacts retain their original particle layers',()=>{
 const doc=fixture(),frame=looks.partFrame(doc.model.Geosets[0]),look=looks.findLook('iron-hit');
 assert.deepEqual(looks.newStack(look,frame,'impact').layers,look.layers.map((s,i)=>looks.makeLayer(s,frame,look.palette,i+1)));
});

test('fly orbit size leaves native sprite scaling alone',()=>{
 const layer={kind:'flies',size:10,spriteSize:3,native:{ParticleScaling:[3,4,5]}};
 assert.deepEqual(looks.withLayerSize(layer,{...layer,size:16}),{...layer,size:16});
 const flame={...layer,kind:'flame'};
 assert.deepEqual(looks.withLayerSize(flame,{...flame,size:16}).native.ParticleScaling,[4.8,6.4,8]);
});