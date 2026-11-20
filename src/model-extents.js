import { isGlobalTrack } from './animation.js';
import { geosetAlphaTrack, geosetMaterialLayers, geosetVisibleIn, hasOnlyAdditiveLayers, isAdditiveLayer } from './geoset-extras.js';
import { isPortraitSequence } from './sequence-editor.js';
import { isTeamGlowLayer } from './texture-references.js';
import { hdContentKind } from './model-version.js';
import { box, include, finish, invalidBoundsTargets, sequenceSampler } from './optimizexl-bounds.js';

// Extents decide where the game draws the health bar, where the unit can be
// clicked and when it is culled at the screen edge. Hive reviewers ask that
// portrait backgrounds and hero/team glow planes stay out of them, because
// they push the health bar far above the unit. Additive effect meshes (an
// attack's shock plane, a spell flash) do the same. These geosets keep their
// own geoset boxes; they only stop widening the model and animation boxes.

/** Shared tooltip for every Calculate extents control. */
export const EXTENTS_TIP = 'Rebuilds the boxes the game uses for the health bar height, clicking and hiding the unit at the screen edge. Hero glow, portrait backgrounds and glowing effect meshes are left out.';

function countsAsVisible(model, index, sequence) {
  const track = geosetAlphaTrack(model, index);
  return isGlobalTrack(track) || geosetVisibleIn(model, track, sequence, sequence.Interval || [0, 0]);
}

/** Geosets left out of model and animation extents, with the reason for each:
 * 'glow' (hero/team glow), 'portrait' (shown only in Portrait animations) or
 * 'effect' (every layer additive). Nothing is left out when that would leave
 * no geometry at all, as for a fully additive Wisp. */
export function extentsExclusions(model) {
  const geosets = model.Geosets || [], sequences = model.Sequences || [], reasons = new Map();
  const portraits = sequences.filter(isPortraitSequence), others = sequences.filter(s => !isPortraitSequence(s));
  geosets.forEach((geoset, index) => {
    const layers = geosetMaterialLayers(model, geoset);
    if (layers.some(layer => isTeamGlowLayer(model, layer)) && layers.every(layer => isTeamGlowLayer(model, layer) || isAdditiveLayer(layer))) reasons.set(index, 'glow');
    else if (portraits.length && others.length && portraits.some(s => countsAsVisible(model, index, s)) && !others.some(s => countsAsVisible(model, index, s))) reasons.set(index, 'portrait');
    else if (hasOnlyAdditiveLayers(layers)) reasons.set(index, 'effect');
  });
  const kept = geosets.some((geoset, index) => !reasons.has(index) && geoset.Vertices?.length);
  return kept ? reasons : new Map();
}

// Geoset animation bounds: one box per animation on every geoset (28 bytes
// each). Blizzard ships some units without them (Forsaken Paladin's body,
// hero glow planes, Abomination explosion). "Necessary only" leaves them out
// and grows each geoset's own box over its still pose and every animation
// that shows it. Blizzard's geoset box is exactly the union of its animation
// boxes, and a hidden geoset's box for that animation is empty.
const GEOSET_ANIMATION_BOX_BYTES = 28;

/** Classic/SD models with animations can leave out geoset animation bounds; Reforged HD models keep them. */
export function offersNecessaryExtents(model) {
  return !!model.Sequences?.length && !(model.Version > 800 && hdContentKind(model));
}

/** The model's own state is the remembered choice: 'necessary' when no geoset
 * with vertices has a complete table and at least one has none, else 'full'. */
export function defaultExtentsChoice(model) {
  const count = model.Sequences?.length || 0, meshes = (model.Geosets || []).filter(geoset => geoset.Vertices?.length);
  const leftOut = meshes.some(geoset => !geoset.Anims?.length) && meshes.every(geoset => (geoset.Anims?.length || 0) !== count);
  return offersNecessaryExtents(model) && leftOut ? 'necessary' : 'full';
}

/** Bytes saved by leaving out every geoset animation box the model has now. */
export function geosetAnimationBoundsBytes(model) {
  return (model.Geosets || []).reduce((sum, geoset) => sum + (geoset.Anims?.length || 0), 0) * GEOSET_ANIMATION_BOX_BYTES;
}

/** Every extent the model has: each geoset's still box and its box per
 * animation, each animation's box and the model's still-pose box. Animation boxes follow
 * the sampled motion and count only geosets shown in that animation.
 * necessaryOnly leaves out the boxes per animation on every geoset; each
 * geoset box then covers its still pose and every animation that shows it. Model
 * and animation boxes are the same either way. */
