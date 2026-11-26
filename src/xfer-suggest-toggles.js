import { generateCompatibleMdx } from './mdx-compatibility.js';
import { standSequenceIndex } from './sequence-editor.js';
import { mirrorModel, transplantSkeleton } from './skeleton-transplant.js';
import { AUTO_FIX_KEYS, FRONT_LEG_KEYS, LEGACY_AUTO_FIX_KEYS, OWNER_REJECTED_KEYS, TOGGLE_CLASHES, TOGGLE_NEEDS, autoFixMirror, toggleRepair } from './transplant-autofix.js';
import { SCORE_RULES, holesWorse, judgeResult, scoreResult } from './xfer-scorecard.js';
import { heldContact } from './held-item.js';
import { rigFor, transplantRepairOptions } from './transfer-window.js';
import { createLookCheck } from './xfer-look.js';
import { spareFrontLegs } from './transplant-gait.js';
import { attackExcess, gripReading, handGapRows, leavesHand, readWeapon, rollFromOwn, seatWithheld, secondHandShare, shaftAngle, TWO_HANDED_SHARE, weaponTurn } from './transplant-weapon-seat.js';
import { worldPivot, sampleNodeMatrices } from './animation.js';
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

// Front legs (Mirror legs / Use arms) are a choice, picked by rule, not scored: Use arms wherever it applies (frontLegPick).
// The donor's lean (the line from the middle of its leg roots to the middle of its arm roots, from upright at its Stand
// reference) was the step 5b rule and is still read for the record: Cold One 76, Ghoul 74, Abomination 30, Kobold 11,
// Footman 5, Grunt 4.
export const BEAST_LEAN = 45;

/** Degrees from upright of the line from the middle of the rig's leg roots to the middle of its arm roots; null
 * without both. */
export function bodyLean(model, rig) {
  const parts = Object.values(rig?.parts || {});
  const legs = parts.filter(p => p.limbKind === 'leg'), arms = parts.filter(p => p.limbKind === 'arm' && /^arm[LR]$/.test(p.key));
  if (!rig?.ok || !legs.length || arms.length < 2) return null;
  const world = sampleNodeMatrices(model, rig.reference?.frame ?? 0, Math.max(0, rig.reference?.sequence ?? 0));
  const middle = list => {
    const points = list.map(p => worldPivot(model, p.joints[0], world, model.Nodes[p.joints[0]]));
    return points.slice(1).reduce((sum, point) => sum.add(point), points[0].clone()).divideScalar(points.length);
  };
  const line = middle(arms).sub(middle(legs));
  return line.lengthSq() > 1e-12 ? Math.acos(Math.min(1, Math.max(-1, line.z / line.length()))) * 180 / Math.PI : null;
}

/** Which front-leg checkbox to suggest: Use arms whenever this model has spare front legs on both sides, no arms of its
 * own, and the donor has arms (owner, 26 Nov: "the results with use arms are great"; decision 6). Mirror legs is never
 * suggested; it stays a box the user can tick. A rider on a four-legged mount has arms: nothing is suggested. `lean` is
 * kept in the reading for the record only. */
export function frontLegPick({ spare, ownArms, donorArms }) {
  return spare && !ownArms && donorArms ? 'useArms' : null;
}

/** Rules gained and lost from one judged result to another. Holes only veto: closing holes gains nothing, and a result
 * loses a rule when its seams tear worse (holesWorse), not by the hole rule's pass or fail. */
export function ruleChange(before, after) {
  const others = SCORE_RULES.filter(k => k !== 'holes');
  return {
    gained: others.filter(k => before.rules[k]?.pass === false && after.rules[k]?.pass === true).length,
    lost: others.filter(k => before.rules[k]?.pass === true && after.rules[k]?.pass === false).length +
      (holesWorse(before.rules.holes, after.rules.holes) ? 1 : 0),
  };
}

