import React, { useRef } from 'react';
import useMovableWindow from './useMovableWindow.js';

/** The classic movable modal window shared by the editor's dialogs. */
export default function Dialog({ title, children, footer, onClose, onHotkeys, overlayClass = '', onKeyDown }) {
  const windowRef = useRef(null), movable = useMovableWindow(windowRef);
  return <div className={`classic-modal ${overlayClass}`} onKeyDown={onKeyDown}><section data-hotkey-scope="dialog" data-hotkey-prefix={title} ref={windowRef} style={movable.style} className="classic-modal-window" role="dialog" aria-modal="true" aria-label={title}><header {...movable.handleProps}><span>{title}</span><div>{onHotkeys && <button data-hotkey="hotkeys" aria-label="Hotkeys for this dialog" onClick={onHotkeys}>Keys</button>}<button data-hotkey="close" aria-label={`Close ${title}`} onClick={onClose}>×</button></div></header><div className="classic-modal-body">{children}</div><footer>{footer || <button data-hotkey="app:action:1" onClick={onClose}>Close</button>}</footer></section></div>;
}
