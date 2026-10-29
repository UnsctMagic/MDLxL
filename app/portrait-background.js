import { Matrix4, Vector3 } from 'three';
import { allNodes, inverseGeosetSkinMatrix, sampleGeosetAnimation, sampleNodeMatrices, sampleTrack, skinGeoset } from '../src/animation.js';
import { createRigNode } from '../src/bone-tools.js';
import { recalculateExtents } from '../src/editor-document.js';
import { createVisibilityGeosetAnimation, ensureGeosetAnimation } from '../src/geoset-animation-defaults.js';
import { recalculatePortraitExtents } from '../src/portrait-extents.js';
import { fillSequenceExtents, isPortraitSequence } from '../src/sequence-editor.js';
import { uniqueName } from '../src/node-hierarchy.js';
import { evaluateModelCamera, MODEL_CAMERA_FOV_FACTOR, PORTRAIT_ASPECT } from './portrait-view.js';

// Measured from 152 distinct SD portrait backdrops (units\*_portrait.mdx) and
// 26 SD unit models with an embedded one: an unanimated, unparented Bone
// ("PortraitBackdrop"/"Plane01") holding one team-glow quad. The quad faces
// the camera (median |normal·view| 0.95), is centred on the view axis (median
// screen offset 0.02/0.04), sits at 2.4x the camera-target distance (p25 1.9,
// p75 3.3) and spans about 3.5x the visible half height around the centre.
// Its material is one unshaded, opaque (None) layer, so the team-colour glow
// fills the whole crop; it is visible only in Portrait sequences.
export const BACKDROP_DEPTH_RATIO = 2.4;
export const BACKDROP_HALF_SIZE = 3.5;
export const BACKDROP_BONE_NAME = 'PortraitBackdrop';
// The look the Background options adjust: size is the half width of the glow
// card in crop half heights (small keeps black around a spotlight, large
// fills the crop), height moves the glow centre up or down the crop.
export const BACKDROP_LOOK = Object.freeze({ size: BACKDROP_HALF_SIZE, height: 0 });
export const BACKDROP_SIZE_RANGE = Object.freeze([1.2, 6]);
export const BACKDROP_HEIGHT_RANGE = Object.freeze([-1, 1]);
const clamp = (value, [min, max]) => Math.min(max, Math.max(min, value));
export function normalizeBackdropLook(look) {
  const size = Number(look?.size), height = Number(look?.height);
  return { size: Number.isFinite(size) ? clamp(size, BACKDROP_SIZE_RANGE) : BACKDROP_LOOK.size, height: Number.isFinite(height) ? clamp(height, BACKDROP_HEIGHT_RANGE) : BACKDROP_LOOK.height };
}
const BACKDROP_NAME = /backdrop|background|portrait.?glow|portrait.?plane/i;

function cameraBasis(view) {
  const position = new Vector3(...view.position), forward = new Vector3(...view.target).sub(position).normalize();
  const reference = Math.abs(forward.z) > .9999 ? new Vector3(-1, 0, 0) : new Vector3(0, 0, 1);
  const right = new Vector3().crossVectors(forward, reference).normalize();
  const up = new Vector3().crossVectors(right, forward).normalize().applyAxisAngle(forward, Number(view.roll) || 0);
  right.crossVectors(forward, up).normalize();
  return { position, forward, right, up };
}

const textureOf = (model, layer) => model.Textures?.[Number.isInteger(layer?.TextureID) ? layer.TextureID : -1];
const teamGlowLayers = (model, geoset) => {
  const layers = model.Materials?.[geoset.MaterialID]?.Layers || [];
  return layers.length > 0 && layers.every(layer => textureOf(model, layer)?.ReplaceableId === 2 || /teamglow/i.test(textureOf(model, layer)?.Image || ''));
};

function visibleInSequence(model, geosetIndex, sequence) {
  const animation = (model.GeosetAnims || []).find(item => item.GeosetId === geosetIndex), [start, end] = sequence.Interval || [];
  if (!animation) return true;
  const frames = [start, (start + end) / 2, end, ...(animation.Alpha?.Keys || []).map(key => key.Frame).filter(frame => frame >= start && frame <= end)];
  return frames.some(frame => sampleTrack(animation.Alpha, frame, { interval: sequence.Interval, globalSequences: model.GlobalSequences, globalTime: 0, fallback: 1 }) > .001);
}

