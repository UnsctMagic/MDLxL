// A clicked object's diamonds on the keyframe reel (owner, 14 Nov 2026): EMTR's shows/hides pairs for
// anything with a Visibility track (emitters, ribbons, lights, attachments) and one diamond per event frame.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { parseCompatibleMdx } from '../src/mdx-compatibility.js';
import { isGlobalTrack } from '../src/animation.js';
import { sampleAnimationProperty } from '../src/animation-tracks.js';
import { classicTimelineDomain } from '../src/classic-keyframes.js';
import { emitterSpans, setEmitterSpans, addSpan, normalizeSpans, eventDiamonds, setEventDiamonds, addEventFrame, timelineDiamonds } from '../src/emitter-timing.js';

const require = createRequire(import.meta.url);
const { fixturePath } = require('./helpers/fixtures.cjs');
const loadMdx = name => {
  const file = fixturePath(name); assert.ok(file && fs.existsSync(file), `fixture missing: ${file}`);
  const bytes = fs.readFileSync(file); return parseCompatibleMdx(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length));
};
const keysOf = track => track?.Keys ? track.Keys.map(key => [key.Frame, key.Vector[0]]) : track;
const outside = (track, [start, end]) => keysOf(track).filter(([frame]) => frame < start || frame > end);

// The chaos orc has a keyed light, attachments, an emitter and events; Attack is 13200-14067.
const orc = loadMdx('sd-chaos-orc');
const ATTACK = orc.Sequences.findIndex(clip => clip.Name === 'Attack');

test('a clicked light shows its on/off pairs and edits only this animation', () => {
  const model = structuredClone(orc), light = model.Lights[0], domain = classicTimelineDomain(model, ATTACK, null);
  const shown = timelineDiamonds(model, [light.ObjectId], domain);
  assert.equal(shown.kind, 'spans');
  assert.deepEqual(shown.groups, [[13200, 13267], [13333, 13400], [13467, 13533], [13633, 13700], [13767, 13833], [13900, 13967]]);
  const interval = Array.from(model.Sequences[ATTACK].Interval), others = outside(light.Visibility, interval);
  setEmitterSpans(model, light.ObjectId, ATTACK, [[13250, 13300], ...shown.groups.slice(1)]);
  assert.deepEqual(emitterSpans(model, light.ObjectId, ATTACK).spans[0], [13250, 13300], 'the dragged diamond moved');
  assert.deepEqual(outside(light.Visibility, interval), others, 'other animations keep their keys');
  assert.equal(light.Visibility.LineType, 0, 'on/off steps');
  setEmitterSpans(model, light.ObjectId, ATTACK, addSpan(timelineDiamonds(model, [light.ObjectId], domain).groups, ...interval));
  assert.equal(timelineDiamonds(model, [light.ObjectId], domain).groups.length, 7, '+ ◆◆ adds a pair');
});

test('a clicked attachment with no Visibility track shows one pair; editing keeps other animations visible', () => {
  const model = structuredClone(orc), weapon = model.Attachments.find(node => node.Visibility === undefined);
  const stand = classicTimelineDomain(model, 0, null);
  assert.deepEqual(timelineDiamonds(model, [weapon.ObjectId], stand).groups, [[67, 1400]]);
  const before = model.Sequences.map((_, index) => emitterSpans(model, weapon.ObjectId, index).spans);
  setEmitterSpans(model, weapon.ObjectId, 0, [[67, 700]]);
  assert.deepEqual(emitterSpans(model, weapon.ObjectId, 0).spans, [[67, 700]]);
  model.Sequences.forEach((_, index) => { if (index) assert.deepEqual(emitterSpans(model, weapon.ObjectId, index).spans, before[index], model.Sequences[index].Name); });
  // Removing the last pair hides it for this animation only.
  setEmitterSpans(model, weapon.ObjectId, 0, []);
  assert.deepEqual(emitterSpans(model, weapon.ObjectId, 0).spans, []);
  assert.deepEqual(emitterSpans(model, weapon.ObjectId, 1).spans, before[1]);
});

