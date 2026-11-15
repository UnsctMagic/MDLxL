import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openDocument} from '../src/editor-document.js';
import {findLook,newStack,partFrame,makeLayer,LAYER_CHOICES} from '../src/global-animation-looks.js';
import {compileAnimation} from '../src/global-animation-model.js';
const bytes=fs.readFileSync(new URL('./fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx',import.meta.url));
test('every new built-in emitter is steady; Blade crackle retains its accepted bursts',()=>{
 const failures=[];
 for(const spec of LAYER_CHOICES.filter(s=>s.type==='Particles'&&!['native','flies'].includes(s.kind))){
  const m=openDocument(bytes,'knight.mdx').model,f=partFrame(m.Geosets[37]),s=newStack(findLook('empty'),f,'steady');
  s.layers=[makeLayer(spec,f,'native',1)];compileAnimation(m,37,s);
  const ps=m.ParticleEmitters2.filter(p=>p._FxTag?.startsWith('steady/'));
  if(spec.label==='Blade crackle')assert.ok(ps.every(p=>p.EmissionRate.Keys.some(k=>k.Vector[0]===0)));
  else if(!ps.length||ps.some(p=>typeof p.EmissionRate!=='number'||p.EmissionRate<=0))failures.push(spec.label);
  if(spec.kind==='drops'&&ps.some(p=>p.EmissionRate*p.LifeSpan<2))failures.push(spec.label+' goes empty between births');
 }
 assert.deepEqual(failures,[],'new emitters with rate wobble');
});
