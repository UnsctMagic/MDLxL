import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SHREDDER_TIMING, RELEASE_TIMING, TEST_TIMING, SHREDDER_TEST_VERSION, MAX_SHOWS, LEARNED_OCCASIONS, emptyNotebook, normalizeNotebook, startSession, recordUse, recordShown, retireLesson,
  remindLater, quietForToday, lessonReady, learnedIn, mayInterrupt, notebookSummary,
} from '../src/shredder-notebook.js';
import { SHREDDER_AREAS, TRICKS, WELCOME, SHORTCUT_CLICKS, trick, areaFor, shortcutLesson, shortcutSignals, trickLesson, fillLesson } from '../src/shredder-lessons.js';
import { COMMANDS } from '../src/commands.js';
import { DEFAULT_PREFERENCES, normalizePreferences } from '../src/preferences.js';
import { translate } from '../src/localization.js';
import ru from '../src/locales/ru.json' with { type: 'json' };
import es from '../src/locales/es.json' with { type: 'json' };
import zh from '../src/locales/zh.json' with { type: 'json' };

const MINUTE = 60 * 1000, DAY = 24 * 60 * MINUTE, start = Date.UTC(2026, 9, 22, 9);
// The rules are checked with the release timing; the test version only shortens the waits.
const timing = RELEASE_TIMING;

test('a lesson is learned after five separate uses, not after repeated use in one burst', () => {
  let notebook = startSession(emptyNotebook());
  const use = now => { notebook = recordUse(notebook, 'key:translate', { now, area: 'vertices', timing }); };
  for (let i = 0; i < 10; i++) use(start + i * 1000);
  assert.equal(notebook.lessons['key:translate'].occasions, 1, 'a burst is one use');
  for (let i = 1; i < 4; i++) use(start + i * timing.occasionGap);
  assert.equal(notebook.lessons['key:translate'].occasions, 4);
  assert.equal(notebook.lessons['key:translate'].learnedAt, 0, 'four is not enough');
  notebook = startSession(notebook);
  use(start + 4 * timing.occasionGap - 1000);
  assert.ok(notebook.lessons['key:translate'].learnedAt, 'the fifth use (here after a new app start) teaches it');
  assert.equal(lessonReady(notebook.lessons['key:translate'], { now: start + DAY, timing }), false, 'learned lessons never come back');
  assert.equal(learnedIn(notebook, 'vertices'), 1);
  assert.equal(LEARNED_OCCASIONS, 5);
});

test('a tip keeps coming back, spaced out, until it is learned', () => {
  let notebook = startSession(emptyNotebook());
  const ready = (id, now) => lessonReady(notebook.lessons[id], { now, timing });
  assert.equal(lessonReady(undefined, { now: start, timing }), true);
  notebook = recordShown(notebook, 'key:save', { now: start, area: 'everywhere' });
  assert.equal(ready('key:save', start + timing.repeat - 1), false, '"K, bro." waits the repeat gap');
  assert.equal(ready('key:save', start + timing.repeat), true, 'then it may come back, same session or not');
  for (let i = 1; i < MAX_SHOWS; i++) notebook = recordShown(notebook, 'key:save', { now: start + i * timing.repeat, area: 'everywhere' });
  assert.equal(ready('key:save', start + 100 * timing.repeat), false, `at most ${MAX_SHOWS} times`);
  notebook = retireLesson(notebook, 'intro:welcome', { area: 'everywhere' });
  assert.equal(ready('intro:welcome', start + DAY), false, 'a retired tip (the hello) never comes back');
  notebook = recordUse(notebook, 'key:open', { now: start, area: 'everywhere', need: 1 });
  assert.equal(ready('key:open', start + DAY), false);
});

test('"Tell me later, bro." brings a tip back after a short while, within the show limit', () => {
  let notebook = startSession(emptyNotebook());
  const ready = (record, now) => lessonReady(record, { now, timing });
  notebook = recordShown(notebook, 'trick:zoom-anchor', { now: start, area: 'vertices' });
  notebook = remindLater(notebook, 'trick:zoom-anchor', { now: start, area: 'vertices', timing });
  assert.equal(ready(notebook.lessons['trick:zoom-anchor'], start + timing.remindLater - 1), false);
  assert.equal(ready(notebook.lessons['trick:zoom-anchor'], start + timing.remindLater), true, 'same session, after the wait');
  notebook = recordShown(notebook, 'trick:zoom-anchor', { now: start + timing.remindLater, area: 'vertices' });
  assert.equal(notebook.lessons['trick:zoom-anchor'].remindAfter, 0, 'showing it again clears the reminder');
  assert.equal(ready(notebook.lessons['trick:zoom-anchor'], start + timing.remindLater + timing.repeat - 1), false, 'without a new reminder the repeat gap applies');
  assert.equal(normalizeNotebook(JSON.parse(JSON.stringify(remindLater(notebook, 'x', { now: start, area: 'everywhere', timing })))).lessons.x.remindAfter, start + timing.remindLater);
});

