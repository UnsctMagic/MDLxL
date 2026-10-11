import React, { useRef } from 'react';
import useMovableWindow from './useMovableWindow.js';
import './pose-controls.css';

export default function PoseWeight({ weight }) {
  const ref = useRef(null), movable = useMovableWindow(ref), value = weight.state;
  if (!value) return null;
  return <div ref={ref} style={movable.style} className="pose-setup pose-weight" role="dialog" aria-modal="false" aria-label="POSE Weight" aria-busy={value.pending}>
    <header {...movable.handleProps}><strong>Weight</strong><button aria-label="Close Weight" title="Keep the editable keyframes and close Weight" onClick={() => weight.finish()}>×</button></header>
    <div className="pose-weight-modes" role="group" aria-label="Weight style">
      <button aria-pressed={value.mode === 'heavy'} title="Hold the connected limb down under the selected weight" onClick={() => weight.update({ mode: 'heavy' })}>Heavy</button>
      <button aria-pressed={value.mode === 'swing'} title="Let the selected part drag, overtake and recoil with the existing swing" onClick={() => weight.update({ mode: 'swing' })}>Swing</button>
    </div>
    <button className="pose-weight-vertices" aria-pressed={value.vertices} title="Click or drag over model vertices here in Movement; Shift adds to the selection" onClick={() => weight.update({ vertices: !value.vertices })}>VERTICES</button>
    <span className="pose-weight-count">{Object.values(value.selection).reduce((sum, ids) => sum + ids.length, 0)} selected</span>
    <label className="pose-weight-amount" title="Change how strongly the selected part weighs down or carries momentum"><span>Weight <output>{value.amount}%</output></span><input aria-label="Weight amount" type="range" min="0" max="100" step="1" value={value.amount} onChange={event => weight.update({ amount: Number(event.target.value) })}/></label>
    <p className="pose-weight-interval">{value.range[0]}–{value.range[1]} ms · use Play below</p>
    {value.error && <p role="status">{value.error}</p>}
    <div className="pose-actions"><button title="Keep ordinary animation keys; refine them with Movement" onClick={() => weight.finish()}>Done</button><button title="Discard this Weight preview" onClick={weight.cancel}>Cancel</button></div>
  </div>;
}
