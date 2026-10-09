import test from 'node:test';
import assert from 'node:assert/strict';
import { isEasyOneHandShortcut, easyShortcutForAction, ShredderCoach, shredderMordorWarning } from '../src/shredder-coach.js';
import { prepareShredderAttack, currentShredderAttack, moveShredderVertex } from '../src/shredder-chaos.js';
import { createStarterDocument } from '../src/starter-model.js';
import { openDocument } from '../src/editor-document.js';
import { LANGUAGES, translate } from '../src/localization.js';
import { normalizePreferences } from '../src/preferences.js';

test('one-hand advice rejects wide reaches and leader sequences, including the supplied example', () => {
  for (const key of ['Z+1', 'Q', 'M', 'F1', 'Ctrl+Z', 'Ctrl+Shift+Z', 'Ctrl+S', 'Ctrl+P', 'Alt+1']) assert.equal(isEasyOneHandShortcut(key), true, key);
  for (const key of ['Z+1+0', 'Ctrl+Alt+Space > A01', 'Ctrl+F12', 'Ctrl+N', 'Ctrl+Shift+Alt+Q', '', 'Control', 'wat']) assert.equal(isEasyOneHandShortcut(key), false, key);
  assert.equal(easyShortcutForAction('move', { move: ['Ctrl+N', 'Q'], other: ['Ctrl+N'] }), 'Q');
  assert.equal(easyShortcutForAction('move', { move: ['Q'], other: ['Q'] }), '', 'a conflicting persisted binding is never advised');
  assert.equal(easyShortcutForAction('move', { move: [] }), '', 'cleared shortcuts stay cleared');
});

test('advice reacts to a few clicks, ignored advice produces anger within seconds, and shortcuts earn a response', () => {
  const coach = new ShredderCoach(), usage = { id: 'move', source: 'mouse', label: 'Move vertices', key: 'Q' };
  assert.equal(coach.use(usage, 0), null);
  assert.equal(coach.use(usage, 400).kind, 'tip');
  assert.equal(coach.use(usage, 800), null);
  assert.equal(coach.use(usage, 1200), null);
  assert.equal(coach.use(usage, 2400).reminder, true);
  for (const now of [3000, 3600, 4200]) assert.equal(coach.use(usage, now), null);
  assert.equal(coach.use(usage, 4800).kind, 'tantrum');
  for (let now = 6000; now < 29000; now += 1000) assert.equal(coach.use(usage, now), null, 'the short tantrum is followed by peace');
  const following = [];
  for (let now = 30000; now < 65000; now += 1000) { const result = coach.use(usage, now); if (result) following.push(result.kind); }
  assert.ok(following.includes('tip'), 'useful advice continues');
  assert.ok(!following.includes('tantrum'), 'harassment happens only once per enabled session');
  assert.equal(coach.use({ ...usage, source: 'shortcut' }, 66000).kind, 'learned');
  assert.equal(coach.attention, null);
  assert.equal(coach.use(usage, 67000), null);
  assert.equal(coach.use(usage, 72000).kind, 'tip');
  const sparse = new ShredderCoach();
  for (const now of [0, 50000, 100000]) assert.equal(sparse.use(usage, now), null, 'occasional mouse use is fine');
  assert.equal(sparse.use({ ...usage, key: '' }, 100001), null, 'no easy shortcut means no advice');
});

test('mixed editing actions receive advice, and unbound editing clicks count only after advice was shown', () => {
  const coach = new ShredderCoach();
  for (let index = 0; index < 3; index++) assert.equal(coach.use({ id: String(index), source: 'mouse', label: 'Tool', key: 'Q' }, index * 500), null);
  const tip = coach.use({ id: 'rotate', source: 'mouse', label: 'Rotate', key: 'R' }, 1500);
  assert.equal(tip.key, 'R');
  const results = [];
  for (let index = 1; index <= 8; index++) { const result = coach.use({ id: '', source: 'mouse', key: '' }, 1500 + index * 700); if (result) results.push(result); }
  assert.deepEqual(results.map(result => result.kind), ['tip', 'tantrum']);
  assert.equal(results[0].key, 'R', 'the reminder teaches the actual previously displayed shortcut');
  const untaught = new ShredderCoach();
  for (let index = 0; index < 50; index++) assert.equal(untaught.use({ id: '', source: 'mouse', key: '' }, index * 500), null);
});

test('proactive advice can be followed immediately and never accuses idle users of ignoring it', () => {
  const coach = new ShredderCoach(), usage = { id: 'move', label: 'Move', key: 'Q' };
  assert.equal(coach.offer(usage, 0, true).proactive, true);
  assert.equal(coach.use({ ...usage, source: 'shortcut' }, 500).kind, 'learned');
  assert.equal(coach.tantrumUsed, false);
  coach.offer(usage, 1000, true);
  assert.equal(coach.use({ ...usage, source: 'mouse' }, 40000), null, 'an idle gap starts a fresh click rhythm');
});

