import { sampleTrack, unanimatedTrackValue } from './animation.js';
import { connectedVertices } from '../app/classic-gestures.js';
import { eligibleUVFaces } from './uv-selection.js';
import { DEFAULT_UV_DRAG } from './uv-drag-settings.js';

const finiteIndex = value => Number.isSafeInteger(value) && value >= 0;
const uniqueIndices = values => [...new Set(Array.from(values || []).filter(finiteIndex))];
/** The UV Wrapper's Rotate is 30% slower than the mouse (owner, 4 Nov 2026). */
const UV_TURN_SENSITIVITY = 0.7;
/** Within this many pixels of the centre the turn goes by distance moved
 * around the centre, not by angle, so passing over the piece never snaps it.
 * The wrapper uses 24 px (owner, 6 Nov: 48 px resisted too much up close,
 * 16 px wanted "a lil bit more smooth");
 * FX texture fitting keeps its original 48 px. */
const UV_TURN_STEADY = 24, FX_TURN_STEADY = 48;
/** The mouse exactly on the centre has no direction; skip that sample. */
const UV_TURN_CENTRE = 2;
/** The Left/right part of the `both` Rotate style: one radian per this many pixels. */
const UV_TURN_SIDEWAYS = 48;
/** Zoom `centre`: the mouse this close to the centre is on it; a drag that
 * starts this near has no direction to read and uses `rightUp`. */
const UV_ZOOM_CENTRE = 3, UV_ZOOM_NEAR = 12;
/** Zoom `centre`: how far behind the centre (cosine, seen from the grab point)
 * the distance has faded to nothing. Half of a cosine is 120 degrees around. */
const UV_ZOOM_BEHIND = 0.5;
/** Below this a collapse is floating-point residue, not a size. */
const UV_ZOOM_ZERO = 1e-9;

/** UV Rotate, owner-locked (see docs/UV-ROTATE-ZOOM.md). Only movement AROUND
 * the selection's centre turns it: circling follows the mouse at the same
 * strength at any distance; moving straight toward or away does nothing.
 * Near the centre the same circling gives a steady, smaller turn instead of a
 * jump. While the mouse is over a big piece (`drag.reach`: its farthest
 * point from the centre in screen pixels) the turn goes by distance moved
 * around the centre, so the piece never outruns the mouse. The wrapper turns at 70%; FX texture fitting keeps 100%. Shift/Alt fine
 * control scale each step (`drag.fine`). Call at drag start and on every sample.
 * `drag.settings` (normalizeUVDrag) holds the UV Wrapper's own options; without
 * it, and with the defaults, this is the locked rule. FX never reads them. */
export function uvTurn(drag, x, y) {
  drag.turn ??= 0;
  const fx = drag.wrapperControls === false, settings = fx ? null : drag.settings, style = settings?.rotateStyle;
  const speed = fx ? 1 : settings ? settings.rotateSpeed / 100 : UV_TURN_SENSITIVITY, fine = drag.fine ?? 1, direction = settings?.rotateReverse ? -1 : 1;
  if (style === 'leftRight') {
    if (drag.lastX !== undefined) drag.turn += (x - drag.lastX) * Math.PI / 180 * speed * fine * direction;
    drag.lastX = x;
    return drag.turn;
  }
  const px = x - drag.pivotScreen[0], py = y - drag.pivotScreen[1], radius = Math.hypot(px, py);
  // Over a big piece the steady zone grows to the piece's own size, so no
  // point of it ever moves faster than 70% of the mouse (owner, 7 Nov 2026).
  const zone = fx ? FX_TURN_STEADY : Math.max(settings ? settings.rotateZone : UV_TURN_STEADY, !settings || settings.rotateBigPieces ? drag.reach || 0 : 0);
  if (style === 'both') {
    // The #580 build (1e797017): around the centre, plus the left/right share
    // of each step that goes straight toward or away from it.
    if (drag.px !== undefined) {
      const qx = drag.px, qy = drag.py, previous = drag.radius, dx = px - qx, dy = py - qy, cross = qx * py - qy * px, near = Math.max(zone, UV_TURN_CENTRE);
      const around = Math.min(radius, previous) >= near - 1e-6 ? Math.atan2(cross, qx * px + qy * py) : cross / (Math.max(radius, previous, 1e-9) * near);
      const ux = px + qx, uy = py + qy, length = Math.hypot(ux, uy);
      const sideways = length < 1 ? dx : (dx * ux + dy * uy) / length * ux / length;
      drag.turn += (around + sideways / UV_TURN_SIDEWAYS * direction) * speed * fine;
    }
    drag.radius = radius; drag.px = px; drag.py = py;
    return drag.turn;
  }
  if (radius < UV_TURN_CENTRE) return drag.turn;
  const angle = Math.atan2(py, px);
  if (drag.angle !== undefined) {
    const step = Math.atan2(Math.sin(angle - drag.angle), Math.cos(angle - drag.angle));
    const steady = zone > 0 ? Math.min(1, radius / zone, drag.radius / zone) : 1;
    // FX texture fitting also uses UVEditor and keeps its original 1:1 speed.
    drag.turn += step * steady * speed * fine;
  }
  drag.angle = angle; drag.radius = radius;
  return drag.turn;
}

