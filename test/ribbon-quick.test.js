import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemoDocument,openDocument} from '../src/editor-document.js';
import {ribbonPlacement,addRibbon,ribbonQuickValues,setRibbonQuick,applyRibbonEdit,ribbonEditFrame,ribbonFrameValues,RIBBON_ADD_SECTIONS} from '../src/ribbon-quick.js';
import {RIBBON_TEXTURE} from '../src/particle-starters.js';

const quickRibbon=(sequence=0)=>{
 const doc=createDemoDocument(),geo=doc.model.Geosets[0],selection={0:Array.from(new Set(geo.Faces.slice(0,12)))};
 const placement=ribbonPlacement(doc.model,selection,sequence);let added;
 doc.apply('Add ribbon',RIBBON_ADD_SECTIONS,m=>{added=addRibbon(m,placement.ribbon.recipe,placement);});
 return {doc,placement,id:added.id,node:()=>doc.model.RibbonEmitters.find(n=>n.ObjectId===added.id)};
};

test('a quick ribbon is added in one step, visible only in the chosen animation',()=>{
 const {doc,placement,node}=quickRibbon(0),ribbon=node();
 assert.equal(doc.historyStats.undoSteps,1);
 assert.equal(doc.model.Textures[doc.model.Materials[ribbon.MaterialID].Layers[0].TextureID].Image,RIBBON_TEXTURE);
 for(let i=0;i<doc.model.Sequences.length;i++)for(const frame of doc.model.Sequences[i].Interval)assert.equal(ribbon.Visibility.Keys.find(k=>k.Frame===frame).Vector[0],i===placement.sequence?1:0);
 assert.ok(ribbonQuickValues(ribbon).size>0);
});

test('a quick ribbon falls back to the first animation when none is chosen',()=>{
 assert.equal(quickRibbon(-1).placement.sequence,0);
});

test('Ribbon box values edit the ribbon and keep its split along the weapon',()=>{
 const {doc,id,node}=quickRibbon();
 const before=ribbonQuickValues(node());
 doc.apply('Change ribbon',['Nodes'],m=>{setRibbonQuick(m,id,{color:[1,0,0],intensity:.5,lasts:.8,size:before.size*2});});
 const after=ribbonQuickValues(node());
 assert.deepEqual(after.color,[1,0,0]);assert.equal(after.intensity,.5);assert.equal(after.lasts,.8);
 assert.ok(Math.abs(after.size-before.size*2)<1e-4);assert.ok(Math.abs(after.above/after.size-before.above/before.size)<1e-6);
 doc.apply('Stretch',['Nodes'],m=>{setRibbonQuick(m,id,{above:after.above+5});});
 assert.ok(Math.abs(ribbonQuickValues(node()).above-(after.above+5))<1e-4);assert.equal(ribbonQuickValues(node()).below,after.below);
});

test('animated ribbon values keep their shape when edited as a whole',()=>{
 const {doc,id,node}=quickRibbon();
 doc.apply('Key alpha',['Nodes'],m=>{m.RibbonEmitters.find(n=>n.ObjectId===id).Alpha={LineType:0,GlobalSeqId:null,Keys:[{Frame:0,Vector:new Float32Array([1])},{Frame:100,Vector:new Float32Array([.5])}]};});
 doc.apply('Dim',['Nodes'],m=>{setRibbonQuick(m,id,{intensity:.5});});
 assert.deepEqual(node().Alpha.Keys.map(k=>k.Vector[0]),[.5,.25]);
 assert.throws(()=>setRibbonQuick(structuredClone(doc.model),id,{lasts:Number.NaN}),/number/);
});

test('size keys let the ribbon grow and shrink during the animation',()=>{
 const {doc,id,node}=quickRibbon(0),[start,end]=Array.from(doc.model.Sequences[0].Interval),middle=Math.round((start+end)/2);
 const at=time=>ribbonEditFrame(doc.model,{time,sequenceIndex:0}),before=ribbonQuickValues(node());
 doc.apply('Key size',['Nodes'],m=>{applyRibbonEdit(m,id,{sizeKey:true},at(start));});
 assert.ok(node().HeightAbove.Keys&&node().HeightBelow.Keys);assert.equal(node().HeightAbove.LineType,1,'Size grows smoothly between keys');
 doc.apply('Bigger later',['Nodes'],m=>{applyRibbonEdit(m,id,{size:before.size*2},at(middle));});
 const early=ribbonFrameValues(doc.model,id,at(start)),late=ribbonFrameValues(doc.model,id,at(middle));
 assert.ok(Math.abs(early.size-before.size)<1e-3,'The first key keeps the original size');assert.ok(Math.abs(late.size-before.size*2)<1e-3,'The later key is twice as big');
 assert.ok(Math.abs(late.above/late.size-before.above/before.size)<1e-6,'The split along the weapon is kept');
 doc.apply('Stretch at key',['Nodes'],m=>{applyRibbonEdit(m,id,{above:late.above+3},at(middle));});
 assert.ok(Math.abs(ribbonFrameValues(doc.model,id,at(middle)).above-(late.above+3))<1e-3);assert.ok(Math.abs(ribbonFrameValues(doc.model,id,at(start)).size-before.size)<1e-3);
 assert.throws(()=>applyRibbonEdit(structuredClone(doc.model),id,{size:10},ribbonEditFrame(doc.model,{time:start,restPose:true})),/animation/);
});

test('moving a ribbon shifts its pivot for every animation',()=>{
 const {doc,id,node}=quickRibbon(),pivot=Array.from(node().PivotPoint);
 doc.apply('Move ribbon',['Nodes','PivotPoints'],m=>{applyRibbonEdit(m,id,{move:[1,-2,3]},ribbonEditFrame(m,{}));});
 assert.deepEqual(Array.from(node().PivotPoint),pivot.map((v,i)=>Math.fround(v+[1,-2,3][i])));
 assert.deepEqual(Array.from(doc.model.PivotPoints[id]),Array.from(node().PivotPoint));
});

test('ribbon size keys survive saving as MDX and MDL',()=>{
 const {doc,id}=quickRibbon(0),[start,end]=Array.from(doc.model.Sequences[0].Interval),at=time=>ribbonEditFrame(doc.model,{time,sequenceIndex:0});
 doc.apply('Key size',['Nodes'],m=>{applyRibbonEdit(m,id,{size:20},at(start));applyRibbonEdit(m,id,{size:60},at(end));});
 for(const format of ['mdx','mdl']){
  const reopened=openDocument(doc.serialize(format),'ribbon.'+format).model,ribbon=reopened.RibbonEmitters.find(n=>n.Name==='Weapon ribbon');
  assert.ok(Math.abs(ribbonFrameValues(reopened,ribbon.ObjectId,ribbonEditFrame(reopened,{time:end,sequenceIndex:0})).size-60)<1e-3,format);
 }
});
