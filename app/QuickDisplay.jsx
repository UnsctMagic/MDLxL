import React from 'react';
import VIEW_MENU from '../src/view-menu.json';
import VIS_VIEW_MENU from '../src/vis-view-menu.json';
import LookIcon from './LookIcon.jsx';
import './portrait-view.css';

// Keep icon names visible at every window width; the editor row can scroll.
export default function QuickDisplay({ viewMode, vanilla, checks, onCommand, isEnabled, onClear }) {
  return <div className="quick-display" role="group" aria-label="Quick display">
    <div className="quick-display-options">
      <button title="Remove all display options; no model data is removed" onClick={onClear}><LookIcon name="clearDisplay"/><span className="quick-display-name">Clear</span></button>
      {(vanilla?VIS_VIEW_MENU:VIEW_MENU)[viewMode].filter(([, action]) => action !== 'clearDisplay' && !(vanilla && ['display:bones', 'display:attachments'].includes(action))).map(([label, action]) =>
        <label key={action} title={label}><input type="checkbox" aria-label={label} title={label} data-hotkey={action} checked={!!checks[action]} disabled={!isEnabled(action)} onChange={() => onCommand(action)}/><LookIcon name={action}/><span className="quick-display-name">{label}</span></label>)}
    </div>
  </div>;
}
