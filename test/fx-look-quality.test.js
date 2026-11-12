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
// Approved retired ingredients re-filed in emitter round 2. Read from the installed
// game's CASC on 12 November 2026: 349680, 11088 and 87536 bytes respectively.
const VERIFIED_EMITTER_TEXTURES=['Textures\\FX\\v\\LeafGold8x8.blp','Textures\\Feather.blp','Textures\\FX\\v\\EmberGlowSharp.blp'].map(gamePathKey);

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

test('moving layers use independent clocks except for the Arcane swirl layers on the look clock',()=>{
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
 // Design section 2.5 leaves the steel pulse and the motes on the 2320 ms look clock.
 assert.deepEqual(shared,['arcane-blade/swirl: Enchanted steel + Orbiting motes on 2320 ms']);
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
 const check=(who,p)=>{if(p&&!CATALOGUE.has(gamePathKey(p))&&!LISTED_BEFORE.includes(gamePathKey(p))&&!VERIFIED_EMITTER_TEXTURES.includes(gamePathKey(p)))foreign.push(who+': '+p);};
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

// Rhythms that dip the light (alpha flicker, flashes, deep breathing, fades) stay only where a look carried them
// before 12 November 2026, plus the limited flicker and local tip bursts in FX design section 2.4.
const DIPPING=['flicker','lightning','glint','double','embers','fade','breathe'];
const CARRIED_BEFORE=new Set([['flaming-sword','Hot core','flicker'],['claude-fel-blade','Fel fire','flicker'],['claude-forge-hot','Heat glow','flicker'],['claude-forge-hot','Glowing seams','breathe'],['frost-blade','Crystal glints','glint'],['frost-blade','Ice sheen','glint'],['frost-blade','White facets','crystal'],['glacial','Fissures','breathe'],['crystal-veins','Crystal veins','breathe'],['crystal-veins','Crystal glints','glint'],['claude-tidal-blade','Wet sheen','breathe'],['sort-tide','Tide mark','breathe'],['lightning-blade','Forked arcs','flicker'],['sort-rift','Rift seam','lightning'],['claude-void-cracked','Void cracks','flicker'],['claude-void-cracked','Dark aura','breathe'],['arcane-blade','Flowing energy','breathe'],['arcane-blade','Narrow highlight','breathe'],['rune-blade','Runes','breathe'],['rune-blade','Thorn glyph','flicker'],['claude-runic-plate','Plate runes','breathe'],['claude-runic-plate','Rune light','breathe'],['glowing-skin','Glowing texture','breathe'],['sort-astral','Constellation','glint'],['sort-soul','Soul seal','breathe'],['sort-eclipse','Eclipse eye','breathe'],['felwood-curse','Poison surface','breathe'],['felwood-curse','Rune','breathe'],['claude-corrupted-veins','Sickly glow','breathe'],['claude-corrupted-veins','Fel veins','breathe'],['sort-basalt','Heat seams','glint'],['sort-abyss','Starlight','glint'],['sort-cairn','Carving light','glint'],['sort-mosaic','Crescent','breathe'],['claude-wraith-form','Fading body','fade'],['claude-blood-pact','Heartbeat','double'],['claude-blood-pact','Pact mark','double'],['sort-blood','Red stain','breathe'],['colour-pulse','Glowing texture','breathe'],['fade-pulse','Breathing opacity','fade'],['recall-seal','Stars','burst']].map(a=>a.join('|')));
const rhythmOf=l=>l.pulse??(l.type==='Glow'||l.glyphs||l.type==='Rune'?'breathe':null);
const luminance=([r,g,b])=>.2126*r+.7152*g+.0722*b;
test('no look flashes: dipping rhythms only where a look had them, slow colour beats at one brightness, calm cards and local tip bursts',()=>{
 const base=knight().model,frame=partFrame(base.Geosets[PARTS.blade]),flashing=[];
 for(const {name,look,stack} of stacks(frame,true))for(const l of stack.layers){
  if(l.stamp)continue;
  const at=name+' '+l.label,rhythm=rhythmOf(l);
  if(DIPPING.includes(rhythm)&&!CARRIED_BEFORE.has([look.id,l.label,rhythm].join('|')))flashing.push(at+': '+rhythm+' dips the light');
  if(['beat','shift'].includes(rhythm)){
   const ratio=luminance(l.tint2||looks.secondTint(l.tint))/Math.max(1e-6,luminance(l.tint));
   if(ratio<.8||ratio>1.25)flashing.push(at+': its two colours differ in brightness ('+ratio.toFixed(2)+')');
   if((l.loop??stack.loop)<1500)flashing.push(at+': colour changes faster than 1.5 s');
  }
  if(l.type==='Card'){
   if(l.frameMs>0&&l.frameMs<100)flashing.push(at+': flipbook faster than 100 ms a frame');
   if(l.sizeMax!=null&&(l.sizeMax/(l.sizeMin||1)>1.45))flashing.push(at+': size swings more than 45 %');
   if((l.sizeMin!==1||l.sizeMax!==1)&&(l.loop??stack.loop)<400)flashing.push(at+': size throbs faster than 0.4 s');
  }
  if(l.type==='Edge'&&!(l.orbit||l.pulse==='steady')&&!CARRIED_BEFORE.has([look.id,l.label,'flicker'].join('|'))&&!['rune-blade','sort-thorn'].includes(look.id))flashing.push(at+': ribbon alpha flickers');
  const localTipBurst=l.gather==='tip'&&l.nativeSpec?.burst;
  if(l.type==='Particles'&&!l.impact&&!localTipBurst&&!CARRIED_BEFORE.has([look.id,l.label,'burst'].join('|'))&&(l.nativeSpec?.burst||l.native?.Squirt||l.burstGap!=null&&look.id!=='lightning-blade'))flashing.push(at+': bursts on and off');
 }
 assert.deepEqual(flashing,[]);
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

// Owner, 12 November: Falling mist showed on a large sword but not on a Footman. A body has many skin regions;
// emitter sizes came from whichever region was first (a small piece), so the mist was a few units wide.
const FOOTMAN=new URL('file:///D:/Claude/MDLxL-TestModels/pose/Footman.mdx');
test('emitters on a many-region part are sized from its main region, so a Footman body shows its mist',{skip:!fs.existsSync(FOOTMAN)&&'Footman fixture not on this PC'},()=>{
 const model=openDocument(fs.readFileSync(FOOTMAN),'footman.mdx').model,sizes={};
 for(const [name,index] of [['body',0],['weapon',1]]){
  const frame=partFrame(model.Geosets[index]),stack=newStack(looks.findLook('frost-blade'),frame,'q'),mist=stack.layers.find(l=>l.label==='Falling mist');
  assert.ok(mist&&mist.enabled!==false,name+' starts with Falling mist');
  const main=frame.regions.reduce((a,b)=>b.frame.length>a.frame.length?b:a).frame;
  assert.ok(frame.regions.length>8,'the Footman '+name+' has many skin regions');
  sizes[name]=mist.size;assert.ok(mist.size>=main.length*.12,name+' mist is a visible size: '+mist.size.toFixed(1)+' for a region '+main.length.toFixed(0)+' long');
 }
});
