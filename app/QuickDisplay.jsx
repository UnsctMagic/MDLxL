import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import useDismiss from './useDismiss.js';
import VIS_VIEW_MENU from '../src/view-menu.json';
import XL_VIEW_MENU from '../src/view-menu-xl.json';
import { OBJECT_TYPES } from '../src/object-display.js';
import LookIcon from './LookIcon.jsx';
import './portrait-view.css';

const TIPS = { 'display:bones': 'Show bones and helpers. Right-click to choose Helpers or Bones.', rgb: 'Show the model colored the way it looks in its Stand animation (geoset colors and fades)' };
// The MDLxL look's own switches. VIS keeps the tips above only.
const XL_TIPS = { ...TIPS, 'display:objects': 'Show attachments, emitters, events and sounds. Right-click to choose which.', 'display:lights': 'Lights', 'display:focusedSkeleton': 'Focused Skeleton' };
// Right-click menus: the same shared menu, one checkbox per type.
const TYPE_MENUS = {
  'display:bones': { label: 'Bone types', rows: [['Helpers', 'boneTypesHelpers'], ['Bones', 'boneTypesBones']] },
  'display:objects': { label: 'Object types', rows: OBJECT_TYPES.map(([label, key]) => [label, key]) },
};

// Keep icon names visible at every window width; the editor row can scroll.
export default function QuickDisplay({ viewMode, vanilla, checks, onCommand, isEnabled, onClear }) {
  const [menu, setMenu] = useState(null), menuRef = useRef(null), triggers = useRef({});
  const trigger = { get current() { return menu ? triggers.current[menu.action] : null; } };
  useDismiss(!!menu, [menuRef, trigger], () => setMenu(null), { claimEscape: true, escapePriority: -20 });
  const tips = vanilla ? TIPS : XL_TIPS, VIEW_MENU = vanilla ? VIS_VIEW_MENU : XL_VIEW_MENU;
  const typeMenu = action => (action === 'display:bones' || !vanilla && action === 'display:objects') ? TYPE_MENUS[action] : null;
  const shown = menu && TYPE_MENUS[menu.action];
  return <div className="quick-display" role="group" aria-label="Quick display">
    <div className="quick-display-options">
      <button title="Remove all display options; no model data is removed" onClick={onClear}>{!vanilla && <LookIcon name="clearDisplay"/>}<span className="quick-display-name">Clear</span></button>
      {(VIEW_MENU[viewMode] || []).filter(([, action]) => action !== 'clearDisplay' && action !== 'axes').map(([label, action]) =>
        <label key={action} ref={typeMenu(action) ? element => { triggers.current[action] = element; } : undefined} onContextMenu={typeMenu(action) ? event => {
          event.preventDefault(); if (!isEnabled(action)) return;
          const rect = event.currentTarget.getBoundingClientRect(), height = typeMenu(action).rows.length * 38;
          setMenu({ action, top: Math.min(rect.bottom, window.innerHeight - height), left: Math.max(0, Math.min(rect.left, window.innerWidth - 152)) });
        } : undefined} title={tips[action] || label}><input type="checkbox" aria-label={label} title={tips[action] || label} data-hotkey={action} checked={!!checks[action]} disabled={!isEnabled(action)} onChange={() => onCommand(action)}/>{!vanilla && <LookIcon name={action}/>}<span className="quick-display-name">{label}</span></label>)}
    </div>
    {shown && createPortal(<div ref={menuRef} className="bone-types-menu" role="menu" aria-label={shown.label} style={{ position: 'fixed', top: menu.top, left: menu.left }}>
      {shown.rows.map(([label, key]) => <button key={key} role="menuitemcheckbox" aria-checked={checks['display:' + key] !== false} onClick={() => onCommand('display:' + key)}><span aria-hidden="true">{checks['display:' + key] !== false ? '✓' : ''}</span>{label}</button>)}
    </div>, triggers.current[menu.action].closest('.classic-app'))}
  </div>;
}
