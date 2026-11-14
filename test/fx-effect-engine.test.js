import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {openDocument} from '../src/editor-document.js';
import * as looks from '../src/global-animation-looks.js';
import {compileAnimation,readAnimationStack} from '../src/global-animation-model.js';
import {withIndividualEmitter} from '../src/fx-emitter-placement.js';
import {modelHash} from './helpers/fx-legacy-snapshot.mjs';

const {fixturePath}=createRequire(import.meta.url)('./helpers/fixtures.cjs');
const footman=()=>openDocument(fs.readFileSync(fixturePath('footman')),'footman.mdx').model;
const strip=()=>openDocument(fs.readFileSync(fixturePath('effect')),'effect.mdx').model;
const sprite='Textures\\Star7b.blp';
const particle=(extra={},nativeSpec={})=>({type:'Particles',label:'Stars',kind:'native',image:sprite,
 tint:[.5,.5,.5],nativeSpec:{texture:sprite,life:1,rate:20,size:[.2,.4,.1],...nativeSpec},...extra});
const separate=layer=>{delete layer.coverFit;};
const pointSites=layer=>{delete layer.cover;};
const close=(a,b)=>assert.ok(Math.abs(a-b)<.001,`${a} differs from ${b}`);
// edit: a hand change to the made layer. A fresh native emitter now covers the part instead of using separate dots or point sites,
// so the tests of those older site layouts (still what saved layers use) switch the cover default off here.
function apply(model,part,make,edit){
 const frame=looks.partFrame(model.Geosets[part]),stack=looks.newStack(looks.findLook('empty'),frame,'redesign');
 const layer=looks.makeLayer(make,frame,'native',1);
 edit?.(layer);
 stack.layers=[layer];
 const graph=compileAnimation(model,part,stack);
 return {graph,stack,layer,emitters:model.ParticleEmitters2.filter(p=>p._FxTag?.startsWith('redesign/1/'))};
}

test('widthCap limits the peak to the site width, preserves stage ratios and yields to individual Size',()=>{
 const model=strip(),part=5,{stack,layer,graph,emitters}=apply(model,part,particle({widthCap:.35,siteCount:3}));
 const site=graph.layers[1].sites[0],p=emitters[0],capped=p.ParticleScaling[1];
 assert.ok(site.componentWidth>0);
 close(p.ParticleScaling[1],site.componentWidth*.35);
 close(p.ParticleScaling[0]/p.ParticleScaling[1],.5);
 close(p.ParticleScaling[2]/p.ParticleScaling[1],.25);
 stack.layers=[withIndividualEmitter(layer,site.key,layer,{...layer,size:2})];
 compileAnimation(model,part,stack);
 const sized=model.ParticleEmitters2.find(n=>n._FxTag===p._FxTag);
 assert.ok(sized.ParticleScaling[1]>capped);
 stack.layers=[looks.withLayerSize(layer,{...layer,size:2})];
 compileAnimation(model,part,stack);
 assert.ok(model.ParticleEmitters2.filter(n=>n._FxTag?.startsWith('redesign/1/')).every(n=>n.ParticleScaling[1]>capped));
});

test('siteCount overrides the live budget and shares strip stations and rate',()=>{
 const a=apply(strip(),5,particle({siteCount:9},{rate:2,size:[.02,.03,.01]}),separate);
 const b=apply(strip(),5,particle({siteCount:9},{rate:4,size:[.2,.4,.1]}),separate);
 assert.equal(a.emitters.length,9);
 assert.deepEqual(a.graph.layers[1].sites.map(s=>s.point),b.graph.layers[1].sites.map(s=>s.point));
 for(const emitter of a.emitters)close(emitter.EmissionRate,2/9);
});

test('scatter is stable across compiles and normalizes to the original rate',()=>{
 const rates=()=>apply(strip(),5,particle({siteCount:5,scatter:.35})).emitters.map(p=>p.EmissionRate);
 const a=rates();
 assert.ok(new Set(a).size>1);
 assert.deepEqual(a,rates());
 close(a.reduce((sum,n)=>sum+n,0),20);
});

test('birthAcross widens the strip slab and widthCap measures the physical strip',()=>{
 const regular=apply(strip(),5,particle({birthRegion:true}));
 const wide=apply(strip(),5,particle({birthRegion:true,birthAcross:1.6,widthCap:.35}));
 const {Width,Length,ParticleScaling}=wide.emitters[0];
 close(Width,regular.emitters[0].Width*1.6/.7);
 close(Length,regular.emitters[0].Length);
 close(ParticleScaling[1],Width/1.6*.35);
});

