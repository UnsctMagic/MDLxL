import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

// Owner, 12 November: a preview that could not be built ({error} without model or frame) turned the whole
// window into "The interface could not finish drawing". The FX stage must still draw; the message shows there.
const load=async file=>{
 const bundled=await build({entryPoints:[new URL(file,import.meta.url).pathname.replace(/^\/(\w:)/,'$1')],bundle:true,write:false,format:'cjs',platform:'node',packages:'external',loader:{'.css':'empty'},logLevel:'silent'});
 const component={exports:{}};new Function('require','module','exports',bundled.outputFiles[0].text)(createRequire(import.meta.url),component,component.exports);return component.exports.default;
};
const Stage=await load('../app/GlobalAnimationStage.jsx');
const Preview=()=>React.createElement('div',{className:'preview-stub'});

test('the FX stage draws when the preview could not be built, for every layer kind',()=>{
 const failed={error:'The resulting mesh bounds exceed the file format’s coordinate range.'};
 const layers=[{id:1,type:'Card',facing:'camera',offset:[0,0,0],size:10,upper:1,lower:1},{id:2,type:'Edge',orbit:true,offset:[0,0,0],size:4,upper:1,lower:1},{id:3,type:'Particles',offset:[0,0,0],size:4,upper:1,lower:1}];
 for(const layer of layers)for(const placing of [false,true]){
  const html=renderToStaticMarkup(React.createElement(Stage,{Preview,graph:failed,layer,placing,onLayer:()=>{}}));
  assert.match(html,/preview-stub/,layer.type+' layer, placing '+placing);
 }
});
