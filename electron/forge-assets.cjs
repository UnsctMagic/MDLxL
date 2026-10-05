const fs=require('node:fs/promises'),path=require('node:path');
/** Generated assets and Bitz textures stay at their declared relative paths. */
async function saveForgeAssets(modelPath,assets=[]){
 if(!Array.isArray(assets)||assets.length>2048)throw Error('Invalid Forge texture list.');
 const prepared=[];let total=0;
 for(const asset of assets){
  const name=String(asset?.name||'').replaceAll('\\','/');
  const originalPart=asset?.source==='parts'&&/\.(blp|dds|tga|png|jpg|jpeg|webp)$/i.test(name)&&name.split('/').every(segment=>segment&&!/[<>:"|?*\x00-\x1f]/.test(segment)&&!/[. ]$/.test(segment)&&!/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(segment));
  if(!originalPart&&!/^MDLxL_(?:Forge|Parts|Citadel)\/[a-z0-9][a-z0-9_.-]{0,200}\.(blp|dds|tga)$/i.test(name))throw Error('Imported textures need a supported filename at a relative texture path.');
  const bytes=Buffer.from(asset.bytes||[]);total+=bytes.length;
  if(!bytes.length||bytes.length>64*1024*1024||total>256*1024*1024)throw Error('Forge texture data exceeds the save limit.');
  prepared.push({file:path.resolve(path.dirname(modelPath),...name.split('/')),bytes});
 }
 if(!prepared.length)return;
 const root=path.dirname(path.resolve(modelPath));
 for(const folder of new Set(prepared.map(item=>path.dirname(item.file)))) {
  let directory=root;
  for(const segment of path.relative(root,folder).split(path.sep).filter(Boolean)){
   directory=path.join(directory,segment);
   await fs.mkdir(directory,{recursive:true});
   const realParent=await fs.realpath(path.dirname(directory)),realDir=await fs.realpath(directory);
   if(path.dirname(realDir).toLowerCase()!==realParent.toLowerCase()||(await fs.lstat(directory)).isSymbolicLink())throw Error('The imported texture folder must be beside the model.');
  }
 }
 for(const {file,bytes} of prepared){
  try{const info=await fs.lstat(file);if(!info.isFile()||info.isSymbolicLink())throw Error('The Forge texture destination is not a regular file.');const existing=await fs.readFile(file);if(!existing.equals(bytes))throw Error('A different texture already exists at the Forge texture path.');}
  catch(error){if(error.code!=='ENOENT')throw error;await fs.writeFile(file,bytes,{flag:'wx'});}
 }
}
module.exports={saveForgeAssets};
