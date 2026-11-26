import * as THREE from 'three';
import { sketchStore, smoothStroke, sweptAngle, SKETCH_SPACES } from '../src/ai-sketch.js';
import { drawSketchNotes, noteNearPoint, SKETCH_CURSORS, SKETCH_MARKER_PIXELS, SKETCH_SPACING_PIXELS } from './sketch-draw-2d.js';

// AI console notes over the Movement preview. Points live in model space on a
// plane through the part they start on, facing the camera, so a note stays on
// its part while the camera turns. Every note keeps the animation and frame it
// was drawn at. The Arrow acts a motion out: while it is held the animation runs
// in real time from the frame shown, and each point keeps the frame it was drawn
// at. Notes are display only; the model, selection and Undo are never touched.

const PART_PIXELS = 32;
const PEN_PART_PIXELS = 16;
const TICK_FRAMES = 100;
// Notes away from the frame shown stay visible but faint.
const NEAR_FRAMES = 60;

export { SKETCH_CURSORS };

export function createPreviewSketch({ host, ownerDocument, invalidate }) {
  let overlay = null,
    gesture = null,
    clock = 0;
  const raycaster = new THREE.Raycaster(),
    pointer = new THREE.Vector2(),
    projected = new THREE.Vector3();
  const unsubscribe = sketchStore.subscribe(() => invalidate());

  const toolFor = p => {
    const sketch = sketchStore.get();
    return p.sketchDocument != null && sketch.visible && SKETCH_SPACES.motion.includes(sketch.tool) ? sketch.tool : null;
  };
  const screenOf = (camera, width, height, x, y, z) => {
    projected.set(x, y, z).project(camera);
    return projected.z > 1 ? null : [((projected.x + 1) / 2) * width, ((1 - projected.y) / 2) * height];
  };
  const worldAt = (gesture, x, y) => {
    pointer.set((x / gesture.width) * 2 - 1, 1 - (y / gesture.height) * 2);
    raycaster.setFromCamera(pointer, gesture.camera);
    return raycaster.ray.intersectPlane(gesture.plane, new THREE.Vector3());
  };
  // The part a note starts on: the nearest shown joint marker.
  const nearestPart = (nodes, x, y, reach) => {
    let best = null,
      distance = reach;
    for (const point of nodes || []) {
      if (!point.visible || !point.world) continue;
      const d = Math.hypot(point.x - x, point.y - y);
      if (d < distance) {
        best = point;
        distance = d;
      }
    }
    return best;
  };
  const partOf = point => (point ? { id: point.node.ObjectId, name: point.node.Name || `Object ${point.node.ObjectId}` } : null);
  const partsAlong = (nodes, screen, reach) => {
    const found = new Map();
    for (const point of nodes || []) {
      if (!point.visible || point.overlayKind !== 'bones') continue;
      if (screen.some(([x, y]) => Math.hypot(point.x - x, point.y - y) <= reach)) found.set(point.node.ObjectId, partOf(point));
    }
    return [...found.values()];
  };

  function items(p, camera, width, height, frame, sequence) {
    if (p.sketchDocument == null || !sketchStore.get().visible) return [];
    const list = [];
    const add = (stroke, id) => {
      if (stroke.sequence !== sequence) return;
      const screen = [];
      for (let i = 0; i < stroke.points.length; i += 3) {
        const xy = screenOf(camera, width, height, stroke.points[i], stroke.points[i + 1], stroke.points[i + 2]);
        if (xy) screen.push(xy);
      }
      if (!screen.length) return;
      const last = stroke.frames?.at(-1) ?? stroke.frame;
      const near = frame >= Math.min(stroke.frame, last) - NEAR_FRAMES && frame <= Math.max(stroke.frame, last) + NEAR_FRAMES;
      const ticks = [];
      if (stroke.tool === 'arrow' && stroke.frames?.length > 1)
        for (let next = stroke.frames[0] + TICK_FRAMES, i = 0; next < last; next += TICK_FRAMES) {
          while (i < stroke.frames.length - 1 && stroke.frames[i + 1] < next) i++;
          if (screen[i]) ticks.push(screen[i]);
        }
      list.push({
        id,
        tool: stroke.tool,
        colorValue: stroke.colorValue,
        screen,
        ticks,
        alpha: near ? 1 : 0.35,
        width: SKETCH_MARKER_PIXELS,
        label: stroke.tool === 'hold' || stroke.tool === 'hit' ? String(stroke.frame) : null,
      });
    };
    for (const stroke of sketchStore.strokes(p.sketchDocument, 'motion')) add(stroke, stroke.id);
    if (gesture?.stroke) add(gesture.stroke, null);
    return list;
  }

  function erase(at) {
    const hits = items(gesture.p, gesture.camera, gesture.width, gesture.height, gesture.frame, gesture.sequence)
      .filter(item => item.id != null && noteNearPoint(item, at.x, at.y))
      .map(item => item.id);
    if (hits.length) sketchStore.remove(hits, gesture.token);
  }

  function addPoint(at) {
    const stroke = gesture.stroke;
    if (gesture.last && Math.hypot(at.x - gesture.last.x, at.y - gesture.last.y) < SKETCH_SPACING_PIXELS) return;
    const world = worldAt(gesture, at.x, at.y);
    if (!world) return;
    gesture.last = at;
    gesture.screen.push(at.x, at.y);
    stroke.points.push(world.x, world.y, world.z);
    if (stroke.tool === 'arrow') {
      const time = gesture.now() - gesture.started;
      stroke.times.push(Math.round(time));
      stroke.frames.push(gesture.frameAt(time));
    }
  }

  // The Arrow's clock: the animation runs from the frame shown while the button is held.
  function runClock() {
    if (!gesture?.driving) return;
    const frame = gesture.frameAt(gesture.now() - gesture.started);
    if (frame !== gesture.shown) {
      gesture.shown = frame;
      gesture.p.onTimeChange?.(frame);
    }
    clock = gesture.window.requestAnimationFrame(runClock);
  }

  return {
    toolFor,
    get drawing() {
      return !!gesture;
    },
    /** Start a note; returns false when no Movement drawing tool is active. */
    begin(event, view) {
      const p = view.p,
        tool = toolFor(p);
      if (!tool) return false;
      const at = { x: view.x, y: view.y };
      const ownerWindow = ownerDocument.defaultView || window;
      gesture = { p, tool, camera: view.camera.clone(), width: view.width, height: view.height, frame: view.frame, sequence: view.sequence, token: {}, window: ownerWindow, now: () => ownerWindow.performance.now() };
      if (tool === 'eraser') {
        erase(at);
        return true;
      }
      const part = nearestPart(view.nodes, at.x, at.y, PART_PIXELS);
      const anchor = part?.world?.clone() || view.center.clone();
      const toCamera = gesture.camera.getWorldDirection(new THREE.Vector3()).negate();
      const start = Math.round(view.frame);
      Object.assign(gesture, {
        plane: new THREE.Plane().setFromNormalAndCoplanarPoint(toCamera, anchor),
        part,
        last: null,
        screen: [],
        started: gesture.now(),
        frameAt: time => Math.min(view.end ?? Infinity, start + Math.round(time)),
        stroke: {
          space: 'motion',
          tool,
          documentId: p.sketchDocument,
          color: sketchStore.get().color[tool],
          colorValue: sketchStore.colorOf(tool),
          sequence: view.sequence,
          sequenceName: view.sequenceName,
          frame: start,
          points: [],
          ...(tool === 'arrow' ? { times: [], frames: [] } : {}),
          view: gesture.camera.getWorldDirection(new THREE.Vector3()).toArray().map(value => Math.round(value * 1000) / 1000),
        },
      });
      addPoint(at);
      if (tool === 'arrow' && view.sequence >= 0) {
        gesture.driving = true;
        gesture.shown = start;
        clock = ownerWindow.requestAnimationFrame(runClock);
      }
      invalidate();
      return true;
    },
    move(events, rect) {
      if (!gesture) return;
      for (const sample of events) {
        const at = { x: sample.clientX - rect.left, y: sample.clientY - rect.top };
        if (gesture.tool === 'eraser') erase(at);
        else if (gesture.tool !== 'hold' && gesture.tool !== 'hit') addPoint(at);
      }
      invalidate();
    },
    end(nodes) {
      const current = gesture;
      gesture = null;
      if (!current) return;
      current.window.cancelAnimationFrame(clock);
      // The playhead goes back to where the Arrow started.
      if (current.driving) current.p.onTimeChange?.(current.stroke.frame);
      invalidate();
      if (current.tool === 'eraser' || !current.stroke.points.length) return;
      const stroke = current.stroke,
        screen = [];
      for (let i = 0; i < current.screen.length; i += 2) screen.push([current.screen[i], current.screen[i + 1]]);
      if (stroke.tool === 'pen' || stroke.tool === 'arrow') stroke.points = smoothStroke(stroke.points);
      if (current.part) stroke.part = partOf(current.part);
      if (stroke.tool === 'marker' || stroke.tool === 'pen') {
        const parts = partsAlong(nodes, screen, stroke.tool === 'marker' ? SKETCH_MARKER_PIXELS : PEN_PART_PIXELS);
        if (parts.length) stroke.parts = parts;
      }
      if (stroke.tool === 'arrow' && current.part) stroke.turn = sweptAngle(current.screen, [current.part.x, current.part.y]);
      sketchStore.add(stroke);
    },
    cancel() {
      if (!gesture) return;
      gesture.window.cancelAnimationFrame(clock);
      if (gesture.driving) gesture.p.onTimeChange?.(gesture.stroke.frame);
      gesture = null;
      invalidate();
    },
    /** Redraw the notes on their own layer over the preview. */
    draw(p, camera, width, height, ratio, frame, sequence) {
      const list = items(p, camera, width, height, frame, sequence);
      if (!list.length) {
        if (overlay) {
          overlay.remove();
          overlay = null;
        }
        return;
      }
      if (!overlay) {
        overlay = ownerDocument.createElement('canvas');
        overlay.dataset.sketchOverlay = '';
        overlay.style.cssText = 'position:absolute;z-index:42;inset:0;width:100%;height:100%;pointer-events:none';
        host.appendChild(overlay);
      }
      const pixelWidth = Math.round(width * ratio),
        pixelHeight = Math.round(height * ratio);
      if (overlay.width !== pixelWidth) overlay.width = pixelWidth;
      if (overlay.height !== pixelHeight) overlay.height = pixelHeight;
      const context = overlay.getContext('2d');
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, overlay.width, overlay.height);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      drawSketchNotes(context, list);
      overlay.dataset.notes = String(list.length);
    },
    dispose() {
      this.cancel();
      unsubscribe();
      overlay?.remove();
      overlay = null;
    },
  };
}
