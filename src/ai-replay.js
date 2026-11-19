// AI work replay (View AI work): one finished AI edit as a short animation from the old
// model to the new one. This file only plans and times it; the views draw it
// (app/ai-replay.js, app/ai-replay-stage.js). The model is already final when a replay
// starts: nothing here changes model data.
import { allNodes } from './animation.js';

export const REPLAY_MIN_MS = 500, REPLAY_MAX_MS = 1000;
const MAX_KEY_FRAMES = 160, MAX_BONES = 48, MAX_TRAILS = 96, MAX_GLOW_TRIANGLES = 2400;

const clamp01 = value => Math.min(1, Math.max(0, value));
export const easeInOut = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = t => 1 - Math.pow(1 - t, 3);

function same(a, b) {
  if (a === b) return true;
  if (a == null || b == null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (ArrayBuffer.isView(a) || ArrayBuffer.isView(b)) {
    if (!ArrayBuffer.isView(a) || !ArrayBuffer.isView(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  for (const key of keys) if (!same(a[key], b[key])) return false;
  return true;
}

function hashNumbers(list, seed) {
  let hash = seed >>> 0;
  if (!list) return hash;
  for (let i = 0; i < list.length; i++) hash = Math.imul(hash ^ (list[i] * 4096 | 0), 16777619) >>> 0;
  return hash;
}
const shapeKey = geoset => `${geoset.Vertices?.length || 0}:${geoset.Faces?.length || 0}:${hashNumbers(geoset.Vertices, 2166136261)}:${hashNumbers(geoset.Faces, 7)}`;

// Which old geoset became which new one. Geosets whose shape did not change anchor the
// match (so inserting or removing one does not shift the rest); what lies between two
// anchors pairs up in order, and the remainder was added or removed.
export function matchGeosets(before = [], after = []) {
  const a = before.map(shapeKey), b = after.map(shapeKey), n = a.length, m = b.length;
  const table = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--) table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
  const pairs = [], added = [], removed = [];
  let i = 0, j = 0, runA = [], runB = [];
  const flush = () => {
    const shared = Math.min(runA.length, runB.length);
    for (let k = 0; k < shared; k++) pairs.push([runA[k], runB[k], true]);
    removed.push(...runA.slice(shared));
    added.push(...runB.slice(shared));
    runA = [];
    runB = [];
  };
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) {
      flush();
      pairs.push([i++, j++, false]);
    } else if (j >= m || (i < n && table[i + 1][j] >= table[i][j + 1])) runA.push(i++);
    else runB.push(j++);
  }
  flush();
  return { pairs, added, removed };
}

export function centerOf(vertices, ids) {
  let x = 0, y = 0, z = 0, count = 0;
  const add = i => {
    x += vertices[i * 3];
    y += vertices[i * 3 + 1];
    z += vertices[i * 3 + 2];
    count++;
  };
  if (ids) for (const id of ids) add(id);
  else for (let i = 0; i < vertices.length / 3; i++) add(i);
  return count ? [x / count, y / count, z / count] : [0, 0, 0];
}
function sizeOf(vertices) {
  if (!vertices?.length) return 0;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < vertices.length; i++) {
    const axis = i % 3;
    if (vertices[i] < min[axis]) min[axis] = vertices[i];
    if (vertices[i] > max[axis]) max[axis] = vertices[i];
  }
  return Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
}
const spread = (list, limit) => {
  const step = Math.max(1, Math.ceil(list.length / limit));
  return list.filter((_, index) => index % step === 0);
};
// The triangles to light for a changed part, thinned on heavy meshes.
function glowFaces(faces, touched) {
  const out = [];
  for (let i = 0; i + 2 < faces.length; i += 3)
    if (!touched || touched.has(faces[i]) || touched.has(faces[i + 1]) || touched.has(faces[i + 2])) out.push(faces[i], faces[i + 1], faces[i + 2]);
  const triangles = out.length / 3;
  if (triangles <= MAX_GLOW_TRIANGLES) return Uint32Array.from(out);
  const step = Math.ceil(triangles / MAX_GLOW_TRIANGLES), thin = [];
  for (let t = 0; t < triangles; t += step) thin.push(out[t * 3], out[t * 3 + 1], out[t * 3 + 2]);
  return Uint32Array.from(thin);
}

