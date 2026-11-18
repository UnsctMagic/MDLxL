// Motion senses for the AI, measured with MDLxL's own playback (animation.js): the style of an
// animation (keys, interpolation, speed curve, strike timing, holds) and the owner's animation checks
// (loop seam and end poses, planted feet, joint jumps and angle wraps, blended socket volume, event
// timing, motion warnings, untouched animations). Statistics only: never verdicts or gates.
import { Matrix3, Quaternion, Vector3 } from 'three';
import {
  allNodes, isGlobalTrack, nodePivot, sampleGeosetAnimation, sampleNodeMatrices, sampleTrack, skinGeoset,
  TRANSFORM_DEFAULTS, visitTracks,
} from './animation.js';
import { animXLFootfalls, animXLRig } from './anim-xl.js';
import { scanMotion } from './motion-inspector.js';
import { isTeamGlowLayer } from './texture-references.js';
import { vertexBoneWeights } from './part-bones.js';
import { nativePercentileRange } from './ai-motion-compare.js';
import nativeMotion from '../docs/AI-SD-MOTION-STYLE.json' with { type: 'json' };

const KINDS = /^(stand|walk|attack|death|decay|birth|spell|morph|dissipate|portrait)(?:\b|\s)/i;
/** The study's animation kind for a sequence name (stand, walk, attack ...), else 'other'. */
export const sequenceKind = name => KINDS.exec(String(name || ''))?.[1]?.toLowerCase() || 'other';
const PROPERTIES = ['Translation', 'Rotation', 'Scaling'];
const LINE_TYPES = ['none', 'linear', 'hermite', 'bezier'];
const round = (value, digits = 2) => value == null || !Number.isFinite(value) ? null : Number(value.toFixed(digits));
const share = (part, whole) => whole ? round(part / whole, 3) : null;
const percentOf = (ms, duration) => duration > 0 ? Math.round(ms / duration * 100) : 0;
function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b), middle = (sorted.length - 1) / 2;
  return (sorted[Math.floor(middle)] + sorted[Math.ceil(middle)]) / 2;
}
const degrees = (a, b) => {
  const dot = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]) /
    ((Math.hypot(...a) || 1) * (Math.hypot(...b) || 1));
  return 2 * Math.acos(Math.min(1, dot)) * 180 / Math.PI;
};
const distance = (a, b) => Math.hypot(...Array.from(a, (v, i) => v - b[i]));

/** One local animation: its interval, length, loop flag, MoveSpeed and kind. */
export function motionClip(model, sequence) {
  const s = model.Sequences?.[sequence];
  if (!Number.isInteger(sequence) || !s?.Interval) throw Error('Animation index is out of range.');
  const [start, end] = Array.from(s.Interval);
  return { sequence, name: s.Name, start, end, duration: end - start, looping: !s.NonLooping, moveSpeed: s.MoveSpeed || 0, kind: sequenceKind(s.Name) };
}
/** Times from start to end at a fixed step; the end is always included. */
export function clipTimes(start, end, step) {
  const times = [];
  for (let t = start; t < end - 1e-6; t += step) times.push(t);
  times.push(end);
  return times;
}
// The rig: bones and helpers (attachments, events and emitters only follow them).
const rigNodes = model => {
  const ids = new Set([...(model.Bones || []), ...(model.Helpers || [])].map(node => node.ObjectId));
  return allNodes(model).filter(node => ids.has(node.ObjectId));
};
// Geosets that show the body: not purely additive or team-glow effect planes.
function bodyGeosets(model) {
  return (model.Geosets || []).flatMap((geoset, i) => {
    const layers = model.Materials?.[geoset.MaterialID]?.Layers || [];
    const effect = layers.length && layers.every(layer => [3, 4].includes(layer.FilterMode) || isTeamGlowLayer(model, layer));
    return effect || !geoset.Vertices?.length ? [] : [i];
  });
}
const visibleAt = (model, gi, frame, sequence) => sampleGeosetAnimation(model, gi, frame, sequence).alpha >= .01;
const jointPositions = (model, nodes, matrices) =>
  nodes.map(node => new Vector3().fromArray(nodePivot(model, node)).applyMatrix4(matrices.get(node.ObjectId)));
const maxAxisDifference = (a, b) => {
  let max = 0, at = -1;
  a.forEach((p, i) => { const d = Math.max(Math.abs(p.x - b[i].x), Math.abs(p.y - b[i].y), Math.abs(p.z - b[i].z)); if (d > max) { max = d; at = i; } });
  return { max, at };
};

// Keys of a sorted track inside [start, end].
function keysIn(track, start, end) {
  const keys = track?.Keys || [];
  let lo = 0, hi = keys.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (keys[mid].Frame < start) lo = mid + 1; else hi = mid; }
  const out = [];
  for (let i = lo; i < keys.length && keys[i].Frame <= end; i++) out.push(keys[i]);
  return out;
}
function localTracks(model, c) {
  const tracks = [];
  for (const node of rigNodes(model)) for (const property of PROPERTIES) {
    const track = node[property];
    if (!track?.Keys || isGlobalTrack(track, model)) continue;
    const keys = keysIn(track, c.start, c.end);
    if (keys.length) tracks.push({ node, property, track, keys });
  }
  return tracks;
}

