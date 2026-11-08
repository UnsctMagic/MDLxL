/** The empty saved-preset lists. A module of its own, because preferences.js and
 * settings-presets.js import each other: this constant must be ready whichever of
 * the two is loaded first. */
export const DEFAULT_SETTINGS_PRESETS = Object.freeze({
  mouse: Object.freeze([]), rotate: Object.freeze([]), uv: Object.freeze([]), hotkeys: Object.freeze([]),
});
