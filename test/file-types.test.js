import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { normalizePreferences } from '../src/preferences.js';

const { FileTypeRegistration, registryEntries, addArguments, PROG_ID, MODEL_TYPES } = createRequire(import.meta.url)('../electron/file-types.cjs');
const executable = 'D:\\Apps\\MDLxL\\MDLxL.exe', brandingDirectory = 'D:\\Apps\\MDLxL\\resources\\app\\dist\\branding';

test('file icon preference accepts the icon choices and defaults to the helmet page', () => {
  assert.equal(normalizePreferences({}).fileIcon, 'page');
  for (const choice of ['page', 'dark-page', 'tile', 'program', 'label-page', 'label-dark-page', 'label-tile', 'label-tag', 'label-letters']) assert.equal(normalizePreferences({ fileIcon: choice }).fileIcon, choice);
  assert.equal(normalizePreferences({ fileIcon: 'C:\\evil.ico' }).fileIcon, 'page');
});

test('MDL files follow the old single choice until they get their own', () => {
  assert.equal(normalizePreferences({}).fileIconMdl, 'page');
  assert.equal(normalizePreferences({ fileIcon: 'tile' }).fileIconMdl, 'tile');
  assert.equal(normalizePreferences({ fileIcon: 'tile', fileIconMdl: 'label-letters' }).fileIconMdl, 'label-letters');
  assert.equal(normalizePreferences({ fileIcon: 'label-tag' }).fileIcon, 'label-tag');
});

test('MDL and MDX get their own file types and labelled icons', () => {
  const entries = registryEntries({ choice: { mdl: 'label-page', mdx: 'label-tag' }, executable, brandingDirectory });
  const value = key => entries.find(([name, valueName]) => name === key && valueName === null)?.[3];
  assert.equal(value('HKCU\\Software\\Classes\\MDLxL.MDL\\DefaultIcon'), `${brandingDirectory}\\file-mdl-page.ico`);
  assert.equal(value('HKCU\\Software\\Classes\\MDLxL.MDX\\DefaultIcon'), `${brandingDirectory}\\file-mdx-tag.ico`);
  // The shared type (Paint Projects, older defaults) shows the unlabelled MDX style.
  assert.equal(value(`HKCU\\Software\\Classes\\${PROG_ID}\\DefaultIcon`), `"${executable}",0`);
  for (const [extension, { progId }] of Object.entries(MODEL_TYPES)) {
    assert.ok(entries.some(([key, name]) => key === `HKCU\\Software\\Classes\\${extension}\\OpenWithProgids` && name === progId), extension);
    assert.ok(entries.some(([key, name, , data]) => key.endsWith('Capabilities\\FileAssociations') && name === extension && data === progId), extension);
  }
  for (const kind of ['mdl', 'mdx']) for (const style of ['page', 'dark-page', 'tile', 'tag', 'letters']) assert.ok(existsSync(new URL(`../public/branding/file-${kind}-${style}.ico`, import.meta.url)), `${kind}-${style}`);
});

test('a default chosen for the old shared type is noticed', async () => {
  const types = progId => new FileTypeRegistration({ executable, brandingDirectory, run: async (file, args) => {
    if (!args[1].endsWith('.mdx\\UserChoice')) throw Error('not found');
    return `\r\n${args[1]}\r\n    ProgId    REG_SZ    ${progId}\r\n`;
  } });
  assert.equal(await types(PROG_ID).usesSharedDefault(), true);
  assert.equal(await types('MDLxL.MDX').usesSharedDefault(), false);
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
  assert.deepEqual(addArguments(entries.find(([key]) => key.endsWith('.mdx\\OpenWithProgids'))), ['add', 'HKCU\\Software\\Classes\\.mdx\\OpenWithProgids', '/v', 'MDLxL.MDX', '/t', 'REG_NONE', '/f']);
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

test('another copy leaves the file types alone unless the owner is gone or it claims them', async () => {
  const registry = new Map(), present = new Set([executable]);
  const run = async (file, args) => {
    if (file !== 'reg.exe') return '';
    const key = args[1] + '|' + (args[2] === '/ve' ? '' : args[3]);
    if (args[0] === 'add') { registry.set(key, args.includes('/d') ? args[args.indexOf('/d') + 1] : ''); return ''; }
    if (args[0] === 'delete' || !registry.has(key)) throw Error('not found');
    return `\r\n${args[1]}\r\n    (Default)    REG_SZ    ${registry.get(key)}\r\n`;
  };
  const command = () => registry.get(`HKCU\\Software\\Classes\\${PROG_ID}\\shell\\open\\command|`);
  const copy = file => new FileTypeRegistration({ executable: file, brandingDirectory, run, exists: candidate => present.has(candidate) });
  const testBuild = 'D:\\TestBuilds\\MDLxL\\MDLxL.exe';
  assert.equal(await copy(executable).apply('page'), true);
  assert.equal(await copy(testBuild).apply('page'), false);
  assert.equal(command(), `"${executable}" "%1"`);
  // Picking an icon in the test build, or installing an update there, takes them over.
  assert.equal(await copy(testBuild).apply('tile', { claim: true }), true);
  assert.equal(registry.get('HKCU\\Software\\Classes\\Applications\\MDLxL.exe\\shell\\open\\command|'), `"${testBuild}" "%1"`);
  // After an update the installed copy claims them back from a test build that still exists.
  present.add(testBuild);
  assert.equal(await copy(executable).apply('tile'), false);
  assert.equal(await copy(executable).apply('tile', { claim: true }), true);
  // A deleted owner hands them to whichever copy starts next.
  present.delete(executable);
  assert.equal(await copy(testBuild).apply('tile'), true);
  assert.equal(command(), `"${testBuild}" "%1"`);
});
