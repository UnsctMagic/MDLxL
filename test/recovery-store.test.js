import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { RecoveryStore } = require('../electron/recovery.cjs');
async function scratch(t) {
  const base = path.resolve(os.tmpdir()), directory = await fs.mkdtemp(path.join(base, 'mdlvis-recovery-'));
  t.after(async () => {
    const resolved = path.resolve(directory);
    if (!resolved.toLowerCase().startsWith(base.toLowerCase() + path.sep) || !path.basename(resolved).startsWith('mdlvis-recovery-')) throw Error('Unexpected recovery cleanup location.');
    await fs.rm(resolved, { recursive: true, force: true });
  }); return directory;
}
const draft = (id, file, version = 1) => ({ id, version, path: file, dirty: true, state: { name: id } });

test('recovery keeps at most 15 drafts, newest first', async t => {
  const root = await scratch(t), store = new RecoveryStore(root);
  for (let i = 0; i < 20; i++) await store.write(draft('model-' + i, `C:\\Models\\m${i}.mdx`));
  const ids = (await store.list()).map(item => item.id);
  assert.equal(ids.length, 15);
  assert.ok(ids.includes('model-19'));
  assert.equal((await fs.readdir(root)).filter(file => file.endsWith('.recovery')).length, 15);
});

test('reopening the same model file replaces its older draft', async t => {
  const root = await scratch(t);
  await new RecoveryStore(root).write(draft('old-open', 'C:\\Models\\Footman.mdx'));
  await new RecoveryStore(root).write(draft('other', 'C:\\Models\\Knight.mdx'));
  const next = new RecoveryStore(root);
  await next.write(draft('new-open', 'c:\\models\\footman.MDX'));
  await next.write(draft('new-open', 'c:\\models\\footman.MDX', 2));
  assert.deepEqual((await next.list()).map(item => item.id).sort(), ['new-open', 'other']);
});

test('two open tabs of the same file in one session keep their own drafts', async t => {
  const root = await scratch(t), store = new RecoveryStore(root);
  await store.write(draft('tab-a', 'C:\\Models\\Footman.mdx'));
  await store.write(draft('tab-b', 'C:\\Models\\Footman.mdx'));
  assert.deepEqual((await store.list()).map(item => item.id).sort(), ['tab-a', 'tab-b']);
});

test('the one-time reset clears old drafts once, but waits while a crash draft is pending', async t => {
  const root = await scratch(t);
  await new RecoveryStore(root).write(draft('old', 'C:\\Models\\Footman.mdx'));
  await fs.writeFile(path.join(root, 'stale.recovery.tmp'), '');
  const store = new RecoveryStore(root);
  assert.equal(await store.resetOnce(true), false);
  assert.equal((await store.list()).length, 1);
  assert.equal(await store.resetOnce(false), true);
  assert.deepEqual(await store.list(), []);
  assert.deepEqual((await fs.readdir(root)).filter(file => /recovery/.test(file)), []);
  await store.write(draft('after', 'C:\\Models\\Footman.mdx'));
  assert.equal(await new RecoveryStore(root).resetOnce(false), false);
  assert.deepEqual((await store.list()).map(item => item.id), ['after']);
});
