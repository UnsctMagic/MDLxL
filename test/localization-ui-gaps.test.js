import test from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { transformSync } from 'esbuild';
import * as browse from '../src/particle-library-browse.js';
import { plainTrackValues } from '../src/plain-track-values.js';
import { translate } from '../src/localization.js';

test('Fix model exposes the authored owner separately from its translatable property', () => {
  const item = plainTrackValues({ Bones: [{ ObjectId: 0, Name: 'Translation', Translation: [0, 0, 5] }] })[0];
  assert.equal(item.ownerLabel, 'Translation');
  assert.equal(item.property, 'Translation');
});

test('generated particle descriptors translate while source names and personal/reviewed names stay literal', () => {
  for (const locale of ['es', 'ru', 'zh', 'fr', 'de']) {
    for (const phrase of ['Red streaks', 'Pale smoke', 'Golden smoke', 'Blue particle burst', 'Green particles', 'Purple flame', 'Ribbon trail', 'Model particles']) {
      const name = phrase + ' · Translation · Footman';
      const item = { name, collection: 'Warcraft', naming: { state: 'review-needed' } };
      assert.equal(browse.particleDisplayName(item, locale), translate(phrase, locale) + ' · Translation · Footman');
      assert.notEqual(translate(phrase, locale), phrase, locale + ': ' + phrase);
      for (const state of ['personal', 'reviewed', 'user-reviewed'])
        assert.equal(browse.particleDisplayName({ ...item, naming: { state } }, locale), name);
      assert.equal(item.name, name);
    }
  }
});


const fileSource = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const literal = /"(?:[^"\\]|\\.)*"/.source;
const visibleProp = /(?:\bchildren|\btitle|\bplaceholder|"aria-label")/.source;
const literalProp = new RegExp(visibleProp + '\\s*:\\s*(' + literal + ')(?=\\s*[,}])', 'g');
const branchProp = new RegExp(visibleProp + '\\s*:\\s*[^,{}\\n]*?\\?\\s*(' + literal + ')\\s*:\\s*(' + literal + '|undefined|void 0)', 'g');
const textChild = new RegExp('^\\s*(' + literal + ')\\s*[,]?\\s*$', 'gm');
const names = new Set(['BitsAndParts', 'EMTR', 'VIS', 'XL', 'RGB', 'R', 'G', 'B']);
const fragments = new Set(['Original (']);