test('a clicked event shows a diamond per frame; move, add at the playhead and remove keep other animations', () => {
  const model = structuredClone(orc), sound = model.EventObjects.find(node => node.Name === 'SNDXKGYR');
  const decay = model.EventObjects.find(node => node.Name === 'SNDXDRIF'), domain = classicTimelineDomain(model, ATTACK, null);
  assert.deepEqual(timelineDiamonds(model, [sound.ObjectId], domain), { id: sound.ObjectId, sequence: ATTACK, global: null, kind: 'events', start: 13200, end: 14067, groups: [[13200], [13633]] });
  setEventDiamonds(model, sound.ObjectId, ATTACK, [13200, 13700]);
  assert.deepEqual(Array.from(sound.EventTrack), [13200, 13700], 'drag moves the frame');
  setEventDiamonds(model, sound.ObjectId, ATTACK, addEventFrame([13200, 13700], 13500, 13200, 14067));
  assert.deepEqual(Array.from(sound.EventTrack), [13200, 13500, 13700], '+ ◆ adds at the playhead');
  assert.throws(() => addEventFrame([13200, 13500], 13500, 13200, 14067), /already a diamond at frame 13500/);
  setEventDiamonds(model, sound.ObjectId, ATTACK, [13200, 13700]);
  assert.deepEqual(eventDiamonds(model, sound.ObjectId, ATTACK).frames, [13200, 13700], 'Remove');
  // The death sound plays in Death (14333): editing Attack never touches it.
  setEventDiamonds(model, decay.ObjectId, ATTACK, [13300]);
  assert.deepEqual(Array.from(decay.EventTrack), [13300, 14333]);
  assert.equal(sound.EventTrack instanceof Uint32Array, true);
});

test('global sequences: shown and edited only on that sequence\'s timeline', () => {
  const model = structuredClone(orc), light = model.Lights[0], sound = model.EventObjects[0];
  model.GlobalSequences = [1000];
  light.Visibility = { LineType: 0, GlobalSeqId: 0, Keys: [{ Frame: 0, Vector: new Float32Array([1]) }, { Frame: 400, Vector: new Float32Array([0]) }, { Frame: 1000, Vector: new Float32Array([0]) }] };
  sound.GlobalSeqId = 0; sound.EventTrack = new Uint32Array([250]);
  const local = classicTimelineDomain(model, ATTACK, null), global = classicTimelineDomain(model, -1, 0);
  assert.equal(timelineDiamonds(model, [light.ObjectId], local), null, 'not on an animation\'s timeline');
  assert.equal(timelineDiamonds(model, [sound.ObjectId], local), null);
  assert.deepEqual(timelineDiamonds(model, [light.ObjectId], global).groups, [[0, 400]]);
  assert.deepEqual(timelineDiamonds(model, [sound.ObjectId], global).groups, [[250]]);
  setEmitterSpans(model, light.ObjectId, -1, [[100, 600]], 0);
  assert.equal(light.Visibility.GlobalSeqId, 0, 'stays on its global sequence');
  assert.deepEqual(emitterSpans(model, light.ObjectId, -1, 0).spans, [[100, 600]]);
  setEventDiamonds(model, sound.ObjectId, -1, [300], 0);
  assert.deepEqual(Array.from(sound.EventTrack), [300]);
  // An emitter on an animation's clock is not shown on the global one.
  assert.equal(timelineDiamonds(model, [model.ParticleEmitters2[0].ObjectId], global), null);
});

test('diamonds belong to one clicked object: none for bones, several objects or All', () => {
  const light = orc.Lights[0].ObjectId, domain = classicTimelineDomain(orc, ATTACK, null);
  assert.equal(timelineDiamonds(orc, [], domain), null);
  assert.equal(timelineDiamonds(orc, [orc.Bones[0].ObjectId], domain), null);
  assert.equal(timelineDiamonds(orc, [light, orc.Attachments[0].ObjectId], domain), null);
  assert.equal(timelineDiamonds(orc, [light], classicTimelineDomain(orc, -1, null)), null);
});

