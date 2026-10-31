import React,{Suspense,lazy,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import ToolWindow from './ToolWindow.jsx';
import {RangeField,SelectField,Section} from './Fields.jsx';
import {CameraTools} from './EditorControls.jsx';
import {openDocument} from '../src/editor-document.js';
import {emptyParticleModel} from '../src/particle-recipes.js';
import {createResourceImporter} from '../src/model-import.js';
import {applyMovementTransform} from '../src/movement.js';
import {sampleNodeProperty} from '../src/animation.js';
import {standSequenceIndex} from '../src/sequence-editor.js';
import {gamePathKey} from '../src/game-path.js';
import {resolveGameFiles} from './desktop.js';
import {backgroundThumbnail} from './asset-preload-client.js';
import {SURFACE_EFFECTS,EFFECT_SECTIONS,defaultEffectOptions,applySurfaceEffect} from '../src/surface-effects.js';
import './resource-editors.css';
import './surface-effects.css';
const GamePreview=lazy(()=>import('./GamePreview.jsx'));
const categories=['All','Eyes','Skins','Energy','Model','Emitters'];
const cache=new Map();
async function loadEffect(effect){
 if(effect.own)return {model:null,assets:new Map()};
 if(cache.has(effect.id))return cache.get(effect.id);
 const job=(async()=>{
  let model=null,file=null,names=[];
  if(effect.path){
   file=await window.desktop.gameFilesReadPath({path:effect.path,variant:'classic'});
   if(!file)throw Error('Native effect not found. Choose your Warcraft III folder in Settings.');
   model=openDocument(file.bytes,file.name,{allowHD:true}).model;
   const required=emptyParticleModel(model.Version),importer=createResourceImporter(model,required,{reuseTextures:'partKey'});
   if(effect.emitter!=null)importer.textureRef(model.ParticleEmitters2.find(n=>n.ObjectId===effect.emitter)?.TextureID);
   else importer.materialRef(effect.material);
   names=required.Textures.map(t=>t.Image).filter(Boolean);
  }else names=[effect.texture];
  const records=file?(await window.desktop.gameFilesResolve({id:file.id,signature:file.signature,names})).found:await resolveGameFiles(names);
  const assets=new Map();for(const record of records)assets.set(gamePathKey(record.name),{name:record.name,bytes:record.bytes,source:'gameFile'});
  const missing=names.filter(name=>!assets.has(gamePathKey(name)));
  if(missing.length)throw Error('Missing native texture: '+missing[0]);
  let thumbnail=null;if(records[0])thumbnail=await backgroundThumbnail(records[0],'surface-effects:'+effect.id);
  return {model,assets,thumbnail};
 })();cache.set(effect.id,job);
 try{return await job;}catch(error){cache.delete(effect.id);throw error;}
}
export default function SurfaceEffects({doc,edit,initialGeoset,textureAssets,modelPath,preferences,teamColor,sequenceIndex,onPlaced,onClose}){
 const [effectId,setEffectId]=useState('eye'),[category,setCategory]=useState('All'),[loaded,setLoaded]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[thumbs,setThumbs]=useState({}),[previewError,setPreviewError]=useState(''),[ready,setReady]=useState(false);
 const effect=SURFACE_EFFECTS.find(e=>e.id===effectId);
 const [options,setOptions]=useState(()=>({...defaultEffectOptions(effect),geoset:doc.model.Geosets[initialGeoset]?initialGeoset:0}));
 const [playing,setPlaying]=useState(true),[time,setTime]=useState(0),[sequence,setSequence]=useState(()=>sequenceIndex>=0?sequenceIndex:standSequenceIndex(doc.model)),[cameraMode,setCameraMode]=useState('work'),[transform,setTransform]=useState('move'),[original,setOriginal]=useState(false),[solo,setSolo]=useState(false);
 const capture=useRef(null),firstFit=useRef(true),selectionForFit=useRef(null);
 const captureReady=useCallback(api=>{capture.current=api;setReady(false);if(api)api.whenReady().then(()=>{if(capture.current===api){if(firstFit.current){api.fitGeoset(selectionForFit.current);firstFit.current=false;}setReady(true);}},cause=>{if(capture.current===api)setPreviewError(cause.message);});},[]);
 useEffect(()=>{let active=true;(async()=>{for(const entry of SURFACE_EFFECTS.filter(e=>!e.own)){try{const value=await loadEffect(entry);if(!active)return;setThumbs(t=>({...t,[entry.id]:value.thumbnail}));}catch{/* A missing library item reports its error when selected. */}}})();return()=>{active=false;};},[]);
 const update=(key,value)=>setOptions(o=>({...o,[key]:value}));
 useEffect(()=>{
  let active=true;setLoaded(null);setLoading(true);setError('');setPreviewError('');
  loadEffect(effect).then(value=>{if(active){setLoaded(value);setThumbs(t=>({...t,[effect.id]:value.thumbnail}));setLoading(false);}},cause=>{if(active){setError(cause.message);setLoading(false);}});
  return()=>{active=false;};
 },[effect]);
 const graph=useMemo(()=>{
  if(!loaded)return null;
  try{const model=structuredClone(doc.model),result=applySurfaceEffect(model,loaded.model,effect,options);return {model,...result};}
  catch(cause){return {error:cause.message};}
 },[doc,doc.revision,loaded,effect,options]);
 selectionForFit.current=options.geoset;
 const assets=useMemo(()=>new Map([...textureAssets,...loaded?.assets||[]]),[textureAssets,loaded]);
 const choose=entry=>{setEffectId(entry.id);setOptions(o=>({...defaultEffectOptions(entry),geoset:o.geoset}));setOriginal(false);};
 const placed=graph?.anchorId!=null;
 const message=error||graph?.error||previewError;
 const setPlacement=change=>{
  const moved=structuredClone(graph.model);applyMovementTransform(moved,[graph.anchorId],change.time,change.sequenceIndex,change);
  const node=moved.Nodes[graph.anchorId],placement={};
  for(const key of ['Translation','Rotation','Scaling'])placement[key]=Array.from(sampleNodeProperty(moved,node,key,change.time,change.sequenceIndex));
  setOptions(o=>({...o,placement}));return true;
 };
 const apply=()=>{
  if(!graph?.model||message)return;
  const result=edit('Apply '+effect.name,EFFECT_SECTIONS,model=>applySurfaceEffect(model,loaded.model,effect,options));
  if(result===false)return;
  onPlaced(loaded.assets,result?.geoset??options.geoset);onClose();
 };
 const added=graph?.model?['Geosets','Textures','Materials','GlobalSequences'].map(key=>graph.model[key].length-doc.model[key].length):null;
 const previewModel=original?doc.model:graph?.model;
 return <ToolWindow title="Surface Effects" overlayClass="resource-editor surface-effects" className="re-window sfx-window" headerClass="re-caption" closeClass="re-caption-close" onClose={onClose}>
  <div className="sfx-target"><SelectField label="Geoset" value={options.geoset} onChange={value=>setOptions(o=>({...o,geoset:Number(value),placement:defaultEffectOptions(effect).placement}))} options={doc.model.Geosets.map((g,i)=>({value:i,label:'Geoset '+(i+1)+' · '+(g.Vertices.length/3)+' vertices'}))}/><span>{effect.emitter!=null?'Attach particles to this surface':'Choose an effect. Adjust it. Apply.'}</span></div>
  <div className="sfx-body">
   <aside className="sfx-library">
    <div className="sfx-categories" role="group" aria-label="Effect categories">{categories.map(name=><button key={name} aria-pressed={category===name} onClick={()=>setCategory(name)}>{name}</button>)}</div>
    <div className="sfx-cards">{SURFACE_EFFECTS.filter(e=>category==='All'||e.category===category).map(entry=><button key={entry.id} aria-label={entry.name} aria-pressed={effect.id===entry.id} title={entry.description} className="sfx-card" onClick={()=>choose(entry)}><img src={thumbs[entry.id]||'./classic/'+(entry.category==='Eyes'?'btn-magical-sentry':'btn-mana-flare')+'.png'} alt=""/><span>{entry.name}<small>{entry.category==='Model'?'Your textures':entry.category}</small></span></button>)}</div>
   </aside>
   <main className="sfx-center">
    <div className="sfx-stage">
     {previewModel&&!graph?.error&&<Suspense fallback={<span>Preparing preview…</span>}><GamePreview model={previewModel} revision={doc.revision} textureAssets={assets} modelPath={modelPath} preferences={preferences} teamColor={teamColor} presentation={placed?undefined:'preview'} preserveCameraView emptyDragRotates mode="textured" view="perspective" playing={playing} onPlayingChange={setPlaying} time={time} onTimeChange={setTime} sequenceIndex={sequence} playbackSpeed={100} loop showParticles showGrid={false} showAxes={false} isolatedGeosets={solo?[...new Set([options.geoset,graph?.geoset].filter(Number.isInteger))]:undefined} hiddenGeosets={solo?new Set(doc.model.Geosets.map((_,i)=>i).filter(i=>i!==options.geoset&&i!==graph?.geoset)):undefined} cameraMode={cameraMode} selectedNodeIds={placed&&!original?[graph.anchorId]:[]} showNodes={placed&&!original} overlays={{bones:false,nodes:false,particles:false,attachments:false}} transformMode={transform} transformSpace="world" onNodeTransform={placed&&!original?setPlacement:undefined} onCaptureReady={captureReady}/></Suspense>}
     {loading&&<span className="sfx-stage-message" role="status">Loading native effect…</span>}
     {message&&<span className="sfx-stage-message sfx-error" role="alert">{message}</span>}
    </div>
    <div className="sfx-transport"><CameraTools value={cameraMode} onChange={setCameraMode}/><button onClick={()=>setPlaying(v=>!v)}>{playing?'Pause':'Play'}</button><select aria-label="Preview animation" value={sequence} onChange={e=>{setSequence(Number(e.target.value));setTime(doc.model.Sequences[Number(e.target.value)]?.Interval[0]||0);}}>{doc.model.Sequences.map((s,i)=><option key={i} value={i}>{s.Name}</option>)}</select><button aria-pressed={solo} onClick={()=>setSolo(v=>!v)} title="Show only the selected surface and its effect">Solo</button><button onClick={()=>capture.current?.fitGeoset(selectionForFit.current)}>Fit selection</button><button aria-pressed={original} title="Compare with the unchanged model" onClick={()=>setOriginal(v=>!v)}>Original</button></div>
    {placed&&<div className="sfx-placement" role="group" aria-label="Effect placement">{['move','rotate','scale'].map(mode=><button key={mode} aria-pressed={transform===mode} onClick={()=>{setTransform(mode);setPlaying(false);setCameraMode('work');}}>{mode[0].toUpperCase()+mode.slice(1)}</button>)}<span>Drag the preview handles</span><button onClick={()=>update('placement',defaultEffectOptions(effect).placement)}>Reset placement</button></div>}
   </main>
   <aside className="sfx-controls">
    <h3>{effect.name}</h3><p className="sfx-description">{effect.description}</p>
    {effect.emitter==null&&<><div className="sfx-modes" role="group" aria-label="Apply mode">{[['overlay','Overlay'],['replace','Replace'],['new','New geoset']].map(([value,label])=><button key={value} aria-pressed={options.mode===value} onClick={()=>update('mode',value)} title={value==='overlay'?'Add effect layers over the selected skin.':value==='replace'?'Use the effect as the selected surface material.':'Create another surface; keep the selected geoset.'}>{label}</button>)}</div>{options.mode==='new'&&<SelectField label="Shape" value={options.shape} onChange={value=>update('shape',value)} options={[{value:'copy',label:'Copy selected shape'},...(effect.nativeShape!=null?[{value:'native',label:'Native effect surface'}]:[])]}/>}</>}
    <RangeField label="Speed" value={options.speed} min={.25} max={4} step={.05} output={v=>v.toFixed(2)+'×'} onChange={v=>update('speed',v)}/>
    <RangeField label="Visibility" value={options.opacity} min={0} max={1} step={.01} output={v=>Math.round(v*100)+'%'} onChange={v=>update('opacity',v)} title="Effect opacity. Existing geoset visibility is retained."/>
    <label className="sfx-colour" title={effect.emitter!=null?'Tint the native particle colours.':'RGB tint affects the whole selected geoset. New geoset gives the effect an independent tint.'}><span>RGB tint</span><input aria-label="RGB tint" type="color" value={'#'+options.tint.map(n=>Math.round(n*255).toString(16).padStart(2,'0')).join('')} onChange={e=>update('tint',[1,3,5].map(i=>parseInt(e.target.value.slice(i,i+2),16)/255))}/><button onClick={()=>update('tint',[1,1,1])}>Reset</button></label>
    {effect.flow&&<RangeField label="Direction" value={options.direction} min={0} max={360} step={5} output={v=>v+'°'} onChange={v=>update('direction',v)}/>}
    {effect.emitter!=null&&<><RangeField label="Amount" value={options.amount} min={.1} max={3} step={.1} output={v=>v.toFixed(1)+'×'} onChange={v=>update('amount',v)}/><RangeField label="Particle size" value={options.size} min={.1} max={3} step={.1} output={v=>v.toFixed(1)+'×'} onChange={v=>update('size',v)}/></>}
    <Section title="More" defaultOpen={false}>
     <RangeField label={effect.emitter!=null?'Emission pulse':'Visibility pulse'} value={options.pulse} min={0} max={1} step={.05} output={v=>Math.round(v*100)+'%'} onChange={v=>update('pulse',v)} title="How far the effect fades on each loop. Zero keeps its native visibility."/>
     {effect.emitter==null&&<><label><input type="checkbox" checked={options.tintPulse} onChange={e=>update('tintPulse',e.target.checked)}/> Pulse RGB tint</label>{!effect.atlas&&effect.nativeShape==null&&<RangeField label="Texture repeats" value={options.tiling} min={.25} max={4} step={.25} output={v=>v+'×'} onChange={v=>update('tiling',v)}/>}</>}
     {['Red','Green','Blue'].map((label,i)=><RangeField key={label} label={label} value={Math.round(options.tint[i]*255)} min={0} max={255} step={1} output={v=>v} onChange={v=>update('tint',options.tint.map((n,j)=>i===j?v/255:n))}/>)}
    </Section>
   </aside>
  </div>
  <footer className="sfx-footer"><span>{added&&!message?added[0]+' new geosets · '+added[1]+' textures · '+added[2]+' materials · '+added[3]+' loops':'Native Warcraft III paths only'}</span><button onClick={onClose}>Cancel</button><button className="sfx-apply" disabled={loading||!ready||!graph?.model||!!message} onClick={apply}>Apply effect</button></footer>
 </ToolWindow>;
}
