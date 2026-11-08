import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Quaternion} from 'three';
import {createDemoDocument,openDocument,createNode} from '../src/editor-document.js';
import {ribbonPolygonSelection,fitRibbonToPolygons,ribbonSwingWindow,NATIVE_RIBBON_COLOR} from '../src/particle-ribbon-fit.js';
import {RIBBON_TEXTURE} from '../src/particle-starters.js';
import {placeTimedParticleRecipe} from '../src/particle-placement.js';
import {sampleNodeMatrices,sampleTrack} from '../src/animation.js';
import {hasCanonicalSerializedNodeOrder,serializedNodes} from '../src/node-id-order.js';

function fixture(){
 const doc=createDemoDocument();doc.apply('Make test weapon',['Geosets','Nodes'],m=>{
  const g=m.Geosets[0];g.Vertices=new Float32Array([20,4,0,22,4,0,22,4,100,20,4,100,999,999,999]);g.Normals=new Float32Array(15);g.TVertices=[new Float32Array(10)];g.Faces=new Uint16Array([0,1,2,0,2,3]);g.VertexGroup=new Uint8Array(5);g.Groups=[[0]];
  m.Bones[0].Translation={LineType:1,GlobalSeqId:null,Keys:[{Frame:0,Vector:new Float32Array([0,0,0])},{Frame:2000,Vector:new Float32Array([17,-9,23])}]};
  m.Bones[0].Rotation={LineType:1,GlobalSeqId:null,Keys:[{Frame:0,Vector:new Float32Array([0,0,0,1])},{Frame:2000,Vector:new Float32Array(new Quaternion().setFromAxisAngle(new Vector3(1,1,0).normalize(),2).toArray())}]};
  m.Bones[0].Scaling={LineType:1,GlobalSeqId:null,Keys:[{Frame:0,Vector:new Float32Array([2,.5,1.5])}]};
 });return doc;
}
test('marked weapon-back polygons fit a native Y-axis ribbon and detect the shared bone',()=>{
 const doc=fixture(),before=structuredClone(doc.model),selection={0:[0,1,2,3,4]},fit=fitRibbonToPolygons(doc.model,selection);
 assert.equal(fit.polygons,2);assert.equal(fit.parent,0);assert.equal(fit.needsBone,false);assert.equal(fit.length,100);
 assert.deepEqual(fit.endpoints,[[21,4,0],[21,4,100]]);assert.deepEqual(doc.model,before,'Fitting is read-only');
 assert.throws(()=>fitRibbonToPolygons(doc.model,{0:[0,1]}),/select the polygons/);
 const g=doc.model.Geosets[0];g.Groups.push([1]);g.VertexGroup[0]=1;
 assert.equal(ribbonPolygonSelection(doc.model,selection).needsBone,true);
 assert.equal(ribbonPolygonSelection(doc.model,selection).parent,0,'Mixed polygons use their strongest shared influence without an attachment prompt');
});
test('fitted endpoints follow animated and nonuniform parent motion without changing the weapon',()=>{
 const doc=fixture(),before=structuredClone(doc.model),fit=fitRibbonToPolygons(doc.model,{0:[0,1,2,3]});let placed;
 doc.apply('Add weapon ribbon',['Nodes','PivotPoints','Materials','Textures','GlobalSequences'],m=>{placed=placeTimedParticleRecipe(m,fit.recipe,{sequence:0,from:0,to:2000,parent:'0',position:[0,0,0],motion:'target',fit:true});});
 const r=doc.model.Nodes[placed.ids[0]];
 for(const frame of [0,125,570,1190,1900]){
  const matrices=sampleNodeMatrices(doc.model,frame,0),ends=[-r.HeightBelow,r.HeightAbove].map(y=>new Vector3(...r.PivotPoint).add(new Vector3(0,y,0)).applyMatrix4(matrices.get(r.ObjectId)));
  for(let i=0;i<2;i++)assert.ok(ends[i].distanceTo(new Vector3(...fit.endpoints[i]).applyMatrix4(matrices.get(0)))<2e-5);
 }
 assert.deepEqual(doc.model.Geosets,before.Geosets);assert.deepEqual(doc.model.Bones,before.Bones);
 doc.undo();assert.deepEqual(doc.model,before);
});
test('fitted native ribbon placement round-trips MDL and MDX with chosen visibility',()=>{
 const doc=createDemoDocument(),selection={0:Array.from({length:doc.model.Geosets[0].Vertices.length/3},(_,i)=>i)},fit=fitRibbonToPolygons(doc.model,selection);
 doc.apply('Add ribbon',['Nodes','PivotPoints','Materials','Textures','GlobalSequences'],m=>placeTimedParticleRecipe(m,fit.recipe,{sequence:0,from:100,to:900,parent:String(fit.parent),position:[0,0,0],motion:'target',fit:true}));
 const r=doc.model.RibbonEmitters[0];for(const format of ['mdx','mdl']){const copy=openDocument(doc.serialize(format),'ribbon.'+format),next=copy.model.RibbonEmitters[0];assert.deepEqual(next.PivotPoint,r.PivotPoint);assert.deepEqual(next.Rotation,r.Rotation);assert.deepEqual(next.Visibility,r.Visibility);assert.equal(next.HeightAbove,Math.fround(r.HeightAbove));}
});
test('ribbon creation uses whole checked animations and preserves its fitted axis in every clip',()=>{
 const doc=fixture();doc.apply('Test animations',['Sequences'],m=>{m.Sequences=[0,1,2].map(i=>({ ...m.Sequences[0],Name:'Clip '+i,Interval:new Uint32Array([i*3000,i*3000+2000]) }));});
 const before=structuredClone(doc.model),fit=fitRibbonToPolygons(doc.model,{0:[0,1,2,3]});let placed;
 doc.apply('Add ribbon',['Nodes','PivotPoints','Materials','Textures','GlobalSequences'],m=>{placed=placeTimedParticleRecipe(m,fit.recipe,{ribbon:fit,sequences:[0,2],sequence:2,from:0,to:'',parent:String(fit.parent),position:[0,0,0],motion:'target',fit:true});});
 const ribbon=doc.model.Nodes[placed.ids[0]];
 for(let i=0;i<doc.model.Sequences.length;i++){
  const interval=doc.model.Sequences[i].Interval;
  for(const frame of [interval[0],interval[0]+500,interval[1]]){
   assert.equal(sampleTrack(ribbon.Visibility,frame,{interval,fallback:1}),i===1?0:1);
   assert.deepEqual(sampleTrack(ribbon.Rotation,frame,{interval,dimension:4,fallback:[0,0,0,1]}),Array.from(fit.recipe.native.RibbonEmitters[0].Rotation.Keys[0].Vector));
  }
 }
 assert.deepEqual(doc.model.Geosets,before.Geosets);assert.deepEqual(doc.model.Bones,before.Bones);assert.deepEqual(doc.model.Sequences,before.Sequences);
 for(const format of ['mdl','mdx']){const reopened=openDocument(doc.serialize(format),'ribbon.'+format).model.RibbonEmitters[0];assert.deepEqual(reopened.Visibility,ribbon.Visibility);assert.deepEqual(reopened.Rotation,ribbon.Rotation);}
 doc.undo();assert.deepEqual(doc.model,before);
});
test('ribbons require a checked animation but still support a static model',()=>{
 for(const animated of [true,false]){
  const doc=fixture();if(!animated)doc.model.Sequences=[];
  const fit=fitRibbonToPolygons(doc.model,{0:[0,1,2,3]});
  const placement={ribbon:fit,sequences:[],sequence:0,from:0,to:'',parent:'0',position:[0,0,0],motion:'target',fit:true};
  if(animated){assert.throws(()=>placeTimedParticleRecipe(doc.model,fit.recipe,placement),/Choose an animation/);continue;}
  const result=placeTimedParticleRecipe(doc.model,fit.recipe,placement);
  const r=doc.model.Nodes[result.ids[0]];
  assert.equal(r.Visibility,1);
 }
});

