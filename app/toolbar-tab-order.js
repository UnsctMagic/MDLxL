/**
 * The Hidden toolbar stays mounted off-screen so its keys still reach it, but Tab must
 * not stop on what cannot be seen. tabindex -1 rather than inert: a key still has to
 * find, focus and press these controls. A control that sets its own tabindex is left alone.
 */
const FOCUSABLE = 'a[href],button,input,select,textarea,summary';
const MARK = 'data-toolbar-no-tab';

export function setToolbarTabStops(root, off) {
  if (!off) { for (const element of root.querySelectorAll(`[${MARK}]`)) { element.removeAttribute('tabindex'); element.removeAttribute(MARK); } return; }
  for (const element of root.querySelectorAll(FOCUSABLE)) if (!element.hasAttribute('tabindex')) { element.setAttribute('tabindex', '-1'); element.setAttribute(MARK, ''); }
}
