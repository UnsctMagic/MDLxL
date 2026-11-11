import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as looks from '../src/global-animation-looks.js';
import {compileAnimation,readAnimationStack} from '../src/global-animation-model.js';
import {openDocument} from '../src/editor-document.js';
import {gamePathKey} from '../src/game-path.js';
import {modelHash,donorsFor} from './helpers/fx-legacy-snapshot.mjs';
import ru from '../src/locales/ru.json' with {type:'json'};
import es from '../src/locales/es.json' with {type:'json'};
import zh from '../src/locales/zh.json' with {type:'json'};
import fr from '../src/locales/fr.json' with {type:'json'};
import de from '../src/locales/de.json' with {type:'json'};

// General rules every look in the library keeps (study of hand-made effects, section 2). No per-look numbers.
const {GLOBAL_LOOKS,LIBRARY,newStack,partFrame,withVariation,lookOf}=looks;
const KNIGHT=fs.readFileSync(new URL('./fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx',import.meta.url));
const knight=()=>openDocument(KNIGHT,'knight.mdx');
// A long thin blade and a broad body part of the same real model.
const PARTS={blade:18,body:15};
const CATALOGUE=new Set(JSON.parse(fs.readFileSync(new URL('../electron/data/texture-library-catalog.json',import.meta.url),'utf8')).items.map(i=>gamePathKey(i.path)));
// Game files the library used before this rule that the classic catalogue does not list (newer game data).
const LISTED_BEFORE=['Textures\\Lightning2b.blp','Textures\\FX\\Flare\\FlareNarrow.blp','Textures\\Lightning4b.blp','Textures\\FX\\Flare\\DiamondNarrow.blp','Textures\\FX\\v\\EclipseRingMidnight.blp','Textures\\Star10_Alpha.blp','Textures\\MoonCrescentGlow.blp','Textures\\FX\\Swirl\\T_FX_Whisps.blp'].map(gamePathKey);

const variations=look=>look.variations?look.variations.map(v=>({id:v.id,name:v.name,layers:v.layers})):[{id:null,name:null,layers:look.layers}];
/** Every look and variation as a fresh stack on a frame; all=true switches the offered layers on too. */
function stacks(frame,all=false){
 return GLOBAL_LOOKS.filter(l=>l.layers.length).flatMap(look=>variations(look).map(v=>{
  let stack=newStack(look,frame,'q');
  if(v.id)stack=withVariation(stack,frame,look,v.id);
  if(all){let id=Math.max(0,...stack.layers.map(l=>l.id));const have=new Set(stack.layers.map(l=>l.label));
   stack={...stack,layers:[...stack.layers.map(l=>({...l,enabled:true})),...v.layers.filter(s=>!have.has(s.label)).map(s=>({...looks.makeLayer(s,frame,look.palette,++id),enabled:true}))]};}
  return {name:look.id+(v.id?'/'+v.id:''),look,stack};
 }));
}
const tracksOf=item=>Object.entries(item||{}).filter(([,t])=>t&&typeof t==='object'&&Array.isArray(t.Keys));
const valueOf=v=>Array.from(ArrayBuffer.isView(v)||Array.isArray(v)?v:[v]);
const moving=t=>t.Keys.length>1&&t.Keys.some(k=>valueOf(k.Vector).some((v,i)=>Math.abs(v-valueOf(t.Keys[0].Vector)[i])>1e-6));
/** Global sequences on which a layer visibly moves: alpha, colour, texture travel and frames, and its own bones and emitters (emission keys excluded). */
function motionClocks(model,tag){
 const clocks=new Set(),add=(t,key)=>{if(t.GlobalSeqId!=null&&t.GlobalSeqId>=0&&!['EmissionRate','Visibility'].includes(key)&&moving(t))clocks.add(t.GlobalSeqId);};
 model.Geosets.forEach((g,i)=>{
  if(!g._FxTag?.startsWith(tag))return;
  for(const layer of model.Materials[g.MaterialID].Layers){for(const [k,t] of tracksOf(layer))add(t,k);if(layer.TVertexAnimId!=null)for(const [k,t] of tracksOf(model.TextureAnims[layer.TVertexAnimId]))add(t,k);}
  for(const [k,t] of tracksOf(model.GeosetAnims.find(a=>a.GeosetId===i)))add(t,k);
 });
 for(const n of model.Nodes)if(n?._FxTag?.startsWith(tag)){for(const [k,t] of tracksOf(n))add(t,k);if(n.MaterialID!=null&&model.RibbonEmitters.includes(n))for(const layer of model.Materials[n.MaterialID].Layers)for(const [k,t] of tracksOf(layer))add(t,k);}
 return clocks;
}

test('every look and variation compiles on a blade and on a body of a real model, offered layers included',()=>{
 const base=knight().model,failures=[];
 for(const [shape,index] of Object.entries(PARTS))for(const all of [false,true]){
  const frame=partFrame(base.Geosets[index]);
  for(const {name,stack} of stacks(frame,all)){
   const model=structuredClone(base);
   try{compileAnimation(model,index,structuredClone(stack),donorsFor(model));}catch(e){failures.push(shape+' '+name+(all?' (all layers)':'')+': '+e.message);}
  }
 }
 assert.deepEqual(failures,[]);
});

