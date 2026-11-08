// Hide extras on the real Blizzard Blademaster: hero glow and the Bladestorm whirlwind leave the list and the view.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { launchApp, closeApp, settle } = require('./helpers/app.cjs');
const { testModel } = require('./helpers/fixtures.cjs');

(async () => {
  const out = path.resolve('out', 'hide-extras-effects');
  await fs.mkdir(out, { recursive: true });
  const profile = await fs.mkdtemp(path.join(out, 'profile-'));
  const fixture = path.join(out, 'heroblademaster.mdx');
  await fs.copyFile(testModel('corpus-sd', 'orc__heroblademaster.mdx'), fixture);
  const { app, page, errors } = await launchApp({ out, profile, env: { MDLVIS_HEADLESS: '1' }, timeout: 60000, fixture, pageTimeout: 20000 });
  try {
    const button = page.getByRole('button', { name: 'Hide extras', exact: true });
    await button.waitFor();
    const listed = async () => { const shown = []; for (let index = 0; index < 9; index++) if (await page.getByLabel(`Select geoset ${index}`, { exact: true }).count()) shown.push(index); return shown; };
    assert.deepEqual(await listed(), [0, 1, 2, 3, 4, 5, 6, 7, 8], 'All nine geosets are listed before Hide extras');
    await page.screenshot({ path: path.join(out, 'before.png') });
    await button.click(); await settle(page, 300);
    assert.deepEqual(await listed(), [1, 2, 3], 'Only the body, head and sword stay');
    await page.screenshot({ path: path.join(out, 'hidden.png') });
    await button.click(); await settle(page, 300);
    assert.deepEqual(await listed(), [0, 1, 2, 3, 4, 5, 6, 7, 8], 'A second click brings every geoset back');
    assert.deepEqual(errors, []);
    console.log('hide-extras-effects: pass');
  } finally { await closeApp(app); }
})().catch(error => { console.error(error); process.exit(1); });
