import React,{useEffect,useRef,useState} from 'react';
import {particlePictureCanvas} from './particle-picture-canvas.js';
import {detectPictureGrid} from './sprite-detect.js';
import {framesAcrossLife,playedFrames,spriteGridValues,suggestedSetups,setupValues,setupLabel} from '../src/sprite-frames.js';

function Frame({image,rows,columns,cell,size}){
 const canvas=useRef(null);
 useEffect(()=>{const c=canvas.current?.getContext('2d');if(!c||!image)return;const sw=image.width/columns,sh=image.height/rows;c.clearRect(0,0,size,size);c.drawImage(image,cell%columns*sw,Math.floor(cell/columns)*sh,sw,sh,0,0,size,size);},[image,rows,columns,cell,size]);
 return <canvas ref={canvas} width={size} height={size}/>;
}

function Stepper({label,value,onChange}){
 return <label className="pe-frame-step">{label}<button aria-label={'Fewer '+label} disabled={value<=1} onClick={()=>onChange(value-1)}>−</button><output>{value}</output><button aria-label={'More '+label} disabled={value>=16} onClick={()=>onChange(value+1)}>+</button></label>;
}

/**
 * Frames of a sprite sheet. The game's own setups for this sheet are one click away; the grid and
 * the frames can also be set by hand: drag across the frames that should play.
 */
export default function ParticleFrameStrip({emitter,asset,pictureName,replaceableId,teamColor,patch,onImport}){
 const [image,setImage]=useState(null),[detected,setDetected]=useState(null),[drag,setDrag]=useState(null),preview=useRef(null);
 const rows=Math.max(1,emitter.Rows||1),columns=Math.max(1,emitter.Columns||1),count=rows*columns,saved=playedFrames(emitter);
 const [first,last]=drag?[Math.min(drag.anchor,drag.at),Math.max(drag.anchor,drag.at)]:[saved.first,saved.last];
 const suggestions=suggestedSetups(pictureName);
 useEffect(()=>{let live=true;setImage(null);setDetected(null);particlePictureCanvas(asset,{replaceableId,teamColor}).then(source=>{if(live)setImage(source);}).catch(()=>{});if(!suggestions.length)detectPictureGrid(asset,{name:pictureName,replaceableId}).then(grid=>{if(live)setDetected(grid);}).catch(()=>{});return()=>{live=false;};},[asset,pictureName,replaceableId,teamColor]);
 useEffect(()=>{
  const c=preview.current?.getContext('2d');if(!c||!image||count<2)return;let index=0;
  const draw=()=>{const cell=first+index%(last-first+1),sw=image.width/columns,sh=image.height/rows;c.clearRect(0,0,48,48);c.drawImage(image,cell%columns*sw,Math.floor(cell/columns)*sh,sw,sh,0,0,48,48);index++;};
  draw();const timer=setInterval(draw,140);return()=>clearInterval(timer);
 },[image,rows,columns,first,last,count]);
 const finish=()=>{if(!drag)return;const a=Math.min(drag.anchor,drag.at),b=Math.max(drag.anchor,drag.at);setDrag(null);if(a!==saved.first||b!==saved.last)patch(framesAcrossLife(emitter,a,b,saved.repeat));};
 const grid=(r,c)=>patch(spriteGridValues(emitter,r,c));
 const sheet=suggestions.length>0||count>1||(detected&&detected.rows*detected.columns>1);
 return <div className="pe-frame-strip">
  <div className="pe-frame-heading"><b>Frames</b>{!sheet&&<span>One picture. If it holds several frames, set its grid.</span>}</div>
  {suggestions.length>0&&<div className="pe-frame-suggestions" aria-label="Suggested frames">{suggestions.map((setup,i)=><button key={i} aria-pressed={setup.rows===rows&&setup.columns===columns&&String(setup.life)===String(Array.from(emitter.LifeSpanUVAnim||[]))&&String(setup.decay)===String(Array.from(emitter.DecayUVAnim||[]))}
   title={'Used this way by '+setup.uses+' game effect'+(setup.uses===1?'':'s')+(setup.examples.length?', for example '+setup.examples.join(', '):'')+'.'} onClick={()=>patch(setupValues(setup))}>{setupLabel(setup)}</button>)}</div>}
  {!suggestions.length&&detected&&detected.rows*detected.columns>1&&(detected.rows!==rows||detected.columns!==columns)&&<button className="pe-frame-found" onClick={()=>grid(detected.rows,detected.columns)}>Use the {detected.rows*detected.columns} frames found in this picture</button>}
  {<div className="pe-frame-grid"><span>Grid</span><Stepper label="rows" value={rows} onChange={r=>grid(r,columns)}/><Stepper label="columns" value={columns} onChange={c=>grid(rows,c)}/></div>}
  {count>1&&<div className="pe-frame-row">
   <canvas ref={preview} className="pe-frame-preview" width="48" height="48" aria-label="Frame preview"/>
   <div className="pe-frame-cells" role="listbox" aria-label="Frames that play" aria-multiselectable="true" onPointerUp={finish} onPointerLeave={finish}>
    {Array.from({length:Math.min(count,256)},(_,cell)=><div key={cell} role="option" aria-selected={cell>=first&&cell<=last} aria-label={'Frame '+cell} className={'pe-frame-cell'+(cell>=first&&cell<=last?' chosen':'')}
     onPointerDown={e=>{e.preventDefault();setDrag({anchor:cell,at:cell});}} onPointerEnter={()=>setDrag(d=>d&&{...d,at:cell})}>
     <Frame image={image} rows={rows} columns={columns} cell={cell} size={36}/><span>{cell}</span></div>)}
   </div>
  </div>}
  {count>1&&<small className="pe-frame-hint">Drag across the frames that should play. They play once over the particle's life.</small>}
  <button className="pe-frame-load" onClick={onImport} title="Load your own sprite sheet (.blp, .dds or .tga). Its frames are set up automatically.">Load own sprite sheet…</button>
 </div>;
}
