import React,{useRef,useState} from 'react';
import GlobalTextureFit from './GlobalTextureFit.jsx';
import {textureRepeats} from '../src/global-animation-model.js';
import {NumberField,RangeField} from './Fields.jsx';
import {ParticleSlider} from './ParticleCluelessControls.jsx';
import {RibbonFields} from './ParticleRibbonFields.jsx';
import {ribbonQuickValues} from '../src/ribbon-quick.js';
import {findLook,LAYER_CHOICES,makeLayer} from '../src/global-animation-looks.js';

export default function GlobalAnimationControls({stack,setStack,selected,select,graph,ColourControl,placing,setPlacing,openEmitter,preferences}){
 const look=findLook(stack.look),l=stack.layers.find(item=>item.id===selected),frame=graph?.frame;
 const [addition,setAddition]=useState(''),[live,setLive]=useState(null),gesture=useRef(null);
 const setLayer=next=>setStack({...stack,layers:stack.layers.map(v=>v.id===next.id?next:v)});
 const update=(key,val)=>setLayer({...l,[key]:val});
 const row=(label,key,min,max,step,tip)=> <div title={tip}><NumberField label={label} min={min} max={max} step={step} value={l[key]} onChange={n=>update(key,Math.max(min,Math.min(max,n)))}/></div>;
 const result=graph?.layers?.[l?.id],p=l?.type==='Particles',r=l?.type==='Rune',edge=l?.type==='Edge',fly=l?.kind==='flies';
 const real=result?.id!=null?graph.model.Nodes[result.id]:null;
 const surface=graph?.model.Geosets[result?.geoset];
 const canTile=!l?.own||(surface&&textureRepeats(graph.model,graph.model.Materials[surface.MaterialID].Layers[0].TextureID));
 function particle(field,key,min,max,step,title){
  return <div title={title}><ParticleSlider field={field} value={live?.key===key?live.value:l[key]} min={min} max={max} step={step}
   begin={()=>{gesture.current={key};}} change={value=>{if(gesture.current){gesture.current.value=value;setLive({key,value});}}}
   finish={()=>{const g=gesture.current;gesture.current=null;setLive(null);if(g?.value!=null)update(key,Math.max(min,Math.min(max,g.value)));}} cancel={()=>{gesture.current=null;setLive(null);}}/></div>;
 }
 const positional=p||edge||r;
 return <>
  <h3>{look.name}</h3>
  <div title="Milliseconds for one complete loop, in every model animation."><NumberField label="Loop length" min={750} max={10000} step={50} value={stack.loop} onChange={v=>setStack({...stack,loop:Math.max(750,Math.min(10000,Math.round(v)))})}/></div>
  <div className="fx-layer-list" role="group" aria-label="Layers">{stack.layers.map(item=><button key={item.id} title={'Adjust this '+item.type.toLowerCase()+' layer.'} aria-pressed={item.id===selected} onClick={()=>{select(item.id);setLive(null);setPlacing(false);}}>{item.label}<small>{item.type}</small></button>)}</div>
  <div className="fx-layer-actions"><select aria-label="Add layer" title="Add one editable layer to this part." value={addition} onChange={e=>{const type=e.target.value;setAddition('');if(!frame||!type)return;const spec=LAYER_CHOICES.find(s=>s.type===type),id=Math.max(0,...stack.layers.map(x=>x.id))+1;
   const next=makeLayer(spec,frame,look.palette,id);setStack({...stack,layers:[...stack.layers,next]});select(id);}}><option value="">Add layer…</option>{LAYER_CHOICES.map(s=><option key={s.type}>{s.type}</option>)}</select>
   {l&&<button title="Remove the selected layer and the pieces it owns." onClick={()=>{const layers=stack.layers.filter(v=>v!==l);setStack({...stack,layers});select(layers[0]?.id);setPlacing(false);}}>Remove layer</button>}</div>
  {l&&<>
  {!edge&&<ColourControl hint={'Changes the colour of '+l.label.toLowerCase()+'.'} effect={{palette:look.palette}} options={{tint:l.tint,mode:'new'}} update={update}/>}
  {edge&&real?<RibbonFields flat model={graph.model} id={real.ObjectId} onEdit={(_,__,mutate)=>{
   const n=structuredClone(real);mutate({RibbonEmitters:[n]});const v=ribbonQuickValues(n);setLayer({...l,tint:v.color,upper:v.above,lower:v.below,smoothness:v.amount,gravity:v.gravity,strength:v.intensity,lasts:v.lasts});}}/>:null}
  {p&&<>
   {particle('EmissionRate','amount',2,fly?9:Math.max(32,l.count*20),1,fly?'How many separate flies circle the part.':'Particles emitted each second across the whole layer.')}
   {!fly&&particle('LifeSpan','lasts',.08,l.kind==='flame'?.84:2.2,.01,'How long each particle stays visible.')}
   {particle('ParticleScaling','size',fly?frame?.radius*.6:.15,fly?frame?.radius*2.2:Math.max(2,frame?.length*.28),.1,fly?'How far the flies circle from the part.':'Size of each visible particle.')}
   {!fly&&particle('Speed','velocity',l.kind==='drops'||l.kind==='mist'?-(frame?.length||30):0,l.kind==='drops'||l.kind==='mist'?0:(frame?.length||30),.1,'Initial speed away from the part.')}
   {!fly&&particle('Gravity','gravity',l.kind==='drops'||l.kind==='mist'?0:-(frame?.length||30)*2,(frame?.length||30)*2,.1,'Pulls the particles down as they age.')}
  </>}
  {!p&&!edge&&<>
   <RangeField title="How strongly this layer shows on the part." label="Intensity" min={.08} max={1} step={.01} value={l.strength} onCommit={v=>update('strength',v)}/>
   {(r||l.type==='Moving skin'&&l.pulse!=='fade')&&row('Speed','speed',1,4,1,'Complete turns or texture passes within the loop.')}
   {l.type==='Moving skin'&&l.pulse!=='fade'&&<>{row('Direction','direction',0,359,1,'Direction of travel on the surface, in degrees.')}{!l.atlasRect&&canTile&&row('Tiling','tiling',1,4,.01,'How many times the skin repeats across the part.')}{!l.atlasRect&&<GlobalTextureFit key={l.id} geoset={surface} canScale={canTile} layer={l} preferences={preferences} change={update}/>}</>}
  </>}
  {positional&&<button className="sfx-place" title="Drag the move handle or the edges in the preview." aria-pressed={placing} onClick={()=>setPlacing(!placing)}>Position &amp; size</button>}
  {(p||edge)&&real&&<button title="Apply this stack and open its selected emitter in the full editor." onClick={()=>openEmitter(l.id)}>Open in EMTR</button>}
  </>}
 </>;
}