// Each keyed segment's sampled shape against straight linear interpolation (lerp, or slerp for
// rotation) at a quarter, half and three quarters: under 5% of the segment's own change counts as
// moving like linear. Steps (no interpolation) are counted separately.
function segmentShapes(model, tracks, size) {
  let linear = 0, curved = 0, stepped = 0, deviations = [];
  const half = new Quaternion(), qa = new Quaternion(), qb = new Quaternion();
  for (const { property, track, keys } of tracks) {
    const rotation = property === 'Rotation';
    for (let i = 1; i < keys.length; i++) {
      const a = keys[i - 1], b = keys[i], dt = b.Frame - a.Frame;
      if (!(dt > 0)) continue;
      const change = rotation ? degrees(a.Vector, b.Vector) : distance(a.Vector, b.Vector);
      if (change < (rotation ? .5 : property === 'Scaling' ? 1e-3 : Math.max(1e-4, size * 1e-3))) continue;
      if (track.LineType === 0) { stepped++; continue; }
      const segment = { LineType: track.LineType, Keys: [a, b] };
      let worst = 0;
      for (const u of [.25, .5, .75]) {
        const value = sampleTrack(segment, a.Frame + dt * u, { fallback: TRANSFORM_DEFAULTS[property], quaternion: rotation });
        let off;
        if (rotation) {
          qa.fromArray(a.Vector).normalize(); qb.fromArray(b.Vector).normalize();
          off = degrees(value, half.copy(qa).slerp(qb, u).toArray());
        } else off = distance(value, Array.from(a.Vector, (v, k) => v + (b.Vector[k] - v) * u));
        worst = Math.max(worst, off / change);
      }
      deviations.push(worst);
      if (worst < .05) linear++; else curved++;
    }
  }
  const moving = linear + curved + stepped;
  return { segments: moving, linear: share(linear, moving), curved: share(curved, moving), stepped: share(stepped, moving), medianDeviation: round(median(deviations), 3) };
}

function keyStats(model, c, tracks) {
  const gaps = [], counts = [], byType = [0, 0, 0, 0];
  let constant = 0;
  for (const { track, keys } of tracks) {
    counts.push(keys.length);
    byType[track.LineType] = (byType[track.LineType] || 0) + 1;
    for (let i = 1; i < keys.length; i++) gaps.push(keys[i].Frame - keys[i - 1].Frame);
    if (keys.every(k => Array.from(k.Vector).every((v, j) => v === keys[0].Vector[j]))) constant++;
  }
  gaps.sort((a, b) => a - b);
  return {
    keys: {
      tracks: tracks.length, total: counts.reduce((n, k) => n + k, 0), perTrack: { median: median(counts), max: counts.length ? Math.max(...counts) : 0 },
      spacingMs: gaps.length ? { min: gaps[0], median: median(gaps), max: gaps.at(-1) } : null, constantTracks: constant,
    },
    authored: Object.fromEntries(LINE_TYPES.map((name, i) => [name, share(byType[i], tracks.length)])),
  };
}

