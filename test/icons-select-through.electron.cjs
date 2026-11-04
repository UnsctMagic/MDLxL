const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { launchApp, closeApp } = require('./helpers/app.cjs');
const { fixturePath } = require('./helpers/fixtures.cjs');

(async () => {
  const out = path.resolve('out/icons-select-through'), profile = path.join(out, 'profile');
  let running;
  const start = async () => {
    running = await launchApp({ out, profile, fixture: fixturePath('footman'), settings: fs.existsSync(path.join(profile, 'settings.json')) ? undefined : { preferences: { modelLookAnswered: true, updateOfferAnswered: true, disableSounds: true } } });
    await running.page.getByLabel('Grabthrough', { exact: true }).waitFor();
    await running.page.waitForFunction(() => document.querySelector('.model-tabs')?.textContent.includes('Footman.mdx'));
    return running.page;
  };
  const click = async locator => {
    await locator.waitFor(); await locator.scrollIntoViewIfNeeded();
    const box = await locator.boundingBox(); assert.ok(box);
    await running.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  };
  const icons = async page => {
    await page.keyboard.press('Control+1');
    await page.getByRole('radiogroup', { name: 'MDL files', exact: true }).waitFor();
  };
  const saved = async (page, mdl, mdx) => {
    // Observe the store's acknowledged first-paint cache, not a delay.
    await page.waitForFunction(({ mdl, mdx }) => {
      const p = JSON.parse(localStorage.getItem('mdlvis-preferences') || '{}');
      return p.fileIconMdl === mdl && p.fileIcon === mdx;
    }, { mdl, mdx });
  };
  try {
    let page = await start();
    assert.equal(await page.getByLabel('Grabthrough', { exact: true }).isChecked(), true);
    await click(page.getByLabel('Grabthrough', { exact: true }));
    await click(page.getByRole('button', { name: 'Bones', exact: true }));
    assert.equal(await page.getByLabel('Grabthrough', { exact: true }).isChecked(), false);
    await click(page.getByLabel('Grabthrough', { exact: true }));
    await icons(page);
    await click(page.getByRole('radiogroup', { name: 'MDL files', exact: true }).getByRole('radio', { name: 'Labelled page', exact: true }));
    await click(page.getByRole('radiogroup', { name: 'MDX files', exact: true }).getByRole('radio', { name: 'Big letters', exact: true }));
    await saved(page, 'label-page', 'label-letters');
    await closeApp(running.app, { keepProfile: true }); running = null;
    page = await start();
    assert.equal(await page.getByLabel('Grabthrough', { exact: true }).isChecked(), false, 'Vertex Select through stays disabled after restart');
    await click(page.getByRole('button', { name: 'Bones', exact: true }));
    assert.equal(await page.getByLabel('Grabthrough', { exact: true }).isChecked(), true, 'Bones remembers its separate enabled choice');
    await click(page.getByLabel('Grabthrough', { exact: true }));
    await icons(page);
    assert.equal(await page.getByRole('radiogroup', { name: 'MDL files', exact: true }).getByRole('radio', { name: 'Labelled page', exact: true }).getAttribute('aria-checked'), 'true');
    assert.equal(await page.getByRole('radiogroup', { name: 'MDX files', exact: true }).getByRole('radio', { name: 'Big letters', exact: true }).getAttribute('aria-checked'), 'true');
    // Exercise every existing choice in both rows, including returning to unlabelled/program icons.
    const choices = [['page','Helmet on a page'],['dark-page','Dark page'],['tile','Dark tile'],['program','Program icon'],['label-page','Labelled page'],['label-dark-page','Labelled dark page'],['label-tile','Labelled tile'],['label-tag','Helmet with label'],['label-letters','Big letters']];
    for (const [style, label] of choices) {
      await click(page.getByRole('radiogroup', { name: 'MDL files', exact: true }).getByRole('radio', { name: label, exact: true }));
      await saved(page, style, 'label-letters');
    }
    for (const [style, label] of choices) {
      await click(page.getByRole('radiogroup', { name: 'MDX files', exact: true }).getByRole('radio', { name: label, exact: true }));
      await saved(page, 'label-letters', style);
    }
    await page.screenshot({ path: path.join(out, 'icon-settings.png') });
    await closeApp(running.app, { keepProfile: true }); running = null;
    page = await start();
    assert.equal(await page.getByLabel('Grabthrough', { exact: true }).isChecked(), false);
    await click(page.getByRole('button', { name: 'Bones', exact: true }));
    assert.equal(await page.getByLabel('Grabthrough', { exact: true }).isChecked(), false, 'Bones Select through stays disabled after restart');
    assert.deepEqual(running.errors, []);
    console.log('PASS: two restarts preserve separate Select through choices; all 18 file-icon choices save independently.');
  } finally { if (running) await closeApp(running.app); }
})().catch(error => { console.error(error); process.exitCode = 1; });
