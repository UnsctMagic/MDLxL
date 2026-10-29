import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createDemoDocument, openDocument } from '../src/editor-document.js';
import { fixturePath } from './helpers/fixtures.cjs';
import { textureReferenceIdentity } from './helpers/texture-reference-identity.js';

// Recorded from unmodified origin/main a953a6949db1bf1e47303e517766b15062a19c60.
const expected = JSON.parse(fs.readFileSync(new URL('./fixtures/texture-reference-identity.json', import.meta.url)));
test('WP-3.4 identity: demo Sort My Mess, Bits and Parts and Merge Similar', () => {
  assert.deepEqual(textureReferenceIdentity(createDemoDocument().model), expected.demo);
});
test('WP-3.4 identity: CASC Footman Sort My Mess, Bits and Parts and Merge Similar', t => {
  const file = fixturePath('footman');
  if (!fs.existsSync(file)) { t.skip('Requires MDLXL_SUITE_FOOTMAN extracted from CASC'); return; }
  assert.deepEqual(textureReferenceIdentity(openDocument(fs.readFileSync(file), 'Footman.mdx').model), expected.footman);
});
