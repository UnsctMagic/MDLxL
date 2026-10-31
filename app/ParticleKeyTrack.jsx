import React,{useEffect,useRef,useState} from 'react';
import {createFrameCoalescer} from './viewport-performance.js';
import useDismiss from './useDismiss.js';
import {emitterSpans,ribbonSizeKeys,addSpan} from '../src/emitter-timing.js';

const names={Visibility:'Visible',HeightAbove:'Upper end',HeightBelow:'Lower end',Alpha:'Intensity',Color:'Color',EmissionRate:'Amount',Translation:'Move',Rotation:'Turn',Scaling:'Scale'};

/** The selected emitter's keys in this animation, as clickable diamonds on the playhead. */
export function emitterKeyFrames(emitter,start,end){
 const frames=new Map();
 for(const [field,value]of Object.entries(emitter||{})){
  if(!Array.isArray(value?.Keys)||value.GlobalSeqId!=null&&value.GlobalSeqId>=0)continue;
  for(const key of value.Keys)if(key.Frame>=start&&key.Frame<=end){const list=frames.get(key.Frame)||[];if(!list.includes(field))list.push(field);frames.set(key.Frame,list);}
 }
 return [...frames].sort((a,b)=>a[0]-b[0]).map(([frame,fields])=>({frame,fields}));
}

const left=(frame,start,span)=>`calc(6px + (100% - 12px) * ${(frame-start)/span})`;

/**
 * The play track. For a ribbon it is its keyframe track: each blue pair of diamonds is one part where the
 * emitter shows and then hides. For a ribbon, green diamonds are size keys and right-click gives Smooth Size.
 */
