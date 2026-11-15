import React, { createContext, useRef, useState } from 'react';
import useMovableWindow from './useMovableWindow.js';

/** The title-bar element the UV workspace puts its map and texture controls into. */
export const UVWindowTools = createContext(null);

export default function UVWindow({ state, onChange, onClose, children }) {
  const ref = useRef(null), [tools, setTools] = useState(null);
  const movable = useMovableWindow(ref, { contained: true, position: state.position, onPositionChange: next => onChange(previous => ({ ...previous, position: typeof next === 'function' ? next(previous.position) : next })) });
  const { minimized, expanded } = state;
  const style = movable.style && { ...movable.style, left: `min(${state.position.left}px, calc(100% - min(900px, 90%)))`, top: `min(${state.position.top}px, 22%)` };
  return <section ref={ref} className={`uv-tab-window${minimized ? ' minimized' : expanded ? ' expanded' : ''}`} style={minimized || expanded ? undefined : style} role="dialog" aria-modal="false" aria-label="UV Wrapper">
    <header {...movable.handleProps} onDoubleClick={event => { if (!event.target.closest('button')) onChange(previous => ({ ...previous, minimized: false, expanded: !previous.expanded })); }}>
      <strong>UV Wrapper</strong><div ref={setTools} className="uv-tab-window-tools"/><div className="uv-tab-window-buttons">
        <button type="button" aria-label={minimized ? 'Restore UV Wrapper' : 'Minimize UV Wrapper'} title={minimized ? 'Restore UV Wrapper' : 'Minimize UV Wrapper'} onClick={() => onChange(previous => ({ ...previous, minimized: !previous.minimized }))}>{minimized ? '▣' : '−'}</button>
        <button type="button" aria-label={expanded && !minimized ? 'Restore UV Wrapper size' : 'Expand UV Wrapper'} title={expanded && !minimized ? 'Restore UV Wrapper size' : 'Expand UV Wrapper'} onClick={() => onChange(previous => ({ ...previous, minimized: false, expanded: !previous.expanded }))}>□</button>
        <button type="button" data-hotkey="uv-wrapper:exit-uv-wrapper" data-hotkey-manual data-hotkey-label="Exit UV Wrapper" aria-label="Close UV Wrapper" title="Close UV Wrapper" onClick={onClose}>×</button>
      </div>
    </header>
    <div className="uv-tab-window-body" hidden={minimized}><UVWindowTools.Provider value={tools}>{children}</UVWindowTools.Provider></div>
  </section>;
}
