import test from 'node:test';
import assert from 'node:assert/strict';
import { readStored, readStoredText, writeStored, writeStoredText } from '../src/local-store.js';

const memory = (values = {}) => ({ values, getItem: key => key in values ? values[key] : null, setItem(key, value) { values[key] = String(value); } });
const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('full'); } };

test('stored JSON values read back through the normaliser and fall back when missing or unreadable', () => {
  const storage = memory();
  assert.equal(readStored('k', 7, Number, storage), 7);
  assert.equal(writeStored('k', 62.5, storage), true);
  assert.equal(storage.values.k, '62.5');
  assert.equal(readStored('k', 7, value => value * 2, storage), 125);
  storage.values.k = 'not json';
  assert.equal(readStored('k', 7, Number, storage), 7);
  writeStored('list', ['ROC', 'TFT'], storage);
  assert.deepEqual(readStored('list', [], undefined, storage), ['ROC', 'TFT']);
});

test('plain-text values keep the bare words older versions saved', () => {
  const storage = memory({ tab: 'models' });
  assert.equal(readStoredText('tab', 'textures', value => ['textures', 'models'].includes(value) ? value : 'textures', storage), 'models');
  writeStoredText('vibe', false, storage);
  assert.equal(storage.values.vibe, 'false');
  assert.equal(readStoredText('missing', 'classic', undefined, storage), 'classic');
});

test('locked or full storage keeps the fallback and never throws', () => {
  assert.equal(readStored('k', 3, undefined, broken), 3);
  assert.equal(readStoredText('k', 'a', undefined, broken), 'a');
  assert.equal(writeStored('k', 1, broken), false);
  assert.equal(writeStoredText('k', 'x', broken), false);
});
