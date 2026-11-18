// Pure geometry for the AI's UV layout pictures and zoomed close-ups. Drawing happens in
// app/ai-editor.js; everything here works on plain model data so it can be tested.

export const UV_PICTURE_LONG_SIDE = 1024;

const textureIdOf = layer => {
  const id = layer?.TextureID;
  if (Number.isInteger(id)) return id;
  const first = id?.Keys?.[0]?.Vector?.[0];
  return Number.isInteger(first) ? first : null;
};

/** The geoset's UV coordinates for one set, or null when it has none. */
export function uvArray(geoset, uvSet = 0) {
  const uv = geoset?.TVertices?.[uvSet];
  return uv && uv.length >= 2 ? uv : null;
}

/** Unique triangle edges in UV space as flat [u0, v0, u1, v1, ...]. */
export function uvEdges(geoset, uvSet = 0) {
  const uv = uvArray(geoset, uvSet),
    faces = geoset?.Faces;
  if (!uv || !faces) return [];
  const count = uv.length / 2,
    seen = new Set(),
    out = [];
  for (let i = 0; i + 2 < faces.length; i += 3)
    for (let j = 0; j < 3; j++) {
      const a = faces[i + j],
        b = faces[i + ((j + 1) % 3)];
      if (!(a < count) || !(b < count)) continue;
      const key = Math.min(a, b) * 0x100000 + Math.max(a, b);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(uv[a * 2], uv[a * 2 + 1], uv[b * 2], uv[b * 2 + 1]);
    }
  return out;
}

/** Smallest box around the used UVs of the geosets, or null when there are none. */
export function uvBounds(geosets, uvSet = 0) {
  let minU = Infinity,
    maxU = -Infinity,
    minV = Infinity,
    maxV = -Infinity;
  for (const geoset of geosets) {
    const uv = uvArray(geoset, uvSet);
    if (!uv) continue;
    const used = new Set(geoset.Faces || []);
    for (const i of used) {
      const u = uv[i * 2],
        v = uv[i * 2 + 1];
      if (!Number.isFinite(u) || !Number.isFinite(v)) continue;
      if (u < minU) minU = u;
      if (u > maxU) maxU = u;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
  }
  return minU === Infinity ? null : { minU, maxU, minV, maxV };
}

/** The drawn range: always the whole 0..1 picture, widened to whole tiles around the UVs. */
export function uvRange(bounds) {
  const b = bounds || { minU: 0, maxU: 1, minV: 0, maxV: 1 };
  const lo = v => Math.min(0, Math.floor(v + 1e-6)),
    hi = v => Math.max(1, Math.ceil(v - 1e-6));
  return { minU: lo(b.minU), maxU: hi(b.maxU), minV: lo(b.minV), maxV: hi(b.maxV) };
}

/** Pixel size of a UV range picture with the longest side at `longSide`. */
export function uvPictureSize(range, longSide = UV_PICTURE_LONG_SIDE) {
  const w = range.maxU - range.minU,
    h = range.maxV - range.minV,
    scale = longSide / Math.max(w, h);
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

/** UV positions [u, v] of the given vertices (marked vertices) in one geoset. */
export function markedUvPoints(geoset, ids = [], uvSet = 0) {
  const uv = uvArray(geoset, uvSet);
  if (!uv) return [];
  return ids.filter(i => Number.isInteger(i) && i >= 0 && i * 2 + 1 < uv.length).map(i => [uv[i * 2], uv[i * 2 + 1]]);
}

/** The geoset's first-layer texture: { textureId, path, replaceableId }, or null when it has none. */
export function geosetTexture(model, geoset) {
  const layer = model.Materials?.[geoset?.MaterialID]?.Layers?.[0],
    textureId = textureIdOf(layer),
    texture = textureId == null ? null : model.Textures?.[textureId];
  if (!texture) return null;
  return { textureId, path: texture.Image || '', replaceableId: texture.ReplaceableId || 0 };
}

/** Geoset ids grouped by the texture they use, so each texture gets one picture. */
export function groupGeosetsByTexture(model, geosetIds) {
  const groups = new Map();
  for (const id of geosetIds) {
    const geoset = model.Geosets[id];
    if (!geoset) continue;
    const texture = geosetTexture(model, geoset),
      key = texture ? (texture.path ? 'path:' + texture.path.toLowerCase() : 'replaceable:' + texture.replaceableId) : 'none';
    if (!groups.has(key)) groups.set(key, { key, texture, geosets: [] });
    groups.get(key).geosets.push(id);
  }
  return [...groups.values()];
}

/** Which geosets a UV picture shows: those asked for, else those with marked vertices, else all. */
export function uvPictureGeosets(model, requested, marked = {}) {
  const exists = id => Number.isInteger(id) && !!model.Geosets[id];
  if (requested?.length) return requested.filter(exists);
  const withMarks = Object.keys(marked)
    .map(Number)
    .filter(id => exists(id) && marked[id]?.length);
  return withMarks.length ? withMarks : model.Geosets.map((_, id) => id);
}

/**
 * A box around flat [x, y, z, ...] points, shrunk about its centre by `zoom`, as its eight
 * corners (the points api.fit frames). A zoom of 1 frames the points as they are.
 */
export function zoomedFocus(points, zoom = 1) {
  if (!points?.length) return points;
  const z = Math.min(8, Math.max(1, Number(zoom) || 1)),
    lo = [Infinity, Infinity, Infinity],
    hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i + 2 < points.length; i += 3)
    for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k], points[i + k]);
      hi[k] = Math.max(hi[k], points[i + k]);
    }
  const mid = lo.map((v, k) => (v + hi[k]) / 2),
    half = lo.map((v, k) => (hi[k] - v) / 2 / z);
  const corners = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const w of [-1, 1]) corners.push(mid[0] + x * half[0], mid[1] + y * half[1], mid[2] + w * half[2]);
  return corners;
}

/** Zoom as a whole-model close-up needs it: a null focus (whole model) has no points to shrink yet. */
export const clampZoom = zoom => (Number.isFinite(zoom) ? Math.min(8, Math.max(1, zoom)) : 1);
