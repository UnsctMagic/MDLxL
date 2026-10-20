import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { normalizePreferences } from '../src/preferences.js';

const { FileTypeRegistration, registryEntries, addArguments, PROG_ID } = createRequire(import.meta.url)('../electron/file-types.cjs');
const executable = 'D:\\Apps\\MDLxL\\MDLxL.exe', brandingDirectory = 'D:\\Apps\\MDLxL\\resources\\app\\dist\\branding';

test('file icon preference accepts the four choices and defaults to the helmet page', () => {
  assert.equal(normalizePreferences({}).fileIcon, 'page');
  for (const choice of ['page', 'dark-page', 'tile', 'program']) assert.equal(normalizePreferences({ fileIcon: choice }).fileIcon, choice);
  assert.equal(normalizePreferences({ fileIcon: 'C:\\evil.ico' }).fileIcon, 'page');
});

test('file type points at the chosen icon or the program icon', () => {
  const icon = choice => registryEntries({ choice, executable, brandingDirectory }).find(([key]) => key.endsWith(`${PROG_ID}\\DefaultIcon`))[3];
  assert.equal(icon('page'), `${brandingDirectory}\\file-page.ico`);
  assert.equal(icon('dark-page'), `${brandingDirectory}\\file-dark-page.ico`);
  assert.equal(icon('tile'), `${brandingDirectory}\\file-tile.ico`);
  assert.equal(icon('program'), `"${executable}",0`);
});

test('the Open with > Always entry for MDLxL.exe shows the same icon', async () => {
  const appIcon = choice => registryEntries({ choice, executable, brandingDirectory }).find(([key]) => key === 'HKCU\\Software\\Classes\\Applications\\MDLxL.exe\\DefaultIcon')[3];
  assert.equal(appIcon('dark-page'), `${brandingDirectory}\\file-dark-page.ico`);
  assert.equal(appIcon('program'), `"${executable}",0`);
});

test('model extensions only gain an Open with entry; nothing is written outside HKCU', () => {
  const entries = registryEntries({ choice: 'page', executable, brandingDirectory });
  assert.ok(entries.every(([key]) => key.startsWith('HKCU\\')));
  for (const extension of ['.mdx', '.mdl']) assert.ok(!entries.some(([key, name]) => key === `HKCU\\Software\\Classes\\${extension}` && name === null), extension);
  assert.deepEqual(addArguments(entries.find(([key]) => key.endsWith('.mdx\\OpenWithProgids'))), ['add', 'HKCU\\Software\\Classes\\.mdx\\OpenWithProgids', '/v', PROG_ID, '/t', 'REG_NONE', '/f']);
  assert.deepEqual(addArguments(entries.find(([key]) => key.endsWith('shell\\open\\command'))).slice(-3), ['/d', `"${executable}" "%1"`, '/f']);
});

test('registration writes once, then skips until the icon changes', async () => {
  const registry = new Map(), calls = [];
  const run = async (file, args) => {
    calls.push(file);
    if (file !== 'reg.exe') return '';
    if (args[0] === 'add') { registry.set(args[1] + '|' + (args[2] === '/ve' ? '' : args[3]), args.includes('/d') ? args[args.indexOf('/d') + 1] : ''); return ''; }
    const key = args[1] + '|' + (args[2] === '/ve' ? '' : args[3]);
    if (!registry.has(key)) throw Error('not found');
    return `\r\n${args[1]}\r\n    ${args[2] === '/ve' ? '(Default)' : args[3]}    REG_SZ    ${registry.get(key)}\r\n`;
  };
  const types = new FileTypeRegistration({ executable, brandingDirectory, run });
  assert.equal(await types.apply('page'), true);
  assert.ok(calls.includes('powershell.exe'));
  assert.equal(await types.apply('page'), false);
  assert.equal(await types.apply('tile'), true);
  assert.equal(registry.get(`HKCU\\Software\\Classes\\${PROG_ID}\\DefaultIcon|`), `${brandingDirectory}\\file-tile.ico`);
  // An earlier version registered without the Applications icon; it is filled in once.
  registry.delete('HKCU\\Software\\Classes\\Applications\\MDLxL.exe\\DefaultIcon|');
  assert.equal(await types.apply('tile'), true);
  assert.equal(await types.apply('tile'), false);
});
