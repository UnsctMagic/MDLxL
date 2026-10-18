import React,{useEffect,useRef,useState} from 'react';
import {particleBlendNames,particlePictureShared} from '../src/particle-picture.js';
import {particlePictureCanvas} from './particle-picture-canvas.js';
import ParticleBlendComparisons from './ParticleBlendComparisons.jsx';
const key=path=>String(path||'').replaceAll('/','\\').toLowerCase();
function PictureTile({asset,replaceableId,teamColor,label,selected,onClick}){
 const canvas=useRef(null),[missing,setMissing]=useState(false);
 useEffect(()=>{let live=true;setMissing(false);particlePictureCanvas(asset,{replaceableId,teamColor}).then(image=>{if(live){const c=canvas.current.getContext('2d');c.clearRect(0,0,48,48);c.drawImage(image,0,0,48,48);}}).catch(()=>{if(live)setMissing(true);});return()=>{live=false;};},[asset,replaceableId,teamColor]);
 return <button className="pe-picture-tile" onClick={onClick} aria-pressed={selected} aria-label={label}><canvas ref={canvas} width="48" height="48"/><span>{missing?'Missing picture':label}</span></button>;
}
/** The picture once, small. Frames sit right below it, only for sprite sheets. */
export default function ParticlePictureTool({model,emitter,assets,preferences,teamColor,sequence,frame,update,onImport,onLibrary,onChoosePicture,onRemovePicture,onTeamPicture,onDemo,demo}){
 const [compare,setCompare]=useState(null),[pictureLimit,setPictureLimit]=useState(64);
 return <div className="pe-picture-tool">
  <div className="pe-picture-choices">{model.Textures.slice(0,pictureLimit).map((t,i)=>{const label=t.ReplaceableId===1?'Team color':t.ReplaceableId===2?'Team glow':t.ReplaceableId?'Team picture '+t.ReplaceableId:'Picture '+(i+1),shared=particlePictureShared(model,emitter,i);return <div className="pe-picture-choice" key={i}><PictureTile asset={assets.get(key(t.Image))} replaceableId={t.ReplaceableId} teamColor={teamColor} label={label} selected={i===emitter.TextureID} onClick={()=>onChoosePicture(i)}/><button className="pe-picture-remove" aria-label={'Remove '+label.toLowerCase()+' picture'} title={shared?'Also used by another emitter or material':'Remove picture'} disabled={shared} onClick={()=>onRemovePicture(i)}>×</button></div>;})}</div>{model.Textures.length>pictureLimit&&<button onClick={()=>setPictureLimit(n=>n+64)}>More pictures</button>}<div className="pe-picture-actions"><button onClick={onLibrary}>Library…</button><button onClick={onImport}>Load picture…</button><button onClick={()=>onTeamPicture(1)}>Team color</button><button onClick={()=>onTeamPicture(2)}>Team glow</button></div>
  <label>Draw as<select aria-label="Draw as" value={emitter.FrameFlags} onChange={e=>update('FrameFlags',Number(e.target.value))}><option value={1}>Sprites</option><option value={2}>Streaks</option><option value={3}>Both</option></select></label>
  <label>Blend look<select aria-label="Blend look" value={emitter.FilterMode} onChange={e=>update('FilterMode',Number(e.target.value))}>{particleBlendNames.map((name,i)=><option key={name} value={i}>{name}</option>)}</select></label><button onClick={()=>setCompare({source:structuredClone(model),sequence,time:frame})}>Compare blend looks</button>
  {compare&&<ParticleBlendComparisons {...compare} id={emitter.ObjectId} {...{assets,preferences}} onChoose={value=>{update('FilterMode',value);setCompare(null);}} onClose={()=>setCompare(null)}/>}
  <details><summary>Orientation and draw options</summary><div className="pe-timing-mode"><button aria-pressed={!(emitter.Flags&1048576)} onClick={()=>update('Flags',emitter.Flags&~1048576)}>Face camera</button><button aria-pressed={!!(emitter.Flags&1048576)} onClick={()=>update('Flags',emitter.Flags|1048576)}>Flat</button></div>{onDemo&&<button aria-pressed={demo} onClick={()=>onDemo(!demo)}>Demonstration motion</button>}{[['Keep brightness',32768],['Ignore fog',262144],['Sort distant particles',65536]].map(([name,bit])=><button key={bit} aria-pressed={!!(emitter.Flags&bit)} onClick={()=>update('Flags',emitter.Flags^bit)}>{name}</button>)}</details>
 </div>;
}
