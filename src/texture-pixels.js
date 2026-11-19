// Texture files as data: the header (format, size, mipmaps) without decoding, and decoded pixels as
// a coarse colour grid, statistics and colour regions, so the AI can find an eye on an atlas.

/** Format, width, height, alpha bits and mipmap count from a BLP1, BLP2, DDS or TGA header. */
export function textureInfo(bytes, name = '') {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength), info = { bytes: b.byteLength };
  const magic = b.byteLength >= 4 ? String.fromCharCode(b[0], b[1], b[2], b[3]) : '';
  const mips = at => { let count = 0; for (let i = 0; i < 16 && at + 64 + i * 4 + 4 <= b.byteLength; i++) if (view.getUint32(at + 64 + i * 4, true)) count++; return count; };
  if (magic === 'BLP1' && b.byteLength >= 156) {
    const compression = view.getUint32(4, true);
    return { ...info, format: compression === 0 ? 'BLP1 JPEG' : 'BLP1 palette', alphaBits: view.getUint32(8, true), width: view.getUint32(12, true), height: view.getUint32(16, true), mipmaps: mips(28) };
  }
  if (magic === 'BLP2' && b.byteLength >= 148) {
    const encoding = b[8], alphaType = b[10];
    const format = encoding === 1 ? 'BLP2 palette' : encoding === 2 ? `BLP2 ${alphaType === 7 ? 'DXT5' : alphaType === 1 ? 'DXT3' : 'DXT1'}` : 'BLP2 ARGB';
    return { ...info, format, alphaBits: b[9], width: view.getUint32(12, true), height: view.getUint32(16, true), mipmaps: mips(20) };
  }
  if (magic === 'DDS ' && b.byteLength >= 128) {
    const fourCC = String.fromCharCode(b[84], b[85], b[86], b[87]).replace(/\0/g, '');
    return { ...info, format: 'DDS ' + (fourCC || 'uncompressed'), width: view.getUint32(16, true), height: view.getUint32(12, true), mipmaps: Math.max(1, view.getUint32(28, true)) };
  }
  if (/\.tga$/i.test(name) && b.byteLength >= 18)
    return { ...info, format: 'TGA', width: view.getUint16(12, true), height: view.getUint16(14, true), alphaBits: b[17] & 15, mipmaps: 1 };
  return { ...info, format: (name.split('.').pop() || 'unknown').toUpperCase() };
}

const hex = (r, g, b) => '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
const parseColor = text => {
  const match = /^#?([0-9a-f]{6})$/i.exec(String(text || '').trim());
  if (!match) throw Error('Choose a colour as #rrggbb.');
  const n = parseInt(match[1], 16);
  return [n >> 16 & 255, n >> 8 & 255, n & 255];
};

/**
 * Pixels of a decoded image ({ width, height, data: RGBA }) as data:
 * - region [left, top, right, bottom] in UV (0..1, top-left origin, as TVertices) or pixels (units);
 * - grid: average colours over the region, up to 64 cells on the longer side (default 16), as rows of
 *   "#rrggbb" strings, with alpha rows when any pixel is not opaque;
 * - stats: mean colour, brightness range, transparent share and the main colours;
 * - find { color, tolerance }: connected regions of pixels within tolerance of the colour (largest
 *   first), each with its box in pixels and UV, centre, size and mean colour.
 */
