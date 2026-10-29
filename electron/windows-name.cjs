// Windows filename rules for one file or folder name (one path segment).
// Characters <>:"/\|?* and control characters are not allowed, a name cannot
// end in a dot or space, and CON, PRN, AUX, NUL, COM1-9 and LPT1-9 are reserved
// (also with an extension, such as CON.txt).
const FORBIDDEN = /[<>:"/\\|?*\x00-\x1f]/;
const FORBIDDEN_ALL = /[<>:"/\\|?*\x00-\x1f]/g;
const RESERVED = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;

/** True when Windows accepts `name` as it is. */
function isWindowsName(name) {
  return typeof name === 'string' && name.length > 0 && !FORBIDDEN.test(name) && !/[. ]$/.test(name) && !RESERVED.test(name);
}

/**
 * A name Windows accepts.
 * With `reject` (an error message) an unusable name is refused and returned unchanged otherwise.
 * Without it the name is repaired: forbidden characters become `_`, trailing
 * dots and spaces go, a reserved name gets a leading `_`, and an empty result
 * becomes `fallback`.
 */
function safeWindowsName(name, { reject, fallback = 'Untitled' } = {}) {
  if (reject) {
    if (!isWindowsName(name)) throw Error(reject);
    return name;
  }
  let safe = String(name ?? '').replace(FORBIDDEN_ALL, '_').replace(/[. ]+$/g, '').trim();
  if (!safe || /^\.+$/.test(safe)) safe = fallback;
  if (RESERVED.test(safe)) safe = '_' + safe;
  return safe;
}

module.exports = { isWindowsName, safeWindowsName };