test('manners: quiet start, cooldown by pace, and quiet for today', () => {
  const notebook = emptyNotebook();
  const ask = (now, extra = {}) => mayInterrupt({ now, notebook, sessionStartedAt: start, timing, ...extra });
  assert.equal(ask(start + MINUTE), false, 'nothing in the first two minutes');
  assert.equal(ask(start + 2 * MINUTE), true);
  assert.equal(ask(start + 4 * MINUTE, { lastTipAt: start + 2 * MINUTE }), false, 'three minutes between tips');
  assert.equal(ask(start + 5 * MINUTE, { lastTipAt: start + 2 * MINUTE }), true);
  assert.equal(ask(start + 5 * MINUTE, { lastTipAt: start + 2 * MINUTE, pace: 'fewer' }), false, 'fewer tips waits ten minutes');
  assert.equal(ask(start + 12 * MINUTE, { lastTipAt: start + 2 * MINUTE, pace: 'fewer' }), true);
  const quiet = quietForToday(notebook, start);
  assert.ok(quiet.quietUntil > start && quiet.quietUntil - start <= DAY);
  assert.equal(new Date(quiet.quietUntil).getHours(), 0, 'quiet until local midnight');
  assert.equal(mayInterrupt({ now: quiet.quietUntil - 1, notebook: quiet, sessionStartedAt: 0, timing }), false);
  assert.equal(mayInterrupt({ now: quiet.quietUntil, notebook: quiet, sessionStartedAt: 0, timing }), true);
});

test('a damaged or foreign notebook loads as a clean one', () => {
  for (const input of [null, 'text', [], { version: 2 }, { version: 1, lessons: [] }]) assert.deepEqual(normalizeNotebook(input), emptyNotebook());
  const notebook = normalizeNotebook({ version: 1, sessions: 4, lessons: { 'key:save': { shown: 2, occasions: -1, retired: 'yes', area: 'everywhere' }, ['x'.repeat(400)]: {} } });
  assert.equal(notebook.sessions, 4);
  assert.deepEqual(Object.keys(notebook.lessons), ['key:save']);
  assert.equal(notebook.lessons['key:save'].occasions, 0);
  assert.equal(notebook.lessons['key:save'].retired, false);
  assert.ok(!Object.hasOwn(normalizeNotebook({ version: 1, lessons: JSON.parse('{"__proto__":{"shown":1}}') }).lessons, '__proto__'));
});

test('shortcut lessons use the current binding: a key first, otherwise its Ctrl+Alt+Space code', () => {
  const key = shortcutLesson({ actionId: 'translate', label: 'Move', keys: ['M', 'Q'], mode: 'vertices' });
  assert.equal(fillLesson(key.text, key.args), 'Next time press M for Move.');
  assert.equal(key.level, 1); assert.equal(key.area, 'vertices');
  const code = shortcutLesson({ actionId: 'fit', label: 'Fit model', keys: ['Ctrl+Alt+Space > A1K'], mode: 'vertices' });
  assert.equal(fillLesson(code.text, code.args), 'Fit model has a code: press Ctrl+Alt+Space, let go, then type A1K.');
  assert.equal(code.level, 2); assert.equal(code.area, 'camera');
  assert.equal(shortcutLesson({ actionId: 'nothing', label: 'Nothing', keys: [], mode: 'vertices' }), null);
  assert.deepEqual(shortcutSignals('translate', 'M'), ['key:translate', 'use:translate']);
  assert.deepEqual(shortcutSignals('fit', 'Ctrl+Alt+Space > A1K'), ['code:fit', 'use:fit']);
  assert.equal(areaFor('save', 'uv'), 'everywhere');
  assert.equal(areaFor('uv:flip-u', 'uv'), 'uv');
  assert.equal(areaFor('select', 'paint'), 'everywhere');
});

test('he speaks up: a key tip on the first click, tricks without waiting for basics, a hello said once', () => {
  assert.equal(SHORTCUT_CLICKS, 1);
  for (const lesson of TRICKS) assert.equal(lesson.level, 1, lesson.id);
  assert.equal(WELCOME.once, true);
  assert.match(WELCOME.text, /Shredder/);
});

