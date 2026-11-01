import React,{Suspense,lazy,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Folder,FolderOpen,Sparkles} from 'lucide-react';
import ToolWindow from './ToolWindow.jsx';
import {SelectField} from './Fields.jsx';
import {CameraTools} from './EditorControls.jsx';
import GameIcon from './GameIcon.jsx';
import GameLibraryRow from './GameLibraryRow.jsx';
import GlobalAnimationControls from './GlobalAnimationControls.jsx';
import GlobalAnimationStage from './GlobalAnimationStage.jsx';
import {GLOBAL_LOOKS,findLook,newStack,partFrame,withLayerTexture,withParticleStrength} from '../src/global-animation-looks.js';
import {animationPart,compileAnimation,readAnimationStack,impactDefaults,strengthPasses,FX_SECTIONS} from '../src/global-animation-model.js';
import {globalAssetKey,createGlobalLibrary} from './global-animation-library.js';
import {translate} from '../src/localization.js';
import {standSequenceIndex} from '../src/sequence-editor.js';
import {tintFromHex,hexFromTint} from '../src/surface-effect-colours.js';
import {imageTextureLayers} from '../src/uv-preview.js';
import {resolveGameFiles} from './desktop.js';
import './particle-editor.css';
import './resource-editors.css';
import './texture-library.css';
import './surface-effects.css';
const TextureLibrary=lazy(()=>import('./TextureLibrary.jsx'));
const GamePreview=lazy(()=>import('./GamePreview.jsx'));
const overlays={bones:false,nodes:false,particles:false,attachments:false};
const idleSelection=[];
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
function ColourControl({tint,defaultTint,update,hint}) {
 const hex=hexFromTint(tint);
 return <div className="sfx-custom-colour" title={hint}><label>Colour <TintPicker value={hex} onCommit={update}/></label><button aria-label="Reset colour" title="Restore this layer's default colour." disabled={hex===hexFromTint(defaultTint)} onClick={()=>update('tint',[...defaultTint])}>Reset</button></div>;
}
export default function SurfaceEffects({doc,edit,initialGeoset,textureAssets,modelPath,preferences,teamColor,sequenceIndex,onPlaced,onOpenEmitter,onClose}){
 const [part,setPart]=useState(()=>animationPart(doc.model,doc.model.Geosets[initialGeoset]?initialGeoset:0));
 const makeStack=(entry,index,current)=>{const saved=readAnimationStack(doc.model,index);if(saved?.look===entry.id)return saved;const next=newStack(entry,partFrame(doc.model.Geosets[index]),saved?.owner||crypto.randomUUID());return entry.impact?{...next,...impactDefaults(doc.model,index,current)}:next;};
 const [stack,setStack]=useState(()=>readAnimationStack(doc.model,part)||makeStack(GLOBAL_LOOKS[0],part,sequenceIndex));
 const [selectedLayer,selectLayer]=useState(()=>stack.layers.find(l=>l.kind==='flame')?.id||stack.layers[0]?.id);
 const [picture,setPicture]=useState(null),strengthDrag=useRef(null);
 const [loadGlobal]=useState(()=>createGlobalLibrary()),[search,setSearch]=useState('');
 const [folders,setFolders]=useState(()=>new Set([findLook(stack.look).group]));
 const [loaded,setLoaded]=useState(null),[error,setError]=useState(''),[previewError,setPreviewError]=useState(''),[ready,setReady]=useState(false);
 const [playing,setPlaying]=useState(true),[sequence,setSequence]=useState(()=>sequenceIndex>=0?sequenceIndex:standSequenceIndex(doc.model));
 const [cameraMode,setCameraMode]=useState('work'),[placing,setPlacing]=useState(false),[original,setOriginal]=useState(false),[solo,setSolo]=useState(false),[highlight,setHighlight]=useState(false);
 const assetKey=globalAssetKey(stack),capture=useRef(null),firstFit=useRef(true),selectionForFit=useRef(part);
 selectionForFit.current=part;
 const captureReady=useCallback(api=>{capture.current=api;setReady(false);if(api)api.whenReady().then(()=>{if(capture.current!==api)return;if(firstFit.current){api.frameGeosets([selectionForFit.current]);firstFit.current=false;}setReady(true);},cause=>{if(capture.current===api)setPreviewError(cause.message);});},[]);
 useEffect(()=>{let active=true;setError('');setPreviewError('');loadGlobal(assetKey,textureAssets).then(value=>{if(active)setLoaded({...value,assetKey});},cause=>{if(active)setError(cause.message);});return()=>{active=false;};},[assetKey,textureAssets,loadGlobal]);
 const loading=loaded?.assetKey!==assetKey;
 const graph=useMemo(()=>{if(loading)return null;try{const model=structuredClone(doc.model);return {model,...compileAnimation(model,part,stack,loaded)};}catch(cause){return {error:cause.message};}},[doc,doc.revision,part,stack,loaded,loading]);
 const lastModel=useRef(doc.model);if(graph?.model)lastModel.current=graph.model;
 function previewStrength(layer,value){
  if(layer.type==='Particles'){
   const result=graph?.layers[layer.id],api=capture.current;if(!api||result?.id==null)return;
   const original=graph.model.Nodes[result.id].Alpha;
   api.previewParticleAlpha(result.ids,value==null?original:withParticleStrength(layer,original,value).native.Alpha);return;
  }
  const index=graph?.model?.Geosets[graph.layers[layer.id]?.geoset]?.MaterialID;
  const api=capture.current;if(index==null||!api)return;
  let drag=strengthDrag.current;
  if(value==null){
   if(drag){cancelAnimationFrame(drag.pending);drag.api.previewMaterialLayers(drag.index,drag.original);strengthDrag.current=null;}
   return;
  }
  if(!drag||drag.api!==api||drag.index!==index){
   const original=graph.model.Materials[index].Layers,glow=!!layer.glyphs||layer.type==='Glow';
   // Recover the native unit-strength curve once, including the case where the drag starts at zero.
   const unitModel=structuredClone(doc.model),unitStack={...stack,layers:stack.layers.map(l=>l.id===layer.id?{...l,strength:1}:l)};
   const result=compileAnimation(unitModel,part,unitStack,loaded);
   const unit=unitModel.Materials[unitModel.Geosets[result.layers[layer.id].geoset].MaterialID].Layers;
   strengthDrag.current=drag={api,index,original,glow,unit};
  }
  drag.value=value;
  if(!drag.pending)drag.pending=requestAnimationFrame(()=>{drag.pending=0;if(capture.current===api)api.previewMaterialLayers(index,strengthPasses(drag.unit,drag.value,drag.glow));});
 }
 useEffect(()=>()=>cancelAnimationFrame(strengthDrag.current?.pending),[]);
 const assets=useMemo(()=>new Map([...textureAssets,...(loaded?.assets||[])]),[textureAssets,loaded]);
 const geosetOptions=useMemo(()=>doc.model.Geosets.map((g,i)=>{const name=imageTextureLayers(doc.model,i)[0]?.path?.split(/[\\/]/).at(-1)?.replace(/\.[^.]+$/,'');return {value:i,label:'Geoset '+(i+1)+' · '+(name||g.Vertices.length/3+' vertices')};}),[doc,doc.revision]);
 const choose=(entry,index=part)=>{if(entry.id===stack.look&&index===part)return;const next=makeStack(entry,index,sequence);setStack(next);selectLayer(next.layers.find(l=>l.kind==='flame')?.id||next.layers[0]?.id);setOriginal(false);setPlacing(false);if(next.impact&&next.sequence>=0)setSequence(next.sequence);};
 const pickGeoset=index=>{index=animationPart(lastModel.current,index);if(!doc.model.Geosets[index]||index===part)return;setPart(index);const saved=readAnimationStack(doc.model,index);if(saved){setStack(saved);selectLayer(saved.layers[0]?.id);setFolders(old=>new Set([...old,findLook(saved.look).group]));}else choose(findLook(stack.look),index);setPlacing(false);};
 const isolated=useMemo(()=>solo?[...new Set([part,...(!original&&graph?.layers?Object.values(graph.layers).map(l=>l.geoset).filter(i=>i>=0):[])])]:undefined,[solo,part,original,graph]);
 const hidden=useMemo(()=>isolated?new Set(doc.model.Geosets.map((_,i)=>i).filter(i=>!isolated.includes(i))):undefined,[doc,doc.revision,isolated]);
 const message=error||graph?.error||previewError,layer=stack.layers.find(l=>l.id===selectedLayer);
 const query=search.trim().toLowerCase(),matches=GLOBAL_LOOKS.filter(e=>!query||query.split(/\s+/).every(word=>(e.name+' '+translate(e.name)+' '+e.group+' '+translate(e.group)).toLowerCase().includes(word)));
 const groups=[...new Set(matches.map(e=>e.group))];
 const apply=(emitterLayer=null)=>{if(!graph?.model||message)return;if(JSON.stringify(stack)===JSON.stringify(readAnimationStack(doc.model,part))){const id=graph.layers[emitterLayer]?.id;if(emitterLayer!=null&&id!=null)onOpenEmitter(id);else onClose();return;}const result=edit('Apply '+findLook(stack.look).name,FX_SECTIONS,model=>compileAnimation(model,part,stack,loaded));if(result===false)return;onPlaced(loaded.assets,result?.geoset??part);if(emitterLayer!=null&&result?.layers?.[emitterLayer]?.id!=null)onOpenEmitter(result.layers[emitterLayer].id);else onClose();};
 return <ToolWindow title="Surface Effects" overlayClass="resource-editor surface-effects" className="re-window sfx-window" headerClass="re-caption" closeClass="re-caption-close" onClose={onClose}
  after={picture!=null&&<Suspense fallback={null}><TextureLibrary model={doc.model} onClose={()=>setPicture(null)} selectLabel="Use picture" onSelectTexture={async asset=>{
   const [file]=await resolveGameFiles([asset.name]);if(!file)throw Error('Choose a native Warcraft texture.');
   setStack(current=>({...current,layers:current.layers.map(l=>l.id===picture?withLayerTexture(l,asset.name):l)}));
   setPicture(null);setOriginal(false);
  }}/></Suspense>}>
  <div className="sfx-target"><SelectField label="Geoset" value={part} onChange={value=>pickGeoset(Number(value))} options={geosetOptions}/><label title="Highlight the selected part in the preview."><input type="checkbox" checked={highlight} onChange={e=>setHighlight(e.target.checked)}/>Highlight geoset</label><span>Double-click a surface to select it.</span></div>
  <div className="sfx-body">
   <aside className="sfx-library">
    <input className="sfx-search" type="search" aria-label="Find a surface effect" placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)}/>
    <div className="gf-tree sfx-cards" aria-label="Effects library">{groups.map(group=>{const entries=matches.filter(e=>e.group===group),open=!!query||folders.has(group);return <section key={group}>
     <GameLibraryRow as="button" className="gf-row folder" folder open={open} aria-expanded={open} name={group} count={entries.length} icon={<GameIcon fallback={open?FolderOpen:Folder}/>} onClick={()=>setFolders(old=>{const next=new Set(old);next.has(group)?next.delete(group):next.add(group);return next;})}/>
     {open&&entries.map(entry=>{const icon=entry.layers.find(l=>l.image)?.image;return <GameLibraryRow as="button" key={entry.id} name={entry.name} className={'gf-row sfx-card'+(stack.look===entry.id?' selected':'')} aria-label={entry.name+(entry.impact?' impact':' global animation')} aria-pressed={stack.look===entry.id} icon={<GameIcon iconKey={icon?'fx:'+icon:null} read={icon?async()=>(await resolveGameFiles([icon]))[0]:null} fallback={Sparkles}/>} onClick={()=>choose(entry)}/>;})}
    </section>;})}{!matches.length&&<span className="sfx-empty">No matching effects</span>}</div>
   </aside>
   <main className="sfx-center"><div className="sfx-stage">
    <Suspense fallback={<span>Loading…</span>}><GlobalAnimationStage Preview={GamePreview} graph={graph} layer={layer} placing={placing&&!original} onLayer={next=>{if(next.size!==layer.size&&layer.native?.ParticleScaling)next.native={...layer.native,ParticleScaling:layer.native.ParticleScaling.map(v=>v*next.size/layer.size)};setStack({...stack,layers:stack.layers.map(l=>l.id===next.id?next:l)});}} model={original?doc.model:lastModel.current} revision={doc.revision} textureAssets={assets} modelPath={modelPath} preferences={preferences} teamColor={teamColor} presentation="preview" preserveCameraView emptyDragRotates mode="textured" view="perspective" playing={playing} onPlayingChange={setPlaying} time={doc.model.Sequences[sequence]?.Interval[0]??0} sequenceIndex={sequence} playbackSpeed={100} loop showParticles showGrid={false} showAxes={false} interactivePreview highlightSelection hoveredGeoset={highlight?part:null} onDoubleClickGeoset={pickGeoset} frameKey={solo?'fx:'+part:undefined} isolatedGeosets={isolated} hiddenGeosets={hidden} cameraMode={cameraMode} selectedNodeIds={idleSelection} overlays={overlays} onCaptureReady={captureReady}/></Suspense>
    {original&&<span className="sfx-comparison">Original</span>}{loading&&!error&&<span className="sfx-stage-message" role="status">Loading…</span>}{message&&<span className="sfx-stage-message sfx-error" role="alert">{message}</span>}
   </div><div className="sfx-transport"><CameraTools value={cameraMode} onChange={setCameraMode}/><button onClick={()=>setPlaying(v=>!v)}>{playing?'Pause':'Play'}</button><select aria-label="Preview animation" value={sequence} onChange={e=>setSequence(Number(e.target.value))}>{doc.model.Sequences.map((s,i)=><option key={i} value={i}>{s.Name}</option>)}</select><button aria-pressed={solo} onClick={()=>setSolo(v=>!v)} title="Show only the selected part.">Solo</button><button title="Frame the selected part." onClick={()=>capture.current?.frameGeosets([part])}>Fit selection</button><button aria-pressed={original} title="Show the original model." onClick={()=>setOriginal(v=>!v)}>Original</button></div></main>
   <aside className="sfx-controls"><GlobalAnimationControls assets={assets} pickTexture={setPicture} previewStrength={previewStrength} preferences={preferences} stack={stack} setStack={next=>{setOriginal(false);setStack(next);}} selected={selectedLayer} select={selectLayer} graph={graph} ColourControl={ColourControl} placing={placing} setPlacing={setPlacing} openEmitter={apply} onSequence={setSequence}/></aside>
  </div><footer className="sfx-footer"><button onClick={onClose}>Cancel</button><button className="sfx-apply" disabled={loading||!ready||!graph?.model||!!message} onClick={()=>apply()}>Apply effect</button></footer>
 </ToolWindow>;
}
