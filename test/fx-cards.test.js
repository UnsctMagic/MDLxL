import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as looks from '../src/global-animation-looks.js';
import {openDocument} from '../src/editor-document.js';
import {compileAnimation,readAnimationStack} from '../src/global-animation-model.js';
import {cardSpec,cardFields,CARD_DEFAULTS} from '../src/fx-cards.js';
import {ownLookFrom,stackFromOwnLook,normalizeOwnLook} from '../src/fx-own-looks.js';
import {layerBasis} from '../src/fx-layer-basis.js';
import {modelHash} from './helpers/fx-legacy-snapshot.mjs';

const {makeLayer,partFrame}=looks;
// A real rigged model (kept in the repository): its first geoset is the part the cards go on.
const KNIGHT=fs.readFileSync(new URL('./fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx',import.meta.url));
const knight=()=>openDocument(KNIGHT,'knight.mdx');
const GLOW='Textures\\GenericGlow64.blp';
function cardStack(model,fields={},extra=[]){
 const frame=partFrame(model.Geosets[0]);
 return {owner:'cards',look:'empty',loop:3000,impact:false,layers:[{...makeLayer(cardSpec('Card',GLOW),frame,'native',1),...fields},...extra]};
}
const tagged=model=>[...model.Geosets,...model.Materials,...model.Textures,...model.TextureAnims,...model.Nodes.filter(Boolean)].filter(item=>item._FxTag||item._FxStack).length;
const cardBones=model=>model.Bones.filter(b=>/\/card\d+-\d+$/.test(b._FxTag||''));
const firstLast=track=>[Array.from(track.Keys[0].Vector),Array.from(track.Keys.at(-1).Vector)];

test('a Card layer compiles to one owned quad geoset, one bone per card and one single-layer material',()=>{
 const {model}=knight(),stack=cardStack(model,{count:3});
 const graph=compileAnimation(model,0,stack),shape=model.Geosets[graph.layers[1].geoset];
 assert.ok(shape,'the card geoset exists');
 assert.equal(shape._FxTag,'cards/1/shape');
 const regions=partFrame(model.Geosets[0]).regions?.length||1,cards=3*regions;
 assert.equal(shape.Vertices.length,cards*12,'four corners per card');
 assert.equal(shape.Faces.length,cards*6,'two triangles per card');
 const bones=cardBones(model);
 assert.equal(bones.length,cards,'one owned bone per card');
 assert.ok(bones.every(b=>(b.Flags&8)===8),'camera-facing cards are on billboarded bones');
 assert.deepEqual(shape.Groups.map(g=>g[0]).sort(),bones.map(b=>b.ObjectId).sort(),'each quad is bound to its own bone');
 const material=model.Materials[shape.MaterialID];
 assert.equal(material.Layers.length,1,'one material layer');
 assert.equal(material.Layers[0].FilterMode,3,'Add by default');
 assert.equal(material.Layers[0].Shading,1|16|32,'unshaded, two-sided and unfogged by default');
 assert.equal(model.Textures[material.Layers[0].TextureID].Image,GLOW,'the native texture');
 assert.equal(graph.layers[1].id,bones.find(b=>b._FxTag==='cards/1/card0-0').ObjectId,'the layer reports its first card bone for the placement handle');
});

test('Facing: ground cards lie flat and stay on the ground; part cards turn with the part',()=>{
 const {model}=knight();
 let graph=compileAnimation(model,0,cardStack(model,{facing:'ground',count:2}));
 let shape=model.Geosets[graph.layers[1].geoset];
 for(let i=2;i<shape.Vertices.length;i+=3)assert.ok(Math.abs(shape.Vertices[i]-1.5)<1e-4,'every corner is on the ground plane');
 assert.ok(cardBones(model).every(b=>b.Parent==null&&!(b.Flags&8)),'ground cards are not parented to the part and not billboarded');
 graph=compileAnimation(model,0,cardStack(model,{facing:'part'}));
 shape=model.Geosets[graph.layers[1].geoset];
 assert.ok(cardBones(model).every(b=>!(b.Flags&8)&&b.Parent!=null),'part cards follow the part without billboarding');
 assert.equal(shape.Vertices.length,(partFrame(model.Geosets[0]).regions?.length||1)*12);
});

test('removing a Card stack leaves the model exactly as before, whatever the card used',()=>{
 for(const fields of [{},{count:4,spin:1.5,jitter:90,rows:4,columns:4,frameMs:70,pulse:'soft',loop:1200},{facing:'ground',count:3,pulse:'beat',spinEased:false,spin:-2}]){
  const {model}=knight(),before=modelHash(model),stack=cardStack(model,fields);
  compileAnimation(model,0,stack);
  assert.ok(tagged(model)>0);
  // Re-editing replaces, never appends.
  compileAnimation(model,0,{...stack,layers:[{...stack.layers[0],count:2,size:stack.layers[0].size*1.5}]});
  compileAnimation(model,0,{...stack,layers:[]});
  assert.equal(tagged(model),0,JSON.stringify(fields)+': nothing owned is left');
  assert.equal(modelHash(model),before,JSON.stringify(fields)+': the model is byte-identical to the pre-apply model');
 }
});

