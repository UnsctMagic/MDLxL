// Small remembered choices (layouts, tabs, presets) kept in browser storage.
// Storage can be missing, private or full: reads fall back and writes are
// skipped, so the choice still applies for this session. Key names are the
// user's saved data; never rename one.

const identity = value => value;

/** A JSON value saved under `key`, passed through `normalize`; `fallback` when missing or unreadable. */
export function readStored(key, fallback, normalize = identity, storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(key);
    return raw == null ? fallback : normalize(JSON.parse(raw));
  } catch { return fallback; }
}

/** Saves `value` as JSON. Returns false when storage refused it. */
export function writeStored(key, value, storage = globalThis.localStorage) {
  try { storage?.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

/** A plain-text value saved under `key` (older keys store bare words, not JSON). */
export function readStoredText(key, fallback, normalize = identity, storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(key);
    return raw == null ? fallback : normalize(raw);
  } catch { return fallback; }
}

/** Saves `value` as plain text. Returns false when storage refused it. */
export function writeStoredText(key, value, storage = globalThis.localStorage) {
  try { storage?.setItem(key, String(value)); return true; } catch { return false; }
}
