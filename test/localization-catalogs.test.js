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
  assert.deepEqual([ru, es, zh].map(pack => Object.keys(pack).length), [6087,6099,3279]);
  for (const source of Object.keys(ru)) assert.ok(Object.hasOwn(es, source), `es: ${source}`);
  for (const [locale, pack] of Object.entries({ ru, es, zh })) for (const [source, value] of Object.entries(pack)) {
    assert.equal(source, source.trim(), `${locale}: ${source}`);
    assert.ok(typeof value === 'string' && value.trim() && !/�|undefined/.test(value), `${locale}: ${source}`);
  }
});
