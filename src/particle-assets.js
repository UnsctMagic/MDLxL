import {Buffer} from 'buffer';
import {safeParticlePath} from './particle-data.js';
export const MAX_PARTICLE_PICTURE_BYTES=4*1024*1024;
const pathKey=value=>String(value||'').replaceAll('/','\\').toLowerCase();
const sameBytes=(a,b)=>a?.bytes&&b?.bytes&&a.bytes.length===b.bytes.length&&a.bytes.every((value,i)=>value===b.bytes[i]);

/** Keep the target's pictures intact when another game build uses the same path. */
export async function prepareParticlePlacementAssets(recipe,incoming,target){
 const assets=new Map(),occupied=new Map([...target].map(([key,asset])=>[pathKey(key),asset]));
 const renames=new Map();
 for(const texture of recipe.native.Textures){
  const key=pathKey(texture.Image);if(!key||assets.has(key)||renames.has(key))continue;
  const asset=incoming.get(key);if(!asset)continue;
  const existing=occupied.get(key);
  if(!existing?.bytes||!asset.bytes||sameBytes(existing,asset)){
   // Retain the target record on identical content, including its save metadata.
   if(!existing?.bytes){assets.set(key,asset);occupied.set(key,asset);}continue;
  }
  const extension=texture.Image.split('.').at(-1).toLowerCase();
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',asset.bytes)),v=>v.toString(16).padStart(2,'0')).join('');
  let name='MDLxL_Forge\\Particle_'+hash.slice(0,32)+'.'+extension;
  // A pre-existing generated name can also contain different bytes.
  for(let suffix=0;occupied.has(pathKey(name))&&!sameBytes(occupied.get(pathKey(name)),asset);suffix++){
   const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(hash+':'+suffix));
   name='MDLxL_Forge\\Particle_'+Array.from(new Uint8Array(digest).subarray(0,16),v=>v.toString(16).padStart(2,'0')).join('')+'.'+extension;
  }
  renames.set(key,name);
  const next={...asset,name,origin:'particle-custom',source:'forge'};
  assets.set(pathKey(name),next);occupied.set(pathKey(name),next);
 }
 if(!renames.size)return {recipe,assets};
 const next=structuredClone(recipe);
 for(const texture of next.native.Textures)texture.Image=renames.get(pathKey(texture.Image))||texture.Image;
 for(const dependency of next.dependencies||[])if(dependency.kind==='texture')dependency.path=renames.get(pathKey(dependency.path))||dependency.path;
 for(const embedded of next.embeddedAssets||[])embedded.path=renames.get(pathKey(embedded.path))||embedded.path;
 return {recipe:next,assets};
}
export function validateParticleAssets(recipe){
 const items=recipe.embeddedAssets||[];
 if(!Array.isArray(items)||items.length>64)throw Error('Too many embedded pictures.');
 let total=0;const seen=new Set();
 for(const item of items){
  if(!item||!safeParticlePath(item.path)||!/^MDLxL_Forge\\Particle_[a-f0-9]{32}\.(png|blp|dds|tga|jpg|jpeg|webp)$/i.test(item.path)||seen.has(item.path.toLowerCase())||typeof item.data!=='string'||item.data.length>Math.ceil(MAX_PARTICLE_PICTURE_BYTES/3)*4||item.data.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(item.data))throw Error('Invalid embedded picture.');
  const length=item.data.length/4*3-(item.data.endsWith('==')?2:item.data.endsWith('=')?1:0);
  if(!length||length>MAX_PARTICLE_PICTURE_BYTES||(total+=length)>8*1024*1024)throw Error('Embedded pictures exceed the portable preset budget.');
  if(!recipe.native.Textures.some(t=>t.Image?.toLowerCase()===item.path.toLowerCase()))throw Error('Embedded picture is not a recipe dependency.');
  seen.add(item.path.toLowerCase());
 }
 return items;
}
export function embeddedParticleAssets(recipe){
 return new Map(validateParticleAssets(recipe).map(item=>[item.path.toLowerCase(),{name:item.path,bytes:new Uint8Array(Buffer.from(item.data,'base64')),origin:'particle-custom'}]));
}
export function includeParticleAssets(recipe,assets){
 const needed=new Set(recipe.native.Textures.map(t=>t.Image?.replaceAll('/','\\').toLowerCase()));
 recipe.embeddedAssets=[...assets.values()].filter(a=>a.origin==='particle-custom'&&needed.has(a.name.toLowerCase())).map(a=>({path:a.name,data:Buffer.from(a.bytes).toString('base64')}));
 validateParticleAssets(recipe);return recipe;
}
