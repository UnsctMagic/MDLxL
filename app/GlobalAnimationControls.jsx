import React,{useMemo,useRef,useState} from 'react';
import {translate} from '../src/localization.js';
import ParticleTimingTool,{CarryButton,EmitModeButtons} from './ParticleTimingTool.jsx';
import {BlendLookField,DrawAsField} from './ParticlePictureTool.jsx';
import ParticleFrameStrip from './ParticleFrameStrip.jsx';
import {particleValue} from '../src/particle-bindings.js';
import GlobalTextureFit from './GlobalTextureFit.jsx';
import FxLookBar from './FxLookBar.jsx';
import {impactDefaults,textureRepeats,glyphIslands,withGlyphGesture} from '../src/global-animation-model.js';
import {NumberField,RangeField} from './Fields.jsx';
import {ParticleSlider,LifeTable} from './ParticleCluelessControls.jsx';
import {RibbonFields} from './ParticleRibbonFields.jsx';
import {ribbonQuickValues} from '../src/ribbon-quick.js';
import {lookOf,LAYER_CHOICES,makeLayer,RUNE_IMAGES,createsOverlay,surfaceIngredient,layerType,withParticleStrength,withIceVariation,withVariation,currentVariation,withLayerSize,BLEND_CHOICES,layerFilter,withBlend,layerMoves,surfaceControls,secondTint,COLOUR_RHYTHM_IDS,emitterChoices as presetEmitterChoices,withOrbit,shellReach,emitterName,layerIngredient} from '../src/global-animation-looks.js';

import {gamePathKey} from '../src/game-path.js';
import {CARD_DEFAULTS,CARD_FACINGS,FLY_BOUNDS} from '../src/fx-cards.js';
import {surfacePalette,tintFromHex} from '../src/surface-effect-colours.js';

