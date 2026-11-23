import { generateCompatibleMdx } from './mdx-compatibility.js';
import { standSequenceIndex } from './sequence-editor.js';
import { mirrorModel, transplantSkeleton } from './skeleton-transplant.js';
import { AUTO_FIX_KEYS, TOGGLE_CLASHES, TOGGLE_NEEDS, autoFixMirror } from './transplant-autofix.js';
import { rigFor } from './transfer-window.js';
import { createLookCheck } from './xfer-look.js';
import { verdict } from './xfer-look-verdict.js';

export const SUGGESTION_SAMPLING = Object.freeze({
  maxMoments: 21,
  clipKinds: /^(stand|walk|attack|spell)\b/i,
});

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

  function build(keys) {
    const autoFix = Object.fromEntries(keys.map(key => [key, true]));
    const mirror = automaticMirror && autoFix.heldGeometry ? null : autoFix.hand ? handMirror : baseMirror;
    const built = transplantSkeleton(model, donor, { ...plainOptions, mirror, autoFix });
    return { model: built.model, mirrored: mirror ?? built.report.mirrorOffer };
  }

  let reflected;
  function measure(result, mirrored) {
    const shown = mirrored ? reflected ??= mirrorModel(donor) : donor;
    const { reasons } = verdict(check.measurePair(shown, result, { native: model }));
    return [reasons.length, reasons.reduce((sum, { value, limit }) => sum + value / limit, 0)];
  }

  const scores = { plain: measure(base.model, baseMirror) };
  const visible = [], improved = [];
  for (const key of AUTO_FIX_KEYS) {
    const result = build([key]);
    if (baseBytes.equals(generateCompatibleMdx(result.model))) continue;
    visible.push(key);
    scores[key] = measure(result.model, result.mirrored);
    if (compared(scores[key], scores.plain) < 0) improved.push(key);
  }
  if (!improved.length) {
    scores.suggested = scores.plain;
    return { visible, suggested: [], scores };
  }

  // Stable ties follow the inventory; a stronger key takes its group first.
  improved.sort((a, b) => compared(scores[a], scores[b]));
  const combo = new Set();
  for (const key of improved) {
    const group = TOGGLE_CLASHES.find(group => group.includes(key));
    if (group?.some(other => combo.has(other))) continue;
    combo.add(key);
  }
  const best = improved[0];
  let suggested = keysWithNeeds([...combo]);
  const bestKeys = keysWithNeeds([best]);
  let comboScore = scores[best];
  if (suggested.length !== bestKeys.length || suggested.some((key, i) => key !== bestKeys[i])) {
    const built = build(suggested);
    comboScore = measure(built.model, built.mirrored);
  }
  if (compared(comboScore, scores[best]) > 0) {
    suggested = bestKeys;
    comboScore = scores[best];
  }
  scores.suggested = comboScore;
  return { visible, suggested, scores };
}