/** Size of a small card geoset (at most 16 points) and whether it is flat. */
function cardShape(geoset) {
  const count = Math.floor((geoset.Vertices?.length || 0) / 3);
  if (count < 3 || count > 16 || !(geoset.Faces?.length >= 3)) return { size: 0, flat: false };
  const points = Array.from({ length: count }, (_, index) => new Vector3().fromArray(geoset.Vertices, index * 3));
  const [a, b, c] = Array.from(geoset.Faces.slice(0, 3), index => points[index]);
  const normal = new Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a));
  const size = Math.max(...points.map(point => point.distanceTo(a)));
  if (!(normal.lengthSq() > 1e-12) || !(size > 1e-6)) return { size: 0, flat: false };
  normal.normalize();
  return { size, flat: count <= 8 && points.every(point => Math.abs(point.clone().sub(a).dot(normal)) <= size * .02) };
}

/** The geoset Warcraft shows as the portrait background, or -1. A card whose
 * bone is named like a backdrop counts (SD catapults use two quads); a flat
 * quad of at most eight points counts when it is shown only in Portrait
 * sequences, or is team glow in a portrait-only model. Hero team-glow planes
 * visible in Stand/Walk are never chosen. Ties go to the largest one. */
export function findPortraitBackground(model) {
  const sequences = model.Sequences || [], everyday = sequences.filter(sequence => !isPortraitSequence(sequence)), portraits = sequences.filter(sequence => isPortraitSequence(sequence));
  const nodes = new Map(allNodes(model).map(node => [node.ObjectId, node]));
  let best = -1, bestScore = 0, bestSize = 0;
  (model.Geosets || []).forEach((geoset, index) => {
    const { size, flat } = cardShape(geoset);
    if (!size) return;
    const named = (geoset.Groups || []).some(group => group.some(id => BACKDROP_NAME.test(nodes.get(id)?.Name || '')));
    const portraitOnly = flat && portraits.length > 0 && everyday.length > 0 && portraits.some(sequence => visibleInSequence(model, index, sequence)) && !everyday.some(sequence => visibleInSequence(model, index, sequence));
    const glow = flat && teamGlowLayers(model, geoset);
    if (!named && !portraitOnly && !(glow && !everyday.length)) return;
    const score = 2 * named + 2 * portraitOnly + glow;
    if (score > bestScore || score === bestScore && size > bestSize) { best = index; bestScore = score; bestSize = size; }
  });
  return best;
}

/** The pose Warcraft shows behind the portrait: the current Portrait
 * animation time, else the first Portrait sequence, else Stand. */
export function portraitBackgroundPose(model, frame = 0, sequenceIndex = -1) {
  const sequences = model.Sequences || [];
  if (isPortraitSequence(sequences[sequenceIndex])) return { frame, sequenceIndex };
  const index = sequences.findIndex(sequence => isPortraitSequence(sequence));
  if (index >= 0) return { frame: sequences[index].Interval[0], sequenceIndex: index };
  return sequences[sequenceIndex] ? { frame, sequenceIndex } : { frame: sequences[0]?.Interval?.[0] ?? 0, sequenceIndex: sequences.length ? 0 : -1 };
}

/** Where the background quad belongs for a camera view. The plane is pushed
 * behind every visible model point inside the crop and kept inside the far
 * clip; farClip is returned when the camera must see farther to show it. */
