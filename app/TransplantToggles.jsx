import React from 'react';
import { AUTO_FIX_LABELS, LEG_TIMING } from '../src/transplant-autofix.js';
import { RangeField } from './Fields.jsx';
import { translate } from '../src/localization.js';

// The tooltip of the Transfer window's Mirror caption button: the checkbox says the same.
const MIRROR_TIP = 'Swap left and right for this whole donor. On by itself when the two models hold their weapon in opposite hands.';

export default function TransplantToggles({ visible = [], suggested = [], checked = [], onChange, suggesting, error, legTiming = LEG_TIMING.default, onLegTiming, mirror = false, mirrorSuggested = false, onMirror }) {
  if (suggesting || error) return <div className="xf-repairs" data-transplant-repairs="" role="status">{translate(suggesting ? 'Suggesting…' : error)}</div>;
  if (!visible.length && !onMirror) return null;
  const mark = <span className="xf-suggested" title={translate('Suggested for this pair.')} aria-label={translate('Suggested for this pair.')}>✦</span>;
  return <div className="xf-repairs" data-transplant-repairs="" role="group" aria-label={translate('Repairs')}>
    {/* Mirror (owner: "I would like this to be optional"): an option, not a repair key; first in the row. */}
    {onMirror && <label className="xf-check" title={translate(MIRROR_TIP)}>
      <input type="checkbox" aria-label={translate('Mirror')} data-repair="mirror" checked={!!mirror} onChange={event => onMirror(event.target.checked)}/>
      {translate('Mirror')}{mirrorSuggested && mark}
    </label>}
    {visible.map(key => {
      const [name, tip] = AUTO_FIX_LABELS[key];
      const recommended = suggested.includes(key);
      const box = <label key={key} className="xf-check" title={translate(tip)}>
        <input type="checkbox" aria-label={translate(name)} data-repair={key} checked={checked.includes(key)}
          onChange={event => onChange(key, event.target.checked)}/>
        {translate(name)}{recommended && mark}
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
