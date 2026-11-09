import { Vector3 } from 'three';
import { nodeIndex } from './node-hierarchy.js';
import { vertexBoneWeights } from './part-bones.js';

const moments = () => ({ mass: 0, origin: null, first: new Float64Array(3), second: new Float64Array(9) });
const region = () => ({ surface: moments(), points: moments(), unmeshed: moments(), rigid: moments(), vertices: 0, min: new Vector3(Infinity, Infinity, Infinity), max: new Vector3(-Infinity, -Infinity, -Infinity) });

function addPoint(to, point, weight) {
  to.origin ||= Array.from(point);
  point = point.map((value, axis) => value - to.origin[axis]);
  to.mass += weight;
  for (let i = 0; i < 3; i++) {
    to.first[i] += point[i] * weight;
    for (let j = 0; j < 3; j++) to.second[i * 3 + j] += point[i] * point[j] * weight;
  }
}

function addMoments(to, from, factor = 1) {
  if (!from.mass || !factor) return;
  to.origin ||= Array.from(from.origin);
  const delta = from.origin.map((value, axis) => value - to.origin[axis]);
  to.mass += from.mass * factor;
  for (let i = 0; i < 3; i++) {
    to.first[i] += (from.first[i] + from.mass * delta[i]) * factor;
    for (let j = 0; j < 3; j++) to.second[i * 3 + j] += (from.second[i * 3 + j] + delta[i] * from.first[j] + from.first[i] * delta[j] + from.mass * delta[i] * delta[j]) * factor;
  }
}

// Integrate a linearly interpolated skin weight over a triangle. First and
// second moments are exact, so subdividing a mesh does not change its shape.
function addTriangle(to, points, weights, area) {
  const weight = weights[0] + weights[1] + weights[2];
  if (!weight) return;
  to.origin ||= Array.from(points[0]);
  points = points.map(point => point.map((value, axis) => value - to.origin[axis]));
  const sum = [0, 0, 0], weighted = [0, 0, 0];
  for (let corner = 0; corner < 3; corner++) for (let axis = 0; axis < 3; axis++) {
    sum[axis] += points[corner][axis];
    weighted[axis] += points[corner][axis] * weights[corner];
  }
  to.mass += area * weight / 3;
  for (let i = 0; i < 3; i++) {
    to.first[i] += area / 12 * (weight * sum[i] + weighted[i]);
    for (let j = 0; j < 3; j++) {
      let squares = 0, weightedSquares = 0;
      for (let corner = 0; corner < 3; corner++) {
        const square = points[corner][i] * points[corner][j];
        squares += square; weightedSquares += weights[corner] * square;
      }
      to.second[i * 3 + j] += area / 60 * (weight * (sum[i] * sum[j] + squares) + sum[i] * weighted[j] + weighted[i] * sum[j] + 2 * weightedSquares);
    }
  }
}

// Symmetric 3x3 Jacobi decomposition; the axes and variances describe measured
// surface shape, not anatomical categories or model-specific proportions.
function principalAxes(covariance) {
  const a = Array.from(covariance), v = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  for (let step = 0; step < 24; step++) {
    let p = 0, q = 1;
    for (const [i, j] of [[0, 2], [1, 2]]) if (Math.abs(a[i * 3 + j]) > Math.abs(a[p * 3 + q])) { p = i; q = j; }
    const off = a[p * 3 + q], norm = Math.abs(a[0]) + Math.abs(a[4]) + Math.abs(a[8]);
    if (Math.abs(off) <= Math.max(norm * 1e-14, Number.MIN_VALUE)) break;
    const angle = .5 * Math.atan2(2 * off, a[q * 3 + q] - a[p * 3 + p]);
    const c = Math.cos(angle), s = Math.sin(angle), pp = a[p * 3 + p], qq = a[q * 3 + q];
    a[p * 3 + p] = c * c * pp - 2 * s * c * off + s * s * qq;
    a[q * 3 + q] = s * s * pp + 2 * s * c * off + c * c * qq;
    a[p * 3 + q] = a[q * 3 + p] = 0;
    for (let k = 0; k < 3; k++) {
      if (k !== p && k !== q) {
        const kp = a[k * 3 + p], kq = a[k * 3 + q];
        a[k * 3 + p] = a[p * 3 + k] = c * kp - s * kq;
        a[k * 3 + q] = a[q * 3 + k] = s * kp + c * kq;
      }
      const vp = v[k * 3 + p], vq = v[k * 3 + q];
      v[k * 3 + p] = c * vp - s * vq; v[k * 3 + q] = s * vp + c * vq;
    }
  }
  const order = [0, 1, 2].sort((i, j) => a[j * 3 + j] - a[i * 3 + i]);
  return {
    eigenvalues: order.map(i => Math.max(0, a[i * 3 + i])),
    axes: order.map(i => {
      const axis = new Vector3(v[i], v[3 + i], v[6 + i]).normalize();
      let largest = 0;
      for (let j = 1; j < 3; j++) if (Math.abs(axis.getComponent(j)) > Math.abs(axis.getComponent(largest))) largest = j;
      return axis.multiplyScalar(axis.getComponent(largest) < 0 ? -1 : 1);
    }),
  };
}