// Samples one clip at a fixed step: each rig node's world rotation, and between neighbouring samples
// the speed of the fastest part (mean of the top 1% of vertex speeds, at least three vertices) and of
// the whole body (mean vertex speed), in model units per second, over visible body geosets.
function poseSamples(model, c, step, geosets = bodyGeosets(model)) {
  const times = clipTimes(c.start, c.end, step), nodes = rigNodes(model);
  const buffers = geosets.map(gi => [new Float32Array(model.Geosets[gi].Vertices.length), new Float32Array(model.Geosets[gi].Vertices.length)]);
  const rotations = [], fast = [], body = [], mids = [], position = new Vector3(), scale = new Vector3();
  let previous = null;
  times.forEach((time, index) => {
    const matrices = sampleNodeMatrices(model, time, c.sequence);
    const poses = geosets.map((gi, k) => visibleAt(model, gi, time, c.sequence) ? skinGeoset(model.Geosets[gi], matrices, buffers[k][index % 2]) : null);
    rotations.push(nodes.map(node => { const q = new Quaternion(); matrices.get(node.ObjectId).decompose(position, q, scale); return q.toArray(); }));
    if (previous) {
      const dt = (time - previous.time) / 1000, speeds = [];
      poses.forEach((q, k) => {
        const p = previous.poses[k];
        if (!p || !q) return;
        for (let v = 0; v < p.length; v += 3) speeds.push(Math.hypot(q[v] - p[v], q[v + 1] - p[v + 1], q[v + 2] - p[v + 2]) / dt);
      });
      mids.push((previous.time + time) / 2);
      if (!speeds.length) { fast.push(0); body.push(0); }
      else {
        const sorted = Float64Array.from(speeds).sort(), top = Math.min(sorted.length, Math.max(3, Math.ceil(sorted.length * .01)));
        let sum = 0; for (let j = sorted.length - top; j < sorted.length; j++) sum += sorted[j];
        fast.push(sum / top);
        body.push(speeds.reduce((s, v) => s + v, 0) / speeds.length);
      }
    }
    previous = { time, poses };
  });
  return { times, nodes, rotations, fast, body, mids };
}
function restSize(model, c, geosets) {
  const matrices = sampleNodeMatrices(model, c.start, c.sequence), lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const gi of geosets) {
    if (!visibleAt(model, gi, c.start, c.sequence)) continue;
    const posed = skinGeoset(model.Geosets[gi], matrices);
    for (let v = 0; v < posed.length; v += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], posed[v + k]); hi[k] = Math.max(hi[k], posed[v + k]); }
  }
  return lo[0] === Infinity ? 1 : Math.max(1e-6, Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]));
}
// Peak, strike (fastest moment), wind-up before the strike burst, impact (the swing stops), holds.
function timing(curves, c) {
  const { fast, body, mids } = curves, at = ms => ({ ms: Math.round(ms - c.start), pct: percentOf(ms - c.start, c.duration) });
  if (!fast.length) return null;
  let peak = 0;
  fast.forEach((v, i) => { if (v > fast[peak]) peak = i; });
  const top = fast[peak];
  let burst = peak; while (burst > 0 && fast[burst - 1] >= top * .5) burst--;
  let stop = peak; while (stop < fast.length - 1 && fast[stop] >= top * .25) stop++;
  let wide = 0; fast.forEach((v, i) => { if (v >= top * .5) wide += (mids[i + 1] ?? c.end) - (mids[i - 1] ?? c.start); });
  const bodyPeak = Math.max(...body), still = body.map(v => v < bodyPeak * .1);
  const stepMs = mids.length > 1 ? mids[1] - mids[0] : c.duration;
  let held = 0, run = 0, longest = { fromMs: null, ms: 0 };
  still.forEach((s, i) => {
    if (s) { held += stepMs; run += stepMs; if (run > longest.ms) longest = { fromMs: Math.round(mids[i] - run + stepMs / 2 - c.start), ms: Math.round(run) }; }
    else run = 0;
  });
  const bins = 20, curve = Array.from({ length: bins }, (_, b) => {
    const from = c.start + c.duration * b / bins, to = c.start + c.duration * (b + 1) / bins;
    const inside = fast.filter((_, i) => mids[i] >= from && mids[i] <= to);
    return round((inside.length ? Math.max(...inside) : 0) / (top || 1), 2);
  });
  return {
    peak: round(top, 1), strike: at(mids[peak]), windUpMs: Math.round(mids[burst] - c.start),
    impact: fast[stop] < top * .25 ? at(mids[stop]) : null, strikeWidthMs: Math.round(wide / 2),
    holds: { share: share(held, c.duration), longest },
    curve,
  };
}

// Per bone: keys, spacing, authored interpolation, measured shape, peak angular speed and its timing.
function boneRows(model, c, tracks, sampled, nodeIds, size) {
  const { times, rotations } = sampled;
  const travel = sampled.nodes.map((node, n) => {
    let sum = 0, peak = 0, peakAt = c.start;
    for (let i = 1; i < times.length; i++) {
      const angle = degrees(rotations[i - 1][n], rotations[i][n]);
      sum += angle;
      const speed = angle * 1000 / (times[i] - times[i - 1]);
      if (speed > peak) { peak = speed; peakAt = (times[i - 1] + times[i]) / 2; }
    }
    return { node, sum, peak, peakAt };
  });
  // By default the eight keyed bones that turn the most (children without keys only inherit).
  const keyed = new Set(tracks.map(t => t.node));
  const chosen = nodeIds?.length ? travel.filter(t => nodeIds.includes(t.node.ObjectId))
    : travel.filter(t => keyed.has(t.node) && t.sum > .5).sort((a, b) => b.sum - a.sum).slice(0, 8);
  const columns = ['id', 'name', 'keys', 'spacingMs', 'authored', 'linear', 'travelDeg', 'peakDegPerS', 'peakPct'];
  const rows = chosen.map(({ node, sum, peak, peakAt }) => {
    const own = tracks.filter(t => t.node === node), keys = own.reduce((n, t) => n + t.keys.length, 0);
    const gaps = own.flatMap(t => t.keys.slice(1).map((k, i) => k.Frame - t.keys[i].Frame));
    const types = own.map(t => LINE_TYPES[t.track.LineType]);
    const shape = segmentShapes(model, own, size);
    return [node.ObjectId, node.Name, keys, median(gaps), [...new Set(types)].join('+') || null, shape.linear, Math.round(sum), Math.round(peak), percentOf(peakAt - c.start, c.duration)];
  });
  return { columns, rows };
}

/** Where a value sits among the Blizzard SD figures for this kind of animation: a percentile bracket
 * of the committed quantiles, never a target. */
function nativeBand(kind, values) {
  const reference = nativeMotion.kinds?.[kind];
  if (!reference) return null;
  const band = { kind, clips: reference.clips };
  for (const [metric, value] of Object.entries(values)) if (reference[metric] && value != null)
    band[metric] = { value, median: reference[metric].median, percentileRange: nativePercentileRange(value, reference[metric]) };
  return band;
}

