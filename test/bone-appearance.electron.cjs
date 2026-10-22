// Run after building; MDLXL_PLAYWRIGHT_MODULE can point to shared Playwright.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const root = process.cwd(), output = path.resolve(process.env.MDLXL_APPEARANCE_OUTPUT || 'out/bone-appearance');
  fs.mkdirSync(output, { recursive: true });
  const profile = fs.mkdtempSync(path.join(output, 'profile-'));
  const fixture = path.join(root, 'fixtures/demo.mdx'), original = fs.readFileSync(fixture);
  fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify({ preferences: { rendererRevision: 3, language: 'en', checkUpdatesOnStartup: false, graphics: { pauseWhenHidden: false } } }));
  const errors = [], result = { combinations: [], rotation: null, persisted: null };
  let app;
  const launch = async () => {
    app = await _electron.launch({ executablePath: path.join(root, 'node_modules/electron/dist/electron.exe'), args: ['--disable-backgrounding-occluded-windows', root, fixture], env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: profile }, timeout: 60000 });
    const page = await app.firstWindow(); page.setDefaultTimeout(20000);
    page.on('pageerror', error => errors.push(error.message));
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.setBackgroundThrottling(false));
    await page.getByRole('button', { name: 'Bones', exact: true }).click();
    await page.locator('.game-preview-surface canvas').first().waitFor();
    await page.evaluate(() => {
      window.currentFiber = host => {
        let fiber = host[Object.keys(host).find(key => key.startsWith('__reactFiber'))], top = fiber;
        while (top.return) top = top.return;
        return top.stateNode.current === top ? fiber : fiber.alternate || fiber;
      };
      window.previewRuntime = () => {
        for (let fiber = currentFiber(document.querySelector('.game-preview-surface')); fiber; fiber = fiber.return) {
          for (let hook = fiber.memoizedState; hook; hook = hook.next) {
            const state = hook.memoizedState?.current;
            if (state?.native && state?.controls) return state;
          }
        }
        throw Error('Preview runtime not found');
      };
      window.previewProps = () => {
        for (let fiber = currentFiber(document.querySelector('.game-preview-surface')); fiber; fiber = fiber.return) if (fiber.memoizedProps?.model && fiber.memoizedProps.preferences) return fiber.memoizedProps;
        throw Error('Preview props not found');
      };
    });
    return page;
  };
  const settings = async page => {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('menu', 'appearanceSettings'));
    await page.getByRole('dialog', { name: 'Settings' }).waitFor();
    await page.locator('.settings-appearance-nav').getByRole('button', { name: 'Bones & skeleton', exact: true }).click();
  };
  try {
    let page = await launch();
    const modelBefore = await page.evaluate(() => JSON.stringify(previewProps().model));
    await settings(page);
    assert.deepEqual(await page.getByLabel('Bone style', { exact: true }).locator('option').evaluateAll(nodes => nodes.map(node => node.value)), ['cubes', 'diamond']);
    assert.deepEqual(await page.getByLabel('Skeleton style', { exact: true }).locator('option').evaluateAll(nodes => nodes.map(node => node.value)), ['shaded', 'tapered', 'cone', 'stick']);
    for (const style of ['cubes', 'diamond']) for (const connector of ['shaded', 'tapered', 'cone', 'stick']) {
      await page.getByLabel('Bone style', { exact: true }).selectOption(style);
      await page.getByLabel('Skeleton style', { exact: true }).selectOption(connector);
      await page.waitForFunction(({ style, connector }) => {
        const bones = previewProps().preferences.viewportAppearance.bones;
        return bones.style === style && bones.connector === connector;
      }, { style, connector });
      const preview = page.getByRole('img', { name: 'Bone appearance preview' });
      assert.equal(await preview.locator('circle').count(), 0);
      assert.equal(await preview.locator('rect').count(), style === 'cubes' ? 4 : 0);
      const selectedStyle = await page.getByLabel('Bone style', { exact: true }).inputValue();
      assert.equal(selectedStyle, style, 'skeleton style must preserve markers');
      await page.getByLabel('Bone style', { exact: true }).selectOption(style === 'cubes' ? 'diamond' : 'cubes');
      assert.equal(await page.getByLabel('Skeleton style', { exact: true }).inputValue(), connector, 'marker style must preserve skeleton');
      await page.getByLabel('Bone style', { exact: true }).selectOption(style);
      result.combinations.push({ style, connector });
    }
    await page.getByLabel('Skeleton style', { exact: true }).selectOption('cone');
    await page.screenshot({ path: path.join(output, 'settings.png'), animations: 'disabled' });
    await page.getByRole('button', { name: 'Close Settings', exact: true }).click();
    // Exercise normal pointer controls, then verify the runtime camera moved.
    const before = await page.evaluate(() => previewRuntime().controls.object.position.toArray());
    const canvas = page.locator('.game-preview-surface canvas').last(), bounds = await canvas.boundingBox();
    assert.ok(bounds && bounds.width > 100);
    await page.keyboard.down('Alt');
    await page.mouse.move(bounds.x + bounds.width * .55, bounds.y + bounds.height * .5);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width * .7, bounds.y + bounds.height * .6, { steps: 12 });
    await page.mouse.up(); await page.keyboard.up('Alt');
    await page.waitForFunction(before => previewRuntime().controls.object.position.toArray().some((value, index) => Math.abs(value - before[index]) > .01), before);
    result.rotation = { before, after: await page.evaluate(() => previewRuntime().controls.object.position.toArray()) };
    assert.equal(await page.evaluate(() => JSON.stringify(previewProps().model)), modelBefore, 'appearance and camera must not mutate model');
    await app.close(); app = null;
    page = await launch();
    await settings(page);
    result.persisted = { style: await page.getByLabel('Bone style', { exact: true }).inputValue(), connector: await page.getByLabel('Skeleton style', { exact: true }).inputValue() };
    assert.deepEqual(result.persisted, { style: 'diamond', connector: 'cone' });
    assert.deepEqual(fs.readFileSync(fixture), original);
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({ ...result, errors }, null, 2));
    console.log(JSON.stringify(result, null, 2));
  } finally {
    if (app) await app.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
