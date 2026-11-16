// Small pure helpers of the Transfer window (app/Transfer.jsx): which chip comes
// first, which donor part feeds a part, POSE handles to parts and back, and the paths
// a hand or foot draws (the overlay that shows what a slider does).
import { Matrix4, Vector3 } from 'three';
import { allNodes, nodePivot, sampleNodeMatrices } from './animation.js';
import { transferRig, transferWholeBody } from './anim-transfer.js';

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

/** The rig as the given animation moves it (R2: transferRig(model, { sequence })). */
export function rigFor(model, sequence) {
  return transferRig(model, { sequence });
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
export function jointPath(model, sequence, jointId, step = 1000 / 30) {
  const interval = model?.Sequences?.[sequence]?.Interval, node = model && allNodes(model).find(item => item.ObjectId === jointId);
  if (!interval || !node) return { frames: [], points: [] };
  const pivot = new Vector3().fromArray(nodePivot(model, node, jointId)), frames = [], points = [];
  for (let f = interval[0]; f < interval[1]; f += step) frames.push(Math.round(f));
  frames.push(interval[1]);
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

/** Add all: every animation of `donor` (source `sourceId`) the open model does not have yet by
 * name (case-insensitive), without Decay and Portrait ones, each with the parts taken from that
 * source pointed at it and its own body animation. Parts from other sources stay as they are.
 * Returns { clips: [{ sequence, name, recipe }] }. */
export function addAllPlan(recipient, donor, sourceId, recipe, fallbackBase) {
  const taken = Object.entries(recipe?.parts || {}).filter(([, part]) => part.source === sourceId);
  if (!taken.length) return { clips: [] };
  const have = new Set((recipient?.Sequences || []).map(sequence => String(sequence.Name || '').trim().toLowerCase())), clips = [];
  (donor?.Sequences || []).forEach((sequence, index) => {
    const name = String(sequence.Name || '').trim(), key = name.toLowerCase();
    if (!name || !sequence.Interval || leftOut(name) || have.has(key)) return;
    have.add(key);
    const parts = Object.fromEntries(Object.entries(recipe.parts).map(([part, value]) => [part, value.source === sourceId ? { ...value, sequence: index } : value]));
    clips.push({ sequence: index, name, recipe: { ...recipe, base: { sequence: bodyAnimationFor(recipient, name, fallbackBase) }, parts } });
  });
  return { clips };
}
