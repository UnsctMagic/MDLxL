import { viewportAppearanceOptions } from '../src/preferences.js';
import { DEFAULT_BONE_APPEARANCE } from '../src/viewport-appearance.js';
import { drawPixelLine } from './pixel-lines.js';

// Shown on the Bone influence render mode and its Appearance page.
export const BONE_INFLUENCE_TIP = 'Bone influence: the model turns see-through so the skeleton stays visible. Parts the selected bone moves turn orange; parts that follow it through child bones turn pale orange.';

// Selection highlights are keyed by these classic colours throughout the rig
// code; the user's Bones & skeleton colours replace them only when drawing.
const HIGHLIGHT_ROLES = Object.freeze({ '#ff0000': 'selected', '#000000': 'parent', '#ffff00': 'child' });
export const boneHighlightRole = highlight => HIGHLIGHT_ROLES[highlight] || null;

// Markers ask for this once per node per frame; normalise each preferences object once.
const cache = new WeakMap();
export function boneDisplayOptions(preferences) {
  if (!preferences || typeof preferences !== 'object') return DEFAULT_BONE_APPEARANCE;
  let bones = cache.get(preferences);
  if (!bones) { bones = viewportAppearanceOptions(preferences).bones; cache.set(preferences, bones); }
  return bones;
}

export const boneDisplayColor = (bones, highlight, hasParentBone) => highlight ? bones[boneHighlightRole(highlight)] || highlight : hasParentBone ? bones.bone : bones.root;

export const BONE_DIAMOND = Object.freeze({
  vertices: [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]],
  faces: [[0,2,4],[2,1,4],[1,3,4],[3,0,4],[2,0,5],[1,2,5],[3,1,5],[0,3,5]],
});

const shade = progress => { const value = Math.round(progress * 255); return `rgb(${value},${value},${value})`; };

/**
 * One parent-to-child bone link. Shaded is the classic dark-to-light line;
 * Tapered narrows towards the child; Cone outlines a wide taper; Stick draws
 * thick bars. A highlighted chain keeps the same shape in the highlight colour.
 */
export function drawBoneLink(context, from, to, { bones = DEFAULT_BONE_APPEARANCE, highlight = null, ratio = 1, pixelBatch = null } = {}) {
  const color = highlight ? bones[boneHighlightRole(highlight)] || highlight : null;
  const width = (highlight ? bones.highlightThickness : bones.thickness) * (bones.connector === 'stick' ? 2 : 1);
  const shape = bones.connector;
  if (shape === 'shaded' || shape === 'stick') {
    const options = { color: color || shade, width, ratio };
    return pixelBatch ? pixelBatch.draw(from,to,options) : drawPixelLine(context,from,to,options);
  }
  const x0 = from.x * ratio, y0 = from.y * ratio, x1 = to.x * ratio, y1 = to.y * ratio, length = Math.hypot(x1 - x0, y1 - y0);
  if (length < 1) return;
  const start = (shape === 'cone' ? Math.max(10, width * 3.4) : width * 1.7) * ratio / 2, end = Math.max(.5, ratio / 2);
  const nx = -(y1 - y0) / length, ny = (x1 - x0) / length;
  context.save(); context.setTransform(1, 0, 0, 1, 0, 0);
  context.beginPath();
  context.moveTo(x0 + nx * start, y0 + ny * start); context.lineTo(x1 + nx * end, y1 + ny * end);
  context.lineTo(x1 - nx * end, y1 - ny * end); context.lineTo(x0 - nx * start, y0 - ny * start); context.closePath();
  if (color) context.fillStyle = color;
  else { const gradient = context.createLinearGradient(x0, y0, x1, y1); gradient.addColorStop(0, shade(0)); gradient.addColorStop(1, shade(1)); context.fillStyle = gradient; }
  context.fill();
  if (shape === 'cone') { context.lineWidth = Math.max(1, ratio); context.strokeStyle = color ? '#000000' : '#202020'; context.stroke(); }
  context.restore();
}