export default function ParticleKeyTrack({model,emitter,timed,ribbon,sequence,start,end,frame,disabled,onScrub,onSpans,onSmoothSize,onRemoveSizeKey}){
 const box=useRef(null),drag=useRef(null),[draft,setDraft]=useState(null),[menu,setMenu]=useState(null),span=Math.max(1,end-start);
 const menuBox=useRef(null),follow=useRef(null),moveFrame=useRef(null);
 // Each diamond move scrubs the preview: follow the pointer once per frame.
 moveFrame.current||=createFrameCoalescer(()=>follow.current?.());
 useEffect(()=>()=>moveFrame.current.cancel(),[]);
 useDismiss(menu,[menuBox],()=>setMenu(null),{stopEscape:false});
 const range=<input aria-label="Particle preview playhead" type="range" min={start} max={end} step="1" value={frame} onChange={e=>onScrub(Number(e.target.value))}/>;
 const timing=timed&&model.Sequences[sequence]?emitterSpans(model,emitter.ObjectId,sequence):null;
 if(!timing||timing.global)return <div className="pe-key-track">{range}
  {emitterKeyFrames(emitter,start,end).map(({frame:at,fields})=><button key={at} type="button" className={'pe-key-mark'+(at===Math.round(frame)?' current':'')} style={{left:left(at,start,span)}}
   aria-label={'Key at frame '+at} title={'Frame '+at+': '+fields.map(field=>names[field]||field).join(', ')+'. Click to jump here.'} onClick={()=>onScrub(at)}/>)}
 </div>;
 const spans=draft||timing.spans,sizeKeys=ribbon?ribbonSizeKeys(model,emitter.ObjectId,sequence):[];
 // Other animated values stay visible as small marks to jump to.
 const otherKeys=emitterKeyFrames(emitter,start,end).map(item=>({...item,fields:item.fields.filter(field=>!['Visibility','HeightAbove','HeightBelow'].includes(field))})).filter(item=>item.fields.length);
 const frameAt=clientX=>{const rect=box.current.getBoundingClientRect();return Math.round(start+Math.min(1,Math.max(0,(clientX-rect.left-6)/Math.max(1,rect.width-12)))*span);};
 const limits=(list,index,side)=>{const [a,b]=list[index];return side?[a+1,list[index+1]?.[0]??end]:[list[index-1]?.[1]??start,b-1];};
 const move=event=>{const d=drag.current;if(!d)return;d.clientX=event.clientX;moveFrame.current.schedule();};
 const applyMove=()=>{
  const d=drag.current;if(!d||d.clientX==null)return;const next=d.spans.map(part=>[...part]),[low,high]=limits(next,d.index,d.side);
  next[d.index][d.side]=Math.max(low,Math.min(high,frameAt(d.clientX)));d.spans=next;setDraft(next);onScrub(next[d.index][d.side]);
 };
 follow.current=applyMove;
 const release=event=>{moveFrame.current.flush();const d=drag.current;if(!d)return;drag.current=null;event.currentTarget.releasePointerCapture?.(event.pointerId);setDraft(null);if(JSON.stringify(d.spans)!==JSON.stringify(timing.spans))onSpans(d.spans);};
 const context=(event,item)=>{event.preventDefault();event.stopPropagation();if(!disabled)setMenu({x:event.clientX,y:event.clientY,...item});};
 // Any point on the track can get a size key, independent of the on/off diamonds.
 return <><div className="pe-key-track ribbon" ref={box} title={ribbon?"Right-click anywhere on the track for Smooth Size at that frame.":undefined} onContextMenu={event=>{if(ribbon)context(event,{frame:frameAt(event.clientX)});}}>
  {otherKeys.map(({frame:at,fields})=><button key={'o'+at} type="button" className="pe-key-mark small" style={{left:left(at,start,span)}} aria-label={'Key at frame '+at} title={'Frame '+at+': '+fields.map(field=>names[field]||field).join(', ')+'. Click to jump here.'} onClick={()=>onScrub(at)}/>)}
  {range}
  {spans.map(([a,b],index)=><div key={'s'+index} className="pe-key-span" style={{left:left(a,start,span),width:`calc((100% - 12px) * ${(b-a)/span})`}}/>)}
  {spans.flatMap(([a,b],index)=>[a,b].map((at,side)=><div key={index+':'+side} role="slider" tabIndex={0} aria-label={(side?(ribbon?'Ribbon':'Emitter')+' hides at frame ':(ribbon?'Ribbon':'Emitter')+' shows at frame ')+at} aria-valuenow={at} aria-valuemin={start} aria-valuemax={end}
   className={'pe-key-diamond'+(side?' hides':' shows')} style={{left:left(at,start,span)}} title={(side?'Hides':'Shows')+' at frame '+at+'. Drag to change when.'+(ribbon?' Right-click for Smooth Size.':' Right-click to remove this pair.')}
   onPointerDown={event=>{if(disabled||event.button!==0)return;event.preventDefault();event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);drag.current={index,side,spans:spans.map(part=>[...part])};setDraft(drag.current.spans);onScrub(at);}}
   onPointerMove={move} onPointerUp={release} onPointerCancel={()=>{moveFrame.current.cancel();drag.current=null;setDraft(null);}}
   onContextMenu={event=>context(event,{frame:at,part:index})}
   onKeyDown={event=>{if(disabled||!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();const next=spans.map(part=>[...part]),[low,high]=limits(next,index,side);next[index][side]=Math.max(low,Math.min(high,at+(event.key==='ArrowRight'?1:-1)*(event.shiftKey?10:1)));onSpans(next);onScrub(next[index][side]);}}/>))}
  {sizeKeys.map(at=><div key={'k'+at} role="button" tabIndex={0} aria-label={'Size key at frame '+at} className="pe-key-size" style={{left:left(at,start,span)}} title={'Size key at frame '+at+'. Right-click for Smooth Size.'}
   onPointerDown={event=>{event.stopPropagation();onScrub(at);}} onContextMenu={event=>context(event,{frame:at,sizeKey:true})}/>)}
  {menu&&<div ref={menuBox} className="pe-key-menu" role="menu" style={{left:menu.x,top:menu.y}}>
   {ribbon&&<button role="menuitem" autoFocus onClick={()=>{setMenu(null);onSmoothSize(menu.frame);}}>Smooth Size at frame {menu.frame}</button>}
   {menu.sizeKey&&<button role="menuitem" onClick={()=>{setMenu(null);onRemoveSizeKey(menu.frame);}}>Remove size key</button>}
   {menu.part!=null&&<button role="menuitem" onClick={()=>{setMenu(null);onSpans(spans.filter((_,i)=>i!==menu.part));}}>Remove this pair</button>}
  </div>}
 </div>
 <button type="button" className="pe-key-add" disabled={disabled} title="Add another pair of diamonds: one more part where it shows and then hides." onClick={()=>{try{onSpans(addSpan(spans,start,end));}catch(error){onSpans(null,error.message);}}}>+ ◆◆</button>
 </>;
}
