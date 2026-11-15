import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openDocument} from '../src/editor-document.js';
import {findLook,newStack,partFrame,LAYER_CHOICES,makeLayer,emitterChoices} from '../src/global-animation-looks.js';
import {compileAnimation} from '../src/global-animation-model.js';
const names=['Falling snow','Maple leaves','Falling feathers','Ash flecks','Coal sparks','Hot filings','Fire hair'];
test('all seven approved emitters are offered, fitted, steady and use native pictures',()=>{
 const specs=names.map(name=>LAYER_CHOICES.find(l=>l.type==='Particles'&&l.label===name));
 assert.deepEqual(names.filter((_,i)=>!specs[i]),[],'missing approved emitters');
 assert.ok(!LAYER_CHOICES.some(l=>l.label==='Ground dust'));
 const offered=emitterChoices(findLook('empty')).map(c=>c.label);for(const name of names)assert.ok(offered.includes(name));
 for(const spec of specs){
  const m=openDocument(fs.readFileSync(new URL('../test/fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx',import.meta.url)),'knight.mdx').model;
  const f=partFrame(m.Geosets[8]),s=newStack(findLook('empty'),f,'added');s.layers=[makeLayer(spec,f,'native',1)];compileAnimation(m,8,s);
  const ps=m.ParticleEmitters2.filter(p=>p._FxTag?.startsWith('added/'));assert.ok(ps.length,spec.label);
  for(const p of ps){
   assert.ok(typeof p.EmissionRate==='number'&&p.EmissionRate>0,spec.label+' steady');
   assert.ok(Math.max(...p.ParticleScaling)>0&&Math.max(...p.ParticleScaling)<f.length,spec.label+' fits the part');
   assert.match(m.Textures[p.TextureID].Image,/^Textures\\/);
   if(spec.nativeSpec.atlas)assert.ok(p.LifeSpan/(p.Rows*p.Columns)>=.1,spec.label+' no fast flipbook');
   if(spec.label==='Fire hair'){
    assert.equal(m.Textures[p.TextureID].Image,'Textures\\clouds_anim1_bw.blp');
    assert.equal(p.Rows,4);assert.equal(p.Columns,4);assert.equal(p.Time,.5);
    assert.deepEqual(Array.from(p.Alpha),[255,255,0]);
    assert.ok(p.ParticleScaling[0]>p.ParticleScaling[1]&&p.ParticleScaling[1]>p.ParticleScaling[2]);
    assert.ok(p.SegmentColor[0][1]>p.SegmentColor[1][1]&&p.SegmentColor[1][1]>p.SegmentColor[2][1]);
   }
  }
 }
});