// Every animation track under `after` whose keys differ from `before`: { frames, global }.
function changedKeys(before, after, out = { frames: new Set(), global: false, any: false }) {
  if (after === before || after == null || typeof after !== 'object' || ArrayBuffer.isView(after)) return out;
  if (Array.isArray(after.Keys)) {
    const old = before?.Keys;
    if (same(old, after.Keys) && before?.LineType === after.LineType && before?.GlobalSeqId === after.GlobalSeqId) return out;
    out.any = true;
    if (after.GlobalSeqId != null) out.global = true;
    const prior = new Map((Array.isArray(old) ? old : []).map(key => [key.Frame, key]));
    for (const key of after.Keys) {
      if (!same(prior.get(key.Frame), key)) out.frames.add(key.Frame);
      prior.delete(key.Frame);
    }
    // A removed key changes the motion around its frame too.
    for (const frame of prior.keys()) out.frames.add(frame);
    return out;
  }
  for (const key of Object.keys(after)) changedKeys(before?.[key], after[key], out);
  return out;
}
const withoutTracks = value =>
  value && typeof value === 'object' && !ArrayBuffer.isView(value)
    ? Array.isArray(value)
      ? value.map(withoutTracks)
      : Array.isArray(value.Keys)
        ? null
        : Object.fromEntries(Object.entries(value).map(([key, item]) => [key, withoutTracks(item)]))
    : value;

const EMITTER_COLLECTIONS = ['ParticleEmitters', 'ParticleEmitters2', 'RibbonEmitters', 'ParticleEmittersPopcorn'];
function emitterIds(model) {
  const ids = new Set();
  for (const key of EMITTER_COLLECTIONS) for (const node of model?.[key] || []) if (Number.isInteger(node?.ObjectId)) ids.add(node.ObjectId);
  return ids;
}
const pivotOf = node => (node?.PivotPoint ? Array.from(node.PivotPoint).slice(0, 3) : [0, 0, 0]);
const normalPath = path => String(path || '').replace(/\\/g, '/').toLowerCase();

