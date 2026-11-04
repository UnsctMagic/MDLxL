import test from 'node:test';
import assert from 'node:assert/strict';
import { russian, translate } from '../src/localization.js';
import ru from '../src/locales/ru.json' with { type: 'json' };
import es from '../src/locales/es.json' with { type: 'json' };
import zh from '../src/locales/zh.json' with { type: 'json' };

// Each language has exactly one catalog. These texts used to be defined
// several times across release-named files, and the later file won; the
// single catalog must keep that winning text.
test('consolidated catalogs keep the text that previously won each override', () => {
  const expected = {
    ru: { Rotation: 'Вращение', Light: 'Свет', Sequences: 'Анимации', 'Keyboard Shortcuts': 'Горячие клавиши', Intensity: 'Интенсивность', Name: 'Имя' },
    es: { 'Clear selection': 'Deseleccionar todo', 'Clear History': 'Borrar historial', 'Work mode': 'Modo de edición', Display: 'Visualización', Shade: 'Sombreado' },
    zh: { 'Citadel Paint': '城堡漆', Sequences: '序列', Intensity: '亮度' },
  };
  for (const [locale, rows] of Object.entries(expected)) for (const [source, text] of Object.entries(rows)) assert.equal(translate(source, locale), text, `${locale}: ${source}`);
});

test('each language catalog has the expected size and only usable entries', () => {
  assert.deepEqual(russian, ru);
  assert.deepEqual([ru, es, zh].map(pack => Object.keys(pack).length), [7924, 7934, 7793]);
  for (const pack of [ru, es, zh]) for (const label of ['Create as overlay','Arc welder','White ice','Rune glow','Ice surface','Drag the UV map to position the runes.']) assert.ok(pack[label],label);
  // The removed delegation labels/tips are gone; the chat picker's texts are translated.
  for (const pack of [ru, es, zh]) for (const key of ['Offload Mode', 'Job routing', 'Tiny job', 'Lighter model']) assert.equal(Object.hasOwn(pack, key), false);
  for (const pack of [ru, es, zh]) for (const key of ['Current chat', 'Earlier chat', 'Earlier chats of this model are read only.', 'An earlier chat, read only. Use the current chat to continue.', 'The model for new requests.']) assert.ok(Object.hasOwn(pack, key), key);
  for (const source of Object.keys(ru)) assert.ok(Object.hasOwn(es, source), `es: ${source}`);
  for (const [locale, pack] of Object.entries({ ru, es, zh })) for (const [source, value] of Object.entries(pack)) {
    assert.equal(source, source.trim(), `${locale}: ${source}`);
    assert.ok(typeof value === 'string' && value.trim() && !/�|undefined/.test(value), `${locale}: ${source}`);
  }
});


test('Sanity Check labels, statuses and displayed Hive diagnostic templates are translated', () => {
  const labels = [
    'Sanity Check', 'by GhostWolf and contributors', 'Close', 'Untitled', '· Format',
    'Check could not complete', 'Checking current model…', 'Advisory findings (',
    'errors ·', 'severe ·', 'warnings ·', 'unused notices',
    'Findings use zero-based indices. Naming, unused data and older compatibility heuristics require review; they are not proof of a game failure.',
    'Checks the current model, including unsaved edits. No model data is changed. Texture file availability and in-game behavior are not tested.',
    'Check partially completed', 'Review findings', 'No issues found by these checks',
    'The bundled mdx-m3-viewer checker supports this comparison for classic version 800 only.',
    'The bundled mdx-m3-viewer checker could not load.', 'warning', 'error', 'severe', 'unused',
  ];
  const templates = [
    ['mdx-m3-viewer comparison could not complete: {0}', ['The bundled mdx-m3-viewer checker could not load.']],
    ['Track {0} at frame {1} is not in any sequence', ['17', '171667']],
    ['Expected {0} pivot points, got {1}', ['116', '119']],
    ['Missing opening track for sequence "{0}" at frame {1} where it is needed', ['Attack - Slam', '170000']],
  ];
  for (const [locale, pack] of Object.entries({ ru, es, zh })) {
    for (const source of labels) {
      const translated = translate(source, locale);
      assert.ok(Object.hasOwn(pack, source) || translated !== source, `${locale}: ${source}`);
      if (Object.hasOwn(pack, source)) assert.equal(translated, pack[source], `${locale}: ${source}`);
    }
    for (const [source, values] of templates) {
      assert.ok(Object.hasOwn(pack, source), `${locale}: ${source}`);
      const populated = source.replace(/\{(\d+)\}/g, (_, index) => values[index]);
      const expected = pack[source].replace(/\{(\d+)\}/g, (_, index) => translate(values[index], locale));
      assert.equal(translate(populated, locale), expected, `${locale}: ${source}`);
    }
  }
});
