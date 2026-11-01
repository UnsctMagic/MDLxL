import {Buffer} from 'buffer';
import {parseMDL} from 'war3-model';
import {parseMdl} from './mdl-lossless.js';
import {parseMdx} from './mdx-container.js';
import {gamePathKey} from './game-path.js';

/** Read TEXS only; no geometry, document, preview or GPU assets are created. */
export function modelTextureNames(bytes,name){
 const data=Buffer.from(bytes);
 if(!/\.mdx$/i.test(name)){
  const tokens=parseMdl(data).tokens.filter(t=>!['whitespace','line-comment','block-comment'].includes(t.kind));
  const start=tokens.findIndex(t=>t.kind==='identifier'&&t.raw.toString()==='Textures');
  if(start<0)return [];
  let depth=0;
  for(let at=start+1;at<tokens.length;at++){
   const text=tokens[at].raw.toString();if(text==='{')depth++;else if(text==='}'&&--depth===0){
    return (parseMDL(data.subarray(tokens[start].start,tokens[at].end).toString('utf8')).Textures||[]).map(t=>t.Image).filter(Boolean);
   }
  }
  throw Error('The model texture list could not be read.');
 }
 const names=[];
 for(const chunk of parseMdx(data).chunks){
  if(chunk.tag!=='TEXS')continue;
  for(let at=0;at+268<=chunk.data.length;at+=268){
   const image=chunk.data.subarray(at+4,at+264),end=image.indexOf(0),path=image.subarray(0,end<0?image.length:end).toString('utf8');
   if(path)names.push(path);
  }
 }
 return names;
}
const textureKey=record=>record.variant+'|'+gamePathKey(record.sourcePath||record.path).split(':').at(-1);
/** Session cache shared by pickers and the full Library; rejected loads can be retried. */
export function createEntryTextureLists(readModels,readIcon){
 const lists=new Map();
 return (entry,variant,signature)=>{
  const key=signature+'|'+variant+'|'+entry.key;
  if(!lists.has(key)){
   const job=(async()=>{
    const groups=await Promise.all((entry.models||[]).map(model=>readModels(model.path,variant,signature)));
    if(entry.icon){const icon=await readIcon(entry.icon,variant);groups.push([icon||{path:entry.icon,variant}]);}
    const seen=new Set();return groups.flat().filter(record=>{const id=textureKey(record);if(seen.has(id))return false;seen.add(id);return true;});
   })();
   lists.set(key,job);job.catch(()=>lists.delete(key));
  }
  return lists.get(key);
 };
}
const catalogIndexes=new WeakMap();
export function matchEntryTextures(records,catalog){
 let index=catalogIndexes.get(catalog);
 if(!index){index=new Map();for(const item of catalog){for(const path of [item.path,item.sourcePath])if(path){const key=item.variant+'|'+gamePathKey(path).split(':').at(-1);if(!index.has(key))index.set(key,item);}}catalogIndexes.set(catalog,index);}
 const items=[],missing=[],seen=new Set();
 for(const record of records){const item=index.get(textureKey(record));if(!item){missing.push(record.path);continue;}if(!seen.has(item.cacheKey||item.id)){items.push(item);seen.add(item.cacheKey||item.id);}}
 return {items,missing};
}
