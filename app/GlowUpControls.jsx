import React from 'react';
const percent = value => Math.round(value * 100);
export default function GlowUpControls({glow,choices,reach,existing,error,onChange,onCreate,onCancel}) {
 const set=change=>onChange(value=>({...value,...change})),likely=choices.filter(c=>!c.other),other=choices.filter(c=>c.other);
 const slider=(key,label,min,max,value=glow[key],title)=><label className="pe-glow-slider" title={title}>{label}<span><input type="range" aria-label={label} min={min} max={max} value={percent(value)} onChange={e=>set({[key]:Number(e.target.value)/100})}/><output>{percent(value)}%</output></span></label>;
 const along='Where along the weapon the glow sits: 0% is the butt or pommel end, 100% is the tip. Set both near 100% for a small glow on a spear tip.';
 return <div className="pe-placement pe-glow">
  <strong>Glow Up</strong>
  {existing&&<small>This model already has hero glow; Glow Up adds another.</small>}
  <label className="pe-glow-toggle" title="The pulsing team-coloured glow on the ground under a hero. Three flat planes at the model's origin, like Blizzard's heroes."><input type="checkbox" checked={glow.origin} onChange={e=>set({origin:e.target.checked})}/>Origin glow</label>
  {glow.origin&&slider('originSize','Origin size',50,200)}
  <label className="pe-glow-toggle" title="Team-coloured glow along the weapon. A row of small glows that always face the camera and follow the weapon's bone."><input type="checkbox" checked={glow.weapon} disabled={!choices.length} onChange={e=>set({weapon:e.target.checked})}/>Weapon glow</label>
  {glow.weapon&&<><select aria-label="Weapon" title="The bone that holds the weapon. Marked polygons use the polygons you selected in Vertices." value={glow.weaponKey} onChange={e=>set({weaponKey:e.target.value,weaponFrom:null,weaponTo:null})}>{likely.map(c=><option key={c.key} value={c.key} translate="no">{c.label}</option>)}{other.length>0&&<optgroup label="Other bones">{other.map(c=><option key={c.key} value={c.key} translate="no">{c.label}</option>)}</optgroup>}</select>
   {reach&&<div className="pe-glow-range">{slider('weaponFrom','Glow from',0,100,glow.weaponFrom??reach.from,along)}{slider('weaponTo','Glow to',0,100,glow.weaponTo??reach.to,along)}</div>}
   {slider('weaponSize','Weapon size',20,200)}</>}
  {slider('brightness','Brightness',10,100)}
  <button disabled={!!error||(!glow.origin&&!glow.weapon)} onClick={onCreate}>Create</button>
  {error&&<small role="status">{error}</small>}
  <button onClick={onCancel}>Cancel</button>
 </div>;
}
