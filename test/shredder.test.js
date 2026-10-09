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

test('mouse repetitions, reminders, shortcut learning, idle gaps and the single brief tantrum', () => {
  const coach = new ShredderCoach(), usage = { id: 'move', source: 'mouse', label: 'Move vertices', key: 'Q' };
  const burst = now => [0, 1, 2].map(offset => coach.use(usage, now + offset)).filter(Boolean);
  assert.deepEqual(burst(0).map(item => item.kind), ['tip']);
  assert.deepEqual(burst(61000).map(item => item.kind), ['tip']);
  assert.deepEqual(burst(122000).map(item => item.kind), ['tip']);
  assert.deepEqual(burst(183000).map(item => item.kind), ['tantrum']);
  assert.deepEqual(burst(244000), [], 'ignoring the same advice cannot cause repeated harassment');
  assert.equal(coach.use({ id: 'move', source: 'shortcut' }, 245000).kind, 'learned');
  assert.deepEqual(burst(306000).map(item => item.kind), ['tip'], 'using the shortcut resets frustration for that action');
  assert.deepEqual(burst(306010), [], 'no immediate repeat speech');
  const sparse = new ShredderCoach();
  for (const now of [0, 50000, 100000]) assert.equal(sparse.use(usage, now), null, 'occasional mouse use is fine');
  assert.equal(sparse.use({ ...usage, key: '' }, 100001), null, 'no easy shortcut means no advice');
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
  const plan = prepareShredderAttack(doc, target, () => .5);
  assert.equal(currentShredderAttack(createStarterDocument(), plan), false);
  doc.apply('User edit', ['Geosets'], model => { model.Geosets[0].Vertices[3] += 1; });
  assert.equal(currentShredderAttack(doc, plan), false);
  doc.readOnly = true;
  assert.equal(prepareShredderAttack(doc, target), null);
  assert.equal(prepareShredderAttack(null, target), null);
  assert.equal(prepareShredderAttack(createStarterDocument(), { ...target, vertexIndex: 9999 }), null);
});

test('every program language has Shredder speech and preserves key placeholders', () => {
  for (const { id } of LANGUAGES.filter(language => language.id !== 'en')) {
    for (const line of ['You keep clicking {0}. Try {1}.', 'Still clicking {0}? One hand, {1}. Caw!', 'You are wasting my time! I have better things to do than stand here being ignored.', 'The shortcut is right there. Caw!', "By Morgoth's crown, this vertex is mine!", 'Fly, little vertex! Your model belongs to Mordor!']) {
      const result = translate(line, id);
      assert.notEqual(result, line, id + ': ' + line);
      assert.deepEqual(result.match(/\{\d+\}/g) || [], line.match(/\{\d+\}/g) || []);
    }
  }
});
