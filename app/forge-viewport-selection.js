import { Vector3 } from 'three';
import { forgeShapeEdges, forgeSelectionVertices } from '../src/forge-shape-editing.js';
import { applySelection, marqueeContainsPoint } from './classic-gestures.js';
import { pickPreviewGeoset, projectPreviewGeosets } from './preview-selection.js';
import { createOverlayDepth } from './preview-depth.js';

export function forgeVertexSelection(entries, selection, mode) {
  return Object.fromEntries(entries.map(({ shape, mesh }, gi) => {
    const ids = new Set(forgeSelectionVertices(shape, selection[shape.id], mode));
    return [gi, mesh.vertexIds.flatMap((id, i) => ids.has(id) ? [i] : [])];
  }));
}

export function forgePartsFromVertices(entries, selection, mode) {
  return Object.fromEntries(entries.map(({ shape, mesh }, gi) => {
    const ids = new Set((selection[gi] || []).map(i => mesh.vertexIds[i]));
    const parts = mode === 'Shape' ? ids.size ? ['shape'] : [] : mode === 'Vertices' ? [...ids] : mode === 'Edges' ? [...forgeShapeEdges(shape)].filter(([, edge]) => edge.every(id => ids.has(id))).map(([key]) => key) : shape.faces.filter(f => f.vertices.every(id => ids.has(id))).map(f => f.id);
    return [shape.id, parts];
  }));
}

// Only the selectable unit differs from Vertices. Navigation, gesture capture,
// marquee drawing, modifiers and transforms still belong to Viewport.
export function pickForgeParts(entries, previous, mode, { start, end, camera, grabThrough }) {
  const geometry = entries.map(({ mesh }, index) => ({ index, vertices: mesh.geosets[0].Vertices, faces: mesh.geosets[0].Faces }));
  const projected = projectPreviewGeosets(geometry, camera, end.width, end.height);
  const depth = createOverlayDepth(projected, end.width, end.height);
  const project = point => { const p = new Vector3(...point).project(camera); return { x: (p.x + 1) * end.width / 2, y: (1 - p.y) * end.height / 2, z: p.z }; };
  const inside = p => p.z >= -1 && p.z <= 1 && marqueeContainsPoint([p.x, p.y], start, end, 3) && (grabThrough !== false || !depth.isOccludedForSelection(p));
  const found = Object.fromEntries(entries.map(e => [e.shape.id, []]));
  if (Math.hypot(end.x - start.x, end.y - start.y) > 5) {
    for (const { shape } of entries) {
      const points = shape.vertices.map(project);
      found[shape.id] = mode === 'Shape' ? points.some(inside) ? ['shape'] : [] : mode === 'Edges' ? [...forgeShapeEdges(shape)].filter(([, ids]) => ids.every(id => inside(points[id]))).map(([key]) => key) : shape.faces.filter(f => f.vertices.every(id => inside(points[id]))).map(f => f.id);
    }
  } else if (mode === 'Edges') {
    let best;
    for (const { shape } of entries) for (const [key, ids] of forgeShapeEdges(shape)) {
      const [a, b] = ids.map(id => project(shape.vertices[id])), dx = b.x - a.x, dy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((end.x - a.x) * dx + (end.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
      const p = { x: a.x + t * dx, y: a.y + t * dy, z: a.z + t * (b.z - a.z) }, distance = Math.hypot(p.x - end.x, p.y - end.y);
      if (p.z < -1 || p.z > 1 || distance > 9 || depth.isOccludedForSelection(p)) continue;
      if (!best || distance < best.distance - .1 || Math.abs(distance - best.distance) <= .1 && p.z < best.z) best = { shape: shape.id, key, distance, z: p.z };
    }
    if (best) found[best.shape] = [best.key];
  } else {
    const hit = pickPreviewGeoset(projected, end.x, end.y);
    if (hit) { const { shape, mesh } = entries[hit.index]; found[shape.id] = [mode === 'Shape' ? 'shape' : mesh.faceIds[Math.floor(hit.ids[0] / 3)]]; }
  }
  return Object.fromEntries(entries.map(({ shape }) => [shape.id, applySelection(previous[shape.id] || [], found[shape.id], start)]));
}
