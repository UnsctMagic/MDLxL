// Read-only handbook evidence. Existing editor owners supply topology, sampling,
// scope validation and resource resolution; these measurements never approve art.
import { prepareAiEdit, encodeAiValue } from './ai-model.js';
import { openDocument } from './editor-document.js';
import { indexedSurfaceIslands } from './geoset-operations.js';
import { checkedVertexSelection } from './mesh-tools.js';
import { vertexBones, vertexBoneWeights } from './part-bones.js';
import { compareMotion, motionTable, trackInventory } from './ai-motion-compare.js';
import { emitterSpans } from './emitter-timing.js';
import { uvMaterialLayers } from './uv-tools.js';
import { sampleTrack, visitTracks, isGlobalTrack } from './animation.js';
import { measureSimplifyCandidate } from './ai-simplify-checks.js';

const same = (a, b) => JSON.stringify(encodeAiValue(a)) === JSON.stringify(encodeAiValue(b));
const streams = [['Vertices', 3], ['Normals', 3], ['VertexGroup', 1], ['Tangents', 4], ['SkinWeights', 8]];
const families = ['ParticleEmitters', 'ParticleEmitters2', 'ParticleEmitterPopcorns', 'RibbonEmitters'];
const check = (name, passed, actual, expected) => ({ name, passed, actual, expected });
const clip = (value, limit) => ({ total: value.length, values: value.slice(0, limit), truncated: value.length > limit });
function selectedSets(model, selection) {
  const sets = new Map();
  for (const [key, indices] of Object.entries(selection || {})) {
    const geoset = Number(key);
    if (!Number.isSafeInteger(geoset) || !model.Geosets?.[geoset]) throw Error('Geoset selection is out of range.');
    const { selected } = checkedVertexSelection(model.Geosets[geoset], indices, { streams: false, allowEmpty: true });
    sets.set(geoset, new Set(selected));
  }
  return sets;
}
function partRows(model, selection, geosets) {
  const selected = selectedSets(model, selection), rows = [];
  const indices = geosets ?? (model.Geosets || []).map((_, i) => i);
  for (const geoset of indices) {
    const g = model.Geosets?.[geoset];
    if (!Number.isSafeInteger(geoset) || !g) throw Error('Geoset index is out of range.');
    const islands = indexedSurfaceIslands(g);
    const triangleCounts = new Array(islands.length).fill(0), membership = new Map();
    islands.forEach((vertices, component) => vertices.forEach(index => membership.set(index, component)));
    for (let offset = 0; offset < g.Faces.length; offset += 3) triangleCounts[membership.get(g.Faces[offset])]++;
    islands.forEach((vertices, component) => {
      const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
      const groups = new Set(); let selectedVertices = 0;
      for (const index of vertices) {
        for (let axis = 0; axis < 3; axis++) { min[axis] = Math.min(min[axis], g.Vertices[index * 3 + axis]); max[axis] = Math.max(max[axis], g.Vertices[index * 3 + axis]); }
        for (const id of vertexBones(g, index)) groups.add(id);
        if (selected.get(geoset)?.has(index)) selectedVertices++;
      }
      rows.push({ geoset, shown: geoset + 1, component, role: 'unassigned', vertices: vertices.length, triangles: triangleCounts[component], selectedVertices,
        materialID: g.MaterialID, uvSets: g.TVertices?.length || 0, bounds: { min, max }, groups: [...groups].sort((a, b) => a - b) });
    });
  }
  return rows;
}
/** Indexed islands are structural parts, preserving seam splits; assign their
 * semantic roles from the actual requested surface and rendered model. */
