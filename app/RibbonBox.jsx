import React,{useEffect,useRef,useState} from 'react';
import {ribbonQuickValues,setRibbonQuick} from '../src/ribbon-quick.js';

const hex=color=>'#'+Array.from(color,v=>Math.round(Math.min(1,Math.max(0,v))*255).toString(16).padStart(2,'0')).join('');
const round=value=>Math.round(value*100)/100;

/** A range that edits a draft while dragging and commits one undo step on release. */
function Slider({label,title,value,min,max,step,format=round,onCommit}){
 const [draft,setDraft]=useState(null),shown=draft??value;
 const commit=()=>{if(draft!=null&&draft!==value)onCommit(draft);setDraft(null);};
 return <label className="ribbon-box-row" title={title}><span>{label}</span><input aria-label={'Ribbon '+label.toLowerCase()} type="range" min={min} max={Math.max(max,value)} step={step} value={shown}
  onChange={e=>setDraft(Number(e.target.value))} onPointerUp={commit} onKeyUp={commit} onBlur={commit}/><output>{format(shown)}</output></label>;
}

function NumberRow({label,title,value,min,step='any',onCommit}){
 const [draft,setDraft]=useState(null);
 const commit=()=>{if(draft!=null&&draft!==''&&Number(draft)!==value)onCommit(Number(draft));setDraft(null);};
 return <label className="ribbon-box-row" title={title}><span>{label}</span><input aria-label={'Ribbon '+label.toLowerCase()} type="number" min={min} step={step} value={draft??round(value)} onChange={e=>setDraft(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')commit();if(e.key==='Escape'){e.stopPropagation();setDraft(null);}}}/></label>;
}

/** The ribbon settings that matter in game. flat shows all of them; otherwise the rarer ones sit under Advanced. */
export function RibbonFields({model,id,disabled,onEdit,onPause,flat=false,children}){
 const node=model.RibbonEmitters.find(item=>item.ObjectId===id),colorInput=useRef(null),latest=useRef(null);
 const set=(label,change)=>{onPause?.(false);onEdit(label,['Nodes'],m=>{setRibbonQuick(m,id,change);});};
 latest.current={set};
 useEffect(()=>{
  // The picker reports every hue while open; commit once when it closes.
  const input=colorInput.current;if(!input)return;
  const done=()=>{const v=input.value;latest.current.set('Change ribbon color',{color:[1,3,5].map(i=>parseInt(v.slice(i,i+2),16)/255)});};
  input.addEventListener('change',done);return()=>input.removeEventListener('change',done);
 },[!!node]);
 useEffect(()=>{const input=colorInput.current;if(node&&input&&input.ownerDocument.activeElement!==input)input.value=hex(ribbonQuickValues(node).color);});
 if(!node)return null;
 // Animated values show their strongest key; these controls change the whole ribbon at once.
 const values=ribbonQuickValues(node);
 const advanced=<>
  <NumberRow label="Upper end" title="How far the ribbon reaches above its center along the weapon." value={values.above} min={0} onCommit={v=>set('Change ribbon upper end',{above:v})}/>
  <NumberRow label="Lower end" title="How far the ribbon reaches below its center along the weapon." value={values.below} min={0} onCommit={v=>set('Change ribbon lower end',{below:v})}/>
  <NumberRow label="Smoothness" title="Trail pieces made per second. More pieces make a smoother curve in fast swings." value={values.amount} min={0} step={1} onCommit={v=>set('Change ribbon smoothness',{amount:v})}/>
  <NumberRow label="Gravity" title="Pulls the trail down while it fades in game. 0 keeps it where the weapon was. The preview does not show gravity." value={values.gravity} onCommit={v=>set('Change ribbon gravity',{gravity:v})}/>
 </>;
 return <>
  <label className="ribbon-box-row" title="The ribbon's color. It is brightest at the weapon and fades along the trail."><span>Color</span><input ref={colorInput} aria-label="Ribbon color" type="color" disabled={disabled} defaultValue={hex(values.color)}/></label>
  <Slider label="Intensity" title="How strongly the ribbon shows. Lower it for a faint trail." value={values.intensity} min={0} max={1} step={.01} format={v=>Math.round(v*100)+'%'} onCommit={v=>set('Change ribbon intensity',{intensity:v})}/>
  <Slider label="Lasts" title="How long, in seconds, the trail stays behind the weapon. Longer makes a longer trail." value={values.lasts} min={.05} max={2} step={.05} format={v=>round(v)+' s'} onCommit={v=>set('Change ribbon length of time',{lasts:v})}/>
  <Slider label="Size" title="How much of the weapon the ribbon covers, everywhere in the animation. For a size that changes during the animation, right-click the ribbon track and choose Smooth Size." value={values.size} min={1} max={Math.max(200,values.size*2)} step={1} format={v=>Math.round(v)} onCommit={v=>set('Change ribbon size',{size:v})}/>
  {flat?advanced:<details className="ribbon-box-advanced"><summary title="Less common ribbon settings.">Advanced settings</summary>{advanced}</details>}
  {children}
 </>;
}

export default function RibbonBox({model,id,onClose,onOpenEditor,onManual,...props}){
 const node=model.RibbonEmitters.find(item=>item.ObjectId===id);
 if(!node)return null;
 return <section className="ribbon-box" aria-label="Ribbon" onKeyDown={e=>{if(e.key==='Escape'&&e.target.type!=='number'){e.stopPropagation();onClose();}}}>
  <div className="ribbon-box-heading"><b>Ribbon</b><span title={node.Name}>{node.Name}</span><button aria-label="Close ribbon" title="Close this box. Click the ribbon or Edit effect to open it again." onClick={onClose}>×</button></div>
  <RibbonFields model={model} id={id} {...props}>
   <div className="ribbon-box-actions">
    <button title="Edit the exact MDL text of this ribbon, for experienced users. Apply is one undo step." onClick={()=>onManual(id)}>Adjust Manually</button>
    <button title="Open this ribbon in the Emitter Editor." onClick={()=>onOpenEditor(id)}>Emitter Editor…</button>
   </div>
  </RibbonFields>
 </section>;
}
