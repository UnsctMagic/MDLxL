const assert = require('node:assert/strict');
const path = require('node:path');
const { launchApp, closeApp } = require('./helpers/app.cjs');
const { testModel } = require('./helpers/fixtures.cjs');

(async () => {
  const fixture = testModel('corpus-sd800', 'creeps__thunderlizard.mdx');
  const { app, page, errors } = await launchApp({ fixture, out: path.resolve('out/glow-non-square'),
    settings: { preferences: { language: 'en', graphics: { pauseWhenHidden: false } } } });
  try {
    const click = async locator => {
      await locator.waitFor();
      const box = await locator.boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    };
    await click(page.getByRole('button', { name: 'Emitter Editor', exact: true }));
    const editor = page.getByRole('dialog', { name: 'Particle Editor', exact: true });
    await click(editor.getByRole('button', { name: 'Glow Up', exact: true }));
    const glow = editor.getByRole('dialog', { name: 'Glow Up', exact: true });
    assert.equal(await glow.getByLabel('Origin glow', { exact: true }).isChecked(), false, 'the Thunder Lizard already has origin glow geometry');
    assert.equal(await glow.getByLabel('Weapon glow', { exact: true }).isChecked(), false);
    assert.equal(await glow.getByRole('button', { name: 'Create', exact: true }).isEnabled(), false);
    assert.deepEqual(errors, []);
    console.log('PASS Glow Up opens with neither addition selected on the Thunder Lizard with authored glow');
  } finally { await closeApp(app); }
})().catch(error => { console.error(error); process.exitCode = 1; });
