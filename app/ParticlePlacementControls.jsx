import React from 'react';
export default function ParticlePlacementControls({model,placement,onChange,onPlace,onCancel,error,pending=false}) {
 const set=change=>onChange(value=>({...value,...change}));
 return <div className="pe-placement">
  <strong>{placement.ribbon?'Add ribbon':'Add effect'}</strong>
  {model.Sequences.length>0&&<fieldset className="pe-ribbon-sequences"><legend>Visibility</legend>{model.Sequences.map((item,index)=><label key={index}><input type="checkbox" checked={placement.sequences.includes(index)} onChange={e=>set({sequences:e.target.checked?[...placement.sequences,index]:placement.sequences.filter(value=>value!==index),...(e.target.checked?{sequence:index}:{})})}/>{item.Name}</label>)}</fieldset>}
  <button disabled={pending||!!error} onClick={onPlace}>Create</button>
  {error&&<small role="status">{error}</small>}
  <button onClick={onCancel}>Cancel</button>
 </div>;
}
