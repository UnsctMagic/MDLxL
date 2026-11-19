import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { openDocument } from '../src/editor-document.js';
import { allNodes } from '../src/animation.js';
import { ANIMXL_DEFAULTS, applyAnimXL, buildAnimXL } from '../src/anim-xl.js';
import { animationEditReport, compareStyle, motionChecks, motionStyle, sequenceChanges } from '../src/ai-motion-style.js';
import { sampleAiModel } from '../src/ai-sampling.js';
import { AI_TOOLS } from '../src/ai-tools.js';
import { validateArguments } from '../electron/ai-mcp.cjs';

const { fixturePath, testModel } = createRequire(import.meta.url)('./helpers/fixtures.cjs');
const footmanFile = fixturePath('citadel-footman'), knightFile = testModel('corpus-sd/undead__herodeathknight.mdx');
const elementalFile = testModel('corpus-sd/human__waterelemental.mdx');
const missing = (...files) => files.some(file => !file || !fs.existsSync(file)) && 'test model not on this machine';
const load = file => openDocument(fs.readFileSync(file), 'model.mdx').model;
const node = (model, name) => allNodes(model).find(n => n.Name === name);
const ATTACK = 4, WALK = 6, STAND = 0; // Footman: Attack - 1, Walk, Stand - 1
const row = (result, name) => result.animations.find(r => r.name === name);

test('a Blizzard attack has few keys and moves like linear; an AnimXL-smoothed copy does not', { skip: missing(footmanFile) }, () => {
  const original = load(footmanFile), smooth = load(footmanFile);
  applyAnimXL(smooth, buildAnimXL(smooth, ATTACK, { ...ANIMXL_DEFAULTS, ease: 100, overlap: 60 }));
  const a = motionStyle(original, ATTACK), b = motionStyle(smooth, ATTACK);
  assert.equal(a.name, 'Attack - 1'); assert.equal(a.kind, 'attack');
  assert.equal(a.keys.perTrack.median, 6);
  assert.ok(a.interpolation.measured.linear > .9, `original linear ${a.interpolation.measured.linear}`);
  assert.ok(a.strike.pct >= 35 && a.strike.pct <= 45, `strike ${a.strike.pct}%`);
  assert.ok(a.impact.pct >= a.strike.pct && a.windUpMs > 200);
  assert.ok(b.keys.perTrack.median >= 3 * a.keys.perTrack.median, `smoothed keys ${b.keys.perTrack.median}`);
  assert.ok(b.keys.spacingMs.median < a.keys.spacingMs.median / 3);
  assert.ok(b.interpolation.measured.linear < .3, `smoothed linear ${b.interpolation.measured.linear}`);
  assert.deepEqual(a.bones.columns, ['id', 'name', 'keys', 'spacingMs', 'authored', 'linear', 'travelDeg', 'peakDegPerS', 'peakPct']);
  assert.equal(a.bones.rows[0][1], 'Bone_Hand_R', 'the sword hand turns most');
  assert.equal(a.speed.curve.length, 20);
  assert.ok(a.native && a.native.kind === 'attack' && a.native.linear.percentileRange, 'the Blizzard range for attacks');
  const { differences } = compareStyle(smooth, ATTACK, original, ATTACK);
  assert.ok(differences.includes('keys per track (median) 21 vs donor 6'), differences.join('\n'));
  assert.ok(differences.some(line => /^moves like linear between keys \d+% vs donor 9\d%$/.test(line)), differences.join('\n'));
  assert.ok(differences.some(line => /^strike \(fastest moment\) at \d+% vs donor 40%$/.test(line)), differences.join('\n'));
});