/** UV Zoom for the wrapper (`drag.settings`: normalizeUVDrag). Returns the size
 * factor. Call at drag start and on every sample, like uvTurn; each sample's
 * change is weighted, so changing Shift mid-drag never jumps. A repeated point
 * adds nothing.
 * `centre`: size follows the mouse's distance from the centre. Behind the centre
 * (seen from where the drag began) that distance fades out and turns negative,
 * so a sweep past the centre, even one that misses it, never grows the selection
 * back; coming back grows it again. It depends only on where the mouse is. */
export function uvZoom(drag, x, y, weight) {
  const { zoomStyle, zoomSpeed } = drag.settings ?? DEFAULT_UV_DRAG, speed = zoomSpeed / 100;
  const px = x - drag.pivotScreen[0], py = y - drag.pivotScreen[1], radius = Math.hypot(px, py);
  if (drag.zoomStyle === undefined) {
    drag.zoomStyle = zoomStyle === 'centre' && radius <= UV_ZOOM_NEAR ? 'rightUp' : zoomStyle;
    drag.scaleDX = 0; drag.scaleX = x; drag.scaleY = y;
    drag.zoomStart = drag.zoomVirtual = drag.zoomSigned = radius; drag.zoomAimX = px / (radius || 1); drag.zoomAimY = py / (radius || 1);
    return 1;
  }
  if (drag.zoomStyle === 'upDown') {
    // Up grows, compounding, so it can never reach zero or flip. UV transform
    // sensitivity is taken back out of the weight; Shift and Alt fine control stay.
    drag.scaleDX += (y - drag.scaleY) * weight / (drag.uvSensitivity ?? 1);
    drag.scaleX = x; drag.scaleY = y;
    return Math.exp(-drag.scaleDX / 100 * speed);
  }
  if (drag.zoomStyle !== 'centre') {
    // Like Movement's Resize: right/up grows, left/down shrinks (screen y is down).
    drag.scaleDX += ((x - drag.scaleX) - (drag.zoomStyle === 'rightUp' ? y - drag.scaleY : 0)) * weight;
    drag.scaleX = x; drag.scaleY = y;
    return Math.max(0, 1 + drag.scaleDX / 100 * speed);
  }
  const aim = (px * drag.zoomAimX + py * drag.zoomAimY) / (radius || 1);
  const signed = radius <= UV_ZOOM_CENTRE ? 0 : radius * Math.min(1, 1 + aim / UV_ZOOM_BEHIND);
  drag.zoomVirtual += (signed - drag.zoomSigned) * weight; drag.zoomSigned = signed;
  const factor = Math.max(0, 1 + (drag.zoomVirtual - drag.zoomStart) / drag.zoomStart * speed);
  return factor < UV_ZOOM_ZERO ? 0 : factor;
}

/** Ctrl snapping: the applied value only, so releasing Ctrl loses nothing. */
export const uvSnapTurn = (turn, degrees) => degrees > 0 ? Math.round(turn * 180 / Math.PI / degrees) * degrees * Math.PI / 180 : turn;
/** True when a drag left any of its coordinates somewhere else. */
export const uvDragChanged = (original, current, indices) => indices.some(index => original[index * 2] !== current[index * 2] || original[index * 2 + 1] !== current[index * 2 + 1]);
export const uvSnapFactor = (factor, percent) => percent > 0 ? Math.round(factor * 100 / percent) * percent / 100 : factor;

/** "Each piece": selected points grouped by triangle connection, the same walk
 * as Select Connected. Selected points on exactly the same UV spot join up, so
 * a seam does not split a piece. */
export function uvPieces(geoset, uvSet, indices, eligible, values = geoset?.TVertices?.[uvSet]) {
  const selected = uniqueIndices(indices), member = new Set(selected), links = eligibleUVFaces(geoset, eligible, uvSet).flat(), spots = new Map(), pieces = [];
  for (const index of selected) {
    const spot = values[index * 2] + ',' + values[index * 2 + 1], first = spots.get(spot);
    // A flat triangle tells the walk the two points are one.
    if (first === undefined) spots.set(spot, index); else links.push(first, index, index);
  }
  // One walk per piece over every triangle froze mouse-down on uncoupled maps
  // (3000 triangles: 2.7 s). Halving the seeds splits the triangles as it goes.
  const collect = (faces, seeds) => {
    const half = seeds.slice(0, Math.ceil(seeds.length / 2)), reached = new Set(connectedVertices(faces, half));
    if (seeds.length === 1) { pieces.push([...reached].filter(vertex => member.has(vertex))); return; }
    const near = [], far = [], rest = seeds.filter(seed => !reached.has(seed));
    for (let offset = 0; offset < faces.length; offset += 3) (reached.has(faces[offset]) ? near : far).push(faces[offset], faces[offset + 1], faces[offset + 2]);
    collect(near, half);
    if (rest.length) collect(far, rest);
  };
  if (selected.length) collect(links, selected);
  return pieces;
}

