import {openDocument} from '../src/editor-document.js';
import {prepareSurfacePackage,SURFACE_EFFECTS} from '../src/surface-effects.js';
import {gamePathKey} from '../src/game-path.js';
import {resolveGameFiles} from './desktop.js';
import {backgroundThumbnail} from './asset-preload-client.js';
import {createThumbnailQueue} from '../src/texture-library-session.js';

function memo(cache,key,load) {
  if (!cache.has(key)) cache.set(key,load().catch(error=>{cache.delete(key);throw error;}));
  return cache.get(key);
}

// The window owns these caches. Keep the compact material packages, and release the
// decoded donor and its bytes as soon as the requested variants have been collected.
export function createSurfaceLibrary() {
  const paths=new Map(), effects=new Map(), thumbnails=new Map();
  const thumbnailQueue=createThumbnailQueue({concurrency:1});
  const sourceKey=effect=>'classic:'+gamePathKey(effect.path||effect.texture||'');
  const variantKey=effect=>[effect.material,effect.nativeShape].join(':');
  async function readPackages(effect) {
    const file=await window.desktop.gameFilesReadPath({path:effect.path,variant:'classic'});
    if(!file)throw Error('Native effect not found. Choose your Warcraft III folder in Settings.');
    const model=openDocument(file.bytes,file.name,{allowHD:true}).model;
    const packages=new Map();
    for(const entry of SURFACE_EFFECTS.filter(e=>e.path&&sourceKey(e)===sourceKey(effect))) {
      if(!packages.has(variantKey(entry)))packages.set(variantKey(entry),prepareSurfacePackage(model,entry));
    }
    return {id:file.id,signature:file.signature,packages};
  }
  async function load(effect) {
    if(effect.own)return {pack:null,assets:new Map()};
    const key=sourceKey(effect);
    return memo(effects,key+':'+variantKey(effect),async()=>{
      const source=effect.path&&await memo(paths,key,()=>readPackages(effect));
      const pack=source?source.packages.get(variantKey(effect)):null;
      const names=pack?pack.Textures.map(t=>t.Image).filter(Boolean):[effect.texture];
      const records=source?(await window.desktop.gameFilesResolve({id:source.id,signature:source.signature,names})).found:await resolveGameFiles(names);
      const assets=new Map(records.map(record=>[gamePathKey(record.name),{name:record.name,bytes:record.bytes,source:'gameFile'}]));
      const missing=names.find(name=>!assets.has(gamePathKey(name)));
      if(missing)throw Error('Missing native texture: '+missing);
      return {pack,assets};
    });
  }
  function thumbnail(effect,isVisible) {
    const name=effect.picture||effect.texture;
    if(!name)return Promise.resolve(null);
    return thumbnailQueue(name,async()=>{
      if(!isVisible())return null;
      return memo(thumbnails,name,async()=>{
        const [record]=await resolveGameFiles([name]);
        return record?backgroundThumbnail(record):null;
      });
    });
  }
  return {load,thumbnail};
}