export function portraitBackgroundPlacement(model, view, frame = 0, sequenceIndex = -1, skip = -1, look = BACKDROP_LOOK) {
  const { size, height } = normalizeBackdropLook(look);
  const { position, forward, right, up } = cameraBasis(view), distance = new Vector3(...view.target).distanceTo(position);
  const tangent = Math.tan(view.fieldOfView * MODEL_CAMERA_FOV_FACTOR / 2), matrices = sampleNodeMatrices(model, frame, sequenceIndex, frame);
  let subject = distance;
  (model.Geosets || []).forEach((geoset, index) => {
    if (index === skip || sampleGeosetAnimation(model, index, frame, sequenceIndex, frame).alpha <= .001) return;
    const vertices = skinGeoset(geoset, matrices), offset = new Vector3();
    for (let start = 0; start + 2 < vertices.length; start += 3) {
      offset.set(vertices[start], vertices[start + 1], vertices[start + 2]).sub(position);
      const depth = offset.dot(forward);
      if (!(depth > 0) || !Number.isFinite(depth)) continue;
      if (Math.abs(offset.dot(right)) <= 1.2 * depth * tangent * PORTRAIT_ASPECT && Math.abs(offset.dot(up)) <= 1.2 * depth * tangent) subject = Math.max(subject, depth);
    }
  });
  let depth = Math.max(BACKDROP_DEPTH_RATIO * distance, subject + .25 * distance), farClip = null;
  const far = Number(view.far) > 0 ? Number(view.far) : Infinity;
  if (depth > far * .9) {
    if (far * .9 >= subject + .1 * distance) depth = far * .9;
    else farClip = Math.ceil(depth * 1.25);
  }
  const center = position.clone().addScaledVector(forward, depth).addScaledVector(up, height * tangent * depth);
  return { center, right, up, normal: forward.clone().negate(), halfSize: size * tangent * depth, depth, farClip };
}

/** The look of an existing background seen from a camera view, or null when
 * it does not face that view inside the crop (then Refresh starts again from
 * the Blizzard default). */
export function measureBackdropLook(model, index, view, frame = 0, sequenceIndex = -1) {
  const geoset = model.Geosets?.[index];
  if (!geoset || !view) return null;
  const { position, forward, right, up } = cameraBasis(view), tangent = Math.tan(view.fieldOfView * MODEL_CAMERA_FOV_FACTOR / 2);
  const vertices = skinGeoset(geoset, sampleNodeMatrices(model, frame, sequenceIndex, frame)), points = [];
  for (let start = 0; start + 2 < vertices.length; start += 3) {
    const offset = new Vector3(vertices[start], vertices[start + 1], vertices[start + 2]).sub(position), depth = offset.dot(forward);
    if (!(depth > 0)) return null;
    points.push({ x: offset.dot(right) / (depth * tangent), y: offset.dot(up) / (depth * tangent) });
  }
  if (points.length < 3) return null;
  const x = [Math.min(...points.map(point => point.x)), Math.max(...points.map(point => point.x))], y = [Math.min(...points.map(point => point.y)), Math.max(...points.map(point => point.y))];
  const size = Math.min(x[1] - x[0], y[1] - y[0]) / 2, height = (y[0] + y[1]) / 2, across = (x[0] + x[1]) / 2;
  if (!(size >= .8 && size <= 12) || Math.abs(height) > 1.5 || Math.abs(across) > 1.5) return null;
  return normalizeBackdropLook({ size, height });
}

/** The look Refresh keeps for the model's background, or null. */
export function currentBackdropLook(model, cameraIndex, frame = 0, sequenceIndex = -1) {
  const index = findPortraitBackground(model), camera = model.Cameras?.[cameraIndex] || model.Cameras?.[0];
  if (index < 0 || !camera) return null;
  const pose = portraitBackgroundPose(model, frame, sequenceIndex);
  return measureBackdropLook(model, index, evaluateModelCamera(model, camera, pose.frame, pose.sequenceIndex), pose.frame, pose.sequenceIndex);
}

/** Step keys at every sequence start: shown in Portrait sequences, hidden in
 * the rest (the SD unit-model pattern). A portrait-only file shows it always. */
function backdropVisibility(model, portraitFile) {
  const sequences = model.Sequences || [];
  if (!sequences.some(sequence => isPortraitSequence(sequence)) && !portraitFile) throw Error('This model has no Portrait animation. Use “No Portrait animation · Create” first, so the background shows only in the portrait.');
  if (portraitFile || sequences.every(sequence => isPortraitSequence(sequence))) return 1;
  const frames = new Map();
  for (const sequence of sequences) {
    const start = Number(sequence.Interval?.[0]);
    if (!Number.isFinite(start)) continue;
    const value = isPortraitSequence(sequence) ? 1 : 0;
    frames.set(start, frames.has(start) ? Math.min(frames.get(start), value) : value);
  }
  return { LineType: 0, GlobalSeqId: null, Keys: [...frames].sort(([a], [b]) => a - b).map(([Frame, value]) => ({ Frame, Vector: new Float32Array([value]) })) };
}

