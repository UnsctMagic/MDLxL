import test from 'node:test';
import assert from 'node:assert/strict';
import * as looks from '../src/global-animation-looks.js';
test('emitter menus use descriptive unique names while saved ingredient labels still resolve',()=>{
 const empty=looks.findLook('empty'),labels=looks.emitterChoices(empty).map(c=>c.label);
 const names=['Flames','Embers','Splinters','Glow orb','Drops','Bubbles','Spark spray','Circling stars','Circling lights','Grey cloud','Ghost flames','Rune discs','Falling stars','Sparkles','Ghost wisps','Light wisps','Inward swirl','Rising glyphs','Small sparks','Green haze'];
 assert.deepEqual(names.filter(n=>!labels.includes(n)),[],'missing renamed emitters');
 assert.equal(new Set(labels).size,labels.length,'no duplicate menu names');
 assert.ok(labels.includes('Blade crackle')&&labels.includes('Rising embers'));
 // Eye sparks left with the Eye glow look, Orb light with the old Glow orb and Rune rings with the old Rune circle (14 November 2026): none is offered or resolvable now.
 for(const old of ['Blade flames','Fire','Lingering embers','Column embers','Rift splinters','Void splinters','Glow orbs','Heavy drops','Ichor drops','Bubbles','Spores','Star sparks','Orbiting stars','Drifting lights','Storm cloud','Lantern flame','Rune sparks','Stars','Light sparks','Spirit wisps','Wisps','Inward souls','Hex glyphs','Sparks','Plague haze']){
  assert.ok(looks.layerIngredient(empty,{type:'Particles',label:old}),'saved ingredient '+old);
 }
 for(const look of looks.GLOBAL_LOOKS){
  const own=looks.emitterChoices(look).map(c=>c.label.replace(/ \(recommended\)$/,''));
  assert.equal(new Set(own).size,own.length,look.name+' has no duplicate emitter entries');
 }
});
