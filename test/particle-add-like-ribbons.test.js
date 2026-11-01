import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,PerspectiveCamera} from 'three';
import {createDemoDocument,createNode} from '../src/editor-document.js';
import {createStarterRecipe} from '../src/particle-starters.js';
import {initialParticlePlacement,placeTimedParticleRecipe} from '../src/particle-placement.js';
import {particleVertexSelection} from '../src/particle-selection.js';
import {ribbonPolygonSelection} from '../src/particle-ribbon-fit.js';
import {sampleNodeMatrices,sampleTrack} from '../src/animation.js';
import {NativeParticleSimulation,particleStageSnapshot} from '../app/particle-preview-adapter.js';
const v=(...values)=>new Float32Array(values);

test('vertex placement uses any marked vertices and the unchanged ribbon influence rule',()=>{
 const model=createDemoDocument().model,geo=model.Geosets[0],ids=[...new Set(Array.from(geo.Faces.slice(0,3)))],vertices=particleVertexSelection(model,{0:ids});
 assert.deepEqual(vertices.points,ribbonPolygonSelection(model,{0:ids}).points);
 assert.equal(vertices.parent,ribbonPolygonSelection(model,{0:ids}).parent);
 const one=initialParticlePlacement(model,{0:[ids[0]]},undefined,0);
 assert.deepEqual(one.position,Array.from(geo.Vertices.slice(ids[0]*3,ids[0]*3+3)));
 assert.equal(one.parent,String(vertices.parent));assert.deepEqual(one.sequences,[0]);
 assert.equal(Object.hasOwn(one,'from'),false);assert.equal(Object.hasOwn(one,'to'),false);
});

test('an empty vertex selection uses the selected node pivot, then the origin',()=>{
 const model=createDemoDocument().model,node=model.Bones[0];node.PivotPoint=v(4,8,12);
 const atNode=initialParticlePlacement(model,{},node.ObjectId,0);assert.equal(atNode.parent,String(node.ObjectId));assert.deepEqual(atNode.position,[4,8,12]);
 const atOrigin=initialParticlePlacement(model,{},undefined,-1);assert.equal(atOrigin.parent,'');assert.deepEqual(atOrigin.position,[0,0,0]);
});

test('whole-animation placement fits local timing to each checked clip and hides the others',()=>{
 const doc=createDemoDocument(),model=doc.model,recipe=createStarterRecipe(),source=structuredClone(recipe);
 model.Sequences=[['Stand',100,1100],['Attack',2000,4000],['Walk',5000,6000]].map(([Name,a,b])=>({Name,Interval:new Uint32Array([a,b])}));
 recipe.native.ParticleEmitters2[0].EmissionRate={LineType:1,GlobalSeqId:null,Keys:[{Frame:0,Vector:v(0)},{Frame:2500,Vector:v(40)},{Frame:5000,Vector:v(0)}]};
 const unchanged=structuredClone(model),input=structuredClone(recipe),placement={...initialParticlePlacement(model,{},undefined,0),sequences:[0,1]},result=placeTimedParticleRecipe(model,recipe,placement),emitter=model.Nodes[result.ids[0]];
 for(const [i,clip]of model.Sequences.entries()){
  const [a,b]=clip.Interval;for(const frame of [a,a+(b-a)/2,b])assert.equal(sampleTrack(emitter.Visibility,frame,{interval:clip.Interval}),i===2?0:1);
  if(i!==2)assert.equal(Number(sampleTrack(emitter.EmissionRate,(a+b)/2,{interval:clip.Interval})),40);
 }
 assert.deepEqual(recipe,input);assert.deepEqual(model.Bones,unchanged.Bones);assert.deepEqual(model.Geosets,unchanged.Geosets);assert.deepEqual(model.Sequences,unchanged.Sequences);assert.notDeepEqual(recipe,source);
});

test('the placed emitter, with source pivot and animation, starts at the selection under its target bone',()=>{
 const model=createDemoDocument().model,recipe=createStarterRecipe(),emitter=recipe.native.ParticleEmitters2[0],bone=model.Bones[0];
 emitter.PivotPoint=v(30,-40,50);recipe.native.PivotPoints[emitter.ObjectId]=emitter.PivotPoint;emitter.Translation={LineType:0,GlobalSeqId:null,Keys:[{Frame:0,Vector:v(7,8,9)}]};
 bone.Translation={LineType:0,GlobalSeqId:null,Keys:[{Frame:0,Vector:v(20,30,40)}]};bone.Scaling={LineType:0,GlobalSeqId:null,Keys:[{Frame:0,Vector:v(2,.5,1.5)}]};
 const position=[11,23,37],placement={...initialParticlePlacement(model,{},bone.ObjectId,0),position},result=placeTimedParticleRecipe(model,recipe,placement),node=model.Nodes[result.ids[0]],matrices=sampleNodeMatrices(model,model.Sequences[0].Interval[0],0);
 const actual=new Vector3().fromArray(node.PivotPoint).applyMatrix4(matrices.get(node.ObjectId)),want=new Vector3(...position).applyMatrix4(matrices.get(bone.ObjectId));assert.ok(actual.distanceTo(want)<1e-5);
 const sim=new NativeParticleSimulation(model,0);sim.advance(200);const camera=new PerspectiveCamera(45,1,.1,2000);camera.position.set(300,-400,250);camera.lookAt(0,0,30);camera.updateMatrixWorld();
 const snapshot=particleStageSnapshot(sim.native,camera,600,600,node.ObjectId,false,{anchorId:result.anchorId});
 assert.ok(Math.hypot(snapshot.anchor.point[0]-snapshot.guide.origin[0],snapshot.anchor.point[1]-snapshot.guide.origin[1])<1e-6,'Handle is on the emitter, not the helper');
});

test('effect placement and all imported resources undo and redo as one transaction',()=>{
 const doc=createDemoDocument(),before=Array.from(doc.serialize('mdx')),recipe=createStarterRecipe(),placement=initialParticlePlacement(doc.model,{},undefined,0);recipe.name='Golden fire · Flame Strike — target';
 doc.apply('Add effect',['Nodes','PivotPoints','Textures','Materials','TextureAnims','GlobalSequences'],model=>placeTimedParticleRecipe(model,recipe,placement));
 const added=Array.from(doc.serialize('mdx'));assert.equal(doc.historyStats.undoSteps,1);doc.undo();assert.deepEqual(Array.from(doc.serialize('mdx')),before);doc.redo();assert.deepEqual(Array.from(doc.serialize('mdx')),added);
});

test('visibility choices do not discard placement, including an empty list and a static model',()=>{
 for(const animated of [true,false]){
  const model=createDemoDocument().model;if(!animated)model.Sequences=[];
  const placement={...initialParticlePlacement(model,{},undefined,0),position:[13,17,23],sequences:[]},result=placeTimedParticleRecipe(model,createStarterRecipe(),placement),anchor=model.Nodes[result.anchorId];
  assert.ok(anchor.Translation.Keys.length);for(const key of anchor.Translation.Keys)assert.deepEqual(Array.from(key.Vector),placement.position);
  if(animated)assert.ok(model.Nodes[result.ids[0]].Visibility.Keys.every(key=>key.Vector[0]===0));
 }
});
