import React from 'react';
import { Tool } from './EditorControls.jsx';

export const MOLD_TOOLS=[
  ['Bend','M4 20V11Q4 4 11 4H20 M8 20V11Q8 8 11 8H20','Bend a piece or selected region. Drag Center and Range to choose where it bends.'],
  ['Bulge','M6 3Q1 12 6 21 M18 3Q23 12 18 21 M8 12H16 M12 8V16','Bulge / Pinch: widen or squeeze the middle while the ends stay put.'],
  ['Taper','M4 21 9 3H15L20 21Z','Taper: gradually narrow or widen a piece toward one end.'],
  ['Bevel','M3 21V8L8 3H21 M3 8H8V3 M8 8 21 21','Bevel: turn selected solid edges into angled or rounded edges.'],
  ['Twist','M6 3C24 7 0 17 18 21 M18 3C0 7 24 17 6 21 M6 3H18 M6 21H18','Twist a piece along its length while its starting end stays still.'],
];
export function ForgeMoldTools({active,disabled,onChoose}){
  return <div className="classic-tools forge-mold-tools" role="group" aria-label="Shaping tools">{MOLD_TOOLS.map(([name,path,description])=><Tool key={name} title={name==='Bulge'?'Bulge / Pinch':name} action={'forge:shape:mold:'+name} description={description} disabled={disabled} active={active===name} onClick={()=>onChoose(name)}><svg className="modern-retro-icon modern-retro-gold" viewBox="0 0 24 24" aria-hidden="true"><path d={path}/></svg></Tool>)}</div>;
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
