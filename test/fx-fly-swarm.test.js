import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as looks from '../src/global-animation-looks.js';
import {openDocument} from '../src/editor-document.js';
import {compileAnimation,readAnimationStack} from '../src/global-animation-model.js';
import {unitHeight,flyQuadSize} from '../src/fx-layer-basis.js';
import {FLY_PICTURES} from '../src/fx-cards.js';
import {modelHash} from './helpers/fx-legacy-snapshot.mjs';

// Owner, 12 November 2026: "fly swarm - doesnt look good ... make it scaleable." Fly swarm is made the native
// Flies.mdx way: one quad per fly on its own billboarded bone, riding a closed path, never particle emitters.
const KNIGHT=fs.readFileSync(new URL('./fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx',import.meta.url));
const knight=()=>openDocument(KNIGHT,'knight.mdx');
// Parts of the checked-in Knight: a small single piece, a part split into many skin regions, a long single-region part.
const PARTS={small:20,body:37,single:30};
const look=looks.GLOBAL_LOOKS.find(l=>l.id==='fly-swarm');
function swarmStack(model,part,fields={}){
 const frame=looks.partFrame(model.Geosets[part]);frame.unitHeight=unitHeight(model);
 const stack=looks.newStack(look,frame,'flies');
 return {...stack,layers:[{...stack.layers[0],...fields}]};
}
const flyBones=model=>model.Bones.filter(b=>/^flies\/1\/fly\d+$/.test(b._FxTag||'')).sort((a,b)=>Number(a._FxTag.slice(13))-Number(b._FxTag.slice(13)));
const shapeOf=model=>model.Geosets.find(g=>g._FxTag==='flies/1/shape');
const tagged=model=>[...model.Geosets,...model.Materials,...model.Textures,...model.TextureAnims,...model.Nodes.filter(Boolean)].filter(item=>item._FxTag||item._FxStack).length;
// Half width of each quad, in fly order.
const quadHalves=model=>{const g=shapeOf(model),out=[];for(let q=0;q<g.Vertices.length/12;q++){const a=q*12;out.push(Math.hypot(g.Vertices[a+3]-g.Vertices[a],g.Vertices[a+4]-g.Vertices[a+1],g.Vertices[a+5]-g.Vertices[a+2])/2);}return out;};
const close=(a,b,message,tolerance=1e-3)=>assert.ok(Math.abs(a-b)<=tolerance*Math.max(1,Math.abs(b)),message+': '+a+' vs '+b);

