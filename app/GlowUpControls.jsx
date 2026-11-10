import React,{useRef,useState} from 'react';
import {ParticleSlider} from './ParticleCluelessControls.jsx';
import {displayNumber} from '../src/display-number.js';
import {translate} from '../src/localization.js';
export default function GlowUpControls({glow,choices,own,detected,faults,error,onChange,onTogglePiece,onCreate,onFix,onCancel}) {
 const set=change=>onChange(value=>({...value,...change})),likely=choices.filter(c=>!c.other),other=choices.filter(c=>c.other);
 // Faults show as one small button; the list opens on a click and Not now hides it until Glow Up opens again.
 const [faultsOpen,setFaultsOpen]=useState(false),[faultsHidden,setFaultsHidden]=useState(false);
 const [reviewOpen,setReviewOpen]=useState(false),[pieceIndex,setPieceIndex]=useState(0);
 const pieces=detected?.detected||[],piece=pieces[pieceIndex]||pieces[0];
 const brightnessShared=kind=>own?.[kind]?.pieces.some(p=>own.mixedGeosets.has(p.geoset));
 // EMTR's own slider: range plus number, Escape restores the value from before the gesture.
 const before=useRef(null),brightness=field=>({begin:()=>{before.current=glow[field];},change:value=>set({[field]:Math.min(1,Math.max(.1,value/100))}),finish:()=>{before.current=null;},cancel:()=>{if(before.current!=null)set({[field]:before.current});before.current=null;}});
 const slider=(kind,label)=>{
  const field=kind+'Brightness',disabled=brightnessShared(kind);
  return <div title={disabled?'Brightness is shared with another effect in this geoset.':undefined}>
   <ParticleSlider label={label} field={field} value={Math.round(glow[field]*100)} min={10} max={100} step={1} disabled={disabled} {...brightness(field)}/>
  </div>;
 };
 return <div className="pe-placement pe-glow" role="dialog" aria-modal="false" data-hotkey-prefix="glow-up" data-hotkey-scope="glow-up" aria-label="Glow Up">
  <strong>Glow Up</strong>
  {own&&<small title="Glow Up moves, resizes and brightens the glow this model already has. It adds glow only when you tick a kind the model doesn't have.">Adjusts this model's own glow.</small>}
  {piece&&<button aria-expanded={reviewOpen} title="Choose which pieces Glow Up can edit." onClick={()=>setReviewOpen(v=>!v)}>Review detected glow</button>}
  {reviewOpen&&piece&&<div className="pe-glow-faults" role="group" aria-label="Detected glow pieces">
   <select className="pe-glow-piece" aria-label="Detected glow piece" value={pieces.indexOf(piece)} onChange={e=>setPieceIndex(Number(e.target.value))}>
    {pieces.map((p,i)=><option key={p.geoset+':'+p.key} value={i} translate="no">
     {translate(`Geoset ${displayNumber(p.geoset)}`)} · {p.bones.map(id=>detected.nodes.get(id).Name).join(' + ')||translate(p.ground?'Origin glow':'Weapon glow')} · {displayNumber(i)}
    </option>)}
   </select>
   <button title={piece.excluded?'Include this piece in Glow Up again.':'Exclude this piece from Glow Up while this model is open.'} onClick={()=>onTogglePiece(piece)}>
    {piece.excluded?'Use as glow':'Not a glow'}
   </button>
  </div>}
  {faults.length>0&&!faultsHidden&&<button className="pe-glow-fix" aria-expanded={faultsOpen} title="This glow is built differently from Blizzard's heroes. Click to see how and fix it." onClick={()=>setFaultsOpen(v=>!v)}>{`Fix glow (${faults.length})`}</button>}
  {faultsOpen&&!faultsHidden&&faults.length>0&&<div className="pe-glow-faults" role="group" aria-label="Glow faults">
   <ul>{faults.map(f=><li key={f.key} title={f.title}>{f.label}{f.count>1?` (${f.count})`:''}</li>)}</ul>
   <button title="Repair the glow in place, as Blizzard builds it. One undo step." onClick={()=>{setFaultsOpen(false);onFix();}}>Fix</button>
   <button onClick={()=>{setFaultsOpen(false);setFaultsHidden(true);}}>Not now</button>
  </div>}
  <label className="pe-glow-toggle" title={own?.origin?"This model's ground glow. Untick to leave it as it is.":"The pulsing team-coloured glow on the ground under a hero. Three flat planes at the model's origin, like Blizzard's heroes."}><input type="checkbox" checked={glow.origin} onChange={e=>set({origin:e.target.checked})}/>Origin glow</label>
  {glow.origin&&slider('origin','Origin brightness %')}
  <label className="pe-glow-toggle" title={own?.weapon?"This model's weapon glow. Untick to leave it as it is.":"Team-coloured glow along the weapon. A row of small glows that always face the camera and follow the weapon's bone."}><input type="checkbox" checked={glow.weapon} disabled={!own?.weapon&&!choices.length} onChange={e=>set({weapon:e.target.checked})}/>Weapon glow</label>
  {glow.weapon&&<>{!own?.weapon&&<select aria-label="Weapon" title="The bone that holds the weapon. Marked polygons use the polygons you selected in Vertices." value={glow.weaponKey} onChange={e=>set({weaponKey:e.target.value,weaponFrom:null,weaponTo:null})}>{likely.map(c=><option key={c.key} value={c.key} translate="no">{c.label}</option>)}{other.length>0&&<optgroup label="Other bones">{other.map(c=><option key={c.key} value={c.key} translate="no">{c.label}</option>)}</optgroup>}</select>}
  {slider('weapon','Weapon brightness %')}</>}
  {(glow.origin||glow.weapon)&&<small>Drag the handles in the preview, as with emitters: Move and the edge for the ground glow; the two ends (anywhere: onto a hammer's head, past the tip) and the corners for the weapon glow.</small>}
  <button disabled={!!error||(!glow.origin&&!glow.weapon)} onClick={onCreate}>{own?'Apply':'Create'}</button>
  {error&&<small role="status">{error}</small>}
  <button data-hotkey="close" onClick={onCancel}>Cancel</button>
 </div>;
}
