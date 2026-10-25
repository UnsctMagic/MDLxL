import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {parseCompatibleMdx} from '../../src/mdx-compatibility.js';
import {CascReader} from '../../electron/casc.cjs';
import {thumbnailPixels} from '../../src/texture-thumbnail.js';
const args=Object.fromEntries(Array.from({length:(process.argv.length-2)/2},(_,i)=>[process.argv[i*2+2],process.argv[i*2+3]]));
if(!args['--game']||!args['--work'])throw Error('Pass --game <installation> --work <scratch directory> [--out <docs directory>].');
const game=path.resolve(args['--game']),work=path.resolve(args['--work']),out=path.resolve(args['--out']||'docs');fs.mkdirSync(work,{recursive:true});fs.mkdirSync(out,{recursive:true});
const file=path.join(out,'AI-SD-TEXTURE-CATALOGUE.json'),previous=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{entries:[]};
const reader=new CascReader(game,work),entries=[],failures=[];
try {
 const modelIndex=await reader.list('models'),teamUses=new Map(),seen=new Set();
 const textureKey=s=>String(s).replaceAll('\\','/').toLowerCase().replace(/\.(?:blp|dds)$/,'');
 for(const name of modelIndex.names.filter(n=>!/(?:_hd|_de)\.w3mod:/i.test(n))){
  const bytes=await reader.readKey(modelIndex.keys[name.toLowerCase()]);if(!bytes)continue;
  const hash=crypto.createHash('sha256').update(bytes).digest('hex');if(seen.has(hash))continue;seen.add(hash);
  const model=parseCompatibleMdx(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length));
  for(const material of model.Materials){const layers=material.Layers||[];if(!layers.some(l=>typeof l.TextureID==='number'&&model.Textures[l.TextureID]?.ReplaceableId===1))continue;
   for(const layer of layers){const texture=typeof layer.TextureID==='number'?model.Textures[layer.TextureID]:null;if(!texture?.Image||texture.ReplaceableId)continue;const key=textureKey(texture.Image);teamUses.set(key,(teamUses.get(key)||0)+1);}
  }
 }
 const index=await reader.list('textures');
 const groups=new Map();
 for(const name of index.names.filter(n=>!/(?:_hd|_de)\.w3mod:/i.test(n))) {
  const logical=name.split(':').at(-1); if(!/\.(blp|dds|tga)$/i.test(logical))continue;
  // Keep distinct SD module variants: the full logical module path is part of the identity.
  if(!groups.has(name.toLowerCase()))groups.set(name.toLowerCase(),name);
 }
 for(const name of groups.values()) {
  try {
   const bytes=await reader.readKey(index.keys[name.toLowerCase()]);if(!bytes)throw Error('not available');
   const magic=bytes.toString('ascii',0,4); let width,height,headerAlpha;
   if(/^BLP[12]$/.test(magic)){width=bytes.readUInt32LE(12);height=bytes.readUInt32LE(16);headerAlpha=magic==='BLP2'?bytes[9]>0:bytes.readUInt32LE(8)!==0;}
   else if(magic==='DDS '){height=bytes.readUInt32LE(12);width=bytes.readUInt32LE(16);headerAlpha=!!(bytes.readUInt32LE(80)&1)||['DXT3','DXT5'].includes(bytes.toString('ascii',84,88));}
   else if(/\.tga$/i.test(name)){width=bytes.readUInt16LE(12);height=bytes.readUInt16LE(14);headerAlpha=(bytes[17]&15)>0;}
   else throw Error('unrecognised texture header');
   const logical=name.split(':').at(-1).replaceAll('\\','/');
   let alpha={header:headerAlpha,pixels:'not decoded'};
   try {
    const pixels=thumbnailPixels({name,bytes});
    if(pixels) {let partial=0,transparent=0,minX=width,minY=height,maxX=-1,maxY=-1;
     for(let i=0;i<width*height;i++){const a=pixels.data[i*4+3];if(a<255){partial++;const x=i%width,y=Math.floor(i/width);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}if(a===0)transparent++;}
     alpha={header:headerAlpha,pixels:'measured',nonOpaqueFraction:partial/(width*height),zeroFraction:transparent/(width*height),nonOpaqueRect:maxX<0?null:[minX/width,minY/height,(maxX+1)/width,(maxY+1)/height]};
    }
   }catch{}
   const sha256=crypto.createHash('sha256').update(bytes).digest('hex');
   entries.push({sha256,path:logical,sourcePath:name,width,height,format:magic,alpha,teamColor:teamUses.has(textureKey(logical))?{status:'observed in material with replaceable 1',materialUses:teamUses.get(textureKey(logical)),candidateAlphaRect:alpha.nonOpaqueRect??null,certainty:'Material correlation. Alpha also includes unused padding/cutouts; candidate rectangle is not a proven complete team-colour mask.'}:{status:'not observed in measured model materials; alpha alone does not prove team colour'},description:'Purpose inferred from game path; regions not visually checked',tags:logical.replace(/[\\/_.]/g,' ').replace(/([a-z])([A-Z])/g,'$1 $2').toLowerCase().split(/\s+/),checkedByEye:false,regions:[]});
  } catch(error){failures.push({path:name,error:error.message});}
  if((entries.length+failures.length)%500===0)console.log(JSON.stringify({textures:entries.length,failures:failures.length}));
 }
 const data={schema:1,source:'Installed Warcraft III SD/base texture headers and decoded alpha. Paths only; no texture pixels distributed.',coordinates:'[u0,v0,u1,v1], normalised top-left origin, Warcraft V down. Regions are safe rectangles inside painted islands, not whole anatomical UV unwraps.',entries,failures};
 for(const t of data.entries){const old=previous.entries.find(p=>p.sourcePath===t.sourcePath&&p.sha256===t.sha256&&p.checkedByEye);if(old)for(const key of ['description','tags','regions','checkedByEye','visualMethod'])t[key]=old[key]??t[key];}
 for(const t of data.entries.filter(t=>t.checkedByEye)) {
  const bytes=await reader.read(t.sourcePath),pixels=thumbnailPixels({name:t.path,bytes});if(!pixels)continue;
  for(const r of t.regions){let count=0,nonOpaque=0,zero=0;const [u0,v0,u1,v1]=r.rect;
   for(let y=Math.floor(v0*t.height);y<Math.ceil(v1*t.height);y++)for(let x=Math.floor(u0*t.width);x<Math.ceil(u1*t.width);x++){const a=pixels.data[(y*t.width+x)*4+3];count++;if(a<255)nonOpaque++;if(a===0)zero++;}
   r.alpha={pixels:count,nonOpaqueFraction:nonOpaque/count,zeroFraction:zero/count,note:'Measured alpha inside this rectangle. Solid parts must avoid unintended cutout/padding; team-colour and alpha cards need the matching material.'};
  }
 }
 data.checkedSheets=data.entries.filter(t=>t.checkedByEye).length;data.checkedRegions=data.entries.reduce((s,t)=>s+t.regions.length,0);
 fs.writeFileSync(file,JSON.stringify(data));
 console.log(JSON.stringify({textures:entries.length,failures:failures.length,measuredAlpha:entries.filter(t=>t.alpha.pixels==='measured').length}));
} finally {reader.close();}