export function calculateExtents(model, { necessaryOnly = false } = {}) {
  const geosets = model.Geosets || [], sequences = model.Sequences || [];
  const excluded = extentsExclusions(model), counted = index => !excluded.has(index) && geosets[index].Vertices?.length;
  const still = geosets.map(geoset => { const b = box(); include(b, geoset.Vertices || []); return b; });
  const stillTotal = box();
  geosets.forEach((geoset, index) => {
    Object.assign(geoset, finish(still[index]));
    if (counted(index)) { include(stillTotal, still[index].min); include(stillTotal, still[index].max); }
  });
  const animated = sequences.length ? sequenceSampler(model, { includeGlobalKeys: true }) : null;
  const swept = necessaryOnly ? structuredClone(still) : null;
  sequences.forEach((sequence, sequenceIndex) => {
    const boxes = animated(sequenceIndex), total = box();
    geosets.forEach((geoset, index) => {
      // As in Blizzard's files, an animation that hides the geoset does not widen its box.
      if (swept) { if (Number.isFinite(boxes[index].min[0]) && countsAsVisible(model, index, sequence)) { include(swept[index], boxes[index].min); include(swept[index], boxes[index].max); } }
      else {
        geoset.Anims ||= [];
        geoset.Anims[sequenceIndex] = finish(boxes[index]);
      }
      if (counted(index) && Number.isFinite(boxes[index].min[0]) && countsAsVisible(model, index, sequence)) { include(total, boxes[index].min); include(total, boxes[index].max); }
    });
    // An animation that shows nothing still needs a box the game accepts.
    const chosen = Number.isFinite(total.min[0]) ? total : stillTotal;
    Object.assign(sequence, finish(chosen));
  });
  if (swept) geosets.forEach((geoset, index) => { Object.assign(geoset, finish(swept[index])); geoset.Anims = []; });
  else geosets.forEach(geoset => { geoset.Anims ||= []; geoset.Anims.length = sequences.length; });
  model.Info ||= {};
  // The model box is the still pose, as in Blizzard's files; motion lives in the animation boxes.
  Object.assign(model.Info, finish(stillTotal));
  return { excluded };
}

const extentRecords = model => [model.Info, ...(model.Sequences || []), ...(model.Geosets || []).flatMap(g => [g, ...(g.Anims || [])])];
/** True when calculating would move some stored box by more than a small
 * share of the model's size (or the count of per-animation boxes differs).
 * A model without geoset animation bounds is compared with Necessary only. */
export function extentsDiffer(model, choice = defaultExtentsChoice(model)) {
  const copy = structuredClone(model);
  calculateExtents(copy, { necessaryOnly: choice === 'necessary' });
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
  // Classic/SD only: Full keeps every box, Necessary only leaves out the geoset animation bounds.
  const offered = offersNecessaryExtents(model), bytes = offered ? geosetAnimationBoundsBytes(model) : 0, kb = (bytes / 1024).toFixed(bytes < 10240 ? 1 : 0);
  const options = [['full', 'Full'], ['necessary', bytes ? `Necessary only (saves ${kb} KB)` : 'Necessary only']];
  if (!targets.length && !differs) {
    // Extents are right: only the size saving is left. It is optional, so Fix
    // everything, Select all, the stage star and the clean state ignore it.
    if (!bytes) return [];
    return [{ id: 'extents', kind: 'bounds', optional: true, targets, sequence: 0, frame: model.Sequences[0]?.Interval[0] || 0,
      choiceLabel: 'Geoset animation bounds', choice: 'necessary', choices: options, label: `Geoset animation bounds (saves ${kb} KB)`,
      detail: 'The extents are already right. Necessary only leaves out the geoset animation bounds to make the file smaller; model and animation boxes stay the same. Fix everything skips this.' }];
  }
  const sequence = targets.find(t => t.sequence != null)?.sequence ?? 0;
  const left = [...extentsExclusions(model).keys()].map(i => i + 1);
  const choices = offered ? { choiceLabel: 'Geoset animation bounds', choice: defaultExtentsChoice(model), choices: options } : {};
  return [{ id: 'extents', kind: 'bounds', targets, sequence, frame: model.Sequences[sequence]?.Interval[0] || 0, ...choices,
    label: targets.length ? `Calculate extents (${targets.length} broken)` : 'Calculate extents',
    detail: left.length ? `Rebuild the model, animation and geoset extents from the model and its sampled animation. They set the health bar height, the click area and when the unit is hidden at the screen edge. Hero glow, portrait backgrounds and glowing effect meshes (geosets ${left.join(', ')}) are left out. Meshes, keys and visibility stay unchanged.`
      : 'Rebuild the model, animation and geoset extents from the model and its sampled animation. They set the health bar height, the click area and when the unit is hidden at the screen edge. Meshes, keys and visibility stay unchanged.' }];
}
