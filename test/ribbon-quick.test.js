import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemoDocument} from '../src/editor-document.js';
import {ribbonQuickValues,setRibbonQuick} from '../src/ribbon-quick.js';
import {fitRibbonToPolygons} from '../src/particle-ribbon-fit.js';
import {placeTimedParticleRecipe} from '../src/particle-placement.js';
const SECTIONS=['Nodes','Textures','Materials','TextureAnims','GlobalSequences','PivotPoints'];
const addTestRibbon=(doc,selection,sequence)=>{const ribbon=fitRibbonToPolygons(doc.model,selection),placement={ribbon,position:[0,0,0],motion:'target',fit:true,sequence,sequences:[sequence],parent:ribbon.parent==null?'':String(ribbon.parent)};let added;doc.apply('Add ribbon',SECTIONS,m=>{added=placeTimedParticleRecipe(m,ribbon.recipe,placement,{convertHD:true});});return {placement,id:added.ids[0]};};
import {RIBBON_TEXTURE} from '../src/particle-starters.js';

const quickRibbon=(sequence=0)=>{
 const doc=createDemoDocument(),geo=doc.model.Geosets[0],selection={0:Array.from(new Set(geo.Faces.slice(0,12)))};
 const {placement,id}=addTestRibbon(doc,selection,sequence),added={id};
 return {doc,placement,id:added.id,node:()=>doc.model.RibbonEmitters.find(n=>n.ObjectId===added.id)};
};

test('a quick ribbon is added in one step, visible only in the chosen animation',()=>{
 const {doc,placement,node}=quickRibbon(0),ribbon=node();
 assert.equal(doc.historyStats.undoSteps,1);
 assert.equal(doc.model.Textures[doc.model.Materials[ribbon.MaterialID].Layers[0].TextureID].Image,RIBBON_TEXTURE);
 for(let i=0;i<doc.model.Sequences.length;i++)for(const frame of doc.model.Sequences[i].Interval)assert.equal(ribbon.Visibility.Keys.find(k=>k.Frame===frame).Vector[0],i===placement.sequence?1:0);
 assert.ok(ribbonQuickValues(ribbon).size>0);
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


test('moving a ribbon shifts its pivot for every animation',()=>{
 const {doc,id,node}=quickRibbon(),pivot=Array.from(node().PivotPoint);
 doc.apply('Move ribbon',['Nodes','PivotPoints'],m=>{setRibbonQuick(m,id,{move:[1,-2,3]});});
 assert.deepEqual(Array.from(node().PivotPoint),pivot.map((v,i)=>Math.fround(v+[1,-2,3][i])));
 assert.deepEqual(Array.from(doc.model.PivotPoints[id]),Array.from(node().PivotPoint));
});
