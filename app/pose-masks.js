// The Modern set: transparent PNG masks, tinted with the Symbol Color. [256 px, 64 px] per symbol.
// Literal new URL() calls are what lets the bundler find and ship the files.
let files = null; // built on first use: import.meta.url does not exist when a test bundles this file
const fileTable = () => files ||= {
  Hand: [new URL('./assets/pose-symbols/hand.png', import.meta.url).href, new URL('./assets/pose-symbols/hand-64.png', import.meta.url).href],
  Foot: [new URL('./assets/pose-symbols/foot.png', import.meta.url).href, new URL('./assets/pose-symbols/foot-64.png', import.meta.url).href],
  Hoof: [new URL('./assets/pose-symbols/hoof.png', import.meta.url).href, new URL('./assets/pose-symbols/hoof-64.png', import.meta.url).href],
  Head: [new URL('./assets/pose-symbols/head.png', import.meta.url).href, new URL('./assets/pose-symbols/head-64.png', import.meta.url).href],
  Neck: [new URL('./assets/pose-symbols/neck.png', import.meta.url).href, new URL('./assets/pose-symbols/neck-64.png', import.meta.url).href],
  Chest: [new URL('./assets/pose-symbols/chest.png', import.meta.url).href, new URL('./assets/pose-symbols/chest-64.png', import.meta.url).href],
  Spine: [new URL('./assets/pose-symbols/spine.png', import.meta.url).href, new URL('./assets/pose-symbols/spine-64.png', import.meta.url).href],
  Pelvis: [new URL('./assets/pose-symbols/pelvis.png', import.meta.url).href, new URL('./assets/pose-symbols/pelvis-64.png', import.meta.url).href],
  Body: [new URL('./assets/pose-symbols/body.png', import.meta.url).href, new URL('./assets/pose-symbols/body-64.png', import.meta.url).href],
  Wing: [new URL('./assets/pose-symbols/wing.png', import.meta.url).href, new URL('./assets/pose-symbols/wing-64.png', import.meta.url).href],
  Tail: [new URL('./assets/pose-symbols/tail.png', import.meta.url).href, new URL('./assets/pose-symbols/tail-64.png', import.meta.url).href],
  Object: [new URL('./assets/pose-symbols/object.png', import.meta.url).href, new URL('./assets/pose-symbols/object-64.png', import.meta.url).href],
  Magnet: [new URL('./assets/pose-symbols/magnet.png', import.meta.url).href, new URL('./assets/pose-symbols/magnet-64.png', import.meta.url).href],
};

export const poseMaskUrl = (name, small = false) => (fileTable()[name] || fileTable().Object)[small ? 1 : 0];

const images = new Map(), tinted = new Map();
function maskImage(name) {
  if (!images.has(name)) {
    const image = typeof Image === 'function' ? new Image() : null;
    if (image) { image.decoding = 'async'; image.src = poseMaskUrl(name, true); }
    images.set(name, image);
  }
  return images.get(name);
}
// Start loading every mask when the app starts so the first handles are not drawn empty.
if (typeof Image === 'function') for (const name of Object.keys(fileTable())) maskImage(name);

/** Draw one mask centred on (x, y) in the 24 x 24 unit box at the context's current scale, filled with `color`. */
export function drawPoseMask(context, name, x, y, color) {
  if (!fileTable()[name]) name = 'Object';
  const image = maskImage(name);
  if (!image?.complete || !image.naturalWidth) return;
  const key = name + '|' + color;
  let layer = tinted.get(key);
  if (!layer) {
    layer = document.createElement('canvas'); layer.width = image.naturalWidth; layer.height = image.naturalHeight;
    const paint = layer.getContext('2d'); paint.drawImage(image, 0, 0);
    paint.globalCompositeOperation = 'source-in'; paint.fillStyle = color; paint.fillRect(0, 0, layer.width, layer.height);
    if (tinted.size > 260) tinted.clear(); // colour-picker drags make many shades
    tinted.set(key, layer);
  }
  context.save(); context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
  context.drawImage(layer, x - 12, y - 12, 24, 24); context.restore();
}