/**
 * The style of one animation: keys and spacing, authored and measured interpolation, the speed curve
 * of the fastest part (20 bins of its peak), strike (fastest moment), wind-up, impact (the swing
 * stops), holds, per-bone rows, and where the clip sits among Blizzard SD clips of its kind.
 * step: sample spacing in ms (default 10; long clips are capped at 600 samples).
 */
export function motionStyle(model, sequence, { nodeIds, step } = {}) {
  const c = motionClip(model, sequence), geosets = bodyGeosets(model), size = restSize(model, c, geosets);
  if (nodeIds !== undefined && (!Array.isArray(nodeIds) || nodeIds.some(id => !Number.isInteger(id)))) throw Error('Invalid style bones.');
  if (step !== undefined && !(Number.isFinite(step) && step > 0)) throw Error('Style step must be a positive number of milliseconds.');
  const sampleStep = Math.max(step ?? 10, c.duration / 600, 1);
  const tracks = localTracks(model, c), { keys, authored } = keyStats(model, c, tracks);
  const shape = segmentShapes(model, tracks, size);
  const sampled = poseSamples(model, c, sampleStep, geosets), times = timing(sampled, c);
  const bones = boneRows(model, c, tracks, sampled, nodeIds, size);
  const style = {
    sequence, name: c.name, kind: c.kind, durationMs: c.duration, looping: c.looping, moveSpeed: c.moveSpeed,
    sampleStepMs: round(sampleStep, 1), size: round(size, 1),
    keys, interpolation: { authored, measured: shape },
    speed: times && { peak: times.peak, peakSizesPerSecond: round(times.peak / size, 2), curve: times.curve },
    strike: times?.strike ?? null, windUpMs: times?.windUpMs ?? null, impact: times?.impact ?? null,
    strikeWidthMs: times?.strikeWidthMs ?? null, holds: times?.holds ?? null,
    bones,
  };
  style.native = nativeBand(c.kind, {
    durationMs: c.duration, keysPerTrack: keys.perTrack.median, spacingMs: keys.spacingMs?.median ?? null,
    linear: shape.linear, strikePct: style.strike?.pct ?? null, impactPct: style.impact?.pct ?? null, holdShare: style.holds?.share ?? null,
  });
  return style;
}

function correlation(a, b) {
  const n = Math.min(a.length, b.length);
  if (n < 2) return null;
  const ma = a.slice(0, n).reduce((s, v) => s + v, 0) / n, mb = b.slice(0, n).reduce((s, v) => s + v, 0) / n;
  let ab = 0, aa = 0, bb = 0;
  for (let i = 0; i < n; i++) { ab += (a[i] - ma) * (b[i] - mb); aa += (a[i] - ma) ** 2; bb += (b[i] - mb) ** 2; }
  return aa && bb ? round(ab / Math.sqrt(aa * bb), 2) : null;
}
const percent = value => value == null ? 'n/a' : Math.round(value * 100) + '%';
const dominant = authored => Object.entries(authored).filter(([, v]) => v).sort((a, b) => b[1] - a[1])[0] || ['none', 0];

/**
 * The style of an animation beside a donor's (another model, or another animation of the same
 * model), with plain differences such as "strike at 61% vs donor 38%". Animations line up by
 * fraction of their length, so different durations compare phase by phase.
 */
export function compareStyle(model, sequence, donor, donorSequence, options = {}) {
  const mine = motionStyle(model, sequence, options), theirs = motionStyle(donor, donorSequence, { step: options.step });
  const lines = [];
  const add = (label, a, b, unit = '') => lines.push(`${label} ${a ?? 'n/a'}${a != null ? unit : ''} vs donor ${b ?? 'n/a'}${b != null ? unit : ''}`);
  add('length', mine.durationMs, theirs.durationMs, ' ms');
  add('keys per track (median)', mine.keys.perTrack.median, theirs.keys.perTrack.median);
  add('key spacing (median)', mine.keys.spacingMs?.median, theirs.keys.spacingMs?.median, ' ms');
  lines.push(`moves like linear between keys ${percent(mine.interpolation.measured.linear)} vs donor ${percent(theirs.interpolation.measured.linear)}`);
  const [myType, myShare] = dominant(mine.interpolation.authored), [theirType, theirShare] = dominant(theirs.interpolation.authored);
  lines.push(`authored ${percent(myShare)} ${myType} vs donor ${percent(theirShare)} ${theirType}`);
  add('strike (fastest moment) at', mine.strike?.pct, theirs.strike?.pct, '%');
  add('impact (swing stops) at', mine.impact?.pct, theirs.impact?.pct, '%');
  add('wind-up before the strike', mine.windUpMs, theirs.windUpMs, ' ms');
  lines.push(`held still ${percent(mine.holds?.share)} vs donor ${percent(theirs.holds?.share)}`);
  const ratio = mine.speed && theirs.speed?.peakSizesPerSecond ? round(mine.speed.peakSizesPerSecond / theirs.speed.peakSizesPerSecond, 2) : null;
  if (ratio != null) lines.push(`peak speed ${ratio}x the donor's (relative to body size)`);
  const shapeMatch = correlation(mine.speed?.curve || [], theirs.speed?.curve || []);
  if (shapeMatch != null) lines.push(`speed curve correlation ${shapeMatch} (1 = same rhythm)`);
  return { differences: lines, model: mine, donor: theirs };
}

