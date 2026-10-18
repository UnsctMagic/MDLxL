import ParticleLifeMarker from './ParticleLifeMarker.jsx';
import ParticleTimingTool from './ParticleTimingTool.jsx';
import ParticlePictureTool from './ParticlePictureTool.jsx';
import ParticleFrameStrip from './ParticleFrameStrip.jsx';
import React,{useEffect,useRef,useState} from 'react';
import {particleBindings,particleSliderDomain,particleValue,primaryParticleFields} from '../src/particle-bindings.js';
const stageNames=['Born','Halfway','End'];
const colorHex=rgb=>'#'+Array.from(rgb||[1,1,1],v=>Math.round(Math.max(0,Math.min(1,v))*255).toString(16).padStart(2,'0')).join('');
export function ParticleSlider({label,field,value,begin,change,finish,cancel,stage,disabled=false,min,max,step='any'}) {
  const down=useRef(false),editing=useRef(false),domain=particleSliderDomain(field,value),name=label||particleBindings[field]?.label||field;
  const shown=Number.isFinite(value)?String(Number(value.toPrecision(7))):'0', [number,setNumber]=useState(shown);
  useEffect(()=>{if(!editing.current)setNumber(shown);},[shown]);
  const start=()=>{if(!down.current){down.current=true;begin(field,stage);}};
  const end=()=>{if(down.current){down.current=false;finish();}};
  return <div className="pe-slider"><span>{name}</span><div className="pe-slider-value"><input type="range" aria-label={name} title={particleBindings[field]?.units} disabled={disabled} min={Math.min(min??domain[0],value)} max={Math.max(max??domain[1],value)} step={step} value={Number.isFinite(value)?value:0} onPointerDown={e=>{e.currentTarget.focus();start();e.currentTarget.setPointerCapture(e.pointerId);}} onChange={e=>{start();change(Number(e.target.value));}} onPointerUp={end} onPointerCancel={()=>{down.current=false;cancel();}} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();down.current=false;cancel();}else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(e.key))start();}} onKeyUp={end} onBlur={end}/><input type="number" aria-label={name+' value'} title={particleBindings[field]?.units} disabled={disabled} step={step} value={number} onFocus={()=>{editing.current=true;}} onChange={e=>{setNumber(e.target.value);if(e.target.value!==''&&Number.isFinite(Number(e.target.value))){start();change(Number(e.target.value));}}} onBlur={()=>{editing.current=false;end();setNumber(shown);}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur();}if(e.key==='Escape'){e.preventDefault();e.stopPropagation();down.current=false;cancel();editing.current=false;setNumber(shown);e.currentTarget.blur();}}}/></div></div>;
}
/** One column per moment of a particle's life; every value is typed or picked directly. */
function LifeTable({emitter,lifeStage,setLifeStage,begin,change,finish,cancel}){
  const gesture=useRef(false),[draft,setDraft]=useState({});
  const start=(field,stage)=>{if(!gesture.current){gesture.current=true;begin(field,stage);}};
  const end=()=>{if(gesture.current){gesture.current=false;finish();}};
  const commit=(field,stage,value)=>{start(field,stage);change(value);end();};
  const number=(key,label,value,field,stage,toValue,min,max)=>{const shown=draft[key]??String(value);const done=()=>{const n=Number(draft[key]);setDraft(d=>({...d,[key]:undefined}));if(draft[key]!=null&&draft[key]!==''&&Number.isFinite(n)&&n!==value)commit(field,stage,toValue(Math.max(min,Math.min(max,n))));};
    return <input type="number" aria-label={label} min={min} max={max} value={shown} onFocus={()=>setLifeStage(stage)} onChange={e=>setDraft(d=>({...d,[key]:e.target.value}))} onBlur={done} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();if(e.key==='Escape'){e.stopPropagation();setDraft(d=>({...d,[key]:undefined}));}}}/>;};
  return <table className="pe-life-table"><colgroup><col className="pe-life-label"/><col/><col/><col/></colgroup><thead><tr><th>Over its life</th>{stageNames.map((name,i)=><th key={name}><button aria-pressed={lifeStage===i} title="Show this moment's size handles in the preview" onClick={()=>setLifeStage(i)}>{name}</button></th>)}</tr></thead>
    <tbody>
      <tr><th>Color</th>{[0,1,2].map(i=><td key={i}><input type="color" aria-label={stageNames[i]+' color'} value={colorHex(emitter.SegmentColor?.[i])} onPointerDown={()=>{setLifeStage(i);start('SegmentColor',i);}} onChange={e=>{start('SegmentColor',i);change([1,3,5].map(k=>parseInt(e.target.value.slice(k,k+2),16)/255));}} onBlur={end} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();gesture.current=false;cancel();}}}/></td>)}</tr>
      <tr><th>Size</th>{[0,1,2].map(i=><td key={i}>{number('size'+i,stageNames[i]+' size',Number((emitter.ParticleScaling?.[i]||0).toFixed(2)),'ParticleScaling',i,v=>v,0,10000)}</td>)}</tr>
      <tr><th>See-through %</th>{[0,1,2].map(i=><td key={i}>{number('alpha'+i,stageNames[i]+' see-through',Math.round((1-(emitter.Alpha?.[i]??255)/255)*100),'Alpha',i,v=>Math.round(255*(1-v/100)),0,100)}</td>)}</tr>
    </tbody></table>;
}
export default function ParticleCluelessControls({model,emitter,frame,globalTime,sequence,tool,scope,setScope,asset,assets,preferences,teamColor,update,patch,onImport,onLibrary,onChoosePicture,onRemovePicture,onTeamPicture,onDemo,demo,begin,change,finish,cancel,lifeStage=1,setLifeStage,onSeek}) {
  const options={frame,globalTime,interval:model.Sequences[sequence]?.Interval,globalSequences:model.GlobalSequences};
  const slider=field=><ParticleSlider key={field} field={field} label={field==='EmissionRate'&&emitter.Squirt?'Burst amount':undefined} value={particleValue(emitter,field,options)} {...{begin,change,finish,cancel}}/>;
  // Two tabs, every field once. On/off timing lives on the play track; text editing is Adjust Manually.
  return <div className="pe-clueless-controls">
    {tool==='Look'&&<><ParticlePictureTool {...{model,emitter,assets,preferences,teamColor,sequence,frame,update,onImport,onLibrary,onChoosePicture,onRemovePicture,onTeamPicture,onDemo,demo}}/>
      <ParticleFrameStrip {...{emitter,asset,teamColor,patch}} pictureName={model.Textures[emitter.TextureID]?.Image} replaceableId={emitter.ReplaceableId||model.Textures[emitter.TextureID]?.ReplaceableId||0}/>
      <LifeTable {...{emitter,lifeStage,setLifeStage,begin,change,finish,cancel}}/>
      <ParticleLifeMarker value={emitter.Time} {...{begin,change,finish,cancel}} onSelect={setLifeStage}/></>}
    {tool==='Motion'&&<><ParticleTimingTool {...{emitter,options,begin,change,finish,cancel,update,patch,onSeek}}/>
      {['Speed','Variation','Latitude','Gravity','LifeSpan','Width','Length'].map(slider)}
      {[0,1,2].map(axis=><ParticleSlider key={'aim'+axis} label={'Aim '+['X','Y','Z'][axis]} field="Rotation" stage={{axis}} value={particleValue(emitter,'Rotation',{...options,axis})} {...{begin,change,finish,cancel}}/>)}
      {(emitter.FrameFlags&2)?slider('TailLength'):null}</>}
  </div>;
}
