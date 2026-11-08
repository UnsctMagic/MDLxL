import { normalizePreferences, migratePreferences } from './preferences.js';

export function exportConfiguration(preferences) {
  return {schema:'mdlxl-configuration', version:1, preferences:normalizePreferences(preferences)};
}
/** Validate before applying: import replaces portable preferences in one update.
 * Machine paths, recovery data and model content are never exported.
 */
export function importConfiguration(input) {
  const data = typeof input === 'string' ? JSON.parse(input) : input;
  if (data?.schema !== 'mdlxl-configuration' || data.version !== 1 || !data.preferences || typeof data.preferences !== 'object' || Array.isArray(data.preferences)) throw new Error('Unsupported MDLxL configuration. Expected version 1.');
  const p = migratePreferences(data.preferences), defaults = normalizePreferences({});
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
  return normalized;
}
