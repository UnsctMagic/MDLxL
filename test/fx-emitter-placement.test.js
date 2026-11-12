import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {Vector3} from 'three';
import * as placement from '../src/fx-emitter-placement.js';
import {sampleNodeMatrices,geosetSkinMatrix} from '../src/animation.js';
import {vertexBoneWeights} from '../src/part-bones.js';
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

for(const part of [0,2])for(const label of ['Blade flames','Fire column'])test(label+' snapped site follows another part in every animation from part '+part,{skip:!fs.existsSync(file)&&'private Footman missing'},()=>{
 const base=openDocument(fs.readFileSync(file),'footman.mdx').model,frame=partFrame(base.Geosets[part]),stack=newStack(findLook('empty'),frame,'snapped'),target=part===0?2:0,geo=base.Geosets[target];
 const layer=makeLayer(layerIngredient(findLook('empty'),{type:'Particles',label}),frame,'native',1);stack.layers=[layer];
 const initial=structuredClone(base),graph=compileAnimation(initial,part,stack),key=graph.layers[1].sites[0].key;
 let face=0;if(target===0){for(let i=0;i<geo.Faces.length;i+=3)if(vertexBoneWeights(geo,geo.Faces[i]).length>1){face=i;break;}}
 const vertices=Array.from(geo.Faces.slice(face,face+3)),barycentric=[.2,.3,.5],position=[0,1,2].map(axis=>vertices.reduce((n,v,i)=>n+geo.Vertices[v*3+axis]*barycentric[i],0));
 layer.individuals={[key]:{position,surface:{geoset:target,vertices,barycentric}}};
 const model=structuredClone(base);compileAnimation(model,part,stack);const emitter=model.ParticleEmitters2.find(n=>n._FxTag==='snapped/1/'+key);
 for(const [sequence,clip] of model.Sequences.entries())for(const frame of [...new Set([...clip.Interval, ...Array.from({length:9},(_,i)=>Math.round(clip.Interval[0]+(clip.Interval[1]-clip.Interval[0])*i/8))])]){
  const matrices=sampleNodeMatrices(model,frame,sequence,frame),actual=new Vector3().fromArray(emitter.PivotPoint).applyMatrix4(matrices.get(emitter.ObjectId)),expected=new Vector3();
  vertices.forEach((v,i)=>expected.addScaledVector(new Vector3().fromArray(geo.Vertices,v*3).applyMatrix4(geosetSkinMatrix(geo,v,matrices)),barycentric[i]));
  assert.ok(actual.distanceTo(expected)<.04,clip.Name+' '+frame+': attached point error '+actual.distanceTo(expected));
 }
});

test('whole-layer conflicts ask only for overlapping individual values and resolve both choices',()=>{
 const previous={type:'Particles',tint:[1,1,1],size:2,offset:[0,0,0],individuals:{source0:{position:[9,8,7],surface:{geoset:2},values:{tint:[1,0,0],native:{Width:4}}},source1:{deleted:true}}};
 const changed={...previous,tint:[0,1,0]};
 assert.equal(placement.emitterEditOverlaps(previous,{...previous,lasts:2}),false,'unrelated life edit asks nothing');
 assert.equal(placement.emitterEditOverlaps(previous,changed),true,'own colour overlaps');
 assert.equal(placement.emitterEditOverlaps(previous,{...previous,offset:[1,0,0]}),true,'hand placement overlaps layer movement');
 assert.deepEqual(placement.resolveEmitterEdit(previous,changed,false).individuals,previous.individuals,'Keep leaves individual records exact');
 const all=placement.resolveEmitterEdit(previous,changed,true);assert.deepEqual(all.individuals.source0,{values:{native:{Width:4}}},'Apply all resets colour and hand placement while preserving unrelated Width');assert.deepEqual(all.individuals.source1,{deleted:true});
});
for(const [from,to] of [['Blade flames','Fire column'],['Fire column','Blade flames']])test('Change emitter preserves automatic, hand-placed and deleted sites: '+from+' to '+to,{skip:!fs.existsSync(file)&&'private Footman missing'},()=>{
 const base=openDocument(fs.readFileSync(file),'footman.mdx').model,frame=partFrame(base.Geosets[0]),stack=newStack(findLook('empty'),frame,'replace');
 const layer=makeLayer(layerIngredient(findLook('empty'),{type:'Particles',label:from}),frame,'native',1);stack.layers=[layer];
 const first=structuredClone(base),initial=compileAnimation(first,0,stack),keys=initial.layers[1].sites.map(s=>s.key);
 layer.placement={upper:layer.upper,lower:layer.lower};layer.formation=.4;layer.offset=[4,5,6];layer.individuals={[keys[0]]:{position:[18,25,92]},[keys[1]]:{deleted:true}};
 const before=structuredClone(base),graph={model:before,...compileAnimation(before,0,stack)},next=makeLayer(layerIngredient(findLook('empty'),{type:'Particles',label:to}),frame,'native',2);
 stack.layers=[placement.replaceEmitter(layer,next,graph)];const after=structuredClone(base);compileAnimation(after,0,stack);
 const sites=m=>Object.fromEntries(m.ParticleEmitters2.filter(n=>n._FxTag?.startsWith('replace/')).map(n=>[n._FxTag.split('/').at(-1),Array.from(n.PivotPoint)]));
 assert.deepEqual(sites(after),sites(before),'every surviving place is exact');assert.deepEqual(after.Geosets[0]._FxStack.layers[0].individuals,layer.individuals,'hand place and deletion remain keyed by original sites');
});