function describe(raw, pointArea) {
  const weighted = moments();
  // Point-only inputs still provide positional evidence. Their contribution is
  // exposed separately and scaled into the surface's own units, never hidden.
  addMoments(weighted, raw.surface);
  addMoments(weighted, raw.unmeshed, pointArea);
  const mass = weighted.mass, localCenter = mass ? new Vector3().fromArray(weighted.first).divideScalar(mass) : null;
  const center = localCenter ? localCenter.clone().add(new Vector3().fromArray(weighted.origin)) : null;
  const covariance = new Array(9).fill(0);
  if (center) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) covariance[i * 3 + j] = weighted.second[i * 3 + j] / mass - localCenter.getComponent(i) * localCenter.getComponent(j);
  const { eigenvalues, axes } = principalAxes(covariance), largest = eigenvalues[0];
  const supported = mass > 0, min = supported ? raw.min.clone() : null, max = supported ? raw.max.clone() : null;
  return {
    area: raw.surface.mass, mass, weight: mass, pointWeight: raw.points.mass, vertexCount: raw.vertices, supported,
    center, rigidCenter: raw.rigid.mass ? new Vector3().fromArray(raw.rigid.first).divideScalar(raw.rigid.mass).add(new Vector3().fromArray(raw.rigid.origin)) : null,
    min, max, extent: supported ? max.clone().sub(min) : new Vector3(), covariance, eigenvalues, axes,
    radius: Math.sqrt(eigenvalues.reduce((sum, value) => sum + value, 0)),
    linear: largest ? (largest - eigenvalues[1]) / largest : 0,
    planar: largest ? (eigenvalues[1] - eigenvalues[2]) / largest : 0,
    volumetric: largest ? eigenvalues[2] / largest : 0,
  };
}

function mergeRegions(regions) {
  const result = region();
  for (const item of regions) {
    if (!item) continue;
    addMoments(result.surface, item.surface); addMoments(result.points, item.points); addMoments(result.unmeshed, item.unmeshed); addMoments(result.rigid, item.rigid);
    result.vertices += item.vertices;
    result.min.min(item.min); result.max.max(item.max);
  }
  return result;
}

// Clip a weighted triangle to the local attachment window. Both position and
// skin weight vary linearly along each cut edge, so the existing exact triangle
// integrals remain valid after triangulating the clipped polygon.
function clipAttachmentTriangle(points, weights, center, radius) {
  let polygon = points.map((point, i) => ({point, weight:weights[i]}));
  for (let axis=0; axis<3; axis++) for (const sign of [-1,1]) {
    if (!polygon.length) return polygon;
    const inside = vertex => sign*(vertex.point[axis]-center[axis]) <= radius;
    const clipped=[];
    for (let i=0; i<polygon.length; i++) {
      const a=polygon[i],b=polygon[(i+1)%polygon.length],aInside=inside(a),bInside=inside(b);
      if (aInside) clipped.push(a);
      if (aInside !== bInside) {
        const boundary=center[axis]+sign*radius, t=(boundary-a.point[axis])/(b.point[axis]-a.point[axis]);
        clipped.push({point:a.point.map((v,j)=>v+t*(b.point[j]-v)),weight:a.weight+t*(b.weight-a.weight)});
      }
    }
    polygon=clipped;
  }
  return polygon;
}