export function inspectEditingParts(model, { selection, geosets, limit = 64, offset = 0 } = {}) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 256) throw Error('Part limit must be 1–256.');
  if (!Number.isSafeInteger(offset) || offset < 0) throw Error('Part offset must be a nonnegative integer.');
  const rows = partRows(model, selection, geosets), truncated = offset + limit < rows.length;
  return { total: rows.length, offset, parts: rows.slice(offset, offset + limit), truncated, nextOffset: truncated ? offset + limit : null,
    identity: 'Zero-based geoset/component IDs; shown is the 1-based geoset list number. Indexed islands keep authored seams; roles require inspection.' };
}
function selectionConfinement(before, after, selection) {
  const selected = selectedSets(before, selection), problems = [];
  for (let gi = 0; gi < Math.max(before.Geosets.length, after.Geosets.length); gi++) {
    const a = before.Geosets[gi], b = after.Geosets[gi], ids = selected.get(gi);
    if (!ids?.size) { if (!same(a, b)) problems.push(`Unselected geoset ${gi} changed.`); continue; }
    if (!b || a.Vertices.length !== b.Vertices.length) { problems.push(`Geoset ${gi} needs an explicit vertex remapping before confinement can be measured.`); continue; }
    for (const [name, width] of [...streams, ...(a.TVertices || []).map((_, i) => [`TVertices/${i}`, 2])]) {
      const stream = (g) => name.startsWith('TVertices/') ? g.TVertices?.[Number(name.split('/')[1])] : g[name];
      const x = stream(a), y = stream(b);
      if (x == null && y == null) continue;
      if (!x || !y || x.constructor !== y.constructor || x.length !== y.length) { problems.push(`Geoset ${gi} ${name} stream identity changed.`); continue; }
      for (let v = 0; v < x.length / width; v++) if (!ids.has(v)) {
        for (let axis = 0; axis < width; axis++) if (x[v * width + axis] !== y[v * width + axis]) { problems.push(`Geoset ${gi} ${name} changed outside the selection at vertex ${v}.`); break; }
        if (problems.length > 64) break;
      }
    }
    const protectedFaces = g => {
      const faces = [];
      for (let offset = 0; offset < g.Faces.length; offset += 3) {
        const face = Array.from(g.Faces.slice(offset, offset + 3));
        if (face.some(index => !ids.has(index))) faces.push(face.join(','));
      }
      return faces.sort();
    };
    if (!same(protectedFaces(a), protectedFaces(b))) problems.push(`Geoset ${gi} changed triangles crossing or outside the selection.`);
    for (let vertex = 0; vertex < a.Vertices.length / 3; vertex++) if (!ids.has(vertex) && !same(vertexBoneWeights(a, vertex), vertexBoneWeights(b, vertex))) {
      problems.push(`Geoset ${gi} changed exterior binding at vertex ${vertex}.`); break;
    }
  }
  return check('selection confinement', problems.length === 0, clip(problems, 16), 'Only selected vertex streams and complete selected faces change; exterior indices remain stable.');
}
function timingOf(model) {
  const clocks = [];
  visitTracks(model, (track, { path }) => clocks.push({ path: path.join('/'), globalSequence: isGlobalTrack(track, model) ? track.GlobalSeqId : null }), { skip: ['Nodes'] });
  return { sequences: (model.Sequences || []).map(sequence => ({ Name: sequence.Name, Interval: sequence.Interval, NonLooping: sequence.NonLooping, MoveSpeed: sequence.MoveSpeed })),
    globalSequences: model.GlobalSequences,
    events: (model.EventObjects || []).map(node => ({ ObjectId: node.ObjectId, Name: node.Name, EventTrack: node.EventTrack, GlobalSeqId: node.GlobalSeqId })),
    globalClocks: clocks.filter(clock => clock.globalSequence != null) };
}
function uvOf(model) { return (model.Geosets || []).map(g => g.TVertices); }
function materialsOf(model) {
  return { materials: model.Materials, textures: model.Textures, textureAnims: model.TextureAnims,
    geosetMaterials: (model.Geosets || []).map(g => g.MaterialID), geosetAnims: model.GeosetAnims };
}
function emitterDiagnostics(model, sequences, limit = 64) {
  const indices = sequences?.filter(value => Number.isInteger(value)) ?? (model.Sequences || []).map((_, i) => i);
  return families.flatMap(family => (model[family] || []).map(node => ({
    family, id: node.ObjectId, parent: node.Parent, textureID: node.TextureID, texture: model.Textures?.[node.TextureID]?.Image,
    materialID: node.MaterialID, modelSpace: !!(node.Flags & 524288), squirt: !!node.Squirt,
    clips: indices.slice(0, limit).map(sequence => {
      const interval = model.Sequences?.[sequence]?.Interval;
      if (!interval) throw Error('Emitter diagnostic animation is out of range.');
      const options = { interval, globalSequences: model.GlobalSequences, fallback: 0 };
      const held = !node.Visibility?.Keys || node.Visibility.LineType === 0;
      return { sequence, global: isGlobalTrack(node.Visibility, model), visibilityKind: held ? 'held/static' : 'interpolated',
        ...(held ? { spans: emitterSpans(model, node.ObjectId, sequence).spans } : {}),
        start: { emissionRate: sampleTrack(node.EmissionRate, interval[0], options), lifeSpan: sampleTrack(node.LifeSpan, interval[0], options) },
        end: { emissionRate: sampleTrack(node.EmissionRate, interval[1], options), lifeSpan: sampleTrack(node.LifeSpan, interval[1], options) } };
    }), clipsTotal: indices.length,
  }))).slice(0, limit);
}

