import test from 'node:test';
import assert from 'node:assert/strict';
import { ModelRenderer } from 'war3-model';
import { createStarterRecipe } from '../src/particle-starters.js';
import { installParticleNativeCompatibility, NativeParticleSimulation } from '../app/particle-preview-adapter.js';

function fixture(speed=160,flags=0){
 const model=structuredClone(createStarterRecipe().native);
 model.Sequences[0].Name='Forward glide';model.Sequences[0].MoveSpeed=speed;
 Object.assign(model.ParticleEmitters2[0],{Flags:flags,Speed:0,Variation:0,Gravity:0,Width:0,Length:0,LifeSpan:4,EmissionRate:20,Visibility:1});
 return model;
}
const live=sim=>sim.native.particlesController.emitters[0].particles;
const near=(a,b)=>assert.ok(Math.abs(a-b)<.003,`${a} != ${b}`);

test('native world particles trail by animation speed and age; new particles remain at the emitter',()=>{
 const model=fixture(),before=structuredClone(model),sim=new NativeParticleSimulation(model);
 sim.advance(1000);assert.ok(live(sim).length>10);
 const origin=model.ParticleEmitters2[0].PivotPoint[0];
 for(const p of live(sim))near(p.pos[0],origin-160*(4-p.lifeSpan));
 assert.ok(live(sim).at(-1).pos[0]>live(sim)[0].pos[0]+100);
 assert.deepEqual(model,before,'authored asset is untouched');
});

test('zero speed and ModelSpace retain their original particle positions',()=>{
 for(const [speed,flags]of [[0,0],[160,524288]]){
  const model=fixture(speed,flags),sim=new NativeParticleSimulation(model);sim.advance(1000);
  assert.ok(live(sim).length);for(const p of live(sim))near(p.pos[0],model.ParticleEmitters2[0].PivotPoint[0]);
 }
});

test('travel follows animation speed rather than independent EMTR FX speed',()=>{
 const sim=new NativeParticleSimulation(fixture(),0,{timeline:[{at:0,frame:0,global:0,fx:0,poseRate:2,fxRate:.5}]});
 sim.advance(1000);assert.ok(live(sim).length);
 const origin=sim.native.model.ParticleEmitters2[0].PivotPoint[0];
 for(const p of live(sim))near(p.pos[0],origin-160*(4-p.lifeSpan)*4);
});

test('paused pose with running FX has no travel',()=>{
 const sim=new NativeParticleSimulation(fixture(),0,{timeline:[{at:0,frame:0,global:0,fx:0,poseRate:0,fxRate:1}]});
 sim.advance(1000);assert.ok(live(sim).length);
 for(const p of live(sim))near(p.pos[0],sim.native.model.ParticleEmitters2[0].PivotPoint[0]);
});

test('looping, checkpoint replay and refresh preserve a continuous deterministic trail',()=>{
 const model=fixture();model.Sequences[0].Interval[1]=500;
 const options={timeline:[{at:0,frame:0,global:0,fx:0,poseRate:1,fxRate:1,loop:[0,500]}]};
 const sim=new NativeParticleSimulation(model,0,options);sim.advance(750);
 const snapshot=sim.snapshot();sim.refresh();assert.deepEqual(sim.snapshot().particles,snapshot.particles);
 sim.advance(1500);const expected=sim.snapshot().particles;
 sim.restore(snapshot);sim.advance(1500);assert.deepEqual(sim.snapshot().particles,expected);
 for(const p of live(sim))near(p.pos[0],model.ParticleEmitters2[0].PivotPoint[0]-160*(4-p.lifeSpan));
});

test('native sequence changes and paused manual effects use the current travel context',()=>{
 const model=fixture();model.Sequences.push({...structuredClone(model.Sequences[0]),Name:'Stand',MoveSpeed:0,Interval:new Uint32Array([6000,11000])});
 const native=new ModelRenderer(model);let playing=true;
 installParticleNativeCompatibility(native,{getTravelDistance:delta=>playing?Number(model.Sequences[native.getSequence()].MoveSpeed)*delta/1000:0});
 installParticleNativeCompatibility(native);
 const controller=native.particlesController,emitter=controller.emitters[0],p={emitter,pos:new Float32Array([0,0,0]),speed:new Float32Array(3),gravity:0,lifeSpan:4};
 native.setSequence(0);controller.updateParticle(p,100);near(p.pos[0],-16);
 playing=false;controller.updateParticle(p,100);near(p.pos[0],-16);
 playing=true;native.setSequence(1);controller.updateParticle(p,100);near(p.pos[0],-16);
 native.setSequence(0);controller.updateParticle(p,0);near(p.pos[0],-16);
});
