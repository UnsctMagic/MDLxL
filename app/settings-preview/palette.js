/** Scene colours: the stage is the user's own viewport background, so everything
 * drawn on it is chosen against that colour rather than the window theme. */
import { viewportAppearanceOptions, visualOptions } from '../../src/preferences.js';

const HEX = /^#[0-9a-f]{6}$/i;
export const rgb = hex => [1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16));
const toHex = channels => '#' + channels.map(value => Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, '0')).join('');
export const mix = (from, to, amount) => { const end = rgb(to); return toHex(rgb(from).map((value, i) => value + (end[i] - value) * amount)); };
export function luminance(hex) {
  const [r, g, b] = rgb(hex).map(value => { const s = value / 255; return s <= .03928 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4; });
  return .2126 * r + .7152 * g + .0722 * b;
}
export const contrast = (a, b) => { const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (high + .05) / (low + .05); };
/** `color`, pushed toward black or white only as far as it takes to read on `stage`. */
export function legible(color, stage, ratio = 3) {
  const target = luminance(stage) > .3 ? '#000000' : '#ffffff';
  for (let amount = 0; amount <= 1; amount += .05) { const next = mix(color, target, amount); if (contrast(next, stage) >= ratio) return next; }
  return target;
}
const colorOr = (value, fallback) => HEX.test(value) ? value : fallback;

/** The real app's active-drag colours (movement-overlay.js). */
const PUSH = '#fff64a', CASING = '#162137';

export function previewLook(preferences) {
  const appearance = viewportAppearanceOptions(preferences), visuals = visualOptions(preferences);
  const stage = colorOr(appearance.background.color, '#cccccc');
  const ink = luminance(stage) > .3 ? '#1b1f26' : '#eef0f3';
  return {
    stage, ink, paper: luminance(stage) > .3 ? '#ffffff' : '#101318',
    accent: legible(colorOr(preferences?.accent, '#71b5f3'), stage), push: PUSH, casing: CASING,
    axes: { X: visuals.axisX, Y: visuals.axisY, Z: visuals.axisZ },
    handles: { X: appearance.controllers.axisX, Y: appearance.controllers.axisY, Z: appearance.controllers.axisZ },
    appearance, visuals,
  };
}
