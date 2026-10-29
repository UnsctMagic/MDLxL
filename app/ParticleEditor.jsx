import { standSequenceIndex } from '../src/sequence-editor.js';
import ParticleIngredients from './ParticleIngredients.jsx';
import { trapTab } from './focus-trap.js';
import ParticleTestView from './ParticleTestView.jsx';
import ParticleExampleComparison from './ParticleExampleComparison.jsx';
import {activeParticleSample} from '../src/particle-sampling.js';
import {removeParticlePicture} from '../src/particle-picture.js';
import {fitRibbonToPolygons,ribbonPolygonSelection} from '../src/particle-ribbon-fit.js';
import {includeParticleAssets,embeddedParticleAssets,prepareParticlePlacementAssets,MAX_PARTICLE_PICTURE_BYTES} from '../src/particle-assets.js';
import React,{Suspense,lazy,useCallback,useDeferredValue,useEffect,useMemo,useRef,useState} from 'react';
import {EditorDocument,createNode,deleteNode} from '../src/editor-document.js';
import {particleRecipeDocument,extractParticleRecipe,placeParticleRecipe,effectNodes} from '../src/particle-recipes.js';
import {createStarterRecipe,nativeStarterTexture,STARTER_TEXTURES,RIBBON_TEXTURE,PARTICLE_STARTERS} from '../src/particle-starters.js';
import {parseParticleData,stringifyParticleData} from '../src/particle-data.js';
import {createParticleGesture} from '../src/particle-bindings.js';
import useMovableWindow from './useMovableWindow.js';
import {isTypingTarget} from '../src/preferences.js';
import ParticleCluelessControls from './ParticleCluelessControls.jsx';
import {RibbonFields} from './ParticleRibbonFields.jsx';
import ParticleKeyTrack from './ParticleKeyTrack.jsx';
import {detectPictureGrid} from './sprite-detect.js';
import {spriteGridValues,framePatterns} from '../src/sprite-frames.js';
import {translate} from '../src/localization.js';
import EmitterTextDialog from './EmitterTextDialog.jsx';
import {ribbonSizeAt,setRibbonSizeKey,removeRibbonSizeKey,setEmitterSpans} from '../src/emitter-timing.js';
import ParticlePlacementStage from './ParticlePlacementStage.jsx';
import ParticlePlacementControls from './ParticlePlacementControls.jsx';
import {placeTimedParticleRecipe} from '../src/particle-placement.js';
import {HD_CONVERTED_MESSAGE} from '../src/model-version.js';
import {addParticleDemonstration} from '../src/particle-sweep.js';
import ParticleStageTools from './ParticleStageTools.jsx';
import ParticleLibrary from './ParticleLibrary.jsx';
import GlowUpControls from './GlowUpControls.jsx';
import GlowStageTools from './GlowStageTools.jsx';
import {addHeroGlow,glowLayout,hasHeroGlow,weaponChoices} from '../src/glow-up.js';
import './resource-editors.css';
import './particle-editor.css';
import { gamePathKey } from '../src/game-path.js';
import { hasDesktop, resolveGameFiles } from './desktop.js';
const GamePreview=lazy(()=>import('./GamePreview.jsx'));
const TextureLibrary=lazy(()=>import('./TextureLibrary.jsx'));
const emptyAssets=new Map();
const GLOW_SECTIONS=['Geosets','Materials','Textures','Bones','Nodes','PivotPoints','GeosetAnims','GlobalSequences','BindPoses','Info'];
function starterLab(){const recipe=createStarterRecipe();return {doc:particleRecipeDocument(recipe),recipe,key:'lab-'+crypto.randomUUID(),assets:new Map()};}
/** Reads stock pictures from the game data, like every other native texture. */
async function stockAssets(names){const records=await resolveGameFiles(names);return new Map((records||[]).filter(record=>record.bytes).map(record=>[gamePathKey(record.name),record]));}
function labDraft(lab,mode){return stringifyParticleData({schema:'mdlxl-particle-draft',version:1,key:lab.key||lab.recipe.id,state:lab.doc.captureRecoveryState(),recipe:includeParticleAssets({...lab.recipe,native:lab.doc.model},lab.assets),mode});}
async function keepLab(lab,mode,active=true){
  const data=labDraft(lab,mode);
  await window.desktop?.particleWorkingCopy?.({id:lab.key||lab.recipe.id,data});
  if(active)await window.desktop?.particleDraft?.(data);
}
async function assetsFor(recipe){
  // Effects saved by earlier versions used generated pictures; they now use the stock ones.
  for(const [owner,field] of [...recipe.native.Textures.map(t=>[t,'Image']),...(recipe.dependencies||[]).map(d=>[d,'path'])]){const image=nativeStarterTexture(owner[field]);if(image)owner[field]=image;}
  const assets=embeddedParticleAssets(recipe),names=recipe.native.Textures.filter(t=>t.Image&&!assets.has(gamePathKey(t.Image))).map(t=>t.Image);
  if(names.length&&hasDesktop('resolveTextures')){const sourceKey=recipe.sources?.find(source=>source.buildKey)?.buildKey;const records=sourceKey?await window.desktop.particleAssets({sourceKey,dependencies:recipe.dependencies.filter(dep=>names.includes(dep.path))}):await resolveGameFiles(names);for(const record of records||[])if(record.bytes)assets.set(gamePathKey(record.name),record);}
  return assets;
}
export default function ParticleEditor({doc,revision=doc?.revision||0,edit,refresh,modelPath,textureAssets=emptyAssets,preferences,teamColor=0,selectedNodeId,attachmentNodeId,selectedGeometry,sequenceIndex=0,previewFrame=0,onClose,onNodeChange,onPlacedAssets}) {
  const [pictureLibrary,setPictureLibrary]=useState(false);
  const [recoveryReady,setRecoveryReady]=useState(false),[newOpen,setNewOpen]=useState(false),[examples,setExamples]=useState(false),[testView,setTestView]=useState(null),[ingredients,setIngredients]=useState(null),[muted,setMuted]=useState([]),[adding,setAdding]=useState(null);
  const [lab,setLab]=useState(starterLab),[context,setContext]=useState(Number.isInteger(selectedNodeId)?'On model':'Lab');
  // One streamlined mode; raw editing is Adjust Manually.
  const mode='Clueless';
  const [library,setLibrary]=useState(!Number.isInteger(selectedNodeId)),[tool,setTool]=useState('Look'),[lifeStage,setLifeStage]=useState(1),[cancelVersion,setCancelVersion]=useState(0),[scope,setScope]=useState('key');
  const [emitterId,setEmitterId]=useState(selectedNodeId??0),[sequence,setSequence]=useState(Number.isInteger(selectedNodeId)?sequenceIndex:0);
  const [time,setTime]=useState(Number.isInteger(selectedNodeId)?previewFrame:800),[playing,setPlaying]=useState(true),[speed,setSpeed]=useState(.25),[loop,setLoop]=useState(true),[linked,setLinked]=useState(true),[fxSpeed,setFxSpeed]=useState(.25),[previewStatus,setPreviewStatus]=useState({busy:false}),[solo,setSolo]=useState(false);
  const [demo,setDemo]=useState(false),[placementError,setPlacementError]=useState('');
  const [preparedPlacement,setPreparedPlacement]=useState(null),[sizeKey,setSizeKey]=useState(null),[manual,setManual]=useState(false);
  const [glow,setGlow]=useState(null),[glowSnapshot,setGlowSnapshot]=useState(null),glowShown=useRef(null),glowFitted=useRef(false);
  const [tick,setTick]=useState(0),[structure,setStructure]=useState(0),[message,setMessage]=useState(''),[snapshot,setSnapshot]=useState(null),[saveOpen,setSaveOpen]=useState(false),[name,setName]=useState('My effect'),[placement,setPlacement]=useState(null);
  const activeDoc=context==='Lab'?lab.doc:doc;
  useEffect(()=>{setMuted([]);setIngredients(null);},[activeDoc]);
  const [stock,setStock]=useState(emptyAssets);
  useEffect(()=>{let live=true;stockAssets(STARTER_TEXTURES).then(found=>{if(live)setStock(found);}).catch(()=>{});return()=>{live=false;};},[]);
  const labAssets=useMemo(()=>new Map([...stock,...lab.assets]),[stock,lab.assets]);
  const model=activeDoc.model,assets=context==='Lab'?labAssets:textureAssets;
  const working=useMemo(()=>structuredClone(model),[activeDoc,context,structure]);
  const soloId=solo?emitterId:null,previewSequence=demo&&context==='Lab'?sequence:-1;
  const preview=useMemo(()=>{
    const next=structuredClone(working);
    if(demo&&context==='Lab')addParticleDemonstration(next,Array.from(next.Sequences[sequence]?.Interval||[0,5000]));
    for(const family of ['ParticleEmitters2','RibbonEmitters','ParticleEmitters','ParticleEmitterPopcorns'])next[family]=next[family].filter(node=>(!solo||node.ObjectId===emitterId)&&!muted.includes(node.ObjectId));
    return next;
  },[working,soloId,muted,demo,context,previewSequence]);
  const selectedEffect=effectNodes(working).find(item=>item.node.ObjectId===emitterId),family=selectedEffect?.family,emitter=['ParticleEmitters2','RibbonEmitters'].includes(family)?selectedEffect.node:null;
  useEffect(()=>{setTool('Look');},[family]);
  const interval=model.Sequences[sequence]?.Interval||[0,5000],start=interval[0],end=interval[1],frame=Math.max(start,Math.min(end,time));
  const [dark,setDark]=useState(true);
  const previewPreferences=useMemo(()=>({...preferences,viewportAppearance:{...preferences.viewportAppearance,background:{type:'color',color:dark?'#24282c':'#d0d0d0'}}}),[preferences,dark]);
  const lastField=useRef(null),dialog=useRef(null),gesture=useRef(null),capture=useRef(null),loaded=useRef(false),latest=useRef(null),opening=useRef(false);
  const previewReady=useCallback(api=>{capture.current=api;if(api)api.whenReady().then(()=>{if(capture.current===api)api.fit();}).catch(error=>{if(capture.current===api)setMessage(error.message);});},[]);
  latest.current={lab,mode,context,activeDoc,working,emitterId,frame,sequence};
  const sync=()=>{
    for(const family of ['ParticleEmitters2','RibbonEmitters','ParticleEmitters','Helpers']){
      for(const node of working[family]){const source=model[family].find(n=>n.ObjectId===node.ObjectId);if(source){for(const key of Object.keys(node))delete node[key];Object.assign(node,structuredClone(source));}}
    }
    setTick(value=>value+1);refresh?.();
  };
  const apply=(label,mutate,sections=['Nodes'])=>{
    if(activeDoc.readOnly)return false;setPlaying(false);
    try{const result=context==='On model'&&edit?edit(label,sections,mutate):activeDoc.apply(label,sections,mutate);sync();setMessage('');return result;}
    catch(error){setMessage(error.message);sync();return false;}
  };
  const cancel=()=>{if(gesture.current){const {field,transaction}=gesture.current;const value=transaction.cancel();lastField.current=field;if(emitter){if(value===undefined)delete emitter[field];else emitter[field]=value;}gesture.current=null;setCancelVersion(v=>v+1);setTick(v=>v+1);}};
  const begin=(field,stage)=>{
    cancel();if(!emitter||activeDoc.readOnly)return;setPlaying(false);
    try{const transaction=createParticleGesture({doc:activeDoc,id:emitterId,field,options:{frame,globalTime:previewStatus.global??frame,interval:Array.from(interval),globalSequences:model.GlobalSequences,scope,family,...(stage&&typeof stage==='object'?stage:{stage})},commit:(label,sections,mutate)=>context==='On model'&&edit?edit(label,sections,mutate):activeDoc.apply(label,sections,mutate)});gesture.current={field,transaction};}
    catch(error){setMessage(error.message);}
  };
  const change=value=>{if(gesture.current){try{lastField.current=gesture.current.field;emitter[gesture.current.field]=gesture.current.transaction.update(value);setTick(v=>v+1);}catch(error){setMessage(error.message);cancel();}}};
  const finish=()=>{if(gesture.current){const current=gesture.current;gesture.current=null;try{current.transaction.finish();sync();}catch(error){setMessage(error.message);sync();}}};
  const update=(field,value)=>{cancel();setPlaying(false);lastField.current=field;const changedFlags=field==='Flags'?((emitter?.Flags||0)^value):0;try{const transaction=createParticleGesture({doc:activeDoc,id:emitterId,field,options:{family,raw:true},commit:(label,sections,mutate)=>context==='On model'&&edit?edit(label,sections,mutate):activeDoc.apply(label,sections,mutate)});transaction.update(value);transaction.finish();sync();setMessage(field==='Gravity'&&family==='RibbonEmitters'?'Ribbon gravity is saved, but this preview does not simulate it.':field==='PriorityPlane'||changedFlags&65536?'Draw-order settings are saved; cross-effect ordering is not yet validated in this preview.':changedFlags&(32768|262144)?'Lighting and fog flags are saved; their effect is not shown in this preview.':'');}catch(error){setMessage(error.message);sync();}};

  // Smooth Size: a draft key shown in the preview only; Commit writes it as one undo step.
  useEffect(()=>{setSizeKey(null);},[emitterId,sequence,context]);
  useEffect(()=>{
   if(!sizeKey||family!=='RibbonEmitters')return;
   const draft=working.RibbonEmitters.find(n=>n.ObjectId===emitterId),source=model.RibbonEmitters.find(n=>n.ObjectId===emitterId);if(!draft||!source)return;
   draft.HeightAbove=structuredClone(source.HeightAbove);draft.HeightBelow=structuredClone(source.HeightBelow);
   try{setRibbonSizeKey(working,emitterId,sizeKey.frame,sequence,sizeKey);}catch(error){setMessage(error.message);}
   setTick(v=>v+1);
  },[sizeKey,working]);
  const smoothSize=frame=>{cancel();setPlaying(false);setTime(frame);try{setSizeKey({frame,...ribbonSizeAt(model,emitterId,frame,sequence)});}catch(error){setMessage(error.message);}dialog.current?.focus();};
  // The banner disappears with its buttons; keep the keyboard in the editor so Ctrl+Z undoes the key.
  const commitSize=()=>{const key=sizeKey;if(key&&apply('Set ribbon size key',m=>setRibbonSizeKey(m,emitterId,key.frame,sequence,key))!==false)setSizeKey(null);dialog.current?.focus();};
  const cancelSize=()=>{setSizeKey(null);sync();dialog.current?.focus();};
  const patch=(values,error)=>{if(error){setMessage(error);return false;}cancel();lastField.current=Object.keys(values).length===1?Object.keys(values)[0]:null;return apply('Change particle appearance',m=>Object.assign(m[family].find(n=>n.ObjectId===emitterId),structuredClone(values)));};
  const teamPicture=id=>{
    cancel();
    const index=apply('Choose team picture',m=>{let index=m.Textures.findIndex(t=>t.ReplaceableId===id&&!t.Image);if(index<0)index=m.Textures.push({Image:'',ReplaceableId:id,Flags:0})-1;const emitter=m.ParticleEmitters2.find(n=>n.ObjectId===emitterId);emitter.TextureID=index;emitter.ReplaceableId=id;return index;},['Nodes','Textures']);
    if(index!==false){setStructure(v=>v+1);fitFrames(null,'',id);}
  };
  // A sprite sheet gets its frames set up right away; a plain picture has none.
  const fitFrames=async(asset,name,replaceableId=0)=>{
    try{
      // The game's own sprite sheets get the setup the game uses most; other pictures are looked at.
      const known=!replaceableId&&framePatterns(name)[0]?.values,grid=known?{rows:known.Rows,columns:known.Columns}:await detectPictureGrid(asset,{name,replaceableId}),doc=latest.current.activeDoc,id=latest.current.emitterId,current=doc.model.ParticleEmitters2.find(n=>n.ObjectId===id);
      if(!current||(!known&&current.Rows===grid.rows&&current.Columns===grid.columns))return;
      if(apply(grid.rows*grid.columns>1?'Use sprite frames':'Use one picture',m=>{const node=m.ParticleEmitters2.find(n=>n.ObjectId===id);Object.assign(node,known||spriteGridValues(node,grid.rows,grid.columns));})!==false){setStructure(v=>v+1);setMessage(grid.rows*grid.columns>1?'Found '+grid.rows*grid.columns+' frames. They play across the particle\'s life.':'');}
    }catch{}
  };
  const choosePicture=index=>{if(patch({TextureID:index,ReplaceableId:0})!==false){setStructure(v=>v+1);const image=model.Textures[index]?.Image;fitFrames(assets.get(gamePathKey(image)),image);}};
  const removePicture=index=>{
    cancel();const result=apply('Remove particle picture',m=>removeParticlePicture(m,emitterId,index),['Nodes','Textures','Materials']);
    if(result===false)return;
    setStructure(v=>v+1);
  };
  const usePicture=async asset=>{
      const bytes=new Uint8Array(asset.bytes);
      if(bytes.byteLength>MAX_PARTICLE_PICTURE_BYTES)throw Error('Choose a picture smaller than 4 MiB for a portable preset.');
      const name=asset.name||asset.path;
      if(!/\.(blp|dds|tga)$/i.test(name||''))throw Error('Choose a .blp, .dds or .tga picture to keep its original texture path.');
      const nextAsset={...asset,name,bytes,...(asset.libraryKey&&asset.source!=='custom'?{}:{origin:'particle-custom',source:'parts'})};
      if(latest.current.activeDoc!==activeDoc||latest.current.emitterId!==emitterId)return;
      cancel();const result=apply('Choose particle picture',m=>{let index=m.Textures.findIndex(t=>t.Image===name);if(index<0)index=m.Textures.push({Image:name,ReplaceableId:0,Flags:0})-1;const emitter=m.ParticleEmitters2.find(n=>n.ObjectId===emitterId);emitter.TextureID=index;emitter.ReplaceableId=0;},['Nodes','Textures']);
      if(result===false)return;const next=new Map(assets);if(!next.has(gamePathKey(name)))next.set(gamePathKey(name),nextAsset);if(context==='Lab')setLab(old=>({...old,assets:next}));else onPlacedAssets?.(next);setStructure(v=>v+1);await fitFrames(nextAsset,name);
  };
  const importPicture=async()=>{
    try{const list=await window.desktop.textures();if(list?.length)await usePicture(list[0]);}catch(error){setMessage(error.message);}
  };
  const close=async()=>{cancel();try{if(recoveryReady)await keepLab(lab,mode);onClose?.();}catch(error){setMessage('Draft could not be saved: '+error.message);}};
  useEffect(()=>{const previous=document.activeElement;dialog.current?.focus();return()=>previous?.focus?.();},[]);
  useEffect(()=>{
    let live=true;
    Promise.resolve(window.desktop?.particleDraft?.()).then(async text=>{
      if(!text||!live||loaded.current)return;const draft=parseParticleData(text);
      if(draft.schema!=='mdlxl-particle-draft'||draft.version!==1)throw Error('Unsupported particle draft.');
      const restored=EditorDocument.restoreRecoveryState(draft.state),recipe=draft.recipe,resolved=await assetsFor({...recipe,native:restored.model});
      if(live&&!loaded.current){setLab({doc:restored,recipe,assets:resolved,key:draft.key||recipe.id});if(!Number.isInteger(selectedNodeId))setEmitterId(effectNodes(restored.model)[0]?.node.ObjectId??null);}
    }).catch(error=>setMessage(error.message)).finally(()=>{if(live)setRecoveryReady(true);});
    return()=>{live=false;};
  },[]);
  useEffect(()=>{
    if(!recoveryReady)return;
    const timer=setTimeout(()=>{keepLab(lab,mode).catch(error=>setMessage(error.message));},800);
    return()=>clearTimeout(timer);
  },[lab,lab.doc.revision,mode,tick,recoveryReady]);
  useEffect(()=>{if(context==='On model')sync();},[revision]);
  useEffect(()=>{const flush=event=>{const current=latest.current;if(current&&recoveryReady)event.detail.push(keepLab(current.lab,current.mode));};window.addEventListener('mdlxl-flush-particle-draft',flush);return()=>window.removeEventListener('mdlxl-flush-particle-draft',flush);},[recoveryReady]);
  const initialPlacement=()=>{
    const sequence=doc.model.Sequences[sequenceIndex]?sequenceIndex:0,interval=doc.model.Sequences[sequence]?.Interval||[0,5000],parent=doc.model.Nodes[attachmentNodeId];
    return {parent:parent?String(parent.ObjectId):'',position:Array.from(parent?.PivotPoint||[0,0,0]),sequence,from:Math.max(interval[0],Math.min(interval[1],Math.round(previewFrame))),to:'',fit:true,motion:parent?'target':'source'};
  };
  const beginPlacement=()=>{cancel();setIngredients(null);try{
    setMessage('');setPlacementError('');setLibrary(false);
    setGlow(null);setPlacement(initialPlacement());
  }catch(error){setMessage(error.message);}};
  const markedPolygons=useMemo(()=>doc?ribbonPolygonSelection(doc.model,selectedGeometry).polygons:0,[doc,revision,selectedGeometry]);
  const beginRibbon=()=>{
    cancel();if(!doc||doc.readOnly)return;
    try{
      const ribbon=fitRibbonToPolygons(doc.model,selectedGeometry),placement=initialPlacement();
      placement.ribbon=ribbon;placement.position=[0,0,0];placement.motion='target';
      placement.sequences=doc.model.Sequences.length?[placement.sequence]:[];
      placement.parent=ribbon.parent==null?'':String(ribbon.parent);
      setPlacement(placement);setGlow(null);setLibrary(false);setNewOpen(false);setIngredients(null);setExamples(false);setTestView(null);setPlacementError('');setMessage('');
    }catch(error){setMessage(error.message);}
  };
  // Glow Up: hero glow at the origin and along the weapon (docs/GLOW_UP.md).
  const glowChoices=useMemo(()=>glow&&doc?weaponChoices(doc.model,selectedGeometry):[],[!!glow,doc,revision,selectedGeometry]);
  const glowOptions=value=>{const choice=glowChoices.find(c=>c.key===value.weaponKey);return {origin:value.origin,originSize:value.originSize,originOffset:value.originOffset,weapon:value.weapon,weaponIds:choice?.ids||[],marked:choice?.marked,weaponSize:value.weaponSize,weaponFrom:value.weaponFrom??undefined,weaponTo:value.weaponTo??undefined,originBrightness:value.originBrightness,weaponBrightness:value.weaponBrightness};};
  // Drag handles in the preview, as for emitters: their bind-pose points follow the weapon bone.
  const glowLayoutNow=useMemo(()=>{if(!glow||!doc)return null;try{return glowLayout(doc.model,glowOptions(glow));}catch{return null;}},[glow,doc,revision,glowChoices]);
  const glowMarks=useMemo(()=>{
    if(!glowLayoutNow)return undefined;const marks={};
    if(glow.origin){const {center:[x,y,z],half}=glowLayoutNow.origin;Object.assign(marks,{origin:{point:[x,y,z]},originX:{point:[x+1,y,z]},originY:{point:[x,y+1,z]},edge:{point:[x+half,y,z]},edgeUnit:{point:[x+half+1,y,z]}});[[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([a,b],i)=>{marks['corner'+i]={point:[x+a*half,y+b*half,z]};});}
    const weapon=glow.weapon&&glowLayoutNow.weapons[0];
    if(weapon)for(const key of ['butt','tip','start','end','mid'])marks[key]={point:weapon[key],node:weapon.parentId,...(key==='mid'?{radius:weapon.half}:{})};
    // One model unit along the weapon and its two sides from each end: the drag turns screen movement into these.
    if(weapon)for(const key of ['start','end'])for(const axis of ['along','side','other'])marks[key+'-'+axis]={point:weapon[key].map((v,a)=>v+weapon.frame[axis][a]),node:weapon.parentId};
    return marks;
  },[glowLayoutNow,glow?.origin,glow?.weapon]);
  // Each slider change rebuilds the preview; fit the view once, then keep the user's camera.
  const glowPreviewReady=useCallback(api=>{capture.current=api;if(api&&!glowFitted.current){glowFitted.current=true;api.whenReady().then(()=>{if(capture.current===api)api.fit();}).catch(error=>{if(capture.current===api)setMessage(error.message);});}},[]);
  // Hold the animation still while a glow handle is dragged, then play on if it was playing.
  const glowPaused=useRef(false),glowDrag=active=>{if(active){glowPaused.current=playing;if(playing)setPlaying(false);}else{if(glowPaused.current)setPlaying(true);glowPaused.current=false;}};
  const glowDraft=useDeferredValue(glow);
  const glowPreview=useMemo(()=>{
    if(!glowDraft||!doc)return null;
    try{const copy=structuredClone(doc.model);addHeroGlow(copy,glowOptions(glowDraft));return {model:copy};}catch(error){return {error:error.message};}
  },[glowDraft,doc,revision,glowChoices]);
  if(!glow)glowShown.current=null;else if(glowPreview?.model)glowShown.current=glowPreview.model;
  const beginGlow=()=>{
    cancel();if(!doc||doc.readOnly)return;
    if(glow){setGlow(null);return;}
    try{
      const best=weaponChoices(doc.model,selectedGeometry)[0],clips=doc.model.Sequences,clip=standSequenceIndex(doc.model);
      if(context!=='On model'){setContext('On model');setEmitterId(effectNodes(doc.model)[0]?.node.ObjectId??null);setStructure(v=>v+1);}
      setSequence(clip);setTime(clips[clip]?.Interval[0]??0);setPlaying(true);
      // Weapon glow starts on only for a clear weapon: marked polygons or a weapon-named bone.
      glowFitted.current=false;
      setGlowSnapshot(null);
      setGlow({origin:true,originSize:1,originOffset:[0,0],weapon:!!best?.sure,weaponKey:best?.key??'',weaponSize:1,weaponFrom:null,weaponTo:null,originBrightness:.75,weaponBrightness:.75});
      setPlacement(null);setLibrary(false);setNewOpen(false);setIngredients(null);setExamples(false);setTestView(null);setMessage('');
    }catch(error){setMessage(error.message);}
  };
  const createGlow=()=>{
    try{
      const options=glowOptions(glow),mutate=m=>addHeroGlow(m,options);
      const accepted=edit?edit('Glow Up',GLOW_SECTIONS,mutate,{rethrow:true}):doc.apply('Glow Up',GLOW_SECTIONS,mutate);
      if(accepted===false)return;
      setGlow(null);setStructure(v=>v+1);refresh?.();setMessage('Hero glow added. Undo restores the model.');
    }catch(error){setMessage(error.message);}
  };
  const toggleLibrary=async()=>{
    cancel();setAdding(null);setIngredients(null);setTestView(null);setExamples(false);
    if(library){setLibrary(false);return;}
    setGlow(null);
    try{if(recoveryReady)await keepLab(lab,mode);setLibrary(true);}catch(error){setMessage(error.message);}
  };
  const loadRecipe=async recipe=>{
    if(opening.current||!recoveryReady)return false;opening.current=true;cancel();loaded.current=true;
    try{
      await keepLab(lab,mode,false);
      const key=recipe.workingId||'lab-'+crypto.randomUUID(),saved=recipe.workingId?await window.desktop?.particleWorkingCopy?.({id:key}):null,draft=saved?parseParticleData(saved):null;
      if(draft&&(draft.schema!=='mdlxl-particle-draft'||draft.version!==1))throw Error('Unsupported working effect.');
      const nextDoc=draft?EditorDocument.restoreRecoveryState(draft.state):particleRecipeDocument(recipe),nextRecipe=draft?{...draft.recipe,name:recipe.name}:recipe;
      const next={doc:nextDoc,recipe:nextRecipe,key,assets:await assetsFor({...nextRecipe,native:nextDoc.model})};
      setLab(next);setContext('Lab');setEmitterId(effectNodes(next.doc.model)[0]?.node.ObjectId??null);const sample=recipe.previewSample||activeParticleSample(next.doc.model);setSequence(sample.sequence);setTime(sample.time);setPlaying(true);setDemo(false);setLibrary(false);setPlacement(null);setMessage(draft?'Your edits are kept.':'');setStructure(v=>v+1);return true;
    }
    catch(error){setMessage(error.message);}
    finally{opening.current=false;}
  };
  const chooseRecipe=async recipe=>{
    if(adding==='ingredient'){
      if(opening.current||!recoveryReady)return false;opening.current=true;cancel();
      try{
        const incoming=await assetsFor(recipe),prepared=await prepareParticlePlacementAssets(recipe,incoming,assets);let result;
        const accepted=apply('Add effect ingredient',target=>{result=placeParticleRecipe(target,prepared.recipe,{sourceInterval:Array.from(recipe.native.Sequences[recipe.defaultSequence||0]?.Interval||[0,5000]),targetInterval:Array.from(interval),fit:true,convertHD:context==='On model'});},['Nodes','PivotPoints','Textures','Materials','TextureAnims','GlobalSequences']);
        if(accepted===false)return false;
        setLab(old=>({...old,assets:new Map([...old.assets,...prepared.assets])}));setEmitterId(result.ids[0]);setLibrary(false);setAdding(null);setStructure(v=>v+1);if(result.convertedHD)window.dispatchEvent(new CustomEvent('mdlxl-notice',{detail:HD_CONVERTED_MESSAGE}));return true;
      }catch(error){setMessage(error.message);return false;}finally{opening.current=false;}
    }
    const accepted=await loadRecipe(recipe);if(accepted&&adding==='model')setPlacement(initialPlacement());if(accepted)setAdding(null);return accepted;
  };
  const remove=()=>{
    cancel();if(!selectedEffect)return;
    const accepted=apply('Remove effect ingredient',target=>deleteNode(target,emitterId),['Nodes','PivotPoints','Info']);
    if(accepted===false)return;
    const next=effectNodes(activeDoc.model)[0]?.node.ObjectId??null;setEmitterId(next);if(context==='On model')onNodeChange?.(next);setStructure(v=>v+1);
  };
  const recipeNow=()=>includeParticleAssets(extractParticleRecipe(activeDoc.model,effectNodes(activeDoc.model).filter(item=>context==='Lab'||item.node.ObjectId===emitterId).map(item=>item.node.ObjectId),{...(context==='Lab'?lab.recipe:{}),name,defaultSequence:sequence}),assets);
  const save=async()=>{
    try{const recipe=recipeNow();recipe.name=name;const saved=await window.desktop.particleSave({data:stringifyParticleData(recipe),name});setMessage('Saved '+saved.name);setSaveOpen(false);if(context==='Lab'){const nativeRecipe={...recipe,id:saved.id};lab.doc.markSaved(lab.doc.serialize('mdx'));setLab({...lab,recipe:nativeRecipe});}}
    catch(error){setMessage(error.message);}
  };
  const chooseContext=value=>{cancel();setGlow(null);setIngredients(null);setTestView(null);setExamples(false);setContext(value);setEmitterId(effectNodes(value==='Lab'?lab.doc.model:doc.model)[0]?.node.ObjectId??null);setSequence(0);setTime(800);setPlacement(null);setStructure(v=>v+1);};
  const undo=redo=>{cancel();if(activeDoc.readOnly||library||examples||testView||ingredients)return;try{activeDoc[redo?'redo':'undo']();if(!effectNodes(activeDoc.model).some(({node})=>node.ObjectId===emitterId)){const id=effectNodes(activeDoc.model)[0]?.node.ObjectId??null;setEmitterId(id);if(context==='On model')onNodeChange?.(id);}setStructure(v=>v+1);setTick(v=>v+1);refresh?.();}catch(error){setMessage(error.message);}};
  const add=()=>{cancel();setGlow(null);setAdding(null);setIngredients(null);setTestView(null);setExamples(false);setNewOpen(v=>!v);};
  const place=()=>{
    try{
      if(!placementResources)return;
      const {recipe,assets:incoming}=placementResources;
      let result;const mutate=target=>{result=placeTimedParticleRecipe(target,recipe,placement,{convertHD:true});};
      const accepted=edit?edit('Add particle effect',['Nodes','Textures','Materials','TextureAnims','GlobalSequences','PivotPoints'],mutate):doc.apply('Add particle effect',['Nodes','Textures','Materials','TextureAnims','GlobalSequences','PivotPoints'],mutate);
      if(accepted===false)return;
      onPlacedAssets?.(incoming);setContext('On model');setEmitterId(result.ids[0]);onNodeChange?.(result.ids[0]);setSequence(placement.sequence);setTime(result.interval[0]);setTool('Look');setPlacement(null);setStructure(v=>v+1);refresh?.();setMessage(placement.ribbon?'Ribbon added. Drag its two ends to adjust the edge.':'Effect added. Undo restores the model.');if(result.convertedHD)window.dispatchEvent(new CustomEvent('mdlxl-notice',{detail:HD_CONVERTED_MESSAGE}));
    }catch(error){setMessage(error.message);}
  };
  const placementRecipe=useMemo(()=>placement?.ribbon?.recipe||(placement?extractParticleRecipe(model,effectNodes(model).map(item=>item.node.ObjectId),{...lab.recipe,name:lab.recipe.name,defaultSequence:sequence}):null),[!!placement,placement?.ribbon,model,activeDoc.revision,sequence]);
  const incomingPlacementAssets=useMemo(()=>placement?.ribbon?new Map([...stock].filter(([key])=>key===gamePathKey(RIBBON_TEXTURE))):assets,[assets,stock,placement?.ribbon]);
  useEffect(()=>{
    let live=true;setPreparedPlacement(null);
    if(placementRecipe)prepareParticlePlacementAssets(placementRecipe,incomingPlacementAssets,textureAssets).then(prepared=>{if(live)setPreparedPlacement({...prepared,original:placementRecipe,incoming:incomingPlacementAssets,target:textureAssets});}).catch(error=>{if(live)setPlacementError(error.message);});
    return()=>{live=false;};
  },[placementRecipe,incomingPlacementAssets,textureAssets]);
  const placementResources=preparedPlacement?.original===placementRecipe&&preparedPlacement?.incoming===incomingPlacementAssets&&preparedPlacement?.target===textureAssets?preparedPlacement:null;
  const placementAssets=useMemo(()=>new Map([...textureAssets,...(placementResources?.assets||[])]),[textureAssets,placementResources]);
  const asset=assets.get(gamePathKey(working.Textures[emitter?.TextureID]?.Image));
  const movable = useMovableWindow(dialog);
  return <div className="resource-editor particle-editor" onKeyDown={event=>{
    event.stopPropagation();
    if(event.key==='Escape'){event.preventDefault();if(sizeKey){setSizeKey(null);sync();}else if(gesture.current)cancel();else if(placement)setPlacement(null);else if(glow)setGlow(null);else if(ingredients)setIngredients(null);else if(library)setLibrary(false);else close();}
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();undo(event.shiftKey);}
    if(event.key===' '&&!isTypingTarget(event.target)){event.preventDefault();setPlaying(v=>!v);}
    trapTab(event,dialog.current);
  }}>
    <section ref={dialog} style={movable.style} tabIndex={-1} className="re-window pe-window" role="dialog" aria-modal="true" aria-label="Particle Editor" data-hotkey-scope="dialog" data-hotkey-prefix="particles">
      <header className="re-caption" {...movable.handleProps}><span>Particle Editor <small>· {context}</small></span><button className="re-caption-close" aria-label="Close Particle Editor" onClick={close}>×</button></header>
      <div className="pe-toolbar"><button aria-pressed={library} onClick={toggleLibrary}>Library</button><button disabled={activeDoc.readOnly} onClick={add}>New</button>{markedPolygons>0&&<button disabled={doc.readOnly} onClick={beginRibbon}>Add ribbon</button>}{doc&&<button disabled={doc.readOnly} aria-pressed={!!glow} title="Add hero glow like Warcraft III heroes: a pulsing team-coloured glow at the feet and along the weapon." onClick={beginGlow}>Glow Up</button>}<select aria-label="Particle context" value={context} onChange={e=>chooseContext(e.target.value)}><option>Lab</option><option disabled={!doc}>On model</option></select><span className="pe-spacer"/><button onClick={()=>undo(false)} disabled={activeDoc.readOnly||library||examples||!!testView||!!ingredients||!activeDoc.canUndo}>Undo</button><button onClick={()=>undo(true)} disabled={activeDoc.readOnly||library||examples||!!testView||!!ingredients||!activeDoc.canRedo}>Redo</button><button disabled={!effectNodes(model).length} onClick={()=>{setName(context==='Lab'?lab.recipe.name:'My effect');setSaveOpen(v=>!v);}}>Save preset</button>{context==='Lab'&&<button disabled={!doc||doc.readOnly||!effectNodes(model).length} onClick={beginPlacement}>Add to model</button>}</div>
      {newOpen&&<div className="pe-action-strip"><span>Start with</span>{PARTICLE_STARTERS.map(([id,label])=><button key={id} disabled={!recoveryReady} onClick={async()=>{setNewOpen(false);if(await chooseRecipe({...createStarterRecipe(id),id:'lab-'+crypto.randomUUID()}))setDemo(id==='ribbon');}}>{label}</button>)}<button onClick={()=>{setExamples(true);setNewOpen(false);}}>Compare examples</button><button onClick={()=>setNewOpen(false)}>Cancel</button></div>}
      {family==='RibbonEmitters'&&context==='Lab'&&!library&&!placement&&<div className="pe-action-strip"><button aria-pressed={demo} onClick={()=>setDemo(value=>!value)}>Preview swing</button><small>For a weapon: mark its back polygons in Vertices, then open EMTR.</small></div>}
      {saveOpen&&<div className="pe-action-strip">{context==='Lab'&&effectNodes(model).length>1&&<span>Whole effect · {effectNodes(model).length} ingredients</span>}<label>Preset name<input aria-label="Preset name" value={name} maxLength={120} onChange={e=>setName(e.target.value)}/></label><button onClick={save}>Save to My presets</button><button onClick={()=>setSaveOpen(false)}>Cancel</button></div>}
      <div className={'pe-body '+(mode==='Classic'?'pe-classic':'pe-clueless')+(library?' pe-browsing':'')}>
        <div className="pe-preview-pane">
          <div className="pe-preview">{glow?<Suspense fallback={<span>Loading preview…</span>}>{glowShown.current?<GamePreview presentation="preview" model={glowShown.current} revision={0} textureAssets={textureAssets} modelPath={modelPath} preferences={previewPreferences} teamColor={teamColor} sequenceIndex={sequence} time={frame} playing={playing} playbackSpeed={100} loop onTimeChange={setTime} onPlayingChange={setPlaying} mode="textured" view="perspective" showParticles={true} showGrid={true} preserveCameraView onCaptureReady={glowPreviewReady} onParticleStage={setGlowSnapshot} particleStageMarks={glowMarks} overlays={{bones:false,nodes:false,attachments:false,particles:false}}/>:<span>{glowPreview?.error||'Preparing glow…'}</span>}<GlowStageTools snapshot={glowSnapshot} glow={glow} layout={glowLayoutNow} onChange={setGlow} onDrag={glowDrag}/></Suspense>:placement?(placementResources?<ParticlePlacementStage {...{doc,placement,teamColor}} recipe={placementResources.recipe} textureAssets={placementAssets} preferences={previewPreferences} onPosition={position=>setPlacement(p=>({...p,position}))} onEnd={to=>setPlacement(p=>({...p,to}))} onError={setPlacementError}/>:<span>Preparing placement…</span>):<><Suspense fallback={<span>Loading preview…</span>}><GamePreview suspended={library||pictureLibrary||examples||!!testView||!!ingredients} presentation="preview" model={preview} revision={0} particleAuthoring particleLiveModel={working} particleLiveRevision={tick} particleLiveField={lastField.current} particleLinked={linked} particleFxSpeed={(linked?speed:fxSpeed)*100} onParticleStatus={setPreviewStatus} particleSelectedId={emitterId} particleAnchorId={emitterId} onParticleStage={setSnapshot} onParticlePick={id=>{cancel();setEmitterId(id);if(context==='On model')onNodeChange?.(id);}} onCameraGestureChange={active=>{if(active)cancel();}} textureAssets={assets} modelPath={context==='On model'?modelPath:undefined} preferences={previewPreferences} teamColor={teamColor} sequenceIndex={sequence} time={frame} playing={playing} playbackSpeed={speed*100} loop={loop} onTimeChange={setTime} onPlayingChange={setPlaying} mode="textured" view="perspective" showParticles={true} showGrid={true} preserveCameraView onCaptureReady={previewReady} overlays={{bones:false,nodes:false,attachments:false,particles:false}}/></Suspense>{sizeKey&&<div className="pe-size-banner" role="status" aria-label="Smooth Size"><b>Adjust the scale at this specific key (frame {sizeKey.frame}) and the ribbon will grow/shrink smoothly between keys.</b><span>Drag the green ends.</span><button onClick={commitSize} title="Write this size key. Undo or Ctrl+Z removes it.">Commit</button><button onClick={cancelSize} title="Discard (Esc).">Cancel</button></div>}{mode==='Clueless'&&!activeDoc.readOnly&&<ParticleStageTools {...{snapshot,tool,emitter,begin,change,finish,cancel,cancelVersion,lifeStage,sizeKey}} onSizeDraft={(field,value)=>setSizeKey(key=>key&&{...key,[field==='HeightAbove'?'above':'below']:value})} options={{frame,globalTime:previewStatus.global??frame,interval,globalSequences:model.GlobalSequences,family}}/>}</>}
          {manual&&selectedEffect&&<EmitterTextDialog doc={activeDoc} id={emitterId} onEdit={(label,sections,mutate)=>apply(label,mutate,sections)} onClose={()=>setManual(false)}/>}
          {ingredients&&<ParticleIngredients source={ingredients} {...{assets,preferences:previewPreferences,teamColor,mode,muted}} onMute={id=>setMuted(values=>values.includes(id)?values.filter(value=>value!==id):[...values,id])} onSelect={id=>{cancel();setEmitterId(id);if(context==='On model')onNodeChange?.(id);setIngredients(null);}} onClose={()=>setIngredients(null)}/>}
          {testView&&<ParticleTestView {...testView} assets={assets} preferences={preferences} onClose={()=>setTestView(null)}/>}
          {examples&&<ParticleExampleComparison preferences={preferences} onClose={()=>setExamples(false)} onChoose={recipe=>{setExamples(false);chooseRecipe(recipe);}}/>}
          {library&&<ParticleLibrary preferences={preferences} disabled={!recoveryReady} onClose={()=>setLibrary(false)} onChoose={chooseRecipe} onError={setMessage}/>}
          </div>
          {glow&&<div className="pe-transport"><button title="Hold the animation still so you can drag every glow handle, then play it again. Space does the same." onClick={()=>setPlaying(v=>!v)}>{playing?'Pause':'Play'}</button></div>}
          {!placement&&!glow&&!library&&<><div className="pe-stage-options"><select aria-label="Effect ingredient" value={emitterId??''} onChange={e=>{cancel();setEmitterId(Number(e.target.value));if(context==='On model')onNodeChange?.(Number(e.target.value));}}>{!selectedEffect&&<option value="">Choose an effect</option>}{effectNodes(model).map(({node,family},i)=><option key={node.ObjectId} value={node.ObjectId} translate="no">{translate(family==='RibbonEmitters'?'Ribbon':'Particle')+' '+(i+1)+(node.Name?' · '+node.Name:'')}</option>)}</select><button disabled={activeDoc.readOnly} onClick={()=>{cancel();setAdding(context==='Lab'?'ingredient':'model');setLibrary(true);}}>Add</button><button disabled={activeDoc.readOnly||!selectedEffect} onClick={remove}>Remove</button>{effectNodes(model).length>1&&<button aria-pressed={!!ingredients} onClick={()=>{cancel();setTestView(null);setExamples(false);setIngredients(value=>value?null:structuredClone(working));}}>Ingredients{muted.length?' · '+muted.length+' muted':''}</button>}<button aria-pressed={solo} onClick={()=>{cancel();setSolo(v=>!v);}}>Solo</button><button onClick={()=>{cancel();capture.current?.fit();}}>Fit view</button><button onClick={()=>setDark(v=>!v)}>{dark?"Light":"Dark"}</button><button disabled={!selectedEffect} onClick={()=>{cancel();setIngredients(null);setTestView({source:structuredClone(model),ids:context==='Lab'?effectNodes(model).map(item=>item.node.ObjectId):[emitterId],sequence,time:frame,frame});}}>Test view</button></div>
          <div className="pe-transport"><button onClick={()=>setPlaying(v=>!v)}>{playing?'Pause':'Play'}</button><button aria-label="Step particle preview" onClick={()=>{setPlaying(false);setTime(v=>Math.min(end,v+10));}}>Step</button><ParticleKeyTrack model={model} emitter={emitter} timed={!!selectedEffect&&!placement} ribbon={family==='RibbonEmitters'} sequence={sequence} start={start} end={end} frame={frame} disabled={activeDoc.readOnly||!!sizeKey} onScrub={value=>{cancel();setPlaying(false);setTime(value);}} onSpans={(spans,error)=>{if(error){setMessage(error);return;}apply('Change when the ribbon shows',m=>{setEmitterSpans(m,emitterId,sequence,spans);});}} onSmoothSize={smoothSize} onRemoveSizeKey={frame=>apply('Remove ribbon size key',m=>{removeRibbonSizeKey(m,emitterId,frame,sequence);})}/><select aria-label="Preview speed" value={speed} onChange={e=>setSpeed(Number(e.target.value))}>{(linked?[.05,.1,.25,.5,1]:[0,.05,.1,.25,.5,1]).map(value=><option key={value} value={value}>{value}×</option>)}</select><button aria-pressed={loop} onClick={()=>setLoop(v=>!v)}>Loop</button></div>
          <details className="pe-clock-options"><summary>{linked?'Clock options':'Unlinked · inspection'}</summary><label><input aria-label="Link animation and FX clocks" type="checkbox" checked={linked} onChange={e=>{setLinked(e.target.checked);if(e.target.checked&&speed===0)setSpeed(.5);}}/>Link animation and FX</label>{!linked&&<label>FX speed<select aria-label="FX speed" value={fxSpeed} onChange={e=>setFxSpeed(Number(e.target.value))}>{[0,.1,.25,.5,1].map(value=><option key={value} value={value}>{value===0?'Paused':value+'×'}</option>)}</select></label>}</details>
          <select aria-label="Particle preview animation" value={sequence} onChange={e=>{cancel();const next=Number(e.target.value);setSequence(next);setTime(model.Sequences[next].Interval[0]);}}>{model.Sequences.map((clip,index)=><option key={index} value={index}>{clip.Name}</option>)}</select></>}
        </div>
        <fieldset className="pe-controls inspector-fields" disabled={activeDoc.readOnly||library||examples||!!testView||!!ingredients}>
          {glow?<GlowUpControls glow={glow} choices={glowChoices} existing={hasHeroGlow(doc.model)} error={glowPreview?.error} onChange={setGlow} onCreate={createGlow} onCancel={()=>setGlow(null)}/>:placement?<ParticlePlacementControls model={doc.model} placement={placement} pending={!placementResources} onChange={setPlacement} onPlace={place} onCancel={()=>setPlacement(null)} error={placementError}/>:
          emitter?<>{family==='RibbonEmitters'?<div className="pe-clueless-controls pe-ribbon-fields"><RibbonFields flat model={activeDoc.model} id={emitterId} time={frame} sequenceIndex={sequence} globalSeqId={null} restPose={false} disabled={activeDoc.readOnly} onEdit={(label,sections,mutate)=>apply(label,mutate,sections)} onPause={()=>{cancel();setPlaying(false);}}><div className="ribbon-box-actions"><button disabled={activeDoc.readOnly} title="Edit the exact MDL text of this ribbon, for experienced users. Apply is one undo step." onClick={()=>{cancel();setPlaying(false);setManual(true);}}>Adjust Manually</button></div></RibbonFields></div>:<><div className="pe-tool-tabs">{['Look','Motion'].map(item=><button key={item} aria-pressed={tool===item} onClick={()=>{cancel();setTool(item);}}>{item}</button>)}<button className="pe-manual" disabled={activeDoc.readOnly} title="Edit the exact MDL text of this emitter, for experienced users. Hover a word to see what it does." onClick={()=>{cancel();setPlaying(false);setManual(true);}}>Adjust Manually</button></div><ParticleCluelessControls onDemo={context==='Lab'?setDemo:undefined} demo={demo} teamColor={teamColor||'#ed3333'} {...{emitter,frame,sequence,tool,scope,setScope,asset,assets,preferences,update,patch,begin,change,finish,cancel,lifeStage,setLifeStage}} onImport={importPicture} onLibrary={()=>{cancel();setPictureLibrary(true);}} onChoosePicture={choosePicture} onRemovePicture={removePicture} onTeamPicture={teamPicture} model={working} globalTime={previewStatus.global??frame} onSeek={value=>{setPlaying(false);setTime(value);}}/></>}</>:<p>{selectedEffect?<>This emitter type has no sliders yet. <button disabled={activeDoc.readOnly} onClick={()=>{cancel();setPlaying(false);setManual(true);}}>Adjust Manually</button></>:'Choose an effect in the library.'}</p>}
        </fieldset>
      </div>
      <footer className="re-footer"><span className="re-status" role="status" data-alert={previewStatus.error ? '' : undefined}>{previewStatus.error||(previewStatus.busy?'Updating effect…':message||(demo&&context==='Lab'?'Demonstration sweep · preview only':activeDoc.readOnly?'Read-only model.':''))}</span><button onClick={close}>Close</button></footer>
    </section>
    {pictureLibrary&&<Suspense fallback={<span>Loading texture library…</span>}><TextureLibrary model={model} modelPath={context==='On model'?modelPath:undefined} onClose={()=>setPictureLibrary(false)} onSelectTexture={async asset=>{await usePicture(asset);setPictureLibrary(false);}} selectLabel="Use picture"/></Suspense>}
  </div>;
}
