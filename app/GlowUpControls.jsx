import React,{useRef} from 'react';
import {ParticleSlider} from './ParticleCluelessControls.jsx';
export default function GlowUpControls({glow,choices,existing,error,onChange,onCreate,onCancel}) {
 const set=change=>onChange(value=>({...value,...change})),likely=choices.filter(c=>!c.other),other=choices.filter(c=>c.other);
 // EMTR's own slider: range plus number, Escape restores the value from before the gesture.
 const before=useRef(null),brightness=field=>({begin:()=>{before.current=glow[field];},change:value=>set({[field]:Math.min(1,Math.max(.1,value/100))}),finish:()=>{before.current=null;},cancel:()=>{if(before.current!=null)set({[field]:before.current});before.current=null;}});
 const slider=(field,label)=><ParticleSlider label={label} field={field} value={Math.round(glow[field]*100)} min={10} max={100} step={1} {...brightness(field)}/>;
 return <div className="pe-placement pe-glow" role="dialog" aria-modal="false" data-hotkey-prefix="glow-up" data-hotkey-scope="glow-up" aria-label="Glow Up">
  <strong>Glow Up</strong>
  {existing&&<small>This model already has hero glow; Glow Up adds another.</small>}
  <label className="pe-glow-toggle" title="The pulsing team-coloured glow on the ground under a hero. Three flat planes at the model's origin, like Blizzard's heroes."><input type="checkbox" checked={glow.origin} onChange={e=>set({origin:e.target.checked})}/>Origin glow</label>
  {glow.origin&&slider('originBrightness','Origin brightness %')}
  <label className="pe-glow-toggle" title="Team-coloured glow along the weapon. A row of small glows that always face the camera and follow the weapon's bone."><input type="checkbox" checked={glow.weapon} disabled={!choices.length} onChange={e=>set({weapon:e.target.checked})}/>Weapon glow</label>
  {glow.weapon&&<><select aria-label="Weapon" title="The bone that holds the weapon. Marked polygons use the polygons you selected in Vertices." value={glow.weaponKey} onChange={e=>set({weaponKey:e.target.value,weaponFrom:null,weaponTo:null})}>{likely.map(c=><option key={c.key} value={c.key} translate="no">{c.label}</option>)}{other.length>0&&<optgroup label="Other bones">{other.map(c=><option key={c.key} value={c.key} translate="no">{c.label}</option>)}</optgroup>}</select>
  {slider('weaponBrightness','Weapon brightness %')}</>}
  {(glow.origin||glow.weapon)&&<small>Drag the handles in the preview, as with emitters: Move and the edge for the ground glow; the two ends (anywhere: onto a hammer's head, past the tip) and the corners for the weapon glow.</small>}
  <button disabled={!!error||(!glow.origin&&!glow.weapon)} onClick={onCreate}>Create</button>
  {error&&<small role="status">{error}</small>}
  <button data-hotkey="close" onClick={onCancel}>Cancel</button>
 </div>;
}
