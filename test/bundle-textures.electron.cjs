// Texture Manager > Bundle Textures in the packaged app: a real click saves every
// texture file the model uses in one ZIP, with the bytes found next to the model.
// Run on a separate desktop: the packaged window must never reach the user's screen.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { launchApp, closeApp, stubDialogs, waitForInfo } = require('./helpers/app.cjs');
const { fixturePath } = require('./helpers/fixtures.cjs');

// Entries of a stored (uncompressed) ZIP, read from its local file headers.
function zipEntries(bytes) {
  const entries = new Map();
  for (let at = 0; bytes.readUInt32LE(at) === 0x04034b50;) {
    const method = bytes.readUInt16LE(at + 8), size = bytes.readUInt32LE(at + 18), nameLength = bytes.readUInt16LE(at + 26), extra = bytes.readUInt16LE(at + 28);
    assert.equal(method, 0, 'stored entry');
    const name = bytes.toString('utf8', at + 30, at + 30 + nameLength), start = at + 30 + nameLength + extra;
    entries.set(name, bytes.subarray(start, start + size));
    at = start + size;
  }
  return entries;
}

(async () => {
  const model = fixturePath('footman');
  if (!model || !fs.existsSync(model)) { console.log('SKIP: no Footman fixture at ' + model); return; }
  const out = path.resolve('out/bundle-textures');
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const target = path.join(out, 'Footman-textures.zip');
  const { app, page, errors } = await launchApp({ out, profile: path.join(out, 'profile'), fixture: model, timeout: 90000 });
  try {
    await waitForInfo(page, 'Opened Footman.mdx');
    const { openDocument } = await import('../src/editor-document.js');
    const images = [...new Set(openDocument(fs.readFileSync(model), 'Footman.mdx').model.Textures.map(texture => texture.Image).filter(Boolean))];
    await stubDialogs(app, { save: target });
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('menu', 'Textures'));
    const manager = page.getByRole('dialog', { name: 'Texture Manager', exact: true });
    await manager.waitFor();
    const button = manager.getByRole('button', { name: 'Bundle Textures', exact: true });
    assert.equal(await button.isDisabled(), false, 'Bundle Textures is clickable for a model with texture files');
    await button.click();
    for (let i = 0; i < 100 && !fs.existsSync(target); i++) await page.waitForTimeout(100);
    assert.ok(fs.existsSync(target), 'the ZIP is saved where the save dialog points');
    const entries = zipEntries(fs.readFileSync(target));
    const local = images.map(image => image.replace(/\\/g, '/')).filter(name => fs.existsSync(path.join(path.dirname(model), name)));
    assert.ok(local.length > 0, 'the Footman has texture files beside it: ' + images.join(', '));
    for (const name of local) {
      assert.ok(entries.has(name), name + ' is in the ZIP: ' + [...entries.keys()].join(', '));
      assert.deepEqual(entries.get(name), fs.readFileSync(path.join(path.dirname(model), name)), name + ' bytes match the file');
    }
    for (const name of entries.keys()) assert.ok(images.some(image => image.replace(/\\/g, '/').toLowerCase() === name.toLowerCase()), name + ' is one of the model textures');
    await page.screenshot({ path: path.join(out, 'texture-manager.png') });
    assert.deepEqual(errors, []);
    console.log('PASS bundle-textures', JSON.stringify({ images, entries: [...entries.keys()] }));
  } finally {
    await closeApp(app);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