function serializedSize(model, sourceBytes) {
  // Same document recipe used by the handbook and normal sandbox saving. The
  // copied canonical sections retain float/channel conversion and node remaps.
  if (!(sourceBytes instanceof Uint8Array)) throw Error('Actual saved byte goals need optimization.sourceBytes from the owning document.originalBytes.');
  const doc = openDocument(sourceBytes, 'measurement.mdx');
  const sections = Object.keys(model).filter(key => key !== 'Nodes');
  doc.apply('Measurement snapshot', sections, working => Object.assign(working, structuredClone(model)));
  const bytes = doc.serialize('mdx'), reopened = openDocument(bytes, 'measurement.mdx');
  return { bytes: bytes.byteLength, readOnly: reopened.readOnly, errors: (reopened.diagnostics || []).filter(row => row.severity === 'error').map(row => row.code) };
}
function emitterGoalChecks(model, goals) {
  if (!Array.isArray(goals) || !goals.length || goals.length > 64) throw Error('Supply 1–64 explicit emitter goals with spans or sampled values.');
  const checks = [];
  for (const goal of goals) {
    const node = families.flatMap(family => model[family] || []).find(node => node.ObjectId === goal.id);
    if (!node) throw Error('Emitter goal names a missing node.');
    const interval = goal.globalSequence != null ? [0, model.GlobalSequences?.[goal.globalSequence]] : model.Sequences?.[goal.sequence]?.Interval;
    if (!interval || !interval.every(Number.isFinite) || interval[1] < interval[0]) throw Error('Emitter goals need an existing sequence or globalSequence clock.');
    const tolerance = goal.tolerance ?? 0;
    if (!Number.isFinite(tolerance) || tolerance < 0) throw Error('Emitter goal tolerance must be finite and nonnegative.');
    let measured = 0;
    if (goal.spans !== undefined) {
      if (goal.globalSequence != null || isGlobalTrack(node.Visibility, model) || node.Visibility?.Keys && node.Visibility.LineType !== 0)
        throw Error('Visibility span goals require a local held/static controller; use sampled values for fades or global clocks.');
      if (!Array.isArray(goal.spans) || goal.spans.some(span => !Array.isArray(span) || span.length !== 2 || !span.every(Number.isFinite) || span[0] < interval[0] || span[1] > interval[1] || span[0] > span[1])) throw Error('Emitter goal spans must lie inside the selected clock.');
      const actual = emitterSpans(model, goal.id, goal.sequence).spans;
      checks.push(check('emitter ' + goal.id + ' visibility spans', same(actual, goal.spans), actual, goal.spans)); measured++;
    }
    if (goal.samples !== undefined && (!Array.isArray(goal.samples) || goal.samples.length > 64)) throw Error('Emitter goals allow up to 64 samples.');
    for (const sample of goal.samples || []) {
      if (!Number.isFinite(sample.frame) || sample.frame < interval[0] || sample.frame > interval[1]) throw Error('Emitter sample must lie inside the selected clock.');
      for (const [field, property, fallback] of [['visibility', 'Visibility', 1], ['emissionRate', 'EmissionRate', 0], ['lifeSpan', 'LifeSpan', 0]]) if (Object.hasOwn(sample, field)) {
        if (!Number.isFinite(sample[field])) throw Error('Emitter goal values must be finite numbers.');
        const actual = Number(sampleTrack(node[property], sample.frame, { interval, globalSequences: model.GlobalSequences, globalTime: sample.frame, fallback }));
        checks.push(check('emitter ' + goal.id + ' ' + field + ' at ' + sample.frame, Number.isFinite(actual) && Math.abs(actual - sample[field]) <= tolerance, actual, { value: sample[field], tolerance })); measured++;
      }
    }
    if (!measured) throw Error('An emitter goal needs explicit spans or sampled visibility, emissionRate or lifeSpan values.');
  }
  return checks;
}

