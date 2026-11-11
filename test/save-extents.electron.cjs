const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { launchApp, closeApp, stubDialogs } = require('./helpers/app.cjs');

const fixture = 'test/fixtures/geoset-save/Tzeentch_Knight_Max_Reduced.mdx';
const testRoot = path.resolve('out/save-extents');

async function click(page, locator) {
  await locator.waitFor();
  const { x, y, width, height } = await locator.boundingBox();
  await page.mouse.click(x + width / 2, y + height / 2);
}

async function withModel(name, change, run) {
  fs.mkdirSync(testRoot, { recursive: true });
  const out = fs.mkdtempSync(path.join(testRoot, name + '-'));
  const file = path.join(out, name + '.mdx');
  const bytes = fs.readFileSync(fixture);
  change?.(bytes);
  fs.writeFileSync(file, bytes);
  const { app, page } = await launchApp({ out, fixture: file, pageTimeout: 15000 });
  try {
    await page.getByRole('tab', { name: name + '.mdx', exact: true }).waitFor();
    await run(app, page, bytes, out);
  } finally { await closeApp(app); }
}

async function saveAs(page) {
  await page.keyboard.press('F12');
  const button = page.getByRole('button', { name: 'Save MDX…', exact: true });
  await button.waitFor();
  const extents = page.getByRole('checkbox', { name: 'Calculate extents' });
  if (!(await extents.isChecked())) await click(page, extents);
  await click(page, button);
  return button;
}

test('Save As writes with Calculate extents whether the boxes change or already match', async () => {
  await withModel('extents-original', null, async (app, page, _bytes, out) => {
    for (const suffix of ['first', 'second']) {
      const destination = path.join(out, 'extents-' + suffix + '.mdx');
      await stubDialogs(app, { save: destination });
      const button = await saveAs(page);
      await button.waitFor({ state: 'hidden' });
      assert.ok(fs.existsSync(destination), 'Save As wrote the requested file');
    }
  });
});

test('cancelling Save As keeps extents, undo history and the clean tab', async () => {
  await withModel('extents-cancel', null, async (app, page, _bytes, out) => {
    const state = () => page.evaluate(() => {
      const doc = window.__mdlxl.document();
      return { boxes: [...doc.model.Info.MaximumExtent], undo: doc.historyStats.undoSteps, dirty: doc.dirty };
    });
    const before = await state();
    await app.evaluate(({ dialog }) => {
      globalThis.cancelledExtentsSave = false;
      dialog.showSaveDialog = async () => {
        globalThis.cancelledExtentsSave = true;
        return { canceled: true };
      };
    });
    await saveAs(page);
    const deadline = Date.now() + 10000;
    while (!await app.evaluate(() => globalThis.cancelledExtentsSave) && Date.now() < deadline) {
      await page.locator('.saving-indicator').waitFor({ state: 'hidden' });
    }
    assert.equal(await app.evaluate(() => globalThis.cancelledExtentsSave), true, 'the native dialog was reached');
    await page.locator('.saving-indicator').waitFor({ state: 'hidden' });
    assert.deepEqual(await state(), before);
    assert.equal(await page.locator('.model-tab.active .model-tab-dirty').textContent(), '');
  });
});

test('non-finite geometry leaves extents alone and still writes the model', async () => {
  await withModel('extents-nonfinite', bytes => {
    const offset = bytes.indexOf('VRTX');
    assert.ok(offset > 0);
    bytes.writeFloatLE(NaN, offset + 8);
  }, async (app, page, bytes, out) => {
    const destination = path.join(out, 'extents-nonfinite-saved.mdx');
    await stubDialogs(app, { save: destination });
    await saveAs(page);
    await page.getByText(/extents were left as they were/i).waitFor({ timeout: 6000 });
    await page.getByRole('tab', { name: path.basename(destination), exact: true }).waitFor();
    assert.deepEqual(fs.readFileSync(destination), bytes);
  });
});
