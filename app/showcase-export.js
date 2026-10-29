import LEVELS from '../electron/data/showcase-gif-levels.json' with { type: 'json' };

// One quality ladder decides the GIF's size limit, colors, file-size budget,
// render quality and default FPS. The encoder reads the same table.
export const SHOWCASE_GIF_LEVELS = LEVELS;
export const DEFAULT_GIF_LEVEL = 'medium';
export const gifLevel = id => Object.hasOwn(LEVELS, id) ? id : DEFAULT_GIF_LEVEL;
// Pixels captured before the encoder's downscale, for smoother edges.
export const gifCaptureSize = id => Math.min(1920, Math.round(LEVELS[gifLevel(id)].longEdge * 1.5));
export const gifMegabytes = id => LEVELS[gifLevel(id)].maxBytes / 1e6;

// Setups saved before the ladder: Low Size became Medium, the old 864 px local
// GIF is High.
export function legacyGifLevel(setup, exportTarget) {
  if (Object.hasOwn(LEVELS, setup?.gifLevel)) return setup.gifLevel;
  return exportTarget === 'low-size' ? 'medium' : 'high';
}
