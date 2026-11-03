import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import useDismiss from './useDismiss.js';
import VIEW_MENU from '../src/view-menu.json';
import VIS_VIEW_MENU from '../src/vis-view-menu.json';
import LookIcon from './LookIcon.jsx';
import './portrait-view.css';

const TIPS = { 'display:bones': 'Show bones and helpers. Right-click to choose Helpers or Bones.', rgb: 'Show the model colored the way it looks in its Stand animation (geoset colors and fades)' };

// Keep icon names visible at every window width; the editor row can scroll.
export default function QuickDisplay({ viewMode, vanilla, checks, onCommand, isEnabled, onClear }) {
  const [menu, setMenu] = useState(null), menuRef = useRef(null), trigger = useRef(null);
  useDismiss(!!menu, [menuRef, trigger], () => setMenu(null), { claimEscape: true, escapePriority: -20 });
  return <div className="quick-display" role="group" aria-label="Quick display">
    <div className="quick-display-options">
      <button title="Remove all display options; no model data is removed" onClick={onClear}>{!vanilla && <LookIcon name="clearDisplay"/>}<span className="quick-display-name">Clear</span></button>
      {(vanilla?VIS_VIEW_MENU:VIEW_MENU)[viewMode].filter(([, action]) => action !== 'clearDisplay' && !(vanilla && action === 'display:attachments')).map(([label, action]) =>
        <label key={action} ref={action === 'display:bones' ? trigger : undefined} onContextMenu={action === 'display:bones' ? event => {
          event.preventDefault(); if (!isEnabled(action)) return;
          const rect = event.currentTarget.getBoundingClientRect();
          setMenu({ top: Math.min(rect.bottom, window.innerHeight - 76), left: Math.max(0, Math.min(rect.left, window.innerWidth - 152)) });
        } : undefined} title={TIPS[action] || label}><input type="checkbox" aria-label={label} title={TIPS[action] || label} data-hotkey={action} checked={!!checks[action]} disabled={!isEnabled(action)} onChange={() => onCommand(action)}/>{!vanilla && <LookIcon name={action}/>}<span className="quick-display-name">{label}</span></label>)}
    </div>
    {menu && createPortal(<div ref={menuRef} className="bone-types-menu" role="menu" aria-label="Bone types" style={{ position: 'fixed', ...menu }}>
      {[['Helpers', 'boneTypesHelpers'], ['Bones', 'boneTypesBones']].map(([label, key]) => <button key={key} role="menuitemcheckbox" aria-checked={checks['display:' + key] !== false} onClick={() => onCommand('display:' + key)}><span aria-hidden="true">{checks['display:' + key] !== false ? '✓' : ''}</span>{label}</button>)}
    </div>, trigger.current.closest('.classic-app'))}
  </div>;
}