// The replay of one edit, or null when the edit changed nothing a view can show.
// options.assets: texture paths whose pixels the edit replaced; options.sequence: the
// animation on screen (the changed span plays inside it).
export function planReplay(before, after, { assets = [], sequence = -1 } = {}) {
  if (!before || !after) return null;
  const glides = [], grows = [], uvs = [], ghosts = [], glow = new Map(), focusAt = [];
  let travel = 0, remeshed = false;
  const light = (geoset, faces) => {
    if (!glow.has(geoset) || faces === null) glow.set(geoset, faces);
  };
  const match = matchGeosets(before.Geosets, after.Geosets);
  for (const [bi, ai, changedShape] of match.pairs) {
    const old = before.Geosets[bi], now = after.Geosets[ai];
    if (changedShape) {
      if (old.Vertices.length === now.Vertices.length) {
        const moved = [];
        let far = 0;
        for (let v = 0; v < now.Vertices.length / 3; v++) {
          const dx = now.Vertices[v * 3] - old.Vertices[v * 3], dy = now.Vertices[v * 3 + 1] - old.Vertices[v * 3 + 1], dz = now.Vertices[v * 3 + 2] - old.Vertices[v * 3 + 2];
          if (dx || dy || dz) {
            moved.push(v);
            far = Math.max(far, Math.hypot(dx, dy, dz));
          }
        }
        if (moved.length) {
          glides.push({ geoset: ai, from: Float32Array.from(old.Vertices), to: Float32Array.from(now.Vertices), trails: Uint32Array.from(spread(moved, MAX_TRAILS)) });
          travel = Math.max(travel, far);
          light(ai, glowFaces(now.Faces, new Set(moved)));
          focusAt.push({ weight: 4, point: centerOf(now.Vertices, moved) });
        }
        // Same points, different triangles: the old surface fades into the new one.
        if (!same(old.Faces, now.Faces)) {
          remeshed = true;
          light(ai, glowFaces(now.Faces));
          if (!moved.length) focusAt.push({ weight: 2, point: centerOf(now.Vertices) });
        }
      } else {
        const oldCenter = centerOf(old.Vertices), newCenter = centerOf(now.Vertices), oldSize = sizeOf(old.Vertices), newSize = sizeOf(now.Vertices);
        const sameSpot = Math.hypot(oldCenter[0] - newCenter[0], oldCenter[1] - newCenter[1], oldCenter[2] - newCenter[2]) < .15 * Math.max(oldSize, newSize, 1e-6);
        const sameSize = newSize > 0 && oldSize / newSize > .8 && oldSize / newSize < 1.25;
        const ratio = old.Vertices.length / Math.max(1, now.Vertices.length);
        if (sameSpot && sameSize && ratio > .7 && ratio < 1.43) {
          // Reworked in place (cut, weld, a few new points): a crossfade, not a rebuild.
          remeshed = true;
        } else {
          // Replaced by a different shape: the old one shrinks away, the new one grows in.
          ghosts.push({ vertices: Float32Array.from(old.Vertices), faces: glowFaces(old.Faces), center: oldCenter });
          grows.push({ geoset: ai, to: Float32Array.from(now.Vertices), center: newCenter });
        }
        light(ai, glowFaces(now.Faces));
        focusAt.push({ weight: 3, point: newCenter });
      }
    }
    if (old.Vertices.length === now.Vertices.length && !same(old.TVertices, now.TVertices) && old.TVertices?.length === now.TVertices?.length) {
      uvs.push({ geoset: ai, from: old.TVertices.map(uv => Float32Array.from(uv)), to: now.TVertices.map(uv => Float32Array.from(uv)) });
      light(ai, glowFaces(now.Faces));
      focusAt.push({ weight: 1, point: centerOf(now.Vertices) });
    }
  }
  for (const ai of match.added) {
    const now = after.Geosets[ai], center = centerOf(now.Vertices);
    grows.push({ geoset: ai, to: Float32Array.from(now.Vertices), center });
    light(ai, glowFaces(now.Faces));
    focusAt.push({ weight: 3, point: center });
  }
  for (const bi of match.removed) {
    const old = before.Geosets[bi], center = centerOf(old.Vertices);
    ghosts.push({ vertices: Float32Array.from(old.Vertices), faces: glowFaces(old.Faces), center });
    focusAt.push({ weight: 3, point: center });
  }

  // Nodes: bones and pivots that moved, emitters that came or went, animation keys.
  const oldNodes = new Map(allNodes(before).map(node => [node.ObjectId, node])), newNodes = new Map(allNodes(after).map(node => [node.ObjectId, node]));
  const oldEmitters = emitterIds(before), newEmitters = emitterIds(after);
  const pivots = [], emitters = [], bones = [], frames = new Set();
  let globalKeys = false, keyed = false;
  for (const [id, node] of newNodes) {
    const old = oldNodes.get(id);
    if (!old) {
      if (newEmitters.has(id)) emitters.push({ id, at: pivotOf(node), on: true });
      else bones.push({ id, at: pivotOf(node) });
      focusAt.push({ weight: 2, point: pivotOf(node) });
      continue;
    }
    if (!same(old.PivotPoint, node.PivotPoint)) {
      pivots.push({ id, from: pivotOf(old), to: pivotOf(node) });
      focusAt.push({ weight: 2, point: pivotOf(node) });
    }
    const keys = changedKeys(old, node);
    if (keys.any) {
      keyed = true;
      globalKeys ||= keys.global;
      for (const frame of keys.frames) frames.add(frame);
      if (bones.length < MAX_BONES) bones.push({ id, at: pivotOf(node) });
      focusAt.push({ weight: 1, point: pivotOf(node) });
    } else if (newEmitters.has(id) && !same(withoutTracks(old), withoutTracks(node))) {
      emitters.push({ id, at: pivotOf(node), on: true });
      focusAt.push({ weight: 1, point: pivotOf(node) });
    }
  }
  for (const [id, old] of oldNodes)
    if (!newNodes.has(id) && oldEmitters.has(id)) {
      emitters.push({ id, at: pivotOf(old), on: false });
      focusAt.push({ weight: 2, point: pivotOf(old) });
    }

  // Surfaces: materials, colours and texture pixels.
  const surfaceKeys = changedKeys({ m: before.Materials, g: before.GeosetAnims, t: before.TextureAnims }, { m: after.Materials, g: after.GeosetAnims, t: after.TextureAnims });
  if (surfaceKeys.any) {
    keyed = true;
    globalKeys ||= surfaceKeys.global;
    for (const frame of surfaceKeys.frames) frames.add(frame);
  }
  const painted = new Set(), newPaths = new Set(assets.map(normalPath));
  (after.Textures || []).forEach((texture, index) => {
    const old = before.Textures?.[index];
    if (!same(old, texture) || (texture?.Image && newPaths.has(normalPath(texture.Image)))) painted.add(index);
  });
  const usesPainted = material => (material?.Layers || []).some(layer => (typeof layer.TextureID === 'number' ? painted.has(layer.TextureID) : painted.size > 0 && layer.TextureID?.Keys?.some(key => painted.has(key.Vector?.[0]))));
  let sweep = false, cross = remeshed;
  (after.Geosets || []).forEach((geoset, ai) => {
    const pair = match.pairs.find(item => item[1] === ai), old = pair && before.Geosets[pair[0]];
    const material = after.Materials?.[geoset.MaterialID];
    const repainted = usesPainted(material);
    const restyled = old && (old.MaterialID !== geoset.MaterialID || !same(before.Materials?.[old.MaterialID], material));
    const tinted = old && !same((before.GeosetAnims || []).find(anim => anim.GeosetId === pair[0]), (after.GeosetAnims || []).find(anim => anim.GeosetId === ai));
    if (!repainted && !restyled && !tinted) return;
    if (repainted) sweep = true;
    else cross = true;
    light(ai, glowFaces(geoset.Faces));
    focusAt.push({ weight: repainted ? 2 : 1, point: centerOf(geoset.Vertices) });
  });
  if (!same(before.TextureAnims, after.TextureAnims)) cross = true;

  // The changed span plays once inside the animation on screen.
  let span = null;
  const frameList = [...frames].filter(Number.isFinite).sort((a, b) => a - b);
  const interval = after.Sequences?.[sequence]?.Interval;
  if (keyed && !globalKeys && interval && frameList.length) {
    const inside = frameList.filter(frame => frame >= interval[0] && frame <= interval[1]);
    if (inside.length) {
      let from = inside[0], to = inside.at(-1);
      const room = interval[1] - interval[0], least = Math.min(room, 400);
      if (to - from < least) {
        const middle = (from + to) / 2;
        from = Math.max(interval[0], Math.min(interval[1] - least, middle - least / 2));
        to = from + least;
      }
      if (to > from) span = { sequence, from, to };
    }
  }

  if (!glides.length && !grows.length && !ghosts.length && !uvs.length && !pivots.length && !emitters.length && !bones.length && !keyed && !sweep && !cross) return null;
  const best = focusAt.sort((a, b) => b.weight - a.weight)[0];
  const scale = Math.max(1e-6, ...(after.Geosets || []).map(geoset => sizeOf(geoset.Vertices)));
  // Bigger changes get a little longer, inside the half to one second window.
  const ms = Math.round(Math.min(REPLAY_MAX_MS, Math.max(REPLAY_MIN_MS, 560 + 260 * clamp01(travel / (scale * .25)) + (grows.length || ghosts.length ? 160 : 0) + (span ? 240 : 0) + (sweep ? 200 : 0))));
  return {
    ms,
    focus: best ? best.point : null,
    glides,
    grows,
    uvs,
    ghosts,
    pivots,
    emitters,
    bones,
    glow: [...glow].map(([geoset, faces]) => ({ geoset, faces })),
    keyFrames: spread(frameList, MAX_KEY_FRAMES),
    span,
    fade: sweep ? 'sweep' : cross ? 'cross' : null,
    geosetCount: (after.Geosets || []).length,
  };
}