/** Each entry of `indices`' own piece centre, as a flat u,v array parallel to it. */
export function uvPieceCenters(geoset, uvSet, indices, eligible, values = geoset?.TVertices?.[uvSet]) {
  const centers = new Float64Array(indices.length * 2), byIndex = new Map();
  for (const piece of uvPieces(geoset, uvSet, indices, eligible, values)) {
    const center = [0, 0];
    for (const index of piece) { center[0] += values[index * 2] / piece.length; center[1] += values[index * 2 + 1] / piece.length; byIndex.set(index, center); }
  }
  indices.forEach((index, position) => { const center = byIndex.get(index); centers[position * 2] = center[0]; centers[position * 2 + 1] = center[1]; });
  return centers;
}

/** Set both repeat axes without changing other texture flags or UVs. */
export function setUVTextureWrapping(model, textureIDs, enabled) {
  for (const id of uniqueIndices(textureIDs)) {
    const texture = model.Textures?.[id];
    if (texture && !texture.ReplaceableId && texture.Image?.trim()) texture.Flags = enabled ? (texture.Flags || 0) | 3 : (texture.Flags || 0) & ~3;
  }
}

function textureLabel(texture) {
  if (!texture) return 'Missing texture';
  if (texture.ReplaceableId === 1) return 'Team Color';
  if (texture.ReplaceableId === 2) return 'Team Glow';
  return String(texture.Image || 'Unnamed texture').split(/[\\/]/).at(-1);
}

/** UV rest uses the saved MDX texture slot or, for MDL tracks, the first key. */
export function uvRestTextureID(layer, slot) {
  return unanimatedTrackValue(layer, slot, layer[slot]?.Keys?.[0]?.Vector?.[0] ?? 0);
}

/** Resolve a material's layers in the UV rest pose or at an animation frame. */
export function uvMaterialLayers(model, materialID, time = 0, sequenceIndex = -1, restPose = sequenceIndex < 0) {
  const material = model?.Materials?.[materialID], interval = model?.Sequences?.[sequenceIndex]?.Interval;
  return (material?.Layers || []).map((layer, layerIndex) => {
    const sampled = restPose && layer.TextureID?.Keys
      ? uvRestTextureID(layer, 'TextureID')
      : sampleTrack(layer.TextureID, time, { interval, globalSequences: model.GlobalSequences, globalTime: time, fallback: -1 });
    const textureID = Math.round(Number(sampled)), texture = model.Textures?.[textureID] || null;
    const coordId = finiteIndex(layer.CoordId) ? layer.CoordId : 0;
    return { materialID, layerIndex, layer, textureID, texture, coordId, label: textureLabel(texture) };
  });
}

/** Only materials used by the current UV working selection are offered. */
export function relevantUVMaterials(model, selectionByGeoset, time = 0, sequenceIndex = -1) {
  const indices = Array.isArray(selectionByGeoset) || selectionByGeoset instanceof Set
    ? uniqueIndices(selectionByGeoset)
    : Object.keys(selectionByGeoset || {}).map(Number).filter(index => selectionByGeoset[index]?.length);
  const grouped = new Map();
  for (const geosetIndex of indices) {
    const geoset = model?.Geosets?.[geosetIndex], materialID = geoset?.MaterialID;
    if (!finiteIndex(materialID) || !model.Materials?.[materialID]) continue;
    const entry = grouped.get(materialID) || { materialID, geosetIndices: [] };
    entry.geosetIndices.push(geosetIndex); grouped.set(materialID, entry);
  }
  return [...grouped.values()].sort((a, b) => a.materialID - b.materialID).map(entry => describeUVMaterial(model, entry, time, sequenceIndex));
}

function describeUVMaterial(model, entry, time, sequenceIndex) {
  const layers = uvMaterialLayers(model, entry.materialID, time, sequenceIndex);
  const availableSets = entry.geosetIndices.map(index => model.Geosets[index].TVertices || []);
  const preferred = layers.map(layer => layer.coordId).find(coordId => availableSets.every(sets => sets[coordId]));
  const coordId = preferred ?? availableSets[0]?.findIndex((_, index) => availableSets.every(sets => sets[index])) ?? 0;
  const names = [...new Set(layers.map(layer => layer.label))];
  return { ...entry, layers, coordId: Math.max(0, coordId), label: `Material ${entry.materialID + 1} · ${names.join(' + ') || 'No texture'}` };
}

