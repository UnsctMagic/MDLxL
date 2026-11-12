import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openDocument} from '../src/editor-document.js';
import {findLook,newStack,partFrame,makeLayer,LAYER_CHOICES} from '../src/global-animation-looks.js';
import {compileAnimation,readAnimationStack,FX_SECTIONS} from '../src/global-animation-model.js';

// Owner, 12 November: "Falling mist does not work on the footman body but it does on a sword? on a body it
// just flashes." A part split into many skin regions gave every region a full set of emitters and shared the
// Amount among all of them: on the Footman body 135 emitters, each one particle every 6 s, so a lone puff
// appeared and vanished. Every site now keeps at least the density of a four-region weapon.
const knight=()=>openDocument(fs.readFileSync(new URL('./fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx',import.meta.url)),'knight.mdx');
// The nominal emission rate: its keys swell between .52 and 1 of it over the loop, .76 on average.
// A steady (number) rate is its own nominal value.
const mean=track=>typeof track==='number'?track:track.Keys.slice(0,-1).reduce((a,k)=>a+k.Vector[0],0)/(track.Keys.length-1)/.76;
function apply(doc,part,label){
 const frame=partFrame(doc.model.Geosets[part]),stack=newStack(findLook('empty'),frame,'mist');
 stack.layers=[makeLayer(LAYER_CHOICES.find(s=>s.label===label),frame,'glacier',1)];
 doc.apply('Add emitter',FX_SECTIONS,m=>compileAnimation(m,part,stack));
 const emitters=doc.model.ParticleEmitters2.filter(p=>p._FxTag?.startsWith('mist/1/'));
 return {frame,stack,layer:stack.layers[0],emitters};
}
// Parts of the real Knight: 17 and 12 skin regions (bodies), 4 and 2 (weapons), 1.
for(const label of ['Falling mist','Rising embers'])for(const part of [37,5,8,0,1])test(label+' keeps a steady stream at every site, part '+part,()=>{
 const doc=knight(),{frame,layer,emitters}=apply(doc,part,label),regions=frame.regions?.length||1;
 // Particles in flight per site with the game's steady emission: below one, a site is dark between puffs.
 const inFlight=emitters.map(p=>mean(p.EmissionRate)*p.LifeSpan);
 assert.ok(Math.min(...inFlight)>=layer.amount*layer.lasts/(layer.count*4)*.99,'every site keeps the density of a four-region part: '+Math.min(...inFlight).toFixed(2)+' in flight');
 assert.ok(Math.abs(emitters.reduce((a,p)=>a+mean(p.EmissionRate),0)-layer.amount)<layer.amount*.01,'Amount is the total over the part');
 // Design section 4 restores the larger frost puff while keeping fitted strip placement.
 if(label==='Falling mist'&&part===1)assert.equal(emitters.length,3,'the restored footprint fits three sites on the strip');
 else if(regions<=4)assert.equal(emitters.length,layer.count*regions,'a weapon keeps one set of emitters per region');
 else{
  assert.equal(emitters.length,layer.count*4);
  // The sites still cover the part: they sit on several regions spread over its length.
  const along=emitters.map(p=>new Float32Array(p.PivotPoint)).map(v=>(v[0]-frame.center.x)*frame.axis.x+(v[1]-frame.center.y)*frame.axis.y+(v[2]-frame.center.z)*frame.axis.z);
  assert.ok(Math.max(...along)-Math.min(...along)>frame.length*.4,'sites spread over the part');
  assert.ok(new Set(emitters.map(p=>p.Parent)).size>=4,'sites on several regions');
 }
 // Save and reopen: the layer reads back the same Amount, and reapplying keeps the emitters.
 for(const format of ['mdx','mdl']){
  const file=openDocument(doc.serialize(format),'mist.'+format),read=readAnimationStack(file.model,part);
  assert.ok(Math.abs(read.layers[0].amount-layer.amount)<1e-3,format+' Amount '+read.layers[0].amount);
  file.apply('Reapply',FX_SECTIONS,m=>compileAnimation(m,part,read));
  assert.equal(file.model.ParticleEmitters2.filter(p=>p._FxTag?.startsWith('mist/1/')).length,emitters.length);
 }
});
