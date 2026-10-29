import { sampleTrack, visitTracks } from './animation.js';

/** Freeze every other animation domain at time zero in a renderer-only model. */
export function isolateGlobalSequence(model, globalSeqId) {
  if (!(model.GlobalSequences?.[globalSeqId] > 0)) return model;
  visitTracks(model, (value, { owner, property }) => {
    if (value.GlobalSeqId === globalSeqId || !value.Keys.length) return;
    const first = value.Keys[0].Vector;
    const fallback = first.length === 1 ? first[0] : Array.from(first);
    const sampled = owner._MdxDefaults?.[property] ?? sampleTrack(value, 0, { globalSequences: model.GlobalSequences, fallback, quaternion: property === 'Rotation' });
    owner[property] = { LineType: 0, GlobalSeqId: null, Keys: [{ Frame: 0, Vector: typeof sampled === 'number' ? [sampled] : Array.from(sampled) }] };
  });
  return model;
}
