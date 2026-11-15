// Frozen FX stacks from before per-layer editing (commit e81e50c9) and the hash of the
// native model each one compiled to. The stacks are stored as JSON, so later changes to
// makeLayer (new layer fields) never reach them; the test proves a layer without the new
// fields still compiles to exactly the same model data.
// Regenerate only on the commit that defines the baseline:
//   node test/helpers/fx-legacy-snapshot.mjs --write
import fs from 'node:fs';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createDemoDocument,openDocument} from '../../src/editor-document.js';
import {compileAnimation} from '../../src/global-animation-model.js';

export const SNAPSHOT=new URL('../fixtures/fx-legacy-stacks.json',import.meta.url);
const KNIGHT=new URL('../fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx',import.meta.url);
let knightBytes;
export function freshModel(name){
 if(name==='demo')return createDemoDocument().model;
 knightBytes??=fs.readFileSync(KNIGHT);
 return openDocument(knightBytes,'knight.mdx').model;
}
export function modelHash(model){
 const text=JSON.stringify(model,(key,value)=>ArrayBuffer.isView(value)?{[value.constructor.name]:Array.from(value)}:typeof value==='number'&&!Number.isFinite(value)?String(value):value);
 return crypto.createHash('sha256').update(text).digest('hex');
}
export function compiledHash(name,stack,donors){
 const model=freshModel(name);
 try{compileAnimation(model,0,structuredClone(stack),donors);}catch(error){return 'error:'+error.message;}
 return modelHash(model);
}
export function donorsFor(model){
 return {rune:{Geosets:[structuredClone(model.Geosets[0])],Materials:[{Layers:[{TextureID:0}]}],Textures:[{Image:'Doodads\\Cinematic\\IcecrownObelisk\\glow_runes.blp'}]}};
}

async function write(){
 const looks=await import('../../src/global-animation-looks.js');
 const {SURFACE_EFFECTS}=await import('../../src/surface-effects.js');
 const {SORT_LOOKS}=await import('../../src/fx-sort-looks.js');
 const {GLOBAL_LOOKS,findLook,newStack,withVariation,makeLayer,partFrame}=looks;
 const ids=[...new Set([...GLOBAL_LOOKS.map(l=>l.id),'white-ice-skin','lava-skin','ice-skin','water-skin',...SORT_LOOKS.map(l=>l.id),...SURFACE_EFFECTS.filter(e=>e.category==='Impacts'&&e.cue==='attack').map(e=>e.id)])];
 const entries=[];
 for(const name of ['demo','knight']){
  const model=freshModel(name),frame=partFrame(model.Geosets[0]),donors=donorsFor(model);
  for(const id of ids){
   const look=findLook(id);if(!look)throw Error('Missing look '+id);
   const stacks=[['new',newStack(look,frame,'legacy')],['all',{...newStack(look,frame,'legacy'),layers:look.layers.map((spec,i)=>makeLayer(spec,frame,look.palette,i+1))}]];
   for(const v of look.variations||[])stacks.push(['variation:'+v.id,withVariation(newStack(look,frame,'legacy'),frame,look,v.id)]);
   for(const [kind,stack] of stacks){
    const frozen=JSON.parse(JSON.stringify(stack));
    entries.push({model:name,look:id,kind,stack:frozen,hash:compiledHash(name,frozen,donors)});
   }
  }
 }
 fs.writeFileSync(SNAPSHOT,JSON.stringify({base:'e81e50c9',entries}));
 console.log(entries.length+' frozen stacks written');
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]&&process.argv.includes('--write'))await write();