test('fitted ribbons attach directly and keep later event pivots and references aligned when saved',()=>{
 const doc=fixture();doc.apply('Event after the weapon',['Nodes','PivotPoints'],m=>{const e=createNode(m,'EventObject');e.Name='Sound event';e.Parent=0;e.PivotPoint=new Float32Array([8,9,10]);m.PivotPoints[e.ObjectId]=e.PivotPoint;});
 const before=structuredClone(doc.model),fit=fitRibbonToPolygons(doc.model,{0:[0,1,2,3]});let placed;
 doc.apply('Create fitted ribbon',['Nodes','PivotPoints','Materials','Textures','GlobalSequences'],m=>{placed=placeTimedParticleRecipe(m,fit.recipe,{ribbon:fit,sequences:[0],sequence:0,parent:'0',position:[0,0,0],motion:'target',fit:true});});
 const ribbon=doc.model.Nodes[placed.ids[0]],event=doc.model.EventObjects[0];
 assert.equal(ribbon.Parent,0);assert.equal(doc.model.Helpers.length,before.Helpers.length);assert.equal(doc.model.Materials[ribbon.MaterialID].Layers[0].Shading,17);
 assert.ok(hasCanonicalSerializedNodeOrder(doc.model));assert.equal(event.ObjectId,ribbon.ObjectId+1);assert.deepEqual(event.PivotPoint,before.EventObjects[0].PivotPoint);
 assert.deepEqual(doc.model.Geosets,before.Geosets);assert.deepEqual(doc.model.Bones,before.Bones);
 for(const format of ['mdx','mdl']){const reopened=openDocument(doc.serialize(format),'created.'+format).model;assert.ok(hasCanonicalSerializedNodeOrder(reopened));for(const node of serializedNodes(reopened))assert.deepEqual(node.PivotPoint,doc.model.PivotPoints[node.ObjectId]);assert.equal(reopened.RibbonEmitters[0].Parent,0);assert.equal(reopened.EventObjects[0].Parent,0);}
 doc.undo();assert.deepEqual(doc.model,before);
});

