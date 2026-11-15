import { Vector3, Quaternion } from 'three';
import { allNodes, composeNodeMatrices, compileTrackSampler, skinGeoset, nodePivot, NODE_COLLECTION_KEYS, TRANSFORM_DEFAULTS } from './animation.js';
import { nodeIndex } from './node-hierarchy.js';
import { vertexBones } from './part-bones.js';

// Measurement used only by the redundant-key owner (optimizexl-redundant-tracks.js)
// for Hive-similar keys it would otherwise keep as small authored turns.
// A linear key may go when the skinned vertices the node moves (descendants,
// blended influences and hidden geosets included) stay within this share of
// that part's bind-pose size, sampled every millisecond with native playback.
export const SMALL_TURN_PART_SHARE = .0025;
const properties = ['Translation', 'Rotation', 'Scaling'];
// Billboarded, locked billboards and camera-anchored: CPU matrices omit them.
const CAMERA_FLAGS = 248;

function diagonal(points) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const p of points) for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], p[i]); hi[i] = Math.max(hi[i], p[i]); }
  return points.length ? Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) : 0;
}

/** Lazily built per scan. `part(node)` is null when the rule cannot measure that
 * node (no mesh, no size, camera-facing chain, hierarchy loop, ambiguous id). */
export function smallTurnReach(model) {
  const nodes = allNodes(model), tree = nodeIndex(model, nodes), byId = tree.byId;
  const cyclic = nodes.some(n => { const path = tree.ancestors(n.ObjectId, true); return path.includes(byId.get(path.at(-1))?.Parent); });
  const verts = [], skinned = new Set();
  (model.Geosets || []).forEach((g, geoset) => {
    for (let v = 0; v < g.Vertices.length / 3; v++) { const bones = vertexBones(g, v); verts.push({ geoset, v, bones }); for (const b of bones) skinned.add(b); }
  });
  const parts = new Map(), samplers = new Map();

  function build(node) {
    const id = node.ObjectId;
    if (cyclic || byId.get(id) !== node) return null;
    const list = verts.filter(x => x.bones.some(b => tree.isAncestor(b, id)));
    if (!list.length) return null;
    if (tree.ancestors(id, true).some(a => (byId.get(a)?.Flags || 0) & CAMERA_FLAGS)) return null;
    // Camera-facing descendants take only their position from this node in
    // play, so their pivots are held to the same limit as unskinned nodes.
    const descendants = nodes.filter(n => tree.isAncestor(n.ObjectId, id));
    const pivots = descendants.filter(n => !skinned.has(n.ObjectId) || (n.Flags || 0) & CAMERA_FLAGS).map(n => n.ObjectId);
    const ids = [...new Set([...list.flatMap(x => x.bones), ...pivots, id])];
    const bind = list.map(({ geoset, v }) => Array.from(model.Geosets[geoset].Vertices.subarray(v * 3, v * 3 + 3)));
    const pivot = nodePivot(model, node, id), box = diagonal(bind);
    // A single-point part has no box: use its lever from the node's pivot.
    const size = box > 1e-6 ? box : bind.reduce((m, p) => Math.max(m, Math.hypot(p[0] - pivot[0], p[1] - pivot[1], p[2] - pivot[2])), 0);
    if (!(size > 1e-6)) return null;
    const byGeoset = new Map();
    for (const x of list) { if (!byGeoset.has(x.geoset)) byGeoset.set(x.geoset, []); byGeoset.get(x.geoset).push(x.v); }
    const meshes = [...byGeoset].map(([gi, indices]) => {
      const src = model.Geosets[gi], hd = src.SkinWeights?.length >= src.Vertices.length / 3 * 8, Vertices = new Float32Array(indices.length * 3), mesh = { Vertices };
      if (hd) mesh.SkinWeights = new Uint8Array(indices.length * 8); else { mesh.Groups = []; mesh.VertexGroup = []; }
      indices.forEach((v, k) => {
        Vertices.set(src.Vertices.subarray(v * 3, v * 3 + 3), k * 3);
        if (hd) mesh.SkinWeights.set(src.SkinWeights.subarray(v * 8, v * 8 + 8), k * 8);
        else { mesh.Groups.push(Array.from(src.Groups?.[src.VertexGroup?.[v]] || [])); mesh.VertexGroup.push(k); }
      });
      return { mesh, before: new Float64Array(Vertices.length), after: new Float64Array(Vertices.length) };
    });
    return { id, size, limit: size * SMALL_TURN_PART_SHARE, ids, meshes, pivots: pivots.map(p => ({ id: p, point: new Vector3().fromArray(nodePivot(model, byId.get(p), p)) })) };
  }
  function part(node) { if (!parts.has(node)) parts.set(node, build(node)); return parts.get(node); }

  const local = { t: new Vector3(), r: new Quaternion(), s: new Vector3() };
  const compile = (track, property, interval) => compileTrackSampler(track, { interval, globalSequences: model.GlobalSequences, fallback: TRANSFORM_DEFAULTS[property], quaternion: property === 'Rotation' });
  function nodeSamplers(node, interval) {
    const key = interval.join(':');
    let cache = samplers.get(key); if (!cache) samplers.set(key, cache = new Map());
    if (!cache.has(node)) cache.set(node, properties.map(p => compile(node[p], p, interval)));
    return cache.get(node);
  }
  function pose(info, node, property, track, interval) {
    const index = properties.indexOf(property), own = compile(track, property, interval);
    return frame => composeNodeMatrices(model, info.ids, n => {
      const s = nodeSamplers(n, interval);
      local.t.fromArray(index === 0 && n === node ? own(frame) : s[0](frame));
      local.r.fromArray(index === 1 && n === node ? own(frame) : s[1](frame));
      local.s.fromArray(index === 2 && n === node ? own(frame) : s[2](frame));
      return local;
    }, byId);
  }
  const world = (info, matrices, which) => ({
    mesh: info.meshes.map(m => skinGeoset(m.mesh, matrices, m[which]).slice()),
    pivots: info.pivots.map(p => { const m = matrices.get(p.id); return m ? p.point.clone().applyMatrix4(m) : p.point.clone(); }),
  });

  /** Does replacing `baseline` by `candidate` on node[property] keep every
   * influenced vertex and unskinned descendant pivot within the part's limit at
   * every whole millisecond of [from,to]? `cache` holds this domain's originals. */
  function fits(node, property, baseline, candidate, interval, from, to, cache) {
    const info = part(node);
    if (!info) return false;
    const before = pose(info, node, property, baseline, interval), after = pose(info, node, property, candidate, interval), limit = info.limit, square = limit * limit;
    for (let frame = Math.ceil(from); frame <= Math.floor(to); frame++) {
      let original = cache.get(frame);
      if (!original) cache.set(frame, original = world(info, before(frame), 'before'));
      const current = world(info, after(frame), 'after');
      for (let m = 0; m < current.mesh.length; m++) {
        const a = original.mesh[m], b = current.mesh[m];
        for (let i = 0; i < a.length; i += 3) {
          const x = a[i] - b[i], y = a[i + 1] - b[i + 1], z = a[i + 2] - b[i + 2], d = x * x + y * y + z * z;
          if (!(d <= square)) return false;
        }
      }
      for (let p = 0; p < current.pivots.length; p++) if (!(original.pivots[p].distanceTo(current.pivots[p]) <= limit)) return false;
    }
    return true;
  }
  return { part, fits };
}

/** The node a redundant-key entry animates, when it is a node TRS track. */
export function trackNode(model, path) {
  if (path.length !== 3 || !NODE_COLLECTION_KEYS.includes(path[0]) || !properties.includes(path[2])) return null;
  const node = model[path[0]]?.[path[1]];
  return node && Number.isInteger(node.ObjectId) ? node : null;
}
