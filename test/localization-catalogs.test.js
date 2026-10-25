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
    ru: { Rotation: 'Ð’Ñ€Ð°Ñ‰ÐµÐ½Ð¸Ðµ', Light: 'Ð¡Ð²ÐµÑ‚', Sequences: 'ÐÐ½Ð¸Ð¼Ð°Ñ†Ð¸Ð¸', 'Keyboard Shortcuts': 'Ð“Ð¾Ñ€ÑÑ‡Ð¸Ðµ ÐºÐ»Ð°Ð²Ð¸ÑˆÐ¸', Intensity: 'Ð˜Ð½Ñ‚ÐµÐ½ÑÐ¸Ð²Ð½Ð¾ÑÑ‚ÑŒ', Name: 'Ð˜Ð¼Ñ' },
    es: { 'Clear selection': 'Deseleccionar todo', 'Clear History': 'Borrar historial', 'Work mode': 'Modo de ediciÃ³n', Display: 'VisualizaciÃ³n', Shade: 'Sombreado' },
    zh: { 'Citadel Paint': 'åŸŽå ¡æ¼†', Sequences: 'åºåˆ—', Intensity: 'äº®åº¦' },
  };
  for (const [locale, rows] of Object.entries(expected)) for (const [source, text] of Object.entries(rows)) assert.equal(translate(source, locale), text, `${locale}: ${source}`);
});

test('each language catalog has the expected size and only usable entries', () => {
  assert.deepEqual(russian, ru);
  assert.deepEqual([ru, es, zh].map(pack => Object.keys(pack).length), [6400,6412,3599]);
  for (const source of Object.keys(ru)) assert.ok(Object.hasOwn(es, source), `es: ${source}`);
  for (const [locale, pack] of Object.entries({ ru, es, zh })) for (const [source, value] of Object.entries(pack)) {
    assert.equal(source, source.trim(), `${locale}: ${source}`);
    assert.ok(typeof value === 'string' && value.trim() && !/ï¿½|undefined/.test(value), `${locale}: ${source}`);
  }
});