test('fitted weapon ribbons start with the native weapon-trail look',()=>{
 const {recipe}=fitRibbonToPolygons(fixture().model,{0:[0,1,2,3]}),ribbon=recipe.native.RibbonEmitters[0],layer=recipe.native.Materials[0].Layers[0];
 // Blademaster, Hellscream and their copies: RibbonBlur1, Additive, faint orange, short life.
 assert.equal(recipe.native.Textures[layer.TextureID].Image,RIBBON_TEXTURE);assert.equal(layer.FilterMode,3);
 assert.equal(ribbon.Alpha,.35);assert.deepEqual(Array.from(ribbon.Color),Array.from(new Float32Array(NATIVE_RIBBON_COLOR)));assert.equal(ribbon.LifeSpan,.35);assert.equal(ribbon.EmissionRate,35);
});
test('weapon ribbons show only while the weapon swings',()=>{
 const doc=fixture();doc.apply('Wind-up, strike, recovery',['Sequences','Nodes'],m=>{
  m.Sequences=[{...m.Sequences[0],Name:'Attack',Interval:new Uint32Array([0,3000])},{...m.Sequences[0],Name:'Stand',Interval:new Uint32Array([4000,5000])}];
  const turn=angle=>new Float32Array(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),angle).toArray());
  delete m.Bones[0].Translation;delete m.Bones[0].Scaling;
  // A slow raise, a fast strike from 1000 to 1400, then a still follow-through; Stand never moves.
  m.Bones[0].Rotation={LineType:1,GlobalSeqId:null,Keys:[[0,0],[1000,-.3],[1400,2],[3000,2],[4000,0],[5000,0]].map(([Frame,angle])=>({Frame,Vector:turn(angle)}))};
 });
 const fit=fitRibbonToPolygons(doc.model,{0:[0,1,2,3]}),[on,off]=ribbonSwingWindow(doc.model,0,0,fit.endpoints);
 assert.ok(on>=900&&on<=1050,'Starts with the strike, not the wind-up: '+on);assert.ok(off>1400&&off<=1900,'Ends shortly after the strike: '+off);
 assert.deepEqual(ribbonSwingWindow(doc.model,1,0,fit.endpoints),[4000,5000],'A still weapon keeps the whole animation');
 const placed=placeTimedParticleRecipe(doc.model,fit.recipe,{ribbon:fit,sequences:[0,1],sequence:0,parent:'0',position:[0,0,0],motion:'target',fit:true});
 const ribbon=doc.model.Nodes[placed.ids[0]],seen=(frame,i)=>sampleTrack(ribbon.Visibility,frame,{interval:doc.model.Sequences[i].Interval,fallback:1});
 assert.equal(seen(500,0),0,'Hidden during the wind-up');assert.equal(seen(1200,0),1,'Shown during the strike');assert.equal(seen(2600,0),0,'Hidden during the recovery');
 assert.equal(seen(4000,1),1);assert.equal(seen(4900,1),1);
});