/** Measurements and requested exact protection checks only. operation names
 * simplify/optimization add the corresponding diagnostics. Preserve flags are
 * explicit exclusions for authorized UV/material/timing edits, not auto repair.
 * No report-wide pass is returned: request-specific and visual gates stay owned
 * by the review. Motion tolerances must be supplied, never inferred from medians.
 */
export function measureEditingCandidate(reference, candidate, options = {}) {
  const { operation, scope, protectedPaths, animationRanges, selection, preserveUVs = true, preserveMaterials = true, preserveTiming = true } = options;
  const checks = [], unverified = ['silhouette and texture appearance', 'Warcraft III playback'];
  try {
    const edit = prepareAiEdit(reference, candidate, { scope, protectedPaths, animationRanges });
    checks.push(check('edit scope', true, { changeCount: edit.changeCount, sections: edit.sections }, scope));
  } catch (error) { checks.push(check('edit scope', false, error.message, 'The explicit permitted model paths and protected data.')); }
  if (selection && operation !== 'simplify') checks.push(selectionConfinement(reference, candidate, selection));
  if (preserveUVs && operation !== 'simplify') checks.push(check('UV preservation', same(uvOf(reference), uvOf(candidate)), 'Exact UV buffers at original vertex indices.', 'All authored UV sets unchanged.'));
  if (preserveMaterials) checks.push(check('material preservation', same(materialsOf(reference), materialsOf(candidate)), 'Material layers, bindings, texture paths/flags, texture animation and geoset colour/visibility.', 'Exact preservation.'));
  const beforeTiming = timingOf(reference), afterTiming = timingOf(candidate);
  if (preserveTiming) checks.push(check('timing preservation', same(beforeTiming, afterTiming), 'Sequence intervals/flags/speed, events and global clocks.', 'Exact preservation.'));
  const simplify = operation === 'simplify' ? measureSimplifyCandidate(reference, candidate, { ...options.simplify, selection, preserveUVs }) : null;
  const components = simplify?.components || [];
  if (simplify) { checks.push(...simplify.checks); unverified.push(...simplify.unverified); }
  const report = { checks, ...(options.parts || selection ? { parts: { before: inspectEditingParts(reference, { selection }), after: inspectEditingParts(candidate) } } : {}),
    components: clip(components, 128).values, componentsTotal: components.length, timing: { changed: !same(beforeTiming, afterTiming) },
    ...(operation === 'emitter' || options.emitterGoals || options.diagnostics?.emitters ? { emitters: emitterDiagnostics(candidate, options.sequences) } : {}), emitterCount: families.reduce((sum, family) => sum + (candidate[family]?.length || 0), 0),
    ...(operation === 'uv' || operation === 'material' || options.diagnostics?.materials ? { layers: clip((candidate.Geosets || []).flatMap((g, geoset) => uvMaterialLayers(candidate, g.MaterialID).map(({ layerIndex, textureID, texture, coordId }) => ({ geoset, layerIndex, textureID, texture: texture?.Image, replaceableId: texture?.ReplaceableId, coordId, uvResolved: !!g.TVertices?.[coordId] }))), 128) } : {}), unverified, worstPoses: [] };
  if (report.emitterCount) unverified.push('elapsed particle playback');
  if (operation === 'emitter' || options.emitterGoals) checks.push(...emitterGoalChecks(candidate, options.emitterGoals));
  if (operation === 'optimization') {
    const goal = options.optimization;
    if (!goal?.measureBytes || goal.maxBytes === undefined && goal.requireReduction !== true) throw Error('Optimization needs a serialized byte size goal: optimization.measureBytes and maxBytes or requireReduction.');
    if (goal.maxBytes !== undefined && (!Number.isSafeInteger(goal.maxBytes) || goal.maxBytes < 1)) throw Error('Optimization maxBytes must be a positive integer.');
    const before = trackInventory(reference), after = trackInventory(candidate);
    const beforeSize = serializedSize(reference, goal.sourceBytes), afterSize = serializedSize(candidate, goal.sourceBytes);
    checks.push(check('serialized reopening', !afterSize.readOnly && !afterSize.errors.length, afterSize, 'Editable MDX reopens without errors.'));
    if (goal.maxBytes !== undefined) checks.push(check('serialized size', afterSize.bytes <= goal.maxBytes, afterSize.bytes, goal.maxBytes));
    if (goal.requireReduction) checks.push(check('serialized reduction', afterSize.bytes < beforeSize.bytes, { before: beforeSize.bytes, after: afterSize.bytes }, 'The candidate serializes smaller than the baseline.'));
    report.optimization = { beforeBytes: beforeSize.bytes, afterBytes: afterSize.bytes, beforeTrackBytes: before.trackBytes, afterTrackBytes: after.trackBytes, beforeTracks: before.tracks.length, afterTracks: after.tracks.length,
      keysOutsideAnimations: after.keysOutsideAnimations, owner: 'EditorDocument MDX serializer; optimizexl track inventory' };
  }
  if (options.motion) {
    const sequences = options.sequences ?? [...(candidate.Sequences || []).map((_, sequence) => sequence), ...(candidate.GlobalSequences || []).map((_, globalSequence) => ({ globalSequence }))];
    const motion = compareMotion(reference, candidate, { sequences, step: options.step });
    report.motion = motionTable(motion);
    const comparable = motion.sequences.length > 0 && !motion.changedTopology.length && motion.sequences.every(row => !row.missing && row.perFrame?.every(frame => frame.comparedVertices > 0));
    checks.push(check('motion correspondence', comparable, { changedTopology: motion.changedTopology, missing: motion.sequences.filter(row => row.missing).map(row => row.name) }, 'Matching topology, animation and usable visible vertices in every measured sample.'));
    for (const row of motion.sequences) if (row.distance) report.worstPoses.push({ ...(row.globalSequence != null ? { globalSequence: row.globalSequence } : { sequence: row.sequence }), frame: row.distance.frame, distance: row.distance.distance });
    report.worstPoses.sort((a, b) => b.distance - a.distance); report.worstPoses = report.worstPoses.slice(0, 8);
    const limits = options.limits || {};
    for (const [key, metric, name] of [['maxDistance', row => row.distance?.distance, 'motion distance'], ['maxSpeedDifference', row => row.speedDifference?.difference, 'motion speed']]) {
      if (limits[key] === undefined) continue;
      if (!Number.isFinite(limits[key]) || limits[key] < 0) throw Error('Motion limits must be finite nonnegative numbers.');
      checks.push(check(name, comparable && motion.sequences.length > 0 && motion.sequences.every(row => Number.isFinite(metric(row)) && metric(row) <= limits[key]),
        motion.sequences.map(row => ({ name: row.name, value: metric(row) })), limits[key]));
    }
    if (limits.requireExactEndpoints) checks.push(check('motion endpoints', comparable && motion.sequences.length > 0 && motion.sequences.every(row => row.endpoints?.start === 0 && row.endpoints?.end === 0), motion.sequences.map(row => ({ name: row.name, endpoints: row.endpoints })), 'Exact first and last poses.'));
    if (!comparable) unverified.push('motion on unmatched or invisible geometry');
    if (!Object.keys(limits).length) unverified.push('motion acceptance tolerance');
  } else unverified.push('sampled motion');
  return report;
}
