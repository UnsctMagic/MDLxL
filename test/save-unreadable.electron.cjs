const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { appTarget, appDist, launchApp, closeApp, stubDialogs, waitForInfo } = require('./helpers/app.cjs');

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

test('an unreadable Save As overwrites only after making a backup and leaves the original baseline and dirty tab', async () => {
  const target = appTarget();
  assert.ok(target.packaged, 'use a disposable packaged build');
  const testRoot = path.resolve('out/save-unreadable');
  fs.mkdirSync(testRoot, { recursive: true });
  const out = fs.mkdtempSync(path.join(testRoot, 'write-'));
  const file = path.join(out, 'Unreadable save.mdx'), destination = path.join(out, 'Existing model.mdx');
  const bytes = fs.readFileSync('test/fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx');
  fs.writeFileSync(file, bytes);
  const previous = Buffer.from(bytes);
  previous.write('Previous destination', previous.indexOf('MODL') + 8, 'ascii');
  fs.writeFileSync(destination, previous);
  const dir = path.join(appDist(target), 'assets');
  const workerPath = path.join(dir, fs.readdirSync(dir).find(name => /^model-save\.worker-.*\.js$/.test(name)));
  const worker = fs.readFileSync(workerPath, 'utf8');
  // Inject a writer failure into the disposable package only. Leave the app's
  // real serialization, reopen check, IPC, overwrite and renderer save flow in use.
  const reopen = /(\b\w+\()(\w+)(,\x60validation\.\$\{\w+\}\x60,\{allowHD:!0\}\);(?=\w+\("verificationMs"\);))/;
  assert.equal(worker.match(reopen)?.length, 4, 'locate final serializer output just before its reopen check');
  fs.writeFileSync(workerPath, worker.replace(reopen, '$1($2.writeUInt32LE(9999,12),$2)$3'));
  let app;
  try {
    const launched = await launchApp({ target, out, fixture: file });
    app = launched.app;
    const { page } = launched;
    await page.getByRole('tab', { name: path.basename(file), exact: true }).waitFor();
    await stubDialogs(app, { save: destination });
    await page.keyboard.press('F12');
    const name = page.getByRole('textbox', { name: 'Model name' });
    await name.waitFor();
    const click = async locator => {
      const { x, y, width, height } = await locator.boundingBox();
      await page.mouse.click(x + width / 2, y + height / 2);
    };
    await click(name);
    await page.keyboard.press('Control+a');
    await page.keyboard.type('Changed name');
    await click(page.getByRole('button', { name: 'Save MDX…', exact: true }));
    // On the old code the tab becomes clean as the disk operation completes.
    await waitForInfo(page, 'Saved Existing model.mdx');
    await page.locator('.saving-indicator').waitFor({ state: 'hidden' });
    const backup = path.join(out, 'Existing model_backup.mdx');
    assert.ok(fs.existsSync(backup), 'the overwritten file has a backup');
    assert.equal(sha256(fs.readFileSync(backup)), sha256(previous));
    assert.equal(fs.readFileSync(destination).readUInt32LE(12), 9999, 'the unreadable bytes were written');
    const notice = page.getByRole('dialog').filter({ hasText: /could not be read back/i });
    assert.equal(await notice.count(), 1);
    assert.match(await notice.textContent(), /Existing model_backup\.mdx/);
    assert.equal(await page.locator('.model-tab.active .model-tab-dirty').textContent(), '●');
    const savedBaseline = await page.evaluate(() => Array.from(window.__mdlxl.document().originalBytes.slice(0, 16)));
    assert.deepEqual(savedBaseline, Array.from(bytes.subarray(0, 16)));
    assert.equal(await page.evaluate(() => window.__mdlxl.session().path), file);
    await click(notice.getByRole('button', { name: 'OK', exact: true }));
    await notice.waitFor({ state: 'hidden' });
    const fresh = path.join(out, 'New model.mdx');
    await stubDialogs(app, { save: fresh });
    await page.keyboard.press('F12');
    await page.getByRole('button', { name: 'Save MDX…', exact: true }).waitFor();
    await click(page.getByRole('button', { name: 'Save MDX…', exact: true }));
    await notice.waitFor();
    assert.equal(fs.readFileSync(fresh).readUInt32LE(12), 9999);
    assert.equal(fs.existsSync(path.join(out, 'New model_backup.mdx')), false);
    assert.equal(await page.locator('.model-tab.active .model-tab-dirty').textContent(), '●');
  } finally {
    if (app) await closeApp(app);
    fs.writeFileSync(workerPath, worker);
  }
});
