const FOCUSABLE = 'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,[tabindex="0"]';

/**
 * Keeps Tab inside a modal window: Tab on the last visible control goes to the
 * first, Shift+Tab on the first (or on the window itself) goes to the last.
 * Call from the window's keydown handler. Returns true when it moved focus.
 */
export function trapTab(event, root) {
  if (event.key !== 'Tab' || event.defaultPrevented || !root) return false;
  const controls = [...root.querySelectorAll(FOCUSABLE)].filter(element => element.getClientRects().length);
  const first = controls[0], last = controls.at(-1), active = root.ownerDocument.activeElement;
  if (event.shiftKey && (active === first || active === root)) { event.preventDefault(); last?.focus(); return true; }
  if (!event.shiftKey && active === last) { event.preventDefault(); first?.focus(); return true; }
  return false;
}
