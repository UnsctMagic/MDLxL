import React, { useEffect, useRef } from 'react';
import useMovableWindow from './useMovableWindow.js';
import { trapTab } from './focus-trap.js';

/**
 * The shell of a tool window: a backdrop and a window moved by its title bar, with ×
 * (data-hotkey="close", so Escape closes it) and Tab kept inside. The shared
 * .mdlxl-overlay / .mdlxl-window classes sit next to the feature's own className and
 * overlayClass, which keep its layout.
 * - caption replaces the plain title in the title bar; actions sit before ×
 *   (groupButtons wraps them and × in one <div>).
 * - ownEscape: the window's onKeyDown handles Escape itself while focus is inside it
 *   (for example leaving a picking mode first), so the hotkeys do not press × for it.
 * - embedded draws the window in place: no backdrop, title bar, moving or Tab trap.
 * - windowRef is the window's <section>, for callers that focus or measure it.
 * - after is drawn on the backdrop after the window (for example a library opened over it).
 */
export default function ToolWindow({ title, caption, actions, groupButtons = false, className = '', overlayClass = '', headerClass, closeClass, closeTitle, onClose, onKeyDown, ownEscape = false, trap = true, modal = true, embedded = false, windowRef, sectionProps, after, children }) {
  const localRef = useRef(null), ref = windowRef || localRef, movable = useMovableWindow(ref);
  useEffect(() => {
    if (!ownEscape) return undefined;
    const claim = event => { if (ref.current?.contains(event.detail?.target)) event.preventDefault(); };
    window.addEventListener('mdlxl-escape-key', claim);
    return () => window.removeEventListener('mdlxl-escape-key', claim);
  }, [ownEscape]);
  const close = <button data-hotkey="close" className={closeClass} aria-label={`Close ${title}`} title={closeTitle} onClick={onClose}>×</button>;
  return <div className={`${embedded ? '' : 'mdlxl-overlay '}${overlayClass}`.trim()} onKeyDown={event => { onKeyDown?.(event); if (trap && !embedded) trapTab(event, ref.current); }}>
    <section ref={ref} style={embedded ? undefined : movable.style} tabIndex={-1} className={`mdlxl-window ${className}`.trim()} role={embedded ? 'region' : 'dialog'} aria-modal={embedded ? undefined : modal} aria-label={title} {...sectionProps}>
      {!embedded && <header className={headerClass} {...movable.handleProps}>{caption ?? <span>{title}</span>}{groupButtons ? <div>{actions}{close}</div> : <>{actions}{close}</>}</header>}
      {children}
    </section>
    {after}
  </div>;
}
