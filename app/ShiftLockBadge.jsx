import React, { useLayoutEffect, useRef, useState } from 'react';
import { bindLockBadge } from '../src/shift-lock.js';
import { dragKeys } from '../src/modifier-bindings.js';
import { usePreferencesContext } from './PreferencesContext.jsx';

export default function ShiftLockBadge({ ownerWindow = window }) {
  const [badge, setBadge] = useState(null), { preferences } = usePreferencesContext(), latest = useRef(preferences);
  latest.current = preferences;
  useLayoutEffect(() => bindLockBadge(ownerWindow, setBadge, event => dragKeys(event, 'move', latest.current).shiftKey), [ownerWindow]);
  if (!badge) return null;
  return <div className="shift-lock-badge" aria-hidden="true" style={{left: `clamp(0px, ${badge.x + 14}px, calc(100vw - 40px))`, top: `clamp(0px, ${badge.y + 14}px, calc(100vh - 16px))`}}>
    <svg width="15" height="16" viewBox="0 0 15 16" fill="currentColor" stroke="black" strokeWidth="1.25">
      <path d="M3.5 7V5a4 4 0 0 1 8 0v2H9V5a1.5 1.5 0 0 0-3 0v2Z"/>
      <rect x="1.5" y="6.5" width="12" height="8.5" rx="1.5"/><path d="M7.5 9.5v2.5"/>
    </svg>{badge.label}
  </div>;
}
