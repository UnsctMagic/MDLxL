import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { writeFileAtomic, serialQueue } = require('../electron/atomic-file.cjs');

async function scratch(t) {
  const root = path.resolve(os.tmpdir()), prefix = 'mdlxl-atomic-', directory = await fs.mkdtemp(path.join(root, prefix));
  t.after(async () => {
    if (path.dirname(path.resolve(directory)) !== root || !path.basename(directory).startsWith(prefix)) throw Error('Unexpected atomic test cleanup location.');
    await fs.rm(directory, { recursive: true, force: true });
  });
  return directory;
}

test('atomic writes replace the file through a random temporary name and leave nothing behind', async t => {
  const directory = await scratch(t), file = path.join(directory, 'state.json');
  await writeFileAtomic(file, 'first');
  await writeFileAtomic(file, Buffer.from('second'), { verify: true });
  assert.equal(await fs.readFile(file, 'utf8'), 'second');
  assert.deepEqual(await fs.readdir(directory), ['state.json']);
  // A stale fixed-name temporary file from an older build does not block a write.
  await fs.writeFile(file + '.tmp', 'stale');
  await writeFileAtomic(file, 'third');
  assert.equal(await fs.readFile(file, 'utf8'), 'third');
});

test('a briefly locked file is retried; other failures keep the old file and remove the temporary', async t => {
  const directory = await scratch(t), file = path.join(directory, 'index.json');
  await fs.writeFile(file, 'old');
  const rename = fs.rename;
  let attempts = 0;
  fs.rename = async (from, to) => { if (to === file && ++attempts < 3) throw Object.assign(Error('locked'), { code: 'EBUSY' }); return rename(from, to); };
  try { await writeFileAtomic(file, 'new'); } finally { fs.rename = rename; }
  assert.equal(attempts, 3);
  assert.equal(await fs.readFile(file, 'utf8'), 'new');
  fs.rename = async () => { throw Object.assign(Error('Disk write failed'), { code: 'EIO' }); };
  try { await assert.rejects(writeFileAtomic(file, 'broken'), /Disk write failed/); } finally { fs.rename = rename; }
  assert.equal(await fs.readFile(file, 'utf8'), 'new');
  assert.deepEqual(await fs.readdir(directory), ['index.json']);
});

test('backup keeps the replaced copy and verify refuses a temporary that reads back differently', async t => {
  const directory = await scratch(t), file = path.join(directory, 'preset.json');
  await writeFileAtomic(file, 'one', { backup: true });
  assert.deepEqual(await fs.readdir(directory), ['preset.json'], 'nothing to back up yet');
  await writeFileAtomic(file, 'two', { backup: true });
  assert.equal(await fs.readFile(file + '.previous', 'utf8'), 'one');
  const readFile = fs.readFile;
  fs.readFile = async (name, ...rest) => String(name).endsWith('.tmp') ? Buffer.from('damaged') : readFile(name, ...rest);
  try { await assert.rejects(writeFileAtomic(file, 'three', { verify: true }), /Write verification failed/); } finally { fs.readFile = readFile; }
  assert.equal(await fs.readFile(file, 'utf8'), 'two');
  assert.deepEqual((await fs.readdir(directory)).sort(), ['preset.json', 'preset.json.previous']);
});

test('serial queue runs operations in order and one failure does not stop the next', async () => {
  const run = serialQueue(), order = [];
  const slow = run(async () => { await new Promise(resolve => setTimeout(resolve, 20)); order.push('slow'); return 1; });
  const failing = run(async () => { order.push('failing'); throw Error('nope'); });
  const last = run(async () => { order.push('last'); return 3; });
  assert.equal(await slow, 1);
  await assert.rejects(failing, /nope/);
  assert.equal(await last, 3);
  await run.idle();
  assert.deepEqual(order, ['slow', 'failing', 'last']);
});
