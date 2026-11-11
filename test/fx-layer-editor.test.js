import test from 'node:test';
import assert from 'node:assert/strict';
import * as looks from '../src/global-animation-looks.js';
import {createDemoDocument,openDocument} from '../src/editor-document.js';
import {compileAnimation,readAnimationStack,FX_SECTIONS} from '../src/global-animation-model.js';
import {fxData} from '../src/global-animation-data.js';

const {findLook,makeLayer,newStack,partFrame}=looks;
function setup(lookId,label){
 const doc=createDemoDocument(),frame=partFrame(doc.model.Geosets[0]),look=findLook(lookId);
 const spec=(look.variations?look.variations.flatMap(v=>v.layers):look.layers).find(s=>!label||s.label===label);
 const stack={...newStack(look,frame,'edit'),layers:[makeLayer(spec,frame,look.palette,1)]};
 return {doc,model:doc.model,frame,stack,layer:stack.layers[0]};
}
function compile(model,stack){
 const graph=compileAnimation(model,0,stack),shape=model.Geosets[graph.layers[stack.layers[0].id].geoset];
 return {graph,shape,material:model.Materials[shape.MaterialID],anim:model.GeosetAnims.find(a=>a.GeosetId===model.Geosets.indexOf(shape))};
}
const withLayer=(stack,patch)=>({...stack,layers:[{...stack.layers[0],...patch}]});

test('Blend sets the FilterMode of a surface layer, and new additive layers are unshaded and unfogged',()=>{
 const {model,stack}=setup('crystal-veins','Crystal veins');
 let {material}=compile(model,stack);
 assert.equal(material.Layers[0].FilterMode,3);
 assert.equal(material.Layers[0].Shading,1|16|32,'an additive body layer is unshaded, two-sided and unfogged');
 ({material}=compile(model,{...stack,layers:[looks.withBlend(stack.layers[0],2)]}));
 assert.equal(material.Layers[0].FilterMode,2);
 assert.equal(material.Layers[0].Shading,16,'See-through drops the additive lighting it followed');
 ({material}=compile(model,{...stack,layers:[looks.withBlend(stack.layers[0],5)]}));
 assert.equal(material.Layers[0].FilterMode,5);
 ({material}=compile(model,withLayer(stack,{unshaded:false})));
 assert.equal(material.Layers[0].Shading&1,0,'Lit by map light clears Unshaded');
 const user=looks.withBlend({...stack.layers[0],unshaded:false},4);
 assert.equal(user.unshaded,false,'a lighting choice the user made survives a Blend change');
});
test('Blend and lighting also reach a native surface card',()=>{
 const {model,stack}=setup('poison-skin','Poison surface');
 const {material}=compile(model,withLayer(stack,{filter:4,unshaded:true,unfogged:true}));
 assert.ok(material.Layers.every(l=>l.FilterMode===4&&(l.Shading&33)===33));
});
test('a layer Loop length runs that layer on its own owned clock, shared by equal lengths and removed with the stack',()=>{
 const {model,stack,frame}=setup('arcane-blade','Flowing energy'),before=[...model.GlobalSequences];
 const second={...makeLayer(findLook('arcane-blade').layers[1],frame,'lilac',2),loop:1133};
 const timed={...stack,layers:[{...stack.layers[0],loop:1133},second,{...makeLayer(findLook('arcane-blade').layers[1],frame,'lilac',3)}]};
 const graph=compileAnimation(model,0,timed),track=id=>{const m=model.Materials[model.Geosets[graph.layers[id].geoset].MaterialID].Layers[0];return {motion:model.TextureAnims[m.TVertexAnimId].Translation.GlobalSeqId,alpha:m.Alpha.GlobalSeqId};};
 const own=track(1),shared=track(2),plain=track(3);
 assert.equal(model.GlobalSequences[own.motion],1133);assert.equal(model.GlobalSequences[own.alpha],1133);
 assert.equal(shared.motion,own.motion,'equal lengths reuse one clock');
 assert.equal(model.GlobalSequences[plain.motion],timed.loop,'a layer without its own length keeps the look clock');
 assert.ok(model.Geosets[0]._FxStack.createdClockIds.includes(own.motion),'the clock is owned by the stack');
 compileAnimation(model,0,{...timed,layers:[]});
 assert.deepEqual(model.GlobalSequences,before,'removing the layers removes their clocks');
});
