const { launchApp, closeApp } = require('./helpers/app.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const out = process.env.MDLXL_TEST_OUT || path.resolve('out/forge-add-menu');
  fs.mkdirSync(out, { recursive: true });
  const { createStarterDocument } = await import('../src/starter-model.js');
  const fixture = path.join(out, 'fixture.mdl');
  fs.writeFileSync(fixture, createStarterDocument().serialize('mdl'));
  const { app, page } = await launchApp({ out, fixture, args: ['--use-angle=d3d11-warp'], show: 'hide', bounds: { x: 0, y: 0, width: 1500, height: 950 } });
  app.process().stderr.on('data', data => process.stderr.write(data));
  try {
    await page.getByLabel('3D model viewport', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Forge', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Forge', exact: true });
    const menu = dialog.locator('.forge-add-menu');
    const add = dialog.getByRole('button', { name: 'Add shape', exact: true });
    await menu.waitFor();
    await menu.getByRole('button', { name: 'Cube', exact: true }).click();
    await menu.waitFor({ state: 'hidden' });
    const counts = await dialog.locator('.classic-counts').innerText();
    await add.click();
    await menu.waitFor();
    await add.click();
    await menu.waitFor({ state: 'hidden' });
    await add.click();
    await menu.waitFor();
    await menu.getByRole('spinbutton', { name: 'Width', exact: true }).click();
    assert.equal(await menu.isVisible(), true, 'Clicking a menu field keeps it open');
    await page.keyboard.press('Escape');
    await menu.waitFor({ state: 'hidden', timeout: 3000 });
    assert.equal(await dialog.isVisible(), true, 'Escape closes only the shape menu');
    assert.equal(await dialog.locator('.classic-counts').innerText(), counts);
    await add.click();
    await menu.waitFor();
    await dialog.getByRole('status').click();
    await menu.waitFor({ state: 'hidden', timeout: 3000 });
    assert.equal(await dialog.locator('.classic-counts').innerText(), counts, 'Dismissal adds or deletes no geometry');
    assert.equal(await dialog.isVisible(), true);
    console.log('PASS: Add shape toggles, stays open inside, and dismisses on Escape/outside click without changing geometry or closing Forge');
  } finally {
    await closeApp(app);
    fs.unlinkSync(fixture);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