test('birthRegion point sites raise the rate to two live particles per site up to four times the recipe',()=>{
 for(const rate of [1,16]){
  const {graph,emitters}=apply(footman(),0,particle({birthRegion:true},{rate}),pointSites);
  assert.ok(graph.layers[1].sites.some(s=>s.birth&&!s.birth.rotation));
  const expected=Math.min(rate*4,Math.max(rate,emitters.length*2));
  assert.ok(expected>rate);
  close(emitters.reduce((sum,p)=>sum+p.EmissionRate,0),expected);
 }
});

test('a curved point fallback samples more than four sites when the footprint allows',()=>{
 const {emitters}=apply(strip(),21,particle({birthRegion:true},{size:[.01,.03,.01]}));
 assert.ok(emitters.length>4&&emitters.length<=16,'curved point site count: '+emitters.length);
});

test('recipe Colour retints the native ramp and a life-stage edit pins it across reopening',()=>{
 const model=footman(),part=2,ramp=[[1,.5,.1],[.5,.4,.25],[.25,.2,0]];
 const {stack,layer}=apply(model,part,particle({native:{SegmentColor:ramp}}));
 assert.deepEqual(layer.rampTint,[.5,.5,.5]);
 const layerTint={...layer,tint:[.25,.75,1]};
 stack.layers=[layerTint];
 compileAnimation(model,part,stack);
 const native=()=>model.ParticleEmitters2.find(n=>n._FxTag?.startsWith('redesign/1/')).SegmentColor.map(v=>Array.from(v));
 for(const [j,row] of [[.5,.75,.2],[.25,.6,.5],[.125,.3,0]].entries())row.forEach((v,i)=>close(native()[j][i],v));
 const pinned=[[.25,.5,1],[.75,1,0],[1,0,.25]];
 stack.layers=[looks.withParticleRamp(layerTint,pinned)];
 compileAnimation(model,part,stack);
 const saved=readAnimationStack(model,part);
 assert.equal(saved.layers[0].rampTint,undefined);
 saved.layers[0].tint=[1,.1,.8];
 compileAnimation(model,part,saved);
 assert.deepEqual(native(),pinned);
});

test('existing airy fit and saved slab stacks compile identically to item 1',()=>{
 const airy={type:'Particles',label:'Airy',kind:'flame',image:'ReplaceableTextures\\Weather\\Clouds8x8.blp',tint:[1,.46,.17],atlas:8,airyFit:{version:1}};
 for(const [part,spec,expected] of [
  [2,airy,'e7fd70cca73440ade028622bd45869a6d24a1de18d94645d7d89f258458a1402'],
  [0,particle({birthRegion:true}),'96879a1cc7c9f16bf522989b4cdbab5623040d07dc8abf89fdefde1e836a773f'],
 ]){
  const model=footman(),frame=looks.partFrame(model.Geosets[part]),stack=looks.newStack(looks.findLook('empty'),frame,'redesign');
  const layer=looks.makeLayer(spec,frame,'native',1);
  delete layer.birthRegionFit;delete layer.cover;
  stack.layers=[JSON.parse(JSON.stringify(layer))];
  compileAnimation(model,part,stack);
  assert.equal(modelHash(model),expected);
 }
});

test('switching from Flame licks back to Surface flames restores the dense native defaults',()=>{
 const model=strip(),part=5,frame=looks.partFrame(model.Geosets[part]),look=looks.findLook('flaming-sword');
 let stack=looks.newStack(look,frame,'switch');
 const flames=()=>model.ParticleEmitters2.filter(p=>p._FxTag?.startsWith('switch/2/')).map(p=>({
  speed:p.Speed,gravity:p.Gravity,rate:p.EmissionRate,alpha:Array.from(p.Alpha),
 }));
 compileAnimation(model,part,stack);
 const dense=flames();
 stack=looks.withVariation(stack,frame,look,'flame-licks');
 compileAnimation(model,part,stack);
 assert.notDeepEqual(flames(),dense,'the airy variation has different defaults');
 stack=looks.withVariation(stack,frame,look,'surface-flames');
 compileAnimation(model,part,stack);
 assert.deepEqual(flames(),dense,'switching back restores dense alpha, loft, gravity and rate');
});
