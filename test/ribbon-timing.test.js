import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemoDocument,openDocument} from '../src/editor-document.js';
import {fitRibbonToPolygons} from '../src/particle-ribbon-fit.js';
import {placeTimedParticleRecipe} from '../src/particle-placement.js';
const SECTIONS=['Nodes','Textures','Materials','TextureAnims','GlobalSequences','PivotPoints'];
const addTestRibbon=(doc,selection,sequence)=>{const ribbon=fitRibbonToPolygons(doc.model,selection),placement={ribbon,position:[0,0,0],motion:'target',fit:true,sequence,sequences:[sequence],parent:ribbon.parent==null?'':String(ribbon.parent)};let added;doc.apply('Add ribbon',SECTIONS,m=>{added=placeTimedParticleRecipe(m,ribbon.recipe,placement,{convertHD:true});});return {placement,id:added.ids[0]};};
import {ribbonSpans,setRibbonSpans,addSpan,normalizeSpans,ribbonSizeKeys,ribbonSizeAt,setRibbonSizeKey,removeRibbonSizeKey} from '../src/ribbon-timing.js';

const quickRibbon=(sequence=0)=>{
 const doc=createDemoDocument(),geo=doc.model.Geosets[0],selection={0:Array.from(new Set(geo.Faces.slice(0,12)))};
 const {placement,id}=addTestRibbon(doc,selection,sequence),added={id};
 return {doc,id:added.id,interval:Array.from(doc.model.Sequences[sequence].Interval)};
};

test('a new ribbon is one on/off part covering the whole animation',()=>{
 const {doc,id,interval}=quickRibbon(0);
 assert.deepEqual(ribbonSpans(doc.model,id,0).spans,[interval]);
 if(doc.model.Sequences.length>1)assert.deepEqual(ribbonSpans(doc.model,id,1).spans,[]);
});

test('moving diamonds and adding parts writes on/off keys for this animation only',()=>{
 const {doc,id,interval:[start,end]}=quickRibbon(0),other=doc.model.Sequences[1]&&ribbonSpans(doc.model,id,1).spans;
 const a=start+Math.round((end-start)*.2),b=start+Math.round((end-start)*.4);
 doc.apply('Set parts',['Nodes'],m=>{setRibbonSpans(m,id,0,[[a,b]]);});
 assert.deepEqual(ribbonSpans(doc.model,id,0).spans,[[a,b]]);
 const two=addSpan([[a,b]],start,end);assert.equal(two.length,2);
 doc.apply('Two parts',['Nodes'],m=>{setRibbonSpans(m,id,0,two);});
 assert.deepEqual(ribbonSpans(doc.model,id,0).spans,two,'show, disappear, show, disappear');
 if(other)assert.deepEqual(ribbonSpans(doc.model,id,1).spans,other,'Other animations are untouched');
 const ribbon=doc.model.RibbonEmitters.find(n=>n.ObjectId===id);
 assert.equal(ribbon.Visibility.LineType,0);assert.ok(ribbon.Visibility.Keys.every(k=>k.Vector[0]===0||k.Vector[0]===1));
 doc.apply('Hide',['Nodes'],m=>{setRibbonSpans(m,id,0,[]);});assert.deepEqual(ribbonSpans(doc.model,id,0).spans,[]);
 assert.deepEqual(addSpan([],start,end),[[start,end]],'Adding to a hidden ribbon shows it all animation');
});

test('touching parts merge and parts stay inside the animation',()=>{
 assert.deepEqual(normalizeSpans([[50,10],[40,60],[90,200]],0,100),[[10,60],[90,100]]);
});

test('a static visibility keeps every other animation as it was',()=>{
 const {doc,id}=quickRibbon(0);
 doc.apply('Static',['Nodes'],m=>{m.RibbonEmitters.find(n=>n.ObjectId===id).Visibility=1;});
 doc.apply('Parts',['Nodes'],m=>{const [s,e]=m.Sequences[0].Interval;setRibbonSpans(m,id,0,[[s,Math.round((s+e)/2)]]);});
 for(let i=1;i<doc.model.Sequences.length;i++)assert.deepEqual(ribbonSpans(doc.model,id,i).spans,[Array.from(doc.model.Sequences[i].Interval)]);
});

test('size keys grow the ribbon smoothly and can be removed again',()=>{
 const {doc,id,interval:[start,end]}=quickRibbon(0),middle=Math.round((start+end)/2),base=ribbonSizeAt(doc.model,id,start,0);
 doc.apply('Key',['Nodes'],m=>{setRibbonSizeKey(m,id,start,0,base);setRibbonSizeKey(m,id,end,0,{above:base.above*3,below:base.below*3});});
 assert.deepEqual(ribbonSizeKeys(doc.model,id,0),[start,end]);
 const half=ribbonSizeAt(doc.model,id,middle,0);assert.ok(Math.abs(half.above-base.above*2)<base.above*.02,'Halfway between keys is halfway in size');
 doc.apply('Remove',['Nodes'],m=>{removeRibbonSizeKey(m,id,end,0);});assert.deepEqual(ribbonSizeKeys(doc.model,id,0),[start]);
 doc.apply('Remove last',['Nodes'],m=>{removeRibbonSizeKey(m,id,start,0);});
 const ribbon=doc.model.RibbonEmitters.find(n=>n.ObjectId===id);assert.equal(typeof ribbon.HeightAbove,'number');assert.ok(Math.abs(ribbon.HeightAbove-base.above)<1e-4);
});

test('visibility parts and size keys survive SD MDX 800 and MDL saves',()=>{
 const {doc,id,interval:[start,end]}=quickRibbon(0),q=Math.round((end-start)/4);
 doc.apply('Timing',['Nodes'],m=>{setRibbonSpans(m,id,0,[[start+q,start+2*q],[start+3*q,end]]);const b=ribbonSizeAt(m,id,start,0);setRibbonSizeKey(m,id,start+q,0,b);setRibbonSizeKey(m,id,end,0,{above:b.above*2,below:b.below});});
 assert.equal(doc.model.Version??800,800);
 for(const format of ['mdx','mdl']){
  const reopened=openDocument(doc.serialize(format),'ribbon.'+format),model=reopened.model,ribbon=model.RibbonEmitters.find(n=>n.Name==='Weapon ribbon');
  assert.equal(reopened.readOnly,false,format);assert.deepEqual(reopened.diagnostics.filter(d=>d.severity==='error'),[],format);
  assert.deepEqual(ribbonSpans(model,ribbon.ObjectId,0).spans,ribbonSpans(doc.model,id,0).spans,format+' parts');
  assert.deepEqual(ribbonSizeKeys(model,ribbon.ObjectId,0),ribbonSizeKeys(doc.model,id,0),format+' size keys');
  assert.ok(Math.abs(ribbonSizeAt(model,ribbon.ObjectId,end,0).above-ribbonSizeAt(doc.model,id,end,0).above)<1e-3,format);
 }
});
