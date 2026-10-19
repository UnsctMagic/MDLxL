import React from 'react';
import { PANEL_WIDTH_DEFAULT, PANEL_WIDTH_MAX, PANEL_WIDTH_MIN } from '../src/preferences.js';

/** App saves the width sent with this window event as the shared panelWidth preference. */
export const PANEL_WIDTH_EVENT = 'mdlxl-panel-width';

const clampWidth = value => Math.round(Math.min(PANEL_WIDTH_MAX, Math.max(PANEL_WIDTH_MIN, value)));

/** Drag handle on the left edge of an editor's right-hand panel. Every editor shares one width. */
export default function SidebarResizer() {
  const commit = width => window.dispatchEvent(new CustomEvent(PANEL_WIDTH_EVENT, { detail: clampWidth(width) }));
  const begin = event => {
    if (event.button !== 0) return;
    event.preventDefault();
    const handle = event.currentTarget, root = handle.ownerDocument.documentElement, style = getComputedStyle(root);
    const scale = Number(style.getPropertyValue('--panel-scale')) || 1, x = event.clientX;
    const start = parseFloat(style.getPropertyValue('--panel-width')) || PANEL_WIDTH_DEFAULT;
    let width = start;
    // Live drag only moves the CSS variable; the preference is saved once on release.
    const move = next => { width = clampWidth(start + (x - next.clientX) / scale); root.style.setProperty('--panel-width', `${width}px`); };
    const end = () => {
      handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', end); handle.removeEventListener('pointercancel', end);
      handle.classList.remove('dragging');
      if (width !== start) commit(width);
    };
    handle.setPointerCapture(event.pointerId);
    handle.classList.add('dragging');
    handle.addEventListener('pointermove', move); handle.addEventListener('pointerup', end); handle.addEventListener('pointercancel', end);
  };
  return <div className="sidebar-resizer" role="separator" aria-orientation="vertical" aria-label="Panel width"
    title="Drag to make this panel wider or narrower. Double-click to reset it." onPointerDown={begin} onDoubleClick={() => commit(PANEL_WIDTH_DEFAULT)}/>;
}
