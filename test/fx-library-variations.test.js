import test from 'node:test';
import assert from 'node:assert/strict';
import * as looks from '../src/global-animation-looks.js';
import {compileAnimation,readAnimationStack,FX_SECTIONS} from '../src/global-animation-model.js';
import {createDemoDocument,openDocument} from '../src/editor-document.js';

// Read through the namespace so a missing export fails the assertions below, not the import.
const {GLOBAL_LOOKS,LAYER_CHOICES,LIBRARY=[],findLook,newStack,partFrame,makeLayer,emitterChoices}=looks;
const withVariation=(...a)=>{assert.ok(looks.withVariation,'withVariation exists');return looks.withVariation(...a);};
const currentVariation=(...a)=>{assert.ok(looks.currentVariation,'currentVariation exists');return looks.currentVariation(...a);};
const fixture=()=>{const doc=createDemoDocument();return {doc,frame:partFrame(doc.model.Geosets[0])};};
const started=(look,frame=fixture().frame)=>newStack(findLook(look),frame,'owner').layers.filter(l=>l.enabled!==false).map(l=>l.label);

test('new stacks start with the chosen emitters and the listed defaults',()=>{
 const {frame}=fixture();
 assert.ok(started('flaming-sword',frame).includes('Blade flames'));assert.ok(!started('flaming-sword',frame).includes('Rising embers'));
 assert.ok(started('claude-fel-blade',frame).includes('Fel flames'));
 assert.ok(!findLook('claude-fel-blade').layers.some(l=>l.label==='Fel edge'),'Fel fire has no Fel edge layer');
 assert.ok(LAYER_CHOICES.some(l=>l.label==='Fel edge'&&l.type==='Edge'),'Fel edge stays addable');
 const frost=findLook('frost-blade');
 assert.deepEqual(frost.variations.map(v=>v.id),['ice','steel','dark','vapour','shards']);assert.equal(frost.loop,3200);
 for(const v of frost.variations.slice(0,3)){
  const stack=withVariation(newStack(frost,frame,'o'),frame,frost,v.id);
  assert.ok(stack.layers.some(l=>l.label==='Falling mist'&&l.enabled),v.id+' starts with its mist');
 }
 assert.deepEqual(newStack(frost,frame,'o').layers.map(l=>l.label),['Packed frost','Ice facets','Falling mist']);
 assert.equal(newStack(frost,frame,'o').variation,'ice');
 const water=findLook('claude-tidal-blade');
 assert.deepEqual(water.variations.map(v=>v.id),['running','currents','spray']);assert.equal(water.loop,2600);
 assert.ok(started('claude-tidal-blade',frame).includes('Dripping water'));
 assert.ok(withVariation(newStack(water,frame,'o'),frame,water,'currents').layers.some(l=>l.label==='Dripping water'&&l.enabled));
 for(const [look,ids] of Object.entries({
  'flaming-sword':['surface-flames','flame-licks','enveloping-flames','fireball'],
  'claude-fel-blade':['original','fel-surge','fel-sparks'],
  'lightning-blade':['original','crackle','tip'],
  'arcane-blade':['arcane','shimmer','swirl'],
  'poison-skin':['original','venom','fumes'],
  lava:['original','spitting','smoulder'],
  'fx-lit-crystal':['light','team','sparkle'],
 }))assert.deepEqual(findLook(look).variations.map(v=>v.id),ids,look);
 for(const id of ['claude-magma-flow','fissures','crystal-veins','fx-liquid-body'])assert.equal(findLook(id).variations,undefined,id);
 const lightning=newStack(findLook('lightning-blade'),frame,'o').layers;
 assert.equal(lightning.find(l=>l.label==='Forked arcs').enabled,true);assert.equal(lightning.find(l=>l.label==='Blade arcs').enabled,false);
 assert.equal(newStack(findLook('glowing-skin'),frame,'o').layers[0].strength,4);
 assert.equal(newStack(findLook('colour-pulse'),frame,'o').layers[0].strength,.56);
});

test('the start flag never reaches the saved layer',()=>{
 const {doc,frame}=fixture(),stack=newStack(findLook('flaming-sword'),frame,'flag');
 assert.ok(stack.layers.every(l=>!('starts' in l)));
 doc.apply('FX',FX_SECTIONS,m=>compileAnimation(m,0,stack));
 assert.ok(!JSON.stringify(readAnimationStack(doc.model,0)).includes('starts'));
});

