import {gamePathKey} from '../src/game-path.js';
import {openDocument} from '../src/editor-document.js';
import {runePath} from '../src/global-animation-looks.js';
import {resolveGameFiles} from './desktop.js';

export function globalAssetKey(stack){
 return JSON.stringify([...new Set(stack?.layers.flatMap(l=>[l.image,...l.frames||[],l.type==='Rune'?runePath:null]).filter(Boolean)||[])].sort());
}
export function createGlobalLibrary(){
 const cached=new Map();
 async function loadOne(name){
  if(name===runePath){
   const file=await window.desktop.gameFilesReadPath({path:name,variant:'classic'});
   if(!file)throw Error('Choose your Warcraft III folder to load the native rune.');
   return openDocument(file.bytes,file.name,{allowHD:true}).model;
  }
  const [file]=await resolveGameFiles([name]);
  if(!file)throw Error('Missing Warcraft texture: '+name);
  return {name,bytes:file.bytes,source:'gameFile'};
 }
 return async(key,assets)=>{
  const result={assets:new Map(),rune:null};
  await Promise.all(JSON.parse(key).map(async name=>{
   const id=gamePathKey(name);
   if(!cached.has(id))cached.set(id,assets.has(id)?Promise.resolve(assets.get(id)):loadOne(name).catch(e=>{cached.delete(id);throw e;}));
   const value=await cached.get(id);
   if(name===runePath)result.rune=value;else result.assets.set(id,value);
  }));
  return result;
 };
}
