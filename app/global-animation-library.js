import {gamePathKey} from '../src/game-path.js';
import {resolveGameFiles} from './desktop.js';

export function globalAssetKey(stack){
 return JSON.stringify([...new Set(stack?.layers.filter(l=>l.enabled!==false).flatMap(l=>[l.image,...l.frames||[],null]).filter(Boolean)||[])].sort());
}
export function createGlobalLibrary(){
 const cached=new Map();
 async function loadOne(name){
  const [file]=await resolveGameFiles([name]);
  if(!file)throw Error('Missing Warcraft texture: '+name);
  return {name,bytes:file.bytes,source:'gameFile'};
 }
 return async(key,assets)=>{
  const result={assets:new Map()};
  await Promise.all(JSON.parse(key).map(async name=>{
   const id=gamePathKey(name);
   if(!cached.has(id))cached.set(id,assets.has(id)?Promise.resolve(assets.get(id)):loadOne(name).catch(e=>{cached.delete(id);throw e;}));
   const value=await cached.get(id);
   result.assets.set(id,value);
  }));
  return result;
 };
}
