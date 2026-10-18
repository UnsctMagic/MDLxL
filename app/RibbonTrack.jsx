import React,{useEffect,useRef,useState} from 'react';
import {ribbonSpans,setRibbonSpans,addSpan,ribbonSizeKeys,removeRibbonSizeKey} from '../src/ribbon-timing.js';

/**
 * The ribbon's on/off parts in the current animation. Each part is a bar with a diamond where the
 * ribbon shows and one where it hides. Size keys are the green dots underneath.
 */
export default function RibbonTrack({model,id,sequenceIndex,time,disabled,onEdit,onSeek,onSmoothSize,onError}){
 const bar=useRef(null),[draft,setDraft]=useState(null),[menu,setMenu]=useState(null),drag=useRef(null);
 useEffect(()=>{
  if(!menu)return;
  const close=event=>{if(event.type==='keydown'?event.key==='Escape':!event.target.closest?.('.ribbon-track-menu'))setMenu(null);};
  window.addEventListener('pointerdown',close,true);window.addEventListener('keydown',close,true);
  return()=>{window.removeEventListener('pointerdown',close,true);window.removeEventListener('keydown',close,true);};
 },[menu]);
 if(!model.RibbonEmitters.some(node=>node.ObjectId===id))return null;
 if(!(sequenceIndex>=0)||!model.Sequences[sequenceIndex])return <div className="ribbon-track" role="group" aria-label="Ribbon visible"><b>Ribbon visible</b><span className="ribbon-track-hint">Choose an animation to set when the ribbon shows.</span></div>;
 const {start,end,spans:saved,global}=ribbonSpans(model,id,sequenceIndex),spans=draft||saved,sizeKeys=ribbonSizeKeys(model,id,sequenceIndex),span=Math.max(1,end-start);
 const pct=frame=>(frame-start)/span*100;
 const frameAt=clientX=>{const box=bar.current.getBoundingClientRect();return Math.round(start+Math.min(1,Math.max(0,(clientX-box.left)/Math.max(1,box.width)))*span);};
 const commit=(label,next)=>onEdit(label,['Nodes'],m=>{setRibbonSpans(m,id,sequenceIndex,next);});
 const beginDrag=(event,index,side)=>{
  if(disabled||event.button!==0)return;event.preventDefault();event.stopPropagation();event.currentTarget.setPointerCapture(event.pointerId);
  drag.current={index,side,spans:spans.map(part=>[...part])};setDraft(drag.current.spans);
 };
 const moveDrag=event=>{
  const d=drag.current;if(!d)return;
  const next=d.spans.map(part=>[...part]),[a,b]=next[d.index];
  // A diamond stays between its neighbours, so parts never swap order.
  const low=d.side?a+1:(next[d.index-1]?.[1]??start),high=d.side?(next[d.index+1]?.[0]??end):b-1;
  next[d.index][d.side]=Math.max(low,Math.min(high,frameAt(event.clientX)));
  d.spans=next;setDraft(next);onSeek(next[d.index][d.side]);
 };
 const endDrag=event=>{
  const d=drag.current;if(!d)return;drag.current=null;event.currentTarget.releasePointerCapture?.(event.pointerId);
  setDraft(null);if(JSON.stringify(d.spans)!==JSON.stringify(saved))commit('Change when the ribbon shows',d.spans);
 };
 const nearKey=clientX=>{const box=bar.current.getBoundingClientRect();return sizeKeys.find(frame=>Math.abs(box.left+pct(frame)/100*box.width-clientX)<=6);};
 const openMenu=(event,extra={})=>{
  event.preventDefault();event.stopPropagation();if(disabled)return;
  const frame=extra.frame??frameAt(event.clientX),part=extra.part??spans.findIndex(([a,b])=>frame>=a&&frame<=b),key=extra.key??nearKey(event.clientX);
  setMenu({x:event.clientX,y:event.clientY,frame:key??frame,part,key});
 };
 return <div className="ribbon-track" role="group" aria-label="Ribbon visible">
  <div className="ribbon-track-heading">
   <b>Ribbon visible</b>
   <span className="ribbon-track-hint">{global?'Visibility uses a global sequence; use Adjust Manually.':'Drag the diamonds to choose when the ribbon shows. Right-click the track for size keys.'}</span>
   <button disabled={disabled||global} title="Add another part where the ribbon shows and then disappears again." onClick={()=>{try{commit('Add a ribbon on/off part',addSpan(spans,start,end));}catch(error){onError?.(error.message);}}}>+ On/off part</button>
  </div>
  <div className="ribbon-track-row">
   <span className="ribbon-track-frame">{start}</span>
   <div ref={bar} className="ribbon-track-bar" onPointerDown={event=>{if(event.button===0&&!event.target.closest('.ribbon-track-diamond'))onSeek(frameAt(event.clientX));}} onContextMenu={openMenu}>
    {spans.map(([a,b],index)=><React.Fragment key={index}>
     <div className="ribbon-track-span" style={{left:pct(a)+'%',width:(pct(b)-pct(a))+'%'}} onContextMenu={event=>openMenu(event,{part:index})}><span>visible</span></div>
     {[a,b].map((frame,side)=><div key={side} role="slider" tabIndex={0} aria-label={(side?'Ribbon hides at frame ':'Ribbon shows at frame ')+frame} aria-valuemin={start} aria-valuemax={end} aria-valuenow={frame}
      className={'ribbon-track-diamond'+(side?' hides':' shows')} style={{left:pct(frame)+'%'}} title={(side?'Hides':'Shows')+' at frame '+frame+'. Drag to change when.'}
      onPointerDown={event=>beginDrag(event,index,side)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={()=>{drag.current=null;setDraft(null);}} onContextMenu={event=>openMenu(event,{part:index,frame})}
      onKeyDown={event=>{if(!['ArrowLeft','ArrowRight'].includes(event.key)||disabled)return;event.preventDefault();const next=spans.map(p=>[...p]),low=side?a+1:(next[index-1]?.[1]??start),high=side?(next[index+1]?.[0]??end):b-1;next[index][side]=Math.max(low,Math.min(high,frame+(event.key==='ArrowRight'?1:-1)*(event.shiftKey?10:1)));commit('Change when the ribbon shows',next);onSeek(next[index][side]);}}/>)}
    </React.Fragment>)}
    {sizeKeys.map(frame=><div key={'k'+frame} className="ribbon-track-size-key" style={{left:pct(frame)+'%'}} title={'Size key at frame '+frame+'. Right-click to adjust or remove.'} onContextMenu={event=>openMenu(event,{key:frame,frame})}/>)}
    <div className="ribbon-track-playhead" style={{left:pct(Math.max(start,Math.min(end,time)))+'%'}}/>
   </div>
   <span className="ribbon-track-frame">{end}</span>
  </div>
  {menu&&<div className="ribbon-track-menu" role="menu" style={{left:menu.x,top:menu.y}}>
   <button role="menuitem" autoFocus onClick={()=>{setMenu(null);onSmoothSize(menu.frame);}}>{menu.key!=null?'Smooth Size: adjust the key at frame '+menu.key:'Smooth Size at frame '+menu.frame}</button>
   {menu.key!=null&&<button role="menuitem" onClick={()=>{setMenu(null);onEdit('Remove ribbon size key',['Nodes'],m=>{removeRibbonSizeKey(m,id,menu.key,sequenceIndex);});}}>Remove size key at frame {menu.key}</button>}
   {menu.part>=0&&<button role="menuitem" onClick={()=>{setMenu(null);commit('Remove a ribbon on/off part',spans.filter((_,i)=>i!==menu.part));}}>Remove this on/off part</button>}
  </div>}
 </div>;
}
