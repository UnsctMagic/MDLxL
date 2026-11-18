// The UV Wrapper's tools as one call each, for scripts: model in, UVs changed in place (run inside one
// Undo step with the 'Geosets' scope). `selection` is the marked UV points per geoset, { geosetIndex: [vertexIds] }
// (the same shape as the vertex selection). Nothing here makes a new texture, material or geoset.
import { combineUVGeosets, uvPieces } from './uv-tools.js';
import { planUVCorners, splitUVCorners, uvCornerCopies, boxProjectUVCorners, cylinderProjectUVCorners, unwrapUVCorners, POINT_LIMIT_ERROR } from './uv-unwrap.js';
import { packCharts } from './paint-uv-atlas.js';

const ids = selection => Object.entries(selection || {}).map(([key, list]) => [Number(key), [...new Set(Array.from(list || []))]]).filter(([, list]) => list.length);
const uvOf = (model, gi, uvSet) => {
  const uv = model?.Geosets?.[gi]?.TVertices?.[uvSet];
  if (!uv) throw Error('Geoset ' + gi + ' has no UV set ' + uvSet + '.');
  return uv;
};
const finite = values => [...values].every(value => Number.isFinite(value) && Number.isFinite(Math.fround(value)));

/**
 * Mirror by X (`axis` 'u') or Mirror by Y ('v'): flips the marked UV points around the centre of all of them,
 * like the UV Wrapper's buttons. Returns { count, centre }.
 */
export function flipUVs(model, selection, axis = 'u', { uvSet = 0 } = {}) {
  if (axis !== 'u' && axis !== 'v') throw Error('axis is "u" or "v".');
  const picked = ids(selection), centre = [0, 0];
  let count = 0;
  for (const [gi, list] of picked) {
    const uv = uvOf(model, gi, uvSet);
    for (const id of list) { centre[0] += uv[id * 2]; centre[1] += uv[id * 2 + 1]; count++; }
  }
  if (!count) throw Error('Mark UV points first.');
  centre[0] /= count; centre[1] /= count;
  const offset = axis === 'u' ? 0 : 1, next = [];
  for (const [gi, list] of picked) {
    const uv = new Float32Array(uvOf(model, gi, uvSet));
    for (const id of list) uv[id * 2 + offset] = centre[offset] - (uv[id * 2 + offset] - centre[offset]);
    if (!finite(uv)) throw Error('UV coordinates must be finite.');
    next.push([gi, uv]);
  }
  for (const [gi, uv] of next) model.Geosets[gi].TVertices[uvSet] = uv;
  return { count, centre };
}

/** A view for the projection tools: a camera looking from `direction` (toward the viewer) with `up`, orthographic. */
export function uvProjectionView(direction = [1, 0, 0], { up = [0, 0, 1], width = 10, height = 8, distance = 50 } = {}) {
  const normalize = v => { const l = Math.hypot(...v); return v.map(x => x / l); };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const b = normalize(direction), r = normalize(cross(up, b)), u = cross(b, r), view = new Array(16).fill(0), eye = b.map(x => x * distance);
  [r, u, b].forEach((axis, row) => { view[row] = axis[0]; view[4 + row] = axis[1]; view[8 + row] = axis[2]; view[12 + row] = -(axis[0] * eye[0] + axis[1] * eye[1] + axis[2] * eye[2]); });
  view[15] = 1;
  const projection = new Array(16).fill(0), near = .1, far = 1000;
  projection[0] = 2 / width; projection[5] = 2 / height; projection[10] = -2 / (far - near); projection[14] = -(far + near) / (far - near); projection[15] = 1;
  return { viewMatrix: view, projectionMatrix: projection };
}

/**
 * Commit corner UVs from Box Projection, Cylinder Projection or Unwrap (the plans the UV Wrapper builds with
 * planUVCorners): each triangle corner gets its UV; a point that needs two spots gets a copy, so the 3D shape is
 * unchanged. Refuses a geoset that would pass 65536 points. Returns { created: { geosetIndex: [new vertex ids] } }.
 */
export function commitUVCornerPlans(model, plans) {
  for (const plan of plans || []) {
    const geoset = model.Geosets[plan.geosetIndex];
    if (geoset.Vertices.length / 3 + uvCornerCopies(geoset, plan.corners) > 65536) throw Error(POINT_LIMIT_ERROR);
  }
  const created = {};
  for (const plan of plans || []) {
    const split = splitUVCorners(model.Geosets[plan.geosetIndex], plan.uvSet, plan.corners);
    if (split.created.length) created[plan.geosetIndex] = split.created;
  }
  return { created };
}

const TOOLS = { unwrap: unwrapUVCorners, box: boxProjectUVCorners, cylinder: cylinderProjectUVCorners };
/**
 * Unwrap, Box Projection or Cylinder Projection of the marked triangles (`tool`: 'unwrap' | 'box' | 'cylinder'),
 * then the commit above. The projections need a view: pass { viewMatrix, projectionMatrix } or { direction } for
 * uvProjectionView. Whole triangles must be marked. Returns { created }.
 */
export function unwrapUVs(model, selection, tool = 'unwrap', { uvSet = 0, viewMatrix, projectionMatrix, direction } = {}) {
  if (!TOOLS[tool]) throw Error('tool is one of ' + Object.keys(TOOLS).join(', ') + '.');
  const picked = ids(selection);
  if (!picked.length) throw Error('Mark UV points first.');
  const view = viewMatrix && projectionMatrix ? { viewMatrix, projectionMatrix } : uvProjectionView(direction);
  const marked = Object.fromEntries(picked);
  const combined = combineUVGeosets(model, picked.map(([gi]) => gi), marked, marked, uvSet);
  const plans = planUVCorners(combined, TOOLS[tool](combined.geoset, combined.selectedVertices, view.viewMatrix, view.projectionMatrix, combined.geoset.TVertices[0]));
  return commitUVCornerPlans(model, plans);
}

