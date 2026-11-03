// Read-only candidate evidence. Native playback and SD/weighted skinning own all poses.
import { Vector3 } from 'three';
import { allNodes, sampleNodeMatrices, sampleGeosetAnimation, skinGeoset } from './animation.js';
import { animation, animationFrames } from './ai-motion-compare.js';
import { vertexBones } from './part-bones.js';
import { nodeIndex } from './node-hierarchy.js';

const index = n => Number.isInteger(n) && n >= 0;
const metric = () => ({ max: null, normalized: null, samples: 0, worst: null });
function observe(row, value, location, scale) {
  if (!Number.isFinite(value)) throw Error('Rig measurement encountered non-finite posed geometry.');
  row.samples++;
  if (row.max === null || value > row.max) Object.assign(row, { max: value, normalized: scale > 0 ? value / scale : null, worst: location });
}
const point = (positions, vertex) => new Vector3().fromArray(positions, vertex * 3);
const distance = (positions, a, b) => point(positions, a).distanceTo(point(positions, b));
const same = (a, b) => a?.length === b?.length && Array.from(a || []).every((v, i) => v === b[i]);
const named = value => String(value || '').trim().toLowerCase();
function vertices(model, spec) {
  if (!spec || typeof spec !== 'object') throw Error('Choose a rig part with a geoset index.');
  const g = model.Geosets?.[spec.geoset];
  if (!index(spec.geoset) || !g) throw Error('Choose a valid zero-based rig geoset index.');
  const result = spec.vertices === undefined ? Array.from({ length: g.Vertices.length / 3 }, (_, i) => i) : spec.vertices;
  if (!Array.isArray(result) || !result.length || result.some(v => !index(v) || v >= g.Vertices.length / 3)) throw Error('Choose valid rig vertex indices.');
  return [...new Set(result)].sort((a, b) => a - b);
}
function diagonal(model) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const g of model.Geosets || []) {
    if (!g.Vertices || g.Vertices.length % 3) throw Error('Rig measurement requires complete vertex coordinates.');
    for (let i = 0; i < g.Vertices.length; i++) {
      if (!Number.isFinite(g.Vertices[i])) throw Error('Rig measurement requires finite vertex coordinates.');
      min[i % 3] = Math.min(min[i % 3], g.Vertices[i]); max[i % 3] = Math.max(max[i % 3], g.Vertices[i]);
    }
  }
  return Number.isFinite(min[0]) ? Math.hypot(...max.map((v, i) => v - min[i])) : 0;
}
// Three non-collinear reference anchors establish a rigid basis in O(vertices).
// Comparing all coordinates in that basis detects shape changes independently
// of the entire piece's translation/rotation; it does not guess its driver.
function anchors(g, ids) {
  const origin = ids[0], p = point(g.Vertices, origin);
  let x = origin, far = 0;
  for (const v of ids) { const d = point(g.Vertices, v).distanceToSquared(p); if (d > far) { far = d; x = v; } }
  const axis = point(g.Vertices, x).sub(p).normalize();
  let y = origin; far = 0;
  for (const v of ids) { const d = point(g.Vertices, v).sub(p).cross(axis).lengthSq(); if (d > far) { far = d; y = v; } }
  return [origin, x, y];
}
function basis(positions, [o, a, b]) {
  const origin = point(positions, o), x = point(positions, a).sub(origin), y = point(positions, b).sub(origin);
  if (!x.lengthSq()) x.set(1, 0, 0); else x.normalize();
  y.addScaledVector(x, -y.dot(x));
  if (y.lengthSq() === 0) { y.set(Math.abs(x.x) < .9 ? 1 : 0, Math.abs(x.x) < .9 ? 0 : 1, 0); y.addScaledVector(x, -y.dot(x)); }
  y.normalize();
  return { origin, x, y, z: x.clone().cross(y) };
}
function shapePoint(positions, vertex, axes) {
  const p = point(positions, vertex).sub(axes.origin);
  return new Vector3(p.dot(axes.x), p.dot(axes.y), p.dot(axes.z));
}
function driverSpace(positions, matrix, ids) {
  if (!matrix || !Number.isFinite(matrix.determinant()) || matrix.determinant() === 0) return null;
  const inverse = matrix.clone().invert(), result = new Float64Array(positions.length);
  for (const v of ids) point(positions, v).applyMatrix4(inverse).toArray(result, v * 3);
  return result;
}
function edges(g, ids) {
  const selected = new Set(ids), result = new Map();
  for (let f = 0; f + 2 < (g.Faces?.length || 0); f += 3) for (const [a, b] of [[g.Faces[f], g.Faces[f + 1]], [g.Faces[f + 1], g.Faces[f + 2]], [g.Faces[f + 2], g.Faces[f]]]) {
    if (a !== b && selected.has(a) && selected.has(b)) result.set([Math.min(a, b), Math.max(a, b)].join(':'), [Math.min(a, b), Math.max(a, b)]);
  }
  return [...result.values()];
}
function selectedClips(model, selections) {
  if (selections !== undefined && (!Array.isArray(selections) || !selections.length)) throw Error('Choose a nonempty rig sequence list.');
  const list = selections ?? [...(model.Sequences || []).map((_, sequence) => sequence), ...(model.GlobalSequences || []).flatMap((duration, globalSequence) => duration > 0 ? [{ globalSequence }] : [])];
  if (!list.length) return [{ model, sequence: -1, interval: [0, 0], name: 'Bind pose', selection: { sequence: -1 } }];
  return list.map(value => {
    const selection = typeof value === 'number' ? { sequence: value } : value;
    if (!selection || (index(selection.sequence) === index(selection.globalSequence))) throw Error('Choose valid zero-based rig animation indices.');
    const clip = animation(model, selection);
    if (!clip || clip.interval.length !== 2 || !clip.interval.every(Number.isFinite) || clip.interval[0] > clip.interval[1]) throw Error('Rig measurement animation is out of range or has an invalid interval.');
    return { ...clip, selection };
  });
}
function matching(model, clip) {
  if (clip.selection.globalSequence !== undefined) return animation(model, clip.selection);
  if (clip.sequence === -1) return { model, sequence: -1, interval: [0, 0] };
  let sequence = clip.sequence;
  if (named(model.Sequences?.[sequence]?.Name) !== named(clip.name)) {
    const found = (model.Sequences || []).flatMap((s, i) => named(s.Name) === named(clip.name) ? [i] : []);
    if (found.length !== 1) return null;
    sequence = found[0];
  }
  return animation(model, { sequence });
}

