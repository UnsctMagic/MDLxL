import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {openDocument} from '../src/editor-document.js';
import {findLook,newStack,partFrame,shellReach} from '../src/global-animation-looks.js';
import {compileAnimation} from '../src/global-animation-model.js';

// Owner, 12 November: "Glow shell - add thickness". The shell layer shows Thickness in its main
// controls; its range follows the part, and minimum, middle and maximum stand visibly apart.
const load=async file=>{
 const bundled=await build({entryPoints:[new URL(file,import.meta.url).pathname.replace(/^\/(\w:)/,'$1')],bundle:true,write:false,format:'cjs',platform:'node',packages:'external',loader:{'.css':'empty'},logLevel:'silent'});
 const component={exports:{}};new Function('require','module','exports',bundled.outputFiles[0].text)(createRequire(import.meta.url),component,component.exports);return component.exports.default;
};
const Controls=await load('../app/GlobalAnimationControls.jsx');
const knight=()=>openDocument(fs.readFileSync(new URL('./fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx',import.meta.url)),'knight.mdx');
const ColourControl=()=>null;
function controls(model,part,stack,selected){
 const graph={model:structuredClone(model)};Object.assign(graph,compileAnimation(graph.model,part,stack));
 return renderToStaticMarkup(React.createElement(Controls,{stack,setStack(){},selected,select(){},graph,ColourControl,setTrial(){},setPlacing(){},previewStrength(){},previewLayout(){},pickTexture(){},openEmitter(){},onSequence(){}}));
}
/** Mean distance of the compiled shell from the part's own vertices. */
function lift(model,part,stack){
 const m=structuredClone(model),g=m.Geosets[part];compileAnimation(m,part,stack);
 const shell=m.Geosets.find(s=>s._FxTag===stack.owner+'/'+stack.layers[0].id+'/shape');
 let sum=0;for(let i=0;i<g.Vertices.length;i+=3)sum+=Math.hypot(shell.Vertices[i]-g.Vertices[i],shell.Vertices[i+1]-g.Vertices[i+1],shell.Vertices[i+2]-g.Vertices[i+2]);
 return sum/(g.Vertices.length/3);
}
for(const part of [0,2])test('Glow shell shows Thickness in its main controls with a range sized from the part, part '+part,()=>{
 const model=knight().model,frame=partFrame(model.Geosets[part]),stack=newStack(findLook('fx-glow-shell'),frame,'shell');
 const shellLayer=stack.layers.find(l=>l.label==='Glow shell'),html=controls(model,part,stack,shellLayer.id);
 const main=html.split('<details')[0],input=main.match(/<input[^>]*aria-label="Thickness"[^>]*>/)?.[0];
 assert.ok(input,'Thickness is in the main controls, not under More');
 const max=Number(input.match(/max="([^"]+)"/)[1]);
 assert.equal(max,shellReach(frame,shellLayer.inflate));
 assert.ok(max>=frame.length*.1-1e-9,'the range grows with the part: '+max.toFixed(2)+' on a part '+frame.length.toFixed(1)+' long');
 // Minimum, middle and maximum: the shell stands visibly further out at each step.
 const at=value=>lift(model,part,{...stack,layers:[{...shellLayer,inflate:value}]});
 const [low,mid,high]=[0,max/2,max].map(at);
 assert.ok(low<1e-6,'minimum sits on the surface');
 assert.ok(mid>frame.length*.04&&high>frame.length*.08&&high>mid*1.8,'middle '+mid.toFixed(2)+' and maximum '+high.toFixed(2)+' stand apart');
 // Another surface layer of the look keeps its Lift under More only.
 const inner={...stack,layers:[...stack.layers,{...stack.layers.find(l=>l.label==='Glow shell'),id:9,label:'Inner glow',shell:undefined}]};
 assert.equal(controls(model,part,inner,9).split('<details')[0].includes('aria-label="Thickness"'),false,'Inner glow has no Thickness');
});
