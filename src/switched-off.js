// Modules the owner has switched off for now (26 Nov 2026: ANIM "will only come back
// when it is useful"). Their code stays; the toolbar icon, menu item and key are gone.
// Delete an id here to bring that module back.
export const SWITCHED_OFF = new Set(['animXL']);
export const switchedOff = id => SWITCHED_OFF.has(id);
// Hotkey rows of a switched-off module (its command and its window keys, e.g. animxl:undo).
const KEY_PREFIXES = { animXL: 'animxl:' };
export const switchedOffKey = id => switchedOff(id) || [...SWITCHED_OFF].some(off => KEY_PREFIXES[off] && id.startsWith(KEY_PREFIXES[off]));
