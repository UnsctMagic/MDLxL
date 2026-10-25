import { decodeBLP, getBLPImageData } from 'war3-model';
import { TGALoader } from 'three/addons/loaders/TGALoader.js';
import { decodeBlp2 } from './blp2.js';
import { decodeDds } from './dds.js';

/** Thumbnail decoding is isolated from imported assets and renderer textures. */
export function thumbnailPixels(asset) {
  const input = asset?.bytes;
  const buffer = input instanceof ArrayBuffer ? input : ArrayBuffer.isView(input) ? input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength) : null;
  if (!buffer) throw Error('Texture has no image data.');
  const name = String(asset.name || '').toLowerCase(), magic = buffer.byteLength >= 4 ? new DataView(buffer).getUint32(0, true) : 0;
  if (magic === 0x20534444 || name.endsWith('.dds')) return decodeDds(buffer);
  if (magic === 0x32504c42) return decodeBlp2(buffer);
  if (magic === 0x31504c42 || name.endsWith('.blp')) return getBLPImageData(decodeBLP(buffer), 0);
  if (name.endsWith('.tga')) return new TGALoader().parse(buffer);
  return null;
}

/** Where an area of a sheet lies in pixels and where its grid lines go: uv [u0, v0, u1, v1] with a
 * top-left origin (the whole sheet by default), grid lines every 1/grid of the whole sheet that fall
 * inside the area, each labelled with its u or v value. */
export function textureAreaLayout({ width, height }, uv = [0, 0, 1, 1], grid = 8) {
  if (!Array.isArray(uv) || uv.length !== 4 || uv.some(v => !Number.isFinite(v) || v < 0 || v > 1) || !(uv[2] > uv[0] && uv[3] > uv[1])) throw Error('uv must be [u0, v0, u1, v1] inside 0..1 with u1 > u0 and v1 > v0.');
  const sx = Math.floor(uv[0] * width), sy = Math.floor(uv[1] * height), sw = Math.max(1, Math.ceil(uv[2] * width) - sx), sh = Math.max(1, Math.ceil(uv[3] * height) - sy);
  // Finer lines when the area is small, so a picked rectangle can be read off the picture.
  const span = Math.min(uv[2] - uv[0], uv[3] - uv[1]), step = 1 / (grid * 2 ** Math.max(0, Math.floor(Math.log2(1 / span / 1.01))));
  const lines = (a, b) => { const out = []; for (let t = Math.ceil(a / step - 1e-9) * step; t <= b + 1e-9; t += step) out.push(Math.round(t * 1e4) / 1e4 || 0); return out; };
  return { sheet: [width, height], crop: [sx, sy, sw, sh], uv: [sx / width, sy / height, (sx + sw) / width, (sy + sh) / height], u: lines(uv[0], uv[2]), v: lines(uv[1], uv[3]) };
}

/** A picture of a texture area to choose paint by looking: the area scaled up (pixels kept sharp),
 * with a labelled uv grid in a margin. Returns { image, sheet: [width, height], uv }. */
export async function decodeTextureArea(asset, { uv, grid = 8, maxDimension = 768 } = {}) {
  if (typeof OffscreenCanvas === 'undefined') throw Error('Background texture previews are unavailable in this browser.');
  let bitmap = null;
  try {
    const pixels = thumbnailPixels(asset);
    let source;
    if (pixels) {
      source = new OffscreenCanvas(pixels.width, pixels.height);
      source.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height), 0, 0);
    } else { bitmap = await createImageBitmap(new Blob([asset.bytes])); source = bitmap; }
    const layout = textureAreaLayout(source, uv, grid), [sx, sy, sw, sh] = layout.crop;
    const scale = Math.max(1, Math.min(8, Math.floor(maxDimension / Math.max(sw, sh)) || 1)) * (Math.max(sw, sh) > maxDimension ? maxDimension / Math.max(sw, sh) : 1);
    const left = 44, top = 18, w = Math.round(sw * scale), h = Math.round(sh * scale);
    const canvas = new OffscreenCanvas(left + w + 4, top + h + 4), g = canvas.getContext('2d');
    g.fillStyle = '#202020'; g.fillRect(0, 0, canvas.width, canvas.height);
    // A checker shows transparent paint as holes.
    for (let y = 0; y < h; y += 8) for (let x = 0; x < w; x += 8) { g.fillStyle = (x + y) / 8 % 2 ? '#8a8a8a' : '#b0b0b0'; g.fillRect(left + x, top + y, 8, 8); }
    g.imageSmoothingEnabled = scale < 1;
    g.drawImage(source, sx, sy, sw, sh, left, top, w, h);
    g.font = '11px sans-serif'; g.textBaseline = 'top'; g.lineWidth = 1;
    const [W, H] = layout.sheet;
    for (const u of layout.u) { const x = left + (u * W - sx) * scale; g.strokeStyle = 'rgba(255,255,0,0.55)'; g.beginPath(); g.moveTo(x + 0.5, top); g.lineTo(x + 0.5, top + h); g.stroke(); g.fillStyle = '#ffeb3b'; g.fillText(String(u), Math.min(x + 2, left + w - 30), 3); }
    for (const v of layout.v) { const y = top + (v * H - sy) * scale; g.strokeStyle = 'rgba(0,255,255,0.55)'; g.beginPath(); g.moveTo(left, y + 0.5); g.lineTo(left + w, y + 0.5); g.stroke(); g.fillStyle = '#4dd0e1'; g.fillText(String(v), 2, Math.min(y + 1, top + h - 12)); }
    const png = new Uint8Array(await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer());
    let binary = ''; for (let offset = 0; offset < png.length; offset += 8192) binary += String.fromCharCode(...png.subarray(offset, offset + 8192));
    return { image: 'data:image/png;base64,' + btoa(binary), sheet: layout.sheet, uv: layout.uv };
  } finally { bitmap?.close(); }
}

export async function decodeTextureThumbnail(asset, maxDimension = 256) {
  if (typeof OffscreenCanvas === 'undefined') throw Error('Background texture previews are unavailable in this browser.');
  let bitmap = null;
  try {
    const pixels = thumbnailPixels(asset);
    let source;
    if (pixels) {
      source = new OffscreenCanvas(pixels.width, pixels.height);
      source.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height), 0, 0);
    } else { bitmap = await createImageBitmap(new Blob([asset.bytes])); source = bitmap; }
    const scale = Math.min(1, maxDimension / Math.max(source.width, source.height));
    const canvas = new OffscreenCanvas(Math.max(1, Math.round(source.width * scale)), Math.max(1, Math.round(source.height * scale)));
    canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
    const png = new Uint8Array(await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer());
    let binary = ''; for (let offset = 0; offset < png.length; offset += 8192) binary += String.fromCharCode(...png.subarray(offset, offset + 8192));
    return 'data:image/png;base64,' + btoa(binary);
  } finally { bitmap?.close(); }
}
