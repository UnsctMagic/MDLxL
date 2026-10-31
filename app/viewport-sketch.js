import { MODEL_LAYER } from './model-smoothing.js';
import { createFrameCoalescer } from './viewport-performance.js';
import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { sketchStore, smoothStroke, PEN_REACH, MARKER_WIDTH } from '../src/ai-sketch.js';

// Pen/Marker drawing on the modeling viewport for the AI console. Strokes are
// display-only scene objects; the model, selection and Undo are never touched.
const PEN_PIXELS = 3.2;
const ERASE_PIXELS = 14;
const SPACING_PIXELS = 2.5;

const cursorSvg = svg => `url("data:image/svg+xml,${encodeURIComponent(svg)}") 12 12, crosshair`;
export const SKETCH_CURSORS = {
  pen: cursorSvg('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><circle cx="12" cy="12" r="3" fill="#fff" stroke="#000" stroke-width="1.2"/></svg>'),
  marker: cursorSvg('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><circle cx="12" cy="12" r="8" fill="#ffd60a66" stroke="#000" stroke-width="1"/><circle cx="12" cy="12" r="1.2" fill="#000"/></svg>'),
  eraser: cursorSvg('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><circle cx="12" cy="12" r="10" fill="#ffffff55" stroke="#000" stroke-width="1.2" stroke-dasharray="3 2"/></svg>'),
};

