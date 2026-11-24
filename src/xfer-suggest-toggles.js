import { generateCompatibleMdx } from './mdx-compatibility.js';
import { standSequenceIndex } from './sequence-editor.js';
import { mirrorModel, transplantSkeleton } from './skeleton-transplant.js';
import { AUTO_FIX_KEYS, LEGACY_AUTO_FIX_KEYS, TOGGLE_CLASHES, TOGGLE_NEEDS, autoFixMirror } from './transplant-autofix.js';
import { heldContact } from './held-item.js';
import { rigFor } from './transfer-window.js';
import { createLookCheck } from './xfer-look.js';
import { verdict } from './xfer-look-verdict.js';

export const SUGGESTION_SAMPLING = Object.freeze({
  maxMoments: 21,
  clipKinds: /^(stand|walk|attack|spell)\b/i,
});

// Targeted repairs changed at most ten of the forty smoke pairs.
export const TARGETED_KEYS = new Set([
  'hand', 'markers', 'detached', 'trunk', 'arms', 'chains', 'looseAxis', 'gripRouting', 'surfaceGrip',
  'saddleDriver', 'trackWindow', 'authoredMotion', 'movingCarrier', 'wristGrip', 'sewnTorso', 'riderSeat', 'seatWeapon',
]);

const compared = (a, b) => a[0] - b[0] || a[1] - b[1];

function keysWithNeeds(keys) {
  const chosen = new Set(keys);
  for (const key of keys) for (const need of TOGGLE_NEEDS[key] ?? []) chosen.add(need);
  return AUTO_FIX_KEYS.filter(key => chosen.has(key));
}

/** Scores changed transplants as [reason count, sum of value / limit] in inventory order. */
export function suggestToggles(model, donor, options = {}, {
  plain = null,
  automaticMirror = options.mirror == null,
  check = createLookCheck(SUGGESTION_SAMPLING),
} = {}) {
  const ownRig = automaticMirror ? rigFor(model, Math.max(0, standSequenceIndex(model))) : null;
  const donorRig = automaticMirror ? rigFor(donor, Math.max(0, standSequenceIndex(donor))) : null;
  const named = !!(ownRig?.weaponSide && donorRig?.weaponSide && ownRig.weaponSide !== donorRig.weaponSide);
  const baseMirror = options.mirror ?? named;
  const plainOptions = { ...options, mirror: baseMirror, autoFix: false };
  const handMirror = automaticMirror && ownRig?.ok && donorRig?.ok
    ? autoFixMirror(model, ownRig, donor, donorRig) ?? baseMirror
    : baseMirror;
  const base = plain ?? transplantSkeleton(model, donor, plainOptions);
  const baseBytes = generateCompatibleMdx(base.model);

  const usableDonorPose = new Map();
  function build(keys) {
    const autoFix = Object.fromEntries(keys.map(key => [key, true]));
    const mirror = automaticMirror && autoFix.heldGeometry ? null : autoFix.hand ? handMirror : baseMirror;
    const built = transplantSkeleton(model, donor, { ...plainOptions, mirror, autoFix });
    const pose = built.report.donorPose;
    usableDonorPose.set(keys.join(','), !!pose?.enabled && !pose.retainedOwn && !Object.keys(pose.added).length);
    return { model: built.model, mirrored: mirror ?? built.report.mirrorOffer, weaponSeated: !!built.report.autoFix?.seatWeapon, looseGripSeated: built.report.autoFix?.seatLooseGrip };
  }

  let reflected;
  function measure(result, mirrored) {
    const shown = mirrored ? reflected ??= mirrorModel(donor) : donor;
    const { reasons } = verdict(check.measurePair(shown, result, { native: model }));
    return [reasons.length, reasons.reduce((sum, { value, limit }) => sum + value / limit, 0)];
  }

  const scores = { plain: measure(base.model, baseMirror) };
  const visible = [], candidates = [], measured = new Map([['', scores.plain]]);
  for (const key of AUTO_FIX_KEYS) {
    const result = build([key]);
    if (key === 'seatLooseGrip' && !result.looseGripSeated) continue;
    if (key === 'seatWeapon' && !result.weaponSeated) continue;
    const identical = baseBytes.equals(generateCompatibleMdx(result.model));
    if (identical && key !== 'donorPose' && key !== 'seatWeapon') continue;
    visible.push(key);
    if (identical && key !== 'seatWeapon') continue;
    scores[key] = measure(result.model, result.mirrored);
    measured.set(keysWithNeeds([key]).join(','), scores[key]);
    // Owner: "most times seamfix was used it made things worse".
    if (['seamFix', 'skinLandmarks', 'gripRouting'].includes(key)) continue;
    if (key === 'surfaceGrip') {
      const holdsWithBothHands = (m, rig) => heldContact(m, rig ?? rigFor(m, Math.max(0, standSequenceIndex(m))))?.twoHands;
      if (!holdsWithBothHands(model, ownRig) || !holdsWithBothHands(donor, donorRig)) continue;
    }
    const change = compared(scores[key], scores.plain);
    // A targeted repair only acts where its own fault test fires: it qualifies unless it adds a look-check reason.
    if (key === 'donorPose' && !usableDonorPose.get(key)) continue;
    if (key === 'seatWeapon' || change < 0 || TARGETED_KEYS.has(key) && scores[key][0] <= scores.plain[0]) candidates.push(key);
  }
  // A stronger key takes its clash group first. Ties prefer the original six, then inventory order.
  candidates.sort((a, b) => compared(scores[a], scores[b]) ||
    Number(LEGACY_AUTO_FIX_KEYS.includes(b)) - Number(LEGACY_AUTO_FIX_KEYS.includes(a)));
  const combo = new Set();
  for (const key of candidates) {
    if (key === 'surfaceGrip' && candidates.includes('seatWeapon')) continue;
    const group = TOGGLE_CLASHES.find(group => group.includes(key));
    if (group?.some(other => combo.has(other))) continue;
    combo.add(key);
  }

  function scoreCombo(keys) {
    const known = measured.get(keys.join(','));
    if (known) return known;
    const built = build(keys);
    return measure(built.model, built.mirrored);
  }

  let suggested = keysWithNeeds([...combo]);
  let comboScore = scoreCombo(suggested);
  if (compared(comboScore, scores.plain) > 0 && [...combo].some(key => !TARGETED_KEYS.has(key))) {
    suggested = keysWithNeeds([...combo].filter(key => TARGETED_KEYS.has(key)));
    comboScore = scoreCombo(suggested);
  }
  if (suggested.includes('donorPose')) {
    const without = suggested.filter(key => key !== 'donorPose'), score = scoreCombo(without);
    if (!usableDonorPose.get(suggested.join(',')) || compared(comboScore, score) >= 0) {
      suggested = without;
      comboScore = score;
    }
  }
  scores.suggested = comboScore;
  return { visible, suggested, scores };
}
