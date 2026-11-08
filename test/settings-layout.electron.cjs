const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { launchApp, closeApp, stubDialogs, root } = require('./helpers/app.cjs');

// The Settings window: fixed layout, preset bar, previews, Rotate rows, drag keys, toolbar, restart.
// Real clicks and keys only, focus left where they leave it; probes only read state.
const TABS = ['Configuration', 'Mouse', 'Hotkeys', 'Graphics', 'Capture', 'Appearance', 'Grid', 'Warcraft III'];
const WITH_PREVIEW = new Set(['Mouse', 'Graphics', 'Capture', 'Appearance', 'Grid']);
const MOUSE_PAGES = ['Camera', 'Rotation', 'Wheel', 'Pointer', 'UV'];
const APPEARANCE_PAGES = ['Presets', 'Interface', 'Viewport', 'Wires', 'Vertices', 'Bones & skeleton', 'Bone influence', 'Controllers', 'Lists & folders', 'Quadview', 'Editor helpers', 'Citadel Paint'];
const UV_PRESET = 'UV Rotate and Zoom preset', LOOK_PRESET = 'Viewport appearance preset';

(async () => {
  const out = path.resolve(process.env.MDLXL_SETTINGS_LAYOUT_OUT || 'out/settings-layout');
  fs.mkdirSync(out, { recursive: true });
  const fixture = path.join(root, 'test/fixtures/demo.mdx'), profile = path.join(out, 'profile-' + process.pid);
  const bounds = { x: 0, y: 0, width: 1440, height: 1000 }, errors = [], checks = [];
  const check = (label, actual, expected = true) => { assert.deepEqual(actual, expected, label); checks.push(label); console.log('PASS ' + label); };

  const openSettings = async page => {
    await page.keyboard.press('Control+,');
    const dialog = page.getByRole('dialog', { name: 'Settings', exact: true });
    await dialog.waitFor();
    return dialog;
  };
  const tab = async (dialog, name) => { await dialog.getByRole('tab', { name, exact: true }).click(); };
  const subPage = async (dialog, nav, name) => { await dialog.getByRole('navigation', { name: nav }).getByRole('button', { name, exact: true }).click(); };
  const mousePage = async (dialog, name) => { await tab(dialog, 'Mouse'); await subPage(dialog, 'Mouse pages', name); };
  const appearancePage = async (dialog, name) => { await tab(dialog, 'Appearance'); await subPage(dialog, 'Appearance pages', name); };
  const chosen = select => select.evaluate(element => element.selectedOptions[0].textContent);
  const optionTexts = select => select.evaluate(element => [...element.options].map(option => option.textContent));
  const preferences = page => page.evaluate(async () => (await window.desktop.getSettings()).preferences);
  const savedWhen = async (page, test, label) => {
    let current;
    for (let tries = 0; tries < 100; tries++) { current = await preferences(page); if (test(current)) { checks.push(label); console.log('PASS ' + label); return current; } await page.waitForTimeout(100); }
    assert.fail(`${label}: not saved`);
  };
  const message = page => page.locator('.settings-window > footer .settings-message');
  const messageSays = async (page, text) => { await page.waitForFunction(text => document.querySelector('.settings-window > footer .settings-message')?.textContent.includes(text), text); check(`status line: ${text}`, true); };
  const typeNumber = async (page, field, value) => { await field.click({ clickCount: 3 }); await page.keyboard.type(String(value)); await page.keyboard.press('Enter'); };
  const sceneIs = async (page, label) => { await page.waitForFunction(label => document.querySelector('svg.settings-preview-scene')?.getAttribute('aria-label') === label, label); check(`preview shows ${label}`, true); };
  const layout = page => page.evaluate(() => {
    const body = document.querySelector('.settings-body'), box = document.querySelector('.settings-window').getBoundingClientRect();
    return { height: Math.round(box.height), width: Math.round(box.width), sideways: body.scrollWidth - body.clientWidth, column: !!document.querySelector('.settings-preview svg.settings-preview-scene') };
  });

  const launched = await launchApp({ fixture, out, errors, profile, bounds, settings: { preferences: { graphics: { pauseWhenHidden: false } } } });
  const { app, page } = launched;
  try {
    await page.getByLabel('Select geoset 0', { exact: true }).waitFor();
    let dialog = await openSettings(page);

    // ---- Every tab and sub-page, same window size, nothing sideways.
    const sizes = new Set();
    for (const name of TABS) {
      await tab(dialog, name);
      check(`${name} is the selected tab`, await dialog.getByRole('tab', { name, exact: true }).getAttribute('aria-selected'), 'true');
      const now = await layout(page);
      sizes.add(`${now.width}x${now.height}`);
      check(`${name}: nothing runs off sideways`, now.sideways <= 0, true);
      check(`${name}: preview column ${WITH_PREVIEW.has(name) ? 'present' : 'absent'}`, now.column, WITH_PREVIEW.has(name));
    }
    check('the window keeps one size across tabs', sizes.size, 1);
    for (const [name, pages, nav] of [['Mouse', MOUSE_PAGES, 'Mouse pages'], ['Appearance', APPEARANCE_PAGES, 'Appearance pages']]) {
      await tab(dialog, name);
      for (const pageName of pages) {
        await subPage(dialog, nav, pageName);
        check(`${pageName} page is pressed`, await dialog.getByRole('navigation', { name: nav }).getByRole('button', { name: pageName, exact: true }).getAttribute('aria-pressed'), 'true');
        const now = await layout(page);
        sizes.add(`${now.width}x${now.height}`);
        check(`${pageName}: nothing runs off sideways`, now.sideways <= 0, true);
        check(`${pageName}: preview column present`, now.column);
      }
    }
    check('the window keeps one size across sub-pages', sizes.size, 1);
    check('the status line is in the footer', await message(page).count(), 1);
    // The bar and the preview stay in view while a long page scrolls.
    await appearancePage(dialog, 'Lists & folders');
    const form = await dialog.locator('.settings-form').boundingBox();
    await page.mouse.move(form.x + form.width / 2, form.y + 200);
    await page.mouse.wheel(0, 500);
    await page.waitForFunction(() => document.querySelector('.settings-body').scrollTop > 100);
    const pinned = await page.evaluate(() => { const top = selector => document.querySelector(selector).getBoundingClientRect().top; return { body: top('.settings-body'), bar: top('.settings-preset-bar'), preview: top('.settings-preview') }; });
    check('the preset bar stays at the top of the page', Math.abs(pinned.bar - pinned.body) <= 1);
    check('the preview stays below the bar', pinned.preview > pinned.bar && pinned.preview - pinned.body < 100);

    // ---- Preset bar on Mouse > UV: Save as, name, Save, Save to file, Load from, Restore, Delete.
    await mousePage(dialog, 'UV');
    const uvPreset = dialog.getByLabel(UV_PRESET, { exact: true }), speed = dialog.getByLabel('Turn speed', { exact: true });
    check('UV preset starts on MDLxL', await chosen(uvPreset), 'MDLxL');
    check('built-in UV presets', (await optionTexts(uvPreset)).slice(0, 4), ['MDLxL', 'MDLVis', 'Freeform', 'Manipulator']);
    await typeNumber(page, speed, 90);
    await page.waitForFunction(label => document.querySelector(`[aria-label="${label}"]`).selectedOptions[0].textContent === 'Custom', UV_PRESET);
    check('an edit reads Custom', await chosen(uvPreset), 'Custom');
    await dialog.getByRole('button', { name: 'Save as…', exact: true }).click();
    const nameBox = dialog.getByLabel('Preset name', { exact: true });
    await nameBox.waitFor();
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Preset name');
    check('Save as focuses the name box', true);
    await page.keyboard.press('Escape');
    await nameBox.waitFor({ state: 'detached' });
    check('Esc closes only the name row', await dialog.isVisible());
    await dialog.getByRole('button', { name: 'Save as…', exact: true }).click();
    await nameBox.waitFor();
    await page.keyboard.type('Layout UV');
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await messageSays(page, 'Layout UV saved.');
    check('the saved preset is the one shown', await chosen(uvPreset), 'Layout UV');
    await savedWhen(page, value => value.settingsPresets.uv.some(item => item.name === 'Layout UV' && item.values.rotateSpeed === 90), 'the UV preset is stored');
    const shared = path.join(out, `shared-${process.pid}.mdlxl-preset`);
    await stubDialogs(app, { save: shared });
    await dialog.getByRole('button', { name: 'Save as…', exact: true }).click();
    await nameBox.waitFor();
    await page.keyboard.type('Shared UV');
    await dialog.getByRole('button', { name: 'Save to file…', exact: true }).click();
    await messageSays(page, 'Shared UV saved to file.');
    const written = JSON.parse(fs.readFileSync(shared, 'utf8'));
    check('the file is a UV preset', [written.schema, written.domain, written.name, written.values.rotateSpeed], ['mdlxl-preset', 'uv', 'Shared UV', 90]);
    const seeded = path.join(out, `seeded-${process.pid}.mdlxl-preset`), wrong = path.join(out, `wrong-${process.pid}.mdlxl-preset`);
    const file = (domain, name, values) => JSON.stringify({ schema: 'mdlxl-preset', version: 1, domain, name, app: 'test', values });
    fs.writeFileSync(seeded, file('uv', 'Seeded UV', { rotateStyle: 'leftRight', rotateSpeed: 33, rotateZone: 0, rotateBigPieces: false, rotateReverse: false, rotateSnap: 0, zoomStyle: 'centre', zoomSpeed: 100, zoomSnap: 0, uvSensitivity: 1 }));
    fs.writeFileSync(wrong, file('rotate', 'Other page', { sensitivity: 2 }));
    await stubDialogs(app, { open: wrong });
    await dialog.getByRole('button', { name: 'Load from…', exact: true }).click();
    await messageSays(page, 'This preset is for Rotate. Open that page to load it.');
    check('a preset for another page changes nothing', await speed.inputValue(), '90');
    await stubDialogs(app, { open: seeded });
    await dialog.getByRole('button', { name: 'Load from…', exact: true }).click();
    await messageSays(page, 'Seeded UV loaded.');
    await page.waitForFunction(() => document.querySelector('[aria-label="Turn speed"]').value === '33');
    check('Load from applies the file', await chosen(uvPreset), 'Seeded UV');
    check('Load from fills How you drag', await chosen(dialog.getByLabel('UV Rotate drag', { exact: true })), 'Left and right');
    check('Left and right hides the deadzone', await dialog.getByLabel('Deadzone near centre', { exact: true }).count(), 0);
    await dialog.locator('[data-hotkey="mouse:uv-reset"]').click();
    await page.waitForFunction(() => document.querySelector('[aria-label="Turn speed"]').value === '70');
    check('Restore goes back to MDLxL', await chosen(uvPreset), 'MDLxL');
    check('Restore carries the old key id', await dialog.getByRole('button', { name: 'Restore', exact: true }).getAttribute('data-hotkey'), 'mouse:uv-reset');
    await uvPreset.selectOption({ label: 'Seeded UV' });
    await page.waitForFunction(() => document.querySelector('[aria-label="Turn speed"]').value === '33');
    await dialog.getByRole('button', { name: 'Delete this preset', exact: true }).click();
    await messageSays(page, 'Seeded UV deleted. Current settings were kept.');
    check('Delete removes it from the list', (await optionTexts(uvPreset)).includes('Seeded UV'), false);
    check('Delete keeps the current settings', await speed.inputValue(), '33');
    await dialog.locator('[data-hotkey="mouse:uv-reset"]').click();
    await page.waitForFunction(() => document.querySelector('[aria-label="Turn speed"]').value === '70');
    const zoomStyle = dialog.getByLabel('UV Zoom drag', { exact: true });
    await zoomStyle.selectOption({ label: 'Up grows, down shrinks' });
    await savedWhen(page, value => value.uvDrag?.zoomStyle === 'upDown', 'Zoom can be set to up and down');
    await zoomStyle.selectOption({ label: 'Away from or toward the centre' });
    await savedWhen(page, value => (value.uvDrag?.zoomStyle ?? 'centre') === 'centre', 'Zoom goes back to the centre style');

    // ---- Hovering a control changes the preview.
    await dialog.getByLabel('UV Rotate drag', { exact: true }).hover();
    await sceneIs(page, 'UV Rotate preview');
    await zoomStyle.hover();
    await sceneIs(page, 'UV Zoom preview');
    await dialog.getByLabel('UV transform sensitivity', { exact: true }).hover();
    await sceneIs(page, 'Pointer speed preview');
    await dialog.getByLabel('UV Rotate drag', { exact: true }).hover();
    await sceneIs(page, 'UV Rotate preview');

    // ---- Mouse > Rotation: rows that cannot apply hide; Apply to works per editor.
    await mousePage(dialog, 'Rotation');
    const leverPick = dialog.getByLabel('Axis pick distance', { exact: true }), linePick = dialog.getByLabel('Lines handles', { exact: true });
    await leverPick.waitFor();
    await linePick.selectOption({ label: 'Turn the grabbed axis' });
    await leverPick.waitFor({ state: 'detached' });
    check('Turn the grabbed axis hides Axis pick distance', await leverPick.count(), 0);
    await linePick.selectOption({ label: 'Swing to pick the axis' });
    await leverPick.waitFor();
    check('Swing to pick the axis brings it back', await leverPick.isVisible());
    const shift = dialog.getByLabel('Shift while rotating', { exact: true }), precision = dialog.getByLabel('Shift rotation precision', { exact: true });
    await shift.selectOption({ label: 'Snap to 15°' });
    await precision.waitFor({ state: 'detached' });
    check('Snapping hides the precision multiplier', await precision.count(), 0);
    await shift.selectOption({ label: 'Slow down' });
    await precision.waitFor();
    const workplane = dialog.getByLabel('Workplane on: how you drag', { exact: true });
    await workplane.selectOption({ label: 'Circle around the centre' });
    await dialog.getByLabel('Facing views', { exact: true }).waitFor({ state: 'detached' });
    check('Circling hides Facing views', await dialog.getByLabel('Facing views', { exact: true }).count(), 0);
    await workplane.selectOption({ label: 'Follow the arrow' });
    await dialog.getByLabel('Facing views', { exact: true }).waitFor();
    const handleSpeed = dialog.getByLabel('Handle speed', { exact: true }), sameSpeed = dialog.getByLabel('Use Rotation sensitivity', { exact: true });
    check('Handle speed starts following Rotation sensitivity', await sameSpeed.isChecked());
    check('and its box is off', await handleSpeed.isDisabled());
    await sameSpeed.click();
    await typeNumber(page, handleSpeed, .5);
    await savedWhen(page, value => value.rotation.handleSensitivity === .5, 'Handle speed saves');
    await sameSpeed.click();
    await savedWhen(page, value => value.rotation.handleSensitivity === undefined, 'Use Rotation sensitivity clears it');
    const editor = dialog.getByLabel('Rotation editor', { exact: true });
    await editor.selectOption('bones');
    await dialog.getByText('Bones has no Rotate tool.', { exact: true }).waitFor();
    check('Bones shows no rows', await dialog.getByLabel('Rotation sensitivity', { exact: true }).count(), 0);
    await editor.selectOption('showcase');
    await dialog.getByLabel('Rotation sensitivity', { exact: true }).waitFor();
    check('Showcase has no Workplane row', await workplane.count(), 0);
    check('Showcase has no Shift row', await shift.count(), 0);
    await editor.selectOption('forge');
    const useDefault = dialog.getByLabel('Use default: Workplane on: how you drag', { exact: true });
    await useDefault.waitFor();
    check('an editor starts on Use default', await useDefault.isChecked());
    check('and its row is off', await workplane.isDisabled());
    await useDefault.click();
    check('unticking turns the row on', await workplane.isEnabled());
    await workplane.selectOption({ label: 'Left and right' });
    await savedWhen(page, value => value.rotation.editors.forge?.workplaneDrag === 'leftRight' && value.rotation.workplaneDrag === undefined, 'only Forge changed');
    await editor.selectOption('all');
    check('All editors keeps its value', await chosen(workplane), 'Follow the arrow');
    await editor.selectOption('forge');
    check('Forge keeps its own value', await chosen(workplane), 'Left and right');
    await useDefault.click();
    await savedWhen(page, value => !value.rotation.editors.forge, 'Use default removes the override');
    await editor.selectOption('all');

    // ---- Hotkeys: drag keys as table rows, a clash waits for Replace, Reset all clears them.
    await tab(dialog, 'Hotkeys');
    check('Hotkeys has the bar', await dialog.getByLabel('Hotkeys preset', { exact: true }).count(), 1);
    const inline = await dialog.locator('.settings-learn svg.settings-preview-scene').boundingBox();
    check('Learn has its small preview', [Math.round(inline.width), Math.round(inline.height)], [220, 96]);
    await dialog.getByLabel('Hotkeys category', { exact: true }).selectOption('Mouse drag keys');
    check('Mouse drag keys lists every meaning', await dialog.locator('.hotkeys-table tbody tr').count(), 13);
    const fine = dialog.getByLabel('Fine control key, Rotate', { exact: true });
    await fine.selectOption('Alt');
    await savedWhen(page, value => value.modifiers['drag.rotate.fine'] === 'Alt', 'a drag key can be rebound');
    await fine.selectOption('Ctrl');
    const clash = dialog.locator('.hotkeys-conflict');
    await clash.waitFor();
    check('a clash names the other meaning', (await clash.innerText()).includes('Ctrl is assigned to Snap to steps (Rotate)'));
    check('a clash changes nothing yet', await fine.inputValue(), 'Alt');
    check('and nothing is saved', (await preferences(page)).modifiers['drag.rotate.fine'], 'Alt');
    await dialog.getByRole('button', { name: /^Replace/ }).click();
    await savedWhen(page, value => value.modifiers['drag.rotate.fine'] === 'Ctrl' && value.modifiers['drag.rotate.snap'] === '', 'Replace takes the key from the other meaning');
    check('the clash sentence goes away', await clash.count(), 0);
    await mousePage(dialog, 'Rotation');
    await dialog.getByText('Ctrl while rotating', { exact: true }).waitFor();
    check('Rotate names the current key', true);
    check('with no snap key the snap row hides', await dialog.locator('[data-hotkey="mouse:rotation-snap"]').count(), 0);
    await tab(dialog, 'Hotkeys');
    await dialog.getByRole('button', { name: 'Reset all Hotkeys…', exact: true }).click();
    await dialog.getByRole('button', { name: 'Restore all defaults', exact: true }).click();
    await savedWhen(page, value => Object.keys(value.modifiers).length === 0, 'Reset all clears the drag keys');
    await dialog.getByLabel('Hotkeys category', { exact: true }).selectOption('Mouse drag keys');
    await dialog.getByLabel('Lock direction key, Move', { exact: true }).selectOption('Alt');
    await savedWhen(page, value => value.modifiers['drag.move.axisLock'] === 'Alt', 'a drag key set for the restart');

    // ---- Appearance: the toolbar select, Save as goes to Presets, an edit reads Custom.
    await appearancePage(dialog, 'Interface');
    const toolbar = dialog.getByLabel('Toolbar', { exact: true });
    check('the toolbar options', await optionTexts(toolbar), ['Graphic', 'Trim', 'Hidden']);
    await dialog.getByText('Hidden: use the menu bar or Ctrl+F2.', { exact: true }).waitFor();
    for (const mode of ['trim', 'hidden']) {
      await toolbar.selectOption(mode);
      await page.waitForFunction(mode => document.querySelector('.classic-app').dataset.toolbar === mode, mode);
      check(`Toolbar ${mode} applies`, true);
    }
    await dialog.locator('[data-hotkey="appearance:reset"]').click();
    await page.waitForFunction(() => document.querySelector('.classic-app').dataset.toolbar === undefined);
    check('Restore Lordaeron goes back to the graphic toolbar', await toolbar.inputValue(), 'graphic');
    await toolbar.selectOption('trim');
    await savedWhen(page, value => value.toolbarMode === 'trim', 'Toolbar set for the restart');
    const look = dialog.getByLabel(LOOK_PRESET, { exact: true });
    check('the Appearance bar reads Lordaeron', await chosen(look), 'Lordaeron');
    await dialog.getByRole('button', { name: 'Save as…', exact: true }).click();
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Custom viewport preset name');
    check('Save as goes to Presets', await dialog.getByRole('navigation', { name: 'Appearance pages' }).getByRole('button', { name: 'Presets', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.keyboard.type('Layout look');
    await dialog.getByRole('button', { name: 'Save as custom preset', exact: true }).click();
    await messageSays(page, 'Layout look saved.');
    check('the saved look is shown', await chosen(look), 'Layout look');
    await subPage(dialog, 'Appearance pages', 'Interface');
    await dialog.getByLabel('UI accent', { exact: true }).fill('#123456');
    await page.waitForFunction(label => document.querySelector(`[aria-label="${label}"]`).selectedOptions[0].textContent === 'Custom', LOOK_PRESET);
    check('an accent edit reads Custom', await chosen(look), 'Custom');
    await savedWhen(page, value => value.viewportPresets.some(item => item.name === 'Layout look' && item.toolHighlight !== undefined), 'a saved look holds the helper colours too');
    await dialog.getByRole('button', { name: 'Done', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
  } catch (error) {
    await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {});
    throw error;
  } finally { await closeApp(app, { keepProfile: true }); }

  // ---- After a restart everything saved is still there.
  const second = await launchApp({ fixture, out, errors, profile, bounds });
  try {
    await second.page.getByLabel('Select geoset 0', { exact: true }).waitFor();
    await second.page.waitForFunction(() => document.querySelector('.classic-app').dataset.toolbar === 'trim');
    check('after a restart: the toolbar mode', true);
    const dialog = await openSettings(second.page);
    await mousePage(dialog, 'UV');
    check('after a restart: the saved UV preset', (await optionTexts(dialog.getByLabel(UV_PRESET, { exact: true }))).includes('Layout UV'));
    await tab(dialog, 'Hotkeys');
    await dialog.getByLabel('Hotkeys category', { exact: true }).selectOption('Mouse drag keys');
    check('after a restart: the drag key', await dialog.getByLabel('Lock direction key, Move', { exact: true }).inputValue(), 'Alt');
    await appearancePage(dialog, 'Presets');
    check('after a restart: the saved look', (await optionTexts(dialog.getByLabel(LOOK_PRESET, { exact: true }))).includes('Layout look'));
  } catch (error) {
    await second.page.screenshot({ path: path.join(out, 'failure-restart.png') }).catch(() => {});
    throw error;
  } finally { await closeApp(second.app); }

  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ checks: checks.length, errors }, null, 2));
  console.log(`CHECKS ${checks.length}, RENDERER ERRORS ${errors.length}`);
  assert.deepEqual(errors, [], 'no renderer errors');
})().catch(error => { console.error(error); process.exitCode = 1; });
