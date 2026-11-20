import { Ray, Triangle, Vector3 } from 'three';
import { nodeIndex } from '../../src/node-hierarchy.js';
import { vertexBones } from '../../src/part-bones.js';
import { geosetMaterialLayers, hasOnlyAdditiveLayers } from '../../src/geoset-extras.js';
import { sampleGeosetAnimation, skinGeoset } from '../../src/animation.js';
import { standSequenceIndex } from '../../src/sequence-editor.js';

export function solidContactFaces(model, root, { hand = false, excludeRoot = null } = {}) {
  const tree = nodeIndex(model), stand = standSequenceIndex(model), faces = [];
  for (const [gi, g] of model.Geosets.entries()) {
    if (hasOnlyAdditiveLayers(geosetMaterialLayers(model, g))) continue;
    if (stand >= 0 && sampleGeosetAnimation(model, gi, model.Sequences[stand].Interval[0], stand).alpha < 0.001) continue;
    const member = vi => {
      const ids = vertexBones(g, vi);
      return ids.length && (hand ? ids.some(id => tree.isAncestor(id, root) && (excludeRoot == null || !tree.isAncestor(id, excludeRoot))) : ids.every(id => id === root));
    };
    for (let i = 0; i < g.Faces.length; i += 3) {
      const ids = Array.from(g.Faces.slice(i, i + 3));
      if (ids.every(member)) faces.push({ gi, ids });
    }
  }
  return faces;
}
export function posedContactFaces(model, matrices, faces) {
  const skin = model.Geosets.map(g => skinGeoset(g, matrices));
  return faces.map(f => new Triangle(...f.ids.map(i => new Vector3().fromArray(skin[f.gi], i * 3))));
}
export function surfaceGap(first, second) {
  let gap = Infinity;
  for (const a of first) for (const b of second) {
    if (a.getArea() < 1e-8 || b.getArea() < 1e-8) continue;
    for (const [x, y] of [[a, b], [b, a]]) {
      const vertices = [x.a, x.b, x.c];
      for (let i = 0; i < 3; i++) {
        const p = vertices[i], end = vertices[(i + 1) % 3];
        gap = Math.min(gap, p.distanceTo(y.closestPointToPoint(p, new Vector3())));
        const length = p.distanceTo(end);
        if (length < 1e-8) continue;
        const hit = new Ray(p, end.clone().sub(p).normalize()).intersectTriangle(y.a, y.b, y.c, false, new Vector3());
        if (hit && p.distanceTo(hit) <= length) return 0;
      }
    }
  }
  return gap;
}
export function pointToContactSurface(point, triangles) {
  return Math.min(...triangles.map(t => point.distanceTo(t.closestPointToPoint(point, new Vector3()))));
}
