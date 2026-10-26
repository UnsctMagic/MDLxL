import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const bundled=await build({entryPoints:[new URL('../app/KeyframeTimeline.jsx',import.meta.url).pathname.replace(/^\/(\w:)/,'$1')],bundle:true,write:false,format:'cjs',platform:'node',packages:'external',loader:{'.css':'empty'},logLevel:'silent'});
const component={exports:{}};new Function('require','module','exports',bundled.outputFiles[0].text)(createRequire(import.meta.url),component,component.exports);const Timeline=component.exports.default;
const track=(frames,value)=>({LineType:0,GlobalSeqId:null,Keys:frames.map(Frame=>({Frame,Vector:new Float32Array(value)}))});
function fixture(){const bone={ObjectId:0,Name:'Bone',Rotation:track([120],[0,0,0,1])},emitter={ObjectId:1,Parent:0,Name:'Emitter',Visibility:track([100,250,600,1000],[1]),Translation:track([350],[0,0,0]),Rotation:track([450],[0,0,0,1]),Scaling:track([550],[1,1,1])},other={ObjectId:2,Name:'Other',Visibility:track([750],[1])};return{Sequences:[{Name:'Spell',Interval:[100,1000]}],GlobalSequences:[400],Nodes:[bone,emitter,other],Bones:[bone],ParticleEmitters2:[emitter,other],Geosets:[],GeosetAnims:[],Materials:[]};}
function frames(model,props={}){const html=renderToStaticMarkup(React.createElement(Timeline,{model,revision:0,sequenceIndex:0,selectedNodeIds:[1],activeController:'move',highlightKeyframes:true,...props}));return[...html.matchAll(/data-frame="(\d+)"/g)].map(match=>Number(match[1]));}
for(const [controller,own]of [['move',[350]],['rotate',[450]],['scale',[550]],['select',[350,450,550]]])for(const chain of [false,true])test('emitter visibility keys stay highlighted with '+controller+' and chain='+chain,()=>{const model=fixture(),before=structuredClone(model);assert.deepEqual(frames(model,{activeController:controller,highlightChain:chain}),[100,250,...own,600,1000].sort((a,b)=>a-b));assert.deepEqual(model,before);});
test('bone highlighting remains confined to its selected transform channel',()=>{const model=fixture();assert.deepEqual(frames(model,{selectedNodeIds:[0],activeController:'rotate'}),[120]);assert.deepEqual(frames(model,{selectedNodeIds:[0],activeController:'move',highlightChain:true}),[]);});
test('global visibility keys appear only on their own global clock',()=>{const model=fixture();model.ParticleEmitters2[0].Visibility={...track([0,200,400],[1]),GlobalSeqId:0};assert.deepEqual(frames(model),[350]);assert.deepEqual(frames(model,{globalSeqId:0,sequenceIndex:-1}),[0,200,400]);});
