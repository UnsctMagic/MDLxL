import React,{useEffect,useState} from 'react';
import {File} from 'lucide-react';
import {decodeTextureThumbnail} from '../src/texture-thumbnail.js';
import {createThumbnailQueue} from '../src/texture-library-session.js';
// Small icons for tree rows: decoded once per session, a few at a time.
const iconQueue=createThumbnailQueue({concurrency:3}),icons=new Map();
function loadIcon(key,read,size=48){
  if(!icons.has(key)){
    const job=iconQueue(key,async()=>{const file=await read();return file?.bytes?.length?decodeTextureThumbnail({name:file.name||key,bytes:file.bytes},size):null;}).catch(()=>null);
    icons.set(key,job);if(icons.size>6000)icons.delete(icons.keys().next().value);
  }
  return icons.get(key);
}
export default function GameIcon({iconKey,read,fallback:Fallback=File,size=16}){
  const [url,setUrl]=useState(null);
  useEffect(()=>{let active=true;setUrl(null);if(iconKey&&read)loadIcon(iconKey,read,Math.max(48,size)).then(value=>{if(active)setUrl(value);});return()=>{active=false;};},[iconKey]);
  return url?<img className="gf-icon" src={url} alt="" width={size} height={size} draggable={false}/>:<Fallback size={size-1} aria-hidden="true" className="gf-icon-glyph"/>;
}

// Folder icons for the World Editor view's top level, taken from the game's own buttons.
export const FOLDER_ICONS={Human:'ReplaceableTextures\\CommandButtons\\BTNFootman.blp',Orc:'ReplaceableTextures\\CommandButtons\\BTNGrunt.blp','Night Elf':'ReplaceableTextures\\CommandButtons\\BTNArcher.blp',Undead:'ReplaceableTextures\\CommandButtons\\BTNGhoul.blp',Naga:'ReplaceableTextures\\CommandButtons\\BTNNagaMyrmidon.blp','Neutral Hostile':'ReplaceableTextures\\CommandButtons\\BTNFurbolg.blp','Neutral Passive':'ReplaceableTextures\\CommandButtons\\BTNSheep.blp',Items:'ReplaceableTextures\\CommandButtons\\BTNChestOfGold.blp',Doodads:'ReplaceableTextures\\WorldEditUI\\Doodad-Prop.blp'};
