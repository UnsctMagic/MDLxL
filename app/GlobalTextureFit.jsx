import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Matrix3} from 'three';
import {useHotkeys,useWindowKeyClaim} from './Hotkeys.jsx';
import {chordFromEvent,isTypingTarget} from '../src/preferences.js';
import {Tool} from './EditorControls.jsx';
import {decodeTextureThumbnail} from '../src/texture-thumbnail.js';
import UVEditor from './UVEditor.jsx';

// The texture area of an atlas layer, drawn as one rectangle over the whole picture.
function areaGeoset([x,y,w,h]){
 return {Vertices:new Float32Array(12),Faces:Uint16Array.from([0,1,2,0,2,3]),TVertices:[Float32Array.from([x,y,x+w,y,x+w,y+h,x,y+h])]};
}
// The mesh is the fitted layer's real UV map. Only the layer settings change on release.
// With area, Move and Scale edit that rectangle of the picture instead.
export default function GlobalTextureFit({geoset,asset,canScale,layer,preferences,change,area,onArea,onGlyph}){
 const [mode,setMode]=useState(layer.glyphs?'move':null),[texture,setTexture]=useState(null),[error,setError]=useState(false);
 const fit=useRef(null);
 const {shortcuts}=useHotkeys();
 useWindowKeyClaim(({event,localWindow})=>{
  if(localWindow!==fit.current?.closest('[role="dialog"]')||isTypingTarget(event.target))return false;
  // Move, Rotate and Resize on the user's own keys.
  const chord=chordFromEvent(event),tool=[['translate','move'],['rotate','rotate'],['scale','scale']].find(([id])=>shortcuts[id]?.includes(chord)&&!(area&&id==='rotate'));
  if(!tool)return false;
  setMode(tool[1]);window.dispatchEvent(new CustomEvent('mdlxl-hotkey-used',{detail:{id:tool[0],chord,event}}));return true;
 },5);
 const visible=!!mode;
 useEffect(()=>{
  let active=true;setTexture(null);setError(false);
  if(visible&&asset)decodeTextureThumbnail(asset,512).then(url=>{if(active)setTexture(url);},()=>{if(active)setError(true);});
  return ()=>{active=false;};
 },[asset,visible]);
 const rect=useMemo(()=>area?areaGeoset(area):null,[area?.join(',')]);
 const shown=rect||geoset,uv=shown?.TVertices[0];
 if(!uv?.length)return null;
 const vertices=Array.from({length:uv.length/2},(_,i)=>i);
 const commit=next=>{
  if(rect){
   let minU=Infinity,minV=Infinity,maxU=-Infinity,maxV=-Infinity;
   for(let i=0;i<next.length;i+=2){minU=Math.min(minU,next[i]);maxU=Math.max(maxU,next[i]);minV=Math.min(minV,next[i+1]);maxV=Math.max(maxV,next[i+1]);}
   // Move keeps the area's size and stops at the picture's edge; Scale trims what leaves the picture.
   const moved=mode==='move',x=moved?Math.min(Math.max(0,minU),1-area[2]):Math.max(0,minU),y=moved?Math.min(Math.max(0,minV),1-area[3]):Math.max(0,minV),w=moved?area[2]:Math.min(1,maxU)-x,h=moved?area[3]:Math.min(1,maxV)-y;
   if(w>.002&&h>.002)onArea([x,y,w,h].map(v=>Math.round(v*1e4)/1e4));
   return;
  }
  let far=0,distance=0;
  for(let i=2;i<uv.length;i+=2){
   const d=Math.hypot(uv[i]-uv[0],uv[i+1]-uv[1]);
   if(d>distance){far=i;distance=d;}
  }
  if(layer.glyphs||mode==='move'||(mode==='scale'&&!canScale)){
   // Store the editor's exact affine gesture, including its centre and texture aspect.
   const u=uv[far]-uv[0],v=uv[far+1]-uv[1];let third=0,area=0;
   for(let i=2;i<uv.length;i+=2){const a=Math.abs(u*(uv[i+1]-uv[1])-v*(uv[i]-uv[0]));if(a>area){third=i;area=a;}}
   let gesture;
   if(mode==='move')gesture=new Matrix3().makeTranslation(next[0]-uv[0],next[1]-uv[1]);
   else if(area>1e-8){
    const points=data=>new Matrix3().set(data[0],data[far],data[third],data[1],data[far+1],data[third+1],1,1,1);
    gesture=points(next).multiply(points(uv).invert());if(Math.abs(gesture.determinant())<1e-6)return;
   }else return;
   const affine=m=>{const e=m.elements;return [e[0],e[1],e[3],e[4],e[6],e[7]];};
   // Runes keep one source of truth: the gesture becomes their Size, Turn, Slide and Across.
   if(onGlyph){onGlyph(affine(gesture));return;}
   const matrix=layer.uvMatrix?new Matrix3().fromArray([layer.uvMatrix[0],layer.uvMatrix[1],0,layer.uvMatrix[2],layer.uvMatrix[3],0,layer.uvMatrix[4],layer.uvMatrix[5],1]):new Matrix3();
   change('uvMatrix',affine(matrix.premultiply(gesture)));return;
  }
  if(!distance)return;
  const x=next[far]-next[0],y=next[far+1]-next[1];
  if(mode==='scale')change('tiling',Math.min(4,Math.max(1,Math.round(100*layer.tiling*Math.hypot(x,y)/distance)/100)));
  if(mode==='rotate'){
   const turn=Math.atan2(y,x)-Math.atan2(uv[far+1]-uv[1],uv[far]-uv[0]);
   change('direction',((Math.round(layer.direction-turn*180/Math.PI)%360)+360)%360);
  }
 };
 const tools=[['move','sb_move','Move'],['rotate','sb_rot','Rotate'],['scale','sb_zoom','Scale']].filter(([action])=>!(rect&&action==='rotate'));
 return <div className="fx-uv-fit" ref={fit}><div className="classic-toolbar-group">{tools.map(([action,icon,title])=><Tool key={action} action={action==='move'?'translate':action} look icon={icon} title={title+(rect?' area':' UVs')} active={mode===action} onClick={()=>setMode(mode===action&&!layer.glyphs?null:action)}/>)}</div>
 {mode&&<div className="fx-uv-canvas"><UVEditor geoset={shown} selectedVertices={vertices} textureUrl={texture} textureWrapping={!rect} fitUVs={!!layer.glyphs} showVertices={!layer.glyphs} showSelectedVertices={!layer.glyphs} transformMode={mode} preferences={preferences} onChange={commit}/>{error&&<span role="status">Texture unavailable.</span>}</div>}</div>;
}
