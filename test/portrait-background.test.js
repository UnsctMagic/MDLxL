import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { createDemoDocument, openDocument } from '../src/editor-document.js';
import { sampleGeosetAnimation, sampleNodeMatrices, skinGeoset } from '../src/animation.js';
import { createPortraitCamera } from '../app/portrait-camera-edit.js';
import { evaluateModelCamera, MODEL_CAMERA_FOV_FACTOR, PORTRAIT_ASPECT } from '../app/portrait-view.js';
import { BACKDROP_DEPTH_RATIO, BACKDROP_HALF_SIZE, findPortraitBackground, refreshPortraitBackground } from '../app/portrait-background.js';

const view = { position: [200, -60, 150], target: [0, 0, 140], fieldOfView: Math.PI / 4, near: 8, far: 2000 };
const SECTIONS = ['Geosets', 'GeosetAnims', 'Materials', 'Textures', 'Bones', 'Nodes', 'PivotPoints', 'BindPoses', 'Sequences', 'Cameras', 'Info'];

function portraitDocument() {
  const doc = createDemoDocument();
  doc.apply('setup', ['Sequences', 'Geosets', 'Cameras', 'BindPoses'], model => {
    model.Sequences.push({ ...structuredClone(model.Sequences[0]), Name: 'Portrait', Interval: new Uint32Array([3000, 4000]) });
    for (const geoset of model.Geosets) geoset.Anims.push(structuredClone(geoset.Anims[0]));
    model.Cameras = [];
    createPortraitCamera(model, view);
  });
  return doc;
}

/** Background corners in normalized crop coordinates (±1 = crop edge). */
function screen(model, index, sequenceIndex) {
  const frame = model.Sequences[sequenceIndex].Interval[0], camera = evaluateModelCamera(model, model.Cameras[0], frame, sequenceIndex);
  const position = new Vector3(...camera.position), forward = new Vector3(...camera.target).sub(position).normalize();
  const right = new Vector3().crossVectors(forward, new Vector3(0, 0, 1)).normalize(), up = new Vector3().crossVectors(right, forward);
  const tangent = Math.tan(camera.fieldOfView * MODEL_CAMERA_FOV_FACTOR / 2), vertices = skinGeoset(model.Geosets[index], sampleNodeMatrices(model, frame, sequenceIndex, frame));
  const points = [];
  for (let start = 0; start < vertices.length; start += 3) {
    const offset = new Vector3(vertices[start], vertices[start + 1], vertices[start + 2]).sub(position), depth = offset.dot(forward);
    points.push({ x: offset.dot(right) / (depth * tangent * PORTRAIT_ASPECT), y: offset.dot(up) / (depth * tangent), depth });
  }
  return { points, distance: new Vector3(...camera.target).distanceTo(position), far: camera.far };
}

