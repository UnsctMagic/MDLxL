import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {particleGridChange,particleCellAt} from '../src/particle-picture.js';
import {particlePictureCanvas} from './particle-picture-canvas.js';

/** Which frames play in each part of a particle's life. Streak parts only matter when streaks are drawn. */
export const FRAME_PARTS=[['LifeSpanUVAnim','Born → Halfway'],['DecayUVAnim','Halfway → End'],['TailUVAnim','Streak: Born → Halfway'],['TailDecayUVAnim','Streak: Halfway → End']];
export const frameParts=emitter=>FRAME_PARTS.filter(([field])=>emitter.FrameFlags&2||!field.startsWith('Tail'));
/** First and last frame shown, from the stored start and exclusive end. */
export const frameRange=values=>{const a=values?.[0]??0,b=values?.[1]??0;return [a,b>a?b-1:a];};

const SIZE=200;
export default function ParticleFramesWindow({emitter,asset,replaceableId,teamColor,part,onPart,update,patch,onClose}){
 const grid=useRef(null),preview=useRef(null),[image,setImage]=useState(null),[picking,setPicking]=useState('first'),[pending,setPending]=useState(null),[message,setMessage]=useState('');
 const rows=Math.max(1,emitter.Rows||1),columns=Math.max(1,emitter.Columns||1),values=emitter[part]||[0,0,1],[first,last]=frameRange(values),cells=rows*columns,drawable=cells<=1024;
 useEffect(()=>{let live=true;particlePictureCanvas(asset,{replaceableId,teamColor}).then(source=>{if(live)setImage(source);}).catch(()=>{if(live)setMessage('This picture cannot be shown.');});return()=>{live=false;};},[asset,replaceableId,teamColor]);
 useEffect(()=>{
  const c=grid.current?.getContext('2d');if(!c)return;c.clearRect(0,0,SIZE,SIZE);
  if(image)c.drawImage(image,0,0,SIZE,SIZE);
  if(!drawable)return;
  const w=SIZE/columns,h=SIZE/rows;c.font='bold 11px sans-serif';
  for(let cell=0;cell<cells;cell++){
   const x=cell%columns*w,y=Math.floor(cell/columns)*h,chosen=cell>=first&&cell<=last;
   if(chosen){c.fillStyle='#ffce5a55';c.fillRect(x,y,w,h);}
   c.strokeStyle=chosen?'#ffce5a':'#a7dfffaa';c.lineWidth=chosen?2:1;c.strokeRect(x+.5,y+.5,w-1,h-1);
   if(w>=18&&h>=14){c.fillStyle='#000a';c.fillRect(x+2,y+2,c.measureText(String(cell)).width+4,13);c.fillStyle='#fff';c.fillText(String(cell),x+4,y+12);}
  }
 },[image,rows,columns,first,last,drawable]);
 useEffect(()=>{
  // Plays the chosen frames in a loop, like one particle would show them.
  const c=preview.current?.getContext('2d');if(!c||!image)return;let index=0;
  const draw=()=>{const cell=first+index%(last-first+1),sw=image.width/columns,sh=image.height/rows;c.clearRect(0,0,64,64);c.drawImage(image,cell%columns*sw,Math.floor(cell/columns)*sh,sw,sh,0,0,64,64);index++;};
  draw();const timer=setInterval(draw,160);return()=>clearInterval(timer);
 },[image,rows,columns,first,last]);
 const pick=cell=>{
  if(picking==='first'){update(part,new Uint32Array([cell,cell+1,values[2]??1]));setPicking('last');}
  else{const a=Math.min(first,cell),b=Math.max(first,cell);update(part,new Uint32Array([a,b+1,values[2]??1]));setPicking('first');}
 };
 const split=(r,c)=>{try{const result=particleGridChange(emitter,r,c);if(result.invalid.length)setPending({rows:r,columns:c});else{patch(result.values);setPending(null);setPicking('first');}}catch(error){setMessage(error.message);}};
 // Floats over the editor window, not inside the scrolling side panel.
 return createPortal(<section className="pe-frames-window" role="dialog" aria-label="Frames" onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();onClose();}}}>
  <div className="pe-frames-heading"><b>Frames</b><button aria-label="Close frames" onClick={onClose}>×</button></div>
  <div className="pe-frames-parts">{frameParts(emitter).map(([field,label])=><button key={field} aria-pressed={part===field} onClick={()=>{onPart(field);setPicking('first');}}>{label}</button>)}</div>
  <div className="pe-frames-body">
   <canvas ref={grid} width={SIZE} height={SIZE} aria-label="Frame grid" role="button" tabIndex={0} onClick={e=>{if(!drawable)return;const rect=e.currentTarget.getBoundingClientRect();pick(particleCellAt(e.clientX-rect.left,e.clientY-rect.top,rect.width,rect.height,rows,columns));}}/>
   <div className="pe-frames-side">
    <span className="pe-frames-hint" role="status">{cells===1?'Split the picture to make frames.':picking==='first'?'Click the first frame.':'Click the last frame.'}</span>
    <canvas ref={preview} width="64" height="64" aria-label="Frame preview"/>
    <span>Plays {first} → {last}</span>
    <label>Repeat ×<input type="number" aria-label="Frame repeats" min={1} max={99} value={Math.max(1,values[2]??1)} onChange={e=>{const n=Math.max(1,Math.min(99,Math.round(Number(e.target.value))||1));update(part,new Uint32Array([values[0],values[1],n]));}}/></label>
   </div>
  </div>
  <div className="pe-frames-split"><span>Split into</span>
   <label>rows <button aria-label="Remove picture row" disabled={rows<=1} onClick={()=>split(rows-1,columns)}>−</button><output>{rows}</output><button aria-label="Add picture row" onClick={()=>split(rows+1,columns)}>+</button></label>
   <label>columns <button aria-label="Remove picture column" disabled={columns<=1} onClick={()=>split(rows,columns-1)}>−</button><output>{columns}</output><button aria-label="Add picture column" onClick={()=>split(rows,columns+1)}>+</button></label>
  </div>
  {pending&&<div className="pe-grid-confirm" role="alert"><span>Some chosen frames would not fit the new split.</span><button onClick={()=>{patch(particleGridChange(emitter,pending.rows,pending.columns,{correct:true}).values);setPending(null);setPicking('first');}}>Split and fit them</button><button onClick={()=>setPending(null)}>Cancel</button></div>}
  {!drawable&&<small>Too many frames to show; use Adjust Manually.</small>}
  {message&&<small role="status">{message}</small>}
 </section>,document.querySelector('.pe-window')||document.body);
}
