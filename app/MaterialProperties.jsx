import React from 'react';
import { MATERIAL_PRESETS, MATERIAL_FILTER_MODES, materialPreset } from '../src/material-presets.js';
import { TEAM_COLORS } from '../src/team-colors.js';
import './material-properties.css';

export default function MaterialProperties({ model, materialID, disabled, onChange, compact = false, filterModes = false }) {
  const state = materialPreset(model, materialID);
  const material = model.Materials?.[materialID];
  const presets = filterModes ? [...MATERIAL_PRESETS, ...MATERIAL_FILTER_MODES] : MATERIAL_PRESETS;
  const change = (preset, tint = state.tint) => onChange?.(materialID, preset, tint);
  return <div className="material-properties">
    <label>{!compact && 'Material Properties '}<select aria-label="Material Properties" disabled={disabled || !material} value={presets.includes(state.preset) ? state.preset : ''} onChange={event => change(event.target.value)}>
      <option value="">-Current-</option>{presets.map(preset => <option key={preset}>{preset}</option>)}
    </select></label>
    {state.preset === 'Color Tint' && <select aria-label="Tint color" disabled={disabled} value={state.tint} onChange={event => change('Color Tint', Number(event.target.value))}>
      {TEAM_COLORS.map((color, index) => <option key={color.sourceKey} value={index}>{color.index === null ? color.name : `${color.index} · ${color.name}`}</option>)}
    </select>}
  </div>;
}