// Where each part of a replay stands at progress p (0..1). All curves are smooth: nothing
// switches on or off between two frames.
export function replayPhase(plan, p) {
  p = clamp01(p);
  const swell = Math.sin(Math.PI * p);
  return {
    p,
    glide: easeInOut(clamp01((p - .04) / .8)),
    grow: easeOut(clamp01((p - .04) / .76)),
    // Removed parts: shrink toward their middle while fading.
    ghostScale: 1 - .72 * easeInOut(clamp01(p / .8)),
    ghostAlpha: 1 - easeInOut(clamp01(p / .78)),
    glow: Math.pow(swell, .85),
    marker: Math.min(clamp01(p / .14), clamp01((1 - p) / .16)),
    fade: easeInOut(clamp01((p - .03) / .86)),
    frame: plan?.span ? plan.span.from + (plan.span.to - plan.span.from) * clamp01((p - .06) / .88) : null,
  };
}

export function glideInto(out, from, to, amount) {
  for (let i = 0; i < out.length; i++) out[i] = from[i] + (to[i] - from[i]) * amount;
  return out;
}
export function growInto(out, to, center, amount) {
  for (let i = 0; i < out.length; i += 3) {
    out[i] = center[0] + (to[i] - center[0]) * amount;
    out[i + 1] = center[1] + (to[i + 1] - center[1]) * amount;
    out[i + 2] = center[2] + (to[i + 2] - center[2]) * amount;
  }
  return out;
}
