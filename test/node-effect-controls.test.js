import test from 'node:test';
import assert from 'node:assert/strict';
import { installNodeEffectControls, crossedSoundEvents } from '../app/node-effect-controls.js';
import { defaultEditorDisplay } from '../src/display-overlays.js';
import { previewOverlayOptions, movementNodeCategories, visibleMovementPoints } from '../app/preview-overlays.js';
import { markerStyle } from '../app/rig-markers-gl.js';

test('category symbols follow each editor and Animations Nodes gates only enabled categories',()=>{
  for(const mode of ['bones','movement','animations'])for(const enabled of [false,true])for(const nodes of [false,true]){
    const display={...defaultEditorDisplay()[mode],particles:enabled,sounds:enabled,events:enabled,nodes}, before=structuredClone(display), options=previewOverlayOptions(display,false,mode);
    for(const kind of ['particles','ribbons','sounds','events'])assert.equal(options[kind],enabled&&(mode!=='animations'||nodes),mode+': '+kind);
    assert.equal(options.bones,false);assert.equal(options.nodes,false);assert.deepEqual(display,before);
  }
});
test('ribbons and event types keep distinct symbols within shared controls',()=>{
  const model={Bones:[{ObjectId:0}],Attachments:[{ObjectId:1}],ParticleEmitters2:[{ObjectId:2}],RibbonEmitters:[{ObjectId:3}],EventObjects:['SNDxTEST','SPLxTEST','FPTxTEST','UBRxTEST','SPNxTEST'].map((Name,i)=>({ObjectId:i+4,Name}))};
  const kinds=movementNodeCategories(model);
  assert.deepEqual([0,1,2,3,4,5,6,7,8].map(id=>kinds.get(id)||'nodes'),['bones','attachments','particles','ribbons','sounds','events','events','events','nodes']);
  const points=[...kinds].map(([id,overlayKind])=>({node:{ObjectId:id},overlayKind}));
  assert.deepEqual(visibleMovementPoints(points,previewOverlayOptions(defaultEditorDisplay().movement,false,'movement')).map(p=>p.node.ObjectId),[2,3]);
  assert.equal(visibleMovementPoints(points,previewOverlayOptions(defaultEditorDisplay().animations,false,'animations')).length,0);
  const symbols=['SPLxTEST','FPTxTEST','UBRxTEST'].map(Name=>markerStyle({node:{ObjectId:0,Name},overlayKind:'events'},new Map(),{}).shape);
  assert.equal(new Set(symbols).size,3);
  for(const shape of symbols)assert.ok(shape.billboard&&shape.faces.length>40);
  for(const kind of ['ribbons','sounds'])assert.ok(markerStyle({node:{ObjectId:0},overlayKind:kind},new Map(),{}).shape.billboard);
});

test('a manual squirt emits once and completes its lifetime while disabled, preserving authored tracks',()=>{
  let clock=0, enabled=false;
  const props={ObjectId:1,Visibility:0,EmissionRate:{Keys:[{Frame:0,Vector:new Float32Array([40])}]},Squirt:true}, before=structuredClone(props);
  const emitter={props,particles:[],emission:0,squirtFrame:-1};
  const calls=[];
  const controller={emitters:[emitter],updateEmitter(item,delta){
    calls.push({visibility:item.props.Visibility,rate:item.props.EmissionRate,emission:item.emission});
    if(item.props.Visibility&&item.emission>0){item.particles.push({life:2000});item.emission=0;}
    for(const particle of item.particles)particle.life-=delta;
    item.particles=item.particles.filter(particle=>particle.life>0);
  },update(delta){for(const item of this.emitters)this.updateEmitter(item,delta);}};
  const native={particlesController:controller,model:{Sequences:[{Interval:[0,1000]}]},getSequence:()=>0,getFrame:()=>0};
  const controls=installNodeEffectControls(native,()=>({particles:enabled}),()=>{},()=>clock);
  controller.update(20);assert.equal(emitter.particles.length,0);
  assert.equal(controls.trigger(1),true);controls.advancePaused(20);
  assert.deepEqual(calls.at(-1),{visibility:1,rate:0,emission:40000});
  clock=20;controls.advancePaused(20);assert.equal(emitter.particles.length,1,'The squirt is not emitted twice');
  assert.deepEqual(props,before);clock=501;controller.update(0);
  assert.equal(controls.active,true);assert.equal(emitter.particles.length,1,'Existing particles survive the old cutoff');
  clock=2001;controls.advancePaused(1980);assert.equal(controls.active,false);assert.equal(emitter.particles.length,0);
  enabled=true;controller.update(20);assert.equal(calls.at(-1).visibility,0);assert.equal(calls.at(-1).rate,props.EmissionRate);
  assert.deepEqual(props,before);controls.dispose();
});

test('sounds trigger at crossed local and global keys, including start and loops, never a paused frame',()=>{
  const local={ObjectId:1,Name:'SNDxTEST',EventTrack:new Uint32Array([0,100,900])},global={ObjectId:2,Name:'SNDxTEST',GlobalSeqId:0,EventTrack:new Uint32Array([100])};
  const model={Sequences:[{Interval:[0,1000]}],GlobalSequences:[500],EventObjects:[local,global]};
  const at=(frame,globalTime=frame,playing=true)=>({frame,globalTime,playing,sequenceIndex:0});
  assert.deepEqual(crossedSoundEvents(model,at(0,0,false),at(10)).map(event=>event.ObjectId),[1]);
  assert.deepEqual(crossedSoundEvents(model,at(80),at(120)).map(event=>event.ObjectId),[1,2]);
  assert.deepEqual(crossedSoundEvents(model,at(120),at(120)),[]);
  assert.deepEqual(crossedSoundEvents(model,at(120),at(150,150,false)),[]);
  assert.deepEqual(crossedSoundEvents(model,at(950,950),at(20,1020)).map(event=>event.ObjectId),[1]);
  assert.deepEqual(crossedSoundEvents(model,at(550,550),at(650,650)).map(event=>event.ObjectId),[2]);
});
