/** Shared value identity helpers: key-sorted, undefined-free, typed arrays as plain arrays. */
export function canonicalValue(value, { omit = [] } = {}) {
  const skip = new Set(omit);
  const walk = item => {
    if (Array.isArray(item) || ArrayBuffer.isView(item)) return Array.from(item, walk);
    if (item && typeof item === 'object') return Object.fromEntries(Object.keys(item).sort().filter(key => item[key] !== undefined && !skip.has(key)).map(key => [key, walk(item[key])]));
    return item;
  };
  return walk(value);
}
export const stableKey = (value, opts) => JSON.stringify(canonicalValue(value, opts));
export const typedJson = value => JSON.stringify(value, (_, v) => ArrayBuffer.isView(v) ? Array.from(v) : v);
