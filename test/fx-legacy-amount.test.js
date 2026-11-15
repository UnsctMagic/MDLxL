import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {openDocument} from '../src/editor-document.js';
import {readAnimationStack,compileAnimation} from '../src/global-animation-model.js';
import {individualEmitterLayer,withIndividualEmitter} from '../src/fx-emitter-placement.js';
import {beginParticleParameter,layerRateShare,layerRateTarget} from '../src/particle-bindings.js';
const {testModel}=createRequire(import.meta.url)('./helpers/fixtures.cjs');
// The pre-#645 save that test/fx-empty-emitters.electron.cjs re-edits; its Blade flames pulse (EmissionRate tracks).
const file=testModel('fx-legacy','legacy-flaming-sword.mdx');
const plain=value=>JSON.parse(JSON.stringify(value,(_,v)=>ArrayBuffer.isView(v)?Array.from(v):v));

test('typing an Amount on a legacy pulsing layer gives that Amount at every frame',{skip:!fs.existsSync(file)&&'legacy flaming-sword fixture missing'},()=>{
 const model=openDocument(fs.readFileSync(file),'legacy-flaming-sword.mdx').model,part=28;
 const stack=readAnimationStack(model,part),layer=stack.layers.find(l=>l.label==='Blade flames');
 const compile=draft=>{const copy=structuredClone(model);return {model:copy,...compileAnimation(copy,part,draft)};};
 const graph=compile(stack),result=graph.layers[layer.id];
 const at=(g,time)=>({frame:time,globalTime:time,interval:g.model.Sequences[0]?.Interval,globalSequences:g.model.GlobalSequences});
 const amount=(g,ids,time)=>ids.reduce((sum,id)=>sum+layerRateShare(g.model.Nodes[id],at(g,time)),0);
 assert.ok(result.ids.some(id=>graph.model.Nodes[id].EmissionRate?.Keys),'the legacy layer pulses');
 // The Amount field's begin/finish (GlobalAnimationControls nativeBegin/nativeFinish), at the frame the user pressed Enter.
 const options={...at(graph,300),scope:'track'},value=117;
 const parameters=result.ids.map(id=>graph.model.Nodes[id]).map(emitter=>({emitter,parameter:beginParticleParameter(emitter,'EmissionRate',options),share:layerRateShare(emitter,options)}));
 const total=parameters.reduce((sum,p)=>sum+p.share,0);
 let next=layer;
 for(const {emitter,parameter,share} of parameters){
  const rate=Math.max(0,layerRateTarget(parameter,share,total,parameters.length,value));
  const key=emitter._FxTag.slice(emitter._FxTag.lastIndexOf('/')+1),own=individualEmitterLayer(next,key);
  next=withIndividualEmitter(next,key,own,{...own,native:{...own.native,EmissionRate:plain(parameter.change(rate))}});
  next.individuals[key].groupFields=[...new Set([...(next.individuals[key].groupFields||[]),'EmissionRate'])];
 }
 next.amount=layer.amount*value/total;next.groupRateCount=parameters.length;
 const edited=compile({...stack,layers:stack.layers.map(l=>l.id===next.id?next:l)}),ids=edited.layers[layer.id].ids;
 assert.equal(ids.length,result.ids.length);
 // The field is read again on whatever frame the preview has reached by then.
 for(const time of [0,300,700,1234,1700])assert.ok(Math.abs(amount(edited,ids,time)-value)<.01,'Amount shows '+value+' at frame '+time+': '+amount(edited,ids,time));
 // The pulse itself is kept: the emitters still breathe around that Amount.
 assert.ok(ids.every(id=>edited.model.Nodes[id].EmissionRate?.Keys),'the edited layer keeps its pulse tracks');
});
