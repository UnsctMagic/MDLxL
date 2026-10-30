import {crc32} from './crc32.js';
import {partMaterialKey} from './bits-and-parts.js';
import {gamePathKey} from './game-path.js';
import {releaseReplaced,usedMaterials,usedTextures} from './uv-preview.js';

/** Current-skin painting keeps the entire authored material, including extra
 * image layers, team colour, animation references and their original UV sets.
 * Private texture/material copies prevent painting a surface from changing a
 * particle or unpainted geoset which happens to reuse the original resource.
 * They exist only while painting; settleCurrentPaintMaterials decides what the
 * model keeps. */
export function enableCurrentPaintMaterials(project,model) {
  const materials=[],byGeoset=new Map();
  for(const target of project.targets)for(const binding of target.bindings){
    if(byGeoset.has(binding.geosetIndex))continue;
    const source=model.Materials[model.Geosets[binding.geosetIndex].MaterialID];
    const entry={materialId:model.Materials.length+materials.length,geosetIndex:binding.geosetIndex,material:structuredClone(source)};
    materials.push(entry);byGeoset.set(binding.geosetIndex,entry);
  }
  const names=new Set();
  project.targets=project.targets.map((target,index)=>{
    const stem=target.paintName||target.label?.replace(/\.[^.]+$/,'')||'Texture';let paintName=stem,suffix=2;
    while(names.has(paintName.toLowerCase()))paintName=stem+' '+suffix++;names.add(paintName.toLowerCase());
    const bindings=target.bindings.map(binding=>({...binding,materialId:byGeoset.get(binding.geosetIndex).materialId}));
    const source=model.Textures[target.textureId];
    return {...target,sourceTextureId:target.textureId,sourceTexture:source?{...source}:undefined,sourceCrc:target.base?crc32(target.base.data):undefined,textureId:model.Textures.length+index,paintName,sourcePath:target.texturePath,citadelCopy:false,basecoat:false,preserveSourceAlpha:false,bindings,materialIds:[...new Set(bindings.map(binding=>binding.materialId))]};
  });
  project.preservedMaterials=materials;project.materialMode=true;project.paintMaterialsVersion=4;
  project.materialRevision=(project.materialRevision||0)+1;project.revision++;project.dirty=true;
  validateCurrentPaintMaterials(project,model);return true;
}

export function validateCurrentPaintMaterials(project,model) {
  const materials=new Map(),geosets=new Set(),textures=new Set(),ids=new Set(),bindings=new Set();
  for(const entry of project.preservedMaterials||[]){
    if(!Number.isInteger(entry.materialId)||entry.materialId<0||entry.materialId>=model.Materials.length+project.preservedMaterials.length||materials.has(entry.materialId)||!Array.isArray(entry.material?.Layers)||!model.Geosets[entry.geosetIndex]||geosets.has(entry.geosetIndex))throw Error('The preset contains an invalid preserved material.');
    materials.set(entry.materialId,entry);geosets.add(entry.geosetIndex);
  }
  for(const target of project.targets){
    if(ids.has(target.id)||textures.has(target.textureId)||!Number.isInteger(target.textureId)||target.textureId<0||target.textureId>=model.Textures.length+project.targets.length)throw Error('The preset contains an invalid paint texture.');
    ids.add(target.id);textures.add(target.textureId);
    for(const binding of target.bindings){
      const entry=materials.get(binding.materialId),geo=project.geometryEdits?.[binding.geosetIndex]||model.Geosets[binding.geosetIndex],uv=geo?.TVertices?.[binding.coordId],key=binding.geosetIndex+':'+binding.layerIndex;
      if(!entry||entry.geosetIndex!==binding.geosetIndex||!Number.isInteger(binding.layerIndex)||!entry.material.Layers[binding.layerIndex]||!uv||uv.length!==geo.Vertices.length/3*2||bindings.has(key))throw Error('The preset contains an invalid current-skin assignment.');
      bindings.add(key);
    }
  }
  return true;
}

