import React,{useEffect,useMemo,useRef,useState} from 'react';
import {createFrameCoalescer} from './viewport-performance.js';
import {translate} from '../src/localization.js';
import {MAX_EMITTER_SITES,withEmitterSiteCount,withEmitterPlacement,individualEmitterLayer,withIndividualEmitter,replaceEmitter} from '../src/fx-emitter-placement.js';
import ParticleTimingTool,{CarryButton,EmitModeButtons} from './ParticleTimingTool.jsx';
import {BlendLookField,DrawAsField} from './ParticlePictureTool.jsx';
import ParticleFrameStrip from './ParticleFrameStrip.jsx';
import {particleValue,beginParticleParameter} from '../src/particle-bindings.js';
import ParticleLifeMarker from './ParticleLifeMarker.jsx';
import GlobalTextureFit from './GlobalTextureFit.jsx';
import FxLookBar from './FxLookBar.jsx';
import {impactDefaults,textureRepeats,glyphIslands,withGlyphGesture} from '../src/global-animation-model.js';
import {ChoiceSelect,NumberField,RangeField} from './Fields.jsx';
import {ParticleSlider,LifeTable} from './ParticleCluelessControls.jsx';
import {RibbonFields} from './ParticleRibbonFields.jsx';
import {ribbonQuickValues} from '../src/ribbon-quick.js';
import {lookOf,LAYER_CHOICES,makeLayer,RUNE_IMAGES,createsOverlay,surfaceIngredient,layerType,withParticleStrength,withIceVariation,withVariation,currentVariation,withLayerSize,BLEND_CHOICES,layerFilter,withBlend,layerMoves,surfaceControls,secondTint,COLOUR_RHYTHM_IDS,emitterChoices as presetEmitterChoices,withOrbit,shellReach,emitterName,layerIngredient} from '../src/global-animation-looks.js';

import {gamePathKey} from '../src/game-path.js';
import {CARD_DEFAULTS,CARD_FACINGS,FLY_BOUNDS} from '../src/fx-cards.js';
import {surfacePalette,tintFromHex} from '../src/surface-effect-colours.js';

