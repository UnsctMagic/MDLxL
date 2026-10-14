import { recalculateExtents } from '../src/editor-document.js';
import { recalculatePortraitExtents } from '../src/portrait-extents.js';
import { evaluateModelCamera, updateModelCameraFromView, MODEL_CAMERA_FOV_FACTOR, PORTRAIT_ASPECT } from './portrait-view.js';
import { Box3, Vector3 } from 'three';
import { allNodes, sampleGeosetAnimation, sampleNodeMatrices, sampleTrack, skinGeoset } from '../src/animation.js';
import { poseNodeRole } from '../src/pose-ik.js';

/** Apply the preview through the normal document history. */
export function setCameraFromCurrentView(model, cameraIndex, view, frame = 0, sequenceIndex = -1) {
  if (!view || !['position', 'target'].every(key => view[key]?.length === 3 && Array.from(view[key]).every(Number.isFinite))) throw Error('The model viewport is still loading.');
  model.Cameras ||= [];
  let index = model.Cameras[cameraIndex] ? cameraIndex : model.Cameras.length ? 0 : -1;
  if (index < 0) {
    const camera = { Name: 'Camera 01', Position: new Float32Array(view.position), TargetPosition: new Float32Array(view.target), FieldOfView: view.fieldOfView, NearClip: Math.max(.0001, view.near), FarClip: Math.max(view.far, view.near + .0001) };
    index = model.Cameras.push(camera) - 1;
    appendCameraBindPose(model);
  } else updateModelCameraFromView(model, model.Cameras[index], view, frame, sequenceIndex, frame, ['position', 'target', 'fieldOfView', 'near', 'far']);
  // Native Warcraft renders the reported portrait black when MDLxL's KCRL
  // camera-roll keys are present. Portrait orientation belongs to the model rig.
  delete model.Cameras[index].Rotation;
  recalculateExtents(model);
  recalculatePortraitExtents(model);
  return index;
}


function appendCameraBindPose(model) {
  for (const pose of model.BindPoses || []) pose.Matrices.push(new Float32Array([1,0,0,0,1,0,0,0,1,0,0,0]));
}

export function createPortraitCamera(model, view) {
  validatePortraitView(view);
  model.Cameras ||= [];
  let number = model.Cameras.length + 1;
  while (model.Cameras.some(camera => camera.Name === 'Camera ' + String(number).padStart(2, '0'))) number++;
  const camera = { Name: 'Camera ' + String(number).padStart(2, '0'), Position: new Float32Array(view.position), TargetPosition: new Float32Array(view.target), FieldOfView: view.fieldOfView, NearClip: view.near, FarClip: view.far };
  model.Cameras.push(camera); appendCameraBindPose(model);
  recalculateExtents(model); recalculatePortraitExtents(model);
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

export function editPortraitCamera(model, index, patch, frame = 0, sequenceIndex = -1) {
  const source = model.Cameras?.[index];
  if (!source) throw Error('Choose a camera first.');
  const view = { ...evaluateModelCamera(model, source, frame, sequenceIndex), ...patch };
  validatePortraitView(view);
  updateModelCameraFromView(model, source, view, frame, sequenceIndex, frame, Object.keys(patch));
  if (patch.name !== undefined) source.Name = String(patch.name).trim() || source.Name;
  recalculatePortraitExtents(model);
  return index;
}

export function portraitShot(view, kind) {
  validatePortraitView(view);
  const target = new Vector3(...view.target), offset = new Vector3(...view.position).sub(target), distance = offset.length();
  if (kind === 'front') offset.set(distance, 0, 0);
  else if (kind === 'level') { offset.z = 0; if (offset.lengthSq() < 1e-10) offset.set(1,0,0); offset.normalize().multiplyScalar(distance); }
  return { ...view, position: target.add(offset).toArray(), roll: 0 };
}

/** Use the posed head and neck when available; otherwise frame the visible body.
 * Mesh effects and hidden geosets do not determine the crop. */
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
  const nodes = allNodes(model);
  const heads = [...(model.Bones || []), ...(model.Helpers || [])].filter(node => poseNodeRole(node) === 'Head');
  let subject = points;
  if (heads.length === 1) {
    const head = heads[0], headPoint = new Vector3().fromArray(head.PivotPoint || model.PivotPoints?.[head.ObjectId] || [0,0,0]);
    if (matrices.get(head.ObjectId)) headPoint.applyMatrix4(matrices.get(head.ObjectId));
    const neck = nodes.find(node => node.ObjectId === head.Parent && poseNodeRole(node) === 'Neck');
    const neckPoint = neck && new Vector3().fromArray(neck.PivotPoint || model.PivotPoints?.[neck.ObjectId] || [0,0,0]);
    if (neckPoint && matrices.get(neck.ObjectId)) neckPoint.applyMatrix4(matrices.get(neck.ObjectId));
    const headHeight = Math.max(size.z * .12, neckPoint ? headPoint.distanceTo(neckPoint) : 0, .01);
    const crop = points.filter(point => point.z >= headPoint.z - headHeight * 1.5 && point.z <= headPoint.z + headHeight * 2 && Math.hypot(point.x - headPoint.x, point.y - headPoint.y) <= headHeight * 2.5);
    if (crop.length >= 3) subject = crop;
  }
  const box = new Box3().setFromPoints(subject), target = box.getCenter(new Vector3());
  const back = view ? new Vector3(...view.position).sub(new Vector3(...view.target)).normalize() : new Vector3(1,0,0);
  if (back.lengthSq() < .5) back.set(1,0,0);
  const reference = Math.abs(back.z) > .9999 ? new Vector3(-1,0,0) : new Vector3(0,0,1);
  const right = new Vector3().crossVectors(reference, back).normalize(), up = new Vector3().crossVectors(back, right).normalize();
  const fieldOfView = view?.fieldOfView || Math.PI / 4, tangent = Math.tan(fieldOfView * MODEL_CAMERA_FOV_FACTOR / 2);
  let distance = .1;
  for (const point of subject) {
    const offset = point.clone().sub(target);
    distance = Math.max(distance, offset.dot(back) + 1.15 * Math.max(Math.abs(offset.dot(up)) / tangent, Math.abs(offset.dot(right)) / (tangent * PORTRAIT_ASPECT)));
  }
  return { position: target.clone().addScaledVector(back,distance).toArray(), target: target.toArray(), fieldOfView, roll: 0, near: Math.max(.01, distance / 1000), far: Math.max(1000, distance + size.length() * 4) };
}
