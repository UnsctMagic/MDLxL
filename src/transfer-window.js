// Small pure helpers of the Transfer window (app/Transfer.jsx): which chip comes
// first, which donor part feeds a part, POSE handles to parts and back, and the paths
// a hand or foot draws (the overlay that shows what a slider does).
import { Matrix4, Vector3 } from 'three';
import { allNodes, nodePivot, sampleNodeMatrices } from './animation.js';
import { transferRig, transferWholeBody } from './anim-transfer.js';
import { standSequenceIndex } from './sequence-editor.js';
import { animationMirror } from './transplant-weapon-seat.js';
import { autoFixMirror, legTimingValue } from './transplant-autofix.js';

const CHIP_ORDER = ['head', 'chest', 'hips', 'armL', 'armR', 'legL', 'legR', 'wingL', 'wingR', 'tail'];

/** Part keys in chip order: Head, Chest, Hips, arms, legs, wings, tail; extra limbs after their kind. */
export function chipOrder(keys) {
  const rank = key => { const [, stem, number] = String(key).match(/^(.*?)(\d*)$/); const at = CHIP_ORDER.indexOf(stem); return (at < 0 ? CHIP_ORDER.length : at) * 100 + (Number(number) || 1); };
  return [...keys].sort((a, b) => rank(a) - rank(b) || String(a).localeCompare(String(b)));
}

/** The donor part that feeds this model's part: the other side when mirrored. */
export function donorPartKey(key, mirror) {
  return mirror ? String(key).replace(/^(arm|leg|wing)([LR])/, (_, kind, side) => kind + (side === 'L' ? 'R' : 'L')) : key;
}

/** The part a clicked POSE handle belongs to ({kind:'body'|'endpoint'|'bend'|'node'}), or null. */
export function handlePart(rig, pose, target) {
  if (!rig?.ok || !target) return null;
  if (target.kind === 'body') return rig.parts.hips ? 'hips' : null;
  let ids = [];
  if (target.kind === 'node') ids = [target.id];
  else if (target.key != null) { const chain = pose?.chains?.find(item => item.key === target.key); if (chain) ids = [chain.end, chain.middle, chain.root, ...(chain.joints || [])]; }
  for (const id of ids) for (const part of Object.values(rig.parts)) if (part.joints.includes(id)) return part.key;
  return null;
}

/** The POSE handle that stands for a part, so the preview can show it as chosen. */
export function partHandle(rig, pose, key) {
  const part = rig?.parts?.[key];
  if (!part || !pose) return null;
  if (key === 'hips') return { kind: 'body' };
  const chain = (pose.chains || []).find(item => [item.end, item.middle, item.root].some(id => part.joints.includes(id)));
  if (chain && part.kind === 'limb') return { kind: 'endpoint', key: chain.key };
  return { kind: 'node', id: part.marker };
}

/** Which source and animation each taken part uses, as one comparable string. */
export function takenSummary(recipe) {
  return Object.entries(recipe?.parts || {}).map(([key, part]) => `${key}:${part.source}:${part.sequence}:${part.from ?? ''}`).sort().join('|') + '|' + JSON.stringify(recipe?.sources || {});
}

// ---------------------------------------------------------------- engine hooks
// The round 2 engine hooks (docs/agent-tasks/transfer-xl.md, R2, R3, R5), as the window reads them.

/** The rig as the given animation moves it (R2: transferRig(model, { sequence })), in one reading of a
 * model that is two creatures (round 7b): 'both' (default), 'seated' (the rider) or 'walker' (the mount).
 * `rig.actors` lists the readings the model offers; a one-creature model offers 'both' only. */
export function rigFor(model, sequence, actor) {
  return transferRig(model, actor && actor !== 'both' ? { sequence, actor } : { sequence });
}

/** Taken parts that a new reading changes: the keys whose part is missing or made of other joints in
 * `next` than in `before` (rider hips become the mount's hips). `feeds(key, part)` gives the rig part
 * key that feeds a taken part (the donor side for a donor; the key itself for the open model). */
