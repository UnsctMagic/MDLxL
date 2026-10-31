import React from 'react';

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