export function createViewportSketch({ parent, entries, invalidate }) {
  const group = new THREE.Group();
  group.renderOrder = 20000;
  parent.add(group);
  const objects = new Map(); // stroke id -> Line2
  const raycaster = new THREE.Raycaster(),
    pointer = new THREE.Vector2();
  raycaster.layers.enable(MODEL_LAYER);
  let documentId = null,
    enabled = false,
    live = null,
    gesture = null;

  function material(stroke) {
    const marker = stroke.tool === 'marker';
    const value = new LineMaterial({
      color: new THREE.Color(stroke.colorValue),
      linewidth: marker ? stroke.width : PEN_PIXELS,
      worldUnits: marker,
      transparent: marker,
      opacity: marker ? 0.5 : 1,
      depthTest: true,
      // A marker writes depth so its own overlapping segments do not stack darker.
      depthWrite: marker,
    });
    return value;
  }
  function displayPositions(stroke) {
    const lift = stroke.lift,
      out = new Array(stroke.points.length);
    for (let i = 0; i < stroke.points.length; i++) out[i] = stroke.points[i] + stroke.normals[i] * lift;
    // Line2 needs two points; a click becomes a short dot.
    if (out.length === 3) out.push(out[0] + lift * 0.01, out[1], out[2]);
    return out;
  }
  function lineFor(stroke) {
    const geometry = new LineGeometry();
    geometry.setPositions(displayPositions(stroke));
    const line = new Line2(geometry, material(stroke));
    line.computeLineDistances();
    line.frustumCulled = false;
    line.renderOrder = stroke.tool === 'marker' ? 20000 : 20001;
    line.userData.strokeId = stroke.id;
    return line;
  }
  function dispose(line) {
    group.remove(line);
    line.geometry.dispose();
    line.material.dispose();
  }
  function sync() {
    const strokes = enabled && documentId != null && sketchStore.get().visible ? sketchStore.strokes(documentId) : [];
    const keep = new Set(strokes.map(s => s.id));
    for (const [id, line] of objects)
      if (!keep.has(id)) {
        dispose(line);
        objects.delete(id);
      }
    for (const stroke of strokes)
      if (!objects.has(stroke.id)) {
        const line = lineFor(stroke);
        objects.set(stroke.id, line);
        group.add(line);
      }
    invalidate();
  }
  const unsubscribe = sketchStore.subscribe(sync);

  function pick(end, camera, anchor) {
    pointer.set((end.x / end.width) * 2 - 1, 1 - (end.y / end.height) * 2);
    raycaster.setFromCamera(pointer, camera);
    const meshes = entries().flatMap(entry => (entry?.group.visible && entry.depth ? [entry.depth] : []));
    const hit = raycaster.intersectObjects(meshes, false)[0];
    const toCamera = raycaster.ray.direction.clone().negate();
    if (hit) {
      const normal = hit.face ? hit.face.normal.clone() : toCamera.clone();
      // Double-sided picking: report the side facing the viewer.
      if (normal.dot(toCamera) < 0) normal.negate();
      return { point: hit.point.clone(), normal, surface: true, geoset: entries().findIndex(entry => entry?.depth === hit.object) };
    }
    // Off the model: draw on the plane through the last surface point, facing the camera.
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(toCamera, anchor);
    const point = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
    return point ? { point, normal: toCamera, surface: false, geoset: -1 } : null;
  }

  function startStroke(start, camera, target, radius, tool) {
    const colorValue = sketchStore.colorOf(tool);
    const stroke = {
      tool,
      documentId,
      color: sketchStore.get().color[tool],
      colorValue,
      points: [],
      normals: [],
      onSurface: [],
      geosets: [],
      width: radius * MARKER_WIDTH,
      reach: radius * PEN_REACH,
      lift: radius * 0.004,
      view: camera.getWorldDirection(new THREE.Vector3()).toArray(),
    };
    gesture = { tool, camera, anchor: target.clone(), last: null, stroke };
    extendStroke(start);
  }
  function extendStroke(end) {
    if (!gesture || gesture.tool === 'eraser') return;
    if (gesture.last && Math.hypot(end.x - gesture.last.x, end.y - gesture.last.y) < SPACING_PIXELS) return;
    const hit = pick(end, gesture.camera, gesture.anchor);
    if (!hit) return;
    gesture.last = end;
    const stroke = gesture.stroke;
    if (hit.surface) {
      gesture.anchor.copy(hit.point);
      if (!stroke.geosets.includes(hit.geoset)) stroke.geosets.push(hit.geoset);
    }
    stroke.points.push(...hit.point.toArray());
    stroke.normals.push(...hit.normal.toArray());
    stroke.onSurface.push(hit.surface);
    lineFrame.schedule();
  }
  // Every sample stays in the stroke; the visible line is rebuilt once per frame.
  const lineFrame = createFrameCoalescer(() => {
    if (!gesture?.stroke) return;
    if (live) dispose(live);
    live = lineFor(gesture.stroke);
    group.add(live);
    invalidate();
  });
  function finishStroke() {
    lineFrame.cancel();
    const current = gesture;
    gesture = null;
    if (live) {
      dispose(live);
      live = null;
    }
    if (!current || current.tool === 'eraser' || !current.stroke.points.length) return invalidate();
    const stroke = current.stroke;
    stroke.points = smoothStroke(stroke.points);
    // Only strokes that touched the model name geosets; a pure off-model sketch
    // still gives the AI nearby vertices through its coordinates.
    if (!stroke.geosets.length) delete stroke.geosets;
    sketchStore.add(stroke);
  }
  function cancelStroke() {
    lineFrame.cancel();
    gesture = null;
    if (live) {
      dispose(live);
      live = null;
    }
    invalidate();
  }
  function erase(end, camera) {
    const screen = new THREE.Vector3(),
      hits = [];
    for (const stroke of sketchStore.strokes(documentId)) {
      for (let i = 0; i < stroke.points.length; i += 3) {
        screen.set(stroke.points[i], stroke.points[i + 1], stroke.points[i + 2]).project(camera);
        if (screen.z < -1 || screen.z > 1) continue;
        const x = ((screen.x + 1) * end.width) / 2,
          y = ((1 - screen.y) * end.height) / 2,
          reach = stroke.tool === 'marker' ? ERASE_PIXELS * 1.6 : ERASE_PIXELS;
        if (Math.hypot(x - end.x, y - end.y) <= reach) {
          hits.push(stroke.id);
          break;
        }
      }
    }
    // One eraser drag is one Undo step.
    if (hits.length) sketchStore.remove(hits, gesture);
  }

  return {
    get tool() {
      return enabled && sketchStore.get().visible ? sketchStore.get().tool : null;
    },
    get drawing() {
      return !!gesture;
    },
    configure(next) {
      if (next.enabled === enabled && next.documentId === documentId) return;
      enabled = !!next.enabled;
      documentId = next.documentId;
      if (!enabled) cancelStroke();
      sync();
    },
    begin(start, camera, target, radius) {
      const tool = this.tool;
      if (!tool) return false;
      if (tool === 'eraser') {
        gesture = { tool, camera };
        erase(start, camera);
      } else startStroke(start, camera, target, radius, tool);
      return true;
    },
    move(end) {
      if (gesture?.tool === 'eraser') erase(end, gesture.camera);
      else extendStroke(end);
    },
    end: finishStroke,
    cancel: cancelStroke,
    resolution(width, height) {
      for (const line of objects.values()) line.material.resolution.set(width, height);
      live?.material.resolution.set(width, height);
    },
    dispose() {
      unsubscribe();
      cancelStroke();
      for (const line of objects.values()) dispose(line);
      objects.clear();
      parent.remove(group);
    },
  };
}
