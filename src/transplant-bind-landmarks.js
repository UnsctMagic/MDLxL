import { Vector3 } from 'three';
import { vertexBones } from './part-bones.js';
import { nodePivot } from './animation.js';

// Use the shared skin at a joint, or the closest part of its rigid surface.
export function bindLandmarks(model, rig, tree) {
  const joints = new Set(Object.values(rig.parts).flatMap((p) => p.joints)), owner = new Map();
  for (const id of tree.byId.keys()) owner.set(id, tree.ancestors(id, true).find((j) => joints.has(j)));
  const samples = new Map(), rings = new Map(), cross = new Set();
  for (const g of model.Geosets) for (let i = 0; i < g.Vertices.length / 3; i++) {
    const ids = [...new Set(vertexBones(g, i).map((b) => owner.get(b)).filter((b) => b != null))];
    const p = new Vector3().fromArray(g.Vertices, 3 * i);
    for (const id of ids) {
      if (!samples.has(id)) samples.set(id, []);
      samples.get(id).push(p);
      if (ids.length > 1) {
        cross.add(id);
        if (ids.includes(tree.parentOf(id))) {
          if (!rings.has(id)) rings.set(id, []);
          rings.get(id).push(p);
        }
      }
    }
  }
  const centre = (pts) => pts?.length ? pts.reduce((s, p) => s.add(p), new Vector3()).divideScalar(pts.length) : null;
  const sites = new Map();
  for (const [id, pts] of samples) {
    const at = new Vector3().fromArray(nodePivot(model, tree.byId.get(id), id));
    pts.sort((a, b) => a.distanceToSquared(at) - b.distanceToSquared(at));
    sites.set(id, centre(rings.get(id)) ?? centre(pts.slice(0, Math.max(3, Math.ceil(0.16 * pts.length)))));
  }
  return { sites, cross, head: centre(rig.parts.head?.joints.flatMap((id) => samples.get(id) ?? [])) };
}