test('an individual quick Life edit replaces its earlier native LifeSpan override',{skip:!fs.existsSync(file)&&'private Footman missing'},()=>{
 const model=openDocument(fs.readFileSync(file),'footman.mdx').model,frame=partFrame(model.Geosets[0]),layer=makeLayer(layerIngredient(findLook('empty'),{type:'Particles',label:'Blade flames'}),frame,'native',1),stack={...newStack(findLook('empty'),frame,'quick-life'),layers:[layer]},graph=compileAnimation(model,0,stack),key=graph.layers[1].sites[0].key;
 layer.individuals={[key]:{values:{native:{LifeSpan:.7}}}};const current=placement.individualEmitterLayer(layer,key),changed=placement.withIndividualEmitter(layer,key,current,{...current,lasts:.3});
 compileAnimation(model,0,{...stack,layers:[changed]});assert.equal(model.ParticleEmitters2.find(n=>n._FxTag==='quick-life/1/'+key).LifeSpan,.3,'quick Life takes effect after native editing');
});

for(const label of ['Blade flames','Fire column'])test(label+' blended-skin drag commits at the live handle position',{skip:!fs.existsSync(file)&&'private Footman missing'},()=>{
 const base=openDocument(fs.readFileSync(file),'footman.mdx').model,frame=partFrame(base.Geosets[0]),layer=makeLayer(layerIngredient(findLook('empty'),{type:'Particles',label}),frame,'native',1),stack={...newStack(findLook('empty'),frame,'precision'),layers:[layer]},before=structuredClone(base);
 let graph=compileAnimation(before,0,stack),node=graph.layers[1].ids.map(id=>before.Nodes[id]).find(n=>before.Nodes[n.Parent]?._FxTag?.includes('/binding-'));
 if(!node){
  // Shared native sites use single bones on this fixture; snap one onto real blended skin first.
  const probeSequence=base.Sequences.findIndex(s=>s.Name.startsWith('Attack')),probeClip=base.Sequences[probeSequence],probeTime=(probeClip.Interval[0]+probeClip.Interval[1])/2,probeMatrices=sampleNodeMatrices(base,probeTime,probeSequence,probeTime),probeDelta=new Vector3(15,-9,12),direction=matrix=>probeDelta.clone().applyMatrix4(matrix).sub(new Vector3().applyMatrix4(matrix));
  const geo=base.Geosets[0],face=Array.from(geo.Faces).findIndex((v,i)=>{const weights=vertexBoneWeights(geo,v);return i%3===0&&weights.length>1&&direction(geosetSkinMatrix(geo,v,probeMatrices)).distanceTo(direction(probeMatrices.get(weights.slice().sort((a,b)=>b[1]-a[1])[0][0])))>1;});
  assert.ok(face>=0,'fixture has skin rotations that differ from the dominant bone');
  const vertex=geo.Faces[face],vertices=Array.from(geo.Faces.slice(face,face+3)),barycentric=vertices.map(v=>v===vertex?1:0),position=Array.from(geo.Vertices.slice(vertex*3,vertex*3+3)),key=before.Nodes[graph.layers[1].ids[0]]._FxTag.split('/').at(-1);
  layer.individuals={[key]:{position,surface:{geoset:0,vertices,barycentric}}};graph=compileAnimation(before,0,stack);node=before.ParticleEmitters2.find(n=>n._FxTag==='precision/1/'+key);
 }
 assert.ok(before.Nodes[node.Parent]?._FxTag?.includes('/binding-'),'real fixture has a blended attachment');const key=node._FxTag.split('/').at(-1),delta=new Vector3(15,-9,12),point=new Vector3().fromArray(node.PivotPoint),sequence=before.Sequences.findIndex(s=>s.Name.startsWith('Attack')),clip=before.Sequences[sequence],time=(clip.Interval[0]+clip.Interval[1])/2,old=sampleNodeMatrices(before,time,sequence,time);
 const expected=point.clone().applyMatrix4(old.get(node.ObjectId)).add(delta.clone().applyMatrix4(old.get(node.Parent)).sub(new Vector3().applyMatrix4(old.get(node.Parent))));
 const changed=placement.withEmitterPosition(layer,key,point.clone().add(delta).toArray(),point.toArray()),after=structuredClone(base);compileAnimation(after,0,{...stack,layers:[changed]});const emitter=after.ParticleEmitters2.find(n=>n._FxTag===node._FxTag),matrices=sampleNodeMatrices(after,time,sequence,time),actual=new Vector3().fromArray(emitter.PivotPoint).applyMatrix4(matrices.get(emitter.ObjectId));
 assert.ok(actual.distanceTo(expected)<.001,'release must keep the live handle position: '+actual.distanceTo(expected));
});