/** The model's other materials, described as if these geosets used them. */
export function otherUVMaterials(model, geosetIndices, excludedMaterialIDs, time = 0, sequenceIndex = -1) {
  const excluded = new Set(excludedMaterialIDs);
  return (model?.Materials || []).flatMap((material, materialID) => material && !excluded.has(materialID)
    ? [describeUVMaterial(model, { materialID, geosetIndices }, time, sequenceIndex)] : []);
}

/** Flatten geosets into one temporary UV canvas with their shared model positions. */
function combineUVGeosetsBySet(model, geosetIndices, eligibleSelection, selectedSelection, uvSetForGeoset) {
  const refs = [], vertices = [], coordinates = [], faces = [], eligibleVertices = [], selectedVertices = [], faceStarts = {};
  let offset = 0;
  for (const geosetIndex of uniqueIndices(geosetIndices)) {
    const geoset = model?.Geosets?.[geosetIndex], uvSet = uvSetForGeoset(geosetIndex), uv = geoset?.TVertices?.[uvSet];
    if (!uv) continue;
    const count = Math.min(geoset.Vertices.length / 3, uv.length / 2), allowed = new Set(uniqueIndices(eligibleSelection?.[geosetIndex]).filter(index => index < count));
    const selected = new Set(uniqueIndices(selectedSelection?.[geosetIndex]).filter(index => allowed.has(index)));
    for (let index = 0; index < count; index++) {
      refs.push({ geosetIndex, vertexIndex: index, uvSet }); coordinates.push(uv[index * 2], uv[index * 2 + 1]);
      vertices.push(geoset.Vertices[index * 3], geoset.Vertices[index * 3 + 1], geoset.Vertices[index * 3 + 2]);
      if (allowed.has(index)) eligibleVertices.push(offset + index);
      if (selected.has(index)) selectedVertices.push(offset + index);
    }
    // Where this geoset's corners start, so a per-corner result maps back to its own Faces.
    faceStarts[geosetIndex] = faces.length;
    for (const index of geoset.Faces || []) faces.push(offset + Number(index));
    offset += count;
  }
  return {
    refs, eligibleVertices, selectedVertices, faceStarts,
    geoset: {
      Vertices: new Float32Array(vertices),
      TVertices: [new Float32Array(coordinates)],
      Faces: new Uint32Array(faces),
    },
  };
}

export function combineUVGeosets(model, geosetIndices, eligibleSelection, selectedSelection, coordId = 0) {
  return combineUVGeosetsBySet(model, geosetIndices, eligibleSelection, selectedSelection, () => coordId);
}

/** One canvas for the selection captured before entering UV mode. Its texture
 * backdrop can change without rerouting any geoset's UV coordinates. */
export function combineSelectedUVGeosets(model, eligibleSelection, selectedSelection, materialEntries) {
  const coordByGeoset = new Map(materialEntries.flatMap(entry => entry.geosetIndices.map(index => [index, entry.coordId])));
  return combineUVGeosetsBySet(model, Object.keys(eligibleSelection).map(Number), eligibleSelection, selectedSelection, index => coordByGeoset.get(index) ?? 0);
}

/** Expand a flattened UV canvas back to the model's individual UV arrays. */
export function splitCombinedUV(model, refs, values, coordId = 0) {
  if (!values || values.length !== refs.length * 2) throw Error('Combined UV coordinates changed structure.');
  const changes = new Map();
  for (let index = 0; index < refs.length; index++) {
    const { geosetIndex, vertexIndex } = refs[index], source = model?.Geosets?.[geosetIndex]?.TVertices?.[coordId];
    if (!source) continue;
    if (!changes.has(geosetIndex)) changes.set(geosetIndex, new Float32Array(source));
    const target = changes.get(geosetIndex), u = Number(values[index * 2]), v = Number(values[index * 2 + 1]);
    if (![u, v].every(value => Number.isFinite(value) && Number.isFinite(Math.fround(value)))) throw Error('UV coordinates must be finite.');
    target[vertexIndex * 2] = u; target[vertexIndex * 2 + 1] = v;
  }
  return [...changes].map(([geosetIndex, next]) => ({ geosetIndex, uvSet: coordId, values: next }));
}

export function collapseUVCoordinates(values, indices) {
  const selected = uniqueIndices(indices), next = new Float32Array(values || []);
  if (selected.length < 2) return next;
  const center = [0, 0];
  for (const index of selected) { center[0] += next[index * 2] / selected.length; center[1] += next[index * 2 + 1] / selected.length; }
  for (const index of selected) { next[index * 2] = center[0]; next[index * 2 + 1] = center[1]; }
  return next;
}

/** Fold a UV selection like paper. Symmetric points coincide naturally; other
 * points keep their mirrored distance so the user can finish an imperfect fold. */