test('Add Background creates the SD team-glow backdrop behind the subject, filling the crop, Portrait-only, undoable and saveable', () => {
  const doc = portraitDocument(), before = structuredClone(doc.model);
  assert.equal(findPortraitBackground(doc.model), -1);
  const result = doc.apply('Add portrait background', SECTIONS, model => refreshPortraitBackground(model, 0));
  const model = doc.model, geoset = model.Geosets[result.geosetIndex];
  assert.equal(result.created, true); assert.equal(model.Geosets.length, before.Geosets.length + 1);
  assert.equal(findPortraitBackground(model), result.geosetIndex);
  const bone = model.Bones.find(node => node.ObjectId === geoset.Groups[0][0]);
  assert.equal(bone.Name, 'PortraitBackdrop'); assert.equal(bone.Parent, null); assert.equal(bone.Flags, 256);
  const layer = model.Materials[geoset.MaterialID].Layers[0];
  assert.deepEqual([model.Materials[geoset.MaterialID].Layers.length, layer.FilterMode, layer.Shading, layer.Alpha, model.Textures[layer.TextureID].ReplaceableId], [1, 0, 1, 1, 2]);
  assert.deepEqual(Array.from(geoset.TVertices[0]), [0, 0, 0, 1, 1, 0, 1, 1]); assert.deepEqual(Array.from(geoset.Faces), [0, 1, 2, 3, 2, 1]);
  const { points, distance, far } = screen(model, result.geosetIndex, 1);
  for (const point of points) {
    assert.ok(Math.abs(point.depth / distance - BACKDROP_DEPTH_RATIO) < 1e-3, 'SD depth');
    assert.ok(point.depth < far, 'inside the far clip');
  }
  const [topLeft, bottomLeft, topRight, bottomRight] = points;
  assert.ok(topLeft.x < -3 && topLeft.y > 3 && bottomLeft.y < -3 && topRight.x > 3 && bottomRight.x > 3 && bottomRight.y < -3, 'covers the crop upright with SD margin');
  assert.ok(Math.abs(topLeft.y - BACKDROP_HALF_SIZE) < .01);
  // The first face winds counter-clockwise on screen, so it faces the camera.
  assert.ok((bottomLeft.x - topLeft.x) * (topRight.y - topLeft.y) - (bottomLeft.y - topLeft.y) * (topRight.x - topLeft.x) > 0);
  assert.equal(sampleGeosetAnimation(model, result.geosetIndex, 3500, 1, 3500).alpha, 1);
  assert.equal(sampleGeosetAnimation(model, result.geosetIndex, 1000, 0, 1000).alpha, 0);
  for (const format of ['mdl', 'mdx']) {
    const reopened = openDocument(doc.serialize(format), 'portrait.' + format);
    assert.equal(findPortraitBackground(reopened.model), result.geosetIndex);
  }
  doc.undo(); assert.deepEqual(doc.model, before);
});

test('Refresh Background re-places the existing backdrop for a moved camera and repairs its visibility', () => {
  const doc = portraitDocument();
  const added = doc.apply('Add', SECTIONS, model => refreshPortraitBackground(model, 0));
  doc.apply('Move camera', ['Cameras', 'GeosetAnims'], model => {
    model.Cameras[0].Position = new Float32Array([-150, 120, 220]);
    model.GeosetAnims.find(item => item.GeosetId === added.geosetIndex).Alpha = 1;
  });
  const count = doc.model.Geosets.length;
  const refreshed = doc.apply('Refresh', SECTIONS, model => refreshPortraitBackground(model, 0));
  assert.equal(refreshed.created, false); assert.equal(refreshed.geosetIndex, added.geosetIndex); assert.equal(doc.model.Geosets.length, count);
  const { points, distance } = screen(doc.model, refreshed.geosetIndex, 1);
  assert.ok(points.every(point => Math.abs(point.depth / distance - BACKDROP_DEPTH_RATIO) < 1e-3 && Math.abs(Math.abs(point.x) - BACKDROP_HALF_SIZE / PORTRAIT_ASPECT) < .01));
  assert.equal(sampleGeosetAnimation(doc.model, refreshed.geosetIndex, 1000, 0, 1000).alpha, 0);
});

test('the backdrop goes behind subject geometry that reaches past the SD depth', () => {
  const doc = portraitDocument();
  doc.apply('Long tail', ['Geosets'], model => {
    const geoset = model.Geosets[0];
    // Pull one point of the blade far behind the target, inside the crop.
    geoset.Vertices.set([-1200, 360, 140], 0);
  });
  const result = doc.apply('Add', SECTIONS, model => refreshPortraitBackground(model, 0));
  const { points } = screen(doc.model, result.geosetIndex, 1), tail = new Vector3(-1200, 360, 140).sub(new Vector3(...view.position)).dot(new Vector3(...view.target).sub(new Vector3(...view.position)).normalize());
  assert.ok(points.every(point => point.depth > tail));
});

