import React, { useLayoutEffect, useRef, useState } from 'react';
import VIEW_MENU from '../src/view-menu.json';
import VIS_VIEW_MENU from '../src/vis-view-menu.json';
import LookIcon from './LookIcon.jsx';
import './portrait-view.css';

// The new look shows these as icon + name chips in the top row; when the row is
// too narrow for every name, they shrink to icons only (names on hover). With VIS
// on they stay the classic checkboxes in the editor row.
export default function QuickDisplay({ viewMode, vanilla, checks, onCommand, isEnabled, onClear }) {
  const box = useRef(null), natural = useRef(0), [compact, setCompact] = useState(false);
  // Measure the free space in the top row (VIS keeps the classic row, never compact).
  useLayoutEffect(() => {
    const element = box.current, bar = element?.parentElement;
    if (!element || !bar?.classList.contains('classic-toolbar') || typeof ResizeObserver === 'undefined') return;
    const check = () => {
      if (!element.classList.contains('quick-display-compact')) natural.current = element.firstElementChild.scrollWidth;
      // Room up to the next item (the strengths are pushed right, so that is where the free space ends).
      const next = element.nextElementSibling, gap = parseFloat(getComputedStyle(bar).columnGap) || 0;
      const free = (next ? next.getBoundingClientRect().left - gap : bar.getBoundingClientRect().right) - element.getBoundingClientRect().left - (parseFloat(getComputedStyle(element).marginRight) || 0);
      setCompact(natural.current > free);
    };
    const observer = new ResizeObserver(check);
    observer.observe(bar);
    check();
    return () => observer.disconnect();
  }, [viewMode, vanilla]);
  return <div ref={box} className={`quick-display${compact ? ' quick-display-compact' : ''}`} role="group" aria-label="Quick display">
    <div className="quick-display-options">
      <button title="Remove all display options; no model data is removed" onClick={onClear}><LookIcon name="clearDisplay"/><span className="quick-display-name">Clear</span></button>
      {(vanilla?VIS_VIEW_MENU:VIEW_MENU)[viewMode].filter(([, action]) => action !== 'clearDisplay' && !((vanilla || viewMode === 'bones') && ['display:bones', 'display:attachments'].includes(action))).map(([label, action]) =>
        <label key={action} title={compact ? label : undefined}><input type="checkbox" aria-label={label} data-hotkey={action} checked={!!checks[action]} disabled={!isEnabled(action)} onChange={() => onCommand(action)}/><LookIcon name={action}/><span className="quick-display-name">{label}</span></label>)}
    </div>
  </div>;
}