// ---- The owner's animation checks -------------------------------------------------------------

/** The pose other animations blend from: Stand Ready, else the first Stand, else animation 0. */
export function referenceSequence(model) {
  const names = (model.Sequences || []).map(s => String(s.Name || '').toLowerCase());
  const ready = names.findIndex(n => /^stand\s*-?\s*ready/.test(n));
  if (ready >= 0) return ready;
  const stand = names.findIndex(n => /^stand\b/.test(n) && !/portrait|victory|work|channel|hit|alternate/.test(n));
  return stand >= 0 ? stand : names.length ? 0 : -1;
}

// Feet that reach the ground (a rider's feet in stirrups do not), sampled every 8 ms. A foot is planted
// within 1 unit of its lowest point (the owner's check; walks: within 15% of its lift, since the ankle
// rolls). Slide is its horizontal travel while planted; for animations with a MoveSpeed,
// slideAtMoveSpeed measures it against ground moving back at that speed (+X is forward).
function feetCheck(model, c, rig) {
  if (!rig.feet.length) return { rows: [], maxSlide: null };
  const byId = new Map(allNodes(model).map(n => [n.ObjectId, n])), times = clipTimes(c.start, c.end, 8);
  const tracks = rig.feet.map(() => []);
  for (const time of times) {
    const matrices = sampleNodeMatrices(model, time, c.sequence);
    rig.feet.forEach((id, k) => tracks[k].push(new Vector3().fromArray(nodePivot(model, byId.get(id))).applyMatrix4(matrices.get(id))));
  }
  const lows = tracks.map(t => Math.min(...t.map(p => p.z))), ground = Math.min(...lows);
  const rows = [];
  rig.feet.forEach((id, k) => {
    if (lows[k] > ground + Math.max(4, rig.legLength * .25)) return;
    const path = tracks[k], start = path[0], range = Math.max(...path.map(p => p.z)) - lows[k];
    const planted = p => p.z - lows[k] < (c.moveSpeed > 0 ? Math.max(1, range * .15) : 1);
    let move = 0, slide = 0, slideMoving = 0, grounded = 0;
    path.forEach((p, i) => {
      move = Math.max(move, Math.hypot(p.x - start.x, p.y - start.y));
      if (!planted(p)) return;
      grounded++;
      if (!i || !planted(path[i - 1])) return;
      const q = path[i - 1], dt = (times[i] - times[i - 1]) / 1000;
      slide += Math.hypot(p.x - q.x, p.y - q.y);
      slideMoving += Math.hypot(p.x - q.x + c.moveSpeed * dt, p.y - q.y);
    });
    rows.push({ id, name: byId.get(id)?.Name, move: round(move, 1), lift: round(range, 1), slide: round(slide, 2),
      ...(c.moveSpeed > 0 ? { slideAtMoveSpeed: round(slideMoving, 2) } : {}), planted: share(grounded, path.length) });
  });
  const key = c.moveSpeed > 0 ? 'slideAtMoveSpeed' : 'slide';
  return { rows, maxSlide: rows.length ? Math.max(...rows.map(r => r[key])) : null, measured: key };
}

// Joint positions and world rotations every 33 ms: the largest joint jump (model units, the owner's
// check), and the three bones that turn the most in one step (degrees; a snap, jitter or an angle
// wrap shows up here, including at the animation's ends).
function jumpCheck(model, c, nodes) {
  let previous = null, jump = { value: 0, node: null, atMs: null };
  const turns = new Map(), position = new Vector3(), scale = new Vector3();
  // Turns are listed for bones keyed in this clip; their children only inherit the same turn.
  const keyed = new Set(localTracks(model, c).map(t => t.node));
  for (const time of clipTimes(c.start, c.end, 33)) {
    const matrices = sampleNodeMatrices(model, time, c.sequence), joints = jointPositions(model, nodes, matrices);
    const rotations = nodes.map(node => { const q = new Quaternion(); matrices.get(node.ObjectId).decompose(position, q, scale); return q.toArray(); });
    if (previous) nodes.forEach((node, i) => {
      const moved = joints[i].distanceTo(previous.joints[i]);
      if (moved > jump.value) jump = { value: moved, node: node.Name, atMs: Math.round(time - c.start) };
      const turn = degrees(rotations[i], previous.rotations[i]);
      if (keyed.has(node) && turn > (turns.get(node)?.deg ?? 0)) turns.set(node, { deg: turn, atMs: Math.round(time - c.start) });
    });
    previous = { joints, rotations };
  }
  return { jump: { ...jump, value: round(jump.value, 2) },
    turns: [...turns].sort((a, b) => b[1].deg - a[1].deg).slice(0, 3).map(([node, t]) => ({ node: node.Name, deg: round(t.deg, 1), atMs: t.atMs })) };
}