export function partsLostByReading(parts, before, next, feeds = key => key) {
  const same = (a, b) => !!a && !!b && a.joints.join(',') === b.joints.join(',');
  return Object.entries(parts || {}).filter(([key, part]) => { const from = feeds(key, part); return from != null && !same(before?.parts?.[from], next?.parts?.[from]); }).map(([key]) => key);
}

/** Readings with Pose at Theirs for hips and legs: taking hips and legs from the rider alone seats a
 * unit (the seat is the rider's stance itself, round 7b). */
export function seatedMatch(actor, key) {
  return actor === 'seated' && (key === 'hips' || /^leg/.test(key)) ? 1 : null;
}

/** The parts "Take whole body" takes, and a sentence when the lower body is left out
 * (R3: transferWholeBody(recipientRig, donorRig)). */
export function wholeBodyParts(recipientRig, donorRig) {
  const { parts, reason } = transferWholeBody(recipientRig, donorRig);
  return { parts, reason: reason || '' };
}

/** The donor part feeding this model's part: Other side (R5, part.flip) and the donor's Mirror. */
export function sourcePartKey(key, mirror, flip) {
  return donorPartKey(flip ? donorPartKey(key, true) : key, mirror);
}

// ---------------------------------------------------------------- limb paths
/** The model with some node tracks swapped in ({id, property, track}); nothing is copied deeply. */
export function withNodeTracks(model, tracks) {
  if (!tracks?.length) return model;
  const byId = new Map();
  for (const item of tracks) (byId.get(item.id) || byId.set(item.id, []).get(item.id)).push(item);
  const patch = node => { const items = byId.get(node.ObjectId); if (!items) return node; const copy = { ...node }; for (const item of items) copy[item.property] = item.track; return copy; };
  return { ...model, Bones: (model.Bones || []).map(patch), Helpers: (model.Helpers || []).map(patch) };
}

/** Where a joint's pivot travels through one animation, sampled every `step` ms:
 * { frames, points } with model-space [x, y, z] points (the path a hand or foot draws). */
export function jointPath(model, sequence, jointId, step = 1000 / 30, range = null) {
  const interval = model?.Sequences?.[sequence]?.Interval, node = model && allNodes(model).find(item => item.ObjectId === jointId);
  if (!interval || !node) return { frames: [], points: [] };
  // `range` (the compare sheet's looks): only this part of the animation, kept inside it.
  const start = range ? Math.max(interval[0], Math.min(interval[1], range[0])) : interval[0], end = range ? Math.max(start, Math.min(interval[1], range[1])) : interval[1];
  const pivot = new Vector3().fromArray(nodePivot(model, node, jointId)), frames = [], points = [];
  for (let f = start; f < end; f += step) frames.push(Math.round(f));
  frames.push(end);
  for (const frame of frames) points.push(pivot.clone().applyMatrix4(sampleNodeMatrices(model, frame, sequence).get(jointId) || new Matrix4()).toArray());
  return { frames, points };
}

/** Index of the sampled frame nearest `time`, for the path's moving dot. */
export function pathMarker(frames, time) {
  if (!frames?.length) return 0;
  let best = 0;
  for (let i = 1; i < frames.length; i++) if (Math.abs(frames[i] - time) < Math.abs(frames[best] - time)) best = i;
  return best;
}

/** POSE handles for the taken parts only (the result view): limb chains of taken limbs, the
 * trunk controls of taken trunk parts, the body handle when Hips is taken; null when nothing is. */
export function takenPoseConfig(pose, rig, takenKeys) {
  if (!pose || !rig?.ok || !takenKeys?.length) return null;
  const parts = takenKeys.map(key => rig.parts[key]).filter(Boolean), joints = new Set(parts.flatMap(part => part.joints));
  const chains = (pose.chains || []).filter(chain => parts.some(part => part.kind === 'limb' && [chain.end, chain.middle, chain.root].some(id => part.joints.includes(id))));
  const nodes = (pose.nodes || []).filter(id => joints.has(id) && parts.some(part => part.kind === 'trunk' && part.joints.includes(id)));
  return { ...pose, chains, nodes, body: takenKeys.includes('hips') ? pose.body : -1 };
}

