import { normalizePreferences, migratePreferences } from './preferences.js';

const localPreferences = new Set(['settingsPresets', 'uvRightUpDefault']);
const isRecord = value => value && typeof value === 'object' && !Array.isArray(value);

/** Fixed settings sections can be partial. A supplied list or key map is complete. */
function preserveMissingFields(input, imported, previous, shape) {
  if (!isRecord(input) || !isRecord(imported) || !isRecord(shape) || !Object.keys(shape).length) return imported;
  const result = { ...imported };
  for (const [key, childShape] of Object.entries(shape)) {
    if (Object.hasOwn(input, key)) result[key] = preserveMissingFields(input[key], imported[key], previous?.[key], childShape);
    else if (previous && Object.hasOwn(previous, key)) result[key] = previous[key];
  }
  return result;
}

export function exportConfiguration(preferences) {
  const portable = Object.fromEntries(Object.entries(normalizePreferences(preferences)).filter(([key]) => !localPreferences.has(key)));
  return { schema: 'mdlxl-configuration', version: 1, preferences: portable };
}
/** Validate before applying the portable preferences supplied by the file. */
export function importConfiguration(input, current = {}) {
  const data = typeof input === 'string' ? JSON.parse(input) : input;
  if (data?.schema !== 'mdlxl-configuration' || data.version !== 1 || !data.preferences || typeof data.preferences !== 'object' || Array.isArray(data.preferences)) throw new Error('Unsupported MDLxL configuration. Expected version 1.');
  const supplied = data.preferences, p = migratePreferences(supplied), defaults = normalizePreferences({});
  for (const key of Object.keys(p)) if (!(key in defaults)) throw new Error(`Unknown preference: ${key}.`);
  const normalized = normalizePreferences(p);
  // Exported values are canonical; malformed/out-of-range values must not silently reset.
  const compare = (a,b,path) => {
    if (Array.isArray(a)) { if (!Array.isArray(b) || a.length!==b.length) throw new Error(`Invalid ${path}.`); a.forEach((v,i)=>compare(v,b[i],`${path}[${i}]`)); }
    else if (a && typeof a==='object') { for (const [k,v] of Object.entries(a)) compare(v,b?.[k],`${path}.${k}`); }
    else if (a!==b) throw new Error(`Invalid ${path}.`);
  };
  compare(migratePreferences(p),normalized,'preferences');
  // Scope-aware shortcut clashes are checked where the catalog is known (configurationHotkeyConflict).
  const provided = Object.keys(p).filter(key => !localPreferences.has(key) &&
    (Object.hasOwn(supplied, key) || key === 'learn' && Object.hasOwn(supplied, 'shredder')));
  const previous = normalizePreferences(current);
  const patch = Object.fromEntries(provided.map(key => {
    const input = Object.hasOwn(supplied, key) ? supplied[key] : supplied.shredder;
    return [key, preserveMissingFields(input, normalized[key], previous[key], defaults[key])];
  }));
  return normalizePreferences({ ...previous, ...patch });
}
