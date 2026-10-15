import { evaluateModelCamera, updateModelCameraFromView, MODEL_CAMERA_FOV_FACTOR, PORTRAIT_ASPECT } from './portrait-view.js';
import { Box3, Vector3 } from 'three';
import { allNodes, sampleGeosetAnimation, sampleNodeMatrices, sampleTrack, skinGeoset } from '../src/animation.js';
import { poseNodeRole } from '../src/pose-ik.js';

// MDX stores camera names in 80 one-byte characters, including the terminating zero.
export const CAMERA_NAME_LIMIT = 79;
// Hand-made SD portrait cameras use near clips of 1-8 units.
export const portraitNearClip = distance => Math.min(Math.max(1, distance * .05), Math.max(.01, distance * .5));
const CAMERA_FIELDS = ['position', 'target', 'fieldOfView', 'near', 'far'];
const close = (a, b) => Math.abs(Number(a) - Number(b)) <= 1e-5 * Math.max(1, Math.abs(Number(b)));
const sameValue = (a, b) => Array.isArray(a) || ArrayBuffer.isView(a) ? a?.length === b?.length && Array.from(a).every((value, index) => close(value, b[index])) : close(a, b);

export function cleanCameraName(value) {
  // MDL stores the name in double quotes; keep both save formats valid.
  const name = String(value ?? '').replace(/[\r\n\0]/g, '').replace(/"/g, "'").trim();
  if (name.length > CAMERA_NAME_LIMIT) throw Error('A camera name can have at most 79 characters.');
  return name;
}

/** Keep only the fields that differ from the evaluated camera. Unchanged
 * numeric fields (within float precision) and names are dropped, so a blur or
 * Enter on an untouched field never creates an edit. */
export function changedPortraitFields(model, index, patch, frame = 0, sequenceIndex = -1) {
  const source = model?.Cameras?.[index];
  if (!source || !patch) return {};
  const current = evaluateModelCamera(model, source, frame, sequenceIndex) || {}, changed = {};
  for (const [key, value] of Object.entries(patch)) {
    if (key === 'name') { const name = cleanCameraName(value); if (name && name !== (source.Name || '')) changed.name = name; }
    else if (CAMERA_FIELDS.includes(key) && !sameValue(value, current[key])) changed[key] = value;
  }
  return changed;
}

function appendCameraBindPose(model) {
  for (const pose of model.BindPoses || []) pose.Matrices.push(new Float32Array([1,0,0,0,1,0,0,0,1,0,0,0]));
}

/** Apply a view through the normal document history. Camera-only: authored
 * sequence/geoset/model extents and any Rotation (KCRL) track stay untouched. */
export function setCameraFromCurrentView(model, cameraIndex, view, frame = 0, sequenceIndex = -1) {
  if (!view || !['position', 'target'].every(key => view[key]?.length === 3 && Array.from(view[key]).every(Number.isFinite))) throw Error('The model viewport is still loading.');
  model.Cameras ||= [];
  const index = model.Cameras[cameraIndex] ? cameraIndex : model.Cameras.length ? 0 : -1;
  if (index < 0) {
    validatePortraitView(view);
    const near = portraitNearClip(new Vector3(...view.position).distanceTo(new Vector3(...view.target)));
    const camera = { Name: 'Camera 01', Position: new Float32Array(view.position), TargetPosition: new Float32Array(view.target), FieldOfView: view.fieldOfView, NearClip: near, FarClip: Math.max(view.far, near + 1) };
    appendCameraBindPose(model);
    return model.Cameras.push(camera) - 1;
  }
  const patch = changedPortraitFields(model, index, Object.fromEntries(CAMERA_FIELDS.map(key => [key, view[key]])), frame, sequenceIndex);
  if (Object.keys(patch).length) {
    validatePortraitView({ ...evaluateModelCamera(model, model.Cameras[index], frame, sequenceIndex), ...patch });
    updateModelCameraFromView(model, model.Cameras[index], patch, frame, sequenceIndex, frame, Object.keys(patch));
  }
  return index;
}

export function createPortraitCamera(model, view) {
  validatePortraitView(view);
  model.Cameras ||= [];
  let number = model.Cameras.length + 1;
  while (model.Cameras.some(camera => camera.Name === 'Camera ' + String(number).padStart(2, '0'))) number++;
  const camera = { Name: 'Camera ' + String(number).padStart(2, '0'), Position: new Float32Array(view.position), TargetPosition: new Float32Array(view.target), FieldOfView: view.fieldOfView, NearClip: view.near, FarClip: view.far };
  model.Cameras.push(camera); appendCameraBindPose(model);
  return model.Cameras.length - 1;
}

/** Warcraft uses the first camera. Keep its associated bind-pose matrix with it. */
export function makePortraitCamera(model, index) {
  if (!model.Cameras?.[index]) throw Error('Choose a camera first.');
  if (index === 0) return 0;
  const count = model.Cameras.length;
  model.Cameras.unshift(model.Cameras.splice(index, 1)[0]);
  for (const pose of model.BindPoses || []) {
    const start = pose.Matrices.length - count;
    pose.Matrices.splice(start, 0, pose.Matrices.splice(start + index, 1)[0]);
  }
  return 0;
}

export function validatePortraitView(view) {
  if (!view || !['position','target'].every(key => view[key]?.length === 3 && Array.from(view[key]).every(Number.isFinite))) throw Error('Camera coordinates must be finite numbers.');
  if (new Vector3(...view.position).distanceToSquared(new Vector3(...view.target)) < 1e-10) throw Error('The camera position and target must be different.');
  if (!(Number.isFinite(view.fieldOfView) && view.fieldOfView > 0 && view.fieldOfView < Math.PI)) throw Error('Field of view must be between 0 and 180 degrees.');
  if (!(Number.isFinite(view.near) && Number.isFinite(view.far) && view.near > 0 && view.far > view.near)) throw Error('Near clip must be positive and Far clip must be greater than Near clip.');
  return view;
}

/** Edit the camera fields only. Values equal to the current camera are ignored. */
export function editPortraitCamera(model, index, patch, frame = 0, sequenceIndex = -1) {
  const source = model.Cameras?.[index];
  if (!source) throw Error('Choose a camera first.');
  const changed = changedPortraitFields(model, index, patch, frame, sequenceIndex), { name, ...fields } = changed;
  if (Object.keys(fields).length) {
    validatePortraitView({ ...evaluateModelCamera(model, source, frame, sequenceIndex), ...fields });
    updateModelCameraFromView(model, source, fields, frame, sequenceIndex, frame, Object.keys(fields));
  }
  if (name !== undefined) source.Name = name;
  return index;
}

export function portraitShot(view, kind) {
  validatePortraitView(view);
  const target = new Vector3(...view.target), offset = new Vector3(...view.position).sub(target), distance = offset.length();
  if (kind === 'front') offset.set(distance, 0, 0);
  else if (kind === 'level') { offset.z = 0; if (offset.lengthSq() < 1e-10) offset.set(1,0,0); offset.normalize().multiplyScalar(distance); }
  return { ...view, position: target.add(offset).toArray(), roll: 0 };
}

const MOUNT_HEAD = /horse|mount|steed|wolf|boar/i;
// Calibrated against 54 hand-made SD portrait cameras (median distance ratio
// 1.0): the visible portrait height averages 0.38 of the head's height above
// the feet and 1.27 of the head-to-pelvis length; the target sits just above
// the head pivot.
const HEAD_HEIGHT_SCALE = .379, TORSO_SCALE = 1.271, TARGET_LIFT = .035;
// Default New Camera direction: the median authored camera sits about 20°
// toward the model's right side and level with the face (models face +X).
const DEFAULT_PORTRAIT_DIRECTION = new Vector3(Math.cos(-20 * Math.PI / 180), Math.sin(-20 * Math.PI / 180), 0);

/** A named portrait head wins; otherwise the highest rider/character head,
 * never a horse or other mount head. */
export function portraitHeadNode(model, matrices = sampleNodeMatrices(model, 0, -1, 0)) {
  const nodes = [...(model.Bones || []), ...(model.Helpers || [])];
  const named = nodes.find(node => /portrait.*head/i.test(node.Name || ''));
  if (named) return named;
  const point = node => nodePoint(model, node, matrices);
  return nodes.filter(node => poseNodeRole(node) === 'Head' && !MOUNT_HEAD.test(node.Name || '')).sort((a, b) => point(b).z - point(a).z)[0] || null;
}

function nodePoint(model, node, matrices) {
  const point = new Vector3().fromArray(node.PivotPoint || model.PivotPoints?.[node.ObjectId] || [0,0,0]);
  const matrix = matrices.get(node.ObjectId);
  return matrix ? point.applyMatrix4(matrix) : point;
}

/** Frame a WC3-style head-and-shoulders shot from the posed head; models
 * without a head are framed as a whole. Mesh effects and hidden geosets do not
 * determine the crop. */
export function framePortraitSubject(model, view, frame = 0, sequenceIndex = -1) {
  const matrices = sampleNodeMatrices(model, frame, sequenceIndex, frame), points = [];
  for (const [index, geoset] of (model.Geosets || []).entries()) {
    if (sampleGeosetAnimation(model, index, frame, sequenceIndex, frame).alpha <= .001) continue;
    const layers = model.Materials?.[geoset.MaterialID]?.Layers || [];
    if (layers.length && layers.every(layer => [3,4].includes(layer.FilterMode) || sampleTrack(layer.Alpha, frame, { interval: model.Sequences?.[sequenceIndex]?.Interval, globalSequences: model.GlobalSequences, globalTime: frame, fallback: 1 }) <= .001)) continue;
    const vertices = skinGeoset(geoset, matrices);
    for (const id of new Set(geoset.Faces || [])) { const p = new Vector3().fromArray(vertices, id * 3); if (p.toArray().every(Number.isFinite)) points.push(p); }
  }
  if (!points.length) throw Error('No visible mesh is available to frame.');
  const bounds = new Box3().setFromPoints(points), size = bounds.getSize(new Vector3());
  const back = view ? new Vector3(...view.position).sub(new Vector3(...view.target)).normalize() : DEFAULT_PORTRAIT_DIRECTION.clone();
  if (!(back.lengthSq() > .5)) back.copy(DEFAULT_PORTRAIT_DIRECTION);
  const fieldOfView = view?.fieldOfView > 0 && view.fieldOfView < Math.PI ? view.fieldOfView : Math.PI / 4, tangent = Math.tan(fieldOfView * MODEL_CAMERA_FOV_FACTOR / 2);
  const head = portraitHeadNode(model, matrices), headPoint = head && nodePoint(model, head, matrices);
  const headHeight = headPoint ? headPoint.z - bounds.min.z : 0;
  let target, distance;
  if (head && headHeight > 1e-3) {
    // Torso: the head's chain down to its pelvis/root, ignoring a mount below.
    const byId = new Map(allNodes(model).map(node => [node.ObjectId, node])), seen = new Set();
    let pelvis = null;
    for (let node = byId.get(head.Parent); node && !seen.has(node.ObjectId) && !pelvis; node = byId.get(node.Parent)) {
      seen.add(node.ObjectId);
      if (['Pelvis', 'Body'].includes(poseNodeRole(node)) && !MOUNT_HEAD.test(node.Name || '')) pelvis = node;
    }
    const torso = pelvis ? headPoint.distanceTo(nodePoint(model, pelvis, matrices)) : 0;
    const visible = torso > 1e-3 ? (HEAD_HEIGHT_SCALE * headHeight + TORSO_SCALE * torso) / 2 : HEAD_HEIGHT_SCALE * headHeight;
    target = headPoint.clone().add(new Vector3(0, 0, TARGET_LIFT * headHeight));
    distance = visible / 2 / tangent;
  } else {
    const reference = Math.abs(back.z) > .9999 ? new Vector3(-1,0,0) : new Vector3(0,0,1);
    const right = new Vector3().crossVectors(reference, back).normalize(), up = new Vector3().crossVectors(back, right).normalize();
    target = bounds.getCenter(new Vector3()); distance = .1;
    for (const point of points) {
      const offset = point.clone().sub(target);
      distance = Math.max(distance, offset.dot(back) + 1.15 * Math.max(Math.abs(offset.dot(up)) / tangent, Math.abs(offset.dot(right)) / (tangent * PORTRAIT_ASPECT)));
    }
  }
  return { position: target.clone().addScaledVector(back, distance).toArray(), target: target.toArray(), fieldOfView, roll: 0, near: portraitNearClip(distance), far: Math.max(1000, distance + size.length() * 4) };
}