export function applyCurrentPaintMaterials(model,project) {
  const Textures=[...model.Textures],Materials=[...model.Materials],Geosets=[...model.Geosets];
  for(const entry of project.preservedMaterials){
    Materials[entry.materialId]=structuredClone(entry.material);
    Geosets[entry.geosetIndex]={...Geosets[entry.geosetIndex],MaterialID:entry.materialId};
  }
  for(const target of project.targets){
    Textures[target.textureId]={Image:target.texturePath,ReplaceableId:0,Flags:target.flags||0};
    for(const binding of target.bindings)Object.assign(Materials[binding.materialId].Layers[binding.layerIndex],{TextureID:target.textureId,CoordId:binding.coordId});
  }
  return {...model,Textures,Materials,Geosets};
}

/** A skin is edited only when its pixels differ from the image Paint opened:
 * an untouched texture, or strokes that were all undone, are not saved again. */
export function currentPaintTargetEdited(target,raster) {
  const a=raster.data,b=target.base.data;
  if(raster.width!==target.base.width||raster.height!==target.base.height||a.length!==b.length)return true;
  for(let i=0;i<a.length;i++)if(a[i]!==b[i])return true;
  return target.sourceCrc!=null&&crc32(b)!==target.sourceCrc;
}

const sameTexture=(a,b)=>!!a&&!!b&&gamePathKey(a.Image||'')===gamePathKey(b.Image||'')&&(a.ReplaceableId||0)===(b.ReplaceableId||0)&&(Number(a.Flags)||0)===(Number(b.Flags)||0);
function sourceTexture(target,model) {
  const texture=model.Textures?.[target.sourceTextureId];
  return texture&&!texture.ReplaceableId&&texture.Image?{...texture}:{Image:target.sourcePath||target.texturePath,ReplaceableId:0,Flags:Number(target.flags)||0};
}

/** Turn the painting copies into the model to keep. `paths` names the saved
 * file of each edited target; every other skin keeps its original texture.
 * Like applyUVPreviews, a material returns to its original when nothing in it
 * changed, reuses an identical one, is edited in place when only painted parts
 * use it, and is copied only to keep an unpainted sharer unchanged. Paint
 * slots and whatever only they used are released. */
export function settleCurrentPaintMaterials(painted,base,project,paths,originalModel=null) {
  const slots=new Set(project.preservedMaterials.map(entry=>entry.materialId)),textureSlots=new Set(project.targets.map(target=>target.textureId));
  const model={...painted,Textures:painted.Textures.slice(0,base.Textures.length),Materials:structuredClone(painted.Materials.slice(0,base.Materials.length)),Geosets:painted.Geosets.map(geo=>({...geo}))};
  for(const key of ['RibbonEmitters','ParticleEmitters2'])if(painted[key])model[key]=painted[key].map(item=>({...item}));
  // Saved working models from older presets may already hold the paint slots.
  const usable=(id,limit)=>Number.isInteger(id)&&!(id<limit&&slots.has(id));
  const textureFor=texture=>{const found=model.Textures.findIndex((t,i)=>!(i<base.Textures.length&&textureSlots.has(i))&&sameTexture(t,texture));return found>=0?found:model.Textures.push({...texture})-1;};
  const resolved=new Map();
  for(const target of project.targets){
    if(!target.bindings.length)continue;
    const source=target.sourceTexture||=sourceTexture(target,base);
    resolved.set(target.id,textureFor(paths.has(target.id)?{Image:paths.get(target.id),ReplaceableId:0,Flags:Number(target.flags)||0}:source));
  }
  let original;
  const priorMaterial=geosetIndex=>{
    let id=base.Geosets[geosetIndex]?.MaterialID;
    if(!usable(id,base.Materials.length)){original??=typeof originalModel==='function'?originalModel():originalModel;id=original?.Geosets?.[geosetIndex]?.MaterialID;}
    return usable(id,base.Materials.length)&&model.Materials[id]?id:null;
  };
  const materialKey=value=>{try{return partMaterialKey(model,value);}catch{return null;}},groups=new Map();
  for(const entry of project.preservedMaterials){
    const material=structuredClone(painted.Materials[entry.materialId]);
    for(const target of project.targets)for(const binding of target.bindings)if(binding.geosetIndex===entry.geosetIndex)material.Layers[binding.layerIndex].TextureID=resolved.get(target.id);
    const prior=priorMaterial(entry.geosetIndex),key=materialKey(material),id=prior+'|'+(key??'part:'+entry.geosetIndex);
    if(!groups.has(id))groups.set(id,{prior,key,material,geosets:[]});
    groups.get(id).geosets.push(model.Geosets[entry.geosetIndex]);
  }
  const assign=(group,id)=>{for(const geo of group.geosets)geo.MaterialID=id;group.done=true;};
  for(const group of groups.values()){
    if(group.key==null)continue;
    const id=group.prior!=null&&materialKey(model.Materials[group.prior])===group.key?group.prior:model.Materials.findIndex((m,i)=>m&&usable(i,base.Materials.length)&&materialKey(m)===group.key);
    if(id>=0)assign(group,id);
  }
  const owners=[...model.Geosets,...(model.RibbonEmitters||[])];
  for(const group of groups.values())if(!group.done&&group.prior!=null&&owners.every(owner=>owner.MaterialID!==group.prior)){model.Materials[group.prior]=group.material;assign(group,group.prior);}
  for(const group of groups.values()){
    if(group.done)continue;
    const same=group.key==null?-1:model.Materials.findIndex((m,i)=>m&&usable(i,base.Materials.length)&&materialKey(m)===group.key);
    assign(group,same>=0?same:model.Materials.push(group.material)-1);
  }
  const before={Materials:structuredClone(base.Materials),ParticleEmitters2:(base.ParticleEmitters2||[]).map(item=>({...item}))};
  releaseReplaced(model,usedMaterials(base),usedTextures(before),base.Textures.length);
  return model;
}

