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
