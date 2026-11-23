import React from 'react';
import { AUTO_FIX_LABELS } from '../src/transplant-autofix.js';
import { translate } from '../src/localization.js';

export default function TransplantToggles({ visible = [], suggested = [], checked = [], onChange, suggesting, error }) {
  if (suggesting || error) return <div className="xf-repairs" data-transplant-repairs="" role="status">{translate(suggesting ? 'Suggesting…' : error)}</div>;
  if (!visible.length) return null;
  return <div className="xf-repairs" data-transplant-repairs="" role="group" aria-label={translate('Repairs')}>
    {visible.map(key => {
      const [name, tip] = AUTO_FIX_LABELS[key];
      const recommended = suggested.includes(key);
      return <label key={key} className="xf-check" title={translate(tip)}>
        <input type="checkbox" aria-label={translate(name)} data-repair={key} checked={checked.includes(key)}
          onChange={event => onChange(key, event.target.checked)}/>
        {translate(name)}{recommended && <span className="xf-suggested" title={translate('Suggested for this pair.')} aria-label={translate('Suggested for this pair.')}>✦</span>}
      </label>;
    })}
  </div>;
}
