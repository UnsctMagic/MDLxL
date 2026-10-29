import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { gamePathKey, toBackslashes, toForwardSlashes } from '../src/game-path.js';
import { partPathKey } from '../src/bits-and-parts.js';

const { gamePathKey: electronKey } = createRequire(import.meta.url)('../electron/game-path.cjs');

test('game path key uses backslashes and lower case, and a missing name gives an empty key', () => {
  for (const key of [gamePathKey, electronKey, partPathKey]) {
    assert.equal(key('Textures/Foo.BLP'), 'textures\\foo.blp');
    assert.equal(key(undefined), '');
    assert.equal(key(null), '');
  }
  assert.equal(toBackslashes('a/b'), 'a\\b');
  assert.equal(toForwardSlashes('a\\b'), 'a/b');
  assert.equal(toBackslashes(undefined), '');
});