/** Name-independent surface evidence in authored model space. Skin weights
 * connect geometry across material/geoset boundaries to the same skeleton.
 * `measure(ids)` joins directly owned regions; `subtree` includes descendants.
 * Covariance uses exact triangle moments with interpolated SD/HD skin weights.
 * A region with no triangles exposes pointWeight separately from surface area.
 * Missing skin, motion or a mirrored peer never excludes a skeleton node here.
 */
export function poseGeometryEvidence(model, { nodes = [...(model.Bones || []), ...(model.Helpers || [])], tree = nodeIndex(model, nodes) } = {}) {
  const { byId, children } = tree, raw = new Map(nodes.map(node => [node.ObjectId, region()]));
  const surfaceLinks = new Map(nodes.map(node => [node.ObjectId, new Map()]));
  const min = new Vector3(Infinity, Infinity, Infinity), max = new Vector3(-Infinity, -Infinity, -Infinity);
  const samples = [], trianglesByOwner = new Map(nodes.map(node=>[node.ObjectId,[]]));
  let totalArea = 0, totalVertices = 0;
  const connect = (a, b, amount) => {
    if (a === b || !(amount > 0)) return;
    const left = surfaceLinks.get(a), right = surfaceLinks.get(b);
    if (!left || !right) return;
    left.set(b, (left.get(b) || 0) + amount); right.set(a, (right.get(a) || 0) + amount);
  };
  for (const geo of model.Geosets || []) {
    const vertices = geo.Vertices || [], count = Math.floor(vertices.length / 3), weights = [], points = [], vertexAreas = new Float64Array(count);
    for (let i = 0; i < count; i++) {
      const point = Array.from(vertices.subarray ? vertices.subarray(i * 3, i * 3 + 3) : vertices.slice(i * 3, i * 3 + 3));
      if (!point.every(Number.isFinite)) { points.push(null); weights.push(new Map()); continue; }
      points.push(point); const vector = new Vector3().fromArray(point); min.min(vector); max.max(vector); totalVertices++;
      const influence = new Map();
      for (const [id, amount] of vertexBoneWeights(geo, i)) if (raw.has(id) && Number.isFinite(amount) && amount > 0) influence.set(id, (influence.get(id) || 0) + amount);
      const total = [...influence.values()].reduce((sum, value) => sum + value, 0);
      if (total) for (const [id, amount] of influence) influence.set(id, amount / total);
      weights.push(influence);
      for (const [id, amount] of influence) {
        const item = raw.get(id); addPoint(item.points, point, amount); item.vertices++; item.min.min(vector); item.max.max(vector);
        if (influence.size === 1) addPoint(item.rigid, point, 1);
      }
    }
    const faces = geo.Faces || [];
    for (let face = 0; face + 2 < faces.length; face += 3) {
      const indices = [faces[face], faces[face + 1], faces[face + 2]];
      if (indices.some(i => !Number.isInteger(i) || i < 0 || i >= count || !points[i])) continue;
      const triangle = indices.map(i => points[i]), u = new Vector3().fromArray(triangle[1]).sub(new Vector3().fromArray(triangle[0]));
      const v = new Vector3().fromArray(triangle[2]).sub(new Vector3().fromArray(triangle[0])), area = u.cross(v).length() * .5;
      if (!(area > 0)) continue;
      totalArea += area; indices.forEach(i => { vertexAreas[i] += area / 3; });
      const ids = new Set(indices.flatMap(i => [...weights[i].keys()]));
      const element={points:triangle,weights:indices.map(i=>weights[i])};
      for(const id of ids)trianglesByOwner.get(id).push(element);
      for (const id of ids) {
        const item = raw.get(id);
        addTriangle(item.surface, triangle, indices.map(i => weights[i].get(id) || 0), area);
        for (const point of triangle) { const vector = new Vector3().fromArray(point); item.min.min(vector); item.max.max(vector); }
      }
      const list = [...ids];
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
        const support = id => indices.reduce((sum, vertex) => sum + (weights[vertex].get(id) || 0), 0) / 3;
        connect(list[i], list[j], area * Math.min(support(list[i]), support(list[j])));
      }
    }
    for (let i = 0; i < count; i++) if (points[i] && weights[i].size) samples.push({ point: points[i], weights: weights[i], area: vertexAreas[i] });
  }
  const span = totalVertices ? max.clone().sub(min).length() : 0, pointArea = totalArea && totalVertices ? totalArea / totalVertices : 1;
  // Material seams often duplicate positions but split triangle connectivity.
  // Weld only for evidence, within floating-point-scale distance; no model edit.
  const seamTolerance = Math.max(span * 1e-7, 1e-8), seams = new Map();
  for (const sample of samples) {
    const key = sample.point.map(value => Math.round(value / seamTolerance)).join(','), bucket = seams.get(key) || new Map();
    for (const [id, amount] of sample.weights) bucket.set(id, (bucket.get(id) || 0) + amount * (sample.area || pointArea));
    seams.set(key, bucket);
  }
  for (const bucket of seams.values()) {
    const list = [...bucket];
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) connect(list[i][0], list[j][0], Math.min(list[i][1], list[j][1]));
  }
  for (const item of raw.values()) if (!item.surface.mass) addMoments(item.unmeshed, item.points);
  const profiles = new Map([...raw].map(([id, item]) => [id, describe(item, pointArea)])), subtree = new Map();
  const measure = ids => describe(mergeRegions([...new Set(ids)].map(id => raw.get(id))), pointArea);
  const pointsByOwner = new Map(nodes.map(node=>[node.ObjectId,[]]));
  for(const sample of samples)for(const id of sample.weights.keys())pointsByOwner.get(id).push(sample);
  /** Exact local surface inside center +/- radius in each coordinate. This
   * window is chosen by native attachment span by the caller, not mesh size;
   * distant clothing cannot inflate it. All original region evidence remains.
   */
  const measureNear = (ids, center, radius) => {
    const owners=new Set(ids), point=center?.toArray ? center.toArray() : Array.from(center || []), local=region();
    if(point.length!==3 || !point.every(Number.isFinite) || !(radius>0) || !Number.isFinite(radius))return describe(local,pointArea);
    const elements=new Set([...owners].flatMap(id=>trianglesByOwner.get(id)||[]));
    for(const element of elements) {
      const weights=element.weights.map(influences=>[...owners].reduce((sum,id)=>sum+(influences.get(id)||0),0));
      const polygon=clipAttachmentTriangle(element.points,weights,point,radius);
      for(let i=1;i+1<polygon.length;i++) {
        const corners=[polygon[0],polygon[i],polygon[i+1]], points=corners.map(c=>c.point);
        const u=new Vector3().fromArray(points[1]).sub(new Vector3().fromArray(points[0]));
        const v=new Vector3().fromArray(points[2]).sub(new Vector3().fromArray(points[0])), area=u.cross(v).length()*.5;
        if(!(area>0))continue;
        addTriangle(local.surface,points,corners.map(c=>c.weight),area);
        for(const corner of points){const v=new Vector3().fromArray(corner);local.min.min(v);local.max.max(v);}
      }
    }
    const localPoints=new Set([...owners].flatMap(id=>pointsByOwner.get(id)||[]));
    for(const sample of localPoints) {
      if(sample.point.some((value,axis)=>Math.abs(value-point[axis])>radius))continue;
      const amount=[...owners].reduce((sum,id)=>sum+(sample.weights.get(id)||0),0);
      const unmeshed=[...owners].reduce((sum,id)=>sum+(!raw.get(id)?.surface.mass?(sample.weights.get(id)||0):0),0);
      addPoint(local.points,sample.point,amount);if(unmeshed)addPoint(local.unmeshed,sample.point,unmeshed);
      if(sample.weights.size===1)addPoint(local.rigid,sample.point,amount);
      local.vertices++;const v=new Vector3().fromArray(sample.point);local.min.min(v);local.max.max(v);
    }
    return describe(local,pointArea);
  };
  // Shared hierarchy helpers define orphan and cycle behavior for every caller.
  // Each direct region contributes once to each ancestor, independent of IDs.
  const beneath = new Map(nodes.map(node => [node.ObjectId, []]));
  for (const node of nodes) for (const ancestor of tree.ancestors(node.ObjectId, true)) beneath.get(ancestor)?.push(raw.get(node.ObjectId));
  for (const [id, regions] of beneath) subtree.set(id, describe(mergeRegions(regions), pointArea));
  return { nodes, tree, byId, children, profiles, subtree, surfaceLinks, measure, measureNear, bounds: { min: totalVertices ? min : null, max: totalVertices ? max : null, span }, totalArea };
}
