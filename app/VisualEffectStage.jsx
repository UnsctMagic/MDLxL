import React,{useMemo,useRef,useState} from 'react';
import ParticleStageTools from './ParticleStageTools.jsx';
import {positionedAccents} from '../src/visual-effect-composition.js';
import {particleValue} from '../src/particle-bindings.js';

const handleTitles={Translation:'Move the attached effect with the selected part.',ParticleScaling:'Make the whole attached effect larger or smaller.',
 HeightAbove:'Drag the ribbon edge to change the width of the trail.',HeightBelow:'Drag the ribbon edge to change the width of the trail.'};

// Only the handle overlay subscribes to stage samples while it is open.
export default function VisualEffectStage({Preview,accents,placing,placement,onCommit,...props}){
 const [snapshot,setSnapshot]=useState(null),[draft,setDraft]=useState(null),gesture=useRef(null);
 const patch=useMemo(()=>accents&&positionedAccents(accents.rest,accents.origin,draft||placement),[accents,draft,placement]);
 const id=accents?.ids[0],family=patch?.RibbonEmitters.some(n=>n.ObjectId===id)?'RibbonEmitters':'ParticleEmitters2';
 const node=patch?.[family].find(n=>n.ObjectId===id);
 const handleNode=useMemo(()=>node&&{...node,Translation:(draft||placement).offset},[node,draft,placement]);
 const active=placing&&!!node,stageOptions={family,stage:1};
 function begin(field){
   gesture.current={field,initial:placement,base:particleValue(handleNode,field,stageOptions),next:placement};
 }
 function change(value){
   const g=gesture.current;if(!g)return;
   const next=g.field==='Translation'?{...g.initial,offset:value}:{...g.initial,size:Math.min(5,Math.max(.12,g.initial.size*value/Math.max(.001,g.base)))};
   g.next=next;setDraft(next);
 }
 function finish(){
   const g=gesture.current;gesture.current=null;setDraft(null);
   if(g&&g.next!==g.initial)onCommit('placement',g.next);
 }
 function cancel(){gesture.current=null;setDraft(null);}
 return <><Preview {...props} particleAnchorId={active?id:undefined} particleSelectedId={active?id:undefined}
     particleLiveModel={active?patch:undefined} onParticleStage={active?setSnapshot:undefined}/>
   {active&&<ParticleStageTools snapshot={snapshot} tool="Look" handleTitles={handleTitles} emitter={handleNode} options={stageOptions}
      begin={begin} change={change} finish={finish} cancel={cancel}/>}</>;
}
