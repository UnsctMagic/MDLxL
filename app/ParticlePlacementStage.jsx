import {useWindowKeyClaim} from './Hotkeys.jsx';
import React,{Suspense,lazy,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {createFrameCoalescer} from './viewport-performance.js';
import {placeTimedParticleRecipe} from '../src/particle-placement.js';
import ParticleStageHandle from './ParticleStageHandle.jsx';
const GamePreview=lazy(()=>import('./GamePreview.jsx'));
export default function ParticlePlacementStage({doc,recipe,placement,onPosition,onSurface,textureAssets,preferences,teamColor,onError}){
 const [snapshot,setSnapshot]=useState(null),[surface,setSurface]=useState(false),[time,setTime]=useState(0),[playing,setPlaying]=useState(true),drag=useRef(null),follow=useRef(null),frame=useRef(null),shown=useRef(null);
 follow.current=()=>{const d=drag.current;if(d?.next)onPosition(d.next);};
 frame.current||=createFrameCoalescer(()=>follow.current());
 useEffect(()=>()=>frame.current.cancel(),[]);
 const ready=useCallback(api=>{frame.current.cancel();if(api)frame.current=createFrameCoalescer(()=>follow.current(),api.frames);},[]);
 const stop=()=>{frame.current.flush();drag.current=null;};
 const abort=()=>{frame.current.cancel();if(drag.current)onPosition(drag.current.position);drag.current=null;};
 useWindowKeyClaim(({event})=>{if(event.key!=='Escape'||!drag.current)return false;abort();return true;},0);
 const graph=useMemo(()=>{
  try{const model=structuredClone(doc.model),inserted=placeTimedParticleRecipe(model,recipe,placement,{preview:true,convertHD:true}),anchor=model.Nodes[inserted.anchorId];
   return {model,...inserted,position:[...placement.position],translation:structuredClone(anchor?.Translation)};
  }catch(error){return {error:error.message};}
 },[doc,doc.revision,recipe,placement.parent,placement.sequence,placement.fit,placement.motion,placement.sequences]);
 if(graph.model)shown.current=graph;
 const visible=shown.current;
 useEffect(()=>{onError?.(graph.error||'');if(graph.interval){setTime(graph.interval[0]);setPlaying(true);}},[graph,onError]);
 if(visible&&!placement.ribbon){
  const anchor=visible.model.Nodes[visible.anchorId],delta=placement.position.map((value,axis)=>value-visible.position[axis]);
  anchor.Translation=structuredClone(visible.translation);
  for(const key of anchor.Translation.Keys)key.Vector=new Float32Array(Array.from(key.Vector,(value,axis)=>value+delta[axis]));
 }
 return <>
 <Suspense fallback={<span>Preparing placement…</span>}><GamePreview presentation="preview" preserveCameraView model={visible?.model||doc.model} particleAuthoring particleLiveModel={visible?.model||doc.model} particleLiveRevision={placement.position.join(':')} particleSelectedId={visible?.ids[0]} particleAnchorId={visible?.anchorId} onCaptureReady={ready} onParticleStage={setSnapshot} onParticleSurfacePlace={surface?(point,hit)=>{onSurface(hit);setSurface(false);}:undefined} textureAssets={textureAssets} preferences={preferences} teamColor={teamColor} sequenceIndex={doc.model.Sequences.length?placement.sequence:-1} time={time} onTimeChange={setTime} playing={playing} playbackSpeed={50} showParticles showGrid mode="textured" view="perspective" overlays={{bones:false,nodes:false,particles:false,attachments:false}}/></Suspense>
 {!placement.ribbon&&snapshot?.anchor&&<svg className="pe-stage-tools" viewBox={'0 0 '+snapshot.width+' '+snapshot.height} aria-label="Effect placement handles"><ParticleStageHandle point={snapshot.anchor.point} label="Move emitter" onPointerDown={e=>{e.preventDefault();e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);e.currentTarget.focus();setPlaying(false);drag.current={x:e.clientX,y:e.clientY,position:[...placement.position],basis:structuredClone(snapshot.anchor)};}} onPointerMove={e=>{const d=drag.current;if(d){d.next=d.position.map((v,i)=>v+(e.clientX-d.x)*d.basis.dx[i]+(e.clientY-d.y)*d.basis.dy[i]);frame.current.schedule();}}} onPointerUp={stop} onPointerCancel={abort} onKeyDown={e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();e.stopPropagation();setPlaying(false);onPosition(placement.position.map((v,i)=>v+(e.key==='ArrowRight'?10:e.key==='ArrowLeft'?-10:0)*snapshot.anchor.dx[i]+(e.key==='ArrowDown'?10:e.key==='ArrowUp'?-10:0)*snapshot.anchor.dy[i]));}}}/></svg>}
 {!placement.ribbon&&<div className="pe-placement-overlay"><button aria-pressed={surface} onClick={()=>setSurface(v=>!v)}>{surface?'Double-click a surface':'Snap to surface'}</button></div>}
 {placement.ribbon&&snapshot?.guide?.upper&&<svg className="pe-stage-tools pe-ribbon-fit-guide" viewBox={'0 0 '+snapshot.width+' '+snapshot.height} aria-label="Fitted weapon edge"><line x1={snapshot.guide.lower[0]} y1={snapshot.guide.lower[1]} x2={snapshot.guide.upper[0]} y2={snapshot.guide.upper[1]}/><text x={snapshot.guide.upper[0]+10} y={snapshot.guide.upper[1]}>Fitted edge</text></svg>}
 </>;
}