test('both entry directions ask exactly once, and unrelated settings never ask', () => {
  const off = { language: 'en', shredderEnabled: false }, bird = { ...off, shredderEnabled: true }, dark = { ...off, language: 'mordor' }, chaos = { ...dark, shredderEnabled: true };
  assert.equal(shredderMordorWarning(bird, chaos), 'Do not tempt Shredder with the powers of Mordor');
  assert.equal(shredderMordorWarning(dark, chaos), 'Do not summon this beast into the lands of Mordor...');
  for (const [before, after] of [[off, bird], [off, dark], [chaos, chaos], [chaos, dark], [chaos, bird]]) assert.equal(shredderMordorWarning(before, after), '');
  assert.equal(normalizePreferences().shredderEnabled, false);
  assert.equal(normalizePreferences({ shredderEnabled: true }).shredderEnabled, true);
  assert.equal(normalizePreferences({ shredderEnabled: 'true' }).shredderEnabled, false);
});

test('Mordor changes actual vertex positions through undo, retaining texture paths, UVs, topology, rig and all other sections', () => {
  const doc = openDocument(createStarterDocument().serialize('mdx'), 'Shredder.mdx');
  const bytes = doc.serialize('mdx'), before = structuredClone(doc.model);
  const plan = prepareShredderAttack(doc, { geosetIndex: 0, vertexIndex: 0 }, () => .75);
  assert.equal(currentShredderAttack(doc, plan), true);
  doc.apply('Shredder: Mordor attack', ['Geosets', 'Info'], model => moveShredderVertex(model, plan));
  assert.deepEqual(Array.from(doc.model.Geosets[0].Vertices.slice(0, 3)), plan.position);
  assert.deepEqual(doc.model.Geosets[0].Vertices.slice(3), before.Geosets[0].Vertices.slice(3));
  for (const field of ['Normals', 'TVertices', 'Faces', 'VertexGroup', 'Groups', 'SkinWeights', 'Tangents']) assert.deepEqual(doc.model.Geosets[0][field], before.Geosets[0][field], field);
  for (const section of Object.keys(before).filter(key => !['Geosets', 'Info'].includes(key))) assert.deepEqual(doc.model[section], before[section], section);
  assert.equal(doc.dirty, true);
  assert.equal(currentShredderAttack(doc, plan), false);
  assert.equal(doc.undo(), true);
  assert.deepEqual(doc.serialize('mdx'), bytes, 'undo restores the original authored bytes');
  assert.equal(doc.redo(), true);
  assert.deepEqual(Array.from(doc.model.Geosets[0].Vertices.slice(0, 3)), plan.position);
});

test('read-only, stale, switched and missing models are never mutated by a pending flight', () => {
  const doc = createStarterDocument(), target = { geosetIndex: 0, vertexIndex: 0 };
  const plan = prepareShredderAttack(doc, target, () => .75);
  assert.ok(plan);
  assert.equal(currentShredderAttack(createStarterDocument(), plan), false);
  doc.apply('User edit', ['Geosets'], model => { model.Geosets[0].Vertices[3] += 1; });
  assert.equal(currentShredderAttack(doc, plan), false);
  doc.readOnly = true;
  assert.equal(prepareShredderAttack(doc, target), null);
  assert.equal(prepareShredderAttack(null, target), null);
  assert.equal(prepareShredderAttack(createStarterDocument(), { ...target, vertexIndex: 9999 }), null);
});

test('sustained chaos keeps finite model scale and the whole run can be undone exactly', () => {
  const doc = openDocument(createStarterDocument().serialize('mdx'), 'Chaos.mdx'), before = doc.serialize('mdx');
  const initialMagnitude = Math.max(1, ...Array.from(doc.model.Geosets[0].Vertices, Math.abs));
  let seed = 17;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let index = 0; index < 60; index++) {
    const plan = prepareShredderAttack(doc, { geosetIndex: 0, vertexIndex: index % 8 }, random);
    assert.ok(plan);
    doc.apply('Shredder: Mordor attack', ['Geosets', 'Info'], model => moveShredderVertex(model, plan));
    assert.ok(Array.from(doc.model.Geosets[0].Vertices).every(value => Number.isFinite(value) && Math.abs(value) < initialMagnitude * 8));
  }
  for (let index = 0; index < 60; index++) assert.equal(doc.undo(), true);
  assert.deepEqual(doc.serialize('mdx'), before);
});

test('every program language has Shredder speech and preserves key placeholders', () => {
  for (const { id } of LANGUAGES.filter(language => language.id !== 'en')) {
    for (const line of ['You keep clicking {0}. Try {1}.', 'Give your mouse a rest. Use {1} for {0}.', "That's it! {1} for {0}. Much faster.", 'Press {1} to {0}. One hand. Caw!', 'Caw! I will show you handy shortcuts. Drag me wherever you like.', 'Put me down wherever you like. I can walk from there.', 'Drag Shredder', 'Your precious model? I will tear it apart!', 'More vertices! More chaos! Caw!', 'The crown commands. The model obeys.', 'No corner of this model is safe!', 'You are wasting my time! I have better things to do than stand here being ignored.', 'The shortcut is right there. Caw!', "By Morgoth's crown, this vertex is mine!", 'Fly, little vertex! Your model belongs to Mordor!']) {
      const result = translate(line, id);
      assert.notEqual(result, line, id + ': ' + line);
      assert.deepEqual((result.match(/\{\d+\}/g) || []).sort(), (line.match(/\{\d+\}/g) || []).sort());
    }
  }
});
