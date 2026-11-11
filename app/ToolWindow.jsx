import React, { useRef } from 'react';
import useMovableWindow from './useMovableWindow.js';
import { trapTab } from './focus-trap.js';

/**
 * The shell of a tool window: a backdrop and a window moved by its title bar, with ×
 * (data-hotkey="close", so Escape closes it) and Tab kept inside. The shared
 * .mdlxl-overlay / .mdlxl-window classes sit next to the feature's own className and
 * overlayClass, which keep its layout.
 * - caption replaces the plain title in the title bar; actions sit before ×
 *   (groupButtons wraps them and × in one <div>).
 * - windowRef is the window's <section>, for callers that focus or measure it.
 * - after is drawn beside the backdrop, not inside it (for example a library opened over the
 *   window), so the feature's overlayClass styles do not restyle it.
 * - unapplied says the window holds work that closing would discard: its close key then asks
 *   for a second press (Hotkeys.jsx). The × button still closes at once.
 */
export default function ToolWindow({ title, caption, actions, groupButtons = false, className = '', overlayClass = '', headerClass, closeClass, closeTitle, onClose, onKeyDown, trap = true, modal = true, windowRef, sectionProps, after, unapplied = false, children }) {
  const localRef = useRef(null), ref = windowRef || localRef, movable = useMovableWindow(ref);
  const close = <button data-hotkey="close" className={closeClass} aria-label={`Close ${title}`} title={closeTitle} onClick={onClose}>×</button>;
  return <><div className={`mdlxl-overlay ${overlayClass}`.trim()} onKeyDown={event => { onKeyDown?.(event); if (trap) trapTab(event, ref.current); }}>
    <section ref={ref} style={movable.style} tabIndex={-1} className={`mdlxl-window ${className}`.trim()} data-hotkey-prefix={title} data-hotkey-scope={title} role="dialog" aria-modal={modal} aria-label={title} data-hotkey-unapplied={unapplied ? '' : undefined} {...sectionProps}>
      <header className={headerClass} {...movable.handleProps}>{caption ?? <span>{title}</span>}{groupButtons ? <div>{actions}{close}</div> : <>{actions}{close}</>}</header>
      {children}
    </section>
  </div>{after}</>;
}
