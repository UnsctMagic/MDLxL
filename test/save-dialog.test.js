import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../electron/main.cjs', import.meta.url), 'utf8');
const helpers = source.slice(source.indexOf('async function chooseSavePath('), source.indexOf('function captureOwner('));

function load(answer, opened = []) {
  const calls = [];
  const context = vm.createContext({ path, win: {},
    dialog: { showSaveDialog: async (_window, options) => { calls.push(JSON.parse(JSON.stringify(options))); return answer; } },
    shell: { openPath: async directory => { opened.push(directory); return directory.includes('missing') ? 'The folder does not exist.' : ''; } } });
  vm.runInContext(helpers, context);
  return { ...context, calls };
}

test('save dialogs force their extension, keep the filter and report cancel as null', async () => {
  const { chooseSavePath, calls } = load({ canceled: false, filePath: 'D:\\Effects\\Fire' });
  assert.equal(await chooseSavePath({ title: 'Export particle preset', defaultPath: 'Fire.mdlxl-particle', extension: 'mdlxl-particle', filterName: 'MDLxL particle preset' }), 'D:\\Effects\\Fire.mdlxl-particle');
  assert.deepEqual(calls[0].filters, [{ name: 'MDLxL particle preset', extensions: ['mdlxl-particle'] }]);
  const upper = load({ canceled: false, filePath: 'D:\\Copy\\Peon.BLP' });
  assert.equal(await upper.chooseSavePath({ title: 'Save a copy', defaultPath: 'Peon.blp', extension: 'blp', buttonLabel: 'Save copy' }), 'D:\\Copy\\Peon.BLP');
  assert.equal(upper.calls[0].buttonLabel, 'Save copy');
  assert.deepEqual(upper.calls[0].filters, [{ name: 'BLP', extensions: ['blp'] }]);
  const plain = load({ canceled: false, filePath: 'D:\\Copy\\README' });
  assert.equal(await plain.chooseSavePath({ title: 'Save a copy', defaultPath: 'README', extension: '' }), 'D:\\Copy\\README');
  assert.equal(plain.calls[0].filters, undefined);
  assert.equal(await load({ canceled: true, filePath: '' }).chooseSavePath({ title: 'Save', extension: 'mdx' }), null);
});

test('opening a library folder returns it or reports the Explorer error', async () => {
  const opened = [], { openFolder } = load({ canceled: true }, opened);
  assert.equal(await openFolder('D:\\MDLxL\\Textures'), 'D:\\MDLxL\\Textures');
  await assert.rejects(openFolder('D:\\missing'), /does not exist/);
  assert.deepEqual(opened, ['D:\\MDLxL\\Textures', 'D:\\missing']);
});
