import { sampleTrack } from './animation.js';
import { isTeamGlowLayer } from './texture-references.js';
import { box, include, finish, invalidBoundsTargets, sequenceSampler } from './optimizexl-bounds.js';

// Extents decide where the game draws the health bar, where the unit can be
// clicked and when it is culled at the screen edge. Hive reviewers ask that
// portrait backgrounds and hero/team glow planes stay out of them, because
// they push the health bar far above the unit. Additive effect meshes (an
// attack's shock plane, a spell flash) do the same. These geosets keep their
// own geoset boxes; they only stop widening the model and animation boxes.

/** Shared tooltip for every Calculate extents control. */
export const EXTENTS_TIP = 'Rebuilds the boxes the game uses for the health bar height, clicking and hiding the unit at the screen edge. Hero glow, portrait backgrounds and glowing effect meshes are left out.';
const ADDITIVE = new Set([3, 4]);
const globalTrack = track => Number.isInteger(track?.GlobalSeqId) && track.GlobalSeqId >= 0;
const isPortraitSequence = sequence => /portrait/i.test(sequence?.Name || '');
const layersOf = (model, geoset) => model.Materials?.[geoset.MaterialID]?.Layers || [];

function visibleIn(model, index, sequence) {
  const track = (model.GeosetAnims || []).find(anim => anim.GeosetId === index)?.Alpha;
  if (globalTrack(track)) return true;
  const [start, end] = sequence.Interval || [0, 0];
  const frames = [start, (start + end) / 2, end, ...(track?.Keys || []).map(key => key.Frame).filter(frame => frame >= start && frame <= end)];
  const options = { interval: sequence.Interval, globalSequences: model.GlobalSequences, globalTime: 0, fallback: 1 };
  return frames.some(frame => sampleTrack(track, frame, options) > 0.001);
}

/** Geosets left out of model and animation extents, with the reason for each:
 * 'glow' (hero/team glow), 'portrait' (shown only in Portrait animations) or
 * 'effect' (every layer additive). Nothing is left out when that would leave
 * no geometry at all, as for a fully additive Wisp. */
export function extentsExclusions(model) {
  const geosets = model.Geosets || [], sequences = model.Sequences || [], reasons = new Map();
  const portraits = sequences.filter(isPortraitSequence), others = sequences.filter(s => !isPortraitSequence(s));
  geosets.forEach((geoset, index) => {
    const layers = layersOf(model, geoset);
    if (layers.some(layer => isTeamGlowLayer(model, layer)) && layers.every(layer => isTeamGlowLayer(model, layer) || ADDITIVE.has(layer.FilterMode))) reasons.set(index, 'glow');
    else if (portraits.length && others.length && portraits.some(s => visibleIn(model, index, s)) && !others.some(s => visibleIn(model, index, s))) reasons.set(index, 'portrait');
    else if (layers.length && layers.every(layer => ADDITIVE.has(layer.FilterMode))) reasons.set(index, 'effect');
  });
  const kept = geosets.some((geoset, index) => !reasons.has(index) && geoset.Vertices?.length);
  return kept ? reasons : new Map();
}

/** Every extent the model has: each geoset's still box and its box per
 * animation, each animation's box and the model's still-pose box. Animation boxes follow
 * the sampled motion and count only geosets shown in that animation. */
export function calculateExtents(model) {
  const geosets = model.Geosets || [], sequences = model.Sequences || [];
  const excluded = extentsExclusions(model), counted = index => !excluded.has(index) && geosets[index].Vertices?.length;
  const still = geosets.map(geoset => { const b = box(); include(b, geoset.Vertices || []); return b; });
  const stillTotal = box();
  geosets.forEach((geoset, index) => {
    Object.assign(geoset, finish(still[index]));
    if (counted(index)) { include(stillTotal, still[index].min); include(stillTotal, still[index].max); }
  });
  const animated = sequences.length ? sequenceSampler(model, { includeGlobalKeys: true }) : null;
  sequences.forEach((sequence, sequenceIndex) => {
    const boxes = animated(sequenceIndex), total = box();
    geosets.forEach((geoset, index) => {
      geoset.Anims ||= [];
      geoset.Anims[sequenceIndex] = finish(boxes[index]);
      if (counted(index) && Number.isFinite(boxes[index].min[0]) && visibleIn(model, index, sequence)) { include(total, boxes[index].min); include(total, boxes[index].max); }
    });
    // An animation that shows nothing still needs a box the game accepts.
    const chosen = Number.isFinite(total.min[0]) ? total : stillTotal;
    Object.assign(sequence, finish(chosen));
  });
  geosets.forEach(geoset => { geoset.Anims ||= []; geoset.Anims.length = sequences.length; });
  model.Info ||= {};
  // The model box is the still pose, as in Blizzard's files; motion lives in the animation boxes.
  Object.assign(model.Info, finish(stillTotal));
  return { excluded };
}

const extentRecords = model => [model.Info, ...(model.Sequences || []), ...(model.Geosets || []).flatMap(g => [g, ...(g.Anims || [])])];
/** True when calculating would move some stored box by more than a small
 * share of the model's size (or the count of per-animation boxes differs). */
export function extentsDiffer(model) {
  const copy = structuredClone(model);
  calculateExtents(copy);
  const before = extentRecords(model), after = extentRecords(copy);
  if (before.length !== after.length) return true;
  const size = Math.max(1, ...Array.from(copy.Info.MaximumExtent).map((v, i) => v - copy.Info.MinimumExtent[i]));
  const tolerance = Math.max(0.5, size * 0.01);
  return before.some((record, i) => !record || ['MinimumExtent', 'MaximumExtent'].some(key => record[key]?.length !== 3 ||
    Array.from(after[i][key]).some((v, k) => !(Math.abs(v - record[key][k]) <= tolerance))) || !(Math.abs((record.BoundsRadius ?? NaN) - after[i].BoundsRadius) <= tolerance));
}

/** OptimizeXL's extents finding: one proposal that calculates all extents. */
export function boundsProposals(model) {
  const targets = invalidBoundsTargets(model);
  let differs = false;
  // A rig the renderer cannot build (a missing parent, say) is left to its own
  // repair first; the extents finding returns on the next scan.
  try { differs = extentsDiffer(model); } catch { if (!targets.length) return []; }
  if (!targets.length && !differs) return [];
  const sequence = targets.find(t => t.sequence != null)?.sequence ?? 0;
  const left = [...extentsExclusions(model).keys()].map(i => i + 1);
  return [{ id: 'extents', kind: 'bounds', targets, sequence, frame: model.Sequences[sequence]?.Interval[0] || 0,
    label: targets.length ? `Calculate extents (${targets.length} broken)` : 'Calculate extents',
    detail: left.length ? `Rebuild the model, animation and geoset extents from the model and its sampled animation. They set the health bar height, the click area and when the unit is hidden at the screen edge. Hero glow, portrait backgrounds and glowing effect meshes (geosets ${left.join(', ')}) are left out. Meshes, keys and visibility stay unchanged.`
      : 'Rebuild the model, animation and geoset extents from the model and its sampled animation. They set the health bar height, the click area and when the unit is hidden at the screen edge. Meshes, keys and visibility stay unchanged.' }];
}