for(const [name,part] of Object.entries(PARTS))test('Fly swarm on the '+name+' part: one quad and one billboarded bone per fly, no emitters, '+[5,10,15,20,25,30].join('/')+' distinct flies',()=>{
 for(const amount of [5,10,15,20,25,30]){
  const {model}=knight(),emitters=model.ParticleEmitters2.length,stack=swarmStack(model,part,{amount});
  assert.equal(stack.layers[0].swarm,true,'the library gives the new swarm');
  const graph=compileAnimation(model,part,stack),label=name+' '+amount;
  assert.equal(model.ParticleEmitters2.length,emitters,label+': no particle emitters');
  const flies=flyBones(model),shape=shapeOf(model);
  assert.equal(flies.length,amount,label+': one bone per fly');
  assert.ok(flies.every(b=>b.Flags===264),label+': every fly bone is a billboarded bone (flags 264)');
  assert.equal(shape.Vertices.length,amount*12,label+': one quad (four corners) per fly');
  assert.equal(shape.Faces.length,amount*6,label+': two triangles per fly');
  assert.deepEqual(shape.Groups.map(g=>g.length),flies.map(()=>1),label+': every corner is entirely on one bone');
  assert.deepEqual(shape.Groups.map(g=>g[0]),flies.map(b=>b.ObjectId),label+': each quad on its own fly bone');
  for(let q=0;q<amount;q++)assert.deepEqual(Array.from(shape.VertexGroup.slice(q*4,q*4+4)),[q,q,q,q]);
  // One swarm around one centre, even on a part split into many skin regions.
  const parents=new Set(flies.map(b=>b.Parent));
  assert.equal(parents.size,1,label+': all flies hang from one swarm bone');
  const swarm=model.Nodes[[...parents][0]];
  assert.equal(swarm._FxTag,'flies/1/swarm');assert.equal(swarm.Flags,256|2,label+': the swarm follows the part without tilting');
  assert.equal(graph.layers[1].id,swarm.ObjectId,label+': the placement handle sits on the swarm bone');
  // No two flies share clock, path, turn and phase (before, Amount above five stacked flies on flies 1-5).
  const tracks=flies.map(b=>model.GlobalSequences[b.Translation.GlobalSeqId]+'|'+JSON.stringify(b.Translation.Keys.map(k=>Array.from(k.Vector,v=>Math.round(v*100)))));
  assert.equal(new Set(tracks).size,amount,label+': every fly has its own path, turn, phase or clock');
  const starts=flies.map(b=>b.PivotPoint.map((v,i)=>Math.round(v+b.Translation.Keys[0].Vector[i])).join());
  assert.equal(new Set(starts).size,amount,label+': no two flies start on the same spot');
  // Every path closes at its wrap, on its own clock; each set of five has a different clock.
  for(const b of flies){
   const keys=b.Translation.Keys,ms=model.GlobalSequences[b.Translation.GlobalSeqId];
   assert.equal(b.Translation.LineType,2,'Hermite paths');
   assert.equal(keys[0].Frame,0);assert.equal(keys.at(-1).Frame,ms,label+': the last key is at the wrap');
   Array.from(keys[0].Vector).forEach((v,i)=>close(v,keys.at(-1).Vector[i],label+': path closes'));
  }
  const clocks=[...new Set(flies.map(b=>model.GlobalSequences[b.Translation.GlobalSeqId]))];
  assert.equal(clocks.length,amount/5,label+': one clock per set of five, all different');
  // One material layer like the native flies: alpha-keyed, two-sided, lit, the Abomination fly area.
  const material=model.Materials[shape.MaterialID];
  assert.equal(material.Layers.length,1);assert.equal(material.PriorityPlane,0);
  assert.equal(material.Layers[0].FilterMode,1,'Transparent (alpha key)');assert.equal(material.Layers[0].Shading,16,'two-sided and lit');
  assert.equal(model.Textures[material.Layers[0].TextureID].Image,'Textures\\Abomination.blp');
  const uv=shape.TVertices[0];
  for(let i=0;i<uv.length;i+=2){assert.ok(uv[i]>=.558&&uv[i]<=.641,'u in the fly area');assert.ok(uv[i+1]>=.309&&uv[i+1]<=.394,'v in the fly area');}
  // Each corner shows the part of the picture the reference swarms map to it, on their turned diamond.
  const ref=FLY_PICTURES.abomination;
  for(let q=0;q<amount;q++)for(let j=0;j<4;j++){
   assert.deepEqual([uv[(q*4+j)*2],uv[(q*4+j)*2+1]].map(v=>Math.round(v*1000)),ref.uv[j].map(v=>Math.round(v*1000)),label+': corner '+j+' picture');
   const pivot=flies[q].PivotPoint,half=Math.max(...[0,1,2,3].map(c=>Math.abs(shape.Vertices[(q*4+c)*3+1]-pivot[1])));
   ref.corners[j].forEach((v,a)=>close(shape.Vertices[(q*4+j)*3+a]-pivot[a],v*half,label+': corner '+j+' axis '+a,1e-3));
  }
  assert.deepEqual(Array.from(shape.Faces.slice(0,6)),[0,1,2,3,2,1],'native triangle order');
 }
});

test('Fly size, Swarm size and Speed change what they name and nothing else',()=>{
 const part=PARTS.body,sample=fields=>{const {model}=knight();compileAnimation(model,part,swarmStack(model,part,{amount:10,...fields}));const flies=flyBones(model);
  return {halves:quadHalves(model),pivots:flies.map(b=>Array.from(b.PivotPoint)),paths:flies.map(b=>b.Translation.Keys.map(k=>Array.from(k.Vector))),clocks:flies.map(b=>model.GlobalSequences[b.Translation.GlobalSeqId])};};
 const {model}=knight(),base=swarmStack(model,part).layers[0],a=sample({});
 const fly=sample({spriteSize:base.spriteSize*2});
 fly.halves.forEach((h,i)=>close(h,a.halves[i]*2,'Fly size doubles every fly'));
 assert.deepEqual([fly.pivots,fly.paths,fly.clocks],[a.pivots,a.paths,a.clocks],'Fly size leaves the paths and clocks');
 const wide=sample({size:base.size*2});
 wide.halves.forEach((h,i)=>close(h,a.halves[i],'Swarm size leaves the flies'));
 wide.paths.forEach((path,i)=>path.forEach((v,j)=>v.forEach((x,k)=>close(x,a.paths[i][j][k]*2,'Swarm size doubles every path',1e-2))));
 const fast=sample({speed:2});
 fast.halves.forEach((h,i)=>close(h,a.halves[i],'Speed leaves the flies'));
 assert.deepEqual([fast.pivots,fast.paths],[a.pivots,a.paths],'Speed leaves the paths');
 fast.clocks.forEach((ms,i)=>close(ms,a.clocks[i]/2,'Speed halves every clock',2e-3));
 assert.equal(new Set(fast.clocks).size,new Set(a.clocks).size,'clocks stay distinct');
});