/** After Apply the document owns the settled skins and materials, so the
 * painting slots move past its end again and copy the materials as they are
 * now. Undo snapshots of surface changes follow the same ids. */
export function adoptCommittedPaintMaterials(project,model) {
  if(!project?.preserveMaterials||!project.materialMode||!Array.isArray(project.preservedMaterials))return false;
  const materialIds=new Map(),textureIds=new Map();let changed=false;
  const layers=geosetIndex=>project.targets.flatMap(target=>target.bindings).filter(binding=>binding.geosetIndex===geosetIndex).map(binding=>binding.layerIndex);
  project.preservedMaterials=project.preservedMaterials.map((entry,k)=>{
    const materialId=model.Materials.length+k,current=model.Materials[model.Geosets[entry.geosetIndex]?.MaterialID];
    const material=current&&layers(entry.geosetIndex).every(index=>current.Layers?.[index])?structuredClone(current):entry.material;
    if(materialId!==entry.materialId||JSON.stringify(material)!==JSON.stringify(entry.material))changed=true;
    materialIds.set(entry.materialId,materialId);return {...entry,materialId,material};
  });
  project.targets.forEach((target,index)=>{textureIds.set(target.textureId,model.Textures.length+index);if(target.textureId!==model.Textures.length+index)changed=true;});
  const remap=target=>{
    if(!target)return;target.textureId=textureIds.get(target.textureId)??target.textureId;
    target.bindings=target.bindings.map(binding=>({...binding,materialId:materialIds.get(binding.materialId)??binding.materialId}));target.materialIds=[...new Set(target.bindings.map(binding=>binding.materialId))];
  };
  for(const target of project.targets)remap(target);
  for(const entry of [...project.history?.undo||[],...project.history?.redo||[]])if(entry.kind==='surface')for(const state of [entry.before,entry.after]){for(const target of state?.targets||[])remap(target);remap(state?.target);}
  // A saved preset still matches its own saved working model, so not dirty.
  if(changed){project.materialRevision=(project.materialRevision||0)+1;project.revision++;}
  return changed;
}

export function assignCurrentPaintMaterial(project,target,indices) {
  const choices=indices.map(geosetIndex=>{
    const binding=project.targets.flatMap(t=>t.bindings).filter(b=>b.geosetIndex===geosetIndex).sort((a,b)=>a.layerIndex-b.layerIndex)[0];
    if(!binding)throw Error('This part has no existing image layer to replace.');
    return {...binding};
  });
  const keys=new Set(choices.map(b=>b.geosetIndex+':'+b.layerIndex));
  for(const item of project.targets){
    item.bindings=item.bindings.filter(b=>!keys.has(b.geosetIndex+':'+b.layerIndex));
    if(item===target)item.bindings.push(...choices);
    item.geosetIndices=[...new Set(item.bindings.map(b=>b.geosetIndex))];item.materialIds=[...new Set(item.bindings.map(b=>b.materialId))];item.sharedUV=item.bindings.length>1;
  }
  project.activeTargetId=target.id;project.materialRevision=(project.materialRevision||0)+1;project.revision++;project.dirty=true;return target;
}