export function foldUVCoordinates(values, indices, direction = 'right-to-left') {
  const selected = uniqueIndices(indices), next = new Float32Array(values || []);
  if (selected.length < 2) return next;
  const rules = {
    'right-to-left': { axis: 0, positive: true }, 'left-to-right': { axis: 0, positive: false },
    'bottom-to-top': { axis: 1, positive: true }, 'top-to-bottom': { axis: 1, positive: false },
  };
  const rule = rules[direction]; if (!rule) throw Error('Choose a valid fold direction.');
  let low = Infinity, high = -Infinity;
  for (const index of selected) { const value = next[index * 2 + rule.axis]; low = Math.min(low, value); high = Math.max(high, value); }
  const crease = (low + high) / 2;
  for (const index of selected) {
    const offset = index * 2 + rule.axis, value = next[offset];
    if (rule.positive ? value > crease : value < crease) next[offset] = 2 * crease - value;
  }
  return next;
}

const pointAt = (geoset, index) => [geoset.Vertices[index * 3], geoset.Vertices[index * 3 + 1], geoset.Vertices[index * 3 + 2]];
/** Seam duplicates: the same UV spot and the same 3D position. */
const uvSpotKey = (geoset, values, index) => values[index * 2] + ',' + values[index * 2 + 1] + (geoset?.Vertices ? ',' + pointAt(geoset, index).join(',') : '');
const validPoints = (geoset, values, list) => {
  const count = Math.min((geoset?.Vertices?.length ?? Infinity) / 3, (values?.length || 0) / 2);
  return uniqueIndices(list).filter(index => index < count);
};

/** Straighten: wider than tall, the selected points become a row (every V their average V);
 * otherwise a column (every U their average U). Seam duplicates count once in the average. */
export function straightenUVCoordinates(values, indices, geoset) {
  const selected = validPoints(geoset, values, indices), next = new Float32Array(values || []);
  if (selected.length < 2) return next;
  const low = [Infinity, Infinity], high = [-Infinity, -Infinity];
  for (const index of selected) for (let axis = 0; axis < 2; axis++) { low[axis] = Math.min(low[axis], next[index * 2 + axis]); high[axis] = Math.max(high[axis], next[index * 2 + axis]); }
  const axis = high[0] - low[0] > high[1] - low[1] ? 1 : 0, spots = new Map();
  for (const index of selected) spots.set(uvSpotKey(geoset, next, index), next[index * 2 + axis]);
  let average = 0;
  for (const value of spots.values()) average += value / spots.size;
  for (const index of selected) next[index * 2 + axis] = average;
  return next;
}

export const NO_MIRROR_POINTS_ERROR = "No mirror points found among the UV Wrapper's points.";

/** Mirror Copy: each selected point's mirror among the other (unselected) UV Wrapper points gets the
 * selected point's UV. The mirror plane is the model axis with the most matches, through the middle
 * of the UV Wrapper's points on that axis. Points on the plane stay. Where a mirror position holds
 * several points, the one whose triangles mirror the selected point's triangles is used; points
 * there with the same UV spot move together. */
