import React,{useMemo,useRef,useState} from 'react';
import ParticleStageTools from './ParticleStageTools.jsx';
import {effectAnchor} from '../src/surface-effects.js';

export default function GlobalAnimationStage({Preview,graph,layer,placing,onLayer,...props}){
 const [snap,setSnap]=useState(null),[draft,setDraft]=useState(null),gesture=useRef(null);
 const value=draft||layer,frame=graph?.frame,result=graph?.layers?.[layer?.id];
 const radius=layer?.type==='Rune'||layer?.kind==='flies';
 const active=placing&&frame&&value&&(result?.id!=null);
 const parent=active?effectAnchor(graph.model,graph.model.Geosets[graph.geoset]):null;
 const marks=useMemo(()=>{
  if(!active)return undefined;
  const at=d=>frame.at(d).add({x:value.offset[0],y:value.offset[1],z:value.offset[2]}).toArray();
  return {center:{point:at(0),node:parent,radius:radius?value.size:undefined},
   upper:{point:at(value.upper),node:parent},upperUnit:{point:at(value.upper+1),node:parent},
   lower:{point:at(-value.lower),node:parent},lowerUnit:{point:at(-value.lower-1),node:parent}};
 },[active,frame,parent,value,radius]);
 const center=snap?.marks?.center;
 let snapshot=null;
 if(center&&snap.anchor){
  const [x,y,,,r]=center,points=[[-1,-1],[-1,1],[1,-1],[1,1]].map(([a,b])=>[x+a*r,y+b*r,0]);
  snapshot={...snap,anchor:{...snap.anchor,point:center},guide:{...snap.guide,...snap.marks,origin:center},
   samples:radius?[{owner:result?.id,age:.5,points}]:[]};
 }
 const fieldKeys={Translation:'offset',ParticleScaling:'size',HeightAbove:'upper',HeightBelow:'lower'};
 const emitter=value&&{ObjectId:result?.id,Translation:value.offset,ParticleScaling:[value.size,value.size,value.size],HeightAbove:value.upper,HeightBelow:value.lower};
 return <><Preview {...props} particleAnchorId={active?result.id:undefined} particleSelectedId={active?result.id:undefined} particleStageMarks={marks} onParticleStage={active?setSnap:undefined}/>
 {active&&<ParticleStageTools snapshot={snapshot} tool="Look" emitter={emitter} options={{family:radius?'ParticleEmitters2':'RibbonEmitters',stage:1}}
  begin={field=>{gesture.current={key:fieldKeys[field],initial:layer};}}
  change={v=>{const g=gesture.current;if(!g)return;g.next={...g.initial,[g.key]:v};setDraft(g.next);}}
  finish={()=>{const g=gesture.current;gesture.current=null;setDraft(null);if(g?.next)onLayer(g.next);}}
  cancel={()=>{gesture.current=null;setDraft(null);}}/>}</>;
}
