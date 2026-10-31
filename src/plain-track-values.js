import { serializedNodes } from './node-id-order.js';

// Warcraft III stores these only as keyframe tracks. A plain value here cannot
// be saved (MDX or MDL) and stops the Warcraft preview, so it is a model error.
const TRACK_ONLY = { Translation: [0, 0, 0], Rotation: [0, 0, 0, 1], Scaling: [1, 1, 1] };

/** Track-only fields that hold a plain value: { owner, property, path, label }. */
export function plainTrackValues(model) {
  const found = [];
  const check = (owner, path, label) => {
    for (const property of Object.keys(TRACK_ONLY)) if (owner?.[property] != null && !Array.isArray(owner[property].Keys))
      found.push({ owner, property, path: `${path}.${property}`, label: `${label} · ${property}` });
  };
  for (const node of serializedNodes(model)) check(node, `Nodes[${node.ObjectId}]`, node.Name || `Node ${node.ObjectId}`);
  (model?.TextureAnims || []).forEach((animation, index) => check(animation, `TextureAnims[${index}]`, `Texture animation ${index + 1}`));
  return found;
}

/** One unchanging value as a track: a key at frame 0 and at every animation's
 * start and end, so every animation shows it. */
export function constantTrack(model, vector) {
  const frames = [...new Set([0, ...(model.Sequences || []).flatMap(sequence => Array.from(sequence.Interval))])].sort((a, b) => a - b);
  return { LineType: 0, GlobalSeqId: null, Keys: frames.map(Frame => ({ Frame, Vector: Float32Array.from(vector) })) };
}

/** Keeps how the model looks: a default value is removed, any other value
 * becomes a constant track. Returns how many values were fixed. */
export function fixPlainTrackValues(model, items = plainTrackValues(model)) {
  for (const { owner, property } of items) {
    const value = owner[property], fallback = TRACK_ONLY[property];
    const vector = ArrayBuffer.isView(value) || Array.isArray(value) ? Array.from(value) : [];
    if (vector.length !== fallback.length || vector.some(number => !Number.isFinite(number)) || vector.every((number, axis) => Math.abs(number - fallback[axis]) < 1e-6)) delete owner[property];
    else owner[property] = constantTrack(model, vector);
  }
  return items.length;
}
