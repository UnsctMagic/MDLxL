import React from 'react';
import { AUTO_FIX_LABELS, LEG_TIMING } from '../src/transplant-autofix.js';
import { RangeField } from './Fields.jsx';
import { translate } from '../src/localization.js';

export default function TransplantToggles({ visible = [], suggested = [], checked = [], onChange, suggesting, error, legTiming = LEG_TIMING.default, onLegTiming }) {
  if (suggesting || error) return <div className="xf-repairs" data-transplant-repairs="" role="status">{translate(suggesting ? 'Suggesting…' : error)}</div>;
  if (!visible.length) return null;
  return <div className="xf-repairs" data-transplant-repairs="" role="group" aria-label={translate('Repairs')}>
    {visible.map(key => {
      const [name, tip] = AUTO_FIX_LABELS[key];
      const recommended = suggested.includes(key);
      const box = <label key={key} className="xf-check" title={translate(tip)}>
        <input type="checkbox" aria-label={translate(name)} data-repair={key} checked={checked.includes(key)}
          onChange={event => onChange(key, event.target.checked)}/>
        {translate(name)}{recommended && <span className="xf-suggested" title={translate('Suggested for this pair.')} aria-label={translate('Suggested for this pair.')}>✦</span>}
      </label>;
      // Mirror legs carries its Leg timing slider, shown only while it is ticked; one rebuild per release or step.
      if (key !== 'mirrorLegs' || !checked.includes(key) || !onLegTiming) return box;
      const tipTiming = translate('When the front legs step: 0 with the back leg on the same side, 50 with the opposite one.');
      return <React.Fragment key={key}>{box}
        <RangeField className="xf-leg-timing" label={translate('Leg timing')} title={tipTiming} inputProps={{ title: tipTiming, 'data-leg-timing': '' }}
          min={LEG_TIMING.min} max={LEG_TIMING.max} step={LEG_TIMING.step} value={legTiming} output={value => `${value}%`} onCommit={onLegTiming}/>
      </React.Fragment>;
    })}
  </div>;
}
