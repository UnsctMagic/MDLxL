import test from 'node:test';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import { russian, translate } from '../src/localization.js';
import ru from '../src/locales/ru.json' with { type: 'json' };
import es from '../src/locales/es.json' with { type: 'json' };
import zh from '../src/locales/zh.json' with { type: 'json' };
import additions from './fixtures/locale-french-german-sources.json' with { type: 'json' };
import fr from '../src/locales/fr.json' with { type: 'json' };
import de from '../src/locales/de.json' with { type: 'json' };

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
  assert.deepEqual([ru, es, zh, fr, de].map(pack => Object.keys(pack).length), [7850, 7860, 7719, 7996, 7996]);
  for (const pack of [ru, es, zh, fr, de]) for (const label of ['Create as overlay','Arc welder','White ice','Rune glow','Ice surface','Drag the UV map to position the runes.']) assert.ok(pack[label],label);
  // The removed delegation labels/tips are gone; the chat picker's texts are translated.
  for (const pack of [ru, es, zh, fr, de]) for (const key of ['Offload Mode', 'Job routing', 'Tiny job', 'Lighter model']) assert.equal(Object.hasOwn(pack, key), false);
  for (const pack of [ru, es, zh, fr, de]) for (const key of ['Current chat', 'Earlier chat', 'Earlier chats of this model are read only.', 'An earlier chat, read only. Use the current chat to continue.', 'The model for new requests.']) assert.ok(Object.hasOwn(pack, key), key);
  for (const source of Object.keys(ru)) assert.ok(Object.hasOwn(es, source), `es: ${source}`);
  for (const [locale, pack] of Object.entries({ ru, es, zh, fr, de })) for (const [source, value] of Object.entries(pack)) {
    assert.equal(source, source.trim(), `${locale}: ${source}`);
    assert.ok(typeof value === 'string' && value.trim() && !/�|undefined/.test(value), `${locale}: ${source}`);
  }
});

// The new catalogs use the same ordered union, including community Chinese-only labels.
test('French and German cover the ordered catalog union and preserve every data slot', () => {
 const keys = [...new Set([...Object.keys(es), ...Object.keys(ru), ...Object.keys(zh), ...additions])];
 const slots = value => [...value.matchAll(/\{\d+\}/g)].map(match => match[0]).sort();
 for (const [locale, pack] of Object.entries({fr,de})) {
  assert.deepEqual(Object.keys(pack), keys, locale);
  for (const key of keys) assert.deepEqual(slots(pack[key]), slots(key), locale + ': ' + key);
 }
});

test('French and German catalogs use UTF-8 text without double-decoded accents', () => {
 for(const [locale,pack] of Object.entries({fr,de}))for(const [key,value]of Object.entries(pack))
  assert.doesNotMatch(value,/\u00c3[\u0080-\u00bf\u0152\u0153\u0178\u0160\u0161\u017d\u017e]|\u00c2[\u0080-\u00bf]|\u00e2\u20ac|\ufffd/,locale+': '+key);
});

test('new catalogs retain CRLF source files with UTF-8 JSON', () => {
 for(const locale of ['fr','de']){
  const raw=readFileSync(new URL('../src/locales/'+locale+'.json',import.meta.url),'utf8');
  assert.doesNotMatch(raw,/(?<!\r)\n/,locale+' line endings');
  assert.doesNotMatch(raw,/\ufffd/,locale+' UTF-8');
  assert.ok(Object.keys(JSON.parse(raw)).length>7900);
 }
});
