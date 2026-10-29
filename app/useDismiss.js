import { useWindowKeyClaim } from './Hotkeys.jsx';
import { useEffect, useRef } from 'react';

const elementOf = item => typeof item === 'function' ? item() : item?.current;

/**
 * Closes an open popover when the user presses outside it or presses Escape.
 * `refs` are the popover's own parts (refs, or functions returning an element);
 * presses inside any of them keep it open. Listens in the popover's own document,
 * so it also works in the detached OptimizeXL window. `onClose` receives the event.
 * Options: `escape` / `outside` choose the triggers, `capture` the listening phase,
 * `stopEscape` keeps the Escape that closed the popover from reaching anything else.
 */
export default function useDismiss(open, refs, onClose, { escape = true, outside = true, capture = true, stopEscape = true, claimEscape = false, escapePriority = 0 } = {}) {
  const latest = useRef(); latest.current = { refs, onClose };
  useWindowKeyClaim(({event}) => {
    if (!open || !escape || !claimEscape || event.key !== 'Escape') return false;
    const elements = latest.current.refs.map(elementOf).filter(Boolean);
    if (elements[0]?.ownerDocument !== event.target?.ownerDocument) return false;
    latest.current.onClose(event); return true;
  }, escapePriority);
  useEffect(() => {
    if (!open) return;
    const elements = () => latest.current.refs.map(elementOf).filter(Boolean);
    const doc = elements()[0]?.ownerDocument || globalThis.document;
    if (!doc) return;
    const press = event => { if (!elements().some(element => element.contains(event.target))) latest.current.onClose(event); };
    const key = event => {
      if (event.key !== 'Escape') return;
      if (stopEscape) event.stopPropagation();
      latest.current.onClose(event);
    };
    if (outside) doc.addEventListener('pointerdown', press, capture);
    if (escape && !claimEscape) doc.addEventListener('keydown', key, capture);
    return () => { doc.removeEventListener('pointerdown', press, capture); doc.removeEventListener('keydown', key, capture); };
  }, [open, escape, outside, capture, stopEscape, claimEscape]);
}