/** { u0, v0, u1, v1 } from a rectangle in texture pixels ({ x, y, width, height }) of a texture this big. */
export const uvRegionOfPixels = ({ x, y, width, height }, textureWidth, textureHeight) =>
  ({ u0: x / textureWidth, v0: y / textureHeight, u1: (x + width) / textureWidth, v1: (y + height) / textureHeight });

/**
 * Fits the marked UV points' bounding box into `region` ({ u0, v0, u1, v1 }, see uvRegionOfPixels), stretching
 * to fill it, or with keepAspect scaling evenly and centring. Returns { count, from, to } boxes.
 */
export function fitUVsToRegion(model, selection, region, { uvSet = 0, keepAspect = false } = {}) {
  const picked = ids(selection);
  if (!picked.length) throw Error('Mark UV points first.');
  if (!region || !['u0', 'v0', 'u1', 'v1'].every(key => Number.isFinite(region[key])) || region.u1 <= region.u0 || region.v1 <= region.v0) throw Error('region needs u0 < u1 and v0 < v1.');
  const lo = [Infinity, Infinity], hi = [-Infinity, -Infinity];
  let count = 0;
  for (const [gi, list] of picked) {
    const uv = uvOf(model, gi, uvSet);
    for (const id of list) { count++; for (let a = 0; a < 2; a++) { lo[a] = Math.min(lo[a], uv[id * 2 + a]); hi[a] = Math.max(hi[a], uv[id * 2 + a]); } }
  }
  const target = [[region.u0, region.u1], [region.v0, region.v1]], span = [0, 1].map(a => hi[a] - lo[a]);
  const scale = [0, 1].map(a => span[a] > 1e-9 ? (target[a][1] - target[a][0]) / span[a] : 1);
  if (keepAspect) {
    const even = Math.min(...[0, 1].filter(a => span[a] > 1e-9).map(a => scale[a]), Infinity);
    if (Number.isFinite(even)) scale[0] = scale[1] = even;
  }
  const next = [];
  for (const [gi, list] of picked) {
    const uv = new Float32Array(uvOf(model, gi, uvSet));
    for (const id of list) for (let a = 0; a < 2; a++) {
      const centre = (lo[a] + hi[a]) / 2, mid = (target[a][0] + target[a][1]) / 2;
      uv[id * 2 + a] = span[a] > 1e-9 ? mid + (uv[id * 2 + a] - centre) * scale[a] : mid;
    }
    if (!finite(uv)) throw Error('UV coordinates must be finite.');
    next.push([gi, uv]);
  }
  for (const [gi, uv] of next) model.Geosets[gi].TVertices[uvSet] = uv;
  return { count, from: { u0: lo[0], v0: lo[1], u1: hi[0], v1: hi[1] }, to: region };
}

/**
 * Packs the UV islands of the marked points (default: every point of `geosets`) side by side inside `region`
 * (default the whole texture) without overlap, upright, all at one scale; the gap between islands is `margin`
 * of the region. Islands are the UV Wrapper's "each piece" (triangle-connected, seams do not split them). Only UV
 * coordinates change. Returns { islands, scale }.
 */
export function packUVIslands(model, selection, { uvSet = 0, region = { u0: 0, v0: 0, u1: 1, v1: 1 }, margin = .01, resolution = 1024 } = {}) {
  const picked = ids(selection);
  if (!picked.length) throw Error('Mark UV points first.');
  const charts = [];
  for (const [gi, list] of picked) {
    const geoset = model.Geosets[gi], uv = uvOf(model, gi, uvSet);
    for (const piece of uvPieces(geoset, uvSet, list, list)) {
      const lo = [Infinity, Infinity], hi = [-Infinity, -Infinity];
      for (const id of piece) for (let a = 0; a < 2; a++) { lo[a] = Math.min(lo[a], uv[id * 2 + a]); hi[a] = Math.max(hi[a], uv[id * 2 + a]); }
      charts.push({ gi, piece, minU: lo[0], minV: lo[1], width: hi[0] - lo[0], height: hi[1] - lo[1] });
    }
  }
  if (!charts.length) throw Error('The marked points have no triangles to pack.');
  const padding = Math.max(1, Math.round(margin * resolution / 2)), { scale, placements } = packCharts(charts, resolution, padding, { upright: true });
  const next = new Map(picked.map(([gi]) => [gi, new Float32Array(uvOf(model, gi, uvSet))])), regionWidth = region.u1 - region.u0, regionHeight = region.v1 - region.v0;
  for (const chart of charts) {
    const place = placements.get(chart), uv = next.get(chart.gi);
    for (const id of chart.piece) {
      uv[id * 2] = region.u0 + (place.x + padding + (uv[id * 2] - chart.minU) * scale) / resolution * regionWidth;
      uv[id * 2 + 1] = region.v0 + (place.y + padding + (uv[id * 2 + 1] - chart.minV) * scale) / resolution * regionHeight;
    }
  }
  for (const [gi, uv] of next) { if (!finite(uv)) throw Error('UV coordinates must be finite.'); model.Geosets[gi].TVertices[uvSet] = uv; }
  return { islands: charts.length, scale };
}