test('switching a variation swaps its layers and keeps what the user added',()=>{
 const {frame}=fixture();
 for(const id of ['frost-blade','claude-tidal-blade','rune-blade']){
  const look=findLook(id);let stack=newStack(look,frame,'o');
  const extra=makeLayer(LAYER_CHOICES.find(l=>l.label==='Light edge'),frame,look.palette,50);stack.layers.push(extra);
  for(const v of [...look.variations.slice(1),look.variations[0]]){
   stack=withVariation(stack,frame,look,v.id);
   assert.equal(currentVariation(stack,look),v.id);
   assert.ok(stack.layers.some(l=>l.id===50),'user layer stays');
   const wanted=v.layers.filter(s=>s.type!=='Particles'||s.starts).map(s=>s.label);
   assert.deepEqual(stack.layers.filter(l=>l.id!==50).map(l=>l.label),wanted,id+' '+v.id);
   assert.equal(new Set(stack.layers.map(l=>l.id)).size,stack.layers.length,'ids stay unique');
  }
 }
 // A layer the user switched off stays off in its place.
 const look=findLook('frost-blade');let stack=newStack(look,frame,'o');stack.layers[0]={...stack.layers[0],enabled:false};
 assert.equal(withVariation(stack,frame,look,'steel').layers[0].enabled,false);
 // An unmarked variation carries no extra emitters of its own.
 assert.equal(currentVariation({layers:[{label:'Cold sheen'}]},look),'steel','a stack saved before variations shows its own finish');
});

test('a saved removed variation shows the first choice and keeps its layers across subsequent switches',()=>{
 const {doc,frame}=fixture(),look=findLook('frost-blade');
 const original={...newStack(look,frame,'removed'),variation:'technique-compact'};
 original.layers=[{...original.layers[0],id:50,recipeRole:'structure',strength:.4}];
 compileAnimation(doc.model,0,original);
 const saved=readAnimationStack(openDocument(doc.serialize('mdx'),'removed.mdx').model,0);
 assert.equal(currentVariation(saved,look),'ice');
 const {recipeOwner,recipeRole,...extra}=saved.layers[0];
 let next=saved;
 for(const id of ['steel','dark']){
  next=withVariation(next,frame,look,id);
  assert.deepEqual(next.layers.find(l=>l.id===50),extra,'the saved layer survives as a user layer');
 }
});

test('Add emitter offers the emitters of every variation first, once',()=>{
 const labels=emitterChoices(findLook('claude-tidal-blade')).map(c=>c.label);
 assert.equal(labels[0],'Dripping water (recommended)');assert.equal(labels.filter(l=>l.startsWith('Dripping water')).length,1);
 const frost=emitterChoices(findLook('frost-blade'));assert.equal(frost[0].spec.label,'Falling mist');assert.equal(frost.filter(c=>c.spec.label==='Falling mist').length,1);
});

test('stacks saved with the retired skins and Ground glow reopen, edit and compile as before',()=>{
 for(const id of ['ice-skin','water-skin','sort-thorn','fx-ground-glow']){
  assert.ok(findLook(id),id+' resolves');assert.ok(!GLOBAL_LOOKS.some(l=>l.id===id),id+' is not in the library');
  const {doc,frame}=fixture(),look=findLook(id),stack={...newStack(look,frame,'old'),layers:look.layers.map((s,i)=>makeLayer(s,frame,look.palette,i+1))};
  compileAnimation(doc.model,0,stack);
  for(const ext of ['mdx','mdl']){
   const m=openDocument(doc.serialize(ext),'old.'+ext).model,read=readAnimationStack(m,0);
   assert.equal(read.look,id);assert.equal(findLook(read.look).layers.length,look.layers.length);
   compileAnimation(m,0,{...read,loop:read.loop+100});
  }
 }
});

test('one table files every library look once, in the owner order',()=>{
 assert.deepEqual(GLOBAL_LOOKS.map(l=>l.group).filter((g,i,all)=>all.indexOf(g)===i),['Fire','Ice','Water','Lightning','Arcane','Light','Poison & nature','Stone','Death & spirit','Build your own']);
 const ids=GLOBAL_LOOKS.map(l=>l.id),listed=LIBRARY.flatMap(([,rows])=>rows.map(([id])=>id));
 assert.deepEqual(ids,listed,'every library look is filed exactly once, in table order');
 assert.equal(new Set(ids).size,ids.length);
 for(const [group,rows] of LIBRARY)for(const [id,name] of rows){const look=GLOBAL_LOOKS.find(l=>l.id===id);assert.equal(look.group,group);if(name)assert.equal(look.name,name);}
 for(const id of ['ice-skin','water-skin','sort-thorn','white-ice-skin','lava-skin','fx-ground-glow'])assert.ok(!ids.includes(id)&&findLook(id),id);
 assert.equal(GLOBAL_LOOKS[0].id,'flaming-sword','a fresh part opens on the first look of the first folder');
});
