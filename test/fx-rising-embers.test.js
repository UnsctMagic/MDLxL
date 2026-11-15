import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openDocument} from '../src/editor-document.js';
import {findLook,newStack,partFrame,LAYER_CHOICES,makeLayer} from '../src/global-animation-looks.js';
import {compileAnimation} from '../src/global-animation-model.js';
test('Rising embers are few, slow, long-lived cooling LavaLump embers',()=>{
 const m=openDocument(fs.readFileSync(new URL('../test/fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx',import.meta.url)),'knight.mdx').model;
 const f=partFrame(m.Geosets[37]),s=newStack(findLook('empty'),f,'embers');
 s.layers=[makeLayer(LAYER_CHOICES.find(l=>l.label==='Rising embers'),f,'native',1)];compileAnimation(m,37,s);
 const ps=m.ParticleEmitters2.filter(p=>p._FxTag?.startsWith('embers/'));
 assert.ok(ps.length);
 assert.ok(ps.reduce((sum,p)=>sum+(typeof p.EmissionRate==='number'?p.EmissionRate:Infinity),0)<=20,'few steady embers');
 for(const p of ps){
  assert.equal(m.Textures[p.TextureID].Image,'Textures\\LavaLump.blp');
  assert.deepEqual(Array.from(p.Alpha),[200,150,80]);assert.ok(p.Flags&262144);
  assert.ok(p.LifeSpan>=2&&p.Speed<f.length*.15&&p.Gravity<0);
  assert.ok(p.SegmentColor[0][1]>p.SegmentColor[1][1]&&p.SegmentColor[1][1]>p.SegmentColor[2][1],'cools through orange');
  assert.ok(p.ParticleScaling[0]>p.ParticleScaling[1]&&p.ParticleScaling[1]>p.ParticleScaling[2]);
 }
});
