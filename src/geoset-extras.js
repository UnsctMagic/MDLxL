import { isGlobalTrack, sampleTrack } from './animation.js';
import { isGlowGeoset } from './glow-up.js';

// Corpse (Death/Decay) and portrait-background geosets only clutter the work
// area. "Everyday" sequences are everything else (Stand, Walk, Attack, ...).
const special = /decay|death|dissipate|portrait/i;
const everydaySequences = model => (model.Sequences || []).filter(sequence => !special.test(String(sequence.Name || '')));
const alphaTrack = (model, index) => (model.GeosetAnims || []).find(item => item.GeosetId === index)?.Alpha;

function visibleIn(model, track, sequence) {
  const [start, end] = sequence.Interval || [];
  const frames = [start, (start + end) / 2, end, ...(track?.Keys || []).map(key => key.Frame).filter(frame => frame >= start && frame <= end)];
  return frames.some(frame => sampleTrack(track, frame, { interval: sequence.Interval, globalSequences: model.GlobalSequences, globalTime: 0, fallback: 1 }) > 0.001);
}

/** Geosets that never show in an everyday sequence: corpses, guts and portrait backgrounds. */
export function corpseAndBackgroundGeosets(model) {
  const everyday = everydaySequences(model);
  const extras = new Set();
  if (!everyday.length) return extras;
  (model.Geosets || []).forEach((_, index) => {
    const track = alphaTrack(model, index);
    if (isGlobalTrack(track)) return;
    if (!everyday.some(sequence => visibleIn(model, track, sequence))) extras.add(index);
  });
  // Never empty the work area.
  return extras.size === (model.Geosets || []).length ? new Set() : extras;
}

// Additive and Add Alpha are how effects are drawn. Across the 398 Blizzard SD models, a geoset drawn that way which sits
// out some everyday sequences is always an effect (a whirlwind, zap or spark). Solid geosets that do so are real gear
// (weapons, shields, coins), and effects that never switch off are part of the unit's look (an Infernal's fire), so both stay.
const isEffectGeoset = (model, geoset) => {
  const layers = model.Materials?.[geoset.MaterialID]?.Layers || [];
  return layers.length > 0 && layers.every(layer => layer.FilterMode === 3 || layer.FilterMode === 4);
};

/** Everything Hide extras takes out of the work area: corpses and backgrounds, hero glow, and part-time effects. */
export function geosetsHiddenByExtras(model) {
  const geosets = model.Geosets || [], everyday = everydaySequences(model), extras = new Set(corpseAndBackgroundGeosets(model));
  geosets.forEach((geoset, index) => {
    const track = alphaTrack(model, index);
    if (isGlowGeoset(model, geoset) || isEffectGeoset(model, geoset) && !isGlobalTrack(track) && everyday.some(sequence => !visibleIn(model, track, sequence))) extras.add(index);
  });
  // Never empty the work area.
  return extras.size === geosets.length ? new Set() : extras;
}
