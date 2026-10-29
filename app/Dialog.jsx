import React, { useRef } from 'react';
import useMovableWindow from './useMovableWindow.js';
import { trapTab } from './focus-trap.js';

/** Shown while a window's code loads. `title` is the whole line, e.g. "Loading Forge…", so it translates as one text. */
export function LoadingWindow({ title }) {
  return <div className="classic-modal mdlxl-overlay"><section className="classic-modal-window mdlxl-window" aria-busy="true"><div className="classic-modal-body" role="status">{title}</div></section></div>;
}

const classes = (...names) => names.filter(Boolean).join(' ');

/**
 * The classic movable modal window shared by the editor's dialogs.
 * className is added to the window, overlayClass to the backdrop.
 * onSubmit makes the body a form with Cancel and OK (Enter in a field presses OK);
 * footer then adds buttons before them. onPointerDown/onPointerUp listen in the
 * capture phase of the whole window.
 */
export default function Dialog({ title, children, footer, onClose, onHotkeys, overlayClass = '', className = '', onKeyDown, onSubmit, onPointerDown, onPointerUp }) {
  const windowRef = useRef(null), movable = useMovableWindow(windowRef);
  const body = <div className="classic-modal-body">{children}</div>;
  return <div className={classes('classic-modal mdlxl-overlay', overlayClass)} onKeyDown={event => { trapTab(event, windowRef.current); onKeyDown?.(event); }}><section data-hotkey-scope="dialog" data-hotkey-prefix={title} ref={windowRef} style={movable.style} className={classes('classic-modal-window mdlxl-window', className)} role="dialog" aria-modal="true" aria-label={title} onPointerDownCapture={onPointerDown} onPointerUpCapture={onPointerUp}><header {...movable.handleProps}><span>{title}</span><div>{onHotkeys && <button data-hotkey="hotkeys" aria-label="Hotkeys for this dialog" onClick={onHotkeys}>Keys</button>}<button data-hotkey="close" aria-label={`Close ${title}`} onClick={onClose}>×</button></div></header>{onSubmit
    ? <form onSubmit={event => { event.preventDefault(); onSubmit(); }}>{body}<footer>{footer}<button type="button" onClick={onClose}>Cancel</button><button type="submit">OK</button></footer></form>
    : <>{body}<footer>{footer || <button data-hotkey="app:action:1" onClick={onClose}>Close</button>}</footer></>}</section></div>;
}