// ---------------------------------------------------------------- Add all
const firstWord = name => String(name || '').trim().split(/[\s\-_]+/)[0].toLowerCase();
const leftOut = name => /\b(decay|portrait)\b/i.test(String(name || ''));

/** The open model's animation a donor clip plays over: exact name, else the same first word
 * (preferring the plain one, "Walk" or "Attack - 1", over "Walk Defend"), else `fallback`. */
export function bodyAnimationFor(recipient, donorName, fallback) {
  const list = (recipient?.Sequences || []).map((sequence, index) => ({ index, name: String(sequence.Name || '').trim() })), wanted = String(donorName || '').trim().toLowerCase(), word = firstWord(donorName);
  const exact = list.find(item => item.name.toLowerCase() === wanted);
  if (exact) return exact.index;
  const same = list.filter(item => firstWord(item.name) === word && word);
  const plain = same.find(item => /^[a-z]+(\s*-?\s*\d+)?$/i.test(item.name));
  return (plain || same[0])?.index ?? fallback;
}

const firstClipOnly = part => { const { next: _drop, ...first } = part; return first; };

/** Add all: every animation of `donor` (source `sourceId`) without Decay and Portrait ones, each with
 * the parts taken from that source pointed at it and its own body animation. Parts from other sources
 * stay as they are. Only first clips: chained clips (`next`) stay out, and a retargeted part loses its
 * trim (`clip`). By default only names the open model does not have yet (case-insensitive) are added;
 * with `replace` a name it has is added too, over its own animation of that name, and `replaces` lists
 * the open model's animations of that name (to remove once the set is added).
 * Returns { clips: [{ sequence, name, recipe, replaces }] }. */
export function addAllPlan(recipient, donor, sourceId, recipe, fallbackBase, { replace = false } = {}) {
  const taken = Object.entries(recipe?.parts || {}).filter(([, part]) => part.source === sourceId);
  if (!taken.length) return { clips: [] };
  const own = (recipient?.Sequences || []).map(sequence => String(sequence.Name || '').trim().toLowerCase());
  const have = new Set(replace ? [] : own), clips = [];
  (donor?.Sequences || []).forEach((sequence, index) => {
    const name = String(sequence.Name || '').trim(), key = name.toLowerCase();
    if (!name || !sequence.Interval || leftOut(name) || have.has(key)) return;
    have.add(key);
    const parts = Object.fromEntries(Object.entries(recipe.parts).map(([part, value]) => [part, firstClipOnly(value.source === sourceId ? { ...value, sequence: index, clip: null } : value)]));
    const replaces = replace ? own.flatMap((item, at) => item === key ? [at] : []) : [];
    clips.push({ sequence: index, name, recipe: { ...recipe, base: { ...recipe.base, sequence: bodyAnimationFor(recipient, name, fallbackBase) }, parts }, replaces });
  });
  return { clips };
}

/** Where the open model's animation `index` is once Add all has appended `clips` (to a model of
 * `count` animations) and removed the ones they replace: a replaced animation becomes its replacement. */
export function sequenceIndexAfter(index, count, clips) {
  const gone = [...new Set(clips.flatMap(clip => clip.replaces || []))];
  const by = clips.findIndex(clip => (clip.replaces || []).includes(index));
  if (by >= 0) return count + by - gone.length;
  return index - gone.filter(at => at < index).length;
}

// ---------------------------------------------------------------- Pose
/** The recipe field Pose writes on a part: Head, Chest and Hips (trunk) take the donor's stance
 * (`stance`); arms, legs and other limbs point the way the donor's do (`match`). */
export const poseKey = kind => kind === 'trunk' ? 'stance' : 'match';
/** Pose of a part (0 Mine to 1 Theirs); a part without the field (an old setup) reads 0. */
export const poseOf = (part, kind) => Number(part?.[poseKey(kind)]) || 0;
/** The part with its Pose set. */
export const withPose = (part, kind, value) => ({ ...part, [poseKey(kind)]: value });

