import { APPLICATION_THEMES, DEFAULT_VISUALS, LIGHT_DARK_KEYS } from './preferences.js';
import { DEFAULT_PAINT_APPEARANCE } from './paint-appearance.js';
import { BUILT_IN_VIEWPORT_PRESETS, viewportPresetById } from './viewport-appearance.js';

const colorValues = value => Object.fromEntries(Object.entries(value).filter(([, color]) => typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)));
export const APPEARANCE_HELPER_KEYS = Object.freeze(['keyframe', 'activeKeyframe', 'bone', 'node', 'particle', 'event', 'selection', 'uvSelection']);
export const helpersForPreset = preset => preset.theme === 'light' ? colorValues(Object.fromEntries(APPEARANCE_HELPER_KEYS.map(key => [key, DEFAULT_VISUALS[key]]))) : { keyframe: preset.appearance.controllers.color, activeKeyframe: preset.appearance.controllers.selected, bone: preset.appearance.tree.nodes.bone, node: preset.appearance.tree.nodes.attachment, particle: preset.appearance.tree.nodes.emitter, event: preset.appearance.tree.nodes.spawn, selection: preset.appearance.controllers.selected, uvSelection: preset.appearance.controllers.pinned };
export const paintForPreset = preset => preset.theme === 'light' ? colorValues(DEFAULT_PAINT_APPEARANCE) : { brushTipLight: '#242424', brushTipDark: APPLICATION_THEMES[preset.theme].colors.text, brushCursor: APPLICATION_THEMES[preset.theme].colors.text, geosetSelection: preset.appearance.controllers.color, geosetBorder: preset.appearance.controllers.selected, lampSelection: preset.appearance.controllers.pinned };

/** The preference change that loading a viewport preset makes, as in Settings › Appearance. */
export function viewportPresetChange(prefs, id) {
  const preset = viewportPresetById(id, prefs.viewportPresets);
  if (!preset) return null;
  return { viewportPreset: id, viewportAppearance: preset.appearance, ...(preset.theme ? { theme: preset.theme, accent: preset.accent || APPLICATION_THEMES[preset.theme].accent } : {}), ...(BUILT_IN_VIEWPORT_PRESETS[id] ? { visuals: { ...prefs.visuals, ...helpersForPreset(preset) }, citadelPaint: { ...prefs.citadelPaint, ...paintForPreset(preset) } } : {}) };
}

// Each built-in look's counterpart on the other side: neutral greys pair with
// neutral greys, the warm darks with warm Silvermoon, the cool darks with Lordaeron.
export const LIGHT_DARK_PARTNERS = Object.freeze({
  'mdlvis-vanilla': 'blender-style', 'blender-style': 'mdlvis-vanilla',
  'solarized-light': 'warm-graphite', 'warm-graphite': 'solarized-light', 'gruvbox-dark': 'solarized-light',
  'nord': 'mdlvis-vanilla', 'catppuccin-mocha': 'mdlvis-vanilla',
});
const presetForTheme = theme => Object.values(BUILT_IN_VIEWPORT_PRESETS).find(preset => preset.theme === theme)?.id;
export const themeScheme = theme => APPLICATION_THEMES[theme]?.scheme === 'dark' ? 'dark' : 'light';
const snapshot = prefs => Object.fromEntries(LIGHT_DARK_KEYS.map(key => [key, prefs[key]]));

/**
 * Photoshop-style Shift+F1 (darker) / Shift+F2 (lighter). Switching back
 * restores the user's own look from the other side exactly, customizations
 * included; the first switch uses the chosen look's built-in counterpart.
 * Returns null when the interface is already on the requested side.
 */
export function lightDarkChange(prefs, scheme) {
  if (themeScheme(prefs.theme) === scheme) return null;
  const saved = prefs.lightDarkReturn;
  const restored = saved && themeScheme(saved.theme) === scheme ? snapshot(saved) : null;
  const partner = LIGHT_DARK_PARTNERS[prefs.viewportPreset] || LIGHT_DARK_PARTNERS[presetForTheme(prefs.theme)] || (scheme === 'dark' ? 'blender-style' : 'mdlvis-vanilla');
  return { ...(restored || viewportPresetChange(prefs, partner)), lightDarkReturn: snapshot(prefs) };
}
