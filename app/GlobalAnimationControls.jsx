import React,{useRef,useState} from 'react';
import ParticleTimingTool from './ParticleTimingTool.jsx';
import {particleValue} from '../src/particle-bindings.js';
import {impactDefaults} from '../src/global-animation-model.js';
import GlobalTextureFit from './GlobalTextureFit.jsx';
import {textureRepeats} from '../src/global-animation-model.js';
import {NumberField,RangeField} from './Fields.jsx';
import {ParticleSlider,LifeTable} from './ParticleCluelessControls.jsx';
import {RibbonFields} from './ParticleRibbonFields.jsx';
import {ribbonQuickValues} from '../src/ribbon-quick.js';
import {findLook,LAYER_CHOICES,makeLayer,RUNE_IMAGES,createsOverlay,surfaceIngredient,layerType,withParticleStrength,withIceVariation} from '../src/global-animation-looks.js';

import {gamePathKey} from '../src/game-path.js';
import {surfacePalette,tintFromHex} from '../src/surface-effect-colours.js';

export default function GlobalAnimationControls({assets,stack,setStack,selected,select,graph,ColourControl,placing,setPlacing,openEmitter,preferences,onSequence,pickTexture,previewStrength}){
 const look=findLook(stack.look),l=stack.layers.find(item=>item.id===selected),frame=graph?.frame;
 const [lifeStage,setLifeStage]=useState(1);
 const [addition,setAddition]=useState(''),[live,setLive]=useState(null),gesture=useRef(null);
 const setLayer=next=>setStack({...stack,layers:stack.layers.map(v=>v.id===next.id?next:v)});
 const update=(key,val)=>{const next={...l,[key]:val};if(key==='tint'&&l.native){next.native={...l.native};delete next.native.SegmentColor;}if(key==='size'&&l.native?.ParticleScaling)next.native={...l.native,ParticleScaling:l.native.ParticleScaling.map(v=>v*val/l.size)};setLayer(next);};
 const row=(label,key,min,max,step,tip)=> <div title={tip}><NumberField label={label} min={min} max={max} step={step} value={l[key]} onChange={n=>update(key,Math.max(min,Math.min(max,n)))}/></div>;
 const result=graph?.layers?.[l?.id],p=l?.type==='Particles',edge=l?.type==='Edge',fly=l?.kind==='flies';
 const real=result?.id!=null?graph.model.Nodes[result.id]:null;
 const surface=graph?.model.Geosets[result?.geoset];
 const nativeImage=surface&&graph.model.Textures[graph.model.Materials[surface.MaterialID]?.Layers[0]?.TextureID]?.Image;
 const uvAsset=assets?.get(gamePathKey(nativeImage||l?.image||''));
 const ingredient=l&&(look.layers.find(s=>s.label===l.label)||LAYER_CHOICES.find(s=>s.label===l.label));
 const defaultTint=l?.defaultTint||ingredient?.tint||tintFromHex(surfacePalette(look)[0][1]);
 const baseGlyph=ingredient?.glyphs?ingredient.image:l?.image;
 const runeImages=baseGlyph&&!RUNE_IMAGES.some(([,path])=>path===baseGlyph)?[[l.label,baseGlyph],...RUNE_IMAGES]:RUNE_IMAGES;
 const activeRunes=l?.glyphs&&!runeImages.some(([,path])=>path===l.image)?[[l.image.split('\\\\').at(-1),l.image],...runeImages]:runeImages;
 const canTile=!l?.own||(surface&&textureRepeats(graph.model,graph.model.Materials[surface.MaterialID].Layers[0].TextureID));
 function particle(field,key,min,max,step,title){
  return <div title={title}><ParticleSlider field={field} value={live?.key===key?live.value:l[key]} min={min} max={max} step={step}
   begin={()=>{gesture.current={key};}} change={value=>{if(gesture.current){gesture.current.value=value;setLive({key,value});}}}
   finish={()=>{const g=gesture.current;gesture.current=null;setLive(null);if(g?.value!=null)update(key,Math.max(min,Math.min(max,g.value)));}} cancel={()=>{gesture.current=null;setLive(null);}}/></div>;
 }
 const menuName=spec=>spec.menuLabel||spec.label;
 const choices=stack.impact?[]:LAYER_CHOICES;
 const emitterChoices=choices.filter(choice=>choice.type==='Particles');
 const positional=p||edge||l?.ground;
 const timingOptions={frame:stack.hit,interval:graph?.model.Sequences[stack.sequence]?.Interval,globalSequences:graph?.model.GlobalSequences};
 const nativeBegin=(field,stage)=>{gesture.current={field,stage,value:undefined};};
 const nativeChange=value=>{if(gesture.current)gesture.current.value=value;};
 const nativeFinish=()=>{const g=gesture.current;gesture.current=null;if(g?.value===undefined)return;if(g.field==='EmissionRate'&&stack.impact){const hit=g.value?.Keys?.find(k=>k.Vector[0]>0)?.Frame;if(hit!=null)setStack({...stack,...impactDefaults(graph.model,graph.geoset,stack.sequence,hit)});else setLayer({...l,burst:g.value});}else setLayer({...l,native:{...l.native,[g.field]:g.value}});};
 return <>
  <h3>{look.name}</h3>
  {!stack.impact&&<div title="Milliseconds for one full loop."><NumberField label="Loop length" min={750} max={10000} step={50} value={stack.loop} onChange={v=>setStack({...stack,loop:Math.max(750,Math.min(10000,Math.round(v)))})}/></div>}
  {stack.look==='ice-skin'&&<label className="field"><span>Ice</span><select aria-label="Ice variation" value={stack.iceVariation||'dark'} onChange={e=>setStack(withIceVariation(stack,frame,e.target.value))}><option value="dark">Dark ice</option><option value="white">White ice</option></select></label>}
  {stack.impact&&<label className="field"><span>Attack</span><select aria-label="Attack animation" value={stack.sequence} onChange={e=>{const sequence=Number(e.target.value);setStack({...stack,...impactDefaults(graph.model,graph.geoset,sequence)});onSequence(sequence);}}>{graph?.model.Sequences.map((s,i)=>/^attack\b/i.test(s.Name)?<option key={i} value={i}>{s.Name}</option>:null)}</select></label>}
  {stack.layers.some(surfaceIngredient)&&<label title="Keep the original surface and draw the effect on a separate geoset."><input type="checkbox" checked={createsOverlay(stack)} onChange={e=>setStack({...stack,asOverlay:e.target.checked})}/>Create as overlay</label>}
  <div className="fx-layer-list" role="group" aria-label="Layers">{stack.layers.map(item=><div className="fx-layer-row" key={item.id}><input type="checkbox" aria-label={'Enable '+item.label} checked={item.enabled!==false} onChange={e=>setLayer({...item,enabled:e.target.checked})}/><button key={item.id} title={'Adjust this '+layerType(item).toLowerCase()+' layer.'} aria-pressed={item.id===selected} onClick={()=>{select(item.id);setLive(null);setPlacing(false);}}>{item.label}<small>{layerType(item)}</small></button></div>)}</div>
  <div className="fx-layer-actions">{!stack.impact&&<select aria-label="Add layer" title="Add one editable layer to this part." value={addition} onChange={e=>{const label=e.target.value;setAddition('');if(!frame||!label)return;const spec=choices.find(s=>menuName(s)===label),id=Math.max(0,...stack.layers.map(x=>x.id))+1;
   const next=makeLayer(spec,frame,look.palette,id);setStack({...stack,layers:[...stack.layers,next]});select(id);}}><option value="">Add layer</option>{[...new Set(choices.map(layerType))].map(type=><optgroup label={type} key={type}>{choices.filter(s=>layerType(s)===type).map(s=><option key={menuName(s)} value={menuName(s)}>{menuName(s)}</option>)}</optgroup>)}</select>}
   {l&&<button title="Remove the selected layer and the pieces it owns." onClick={()=>{const layers=stack.layers.filter(v=>v!==l);setStack({...stack,layers});select(layers[0]?.id);setPlacing(false);}}>Remove layer</button>}</div>
  {l&&<>
  {p&&!stack.impact&&<select aria-label="Change emitter" title="Replace this emitter and keep its position." value="" onChange={e=>{
   const spec=emitterChoices.find(s=>menuName(s)===e.target.value);if(!spec||!frame)return;
   const next=makeLayer(spec,frame,look.palette,Math.max(...stack.layers.map(v=>v.id))+1);
   setStack({...stack,layers:stack.layers.map(v=>v.id===l.id?{...next,enabled:l.enabled,offset:l.offset,upper:l.upper,lower:l.lower}:v)});select(next.id);
  }}><option value="">Change emitter</option>{emitterChoices.map(s=><option key={menuName(s)} value={menuName(s)}>{menuName(s)}</option>)}</select>}
  {!l.stamp&&<button title="Choose a texture from the game library for this layer." onClick={()=>pickTexture(l.id)}>Change texture</button>}
  {!edge&&!l.stamp&&<ColourControl hint={'Changes the colour of '+l.label.toLowerCase()+'.'} tint={l.tint} defaultTint={defaultTint} update={update}/>}
  {edge&&real?<RibbonFields flat model={graph.model} id={real.ObjectId} onEdit={(_,__,mutate)=>{
   const n=structuredClone(real);mutate({RibbonEmitters:[n]});const v=ribbonQuickValues(n);setLayer({...l,tint:v.color,upper:v.above,lower:v.below,smoothness:v.amount,gravity:v.gravity,strength:v.intensity,lasts:v.lasts});}}/>:null}
  {!edge&&!l.stamp&&(!p||real)&&<RangeField key={l.id} title="Adjust only the selected layer." label="Intensity"
   output={v=>Math.round(v*100)+'%'} min={0} max={l.type==='Glow'||l.glyphs?4:1} step={.01} value={p?(l.particleStrength??1):l.strength}
   onDraft={v=>previewStrength(l,v)} onCommit={v=>p?setLayer(withParticleStrength(l,real.Alpha,v)):update('strength',v)}/>}
  {l.powerArcs&&<>
   {row('Burst duration (s)','burstWindow',.06,1,.01,'How long the arcs flash along the blade.')}
   {row('Time between bursts (s)','burstGap',.1,15,.1,'Quiet time between flashes.')}
   {row('Flashes per burst','amount',1,12,1,'Number of flashes along the blade in each burst.')}
  </>}
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
   {(stack.impact?['LifeSpan','Speed','Gravity']:['EmissionRate','LifeSpan','Speed','Gravity']).map(field=><ParticleSlider key={field} field={field} value={particleValue(real,field,timingOptions)} begin={nativeBegin} change={nativeChange} finish={nativeFinish} cancel={()=>{gesture.current=null;}}/>)}
  </>}
  {(l.glyphs||l.type==='Glow')&&<label className="field"><span>Glow</span><select aria-label={l.glyphs?'Rune glow':'Glow style'} value={l.pulse||'breathe'} onChange={e=>update('pulse',e.target.value)}>{[['steady','Steady'],['breathe','Pulse'],['flicker','Flicker'],['glint','Flash'],['double','Double pulse'],...(['crystal','steel'].includes(l.pulse)?[[l.pulse,l.label]]:[])].map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>}
  {l.glyphs&&<>
   <label className="field"><span>Rune</span><select aria-label="Rune" value={l.image} onChange={e=>setLayer({...l,image:e.target.value})}>{activeRunes.map(([name,path])=><option key={path} value={path}>{name}</option>)}</select></label>
   <GlobalTextureFit key={l.id} geoset={surface} asset={uvAsset} canScale layer={l} preferences={preferences} change={update}/>
  </>}
  {!p&&!edge&&!l.stamp&&<>
   {(l.type==='Moving skin'&&!l.fixed&&l.pulse!=='fade'&&!l.nativeSurface&&!l.powerArcs)&&row('Speed','speed',1,4,1,'Complete turns or texture passes within the loop.')}
   {l.type==='Moving skin'&&!l.fixed&&l.pulse!=='fade'&&!l.nativeSurface&&<>{row('Direction','direction',0,359,1,'Direction of travel on the surface, in degrees.')}{!l.atlasRect&&canTile&&row('Tiling','tiling',1,4,.01,'How many times the skin repeats across the part.')}{!l.atlasRect&&<GlobalTextureFit key={l.id} geoset={surface} asset={uvAsset} canScale={canTile} layer={l} preferences={preferences} change={update}/>}</>}
  </>}
  {positional&&<button className="sfx-place" title={stack.impact?"Drag the corners to resize the burst.":l.stamp?"Drag the move handle in the preview.":"Drag the move handle or the edges in the preview."} aria-pressed={placing} onClick={()=>setPlacing(!placing)}>{stack.impact?'Size':l.stamp?'Position':'Position & size'}</button>}
  {(p||edge)&&real&&<button title="Apply this stack and open its selected emitter in the full editor." onClick={()=>openEmitter(l.id)}>Open in EMTR</button>}
  </>}
 </>;
}