export function mirrorCopyUVCoordinates(geoset, indices, eligible, values = geoset?.TVertices?.[0]) {
  const domain = validPoints(geoset, values, eligible), member = new Set(domain);
  const selected = validPoints(geoset, values, indices).filter(index => member.has(index)), chosen = new Set(selected);
  const targets = domain.filter(index => !chosen.has(index));
  if (!selected.length || !targets.length) throw Error(NO_MIRROR_POINTS_ERROR);
  const at = index => pointAt(geoset, index), low = [Infinity, Infinity, Infinity], high = [-Infinity, -Infinity, -Infinity];
  for (const index of domain) at(index).forEach((value, axis) => { low[axis] = Math.min(low[axis], value); high[axis] = Math.max(high[axis], value); });
  const tolerance = Math.max(1e-4, Math.hypot(high[0] - low[0], high[1] - low[1], high[2] - low[2]) * 1e-3);
  const cell = p => p.map(value => Math.floor(value / tolerance)), grid = new Map();
  for (const index of targets) { const key = cell(at(index)).join(','); if (!grid.has(key)) grid.set(key, []); grid.get(key).push(index); }
  const same = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) <= tolerance;
  const near = p => {
    const [x, y, z] = cell(p), found = [];
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++)
      for (const index of grid.get([x + dx, y + dy, z + dz].join(',')) || []) if (same(at(index), p)) found.push(index);
    return found;
  };
  const mirror = (p, axis, middle) => { const q = p.slice(); q[axis] = 2 * middle - p[axis]; return q; };
  // A posed model's points are not centred on its mirror plane (the Footman's arms and shield), so
  // besides the middle of the points each axis also tries the plane that most pairs of the UV
  // Wrapper's points are centred on: the model's own symmetry, whatever is selected.
  const voted = axis => {
    const [first, second] = [0, 1, 2].filter(other => other !== axis), columns = new Map(), votes = new Map();
    const column = p => [Math.floor(p[first] / tolerance), Math.floor(p[second] / tolerance)];
    for (const index of domain) { const key = column(at(index)).join(','); if (!columns.has(key)) columns.set(key, []); columns.get(key).push(index); }
    let pairs = 0;
    for (const index of domain) {
      const p = at(index), [x, y] = column(p);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const other of columns.get((x + dx) + ',' + (y + dy)) || []) {
        if (other <= index || ++pairs > 200000) continue;
        const q = at(other);
        if (Math.hypot(q[first] - p[first], q[second] - p[second]) > tolerance || Math.abs(q[axis] - p[axis]) <= 2 * tolerance) continue;
        const middle = (p[axis] + q[axis]) / 2, bin = Math.round(middle / tolerance);
        if (!votes.has(bin)) votes.set(bin, []); votes.get(bin).push(middle);
      }
    }
    const centre = (low[axis] + high[axis]) / 2;
    let best = null, bestBin = 0;
    for (const bin of votes.keys()) {
      const near = [bin - 1, bin, bin + 1].flatMap(key => votes.get(key) || []);
      if (!best || near.length > best.length || (near.length === best.length && Math.abs(bin * tolerance - centre) < Math.abs(bestBin * tolerance - centre))) { best = near; bestBin = bin; }
    }
    return best ? best.reduce((sum, value) => sum + value, 0) / best.length : null;
  };
  let plane = null;
  for (let axis = 0; axis < 3; axis++) for (const middle of [(low[axis] + high[axis]) / 2, voted(axis)]) {
    if (middle === null) continue;
    let matched = 0;
    for (const index of selected) { const p = at(index); if (Math.abs(p[axis] - middle) > tolerance && near(mirror(p, axis, middle)).length) matched++; }
    if (!plane || matched > plane.matched) plane = { axis, middle, matched };
  }
  if (!plane.matched) throw Error(NO_MIRROR_POINTS_ERROR);
  const around = new Map(), faces = geoset.Faces || [];
  for (let corner = 0; corner + 2 < faces.length; corner += 3) {
    const triangle = [faces[corner], faces[corner + 1], faces[corner + 2]];
    for (const index of triangle) {
      const others = triangle.filter(id => id !== index);
      if (member.has(index) && others.length === 2) { if (!around.has(index)) around.set(index, []); around.get(index).push(others); }
    }
  }
  const score = (source, target) => {
    const theirs = (around.get(target) || []).map(pair => pair.map(at));
    let count = 0;
    for (const pair of around.get(source) || []) {
      const [a, b] = pair.map(id => mirror(at(id), plane.axis, plane.middle));
      if (theirs.some(([c, d]) => (same(a, c) && same(b, d)) || (same(a, d) && same(b, c)))) count++;
    }
    return count;
  };
  const claims = new Map();
  for (const source of selected) {
    const p = at(source);
    if (Math.abs(p[plane.axis] - plane.middle) <= tolerance) continue;
    const groups = new Map();
    for (const target of near(mirror(p, plane.axis, plane.middle))) { const key = uvSpotKey(geoset, values, target); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(target); }
    let pick = null;
    for (const [key, members] of groups) { const value = Math.max(...members.map(target => score(source, target))); if (!pick || value > pick.score) pick = { key, members, score: value }; }
    const previous = pick && claims.get(pick.key);
    if (pick && (!previous || pick.score > previous.score)) claims.set(pick.key, { ...pick, source });
  }
  const next = new Float32Array(values);
  for (const { members, source } of claims.values()) for (const target of members) { next[target * 2] = values[source * 2]; next[target * 2 + 1] = values[source * 2 + 1]; }
  return next;
}

export const RELAX_EDGE_ERROR = "Relax keeps the selection's outer edge in place. Select more than the edge.";

/** Relax: selected points move to the mean-value-weighted average of their UV neighbours (weights
 * from the 3D triangle angles), Gauss–Seidel until the largest move is below 1e-7 UV or 5000
 * sweeps. Unselected points stay, and so does the selection's outer edge: a point of a triangle
 * that is not fully selected, or on an open UV edge. Seam duplicates move together. */