// Blended vertices (a matrix group of two or more bones, or HD weights over several bones) keep their
// volume while their bones turn together. Volume is |det(mean of the bones' 3x3 world matrices)|^(1/3)
// (the owner's check): 1 when the bones agree, smaller as they twist apart; his warriors' own attacks
// reach about 0.34-0.54 at the shoulder socket.
export function blendGroups(model, geosets = bodyGeosets(model)) {
  const groups = new Map(), names = new Map(allNodes(model).map(n => [n.ObjectId, n.Name]));
  for (const gi of geosets) {
    const geoset = model.Geosets[gi];
    for (let v = 0; v < geoset.Vertices.length / 3; v++) {
      const weights = vertexBoneWeights(geoset, v).filter(([id]) => names.has(id));
      if (weights.length < 2) continue;
      const key = weights.map(([id]) => id).sort((a, b) => a - b).join(',');
      const group = groups.get(key) || { bones: weights.map(([id]) => id), sums: new Map(), vertices: 0,
        label: weights.map(([id]) => String(names.get(id)).replace(/^Bone_/i, '')).join('+') };
      for (const [id, w] of weights) group.sums.set(id, (group.sums.get(id) || 0) + w);
      group.vertices++;
      groups.set(key, group);
    }
  }
  return [...groups.values()].map(({ sums, ...group }) => ({ ...group, weights: group.bones.map(id => [id, sums.get(id) / group.vertices]) }));
}
const linear3 = new Matrix3();
export function blendVolume(group, matrices) {
  const sum = new Array(9).fill(0);
  let total = 0;
  for (const [id, w] of group.weights) {
    const m = matrices.get(id)?.elements;
    if (!m) continue;
    const parts = [m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]];
    for (let k = 0; k < 9; k++) sum[k] += parts[k] * w;
    total += w;
  }
  if (!total) return 1;
  linear3.fromArray(sum.map(v => v / total));
  return Math.cbrt(Math.abs(linear3.determinant()));
}
// Each group's lowest volume over one animation, sampled every 33 ms.
function socketLows(model, c, groups) {
  const lowest = groups.map(() => ({ value: Infinity, atMs: null }));
  for (const time of clipTimes(c.start, c.end, 33)) {
    const matrices = sampleNodeMatrices(model, time, c.sequence);
    groups.forEach((group, i) => { const v = blendVolume(group, matrices); if (v < lowest[i].value) lowest[i] = { value: v, atMs: Math.round(time - c.start) }; });
  }
  return lowest;
}
// Kinds whose clips return to the ready pose and whose sockets show the model's own normal range.
const RETURNING = new Set(['stand', 'walk', 'attack', 'spell', 'other']);

// Event objects (SND sound, FPT footprint, SPL splat, SPN spawn, UBR ubersplat) inside the clip,
// with the nearest footfall for footprints and the strike for the rest.
function eventCheck(model, c, footfalls, strike) {
  const rows = [];
  for (const event of model.EventObjects || []) for (const time of Array.from(event.EventTrack || [])) {
    if (time < c.start || time > c.end) continue;
    const row = { name: event.Name, atMs: time - c.start, pct: percentOf(time - c.start, c.duration) };
    if (/^FPT/i.test(event.Name) && footfalls.length) {
      const near = footfalls.reduce((best, f) => Math.abs(f - time) < Math.abs(best - time) ? f : best);
      row.footfallOffsetMs = Math.round(near - time);
    } else if (strike) row.strikeOffsetMs = Math.round(c.start + strike.ms - time);
    rows.push(row);
  }
  return rows.sort((a, b) => a.atMs - b.atMs);
}

/**
 * The owner's animation checks for each listed animation (default all), informational only:
 * - seam (looping): largest joint position difference between the first and last frame (0.00 expected)
 *   and the largest bone turn between them;
 * - ends (attacks, spells and other clips that return): first and last frame against the reference
 *   pose (Stand Ready, else Stand), 0.00 when the animation blends cleanly;
 * - feet: planted-foot slide per foot (the owner's limit is 0.5), hooves for mounts;
 * - jump and turns: largest joint jump and bone turns per 33 ms (snaps, jitter, angle wraps);
 * - sockets: the four most collapsed blended vertex groups, with their value at the reference pose
 *   and the lowest the model's own other animations reach;
 * - events against footfalls and the strike; motion warnings (the timeline's amber marks).
 */
