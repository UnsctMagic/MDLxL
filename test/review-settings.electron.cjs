const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { launchApp, closeApp } = require('./helpers/app.cjs');
const { fixturePath } = require('./helpers/fixtures.cjs');

const out = path.resolve('out/review-settings');
const fixture = fixturePath('footman');
const failures = [];
const dragKey = 'drag.move.axisLock';
const pressed = (page, action) => page.locator('.classic-sidebar [data-hotkey="' + action + '"]').getAttribute('aria-pressed');
const click = async (page, locator) => {
  await locator.waitFor();
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
};

async function check(name, preferences, body, env) {
  const errors = [];
  let app;
  try {
    const launched = await launchApp({ fixture, out, errors, settings: preferences && { preferences }, env });
    app = launched.app;
    await body(launched.page);
    assert.deepEqual(errors, []);
    console.log('PASS ' + name);
  } catch (error) {
    failures.push(name);
    console.error('FAIL ' + name + ': ' + error.message);
  } finally {
    if (app) await closeApp(app);
  }
}

(async () => {
  await check('Hotkeys Default waits for confirmation and Cancel and Escape preserve the current keys', {
    hotkeys: { translate: ['Ctrl+F2'] }
  }, async page => {
    const dialog = page.getByRole('dialog', { name: 'Settings', exact: true });
    const hotkeys = dialog.getByRole('tab', { name: 'Hotkeys', exact: true });
    const preset = dialog.getByLabel('Hotkeys preset', { exact: true });
    const confirm = dialog.getByRole('button', { name: 'Restore all defaults', exact: true });
    const ask = async () => {
      await click(page, hotkeys);
      for (let step = 0; step < 8 && !await preset.evaluate(el => document.activeElement === el); step++) await page.keyboard.press('Tab');
      assert.ok(await preset.evaluate(el => document.activeElement === el), 'real Tab navigation reaches the closed preset dropdown');
      assert.equal(await preset.inputValue(), 'custom');
      await page.keyboard.press('ArrowDown');
      assert.ok(await confirm.isVisible(), 'choosing the built-in shows the Restore confirmation');
      assert.equal(await preset.inputValue(), 'custom', 'the dropdown still shows the current preset');
    };
    await page.getByLabel('3D model viewport', { exact: true }).waitFor();
    await page.keyboard.press('Control+k');
    await preset.waitFor();
    await ask();
    await click(page, dialog.getByRole('button', { name: 'Cancel', exact: true }));
    assert.equal(await preset.inputValue(), 'custom');
    await ask();
    await page.keyboard.press('Escape');
    assert.equal(await confirm.isVisible(), false);
    assert.equal(await preset.inputValue(), 'custom');
    await ask();
    await click(page, confirm);
    assert.equal(await preset.inputValue(), 'default');
  });

  const configFile = path.join(out, 'legacy-configuration.json');
  await fs.writeFile(configFile, JSON.stringify({
    schema: 'mdlxl-configuration', version: 1, preferences: { rendererRevision: 3, capture: { fps: 24 } }
  }));
  try {
    await check('configuration import tells the user that missing settings and saved presets stay', {
      toolbarMode: 'trim', capture: { fps: 50, screenshotQuality: 'high' },
      settingsPresets: { hotkeys: [{ id: 'custom-keys', name: 'My keys', values: { hotkeys: { translate: ['Ctrl+F2'] } } }] }
    }, async page => {
      await page.getByLabel('3D model viewport', { exact: true }).waitFor();
      await page.keyboard.press('Control+k');
      const dialog = page.getByRole('dialog', { name: 'Settings', exact: true });
      await click(page, dialog.getByRole('tab', { name: 'Configuration', exact: true }));
      const chooser = page.waitForEvent('filechooser');
      await click(page, dialog.getByRole('button', { name: 'Import configuration', exact: false }));
      await (await chooser).setFiles(configFile);
      await page.waitForFunction(async () => (await window.desktop.getSettings()).preferences.capture.fps === 24);
      const status = dialog.locator('.settings-message');
      assert.equal(await status.innerText(), 'Configuration imported. Kept saved Hotkeys and Mouse presets and settings missing from the file.');
      const prefs = await page.evaluate(async () => (await window.desktop.getSettings()).preferences);
      assert.equal(prefs.capture.screenshotQuality, 'high');
      assert.equal(prefs.toolbarMode, 'trim');
      assert.equal(prefs.settingsPresets.hotkeys[0].name, 'My keys');
    });
  } finally { await fs.rm(configFile, { force: true }); }

  await check('Move lock badge follows Alt in the main viewport', { modifiers: { [dragKey]: 'Alt' } }, async page => {
    const viewport = page.getByLabel('3D model viewport', { exact: true });
    await click(page, page.locator('[data-hotkey="geosetsClear"]'));
    const geoset = page.getByLabel('Select geoset 0', { exact: true });
    if (!await geoset.isChecked()) await click(page, geoset);
    await click(page, viewport);
    await page.keyboard.press('Control+a');
    await page.keyboard.press('KeyM');
    const constraints = page.getByLabel('Workplane Constraints', { exact: true });
    if (!await constraints.isChecked()) await click(page, constraints);
    const plane = page.getByLabel('XY workplane', { exact: true });
    if (!await plane.isChecked()) await click(page, plane);
    const box = await viewport.boundingBox(), x = box.x + box.width * .47, y = box.y + box.height * .45;
    const badge = page.locator('.shift-lock-badge:visible');
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 20, y + 8, { steps: 4 });
    assert.equal(await badge.count(), 0);
    await page.keyboard.down('Alt');
    try {
      await page.mouse.move(x + 54, y + 9, { steps: 4 });
      await page.waitForFunction(() => {
        const runtime = findFiberState('[aria-label="3D model viewport"]', value => value?.renderer && value?.entries);
        return runtime?.drag?.lastMove?.shiftKey === true;
      }, undefined, { timeout: 2500 });
      await badge.waitFor({ timeout: 2500 }).catch(() => assert.fail('holding rebound Alt displays the Move lock badge'));
      assert.equal(await badge.innerText(), 'X');
    } finally {
      await page.keyboard.up('Alt');
      await page.keyboard.press('Escape');
      await page.mouse.up();
    }
    assert.equal(await badge.count(), 0);
  });

  await check('tapped Alt falls through to plain Rotate and still runs Alt+M', { hotkeys: { recovery: [] } }, async page => {
    await click(page, page.getByLabel('3D model viewport', { exact: true }));
    assert.equal(await pressed(page, 'rotate'), 'false');
    await page.keyboard.press('Alt');
    await page.keyboard.press('KeyR');
    assert.equal(await pressed(page, 'rotate'), 'true', 'plain R still selects Rotate after tapped Alt');
    await page.keyboard.press('Alt');
    await page.keyboard.press('KeyM');
    await page.getByRole('dialog', { name: 'Material Manager', exact: true }).waitFor({ timeout: 2500 });
    await page.keyboard.press('Escape');
    await page.keyboard.press('Alt');
    await page.keyboard.press('Escape');
    assert.equal(await pressed(page, 'rotate'), 'true', 'Escape only dismisses the armed hints');
  });

  await check('saved keys win over the launcher, toolbar and FX defaults', {
    hotkeys: { translate: ['Ctrl+F2'], scale: ['Shift+F3'], rotate: ['Alt+K'] }
  }, async page => {
    await click(page, page.getByLabel('3D model viewport', { exact: true }));
    const result = [];
    for (const [key, action] of [['Control+F2', 'translate'], ['Shift+F3', 'scale'], ['Alt+k', 'rotate']]) {
      await page.keyboard.press(key);
      result.push(await pressed(page, action));
    }
    assert.deepEqual(result, ['true', 'true', 'true'], 'each custom shortcut runs its original command');
  });

  async function checkUv(page, expected) {
    await page.getByLabel('3D model viewport', { exact: true }).waitFor();
    await page.keyboard.press('Control+k');
    const dialog = page.getByRole('dialog', { name: 'Settings', exact: true });
    await click(page, dialog.getByRole('tab', { name: 'Mouse', exact: true }));
    await click(page, dialog.getByRole('navigation', { name: 'Mouse pages' }).getByRole('button', { name: 'UV', exact: true }));
    const preset = dialog.getByLabel('UV Rotate and Zoom preset', { exact: true });
    const zoom = dialog.getByLabel('UV Zoom drag', { exact: true });
    const changeTo = async id => {
      // Move focus from the UV tab to the preset with the user's Tab key.
      await click(page, dialog.getByRole('navigation', { name: 'Mouse pages' }).getByRole('button', { name: 'UV', exact: true }));
      for (let step = 0; step < 8 && !await preset.evaluate(el => document.activeElement === el); step++) await page.keyboard.press('Tab');
      assert.ok(await preset.evaluate(el => document.activeElement === el));
      await page.keyboard.press('ArrowDown');
      assert.equal(await preset.inputValue(), id);
    };
    const observed = [await preset.inputValue(), await zoom.inputValue()];
    // Old code reads a seeded profile as Custom, which precedes MDLxL in the dropdown.
    if (observed[0] === 'custom') await changeTo('mdlxl');
    await changeTo('mdlvis');
    await click(page, dialog.getByRole('button', { name: 'Restore', exact: true }));
    observed.push(await preset.inputValue(), await zoom.inputValue());
    await changeTo('mdlvis');
    await click(page, dialog.getByRole('button', { name: 'Restore mouse defaults', exact: true }));
    observed.push(await preset.inputValue(), await zoom.inputValue());
    assert.deepEqual(observed, ['mdlxl', expected, 'mdlxl', expected, 'mdlxl', expected], 'initial UV preset and both Restore buttons agree');
  }

  const freshProfile = path.join(out, 'fresh-profile-' + process.pid);
  try {
    await check('fresh packaged profile starts and restores to right/up Zoom', null, page => checkUv(page, 'rightUp'), { MDLXL_PROFILE: freshProfile });
    await check('existing profile starts and restores to centre Zoom', {}, page => checkUv(page, 'centre'));
  } finally {
    await fs.rm(freshProfile, { recursive: true, force: true, maxRetries: 6, retryDelay: 200 });
  }
  assert.deepEqual(failures, []);
})().catch(error => { console.error(error); process.exitCode = 1; });
