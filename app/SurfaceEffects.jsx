import React,{Suspense,lazy,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import ToolWindow from './ToolWindow.jsx';
import {RangeField,SelectField,Section} from './Fields.jsx';
import {CameraTools} from './EditorControls.jsx';
import {applyMovementTransform} from '../src/movement.js';
import {sampleNodeProperty} from '../src/animation.js';
import {standSequenceIndex} from '../src/sequence-editor.js';
import {SURFACE_EFFECTS,EFFECT_SECTIONS,defaultEffectOptions,applySurfaceEffect} from '../src/surface-effects.js';
import {surfacePalette, tintFromHex, hexFromTint} from '../src/surface-effect-colours.js';
import {imageTextureLayers} from '../src/uv-preview.js';
import {createSurfaceLibrary} from './surface-effect-library.js';
import './resource-editors.css';
import './surface-effects.css';
const GamePreview=lazy(()=>import('./GamePreview.jsx'));
const categories=['All',...new Set(SURFACE_EFFECTS.map(effect=>effect.category))];
const overlays={bones:false,nodes:false,particles:false,attachments:false};
const idleSelection=[];

function EffectCard({entry,selected,choose,library,enabled}) {
 const ref=useRef(null), [image,setImage]=useState(null);
 useEffect(()=>{
  if(!enabled||image||entry.own)return;
  let visible=false,active=true;
  const observer=new IntersectionObserver(([item])=>{
   visible=item.isIntersecting;
   if(visible)library.thumbnail(entry,()=>active&&visible).then(url=>{if(active&&url)setImage(url);},
    ()=>{/* Keep the static icon when a thumbnail cannot be decoded. */});
  },{root:ref.current.parentElement});
  observer.observe(ref.current);
  return()=>{active=false;observer.disconnect();};
 },[entry,library,enabled,image]);
 const [u,v,w,h]=entry.thumbnailRect||entry.atlas||[0,0,1,1];
 const crop=image?{width:(100/w)+'%',height:(100/h)+'%',left:(-u/w*100)+'%',top:(-v/h*100)+'%'}:undefined;
 return <button ref={ref} aria-label={entry.name} aria-pressed={selected} title={entry.description} className="sfx-card" onClick={()=>choose(entry)}>
  <span className="sfx-art" style={{'--sfx-tint':image?surfacePalette(entry)[0][1]:'#ffffff'}}><img style={crop} src={image||'./classic/'+(entry.nativeShape!=null?'btn-magical-sentry':'btn-mana-flare')+'.png'} alt=""/></span>
  <span>{entry.name}<small>{entry.own?'Your textures':entry.category}</small></span>
 </button>;
}
function TintPicker({value,onCommit}) {
 const input=useRef(null);
 useEffect(()=>{input.current.value=value;},[value]);
 useEffect(()=>{
  const element=input.current;
  function commit(){onCommit('tint',tintFromHex(element.value));}
  element.addEventListener('change',commit);
  return()=>element.removeEventListener('change',commit);
 },[onCommit]);
 return <input ref={input} type="color" aria-label="RGB tint" title="Choose a custom RGB colour" defaultValue={value}/>;
}
function ColourControl({effect,options,update}) {
 const swatches=surfacePalette(effect), hex=hexFromTint(options.tint);
 const current=swatches.find(([,colour])=>colour===hex);
 const hint=options.mode==='new'?'Tints the new effect surface.':'Tints this geoset, including its base skin.';
 return <div className="sfx-colours">
  <div className="sfx-colour-heading"><strong>Colour</strong><span>{current?.[0]??hex.toUpperCase()}</span></div>
  <div className="sfx-swatches" role="group" aria-label="Colour swatches">
   {swatches.map(([name,colour])=><button key={name} className="sfx-swatch" style={{backgroundColor:colour}} title={name} aria-label={name} aria-pressed={hex===colour} onClick={()=>update("tint",tintFromHex(colour))}>{hex===colour?"✓":""}</button>)}
  </div>
  <div className="sfx-custom-colour"><label>Custom <TintPicker value={hex} onCommit={update}/></label><button aria-label="Reset colour" title="Restore this effect’s preset colour" disabled={hex===swatches[0][1]} onClick={()=>update("tint",tintFromHex(swatches[0][1]))}>Reset</button></div>
  <small>{hint}</small>
 </div>;
}
export default function SurfaceEffects({doc,edit,initialGeoset,textureAssets,modelPath,preferences,teamColor,sequenceIndex,onPlaced,onClose}){
 const [library]=useState(createSurfaceLibrary);
 const [effectId,setEffectId]=useState('eye'),[category,setCategory]=useState('All');
 const [search,setSearch]=useState('');
 const explicitMode=useRef(null);
 const [loaded,setLoaded]=useState(null),[error,setError]=useState(''),[previewError,setPreviewError]=useState(''),[ready,setReady]=useState(false);
 const effect=SURFACE_EFFECTS.find(e=>e.id===effectId);
 const [options,setOptions]=useState(()=>({...defaultEffectOptions(effect),geoset:doc.model.Geosets[initialGeoset]?initialGeoset:0}));
 const [playing,setPlaying]=useState(true),[sequence,setSequence]=useState(()=>sequenceIndex>=0?sequenceIndex:standSequenceIndex(doc.model));
 const [cameraMode,setCameraMode]=useState('work'),[transform,setTransform]=useState('move'),[original,setOriginal]=useState(false),[solo,setSolo]=useState(false);
 const [hovered,setHovered]=useState(null);
 const capture=useRef(null),firstFit=useRef(true),selectionForFit=useRef(initialGeoset);
 const captureReady=useCallback(api=>{
  capture.current=api;setReady(false);
  if(api)api.whenReady().then(()=>{
   if(capture.current!==api)return;
   if(firstFit.current){api.frameGeosets([selectionForFit.current]);firstFit.current=false;}
   setReady(true);
  },cause=>{if(capture.current===api)setPreviewError(cause.message);});
 },[]);
 const update=useCallback((key,value)=>{
  if(key==='mode')explicitMode.current=value;
  setOriginal(false);
  setOptions(o=>key==='tint'?{...o,tint:value,setTint:true}:o[key]===value?o:{...o,[key]:value});
 },[]);
 const geosetOptions=useMemo(()=>doc.model.Geosets.map((g,i)=>{
  const path=imageTextureLayers(doc.model,i)[0]?.path;
  const part=path?.split(/[\\/]/).at(-1)?.replace(/\.[^.]+$/,'');
  return {value:i,label:'Geoset '+(i+1)+' · '+(part||g.Vertices.length/3+' vertices')};
 }),[doc,doc.revision]);
 useEffect(()=>{
  let active=true;setError('');setPreviewError('');
  library.load(effect).then(value=>{if(active)setLoaded({...value,effect});},cause=>{if(active)setError(cause.message);});
  return()=>{active=false;};
 },[library,effect]);
 const loading=loaded?.effect!==effect;
 const graph=useMemo(()=>{
  if(loading)return null;
  try{
   const model=structuredClone(doc.model);
   return {model,...applySurfaceEffect(model,loaded.pack,effect,options,{preview:true})};
  }catch(cause){return {error:cause.message};}
 },[doc,doc.revision,loaded,effect,options,loading]);
 const lastModel=useRef(doc.model);
 if(graph?.model)lastModel.current=graph.model;
 selectionForFit.current=options.geoset;
 const assets=useMemo(()=>new Map([...textureAssets,...(loaded?.assets||[])]),[textureAssets,loaded]);
 const choose=entry=>{
  setOriginal(false);
  if(entry.id===effect.id)return;
  const defaults=defaultEffectOptions(entry);
  setEffectId(entry.id);
  setOptions(o=>({...defaults,mode:explicitMode.current??defaults.mode,geoset:o.geoset}));
 };
 const query=search.trim().toLowerCase();
 const visibleEffects=SURFACE_EFFECTS.filter(e=>(category==='All'||e.category===category)&&(!query||[e.name,e.category,e.description].some(value=>value.toLowerCase().includes(query))));
 const pickGeoset=useCallback(index=>{
  if(!doc.model.Geosets[index])return;
  setOptions(o=>o.geoset===index?o:{...o,geoset:index,placement:defaultEffectOptions(effect).placement});
 },[effect,doc]);
 const placed=graph?.anchorId!=null;
 const selectedNodes=useMemo(()=>placed&&!original?[graph.anchorId]:idleSelection,[placed,original,graph?.anchorId]);
 const isolated=useMemo(()=>solo?[...new Set([options.geoset,original?options.geoset:graph?.geoset].filter(Number.isInteger))]:undefined,[solo,options.geoset,original,graph?.geoset]);
 const hidden=useMemo(()=>isolated?new Set(doc.model.Geosets.map((_,i)=>i).filter(i=>!isolated.includes(i))):undefined,[doc,doc.revision,isolated]);
 const message=error||graph?.error||previewError;
 const setPlacement=change=>{
  const moved=structuredClone(graph.model);applyMovementTransform(moved,[graph.anchorId],change.time,change.sequenceIndex,change);
  const node=moved.Nodes[graph.anchorId],placement={};
  for(const key of ['Translation','Rotation','Scaling'])placement[key]=Array.from(sampleNodeProperty(moved,node,key,change.time,change.sequenceIndex));
  setOptions(o=>({...o,placement}));return true;
 };
 const apply=()=>{
  if(!graph?.model||message)return;
  const result=edit('Apply '+effect.name,EFFECT_SECTIONS,model=>applySurfaceEffect(model,loaded.pack,effect,options));
  if(result===false)return;
  onPlaced(loaded.assets,result?.geoset??options.geoset);onClose();
 };
 const previewModel=original?doc.model:lastModel.current;
 return <ToolWindow title="Surface Effects" overlayClass="resource-editor surface-effects" className="re-window sfx-window" headerClass="re-caption" closeClass="re-caption-close" onClose={onClose}>
  <div className="sfx-target"><SelectField label="Geoset" value={options.geoset} onChange={value=>pickGeoset(Number(value))} options={geosetOptions}/><span>Ctrl-click a surface to select it.</span></div>
  <div className="sfx-body">
   <aside className="sfx-library">
    <input className="sfx-search" type="search" aria-label="Find a surface effect" placeholder="Find an effect…" value={search} onChange={e=>setSearch(e.target.value)}/>
    <div className="sfx-categories" role="group" aria-label="Effect categories">{categories.map(name=><button key={name} aria-pressed={category===name} onClick={()=>setCategory(name)}>{name}</button>)}</div>
    <div className="sfx-cards">{!visibleEffects.length&&<small className="sfx-empty" role="status">No matching effects</small>}{visibleEffects.map(entry=><EffectCard key={entry.id} entry={entry} selected={effect.id===entry.id} choose={choose} library={library} enabled={!!loaded&&ready}/>)}</div>
   </aside>
   <main className="sfx-center">
    <div className="sfx-stage">
     {previewModel&&<Suspense fallback={<span>Preparing preview…</span>}><GamePreview model={previewModel} revision={doc.revision} textureAssets={assets} modelPath={modelPath} preferences={preferences} teamColor={teamColor} presentation={placed?undefined:'preview'} preserveCameraView emptyDragRotates mode="textured" view="perspective" playing={playing} onPlayingChange={setPlaying} time={doc.model.Sequences[sequence]?.Interval[0]??0} sequenceIndex={sequence} playbackSpeed={100} loop showParticles showGrid={false} showAxes={false} interactivePreview highlightSelection hoveredGeoset={hovered} onHoverGeoset={setHovered} onInspectGeoset={pickGeoset} frameKey={solo?'fx:'+options.geoset:undefined} isolatedGeosets={isolated} hiddenGeosets={hidden} cameraMode={cameraMode} selectedNodeIds={selectedNodes} showNodes={placed&&!original} overlays={overlays} transformMode={transform} transformSpace="world" onNodeTransform={placed&&!original?setPlacement:undefined} onCaptureReady={captureReady}/></Suspense>}
     {original&&<span className="sfx-comparison">Original</span>}
     {loading&&!error&&<span className="sfx-stage-message" role="status">Loading native effect…</span>}
     {message&&<span className="sfx-stage-message sfx-error" role="alert">{message}</span>}
    </div>
    <div className="sfx-transport"><CameraTools value={cameraMode} onChange={setCameraMode}/><button onClick={()=>setPlaying(v=>!v)}>{playing?'Pause':'Play'}</button><select aria-label="Preview animation" value={sequence} onChange={e=>setSequence(Number(e.target.value))}>{doc.model.Sequences.map((s,i)=><option key={i} value={i}>{s.Name}</option>)}</select><button aria-pressed={solo} onClick={()=>setSolo(v=>!v)} title="Show only the selected surface and its effect">Solo</button><button onClick={()=>capture.current?.frameGeosets([options.geoset])}>Fit selection</button><button aria-pressed={original} title="Compare with the unchanged model" onClick={()=>setOriginal(v=>!v)}>Original</button></div>
    {placed&&<div className="sfx-placement" role="group" aria-label="Effect placement">{['move','rotate','scale'].map(mode=><button key={mode} aria-pressed={transform===mode} onClick={()=>{setTransform(mode);setPlaying(false);setCameraMode('work');}}>{mode[0].toUpperCase()+mode.slice(1)}</button>)}<span>Drag the preview handles</span><button onClick={()=>update('placement',defaultEffectOptions(effect).placement)}>Reset placement</button></div>}
   </main>
   <aside className="sfx-controls">
    <h3>{effect.name}</h3><p className="sfx-description">{effect.description}</p>
    <><div className="sfx-modes" role="group" aria-label="Apply mode">{[['overlay','Overlay'],['replace','Replace'],['new','New geoset']].map(([value,label])=><button key={value} aria-pressed={options.mode===value} onClick={()=>update('mode',value)} title={value==='overlay'?'Add effect layers over the selected skin.':value==='replace'?'Use the effect as the selected surface material.':'Create another surface; keep the selected geoset.'}>{label}</button>)}</div>{options.mode==='new'&&<SelectField label="Shape" value={options.shape} onChange={value=>update('shape',value)} options={[{value:'copy',label:'Copy selected shape'},...(effect.nativeShape!=null?[{value:'native',label:'Native effect surface'}]:[])]}/>}</>
    <RangeField label="Speed" value={options.speed} min={.25} max={4} step={.05} output={v=>v.toFixed(2)+'×'} onCommit={v=>update('speed',v)}/>
    <RangeField label="Visibility" value={options.opacity} min={0} max={1} step={.01} output={v=>Math.round(v*100)+'%'} onCommit={v=>update('opacity',v)} title="Effect opacity. Existing geoset visibility is retained."/>
    <ColourControl effect={effect} options={options} update={update}/>
    {effect.flow&&<RangeField label="Direction" value={options.direction} min={0} max={360} step={5} output={v=>v+'°'} onCommit={v=>update('direction',v)}/>}
    <Section title="More" defaultOpen={false}>
     <RangeField label="Visibility pulse" value={options.pulse} min={0} max={1} step={.05} output={v=>Math.round(v*100)+'%'} onCommit={v=>update('pulse',v)} title="How far the effect fades on each loop. Zero keeps its native visibility."/>
     <><label><input type="checkbox" checked={options.tintPulse} onChange={e=>update('tintPulse',e.target.checked)}/> Pulse RGB tint</label>{!effect.atlas&&effect.nativeShape==null&&<RangeField label="Texture repeats" value={options.tiling} min={.25} max={4} step={.25} output={v=>v+'×'} onCommit={v=>update('tiling',v)}/>}</>
    </Section>
   </aside>
  </div>
  <footer className="sfx-footer"><button onClick={onClose}>Cancel</button><button className="sfx-apply" disabled={loading||!ready||!graph?.model||!!message} onClick={apply}>Apply effect</button></footer>
 </ToolWindow>;
}
