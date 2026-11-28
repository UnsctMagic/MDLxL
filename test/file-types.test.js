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
  const testBuild = 'D:\\Apps\\MDLxL-copy\\MDLxL.exe';
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

test('test builds never take over double-clicked models, even when the owner is gone or they claim', async () => {
  const registry = new Map(), writes = [];
  const run = async (file, args) => {
    if (file !== 'reg.exe') return '';
    if (args[0] === 'add') { writes.push(args[1]); registry.set(args[1], args[args.indexOf('/d') + 1]); return ''; }
    throw Error('not found');
  };
  for (const build of ['D:\\Claude\\MDLxL\\TestBuilds\\uv-new-tools\\MDLxL-win32-x64\\MDLxL.exe', 'D:\\Claude\\MDLxL\\.claude\\worktrees\\task\\out\\pkg-picks\\MDLxL-win32-x64\\MDLxL.exe', 'D:\\Codex\\xfer-showcase-40\\Engine\\MDLxL-win32-x64\\MDLxL.exe']) {
    const copy = new FileTypeRegistration({ executable: build, brandingDirectory, run, exists: () => false });
    assert.equal(await copy.apply('page'), false, build);
    assert.equal(await copy.apply('tile', { claim: true }), false, build);
  }
  assert.deepEqual(writes, []);
  assert.equal(await new FileTypeRegistration({ executable, brandingDirectory, run, exists: () => false }).apply('page'), true);
});

test('Open with defaults are detected for either extension, regardless of registry casing', async () => {
  for (const extension of ['.mdl', '.mdx']) for (const progId of ['Applications\\MDLxL.exe', 'applications\\mdlxl.EXE', 'mdlxl.model']) {
    const types = new FileTypeRegistration({ executable, brandingDirectory, run: async (file, args) => {
      if (!args[1].endsWith(extension + '\\UserChoice')) throw Error('not found');
      return `\r\n${args[1]}\r\n    ProgId    REG_SZ    ${progId}\r\n`;
    } });
    assert.equal(await types.usesSharedDefault(), true, `${extension}: ${progId}`);
  }
});

test('Remove MDLxL from Windows deletes only MDLxL entries and only from the owning copy', async () => {
  const calls = [];
  const run = (owner, defaults = {}) => async (file, args) => {
    calls.push([file, ...args]);
    if (args[0] === 'query' && args[1].endsWith(`${PROG_ID}\\shell\\open\\command`)) return `\r\n    (Default)    REG_SZ    "${owner}" "%1"\r\n`;
    if (args[0] === 'query' && /\\UserChoice(Latest)?$/.test(args[1])) { const progId = defaults[args[1].split('\\').at(-2)]; if (progId) return `\r\n    ProgId    REG_SZ    ${progId}\r\n`; }
    if (args[0] === 'query') throw Error('not found');
    return '';
  };
  const deleted = () => calls.filter(call => call[1] === 'delete').map(call => call.slice(2, -1).join(' '));
  const types = new FileTypeRegistration({ executable, brandingDirectory, run: run(executable, { '.mdx': 'MDLxL.MDX', '.mdl': 'Some.Other.Editor' }), exists: () => true });
  assert.deepEqual(await types.remove(), { removed: true });
  const removed = deleted();
  for (const key of ['MDLxL.Model', 'MDLxL.MDL', 'MDLxL.MDX', 'Applications\\MDLxL.exe', '.mdlxlpaint']) assert.ok(removed.includes(`HKCU\\Software\\Classes\\${key}`), key);
  assert.ok(removed.includes('HKCU\\Software\\RegisteredApplications /v MDLxL'));
  assert.ok(removed.includes('HKCU\\Software\\MDLxL'));
  assert.ok(removed.includes('HKCU\\Software\\Classes\\.mdx\\OpenWithProgids /v MDLxL.MDX'));
  // Windows' default is cleared where it is MDLxL, kept where it is another program.
  assert.ok(removed.some(key => key.endsWith('FileExts\\.mdx\\UserChoice')));
  assert.ok(!removed.some(key => key.includes('FileExts\\.mdl\\')));
  assert.ok(!removed.some(key => /Classes\\\.(mdx|mdl)$/.test(key)), 'the .mdl/.mdx keys themselves stay');
  assert.ok(removed.every(key => key.startsWith('HKCU\\')));

  calls.length = 0;
  const other = new FileTypeRegistration({ executable, brandingDirectory, run: run('D:\\Other\\MDLxL.exe'), exists: () => true });
  assert.deepEqual(await other.remove(), { removed: false, owner: 'D:\\Other\\MDLxL.exe' });
  assert.deepEqual(deleted(), []);

  calls.length = 0;
  const testCopy = new FileTypeRegistration({ executable: 'D:\\Claude\\MDLxL\\TestBuilds\\x\\MDLxL.exe', brandingDirectory, run: run(executable), exists: () => true });
  assert.equal((await testCopy.remove()).removed, false);
  assert.deepEqual(deleted(), []);
});

test('a copy taken out of Windows stays out until a file icon is picked', () => {
  assert.equal(normalizePreferences({}).windowsFileTypes, true);
  assert.equal(normalizePreferences({ windowsFileTypes: false }).windowsFileTypes, false);
  assert.equal(normalizePreferences({ windowsFileTypes: 'no' }).windowsFileTypes, true);
});