test('a far clip that would hide the backdrop is extended', () => {
  const doc = portraitDocument();
  doc.apply('Near far clip', ['Cameras'], model => { model.Cameras[0].FarClip = 300; });
  const result = doc.apply('Add', SECTIONS, model => refreshPortraitBackground(model, 0));
  const { points, far } = screen(doc.model, result.geosetIndex, 1);
  assert.ok(result.farClip > 300); assert.ok(points.every(point => point.depth < far));
});

test('hero team-glow planes shown in Stand are not mistaken for the background; no Portrait sequence is refused', () => {
  const doc = createDemoDocument();
  doc.apply('setup', ['Cameras', 'BindPoses'], model => { model.Cameras = []; createPortraitCamera(model, view); });
  assert.throws(() => doc.apply('Add', SECTIONS, model => refreshPortraitBackground(model, 0)), /no Portrait animation/);
  const portraitFile = doc.apply('Add', SECTIONS, model => refreshPortraitBackground(model, 0, { portraitFile: true }));
  assert.equal(sampleGeosetAnimation(doc.model, portraitFile.geosetIndex, 1000, 0, 1000).alpha, 1);
  doc.undo();
  doc.apply('Hero glow', ['Geosets', 'Textures', 'Materials', 'Bones', 'Nodes', 'PivotPoints', 'GeosetAnims', 'Sequences'], model => {
    refreshPortraitBackground(model, 0, { portraitFile: true });
    model.Bones.at(-1).Name = 'Glow';
    model.Sequences.push({ ...structuredClone(model.Sequences[0]), Name: 'Portrait', Interval: new Uint32Array([3000, 4000]) });
    for (const geoset of model.Geosets) geoset.Anims.push(structuredClone(geoset.Anims[0]));
  });
  assert.equal(findPortraitBackground(doc.model), -1);
});

test('Background options set the glow size and height; Refresh keeps them; a lost background starts from the Blizzard default', async () => {
  const { currentBackdropLook, BACKDROP_LOOK } = await import('../app/portrait-background.js');
  const doc = portraitDocument();
  const spotlight = { size: 1.8, height: -.75 };
  const added = doc.apply('Add', SECTIONS, model => refreshPortraitBackground(model, 0, { look: spotlight }));
  let { points } = screen(doc.model, added.geosetIndex, 1);
  const top = Math.max(...points.map(point => point.y)), bottom = Math.min(...points.map(point => point.y));
  assert.ok(Math.abs((top + bottom) / 2 - spotlight.height) < .01 && Math.abs((top - bottom) / 2 - spotlight.size) < .01);
  assert.deepEqual(Object.values(currentBackdropLook(doc.model, 0)).map(value => +value.toFixed(3)), [1.8, -.75]);
  doc.apply('Move camera', ['Cameras'], model => { model.Cameras[0].Position = new Float32Array([-150, 120, 220]); });
  // Seen from the moved camera the old card is off-centre, so its look is unknown.
  assert.equal(currentBackdropLook(doc.model, 0), null);
  const reset = doc.apply('Refresh', SECTIONS, model => refreshPortraitBackground(model, 0));
  assert.deepEqual(reset.look, BACKDROP_LOOK);
  doc.apply('Spotlight again', SECTIONS, model => refreshPortraitBackground(model, 0, { look: spotlight }));
  doc.apply('Small camera move', ['Cameras'], model => { model.Cameras[0].Position[2] += 4; });
  const kept = doc.apply('Refresh', SECTIONS, model => refreshPortraitBackground(model, 0));
  assert.ok(Math.abs(kept.look.size - spotlight.size) < .1 && Math.abs(kept.look.height - spotlight.height) < .1, JSON.stringify(kept.look));
  ({ points } = screen(doc.model, kept.geosetIndex, 1));
  assert.ok(points.every(point => Math.abs(point.depth / screen(doc.model, kept.geosetIndex, 1).distance - BACKDROP_DEPTH_RATIO) < 1e-3));
});
