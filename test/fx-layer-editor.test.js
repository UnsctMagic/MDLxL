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
const nativeData=model=>JSON.stringify(['Materials','TextureAnims','GlobalSequences','GeosetAnims','Textures'].map(k=>model[k]).concat([model.Geosets.map(g=>g.TVertices)]),(key,v)=>key==='_FxStack'?undefined:ArrayBuffer.isView(v)?Array.from(v):v);
test('Speed 0 holds a surface still; Speed reaches 8 whole passes; Moving starts a glow travelling',()=>{
 const {model,stack}=setup('arcane-blade','Flowing energy');
 let {material}=compile(model,withLayer(stack,{speed:0}));
 assert.equal(material.Layers[0].TVertexAnimId,null,'Speed 0 compiles without a texture animation');
 assert.equal(model.TextureAnims.filter(a=>a._FxTag?.startsWith('edit/')).length,0);
 ({material}=compile(model,withLayer(stack,{speed:8})));
 assert.equal(model.TextureAnims[material.Layers[0].TVertexAnimId].Translation.Keys.at(-1).Vector[0],8);
 assert.equal(readAnimationStack(model,0).layers[0].speed,8);
 const glow=setup('arcane-blade','Narrow highlight');
 ({material}=compile(glow.model,glow.stack));assert.equal(material.Layers[0].TVertexAnimId,null);
 assert.equal(looks.layerMoves(glow.layer),false);
 ({material}=compile(glow.model,withLayer(glow.stack,{fixed:false})));
 assert.ok(material.Layers[0].TVertexAnimId!=null,'Moving makes a glow travel');
 const water=setup('water-skin','Water surface');
 ({material}=compile(water.model,withLayer(water.stack,{speed:0})));
 assert.equal(typeof material.Layers[0].TextureID,'number','Speed 0 holds the first water frame');
});
test('every shown Speed, Direction and Tiling control changes every surface layer of every look, including native cards',()=>{
 const silent=[];
 for(const look of looks.GLOBAL_LOOKS)for(const spec of look.variations?look.variations.flatMap(v=>v.layers):look.layers){
  if(spec.stamp||!looks.surfaceIngredient(spec))continue;
  const doc=createDemoDocument(),frame=partFrame(doc.model.Geosets[0]),layer={...makeLayer(spec,frame,look.palette,1),enabled:true},stack={...newStack(look,frame,'c'),layers:[layer]};
  const base=structuredClone(doc.model),{material}=compile(base,stack),tid=material.Layers[0].TextureID;
  const repeats=t=>typeof t!=='number'||(base.Textures[t].Flags&3)===3;
  const canTile=layer.nativeSurface?repeats(tid):!layer.own||repeats(base.Materials[doc.model.Geosets[0].MaterialID].Layers.at(-1).TextureID);
  const shown=looks.surfaceControls(layer,canTile),reference=nativeData(base);
  for(const [key,value] of [['speed',layer.speed===2?3:2],['direction',layer.direction===90?180:90],['tiling',2]]){
   if(!shown[key])continue;
   const model=structuredClone(doc.model);compile(model,withLayer(stack,{[key]:value}));
   if(nativeData(model)===reference)silent.push(look.id+' '+spec.label+' '+key);
  }
 }
 assert.deepEqual(silent,[]);
});
const span=uv=>{let a=[Infinity,Infinity,-Infinity,-Infinity];for(let i=0;i<uv.length;i+=2)a=[Math.min(a[0],uv[i]),Math.min(a[1],uv[i+1]),Math.max(a[2],uv[i]),Math.max(a[3],uv[i+1])];return a;};
const inside=(uv,[x,y,w,h])=>{const [a,b,c,d]=span(uv);return a>=x-1e-5&&b>=y-1e-5&&c<=x+w+1e-5&&d<=y+h+1e-5;};
test('the texture area of a native card and of an atlas skin moves and resizes inside FX, also after Change texture',()=>{
 const poison=setup('poison-skin','Poison surface');
 let {shape}=compile(poison.model,poison.stack);
 assert.ok(inside(shape.TVertices[0],poison.layer.nativeSurface.atlas),'starts on its tileset cell');
 let result=compile(structuredClone(poison.model),withLayer(poison.stack,{atlasRect:[0,0,.5,.5]}));
 assert.ok(inside(result.shape.TVertices[0],[0,0,.5,.5]),'a moved and larger area reaches the TVertices');
 assert.ok(span(result.shape.TVertices[0])[2]>.3,'the larger area is used, not only its corner');
 const changed=looks.withLayerTexture(poison.layer,'TerrainArt\\Felwood\\Felwood_Dirt.blp');
 result=compile(structuredClone(poison.model),{...poison.stack,layers:[{...changed,atlasRect:[.5,.5,.5,.5]}]});
 assert.ok(inside(result.shape.TVertices[0],[.5,.5,.5,.5]),'the area applies to the new picture');
 const curse=setup('felwood-curse','Poison surface');
 result=compile(curse.model,withLayer(curse.stack,{atlasRect:[.1,.2,.3,.4]}));
 assert.ok(inside(result.shape.TVertices[0],[.1,.2,.3,.4]));
 const waves=setup('revenant'),plain=compile(structuredClone(waves.model),waves.stack).shape.TVertices[0];
 const moved=compile(waves.model,withLayer(waves.stack,{uvMatrix:[1,0,0,1,.25,0]})).shape.TVertices[0];
 assert.ok(Math.abs(moved[0]-plain[0]-.25)<1e-5&&Math.abs(moved[1]-plain[1])<1e-5,'a moved UV map reaches a native card without an atlas');
});
test('rune Repeat, Size, Turn, Slide and Across lay out the glyphs, and a fit-view gesture edits the same fields',async()=>{
 const {glyphIslands,withGlyphGesture,previewCoordinates}=await import('../src/global-animation-model.js');
 const rune=setup('rune-blade','Runes'),uv=patch=>compile(structuredClone(rune.model),withLayer(rune.stack,patch)).shape.TVertices[0];
 const plain=uv({}),computed=glyphIslands(rune.model.Geosets[0])[0].repeats,height=a=>span(a)[3]-span(a)[1],width=a=>span(a)[2]-span(a)[0];
 assert.ok(Math.abs(height(uv({repeats:computed}))-height(plain))<1e-5,'the computed count is the default of Repeat');
 assert.ok(Math.abs(height(uv({repeats:computed*3}))/height(plain)-3)<1e-4,'Repeat changes how often the runes repeat along the part');
 assert.ok(Math.abs(width(uv({glyphScale:2}))/width(plain)-.5)<1e-4,'Size 2 halves the UV span, so the runes grow');
 const turned=uv({glyphTurn:90});
 assert.ok(Math.abs(width(turned)-height(plain))<1e-4&&Math.abs(height(turned)-width(plain))<1e-4,'Turn 90 swaps the rune axes');
 const slid=uv({glyphSlide:.25,glyphAcross:-.1});
 for(let i=0;i<plain.length;i+=2){assert.ok(Math.abs(slid[i]-plain[i]+.1)<1e-5);assert.ok(Math.abs(slid[i+1]-plain[i+1]-.25)<1e-5);}
 // A gesture in the fit view, on top of an older moved UV map, lands exactly where the view showed it.
 const start={...rune.layer,uvMatrix:[0,1,-1,0,.3,.1],glyphScale:1.5,glyphTurn:30},before=uv(start);
 const c=Math.cos(.4)*1.3,s=Math.sin(.4)*1.3,gesture=[c,s,-s,c,.2,-.05],after=uv(withGlyphGesture(start,gesture));
 for(let i=0;i<before.length;i+=2){const u=before[i],v=before[i+1];assert.ok(Math.abs(after[i]-(c*u-s*v+.2))<2e-3&&Math.abs(after[i+1]-(s*u+c*v-.05))<2e-3,'fields and fit view agree');}
 const live={...rune.layer,repeats:4,glyphTurn:45,glyphSlide:.3};
 assert.deepEqual(Array.from(previewCoordinates(rune.model,0,rune.stack,live)),Array.from(uv(live)),'the live preview shows exactly what release applies');
});
test('colour rhythms animate the overlay colour on the layer clock with constant alpha; Soft pulse stays bright',async()=>{
 const {strengthPasses}=await import('../src/global-animation-model.js');
 const rune=setup('rune-blade','Runes'),before={anims:rune.model.GeosetAnims.length,clocks:[...rune.model.GlobalSequences]};
 const tint=rune.layer.tint,second=looks.secondTint(tint),near=(a,b)=>a.every((v,i)=>Math.abs(v-b[i])<1e-6);
 let {anim,material,model}={...compile(rune.model,withLayer(rune.stack,{pulse:'beat',loop:2000})),model:rune.model};
 assert.equal(anim.Color.LineType,3,'Colour beat eases between its colours');
 assert.equal(model.GlobalSequences[anim.Color.GlobalSeqId],2000,'the colour runs on the layer clock');
 assert.deepEqual(anim.Color.Keys.map(k=>k.Frame),[0,1000,2000]);
 assert.ok(near(Array.from(anim.Color.Keys[0].Vector),tint)&&near(Array.from(anim.Color.Keys[1].Vector),second)&&near(Array.from(anim.Color.Keys[2].Vector),tint));
 assert.ok(anim.Color.Keys.every(k=>k.InTan&&k.OutTan));
 assert.ok(material.Layers.every(l=>typeof l.Alpha==='number'),'colour rhythms keep alpha constant');
 assert.deepEqual(looks.secondTint([1,.3,0]).map(v=>Math.round(v*100)/100),[1,.1,0]);
 ({anim}=compile(model,withLayer(rune.stack,{pulse:'embers',tint2:[0,.73,0]})));
 const frames=anim.Color.Keys.map(k=>k.Frame/rune.stack.loop),gaps=frames.slice(1).map((f,i)=>Math.round((f-frames[i])*100));
 assert.equal(anim.Color.Keys.length,7);assert.equal(anim.Color.LineType,1);
 assert.ok(new Set(gaps).size>3,'uneven spacing');
 assert.ok(near(Array.from(anim.Color.Keys[1].Vector),[0,.73,0]),'the second colour is used');
 const depths=anim.Color.Keys.filter((k,i)=>i%2).map(k=>Math.round(k.Vector[1]*100));assert.equal(new Set(depths).size,3,'three depths of the second colour');
 ({anim}=compile(model,withLayer(rune.stack,{pulse:'shift'})));
 assert.ok(near(Array.from(anim.Color.Keys[0].Vector),Array.from(anim.Color.Keys[1].Vector))&&near(Array.from(anim.Color.Keys[2].Vector),Array.from(anim.Color.Keys[3].Vector)),'Colour shift holds at each end');
 ({material,anim}=compile(model,withLayer(rune.stack,{pulse:'soft'})));
 assert.equal(material.Layers[0].Alpha.LineType,3);
 const peaks=material.Layers[0].Alpha.Keys.map(k=>k.Vector[0]);assert.ok(Math.min(...peaks)>=.78*Math.max(...peaks)-1e-6,'Soft pulse never drops below 78 %');
 assert.ok(ArrayBuffer.isView(anim.Color),'alpha rhythms keep one colour');
 const unit=compile(structuredClone(rune.model),withLayer(rune.stack,{pulse:'beat',strength:1})).material.Layers;
 assert.deepEqual(strengthPasses(unit,2.5,true).map(p=>p.Alpha),[1,1,.5],'the live Intensity drag still scales a colour-beat layer');
 compileAnimation(model,0,{...rune.stack,layers:[]});
 assert.equal(model.GeosetAnims.length,before.anims,'removing the layer removes its colour track');assert.deepEqual(model.GlobalSequences,before.clocks);
 const poison=setup('poison-skin','Poison surface');
 ({anim}=compile(poison.model,withLayer(poison.stack,{pulse:'beat'})));
 assert.equal(anim.Color.Keys.length,3,'a native card takes a colour rhythm too');
});
