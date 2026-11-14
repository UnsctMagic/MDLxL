import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openDocument} from '../src/editor-document.js';
import {findLook,newStack,partFrame,makeLayer,LAYER_CHOICES,emitterName,layerIngredient} from '../src/global-animation-looks.js';
import {compileAnimation,FX_SECTIONS} from '../src/global-animation-model.js';

// Owner, 12 November: "EMITTERS ... they are good but some are very bad, im lacking options and names are not
// descriptive." Fixes from the emitter audit, each on new layers only.
const knight=()=>openDocument(fs.readFileSync(new URL('./fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx',import.meta.url)),'knight.mdx');
const choice=label=>layerIngredient(findLook('empty'),{type:'Particles',label});
const offered=()=>LAYER_CHOICES.filter(s=>s.type==='Particles').map(emitterName);
export function addEmitter(label,part=37,palette='native'){
 const doc=knight(),frame=partFrame(doc.model.Geosets[part]),stack=newStack(findLook('empty'),frame,'audit');
 stack.layers=[makeLayer(choice(label),frame,palette,1)];
 doc.apply('Add emitter',FX_SECTIONS,m=>compileAnimation(m,part,stack));
 return {layer:stack.layers[0],emitters:doc.model.ParticleEmitters2.filter(p=>p._FxTag?.startsWith('audit/1/'))};
}

test('flames are fire coloured on a look without a fire palette, and offered once',()=>{
 const {layer,emitters}=addEmitter('Blade flames');
 assert.deepEqual(layer.tint,[1,.463,.173]);
 const middle=Array.from(emitters[0].SegmentColor[1]);
 assert.ok(middle[0]>.9&&middle[1]<.6&&middle[2]<.3,'orange, not white: '+middle);
 assert.equal(offered().filter(l=>l==='Flames').length,1);
});

for(const label of ['Heavy drops','Ichor drops'])test(label+' fall like Dripping water: its amount, life, size and streak',()=>{
 const water=addEmitter('Dripping water'),{layer,emitters}=addEmitter(label);
 for(const key of ['amount','lasts','size','gravity'])assert.equal(layer[key],water.layer[key],key);
 assert.deepEqual(layer.native,water.layer.native);
 assert.equal(emitters[0].FrameFlags,3);
 const inFlight=list=>list.reduce((a,p)=>a+(typeof p.EmissionRate==='number'?p.EmissionRate:p.EmissionRate.Keys.slice(0,-1).reduce((s,k)=>s+k.Vector[0],0)/(p.EmissionRate.Keys.length-1))*p.LifeSpan,0);
 assert.ok(inFlight(emitters)>9,'drops in flight on the body: '+inFlight(emitters).toFixed(1));
});
test('Stars emit at a steady rate instead of a burst once a loop',()=>{
 const {emitters}=addEmitter('Stars');
 assert.ok(emitters.length>0);
 for(const p of emitters){
  assert.equal(p.Squirt,false);
  const values=typeof p.EmissionRate==='number'?[p.EmissionRate]:p.EmissionRate.Keys.map(k=>k.Vector[0]);
  assert.ok(Math.min(...values)>0&&Math.max(...values)===Math.min(...values),'steady rate: '+values);
 }
});
test('Rune sparks are additive and turn from white to their tint',()=>{
 const {layer,emitters}=addEmitter('Rune sparks',37,'azure');
 for(const p of emitters){
  assert.equal(p.FilterMode,1,'additive');
  assert.deepEqual(Array.from(p.SegmentColor[0]),[1,1,1]);
  assert.deepEqual(Array.from(p.SegmentColor[2]).map(v=>+v.toFixed(4)),layer.tint.map(v=>+Math.fround(v).toFixed(4)));
 }
});
// Eye sparks left the library with the Eye glow look (14 November 2026), so it is no longer an offered emitter. Rift splinters are small bright streaks over the whole surface now.
// Audit: invisible on the Footman body (light .00-.04) at their old sizes; twice the size, embers [.16,.1,.04].
for(const [label,size] of [['Blood beads',[.12,.32,.12]],['Rift splinters',[.03,.1,.02]],['Void splinters',[.14,.28,.04]],['Lingering embers',[.16,.1,.04]]])test(label+' start at a visible size',()=>{
 assert.deepEqual(choice(label).nativeSpec.size,size);
 const {emitters}=addEmitter(label);
 assert.ok(emitters.length>0&&emitters.every(p=>p.ParticleScaling[1]>0));
});
for(const label of ['Falling mist','Drifting lights','Orbiting stars'])test(label+' emits at a steady rate with no swell',()=>{
 const {emitters}=addEmitter(label);
 assert.ok(emitters.length>0&&emitters.every(p=>typeof p.EmissionRate==='number'&&p.EmissionRate>0));
});
test('Falling mist puffs stay within about a third of the unit height',()=>{
 const doc=knight(),frame=partFrame(doc.model.Geosets[0]);frame.unitHeight=60;
 const layer=makeLayer(choice('Falling mist'),frame,'glacier',1);
 assert.ok(layer.size*1.38<=60*.35+1e-9,'largest puff '+(layer.size*1.38).toFixed(1));
});
test('motes are larger and emit at least two per second at every orbit',()=>{
 const {layer,emitters}=addEmitter('Drifting lights'),before=makeLayer({...choice('Drifting lights'),burstGap:1},partFrame(knight().model.Geosets[37]),'native',1);
 assert.ok(emitters.every(p=>p.EmissionRate>=2-1e-9),'per orbit '+emitters.map(p=>p.EmissionRate.toFixed(2)));
 assert.ok(Math.abs(layer.size-before.size*1.5)<1e-9,'half as large again');
});
test('Plague haze is additive, not a mud-coloured blend',()=>{
 const {emitters}=addEmitter('Plague haze');
 assert.ok(emitters.every(p=>p.FilterMode===1&&Math.max(...p.Alpha)<=120));
});
