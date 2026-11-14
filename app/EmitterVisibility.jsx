import React, {useEffect} from 'react';
import {effectNodes} from '../src/particle-recipes.js';
import {objectKind} from '../src/object-kinds.js';
import {globalSequenceId} from '../src/animation.js';
import {sampleAnimationProperty,readAnimationTrack,setAnimationKey,setAnimationInlineValues} from '../src/animation-tracks.js';
// Emitters and ribbons: visibility is edited in EMTR (diamonds), so only "Edit effect" shows.
// Lights and attachments also switch on and off over time and EMTR cannot edit them: they keep "Visible".
const TIMED=['lights','attachments'];
export default function EmitterVisibility({model,selectedNodeIds,frame,sequenceIndex,globalSeqId,restPose,disabled,onEdit,onOpen,onPause,onTimelineChange}) {
 const effects=effectNodes(model).filter(({node})=>selectedNodeIds.includes(node.ObjectId));
 const kinds=objectKind(model),timed=selectedNodeIds.filter(id=>TIMED.includes(kinds.get(id)));
 const targets=timed.map(id=>({kind:'node',id,property:'Visibility'})),global=!restPose&&Number.isInteger(globalSeqId)&&globalSeqId>=0?globalSeqId:null;
 // Keyed visibility belongs to one clock: the model's animations or a global sequence.
 const clocks=[...new Set(targets.flatMap(target=>{const track=readAnimationTrack(model,target);return track?.Keys?[globalSequenceId(track)]:[];}))];
 const clock=clocks.length===1?clocks[0]:undefined;
 // Visibility on a global sequence is edited on that sequence's timeline, so selecting the object shows it.
 useEffect(()=>{if(!restPose&&Number.isInteger(clock)&&clock!==global)onTimelineChange?.(`global:${clock}`);},[timed.join(','),clock,restPose]);
 if(!effects.length&&!timed.length)return null;
 const animated=!restPose&&(sequenceIndex>=0||global!==null);
 const blocked=clocks.length>1||(clocks.length?clock!==global||!animated:false);
 const values=targets.map(target=>Number(sampleAnimationProperty(model,target,frame,sequenceIndex,global))),mixed=values.some(value=>value!==values[0]);
 return <div className="movement-emitter-controls">{timed.length>0&&<label title={blocked?'Choose an animation to edit keyed visibility.':undefined}><input aria-label="Object visible at current frame" type="checkbox" checked={values.every(v=>v>0)} ref={el=>{if(el)el.indeterminate=mixed;}} disabled={disabled||blocked} onChange={event=>{onPause?.(false);const value=event.target.checked?1:0;onEdit('Set object visibility',['Nodes'],current=>animated?setAnimationKey(current,targets,frame,value,sequenceIndex,global):setAnimationInlineValues(current,targets,value));}}/>Visible</label>}{effects.length>0&&<button onClick={()=>onOpen?.(effects[0].node.ObjectId)}>Edit effect</button>}</div>;
}
