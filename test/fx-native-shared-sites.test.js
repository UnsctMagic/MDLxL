import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openDocument} from '../src/editor-document.js';
import {findLook,newStack,partFrame,makeLayer,LAYER_CHOICES} from '../src/global-animation-looks.js';
import {compileAnimation,readAnimationStack,FX_SECTIONS} from '../src/global-animation-model.js';

// Emitter audit, 12 November: native emitters gave every skin region its own emitter at the full rate, so a body
// with many regions had several times the particles of a sword (Fire column 648 in flight on the Footman body) and
// a ground or flat emitter was stacked once per region at one point (Rune rings, Inward souls). New layers share
// the rate among the part's sites as built-in kinds do, and compile ground and flat emitters once.
const knight=()=>openDocument(fs.readFileSync(new URL('./fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx',import.meta.url)),'knight.mdx');
const rate=p=>typeof p.EmissionRate==='number'?p.EmissionRate:Math.max(...p.EmissionRate.Keys.map(k=>k.Vector[0]));
function apply(doc,part,label,edit=l=>l){
 const frame=partFrame(doc.model.Geosets[part]),stack=newStack(findLook('empty'),frame,'nat');
 stack.layers=[edit(makeLayer(LAYER_CHOICES.find(s=>s.type==='Particles'&&s.label===label),frame,'native',1))];
 doc.apply('Add emitter',FX_SECTIONS,m=>compileAnimation(m,part,stack));
 return {frame,stack,emitters:doc.model.ParticleEmitters2.filter(p=>p._FxTag?.startsWith('nat/1/'))};
}
// Parts of the real Knight: 17 skin regions (body), 4 (weapon), 1.
test('a new native emitter keeps the same per-site density on a 1-, 4- and 17-region part',()=>{
 const total={};
 for(const part of [1,8,37]){
  const {frame,emitters}=apply(knight(),part,'Fire column'),regions=frame.regions?.length||1;
  total[regions]=emitters.reduce((a,p)=>a+rate(p),0);
  if(regions<=4)assert.equal(emitters.length,regions,'one emitter per region up to four regions');
  else assert.ok(emitters.length<=4,'at most four sites on a many-region part: '+emitters.length);
 }
 const site=total[1];
 assert.ok(Math.abs(total[4]-4*site)<1e-6*site,'four regions: four sites at one site\'s rate');
 assert.ok(Math.abs(total[17]-4*site)<1e-6*site,'seventeen regions: the rate of four sites, not seventeen: '+total[17]/site);
});
test('a saved native layer without the flag still gives every region its own emitter',()=>{
 const {frame,emitters}=apply(knight(),37,'Fire column',l=>{const {sharedSites:_s,...rest}=l;return rest;});
 assert.equal(emitters.length,frame.regions.length);
});
for(const label of ['Rune rings','Inward souls'])test(label+' is one emitter on a many-region part, also after save and reopen',()=>{
 const doc=knight(),{frame,emitters}=apply(doc,37,label);
 assert.ok(frame.regions.length>8);
 assert.equal(emitters.length,1);
 const file=openDocument(doc.serialize('mdx'),'nat.mdx'),read=readAnimationStack(file.model,37);
 file.apply('Reapply',FX_SECTIONS,m=>compileAnimation(m,37,read));
 assert.equal(file.model.ParticleEmitters2.filter(p=>p._FxTag?.startsWith('nat/1/')).length,1);
});
