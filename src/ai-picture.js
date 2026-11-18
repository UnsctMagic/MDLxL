// The AI's off-screen pictures: the props its hidden preview gets for one picture, the pose it
// draws and exact framing. Drawing happens in app/AiOffscreenRender.jsx; everything here is plain
// data so it can be tested.
import { sampleGeosetAnimation, sampleNodeMatrices, skinGeoset } from './animation.js';
import { isolateGlobalSequence } from './global-sequence-preview.js';

// Render modes a picture can ask for: the surface with its textures, mesh lines only, or plain
// shading (the editor's Surface View: one untextured grey, lit, cut-outs kept).
const PICTURE_MODES = ['textured', 'wireframe', 'solid'];
/** Share of the picture the framed points span (the larger of width and height). */
export const PICTURE_FILL = 0.88;

/** The hidden GamePreview's props for one AI picture job. The preview presentation reads the
 * render mode from previewMode (it overwrites mode), so wireframe and plain pictures set it there.
 * The geosets the job hides stay hidden, and no animation (sequence -1) is the bind pose. */
export function aiPictureProps(job, { preferences, teamColor } = {}) {
  return {
    presentation: 'preview',
    model: job.model,
    revision: job.revision || 0,
    textureAssets: job.assets,
    modelPath: job.path,
    preferences,
    teamColor,
    sequenceIndex: job.sequence ?? -1,
    globalSeqId: job.globalSequence ?? null,
    time: job.frame || 0,
    restPose: job.restPose === true,
    playing: false,
    showGrid: false,
    showParticles: job.showParticles,
    mode: job.renderMode || 'textured',
    previewMode: PICTURE_MODES.includes(job.renderMode) ? job.renderMode : 'textured',
    view: job.view || 'perspective',
    hiddenGeosets: job.hiddenGeosets,
    keepHiddenGeosets: true,
    overlays: { bones: false, nodes: false, particles: false, attachments: false },
  };
}

const clamp = (value, low, high) => Math.min(high, Math.max(low, Number.isFinite(value) ? value : low));

/**
 * The pose a picture draws, as the hidden preview draws it: a global animation on its own
 * clock (other tracks held, as in sampling), a sequence with the frame kept inside it, or no
 * animation: the bind pose, whose geoset visibility the preview takes from the first animation.
 */
export function picturePose(model, { sequence = -1, globalSequence = null, frame = 0 } = {}) {
  const duration = globalSequence == null ? 0 : model.GlobalSequences?.[globalSequence];
  if (duration > 0) {
    const isolated = isolateGlobalSequence(structuredClone(model), globalSequence),
      reel = isolated.Sequences.push({ Name: 'AI global preview', Interval: new Uint32Array([0, duration]) }) - 1,
      at = clamp(frame, 0, duration);
    return { kind: 'global', model: isolated, sequence: reel, frame: at, globalTime: at, globalSequence, interval: [0, duration] };
  }
  const interval = model.Sequences?.[sequence]?.Interval;
  if (sequence >= 0 && interval) {
    const at = clamp(frame, interval[0], interval[1]);
    return { kind: 'sequence', model, sequence, frame: at, globalTime: at, interval: [interval[0], interval[1]] };
  }
  const first = model.Sequences?.[0]?.Interval;
  return { kind: 'bind', model, sequence: first ? 0 : -1, frame: first ? first[0] : 0, globalTime: first ? first[0] : 0, bind: true };
}

/** Node matrices of the pose, or null for the bind pose (vertices as stored). */
export const poseMatrices = pose => (pose.bind ? null : sampleNodeMatrices(pose.model, pose.frame, pose.sequence, pose.globalTime));

/** The geosets the preview draws in this pose: not hidden, and not faded out by their geoset animation. */
export function drawnGeosets(pose, hidden = []) {
  const skip = new Set(hidden);
  return pose.model.Geosets.flatMap((_, index) =>
    !skip.has(index) && sampleGeosetAnimation(pose.model, index, pose.frame, pose.sequence, pose.globalTime).alpha > 0.001 ? [index] : [],
  );
}

/** The vertices the geoset's triangles use. */
export const usedVertices = geoset => [...new Set(geoset?.Faces || [])];

/**
 * Model-space positions, posed, of vertices given per geoset (geoset index -> vertex ids, or true for
 * every vertex a triangle uses), as flat [x, y, z, ...]. No cap: framing needs every point.
 */
export function posedPoints(pose, byGeoset, matrices = poseMatrices(pose)) {
  const out = [];
  for (const [key, ids] of byGeoset instanceof Map ? byGeoset : Object.entries(byGeoset || {})) {
    const geoset = pose.model.Geosets[key];
    if (!geoset?.Vertices?.length) continue;
    const positions = matrices ? skinGeoset(geoset, matrices) : geoset.Vertices,
      list = ids === true ? usedVertices(geoset) : ids;
    for (const id of list || [])
      if (Number.isInteger(id) && id >= 0 && id * 3 + 2 < positions.length) out.push(positions[id * 3], positions[id * 3 + 1], positions[id * 3 + 2]);
  }
  return Float32Array.from(out);
}

