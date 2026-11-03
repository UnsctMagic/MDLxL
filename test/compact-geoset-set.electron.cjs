const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { launchApp, prepareWindow, closeApp } = require('./helpers/app.cjs');
const { fixturePath } = require('./helpers/fixtures.cjs');

(async () => {
  const out = path.resolve('out/compact-geoset-set');
  fs.mkdirSync(out, { recursive: true });
  const fixture = fixturePath('effect'), before = fs.readFileSync(fixture);
  const { app, page: initialPage, errors } = await launchApp({ out, fixture, show: 'hide', settings: { preferences: { rendererRevision: 3, modelLookAnswered: true, graphics: { pauseWhenHidden: false } } } });
  // Packaged Electron can expose a temporary about:blank target before its editor window.
  const page = initialPage.url().startsWith('file:') ? initialPage : app.windows().find(p => p.url().startsWith('file:')) || await app.waitForEvent('window', { predicate: p => p.url().startsWith('file:') });
  await prepareWindow(app, page, { show: 'hide', errors });
  const state = () => page.evaluate(() => {
    const p = findFiberProps('.viewport,.game-preview-root', p => p?.hiddenGeosets instanceof Set && p?.selectableGeosets instanceof Set);
    if (!p) throw Error('Editor visibility props unavailable');
    return { hidden: [...p.hiddenGeosets], selected: [...p.selectableGeosets], visible: [...p.visibleGeosets] };
  });
  const row = i => page.locator('.geoset-row').filter({ has: page.locator(`[data-hotkey="geoset:${i}"]`) });
  const menu = async (i, label) => {
    await row(i).click({ button: 'right' });
    await page.getByRole('menuitemcheckbox', { name: label, exact: true }).click();
    await page.getByRole('menu').waitFor({ state: 'hidden' });
  };
  try {
    await page.locator('[data-hotkey="geoset:0"]').waitFor();
    assert.equal(await page.locator('.compact-geoset-list').count(), 1, 'Compact Set is the default for an existing profile');
    const initialCount = await page.locator('.geoset-row').count();
    await page.waitForFunction(() => findFiberState('.viewport', value => value?.renderer && value?.entries)?.entries[0]?.group.visible);
    const boxStyle = await page.locator('.geoset-row').first().evaluate(el => {
      const css = getComputedStyle(el), input = getComputedStyle(el.querySelector('input'));
      return { shadow: css.boxShadow, border: css.borderColor, checkboxOpacity: input.opacity };
    });
    assert.notEqual(boxStyle.shadow, 'none', 'selected compact box has a neon glow');
    assert.equal(boxStyle.border, 'rgb(113, 181, 243)', 'Lordaeron selected box uses light blue');
    assert.equal(boxStyle.checkboxOpacity, '0', 'Compact Set shows the number without a checklist mark');
    const check = page.locator('[data-hotkey="geoset:0"]');
    const selectedBefore = await check.isChecked();
    await check.click();
    assert.equal(await check.isChecked(), !selectedBefore, 'number toggles selection');
    await check.click();
    const camera = () => page.evaluate(() => {
      const runtime = findFiberState('.viewport', value => value?.renderer && value?.entries);
      return runtime.camera.position.toArray();
    });
    const originalCamera = await camera();
    const canvas = await page.locator('.viewport canvas').first().boundingBox();
    await page.mouse.move(canvas.x + canvas.width * .55, canvas.y + canvas.height * .45);
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(canvas.x + canvas.width * .55 + 75, canvas.y + canvas.height * .45 + 35, { steps: 10 });
    await page.mouse.up({ button: 'right' });
    await page.waitForFunction(before => JSON.stringify(findFiberState('.viewport', value => value?.renderer && value?.entries).camera.position.toArray()) !== JSON.stringify(before), originalCamera);
    const rotatedCamera = await camera();
    await page.getByRole('checkbox', { name: 'Highlight Geoset', exact: true }).check();
    await row(0).click({ button: 'right' });
    assert.equal(await page.getByRole('menuitem', { name: 'Select all geosets', exact: true }).count(), 0);
    assert.equal(await page.getByRole('menuitem', { name: 'Invert geosets', exact: true }).count(), 0);
    await page.getByRole('menuitemcheckbox', { name: 'Hide Geoset', exact: true }).click();
    await page.waitForFunction(() => findFiberProps('.viewport', p => p?.hiddenGeosets instanceof Set)?.hiddenGeosets.has(0));
    assert.equal(await page.locator('.geoset-row').count(), initialCount, 'hidden geoset remains in the list');
    assert.ok((await state()).hidden.includes(0), 'Hide overrides Show all');
    await row(0).hover();
    await page.waitForFunction(() => !findFiberState('.viewport', value => value?.renderer && value?.entries)?.entries[0]?.group.visible);
    await menu(0, 'Show Always');
    await page.getByRole('checkbox', { name: 'Show all geosets', exact: true }).uncheck();
    assert.equal((await state()).hidden.includes(0), false, 'Show Always overrides deselected geoset and Show all off');
    assert.equal(await check.isChecked(), false);
    await check.click(); await check.click();
    assert.equal((await state()).hidden.includes(0), false, 'Show Always survives selection toggles');
    await menu(0, 'Show Always');
    assert.equal((await state()).hidden.includes(0), true, 'turning Show Always off restores ordinary visibility');
    await menu(0, 'Hide Geoset');
    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+y');
    assert.ok((await state()).hidden.includes(0), 'hidden state survives redo');
    await page.keyboard.press('Control+6');
    await page.getByRole('navigation', { name: 'Appearance pages' }).getByRole('button', { name: 'Interface', exact: true }).click();
    const style = page.getByRole('combobox', { name: 'Geoset set', exact: true });
    assert.equal(await style.inputValue(), 'compact');
    assert.equal(await page.getByLabel('Compact Set color', { exact: true }).inputValue(), '#71b5f3');
    await style.selectOption({ label: 'Classic Set' });
    assert.equal(await page.locator('.compact-geoset-list').count(), 0);
    await style.selectOption({ label: 'Compact Set' });
    await page.getByLabel('Compact Set color', { exact: true }).fill('#c080ff');
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    assert.equal(await page.locator('.compact-geoset-list').evaluate(el => getComputedStyle(el).getPropertyValue('--geoset-set-color').trim()), '#c080ff');
    assert.ok((await camera()).every((value, i) => Math.abs(value - rotatedCamera[i]) < 1e-8), 'visibility and appearance preserve the rotated viewpoint (floating-point tolerance)');
    await page.keyboard.press('Control+6');
    await page.getByRole('navigation', { name: 'Appearance pages' }).getByRole('button', { name: 'Presets', exact: true }).click();
    for (const [id, color] of [['blender-style', '#ff8a00'], ['mdlvis-vanilla', '#71b5f3']]) {
      await page.getByRole('combobox', { name: 'Viewport appearance preset', exact: true }).selectOption(id);
      await page.getByRole('navigation', { name: 'Appearance pages' }).getByRole('button', { name: 'Interface', exact: true }).click();
      assert.equal(await page.getByLabel('Compact Set color', { exact: true }).inputValue(), color);
      await page.getByRole('navigation', { name: 'Appearance pages' }).getByRole('button', { name: 'Presets', exact: true }).click();
    }
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await menu(0, 'Show Always');
    await page.locator('[data-hotkey="animation"]').click();
    await page.locator('.game-preview-root canvas').first().waitFor();
    assert.equal((await state()).hidden.includes(0), false, 'Show Always works in Movement');
    await menu(0, 'Hide Geoset');
    assert.equal((await state()).hidden.includes(0), true, 'Hide works in Movement');
    await page.keyboard.press('Control+n');
    await page.getByRole('tab', { name: 'Untitled.mdx', exact: true }).waitFor();
    await page.waitForFunction(() => !__mdlxl.session()?.path && __mdlxl.model()?.Geosets.length === 0);
    await page.getByRole('tab', { name: path.basename(fixture), exact: true }).click();
    await page.waitForFunction(file => __mdlxl.session()?.path === file, fixture);
    await page.locator('.game-preview-root canvas').first().waitFor();
    assert.equal((await state()).hidden.includes(0), true, 'hidden override belongs to its model tab');
    assert.ok(fs.readFileSync(fixture).equals(before), 'model bytes unchanged');
    assert.equal(await page.evaluate(() => __mdlxl.document().dirty), false, 'view-only changes do not dirty the model');
    assert.deepEqual(errors, []);
    console.log('PASS compact default, numeric toggles, mouse rotation, Classic Set, color changes/presets, Hide/Show Always in Vertices and Movement, undo/redo, viewpoint/model preservation.');
  } catch (error) {
    console.error('Renderer errors:', errors);
    throw error;
  } finally { await closeApp(app); }
})().catch(error => { console.error(error); process.exitCode = 1; });
