import { Matrix4, Vector3 } from 'three';
import { allNodes, geosetSkinMatrix, nodePivot, sampleGeosetAnimation, sampleNodeMatrices, skinGeoset } from './animation.js';
import { MAX_SWEEP_POINT_VERTICES } from './ai-tools.js';
import { animation, animationFrames } from './ai-motion-compare.js';
import { standSequenceIndex } from './sequence-editor.js';

const index = id => Number.isInteger(id) && id >= 0;
const compact = value => Number(value.toPrecision(6));

// Keep only the named vertices and their bindings. Sorting preserves animation.js's
// HD-prefix/SD-tail interpretation even for an incomplete SkinWeights array.
function preparePoint(model, spec, label, nodes, needed) {
  if (!spec || typeof spec !== 'object') throw Error('Choose point ' + label + '.');
  if ('nodeId' in spec) {
    if ('geoset' in spec || 'vertices' in spec || !index(spec.nodeId) || !nodes.has(spec.nodeId))
      throw Error('Invalid node for point ' + label + '.');
    needed.add(spec.nodeId);
    return { nodeId: spec.nodeId, pivot: new Vector3().fromArray(nodePivot(model, nodes.get(spec.nodeId))), positions: new Float64Array(3) };
  }
  const g = model.Geosets?.[spec.geoset];
  if (!index(spec.geoset) || !g) throw Error('Invalid geoset for point ' + label + '.');
  if (Array.isArray(spec.vertices) && spec.vertices.length > MAX_SWEEP_POINT_VERTICES)
    throw Error(`Choose at most ${MAX_SWEEP_POINT_VERTICES} vertices for point ${label}.`);
  if (!Array.isArray(spec.vertices) || !spec.vertices.length || spec.vertices.some(v => !index(v) || v >= g.Vertices.length / 3))
    throw Error('Choose valid vertices for point ' + label + '.');
  const ids = [...new Set(spec.vertices)].sort((a, b) => a - b);
  const mesh = { Vertices: [], VertexGroup: [], Groups: [], SkinWeights: [] };
  for (const id of ids) {
    mesh.Vertices.push(...g.Vertices.slice(id * 3, id * 3 + 3));
    mesh.VertexGroup.push(mesh.Groups.length);
    const group = g.Groups?.[g.VertexGroup?.[id]] || [];
    mesh.Groups.push(Array.from(group));
    if (g.SkinWeights?.length >= (id + 1) * 8) {
      const skin = g.SkinWeights.slice(id * 8, id * 8 + 8);
      mesh.SkinWeights.push(...skin);
      for (let slot = 0; slot < 4; slot++) if (skin[4 + slot]) needed.add(skin[slot]);
    } else for (const bone of group) needed.add(bone);
  }
  return { geoset: spec.geoset, mesh, positions: new Float32Array(mesh.Vertices.length) };
}

function posePoint(point, matrices, center) {
  if (point.mesh) {
    const positions = skinGeoset(point.mesh, matrices, point.positions);
    center.set(0, 0, 0);
    for (let i = 0; i < positions.length; i += 3) {
      center.x += positions[i]; center.y += positions[i + 1]; center.z += positions[i + 2];
    }
    center.multiplyScalar(3 / positions.length);
  } else {
    center.copy(point.pivot).applyMatrix4(matrices.get(point.nodeId)).toArray(point.positions);
  }
}

function closest(a, b) {
  let min = Infinity;
  for (let i = 0; i < a.length; i += 3) for (let j = 0; j < b.length; j += 3) {
    const x = a[i] - b[j], y = a[i + 1] - b[j + 1], z = a[i + 2] - b[j + 2];
    min = Math.min(min, x * x + y * y + z * z);
  }
  return Math.sqrt(min);
}

// B's origin is its posed centre. Its axes come from the node transform, or the
// mean skin transform of its selected vertices (including HD weights and scale).
function localOffset(b, matrices, from, center, basis, scratch) {
  if (b.mesh) {
    basis.elements.fill(0);
    const count = b.positions.length / 3;
    for (let i = 0; i < count; i++) {
      geosetSkinMatrix(b.mesh, i, matrices, scratch);
      for (let k = 0; k < 16; k++) basis.elements[k] += scratch.elements[k] / count;
    }
  } else basis.copy(matrices.get(b.nodeId));
  basis.setPosition(center);
  if (Math.abs(basis.determinant()) < 1e-12) return null;
  return from.applyMatrix4(basis.invert());
}

function selections(model, { sequences, globalSequence }) {
  if (sequences !== undefined && (!Array.isArray(sequences) || !sequences.length ||
    sequences.some(i => !index(i) || !model.Sequences[i]))) throw Error('Invalid sweep sequence list.');
  if (globalSequence !== undefined && (!index(globalSequence) || !(model.GlobalSequences?.[globalSequence] > 0)))
    throw Error('Invalid sweep global sequence.');
  const all = sequences === undefined && globalSequence === undefined;
  const local = all ? model.Sequences.map((_, i) => i) : [...new Set(sequences)];
  const globals = all ? (model.GlobalSequences || []).flatMap((ms, i) => ms > 0 ? [i] : []) : globalSequence === undefined ? [] : [globalSequence];
  return [...local.map(sequence => ({ sequence })), ...globals.map(globalSequence => ({ globalSequence }))];
}

