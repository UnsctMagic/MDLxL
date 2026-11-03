const { launchApp, prepareWindow, closeApp } = require('./helpers/app.cjs');
const { fixturePath } = require('./helpers/fixtures.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const out = path.resolve('out/geoset-leave-visible'), fixture = fixturePath('effect');
  fs.mkdirSync(out, { recursive: true });
  const original = fs.readFileSync(fixture);
  const { app, page: initialPage, errors } = await launchApp({ out, fixture, show: 'hide', settings: { preferences: { rendererRevision: 3, modelLookAnswered: true, viewportAppearance: { geosetSet: { style: 'classic' } }, graphics: { pauseWhenHidden: false } } } });
  const page = initialPage.url().startsWith('file:') ? initialPage : app.windows().find(p => p.url().startsWith('file:')) || await app.waitForEvent('window', { predicate: p => p.url().startsWith('file:') });
  await prepareWindow(app, page, { show: 'hide', errors });
  const state = () => page.evaluate(() => {
    const p = findFiberProps('.viewport,.game-preview-root', p => p?.selectableGeosets && p?.hiddenGeosets);
    return { editable: [...p.selectableGeosets], visible: [...p.visibleGeosets], hidden: [...p.hiddenGeosets], selected: Object.values(p.selectionByGeoset).flat().length };
  });
  const pin = async () => {
    await page.locator('.geoset-row').first().click({ button: 'right' });
    await page.getByRole('menuitemcheckbox', { name: 'Show Always', exact: true }).click();
    await page.mouse.move(300, 50);
  };
  try {
    await page.locator('[data-hotkey="geoset:0"]').waitFor();
    assert.equal(await page.locator('.compact-geoset-list').count(), 0, 'Classic Set keeps the checklist');
    const count = await page.locator('.geoset-row').count();
    await page.locator('[data-hotkey="geosetsClear"]').click();
    await page.getByRole('checkbox', { name: 'Show all geosets', exact: true }).uncheck();
    await pin();
    assert.deepEqual(await state(), { editable: [], visible: [0], hidden: Array.from({length: count - 1}, (_, i) => i + 1), selected: 0 });
    await page.keyboard.press('Control+a');
    assert.equal((await state()).selected, 0, 'an unchecked Show Always geoset stays outside vertex selection');
    await page.keyboard.press('Control+z');
    await page.waitForFunction(() => !document.querySelector('[aria-label="Geoset 1 Show Always"]'));
    assert.deepEqual((await state()).visible, []);
    await page.keyboard.press('Control+y');
    await page.getByLabel('Geoset 1 Show Always', { exact: true }).waitFor();
    assert.deepEqual((await state()).visible, [0]);
    await page.locator('[data-hotkey="animation"]').click();
    await page.locator('.game-preview-root canvas').first().waitFor();
    assert.deepEqual((await state()).visible, [0]);
    assert.deepEqual((await state()).editable, []);
    await pin(); assert.deepEqual((await state()).visible, []);
    await pin(); assert.deepEqual((await state()).visible, [0]);
    await page.keyboard.press('Control+n');
    await page.getByRole('tab', { name: 'Untitled.mdx', exact: true }).waitFor();
    await page.waitForFunction(() => !__mdlxl.session()?.path && __mdlxl.model()?.Geosets.length === 0);
    assert.equal(await page.getByLabel('Geoset 1 Show Always', { exact: true }).count(), 0);
    await page.getByRole('tab', { name: path.basename(fixture), exact: true }).click();
    await page.waitForFunction(file => __mdlxl.session()?.path === file, fixture);
    await page.locator('.game-preview-root canvas').first().waitFor();
    assert.deepEqual((await state()).visible, [0]);
    await page.locator('[data-hotkey="geoset:0"]').check();
    assert.deepEqual((await state()).editable, [0]);
    assert.equal(await page.getByLabel('Geoset 1 Show Always', { exact: true }).count(), 1, 'selection keeps Show Always');
    await pin();
    assert.deepEqual((await state()).editable, [0], 'toggling Show Always does not change selection');
    assert.equal(await page.getByLabel('Geoset 1 Show Always', { exact: true }).count(), 0);
    assert.ok(fs.readFileSync(fixture).equals(original));
    assert.equal(await page.evaluate(() => __mdlxl.document().dirty), false);
    assert.deepEqual(errors, []);
    console.log('PASS Classic Set Show Always: vertex selection isolation, undo/redo, Movement, model-tab restoration, selection-independent toggle, model unchanged.');
  } finally { await closeApp(app); }
})().catch(error => { console.error(error); process.exitCode = 1; });