function backdropMaterial(model) {
  model.Textures ||= []; model.Materials ||= [];
  let textureId = model.Textures.findIndex(texture => texture.ReplaceableId === 2 && !texture.Image);
  if (textureId < 0) { textureId = model.Textures.length; model.Textures.push({ Image: '', ReplaceableId: 2, Flags: 0 }); }
  const existing = model.Materials.findIndex(material => material.Layers?.length === 1 && material.Layers[0].TextureID === textureId && material.Layers[0].FilterMode === 0 && material.Layers[0].Shading === 1 && material.Layers[0].Alpha === 1 && material.Layers[0].TVertexAnimId == null);
  if (existing >= 0) return existing;
  model.Materials.push({ PriorityPlane: 0, RenderMode: 0, Layers: [{ FilterMode: 0, Shading: 1, TextureID: textureId, TVertexAnimId: null, CoordId: 0, Alpha: 1 }] });
  return model.Materials.length - 1;
}

function createBackdrop(model, center) {
  const bone = createRigNode(model, 'Bone');
  const names = new Set(allNodes(model).filter(node => node !== bone).map(node => node.Name));
  bone.Name = uniqueName(BACKDROP_BONE_NAME, names, n => `${BACKDROP_BONE_NAME}${n}`); bone.Parent = null; bone.Flags = 256;
  bone.PivotPoint = new Float32Array(center.toArray()); model.PivotPoints[bone.ObjectId] = bone.PivotPoint;
  model.Geosets ||= []; model.GeosetAnims ||= [];
  // SD order: top-left, bottom-left, top-right, bottom-right; faces wind
  // counter-clockwise toward the camera.
  const geoset = { Vertices: new Float32Array(12), Normals: new Float32Array(12), TVertices: [new Float32Array([0, 0, 0, 1, 1, 0, 1, 1])], Faces: new Uint16Array([0, 1, 2, 3, 2, 1]), VertexGroup: new Uint8Array(4), Groups: [[bone.ObjectId]], TotalGroupsCount: 1, MaterialID: backdropMaterial(model), SelectionGroup: 0, Unselectable: false, Anims: [] };
  if (model.Version >= 900) geoset.LevelOfDetail = 0;
  const index = model.Geosets.push(geoset) - 1;
  bone.GeosetId = index; bone.GeosetAnimId = model.GeosetAnims.push(createVisibilityGeosetAnimation(index)) - 1;
  return index;
}

/** Move the quad onto the placement. Other shapes keep their outline and UVs,
 * scaled to cover the same area; vertices bound to an animated or parented
 * bone are placed through that bone's pose at the portrait time. */
