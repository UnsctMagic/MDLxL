import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openDocument} from '../src/editor-document.js';
import {findLook,newStack,partFrame,makeLayer,LAYER_CHOICES} from '../src/global-animation-looks.js';
import {compileAnimation} from '../src/global-animation-model.js';
const bytes=fs.readFileSync(new URL('./fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx',import.meta.url));
const sample=(label,edit=l=>l)=>{
 const model=openDocument(bytes,'knight.mdx').model,frame=partFrame(model.Geosets[37]),stack=newStack(findLook('empty'),frame,'round2');
 stack.layers=[edit(makeLayer(LAYER_CHOICES.find(s=>s.type==='Particles'&&s.label===label),frame,'native',1))];
 compileAnimation(model,37,stack);
 return {model,frame,layer:stack.layers[0],emitters:model.ParticleEmitters2.filter(p=>p._FxTag?.startsWith('round2/'))};
};
// Rune rings left the library with the old Rune circle (14 November).
for(const [label,rate] of [['Inward souls',4.5]])test(label+' restores ground strength with one steady emitter',()=>{
 const {emitters}=sample(label);
 assert.equal(emitters.length,1);
 assert.equal(emitters[0].EmissionRate,rate);
 assert.equal(emitters[0].Parent,null,'ground emitter is independent of the limb');
 assert.deepEqual(Array.from(emitters[0].PivotPoint),[0,0,1.5]);
});