/** Centre and half size of flat [x, y, z, ...] points, or null when there are none. */
export function pointsBox(points) {
  if (!points?.length) return null;
  const lo = [Infinity, Infinity, Infinity],
    hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i + 2 < points.length; i += 3)
    for (let k = 0; k < 3; k++) {
      const value = points[i + k];
      if (!Number.isFinite(value)) continue;
      if (value < lo[k]) lo[k] = value;
      if (value > hi[k]) hi[k] = value;
    }
  if (!(lo[0] <= hi[0])) return null;
  return { center: lo.map((v, k) => (v + hi[k]) / 2), half: lo.map((v, k) => (hi[k] - v) / 2) };
}

/** The eight corners of a box (what the preview's fit frames). */
export function boxCorners({ center, half }) {
  const out = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) out.push(center[0] + x * half[0], center[1] + y * half[1], center[2] + z * half[2]);
  return out;
}

/**
 * Where projected points sit in a picture: `screen` is [x, y, inFront, ...] in pixels. Returns the
 * box centre's offset from the picture centre (dx right, dy down) and the share of the picture the
 * box spans (fill, the larger of its width and height share), or null when nothing is in front.
 */
export function screenBox(screen, width, height) {
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (let i = 0; i + 2 < screen.length; i += 3) {
    if (!screen[i + 2]) continue;
    const x = screen[i],
      y = screen[i + 1];
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  if (minX === Infinity) return null;
  return { dx: (minX + maxX) / 2 - width / 2, dy: (minY + maxY) / 2 - height / 2, fill: Math.max((maxX - minX) / width, (maxY - minY) / height), minX, maxX, minY, maxY };
}

/**
 * The smallest model-space move whose picture move is (dx, dy), from the picture move of a unit
 * step along x, y and z (`columns`: three [px, py] pairs): the camera follows it to centre the box.
 */
export function pictureShift(columns, dx, dy) {
  const [a, b] = [0, 1].map(row => columns.map(column => column[row]));
  const aa = a[0] * a[0] + a[1] * a[1] + a[2] * a[2],
    ab = a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    bb = b[0] * b[0] + b[1] * b[1] + b[2] * b[2],
    det = aa * bb - ab * ab;
  if (!(Math.abs(det) > 1e-12)) return [0, 0, 0];
  const la = (bb * dx - ab * dy) / det,
    lb = (aa * dy - ab * dx) / det;
  return [0, 1, 2].map(k => la * a[k] + lb * b[k]);
}

/**
 * Frame points exactly through a preview's capture API (fit, focusPoint, project): their picture
 * box centred, spanning `fill` of the picture, then `zoom` times closer about that centre. The
 * preview's own fit centres a box and sizes the view from it, so a few corrected fits converge
 * in every view preset; returns how the points finally sit.
 */
export function frameExactly(api, points, { fill = PICTURE_FILL, zoom = 1, passes = 4 } = {}) {
  const box = pointsBox(points);
  if (!box) {
    api.fit(null);
    return null;
  }
  const extent = Math.max(...box.half, 1e-3);
  box.half = box.half.map(value => Math.max(value, extent * 1e-3));
  // Moving the camera with its target first keeps a free (orthographic) view's direction.
  api.focusPoint(box.center);
  api.fit(boxCorners(box));
  // The camera looks at the box centre: it projects to the picture centre, giving the picture size.
  const [cx, cy] = api.project(box.center),
    width = cx * 2,
    height = cy * 2;
  if (!(width > 0 && height > 0)) return null;
  // Each pass moves the box centre to the picture centre and, while sizing, scales it to `fill`.
  const correct = sizing => {
    const placed = screenBox(api.project(points), width, height);
    if (!placed) return false;
    const scale = sizing && placed.fill > 1e-6 ? placed.fill / fill : 1;
    if (Math.abs(placed.dx) < 0.5 && Math.abs(placed.dy) < 0.5 && Math.abs(scale - 1) < 0.005) return false;
    const step = extent * 0.01,
      origin = api.project(box.center),
      columns = [0, 1, 2].map(k => {
        const moved = [...box.center];
        moved[k] += step;
        const at = api.project(moved);
        return [(at[0] - origin[0]) / step, (at[1] - origin[1]) / step];
      }),
      shift = pictureShift(columns, placed.dx, placed.dy);
    box.center = box.center.map((value, k) => value + shift[k]);
    box.half = box.half.map(value => value * scale);
    api.focusPoint(box.center);
    api.fit(boxCorners(box));
    return true;
  };
  for (let pass = 0; pass < passes && correct(true); pass++);
  if (zoom > 1) {
    // Closer about the same centre, then centred again: a perspective camera sees near parts grow more.
    box.half = box.half.map(value => value / zoom);
    api.fit(boxCorners(box));
    for (let pass = 0; pass < 2 && correct(false); pass++);
  }
  return screenBox(api.project(points), width, height);
}
