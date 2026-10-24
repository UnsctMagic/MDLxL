import { backgroundImageRect } from '../src/viewport-appearance.js';

/** Center-cropped source rectangle for the same cover fit used on screen. */
export function backgroundCoverRect(imageWidth, imageHeight, width, height) {
  if (![imageWidth, imageHeight, width, height].every(value => Number.isFinite(value) && value > 0)) throw new Error('Background and preview dimensions must be positive.');
  const scale = Math.max(width / imageWidth, height / imageHeight), sourceWidth = width / scale, sourceHeight = height / scale;
  return { x: (imageWidth - sourceWidth) / 2, y: (imageHeight - sourceHeight) / 2, width: sourceWidth, height: sourceHeight };
}

export function drawPreviewBackground(context, width, height, image, color = '#ccc', options = {}) {
  context.save(); context.setTransform(1, 0, 0, 1, 0, 0); context.globalAlpha = 1; context.globalCompositeOperation = 'source-over';
  context.fillStyle = color; context.fillRect(0, 0, width, height);
  if (image) {
    context.globalAlpha = Number.isFinite(options.opacity) ? Math.max(0, Math.min(1, options.opacity)) : 1;
    if (options.display && options.display !== 'fill') {
      const rect = backgroundImageRect(image.videoWidth || image.naturalWidth || image.width, image.videoHeight || image.naturalHeight || image.height, width, height, options.display);
      if (rect) context.drawImage(image, rect.x, rect.y, rect.width, rect.height);
    } else {
      const rect = backgroundCoverRect(image.videoWidth || image.naturalWidth || image.width, image.videoHeight || image.naturalHeight || image.height, width, height);
      context.drawImage(image, rect.x, rect.y, rect.width, rect.height, 0, 0, width, height);
    }
  }
  context.restore();
}

export function composePreviewCapture(backgroundCanvas, modelCanvas, createCanvas = () => document.createElement('canvas')) {
  const snapshot = createCanvas(); snapshot.width = modelCanvas.width; snapshot.height = modelCanvas.height;
  const context = snapshot.getContext('2d');
  if (!context) throw new Error('Could not create a preview capture canvas.');
  context.drawImage(backgroundCanvas, 0, 0, snapshot.width, snapshot.height);
  context.drawImage(modelCanvas, 0, 0, snapshot.width, snapshot.height);
  return snapshot;
}

// Called synchronously after a normal render, before WebGL clears its buffer.
// Copy the viewport's own layers so floating windows never need to disappear.
export function composeViewportLayers(host, modelCanvas) {
  const snapshot = host.ownerDocument.createElement('canvas');
  snapshot.width = modelCanvas.width; snapshot.height = modelCanvas.height;
  const context = snapshot.getContext('2d'), bounds = modelCanvas.getBoundingClientRect();
  if (!context || !bounds.width || !bounds.height) throw new Error('The model viewport is not visible.');
  const scaleX = snapshot.width / bounds.width, scaleY = snapshot.height / bounds.height;
  const layers = [...host.querySelectorAll('canvas')].map((canvas, order) => {
    const style = host.ownerDocument.defaultView.getComputedStyle(canvas);
    return {canvas, order, style, z: Number(style.zIndex) || 0};
  }).sort((a,b) => a.z - b.z || a.order - b.order);
  for (const {canvas, style} of layers) {
    const rect = canvas.getBoundingClientRect();
    if (!canvas.width || !canvas.height || !rect.width || !rect.height || style.visibility === 'hidden' || style.display === 'none') continue;
    context.globalAlpha = Number(style.opacity);
    context.drawImage(canvas, (rect.x - bounds.x) * scaleX, (rect.y - bounds.y) * scaleY, rect.width * scaleX, rect.height * scaleY);
  }
  return snapshot;
}

/** Explicit preview Loop overrides the authored sequence's NonLooping flag. */
export function previewPlaybackStep(interval, frame, delta, loop = true) {
  const [start, end] = interval, duration = end - start;
  const current = Math.min(end, Math.max(start, frame)), elapsed = Math.max(0, Number(delta) || 0);
  if (!elapsed) return { frame: current, elapsed: 0, finished: false };
  if (!(duration > 0)) return { frame: start, elapsed: 0, finished: true };
  if (!loop && current + elapsed >= end) return { frame: start, elapsed: Math.max(0, end - current), finished: true };
  return { frame: loop ? start + ((current - start + elapsed) % duration) : current + elapsed, elapsed, finished: false };
}
