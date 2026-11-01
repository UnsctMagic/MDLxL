import React,{useState} from 'react';
import UVEditor from './UVEditor.jsx';

// The mesh is the fitted layer's real UV map. Only the layer settings change on release.
export default function GlobalTextureFit({geoset,canScale,layer,preferences,change}){
 const [mode,setMode]=useState(null);
 const uv=geoset?.TVertices[0];
 if(!uv?.length)return null;
 const vertices=Array.from({length:uv.length/2},(_,i)=>i);
 const commit=next=>{
  let far=0,distance=0;
  for(let i=2;i<uv.length;i+=2){
   const d=Math.hypot(uv[i]-uv[0],uv[i+1]-uv[1]);
   if(d>distance){far=i;distance=d;}
  }
  if(mode==='move'){change('uvOffset',[(layer.uvOffset?.[0]||0)+next[0]-uv[0],(layer.uvOffset?.[1]||0)+next[1]-uv[1]]);return;}
  if(!distance)return;
  const x=next[far]-next[0],y=next[far+1]-next[1];
  if(mode==='scale')change('tiling',Math.min(4,Math.max(1,Math.round(100*layer.tiling*Math.hypot(x,y)/distance)/100)));
  if(mode==='rotate'){
   const turn=Math.atan2(y,x)-Math.atan2(uv[far+1]-uv[1],uv[far]-uv[0]);
   change('direction',((Math.round(layer.direction-turn*180/Math.PI)%360)+360)%360);
  }
 };
 return <><div className="fx-layer-actions">{[...(layer.glyphs?[['move','Move']]:[]),['rotate','Rotate'],...(canScale?[['scale','Scale']]:[])].map(([action,title])=><button key={action} aria-pressed={mode===action} title={action==='move'?"Drag the UV map to position the runes.":action==='rotate'?'Drag around the UV map to turn texture motion.':'Drag sideways on the UV map to change tiling.'} onClick={()=>setMode(mode===action?null:action)}>{title} UVs</button>)}</div>
 {mode&&<div style={{height:180}}><UVEditor geoset={geoset} selectedVertices={vertices} transformMode={mode} preferences={preferences} showTextureFrame onChange={commit}/></div>}</>;
}