/** Indices are zero-based; every geoset location also includes its displayed
 * one-based geosetId. Corresponding topology is required; no nearest-vertex
 * guesses. `expectedScale` is an explicitly intended uniform scale in driver
 * space. No thresholds or automatic repairs are inferred from measurements.
 * Bounds evidence checks AABBs, not the engine's culling or bounding spheres.
 * A bounded preview specifies sequences and step. Omit sequences for all local
 * and isolated global clips. The shared frame sampler defaults to 1 ms, or
 * 10 ms for clips longer than 5 s, always including endpoints. Reports describe
 * that finite grid, not continuous-time extrema; explicit step:1 samples every
 * integer millisecond when authored clip endpoints are integer timestamps.
 */
export async function measureRigCandidate(reference, candidate, { rigidParts = [], flexibleParts = [], sequences, step } = {}, signal) {
  if (step !== undefined && (!Number.isFinite(step) || step <= 0)) throw Error('Rig sample step must be positive milliseconds.');
  if (!Array.isArray(rigidParts) || !Array.isArray(flexibleParts)) throw Error('Rig parts must be lists.');
  // Snapshot once before yielding: a concurrent edit cannot mix revisions.
  const before = structuredClone(reference), after = structuredClone(candidate);
  const scale = diagonal(before); diagonal(after);
  signal?.throwIfAborted();
  const changedTopology = [];
  for (let i = 0; i < Math.max(before.Geosets?.length || 0, after.Geosets?.length || 0); i++) {
    const a = before.Geosets?.[i], b = after.Geosets?.[i];
    if (!a || !b || a.Vertices.length !== b.Vertices.length || !same(a.Faces || [], b.Faces || [])) changedTopology.push(i);
  }
  const changed = new Set(changedTopology), nodes = [before, after].map(m => new Map(allNodes(m).map(n => [n.ObjectId, n])));
  const rigid = rigidParts.map(spec => {
    const ids = vertices(after, spec), expectedScale = spec.expectedScale ?? 1;
    if (!Number.isFinite(expectedScale) || expectedScale <= 0) throw Error('Rig expectedScale must be a positive uniform scale.');
    if (!index(spec.driverBone) || !nodes[1].has(spec.driverBone) || !nodes[0].has(spec.referenceDriverBone ?? spec.driverBone)) throw Error('Choose existing driver ObjectIds in both models.');
    return { spec, ids, expectedScale, anchors: changed.has(spec.geoset) ? null : anchors(before.Geosets[spec.geoset], ids), row: { geoset: spec.geoset, geosetId: spec.geoset + 1, driverBone: spec.driverBone, shape: metric(), attachment: metric(), coverage: [], unmeasured: changed.has(spec.geoset) ? ['Changed topology: vertex correspondence is unknown.'] : [] } };
  });
  const flexible = flexibleParts.map(spec => {
    const ids = vertices(after, spec), pairs = spec.seamPairs ?? [];
    if (!Array.isArray(pairs)) throw Error('Seams must be explicit pairs of geoset/vertex points.');
    for (const pair of pairs) {
      if (!Array.isArray(pair) || pair.length !== 2) throw Error('Choose two points for every seam.');
      for (const p of pair) { if (!p || !index(p.vertex)) throw Error('Choose valid seam vertex indices.'); vertices(after, { geoset: p.geoset, vertices: [p.vertex] }); }
    }
    return { spec, ids, edges: changed.has(spec.geoset) ? [] : edges(before.Geosets[spec.geoset], ids), pairs, row: { geoset: spec.geoset, geosetId: spec.geoset + 1, edgeStrain: metric(), seamOpening: metric(), absoluteEdgeStrain: metric(), absoluteSeamOpening: metric(), coverage: [], unmeasured: changed.has(spec.geoset) ? ['Changed topology: vertex correspondence is unknown.'] : [] } };
  });
  const affectedCameraDependentNodes = new Set();
  for (const [side, model] of [before, after].entries()) {
    const hierarchy = nodeIndex(model), needed = new Set();
    function includeVertex(geoset, vertex) {
      const g = model.Geosets?.[geoset];
      if (!g || vertex >= g.Vertices.length / 3) return;
      // Native skinGeoset supports an HD prefix with a classic tail. Give the
      // shared influence reader one complete weighted vertex for that prefix.
      const weighted = g.SkinWeights?.length >= (vertex + 1) * 8;
      const ids = weighted ? vertexBones({ Vertices: [0,0,0], SkinWeights: g.SkinWeights.slice(vertex * 8, vertex * 8 + 8) }, 0) : vertexBones(g, vertex);
      for (const id of ids) needed.add(id);
    }
    for (const part of rigid) {
      needed.add(side === 0 ? part.spec.referenceDriverBone ?? part.spec.driverBone : part.spec.driverBone);
      for (const v of part.ids) includeVertex(part.spec.geoset, v);
    }
    for (const part of flexible) {
      for (const v of part.ids) includeVertex(part.spec.geoset, v);
      for (const pair of part.pairs) for (const p of pair) includeVertex(p.geoset, p.vertex);
    }
    for (const id of needed) for (const ancestor of hierarchy.ancestors(id, true))
      if (hierarchy.byId.get(ancestor).Flags & 120) affectedCameraDependentNodes.add(ancestor);
  }
  const boxes = [], missing = [];
  function addBox(owner, data, fields = {}) {
    const row = { owner, ...fields, measuredVertices: 0, hiddenVertexSamples: 0, outsideSamples: 0, maxOverflow: null, normalized: null, worst: null };
    if (!data || data.MinimumExtent?.length !== 3 || data.MaximumExtent?.length !== 3 || Array.from(data.MinimumExtent).some((v, i) => !Number.isFinite(v) || !Number.isFinite(data.MaximumExtent[i]) || v > data.MaximumExtent[i])) { missing.push({ owner, ...fields, reason: 'Missing or invalid extent box.' }); return; }
    boxes.push({ data, row });
  }
  addBox('model', after.Info);
  for (const [sequence, clip] of (after.Sequences || []).entries()) addBox('sequence', clip, { sequence });
  for (const [geoset, g] of (after.Geosets || []).entries()) {
    const fields = { geoset, geosetId: geoset + 1 };
    addBox('geoset', g, fields);
    for (let sequence = 0; sequence < (after.Sequences?.length || 0); sequence++) addBox('geoset-animation', g.Anims?.[sequence], { ...fields, sequence });
  }
  const clipRows = [], missingClips = [];
  let lastYield = performance.now();
  for (const clip of selectedClips(after, sequences)) {
    const baseline = matching(before, clip), { frames, step: sampleStep } = animationFrames(clip.interval, step);
    clipRows.push({ ...clip.selection, name: clip.name, interval: clip.interval, framesSampled: frames.length, step: sampleStep });
    if (!baseline) missingClips.push({ ...clip.selection, name: clip.name, reason: 'No unambiguous matching reference animation.' });
    for (const part of [...rigid, ...flexible]) part.row.coverage.push({ ...clip.selection, clip: clip.name, framesSampled: frames.length, measuredFrames: 0, hiddenFrames: 0, unmeasuredFrames: 0 });
    const positions = [before, after].map(m => (m.Geosets || []).map(g => new Float32Array(g.Vertices.length)));
    for (const frame of frames) {
      if (performance.now() - lastYield >= 16) { await new Promise(resolve => setTimeout(resolve, 0)); lastYield = performance.now(); }
      signal?.throwIfAborted();
      const referenceFrame = baseline ? baseline.interval[0] + (frame - clip.interval[0]) * ((baseline.interval[1] - baseline.interval[0]) / (clip.interval[1] - clip.interval[0] || 1)) : null;
      const matrices = [baseline ? sampleNodeMatrices(baseline.model, referenceFrame, baseline.sequence) : null, sampleNodeMatrices(clip.model, frame, clip.sequence)];
      const visible = [before, after].map((m, side) => (m.Geosets || []).map((_, gi) => side === 0 ? !!baseline && sampleGeosetAnimation(baseline.model, gi, referenceFrame, baseline.sequence).alpha >= .01 : sampleGeosetAnimation(clip.model, gi, frame, clip.sequence).alpha >= .01));
      for (const [side, model] of [before, after].entries()) if (matrices[side]) for (const [gi, g] of (model.Geosets || []).entries()) {
        if (!visible[0][gi] && !visible[1][gi]) continue;
        if (performance.now() - lastYield >= 16) { await new Promise(resolve => setTimeout(resolve, 0)); lastYield = performance.now(); signal?.throwIfAborted(); }
        skinGeoset(g, matrices[side], positions[side][gi]);
      }
      const location = (geoset, fields = {}) => ({ ...clip.selection, clip: clip.name, frame, referenceFrame, geoset, geosetId: geoset + 1, ...fields });
      if (baseline) {
        for (const part of rigid) {
          const { spec, ids, row } = part;
          const coverage = row.coverage.at(-1);
          if (!visible[0][spec.geoset] && !visible[1][spec.geoset]) { coverage.hiddenFrames++; continue; }
          if (changed.has(spec.geoset)) { coverage.unmeasuredFrames++; continue; }
          const local = [before.Geosets[spec.geoset].Vertices, driverSpace(positions[1][spec.geoset], matrices[1].get(spec.driverBone), ids)];
          if (local.some(p => !p)) { coverage.unmeasuredFrames++; if (!row.unmeasured.some(r => r.clip === clip.name)) row.unmeasured.push({ clip: clip.name, frame, reason: 'Driver space is singular.' }); continue; }
          coverage.measuredFrames++;
          const axes = local.map(p => basis(p, part.anchors));
          for (const vertex of ids) {
            observe(row.attachment, point(local[1], vertex).distanceTo(point(local[0], vertex).multiplyScalar(part.expectedScale)), location(spec.geoset, { vertex }), scale);
            observe(row.shape, shapePoint(local[1], vertex, axes[1]).distanceTo(shapePoint(local[0], vertex, axes[0]).multiplyScalar(part.expectedScale)), location(spec.geoset, { vertex }), scale);
          }
        }
        for (const part of flexible) {
          const { spec, row } = part;
          const coverage = row.coverage.at(-1);
          if (!visible[0][spec.geoset] && !visible[1][spec.geoset]) { coverage.hiddenFrames++; continue; }
          if (changed.has(spec.geoset)) coverage.unmeasuredFrames++; else coverage.measuredFrames++;
          if (!changed.has(spec.geoset)) for (const edge of part.edges) {
            const lengths = positions.map(p => distance(p[spec.geoset], ...edge));
            observe(row.edgeStrain, Math.abs(lengths[1] - lengths[0]), location(spec.geoset, { edge, referenceLength: lengths[0], candidateLength: lengths[1], strainRatio: lengths[0] > 0 ? Math.abs(lengths[1] - lengths[0]) / lengths[0] : null }), scale);
            const bindLength = distance(before.Geosets[spec.geoset].Vertices, ...edge);
            observe(row.absoluteEdgeStrain, Math.abs(lengths[1] - bindLength), location(spec.geoset, { edge, bindLength, candidateLength: lengths[1], strainRatio: bindLength > 0 ? Math.abs(lengths[1] - bindLength) / bindLength : null }), scale);
          }
          for (const pair of part.pairs) {
            if (pair.some(p => !visible[0][p.geoset] && !visible[1][p.geoset])) continue;
            if (pair.some(p => changed.has(p.geoset))) { if (!row.unmeasured.includes('A seam crosses changed topology.')) row.unmeasured.push('A seam crosses changed topology.'); continue; }
            const lengths = positions.map(p => point(p[pair[0].geoset], pair[0].vertex).distanceTo(point(p[pair[1].geoset], pair[1].vertex)));
            observe(row.seamOpening, Math.max(0, lengths[1] - lengths[0]), location(pair[0].geoset, { vertex: pair[0].vertex, seam: pair, referenceGap: lengths[0], candidateGap: lengths[1] }), scale);
            const bindGap = point(before.Geosets[pair[0].geoset].Vertices, pair[0].vertex).distanceTo(point(before.Geosets[pair[1].geoset].Vertices, pair[1].vertex));
            observe(row.absoluteSeamOpening, Math.max(0, lengths[1] - bindGap), location(pair[0].geoset, { vertex: pair[0].vertex, seam: pair, bindGap, candidateGap: lengths[1] }), scale);
          }
        }
      }
      // Animated boxes cover visible candidate geometry, as the native viewer
      // does. Static geoset boxes cover authored bind vertices once.
      for (const { data, row } of boxes) {
        if (row.owner === 'geoset' && row.measuredVertices > 0) continue;
        if (row.sequence !== undefined && (clip.selection.globalSequence !== undefined || row.sequence !== clip.sequence)) continue;
        const geosets = row.geoset === undefined ? positions[1].map((_, i) => i) : [row.geoset];
        for (const gi of geosets) {
          if (row.owner !== 'geoset' && !visible[1][gi]) { row.hiddenVertexSamples += after.Geosets[gi].Vertices.length / 3; continue; }
          const p = row.owner === 'geoset' ? after.Geosets[gi].Vertices : positions[1][gi];
          for (let vertex = 0; vertex < p.length / 3; vertex++) {
          if (vertex % 2048 === 0 && performance.now() - lastYield >= 16) { await new Promise(resolve => setTimeout(resolve, 0)); lastYield = performance.now(); signal?.throwIfAborted(); }
          const at = vertex * 3;
          const overflow = Math.max(0, data.MinimumExtent[0] - p[at], p[at] - data.MaximumExtent[0],
            data.MinimumExtent[1] - p[at + 1], p[at + 1] - data.MaximumExtent[1],
            data.MinimumExtent[2] - p[at + 2], p[at + 2] - data.MaximumExtent[2]);
          if (!Number.isFinite(overflow)) throw Error('Bounds measurement encountered non-finite posed geometry.');
          row.measuredVertices++; if (overflow > 0) row.outsideSamples++;
          if (row.maxOverflow === null || overflow > row.maxOverflow) Object.assign(row, { maxOverflow: overflow, normalized: scale > 0 ? overflow / scale : null, worst: row.owner === 'geoset' ? { sequence: -1, clip: 'Bind pose', frame: 0, referenceFrame: 0, geoset: gi, geosetId: gi + 1, vertex } : location(gi, { vertex }) });
          }
        }
      }
    }
  }
  for (const part of [...rigid, ...flexible]) {
    if (!part.row.coverage.some(c => c.measuredFrames)) part.row.unmeasured.push('No visible corresponding poses were measured.');
    for (const c of part.row.coverage) if (missingClips.some(m => m.sequence === c.sequence && m.globalSequence === c.globalSequence)) c.unmeasuredFrames = c.framesSampled;
  }
  return {
    source: 'MDLxL animation.js (app-owned rig measurement)', scale: { modelDiagonal: scale },
    method: 'Matched vertex indices and clip phases; native SD/weighted skinning. Rigid attachment compares candidate driver-local offsets to ORIGINAL BIND vertices carried by the declared driver, never the possibly broken posed reference skin. Rigid shape compares candidate driver-local shape against the original bind shape in a rigid basis; authored driver scaling factors out. Flexible edgeStrain/seamOpening are deltas from posed reference motion; absoluteEdgeStrain/absoluteSeamOpening are departures from original bind edge lengths/seam gaps. Seams require explicit vertex pairs. Rig poses are measured if visible in either model (geoset alpha >=0.01). Candidate-visible posed vertices are checked against model/sequence/geoset-animation AABBs; static geoset AABBs use bind vertices. No bounding-sphere or Warcraft III culling verdict. Global loops are isolated individually; combined global phases and camera-dependent billboards are not certified.',
    affectedCameraDependentNodes: [...affectedCameraDependentNodes].sort((a,b) => a-b),
    changedTopology, missingClips, clips: clipRows, rigidParts: rigid.map(p => p.row), flexibleParts: flexible.map(p => p.row), bounds: { boxes: boxes.map(b => b.row), missing },
    cameraDependentNodes: [...new Set([...nodes[0].values(), ...nodes[1].values()].filter(n => n.Flags & 120).map(n => n.ObjectId))].sort((a,b) => a-b),
  };
}
