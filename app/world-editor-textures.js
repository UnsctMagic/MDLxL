import {createEntryTextureLists,modelTextureNames} from '../src/world-editor-textures.js';

// Resolve metadata through the same module-first path as model previews, without
// reading/decoding all the pictures before the visible tiles request thumbnails.
export const entryTextureList=createEntryTextureLists(async(path,variant,signature)=>{
 const file=await window.desktop.gameFilesReadPath({path,variant});
 if(!file)return [];
 const names=modelTextureNames(file.bytes,file.name);
 if(!names.length)return [];
 const resolved=await window.desktop.gameFilesResolve({id:file.id,signature:file.signature||signature,names,metadataOnly:true});
 return [...resolved.found,...resolved.missing.map(path=>({path,variant}))].sort((a,b)=>names.indexOf(a.name||a.path)-names.indexOf(b.name||b.path));
},(path,variant)=>window.desktop.gameFilesFindPath({path,variant}));
