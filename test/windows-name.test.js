import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { isWindowsName, safeWindowsName } = require('../electron/windows-name.cjs');

test('Windows filename rule accepts ordinary names and refuses forbidden characters, endings and device names', () => {
  for (const name of ['Footman', 'Footman_Portrait.mdx', 'Fire (big).mdlxl-particle', 'con-artist', 'Console', 'COM10']) assert.equal(isWindowsName(name), true, name);
  for (const name of ['', 'a<b', 'a>b', 'a:b', 'a"b', 'a/b', 'a\\b', 'a|b', 'a?b', 'a*b', 'tab\tname', 'dot.', 'space ', 'CON', 'con.txt', 'Prn', 'AUX.mdx', 'nul', 'COM1', 'lpt9.blp', null, 7]) assert.equal(isWindowsName(name), false, String(name));
  assert.equal(safeWindowsName('Footman', { reject: 'Bad name.' }), 'Footman');
  assert.throws(() => safeWindowsName('CON', { reject: 'Choose a valid Bit filename.' }), /Choose a valid Bit filename/);
});

test('repairing a name replaces forbidden characters, trims endings and guards device names', () => {
  assert.equal(safeWindowsName('Fire: big/small?'), 'Fire_ big_small_');
  assert.equal(safeWindowsName('Trailing. . '), 'Trailing');
  assert.equal(safeWindowsName('CON'), '_CON');
  assert.equal(safeWindowsName('lpt1.final'), '_lpt1.final');
  assert.equal(safeWindowsName('...'), 'Untitled');
  assert.equal(safeWindowsName(''), 'Untitled');
  assert.equal(safeWindowsName('   ', { fallback: 'Particle preset' }), 'Particle preset');
});

test('Electron filename callers share the rule', async () => {
  for (const file of ['bits-and-parts.cjs', 'forge-assets.cjs', 'preview-capture.cjs', 'main.cjs', 'updater.cjs']) {
    const source = await fs.readFile(new URL('../electron/' + file, import.meta.url), 'utf8');
    assert.match(source, /require\('\.\/windows-name\.cjs'\)/, file);
    assert.doesNotMatch(source, /con\|prn\|aux\|nul/i, file);
  }
});