test('the sample tool compares an animation with a donor model and with the native range', { skip: missing(footmanFile, knightFile) }, async () => {
  const footman = load(footmanFile), knight = load(knightFile), schema = AI_TOOLS.find(t => t.name === 'mdlxl_sample').inputSchema;
  validateArguments(schema, { target: 't', style: { sequence: ATTACK, donor: { documentId: 'd' } } });
  validateArguments(schema, { target: 't', checks: { sequences: [0, 4] }, since: 'original' });
  assert.throws(() => validateArguments(schema, { target: 't', style: { donor: {} } }), /documentId is required/);
  const result = await sampleAiModel(footman, { sequence: ATTACK }, { style: { donor: { documentId: 'knight' } } }, undefined, { donor: knight });
  assert.equal(result.style.model.name, 'Attack - 1');
  assert.equal(result.style.donor.name, 'Attack -1', 'the donor animation of the same kind');
  assert.ok(result.style.differences.some(line => line.startsWith('strike (fastest moment) at 40% vs donor')));
  await assert.rejects(async () => sampleAiModel(footman, { sequence: ATTACK }, { style: { donor: { documentId: 'gone' } } }), /donor model is not open/);
  const own = await sampleAiModel(footman, { sequence: WALK }, { style: {} });
  assert.equal(own.style.name, 'Walk');
});

test('owner checks: Blizzard loops close; a broken loop, a sliding foot, a snap and a twisted socket show', { skip: missing(footmanFile) }, () => {
  const original = load(footmanFile), clean = motionChecks(original, { sequences: [STAND, ATTACK, WALK] });
  assert.equal(clean.reference, 'Stand - 1');
  assert.equal(row(clean, 'Stand - 1').seam.max, 0);
  assert.equal(row(clean, 'Walk').seam.max, 0);
  assert.ok(row(clean, 'Attack - 1').ends && !row(clean, 'Attack - 1').seam);
  const feet = row(clean, 'Attack - 1').feet;
  assert.deepEqual(feet.rows.map(r => r.name).sort(), ['Bone_Foot_L', 'Bone_Foot_R']);
  assert.equal(row(clean, 'Walk').feet.measured, 'slideAtMoveSpeed');
  assert.ok(row(clean, 'Walk').events.some(e => e.name === 'FPTxFBL1' && Math.abs(e.footfallOffsetMs) <= 33));
  assert.equal(row(clean, 'Attack - 1').warnings.count, 0);
  const quiet = row(clean, 'Attack - 1');

  const broken = load(footmanFile), [start, end] = broken.Sequences[WALK].Interval;
  const pelvis = node(broken, 'Bone_Pelvis');
  pelvis.Translation ||= { LineType: 1, GlobalSeqId: null, Keys: [{ Frame: start, Vector: new Float32Array(3) }] };
  const last = pelvis.Translation.Keys.find(k => k.Frame === end);
  if (last) last.Vector = Float32Array.from(last.Vector, (v, i) => v + (i === 2 ? 12 : 0));
  else pelvis.Translation.Keys.push({ Frame: end, Vector: new Float32Array([0, 0, 12]) }), pelvis.Translation.Keys.sort((a, b) => a.Frame - b.Frame);
  assert.ok(row(motionChecks(broken, { sequences: [WALK] }), 'Walk').seam.max >= 10, 'a lifted last walk pose breaks the loop seam');

  const sliding = load(footmanFile), root = node(sliding, 'Bone_Root'), [as, ae] = sliding.Sequences[ATTACK].Interval;
  root.Translation ||= { LineType: 1, GlobalSeqId: null, Keys: [] };
  root.Translation.Keys = root.Translation.Keys.filter(k => k.Frame < as || k.Frame > ae)
    .concat([{ Frame: as, Vector: new Float32Array([0, 0, 0]) }, { Frame: ae, Vector: new Float32Array([40, 0, 0]) }]).sort((a, b) => a.Frame - b.Frame);
  root.Translation.LineType = 1;
  const slid = row(motionChecks(sliding, { sequences: [ATTACK] }), 'Attack - 1').feet;
  assert.ok(slid.maxSlide > quiet.feet.maxSlide + 20, `slide ${quiet.feet.maxSlide} -> ${slid.maxSlide}`);

  const snapped = load(footmanFile), hand = node(snapped, 'Bone_Hand_R'), keys = hand.Rotation.Keys;
  const at = keys.findIndex(k => k.Frame > as + 600 && k.Frame < ae);
  keys.splice(at, 0, { Frame: keys[at].Frame - 1, Vector: keys[at - 1].Vector.slice(), InTan: keys[at - 1].Vector.slice(), OutTan: keys[at - 1].Vector.slice() });
  keys[at + 1].Vector = new Float32Array([1, 0, 0, 0]); keys[at + 1].InTan = keys[at + 1].OutTan = keys[at + 1].Vector.slice();
  const turns = row(motionChecks(snapped, { sequences: [ATTACK] }), 'Attack - 1').turns;
  assert.ok(turns.some(t => t.node === 'Bone_Hand_R' && t.deg > 90), JSON.stringify(turns));

  const twisted = load(footmanFile), lowest = quiet.sockets[0], bone = allNodes(twisted).find(n => lowest.group.split('+').includes(n.Name.replace(/^Bone_/, '')));
  bone.Rotation ||= { LineType: 2, GlobalSeqId: null, Keys: [] };
  bone.Rotation.Keys = bone.Rotation.Keys.filter(k => k.Frame < as || k.Frame > ae).concat([as, ae].map(Frame =>
    ({ Frame, Vector: new Float32Array([0.996, 0, 0, 0.087]), InTan: new Float32Array([0.996, 0, 0, 0.087]), OutTan: new Float32Array([0.996, 0, 0, 0.087]) }))).sort((a, b) => a.Frame - b.Frame);
  const sockets = row(motionChecks(twisted, { sequences: [ATTACK] }), 'Attack - 1').sockets;
  const same = sockets.find(s => s.group === lowest.group) || sockets[0];
  assert.ok(same.lowest < lowest.lowest && same.lowest < same.ownLowest, `${JSON.stringify(lowest)} -> ${JSON.stringify(same)}`);
});

