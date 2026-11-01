import React,{useEffect,useState} from 'react';
import {Matrix3} from 'three';
import {Tool} from './EditorControls.jsx';
import {decodeTextureThumbnail} from '../src/texture-thumbnail.js';
import UVEditor from './UVEditor.jsx';

// The mesh is the fitted layer's real UV map. Only the layer settings change on release.
export default function GlobalTextureFit({geoset,asset,canScale,layer,preferences,change}){
 const [mode,setMode]=useState(layer.glyphs?'move':null),[texture,setTexture]=useState(null),[error,setError]=useState(false);
 const visible=!!mode;
 useEffect(()=>{
  let active=true;setTexture(null);setError(false);
  if(visible&&asset)decodeTextureThumbnail(asset,512).then(url=>{if(active)setTexture(url);},()=>{if(active)setError(true);});
  return ()=>{active=false;};
 },[asset,visible]);
 const uv=geoset?.TVertices[0];
 if(!uv?.length)return null;
 const vertices=Array.from({length:uv.length/2},(_,i)=>i);
 const commit=next=>{
  let far=0,distance=0;
  for(let i=2;i<uv.length;i+=2){
   const d=Math.hypot(uv[i]-uv[0],uv[i+1]-uv[1]);
   if(d>distance){far=i;distance=d;}
  }
  if(layer.glyphs){
   // Store the editor's exact affine gesture, including its centre and texture aspect.
   const u=uv[far]-uv[0],v=uv[far+1]-uv[1];let third=0,area=0;
   for(let i=2;i<uv.length;i+=2){const a=Math.abs(u*(uv[i+1]-uv[1])-v*(uv[i]-uv[0]));if(a>area){third=i;area=a;}}
   const matrix=layer.uvMatrix?new Matrix3().fromArray([layer.uvMatrix[0],layer.uvMatrix[1],0,layer.uvMatrix[2],layer.uvMatrix[3],0,layer.uvMatrix[4],layer.uvMatrix[5],1]):new Matrix3();
   if(mode==='move')matrix.premultiply(new Matrix3().makeTranslation(next[0]-uv[0],next[1]-uv[1]));
   else if(area>1e-8){
    const points=data=>new Matrix3().set(data[0],data[far],data[third],data[1],data[far+1],data[third+1],1,1,1);
    const transform=points(next).multiply(points(uv).invert());if(Math.abs(transform.determinant())<1e-6)return;
    matrix.premultiply(transform);
   }else return;
   const e=matrix.elements;change('uvMatrix',[e[0],e[1],e[3],e[4],e[6],e[7]]);return;
  }
  if(!distance)return;
  const x=next[far]-next[0],y=next[far+1]-next[1];
  if(mode==='scale')change('tiling',Math.min(4,Math.max(1,Math.round(100*layer.tiling*Math.hypot(x,y)/distance)/100)));
  if(mode==='rotate'){
   const turn=Math.atan2(y,x)-Math.atan2(uv[far+1]-uv[1],uv[far]-uv[0]);
   change('direction',((Math.round(layer.direction-turn*180/Math.PI)%360)+360)%360);
  }
 };
 const tools=[...(layer.glyphs?[['move','sb_move','Move']]:[]),['rotate','sb_rot','Rotate'],...(canScale?[['scale','sb_zoom','Scale']]:[])];
 return <div className="fx-uv-fit"><div className="classic-toolbar-group">{tools.map(([action,icon,title])=><Tool key={action} action={action==='move'?'translate':action} look icon={icon} title={title+' UVs'} active={mode===action} onClick={()=>setMode(mode===action&&!layer.glyphs?null:action)}/>)}</div>
 {mode&&<div className="fx-uv-canvas"><UVEditor geoset={geoset} selectedVertices={vertices} textureUrl={texture} fitUVs={!!layer.glyphs} showVertices={!layer.glyphs} showSelectedVertices={!layer.glyphs} transformMode={mode} preferences={preferences} onChange={commit}/>{error&&<span role="status">Texture unavailable.</span>}</div>}</div>;
}
