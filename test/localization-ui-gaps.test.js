import test from 'node:test';
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
  for (const locale of ['es', 'ru', 'zh']) {
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
