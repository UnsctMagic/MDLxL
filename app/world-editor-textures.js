import {createEntryTextureLists,modelTextureNames} from '../src/world-editor-textures.js';

// Resolve metadata through the same module-first path as model previews, without
// reading/decoding all the pictures before the visible tiles request thumbnails.
export const entryTextureList=createEntryTextureLists(async(path,variant,signature)=>{
 const entry=await window.desktop.gameFilesFindPath({path,variant});
 if(!entry)return [];
 const file=await window.desktop.gameFilesRead({id:entry.id,signature});
 const names=modelTextureNames(file.bytes,entry.name);
 if(!names.length)return [];
 const resolved=await window.desktop.gameFilesResolve({id:entry.id,signature,names,metadataOnly:true});
 return [...resolved.found,...resolved.missing.map(path=>({path,variant}))].sort((a,b)=>names.indexOf(a.name||a.path)-names.indexOf(b.name||b.path));
},(path,variant)=>window.desktop.gameFilesFindPath({path,variant}));
