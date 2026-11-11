import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as looks from '../src/global-animation-looks.js';
import {openDocument} from '../src/editor-document.js';
import {compileAnimation,readAnimationStack} from '../src/global-animation-model.js';
import {ownLookFrom,stackFromOwnLook,normalizeOwnLook} from '../src/fx-own-looks.js';
import {layerBasis} from '../src/fx-layer-basis.js';
import {modelHash} from './helpers/fx-legacy-snapshot.mjs';

const {LAYER_CHOICES,makeLayer,partFrame}=looks;
const KNIGHT=fs.readFileSync(new URL('./fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx',import.meta.url));
const knight=()=>openDocument(KNIGHT,'knight.mdx');
function edgeStack(model,fields={}){
 const frame=partFrame(model.Geosets[0]),spec=LAYER_CHOICES.find(s=>s.type==='Edge'&&s.label==='Light edge');
 return {owner:'orbit',look:'empty',loop:3000,impact:false,layers:[{...makeLayer(spec,frame,'native',1),...fields}]};
}
const ribbons=model=>model.RibbonEmitters.filter(n=>n._FxTag?.startsWith('orbit/1/'));
const helpers=model=>model.Bones.filter(n=>/^orbit\/1\/orbit\d+-\d$/.test(n._FxTag||''));

test('Orbit puts the ribbon on a chain of three owned helpers, each on its own clock, every loop closed',()=>{
 const {model}=knight();
 compileAnimation(model,0,edgeStack(model,{orbit:true,orbitRadius:12,orbitTurns:2,strength:.5}));
 for(const ribbon of ribbons(model)){
  const chain=[];let id=ribbon.Parent;
  for(let i=0;i<3;i++){const node=model.Nodes[id];chain.push(node);id=node.Parent;}
  assert.ok(chain.every(n=>/\/orbit\d+-\d$/.test(n._FxTag)),'the ribbon hangs from three owned helpers');
  const tracks=chain.map(n=>n.Rotation||n.Translation),lengths=tracks.map(t=>model.GlobalSequences[t.GlobalSeqId]);
  assert.equal(new Set(lengths).size,3,'three clocks');
  for(const a of lengths)for(const b of lengths)if(a!==b)assert.ok(Math.max(a,b)%Math.min(a,b)!==0,a+' and '+b+' do not divide');
  assert.equal(lengths[2],1500,'the first helper turns twice per 3000 ms loop');
  for(const t of tracks)assert.deepEqual(Array.from(t.Keys[0].Vector),Array.from(t.Keys.at(-1).Vector),'loop closes');
  assert.equal(ribbon.Translation,undefined,'the helpers move the ribbon; the sway is off');
  assert.equal(ribbon.Alpha,.5,'static alpha');
  assert.equal(model.Materials[ribbon.MaterialID].Layers[0].FilterMode,3,'Add');
 }
});

test('without Orbit an Edge compiles as before; turning Orbit off or removing the stack leaves nothing behind',()=>{
 const {model}=knight(),before=modelHash(model),stack=edgeStack(model);
 compileAnimation(model,0,stack);
 const plain=structuredClone(ribbons(model).map(r=>[r.Parent,r.Translation,r.Alpha]));
 assert.equal(helpers(model).length,0);
 compileAnimation(model,0,{...stack,layers:[{...stack.layers[0],orbit:true,orbitRadius:10}]});
 assert.ok(helpers(model).length>=3);
 compileAnimation(model,0,stack);
 assert.equal(helpers(model).length,0,'Orbit off removes the helpers');
 assert.deepEqual(structuredClone(ribbons(model).map(r=>[r.Parent,r.Translation,r.Alpha])),plain,'and the edge is as it was');
 compileAnimation(model,0,{...stack,layers:[{...stack.layers[0],orbit:true}]});
 compileAnimation(model,0,{...stack,layers:[]});
 assert.equal(modelHash(model),before,'removing an orbiting Edge restores the model exactly');
});

test('an orbiting Edge saves, reopens and its look fits another part',()=>{
 const doc=knight(),stack=edgeStack(doc.model,{orbit:true,orbitRadius:9,orbitTurns:3});
 compileAnimation(doc.model,0,stack);
 for(const format of ['mdx','mdl']){
  const reopened=openDocument(doc.serialize(format),'orbit.'+format),read=readAnimationStack(reopened.model,0).layers[0];
  assert.deepEqual([read.orbit,read.orbitRadius,read.orbitTurns],[true,9,3],format);
  assert.ok(helpers(reopened.model).length>=3,format+': helpers keep their owner');
 }
 const from=partFrame(doc.model.Geosets[0]),to={length:from.length*2,girth:from.girth*2,radius:from.radius*2};
 const fitted=stackFromOwnLook(ownLookFrom(stack,from,'Orbit'),to,'o').layers[0];
 assert.ok(Math.abs(fitted.orbitRadius-9*layerBasis(to).unit/layerBasis(from).unit)<1e-9,'radius follows the part');
 const kept=normalizeOwnLook({id:'own-orbit',name:'Orbit',loop:3000,frame:{length:100,girth:5,radius:5},layers:[{id:1,type:'Edge',tint:[1,1,1],offset:[0,0,0],orbit:true,orbitTurns:40,orbitRadius:-3}]}).layers[0];
 assert.deepEqual([kept.orbitTurns,kept.orbitRadius],[8,0],'saved orbit fields stay in bounds');
});
