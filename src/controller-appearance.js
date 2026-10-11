import themes from './application-themes.json' with { type: 'json' };

export const CONTROLLER_SHAPES = Object.freeze(['circle', 'square', 'diamond', 'triangle']);
export const PIN_STYLES = Object.freeze(['label', 'icon', 'round']);
const looks = {
  light: ['circle', 'diamond', 'triangle', 'label', '#174aa1', '#995400', '#198054'],
  dark: ['square', 'diamond', 'triangle', 'icon', '#ffb765', '#fff0db', '#ffd166'],
  'warm-dark': ['square', 'square', 'diamond', 'label', '#e6bd86', '#fff0dc', '#e7a358'],
  nord: ['diamond', 'circle', 'triangle', 'round', '#88c0d0', '#eceff4', '#a3be8c'],
  'solarized-light': ['circle', 'diamond', 'square', 'label', '#006b9a', '#b34c1b', '#687700'],
  'gruvbox-dark': ['triangle', 'square', 'diamond', 'icon', '#b8bb26', '#fbf1c7', '#fabd2f'],
  'catppuccin-mocha': ['diamond', 'circle', 'circle', 'round', '#cba6f7', '#f5e0dc', '#a6e3a1'],
};
export function controllerAppearanceForTheme(id = 'light') {
  const theme = themes[id] || themes.light;
  const [shape, bodyShape, bendShape, pinStyle, color, selected, pinned] = looks[id] || looks.light;
  return { shape, bodyShape, bendShape, pinStyle, color, selected, pinned, background: theme.colors.field,
    skeleton: theme.colors.link, outline: theme.colors.text, symbols: true, size: 17,
    axisX: theme.scheme === 'light' ? '#ce3434' : '#fa6975', axisY: theme.scheme === 'light' ? '#248142' : '#77cf80', axisZ: theme.scheme === 'light' ? '#236ac2' : '#77aaff' };
}
export const DEFAULT_CONTROLLER_APPEARANCE = Object.freeze(controllerAppearanceForTheme());
export function normalizeControllerAppearance(value, fallback = DEFAULT_CONTROLLER_APPEARANCE) {
  const input = value && typeof value === 'object' ? value : {}, base = { ...DEFAULT_CONTROLLER_APPEARANCE, ...fallback };
  const output = {};
  for (const key of ['color', 'selected', 'pinned', 'background', 'skeleton', 'outline', 'axisX', 'axisY', 'axisZ']) output[key] = /^#[0-9a-f]{6}$/i.test(input[key]) ? input[key].toLowerCase() : base[key];
  for (const key of ['shape', 'bodyShape', 'bendShape']) output[key] = CONTROLLER_SHAPES.includes(input[key]) ? input[key] : base[key];
  output.pinStyle = PIN_STYLES.includes(input.pinStyle) ? input.pinStyle : base.pinStyle;
  output.symbols = typeof input.symbols === 'boolean' ? input.symbols : base.symbols;
  output.size = Number.isFinite(input.size) ? Math.max(12, Math.min(24, input.size)) : base.size;
  return output;
}

// One outline is shared by canvas rendering and the Settings preview.
export function controllerShapePoints(shape, radius) {
  if (shape === 'square') return [[-radius, -radius], [radius, -radius], [radius, radius], [-radius, radius]];
  if (shape === 'diamond') return [[0, -radius], [radius, 0], [0, radius], [-radius, 0]];
  if (shape === 'triangle') return [[0, -radius], [radius, radius], [-radius, radius]];
  return null;
}
