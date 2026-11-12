const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { appTarget, appDist, launchApp, closeApp } = require('./helpers/app.cjs');
const { fixturePath, gameFolder } = require('./helpers/fixtures.cjs');

async function click(page, locator) {
  await locator.waitFor();
  const { x, y, width, height } = await locator.boundingBox();
  await page.mouse.click(x + width / 2, y + height / 2);
}

test('Library keeps the checked geosets open for correction when their copy would lose data', async () => {
  const target = appTarget();
  assert.ok(target.packaged, 'use a disposable packaged build');
  const dir = path.join(appDist(target), 'assets');
  const bundlePath = path.join(dir, fs.readdirSync(dir).find(name => /^GameFileBrowser-.*\.js$/.test(name)));
  const bundle = fs.readFileSync(bundlePath, 'utf8');
  // The real writer/reopen comparison must detect this unsupported field in
  // the subset copy. The installed game model and its original bytes stay intact.
  const select = /(\.apply\("Keep checked geosets",\["Geosets","GeosetAnims","Gliders","Info"\],(\w+)=>\{)/;
  assert.ok(select.test(bundle), 'locate the checked-geoset copy in the bundle');
  fs.writeFileSync(bundlePath, bundle.replace(select, '$1$2.Info.UnwrittenTestField=23;'));
  const out = path.resolve('out/library-copy-verification');
  fs.mkdirSync(out, { recursive: true });
  let app;
  try {
    const launched = await launchApp({
      target, out, fixture: fixturePath('citadel-footman'), pageTimeout: 45000,
      env: { MDLVIS_GAME_DATA: process.env.MDLVIS_GAME_DATA || await gameFolder() },
    });
    app = launched.app;
    const { page } = launched;
    await click(page, page.locator('[data-hotkey="textureLibrary"]'));
    const library = page.getByRole('dialog', { name: 'Warcraft III Library' });
    await click(page, library.getByRole('tab', { name: 'Models', exact: true }));
    const style = library.getByRole('button', { name: 'World Editor Style', exact: true });
    await style.waitFor();
    if (await style.getAttribute('aria-pressed') !== 'true') await click(page, style);
    const row = name => library.locator('.gf-row').filter({ has: page.locator('.gf-name', { hasText: new RegExp('^' + name + '$') }) }).first();
    for (const name of ['Human', 'Units', 'Normal', 'Footman']) await click(page, row(name));
    const parts = library.locator('.gf-geosets');
    await click(page, parts.getByRole('button', { name: 'Clear', exact: true }));
    await click(page, parts.getByRole('checkbox', { name: 'Geoset 1', exact: true }));
    await click(page, parts.getByRole('button', { name: 'Open in editor', exact: true }));
    const warning = parts.getByText(/Save verification failed: .*UnwrittenTestField/);
    await Promise.race([warning.waitFor({ timeout: 10000 }), library.waitFor({ state: 'hidden', timeout: 10000 })]);
    assert.equal(await warning.isVisible(), true, 'the Library keeps the selection and shows the actual save warning');
    assert.equal(await page.getByRole('tab', { name: 'Footman.mdx', exact: true }).count(), 1);
  } finally {
    if (app) await closeApp(app);
    fs.writeFileSync(bundlePath, bundle);
  }
});