function visibleStrings(source) {
  // esbuild turns JSX text into literal children and keeps the accessible
  // attributes on their own properties, including static conditional labels.
  const { code } = transformSync(source, { loader: 'jsx', jsx: 'automatic' });
  const literals = [
    ...[...code.matchAll(literalProp)].map(match => match[1]),
    ...[...code.matchAll(branchProp)].flatMap(match => match.slice(1).filter(value => value !== 'undefined' && value !== 'void 0')),
    ...[...code.matchAll(textChild)].filter(match => !/\b(?:jsx|jsxs)\($/.test(code.slice(0, match.index).trimEnd())).map(match => match[1]),
  ];
  return [...new Set(literals.map(value => JSON.parse(value.replace(/\\x([\da-f]{2})/gi, '\\u00$1')).trim()).filter(value =>
    /[a-z]/i.test(value) && !names.has(value) && !fragments.has(value)))];
}

function emtrMenuSource() {
  const toolbar = fileSource('app/AppToolbar.jsx');
  const popup = toolbar.indexOf('const iconMenuPopup');
  const start = toolbar.indexOf(') : <>', popup);
  const end = toolbar.indexOf('</>}', start);
  assert.ok(popup >= 0 && start > popup && end > start, 'locate the EMTR icon menu JSX');
  return 'const menu = <>' + toolbar.slice(start + ') : <>'.length, end) + '</>;';
}

test('the JSX scan detects new text and accessible labels', () => {
  assert.deepEqual(visibleStrings(
    'const menu = <button title="New title" aria-label="New aria label" placeholder={empty ? "New placeholder" : undefined}><span/>New text</button>;',
  ).sort(), ['New aria label', 'New placeholder', 'New text', 'New title']);
});

const reviewedSources = {
  'app/AppToolbar.jsx': [
    'EMTR Library', 'Manager', 'Emitter Editor. Right-click for Glow Up, EMTR Library, and Manager.',
    'Library', 'All', 'Textures', 'Models', 'Sounds',
    'Material and Texture Library. Right-click to choose a section.',
  ],
  'app/ResourceEditors.jsx': [
    'Emitter Manager', 'Emitters', 'New emitter type:', 'New emitter type',
  ],
  'app/App.jsx': [
    'Set Bit RGB', 'The original model changed while editing the replacement.',
    'Save or Revert the temporary UV textures before replacing a part.',
    'Save model?', 'Commit or discard the replacement before saving.',
  ],
  'app/AppDialogs.jsx': ['Close model tab?', 'Discard replacement', 'Commit or discard the replacement before closing this tab.'],
  'electron/model-close.cjs': [
    'The replacement has not been committed.',
    'Commit or discard the replacement before saving. Close without saving discards it.',
  ],
  'electron/bits-and-parts.cjs': [
    'An entry with this name already exists in this folder.', 'A folder cannot be moved inside itself.',
    'Choose a valid folder name.', 'Choose a valid file or folder name.', 'Choose an entry inside BitsAndParts.',
    'Linked entries are not supported.', 'Choose a library action.',
    'This Bit uses a loose texture. Move its folder to keep the texture with the model.',
  ],
  'app/GameFileBrowser.jsx': [
    'Copy path', 'Path copied.', 'Save a copy…',
    'Units by race, campaign dialogue, music, ambient sounds and effects',
    'Grouped by file type, with World Editor sound categories',
  ],
  'app/TextureLibrary.jsx': ['Library sections', 'All files', 'Save a copy…'],
  'electron/game-file-library.cjs': [
    'Campaign dialogue', 'Cinematics', 'Ambient', 'Interface', 'Music', 'Combat', 'Spells',
    'Units', 'Buildings', 'Doodads', 'Other sounds', 'Night Elf', 'Neutral Hostile', 'Neutral Passive',
    'Text & data', 'Other files',
  ],
  'electron/main.cjs': ['The texture sources changed. Select the texture again.', 'Save copy'],
  'app/Settings.jsx': [
    'ShareX regions', 'Lets ShareX find the viewport and toolbox as capture regions. Runs a small helper program while an editor is open.',
  ],
};

test('BITZ, Library, Emitter Manager and ShareX UI strings are in all five catalogs', () => {
  const generated = [
    'Search emitters', 'Emitters list', 'No emitters.', 'Close Emitter Manager',
    'Bit R', 'Bit G', 'Bit B', 'Original ({0})', 'Saved {0}', 'Save a copy of {0}', '{0} could not be read.',
  ];
  for (const [file, keys] of Object.entries(reviewedSources)) {
    const source = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
    for (const key of keys) assert.ok(source.includes(key), file + ': ' + key);
  }
  const scanned = ['app/BitsAndParts.jsx', 'app/PartRgb.jsx', 'app/LibrarySaveCopy.jsx'].flatMap(file => visibleStrings(fileSource(file)));
  const keys = [...new Set([...Object.values(reviewedSources).flat(), ...generated, ...scanned, ...visibleStrings(emtrMenuSource())])];
  const missing = [];
  for (const locale of ['ru', 'es', 'zh', 'fr', 'de']) {
    const pack = JSON.parse(readFileSync(new URL('../src/locales/' + locale + '.json', import.meta.url), 'utf8'));
    for (const key of keys) if (!Object.hasOwn(pack, key)) missing.push(locale + ': ' + key);
  }
  assert.deepEqual(missing, []);
});