test('default sizes: flies from the unit height (8.5%, 6-22 units), the swarm at least four flies wide',()=>{
 for(const part of Object.values(PARTS)){
  const {model}=knight(),l=swarmStack(model,part).layers[0];
  assert.ok(l.spriteSize>=6&&l.spriteSize<=22,'fly size '+l.spriteSize);
  close(l.spriteSize,Math.max(6,Math.min(22,unitHeight(model)*.085)),'fly size follows the unit');
  assert.ok(l.size>=l.spriteSize*4,'swarm radius '+l.size);
  assert.equal(l.amount,5);assert.equal(l.speed,1);assert.deepEqual(l.tint,[1,1,1],'no tint');
 }
});

test('removing a Fly swarm leaves the model exactly as before, bounds included',()=>{
 for(const [name,part] of Object.entries(PARTS)){
  const {model}=knight(),before=modelHash(model),stack=swarmStack(model,part,{amount:15});
  compileAnimation(model,part,stack);
  assert.ok(tagged(model)>0);
  // Re-editing replaces, never appends.
  compileAnimation(model,part,{...stack,layers:[{...stack.layers[0],amount:30,size:stack.layers[0].size*1.5,speed:.5}]});
  assert.equal(flyBones(model).length,30);assert.equal(model.Geosets.filter(g=>g._FxTag==='flies/1/shape').length,1);
  compileAnimation(model,part,{...stack,layers:[{...stack.layers[0],amount:5}]});
  assert.equal(flyBones(model).length,5,name+': fewer flies remove their bones');
  compileAnimation(model,part,{...stack,layers:[]});
  assert.equal(tagged(model),0,name+': nothing owned is left');
  assert.equal(modelHash(model),before,name+': the model is byte-identical to the pre-apply model');
 }
});

test('a Fly swarm saves and reopens as MDX and MDL with the same editable layer',()=>{
 for(const format of ['mdx','mdl']){
  const doc=knight(),part=PARTS.body,stack=swarmStack(doc.model,part,{amount:20,tint:[.4,.8,.3],strength:.8,speed:1.5});
  compileAnimation(doc.model,part,stack);
  const reopened=openDocument(doc.serialize(format),'flies.'+format),read=readAnimationStack(reopened.model,part),layer=read.layers[0];
  for(const key of ['type','kind','label','image','swarm','amount','size','spriteSize','speed','offset'])assert.deepEqual(layer[key],stack.layers[0][key],format+' '+key);
  assert.ok(Math.abs(layer.strength-.8)<1e-4&&layer.tint.every((v,i)=>Math.abs(v-[.4,.8,.3][i])<1e-4),format+': colour and intensity read back');
  assert.equal(flyBones(reopened.model).length,20,format+': the fly bones keep their owner');
  compileAnimation(reopened.model,part,{...read,layers:[{...layer,amount:10}]});
  assert.equal(flyBones(reopened.model).length,10,format+': re-applying replaces the flies');
  compileAnimation(reopened.model,part,{...read,layers:[]});
  assert.equal(tagged(reopened.model),0,format+': removing after reopen leaves nothing owned');
 }
});

test('a stack saved with the old emitter flies keeps them and compiles as before',()=>{
 const {model}=knight(),stack=swarmStack(model,PARTS.single),old={...stack.layers[0]};
 delete old.swarm;old.size=20;old.spriteSize=3;old.tint=[.28,.26,.25];
 const emitters=model.ParticleEmitters2.length;
 compileAnimation(model,PARTS.single,{...stack,layers:[old]});
 assert.equal(model.ParticleEmitters2.length-emitters,5,'old flies stay particle emitters');
 assert.equal(flyBones(model).length,0,'no quad flies for an old stack');
 assert.equal(readAnimationStack(model,PARTS.single).layers[0].swarm,undefined,'reading back does not convert it');
});

test('a small unit gets proportionate flies: the mean fly is about 8.5% of the mesh height',()=>{
 assert.equal(flyQuadSize(104),104*.085,'a 104-unit Footman body: 8.8-unit flies');
 assert.equal(flyQuadSize(40),6,'never smaller than 6 (readable at game distance)');
 assert.equal(flyQuadSize(600),22);
});

test('Change texture still works: another picture shows whole, Doodads0 keeps the native cell',()=>{
 for(const [image,override,inside] of [['Textures\\Doodads0.blp',false,[.4375,.5,.75,.8334]],['Textures\\GenericGlow64.blp',true,[0,1,0,1]]]){
  const {model}=knight();compileAnimation(model,PARTS.single,swarmStack(model,PARTS.single,{image,pictureOverride:override}));
  const shape=shapeOf(model),uv=shape.TVertices[0];
  assert.equal(model.Textures[model.Materials[shape.MaterialID].Layers[0].TextureID].Image,image);
  for(let i=0;i<uv.length;i+=2)assert.ok(uv[i]>=inside[0]-1e-6&&uv[i]<=inside[1]+1e-6&&uv[i+1]>=inside[2]-1e-6&&uv[i+1]<=inside[3]+1e-6,image);
 }
});
