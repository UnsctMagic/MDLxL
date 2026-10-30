// Read-only motion evidence. Playback and skinning stay with animation.js.
import { sampleTrack, sampleNodeMatrices, skinGeoset, sampleGeosetAnimation } from './animation.js';
import { isolateGlobalSequence } from './global-sequence-preview.js';

const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(p * (sorted.length - 1))] : 0;
};
const mean = values => values.reduce((sum, v) => sum + v, 0) / (values.length || 1);
const named = value => String(value || '').trim().toLowerCase();
const xy = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function animation(model, selection) {
  if (selection.globalSequence != null) {
    const duration = model.GlobalSequences?.[selection.globalSequence];
    if (!(duration > 0)) return null;
    const copy = isolateGlobalSequence(structuredClone(model), selection.globalSequence);
    const sequence = copy.Sequences.push({ Name: 'AI global measurement', Interval: [0, duration] }) - 1;
    return { model: copy, sequence, interval: [0, duration], name: `global sequence ${selection.globalSequence}` };
  }
  const sequence = selection.sequence, clip = model.Sequences?.[sequence];
  return clip && { model, sequence, interval: Array.from(clip.Interval), name: clip.Name };
}

function matching(before, after, selection) {
  if (selection.globalSequence != null) return animation(before, selection);
  const name = named(after.Sequences?.[selection.sequence]?.Name);
  const index = named(before.Sequences?.[selection.sequence]?.Name) === name
    ? selection.sequence : (before.Sequences || []).findIndex(s => named(s.Name) === name);
  return index < 0 ? null : animation(before, { sequence: index });
}

// Records are compared by geoset index, node ObjectId within its collection, and
// material/layer index. No nearest-vertex guess disguises a topology change.
function channelPairs(before, after) {
  const pairs = [];
  for (let i = 0; i < Math.max(before.Geosets?.length || 0, after.Geosets?.length || 0); i++) {
    for (const property of ['alpha', 'color']) pairs.push({
      path: `/Geosets/${i}/${property}`, kind: `geoset-${property}`,
      sample: (a, frame) => a.model.Geosets?.[i]
        ? sampleGeosetAnimation(a.model, i, frame, a.sequence)[property] : null,
    });
  }
  for (const collection of ['Attachments', 'ParticleEmitters', 'ParticleEmitters2', 'ParticleEmitterPopcorns', 'RibbonEmitters', 'Lights']) {
    const ids = new Set([...(before[collection] || []), ...(after[collection] || [])].map(n => n.ObjectId));
    for (const id of ids) pairs.push({
      path: `/${collection}/ObjectId:${id}/Visibility`, kind: 'node-visibility',
      sample: (a, frame) => {
        const node = a.model[collection]?.find(n => n.ObjectId === id);
        return node ? sampleTrack(node.Visibility, frame, { interval: a.interval, globalSequences: a.model.GlobalSequences, fallback: 1 }) : null;
      },
    });
  }
  for (let mi = 0; mi < Math.max(before.Materials?.length || 0, after.Materials?.length || 0); mi++) {
    for (let li = 0; li < Math.max(before.Materials?.[mi]?.Layers?.length || 0, after.Materials?.[mi]?.Layers?.length || 0); li++) pairs.push({
      path: `/Materials/${mi}/Layers/${li}/Alpha`, kind: 'layer-alpha',
      sample: (a, frame) => {
        const layer = a.model.Materials?.[mi]?.Layers?.[li];
        return layer ? sampleTrack(layer.Alpha, frame, { interval: a.interval, globalSequences: a.model.GlobalSequences, fallback: 1 }) : null;
      },
    });
  }
  return pairs;
}

const vector = value => typeof value === 'number' ? [value] : Array.from(value);
function channelDifference(a, b) {
  if (a == null || b == null) return a === b ? 0 : null;
  const x = vector(a), y = vector(b);
  return x.length === y.length ? Math.max(0, ...x.map((v, i) => Math.abs(v - y[i]))) : null;
}

/** Statistics, never acceptance gates. Sequence numbers refer to after; names
 * match case-insensitively, and differing intervals compare equal phases.
 * step is milliseconds in the edited animation (default 1, or 10 above 5 s).
 * Both endpoints are always sampled. Global selections use {globalSequence}.
 */