// ---------------------------------------------------------------- clip timeline
/** Timeline lanes of the taken parts, one per clip group: parts whose n-th clip comes from the same
 * source and animation with the same Delay, Speed and trim share a lane. `clipOf(clip)` gives
 * { length, looping } of the clip's source animation (ms, unscaled, untrimmed).
 * Each lane: { id, index, keys, source, sequence, start, speed, blend, clip, full, span, looping, fixes }
 * where index is the position in the parts' chains (0 = first clip), clip the trim ([from, to] ms in
 * the donor animation, or null), full the untrimmed length, span the clip's length in the result,
 * and fixes [{ key, index, time }] in result ms (first clips only). First clips come first. */
export function clipLanes(parts, clipOf, order = Object.keys(parts || {})) {
  const lanes = new Map(), depth = Math.max(0, ...order.map(key => partClips(parts?.[key]).length));
  for (let index = 0; index < depth; index++) for (const key of order) {
    const part = parts?.[key], clip = partClips(part)[index];
    if (!clip) continue;
    const start = Number(clip.start) || 0, speed = clip.speed > 0 ? clip.speed : 1, trim = trimOf(clip);
    const id = `${index}|${clip.source}|${clip.sequence}|${start}|${speed}|${trim ? trim.join('-') : ''}`;
    let lane = lanes.get(id);
    if (!lane) {
      const found = clipOf(clip) || { length: 0, looping: false }, full = found.length, cut = trim ? normalTrim(trim, full) : null;
      lane = { id, index, keys: [], source: clip.source, sequence: clip.sequence, start, speed, blend: 0, clip: cut, full, span: (cut ? cut[1] - cut[0] : full) / speed, looping: !!(clip.loop ?? found.looping), fixes: [] };
      lanes.set(id, lane);
    }
    lane.keys.push(key);
    lane.blend = Math.max(lane.blend, Number(clip.blend) || 0);
    if (index === 0) (clip.fixes || []).forEach((fix, i) => { if (Number.isFinite(fix?.time)) lane.fixes.push({ key, index: i, time: fix.time }); });
  }
  return [...lanes.values()];
}

/** Where a clip sits on the timeline: [{ from, to }] in result ms, cut to `length`. A looping
 * clip repeats from its Delay to the end (the first one is the clip you drag). */
export function clipBlocks(start, span, looping, length) {
  if (!(span > 0)) return [];
  const blocks = [];
  if (!looping) return start < length ? [{ from: start, to: Math.min(length, start + span) }] : [];
  for (let from = start; from < length && blocks.length < 200; from += span) blocks.push({ from, to: Math.min(length, from + span) });
  return blocks;
}

// ---------------------------------------------------------------- chained clips and trim
/** Settings that belong to the whole part, not to one of its clips: they are copied to a chained
 * clip and changed on every clip of the part together. */
export const PART_WIDE = ['flip', 'plant', 'grip', 'clear', 'aim', 'range', 'follow', 'avoid', 'hang'];
/** The clips of a taken part in order: the part itself (without `next`) and its chained clips. */
export function partClips(part) {
  if (!part) return [];
  const { next, ...first } = part;
  return [first, ...(Array.isArray(next) ? next : [])];
}
/** One clip of a part: 0 is the part itself. */
export function clipOfPart(part, index) {
  return index > 0 ? part?.next?.[index - 1] : part;
}
/** The part with clip `index` replaced (clip 0 keeps the part's chain). */
export function withClip(part, index, clip) {
  if (!(index > 0)) { const { next: _drop, ...first } = clip; return part?.next ? { ...first, next: part.next } : first; }
  return { ...part, next: part.next.map((item, i) => i === index - 1 ? clip : item) };
}
/** The part without chained clip `index` (1 or more). */
export function withoutClip(part, index) {
  if (!(index > 0) || !part?.next) return part;
  const next = part.next.filter((_, i) => i !== index - 1), { next: _drop, ...first } = part;
  return next.length ? { ...first, next } : first;
}
/** The part with whole-part settings set on every clip. */
export function withPartWide(part, values) {
  const first = { ...part, ...values };
  return part.next ? { ...first, next: part.next.map(clip => ({ ...clip, ...values })) } : first;
}
/** A clip chained after `part`'s clips: `defaults` (defaultTransferPart) with the source, animation and
 * start, a 150 ms hand-over, and the part's whole-part settings. */
