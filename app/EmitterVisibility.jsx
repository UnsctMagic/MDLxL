import React, {useEffect} from 'react';
import {effectNodes} from '../src/particle-recipes.js';
import {xlObjectKinds} from '../src/object-display.js';
import {globalSequenceId} from '../src/animation.js';
import {sampleAnimationProperty,readAnimationTrack,setAnimationKey,setAnimationInlineValues} from '../src/animation-tracks.js';
// Emitters and ribbons: visibility is edited in EMTR (diamonds), so only "Edit effect" shows.
// Lights and attachments also switch on and off over time and EMTR cannot edit them: they keep "Visible".
const TIMED=['lights','attachments'];
export default function EmitterVisibility(props) {
 return props.vanilla?<VisEmitterVisibility {...props}/>:<ObjectVisibility {...props}/>;
}
// VIS look: as on main (Visible tick and Edit effect for emitters).
function VisEmitterVisibility({model,selectedNodeIds,frame,sequenceIndex,globalSeqId,restPose,disabled,onEdit,onOpen,onPause}) {
 const effects=effectNodes(model).filter(({node})=>selectedNodeIds.includes(node.ObjectId));
 if(!effects.length)return null;
 const targets=effects.map(({node})=>({kind:'node',id:node.ObjectId,property:'Visibility'})),global=!restPose&&Number.isInteger(globalSeqId)&&globalSeqId>=0?globalSeqId:null;
 const animated=!restPose&&(sequenceIndex>=0||global!==null),blocked=!animated&&targets.some(target=>readAnimationTrack(model,target)?.Keys);
 const values=targets.map(target=>Number(sampleAnimationProperty(model,target,frame,sequenceIndex,global))),mixed=values.some(value=>value!==values[0]);
 return <div className="movement-emitter-controls"><label title={blocked?'Choose an animation to edit keyed visibility.':undefined}><input aria-label="Emitter visible at current frame" type="checkbox" checked={values.every(v=>v>0)} ref={el=>{if(el)el.indeterminate=mixed;}} disabled={disabled||blocked} onChange={event=>{onPause?.(false);const value=event.target.checked?1:0;onEdit('Set emitter visibility',['Nodes'],current=>animated?setAnimationKey(current,targets,frame,value,sequenceIndex,global):setAnimationInlineValues(current,targets,value));}}/>Visible</label><button onClick={()=>onOpen?.(effects[0].node.ObjectId)}>Edit effect</button></div>;
}
// MDLxL look.
function ObjectVisibility({model,selectedNodeIds,frame,sequenceIndex,globalSeqId,restPose,disabled,onEdit,onOpen,onPause,onTimelineChange}) {
 const effects=effectNodes(model).filter(({node})=>selectedNodeIds.includes(node.ObjectId));
 const kinds=xlObjectKinds(model),timed=selectedNodeIds.filter(id=>TIMED.includes(kinds.get(id)));
 const targets=timed.map(id=>({kind:'node',id,property:'Visibility'})),global=!restPose&&Number.isInteger(globalSeqId)&&globalSeqId>=0?globalSeqId:null;
 // Keyed visibility belongs to one clock: the model's animations or a global sequence.
 const clocks=[...new Set(targets.flatMap(target=>{const track=readAnimationTrack(model,target);return track?.Keys?[globalSequenceId(track)]:[];}))];
 const clock=clocks.length===1?clocks[0]:undefined;
 // Visibility on a global sequence is edited on that sequence's timeline, so selecting the object shows it.
 // Emitters, ribbons and events on one global sequence switch the timeline the same way, so their diamonds show.
 const allClocks=[...new Set([...effects.map(({node})=>({kind:'node',id:node.ObjectId,property:'Visibility'})),...targets].flatMap(target=>{const track=readAnimationTrack(model,target);return track?.Keys?[globalSequenceId(track)]:[];})
  .concat((model.EventObjects||[]).filter(node=>selectedNodeIds.includes(node.ObjectId)&&node.EventTrack?.length).map(node=>Number.isInteger(node.GlobalSeqId)&&node.GlobalSeqId>=0?node.GlobalSeqId:null)))];
 const shownClock=allClocks.length===1?allClocks[0]:undefined;
 useEffect(()=>{if(!restPose&&Number.isInteger(shownClock)&&shownClock!==global)onTimelineChange?.(`global:${shownClock}`);},[selectedNodeIds.join(','),shownClock,restPose]);
 if(!effects.length&&!timed.length)return null;
 const animated=!restPose&&(sequenceIndex>=0||global!==null);
 const blocked=clocks.length>1||(clocks.length?clock!==global||!animated:false);
 const values=targets.map(target=>Number(sampleAnimationProperty(model,target,frame,sequenceIndex,global))),mixed=values.some(value=>value!==values[0]);
 return <div className="movement-emitter-controls">{timed.length>0&&<label title={blocked?'Choose an animation to edit keyed visibility.':undefined}><input aria-label="Object visible at current frame" type="checkbox" checked={values.every(v=>v>0)} ref={el=>{if(el)el.indeterminate=mixed;}} disabled={disabled||blocked} onChange={event=>{onPause?.(false);const value=event.target.checked?1:0;onEdit('Set object visibility',['Nodes'],current=>animated?setAnimationKey(current,targets,frame,value,sequenceIndex,global):setAnimationInlineValues(current,targets,value));}}/>Visible</label>}{effects.length>0&&<button onClick={()=>onOpen?.(effects[0].node.ObjectId)}>Edit effect</button>}</div>;
}