const RHYTHMS=[['steady','Steady'],['soft','Soft pulse'],['breathe','Pulse'],['beat','Colour beat'],['embers','Uneven beat'],['shift','Colour shift'],['flicker','Flicker'],['glint','Flash'],['double','Double pulse']];
export default function GlobalAnimationControls({lookActions,overlayLocked=false,assets,stack,setStack,trial,setTrial,selected,select,selectedSite,deleteEmitter,showMarkers,toggleMarkers,setEmitterEditPolicy,colourRevision,surfaceSnap,setSurfaceSnap,graph,recipeFrame,ColourControl,placing,setPlacing,rotating,setRotating,openEmitter,preferences,onSequence,pickTexture,previewStrength,previewLayout,previewFrame,previewSequence,authoredClocks,readPreviewClock}){
 // A preview that could not be built (its message shows in the stage) leaves the controls without compiled values.
 if(graph&&!graph.model)graph=null;
 const look=lookOf(stack),layer=stack.layers.find(item=>item.id===selected),l=individualEmitterLayer(layer,selectedSite),frame=graph?.frame;
 const [lifeStage,setLifeStage]=useState(1);
 const [live,setLive]=useState(null),gesture=useRef(null),[more,setMore]=useState(false);
 const liveFrame=useRef(null);
 if(!liveFrame.current)liveFrame.current=createFrameCoalescer(()=>{const g=gesture.current;if(g){const emitter=g.displayParameter?{...g.emitter,[g.field]:g.displayParameter.change(g.value)}:undefined;setLive({field:g.field,value:g.value,emitter});}});
 useEffect(()=>()=>liveFrame.current.cancel(),[]);
 const setLayer=(next,touched)=>{const changed=selectedSite?withIndividualEmitter(layer,selectedSite,l,next,touched):next;setStack({...stack,layers:stack.layers.map(v=>v.id===changed.id?changed:v)});};
 const update=(key,val)=>{
  const next={...l,[key]:val},fireQuick=l.fireFit?.version===1&&['size','velocity','gravity'].includes(key);
  if(key==='tint'&&l.native){next.native={...l.native};delete next.native.SegmentColor;}
  if(fireQuick&&!selectedSite)next.fireFit={...l.fireFit,[key+'Edited']:true};
  const actualSize=real?.ParticleScaling?.[1];
  const previous=key==='size'&&fireQuick&&l.native?.ParticleScaling&&actualSize>0?{...l,size:actualSize}:l;
  setLayer(key==='size'?withLayerSize(previous,next):next,fireQuick?key:undefined);
 };
 const row=(label,key,min,max,step,tip)=> <div title={tip}><NumberField label={label} min={min} max={max} step={step} value={l[key]} onChange={n=>update(key,Math.max(min,Math.min(max,n)))}/></div>;
 // A Fly swarm is quads on bones, not an emitter: it has its own controls and none of EMTR's.
 const swarm=!!l?.swarm&&l?.type==='Particles';
 const result=graph?.layers?.[l?.id],p=l?.type==='Particles'&&!swarm,edge=l?.type==='Edge',fly=l?.kind==='flies',card=l?.type==='Card';
 const selectedId=selectedSite?result?.ids?.find(id=>graph.model.Nodes[id]._FxTag.endsWith('/'+selectedSite)):result?.id;
 const real=selectedId!=null?graph.model.Nodes[selectedId]:null;
 const surface=graph?.model.Geosets[result?.geoset];
 const nativeImage=surface&&graph.model.Textures[graph.model.Materials[surface.MaterialID]?.Layers[0]?.TextureID]?.Image;
 const uvAsset=assets?.get(gamePathKey(nativeImage||l?.image||''));
 const ingredient=l&&layerIngredient(look,l);
 const defaultTint=l?.defaultTint||ingredient?.tint||tintFromHex(surfacePalette(look)[0][1]);
 const baseGlyph=ingredient?.glyphs?ingredient.image:l?.image;
 const runeImages=baseGlyph&&!RUNE_IMAGES.some(([,path])=>path===baseGlyph)?[[l.label,baseGlyph],...RUNE_IMAGES]:RUNE_IMAGES;
 const activeRunes=l?.glyphs&&!runeImages.some(([,path])=>path===l.image)?[[l.image.split('\\\\').at(-1),l.image],...runeImages]:runeImages;
 // Every surface layer has the same controls, whatever preset it came from.
 const surf=l&&l.type!=='Particles'&&l.type!=='Edge'&&!l.stamp&&surfaceIngredient(l);
 // A shell layer's Lift is its Thickness, shown once in the main controls.
 const shell=surf&&!!ingredient?.shell;
 const compiled=graph?.model.Materials[surface?.MaterialID]?.Layers[0];
 const canTile=l?.nativeSurface?typeof compiled?.TextureID!=='number'||textureRepeats(graph.model,compiled.TextureID):!l?.own||(surface&&textureRepeats(graph.model,graph.model.Materials[surface.MaterialID].Layers[0].TextureID));
 const controls=surf?surfaceControls(l,!!canTile):{};
 // The area of the picture an atlas layer shows; Reset returns to the area it started with.
 const area=controls.area?l.atlasRect||l.nativeSurface.atlas:null,startArea=l?.nativeSurface?l.nativeSurface.atlas:ingredient?.image===l?.image?ingredient?.atlasRect:undefined;
 const areaChanged=!!area&&(!!l.uvMatrix||(l.nativeSurface?!!l.atlasRect:!!startArea&&area.join()!==startArea.join()));
 // A saved rhythm id outside the list shows under the layer's own name; a native card without one keeps its own.
 const rhythm=l?.pulse??(l?.nativeSurface?'':l?.type==='Glow'||l?.glyphs?'breathe':'steady');
 const withRhythm=id=>{const next={...l,pulse:id};if(id==='')delete next.pulse;if(!card&&layerMoves(l)&&!layerMoves(next))next.fixed=false;return next;};
 const runeRepeats=useMemo(()=>l?.glyphs&&surface?glyphIslands(surface)[0]?.repeats??1:1,[l?.glyphs,surface]);
 const resetArea=()=>{const next={...l};delete next.uvMatrix;if(l.nativeSurface||!startArea)delete next.atlasRect;else next.atlasRect=[...startArea];setLayer(next);};
 const blend=l&&(layerFilter(l)??compiled?.FilterMode);
 const unshaded=l?.unshaded??!!(compiled?.Shading&1);
 const menuName=emitterName;
 const choices=stack.impact?[]:LAYER_CHOICES;
 const emitterChoices=choices.filter(choice=>choice.type==='Particles');
 const surfaceChoices=choices.filter(choice=>choice.type!=='Particles');
 const additions=presetEmitterChoices(look);
 const nextId=()=>Math.max(0,...stack.layers.map(x=>x.id))+1;
 const findSurfaceChoice=label=>surfaceChoices.find(spec=>menuName(spec)===label);
 const currentEmitter=(l?.recipeKey&&emitterChoices.find(s=>s.recipeKey===l.recipeKey))||emitterChoices.find(spec=>l?.menuLabel&&spec.menuLabel===l.menuLabel&&spec.kind===l.kind)||
  emitterChoices.find(spec=>spec.label===l?.label&&spec.kind===l?.kind&&spec.image===l?.image)||
  emitterChoices.find(spec=>spec.label===l?.label&&spec.kind===l?.kind)||
  emitterChoices.find(spec=>menuName(spec)===menuName(l||{})&&spec.kind===l?.kind);
 const addLayer=label=>{
  const spec=findSurfaceChoice(label);
  if(!recipeFrame||!spec)return;
  const id=nextId();
  const next=makeLayer(spec,recipeFrame,look.palette,id);
  if(trial?.source==='layer')setTrial(null);
  setStack({...stack,layers:[...stack.layers,next]});select(id);
 };
 // A wheel choice on Add layer is temporary, like the existing emitter picker.
 const tryLayer=(source,label,spec)=>{
  if(spec&&recipeFrame)setTrial({source,label,layer:makeLayer(spec,recipeFrame,look.palette,0)});
  else if(trial?.source===source)setTrial(null);
 };
 const tryEmitter=label=>tryLayer('emitter',label,additions.find(s=>s.label===label)?.spec);
 const changeEmitter=label=>{
  const spec=emitterChoices.find(s=>menuName(s)===label);
  if(!spec||!recipeFrame||spec===currentEmitter)return;
  const next=makeLayer(spec,recipeFrame,look.palette,nextId());
  setStack({...stack,layers:stack.layers.map(v=>v.id===l.id?replaceEmitter(l,next,graph||{frame:recipeFrame,layers:{}}):v)});select(next.id);
 };
 const keepTrial=()=>{const id=nextId();setStack({...stack,layers:[...stack.layers,{...trial.layer,id}]});select(id);setTrial(null);setPlacing(false);};
 const positional=p||swarm||edge||l?.ground||card;
 const siteCount=result?.ids?.length??layer?.siteCount;
 const particleLayer=p||swarm;
 const countable=p&&!selectedSite&&!stack.impact&&l.enabled!==false&&!!result;
 const changeSiteCount=count=>setLayer(withEmitterSiteCount(layer,result,count));
 const cardValue=key=>l[key]??CARD_DEFAULTS[key];
 // An emitter field set under More (EMTR's own controls) is kept in layer.native.
 const plainValues=values=>Object.fromEntries(Object.entries(values).map(([key,value])=>[key,ArrayBuffer.isView(value)?Array.from(value):value]));
 const depth=(field,value)=>setLayer({...l,native:{...l.native,...plainValues({[field]:value})}});
 const clock=()=>{const sample=readPreviewClock?.();return {frame:sample?.frame??previewFrame,globalTime:sample?.globalTime,interval:graph?.model.Sequences[sample?.sequence??previewSequence]?.Interval,globalSequences:graph?.model.GlobalSequences||authoredClocks};};
 const timingOptions=clock();
 const plain=value=>JSON.parse(JSON.stringify(value,(_,v)=>ArrayBuffer.isView(v)?Array.from(v):v?.Keys&&v.GlobalSeqId>=0?{...v,_FxGlobalDuration:graph.model.GlobalSequences[v.GlobalSeqId]}:v));
 const nativeBegin=(field,stage)=>{
  if(!real)return;
  const options={...clock(),stage,scope:'track'};
  if(stage?.raw){gesture.current={field,raw:true};return;}
  const aggregate=field==='EmissionRate'&&!selectedSite;
  const emitters=!selectedSite?(result?.ids||[]).map(id=>graph.model.Nodes[id]):[real];
  const parameters=emitters.map(emitter=>({emitter,parameter:beginParticleParameter(emitter,field,options)}));
  gesture.current={field,stage,emitter:real,displayParameter:beginParticleParameter(real,field,options),parameters,aggregate,group:!selectedSite,representative:particleValue(real,field,options),total:parameters.reduce((sum,p)=>sum+p.parameter.sampled,0)};
 };
 const nativeChange=value=>{if(gesture.current){gesture.current.value=value;liveFrame.current.schedule();}};
 const nativeFinish=()=>{
  liveFrame.current.flush();const g=gesture.current;gesture.current=null;setLive(null);if(g?.value===undefined)return;
  if(g.swarmKey){update(g.swarmKey,Math.max(g.min,Math.min(g.max,g.swarmKey==='amount'?Math.round(g.value/5)*5:g.value)));return;}
  if(g.raw){const hit=g.value?.Keys?.find(k=>k.Vector[0]>0)?.Frame;if(stack.impact&&hit!=null)setStack({...stack,...impactDefaults(graph.model,graph.geoset,stack.sequence,hit)});else depth(g.field,g.value);return;}
  if(g.group){
   let next=layer;
   for(const {emitter,parameter} of g.parameters){
    let value=Array.isArray(g.value)?g.value.map((v,i)=>Math.max(0,Math.min(1,parameter.sampled[i]+v-g.representative[i]))):g.aggregate?(g.total?g.value*parameter.sampled/g.total:g.value/g.parameters.length):g.field==='ParticleScaling'&&g.representative?g.value*parameter.sampled/g.representative:parameter.sampled+g.value-g.representative;
    if(g.field==='Alpha')value=Math.max(0,Math.min(255,value));
    else if(g.field==='Time')value=Math.max(0,Math.min(1,value));
    else if(g.field==='Latitude')value=Math.max(0,Math.min(180,value));
    else if(['ParticleScaling','EmissionRate','Width','Length','TailLength'].includes(g.field))value=Math.max(0,value);
    else if(g.field==='LifeSpan')value=Math.max(.001,value);
    const key=emitter._FxTag.slice(emitter._FxTag.lastIndexOf('/')+1),own=individualEmitterLayer(next,key);
    next=withIndividualEmitter(next,key,own,{...own,native:{...own.native,[g.field]:plain(parameter.change(value))}});
    if(g.field==='Alpha'){next.individuals[key].values.opacityBase=plain(next.individuals[key].values.native.Alpha);next.individuals[key].values.particleStrength=1;}
    next.individuals[key].groupFields=[...new Set([...(next.individuals[key].groupFields||[]),g.field])];
   }
   if(g.aggregate){
    const unitRate=l.nativeSpec?((l.nativeSpec.rate??8)/24)*(l.speed??1)*(result.siteRateScale??1):1;
    next.amount=g.total>0?layer.amount*g.value/g.total:unitRate>0?g.value/unitRate:layer.amount;
    next.groupRateCount=g.parameters.length;
   }
   if(g.field==='Alpha'){delete next.opacityBase;next.particleStrength=1;}

   setStack({...stack,layers:stack.layers.map(item=>item.id===next.id?next:item)},false,{layerId:layer.id,field:g.field,sites:g.parameters.map(p=>p.emitter._FxTag.slice(p.emitter._FxTag.lastIndexOf('/')+1)),baselines:Object.fromEntries(g.parameters.map(p=>[p.emitter._FxTag.slice(p.emitter._FxTag.lastIndexOf('/')+1),plain(p.parameter.baseline)]))});
  }else if(g.parameters?.length){
   const value=plain(g.parameters[0].parameter.change(g.value));
   setLayer({...l,native:{...l.native,[g.field]:value},...(g.field==='Alpha'?{opacityBase:plain(value),particleStrength:1}:{})});
  }
 };
 const nativeSlider=(field,disabled=false)=>{
  disabled=disabled||real?.[field]?.GlobalSeqId>=0&&timingOptions.globalTime==null;
  const value=real?(field==='EmissionRate'&&!selectedSite?(result?.ids||[]).reduce((sum,id)=>sum+particleValue(graph.model.Nodes[id],field,timingOptions),0):particleValue(real,field,timingOptions)):undefined;
  const title=field==='EmissionRate'?(selectedSite?'Particles emitted by this emitter.':'Particles emitted across this layer.')+' '+(real?.Squirt?'Particles per burst.':'Particles per second.'):undefined;
  return <div key={field} title={title}><ParticleSlider decimals={2} field={field} value={live?.field===field?live.value:value} disabled={disabled||!real} unavailable={disabled||!real} begin={nativeBegin} change={nativeChange} finish={nativeFinish} cancel={()=>{liveFrame.current.cancel();gesture.current=null;setLive(null);}}/></div>;
 };
 const swarmSlider=(field,key,min,max,step,title)=><div title={title}><ParticleSlider field={field} units={title} decimals={2} min={min} max={max} step={step} value={live?.field===field?live.value:l[key]??1}
  begin={()=>{gesture.current={field,swarmKey:key,min,max};}} change={nativeChange} finish={nativeFinish} cancel={()=>{liveFrame.current.cancel();gesture.current=null;setLive(null);}}/></div>;
 const unavailable=label=><div key={label}><NumberField label={label} disabled value={undefined} placeholder="N/A"/></div>;

 return <>
  <h3>{look.name}</h3>
  {lookActions&&<FxLookBar look={look} stack={stack} actions={lookActions}/>}
  {!stack.impact&&<div title="Milliseconds for one full loop."><NumberField label="Loop length" min={750} max={10000} step={50} value={stack.loop} onChange={v=>setStack({...stack,loop:Math.max(750,Math.min(10000,Math.round(v)))})}/></div>}
  {stack.look==='ice-skin'&&<label className="field"><span>Ice</span><ChoiceSelect aria-label="Ice variation" disabled={!recipeFrame} value={stack.iceVariation||'dark'} onChange={value=>setStack(withIceVariation(stack,recipeFrame,value))}><option value="dark">Dark ice</option><option value="white">White ice</option></ChoiceSelect></label>}
  {look.variations&&<label className="field"><span>Variation</span><ChoiceSelect aria-label="Variation" disabled={!recipeFrame} value={currentVariation(stack,look)} onChange={value=>setStack(withVariation(stack,recipeFrame,look,value))}>{look.variations.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</ChoiceSelect></label>}
  {stack.impact&&<label className="field"><span>Attack</span><ChoiceSelect aria-label="Attack animation" value={stack.sequence} onChange={value=>{const sequence=Number(value);setStack({...stack,...impactDefaults(graph.model,graph.geoset,sequence)});onSequence(sequence);}}>{graph?.model.Sequences.map((s,i)=>/^attack\b/i.test(s.Name)?<option key={i} value={i}>{s.Name}</option>:null)}</ChoiceSelect></label>}
  {stack.layers.some(surfaceIngredient)&&<label title="Keep the original surface and draw the effect on a separate geoset."><input type="checkbox" disabled={overlayLocked} checked={overlayLocked||createsOverlay(stack)} onChange={e=>setStack({...stack,asOverlay:e.target.checked})}/>Create as overlay</label>}
  <div className="fx-layer-list" role="group" aria-label="Layers">{stack.layers.map(item=><div className="fx-layer-row" key={item.id}><input type="checkbox" aria-label={'Enable '+emitterName(item)} checked={item.enabled!==false} onChange={e=>setStack({...stack,layers:stack.layers.map(l=>l.id===item.id?{...item,enabled:e.target.checked}:l)})}/><button key={item.id} title={translate('Adjust this {0} layer.').replace('{0}',translate(layerType(item)).toLowerCase())} aria-pressed={item.id===selected} onClick={()=>{select(item.id);setLive(null);if(!selectedSite)setPlacing(false);}}>{emitterName(item)}<small>{layerType(item)}</small></button></div>)}</div>
  {!stack.impact&&<label className="field fx-add-emitter" title="Pick an emitter to preview it. Add keeps it as a layer."><span>Particles</span><ChoiceSelect aria-label="Add emitter" disabled={!recipeFrame} value={trial?.source==='emitter'?trial.label:''} onChange={tryEmitter}><option value="">Add emitter</option>{additions.map(s=><option key={s.label} value={s.label}>{s.label}</option>)}</ChoiceSelect></label>}
  {!stack.impact&&trial&&<button className="fx-keep-emitter" title={trial.source==='layer'?'Add one editable layer to this part.':'Keep the previewed emitter as a layer.'} onClick={keepTrial}>Add</button>}
  <div className="fx-layer-actions">{!stack.impact&&<ChoiceSelect aria-label="Add layer" title="Add one editable layer to this part." disabled={!recipeFrame} value={trial?.source==='layer'?trial.label:''} onChange={addLayer} onWheelChange={label=>tryLayer('layer',label,findSurfaceChoice(label))}><option value="">Add layer</option>{[...new Set(surfaceChoices.map(layerType))].map(type=><optgroup label={type} key={type}>{surfaceChoices.filter(s=>layerType(s)===type).map(s=><option key={menuName(s)} value={menuName(s)}>{menuName(s)}</option>)}</optgroup>)}</ChoiceSelect>}
   {l&&!selectedSite&&<button title="Remove the selected layer and the pieces it owns." onClick={()=>{const layers=stack.layers.filter(v=>v!==l);setStack({...stack,layers});select(layers[0]?.id);setPlacing(false);}}>Remove layer</button>}</div>
  {l&&<>
  {selectedSite&&<h4>{translate(emitterName(l))+' '+((result?.ids.indexOf(selectedId)??0)+1)}</h4>}
  {selectedSite&&<button aria-pressed={surfaceSnap} onClick={()=>setSurfaceSnap(v=>!v)}>{surfaceSnap?'Double-click a surface':'Snap to surface'}</button>}
  {selectedSite&&<button onClick={deleteEmitter}>Delete emitter</button>}
  {(p||swarm)&&!selectedSite&&!stack.impact&&<ChoiceSelect aria-label="Change emitter" title="Replace this emitter and keep its position." disabled={!recipeFrame} value={currentEmitter?menuName(currentEmitter):''} onChange={changeEmitter}><option value="" disabled>Change emitter</option>{emitterChoices.map(s=><option key={menuName(s)} value={menuName(s)}>{menuName(s)}</option>)}</ChoiceSelect>}
  {!l.stamp&&!selectedSite&&<button title="Choose a texture from the game library for this layer." onClick={()=>pickTexture(l.id)}>Change texture</button>}
  {!edge&&!l.stamp&&<ColourControl resetKey={colourRevision} hint={translate('Changes the colour of {0}.').replace('{0}',translate(emitterName(l)).toLowerCase())} tint={l.tint} defaultTint={defaultTint} update={update}/>}
  {(surf||card)&&COLOUR_RHYTHM_IDS.includes(l.pulse)&&<ColourControl resetKey={colourRevision} label="Second colour" pickerLabel="Second colour" resetLabel="Reset second colour" hint="The colour the rhythm moves to and back from." tint={l.tint2||secondTint(l.tint)} defaultTint={secondTint(l.tint)} update={(_,value)=>{const next={...l,tint2:value};if(value.every((v,i)=>Math.abs(v-secondTint(l.tint)[i])<1/512))delete next.tint2;setLayer(next);}}/>}
  {edge&&real?<RibbonFields flat model={graph.model} id={real.ObjectId} onEdit={(_,__,mutate)=>{
   const n=structuredClone(real);mutate({RibbonEmitters:[n]});const v=ribbonQuickValues(n);setLayer({...l,tint:v.color,upper:v.above,lower:v.below,smoothness:v.amount,gravity:v.gravity,strength:v.intensity,lasts:v.lasts});}}/>:null}
  {!edge&&!l.stamp&&<RangeField disabled={p&&!real} key={l.id} title="Adjust only the selected layer." label="Intensity"
   output={v=>Math.round(v*100)+'%'} min={0} max={l.type==='Glow'||l.glyphs?4:1} step={.01} value={p?(l.particleStrength??1):l.strength}
   onDraft={v=>previewStrength(l,v,selectedSite)} onCommit={v=>p?setLayer(withParticleStrength(l,real.Alpha,v)):update('strength',v)}/>}
  {particleLayer&&<RangeField disabled={!countable} label="Emitters" title="Number of emitter sites in this layer." min={0} max={Math.max(MAX_EMITTER_SITES,siteCount??0)} step={1} value={siteCount??0} output={value=>swarm||siteCount==null?'N/A':value} onCommit={changeSiteCount}/>}
  {particleLayer&&<RangeField disabled={!!selectedSite||!!stack.impact} label="Formation" title="Pull the emitters together or spread them apart." min={swarm?4:0} max={swarm?Math.max(200,(frame?.length||100)*2,l.size):2} step={swarm ? .5 : .01} value={swarm?l.size:l.formation??1} output={v=>swarm?v.toFixed(1):Math.round(v*100)+'%'} onCommit={v=>swarm?update('size',v):setLayer(withEmitterPlacement(l,{...l,formation:v}))}/>}
  {shell&&<RangeField key={l.id+'thickness'} title="Distance of this layer above the surface." label="Thickness" output={v=>v.toFixed(1)} min={0} max={shellReach(frame,l.inflate)} step={.05} value={l.inflate??0} onCommit={v=>update('inflate',v)}/>}
  {particleLayer&&<>
   <LifeTable unavailable={!real||swarm} emitter={live?.emitter||real} lifeStage={lifeStage} setLifeStage={setLifeStage}
    begin={nativeBegin} change={nativeChange} finish={nativeFinish} cancel={()=>{liveFrame.current.cancel();gesture.current=null;setLive(null);}}/>
   {swarm?swarmSlider('EmissionRate','amount',FLY_BOUNDS.amount[0],FLY_BOUNDS.amount[1],5,'How many flies. Each five more fly on their own clock and paths.'):nativeSlider('EmissionRate')}
   {nativeSlider('LifeSpan',swarm)}
   {swarm?swarmSlider('ParticleScaling','spriteSize',FLY_BOUNDS.spriteSize[0],Math.max(FLY_BOUNDS.spriteSize[1],l.spriteSize),.5,'Width of each fly.'):nativeSlider('ParticleScaling')}
   {swarm?swarmSlider('Speed','speed',FLY_BOUNDS.speed[0],FLY_BOUNDS.speed[1],.05,'How fast the flies circle. Every fly keeps its own pace.'):nativeSlider('Speed')}
   {nativeSlider('Gravity',swarm)}
   <details className="fx-more" onToggle={e=>setMore(e.currentTarget.open)}><summary>More</summary>{more&&<>
    {['Width','Length','Latitude','Variation'].map(field=>nativeSlider(field,swarm))}
    {l.burstGap!=null?<>{row('Burst duration (s)','burstWindow',.06,1,.01,'How long one burst emits lightning.')}{row('Time between bursts (s)','burstGap',.1,15,.1,'Quiet time before the next burst on the blade.')}</>:<>{unavailable('Burst duration (s)')}{unavailable('Time between bursts (s)')}</>}
    {<ParticleLifeMarker unavailable={!real||swarm} value={live?.field==='Time'?live.value:real?.Time??.5} begin={nativeBegin} change={nativeChange} finish={nativeFinish} cancel={()=>{gesture.current=null;}} onSelect={setLifeStage}/>}
    <BlendLookField unavailable={!real||swarm} emitter={real||{}} update={depth} wheel/>
    <CarryButton unavailable={!real||swarm} emitter={real||{}} update={depth}/>
    <DrawAsField unavailable={!real||swarm} emitter={real||{}} update={depth} wheel/>
    {nativeSlider('TailLength',swarm||!(real?.FrameFlags&2))}
    {<ParticleFrameStrip unavailable={!real||swarm} emitter={real||{}} wheel asset={assets?.get(gamePathKey(graph?.model.Textures[real?.TextureID]?.Image||''))} pictureName={graph?.model.Textures[real?.TextureID]?.Image} replaceableId={real?.ReplaceableId||graph?.model.Textures[real?.TextureID]?.ReplaceableId||0} patch={values=>values&&setLayer({...l,native:{...l.native,...plainValues(values)}})}/>}
    <EmitModeButtons unavailable={!real||swarm} emitter={real||{}} update={depth}/>
    {stack.impact&&real&&<ParticleTimingTool impactOnly emitter={real} options={timingOptions} begin={nativeBegin} change={nativeChange} finish={nativeFinish} cancel={()=>{gesture.current=null;}} update={depth} patch={values=>values&&setLayer({...l,native:{...l.native,...values}})}/>}
    <label><input type="checkbox" disabled={!swarm} checked={swarm&&!!l.riseOnDeath} onChange={e=>update('riseOnDeath',e.target.checked)}/>Rise on Death</label>
   </>}</details>
  </>}
  {card&&<>
   <label className="field" title="Which way the card faces: the camera, the ground, or fixed to the part."><span>Facing</span><ChoiceSelect aria-label="Facing" value={cardValue('facing')} onChange={value=>update('facing',value)}>{CARD_FACINGS.map(id=><option key={id} value={id}>{{camera:'Camera',ground:'Ground',part:'Part'}[id]}</option>)}</ChoiceSelect></label>
   {row('Count','count',1,8,1,'Cards spread along the part. Each runs on its own clock.')}
  </>}
  {(surf||card)&&<label className="field" title="How the layer's light or colour changes over its loop."><span>Rhythm</span><ChoiceSelect aria-label="Rhythm" value={rhythm} onChange={value=>setLayer(withRhythm(value))}>{[...RHYTHMS,...(rhythm===''||!RHYTHMS.some(([id])=>id===rhythm)?[[rhythm,'Built-in']]:[])].map(([id,name])=><option key={id} value={id}>{name}</option>)}</ChoiceSelect></label>}
  {surf&&<label className="field" title="How this layer mixes with what is behind it."><span>Blend</span><ChoiceSelect aria-label="Blend" value={blend??''} onChange={value=>setLayer(withBlend(l,Number(value)))}>{blend==null&&<option value="" disabled/>}{BLEND_CHOICES.map(([id,name])=><option key={id} value={id}>{name}</option>)}</ChoiceSelect></label>}
  {surf&&<>
   {controls.moving&&<label title="Move the texture across the part on the loop."><input type="checkbox" checked={layerMoves(l)} onChange={e=>update('fixed',!e.target.checked)}/>Moving</label>}
   {controls.speed&&row('Speed','speed',0,8,.05,'Texture passes per loop. Below 1 moves slower than the loop.')}
   {controls.direction&&row('Direction','direction',0,359,1,'Direction of travel on the surface, in degrees.')}
   {controls.tiling&&row('Tiling','tiling',1,4,.01,'How many times the skin repeats across the part.')}
   {!l.glyphs&&!controls.area&&<GlobalTextureFit key={l.id} geoset={surface} asset={uvAsset} canScale={canTile} layer={l} preferences={preferences} change={update}/>}
   {controls.area&&<>
    <GlobalTextureFit key={l.id} geoset={surface} asset={uvAsset} layer={l} preferences={preferences} change={update} area={area} onArea={rect=>update('atlasRect',rect)}/>
    <div className="fx-area-actions"><button title="Use the whole picture." disabled={area.join()==='0,0,1,1'} onClick={()=>update('atlasRect',[0,0,1,1])}>Whole picture</button><button title="Restore this layer's starting area." disabled={!areaChanged} onClick={resetArea}>Reset</button></div>
   </>}
   {l.glyphs&&<>
    <label className="field"><span>Rune</span><ChoiceSelect aria-label="Rune" value={l.image} onChange={value=>setLayer({...l,image:value})}>{activeRunes.map(([name,path])=><option key={path} value={path}>{name}</option>)}</ChoiceSelect></label>
    <GlobalTextureFit key={l.id} geoset={surface} asset={uvAsset} canScale layer={l} preferences={preferences} change={update} onGlyph={gesture=>setLayer(withGlyphGesture(l,gesture))}/>
    {[['Repeat','repeats',1,12,1,v=>v,'How many times the runes repeat along the part.'],['Size','glyphScale',.25,4,.05,v=>v.toFixed(2)+'×','Size of the runes.'],['Turn','glyphTurn',-180,180,15,v=>Math.round(v)+'°','Turns the runes, in degrees.'],['Slide','glyphSlide',-1,1,.01,v=>v.toFixed(2),'Moves the runes along the part.'],['Across','glyphAcross',-1,1,.01,v=>v.toFixed(2),'Moves the runes across the part.']].map(([label,key,min,max,step,output,tip])=>
     <RangeField key={l.id+key} title={tip} label={label} output={output} min={min} max={max} step={step} value={l[key]??(key==='repeats'?runeRepeats:key==='glyphScale'?1:0)} onDraft={v=>previewLayout(l,v==null?null:{...l,[key]:v})} onCommit={v=>update(key,v)}/>)}
   </>}
  </>}
  {surf&&<details className="fx-more" onToggle={e=>setMore(e.currentTarget.open)}><summary>More</summary>{more&&<>
   {!shell&&<RangeField key={l.id+'inflate'} title="Distance of this layer above the surface." label="Lift" output={v=>v.toFixed(2)} min={0} max={1} step={.01} value={l.inflate??0} onCommit={v=>update('inflate',v)}/>}
   {!stack.impact&&<div className="fx-layer-loop" title="Milliseconds for one loop of this layer. Empty uses the look's loop length."><NumberField label="Loop length" min={100} max={20000} step={1} placeholder={String(stack.loop)} value={l.loop} onChange={v=>update('loop',Math.round(v))}/>{l.loop!=null&&<button aria-label="Use the look's loop length." title="Use the look's loop length." onClick={()=>{const next={...l};delete next.loop;setLayer(next);}}>×</button>}</div>}
   <label title="Shade this layer with the map's light. Off keeps it at full brightness."><input type="checkbox" checked={!unshaded} onChange={e=>update('unshaded',!e.target.checked)}/>Lit by map light</label>
  </>}</details>}
  {edge&&real&&<details className="fx-more" onToggle={e=>setMore(e.currentTarget.open)}><summary>More</summary>{more&&<>
   <label title="Draws the ribbon around the part on turning helpers."><input type="checkbox" checked={!!l.orbit} onChange={e=>{
    if(!e.target.checked){const next={...l};delete next.orbit;setLayer(next);return;}
    setLayer(withOrbit(l,frame,stack.loop));
   }}/>Orbit</label>
   {l.orbit&&<>
    <RangeField key={l.id+'radius'} title="Distance of the ribbon from the part." label="Radius" output={v=>v.toFixed(1)} min={0} max={Math.max(2,(frame?.length||40)*.5)} step={.1} value={l.orbitRadius} onCommit={v=>update('orbitRadius',v)}/>
    <RangeField key={l.id+'turns'} title="Turns around the part per loop." label="Turns" output={v=>String(Math.round(v))} min={1} max={8} step={1} value={l.orbitTurns??1} onCommit={v=>update('orbitTurns',Math.round(v))}/>
   </>}
   {!stack.impact&&<div className="fx-layer-loop" title="Milliseconds for one loop of this layer. Empty uses the look's loop length."><NumberField label="Loop length" min={100} max={20000} step={1} placeholder={String(stack.loop)} value={l.loop} onChange={v=>update('loop',Math.round(v))}/>{l.loop!=null&&<button aria-label="Use the look's loop length." title="Use the look's loop length." onClick={()=>{const next={...l};delete next.loop;setLayer(next);}}>×</button>}</div>}
  </>}</details>}
  {card&&<details className="fx-more" onToggle={e=>setMore(e.currentTarget.open)}><summary>More</summary>{more&&<>
   {[['Smallest size','sizeMin',.1,2,.01,v=>Math.round(v*100)+'%','Size at the small point of the pulse, as a share of the card size.'],['Largest size','sizeMax',.1,2,.01,v=>Math.round(v*100)+'%','Size at the large point of the pulse, as a share of the card size.'],['Spin','spin',-8,8,.25,v=>v.toFixed(2),'Turns per loop. Negative turns the other way.'],['Jitter','jitter',0,180,1,v=>Math.round(v)+'°','Fast random turns, in degrees.']].map(([label,key,min,max,step,output,tip])=>
    <RangeField key={l.id+key} title={tip} label={label} output={output} min={min} max={max} step={step} value={cardValue(key)} onCommit={v=>{const next={...l,[key]:v};if(key==='sizeMin'&&v>cardValue('sizeMax'))next.sizeMax=v;if(key==='sizeMax'&&v<cardValue('sizeMin'))next.sizeMin=v;setLayer(next);}}/>)}
   <label title="Turns faster and slower within each turn."><input type="checkbox" checked={cardValue('spinEased')!==false} onChange={e=>update('spinEased',e.target.checked)}/>Eased spin</label>
   {[['Rows','rows',1,16,1,'Rows of cells in the picture.'],['Columns','columns',1,16,1,'Columns of cells in the picture.'],['Frame time (ms)','frameMs',0,1000,10,'Milliseconds per cell. 0 shows one cell.'],['Cell','cell',0,Math.max(0,cardValue('rows')*cardValue('columns')-1),1,'The cell shown when Frame time is 0.']].map(([label,key,min,max,step,tip])=>
    <div key={key} title={tip}><NumberField label={label} min={min} max={max} step={step} value={cardValue(key)} onChange={n=>update(key,Math.round(Math.max(min,Math.min(max,n))))}/></div>)}
   {!stack.impact&&<div className="fx-layer-loop" title="Milliseconds for one loop of this layer. Empty uses the look's loop length."><NumberField label="Loop length" min={100} max={20000} step={1} placeholder={String(stack.loop)} value={l.loop} onChange={v=>update('loop',Math.round(v))}/>{l.loop!=null&&<button aria-label="Use the look's loop length." title="Use the look's loop length." onClick={()=>{const next={...l};delete next.loop;setLayer(next);}}>×</button>}</div>}
   <label className="field" title="How this layer mixes with what is behind it."><span>Blend</span><ChoiceSelect aria-label="Blend" value={l.filter??CARD_DEFAULTS.filter} onChange={value=>update('filter',Number(value))}>{BLEND_CHOICES.map(([id,name])=><option key={id} value={id}>{name}</option>)}</ChoiceSelect></label>
   <label title="Shade this layer with the map's light. Off keeps it at full brightness."><input type="checkbox" checked={!unshaded} onChange={e=>update('unshaded',!e.target.checked)}/>Lit by map light</label>
  </>}</details>}
  {positional&&<div className="sfx-placement"><button className="sfx-place" title={stack.impact?"Drag the corners to resize the burst.":l.stamp?"Drag the move handle in the preview.":"Drag the move handle or the edges in the preview."} aria-pressed={placing} onClick={()=>setPlacing(!placing)}>{stack.impact?'Size':l.stamp?'Position':'Position & size'}</button>
   {p&&placing&&real&&<button aria-pressed={rotating} title="Rotate the emitter aim." onClick={()=>setRotating(!rotating)}>Rotate</button>}
   {p&&placing&&real&&<button aria-pressed={showMarkers} onClick={toggleMarkers}>Emitter markers</button>}</div>}
  {stack.emitterEditPolicy&&<label className="field fx-emitter-policy"><span>Individual edits</span><select data-wheel-skip="" aria-label="Individual edits" value={stack.emitterEditPolicy} onChange={event=>setEmitterEditPolicy(event.target.value)}><option value="ask">Ask each time</option><option value="keep">Keep individual changes</option><option value="all">Apply to all</option></select></label>}
  {(p||edge)&&real&&<button title="Apply this stack and open its selected emitter in the full editor." onClick={()=>openEmitter(l.id,selectedSite)}>Open in EMTR</button>}
  </>}
 </>;
}