export function motionChecks(model, { sequences, reference = referenceSequence(model), warnings = true } = {}) {
  const list = sequences ?? (model.Sequences || []).map((_, i) => i);
  if (!Array.isArray(list) || list.some(i => !Number.isInteger(i) || !model.Sequences?.[i])) throw Error('Invalid animation list.');
  if (reference !== -1 && (!Number.isInteger(reference) || !model.Sequences?.[reference])) throw Error('Invalid reference animation.');
  const nodes = rigNodes(model), groups = blendGroups(model);
  const ref = reference >= 0 ? motionClip(model, reference) : null;
  const refMatrices = ref ? sampleNodeMatrices(model, ref.start, ref.sequence) : null;
  const refJoints = refMatrices ? jointPositions(model, nodes, refMatrices) : null;
  const ready = refMatrices ? groups.map(group => blendVolume(group, refMatrices)) : null;
  // The model's own range: every returning animation's lowest socket volumes.
  const own = new Map();
  (model.Sequences || []).forEach((s, i) => { if (s?.Interval && RETURNING.has(sequenceKind(s.Name))) own.set(i, socketLows(model, motionClip(model, i), groups)); });
  const position = new Vector3(), scale = new Vector3();
  const rotationsAt = matrices => nodes.map(node => { const q = new Quaternion(); matrices.get(node.ObjectId).decompose(position, q, scale); return q.toArray(); });
  const rows = list.map(sequence => {
    const c = motionClip(model, sequence);
    const first = sampleNodeMatrices(model, c.start, sequence), last = sampleNodeMatrices(model, c.end, sequence);
    const a = jointPositions(model, nodes, first), b = jointPositions(model, nodes, last);
    const row = { sequence, name: c.name, durationMs: c.duration, looping: c.looping };
    if (c.looping) {
      const seam = maxAxisDifference(a, b), ra = rotationsAt(first), rb = rotationsAt(last);
      const turn = nodes.reduce((best, node, i) => { const d = degrees(ra[i], rb[i]); return d > best.deg ? { deg: d, node: node.Name } : best; }, { deg: 0, node: null });
      row.seam = { max: round(seam.max, 2), node: seam.at >= 0 ? nodes[seam.at].Name : null, turnDeg: round(turn.deg, 1), turnNode: turn.node };
    } else if (refJoints && sequence !== reference && ['attack', 'spell', 'other', 'stand'].includes(c.kind))
      row.ends = { reference: ref.name, start: round(maxAxisDifference(a, refJoints).max, 2), end: round(maxAxisDifference(b, refJoints).max, 2) };
    let rig = { feet: [], legLength: 0 };
    try { rig = animXLRig(model, sequence); } catch { /* unusual rigs have no feet */ }
    row.feet = feetCheck(model, c, rig);
    Object.assign(row, jumpCheck(model, c, nodes));
    if (groups.length) {
      const lows = own.get(sequence) || socketLows(model, c, groups);
      row.sockets = groups.map((group, i) => {
        const others = [...own].filter(([s]) => s !== sequence).map(([, values]) => values[i].value);
        const ownLowest = others.length ? Math.min(...others) : null;
        return { group: group.label, vertices: group.vertices, lowest: round(lows[i].value, 2), atMs: lows[i].atMs,
          ready: ready ? round(ready[i], 2) : null, ownLowest: round(ownLowest, 2), score: lows[i].value / (ownLowest || ready?.[i] || 1) };
      }).sort((x, y) => x.score - y.score).slice(0, 4).map(({ score, ...rest }) => rest);
    }
    let footfalls = [];
    try { footfalls = rig.feet.length ? animXLFootfalls(model, sequence, rig) : []; } catch { /* no footfalls */ }
    const strike = timing(poseSamples(model, c, Math.max(10, c.duration / 300)), c)?.strike;
    row.events = eventCheck(model, c, footfalls, strike);
    if (warnings) {
      try {
        const scan = scanMotion(model, { sequenceIndex: sequence, maxWorldSamples: 6000, maxFindings: 50 });
        row.warnings = { count: scan.findings.length, top: scan.findings.slice(0, 3).map(f => ({ node: f.nodeName, property: f.property, kind: f.kind, atMs: Math.round(f.time - c.start), evidence: f.evidence })) };
      } catch { row.warnings = null; }
    }
    return row;
  });
  return { reference: ref?.name ?? null, units: 'model units; times in ms from the animation start', animations: rows };
}

// ---- Untouched animations ---------------------------------------------------------------------

const sameNumbers = (a, b) => a === b || (a != null && b != null && a.length === b.length && Array.from(a).every((v, i) => Object.is(v, b[i])));
function keyedTracks(model) {
  const tracks = new Map();
  visitTracks(model, (track, { path }) => tracks.set('/' + path.join('/'), track), { skip: ['Nodes'] });
  return tracks;
}
const named = name => String(name || '').trim().toLowerCase();

/**
 * Which animations differ between a saved version (before) and the model (after): per animation,
 * whether every key inside it is byte-identical (frames relative to the start, values, tangents,
 * interpolation), how many tracks differ, and the largest bone matrix difference at 15 evenly
 * spaced times (the owner's check; 0 means untouched). Animations match by name.
 */
