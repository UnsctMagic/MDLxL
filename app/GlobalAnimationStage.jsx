import React,{useCallback,useMemo,useRef,useState} from 'react';
import ParticleStageTools from './ParticleStageTools.jsx';
import {Vector3} from 'three';
import {withEmitterPlacement,layerEmitterPoint} from '../src/fx-emitter-placement.js';

export default function GlobalAnimationStage({Preview,graph,layer,placing,onLayer,...props}){
 const [snap,setSnap]=useState(null),[draft,setDraft]=useState(null),gesture=useRef(null),capture=useRef(null);
 const captureReady=useCallback(api=>{capture.current=api;props.onCaptureReady?.(api);},[props.onCaptureReady]);
 const value=draft||layer,result=graph?.layers?.[layer?.id];
 // A card's size is its half width: the same round size handle emitters use.
 const card=layer?.type==='Card',flat=layer?.ground||card&&layer.facing==='ground';
 const radius=flat||layer?.kind==='flies'||layer?.kind==='native'||card;
 const real=graph?.model?.Nodes[result?.id];
 // An orbiting Edge rides three helpers; its handles stay with the part the helpers hang from.
 let parentNode=real?.Parent,anchorId=result?.id;if(layer?.orbit&&layer.type==='Edge')for(let i=0;i<3&&parentNode!=null;i++){anchorId=parentNode;parentNode=graph.model.Nodes[parentNode]?.Parent;}
 // A fly swarm hangs from the whole part's centre, never from one skin region.
 const frame=layer?.type==='Particles'?graph?.frame:layer?.swarm?graph?.frame:graph?.frame?.regions?.find(r=>r.weights.some(([id])=>id===parentNode))?.frame||graph?.frame;
 const active=placing&&frame&&value&&(result?.id!=null);
 const parent=active?layer.type==='Particles'?graph?.model?.Nodes[result?.id]?.Parent??null:parentNode??null:null;
 const marks=useMemo(()=>{
  if(!active)return undefined;
  const base=(layer.impact||flat)&&real?{x:real.PivotPoint[0]-layer.offset[0],y:real.PivotPoint[1]-layer.offset[1],z:real.PivotPoint[2]-layer.offset[2]}:null;
  const at=d=>(base?frame.center.clone().copy(base).addScaledVector(frame.axis,d):frame.at(d)).add({x:value.offset[0],y:value.offset[1],z:value.offset[2]}).toArray();
  return {center:{point:at(0),node:parent,radius:radius?value.size:undefined},
   upper:{point:at(value.upper),node:parent},upperUnit:{point:at(value.upper+1),node:parent},
   lower:{point:at(-value.lower),node:parent},lowerUnit:{point:at(-value.lower-1),node:parent}};
 },[active,frame,parent,value,radius]);
 const center=snap?.marks?.center;
 let snapshot=null;
 if(center&&snap.anchor){
  const [x,y,,,r]=center,points=[[-1,-1],[-1,1],[1,-1],[1,1]].map(([a,b])=>[x+a*r,y+b*r,0]);
  snapshot={...snap,anchor:layer.impact?null:{...snap.anchor,point:center},guide:{...snap.guide,...snap.marks,origin:center},
   samples:radius?[{owner:result?.id,age:.5,points}]:[]};
 }
 const liveModel=useMemo(()=>{
  if(!draft||!graph?.model||layer.type!=='Particles'||layer.swarm)return graph?.model;
  const points=new Map((result.sites||[]).map(s=>[s.key,s.point])),prefix=graph.model.Geosets[graph.geoset]._FxStack.owner+'/'+layer.id+'/';
  return {...graph.model,ParticleEmitters2:graph.model.ParticleEmitters2.map(node=>{
   const point=points.get(node._FxTag?.slice(prefix.length));if(!node._FxTag?.startsWith(prefix)||!point)return node;
   return {...node,PivotPoint:Float32Array.from(layerEmitterPoint(graph.frame,draft,new Vector3(...point)).toArray())};
  })};
 },[draft,graph,layer,result]);
 const fieldKeys={Translation:'offset',ParticleScaling:'size',HeightAbove:'upper',HeightBelow:'lower'};
 const emitter=value&&{ObjectId:result?.id,Translation:value.offset,ParticleScaling:[value.size,value.size,value.size],HeightAbove:value.upper,HeightBelow:value.lower};
 return <><Preview {...props} particleLiveModel={liveModel} particleLiveRevision={draft} onCaptureReady={captureReady} particleAnchorId={active?anchorId:undefined} keepBillboards={card||!!layer?.swarm} particleSelectedId={active?result.id:undefined} particleStageMarks={marks} onParticleStage={active?setSnap:undefined}/>
 {active&&<ParticleStageTools frames={capture.current?.frames} spanHandles={layer.type==='Particles'} snapshot={snapshot} tool={layer.stamp?"Placement":"Look"} emitter={emitter} options={{family:radius?'ParticleEmitters2':'RibbonEmitters',stage:1}}
  begin={field=>{gesture.current={key:fieldKeys[field],initial:layer};}}
  change={v=>{const g=gesture.current;if(!g)return;g.next=withEmitterPlacement(g.initial,{...g.initial,[g.key]:v});setDraft(g.next);}}
  finish={()=>{const g=gesture.current;gesture.current=null;setDraft(null);if(g?.next)onLayer(g.next);}}
  cancel={()=>{gesture.current=null;setDraft(null);}}/>}</>;
}
