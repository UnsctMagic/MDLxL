import React,{useEffect,useRef,useState} from 'react';
import {particlePictureCanvas} from './particle-picture-canvas.js';
import {detectPictureGrid} from './sprite-detect.js';
import {framesAcrossLife,playedFrames,spriteGridValues,framePatterns,playsPattern} from '../src/sprite-frames.js';

function Frame({image,rows,columns,cell,size}){
 const canvas=useRef(null);
 useEffect(()=>{const c=canvas.current?.getContext('2d');if(!c||!image)return;const sw=image.width/columns,sh=image.height/rows;c.clearRect(0,0,size,size);c.drawImage(image,cell%columns*sw,Math.floor(cell/columns)*sh,sw,sh,0,0,size,size);},[image,rows,columns,cell,size]);
 return <canvas ref={canvas} width={size} height={size}/>;
}

function Stepper({label,value,onChange}){
 return <label className="pe-frame-step">{label}<button aria-label={'Fewer '+label} disabled={value<=1} onClick={()=>onChange(value-1)}>−</button><output>{value}</output><button aria-label={'More '+label} disabled={value>=16} onClick={()=>onChange(value+1)}>+</button></label>;
}

/** Frames: one choice and the sprite playing it. Custom… is the only way into the grid and frame picking. */
export default function ParticleFrameStrip({emitter,asset,pictureName,replaceableId,teamColor,patch}){
 const [image,setImage]=useState(null),[detected,setDetected]=useState(null),[drag,setDrag]=useState(null),[custom,setCustom]=useState(false),preview=useRef(null);
 const rows=Math.max(1,emitter.Rows||1),columns=Math.max(1,emitter.Columns||1),count=rows*columns,saved=playedFrames(emitter);
 const [first,last]=drag?[Math.min(drag.anchor,drag.at),Math.max(drag.anchor,drag.at)]:[saved.first,saved.last];
 const game=framePatterns(pictureName);
 useEffect(()=>{let live=true;setImage(null);setDetected(null);particlePictureCanvas(asset,{replaceableId,teamColor}).then(source=>{if(live)setImage(source);}).catch(()=>{});if(!game.length)detectPictureGrid(asset,{name:pictureName,replaceableId}).then(grid=>{if(live)setDetected(grid);}).catch(()=>{});return()=>{live=false;};},[asset,pictureName,replaceableId,teamColor]);
 useEffect(()=>{
  const c=preview.current?.getContext('2d');if(!c||!image||count<2)return;let index=0;
  const draw=()=>{const cell=first+index%(last-first+1),sw=image.width/columns,sh=image.height/rows;c.clearRect(0,0,40,40);c.drawImage(image,cell%columns*sw,Math.floor(cell/columns)*sh,sw,sh,0,0,40,40);index++;};
  draw();const timer=setInterval(draw,120);return()=>clearInterval(timer);
 },[image,rows,columns,first,last,count]);
 const patterns=game.length?game:[{name:'One picture',values:spriteGridValues(emitter,1,1)},...(detected&&detected.rows*detected.columns>1?[{name:'Whole animation',values:spriteGridValues(emitter,detected.rows,detected.columns)}]:[])];
 const current=patterns.find(pattern=>playsPattern(emitter,pattern.values))?.name||(count===1&&!game.length?'One picture':'Custom…');
 const showCustom=custom||current==='Custom…';
 const finish=()=>{if(!drag)return;const a=Math.min(drag.anchor,drag.at),b=Math.max(drag.anchor,drag.at);setDrag(null);if(a!==saved.first||b!==saved.last)patch(framesAcrossLife(emitter,a,b,saved.repeat));};
 return <div className="pe-frame-strip">
  <div className="pe-frame-pick">
   <label>Frames<select aria-label="Frames" value={showCustom?'Custom…':current} onChange={e=>{const pick=patterns.find(p=>p.name===e.target.value);if(pick){setCustom(false);patch(pick.values);}else setCustom(true);}}>
    {patterns.map(pattern=><option key={pattern.name}>{pattern.name}</option>)}<option>Custom…</option>
   </select></label>
   {count>1&&<canvas ref={preview} className="pe-frame-preview" width="40" height="40" aria-label="Frame preview"/>}
  </div>
  {showCustom&&<>
   <div className="pe-frame-grid"><Stepper label="rows" value={rows} onChange={r=>patch(spriteGridValues(emitter,r,columns))}/><Stepper label="columns" value={columns} onChange={c=>patch(spriteGridValues(emitter,rows,c))}/></div>
   {count>1&&<div className="pe-frame-cells" role="listbox" aria-label="Frames that play" aria-multiselectable="true" onPointerUp={finish} onPointerLeave={finish}>
    {Array.from({length:Math.min(count,256)},(_,cell)=><div key={cell} role="option" aria-selected={cell>=first&&cell<=last} aria-label={'Frame '+cell} className={'pe-frame-cell'+(cell>=first&&cell<=last?' chosen':'')}
     onPointerDown={e=>{e.preventDefault();setDrag({anchor:cell,at:cell});}} onPointerEnter={()=>setDrag(d=>d&&{...d,at:cell})}><Frame image={image} rows={rows} columns={columns} cell={cell} size={36}/></div>)}
   </div>}
  </>}
 </div>;
}
