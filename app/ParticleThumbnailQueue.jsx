import {embeddedParticleAssets} from '../src/particle-assets.js';
import {repointStarterTextures} from '../src/particle-starters.js';
import React,{Suspense,lazy,useEffect,useRef,useState} from 'react';
import {parseParticleData} from '../src/particle-data.js';
import {particleRecipeDocument} from '../src/particle-recipes.js';
import {activeParticleSample} from '../src/particle-sampling.js';
import { capturePreviewThumbnail } from './game-preview-capture.js';
import { gamePathKey } from '../src/game-path.js';
import {prepareParticleLibraryMotion} from '../src/particle-library-motion.js';
const GamePreview=lazy(()=>import('./GamePreview.jsx'));
export async function loadParticlePreview(item,{ribbonOnly=false}={}){
  const recipe=parseParticleData(await window.desktop.particleRead(item.id));
  if(ribbonOnly&&!recipe.native?.RibbonEmitters?.length)return null;
  const doc=particleRecipeDocument(recipe),assets=embeddedParticleAssets(recipe);
  repointStarterTextures(doc.model);
  const names=doc.model.Textures.filter(t=>t.Image&&!assets.has(gamePathKey(t.Image))).map(t=>t.Image),sourceKey=recipe.sources?.find(source=>source.buildKey)?.buildKey;
  const records=sourceKey?await window.desktop.particleAssets({sourceKey,dependencies:recipe.dependencies.filter(dep=>names.includes(dep.path))}):await window.desktop.resolveTextures({names});
  for(const record of records||[])if(record.bytes)assets.set(gamePathKey(record.name),record);
  const sample=item.previewSample||activeParticleSample(doc.model.RibbonEmitters?.length?{...doc.model,ParticleEmitters2:[]}:doc.model),demonstration=prepareParticleLibraryMotion(doc.model,sample);
  const selectedId=doc.model.RibbonEmitters?.[0]?.ObjectId,sweepRange=selectedId!=null?Array.from(doc.model.Sequences[sample.sequence].Interval):undefined;
  return {id:item.id,model:doc.model,assets,...sample,demonstration,selectedId,sweepRange};
}
export default function ParticleThumbnailQueue({items,preferences,onThumbnail,onFailure}) {
  const [current,setCurrent]=useState(null),pending=useRef(new Set()),mounted=useRef(true),loading=useRef(false);
  useEffect(()=>()=>{mounted.current=false;},[]);
  useEffect(()=>{
    if(current||loading.current)return;
    const item=items.find(item=>!item.empty&&!item.thumbnail&&!item.previewError&&!pending.current.has(item.id)&&!item.blocked);
    if(!item)return;
    pending.current.add(item.id);loading.current=true;
    (async()=>{
      const cached=await window.desktop.particleThumbnails([item.id]);if(cached[item.id]?.url){pending.current.delete(item.id);if(mounted.current)onThumbnail(item.id,cached[item.id].url);return;}
      const preview=await loadParticlePreview(item,{ribbonOnly:!!item.unsupported?.length});
      if(mounted.current)setCurrent(preview?{...preview,revision:cached[item.id]?.revision}:{skipped:true,id:item.id});
    })().catch(error=>{pending.current.delete(item.id);if(mounted.current){onFailure?.(item.id,error.message);setCurrent({failed:true,id:item.id});}}).finally(()=>{loading.current=false;});
  },[items,current]);
  useEffect(()=>{if(current?.failed||current?.skipped)setCurrent(null);},[current]);
  const capture=useRef(false);
  async function ready(api){
    if(!api||capture.current||!current)return;capture.current=true;
    try{
      const url=await capturePreviewThumbnail(api,{maxDimension:256});
      await window.desktop.particleThumbnail({id:current.id,url,revision:current.revision});
      if(mounted.current)onThumbnail(current.id,url);
    }catch(error){if(mounted.current)onFailure?.(current.id,error.message);}
    finally{pending.current.delete(current.id);capture.current=false;if(mounted.current)setCurrent(null);}
  }
  if(!current||current.failed||current.skipped)return null;
  const previewPreferences={...preferences,graphics:{...preferences.graphics,pauseWhenHidden:false},viewportAppearance:{...preferences.viewportAppearance,background:{type:'color',color:'#24282c'}}};
  return <div className="pe-thumbnail-renderer" aria-hidden="true"><Suspense fallback={null}><GamePreview key={current.id} presentation="preview" model={current.model} revision={0} textureAssets={current.assets} preferences={previewPreferences} particleAuthoring particleSelectedId={current.selectedId} particleSweepRange={false} sequenceIndex={current.sequence} time={current.time} playing={false} showParticles showGrid={false} mode="textured" view="perspective" overlays={{bones:false,nodes:false,particles:false,attachments:false}} onCaptureReady={ready}/></Suspense></div>;
}
