import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { PerspectiveCamera } from 'three';
import { setLanguage, translate } from '../src/localization.js';
import { drawEditHandles } from '../app/viewport-edit-handles.js';
import { forgeMoldHandles } from '../app/forge-mold-handles.js';

const require = createRequire(import.meta.url);
const { buildMenuTemplate } = require('../electron/menu.cjs');
const VIEW_MENU = require('../src/view-menu.json');
const locales = ['es', 'ru', 'zh', 'fr', 'de'];

// Chinese runs words together; a space between two Han characters splits one name in two.
test('Chinese native menu shows every label as one phrase', () => {
  const labels = [];
  const walk = items => items.forEach(item => { if (item.label) labels.push(item.label); if (item.submenu) walk(item.submenu); });
  for (const viewMode of Object.keys(VIEW_MENU)) walk(buildMenuTemplate({}, () => {}, 'win32', [], value => translate(value, 'zh'), { viewMode }));
  const split = labels.filter(label => /[㐀-鿿]\s+[㐀-鿿]/.test(label));
  assert.deepEqual([...new Set(split)], []);
  for (const source of ['Material Manager…', 'Node Manager…', 'Geoset Manager…', 'Geoset Animation Manager…'])
    assert.equal(translate(source, 'zh'), translate(source.slice(0, -1), 'zh') + '…', source);
});

test('BITZ New folder reads as one phrase, not the New {0} template around English', () => {
  for (const locale of locales) assert.doesNotMatch(translate('New folder', locale), /folder/, locale);
});

test('the Forge tools header uses the Forge name the other Forge labels use', () => {
  for (const locale of locales) {
    if (!translate('Forge tools', locale).includes('Forge')) continue;
    assert.equal(translate('FORGE', locale), 'FORGE', locale);
  }
});

test('Spanish mesh Faces uses the same word as the other face labels', () => {
  assert.match(translate('{0} faces · {1} geoset', 'es'), /caras/);
  assert.equal(translate('Faces', 'es'), 'Caras');
});

test('Glow Up is translated in French and German like in the other languages', () => {
  assert.ok(['es', 'ru', 'zh'].every(locale => translate('Glow Up', locale) !== 'Glow Up'));
  for (const locale of ['fr', 'de']) assert.notEqual(translate('Glow Up', locale), 'Glow Up', locale);
});

function drawnLabels(handles, locale) {
  const texts = [], context = new Proxy({ fillText: text => texts.push(text) }, { get: (target, key) => target[key] ?? (() => {}), set: () => true });
  const canvas = { getContext: () => context }, camera = new PerspectiveCamera(50, 1, .1, 1000);
  camera.position.set(0, -300, 0); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
  setLanguage(locale);
  try { drawEditHandles(canvas, handles, camera, 400, 400, 1); } finally { setLanguage('en'); }
  return texts;
}

// Canvas text never passes through the JSX adapter, so drawn handle words must translate themselves.
test('Call Upon Forge handle words are drawn in the chosen language', () => {
  const bounds = { center: [0, 0, 0], span: [40, 40, 40], min: [-20, -20, -20], max: [20, 20, 20] };
  const handles = forgeMoldHandles({ bounds, axis: 2, direction: 0, tool: 'Bend', center: 0, width: 20, amount: 0 });
  assert.deepEqual(drawnLabels(handles, 'en'), ['Drag', 'Center', 'Range', 'Range']);
  const expected = { es: ['Arrastrar', 'Centro'], ru: ['Тянуть', 'Центр'], zh: ['拖动', '中心'], fr: ['Glisser', 'Centre'], de: ['Ziehen', 'Mitte'] };
  for (const locale of locales) assert.deepEqual(drawnLabels(handles, locale), [...expected[locale], translate('Range', locale), translate('Range', locale)], locale);
});

// Bone Namer words share English spelling with views, verbs and other tools; its own context keeps the bone meaning.
test('Bone Namer columns and choices use their bone meaning in every language', () => {
  const source = readFileSync(new URL('../app/BoneNamer.jsx', import.meta.url), 'utf8');
  for (const key of ['bone-side\\u0004', 'bone-part\\u0004', 'bone-kind\\u0004', "'bone-namer\\u0004Side'", "'bone-namer\\u0004Part'"]) assert.ok(source.includes(key), key);
  const expected = {
    'bone-side\u0004Left': { zh: '左' }, 'bone-side\u0004Right': { zh: '右' },
    'bone-namer\u0004Side': { es: 'Lado', ru: 'Сторона', zh: '左右', fr: 'Côté', de: 'Seite' },
    'bone-namer\u0004Part': { fr: 'Partie', de: 'Körperteil' },
    'bone-kind\u0004Copy': { es: 'Copia', ru: 'Копия', zh: '副本', fr: 'Copie', de: 'Kopie' },
    'bone-part\u0004Spine': { es: 'Columna vertebral', fr: 'Colonne vertébrale' },
  };
  for (const [key, rows] of Object.entries(expected)) {
    assert.equal(translate(key, 'en'), key.split('\u0004')[1]);
    for (const [locale, text] of Object.entries(rows)) assert.equal(translate(key, locale), text, `${locale}: ${key}`);
  }
  // The generic words keep their meaning elsewhere (camera views, Copy command).
  assert.equal(translate('Left', 'zh'), '左视图');
  assert.equal(translate('Copy', 'es'), 'Copiar');
});

test('zoom anchor marker words are translated', () => {
  for (const locale of locales) for (const word of ['ALIGN', 'ANCHOR']) assert.notEqual(translate(word, locale), word, locale + ': ' + word);
});
