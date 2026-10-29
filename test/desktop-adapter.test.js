import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('game files resolve through the desktop bridge and are an empty list in the browser', async () => {
  const previous = globalThis.window;
  try {
    globalThis.window = {};
    const browser = await import('../app/desktop.js?browser');
    assert.equal(browser.desktop, null);
    assert.equal(browser.hasDesktop('resolveTextures'), false);
    assert.deepEqual(await browser.resolveGameFiles(['Textures\\Peon.blp'], 'D:\\Models\\Peon.mdx'), []);

    const requests = [];
    globalThis.window = { desktop: { resolveTextures: async request => { requests.push(request); return [{ name: request.names[0], bytes: new Uint8Array([1]) }]; }, version: '1' } };
    const app = await import('../app/desktop.js?desktop');
    assert.equal(app.hasDesktop('resolveTextures'), true);
    assert.equal(app.hasDesktop('version'), false, 'only functions count as features');
    assert.equal(app.hasDesktop('missing'), false);
    assert.equal((await app.resolveGameFiles(['Textures\\Peon.blp'], 'D:\\Models\\Peon.mdx'))[0].name, 'Textures\\Peon.blp');
    assert.deepEqual(await app.resolveGameFiles([]), [], 'nothing to look up asks nothing');
    assert.deepEqual(requests, [{ names: ['Textures\\Peon.blp'], path: 'D:\\Models\\Peon.mdx' }]);
  } finally {
    globalThis.window = previous;
  }
});

test('the resolve-with-fallback sites use the desktop adapter', async () => {
  for (const file of ['ParticleEditor.jsx', 'ParticleExampleComparison.jsx', 'PaintTextureShelf.jsx', 'PaintWorkspace.jsx', 'BitsAndParts.jsx', 'App.jsx', 'ForgeShapes.jsx', 'TextureLibrary.jsx']) {
    const source = await fs.readFile(new URL('../app/' + file, import.meta.url), 'utf8');
    assert.match(source, /from '\.\/desktop\.js'/, file);
    assert.doesNotMatch(source, /window\.desktop\??\.resolveTextures/, file);
  }
});
