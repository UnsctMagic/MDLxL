import test from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
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


const reviewedSources = {
  'app/AppToolbar.jsx': [
    'EMTR Library', 'Manager', 'Emitter Editor. Right-click for Glow Up, EMTR Library, and Manager.',
    'Library', 'All', 'Textures', 'Models', 'Sounds',
    'Material and Texture Library. Right-click to choose a section.',
  ],
  'app/ResourceEditors.jsx': [
    'Emitter Manager', 'Emitters', 'New emitter type:', 'New emitter type',
  ],
  'app/BitsAndParts.jsx': [
    'Manage', 'Done', 'New folder', 'Rename', 'Move', 'Delete', 'Name', 'Folder',
    'Create folder', 'Save name', 'Move here', 'Move to Recycle Bin', 'Mixed', 'Custom RGB',
    'Choose a Bit to replace the selection.',
    'Edit the Bit’s RGB channels before importing (0–255). Blank channels keep the selected look.',
  ],
  'app/PartRgb.jsx': [
    'Replacement RGB', 'Set RGB (0–255) on the selected geosets. Press Enter or leave the field to preview the value.',
  ],
  'app/App.jsx': [
    'Set Bit RGB', 'The original model changed while editing the replacement.',
    'Save or Revert the temporary UV textures before replacing a part.',
    'Commit or discard the replacement before saving.',
  ],
  'app/AppDialogs.jsx': ['Discard replacement', 'Commit or discard the replacement before closing this tab.'],
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
  'app/LibrarySaveCopy.jsx': ['Texture save format'],
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
  const keys = [...new Set([...Object.values(reviewedSources).flat(), ...generated])];
  const missing = [];
  for (const locale of ['ru', 'es', 'zh', 'fr', 'de']) {
    const pack = JSON.parse(readFileSync(new URL('../src/locales/' + locale + '.json', import.meta.url), 'utf8'));
    for (const key of keys) if (!Object.hasOwn(pack, key)) missing.push(locale + ': ' + key);
  }
  assert.deepEqual(missing, []);
});