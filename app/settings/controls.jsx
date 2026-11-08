import React from 'react';
import { Check, useDraftNumber } from '../Fields.jsx';

// Commits on Enter or on leaving the box, like every other number field.
export function Numeric({ id, label, value, min, max, step = 1, onChange, unit = '', title }) {
  const field = useDraftNumber({ value, onCommit: onChange });
  return <label className="settings-number" title={title}><span>{label}</span><span><input data-hotkey={id} aria-label={label} title={title} type="number" min={min} max={max} step={step} {...field}/>{unit}</span></label>;
}
export function SettingsNumberInput({ value, onChange, disabled, ...props }) {
  const field = useDraftNumber({ value, disabled, onCommit: onChange });
  return <input {...props} type="number" disabled={disabled} {...field}/>;
}
/** A label and a select on one row; `tip` shows over both. A number value comes back as a number. */
export function SettingsSelect({ id, label, aria = label, tip, value, options, onChange, disabled }) {
  return <label className="settings-select" title={tip}><span>{label}</span><select aria-label={aria} data-hotkey={id} title={tip} disabled={disabled} value={value} onChange={event => onChange(typeof value === 'number' ? Number(event.target.value) : event.target.value)}>{options.map(([entry, name]) => <option key={entry} value={entry}>{name}</option>)}</select></label>;
}
/** A checkbox whose tip shows over the box and its label. */
export function SettingsCheck({ id = null, label, checked, tip, onChange }) {
  return <div title={tip}><Check className="settings-toggle" id={id} label={label} title={tip} value={checked} onChange={onChange}/></div>;
}
