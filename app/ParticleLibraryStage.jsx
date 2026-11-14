import React,{Suspense,lazy,useCallback,useEffect,useRef,useState} from 'react';
import {loadParticlePreview} from './ParticleThumbnailQueue.jsx';
const GamePreview=lazy(()=>import('./GamePreview.jsx'));

export default function ParticleLibraryStage({item,preferences,suspended}){
  const [preview,setPreview]=useState(null),[error,setError]=useState(''),[time,setTime]=useState(0),[playing,setPlaying]=useState(true);
  const capture=useRef(null);
  const ready=useCallback(api=>{capture.current=api;if(api)api.whenReady().then(()=>{if(capture.current===api)api.fit();}).catch(error=>{if(capture.current===api)setError(error.message);});},[]);
  useEffect(()=>{
    let active=true;setPreview(null);setError('');
    if(item&&!item.blocked&&!item.empty)loadParticlePreview(item).then(value=>{if(active){setPreview(value);setTime(value.time);setPlaying(true);}}).catch(error=>{if(active)setError(error.message);});
    return()=>{active=false;};
  },[item?.id]);
  return <div className="gf-stage-layer">{error?<span className="gf-stage-note">{error}</span>:preview?<Suspense fallback={<span className="gf-stage-note">Loading preview…</span>}><GamePreview key={preview.id} presentation="preview" model={preview.model} revision={0} textureAssets={preview.assets} preferences={preferences} particleAuthoring particleSelectedId={preview.selectedId} particleSweepRange={preview.sweepRange} interactivePreview sequenceIndex={preview.sequence} time={time} onTimeChange={setTime} playing={playing} onPlayingChange={setPlaying} suspended={suspended} showParticles showGrid mode="textured" view="perspective" onCaptureReady={ready} overlays={{bones:false,nodes:false,particles:false,attachments:false}}/></Suspense>:<span className="gf-stage-note">{item?.blocked?.reason||(item?.empty?'Empty effect':item?'Loading preview…':'Choose an effect.')}</span>}{preview?.demonstration&&<small style={{position:'absolute',bottom:6,right:8,zIndex:2,pointerEvents:'none'}}>Demonstration sweep · preview only</small>}</div>;
}