test('no two moving layers of a look share one clock',()=>{
 const base=knight().model,frame=partFrame(base.Geosets[PARTS.blade]),shared=[];
 for(const {name,stack} of stacks(frame,true)){
  const model=structuredClone(base);compileAnimation(model,PARTS.blade,structuredClone(stack),donorsFor(model));
  const clocks=stack.layers.map(l=>[l,motionClocks(model,'q/'+l.id+'/')]);
  for(const [i,[a,ca]] of clocks.entries())for(const [b,cb] of clocks.slice(i+1)){
   if(a.lockedClock&&a.lockedClock===b.lockedClock)continue;
   const both=[...ca].filter(c=>cb.has(c));
   if(both.length)shared.push(name+': '+a.label+' + '+b.label+' on '+both.map(c=>model.GlobalSequences[c]+' ms').join(', '));
  }
 }
 assert.deepEqual(shared,[]);
});

const close=(a,b,wrap)=>a.every((v,i)=>{const d=Math.abs(v-b[i]);return d<1e-4||wrap&&Math.abs(d-Math.round(d))<1e-4;});
const sameRotation=(a,b)=>close(a,b)||close(a,b.map(v=>-v));
test('every looping track ends where it starts, on its clock\'s last frame',()=>{
 const base=knight().model,frame=partFrame(base.Geosets[PARTS.blade]),open=[];
 for(const {name,stack} of stacks(frame,true)){
  const model=structuredClone(base),clocks=model.GlobalSequences.length;compileAnimation(model,PARTS.blade,structuredClone(stack),donorsFor(model));
  const owned=[...model.Geosets.filter(g=>g._FxTag?.startsWith('q/')).flatMap(g=>[...model.Materials[g.MaterialID].Layers.flatMap(l=>[l,model.TextureAnims[l.TVertexAnimId]]),model.GeosetAnims.find(a=>a.GeosetId===model.Geosets.indexOf(g))]),...model.Nodes.filter(n=>n?._FxTag?.startsWith('q/'))];
  for(const item of owned)for(const [key,t] of tracksOf(item)){
   if(t.GlobalSeqId==null||t.GlobalSeqId<clocks&&t.GlobalSeqId<0||t.Keys.length<2||!moving(t))continue;
   const first=valueOf(t.Keys[0].Vector),last=valueOf(t.Keys.at(-1).Vector),length=model.GlobalSequences[t.GlobalSeqId];
   const wraps=item.Translation===t&&model.TextureAnims.includes(item);
   const ends=key==='Rotation'?sameRotation(first,last):close(first,last,wraps);
   if(!ends||t.Keys[0].Frame!==0||t.Keys.at(-1).Frame!==length)open.push(name+' '+(item.Name||item._FxTag||'layer')+' '+key+': '+JSON.stringify([t.Keys[0].Frame,first,t.Keys.at(-1).Frame,last,length]));
  }
 }
 assert.deepEqual(open,[]);
});

test('every look uses native game textures only',()=>{
 const foreign=[];
 const check=(who,p)=>{if(p&&!CATALOGUE.has(gamePathKey(p))&&!LISTED_BEFORE.includes(gamePathKey(p)))foreign.push(who+': '+p);};
 for(const look of GLOBAL_LOOKS)for(const v of variations(look))for(const s of v.layers)for(const p of [s.image,...(s.frames||[]),s.nativeSpec?.texture,s.nativeSurface?.texture,...(s.nativeSurface?.layers||[]).map(l=>l.texture)])check(look.id+' '+s.label,p);
 for(const s of looks.LAYER_CHOICES)check('Add layer '+s.label,s.image);
 assert.deepEqual([...new Set(foreign)],[]);
});

test('every folder, look, variation and layer name has all five translations',()=>{
 const missing=new Set();
 const names=new Set([...LIBRARY.map(([group])=>group),...GLOBAL_LOOKS.flatMap(look=>[look.name,...variations(look).flatMap(v=>[v.name,...v.layers.map(s=>s.label)])])].filter(Boolean));
 for(const name of names)for(const [locale,pack] of Object.entries({ru,es,zh,fr,de}))if(!Object.hasOwn(pack,name))missing.add(locale+': '+name);
 assert.deepEqual([...missing],[]);
});

test('applying and then removing any look leaves the model exactly as before',()=>{
 const changed=[];
 for(const [shape,index] of Object.entries(PARTS)){
  const base=knight().model,before=modelHash(base),frame=partFrame(base.Geosets[index]);
  for(const {name,stack} of stacks(frame,true)){
   const model=structuredClone(base);compileAnimation(model,index,structuredClone(stack),donorsFor(model));compileAnimation(model,index,{...structuredClone(stack),layers:[]});
   if(modelHash(model)!==before)changed.push(shape+' '+name);
  }
 }
 assert.deepEqual(changed,[]);
});

test('every look survives MDX save and reopen as the same editable stack',()=>{
 const lost=[];
 const frame=partFrame(knight().model.Geosets[PARTS.blade]);
 for(const {name,stack} of stacks(frame)){
  const doc=knight();compileAnimation(doc.model,PARTS.blade,structuredClone(stack),donorsFor(doc.model));
  const reopened=openDocument(doc.serialize('mdx'),'q.mdx').model,read=readAnimationStack(reopened,PARTS.blade);
  const shape=s=>s?.layers.map(l=>[l.type,l.label,l.enabled!==false]);
  if(!read||read.look!==stack.look||read.variation!==stack.variation||JSON.stringify(shape(read))!==JSON.stringify(shape(stack))||lookOf(read).custom){lost.push(name);continue;}
  try{compileAnimation(reopened,PARTS.blade,{...read,loop:read.loop+100});}catch(e){lost.push(name+': '+e.message);}
 }
 assert.deepEqual(lost,[]);
});