test('since lists only the animation an edit changed; the edit report says the rest stayed identical', { skip: missing(footmanFile) }, async () => {
  const before = load(footmanFile), after = load(footmanFile), [as, ae] = after.Sequences[ATTACK].Interval;
  const key = node(after, 'Bone_Hand_R').Rotation.Keys.find(k => k.Frame > as && k.Frame < ae);
  key.Vector = new Float32Array([0.7, 0, 0, 0.7]);
  const changes = sequenceChanges(before, after);
  assert.deepEqual(changes.changed, ['Attack - 1']);
  assert.equal(changes.identical, after.Sequences.length - 1);
  assert.ok(changes.animations.filter(r => r.name !== 'Attack - 1').every(r => r.keysIdentical && r.maxDifference === 0));
  const attack = changes.animations.find(r => r.name === 'Attack - 1');
  assert.equal(attack.tracksChanged, 1); assert.ok(attack.maxDifference > 1);
  const viaTool = await sampleAiModel(after, { sequence: 0 }, { since: 'original' }, undefined, { since: before });
  assert.equal(viaTool.since.version, 'original'); assert.deepEqual(viaTool.since.changed, ['Attack - 1']);
  assert.equal(animationEditReport(before, structuredClone(before)), null);
  const report = animationEditReport(before, after);
  assert.deepEqual(report.changed, ['Attack - 1']); assert.equal(report.unchanged, after.Sequences.length - 1);
  assert.ok(Array.isArray(report.newWarnings));
});

test('samples give geoset alpha and colour and texture animation values at each frame', { skip: missing(footmanFile, elementalFile) }, () => {
  const footman = load(footmanFile), death = footman.Sequences.findIndex(s => s.Name === 'Decay Flesh');
  const [start, end] = footman.Sequences[death].Interval;
  const sampled = sampleAiModel(footman, { sequence: death }, { frames: [start, end], geosetIds: [0] });
  assert.equal(sampled.samples[0].geosets[0].alpha, 1);
  assert.deepEqual(sampled.samples[0].geosets[0].color, [1, 1, 1]);
  assert.ok(!('textureAnims' in sampled.samples[0]), 'no texture animations, no field');
  const elemental = load(elementalFile), walk = elemental.Sequences.findIndex(s => /walk/i.test(s.Name));
  const [ws, we] = elemental.Sequences[walk].Interval;
  const water = sampleAiModel(elemental, { sequence: walk }, { frames: [ws, Math.round((ws + we) / 2)], geosetIds: [] });
  assert.equal(water.samples[0].textureAnims.length, 2);
  assert.deepEqual(Object.keys(water.samples[0].textureAnims[0]), ['id', 'translation', 'rotation', 'scaling']);
  const moved = water.samples.map(s => s.textureAnims.map(t => t.translation.join()));
  assert.notDeepEqual(moved[0], moved[1], 'the water texture scrolls');
});
