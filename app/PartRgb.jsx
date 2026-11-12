import React from 'react';
import { sampleGeosetAnimation } from '../src/animation.js';
import { useDraftNumber } from './Fields.jsx';

function RgbField({ channel, value, disabled, onChange }) {
  const field = useDraftNumber({ value, disabled, onCommit: onChange, parse: text => /^\d+$/.test(text) && Number(text) <= 255 ? Number(text) : undefined });
  return <label className={`channel-${channel.toLowerCase()}`}>{channel}<input {...field} type="number" aria-label={`Bit ${channel}`}
    placeholder={value === '' ? 'Mixed' : undefined} min="0" max="255" step="1" disabled={disabled}/></label>;
}

export function ReplacementRgb({ model, geosetIds, disabled, onChange }) {
  const colors = geosetIds.map(id => sampleGeosetAnimation(model, id, 0, -1).color);
  return <div className="bit-replacement-rgb" role="group" aria-label="Replacement RGB" title="Set RGB (0–255) on the selected geosets. Press Enter or leave the field to preview the value.">
    {['R', 'G', 'B'].map((channel, axis) => {
      const values = new Set(colors.map(color => Math.round(color[axis] * 255)));
      return <RgbField key={channel} channel={channel} value={values.size === 1 ? [...values][0] : ''} disabled={disabled || !geosetIds.length} onChange={value => onChange(axis, value)}/>;
    })}
  </div>;
}

/** Bitz uses a Bit's animations only for RGB, so it lists the Bit's distinct
 * RGBs; a Bit with one look or none shows nothing. */
export default function PartRgb({ options, value, onChange, busy }) {
  if (options.length < 2) return null;
  const colors = [...new Set((options[value]?.colors || []).filter(Boolean).map(rgb => rgb.map(part => Math.round(part * 255)).join(',')))];
  return <div className="parts-animation-options"><div className="parts-color-controls">
    <label>RGB<select aria-label="Bit RGB" value={value} disabled={busy} onChange={event => onChange(Number(event.target.value))}>{options.map((option, index) => <option key={index} value={index}>{option.label}</option>)}</select></label>
    {colors.map(rgb => <span key={rgb} className="parts-rgb-swatch" style={{ background: `rgb(${rgb})` }}/>)}
  </div></div>;
}