function placeBackdrop(model, index, placement, frame, sequenceIndex) {
  const geoset = model.Geosets[index], count = geoset.Vertices.length / 3, matrices = sampleNodeMatrices(model, frame, sequenceIndex, frame);
  const posed = skinGeoset(geoset, matrices), points = Array.from({ length: count }, (_, vertex) => new Vector3().fromArray(posed, vertex * 3));
  const quad = count === 4 && Array.from(geoset.Faces).join() === '0,1,2,3,2,1';
  let local;
  if (quad) local = [[-1, 1], [-1, -1], [1, 1], [1, -1]];
  else {
    const centroid = points.reduce((sum, point) => sum.add(point), new Vector3()).divideScalar(count);
    const [a, b, c] = Array.from(geoset.Faces.slice(0, 3), vertex => points[vertex]);
    const normal = new Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a)).normalize();
    const u = placement.right.clone().addScaledVector(normal, -placement.right.dot(normal));
    if (u.lengthSq() < 1e-8) u.copy(placement.up).addScaledVector(normal, -placement.up.dot(normal));
    u.normalize();
    const v = new Vector3().crossVectors(normal, u);
    if (v.dot(placement.up) < 0) v.negate();
    const flat = points.map(point => [point.clone().sub(centroid).dot(u), point.clone().sub(centroid).dot(v)]);
    const min = [0, 1].map(axis => Math.min(...flat.map(item => item[axis]))), max = [0, 1].map(axis => Math.max(...flat.map(item => item[axis])));
    const middle = [0, 1].map(axis => (min[axis] + max[axis]) / 2), half = [0, 1].map(axis => Math.max(1e-6, (max[axis] - min[axis]) / 2));
    const scale = 1 / Math.min(...half);
    local = flat.map(item => [(item[0] - middle[0]) * scale, (item[1] - middle[1]) * scale]);
  }
  const inverse = new Matrix4(), world = new Vector3(), normalMatrix = new Matrix4();
  for (let vertex = 0; vertex < count; vertex++) {
    const [x, y] = local[vertex];
    world.copy(placement.center).addScaledVector(placement.right, x * placement.halfSize).addScaledVector(placement.up, y * placement.halfSize);
    inverseGeosetSkinMatrix(geoset, vertex, matrices, inverse);
    const rest = world.clone().applyMatrix4(inverse);
    geoset.Vertices.set(rest.toArray(), vertex * 3);
    const normal = placement.normal.clone().transformDirection(normalMatrix.copy(inverse));
    if (geoset.Normals?.length === geoset.Vertices.length) geoset.Normals.set(normal.toArray(), vertex * 3);
  }
  // Keep the faces turned toward the camera so one-sided materials render.
  if (!quad) {
    const faces = geoset.Faces;
    for (let start = 0; start + 2 < faces.length; start += 3) {
      const [a, b, c] = [0, 1, 2].map(offset => new Vector3(local[faces[start + offset]][0], local[faces[start + offset]][1], 0));
      if (new Vector3().crossVectors(b.sub(a), c.sub(a)).z < 0) [faces[start + 1], faces[start + 2]] = [faces[start + 2], faces[start + 1]];
    }
  }
  const bounds = { Geosets: [geoset], Info: {} }; recalculateExtents(bounds);
  fillSequenceExtents(model, geoset);
  if (model.Info) {
    for (const key of ['MinimumExtent', 'MaximumExtent']) model.Info[key] = new Float32Array([0, 1, 2].map(axis => (key === 'MinimumExtent' ? Math.min : Math.max)(model.Info[key]?.[axis] ?? geoset[key][axis], geoset[key][axis])));
    model.Info.BoundsRadius = Math.max(model.Info.BoundsRadius || 0, Math.hypot(...[0, 1, 2].map(axis => (model.Info.MaximumExtent[axis] - model.Info.MinimumExtent[axis]) / 2)));
  }
}

/** Add Background / Refresh Background: one undoable edit that places the SD
 * portrait backdrop behind the subject for the selected camera and makes it
 * visible only in Portrait sequences. Without a look, Refresh keeps the
 * background's current size and height; when they cannot be measured, and
 * for Add, the fallback look (else the Blizzard default) is used. */
export function refreshPortraitBackground(model, cameraIndex, { frame = 0, sequenceIndex = -1, portraitFile = false, look, fallback } = {}) {
  const camera = model.Cameras?.[cameraIndex] || model.Cameras?.[0];
  if (!camera) throw Error('Add a portrait camera first (Set Current View or New Camera).');
  const visibility = backdropVisibility(model, portraitFile), pose = portraitBackgroundPose(model, frame, sequenceIndex);
  const view = evaluateModelCamera(model, camera, pose.frame, pose.sequenceIndex);
  if (!view) throw Error('The portrait camera has no valid position.');
  let index = findPortraitBackground(model);
  const created = index < 0, kept = look || created ? null : measureBackdropLook(model, index, view, pose.frame, pose.sequenceIndex);
  const placement = portraitBackgroundPlacement(model, view, pose.frame, pose.sequenceIndex, index, look || kept || fallback || BACKDROP_LOOK);
  if (placement.farClip) camera.FarClip = placement.farClip;
  if (created) index = createBackdrop(model, placement.center);
  placeBackdrop(model, index, placement, pose.frame, pose.sequenceIndex);
  ensureGeosetAnimation(model, index, { refuseDuplicates: false }).Alpha = visibility;
  recalculatePortraitExtents(model);
  if (model.Info) { model.Info.NumGeosets = model.Geosets.length; model.Info.NumGeosetAnims = model.GeosetAnims.length; model.Info.NumBones = model.Bones?.length || 0; }
  return { geosetIndex: index, created, farClip: placement.farClip, look: normalizeBackdropLook(look || kept || fallback || BACKDROP_LOOK) };
}