const RHYTHMS=[['steady','Steady'],['soft','Soft pulse'],['breathe','Pulse'],['beat','Colour beat'],['embers','Uneven beat'],['shift','Colour shift'],['flicker','Flicker'],['glint','Flash'],['double','Double pulse']];
export default function GlobalAnimationControls({lookActions,overlayLocked=false,assets,stack,setStack,trial,setTrial,selected,select,graph,ColourControl,placing,setPlacing,openEmitter,preferences,onSequence,pickTexture,previewStrength,previewLayout}){
 // A preview that could not be built (its message shows in the stage) leaves the controls without compiled values.
 if(graph&&!graph.model)graph=null;
 const look=lookOf(stack),l=stack.layers.find(item=>item.id===selected),frame=graph?.frame;
 const [lifeStage,setLifeStage]=useState(1);
 const [live,setLive]=useState(null),gesture=useRef(null),[more,setMore]=useState(false);
 const setLayer=next=>setStack({...stack,layers:stack.layers.map(v=>v.id===next.id?next:v)});
 const update=(key,val)=>{const next={...l,[key]:val};if(key==='tint'&&l.native){next.native={...l.native};delete next.native.SegmentColor;}setLayer(key==='size'?withLayerSize(l,next):next);};
 const row=(label,key,min,max,step,tip)=> <div title={tip}><NumberField label={label} min={min} max={max} step={step} value={l[key]} onChange={n=>update(key,Math.max(min,Math.min(max,n)))}/></div>;
 // A Fly swarm is quads on bones, not an emitter: it has its own controls and none of EMTR's.
 const swarm=!!l?.swarm&&l?.type==='Particles';
 const result=graph?.layers?.[l?.id],p=l?.type==='Particles'&&!swarm,edge=l?.type==='Edge',fly=l?.kind==='flies',card=l?.type==='Card';
 const real=result?.id!=null?graph.model.Nodes[result.id]:null;
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
 function particle(field,key,min,max,step,title){
  return <div title={title}><ParticleSlider decimals={2} field={field} value={live?.key===key?live.value:l[key]} min={min} max={max} step={step}
   begin={()=>{gesture.current={key};}} change={value=>{if(gesture.current){gesture.current.value=value;setLive({key,value});}}}
   finish={()=>{const g=gesture.current;gesture.current=null;setLive(null);if(g?.value!=null)update(key,Math.max(min,Math.min(max,g.value)));}} cancel={()=>{gesture.current=null;setLive(null);}}/></div>;
 }
 const menuName=emitterName;
 const choices=stack.impact?[]:LAYER_CHOICES;
 const emitterChoices=choices.filter(choice=>choice.type==='Particles');
 const surfaceChoices=choices.filter(choice=>choice.type!=='Particles');
 const additions=presetEmitterChoices(look);
 const nextId=()=>Math.max(0,...stack.layers.map(x=>x.id))+1;
 const addLayer=spec=>{
  if(!frame||!spec)return;
  const id=nextId();
  const next=makeLayer(spec,frame,look.palette,id);setStack({...stack,layers:[...stack.layers,next]});select(id);
 };
 // Picking an emitter only previews it; Add keeps it as a layer.
 const tryEmitter=label=>{const choice=additions.find(s=>s.label===label);setTrial(choice&&frame?{label,layer:makeLayer(choice.spec,frame,look.palette,0)}:null);};
 const keepTrial=()=>{const id=nextId();setStack({...stack,layers:[...stack.layers,{...trial.layer,id}]});select(id);setTrial(null);setPlacing(false);};
 const positional=p||swarm||edge||l?.ground||card;
 const cardValue=key=>l[key]??CARD_DEFAULTS[key];
 // An emitter field set under More (EMTR's own controls) is kept in layer.native.
 const plainValues=values=>Object.fromEntries(Object.entries(values).map(([key,value])=>[key,ArrayBuffer.isView(value)?Array.from(value):value]));
 const depth=(field,value)=>setLayer({...l,native:{...l.native,...plainValues({[field]:value})}});
 const timingOptions={frame:stack.hit,interval:graph?.model.Sequences[stack.sequence]?.Interval,globalSequences:graph?.model.GlobalSequences};
 const nativeBegin=(field,stage)=>{gesture.current={field,stage,value:undefined};};
 const nativeChange=value=>{if(gesture.current)gesture.current.value=value;};
 const nativeFinish=()=>{const g=gesture.current;gesture.current=null;if(g?.value===undefined)return;if(g.field==='EmissionRate'&&stack.impact){const hit=g.value?.Keys?.find(k=>k.Vector[0]>0)?.Frame;if(hit!=null)setStack({...stack,...impactDefaults(graph.model,graph.geoset,stack.sequence,hit)});else setLayer({...l,burst:g.value});}else setLayer({...l,native:{...l.native,[g.field]:g.value}});};
 return <>
  <h3>{look.name}</h3>
  {lookActions&&<FxLookBar look={look} stack={stack} actions={lookActions}/>}
  {!stack.impact&&<div title="Milliseconds for one full loop."><NumberField label="Loop length" min={750} max={10000} step={50} value={stack.loop} onChange={v=>setStack({...stack,loop:Math.max(750,Math.min(10000,Math.round(v)))})}/></div>}
  {stack.look==='ice-skin'&&<label className="field"><span>Ice</span><select aria-label="Ice variation" value={stack.iceVariation||'dark'} onChange={e=>setStack(withIceVariation(stack,frame,e.target.value))}><option value="dark">Dark ice</option><option value="white">White ice</option></select></label>}
  {look.variations&&<label className="field"><span>Variation</span><select aria-label="Variation" value={currentVariation(stack,look)} onChange={e=>setStack(withVariation(stack,frame,look,e.target.value))}>{look.variations.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></label>}
  {stack.impact&&<label className="field"><span>Attack</span><select aria-label="Attack animation" value={stack.sequence} onChange={e=>{const sequence=Number(e.target.value);setStack({...stack,...impactDefaults(graph.model,graph.geoset,sequence)});onSequence(sequence);}}>{graph?.model.Sequences.map((s,i)=>/^attack\b/i.test(s.Name)?<option key={i} value={i}>{s.Name}</option>:null)}</select></label>}
  {stack.layers.some(surfaceIngredient)&&<label title="Keep the original surface and draw the effect on a separate geoset."><input type="checkbox" disabled={overlayLocked} checked={overlayLocked||createsOverlay(stack)} onChange={e=>setStack({...stack,asOverlay:e.target.checked})}/>Create as overlay</label>}
  <div className="fx-layer-list" role="group" aria-label="Layers">{stack.layers.map(item=><div className="fx-layer-row" key={item.id}><input type="checkbox" aria-label={'Enable '+emitterName(item)} checked={item.enabled!==false} onChange={e=>setLayer({...item,enabled:e.target.checked})}/><button key={item.id} title={translate('Adjust this {0} layer.').replace('{0}',translate(layerType(item)).toLowerCase())} aria-pressed={item.id===selected} onClick={()=>{select(item.id);setLive(null);setPlacing(false);}}>{emitterName(item)}<small>{layerType(item)}</small></button></div>)}</div>
  {!stack.impact&&<label className="field fx-add-emitter" title="Pick an emitter to preview it. Add keeps it as a layer."><span>Particles</span><select aria-label="Add emitter" value={trial?.label||''} onChange={e=>tryEmitter(e.target.value)}><option value="">Add emitter</option>{additions.map(s=><option key={s.label} value={s.label}>{s.label}</option>)}</select></label>}
  {!stack.impact&&trial&&<button className="fx-keep-emitter" title="Keep the previewed emitter as a layer." onClick={keepTrial}>Add</button>}
  <div className="fx-layer-actions">{!stack.impact&&<select aria-label="Add layer" title="Add one editable layer to this part." value="" onChange={e=>addLayer(choices.find(s=>menuName(s)===e.target.value))}><option value="">Add layer</option>{[...new Set(surfaceChoices.map(layerType))].map(type=><optgroup label={type} key={type}>{surfaceChoices.filter(s=>layerType(s)===type).map(s=><option key={menuName(s)} value={menuName(s)}>{menuName(s)}</option>)}</optgroup>)}</select>}
   {l&&<button title="Remove the selected layer and the pieces it owns." onClick={()=>{const layers=stack.layers.filter(v=>v!==l);setStack({...stack,layers});select(layers[0]?.id);setPlacing(false);}}>Remove layer</button>}</div>
  {l&&<>
  {(p||swarm)&&!stack.impact&&<select aria-label="Change emitter" title="Replace this emitter and keep its position." value="" onChange={e=>{
   const spec=emitterChoices.find(s=>menuName(s)===e.target.value);if(!spec||!frame)return;
   const next=makeLayer(spec,frame,look.palette,Math.max(...stack.layers.map(v=>v.id))+1);
   setStack({...stack,layers:stack.layers.map(v=>v.id===l.id?{...next,enabled:l.enabled,offset:l.offset,upper:l.upper,lower:l.lower}:v)});select(next.id);
  }}><option value="">Change emitter</option>{emitterChoices.map(s=><option key={menuName(s)} value={menuName(s)}>{menuName(s)}</option>)}</select>}
  {!l.stamp&&<button title="Choose a texture from the game library for this layer." onClick={()=>pickTexture(l.id)}>Change texture</button>}
  {!edge&&!l.stamp&&<ColourControl hint={translate('Changes the colour of {0}.').replace('{0}',translate(emitterName(l)).toLowerCase())} tint={l.tint} defaultTint={defaultTint} update={update}/>}
  {(surf||card)&&COLOUR_RHYTHM_IDS.includes(l.pulse)&&<ColourControl label="Second colour" pickerLabel="Second colour" resetLabel="Reset second colour" hint="The colour the rhythm moves to and back from." tint={l.tint2||secondTint(l.tint)} defaultTint={secondTint(l.tint)} update={(_,value)=>{const next={...l,tint2:value};if(value.every((v,i)=>Math.abs(v-secondTint(l.tint)[i])<1/512))delete next.tint2;setLayer(next);}}/>}
  {edge&&real?<RibbonFields flat model={graph.model} id={real.ObjectId} onEdit={(_,__,mutate)=>{
   const n=structuredClone(real);mutate({RibbonEmitters:[n]});const v=ribbonQuickValues(n);setLayer({...l,tint:v.color,upper:v.above,lower:v.below,smoothness:v.amount,gravity:v.gravity,strength:v.intensity,lasts:v.lasts});}}/>:null}
  {!edge&&!l.stamp&&(!p||real)&&<RangeField key={l.id} title="Adjust only the selected layer." label="Intensity"
   output={v=>Math.round(v*100)+'%'} min={0} max={l.type==='Glow'||l.glyphs?4:1} step={.01} value={p?(l.particleStrength??1):l.strength}
   onDraft={v=>previewStrength(l,v)} onCommit={v=>p?setLayer(withParticleStrength(l,real.Alpha,v)):update('strength',v)}/>}
  {shell&&<RangeField key={l.id+'thickness'} title="Distance of this layer above the surface." label="Thickness" output={v=>v.toFixed(1)} min={0} max={shellReach(frame,l.inflate)} step={.05} value={l.inflate??0} onCommit={v=>update('inflate',v)}/>}
  {p&&<>
   {real&&<LifeTable emitter={live?.emitter||real} lifeStage={lifeStage} setLifeStage={setLifeStage}
    begin={(field,stage)=>{gesture.current={field,stage,emitter:structuredClone(real)};}}
    change={value=>{const g=gesture.current;if(g){g.emitter[g.field][g.stage]=g.field==='SegmentColor'?Float32Array.from(value):value;setLive({emitter:g.emitter});}}}
    finish={()=>{const g=gesture.current;gesture.current=null;setLive(null);if(g){const native={...l.native,[g.field]:g.field==='SegmentColor'?g.emitter[g.field].map(v=>Array.from(v)):Array.from(g.emitter[g.field])};const next={...l,native};if(g.field==='Alpha'){delete next.opacityBase;delete next.particleStrength;}setLayer(next);}}}
    cancel={()=>{gesture.current=null;setLive(null);}}/>}
   {l.burstGap!=null&&<>
    {row('Burst duration (s)','burstWindow',.06,1,.01,'How long one burst emits lightning.')}
    {row('Time between bursts (s)','burstGap',.1,15,.1,'Quiet time before the next burst on the blade.')}
    {row('Bolts per burst','amount',1,32,1,'Total bolts emitted at one point during each burst.')}
    {row('Spread (°)','spread',1,90,1,'How far the lightning can spread around the blade.')}
   </>}
   {l.burstGap==null&&l.kind!=='native'&&particle('EmissionRate','amount',2,fly?9:Math.max(32,l.count*20),1,fly?'How many separate flies circle the part.':'Particles emitted each second across the whole layer.')}
   {!fly&&l.kind!=='native'&&particle('LifeSpan','lasts',.08,l.kind==='flame'?.84:2.2,.01,'How long each particle stays visible.')}
   {l.kind!=='native'&&particle('ParticleScaling','size',fly?frame?.radius*.6:.15,fly?frame?.radius*2.2:Math.max(2,frame?.length*.28),.1,fly?'How far the flies circle from the part.':'Size of each visible particle.')}
   {!fly&&l.kind!=='native'&&particle('Speed','velocity',l.kind==='drops'||l.kind==='mist'?-(frame?.length||30):0,l.kind==='drops'||l.kind==='mist'?0:(frame?.length||30),.1,'Initial speed away from the part.')}
   {!fly&&l.kind!=='native'&&particle('Gravity','gravity',l.kind==='drops'||l.kind==='mist'?0:-(frame?.length||30)*2,(frame?.length||30)*2,.1,'Pulls the particles down as they age.')}
  </>}
  {p&&l.kind==='native'&&real&&<>
   {stack.impact&&<ParticleTimingTool impactOnly emitter={real} options={timingOptions} begin={nativeBegin} change={nativeChange} finish={nativeFinish} cancel={()=>{gesture.current=null;}} update={(field,value)=>setLayer({...l,native:{...l.native,[field]:value}})} patch={values=>values&&setLayer({...l,native:{...l.native,...values}})}/>}
   {(stack.impact?['LifeSpan','Speed','Gravity']:['EmissionRate','LifeSpan','Speed','Gravity']).map(field=><ParticleSlider key={field} decimals={2} field={field} value={particleValue(real,field,timingOptions)} begin={nativeBegin} change={nativeChange} finish={nativeFinish} cancel={()=>{gesture.current=null;}}/>)}
  </>}
  {p&&real&&!stack.impact&&<details className="fx-more" onToggle={e=>setMore(e.currentTarget.open)}><summary>More</summary>{more&&<>
   {/* EMTR's own fields; each value is kept in layer.native. */}
   {(l.burstGap==null?['Latitude','Variation']:['Variation']).map(field=><ParticleSlider key={field} decimals={2} field={field} value={particleValue(real,field,timingOptions)} begin={nativeBegin} change={nativeChange} finish={nativeFinish} cancel={()=>{gesture.current=null;}}/>)}
   <BlendLookField emitter={real} update={depth}/>
   <CarryButton emitter={real} update={depth}/>
   <DrawAsField emitter={real} update={depth}/>
   {(real.FrameFlags&2)?<ParticleSlider decimals={2} field="TailLength" value={particleValue(real,'TailLength',timingOptions)} begin={nativeBegin} change={nativeChange} finish={nativeFinish} cancel={()=>{gesture.current=null;}}/>:null}
   <ParticleFrameStrip emitter={real} asset={assets?.get(gamePathKey(graph.model.Textures[real.TextureID]?.Image||''))} pictureName={graph.model.Textures[real.TextureID]?.Image} replaceableId={real.ReplaceableId||graph.model.Textures[real.TextureID]?.ReplaceableId||0} patch={values=>values&&setLayer({...l,native:{...l.native,...plainValues(values)}})}/>
   <EmitModeButtons emitter={real} update={depth}/>
  </>}</details>}
  {swarm&&<>
   <RangeField key={l.id+'amount'} title="How many flies. Each five more fly on their own clock and paths." label="Amount" output={v=>String(Math.round(v))} min={FLY_BOUNDS.amount[0]} max={FLY_BOUNDS.amount[1]} step={5} value={l.amount} onCommit={v=>update('amount',Math.round(v/5)*5)}/>
   <RangeField key={l.id+'fly'} title="Width of each fly." label="Fly size" output={v=>v.toFixed(1)} min={FLY_BOUNDS.spriteSize[0]} max={Math.max(FLY_BOUNDS.spriteSize[1],l.spriteSize)} step={.5} value={l.spriteSize} onCommit={v=>update('spriteSize',v)}/>
   <RangeField key={l.id+'swarm'} title="How far the flies circle from the centre. The round handle in the preview drags it too." label="Swarm size" output={v=>v.toFixed(1)} min={4} max={Math.max(200,(frame?.length||100)*2,l.size)} step={.5} value={l.size} onCommit={v=>update('size',v)}/>
   <RangeField key={l.id+'speed'} title="How fast the flies circle. Every fly keeps its own pace." label="Speed" output={v=>v.toFixed(2)+'×'} min={FLY_BOUNDS.speed[0]} max={FLY_BOUNDS.speed[1]} step={.05} value={l.speed??1} onCommit={v=>update('speed',v)}/>
  </>}
  {card&&<>
   <label className="field" title="Which way the card faces: the camera, the ground, or fixed to the part."><span>Facing</span><select aria-label="Facing" value={cardValue('facing')} onChange={e=>update('facing',e.target.value)}>{CARD_FACINGS.map(id=><option key={id} value={id}>{{camera:'Camera',ground:'Ground',part:'Part'}[id]}</option>)}</select></label>
   {row('Count','count',1,8,1,'Cards spread along the part. Each runs on its own clock.')}
  </>}
  {(surf||card)&&<label className="field" title="How the layer's light or colour changes over its loop."><span>Rhythm</span><select aria-label="Rhythm" value={rhythm} onChange={e=>setLayer(withRhythm(e.target.value))}>{[...RHYTHMS,...(rhythm===''||!RHYTHMS.some(([id])=>id===rhythm)?[[rhythm,'Built-in']]:[])].map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>}
  {surf&&<label className="field" title="How this layer mixes with what is behind it."><span>Blend</span><select aria-label="Blend" value={blend??''} onChange={e=>setLayer(withBlend(l,Number(e.target.value)))}>{blend==null&&<option value=""/>}{BLEND_CHOICES.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>}
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
    <label className="field"><span>Rune</span><select aria-label="Rune" value={l.image} onChange={e=>setLayer({...l,image:e.target.value})}>{activeRunes.map(([name,path])=><option key={path} value={path}>{name}</option>)}</select></label>
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
   <label className="field" title="How this layer mixes with what is behind it."><span>Blend</span><select aria-label="Blend" value={l.filter??CARD_DEFAULTS.filter} onChange={e=>update('filter',Number(e.target.value))}>{BLEND_CHOICES.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
   <label title="Shade this layer with the map's light. Off keeps it at full brightness."><input type="checkbox" checked={!unshaded} onChange={e=>update('unshaded',!e.target.checked)}/>Lit by map light</label>
  </>}</details>}
  {positional&&<button className="sfx-place" title={stack.impact?"Drag the corners to resize the burst.":l.stamp?"Drag the move handle in the preview.":"Drag the move handle or the edges in the preview."} aria-pressed={placing} onClick={()=>setPlacing(!placing)}>{stack.impact?'Size':l.stamp?'Position':'Position & size'}</button>}
  {(p||edge)&&real&&<button title="Apply this stack and open its selected emitter in the full editor." onClick={()=>openEmitter(l.id)}>Open in EMTR</button>}
  </>}
 </>;
}
