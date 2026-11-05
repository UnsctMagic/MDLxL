const { launchApp, closeApp } = require('./helpers/app.cjs');
const { fixturePath } = require('./helpers/fixtures.cjs');
// Run after building dist: node test/localization.electron.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const { translate } = await import('../src/localization.js');
  const { createNode, openDocument } = await import('../src/editor-document.js');
  const realModel = fs.readFileSync(fixturePath('footman'));
  const document = () => openDocument(realModel, 'Footman.mdx');
  const output = path.resolve('out/localization/electron');
  fs.mkdirSync(output, { recursive: true });
  const doc = document();
  doc.apply('Particle fixture', ['Nodes', 'PivotPoints'], model => { createNode(model, 'ParticleEmitter2').Name = 'Materials'; });
  const fixture = path.join(output, 'Materials.mdx');
  fs.writeFileSync(fixture, doc.serialize('mdx'));
  const repairDoc = document();
  repairDoc.apply('Tint conflict fixture', ['GeosetAnims'], model => {
    // Keep every original animation index referenced by the real Footman's bones.
    const first = model.GeosetAnims.find(anim => anim.GeosetId === 0);
    if (first) Object.assign(first, { Flags: 2, Alpha: 1, Color: new Float32Array([1, 0, 0]) });
    else model.GeosetAnims.push({ GeosetId: 0, Flags: 2, Alpha: 1, Color: new Float32Array([1, 0, 0]) });
    model.GeosetAnims.push({ GeosetId: 0, Flags: 2, Alpha: 1, Color: new Float32Array([0, 1, 0]) });
  });
  const repairFixture = path.join(output, 'Tint conflict.mdx');
  fs.writeFileSync(repairFixture, repairDoc.serialize('mdx'));
  const original = fs.readFileSync(fixture), repairOriginal = fs.readFileSync(repairFixture);
  const failures = [];
  async function launch(file, language = 'en') {
    const profile = path.join(output, `profile-${language}-${Date.now()}`);
    fs.mkdirSync(profile, { recursive: true });
    fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify({ preferences: { language } }));
    const { app, page } = await launchApp({ out: path.dirname(profile), profile: profile, env: { MDLVIS_HEADLESS: '1' }, timeout: 60000, fixture: file , pageTimeout: 15000 });

    page.on('pageerror', error => failures.push(error.message));
    await app.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0];
      window.webContents.setBackgroundThrottling(false); window.setFocusable(false); window.setSkipTaskbar(true); window.setIgnoreMouseEvents(true); window.setOpacity(0); window.setPosition(-3000, 0); window.showInactive();
    });
    return { app, page };
  }
  const { app, page } = await launch(fixture);
  try {
    await page.locator('.language-trigger').waitFor();
    await page.getByLabel('Select geoset 0', { exact: true }).waitFor();
    await page.evaluate(() => {
      window.testDocument = ()=>{const state=findFiberState('.classic-app',s=>s?.doc?.model);if(!state)throw Error('Document unavailable');return state.doc;};
    });
    await page.waitForFunction(() => testDocument().name === 'Materials.mdx');
    const before = await page.evaluate(() => JSON.stringify(testDocument().model));
    const widths = await page.locator('.classic-sidebar').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().width));
    assert.equal(widths.length, 1);
    for (const [locale, label] of [['ru', 'Russian'], ['es', 'Spanish'], ['zh', 'Chinese'], ['fr', 'French'], ['de', 'German'], ['mordor', 'The Language of Mordor'], ['en', 'English'], ['ru', 'Russian'], ['es', 'Spanish']]) {
      await page.locator('.language-trigger').click();
      await page.getByRole('option', { name: label, exact: true }).click();
      await page.getByLabel(translate('Select geoset 0', locale), { exact: true }).waitFor();
      const expectedFile = translate('&File', locale);
      // Renderer translation and the asynchronous native-menu IPC finish separately.
      const deadline = Date.now() + 5000;
      while ((await app.evaluate(({ Menu }) => Menu.getApplicationMenu().items[0].label)) !== expectedFile) {
        if (Date.now() > deadline) throw Error(locale + ': native menu language did not update');
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      const menu = await app.evaluate(({ Menu }) => Menu.getApplicationMenu().items.map(item => ({ label: item.label, children: item.submenu?.items.map(child => child.label) })));
      assert.equal(menu[0].label, expectedFile);
      const coordinates = await page.locator('.classic-coordinates').evaluate(element => getComputedStyle(element, '::before').content);
      assert.equal(coordinates, JSON.stringify(locale === 'zh' ? 'Coords:' : translate('Coords:', locale)));
      // The deliberate Mordor cipher can give two top-level menus the same word.
      const windowLabels = menu[5].children;
      assert.equal(menu[5].label, translate('Managers', locale));
      assert.ok(windowLabels.includes(translate('Material Manager…', locale)), `${locale}: ${JSON.stringify(windowLabels)}`);
      assert.equal(await page.evaluate(() => JSON.stringify(testDocument().model)), before, `${locale}: language must not mutate the model`);
      assert.deepEqual(await page.locator('.classic-sidebar').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().width)), widths);
      if (locale !== 'en') {
        await page.screenshot({ path: path.join(output, `${locale}-editor.png`) });
        await page.locator('button.emitter-tool[data-hotkey="particles"]').click();
        const dialog = page.getByRole('dialog', { name: translate('Particle Editor', locale), exact: true });
        await dialog.waitFor();
        // The library opens only while no emitter is selected; the first pass below selects one.
        await dialog.locator('.pe-toolbar').waitFor();
        const closeLibrary = dialog.getByRole('button', { name: translate('Close Particle Library', locale), exact: true });
        if (await closeLibrary.count()) await closeLibrary.click();
        await dialog.getByLabel(translate('Particle context', locale), { exact: true }).selectOption('On model');
        assert.ok((await dialog.getByLabel(translate('Effect ingredient', locale), { exact: true }).locator('option').allTextContents()).some(text => text.includes('Materials')), 'user emitter names stay literal');
        const transport = dialog.locator('.pe-transport button').first();
        assert.equal(await transport.evaluate(button => [...button.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent).join('')), translate('Pause', locale));
        await transport.click();
        assert.equal(await transport.evaluate(button => [...button.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent).join('')), translate('Play', locale));
        // The reworked Emitter Editor: Look tab, life table and Adjust Manually.
        const ingredient = dialog.getByLabel(translate('Effect ingredient', locale), { exact: true });
        await ingredient.selectOption({ index: await ingredient.evaluate(select => [...select.options].findIndex(option => option.textContent.includes('Materials'))) });
        await dialog.locator('.pe-life-table').waitFor();
        assert.equal(await dialog.locator('.pe-tool-tabs button').first().textContent(), translate('Look', locale));
        assert.equal(await dialog.locator('.pe-manual').textContent(), translate('Adjust Manually', locale));
        assert.equal(await dialog.locator('.pe-life-table thead th').first().textContent(), translate('Over its life', locale));
        assert.deepEqual(await dialog.locator('.pe-life-table thead button').allTextContents(), ['Born', 'Halfway', 'End'].map(text => translate(text, locale)));
        await page.screenshot({ path: path.join(output, `${locale}-particles.png`) });
        await dialog.locator('.pe-manual').click();
        const manual = page.locator('.emitter-text-dialog');
        assert.equal(await manual.locator('.emitter-text-heading span').textContent(), translate('Exact MDL text of this emitter', locale));
        await page.screenshot({ path: path.join(output, `${locale}-emitter-text.png`) });
        await manual.locator('.emitter-text-actions button').last().click();
        await manual.waitFor({ state: 'hidden' });
        await dialog.getByRole('button', { name: translate('Close Particle Editor', locale), exact: true }).click();
        await dialog.waitFor({ state: 'hidden' });
        assert.equal(await page.evaluate(() => JSON.stringify(testDocument().model)), before);
      }
    }
  } finally { await closeApp(app); }

  for (const locale of ['ru', 'es', 'fr', 'de']) {
    const { app: repairApp, page: repairPage } = await launch(repairFixture, locale);
    try {
      // The model opens straight away; its persistent warning opens the repair choices.
      await repairPage.getByRole('button', { name: translate('Duplicate geoset animations', locale), exact: true }).click();
      const dialog = repairPage.getByRole('dialog', { name: translate('Duplicate geoset animations', locale), exact: true });
      await dialog.waitFor();
      await dialog.getByRole('button', { name: translate('Review tint conflict', locale), exact: true }).click();
      assert.equal(await repairPage.evaluate(() => document.activeElement?.dataset.geosetTint), '0', `${locale}: tint review focuses the localized field`);
      await dialog.locator('[data-geoset-tint="0"]').selectOption('0');
      assert.equal(await dialog.getByRole('button', { name: translate('Fix', locale), exact: true }).isEnabled(), true);
      await repairPage.screenshot({ path: path.join(output, `${locale}-repair.png`) });
    } finally { await closeApp(repairApp); }
  }
  assert.deepEqual(fs.readFileSync(fixture), original);
  assert.deepEqual(fs.readFileSync(repairFixture), repairOriginal);
  assert.deepEqual(failures, [], 'No renderer exceptions');
  console.log('PASS: nine language switches, translated native menus, unchanged model data/sidebar widths, particle controls and Emitter Editor labels in Russian, Spanish, Chinese, French, German and Mordor, and tint-conflict focus in Russian, Spanish, French and German.');
  console.log(`Screenshots: ${output}`);
})().catch(error => { console.error(error); process.exitCode = 1; });