export function chainedClip(part, defaults, source, sequence, start, blend = 150) {
  const { next: _drop, fixes: _fixes, ...base } = defaults;
  const clip = { ...base, fixes: [], source, sequence, start: Math.max(0, Math.round(start)), blend };
  for (const key of PART_WIDE) if (part?.[key] !== undefined) clip[key] = part[key];
  return clip;
}
const trimOf = clip => Array.isArray(clip?.clip) && clip.clip.length === 2 && clip.clip.every(Number.isFinite) ? clip.clip.map(Number) : null;
const normalTrim = (trim, full) => { const from = Math.max(0, Math.min(full, trim[0])), to = Math.max(0, Math.min(full, trim[1])); return to > from && (from > 0 || to < full) ? [from, to] : null; };
/** A trim by one edge of a lane's clip, dragged `dt` result ms: { clip, start }. The kept part stays
 * where it is in time: a left trim moves Delay later by what was cut (scaled by Speed). A clip back
 * to its whole length is `clip: null`. Times round to 10 ms (donor) and 1 ms (Delay). */
export function trimmedClip(lane, edge, dt, minLength = 50) {
  const full = lane.full, [from, to] = lane.clip || [0, full], speed = lane.speed > 0 ? lane.speed : 1;
  const step = value => Math.round(value / 10) * 10, keep = Math.min(minLength, full);
  if (edge === 'left') {
    const cut = Math.max(0, Math.min(to - keep, step(from + dt * speed)));
    return { clip: normalTrim([cut, to], full), start: Math.max(0, Math.round(lane.start + (cut - from) / speed)) };
  }
  const end = Math.max(from + keep, Math.min(full, step(to + dt * speed)));
  return { clip: normalTrim([from, end], full), start: lane.start };
}
/** Double-click on an edge: that end of the clip back, the kept part where it was. */
export function restoredClip(lane, edge) {
  const full = lane.full, [from, to] = lane.clip || [0, full], speed = lane.speed > 0 ? lane.speed : 1;
  if (edge === 'left') return { clip: normalTrim([0, to], full), start: Math.max(0, Math.round(lane.start - from / speed)) };
  return { clip: normalTrim([from, full], full), start: lane.start };
}

// ---------------------------------------------------------------- drag to aim
/** Where a dragged hand or foot goes: the pointer ray's nearer hit on the sphere around the limb's
 * root through its end; when the ray misses the sphere, its hit on the plane through the end that
 * faces the camera. ray = { origin, direction } (model space); returns [x, y, z]. */
export function dropPoint(ray, root, end) {
  const o = new Vector3().fromArray(ray.origin), d = new Vector3().fromArray(ray.direction).normalize(), c = new Vector3().fromArray(root), e = new Vector3().fromArray(end);
  const radius = e.distanceTo(c), oc = o.clone().sub(c), b = oc.dot(d), disc = b * b - (oc.lengthSq() - radius * radius);
  if (radius > 1e-6 && disc >= 0) { const t = -b - Math.sqrt(disc); if (t > 0) return o.addScaledVector(d, t).toArray(); }
  const denom = d.dot(d), t = e.clone().sub(o).dot(d) / denom;
  return o.addScaledVector(d, t).toArray();
}

// ---------------------------------------------------------------- setups (save and load)
export const SETUP_KIND = 'mdlxl-transfer-setup';
const nameIndex = (model, name) => (model?.Sequences || []).findIndex(sequence => String(sequence.Name || '').trim().toLowerCase() === String(name || '').trim().toLowerCase());

/** A setup file: the recipe with sources by file or game path and animations by name.
 * `describe(sourceId)` gives { kind: 'self' | 'file' | 'library', path, name, model }.
 * `features` (transferFeatures of the open model): kept features are saved by their top joint's name,
 * since joint ids differ between models. */
