import { isGlobalTrack, sampleTrack } from './animation.js';

// Corpse (Death/Decay) and portrait-background geosets only clutter the work
// area. "Everyday" sequences are everything else (Stand, Walk, Attack, ...).
const special = /decay|death|dissipate|portrait/i;

function visibleIn(model, track, sequence) {
  const [start, end] = sequence.Interval || [];
  const frames = [start, (start + end) / 2, end, ...(track?.Keys || []).map(key => key.Frame).filter(frame => frame >= start && frame <= end)];
  return frames.some(frame => sampleTrack(track, frame, { interval: sequence.Interval, globalSequences: model.GlobalSequences, globalTime: 0, fallback: 1 }) > 0.001);
}

/** Geosets that never show in an everyday sequence: corpses, guts and portrait backgrounds. */
export function corpseAndBackgroundGeosets(model) {
  const everyday = (model.Sequences || []).filter(sequence => !special.test(String(sequence.Name || '')));
  const extras = new Set();
  if (!everyday.length) return extras;
  (model.Geosets || []).forEach((_, index) => {
    const track = (model.GeosetAnims || []).find(item => item.GeosetId === index)?.Alpha;
    if (isGlobalTrack(track)) return;
    if (!everyday.some(sequence => visibleIn(model, track, sequence))) extras.add(index);
  });
  // Never empty the work area.
  return extras.size === (model.Geosets || []).length ? new Set() : extras;
}
