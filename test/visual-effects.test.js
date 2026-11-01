import {matchesVisualEffect} from '../src/visual-effect-recipes.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {SURFACE_EFFECTS,defaultEffectOptions,applySurfaceEffect,EFFECT_SECTIONS} from '../src/surface-effects.js';
import {sampleTrack} from '../src/animation.js';
import {createDemoDocument,openDocument} from '../src/editor-document.js';
const groups=['Energy streaks','Auras','Ambient','Weapons','Impacts','Buffs & curses'];
test('the library offers distinct surface looks in all six groups and retires both test eyes',()=>{
 assert.equal(SURFACE_EFFECTS.filter(e=>e.category==='Eyes'||/^(moving|classic) eye$/i.test(e.name)).length,0);
 for(const group of groups)assert.ok(SURFACE_EFFECTS.filter(e=>e.category===group).length>=5,group);
 assert.equal(new Set(SURFACE_EFFECTS.map(e=>e.id)).size,SURFACE_EFFECTS.length);
});
test('layered effects survive native MDX, preserve authored sequences and take one undo',()=>{
 for(const effect of SURFACE_EFFECTS.filter(e=>e.layers))for(const mode of ['overlay','replace','new']){
  const doc=openDocument(createDemoDocument().serialize('mdx'),'source.mdx'), before=structuredClone(doc.model);
  const options={...defaultEffectOptions(effect),geoset:0,sequence:0,mode};
  doc.apply(effect.name,EFFECT_SECTIONS,m=>applySurfaceEffect(m,null,effect,options));
  const saved=openDocument(doc.serialize('mdx'),effect.id+'.mdx').model;
  assert.deepEqual(saved.Sequences,before.Sequences,effect.name);
  assert.equal(saved.Geosets.length,before.Geosets.length+(mode==='new'?1:0),effect.name);
  if(mode==='replace')assert.deepEqual(saved.Geosets[0].TVertices[0],doc.model.Geosets[0].TVertices[0]);
  else assert.deepEqual(saved.Geosets[0].TVertices[0],before.Geosets[0].TVertices[0]);
  if(effect.accents?.length)assert.ok(saved.ParticleEmitters2.length+saved.RibbonEmitters.length>before.ParticleEmitters2.length+before.RibbonEmitters.length,effect.name);
  assert.deepEqual(saved.Helpers,before.Helpers,effect.name);
  doc.undo();assert.deepEqual(doc.model,before,effect.name+' undo');
 }
});
test('energy streaks animate native UVs without launching or attaching an object',()=>{
 for(const e of SURFACE_EFFECTS.filter(e=>e.category==='Energy streaks')){
  const doc=createDemoDocument(),m=doc.model,ids=m.Nodes.length;
  applySurfaceEffect(m,null,e,defaultEffectOptions(e));
  assert.equal(m.Nodes.length,ids);assert.ok(m.TextureAnims.some(a=>a.Translation?.Keys?.length>1),e.name);
 }
});
test('cue colours and burst counts stay in their chosen sequence',()=>{
 const m=createDemoDocument().model,e=SURFACE_EFFECTS.find(e=>e.id==='iron-hit');
 const first=m.Sequences[0];m.Sequences.push({...structuredClone(first),Name:'Attack',Interval:new Uint32Array([3000,4400])});
 const before=Array.from(m.GeosetAnims.find(g=>g.GeosetId===0)?.Color||[1,1,1]);
 applySurfaceEffect(m,null,e,{...defaultEffectOptions(e),sequence:1,tint:[.3,.5,.9]});
 const p=m.ParticleEmitters2.at(-1),colour=m.GeosetAnims.find(g=>g.GeosetId===0).Color;
 assert.ok(p.Squirt);assert.deepEqual(Array.from(sampleTrack(colour,500,{interval:first.Interval,fallback:[1,1,1]})),before);
 assert.equal(Number(sampleTrack(p.EmissionRate,500,{interval:first.Interval})),0);
 assert.equal(Number(sampleTrack(p.EmissionRate,3680,{interval:m.Sequences[1].Interval})),24);
});
test('ground marks use native event codes, and the allegiance ward uses the game team colour',()=>{
 const m=createDemoDocument().model,fx=id=>SURFACE_EFFECTS.find(e=>e.id===id);
 for(const [id,code] of [['thunder-print','UBRxTHND'],['fel-rupture','SPLxDBS1'],['recall-seal','UBRxSCTP']]){
  const e=fx(id);applySurfaceEffect(m,null,e,{...defaultEffectOptions(e),sequence:0});
  const mark=m.EventObjects.at(-1);assert.equal(mark.Name,code);assert.equal(mark.EventTrack.length,1);
 }
 const ward=fx('standard-ward');applySurfaceEffect(m,null,ward,defaultEffectOptions(ward));
 const team=m.ParticleEmitters2.at(-2);assert.equal(m.Textures[team.TextureID].ReplaceableId,2);
 assert.equal(m.Textures[team.TextureID].Image,'');
});

test('a flickering sprite uses one complete tile per step, and a turning ward stays centred',()=>{
 const m=createDemoDocument().model,fx=id=>SURFACE_EFFECTS.find(e=>e.id===id);
 const star=fx('starfall-sheen');applySurfaceEffect(m,null,star,defaultEffectOptions(star));
 const g=m.Geosets[0],layer=m.Materials[g.MaterialID].Layers.at(-1),uv=g.TVertices[layer.CoordId],shift=m.TextureAnims[layer.TVertexAnimId].Translation;
 assert.equal(shift.LineType,0);assert.equal(shift.Keys.length,17);
 for(const key of shift.Keys){for(let i=0;i<uv.length;i++){const fraction=(uv[i]+key.Vector[i%2])*4;assert.equal(Math.floor(fraction),Math.round(4*key.Vector[i%2]));}}
 const ward=fx('spell-ward');applySurfaceEffect(m,null,ward,defaultEffectOptions(ward));
 const spun=m.Materials[g.MaterialID].Layers.slice(-2).map(l=>m.TextureAnims[l.TVertexAnimId]);
 assert.ok(spun.every(anim=>anim.Rotation.Keys.length===9));
 for(const anim of spun)assert.deepEqual(Array.from(anim.Translation.Keys[0].Vector),[.5,.5,0]);
 assert.ok(spun[0].Rotation.Keys[1].Vector[2]*spun[1].Rotation.Keys[1].Vector[2]<0,'The two rings turn in opposite directions');
});

test('search recognises common game terms and translated card names',()=>{
 const find=(text,localise)=>SURFACE_EFFECTS.filter(e=>matchesVisualEffect(e,text,localise)).map(e=>e.id);
 assert.ok(find('weapon trail').includes('frost-ribbon'));assert.ok(find('spawn').includes('recall-seal'));
 assert.ok(find('projectile').includes('storm-thread'));assert.ok(find('debuff').includes('hex-mark'));
 assert.ok(find('ground splat').includes('thunder-print'));
 assert.ok(find('luciérnagas',value=>value==='Fireflies'?'Luciérnagas':value).includes('fireflies'));
});
