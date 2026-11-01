// Read-only motion evidence. Playback and skinning stay with animation.js.
import { sampleTrack, sampleNodeMatrices, skinGeoset, sampleGeosetAnimation, visitTracks, isGlobalTrack } from './animation.js';
import { isolateGlobalSequence } from './global-sequence-preview.js';
import nativeStudy from '../docs/AI-SD-STUDY-DATA.json' with { type: 'json' };

const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(p * (sorted.length - 1))] : 0;
};
const mean = values => values.reduce((sum, v) => sum + v, 0) / (values.length || 1);
const named = value => String(value || '').trim().toLowerCase();
const xy = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function animation(model, selection) {
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

export function animationFrames([start, end], step = end - start > 5000 ? 10 : 1) {
  const frames = [];
  for (let frame = start; frame < end; frame += step) frames.push(frame);
  frames.push(end);
  return { frames, step };
}

function matching(before, after, selection) {
  if (selection.globalSequence != null) return animation(before, selection);
  const name = named(after.Sequences?.[selection.sequence]?.Name);
  const index = named(before.Sequences?.[selection.sequence]?.Name) === name
    ? selection.sequence : (before.Sequences || []).findIndex(s => named(s.Name) === name);
  return index < 0 ? null : animation(before, { sequence: index });
}

// Geosets retain their indices; nodes match within their collection by unique
// name (else stable position). Material references follow corresponding geosets.
// Export can renumber ObjectIds/resources without changing their channels.
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
    const old = before[collection] || [], next = after[collection] || [], remaining = new Set(next.map((_, i) => i));
    const indices = old.map((node, i) => {
      const namedMatches = node.Name ? next.flatMap((n, j) => n.Name === node.Name && remaining.has(j) ? [j] : []) : [];
      const j = namedMatches.length === 1 ? namedMatches[0] : remaining.has(i) && next[i]?.Name === node.Name ? i : -1;
      remaining.delete(j); return [i, j];
    }).concat([...remaining].map(j => [-1, j]));
    for (const ids of indices) pairs.push({
      path: `/${collection}/${ids[1] >= 0 ? ids[1] : 'removed:' + ids[0]}/Visibility`, kind: 'node-visibility',
      sample: (a, frame, side) => {
        const node = a.model[collection]?.[ids[side]];
        return node ? sampleTrack(node.Visibility, frame, { interval: a.interval, globalSequences: a.model.GlobalSequences, fallback: 1 }) : null;
      },
    });
  }
  const materials = new Map();
  for (let gi = 0; gi < Math.max(before.Geosets?.length || 0, after.Geosets?.length || 0); gi++) {
    const ids = [before.Geosets?.[gi]?.MaterialID, after.Geosets?.[gi]?.MaterialID];
    materials.set(ids.join(':'), ids);
  }
  for (const ids of materials.values()) {
    for (let li = 0; li < Math.max(before.Materials?.[ids[0]]?.Layers?.length || 0, after.Materials?.[ids[1]]?.Layers?.length || 0); li++) pairs.push({
      path: `/Materials/${ids[0] ?? 'absent'}->${ids[1] ?? 'absent'}/Layers/${li}/Alpha`, kind: 'layer-alpha',
      sample: (a, frame, side) => {
        const layer = a.model.Materials?.[ids[side]]?.Layers?.[li];
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
    const [start, end] = b.interval, duration = end - start;
    const { frames, step: sampleStep } = animationFrames(b.interval, step);
    const perFrame = [], channelRows = channels.map(c => ({ path: c.path, kind: c.kind, max: 0, spans: [] }));
    const buffers = [a, b].map(side => comparable.map(i => [new Float32Array(side.model.Geosets[i].Vertices.length), new Float32Array(side.model.Geosets[i].Vertices.length)]));
    let previous, peakSpeed = 0, worst = { distance: 0, frame: start }, worstSpeed = { difference: 0, frame: start };
    let centre = { max: 0, frame: start, beforeTravel: 0, afterTravel: 0 }, firstCentres;
    const contact = { before: 0, after: 0 };
    for (let fi = 0; fi < frames.length; fi++) {
      const frame = frames[fi];
      const beforeFrame = a.interval[0] + (frame - start) * (duration ? (a.interval[1] - a.interval[0]) / duration : 0);
      const matrices = [sampleNodeMatrices(a.model, beforeFrame, a.sequence), sampleNodeMatrices(b.model, frame, b.sequence)];
      const centres = [[0, 0], [0, 0]], lowest = [Infinity, Infinity], visible = [];
      let max = 0, sum = 0, count = 0, speedDifference = 0, speed = 0;
      const poses = comparable.map((gi, index) => [a, b].map((side, si) => skinGeoset(side.model.Geosets[gi], matrices[si], buffers[si][index][fi % 2])));
      for (let g = 0; g < comparable.length; g++) {
        const gi = comparable[g], [x, y] = poses[g];
        if (sampleGeosetAnimation(a.model, gi, beforeFrame, a.sequence).alpha < .01 && sampleGeosetAnimation(b.model, gi, frame, b.sequence).alpha < .01) continue;
        visible.push(g);
        for (let v = 0; v < x.length; v += 3) {
          const distance = Math.hypot(x[v] - y[v], x[v + 1] - y[v + 1], x[v + 2] - y[v + 2]);
          max = Math.max(max, distance); sum += distance; count++;
          for (let si = 0; si < 2; si++) {
            const p = poses[g][si];
            centres[si][0] += p[v]; centres[si][1] += p[v + 1];
            lowest[si] = Math.min(lowest[si], p[v + 2]);
          }
          if (previous) {
            const dt = frame - previous.frame, beforeDt = beforeFrame - previous.beforeFrame || dt;
            const pa = previous.poses[g][0], pb = previous.poses[g][1];
            const ax = (x[v] - pa[v]) / beforeDt, ay = (x[v + 1] - pa[v + 1]) / beforeDt, az = (x[v + 2] - pa[v + 2]) / beforeDt;
            const bx = (y[v] - pb[v]) / dt, by = (y[v + 1] - pb[v + 1]) / dt, bz = (y[v + 2] - pb[v + 2]) / dt;
            speed = Math.max(speed, Math.hypot(ax, ay, az));
            speedDifference = Math.max(speedDifference, Math.hypot(ax - bx, ay - by, az - bz));
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
          let travel = 0, contacts = 0;
          for (const g of visible) {
            const p = poses[g][si], old = previous.poses[g][si];
            for (let v = 0; v < p.length; v += 3) if (p[v + 2] <= lowest[si] + 1e-4 && old[v + 2] <= previous.lowest[si] + 1e-4) {
              travel += Math.hypot(p[v] - old[v], p[v + 1] - old[v + 1]); contacts++;
            }
          }
          contact[si === 0 ? 'before' : 'after'] += contacts ? travel / contacts : 0;
        }
      }
      peakSpeed = Math.max(peakSpeed, speed);
      if (max > worst.distance) worst = { distance: max, frame };
      if (speedDifference > worstSpeed.difference) worstSpeed = { difference: speedDifference, frame };
      perFrame.push({ frame, beforeFrame, max, mean: count ? sum / count : 0, speedDifference, comparedVertices: count });
      channels.forEach((channel, ci) => {
        const av = channel.sample(a, beforeFrame, 0), bv = channel.sample(b, frame, 1), difference = channelDifference(av, bv), row = channelRows[ci];
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

const median = values => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b), middle = (sorted.length - 1) / 2;
  return (sorted[Math.floor(middle)] + sorted[Math.ceil(middle)]) / 2;
};
const sameVector = (a, b) => a?.length === b?.length && a != null && Array.from(a).every((v, i) => v === b[i]);
function constantCurve(track, keys, rotation) {
  if (!keys.length) return null;
  if (!keys.every(k => sameVector(k.Vector, keys[0].Vector))) return false;
  if (track.LineType < 2 || keys.length === 1) return true;
  return keys.slice(0, -1).every((key, i) => {
    const next = keys[i + 1];
    if (rotation || track.LineType === 3) return sameVector(key.OutTan, key.Vector) && sameVector(next.InTan, next.Vector);
    return key.OutTan != null && next.InTan != null && [...key.OutTan, ...next.InTan].every(v => v === 0);
  });
}
function nativePercentileRange(value, reference) {
  if (value == null || !reference) return null;
  // The study commits quantiles, not the raw distribution. A bracket is honest;
  // interpolating an exact rank from these summaries would invent evidence.
  const points = [['min', 0], ['p10', 10], ['p25', 25], ['median', 50], ['p75', 75], ['p90', 90], ['p95', 95], ['max', 100]];
  const lower = points.filter(([key]) => reference[key] < value).at(-1)?.[1] ?? 0;
  const upper = points.find(([key]) => reference[key] > value)?.[1] ?? 100;
  return [lower, upper];
}

/** Track bytes are encoded controller bytes (16-byte header, timestamp +
 * vectors/controls), not a prediction of total serialized file size. Native
 * density follows the study reproduction's median-per-clip definition exactly.
 * No recommendations, targets or pass/fail fields are derived from it.
 */
export function trackInventory(model) {
  const sequences = model.Sequences || [], tracks = [];
  visitTracks(model, (track, { property, path }) => {
    const global = isGlobalTrack(track, model), rotation = property === 'Rotation';
    const keys = track.Keys, components = keys[0]?.Vector?.length || 0;
    const perAnimation = global ? [] : sequences.map((s, sequence) => {
      const local = keys.filter(k => k.Frame >= s.Interval[0] && k.Frame <= s.Interval[1]);
      return { sequence, keys: local.length, constant: constantCurve(track, local, rotation) };
    });
    const cubicEqualControlSegments = rotation && track.LineType >= 2
      ? keys.slice(0, -1).filter((key, i) => {
        const next = keys[i + 1];
        const sameDomain = global || sequences.some(s => key.Frame >= s.Interval[0] && next.Frame <= s.Interval[1]);
        return sameDomain && sameVector(key.OutTan, key.Vector) && sameVector(next.InTan, next.Vector);
      }).length : 0;
    tracks.push({ path: '/' + path.join('/'), interpolation: track.LineType, globalSequence: global ? track.GlobalSeqId : null,
      keys: keys.length, bytes: 16 + keys.length * (4 + components * 4 * (track.LineType >= 2 ? 3 : 1)), components,
      keysOutsideAnimations: global ? 0 : keys.filter(k => !sequences.some(s => k.Frame >= s.Interval[0] && k.Frame <= s.Interval[1])).length,
      constantKeyValues: keys.length > 0 && keys.every(k => sameVector(k.Vector, keys[0].Vector)),
      constantWithinKeyedDomains: global ? constantCurve(track, keys, rotation) : perAnimation.filter(s => s.keys).every(s => s.constant),
      cubicEqualControlSegments, perAnimation,
      // The study used `global == null`, not the renderer's broader local rule.
      nativeStudyEligible: track.GlobalSeqId == null,
    });
  }, { skip: ['Nodes'] });
  const animations = sequences.map((s, sequence) => {
    const active = tracks.filter(t => t.perAnimation[sequence]?.keys > 0), nativeActive = active.filter(t => t.nativeStudyEligible);
    const kind = /^(stand|walk|attack|death|decay|birth|spell|morph|dissipate|portrait)(?:\b|\s)/i.exec(s.Name)?.[1]?.toLowerCase() || 'other';
    const studyMedian = median(nativeActive.map(t => t.perAnimation[sequence].keys));
    const reference = nativeStudy.blizzard.summary.sequenceKinds[kind]?.keysPerTrack;
    return { sequence, name: s.Name, kind, activeTracks: active.length,
      keys: active.reduce((n, t) => n + t.perAnimation[sequence].keys, 0),
      medianKeysPerTrack: median(active.map(t => t.perAnimation[sequence].keys)),
      nativeComparison: { medianKeysPerTrack: studyMedian, activeTracks: nativeActive.length,
        excludedExplicitLocalTracks: active.length - nativeActive.length,
        percentileRange: nativePercentileRange(studyMedian, reference), reference: reference || null } };
  });
  return { source: 'MDLxL track inventory; Blizzard AI-SD-STUDY-DATA.json',
    nativeDefinition: 'Distribution of each unit-family clip’s median key count across active tracks of all properties, by sequence kind. The reproduction skips Nodes aliases and includes only null/absent GlobalSeqId; explicit -1 is excluded from native comparison, while inventory uses playback semantics. Percentile ranges bracket committed quantiles; they are not targets.',
    tracks, animations, trackBytes: tracks.reduce((n, t) => n + t.bytes, 0), keysOutsideAnimations: tracks.reduce((n, t) => n + t.keysOutsideAnimations, 0) };
}
