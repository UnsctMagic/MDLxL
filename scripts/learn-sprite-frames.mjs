// Learns how the game's own effects use each sprite sheet: grid and frame setups per picture.
// Usage: node scripts/learn-sprite-frames.mjs [Warcraft III folder]
// Writes src/sprite-sheet-frames.json. Only facts (grids, frame numbers, model names) are kept; no game files.
import fs from 'node:fs/promises';
import path from 'node:path';
import {repoRoot as root} from './lib/paths.mjs';
import {gameFolder} from '../test/helpers/fixtures.cjs';
import {createRequire} from 'node:module';
import {openDocument} from '../src/editor-document.js';
const require=createRequire(import.meta.url);
const {CascReader}=require('../electron/casc.cjs');
const folder=process.argv[2]||await gameFolder();
const key=name=>String(name||'').replaceAll('/','\\').toLowerCase();
const range=value=>Array.from(value||[0,0,1]);

const reader=new CascReader(folder,root),sheets=new Map();let models=0,emitters=0,failed=0;
try{
 const inventory=await reader.list('models');
 const names=inventory.names.filter(name=>/\.mdx$/i.test(name)&&!/(?:^|:)_(?:hd|de)\.w3mod:/i.test(name));
 for(const [i,name] of names.entries()){
  if(i%500===0)console.error(`${i}/${names.length} models, ${emitters} emitters`);
  let model;
  try{const bytes=inventory.keys[name.toLowerCase()]?await reader.readKey(inventory.keys[name.toLowerCase()]):await reader.read(name);if(!bytes)continue;model=openDocument(new Uint8Array(bytes),name.split(':').pop()).model;}catch{failed++;continue;}
  models++;
  for(const p of model.ParticleEmitters2||[]){
   const texture=model.Textures?.[p.TextureID];if(!texture?.Image||texture.ReplaceableId)continue;
   emitters++;
   const rows=Math.max(1,p.Rows||1),columns=Math.max(1,p.Columns||1),streak=!!(p.FrameFlags&2);
   const setup={rows,columns,life:range(p.LifeSpanUVAnim),decay:range(p.DecayUVAnim),...(streak?{tail:range(p.TailUVAnim),tailDecay:range(p.TailDecayUVAnim)}:{})};
   const id=JSON.stringify(setup),entry=sheets.get(key(texture.Image))||{texture:texture.Image,uses:0,setups:new Map()};
   entry.uses++;const known=entry.setups.get(id)||{...setup,uses:0,examples:[]};known.uses++;
   const example=name.split(':').pop().split(/[\\/]/).pop().replace(/\.mdx$/i,'');if(known.examples.length<3&&!known.examples.includes(example))known.examples.push(example);
   entry.setups.set(id,known);sheets.set(key(texture.Image),entry);
  }
 }
}finally{reader.close();}

// Keep sprite sheets only (the game splits them into frames), most used setups first.
const catalog={};
for(const [path_,entry] of [...sheets].sort((a,b)=>a[0].localeCompare(b[0]))){
 const setups=[...entry.setups.values()].sort((a,b)=>b.uses-a.uses);
 if(!setups.some(setup=>setup.rows*setup.columns>1))continue;
 catalog[path_]={uses:entry.uses,setups:setups.filter(setup=>setup.rows*setup.columns>1).slice(0,6)};
}
const out=path.join(root,'src','sprite-sheet-frames.json');
await fs.writeFile(out,JSON.stringify({source:'Frame setups used by the game\'s own SD particle effects (grids and frame numbers only).',models,emitters,sheets:catalog},null,1)+'\n');
console.error(`Done: ${models} models, ${emitters} particle emitters, ${Object.keys(catalog).length} sprite sheets, ${failed} unreadable. Wrote ${out}`);
