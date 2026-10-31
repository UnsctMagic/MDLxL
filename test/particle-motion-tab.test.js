import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createNode} from '../src/editor-document.js';
import {createStarterDocument} from '../src/starter-model.js';
const bundled=await build({entryPoints:[new URL('../app/ParticleCluelessControls.jsx',import.meta.url).pathname.replace(/^\/(\w:)/,'$1')],bundle:true,write:false,format:'cjs',platform:'node',packages:'external',loader:{'.css':'empty'},logLevel:'silent'});
const component={exports:{}};new Function('require','module','exports',bundled.outputFiles[0].text)(createRequire(import.meta.url),component,component.exports);const Controls=component.exports.default;
const noop=()=>{};
function motion(model,emitter){return renderToStaticMarkup(React.createElement(Controls,{model,emitter,frame:0,globalTime:0,sequence:0,tool:'Motion',update:noop,patch:noop,begin:noop,change:noop,finish:noop,cancel:noop}));}
function starterEmitter(){const doc=createStarterDocument();let emitter;doc.apply('Add emitter',['Nodes','PivotPoints'],model=>{emitter=createNode(model,'ParticleEmitter2');});return {model:doc.model,emitter:doc.model.ParticleEmitters2.find(e=>e.ObjectId===emitter.ObjectId)};}

test('Motion tab draws for a new emitter on a model without animations',()=>{
 const {model,emitter}=starterEmitter();
 assert.equal(model.Sequences.length,0);
 const html=motion(model,emitter);
 for(const label of ['Continuous','Burst','Aim X','Aim Y','Aim Z'])assert.match(html,new RegExp(label));
});

test('Burst mode without animations keeps the tab and disables only burst placement',()=>{
 const {model,emitter}=starterEmitter();
 const html=motion(model,{...emitter,Squirt:true,EmissionRate:{LineType:0,GlobalSeqId:null,Keys:[{Frame:10,Vector:new Float32Array([5])}]}});
 assert.match(html,/<button disabled="" title="Add an animation first[^"]*">Place burst at playhead<\/button>/);
 assert.doesNotMatch(html,/Impact moment/);
});

test('Burst placement stays available when the model has an animation',()=>{
 const {model,emitter}=starterEmitter();
 const html=motion({...model,Sequences:[{Name:'Stand',Interval:new Uint32Array([0,1000])}]},{...emitter,Squirt:true});
 assert.match(html,/<button title="Replace amount keys[^"]*">Place burst at playhead<\/button>/);
});