export function sequenceChanges(before, after, { posed = true, paths: keepPaths = false } = {}) {
  const old = keyedTracks(before), now = keyedTracks(after), paths = [...new Set([...old.keys(), ...now.keys()])];
  const nodesBefore = new Map(allNodes(before).map(n => [n.ObjectId, n])), nodesAfter = allNodes(after);
  const rows = [], matched = new Set();
  (after.Sequences || []).forEach((s, i) => {
    const j = (before.Sequences || []).findIndex((o, k) => !matched.has(k) && named(o.Name) === named(s.Name));
    if (j < 0) { rows.push({ name: s.Name, sequence: i, added: true }); return; }
    matched.add(j);
    const o = before.Sequences[j], [as, ae] = Array.from(s.Interval), [bs, be] = Array.from(o.Interval);
    const differing = [];
    for (const path of paths) {
      const a = old.get(path), b = now.get(path);
      if ((a && isGlobalTrack(a, before)) || (b && isGlobalTrack(b, after))) continue;
      const ka = a ? keysIn(a, bs, be) : [], kb = b ? keysIn(b, as, ae) : [];
      if (!ka.length && !kb.length) continue;
      const same = ka.length === kb.length && (a?.LineType === b?.LineType || !ka.length) && ka.every((k, n) => {
        const m = kb[n];
        return k.Frame - bs === m.Frame - as && sameNumbers(k.Vector, m.Vector) && sameNumbers(k.InTan, m.InTan) && sameNumbers(k.OutTan, m.OutTan);
      });
      if (!same) differing.push(path);
    }
    const row = { name: s.Name, sequence: i, baselineSequence: j, keysIdentical: !differing.length && as - ae === bs - be, tracksChanged: differing.length,
      ...(differing.length ? { examples: differing.slice(0, 4) } : {}), ...(keepPaths ? { paths: differing } : {}) };
    if (posed) {
      let max = 0;
      for (let n = 0; n < 15; n++) {
        const u = n / 14, ma = sampleNodeMatrices(before, bs + (be - bs) * u, j), mb = sampleNodeMatrices(after, as + (ae - as) * u, i);
        for (const node of nodesAfter) {
          if (!nodesBefore.has(node.ObjectId)) continue;
          const x = ma.get(node.ObjectId)?.elements, y = mb.get(node.ObjectId)?.elements;
          if (x && y) for (let k = 0; k < 16; k++) max = Math.max(max, Math.abs(x[k] - y[k]));
        }
      }
      row.maxDifference = Number(max.toPrecision(3));
    }
    rows.push(row);
  });
  (before.Sequences || []).forEach((s, k) => { if (!matched.has(k)) rows.push({ name: s.Name, removed: true }); });
  let globalTracks = 0;
  for (const path of paths) {
    const a = old.get(path), b = now.get(path);
    if (!(a && isGlobalTrack(a, before)) && !(b && isGlobalTrack(b, after))) continue;
    if (JSON.stringify(a?.Keys?.map(k => [k.Frame, Array.from(k.Vector || []), Array.from(k.InTan || []), Array.from(k.OutTan || [])])) !==
      JSON.stringify(b?.Keys?.map(k => [k.Frame, Array.from(k.Vector || []), Array.from(k.InTan || []), Array.from(k.OutTan || [])])) || a?.LineType !== b?.LineType) globalTracks++;
  }
  return {
    changed: rows.filter(r => r.added || r.removed || r.keysIdentical === false || r.maxDifference > 0).map(r => r.name),
    identical: rows.filter(r => r.keysIdentical && !(r.maxDifference > 0)).length,
    globalTracksChanged: globalTracks,
    animations: rows,
  };
}

/**
 * After an edit: the animations whose keys changed, and the motion warnings in them that the edit
 * added (same bone, channel and kind not warned before). Null when no animation data changed.
 */
// The ObjectId of the node owning a track path such as /Bones/3/Rotation, else null.
function trackNode(model, path) {
  const [collection, index] = path.split('/').slice(1);
  const node = model[collection]?.[Number(index)];
  return Number.isInteger(node?.ObjectId) && PROPERTIES.includes(path.split('/')[3]) ? node.ObjectId : null;
}

/**
 * After an edit: the animations whose keys changed, how many stayed byte-identical, and the motion
 * warnings the edit added on the bones it changed (same bone, channel and kind not warned before).
 * Null when no animation data changed. Informational only.
 */
export function animationEditReport(before, after) {
  const changes = sequenceChanges(before, after, { posed: false, paths: true });
  const edited = changes.animations.filter(r => r.keysIdentical === false || r.added);
  if (!edited.length && !changes.globalTracksChanged) return null;
  const warnings = [];
  for (const row of edited.slice(0, 6)) {
    const nodeIds = [...new Set((row.paths || []).map(path => trackNode(after, path)).filter(id => id != null))];
    if (row.added || !nodeIds.length) continue;
    try {
      const scan = (model, index) => scanMotion(model, { sequenceIndex: index, nodeIds, maxWorldSamples: 4000, maxFindings: 60 }).findings;
      const key = f => `${f.nodeName}|${f.property}|${f.kind}`, seen = new Set(scan(before, row.baselineSequence).map(key));
      const start = after.Sequences[row.sequence].Interval[0], fresh = scan(after, row.sequence).filter(f => !seen.has(key(f)));
      if (fresh.length) warnings.push({ animation: row.name, count: fresh.length,
        top: fresh.slice(0, 3).map(f => ({ node: f.nodeName, property: f.property, kind: f.kind, atMs: Math.round(f.time - start), evidence: f.evidence })) });
    } catch { /* warnings are informational */ }
  }
  return { changed: edited.map(r => r.name), unchanged: changes.identical,
    ...(changes.globalTracksChanged ? { globalTracksChanged: changes.globalTracksChanged } : {}), newWarnings: warnings };
}
