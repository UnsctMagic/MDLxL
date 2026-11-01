import React,{useMemo,useRef,useState} from 'react';
import ParticleStageTools from './ParticleStageTools.jsx';

export default function GlobalAnimationStage({Preview,graph,layer,placing,onLayer,...props}){
 const [snap,setSnap]=useState(null),[draft,setDraft]=useState(null),gesture=useRef(null);
 const value=draft||layer,result=graph?.layers?.[layer?.id];
 const radius=layer?.ground||layer?.kind==='flies'||layer?.kind==='native';
 const real=graph?.model.Nodes[result?.id],parentNode=real?.Parent,frame=graph?.frame.regions?.find(r=>r.weights.some(([id])=>id===parentNode))?.frame||graph?.frame;
 const active=placing&&frame&&value&&(result?.id!=null);
 const parent=active?real?.Parent??null:null;
 const marks=useMemo(()=>{
  if(!active)return undefined;
  const base=(layer.impact||layer.ground)&&real?{x:real.PivotPoint[0]-layer.offset[0],y:real.PivotPoint[1]-layer.offset[1],z:real.PivotPoint[2]-layer.offset[2]}:null;
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
 const fieldKeys={Translation:'offset',ParticleScaling:'size',HeightAbove:'upper',HeightBelow:'lower'};
 const emitter=value&&{ObjectId:result?.id,Translation:value.offset,ParticleScaling:[value.size,value.size,value.size],HeightAbove:value.upper,HeightBelow:value.lower};
 return <><Preview {...props} particleAnchorId={active?result.id:undefined} particleSelectedId={active?result.id:undefined} particleStageMarks={marks} onParticleStage={active?setSnap:undefined}/>
 {active&&<ParticleStageTools snapshot={snapshot} tool={layer.stamp?"Placement":"Look"} emitter={emitter} options={{family:radius?'ParticleEmitters2':'RibbonEmitters',stage:1}}
  begin={field=>{gesture.current={key:fieldKeys[field],initial:layer};}}
  change={v=>{const g=gesture.current;if(!g)return;g.next={...g.initial,[g.key]:v};setDraft(g.next);}}
  finish={()=>{const g=gesture.current;gesture.current=null;setDraft(null);if(g?.next)onLayer(g.next);}}
  cancel={()=>{gesture.current=null;setDraft(null);}}/>}</>;
}
