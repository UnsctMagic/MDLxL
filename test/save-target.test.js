import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareModelSave } from '../src/save-target.js';
import { createStarterDocument } from '../src/starter-model.js';
import { createDemoDocument, openDocument } from '../src/editor-document.js';

test('Save As selects actual bytes and extension for both model versions', () => {
  for (const version of [800, 1000]) {
    const doc = createStarterDocument(version);
    assert.equal(doc.format, 'mdx');
    for (const format of ['mdl', 'mdx']) {
      const saved = prepareModelSave(doc, format);
      assert.equal(saved.name, 'Untitled.' + format);
      const reopened = openDocument(saved.bytes, saved.name);
      assert.equal(reopened.version, version); assert.equal(reopened.format, format);
      if (version === 1000) assert.equal(reopened.model.Geosets[0].LevelOfDetail, 0);
    }
  }
});

test('Save As blocks opaque loss in both directions and keeps exact original saves', () => {
  const starter = createStarterDocument();
  const text = Buffer.concat([starter.serialize('mdl'), Buffer.from('\nFuture { Value 1, }')]);
  const chunk = Buffer.alloc(12); chunk.write('XTRA'); chunk.writeUInt32LE(4, 4); chunk.writeUInt32LE(42, 8);
  const binary = Buffer.concat([starter.serialize('mdx'), chunk]);
  for (const [bytes, format] of [[text, 'mdl'], [binary, 'mdx']]) {
    const doc = openDocument(bytes, 'future.' + format), before = structuredClone(doc.model);
    assert.throws(() => prepareModelSave(doc, format === 'mdx' ? 'mdl' : 'mdx'), /unrecognized source data/);
    assert.deepEqual(doc.model, before); assert.equal(doc.dirty, false);
    assert.deepEqual(Buffer.from(prepareModelSave(doc, format).bytes), bytes);
  }
});

for (const format of ['mdx', 'mdl']) test('save preflight returns unreadable ' + format.toUpperCase() + ' output with a distinct flag', () => {
  const doc = createDemoDocument();
  const baseline = doc.originalBytes;
  // Force a syntactically writable version the reader cannot edit. An actual
  // document edit cannot set it, so this fixture bypasses the edit guard only.
  doc.model.Version = 9999;
  const prepared = prepareModelSave(doc, format);
  assert.ok(prepared.bytes.length);
  assert.equal(openDocument(prepared.bytes, prepared.name).readOnly, true);
  assert.equal(prepared.unreadable, true);
  assert.ok(prepared.verificationWarnings.length);
  assert.equal(doc.dirty, true);
  assert.deepEqual(doc.originalBytes, baseline);
});