test('fewer cards and no jitter remove the bones, clocks and texture animation they no longer use',()=>{
 const {model}=knight(),stack=cardStack(model,{count:4,jitter:60,rows:2,columns:2,frameMs:80});
 compileAnimation(model,0,stack);
 const clocks=model.GlobalSequences.length,anims=model.TextureAnims.length;
 compileAnimation(model,0,{...stack,layers:[{...stack.layers[0],count:1,jitter:0,frameMs:0}]});
 const regions=partFrame(model.Geosets[0]).regions?.length||1;
 assert.equal(cardBones(model).length,regions);
 assert.equal(model.Bones.filter(b=>/jitter/.test(b._FxTag||'')).length,0,'jitter bones go');
 assert.ok(model.GlobalSequences.length<clocks,'unused clocks go');
 assert.equal(model.TextureAnims.length,anims-1,'the flipbook goes');
});

test('several cards run on different clocks that never divide each other, and every loop ends where it starts',()=>{
 const {model}=knight(),stack=cardStack(model,{count:4,spin:1,jitter:45,rows:4,columns:4,frameMs:60,pulse:'breathe'});
 const graph=compileAnimation(model,0,stack);
 const bones=cardBones(model).filter(b=>/card0-/.test(b._FxTag));
 const lengths=bones.map(b=>model.GlobalSequences[b.Scaling.GlobalSeqId]);
 assert.deepEqual(lengths,[3000,3399,3600,3900],'base × 1, 1.133, 1.2, 1.3');
 for(const a of lengths)for(const b of lengths)if(a!==b)assert.ok(Math.max(a,b)%Math.min(a,b)!==0,a+' and '+b+' do not divide');
 const jitters=model.Bones.filter(b=>/jitter0-/.test(b._FxTag||'')).map(b=>model.GlobalSequences[b.Rotation.GlobalSeqId]);
 assert.deepEqual(jitters,[100,133,117,151]);
 for(const b of [...bones,...model.Bones.filter(b=>/jitter/.test(b._FxTag||''))])for(const track of [b.Scaling,b.Rotation].filter(Boolean)){
  const [first,last]=firstLast(track);
  assert.deepEqual(first,last,b.Name+': the loop closes without a pop');
  assert.equal(track.Keys.at(-1).Frame,model.GlobalSequences[track.GlobalSeqId],'the last key is at the loop end');
 }
 const layer=model.Materials[model.Geosets[graph.layers[1].geoset].MaterialID].Layers[0];
 for(const track of [layer.Alpha,model.TextureAnims[layer.TVertexAnimId].Translation]){const [first,last]=firstLast(track);assert.deepEqual(first,last);}
 assert.equal(model.TextureAnims[layer.TVertexAnimId].Translation.LineType,0,'the flipbook steps without blending');
 assert.equal(model.GlobalSequences[model.TextureAnims[layer.TVertexAnimId].Translation.GlobalSeqId],16*60,'one frame time per cell');
});

test('size pulse scales between the smallest and largest size; spin turns about the card normal',()=>{
 const {model}=knight();
 compileAnimation(model,0,cardStack(model,{sizeMin:.5,sizeMax:1.5,spin:2}));
 const bone=cardBones(model)[0],values=bone.Scaling.Keys.map(k=>k.Vector[0]);
 assert.deepEqual([Math.min(...values),Math.max(...values)],[.5,1.5]);
 assert.equal(model.GlobalSequences[bone.Rotation.GlobalSeqId],1500,'two turns per 3000 ms loop: one turn every 1500 ms');
 for(const key of bone.Rotation.Keys)assert.ok(Math.abs(key.Vector[1])<1e-6&&Math.abs(key.Vector[2])<1e-6,'a camera card turns about X, the view axis');
 compileAnimation(model,0,cardStack(model,{sizeMin:1,sizeMax:1}));
 assert.equal(cardBones(model)[0].Scaling,undefined,'no pulse, no scale track');
});

