// The AI's off-screen pictures (mdlxl_capture samples): what the hidden preview is asked to draw,
// the pose it draws and how the framed points sit in the picture.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { OrthographicCamera, PerspectiveCamera, Vector3 } from 'three';
import { previewPresentationProps } from '../app/preview-presentation.js';
import { VIEW_PRESETS, orthographicHalfHeight, perspectiveFitDistance } from '../app/viewport-math.js';
import { aiPictureProps, drawnGeosets, frameExactly, picturePose, posedPoints, pointsBox, PICTURE_FILL } from '../src/ai-picture.js';
import { sampleAiModel } from '../src/ai-sampling.js';
import { parseCompatibleMdx } from '../src/mdx-compatibility.js';

const { fixturePath } = createRequire(import.meta.url)('./helpers/fixtures.cjs');
const loadMdx = name => {
  const b = fs.readFileSync(fixturePath(name));
  return parseCompatibleMdx(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
};
const missing = name => (fs.existsSync(fixturePath(name) || '') ? false : `test model not on this machine: ${name}`);

// What the hidden preview finally draws: the AI job's props after the preview presentation.
const drawn = (job, options = {}) => previewPresentationProps(aiPictureProps({ model: { Geosets: [] }, ...job }, { preferences: { graphics: {} }, ...options }));

test('a wireframe picture reaches the preview as wireframe: mesh lines drawn, surface skipped', () => {
  const wire = drawn({ renderMode: 'wireframe' });
  assert.equal(wire.mode, 'wireframe', 'GamePreview skips the surface only in wireframe mode');
  assert.equal(wire.overlays.wires, true, 'the mesh lines are drawn');
  const textured = drawn({ renderMode: 'textured' });
  assert.equal(textured.mode, 'textured');
  assert.equal(textured.overlays.wires, false, 'an ordinary picture has no mesh lines');
});

test('a plain picture reaches the preview as the untextured Surface View', () => {
  // The Warcraft preview adapter shades every first layer in one grey when mode is 'solid'.
  const plain = drawn({ renderMode: 'solid' });
  assert.equal(plain.mode, 'solid');
  assert.equal(plain.overlays.wires, false);
});

test('only the geosets a picture shows are drawn: the hidden ones reach the preview', () => {
  const only = drawn({ hiddenGeosets: [0, 2, 3] });
  assert.deepEqual([...only.hiddenGeosets], [0, 2, 3], 'geosets: [1] must not draw the whole model');
  // Ordinary previews still ignore the editor's hidden geosets.
  assert.equal(previewPresentationProps({ presentation: 'preview', preferences: { graphics: {} }, hiddenGeosets: [1] }).hiddenGeosets, undefined);
});

test('a picture without an animation draws the bind pose, where its framed points are', { skip: missing('footman') }, () => {
  const model = loadMdx('footman'), pose = picturePose(model, { sequence: -1, frame: 1234 });
  assert.equal(pose.bind, true);
  assert.equal(drawn({ sequence: -1, restPose: pose.bind }).restPose, true, 'the preview must not play sequence 0 instead');
  const points = posedPoints(pose, { 0: [0, 5] });
  assert.deepEqual(Array.from(points), [...model.Geosets[0].Vertices.subarray(0, 3), ...model.Geosets[0].Vertices.subarray(15, 18)]);
});

test('framed points cover every vertex of a geoset, posed exactly as sampling poses it', { skip: missing('forge-hd-footman') }, () => {
  const model = loadMdx('forge-hd-footman'),
    walk = model.Sequences.findIndex(s => /^walk/i.test(s.Name)),
    [start, end] = model.Sequences[walk].Interval,
    frame = Math.round((start + end) / 2),
    big = model.Geosets.reduce((best, g, i) => (g.Vertices.length > model.Geosets[best].Vertices.length ? i : best), 0),
    count = model.Geosets[big].Vertices.length / 3;
  assert.ok(count > 1000, 'a geoset larger than one sampling page');
  const pose = picturePose(model, { sequence: walk, frame }),
    points = posedPoints(pose, { [big]: true }),
    box = pointsBox(points),
    sampled = sampleAiModel(model, { frame, sequence: walk, selectedNodeIds: [] }, { frames: [frame], geosetIds: [big], vertices: {} }).samples[0].geosets[0].bounds;
  assert.equal(points.length / 3, new Set(model.Geosets[big].Faces).size, 'every vertex a triangle uses');
  for (let k = 0; k < 3; k++) {
    assert.ok(Math.abs(box.center[k] - box.half[k] - sampled.min[k]) < 1e-3, `min ${k}: ${box.center[k] - box.half[k]} vs ${sampled.min[k]}`);
    assert.ok(Math.abs(box.center[k] + box.half[k] - sampled.max[k]) < 1e-3, `max ${k}: ${box.center[k] + box.half[k]} vs ${sampled.max[k]}`);
  }
  // A frame past the end is drawn at the end, and the picture says the frame it drew.
  assert.equal(picturePose(model, { sequence: walk, frame: end + 5000 }).frame, end);
});

test('geosets faded out by their geoset animation are not counted as drawn', { skip: missing('footman') }, () => {
  const model = loadMdx('footman'),
    decay = model.Sequences.findIndex(s => /decay bone/i.test(s.Name)),
    pose = picturePose(model, { sequence: decay, frame: model.Sequences[decay].Interval[0] }),
    faded = model.Geosets.map((_, i) => i).filter(i => !drawnGeosets(pose).includes(i));
  assert.ok(faded.length > 0, 'Decay Bone hides the flesh');
  assert.ok(drawnGeosets(pose, [0]).every(g => g !== 0), 'hidden geosets stay out');
});

// A stand-in for the hidden GamePreview's capture API with its fit rules: the camera looks at the
// box centre and sizes the view from 0.75 of the box diagonal, in the preset's direction.
function previewStandIn(view, { width = 768, height = 576, radius = 60 } = {}) {
  const aspect = width / height,
    perspective = new PerspectiveCamera(42, aspect, 0.2, 1e6),
    ortho = new OrthographicCamera(-1, 1, 1, -1, -1e6, 1e6),
    target = new Vector3(),
    camera = view === 'perspective' ? perspective : ortho;
  perspective.up.set(0, 0, 1);
  const direction = new Vector3(...(VIEW_PRESETS[view]?.direction || [1, -1.5, 0.9])).normalize();
  if (VIEW_PRESETS[view]) ortho.up.fromArray(VIEW_PRESETS[view].up);
  else ortho.up.set(0, 0, 1);
  const place = r => {
    if (camera === perspective) perspective.position.copy(target).addScaledVector(direction, perspectiveFitDistance(r, 42, aspect));
    else {
      const half = orthographicHalfHeight(radius, aspect);
      Object.assign(ortho, { left: -half * aspect, right: half * aspect, top: half, bottom: -half, zoom: Math.max(1, radius) / r });
      ortho.position.copy(target).addScaledVector(direction, radius * 4);
    }
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  };
  return {
    fit(points) {
      const box = pointsBox(points);
      target.fromArray(box.center);
      place(Math.max(1, radius * 0.04, Math.hypot(...box.half) * 2 * 0.75));
    },
    focusPoint(values) {
      const next = new Vector3().fromArray(values);
      camera.position.add(next.clone().sub(target));
      target.copy(next);
      camera.updateMatrixWorld();
    },
    project(points) {
      const out = new Float32Array(points.length), point = new Vector3();
      for (let i = 0; i < points.length; i += 3) {
        point.set(points[i], points[i + 1], points[i + 2]).project(camera);
        out[i] = ((point.x + 1) / 2) * width;
        out[i + 1] = ((1 - point.y) / 2) * height;
        out[i + 2] = point.z >= -1 && point.z <= 1 ? 1 : 0;
      }
      return out;
    },
  };
}

test('framed points end up centred and filling the picture in every view preset', { skip: missing('footman') }, () => {
  const model = loadMdx('footman'), pose = picturePose(model, { sequence: -1 }),
    // The shield alone sits well off the model's centre: a close-up of it must not park in a corner.
    shield = posedPoints(pose, { 1: true }),
    body = posedPoints(pose, new Map(drawnGeosets(pose).map(g => [g, true])));
  for (const points of [body, shield])
    for (const view of ['front', 'back', 'left', 'right', 'top', 'bottom', 'perspective']) {
      const placed = frameExactly(previewStandIn(view), points);
      assert.ok(Math.abs(placed.dx) < 1 && Math.abs(placed.dy) < 1, `${view}: centre off by ${placed.dx}, ${placed.dy} px`);
      assert.ok(Math.abs(placed.fill - PICTURE_FILL) < 0.01, `${view}: fills ${placed.fill}`);
      assert.ok(placed.minX >= 0 && placed.maxX <= 768 && placed.minY >= 0 && placed.maxY <= 576, `${view}: fully visible`);
      // Zoom crops into the same centre (perspective moves closer, so near parts grow a little more).
      const zoomed = frameExactly(previewStandIn(view), points, { zoom: 2 }), slack = view === 'perspective' ? 0.08 : 0.003;
      assert.ok(Math.abs(zoomed.dx) < 768 * slack && Math.abs(zoomed.dy) < 576 * slack && Math.abs(zoomed.fill - 2 * PICTURE_FILL) < (view === 'perspective' ? 0.2 : 0.02), `${view} zoom 2: ${JSON.stringify(zoomed)}`);
    }
});
