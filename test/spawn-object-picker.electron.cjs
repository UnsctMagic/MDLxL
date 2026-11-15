const assert = require('node:assert/strict');
const path = require('node:path');
const { launchApp, closeApp, waitForInfo } = require('./helpers/app.cjs');
const { fixturePath, gameFolder } = require('./helpers/fixtures.cjs');

(async () => {
  const fixture = fixturePath('footman');
  const out = path.join(process.cwd(), 'out', 'spawn-object-picker');
  const { app, page, errors } = await launchApp({ fixture, out, env: { MDLVIS_GAME_DATA: await gameFolder() } });
  try {
    await waitForInfo(page, 'Opened ' + path.basename(fixture));
    await page.keyboard.press('Alt+o');
    const manager = page.getByRole('dialog', { name: 'Object Manager', exact: true });
    await manager.waitFor();
    const search = manager.getByLabel('Search spawn objects', { exact: true });
    const picker = manager.getByLabel('Spawn Object', { exact: true });
    const preview = manager.getByRole('region', { name: 'Spawn Object preview' });
    const node = name => manager.locator('.re-node-name').filter({ hasText: new RegExp('^' + name + '$') });
    const visibleCodes = () => picker.locator('option:not([disabled]):not([hidden])').evaluateAll(options => options.map(option => option.value));
    const type = async (field, value) => {
      await field.click();
      await page.keyboard.press('Control+a');
      await page.keyboard.type(value);
    };
    const choose = async id => {
      await type(search, id);
      await picker.locator('option[value="' + id + '"]').waitFor({ state: 'attached' });
      await picker.click();
      const codes = await visibleCodes();
      await page.keyboard.press(codes[0] === id ? 'Home' : 'End');
      await page.waitForFunction(value => document.querySelector('select[aria-label="Spawn Object"]').value === value, id);
      await preview.locator('canvas').first().waitFor();
    };

    await node('SPNxHBF0').click();
    await picker.locator('option[value="UBGH"]').waitFor({ state: 'attached' });
    const editingCodes = await visibleCodes();
    assert.ok(!editingCodes.includes('TEST') && !editingCodes.includes('HBDH'), 'missing-file and empty rows must be absent from the existing-node picker');
    assert.ok(editingCodes.includes('UBAB') && editingCodes.includes('UBGH') && editingCodes.includes('UEGG'));
    for (const hidden of ['TEST', 'HBDH']) {
      await type(search, hidden);
      assert.deepEqual(await visibleCodes(), ['HBF0'], 'search for ' + hidden + ' must show only the already-selected usable effect');
    }

    await manager.getByText('Node settings', { exact: true }).click();
    const name = manager.getByRole('textbox', { name: 'Name', exact: true });
    await type(name, 'SPNxTEST');
    await page.keyboard.press('Tab');
    await node('SPNxTEST').waitFor();
    await manager.getByText('Not found in the game files', { exact: true }).waitFor();
    assert.equal(await picker.inputValue(), '', 'an unavailable assignment must not select a replacement');
    assert.equal(await preview.count(), 0);
    await manager.getByRole('button', { name: 'Undo manager edit', exact: true }).click();
    await node('SPNxHBF0').waitFor();

    await manager.getByRole('button', { name: 'New', exact: true }).click();
    await manager.getByRole('button', { name: 'Spawn Object', exact: true }).click();
    await picker.locator('option[value="UEGG"]').waitFor({ state: 'attached' });
    assert.deepEqual(await visibleCodes(), editingCodes, 'New and Edit must show the same usable effects');
    await choose('UEGG');
    assert.equal(await node('SPNxUEGG').count(), 0, 'browsing must not create a node');
    await manager.getByRole('button', { name: 'Add event', exact: true }).click();
    await node('SPNxUEGG').waitFor();
    await choose('UBGH');
    await node('SPNxUBGH').waitFor();

    await node('SNDXDFOO').click();
    await manager.getByText('Node settings', { exact: true }).click();
    const eventType = manager.getByLabel('Type', { exact: true });
    await eventType.locator('option[value="SPN"]').waitFor({ state: 'attached' });
    await eventType.click();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await node('SPNX' + editingCodes[0]).waitFor();
    assert.equal(await picker.inputValue(), editingCodes[0], 'changing Type chooses the first usable spawn effect');
    assert.deepEqual(errors, []);
    console.log('PASS shared Spawn Object list, unavailable assignment and undo, search, preview and Add event.');
  } finally {
    await closeApp(app);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