test('Rhythm, Second colour, Blend and Lit by map light reach a Card the way they reach a surface layer',()=>{
 const {model}=knight();
 let graph=compileAnimation(model,0,cardStack(model,{pulse:'beat',tint:[1,.3,0],tint2:[1,.1,0],filter:4,unshaded:false}));
 const shape=model.Geosets[graph.layers[1].geoset],layer=model.Materials[shape.MaterialID].Layers[0];
 assert.equal(shape.Vertices.length,(partFrame(model.Geosets[0]).regions?.length||1)*12,'the colour goes on the card quads');
 assert.equal(layer.FilterMode,4);assert.equal(layer.Shading&1,0);
 const colour=model.GeosetAnims.find(a=>a.GeosetId===graph.layers[1].geoset).Color;
 assert.ok(colour.Keys,'a colour rhythm animates the geoset colour');
 assert.ok(Math.abs(colour.Keys[1].Vector[1]-.1)<1e-6,'to the second colour');
 graph=compileAnimation(model,0,cardStack(model,{pulse:'flicker',strength:.6}));
 const alpha=model.Materials[model.Geosets[graph.layers[1].geoset].MaterialID].Layers[0].Alpha;
 assert.ok(alpha.Keys&&Math.abs(Math.max(...alpha.Keys.map(k=>k.Vector[0]))-.6)<1e-6,'an alpha rhythm peaks at the intensity');
});

test('a Card stack saves and reopens as MDX and MDL with the same editable layer, and re-applies',()=>{
 for(const format of ['mdx','mdl']){
  const doc=knight(),stack=cardStack(doc.model,{count:2,facing:'part',spin:.5,rows:2,columns:2,frameMs:0,cell:3,tint:[.2,.9,.4],strength:.7});
  compileAnimation(doc.model,0,stack);
  const reopened=openDocument(doc.serialize(format),'cards.'+format),read=readAnimationStack(reopened.model,0);
  const layer=read.layers[0];
  for(const key of ['type','label','image','facing','count','size','spin','rows','columns','frameMs','cell'])assert.deepEqual(layer[key],stack.layers[0][key],format+' '+key);
  assert.ok(Math.abs(layer.strength-.7)<1e-4&&layer.tint.every((v,i)=>Math.abs(v-stack.layers[0].tint[i])<1e-4),format+': colour and intensity read back');
  const shape=reopened.model.Geosets.find(g=>g._FxTag==='cards/1/shape');
  assert.ok(shape,format+': the card geoset keeps its owner');
  assert.equal(shape.Vertices.length,cardBones(reopened.model).length*12,format+': four corners per reopened card bone');
  assert.ok(cardBones(reopened.model).length>=2,format+': the card bones keep their owner');
  compileAnimation(reopened.model,0,{...read,layers:[{...layer,count:1}]});
  assert.equal(reopened.model.Geosets.filter(g=>g._FxTag==='cards/1/shape').length,1,format+': re-applying replaces the card geoset');
  compileAnimation(reopened.model,0,{...read,layers:[]});
  assert.equal(tagged(reopened.model),0,format+': removing after reopen leaves nothing owned');
 }
});

test('a saved Card look fits a different part: size and offset follow the part',()=>{
 const {model}=knight(),from=partFrame(model.Geosets[0]),to={length:from.length*2,girth:from.girth*2,radius:from.radius*2};
 const layer={...makeLayer(cardSpec('Card',GLOW,{facing:'ground',count:3}),from,'native',1),offset:[2,0,1]};
 const record=ownLookFrom({loop:3000,layers:[layer]},from,'Cards');
 assert.ok(normalizeOwnLook(record),'a Card look is a valid saved look');
 const fitted=stackFromOwnLook(record,to,'o').layers[0],was=layerBasis(from),now=layerBasis(to);
 const cardSizeOf=b=>Math.max(b.unit*1.2,Math.min(b.length*.18,b.girth*2.2));
 assert.ok(Math.abs(fitted.size-layer.size*cardSizeOf(now)/cardSizeOf(was))<1e-9,'size follows the card size of the part');
 assert.ok(Math.abs(fitted.offset[0]-2*now.unit/was.unit)<1e-9,'offset follows the part unit');
 assert.equal(fitted.count,3);
});

test('saved Card fields are kept inside their bounds',()=>{
 const base={id:'own-cards',name:'Cards',loop:3000,frame:{length:100,girth:5,radius:5}};
 const look=normalizeOwnLook({...base,layers:[{id:1,type:'Card',label:'Card',image:GLOW,tint:[1,1,1],offset:[0,0,0],count:40,rows:0,columns:99,facing:'sideways',jitter:999,sizeMin:2,sizeMax:1,frameMs:-5}]});
 const l=look.layers[0];
 assert.deepEqual([l.count,l.rows,l.columns,l.facing,l.jitter,l.frameMs],[8,1,16,'camera',180,0]);
 assert.ok(l.sizeMax>=l.sizeMin);
 assert.deepEqual(cardFields({}),{...CARD_DEFAULTS},'an empty card uses the defaults');
});
