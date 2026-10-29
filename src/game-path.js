/** One game-path key: backslashes, lower case, `''` for a missing name. */
export const gamePathKey = value => String(value || '').replaceAll('/', '\\').toLowerCase();
export const toBackslashes = value => String(value || '').replaceAll('/', '\\');
export const toForwardSlashes = value => String(value || '').replaceAll('\\', '/');