export function relaxUVCoordinates(geoset, indices, eligible, values = geoset?.TVertices?.[0]) {
  const domain = validPoints(geoset, values, eligible), member = new Set(domain), chosen = new Set(validPoints(geoset, values, indices).filter(index => member.has(index)));
  const nodeOf = new Map(), nodes = [], spots = new Map();
  for (const index of domain) {
    const key = uvSpotKey(geoset, values, index);
    let node = spots.get(key);
    if (node === undefined) { node = nodes.length; spots.set(key, node); nodes.push({ points: [], selected: true, position: pointAt(geoset, index), uv: [values[index * 2], values[index * 2 + 1]] }); }
    nodes[node].points.push(index); if (!chosen.has(index)) nodes[node].selected = false;
    nodeOf.set(index, node);
  }
  const fixed = nodes.map(node => !node.selected), triangles = [], uses = new Map(), faces = geoset.Faces || [], edge = (a, b) => a < b ? a * nodes.length + b : b * nodes.length + a;
  for (let corner = 0; corner + 2 < faces.length; corner += 3) {
    const triangle = [faces[corner], faces[corner + 1], faces[corner + 2]].map(index => nodeOf.has(index) ? nodeOf.get(index) : -1);
    if (!triangle.some(node => node >= 0)) continue;
    if (!triangle.every(node => node >= 0 && nodes[node].selected)) { for (const node of triangle) if (node >= 0) fixed[node] = true; continue; }
    if (new Set(triangle).size < 3) continue;
    triangles.push(triangle);
    for (let k = 0; k < 3; k++) { const key = edge(triangle[k], triangle[(k + 1) % 3]); uses.set(key, (uses.get(key) || 0) + 1); }
  }
  for (const triangle of triangles) for (let k = 0; k < 3; k++) if (uses.get(edge(triangle[k], triangle[(k + 1) % 3])) === 1) fixed[triangle[k]] = fixed[triangle[(k + 1) % 3]] = true;
  const weights = new Map();
  for (const triangle of triangles) for (let k = 0; k < 3; k++) {
    const i = triangle[k]; if (fixed[i]) continue;
    const j = triangle[(k + 1) % 3], l = triangle[(k + 2) % 3], p = nodes[i].position;
    const a = nodes[j].position.map((value, axis) => value - p[axis]), b = nodes[l].position.map((value, axis) => value - p[axis]);
    const la = Math.hypot(...a), lb = Math.hypot(...b);
    if (!(la > 0 && lb > 0)) continue;
    const angle = Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (la * lb))));
    const half = Math.tan(Math.min(angle, Math.PI - 1e-6) / 2);
    if (!weights.has(i)) weights.set(i, new Map());
    const row = weights.get(i);
    row.set(j, (row.get(j) || 0) + half / la); row.set(l, (row.get(l) || 0) + half / lb);
  }
  const free = [...weights].filter(([, row]) => [...row.values()].reduce((sum, value) => sum + value, 0) > 0)
    .map(([node, row]) => ({ node, neighbours: Int32Array.from(row.keys()), weights: Float64Array.from(row.values()) }));
  if (!free.length) throw Error(RELAX_EDGE_ERROR);
  const u = Float64Array.from(nodes, node => node.uv[0]), v = Float64Array.from(nodes, node => node.uv[1]);
  for (let sweep = 0; sweep < 5000; sweep++) {
    let largest = 0;
    for (const { node, neighbours, weights: w } of free) {
      let su = 0, sv = 0, total = 0;
      for (let k = 0; k < neighbours.length; k++) { su += w[k] * u[neighbours[k]]; sv += w[k] * v[neighbours[k]]; total += w[k]; }
      const nu = su / total, nv = sv / total;
      largest = Math.max(largest, Math.abs(nu - u[node]), Math.abs(nv - v[node]));
      u[node] = nu; v[node] = nv;
    }
    if (largest < 1e-7) break;
  }
  const next = new Float32Array(values);
  for (const { node } of free) for (const index of nodes[node].points) { next[index * 2] = u[node]; next[index * 2 + 1] = v[node]; }
  return next;
}

export function copyVertexAttribute(source, sourceIndices, stride) {
  if (!source?.length) return source;
  const output = new source.constructor(sourceIndices.length * stride);
  sourceIndices.forEach((sourceIndex, index) => output.set(source.subarray(sourceIndex * stride, sourceIndex * stride + stride), index * stride));
  return output;
}

function transferUVCornerInward(values, faces, corner, weight = 0.8) {
  const faceStart = Math.floor(corner / 3) * 3, localCorner = corner % 3;
  const vertexIndex = faces[corner], firstNeighbor = faces[faceStart + (localCorner + 1) % 3], secondNeighbor = faces[faceStart + (localCorner + 2) % 3];
  const offset = vertexIndex * 2, firstOffset = firstNeighbor * 2, secondOffset = secondNeighbor * 2, neighborWeight = (1 - weight) / 2;
  values[offset] = weight * values[offset] + neighborWeight * values[firstOffset] + neighborWeight * values[secondOffset];
  values[offset + 1] = weight * values[offset + 1] + neighborWeight * values[firstOffset + 1] + neighborWeight * values[secondOffset + 1];
}

/** MDLVis 1.40 UV Uncouple (unTex.pas): give every selected face corner its
 * own vertex, then move those UVs 20% toward their respective triangle. The
 * active UV set fans apart visibly while the 3D mesh and other UV sets stay
 * unchanged. MDLVis clears the UV selection after this operation. */
