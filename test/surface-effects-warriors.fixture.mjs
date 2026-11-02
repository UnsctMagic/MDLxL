import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openDocument} from '../src/editor-document.js';
import {sampleTrack} from '../src/animation.js';
import {SURFACE_EFFECTS,defaultEffectOptions,applySurfaceEffect} from '../src/surface-effects.js';
import fixtures from './helpers/fixtures.cjs';

const open = file => openDocument(fs.readFileSync(fixtures.testModel(file)), file);
const preset = name => {
  const entry = SURFACE_EFFECTS.find(effect => effect.name === name);
  assert.ok(entry, 'Missing surface preset: '+name);
  return entry;
};
const nurgle = 'surface-effects/WH_WOC_WarriorNurgle02.mdx';
const khorne = 'optimizexl-diagnostics/WH_WOC_WarriorKhorneGW02.mdx';

test('Felwood poison uses the existing Warrior texture and stays inside a full tile throughout its loop',()=>{
  const doc=open(nurgle), m=doc.model, g=m.Geosets[19], oldUV=g.TVertices[0].slice();
  const effect=preset('Felwood poison'), options={...defaultEffectOptions(effect),geoset:19};
  const count=m.Textures.length, sourceGeometry=g.Vertices.slice();
  doc.apply('Poison',[],model=>applySurfaceEffect(model,null,effect,options));
  assert.equal(m.Textures.length,count);
  assert.deepEqual(g.Vertices,sourceGeometry);
  assert.deepEqual(g.TVertices[0],oldUV);
  const layer=m.Materials[g.MaterialID].Layers.at(-1);
  assert.match(m.Textures[layer.TextureID].Image,/terrainart\\felwood\\felwood_poison\.blp/i);
  const [u,v,w,h]=effect.atlas, coords=g.TVertices[layer.CoordId];
  const motion=m.TextureAnims[layer.TVertexAnimId].Translation, ms=m.GlobalSequences[motion.GlobalSeqId];
  assert.ok(layer.CoordId>0 && ms>1000);
  // Translate both endpoints and midpoints. Transition cells must never enter the effect.
  for(let t=0;t<=ms;t+=ms/32){
    const offset=sampleTrack(motion,t,{globalSequences:m.GlobalSequences,fallback:[0,0,0]});
    for(let i=0;i<coords.length;i+=2){
      assert.ok(coords[i]+offset[0]>u && coords[i]+offset[0]<u+w);
      assert.ok(coords[i+1]+offset[1]>v && coords[i+1]+offset[1]<v+h);
    }
  }
  assert.ok(motion.Keys.some(k=>Math.abs(k.Vector[0])>.001));
  assert.deepEqual(motion.Keys[0].Vector,motion.Keys.at(-1).Vector);
  const reopened=openDocument(doc.serialize('mdx'),'poison.mdx').model;
  assert.deepEqual(reopened.Geosets[19].TVertices[layer.CoordId],coords);
  doc.undo();assert.deepEqual(m.Geosets[19].TVertices,[oldUV]);
});

test('Lava fissures use the axe’s native picture and pulse the cracks without moving its base skin',()=>{
  const m=open(khorne).model, effect=preset('Lava fissures'), g=m.Geosets[18], count=m.Textures.length;
  const base=m.Materials[g.MaterialID].Layers.map(l=>structuredClone(l));
  applySurfaceEffect(m,null,effect,{...defaultEffectOptions(effect),geoset:18});
  const layers=m.Materials[g.MaterialID].Layers,glow=layers.at(-1);
  assert.deepEqual(layers.slice(0,base.length),base);
  assert.equal(m.Textures.length,count);
  assert.match(m.Textures[glow.TextureID].Image,/cave_lavacracks\.blp/i);
  assert.ok(glow.Alpha.Keys[0].Vector[0]>glow.Alpha.Keys[1].Vector[0]);
  assert.ok(m.GlobalSequences[glow.Alpha.GlobalSeqId]>1000);
});

test('Flaming skin samples the flame band on packed Warrior UVs, including when they wrap past one',()=>{
  const m=open(khorne).model,g=m.Geosets[18],effect=preset('Flaming skin');
  assert.match(effect.texture||'',/HeroAvatarFlame\.blp$/i);
  applySurfaceEffect(m,null,effect,{...defaultEffectOptions(effect),geoset:18});
  const layer=m.Materials[g.MaterialID].Layers.at(-1), uv=g.TVertices[layer.CoordId];
  const rows=uv.filter((_,i)=>i%2===1), columns=uv.filter((_,i)=>i%2===0);
  assert.ok(Math.min(...rows)>.79 && Math.max(...rows)<1,'Only flame artwork is sampled');
  assert.ok(Math.max(...columns)-Math.min(...columns)>.3,'The pattern covers the part');
  const motion=m.TextureAnims[layer.TVertexAnimId].Translation;
  assert.equal(motion.Keys.at(-1).Vector[0]-motion.Keys[0].Vector[0],1);
});

test('Picking a tint honours its RGB when the original geoset had stored but disabled colour',()=>{
  const m=open(khorne).model, geo=18, effect=preset('Colour pulse');
  const animation=m.GeosetAnims.find(a=>a.GeosetId===geo);
  animation.Flags &= ~2;animation.Color=new Float32Array([0,0,0]);
  const tint=[1,.45,.15];
  applySurfaceEffect(m,null,effect,{...defaultEffectOptions(effect),geoset:geo,tintPulse:false,tint});
  for(let i=0;i<3;i++)assert.ok(Math.abs(animation.Color[i]-tint[i])<1e-6);
});
test('A chosen preset colour sets the static RGB on a previously tinted Warrior part',()=>{
  const doc=open(khorne),index=17,effect=preset('Flaming skin'),options=defaultEffectOptions(effect);
  const anim=doc.model.GeosetAnims.find(a=>a.GeosetId===index);
  assert.ok((anim.Flags&2) && anim.Color[1]===0,'The authored axe has no green channel');
  applySurfaceEffect(doc.model,null,effect,{...options,geoset:index});
  assert.deepEqual(anim.Color,Float32Array.from(options.tint));
  applySurfaceEffect(doc.model,null,effect,{...options,geoset:index,tint:[1,1,1],setTint:true});
  assert.deepEqual(anim.Color,Float32Array.from([1,1,1]));
});
