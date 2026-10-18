import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemoDocument,createNode,openDocument} from '../src/editor-document.js';
import {emitterMdlText,parseEmitterMdlText,applyEmitterNode} from '../src/emitter-text.js';
import {mdlHoverPieces,explainMdlWord} from '../src/mdl-glossary.js';
import {emitterSpans,setEmitterSpans,addSpan} from '../src/emitter-timing.js';
import {createStarterRecipe} from '../src/particle-starters.js';
import {placeParticleRecipe} from '../src/particle-recipes.js';

const withParticles=()=>{
 const doc=createDemoDocument();let id;
 doc.apply('Add sparks',['Nodes','Textures','Materials','TextureAnims','GlobalSequences','PivotPoints'],m=>{id=placeParticleRecipe(m,createStarterRecipe('sparks'),{parent:null,position:[0,0,0]}).ids.find(i=>m.ParticleEmitters2.some(n=>n.ObjectId===i));});
 return {doc,id};
};

test('Adjust Manually shows and applies the exact MDL text of a particle emitter',()=>{
 const {doc,id}=withParticles(),{block,family}=emitterMdlText(doc,id);
 assert.equal(family,'ParticleEmitters2');assert.match(block,/^ParticleEmitter2 "[^"]+" \{/);
 const parsed=parseEmitterMdlText(doc,id,block.replace(/Speed [0-9.]+,/,'Speed 77,'));
 doc.apply('Manual',['Nodes'],m=>{applyEmitterNode(m,id,parsed);});
 assert.equal(doc.model.ParticleEmitters2.find(n=>n.ObjectId===id).Speed,77);
 assert.throws(()=>parseEmitterMdlText(doc,id,block.replace(/TextureID \d+/,'TextureID 99')),/texture|Texture/);
 assert.throws(()=>parseEmitterMdlText(doc,id,block+'\nRibbonEmitter "x" {}'),/exactly one/);
 for(const format of ['mdx','mdl'])assert.equal(openDocument(doc.serialize(format),'p.'+format).model.ParticleEmitters2.find(n=>n.ObjectId===id).Speed,77);
});

test('hover help explains the words of an emitter in plain language',()=>{
 const {doc,id}=withParticles(),{block,family}=emitterMdlText(doc,id),pieces=mdlHoverPieces(block,family);
 assert.equal(pieces.map(p=>p.text).join(''),block,'The hover layer matches the text exactly');
 const explained=new Set(pieces.filter(p=>p.tip).map(p=>p.text));
 for(const word of ['ParticleEmitter2','Speed','Latitude','LifeSpan','Gravity','SegmentColor','Alpha','ParticleScaling','TextureID'])assert.ok(explained.has(word),word);
 assert.notEqual(explainMdlWord('Alpha','RibbonEmitters'),explainMdlWord('Alpha','ParticleEmitters2'),'Same word, explained for the emitter type');
 const keyed=mdlHoverPieces('\tVisibility 2 {\n\t\tDontInterp,\n\t\t120: 1,\n\t}','ParticleEmitters2');
 assert.match(keyed.find(p=>p.text==='120:').tip,/frame 120/);assert.match(keyed.find(p=>p.text==='2').tip,/2 keys/);
});

test('particle emitters get the same on/off diamond pairs as ribbons',()=>{
 const {doc,id}=withParticles(),[start,end]=Array.from(doc.model.Sequences[0].Interval);
 assert.deepEqual(emitterSpans(doc.model,id,0).spans,[[start,end]],'Always on is one pair, start to finish');
 const two=addSpan([[start,Math.round((start+end)/2)]],start,end);
 doc.apply('Pairs',['Nodes'],m=>{setEmitterSpans(m,id,0,two);});
 assert.deepEqual(emitterSpans(doc.model,id,0).spans,two);
 const reopened=openDocument(doc.serialize('mdx'),'p.mdx').model;assert.deepEqual(emitterSpans(reopened,id,0).spans,two);
});
