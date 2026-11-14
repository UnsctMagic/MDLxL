import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as looks from '../src/global-animation-looks.js';
import {createDemoDocument,openDocument} from '../src/editor-document.js';
import {compileAnimation,readAnimationStack,EMITTER_DEPTH} from '../src/global-animation-model.js';
import {ownLookFrom,stackFromOwnLook} from '../src/fx-own-looks.js';

const {GLOBAL_LOOKS,findLook,makeLayer,partFrame}=looks;
const KNIGHT=fs.readFileSync(new URL('./fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx',import.meta.url));
const models={demo:()=>createDemoDocument(),knight:()=>openDocument(KNIGHT,'knight.mdx')};
const depthKeys=l=>Object.keys(l.native||{}).filter(key=>EMITTER_DEPTH.includes(key));
function flameStack(model){
 const frame=partFrame(model.Geosets[0]),look=findLook('flaming-sword');
 return {owner:'depth',look:look.id,loop:look.loop,impact:false,layers:[makeLayer(look.layers[1],frame,look.palette,1)]};
}
const emitterOf=(model,id)=>model.ParticleEmitters2.find(n=>n._FxTag?.startsWith('depth/'+id+'/'));
// What a user does in EMTR on the applied emitter: spread, variation, blend, carry, streaks, tail, grid, frames, burst.
const EMTR_EDIT={Latitude:70,Variation:2,FilterMode:2,FrameFlags:3,TailLength:2.5,Rows:4,Columns:4,LifeSpanUVAnim:[0,5,1],DecayUVAnim:[6,15,1],Squirt:true};
function editInEmtr(model){
 for(const node of model.ParticleEmitters2.filter(n=>n._FxTag?.startsWith('depth/1/'))){
  for(const [key,value] of Object.entries(EMTR_EDIT))node[key]=Array.isArray(value)?Uint32Array.from(value):value;
  node.Flags^=524288;
 }
}

test('a fresh apply reads back without emitter fields: no look gains a layer.native key it did not set',()=>{
 for(const [name,open] of Object.entries(models))for(const look of GLOBAL_LOOKS){
  const specs=(look.variations?look.variations.flatMap(v=>v.layers):look.layers).filter(s=>s.type==='Particles');
  if(!specs.length||look.impact)continue;
  const doc=open(),frame=partFrame(doc.model.Geosets[0]);
  const stack={owner:'depth',look:look.id,loop:look.loop,impact:false,layers:specs.map((spec,i)=>({...makeLayer(spec,frame,look.palette,i+1),enabled:true}))};
  compileAnimation(doc.model,0,stack);
  for(const format of [null,'mdx','mdl']){
   const model=format?openDocument(doc.serialize(format),'depth.'+format).model:doc.model;
   // A look may set emitter fields itself (flames: frames and flags); any other key is a stray.
   for(const layer of readAnimationStack(model,0).layers)assert.deepEqual(depthKeys(layer).filter(key=>!(key in (specs[layer.id-1].native||{}))),[],name+' '+look.id+' '+layer.label+' '+(format||'live'));
  }
 }
});

test('emitter fields edited in EMTR come back into the layer, survive Save as, re-apply and both file formats',()=>{
 const doc=models.knight(),stack=flameStack(doc.model),frame=partFrame(doc.model.Geosets[0]);
 compileAnimation(doc.model,0,stack);
 const flags=emitterOf(doc.model,1).Flags^524288;
 editInEmtr(doc.model);
 const expected={...EMTR_EDIT,Flags:flags};
 // An EMTR edit of the emitters comes back as each emitter's own values (14 November: edits are per site), all equal here.
 const field=(layer,key)=>{
  if(layer.native?.[key]!==undefined)return layer.native[key];
  const sites=Object.values(layer.individuals||{}).filter(record=>!record.deleted).map(record=>record.values?.native?.[key]);
  assert.ok(sites.length&&sites.every(value=>JSON.stringify(value)===JSON.stringify(sites[0])),'every site holds the same '+key);
  return sites[0];
 };
 const check=(layer,where)=>{for(const [key,value] of Object.entries(expected))assert.deepEqual(field(layer,key),value,where+' '+key);};
 const read=readAnimationStack(doc.model,0);
 check(read.layers[0],'read');
 // Save as… keeps them, and a saved look applied to another model writes them.
 const kept=stackFromOwnLook(ownLookFrom(read,frame,'Edited flame'),frame,'depth');
 check(kept.layers[0],'saved look');
 const other=models.knight();
 compileAnimation(other.model,0,kept);
 const node=emitterOf(other.model,1);
 for(const [key,value] of Object.entries(expected))assert.deepEqual(ArrayBuffer.isView(node[key])?Array.from(node[key]):node[key],value,'applied '+key);
 // Re-applying an unrelated change keeps them; so do both file formats.
 compileAnimation(doc.model,0,{...read,loop:read.loop+100});
 check(readAnimationStack(doc.model,0).layers[0],'re-applied');
 for(const format of ['mdx','mdl'])check(readAnimationStack(openDocument(doc.serialize(format),'depth.'+format).model,0).layers[0],format);
});

test('the More fields write their emitter values, and absent fields keep what the layer compiled to before',()=>{
 const doc=models.knight(),stack=flameStack(doc.model);
 compileAnimation(doc.model,0,stack);
 const plain=structuredClone(emitterOf(doc.model,1));
 compileAnimation(doc.model,0,{...stack,layers:[{...stack.layers[0],native:{Latitude:12,Variation:1.5,FilterMode:4,FrameFlags:2,TailLength:3,Squirt:true,LifeSpanUVAnim:[0,3,1]}}]});
 const node=emitterOf(doc.model,1);
 assert.deepEqual([node.Latitude,node.Variation,node.FilterMode,node.FrameFlags,node.TailLength,node.Squirt],[12,1.5,4,2,3,true]);
 assert.ok(node.LifeSpanUVAnim instanceof Uint32Array,'frame ranges stay the native integer type');
 const fresh=models.knight();compileAnimation(fresh.model,0,stack);
 for(const key of EMITTER_DEPTH)assert.deepEqual(emitterOf(fresh.model,1)[key],plain[key],'without the value the emitter is as before: '+key);
});

test('a new picture drops the old picture grid from the layer',()=>{
 const layer={type:'Particles',kind:'flame',image:'a.blp',native:{Rows:4,Columns:4,LifeSpanUVAnim:[0,5,1],Latitude:10}};
 const next=looks.withLayerTexture(layer,'Textures\\Star4.blp');
 assert.deepEqual(next.native,{Latitude:10});
});
