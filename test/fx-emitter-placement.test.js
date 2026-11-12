import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {Vector3} from 'three';
import {openDocument} from '../src/editor-document.js';
import {findLook,newStack,makeLayer,partFrame,layerIngredient} from '../src/global-animation-looks.js';
import {compileAnimation} from '../src/global-animation-model.js';
const {fixturePath}=createRequire(import.meta.url)('./helpers/fixtures.cjs'),file=fixturePath('footman');
for(const part of [0,2])for(const label of ['Blade flames','Fire column','Orbiting stars','Blood beads'])test(label+' layer span moves every site on Footman part '+part,{skip:!fs.existsSync(file)&&'private Footman missing'},()=>{
 const base=openDocument(fs.readFileSync(file),'footman.mdx').model,frame=partFrame(base.Geosets[part]),stack=newStack(findLook('empty'),frame,'placement');
 const layer=makeLayer(layerIngredient(findLook('empty'),{type:'Particles',label}),frame,'native',1);stack.layers=[layer];
 const before=structuredClone(base);compileAnimation(before,part,stack);
 layer.placement={upper:layer.upper,lower:layer.lower};layer.upper*=1.8;layer.lower*=.4;layer.offset=[7,-9,13];
 const after=structuredClone(base);compileAnimation(after,part,stack);
 const nodes=m=>m.ParticleEmitters2.filter(p=>p._FxTag?.startsWith('placement/1/'));
 assert.equal(nodes(after).length,nodes(before).length,'placement does not add or remove sites');
 for(const p of nodes(before)){
  const q=nodes(after).find(n=>n._FxTag===p._FxTag),at=new Vector3().fromArray(p.PivotPoint),along=at.clone().sub(frame.center).dot(frame.axis);
  const fitted=-layer.lower+(layer.upper+layer.lower)*(along+layer.placement.lower)/(layer.placement.upper+layer.placement.lower);
  const expected=at.addScaledVector(frame.axis,fitted-along).add(new Vector3(...layer.offset));
  assert.ok(expected.distanceTo(new Vector3().fromArray(q.PivotPoint))<.001,'top/bottom and move place '+p._FxTag);
 }
});


for(const part of [0,2])for(const label of ['Blade flames','Fire column'])test(label+' formation scales sites about the layer centre on part '+part,{skip:!fs.existsSync(file)&&'private Footman missing'},()=>{
 const base=openDocument(fs.readFileSync(file),'footman.mdx').model,frame=partFrame(base.Geosets[part]),stack=newStack(findLook('empty'),frame,'formation');
 const layer=makeLayer(layerIngredient(findLook('empty'),{type:'Particles',label}),frame,'native',1);stack.layers=[layer];
 const before=structuredClone(base);compileAnimation(before,part,stack);
 layer.placement={upper:layer.upper,lower:layer.lower};layer.formation=.35;
 const after=structuredClone(base);compileAnimation(after,part,stack);
 for(const p of before.ParticleEmitters2.filter(n=>n._FxTag?.startsWith('formation/1/'))){
  const q=after.ParticleEmitters2.find(n=>n._FxTag===p._FxTag),expected=new Vector3().fromArray(p.PivotPoint).sub(frame.center).multiplyScalar(.35).add(frame.center);
  assert.ok(expected.distanceTo(new Vector3().fromArray(q.PivotPoint))<.001,'formation tightens '+p._FxTag);
 }
});


for(const part of [0,2])for(const label of ['Blade flames','Fire column'])test(label+' individual position and values affect only its stable site on part '+part,{skip:!fs.existsSync(file)&&'private Footman missing'},()=>{
 const base=openDocument(fs.readFileSync(file),'footman.mdx').model,frame=partFrame(base.Geosets[part]),stack=newStack(findLook('empty'),frame,'individual');
 const layer=makeLayer(layerIngredient(findLook('empty'),{type:'Particles',label}),frame,'native',1);stack.layers=[layer];
 const before=structuredClone(base);compileAnimation(before,part,stack);
 const nodes=before.ParticleEmitters2.filter(n=>n._FxTag?.startsWith('individual/1/')),chosen=nodes[0],key=chosen._FxTag.split('/').at(-1);
 layer.individuals={[key]:{position:[23,-14,81],values:{tint:[1,0,0],amount:layer.amount*2,lasts:.4,size:layer.size*1.5,native:{LifeSpan:.4,Time:.7,Width:12,Length:4}}}};
 const after=structuredClone(base);compileAnimation(after,part,stack);
 for(const p of nodes){
  const q=after.ParticleEmitters2.find(n=>n._FxTag===p._FxTag);
  if(p===chosen){assert.deepEqual(Array.from(q.PivotPoint),[23,-14,81],'only the selected site moves');assert.equal(q.LifeSpan,.4);assert.equal(q.Time,.7);assert.equal(q.Width,12);assert.equal(q.Length,4);assert.equal(q.SegmentColor[1][1],0);assert.ok(q.EmissionRate>p.EmissionRate,'individual Amount changes its own rate');}
  else assert.deepEqual(q,p,'unselected emitter remains byte-identical');
 }
});

for(const part of [0,2])for(const label of ['Blade flames','Fire column'])test(label+' deletes only the chosen site on part '+part,{skip:!fs.existsSync(file)&&'private Footman missing'},()=>{
 const base=openDocument(fs.readFileSync(file),'footman.mdx').model,frame=partFrame(base.Geosets[part]),stack=newStack(findLook('empty'),frame,'deleted');
 const layer=makeLayer(layerIngredient(findLook('empty'),{type:'Particles',label}),frame,'native',1);stack.layers=[layer];
 const before=structuredClone(base),graph=compileAnimation(before,part,stack),sites=graph.layers[1].sites,key=sites[0].key;
 layer.individuals={[key]:{deleted:true},missing:{position:[1,2,3]}};
 const after=structuredClone(base),result=compileAnimation(after,part,stack),nodes=m=>m.ParticleEmitters2.filter(n=>n._FxTag?.startsWith('deleted/1/'));
 assert.equal(nodes(after).length,nodes(before).length-1,'only one emitter removed');
 assert.ok(!nodes(after).some(n=>n._FxTag.endsWith('/'+key)),'deleted stable key absent');
 assert.deepEqual(result.layers[1].sites.map(s=>s.key),sites.map(s=>s.key),'deleted slot remains addressable');
 assert.deepEqual(after.Geosets[part]._FxStack.layers[0].individuals,{[key]:{deleted:true}},'prune records for nonexistent sites');
});