export function compareMotion(before, after, { sequences, step } = {}) {
  if (step !== undefined && (!Number.isFinite(step) || step <= 0)) throw Error('Motion sample step must be a positive number of milliseconds.');
  const selections = sequences ?? (after.Sequences || []).map((_, sequence) => sequence);
  const changedTopology = [];
  const comparable = [];
  for (let i = 0; i < Math.max(before.Geosets?.length || 0, after.Geosets?.length || 0); i++) {
    const a = before.Geosets?.[i], b = after.Geosets?.[i];
    if (!a || !b || a.Vertices.length !== b.Vertices.length || !equal(Array.from(a.Faces || []), Array.from(b.Faces || []))) changedTopology.push(i);
    else comparable.push(i);
  }
  const channels = channelPairs(before, after);
  const rows = selections.map(selection => {
    if (typeof selection === 'string') selection = { sequence: (after.Sequences || []).findIndex(s => named(s.Name) === named(selection)) };
    else if (typeof selection === 'number') selection = { sequence: selection };
    const b = animation(after, selection), a = b && matching(before, after, selection);
    if (!b) throw Error('Motion comparison animation is out of range.');
    if (!a) return { ...selection, name: b.name, missing: 'No matching animation in the baseline.' };
    const [start, end] = b.interval, duration = end - start, sampleStep = step ?? (duration > 5000 ? 10 : 1);
    const frames = [];
    for (let frame = start; frame < end; frame += sampleStep) frames.push(frame);
    frames.push(end);
    const perFrame = [], channelRows = channels.map(c => ({ path: c.path, kind: c.kind, max: 0, spans: [] }));
    const buffers = [a, b].map(side => comparable.map(i => [new Float32Array(side.model.Geosets[i].Vertices.length), new Float32Array(side.model.Geosets[i].Vertices.length)]));
    let previous, peakSpeed = 0, worst = { distance: 0, frame: start }, worstSpeed = { difference: 0, frame: start };
    let centre = { max: 0, frame: start, beforeTravel: 0, afterTravel: 0 }, firstCentres;
    const contact = { before: 0, after: 0 };
    for (let fi = 0; fi < frames.length; fi++) {
      const frame = frames[fi], phase = duration ? (frame - start) / duration : 0;
      const beforeFrame = a.interval[0] + phase * (a.interval[1] - a.interval[0]);
      const matrices = [sampleNodeMatrices(a.model, beforeFrame, a.sequence), sampleNodeMatrices(b.model, frame, b.sequence)];
      const centres = [[0, 0], [0, 0]], lowest = [Infinity, Infinity], points = [[], []];
      let max = 0, sum = 0, count = 0, speedDifference = 0, speed = 0;
      const poses = comparable.map((gi, index) => [a, b].map((side, si) => skinGeoset(side.model.Geosets[gi], matrices[si], buffers[si][index][fi % 2])));
      for (let g = 0; g < comparable.length; g++) {
        const gi = comparable[g], [x, y] = poses[g];
        if (sampleGeosetAnimation(a.model, gi, beforeFrame, a.sequence).alpha < .01 && sampleGeosetAnimation(b.model, gi, frame, b.sequence).alpha < .01) continue;
        for (let v = 0; v < x.length; v += 3) {
          const distance = Math.hypot(x[v] - y[v], x[v + 1] - y[v + 1], x[v + 2] - y[v + 2]);
          max = Math.max(max, distance); sum += distance; count++;
          for (let si = 0; si < 2; si++) {
            const p = poses[g][si];
            centres[si][0] += p[v]; centres[si][1] += p[v + 1];
            lowest[si] = Math.min(lowest[si], p[v + 2]);
            points[si].push({ g, v, z: p[v + 2] });
          }
          if (previous) {
            const dt = frame - previous.frame, da = [0, 1, 2].map(k => x[v + k] - previous.poses[g][0][v + k]), db = [0, 1, 2].map(k => y[v + k] - previous.poses[g][1][v + k]);
            const beforeDt = beforeFrame - previous.beforeFrame;
            speed = Math.max(speed, Math.hypot(...da) / (beforeDt || dt));
            speedDifference = Math.max(speedDifference, Math.hypot(...da.map((d, k) => d / (beforeDt || dt) - db[k] / dt)));
          }
        }
      }
      if (count) {
        centres.forEach(c => { c[0] /= count; c[1] /= count; });
        firstCentres ||= centres.map(c => [...c]);
        const drift = xy(centres[0], centres[1]);
        if (drift > centre.max) Object.assign(centre, { max: drift, frame });
        centre.beforeTravel = Math.max(centre.beforeTravel, xy(centres[0], firstCentres[0]));
        centre.afterTravel = Math.max(centre.afterTravel, xy(centres[1], firstCentres[1]));
        if (previous) for (let si = 0; si < 2; si++) {
          const travel = points[si].filter(p => p.z <= lowest[si] + 1e-4 && previous.poses[p.g][si][p.v + 2] <= previous.lowest[si] + 1e-4)
            .map(p => Math.hypot(poses[p.g][si][p.v] - previous.poses[p.g][si][p.v], poses[p.g][si][p.v + 1] - previous.poses[p.g][si][p.v + 1]));
          contact[si === 0 ? 'before' : 'after'] += mean(travel);
        }
      }
      peakSpeed = Math.max(peakSpeed, speed);
      if (max > worst.distance) worst = { distance: max, frame };
      if (speedDifference > worstSpeed.difference) worstSpeed = { difference: speedDifference, frame };
      perFrame.push({ frame, beforeFrame, max, mean: count ? sum / count : 0, speedDifference, comparedVertices: count });
      channels.forEach((channel, ci) => {
        const av = channel.sample(a, beforeFrame), bv = channel.sample(b, frame), difference = channelDifference(av, bv), row = channelRows[ci];
        // Float roundoff is reported geometrically; channel spans use 1e-6.
        if (difference === null || difference > 1e-6) {
          if (difference === null || difference > row.max) Object.assign(row, { max: difference, frame });
          const last = row.spans.at(-1);
          if (last && last.lastSample === fi - 1) Object.assign(last, { to: frame, beforeTo: beforeFrame, samples: last.samples + 1, lastSample: fi });
          else row.spans.push({ from: frame, to: frame, beforeFrom: beforeFrame, beforeTo: beforeFrame, samples: 1, before: av, after: bv, lastSample: fi });
        }
      });
      previous = { frame, beforeFrame, poses, lowest };
    }
    const distances = perFrame.map(f => f.max), speeds = perFrame.slice(1).map(f => f.speedDifference);
    return {
      ...selection, name: b.name, baselineSequence: a.sequence, interval: b.interval, baselineInterval: a.interval,
      framesSampled: frames.length, step: sampleStep, perFrame,
      distance: { ...worst, p50: percentile(distances, .5), p95: percentile(distances, .95), mean: mean(distances), meanVertex: mean(perFrame.map(f => f.mean)),
        sharesAbove: Object.fromEntries([.5, 1, 2].map(d => [d, distances.filter(v => v > d).length / frames.length])) },
      endpoints: { start: distances[0], end: distances.at(-1) },
      originalPeakSpeed: peakSpeed, speedDifference: { ...worstSpeed, p99: percentile(speeds, .99) },
      distanceAtPeakSpeedMs: peakSpeed ? worst.distance / peakSpeed : worst.distance ? null : 0,
      centreHorizontalDrift: centre,
      contactSlip: { ...contact, difference: contact.after - contact.before },
      channels: channelRows.filter(c => c.spans.length).map(c => ({ ...c, spans: c.spans.map(({ lastSample, ...span }) => span) })),
    };
  });
  return { source: 'MDLxL animation.js (app-owned measurement)', units: 'model units; speed in model units/ms',
    method: 'Visible if either geoset alpha >= 0.01; matching vertex indices only. Contact travel averages horizontal movement of vertices lowest in consecutive samples (1e-4 tie allowance); it is a structural indicator, not a foot diagnosis. Camera-dependent billboards are not evaluated.',
    changedTopology, sequences: rows };
}

/** Compact table for the independent reviewer; keep every animation and channel
 * span, without shipping all sampled frames a second time. */
export function motionTable(motion) {
  return { ...motion, sequences: motion.sequences.map(({ perFrame, ...row }) => row) };
}
