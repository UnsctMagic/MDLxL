import {encodePaintBlp1} from './paint-blp.js';
import {compositePaintTarget} from './paint-project.js';
import {paintProjectModel} from './paint-view.js';
import {decodeBLP,getBLPImageData} from 'war3-model';
import {currentPaintTargetEdited,settleCurrentPaintMaterials} from './paint-current-materials.js';
export {adoptCommittedPaintMaterials} from './paint-current-materials.js';
const encodedTargets=new WeakMap();

/** Prepare every texture before changing the document. Leaving Citadel applies
 * real materials and portable BLP assets, so Vertices and normal model saving
 * show the same paint. Coats remain editable in the separate paint preset.
 * Content-addressed files keep saved models and editor undo independent.
 * Edit the texture saves only the skins whose pixels changed; the rest keep
 * their original texture and material. */
export async function preparePaintModelCommit(model,project,originalModel=model,{encode=encodePaintBlp1}={}){
  const painted=paintProjectModel(model,project,originalModel),assets=[],current=!!project.preserveMaterials,paths=new Map();
  for(const target of project.targets){
    if(!target.bindings.length)continue;
    const version=JSON.stringify([target.revision||0,target.preserveSourceAlpha??true,target.coats.map(c=>[c.visible,c.opacity])]);
    let cached=encode===encodePaintBlp1&&encodedTargets.get(target);
    if(!cached||cached.version!==version){
      const raster=compositePaintTarget(project,target.id);
      if(current&&!currentPaintTargetEdited(target,raster))cached={version,unedited:true};
      else{
        const bytes=await encode(raster,{jpegQuality:95});
        const decoded=getBLPImageData(decodeBLP(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)),0);
        if(decoded.width!==raster.width||decoded.height!==raster.height)throw Error('The painted BLP could not be verified.');
        const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
        cached={version,bytes,hash:Array.from(digest.subarray(0,12),v=>v.toString(16).padStart(2,'0')).join('')};
      }
      if(encode===encodePaintBlp1)encodedTargets.set(target,cached);
    }
    if(cached.unedited)continue;
    const {bytes,hash}=cached;
    const stem=String(target.paintName||target.label||'Texture').replace(/\.[a-z0-9]+$/i,'').replace(/[^a-z0-9_.-]+/gi,'_').replace(/^[^a-z0-9]+/i,'').slice(0,80)||'Texture';
    const name=`MDLxL_Citadel/${stem}_${hash}.blp`;
    if(current)paths.set(target.id,name.replaceAll('/','\\'));
    else painted.Textures[target.textureId]={...painted.Textures[target.textureId],Image:name.replaceAll('/','\\')};
    assets.push({name,bytes,source:'paint'});
  }
  return {model:current?settleCurrentPaintMaterials(painted,model,project,paths,originalModel):painted,assets};
}

// Releasing unused textures/materials renumbers what emitters point at.
const EMITTER_REFERENCES={ParticleEmitters2:'TextureID',RibbonEmitters:'MaterialID'};
export function commitPaintModel(doc,prepared){
  const emitters=Object.keys(EMITTER_REFERENCES).filter(key=>(prepared.model[key]||[]).some((item,i)=>doc.model[key]?.[i]&&item[EMITTER_REFERENCES[key]]!==doc.model[key][i][EMITTER_REFERENCES[key]]));
  return doc.apply('Apply Citadel paint',['Textures','Materials','Geosets',...emitters],model=>{
    model.Textures=structuredClone(prepared.model.Textures);
    model.Materials=structuredClone(prepared.model.Materials);
    model.Geosets=structuredClone(prepared.model.Geosets);
    for(const key of emitters)prepared.model[key].forEach((item,i)=>{if(model[key][i])model[key][i][EMITTER_REFERENCES[key]]=item[EMITTER_REFERENCES[key]];});
  });
}

/** Once the document owns the edited UVs, its UV0 is the next working base.
 * Keeping absolute preset overrides here would erase later edits in UV maps. */
export function adoptCommittedPaintUVs(project){
  let changed=false;
  for(const target of project.targets)for(const binding of target.bindings){if(binding.sourceCoordId){binding.sourceCoordId=0;changed=true;}}
  if(Object.keys(project.uvEdits||{}).length){project.uvEdits={};project.uvRevision=(project.uvRevision||0)+1;changed=true;}
  if(Object.keys(project.geometryEdits||{}).length){project.geometryEdits={};project.uvRevision=(project.uvRevision||0)+1;changed=true;}
  if(changed){project.materialRevision=(project.materialRevision||0)+1;project.revision++;project.dirty=true;}
}