export async function sweepAiRelation(model, rule, signal) {
  if (!['attached', 'clear', 'level'].includes(rule?.kind)) throw Error('Choose an attached, clear or level sweep.');
  const { kind, limit } = rule;
  if (limit !== undefined && (!Number.isFinite(limit) || limit < 0)) throw Error('Choose a finite nonnegative sweep limit.');
  const clips = selections(model, rule);
  const nodes = new Map(allNodes(model).map(n => [n.ObjectId, n])), needed = new Set();
  const a = preparePoint(model, rule.a, 'A', nodes, needed);
  const b = kind !== 'level' || rule.b !== undefined ? preparePoint(model, rule.b, 'B', nodes, needed) : null;
  for (const id of needed) {
    const parent = nodes.get(id)?.Parent;
    if (nodes.has(parent)) needed.add(parent);
  }
  const geosets = [...new Set([a.geoset, b?.geoset].filter(index))];
  // Detach just the playback inputs before yielding. A concurrent edit cannot
  // mix two revisions in a single sweep.
  const pose = structuredClone({
    Sequences: model.Sequences, GlobalSequences: model.GlobalSequences,
    Bones: [...needed].filter(id => nodes.has(id)).map(id => ({ ...nodes.get(id), PivotPoint: nodePivot(model, nodes.get(id)) })),
    GeosetAnims: model.GeosetAnims?.filter(g => geosets.includes(g.GeosetId)),
  });
  const cameraDependentNodes = [...needed].filter(id => nodes.get(id)?.Flags & 120).sort((a, b) => a - b);
  const from = new Vector3(), center = new Vector3(), basis = new Matrix4(), scratch = new Matrix4();
  function measure(clip, frame, reference) {
    const matrices = sampleNodeMatrices(clip.model, frame, clip.sequence);
    posePoint(a, matrices, from);
    if (b) posePoint(b, matrices, center);
    if (kind === 'level') return from.z - center.z;
    if (kind === 'clear') return closest(a.positions, b.positions);
    const offset = localOffset(b, matrices, from, center, basis, scratch);
    return reference ? (offset && offset.distanceTo(reference)) : offset?.clone();
  }

  let reference;
  if (kind === 'attached') {
    const seq = rule.reference?.sequence ?? standSequenceIndex(pose);
    const clip = seq === -1 && rule.reference?.sequence === undefined
      ? { model: pose, sequence: -1, interval: [0, 0] } : index(seq) && animation(pose, { sequence: seq });
    const frame = rule.reference?.frame ?? clip?.interval[0];
    if (!clip || !Number.isFinite(frame) || frame < clip.interval[0] || frame > clip.interval[1])
      throw Error('Invalid attached reference sequence or frame.');
    reference = measure(clip, frame);
    if (!reference) throw Error('Point B has no invertible space at the reference frame.');
  }
  const columns = ['clip', 'framesSampled', 'stepMs', 'measured', 'worst', 'frame', 'p50', 'p95'];
  if (kind === 'level') columns.push('min', 'max', 'spread');
  if (limit !== undefined) columns.push('sharePast');
  const rows = [];
  let worst = null, worstScore = -Infinity, lastYield = performance.now();
  for (const selection of clips) {
    const clip = animation(pose, selection);
    const { frames, step } = animationFrames(clip.interval);
    const values = [];
    let peak = -Infinity, worstFrame = null, worstValue = null, past = 0;
    for (const frame of frames) {
      if (performance.now() - lastYield >= 16) {
        await new Promise(resolve => setTimeout(resolve, 0));
        lastYield = performance.now();
      }
      signal?.throwIfAborted();
      if (geosets.some(id => sampleGeosetAnimation(clip.model, id, frame, clip.sequence).alpha < .01)) continue;
      const value = measure(clip, frame, reference);
      if (!Number.isFinite(value)) continue;
      values.push(value);
      const score = kind === 'clear' ? -value : Math.abs(value);
      if (score > peak) { peak = score; worstValue = compact(value); worstFrame = frame; }
      if (limit !== undefined && (kind === 'clear' ? value < limit : score > limit)) past++;
    }
    if (peak > worstScore) { worstScore = peak; worst = { clip: clip.name, frame: worstFrame, value: worstValue }; }
    values.sort((x, y) => x - y);
    const n = values.length;
    const quantile = p => n ? compact(values[Math.floor(p * (n - 1))]) : null;
    const row = [clip.name, frames.length, step, n, worstValue, worstFrame, quantile(.5), quantile(.95)];
    if (kind === 'level') row.push(quantile(0), quantile(1), n ? compact(values[n - 1] - values[0]) : null);
    if (limit !== undefined) row.push(n ? compact(past / n) : null);
    rows.push(row);
  }
  return { kind, worst, columns, rows, ...(cameraDependentNodes.length ? { cameraDependentNodes } : {}) };
}
