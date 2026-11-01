import React,{Suspense,lazy,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import ToolWindow from './ToolWindow.jsx';
import {RangeField,SelectField} from './Fields.jsx';
import {CameraTools} from './EditorControls.jsx';
import GlobalAnimationControls from './GlobalAnimationControls.jsx';
import GlobalAnimationStage from './GlobalAnimationStage.jsx';
import {GLOBAL_LOOKS,findLook,newStack,partFrame} from '../src/global-animation-looks.js';
import {animationPart,compileAnimation,readAnimationStack,FX_SECTIONS} from '../src/global-animation-model.js';
import {globalAssetKey,createGlobalLibrary} from './global-animation-library.js';
import VisualEffectStage from './VisualEffectStage.jsx';
import {translate} from '../src/localization.js';
import {matchesVisualEffect} from '../src/visual-effect-recipes.js';
import {effectSequence} from '../src/visual-effect-composition.js';
import './particle-editor.css';
import {standSequenceIndex} from '../src/sequence-editor.js';
import {SURFACE_EFFECTS,EFFECT_SECTIONS,defaultEffectOptions,applySurfaceEffect} from '../src/surface-effects.js';
import {surfacePalette, tintFromHex, hexFromTint} from '../src/surface-effect-colours.js';
import {imageTextureLayers} from '../src/uv-preview.js';
import {createSurfaceLibrary} from './surface-effect-library.js';
import './resource-editors.css';
import './surface-effects.css';
const GamePreview=lazy(()=>import('./GamePreview.jsx'));
const categories=['All','Energy streaks','Auras','Ambient','Weapons','Impacts','Buffs & curses','Skins','Terrain','Model'];
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
  <span className="sfx-art" style={{'--sfx-tint':image?surfacePalette(entry)[0][1]:'#ffffff'}}><img style={crop} src={image||'./classic/'+'btn-mana-flare'+'.png'} alt=""/></span>
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
function ColourControl({effect,options,update,hint:layerHint}) {
 const swatches=surfacePalette(effect), hex=hexFromTint(options.tint);
 const current=swatches.find(([,colour])=>colour===hex);
 const hint=layerHint??(effect.cue?'Colours the flash and particles during the chosen animation.':options.mode==='new'?'Tints the new surface.':'Tints the selected part, including its skin.');
 return <div className="sfx-colours" title={hint+(effect.accents?.length?" Its attached effect uses the same colour.":"")}>
  <div className="sfx-colour-heading"><strong>Colour</strong><span>{current?.[0]??hex.toUpperCase()}</span></div>
  <div className="sfx-swatches" role="group" aria-label="Colour swatches">
   {swatches.map(([name,colour])=><button key={name} className="sfx-swatch" style={{backgroundColor:colour}} title={'Use '+name+' on this effect.'} aria-label={name} aria-pressed={hex===colour} onClick={()=>update("tint",tintFromHex(colour))}>{hex===colour?"✓":""}</button>)}
  </div>
  <div className="sfx-custom-colour"><label title="Choose any colour for this effect.">Custom <TintPicker value={hex} onCommit={update}/></label><button aria-label="Reset colour" title="Restore this effect’s preset colour" disabled={hex===swatches[0][1]} onClick={()=>update("tint",tintFromHex(swatches[0][1]))}>Reset</button></div>
  <small>{hint}</small>
 </div>;
}
export default function SurfaceEffects({doc,edit,initialGeoset,textureAssets,modelPath,preferences,teamColor,sequenceIndex,onPlaced,onOpenEmitter,onClose}){
 const [library]=useState(createSurfaceLibrary);
 const [effectId,setEffectId]=useState('fire'),[category,setCategory]=useState('All');
 const [search,setSearch]=useState('');
 const [initialPart]=useState(()=>animationPart(doc.model,doc.model.Geosets[initialGeoset]?initialGeoset:0));
 const [stack,setStack]=useState(()=>readAnimationStack(doc.model,initialPart));
 const [selectedLayer,selectLayer]=useState(()=>stack?.layers[0]?.id);
 const [loadGlobal]=useState(()=>createGlobalLibrary());
 const assetKey=stack?globalAssetKey(stack):null;
 const explicitMode=useRef(null);
 const [loaded,setLoaded]=useState(null),[error,setError]=useState(''),[previewError,setPreviewError]=useState(''),[ready,setReady]=useState(false);
 const effect=SURFACE_EFFECTS.find(e=>e.id===effectId);
 const [options,setOptions]=useState(()=>({...defaultEffectOptions(effect),geoset:initialPart}));
 const [playing,setPlaying]=useState(true),[sequence,setSequence]=useState(()=>sequenceIndex>=0?sequenceIndex:standSequenceIndex(doc.model));
 const [cameraMode,setCameraMode]=useState('work'),[placing,setPlacing]=useState(false),[original,setOriginal]=useState(false),[solo,setSolo]=useState(false);
 const [hovered,setHovered]=useState(null);
 const capture=useRef(null),firstFit=useRef(true),selectionForFit=useRef(initialPart);
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
  if(key==='sequence')setSequence(value);
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
  (assetKey!==null?loadGlobal(assetKey,textureAssets):library.load(effect,textureAssets)).then(value=>{if(active)setLoaded({...value,effect,assetKey});},cause=>{if(active)setError(cause.message);});
  return()=>{active=false;};
 },[library,effect,textureAssets,assetKey,loadGlobal]);
 const loading=loaded?.effect!==effect||loaded?.assetKey!==assetKey;
 const graph=useMemo(()=>{
  if(loading)return null;
  try{
   const model=structuredClone(doc.model);
   return {model,...(stack?compileAnimation(model,options.geoset,stack,loaded):applySurfaceEffect(model,loaded.pack,effect,options))};
  }catch(cause){return {error:cause.message};}
 },[doc,doc.revision,loaded,effect,options,loading,stack]);
 const lastModel=useRef(doc.model);
 if(graph?.model)lastModel.current=graph.model;
 selectionForFit.current=options.geoset;
 const assets=useMemo(()=>new Map([...textureAssets,...(loaded?.assets||[])]),[textureAssets,loaded]);
 const choose=entry=>{
  setStack(null);
  setOriginal(false);
  if(entry.id===effect.id)return;
  const defaults=defaultEffectOptions(entry);
  defaults.sequence=effectSequence(doc.model,entry,sequence);
  if(entry.cue)setSequence(defaults.sequence);
  setPlacing(false);
  setEffectId(entry.id);
  setOptions(o=>({...defaults,mode:explicitMode.current??defaults.mode,geoset:o.geoset}));
 };
 const query=search.trim().toLowerCase();
 const matches=useMemo(()=>query?SURFACE_EFFECTS.filter(e=>matchesVisualEffect(e,query,translate)):SURFACE_EFFECTS,[query]);
 const visibleEffects=matches.filter(e=>category==='All'||e.category===category);
 const chooseGlobal=(entry,index=options.geoset)=>{
  const part=doc.model.Geosets[index];if(!part)return;
  const next=part._FxStack?.look===entry.id?readAnimationStack(doc.model,index):newStack(entry,partFrame(part),part._FxStack?.owner||crypto.randomUUID());
  setStack(next);selectLayer((next.layers.find(l=>l.kind==='flame')||next.layers[0])?.id);setOriginal(false);setPlacing(false);
 };
 const pickGeoset=useCallback(index=>{
  index=animationPart(lastModel.current,index);
  const part=doc.model.Geosets[index];if(!part||index===options.geoset)return;
  setOptions(o=>({...o,geoset:index,placement:defaultEffectOptions(effect).placement}));
  const saved=readAnimationStack(doc.model,index);
  if(saved||stack){const next=saved||newStack(findLook(stack.look),partFrame(part),crypto.randomUUID());setStack(next);selectLayer(next.layers[0]?.id);}
  setPlacing(false);
 },[effect,doc,options.geoset,stack]);
 const isolated=useMemo(()=>solo?[...new Set([options.geoset,original?options.geoset:graph?.geoset,...(!original&&graph?.layers?Object.values(graph.layers).map(l=>l.geoset).filter(i=>i>=0):[])].filter(Number.isInteger))]:undefined,[solo,options.geoset,original,graph]);
 const hidden=useMemo(()=>isolated?new Set(doc.model.Geosets.map((_,i)=>i).filter(i=>!isolated.includes(i))):undefined,[doc,doc.revision,isolated]);
 const message=error||graph?.error||previewError;
 const apply=(emitterLayer=null)=>{
  if(!graph?.model||message)return;
  if(stack&&JSON.stringify(stack)===JSON.stringify(readAnimationStack(doc.model,options.geoset))){
   const id=graph.layers[emitterLayer]?.id;
   if(emitterLayer!=null&&id!=null)onOpenEmitter(id);else onClose();
   return;
  }
  const result=stack?edit('Apply '+findLook(stack.look).name,FX_SECTIONS,model=>compileAnimation(model,options.geoset,stack,loaded)):edit('Apply '+effect.name,EFFECT_SECTIONS,model=>applySurfaceEffect(model,loaded.pack,effect,options));
  if(result===false)return;
  onPlaced(loaded.assets,result?.geoset??options.geoset);
  if(emitterLayer!=null&&result?.layers?.[emitterLayer]?.id!=null)onOpenEmitter(result.layers[emitterLayer].id);else onClose();
 };
 const previewModel=original?doc.model:lastModel.current;
 const Stage=stack?GlobalAnimationStage:VisualEffectStage;
 const layer=stack?.layers.find(l=>l.id===selectedLayer);
 const stageProps=stack?{graph,layer,placing:placing&&!original,onLayer:next=>setStack({...stack,layers:stack.layers.map(l=>l.id===next.id?next:l)})}:{accents:!original?graph?.accents:null,placing,placement:options.placement,onCommit:update};
 const globalMatches=category==='All'?GLOBAL_LOOKS.filter(e=>!query||(e.name+' '+e.group).toLowerCase().includes(query)):[];

 const hasAccents=!!effect.accents?.length;
 const density=hasAccents&&(!effect.cue||effect.stamp)&&effect.accents.some(a=>!a.ribbon);
 const directional=!!effect.flow||effect.category==='Energy streaks';
 const speedHint=effect.category==='Energy streaks'?'Sets how quickly the highlight travels across the part.':effect.accents?.some(a=>a.ribbon)?'Sets how quickly the weapon glow moves and how long its trail hangs in the air.':effect.visibilityPulse?'Changes how quickly the surface fades out and back.':effect.tintPulse?'Changes how quickly the colour comes and goes.':'Changes how quickly the effect moves or repeats.';
 return <ToolWindow title="Surface Effects" overlayClass="resource-editor surface-effects" className="re-window sfx-window" headerClass="re-caption" closeClass="re-caption-close" onClose={onClose}>
  <div className="sfx-target" title="Choose the part that receives the effect. Ctrl-click a surface in the preview to select it."><SelectField label="Geoset" value={options.geoset} onChange={value=>pickGeoset(Number(value))} options={geosetOptions}/><span>Ctrl-click a surface to select it.</span></div>
  <div className="sfx-body">
   <aside className="sfx-library">
    <input className="sfx-search" title="Find a look by its name or appearance." type="search" aria-label="Find a surface effect" placeholder="Find an effect…" value={search} onChange={e=>setSearch(e.target.value)}/>
    <div className="sfx-categories" role="group" aria-label="Effect categories">{categories.map(name=><button key={name} title={name==='All'?'Show all surface effects.':'Show effects in this category.'} aria-pressed={category===name} onClick={()=>setCategory(name)}>{name}</button>)}</div>
    <div className="sfx-cards">{[...new Set(globalMatches.map(e=>e.group))].map(group=><section key={group} className="fx-starters" aria-label={group+' global animations'}><h4>{group}</h4>{globalMatches.filter(e=>e.group===group).map(e=><button key={e.id} className="fx-look" aria-label={e.name+' global animation'} aria-pressed={stack?.look===e.id} title={'Fit '+e.name.toLowerCase()+' to this part and adjust its layers.'} onClick={()=>chooseGlobal(e)}>{e.name}</button>)}</section>)}{!globalMatches.length&&!visibleEffects.length&&<div className="sfx-empty" role="status"><small>No matching effects</small>{matches.length>0&&<button title="Show matching cards from every category." onClick={()=>setCategory("All")}>Search all effects</button>}</div>}{visibleEffects.map(entry=><EffectCard key={entry.id} entry={entry} selected={!stack&&effect.id===entry.id} choose={choose} library={library} enabled={!!loaded&&ready}/>)}</div>
   </aside>
   <main className="sfx-center">
    <div className="sfx-stage">
     {previewModel&&<Suspense fallback={<span>Preparing preview…</span>}><Stage Preview={GamePreview} {...stageProps} model={previewModel} revision={doc.revision} textureAssets={assets} modelPath={modelPath} preferences={preferences} teamColor={teamColor} presentation="preview" preserveCameraView emptyDragRotates mode="textured" view="perspective" playing={playing} onPlayingChange={setPlaying} time={doc.model.Sequences[sequence]?.Interval[0]??0} sequenceIndex={sequence} playbackSpeed={100} loop showParticles showGrid={false} showAxes={false} interactivePreview highlightSelection hoveredGeoset={hovered} onHoverGeoset={setHovered} onInspectGeoset={pickGeoset} frameKey={solo?'fx:'+options.geoset:undefined} isolatedGeosets={isolated} hiddenGeosets={hidden} cameraMode={cameraMode} selectedNodeIds={idleSelection} overlays={overlays} onCaptureReady={captureReady}/></Suspense>}
     {original&&<span className="sfx-comparison">Original</span>}
     {loading&&!error&&<span className="sfx-stage-message" role="status">Loading native effect…</span>}
     {message&&<span className="sfx-stage-message sfx-error" role="alert">{message}</span>}
    </div>
    <div className="sfx-transport"><CameraTools value={cameraMode} onChange={setCameraMode}/><button title="Pause or play this preview." onClick={()=>setPlaying(v=>!v)}>{playing?'Pause':'Play'}</button><select title="Choose the model animation to preview." aria-label="Preview animation" value={sequence} onChange={e=>setSequence(Number(e.target.value))}>{doc.model.Sequences.map((s,i)=><option key={i} value={i}>{s.Name}</option>)}</select><button aria-pressed={solo} onClick={()=>setSolo(v=>!v)} title="Show only the selected surface and its effect">Solo</button><button title="Frame the selected part in the preview." onClick={()=>capture.current?.frameGeosets([options.geoset])}>Fit selection</button><button aria-pressed={original} title="Compare with the unchanged model" onClick={()=>setOriginal(v=>!v)}>Original</button></div>
   </main>
   <aside className="sfx-controls">
    {stack?<GlobalAnimationControls preferences={preferences} stack={stack} setStack={setStack} selected={selectedLayer} select={selectLayer} graph={graph} ColourControl={ColourControl} placing={placing} setPlacing={setPlacing} openEmitter={apply}/>:<>
    <h3>{effect.name}</h3><p className="sfx-description">{effect.description}</p>
    <div className="sfx-modes" role="group" aria-label="Apply mode">{[['overlay','Overlay'],['replace','Replace'],['new','New geoset']].map(([value,label])=><button key={value} aria-pressed={options.mode===value} onClick={()=>update('mode',value)} title={value==='overlay'?'Lay the effect over the existing skin.':value==='replace'?'Use the effect in place of the selected material.':'Copy the selected shape and give the copy its own effect.'}>{label}</button>)}</div>
    {!effect.team&&<ColourControl effect={effect} options={options} update={update}/>}
    {effect.cue&&doc.model.Sequences.length>0?<label className="field" title="The flash and particles play once in this animation."><span>Play during</span><select aria-label="Play during" value={options.sequence} onChange={e=>update('sequence',Number(e.target.value))}>{doc.model.Sequences.map((seq,i)=><option key={i} value={i}>{seq.Name}</option>)}</select></label>:
     <RangeField label="Speed" value={options.speed} min={.25} max={4} step={.05} output={v=>v.toFixed(2)+'×'} onCommit={v=>update('speed',v)} title={speedHint}/>}
    {density?<RangeField label="Density" value={options.density} min={.2} max={2} step={.05} output={v=>Math.round(v*100)+'%'} onCommit={v=>update('density',v)} title={effect.stamp?"Changes how many sparks or drops accompany the ground mark.":"Changes how many particles appear at the same time."}/>:
     <RangeField label="Strength" value={options.opacity} min={0} max={1} step={.01} output={v=>Math.round(v*100)+'%'} onCommit={v=>update('opacity',v)} title="Fades the effect from invisible to its full brightness."/>}
    {hasAccents?<button aria-pressed={placing} title={effect.stamp?"Drag Move to place the mark and particles. The corners size the particles.":"Drag Move to reposition the attached effect. Drag its edge or a corner to resize the whole group."} onClick={()=>{setOriginal(false);setPlacing(v=>!v);}} className="sfx-place">Position &amp; size</button>:directional?
     <RangeField label="Direction" value={options.direction} min={0} max={360} step={5} output={v=>v+'°'} onCommit={v=>update('direction',v)} title="Turns the moving pattern to follow the length of the part."/>:effect.visibilityPulse?
     <RangeField label="Fade depth" value={options.pulse} min={0} max={1} step={.05} output={v=>Math.round(v*100)+'%'} onCommit={v=>update('pulse',v)} title="Sets how far the part fades on each pulse."/>:null}
    </>}
   </aside>
  </div>
  <footer className="sfx-footer"><button title="Close and discard this preview." onClick={onClose}>Cancel</button><button className="sfx-apply" title="Write the previewed effect to the model as one undoable edit." disabled={loading||!ready||!graph?.model||!!message} onClick={()=>apply()}>Apply effect</button></footer>
 </ToolWindow>;
}