export function uncoupleUVVertices(geoset, indices, uvSet = 0) {
  const count = geoset?.Vertices?.length / 3, selected = new Set(uniqueIndices(indices));
  const activeUV = geoset?.TVertices?.[uvSet];
  if (!Number.isInteger(count) || selected.size === 0 || [...selected].some(index => index >= count) || activeUV?.length !== count * 2) throw Error('Select valid UV vertices first.');
  const sources = Array.from({ length: count }, (_, index) => index), faces = new Uint32Array(geoset.Faces), transferCorners = [], created = [];
  for (const source of selected) {
    const corners = [];
    for (let corner = 0; corner < faces.length; corner++) if (faces[corner] === source) corners.push(corner);
    if (!corners.length) continue;
    for (const corner of corners.slice(1)) {
      if (sources.length >= 65536) throw Error('UV uncoupling would exceed the 65536-vertex geoset limit. Split the geoset first.');
      const duplicate = sources.length;
      faces[corner] = duplicate; sources.push(source); created.push(duplicate); transferCorners.push(corner);
    }
    transferCorners.push(corners[0]);
  }
  const added = sources.length - count;
  if (added) {
    geoset.Vertices = copyVertexAttribute(geoset.Vertices, sources, 3);
    geoset.Normals = copyVertexAttribute(geoset.Normals, sources, 3);
    geoset.VertexGroup = copyVertexAttribute(geoset.VertexGroup, sources, 1);
    geoset.TVertices = (geoset.TVertices || []).map(uv => copyVertexAttribute(uv, sources, 2));
    if (geoset.Tangents?.length) geoset.Tangents = copyVertexAttribute(geoset.Tangents, sources, 4);
    if (geoset.SkinWeights?.length) geoset.SkinWeights = copyVertexAttribute(geoset.SkinWeights, sources, 8);
    geoset.Faces = new Uint16Array(faces);
  }
  const movedUV = geoset.TVertices[uvSet];
  for (const corner of transferCorners) transferUVCornerInward(movedUV, faces, corner);
  return { added, created, selection: [] };
}

const transform4 = (matrix, vector) => [0, 1, 2, 3].map(row => matrix[row] * vector[0] + matrix[4 + row] * vector[1] + matrix[8 + row] * vector[2] + matrix[12 + row] * vector[3]);

/** Planar projection from the exact live-preview camera viewport. Keep the UV
 * selection anchored at its current center while the user's view controls its
 * orientation and scale. Warcraft V remains top-down. */
export function projectUVFromView(geoset, indices, viewMatrix, projectionMatrix, source = geoset?.TVertices?.[0]) {
  if (![viewMatrix, projectionMatrix].every(matrix => matrix?.length === 16 && Array.from(matrix).every(Number.isFinite))) throw Error('Rotate the live preview before projecting.');
  const selected = uniqueIndices(indices), next = new Float32Array(source || []), count = geoset?.Vertices?.length / 3;
  if (!selected.length || selected.some(index => index >= count || index * 2 + 1 >= next.length)) throw Error('Select valid UV vertices before projecting.');
  const sourceCenter = [0, 0], projectedCenter = [0, 0], projected = [];
  for (const index of selected) {
    const point = Array.from(geoset.Vertices.subarray(index * 3, index * 3 + 3));
    const clip = transform4(projectionMatrix, transform4(viewMatrix, [...point, 1]));
    if (!Number.isFinite(clip[3]) || Math.abs(clip[3]) < 1e-8) throw Error('The selected vertices cannot be projected from this view.');
    const uv = [(clip[0] / clip[3] + 1) / 2, (1 - clip[1] / clip[3]) / 2];
    projected.push(uv); sourceCenter[0] += next[index * 2]; sourceCenter[1] += next[index * 2 + 1];
    projectedCenter[0] += uv[0]; projectedCenter[1] += uv[1];
  }
  for (const center of [sourceCenter, projectedCenter]) { center[0] /= selected.length; center[1] /= selected.length; }
  for (let position = 0; position < selected.length; position++) {
    const index = selected[position], uv = projected[position];
    next[index * 2] = sourceCenter[0] + uv[0] - projectedCenter[0];
    next[index * 2 + 1] = sourceCenter[1] + uv[1] - projectedCenter[1];
  }
  return next;
}

/** Commit only changed coordinates to each original geoset and UV set. */
export function splitSelectedUVGeosets(model, refs, values) {
  if (!values || values.length !== refs.length * 2) throw Error('Combined UV coordinates changed structure.');
  const changes = new Map();
  for (let index = 0; index < refs.length; index++) {
    const { geosetIndex, vertexIndex, uvSet } = refs[index], source = model?.Geosets?.[geosetIndex]?.TVertices?.[uvSet];
    if (!source) continue;
    const u = Number(values[index * 2]), v = Number(values[index * 2 + 1]);
    if (![u, v].every(value => Number.isFinite(value) && Number.isFinite(Math.fround(value)))) throw Error('UV coordinates must be finite.');
    if (u === source[vertexIndex * 2] && v === source[vertexIndex * 2 + 1]) continue;
    const key = geosetIndex + ':' + uvSet;
    if (!changes.has(key)) changes.set(key, { geosetIndex, uvSet, values: new Float32Array(source) });
    const target = changes.get(key).values;
    target[vertexIndex * 2] = u; target[vertexIndex * 2 + 1] = v;
  }
  return [...changes.values()];
}