test('tricks name their own learning signals and fill in the user key, or step aside without one', () => {
  for (const lesson of TRICKS) {
    assert.ok(SHREDDER_AREAS.some(([area]) => area === lesson.area), lesson.id);
    assert.ok(lesson.learnedBy.length, lesson.id);
    for (const key of lesson.keys || []) assert.ok(COMMANDS.some(command => command.id === key), key);
    assert.equal((lesson.text.match(/\{\d\}/g) || []).length, (lesson.keys || []).length, lesson.id);
  }
  const anchor = trickLesson(trick('trick:zoom-anchor'), { anchorSelect: ['1'] });
  assert.match(fillLesson(anchor.text, anchor.args), /^Zoom anchor: select some vertices, press 1, then/);
  assert.equal(trickLesson(trick('trick:zoom-anchor'), { anchorSelect: [] }), null);
  const camera = trickLesson(trick('trick:camera-toggle'), { cameraToggle: ['W'] });
  assert.match(fillLesson(camera.text, camera.args), /^W switches/);
  const bones = trickLesson(trick('trick:bones-keys'), { rotate: ['R'], Collapse: ['C'], 'Create triangle': ['T'], 'bone:detach': ['D'] });
  assert.equal(fillLesson(bones.text, bones.args), 'In Bones, R is Hard Bind, C is Soft Bind, T is Attach and D detaches from the parent bone.');
  assert.equal(trickLesson(trick('trick:bones-keys'), { rotate: ['R'] }), null);
});

test('the notebook summary counts learned and met lessons per area and this week', () => {
  let notebook = startSession(emptyNotebook());
  notebook = recordUse(notebook, 'key:select', { now: start, area: 'vertices', need: 1 });
  notebook = recordShown(notebook, 'key:translate', { now: start, area: 'vertices' });
  notebook = recordUse(notebook, 'key:save', { now: start - 10 * DAY, area: 'everywhere', need: 1 });
  const summary = notebookSummary(notebook, SHREDDER_AREAS, start + MINUTE);
  assert.deepEqual(summary.areas.find(row => row.area === 'vertices'), { area: 'vertices', label: 'Vertex editor', learned: 1, met: 2 });
  assert.equal(summary.areas.find(row => row.area === 'uv').met, 0);
  assert.equal(summary.learnedThisWeek, 1); assert.equal(summary.learned, 2);
});

test('the test version talks fast and starts on; the release version waits and starts off', () => {
  assert.equal(SHREDDER_TIMING, SHREDDER_TEST_VERSION ? TEST_TIMING : RELEASE_TIMING);
  assert.equal(TEST_TIMING.quietStart, 0);
  assert.ok(TEST_TIMING.cooldown.normal <= 10 * 1000);
  assert.equal(RELEASE_TIMING.quietStart, 2 * MINUTE);
  assert.equal(RELEASE_TIMING.cooldown.normal, 3 * MINUTE);
});

test('Shredder starts on only in the test version, and his preferences survive normalizing', () => {
  assert.equal(DEFAULT_PREFERENCES.shredder, SHREDDER_TEST_VERSION);
  assert.equal(normalizePreferences({ shredder: true, shredderPace: 'fewer' }).shredder, true);
  assert.equal(normalizePreferences({ shredder: true, shredderPace: 'fewer' }).shredderPace, 'fewer');
  assert.equal(normalizePreferences({ shredder: 'yes', shredderPace: 'loud' }).shredder, SHREDDER_TEST_VERSION);
  assert.equal(normalizePreferences({ shredder: false }).shredder, false);
  assert.equal(normalizePreferences({ shredderPace: 'loud' }).shredderPace, 'normal');
  assert.ok(COMMANDS.some(command => command.id === 'shredder'));
});

test('every Shredder sentence is translated, with the user key and button name kept', () => {
  const sources = [...TRICKS.map(lesson => lesson.text), ...SHREDDER_AREAS.map(([, label]) => label), 'Next time press {0} for {1}.', '{1} has a code: press Ctrl+Alt+Space, let go, then type {0}.',
    "Shredder's notebook", '{0} of {1} learned', 'Not visited yet', 'This week: {0} learned · {1} in all', 'K, bro.', 'Tell me later, bro.', 'Quiet for today', 'Fewer tips', 'Turn off', 'Shredder the Wise',
    'Shredder the Wise: hotkey and trick tips', 'Quiet until tomorrow.', 'No tips until tomorrow.', WELCOME.text, 'Test version: tips come every few seconds.',
    'Close this tip. Until you use the trick yourself, it comes back now and then.', 'Close this tip and bring it back soon.', 'A trick counts as learned once you have used it yourself five separate times.'];
  for (const [locale, pack] of Object.entries({ ru, es, zh })) for (const source of sources) assert.ok(pack[source]?.trim(), `${locale}: ${source}`);
  for (const locale of ['ru', 'es', 'zh']) {
    const sentence = translate('Next time press M for Move.', locale);
    assert.notEqual(sentence, 'Next time press M for Move.', locale);
    assert.ok(sentence.includes('M') && sentence.includes(translate('Move', locale)), `${locale}: ${sentence}`);
    assert.match(translate('3 of 7 learned', locale), /3.*7/);
  }
});
