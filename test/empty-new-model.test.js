import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyDocument } from '../src/starter-model.js';

test('File → New makes a truly empty model in both formats', () => {
  for (const version of [800, 1000]) {
    const doc = createEmptyDocument(version), model = doc.model;
    assert.equal(model.Version, version);
    for (const key of ['Geosets', 'Materials', 'Textures', 'Bones', 'Helpers', 'Sequences']) assert.equal(model[key]?.length || 0, 0, key);
    assert.equal(doc.dirty, false);
  }
});