/** Scores changed transplants as [reason count, sum of value / limit] in inventory order. */
export function suggestToggles(model, donor, options = {}, {
  plain = null,
  automaticMirror = options.mirror == null,
  check = createLookCheck(SUGGESTION_SAMPLING),
  rules = true,
  rejected = OWNER_REJECTED_KEYS,
} = {}) {
  // The owner's verdict outranks every measurement: a blocked key is never a candidate, never flipped on by the rules
  // step, and is filtered from the result last, so no stage can add it back. It stays in `visible` for the user to tick.
  const blocked = new Set(rejected);
  const allowed = keys => keys.filter(key => !blocked.has(key));
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
    const resolved = transplantRepairOptions(model,donor,{...plainOptions,mirror,autoFix},automaticMirror);
    const built = transplantSkeleton(model, donor, resolved);
    const pose = built.report.donorPose;
    usableDonorPose.set(keys.join(','), !!pose?.enabled && !pose.retainedOwn && !Object.keys(pose.added).length);
    return { model: built.model, mirrored: resolved.mirror ?? built.report.mirrorOffer, weaponSeated: built.report.autoFix?.seatWeapon, looseGripSeated: built.report.autoFix?.seatLooseGrip };
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
    if (blocked.has(key) || FRONT_LEG_KEYS.includes(key) || ['skinLandmarks', 'gripRouting', 'gripInHand'].includes(key)) continue;
    if (key === 'surfaceGrip') {
      const holdsWithBothHands = (m, rig) => heldContact(m, rig ?? rigFor(m, Math.max(0, standSequenceIndex(m))))?.twoHands;
      if (!holdsWithBothHands(model, ownRig) || !holdsWithBothHands(donor, donorRig)) continue;
    }
    const change = compared(scores[key], scores.plain);
    // A targeted repair only acts where its own fault test fires: it qualifies unless it adds a look-check reason.
    if (key === 'donorPose' && !usableDonorPose.get(key)) continue;
    if (key === 'seatWeapon') {
      if (result.weaponSeated.every(item => Number.isFinite(item.after)) &&
          result.weaponSeated.reduce((sum,item) => sum+item.before-item.after,0) > .01*result.weaponSeated.length) candidates.push(key);
      continue;
    }
    if (change < 0 || TARGETED_KEYS.has(key) && scores[key][0] <= scores.plain[0]) candidates.push(key);
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
  if (suggested.includes('seatWeapon')) {
    const items=build(suggested).weaponSeated;
    if (!items?.length || !items.every(item => Number.isFinite(item.before) && Number.isFinite(item.after)) ||
        items.reduce((sum,item)=>sum+item.before-item.after,0)<=.01*items.length) {
      suggested=suggested.filter(key=>key!=='seatWeapon');
      comboScore=scoreCombo(suggested);
    }
  }
  // Seat weapon only where there is something to repair (plan step 6, owner on reasonable-32: "the before is a better
  // transfer"): whenever it is shown, the suggested ticks are built without and with it once; when the plain result already
  // holds the weapon as the model's own animations do and Seat changes that grip without gaining a second hand
  // (seatWithheld), Seat is blocked for this pair, so no later stage can tick it. Its numbers are kept in scores.seat.
  if (visible.includes('seatWeapon')) {
    const without = suggested.filter(key => key !== 'seatWeapon' && key !== 'donorPose');
    const plainSeat = build(without), seated = build(toggleRepair(without, 'seatWeapon', true));
    const weapon = readWeapon(model, ownRig ?? rigFor(model, Math.max(0, standSequenceIndex(model))));
    const shownDonor = plainSeat.mirrored === true ? reflected ??= mirrorModel(donor) : donor;
    const donorWeapon = readWeapon(shownDonor, rigFor(shownDonor, Math.max(0, standSequenceIndex(shownDonor))));
    const turn = weapon ? weaponTurn(plainSeat.model, seated.model, weapon) : null;
    const numbers = {
      own: weapon && gripReading(weapon, model), plain: weapon && gripReading(weapon, plainSeat.model),
      seated: weapon && gripReading(weapon, seated.model), shaft: weapon ? shaftAngle(plainSeat.model, weapon, shownDonor, donorWeapon) : null,
      turn: turn?.turn ?? null, roll: turn?.roll ?? null, flat: turn?.flat ?? null, support: !!seated.weaponSeated?.some(item => item.support),
      // Rolls from the model's own grip (plan step 6 fix); `roll` (plain to seated) is kept for the record only.
      rollPlain: weapon ? rollFromOwn(model, weapon, plainSeat.model) : null, rollSeated: weapon ? rollFromOwn(model, weapon, seated.model) : null,
    };
    const reason = seatWithheld(numbers);
    scores.seat = { ...numbers, withheld: reason };
    if (reason) {
      blocked.add('seatWeapon');
      if (suggested.includes('seatWeapon')) { suggested = suggested.filter(key => key !== 'seatWeapon'); comboScore = scoreCombo(suggested); }
    }
  }
  // The owner's six rules (src/xfer-scorecard.js, docs/agent-tasks/xfer-finish-line.md): a shown checkbox is flipped when
  // that passes at least one more rule and fails none that passed. The helpful flips are applied together; if together
  // they fail a rule that passed, only the flip passing the most rules is kept.
  if (rules) {
    const judged = keys => { const built = build(keys); return judgeResult(scoreResult(model, donor, built.model, built.mirrored === true)); };
    const ticks = suggested.filter(key => key !== 'donorPose'), pose = suggested.includes('donorPose');
    const before = judged(ticks);
    const change = r => ruleChange(before, r);
    const helpful = [];
    for (const key of visible) {
      // Two-hand grip is decided in one place below (plan step 7), not by the six rules.
      if (key === 'donorPose' || key === 'surfaceGrip' || key === 'gripInHand' || blocked.has(key) || FRONT_LEG_KEYS.includes(key)) continue;
      const checked = !ticks.includes(key), flipped = toggleRepair(ticks, key, checked);
      const { gained, lost } = change(judged(flipped));
      if (gained && !lost) helpful.push({ key, checked, gained });
    }
    if (helpful.length) {
      let keys = ticks;
      for (const { key, checked } of helpful) keys = toggleRepair(keys, key, checked);
      if (helpful.length > 1 && change(judged(keys)).lost) {
        const best = helpful.sort((a, b) => b.gained - a.gained)[0];
        keys = toggleRepair(ticks, best.key, best.checked);
      }
      suggested = pose ? toggleRepair(keys, 'donorPose', true) : keys;
      comboScore = scoreCombo(suggested);
      scores.rules = helpful.map(({ key, checked, gained }) => ({ key, checked, gained }));
    }
    // Holes only veto (plan step 3 and its fix): when the suggested ticks tear the mesh worse than the plain result, the
    // first tick whose removal makes it no longer worse than plain is dropped and blocked for this pair.
    const finalTicks = suggested.filter(key => key !== 'donorPose');
    const holes = (helpful.length ? judged(finalTicks) : before).rules.holes;
    // Worse needs more than two torn seams, so the plain result is scored only then.
    const plainHoles = finalTicks.length && holes?.torn > 2 ? scoreResult(model, donor, base.model, baseMirror === true).rules.holes : holes;
    if (holesWorse(plainHoles, holes)) {
      const culprit = finalTicks.find(key => !FRONT_LEG_KEYS.includes(key) && !holesWorse(plainHoles, judged(toggleRepair(finalTicks, key, false)).rules.holes));
      if (culprit) {
        blocked.add(culprit);
        suggested = toggleRepair(suggested, culprit, false);
        comboScore = scoreCombo(suggested);
        scores.holes = { dropped: culprit, torn: holes.torn, worst: holes.worst };
      }
    }
    // Weapon in hand (plan step 9, decision 18): only for a weapon that leaves the hand during an attack (leavesHand), when
    // the box cuts that excess by 0.1 or more and no rule is lost; never with Seat suggested. Before the Two-hand grip.
    if (visible.includes('gripInHand') && !suggested.includes('gripInHand') && !suggested.includes('seatWeapon') && !blocked.has('gripInHand')) {
      const ticks = suggested.filter(key => key !== 'donorPose'), without = build(ticks);
      const shownDonor = without.mirrored === true ? reflected ??= mirrorModel(donor) : donor;
      const reading = handGapRows(model, shownDonor, without.model), leaves = reading && leavesHand(reading);
      let take = false, withExcess = null, lost = null;
      if (leaves) {
        const kept = build(toggleRepair(ticks, 'gripInHand', true));
        withExcess = attackExcess(handGapRows(model, shownDonor, kept.model), leaves.clip);
        if (withExcess != null && leaves.excess - withExcess >= .1) {
          const judge = built => judgeResult(scoreResult(model, donor, built.model, built.mirrored === true));
          lost = ruleChange(judge(without), judge(kept)).lost;
          take = lost === 0;
        }
      }
      scores.gripInHand = { leaves, withExcess, lost, suggested: take };
      if (take) {
        suggested = toggleRepair(suggested, 'gripInHand', true);
        comboScore = scoreCombo(suggested);
      }
    }
    // Two-hand grip (plan step 7): built with and without it on the final ticks; suggested only when the donor holds its
    // weapon with both hands in some animation (TWO_HANDED_SHARE of its moments), the result's second hand gains 0.1 or more
    // of those moments, and no rule is lost (jitter, near-twin and holes included).
    if (visible.includes('surfaceGrip') && !suggested.includes('surfaceGrip') && !blocked.has('surfaceGrip')) {
      const ticks = suggested.filter(key => key !== 'donorPose'), withGrip = toggleRepair(ticks, 'surfaceGrip', true);
      const without = build(ticks), gripped = build(withGrip);
      const shownDonor = without.mirrored === true ? reflected ??= mirrorModel(donor) : donor;
      const shareWithout = secondHandShare(model, shownDonor, without.model), shareWith = secondHandShare(model, shownDonor, gripped.model);
      const twoHanded = !!shareWith?.clips.some(clip => clip.donorOn >= TWO_HANDED_SHARE);
      const gain = (shareWith?.share ?? 0) - (shareWithout?.share ?? 0);
      const judge = built => judgeResult(scoreResult(model, donor, built.model, built.mirrored === true));
      const { lost } = twoHanded && gain >= .1 ? ruleChange(judge(without), judge(gripped)) : { lost: null };
      const take = twoHanded && gain >= .1 && lost === 0;
      scores.secondHand = { twoHanded, without: shareWithout?.share ?? null, with: shareWith?.share ?? null, lost, suggested: take };
      if (take) {
        suggested = toggleRepair(suggested, 'surfaceGrip', true);
        comboScore = scoreCombo(suggested);
      }
    }
  }
  // The front-leg choice is added last, by rule (frontLegPick), when its box is shown.
  let chosen = suggested.filter(key => !FRONT_LEG_KEYS.includes(key));
  if (FRONT_LEG_KEYS.some(key => visible.includes(key))) {
    const mine = ownRig ?? rigFor(model, Math.max(0, standSequenceIndex(model)));
    const theirs = donorRig ?? rigFor(donor, Math.max(0, standSequenceIndex(donor)));
    const pick = frontLegPick({ spare: spareFrontLegs(model, donor, mine, theirs), ownArms: !!(mine?.parts?.armL || mine?.parts?.armR),
      donorArms: !!(theirs?.parts?.armL && theirs?.parts?.armR), lean: bodyLean(donor, theirs) });
    if (pick && visible.includes(pick)) chosen = toggleRepair(chosen, pick, true);
  }
  const kept = allowed(chosen);
  if (kept.join(',') !== suggested.join(',')) comboScore = scoreCombo(kept);
  scores.suggested = comboScore;
  return { visible, suggested: kept, scores };
}
