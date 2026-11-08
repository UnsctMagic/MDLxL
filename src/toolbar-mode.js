/** How the main toolbar is drawn. Graphic is today's look. */
export const TOOLBAR_MODES = Object.freeze(['graphic', 'trim', 'hidden']);
export const DEFAULT_TOOLBAR_MODE = 'graphic';
export const TOOLBAR_MODE_LABELS = Object.freeze({ graphic: 'Graphic', trim: 'toolbar-mode\u0004Trim', hidden: 'Hidden' });
export const normalizeToolbarMode = value => TOOLBAR_MODES.includes(value) ? value : DEFAULT_TOOLBAR_MODE;
export const nextToolbarMode = value => TOOLBAR_MODES[(TOOLBAR_MODES.indexOf(normalizeToolbarMode(value)) + 1) % TOOLBAR_MODES.length];
