import React from 'react';
import { Tool } from './EditorControls.jsx';
import ToolIcon from './ToolIcon.jsx';

export const MOLD_TOOLS=[
  ['Bend','Bend a piece or selected region. Drag Center and Range to choose where it bends.'],
  ['Bulge','Bulge / Pinch: widen or squeeze the middle while the ends stay put.'],
  ['Taper','Taper: gradually narrow or widen a piece toward one end.'],
  ['Bevel','Bevel: turn selected solid edges into angled or rounded edges.'],
  ['Twist','Twist a piece along its length while its starting end stays still.'],
];
export function ForgeMoldTools({active,disabled,onChoose}){
  return <div className="classic-tools forge-mold-tools" role="group" aria-label="Shaping tools">{MOLD_TOOLS.map(([name,description])=><Tool key={name} title={name==='Bulge'?'Bulge / Pinch':name} action={'forge:shape:mold:'+name} description={description} disabled={disabled} active={active===name} onClick={()=>onChoose(name)}><ToolIcon name={name.toLowerCase()} className="modern-retro-icon"/></Tool>)}</div>;
}
export function ForgeMoldControls({state,error,onChange,onApply,onCancel}){
  if(!state)return null;
  const {tool,axis,direction}=state,axisName=['Across','Depth','Up'];
  return <div className="forge-mold-bar" role="group" aria-label="Shaping controls">
    <strong>{tool==='Bulge'?'Bulge / Pinch':tool}</strong>
    {tool!=='Bevel'&&<>{axisName.map((label,a)=><button key={a} type="button" aria-label={'Shape along '+label.toLowerCase()} title={'Shape along '+label.toLowerCase()+'. The handles show the direction on the piece.'} aria-pressed={axis===a} onClick={()=>onChange({...state,axis:a,direction:direction===a?(a+1)%3:direction,center:state.bounds.center[a],width:state.bounds.span[a],amount:0})}>{label}</button>)}
    {tool==='Bend'&&<button type="button" title="Turn the bending direction around the piece." onClick={()=>onChange({...state,direction:3-axis-direction})}>Turn bend</button>}</>}
    {tool==='Bevel'&&<button type="button" title="Switch between a flat chamfer and a rounded edge." aria-pressed={state.round} onClick={()=>onChange({...state,round:!state.round})}>{state.round?'Rounded':'Angled'}</button>}
    <span>{tool==='Bend'||tool==='Twist'?Math.round(state.amount)+'°':tool==='Bevel'?state.amount.toFixed(1):Math.round(state.amount*100)+'%'}</span>
    <button type="button" data-hotkey="forge:shape:commit" aria-label="Keep shaping" title="Keep this shape as one Undo step." disabled={!!error||!state.amount} onClick={onApply}>✓</button>
    <button type="button" aria-label="Cancel shaping" title="Cancel shaping (Escape)." onClick={onCancel}>×</button>
  </div>;
}