export function setupFromRecipe(recipe, model, describe, name, features = []) {
  const sources = {}, parts = {};
  // Every part field travels (range, follow, avoid, clip, ...): only the source becomes a reference
  // and the animation a name, for the part and for each chained clip in `next`.
  const saved = clip => {
    const source = describe(clip.source);
    if (!source) return null;
    sources[clip.source] ||= { kind: source.kind, path: source.path || null, name: source.name || '', mirror: recipe.sources?.[clip.source]?.mirror ?? null, ...(recipe.sources?.[clip.source]?.actor ? { actor: recipe.sources[clip.source].actor } : {}) };
    const { source: _id, sequence, next: _next, ...values } = clip;
    return { ...values, source: clip.source, animation: source.model?.Sequences?.[sequence]?.Name || '' };
  };
  for (const [key, part] of Object.entries(recipe?.parts || {})) {
    const first = saved(part);
    if (!first) continue;
    const next = (Array.isArray(part.next) ? part.next : []).map(saved).filter(Boolean);
    parts[key] = next.length ? { ...first, next } : first;
  }
  const kept = {};
  for (const [id, value] of Object.entries(recipe?.features || {})) { const feature = features.find(item => String(item.id) === String(id)); if (feature && value?.keep) kept[feature.name] = { ...value }; }
  return { kind: SETUP_KIND, version: 1, name: String(name || ''), body: model?.Sequences?.[recipe?.base?.sequence]?.Name || '', ...(recipe?.base?.actor ? { bodyActor: recipe.base.actor } : {}), length: recipe?.length ?? null, sources, parts, ...(Object.keys(kept).length ? { features: kept } : {}) };
}

/** Reads a setup's text; throws a short sentence when it is not one. */
export function parseSetup(text) {
  let value;
  try { value = JSON.parse(text); } catch { throw new Error('This file is not a Transfer setup.'); }
  if (value?.kind !== SETUP_KIND || typeof value.parts !== 'object' || typeof value.sources !== 'object') throw new Error('This file is not a Transfer setup.');
  return value;
}

/** The recipe a setup makes on `model`: `donors` maps each setup source id to { id, model } (or null when
 * it could not be opened). Parts the model lacks, animations a donor lacks and missing donors are left
 * out and named in `left`. `fallbackBase` is used when the model has no animation of the setup's body name.
 * `features` (transferFeatures of the open model) maps kept features by name; ones it lacks are named. */
export function recipeFromSetup(setup, model, rig, donors, fallbackBase, features = []) {
  const left = [], parts = {}, sources = {};
  const body = nameIndex(model, setup.body);
  // A source's Mirror and reading (Both, Rider, Mount) when the setup has them; an old setup has neither.
  const keepSource = (savedId, id) => {
    const saved = setup.sources?.[savedId], value = { ...(saved?.mirror != null ? { mirror: saved.mirror } : {}), ...(saved?.actor ? { actor: saved.actor } : {}) };
    if (Object.keys(value).length) sources[id] = { ...sources[id], ...value };
  };
  for (const [key, part] of Object.entries(setup.parts || {})) {
    const donor = donors[part.source];
    if (!rig?.parts?.[key]) { left.push(`part:${key}`); continue; }
    if (!donor) { left.push(`source:${part.source}`); continue; }
    const sequence = nameIndex(donor.model, part.animation);
    if (sequence < 0) { left.push(`animation:${part.animation}`); continue; }
    const { source: _id, animation: _name, next: savedNext, ...values } = part;
    keepSource(part.source, donor.id);
    // Chained clips: one whose donor or animation is missing is left out and named.
    const next = [];
    for (const clip of Array.isArray(savedNext) ? savedNext : []) {
      const from = donors[clip?.source];
      if (!from) { left.push(`source:${clip?.source}`); continue; }
      const index = nameIndex(from.model, clip.animation);
      if (index < 0) { left.push(`animation:${clip.animation}`); continue; }
      const { source: _cid, animation: _cname, next: _deeper, ...clipValues } = clip;
      next.push({ ...clipValues, source: from.id, sequence: index });
      keepSource(clip.source, from.id);
    }
    parts[key] = next.length ? { ...values, source: donor.id, sequence, next } : { ...values, source: donor.id, sequence };
  }
  // Kept features by name: this model's feature of that name, else left out and named.
  let kept = null;
  for (const [featureName, value] of Object.entries(setup.features && typeof setup.features === 'object' ? setup.features : {})) {
    const feature = features.find(item => item.name === featureName);
    if (!feature) { left.push(`feature:${featureName}`); continue; }
    (kept ||= {})[feature.id] = { ...value };
  }
  return { recipe: { base: { sequence: body >= 0 ? body : fallbackBase, ...(setup.bodyActor ? { actor: setup.bodyActor } : {}) }, length: setup.length ?? null, sources, parts, ...(kept ? { features: kept } : {}) }, left: [...new Set(left)] };
}