// main 34bc89d6's emitterSpans and setEmitterSpans, copied so EMTR's results stay byte-identical.
const mainClip = (model, sequenceIndex) => Array.from(model.Sequences[sequenceIndex].Interval, Math.round);
function mainSpans(model, emitter, sequenceIndex) {
  const [start, end] = mainClip(model, sequenceIndex), id = emitter.ObjectId;
  if (isGlobalTrack(emitter.Visibility)) return { start, end, spans: [], global: true };
  const target = { kind: 'node', id, property: 'Visibility' }, on = frame => Number(sampleAnimationProperty(model, target, frame, sequenceIndex)) > 0;
  const changes = [...new Set((emitter.Visibility?.Keys || []).map(key => key.Frame).filter(frame => frame > start && frame < end))].sort((a, b) => a - b);
  const spans = []; let open = on(start) ? start : null;
  for (const frame of changes) { const visible = on(frame); if (visible && open === null) open = frame; else if (!visible && open !== null) { spans.push([open, frame]); open = null; } }
  if (open !== null) spans.push([open, end]);
  return { start, end, spans, global: false };
}
function mainSet(model, emitter, sequenceIndex, spans) {
  const [start, end] = mainClip(model, sequenceIndex), parts = normalizeSpans(spans, start, end), keys = new Map();
  if (emitter.Visibility?.Keys) { for (const key of emitter.Visibility.Keys) if (key.Frame < start || key.Frame > end) keys.set(key.Frame, key.Vector[0] > 0 ? 1 : 0); }
  else { const value = typeof emitter.Visibility === 'number' ? emitter.Visibility : 1; model.Sequences.forEach((clip, index) => { if (index !== sequenceIndex) for (const frame of clip.Interval) if (frame < start || frame > end) keys.set(Math.round(frame), value > 0 ? 1 : 0); }); }
  keys.set(start, parts[0]?.[0] === start ? 1 : 0);
  for (const [shows, hides] of parts) { if (shows > start) keys.set(shows, 1); if (hides < end) keys.set(hides, 0); }
  keys.set(end, parts.at(-1)?.[1] === end ? 1 : 0);
  emitter.Visibility = { LineType: 0, GlobalSeqId: null, Keys: [...keys].sort((a, b) => a[0] - b[0]).map(([Frame, value]) => ({ Frame, Vector: new Float32Array([value]) })) };
}

test('EMTR: every emitter and ribbon reads and writes exactly as before', () => {
  let compared = 0;
  for (const name of ['sd-chaos-orc', 'ribbon-attachment', 'optimizexl-exact-unit', 'effect']) {
    const model = loadMdx(name);
    for (const family of ['ParticleEmitters2', 'RibbonEmitters', 'ParticleEmitters', 'ParticleEmitterPopcorns']) for (const emitter of model[family] || []) {
      model.Sequences.forEach((_, index) => {
        assert.deepEqual(emitterSpans(model, emitter.ObjectId, index), mainSpans(model, emitter, index), `${name} ${emitter.Name} ${index}`);
        const timing = mainSpans(model, emitter, index);
        if (timing.global) { assert.throws(() => setEmitterSpans(structuredClone(model), emitter.ObjectId, index, [])); return; }
        let next; try { next = addSpan(timing.spans, timing.start, timing.end); } catch { next = timing.spans.slice(1); }
        const ours = structuredClone(model), theirs = structuredClone(model);
        setEmitterSpans(ours, emitter.ObjectId, index, next);
        mainSet(theirs, theirs[family].find(node => node.ObjectId === emitter.ObjectId), index, next);
        assert.deepEqual(ours[family].find(node => node.ObjectId === emitter.ObjectId).Visibility, theirs[family].find(node => node.ObjectId === emitter.ObjectId).Visibility, `${name} ${emitter.Name} ${index} write`);
        compared++;
      });
    }
  }
  assert.ok(compared > 20, `compared ${compared}`);
});
