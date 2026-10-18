import React,{useEffect,useRef,useState} from 'react';
import {particlePictureCanvas} from './particle-picture-canvas.js';
import {detectPictureGrid} from './sprite-detect.js';
import {framesAcrossLife,playedFrames,spriteGridValues} from '../src/sprite-frames.js';

const GRIDS=[[1,1],[2,2],[4,4],[8,8],[1,4],[1,8],[4,1],[8,1]];
const gridLabel=(rows,columns)=>rows*columns===1?'None':`${columns} × ${rows} (${rows*columns})`;

function Frame({image,rows,columns,cell,size}){
 const canvas=useRef(null);
 useEffect(()=>{const c=canvas.current?.getContext('2d');if(!c||!image)return;const sw=image.width/columns,sh=image.height/rows;c.clearRect(0,0,size,size);c.drawImage(image,cell%columns*sw,Math.floor(cell/columns)*sh,sw,sh,0,0,size,size);},[image,rows,columns,cell,size]);
 return <canvas ref={canvas} width={size} height={size}/>;
}

/**
 * Frames, only for sprite sheets: every frame in one row. Drag across the frames that should play;
 * they play once across the particle's life. A plain picture shows just the small Frames picker.
 */
export default function ParticleFrameStrip({emitter,asset,pictureName,replaceableId,teamColor,patch}){
 const [image,setImage]=useState(null),[detected,setDetected]=useState(null),[drag,setDrag]=useState(null),preview=useRef(null);
 const rows=Math.max(1,emitter.Rows||1),columns=Math.max(1,emitter.Columns||1),count=rows*columns,saved=playedFrames(emitter);
 const [first,last]=drag?[Math.min(drag.anchor,drag.at),Math.max(drag.anchor,drag.at)]:[saved.first,saved.last];
 useEffect(()=>{let live=true;setImage(null);particlePictureCanvas(asset,{replaceableId,teamColor}).then(source=>{if(live)setImage(source);}).catch(()=>{});detectPictureGrid(asset,{name:pictureName,replaceableId}).then(grid=>{if(live)setDetected(grid);}).catch(()=>{});return()=>{live=false;};},[asset,pictureName,replaceableId,teamColor]);
 useEffect(()=>{
  const c=preview.current?.getContext('2d');if(!c||!image||count<2)return;let index=0;
  const draw=()=>{const cell=first+index%(last-first+1),sw=image.width/columns,sh=image.height/rows;c.clearRect(0,0,48,48);c.drawImage(image,cell%columns*sw,Math.floor(cell/columns)*sh,sw,sh,0,0,48,48);index++;};
  draw();const timer=setInterval(draw,140);return()=>clearInterval(timer);
 },[image,rows,columns,first,last,count]);
 const options=[...GRIDS];for(const grid of [[rows,columns],detected&&[detected.rows,detected.columns]])if(grid&&!options.some(([r,c])=>r===grid[0]&&c===grid[1]))options.push(grid);
 const finish=()=>{if(!drag)return;const a=Math.min(drag.anchor,drag.at),b=Math.max(drag.anchor,drag.at);setDrag(null);if(a!==saved.first||b!==saved.last)patch(framesAcrossLife(emitter,a,b,saved.repeat));};
 return <div className="pe-frame-strip">
  <label className="pe-frame-grid-pick" title={detected&&detected.rows*detected.columns>1?`This picture looks like ${detected.rows*detected.columns} frames.`:'This picture looks like one plain picture.'}>Frames
   <select aria-label="Picture frames" value={rows+'x'+columns} onChange={e=>{const [r,c]=e.target.value.split('x').map(Number);patch(spriteGridValues(emitter,r,c));}}>
    {options.map(([r,c])=><option key={r+'x'+c} value={r+'x'+c}>{gridLabel(r,c)}{detected&&detected.rows===r&&detected.columns===c&&r*c>1?' · found':''}</option>)}
   </select></label>
  {count>1&&<div className="pe-frame-row">
   <canvas ref={preview} className="pe-frame-preview" width="48" height="48" aria-label="Frame preview"/>
   <div className="pe-frame-cells" role="listbox" aria-label="Frames that play" aria-multiselectable="true" onPointerUp={finish} onPointerLeave={finish}>
    {Array.from({length:Math.min(count,256)},(_,cell)=><div key={cell} role="option" aria-selected={cell>=first&&cell<=last} aria-label={'Frame '+cell} className={'pe-frame-cell'+(cell>=first&&cell<=last?' chosen':'')}
     onPointerDown={e=>{e.preventDefault();e.currentTarget.parentElement.releasePointerCapture?.(e.pointerId);setDrag({anchor:cell,at:cell});}} onPointerEnter={()=>setDrag(d=>d&&{...d,at:cell})}>
     <Frame image={image} rows={rows} columns={columns} cell={cell} size={36}/><span>{cell}</span></div>)}
   </div>
  </div>}
 </div>;
}
