import Dialog from './Dialog.jsx';
import {deleteEmitterSite,emitterEditOverlaps,resolveEmitterEdit,clearGroupFieldEdits,emitterGroup} from '../src/fx-emitter-placement.js';
import React,{Suspense,lazy,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Folder,FolderOpen,Sparkles} from 'lucide-react';
import ToolWindow from './ToolWindow.jsx';
import {ChoiceSelect,SelectField} from './Fields.jsx';
import {CameraTools} from './EditorControls.jsx';
import GameIcon from './GameIcon.jsx';
import GameLibraryRow from './GameLibraryRow.jsx';
import GlobalAnimationControls from './GlobalAnimationControls.jsx';
import GlobalAnimationStage from './GlobalAnimationStage.jsx';
import {GLOBAL_LOOKS,findLook,lookOf,newStack,partFrame,withLayerTexture,withParticleStrength,withLayerSize} from '../src/global-animation-looks.js';
import {unitHeight} from '../src/fx-layer-basis.js';
import {version} from '../package.json';
import {ownLookFrom,stackFromOwnLook,upsertOwnLook,ownLookFile,parseOwnLookFile} from '../src/fx-own-looks.js';
import {writePresetFile} from './PresetBar.jsx';
import {animationPart,compileAnimation,carryAnimationStack,readAnimationStack,impactDefaults,strengthPasses,previewCoordinates,FX_SECTIONS} from '../src/global-animation-model.js';
import {createFrameCoalescer} from './viewport-performance.js';
import {globalAssetKey,createGlobalLibrary} from './global-animation-library.js';
import {translate} from '../src/localization.js';
import {standSequenceIndex} from '../src/sequence-editor.js';
import {tintFromHex,hexFromTint} from '../src/surface-effect-colours.js';
import {imageTextureLayers} from '../src/uv-preview.js';
import {resolveGameFiles} from './desktop.js';
import './preset-bar.css';
import './particle-editor.css';
import './resource-editors.css';
import './texture-library.css';
import './surface-effects.css';
const TextureLibrary=lazy(()=>import('./TextureLibrary.jsx'));
const GamePreview=lazy(()=>import('./GamePreview.jsx'));
const overlays={bones:false,nodes:false,particles:false,attachments:false};
const idleSelection=[];
const withEmitterEditPolicy=(stack,policy)=>{
 const next={...stack};
 if(policy==='ask')delete next.emitterEditPolicy;else next.emitterEditPolicy=policy;
 return next;
};
const applyEmitterEditPolicy=(before,next,all,operation)=>({...next,layers:next.layers.map(layer=>{
 const old=before.layers.find(l=>l.id===layer.id);
 return old&&emitterEditOverlaps(old,layer,operation)?resolveEmitterEdit(old,layer,all,operation):layer;
})});
function TintPicker({value,onCommit,resetKey,label='RGB tint'}) {
 const input=useRef(null);
 useEffect(()=>{input.current.value=value;},[value,resetKey]);
 useEffect(()=>{
  const element=input.current;
  function commit(){onCommit('tint',tintFromHex(element.value));}
  element.addEventListener('change',commit);
  return()=>element.removeEventListener('change',commit);
 },[onCommit]);
 return <input ref={input} type="color" aria-label={label} title="Choose a custom RGB colour" defaultValue={value}/>;
}
function ColourControl({tint,defaultTint,update,hint,resetKey,label='Colour',pickerLabel,resetLabel='Reset colour'}) {
 const hex=hexFromTint(tint);
 return <div className="sfx-custom-colour" title={hint}><label>{label} <TintPicker resetKey={resetKey} value={hex} onCommit={update} label={pickerLabel}/></label><button aria-label={resetLabel} title="Restore this layer's default colour." disabled={hex===hexFromTint(defaultTint)} onClick={()=>update('tint',[...defaultTint])}>Reset</button></div>;
}
export default function SurfaceEffects({doc,edit,initialGeoset,initialGroup=[],textureAssets,modelPath,preferences,changePreferences,teamColor,sequenceIndex,onPlaced,onOpenEmitter,onClose}){
 // Two or more geosets checked in the editor are offered as one surface, chosen by default.
 const [groupChoice]=useState(()=>{const usable=i=>doc.model.Geosets[i]&&!doc.model.Geosets[i]._FxTag,picked=initialGroup.filter(usable);if(picked.length>1)return picked;const start=animationPart(doc.model,doc.model.Geosets[initialGeoset]?initialGeoset:0),saved=doc.model.Geosets[start]?._FxStack?.group?.filter(usable);return saved?.length?[start,...saved]:[];});
 const [combined,setCombined]=useState(groupChoice.length>1);
 const [part,setPart]=useState(()=>{const start=animationPart(doc.model,doc.model.Geosets[initialGeoset]?initialGeoset:0);return groupChoice.length>1&&!groupChoice.includes(start)?groupChoice[0]:start;});
 const members=useMemo(()=>combined?groupChoice.filter(i=>i!==part):[],[combined,groupChoice,part]);
 const makeStack=(entry,index,current)=>{const fitted=()=>{const frame=partFrame(doc.model.Geosets[index]);if(frame)frame.unitHeight=unitHeight(doc.model);return frame;};const saved=readAnimationStack(doc.model,index);if(saved?.look===entry.id)return saved;if(entry.own)return stackFromOwnLook(entry.own,partFrame(doc.model.Geosets[index]),saved?.owner||crypto.randomUUID());const next=newStack(entry,fitted(),saved?.owner||crypto.randomUUID());return entry.impact?{...next,...impactDefaults(doc.model,index,current)}:next;};
 // The user's own looks are filed as a first folder, with the same rows as the built-in ones.
 const ownLooks=preferences?.fxLooks||[],ownEntries=useMemo(()=>ownLooks.map(record=>({id:record.id,name:record.name,group:'My looks',layers:record.layers,own:record})),[ownLooks]);
 const [stack,setStack]=useState(()=>readAnimationStack(doc.model,part)||makeStack(GLOBAL_LOOKS[0],part,sequenceIndex));
 // Only the current target has a working preview and a close-warning baseline.
 const baseline=useRef(stack);
 // Once the user has chosen or changed anything, that choice goes with them from part to part.
 const chosen=useRef(false);
 const [selectedLayer,setSelectedLayer]=useState(()=>stack.layers.find(l=>l.kind==='flame')?.id||stack.layers[0]?.id);
 const [selectedSite,setSelectedSite]=useState(null),[surfaceSnap,setSurfaceSnap]=useState(false),[showMarkers,setShowMarkers]=useState(true),[groupSelect,setGroupSelect]=useState(false);
 const windowRef=useRef(null);
 const selectSite=key=>{setSelectedSite(key);setSurfaceSnap(false);};
 const selectLayer=id=>{setSelectedLayer(id);selectSite(null);setRotating(false);};
 const [pendingEdit,setPendingEdit]=useState(null),[colourRevision,setColourRevision]=useState(0);
 const changeStack=(next,aimOnly=false,operation)=>{
  setOriginal(false);chosen.current=true;
  if(!selectedSite&&!operation)next={...next,layers:next.layers.map(layer=>{const old=stack.layers.find(l=>l.id===layer.id);return old?clearGroupFieldEdits(old,layer):layer;})};
  if(!selectedSite&&stack.layers.some(old=>{const changed=next.layers.find(l=>l.id===old.id);return changed&&emitterEditOverlaps(old,changed,operation);})){
   if(stack.emitterEditPolicy==='keep'||stack.emitterEditPolicy==='all')setStack(applyEmitterEditPolicy(stack,next,stack.emitterEditPolicy==='all',operation));
   else setPendingEdit({before:stack,next,remember:false,aimOnly,operation});
   return;
  }
  setStack(next);
 };
 const resolvePending=policy=>{
  const next=applyEmitterEditPolicy(pendingEdit.before,pendingEdit.next,policy==='all',pendingEdit.operation);
  setStack(pendingEdit.remember?withEmitterEditPolicy(next,policy):next);setPendingEdit(null);
 };
 const deleteEmitter=()=>{
  if(!selectedSite)return;
  changeStack({...stack,layers:stack.layers.map(layer=>layer.id===selectedLayer?deleteEmitterSite(layer,selectedSite,graph?.layers?.[layer.id]?.sites):layer)});
  selectSite(null);
 };
 const [picture,setPicture]=useState(null),strengthDrag=useRef(null);
 const [loadGlobal]=useState(()=>createGlobalLibrary()),[search,setSearch]=useState('');
 const [folders,setFolders]=useState(()=>new Set([lookOf(stack).group]));
 const [loaded,setLoaded]=useState(null),[error,setError]=useState(''),[previewError,setPreviewError]=useState(''),[ready,setReady]=useState(false);
 const [playing,setPlaying]=useState(true),[sequence,setSequence]=useState(()=>sequenceIndex>=0?sequenceIndex:standSequenceIndex(doc.model));
 const [time,setTime]=useState(()=>doc.model.Sequences[sequence]?.Interval[0]??0),heldPlay=useRef(false);
 useEffect(()=>setTime(doc.model.Sequences[sequence]?.Interval[0]??0),[sequence]);
 const holdFrame=active=>{if(active){heldPlay.current=playing;if(playing)setPlaying(false);}else{if(heldPlay.current)setPlaying(true);heldPlay.current=false;}};
 const [cameraMode,setCameraMode]=useState('work'),[placing,setPlacing]=useState(false),[rotating,setRotating]=useState(false),[original,setOriginal]=useState(false),[solo,setSolo]=useState(false),[highlight,setHighlight]=useState(false);
 // A picked ingredient shows in the preview (and Apply) before Add keeps it as a layer.
 const [trial,setTrial]=useState(null);
 const unapplied=!!trial||JSON.stringify(stack)!==JSON.stringify(baseline.current);
 const previewStack=useMemo(()=>{const shown=trial?{...stack,layers:[...stack.layers,{...trial.layer,id:Math.max(0,...stack.layers.map(l=>l.id))+1}]}:stack;if(members.length)return {...shown,group:members,asOverlay:true};if(!shown.group)return shown;const {group:_group,...single}=shown;return single;},[stack,trial,members]);
 const assetKey=globalAssetKey(previewStack),capture=useRef(null),firstFit=useRef(true),selectionForFit=useRef([part]);
 selectionForFit.current=[part,...members];
 const captureReady=useCallback(api=>{capture.current=api;setReady(false);if(api)api.whenReady().then(()=>{if(capture.current!==api)return;if(firstFit.current){api.frameGeosets(selectionForFit.current);firstFit.current=false;}setReady(true);},cause=>{if(capture.current===api)setPreviewError(cause.message);});},[]);
 useEffect(()=>{let active=true;setError('');setPreviewError('');loadGlobal(assetKey,textureAssets).then(value=>{if(active)setLoaded({...value,assetKey});},cause=>{if(active)setError(cause.message);});return()=>{active=false;};},[assetKey,textureAssets,loadGlobal]);
 const loading=loaded?.assetKey!==assetKey;
 // Skin-attachment samples of this model revision, shared by every compile until the model changes.
 const attachments=useMemo(()=>new Map(),[doc,doc.revision]);
 const graph=useMemo(()=>{if(loading)return null;try{const model=structuredClone(doc.model);return {model,...compileAnimation(model,part,previewStack,{...loaded,attachments})};}catch(cause){return {error:cause.message};}},[doc,doc.revision,part,previewStack,loaded,loading,attachments]);
 // Select emitter by group: the emitters of every layer that sit where the selected one does.
 const group=useMemo(()=>groupSelect&&selectedSite&&graph?.layers?emitterGroup(graph,stack.layers,selectedLayer,selectedSite):[],[groupSelect,selectedSite,selectedLayer,graph,stack]);
 const recipeFrameCache=useRef(null);
 if(graph?.frame)recipeFrameCache.current={doc,revision:doc.revision,part,members,frame:graph.frame};
 const cachedRecipe=recipeFrameCache.current;
 const recipeFrame=cachedRecipe?.doc===doc&&cachedRecipe.revision===doc.revision&&cachedRecipe.part===part&&cachedRecipe.members===members?cachedRecipe.frame:null;
 const lastModel=useRef(doc.model);if(graph?.model)lastModel.current=graph.model;
 function previewStrength(layer,value,siteKey){
  if(layer.type==='Particles'&&!layer.swarm){
   const result=graph?.layers?.[layer.id],api=capture.current;if(!api||result?.id==null)return;
   const ids=siteKey?result.ids.filter(id=>graph.model.Nodes[id]._FxTag.endsWith('/'+siteKey)):result.ids;
   const original=graph.model.Nodes[ids[0]]?.Alpha;if(!original)return;
   api.previewParticleAlpha(ids,value==null?original:withParticleStrength(layer,original,value).native.Alpha);return;
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
   const unitModel=structuredClone(doc.model),unitStack={...previewStack,layers:previewStack.layers.map(l=>l.id===layer.id?{...l,strength:1}:l)};
   const result=compileAnimation(unitModel,part,unitStack,{...loaded,attachments});
   const unit=unitModel.Materials[unitModel.Geosets[result.layers[layer.id].geoset].MaterialID].Layers;
   strengthDrag.current=drag={api,index,original,glow,unit};
  }
  drag.value=value;
  if(!drag.pending)drag.pending=requestAnimationFrame(()=>{drag.pending=0;if(capture.current===api)api.previewMaterialLayers(index,strengthPasses(drag.unit,drag.value,drag.glow));});
 }
 useEffect(()=>()=>cancelAnimationFrame(strengthDrag.current?.pending),[]);
 // A rune layout drag moves only that layer's UVs, once per preview frame; release commits.
 const layoutDrag=useRef(null),layoutFrame=useRef(null);
 function applyLayout(){const d=layoutDrag.current;if(d&&capture.current===d.api)d.api.previewGeosetUV(d.index,previewCoordinates(d.model,d.part,d.stack,d.layer));}
 function previewLayout(layer,next){
  const api=capture.current,index=graph?.layers?.[layer.id]?.geoset,geo=graph?.model?.Geosets[index];
  if(!api||!geo)return;
  if(next==null){layoutFrame.current?.cancel();if(layoutDrag.current)api.previewGeosetUV(index,geo.TVertices[0]);layoutDrag.current=null;return;}
  layoutDrag.current={api,index,layer:next,model:doc.model,part,stack:previewStack};
  if(!layoutFrame.current||layoutFrame.current.api!==api){layoutFrame.current?.cancel();layoutFrame.current=Object.assign(createFrameCoalescer(()=>applyLayout(),api.frames),{api});}
  layoutFrame.current.schedule();
 }
 useEffect(()=>()=>layoutFrame.current?.cancel(),[]);
 const assets=useMemo(()=>new Map([...textureAssets,...(loaded?.assets||[])]),[textureAssets,loaded]);
 const geosetOptions=useMemo(()=>doc.model.Geosets.map((g,i)=>{const name=imageTextureLayers(doc.model,i)[0]?.path?.split(/[\\/]/).at(-1)?.replace(/\.[^.]+$/,'');return {value:i,label:'Geoset '+(i+1)+' · '+(name||g.Vertices.length/3+' vertices')};}),[doc,doc.revision]);
 const targetOptions=groupChoice.length>1?[{value:-1,label:'Selected geosets ('+groupChoice.length+')'},...geosetOptions]:geosetOptions;
 const pickTarget=value=>value===-1?pickGeoset(groupChoice.includes(part)?part:groupChoice[0],true):pickGeoset(value);
 // A look absent from the library can be refitted from the applied effect, without carrying its current draft.
 const entryOf=current=>{
  const listed=findLook(current.look)||ownEntries.find(entry=>entry.id===current.look);
  if(listed)return listed;
  const saved=readAnimationStack(doc.model,part);
  const source=saved?.look===current.look?saved:baseline.current;
  if(source.look!==current.look)return GLOBAL_LOOKS[0];
  const name=source.name||'Custom look';
  return {id:source.look,name,own:{...ownLookFrom(source,partFrame(doc.model.Geosets[part]),name),id:source.look}};
 };
 const show=(next,keep)=>{setStack(next);setTrial(keep?.trial||null);setPendingEdit(null);selectLayer(next.layers.find(l=>l.id===keep?.layer)?.id||next.layers.find(l=>l.kind==='flame')?.id||next.layers[0]?.id);setOriginal(false);setPlacing(false);if(next.impact&&next.sequence>=0)setSequence(next.sequence);};
 const choose=entry=>{if(entry.id!==stack.look){chosen.current=true;show(makeStack(entry,part,sequence));}};
 // Saving a look changes preferences only: not the model, not Undo, and not the window's unapplied work.
 const keepLooks=looks=>changePreferences?.(previous=>({...previous,fxLooks:looks})),openMyLooks=()=>setFolders(old=>new Set([...old,'My looks']));
 const lookActions={
  save:name=>{const {looks,look}=upsertOwnLook(ownLooks,ownLookFrom(stack,partFrame(doc.model.Geosets[part]),name)),next={...stack,look:look.id,name:look.name};keepLooks(looks);if(JSON.stringify(stack)===JSON.stringify(baseline.current))baseline.current=next;setStack(next);openMyLooks();return look;},
  saveFile:name=>writePresetFile(name,ownLookFile(ownLookFrom(stack,partFrame(doc.model.Geosets[part]),name),version)),
  loadText:text=>{const {looks,look}=upsertOwnLook(ownLooks,parseOwnLookFile(text));keepLooks(looks);chosen.current=true;show(stackFromOwnLook(look,partFrame(doc.model.Geosets[part]),stack.owner));openMyLooks();return look;},
 };
 const removeLook=id=>changePreferences?.(previous=>({...previous,fxLooks:previous.fxLooks.filter(l=>l.id!==id)}));
 const pickGeoset=(index,group=false)=>{
  index=animationPart(lastModel.current,index);
  if(!doc.model.Geosets[index]||(index===part&&group===combined))return;
  const saved=readAnimationStack(doc.model,index);
  // The look, its variation and the layer edits stay with the user on the next part. A part that already has an
  // effect shows that effect until the user has chosen or changed something here. Nothing applied is touched.
  let next=saved&&!chosen.current?saved:null,keep;
  if(!next&&!stack.impact)try{
   const from=recipeFrame||partFrame(doc.model.Geosets[part]),to=partFrame(doc.model.Geosets[index]);
   to.unitHeight=unitHeight(doc.model);
   const id=Math.max(0,...stack.layers.map(l=>l.id))+1;
   const source={...stack,layers:trial?[...stack.layers,{...trial.layer,id}]:stack.layers,...(members.length?{group:members,asOverlay:true}:{})};
   const carried=carryAnimationStack(doc.model,part,source,from,to,saved?.owner||crypto.randomUUID(),{...loaded,attachments});
   if(stack.asOverlay==null)delete carried.asOverlay;else carried.asOverlay=stack.asOverlay;
   keep={layer:selectedLayer,trial:trial?{...trial,layer:{...carried.layers.find(l=>l.id===id),id:trial.layer.id}}:null};
   next={...carried,layers:carried.layers.filter(l=>!trial||l.id!==id)};
  }catch{next=null;}
  next||=saved||makeStack(entryOf(stack),index,sequence);
  // The close warning compares with how this part opens: choices carried onto it from another part are unapplied.
  baseline.current=saved||(chosen.current?makeStack(GLOBAL_LOOKS[0],index,sequence):next);
  lastModel.current=doc.model;
  setCombined(group);setPart(index);show(next,keep);
  if(saved)setFolders(old=>new Set([...old,lookOf(saved).group]));
 };
 const isolated=useMemo(()=>solo?[...new Set([part,...members,...(!original&&graph?.layers?Object.values(graph.layers).map(l=>l.geoset).filter(i=>i>=0):[])])]:undefined,[solo,part,members,original,graph]);
 const hidden=useMemo(()=>isolated?new Set(doc.model.Geosets.map((_,i)=>i).filter(i=>!isolated.includes(i))):undefined,[doc,doc.revision,isolated]);
 const message=error||graph?.error||previewError,layer=stack.layers.find(l=>l.id===selectedLayer);
 const query=search.trim().toLowerCase(),matches=[...ownEntries,...GLOBAL_LOOKS].filter(e=>!query||query.split(/\s+/).every(word=>(e.name+' '+translate(e.name)+' '+e.group+' '+translate(e.group)+' '+(e.variations||[]).map(v=>v.name+' '+translate(v.name)).join(' ')).toLowerCase().includes(word)));
 const groups=[...new Set(matches.map(e=>e.group))];
 const apply=(emitterLayer=null,siteKey=null)=>{
  if(!graph?.model||message)return;
  const emitterId=layer=>siteKey?layer?.siteIds?.[siteKey]:layer?.id;
  // Opening one site in EMTR records its native baseline for the next FX edit.
  const appliedStack=siteKey?{...previewStack,layers:previewStack.layers.map(l=>l.id===emitterLayer&&!l.individuals?.[siteKey]?{...l,individuals:{...l.individuals,[siteKey]:{}}}:l)}:previewStack;
  if(!appliedStack.layers.length&&!readAnimationStack(doc.model,part)){onClose();return;}
  if(JSON.stringify(appliedStack)===JSON.stringify(readAnimationStack(doc.model,part))){const id=emitterId(graph.layers[emitterLayer]);if(emitterLayer!=null&&id!=null)onOpenEmitter(id);else onClose();return;}
  const result=edit('Apply '+lookOf(stack).name,FX_SECTIONS,model=>compileAnimation(model,part,appliedStack,{...loaded,attachments}));if(result===false)return;
  onPlaced(loaded.assets,result?.geoset??part);const id=emitterId(result?.layers?.[emitterLayer]);if(emitterLayer!=null&&id!=null)onOpenEmitter(id);else onClose();
 };
 return <ToolWindow title="Surface Effects" windowRef={windowRef} overlayClass="resource-editor surface-effects" className="re-window sfx-window" headerClass="re-caption" closeClass="re-caption-close" onClose={onClose} unapplied={unapplied}
  after={<>{pendingEdit&&<Dialog title="Individual emitter changes" onClose={()=>{setPendingEdit(null);setColourRevision(v=>v+1);}} footer={<><button title={pendingEdit.aimOnly?"Use the layer aim for all emitters.":"Use the layer value and return hand-placed emitters to the formation."} onClick={()=>resolvePending('all')}>Apply to all</button><button title="Keep each emitter's own values and placement." onClick={()=>resolvePending('keep')}>Keep individual changes</button></>}><label><input type="checkbox" checked={pendingEdit.remember} onChange={event=>{const remember=event.target.checked;setPendingEdit(edit=>({...edit,remember}));}}/>Remember for this effect</label></Dialog>}{picture!=null&&<Suspense fallback={null}><TextureLibrary model={doc.model} onClose={()=>setPicture(null)} selectLabel="Use picture" onSelectTexture={async asset=>{
   const [file]=await resolveGameFiles([asset.name]);if(!file)throw Error('Choose a native Warcraft texture.');
   setStack(current=>({...current,layers:current.layers.map(l=>l.id===picture?withLayerTexture(l,asset.name):l)}));chosen.current=true;
   setPicture(null);setOriginal(false);
  }}/></Suspense>}</>}>
  <div className="sfx-target"><SelectField label="Geoset" wheel value={combined?-1:part} onChange={value=>pickTarget(Number(value))} options={targetOptions}/><label title="Highlight the selected part in the preview."><input data-hotkey="surface-effects:highlight-geoset" data-hotkey-manual data-hotkey-label="Highlight geoset" type="checkbox" checked={highlight} onChange={e=>setHighlight(e.target.checked)}/>Highlight geoset</label><span>Double-click a surface to select it.</span></div>
  <div className="sfx-body">
   <aside className="sfx-library">
    <input data-hotkey="surface-effects:find-a-surface-effect" data-hotkey-manual data-hotkey-label="Find a surface effect" className="sfx-search" type="search" aria-label="Find a surface effect" placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)}/>
    <div className="gf-tree sfx-cards" aria-label="Effects library">{groups.map(group=>{const entries=matches.filter(e=>e.group===group),open=!!query||folders.has(group);return <section key={group}>
     <GameLibraryRow as="button" className="gf-row folder" folder open={open} aria-expanded={open} name={translate(group)} count={entries.length} icon={<GameIcon fallback={open?FolderOpen:Folder}/>} onClick={()=>setFolders(old=>{const next=new Set(old);next.has(group)?next.delete(group):next.add(group);return next;})}/>
     {open&&entries.map(entry=>{const icon=entry.layers.find(l=>l.image)?.image,row=<GameLibraryRow as="button" key={entry.id} name={entry.own?entry.name:translate(entry.name)} className={'gf-row sfx-card'+(stack.look===entry.id?' selected':'')} aria-label={entry.name+(entry.impact?' impact':' global animation')} aria-pressed={stack.look===entry.id} icon={<GameIcon iconKey={icon?'fx:'+icon:null} read={icon?async()=>(await resolveGameFiles([icon]))[0]:null} fallback={Sparkles}/>} onClick={()=>choose(entry)}/>;return entry.own&&stack.look===entry.id?<div className="sfx-own-row" key={entry.id}>{row}<button type="button" className="preset-bar-delete" aria-label="Delete this look" title="Deletes this saved look. Models that use it keep their effect." onClick={()=>removeLook(entry.id)}>×</button></div>:row;})}
    </section>;})}{!matches.length&&<span className="sfx-empty">No matching effects</span>}</div>
   </aside>
   <main className="sfx-center"><div className="sfx-stage">
    <Suspense fallback={<span>Loading…</span>}><GlobalAnimationStage Preview={GamePreview} graph={graph} layer={layer} group={group} stackLayers={stack.layers} onLayers={list=>changeStack({...stack,layers:stack.layers.map(l=>list.find(next=>next.id===l.id)||l)})} selectedSite={selectedSite} selectSite={selectSite} deleteEmitter={deleteEmitter} windowRef={windowRef} showMarkers={showMarkers} surfaceSnap={surfaceSnap} setSurfaceSnap={setSurfaceSnap} placing={placing&&!original} rotating={rotating} onDrag={holdFrame} onLayer={(next,aimOnly)=>{changeStack({...stack,layers:stack.layers.map(l=>l.id===next.id?withLayerSize(layer,next):l)},aimOnly);}} model={original?doc.model:lastModel.current} revision={doc.revision} textureAssets={assets} modelPath={modelPath} preferences={preferences} teamColor={teamColor} presentation="preview" preserveCameraView emptyDragRotates mode="textured" view="perspective" playing={playing} onPlayingChange={setPlaying} time={time} onTimeChange={setTime} sequenceIndex={sequence} playbackSpeed={100} loop showParticles showGrid={false} showAxes={false} interactivePreview highlightSelection hoveredGeoset={highlight?part:null} onDoubleClickGeoset={pickGeoset} frameKey={solo?'fx:'+part:undefined} isolatedGeosets={isolated} hiddenGeosets={hidden} cameraMode={cameraMode} selectedNodeIds={idleSelection} overlays={overlays} onCaptureReady={captureReady}/></Suspense>
    {original&&<span className="sfx-comparison">Original</span>}{loading&&!error&&<span className="sfx-stage-message" role="status">Loading…</span>}{message&&<span className="sfx-stage-message sfx-error" role="alert">{message}</span>}
   </div><div className="sfx-transport"><CameraTools value={cameraMode} onChange={setCameraMode}/><button data-hotkey="surface-effects:play" data-hotkey-manual data-hotkey-label="Play / pause" onClick={()=>setPlaying(v=>!v)}>{playing?'Pause':'Play'}</button><ChoiceSelect data-hotkey="surface-effects:preview-animation" data-hotkey-manual data-hotkey-label="Preview animation" aria-label="Preview animation" value={sequence} onChange={value=>setSequence(Number(value))}>{doc.model.Sequences.map((s,i)=><option key={i} value={i}>{s.Name}</option>)}</ChoiceSelect><button data-hotkey="surface-effects:solo" data-hotkey-manual data-hotkey-label="Solo" aria-pressed={solo} onClick={()=>setSolo(v=>!v)} title="Show only the selected part.">Solo</button><button data-hotkey="surface-effects:fit-selection" data-hotkey-manual data-hotkey-label="Fit selection" title="Frame the selected part." onClick={()=>capture.current?.frameGeosets([part])}>Fit selection</button><button data-hotkey="surface-effects:original" data-hotkey-manual data-hotkey-label="Original" aria-pressed={original} title="Show the original model." onClick={()=>setOriginal(v=>!v)}>Original</button></div></main>
   <aside className="sfx-controls"><GlobalAnimationControls lookActions={lookActions} overlayLocked={members.length>0} assets={assets} pickTexture={setPicture} previewStrength={previewStrength} previewLayout={previewLayout} preferences={preferences} stack={stack} colourRevision={colourRevision} setStack={changeStack} trial={trial} setTrial={next=>{setOriginal(false);if(next)chosen.current=true;setTrial(next);}} selected={selectedLayer} select={selectLayer} selectedSite={selectedSite} deleteEmitter={deleteEmitter} showMarkers={showMarkers} toggleMarkers={()=>setShowMarkers(v=>!v)} groupSelect={groupSelect} toggleGroupSelect={()=>setGroupSelect(v=>!v)} groupCount={group.length} setEmitterEditPolicy={policy=>setStack(current=>withEmitterEditPolicy(current,policy))} surfaceSnap={surfaceSnap} setSurfaceSnap={setSurfaceSnap} graph={graph} recipeFrame={recipeFrame} readPreviewClock={()=>capture.current?.playbackClock()} previewFrame={time} previewSequence={sequence} authoredClocks={doc.model.GlobalSequences} ColourControl={ColourControl} placing={placing} setPlacing={value=>{setPlacing(value);if(!value){selectSite(null);setRotating(false);}}} rotating={rotating} setRotating={setRotating} openEmitter={apply} onSequence={setSequence}/></aside>
  </div><footer className="sfx-footer"><button onClick={onClose}>Cancel</button><button data-hotkey="surface-effects:apply-effect" data-hotkey-manual data-hotkey-label="Apply effect" className="sfx-apply" disabled={loading||!ready||!graph?.model||!!message} onClick={()=>apply()}>Apply effect</button></footer>
 </ToolWindow>;
}