export function texturePixels(image, { region, units = 'uv', grid = 16, find } = {}) {
  const { width, height, data } = image;
  if (!(width > 0 && height > 0) || !data || data.length < width * height * 4) throw Error('The texture could not be decoded.');
  if (!Number.isInteger(grid) || grid < 1 || grid > 64) throw Error('Choose a grid of 1-64 cells.');
  if (!['uv', 'pixels'].includes(units)) throw Error('Choose uv or pixels units.');
  let [x0, y0, x1, y1] = region ?? (units === 'uv' ? [0, 0, 1, 1] : [0, 0, width, height]);
  if (![x0, y0, x1, y1].every(Number.isFinite)) throw Error('Choose a region of four numbers.');
  if (units === 'uv') { x0 *= width; x1 *= width; y0 *= height; y1 *= height; }
  // UV outside 0..1 repeats the texture; the region is read inside one tile.
  const clampX = v => Math.max(0, Math.min(width, Math.round(v))), clampY = v => Math.max(0, Math.min(height, Math.round(v)));
  [x0, x1] = [clampX(Math.min(x0, x1)), clampX(Math.max(x0, x1))]; [y0, y1] = [clampY(Math.min(y0, y1)), clampY(Math.max(y0, y1))];
  if (x1 - x0 < 1 || y1 - y0 < 1) throw Error('The region is empty.');
  const w = x1 - x0, h = y1 - y0, cols = Math.max(1, Math.round(grid * (w >= h ? 1 : w / h))), rows = Math.max(1, Math.round(grid * (h >= w ? 1 : h / w)));
  const at = (x, y) => (y * width + x) * 4;
  const colours = [], alphas = [];
  let translucent = false;
  for (let r = 0; r < rows; r++) {
    const line = [], alphaLine = [];
    for (let c = 0; c < cols; c++) {
      const xa = x0 + Math.floor(c * w / cols), xb = Math.max(xa + 1, x0 + Math.floor((c + 1) * w / cols));
      const ya = y0 + Math.floor(r * h / rows), yb = Math.max(ya + 1, y0 + Math.floor((r + 1) * h / rows));
      let sr = 0, sg = 0, sb = 0, sa = 0, n = 0;
      for (let y = ya; y < yb; y++) for (let x = xa; x < xb; x++) { const i = at(x, y); sr += data[i]; sg += data[i + 1]; sb += data[i + 2]; sa += data[i + 3]; n++; }
      line.push(hex(sr / n, sg / n, sb / n));
      alphaLine.push(Math.round(sa / n));
      if (sa / n < 250) translucent = true;
    }
    colours.push(line.join(' ')); alphas.push(alphaLine.join(' '));
  }
  // Statistics over the region; main colours from a 4-bit-per-channel histogram.
  const buckets = new Map();
  let mr = 0, mg = 0, mb = 0, clear = 0, lo = 255, hi = 0, n = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = at(x, y), r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3], light = .299 * r + .587 * g + .114 * b;
    mr += r; mg += g; mb += b; n++; if (a < 128) clear++; lo = Math.min(lo, light); hi = Math.max(hi, light);
    const key = (r >> 4) << 8 | (g >> 4) << 4 | b >> 4, bucket = buckets.get(key) || [0, 0, 0, 0];
    bucket[0]++; bucket[1] += r; bucket[2] += g; bucket[3] += b; buckets.set(key, bucket);
  }
  const main = [...buckets.values()].sort((a, b) => b[0] - a[0]).slice(0, 6).map(([count, r, g, b]) => ({ color: hex(r / count, g / count, b / count), share: Number((count / n).toFixed(3)) }));
  const result = {
    width, height, region: { pixels: [x0, y0, x1, y1], uv: [x0 / width, y0 / height, x1 / width, y1 / height].map(v => Number(v.toFixed(4))) },
    grid: { columns: cols, rows, cellPixels: [Number((w / cols).toFixed(2)), Number((h / rows).toFixed(2))], colors: colours, ...(translucent ? { alpha: alphas } : {}) },
    stats: { mean: hex(mr / n, mg / n, mb / n), brightness: [Math.round(lo), Math.round(hi)], transparent: Number((clear / n).toFixed(3)), main },
  };
  if (find) result.found = findColor(image, [x0, y0, x1, y1], find);
  return result;
}

// Connected regions (4-neighbour) of pixels within tolerance of a colour, inside the read region.
function findColor({ width, height, data }, [x0, y0, x1, y1], { color, tolerance = 48, limit = 8 } = {}) {
  const target = parseColor(color);
  if (!(Number.isFinite(tolerance) && tolerance >= 0 && tolerance <= 442)) throw Error('Choose a tolerance of 0-442.');
  const w = x1 - x0, h = y1 - y0, seen = new Uint8Array(w * h), regions = [];
  const match = (x, y) => { const i = (y * width + x) * 4; return data[i + 3] >= 16 && Math.hypot(data[i] - target[0], data[i + 1] - target[1], data[i + 2] - target[2]) <= tolerance; };
  let total = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    if (seen[(y - y0) * w + x - x0] || !match(x, y)) continue;
    const stack = [[x, y]], box = [x, y, x, y];
    let count = 0, sx = 0, sy = 0, sr = 0, sg = 0, sb = 0;
    seen[(y - y0) * w + x - x0] = 1;
    while (stack.length) {
      const [px, py] = stack.pop(), i = (py * width + px) * 4;
      count++; sx += px; sy += py; sr += data[i]; sg += data[i + 1]; sb += data[i + 2];
      box[0] = Math.min(box[0], px); box[1] = Math.min(box[1], py); box[2] = Math.max(box[2], px); box[3] = Math.max(box[3], py);
      for (const [nx, ny] of [[px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]]) {
        if (nx < x0 || ny < y0 || nx >= x1 || ny >= y1 || seen[(ny - y0) * w + nx - x0] || !match(nx, ny)) continue;
        seen[(ny - y0) * w + nx - x0] = 1; stack.push([nx, ny]);
      }
    }
    total += count;
    regions.push({ pixels: [box[0], box[1], box[2] + 1, box[3] + 1], uv: [box[0] / width, box[1] / height, (box[2] + 1) / width, (box[3] + 1) / height].map(v => Number(v.toFixed(4))),
      centre: { pixels: [Math.round(sx / count), Math.round(sy / count)], uv: [Number((sx / count / width).toFixed(4)), Number((sy / count / height).toFixed(4))] },
      size: count, mean: hex(sr / count, sg / count, sb / count) });
  }
  return { color, tolerance, matching: total, share: Number((total / (w * h)).toFixed(4)), regions: regions.sort((a, b) => b.size - a.size).slice(0, limit), more: Math.max(0, regions.length - limit) };
}