// ---------------------------------------------------------------- Transplant mode
/** The transplant engine's options from the Transplant settings: Sounds (the donor's events, on),
 * Effects (the donor's particle effects, off), Keep (own extras whose bone stays; only ids the
 * engine's report lists, when it is given) and the donor caption's Mirror. */
export function transplantOptions({ sounds = true, effects = false, keep = [], mirror = false, autoFix = false, legTiming = null } = {}, extras = null) {
  const offered = extras ? new Set(extras.map(extra => extra.id)) : null;
  // Leg timing only goes with Mirror legs, so no other build gets a new field.
  return { events: !!sounds, emitters: !!effects, keep: [...new Set(keep)].filter(id => !offered || offered.has(id)).sort((a, b) => a - b), mirror: !!mirror, ...(autoFix ? { autoFix } : {}),
    ...(autoFix?.mirrorLegs && legTiming != null ? { legTiming: legTimingValue(legTiming) } : {}) };
}

/** The transplant options of an engine-per-region choice ({armL, armR, legL, legR, weapon}: 1 or 2): engine 2 with those
 * regions when any part is on engine 2, else nothing (engine 1, the plain transplant). */
export function engineOptions(regions) {
  const picked = Object.fromEntries(Object.entries(regions || {}).filter(([, value]) => value === 1 || value === 2));
  return Object.values(picked).includes(2) ? { engine: 2, regions: picked } : {};
}

/** Use the same automatic Mirror choice for the trial and the result it recommends. */
export function transplantRepairOptions(model, donor, options = {}, automaticMirror = options.mirror == null) {
  if (!automaticMirror) return options;
  const fix = options.autoFix;
  if (fix?.seatWeapon || fix?.hand || fix?.heldGeometry) {
    const match=animationMirror(model,donor,rigFor(model,Math.max(0,standSequenceIndex(model))),rigFor(donor,Math.max(0,standSequenceIndex(donor))));
    if(match?.close) return {...options,mirror:match.mirror};
  }
  if (fix?.heldGeometry) return { ...options, mirror: null };
  if (options.mirror != null && !fix?.hand) return options;
  const ownRig = rigFor(model, Math.max(0, standSequenceIndex(model)));
  const donorRig = rigFor(donor, Math.max(0, standSequenceIndex(donor)));
  const named = options.mirror ?? !!(ownRig?.weaponSide && donorRig?.weaponSide && ownRig.weaponSide !== donorRig.weaponSide);
  const mirror = fix?.hand && ownRig?.ok && donorRig?.ok ? autoFixMirror(model, ownRig, donor, donorRig) ?? named : named;
  return { ...options, mirror };
}

/** The transplanted model's animation that matches the donor's `sequence`: the one of the same
 * name, else the one at the same place in the list; -1 when there is none. */
export function transplantSequence(result, donor, sequence) {
  const list = result?.Sequences || [], name = donor?.Sequences?.[sequence]?.Name;
  const named = name == null ? -1 : list.findIndex(item => item.Name === name);
  return named >= 0 ? named : sequence >= 0 && sequence < list.length ? sequence : -1;
}

/** Puts every section of `next` in place of `target`'s (the transplant swaps the whole model in
 * one edit): sections `next` lacks are removed, the rest replaced. Returns `target`. */
export function replaceModelContents(target, next) {
  for (const key of Object.keys(target)) if (!Object.hasOwn(next, key)) delete target[key];
  return Object.assign(target, next);
}
