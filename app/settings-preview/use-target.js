/** Which control the preview follows: one delegated hover and focus listener. */
import { useEffect, useState } from 'react';
import { previewEntry } from './registry.js';

const CONTROL = '[data-hotkey],[aria-label]';
const HOST = 'label, button, select, input, textarea, [role=group], [data-hotkey], [aria-label]';

const keyOf = element => [element?.getAttribute('data-hotkey'), element?.getAttribute('aria-label')].find(key => previewEntry(key));

/** From any element under the pointer to its Settings control: { element, id }, or null. */
export function resolvePreviewTarget(target) {
  const host = target?.closest?.(HOST);
  if (!host) return null;
  const control = host.matches(CONTROL) ? host : host.querySelector(CONTROL);
  const id = keyOf(control);
  if (id) return { element: control, id };
  // A plain button inside a labelled group, such as the two background type buttons.
  const group = host.closest('[role=group][aria-label]'), groupId = keyOf(group);
  return groupId ? { element: host, id: groupId } : null;
}

/**
 * Follows hover and focus inside `rootRef`. Returns { id, restart } for SettingsPreview.
 * `defaultId` is shown until a control is reached and again when the page changes.
 * Moving onto something with no preview keeps the current one, and coming back replays it.
 */
export function useSettingsPreviewTarget(rootRef, defaultId) {
  const [target, setTarget] = useState({ id: defaultId, restart: 0 });
  useEffect(() => setTarget(previous => previous.id === defaultId ? previous : { id: defaultId, restart: previous.restart + 1 }), [defaultId]);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    let current = null;
    const follow = event => {
      const found = resolvePreviewTarget(event.target);
      if (!found) { current = null; return; }
      if (found.element === current) return;
      current = found.element;
      setTarget(previous => ({ id: found.id, restart: previous.restart + 1 }));
    };
    root.addEventListener('pointerover', follow);
    root.addEventListener('focusin', follow);
    return () => { root.removeEventListener('pointerover', follow); root.removeEventListener('focusin', follow); };
  }, [rootRef]);
  return target;
}
