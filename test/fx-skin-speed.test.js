import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemoDocument,openDocument} from '../src/editor-document.js';
import {findLook,newStack,partFrame} from '../src/global-animation-looks.js';
import {compileAnimation,readAnimationStack,FX_SECTIONS} from '../src/global-animation-model.js';

// Owner, 12 November: "speed is 1 or 0... i cant make skin move slow but still move". Speed takes
// fine values; a slow layer still moves, and every pass wraps seamlessly.
const CASES=[
 ['repeating texture','fx-energy-flow','Energy flow'],
 ['frame flipbook','fx-liquid-body','Water body'],
 ['atlas area','felwood-curse','Poison surface'],
 ['native card','poison-skin','Poison surface'],
];
function apply(look,label,speed){
 const doc=createDemoDocument(),frame=partFrame(doc.model.Geosets[0]),stack=newStack(findLook(look),frame,'speed');
 // Only the layer under test, with Speed typed as the user types it.
 stack.layers=stack.layers.filter(l=>l.label===label).map(l=>({...l,speed}));
 assert.equal(stack.layers.length,1,label);
 const clocks=doc.model.GlobalSequences.length;
 doc.apply('Speed',FX_SECTIONS,m=>compileAnimation(m,0,stack));
 return {doc,stack,clocks};
}
/** Passes per second of the layer's motion and whether the motion ends where it started (whole tiles). */
function motion(model,stack){
 const shape=model.Geosets.find(g=>g._FxTag===stack.owner+'/'+stack.layers[0].id+'/shape'),layer=model.Materials[shape.MaterialID].Layers[0];
 if(layer.TextureID?.Keys){
  const keys=layer.TextureID.Keys,ms=model.GlobalSequences[layer.TextureID.GlobalSeqId],frames=new Set(keys.map(k=>k.Vector[0])).size;
  return {rate:(keys.length-1)/frames/ms,seamless:keys[0].Vector[0]===keys.at(-1).Vector[0]&&keys.at(-1).Frame===ms};
 }
 const track=model.TextureAnims[layer.TVertexAnimId].Translation,keys=track.Keys,ms=model.GlobalSequences[track.GlobalSeqId];
 const travel=[0,1].map(a=>keys.at(-1).Vector[a]-keys[0].Vector[a]),whole=travel.every(v=>Math.abs(v-Math.round(v))<1e-6);
 // A straight pass covers whole tiles; an atlas excursion returns to its start several times.
 const passes=Math.max(...travel.map(Math.abs))||keys.filter((k,i)=>i&&k.Vector.every((v,a)=>Math.abs(v-keys[0].Vector[a])<1e-6)).length/2;
 return {rate:passes/ms,seamless:whole&&keys.at(-1).Frame===ms};
}
for(const [name,look,label] of CASES)test('Moving skin Speed below and between whole numbers moves proportionally and wraps seamlessly: '+name,()=>{
 const one=motion(apply(look,label,1).doc.model,apply(look,label,1).stack);
 assert.ok(one.seamless,'speed 1 wraps');
 for(const speed of [.25,.5,1.5]){
  const {doc,stack,clocks}=apply(look,label,speed),now=motion(doc.model,stack);
  assert.ok(now.seamless,speed+': the pass ends where the texture repeats');
  assert.ok(Math.abs(now.rate/one.rate-speed)<.01*speed,speed+': moves at '+(now.rate/one.rate).toFixed(3)+'x the speed of Speed 1');
  for(const format of ['mdx','mdl']){
   const file=openDocument(doc.serialize(format),'speed.'+format),read=readAnimationStack(file.model,0);
   assert.equal(read.layers[0].speed,speed,format+' reopens with the same Speed');
   file.apply('Reapply',FX_SECTIONS,m=>compileAnimation(m,0,read));
   assert.ok(Math.abs(motion(file.model,read).rate/one.rate-speed)<.01*speed,format+' reapplies at the same speed');
  }
  // Removing the layer releases its own clock.
  doc.apply('Remove layer',FX_SECTIONS,m=>compileAnimation(m,0,{...stack,layers:[]}));
  assert.equal(doc.model.GlobalSequences.length,clocks,speed+': no clock left behind');
  doc.undo();assert.ok(Math.abs(motion(doc.model,stack).rate/one.rate-speed)<.01*speed,'Undo brings the layer back');
 }
});
