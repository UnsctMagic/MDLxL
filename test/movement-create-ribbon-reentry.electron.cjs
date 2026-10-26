const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  if (process.platform === 'win32') assert.equal(process.env.MDLXL_SUITE_HIDDEN, '1', 'Run through the hidden-desktop packaged runner');
  const root = process.cwd(), out = path.join(root, 'out/movement-create-ribbon-reentry');
  fs.mkdirSync(out, { recursive: true });
  const { createDemoDocument } = await import('../src/editor-document.js');
  const { createStarterRecipe, STARTER_TEXTURE, RIBBON_TEXTURE } = await import('../src/particle-starters.js'), { starterTextureAsset } = await import('./starter-picture.js');
  const { placeParticleRecipe } = await import('../src/particle-recipes.js');
  const doc = createDemoDocument(), empty = path.join(out, 'No-effects.mdx');
  fs.writeFileSync(empty, doc.serialize('mdx'));
  placeParticleRecipe(doc.model, createStarterRecipe(), { position: [0, 0, 60] });
  placeParticleRecipe(doc.model, createStarterRecipe('ribbon'), { position: [0, 0, 50] });
  placeParticleRecipe(doc.model, createStarterRecipe('ribbon'), { position: [0, 70, 50] });
  const fixture = path.join(out, 'Existing-effects.mdx');
  const { generateCompatibleMdx } = await import('../src/mdx-compatibility.js');
  fs.writeFileSync(fixture, Buffer.from(generateCompatibleMdx(doc.model)));
  for (const name of [STARTER_TEXTURE, RIBBON_TEXTURE]) {
    const file = path.join(out, ...name.split('\\'));
    fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, starterTextureAsset(name).bytes);
  }
  const pkg = path.resolve(process.env.MDLXL_SUITE_PKG || 'out/pkg/MDLxL-win32-x64');
  const app = await _electron.launch({ executablePath: path.join(pkg, 'MDLxL.exe'), args: ['--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-gpu-vsync', '--disable-frame-rate-limit', fixture], cwd: root, env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: path.join(out, 'profile') }, timeout: 60000 });
  const checks = [], errors = [];
  let page;
  try {
    page = await app.firstWindow(); page.setDefaultTimeout(20000);
    page.on('pageerror', error => errors.push(error.message));
    const menu = action => app.evaluate(({ BrowserWindow }, id) => BrowserWindow.getAllWindows()[0].webContents.send('menu', id), action);
    const closeEditor = async () => {
      await page.getByRole('button', { name: 'Close Particle Editor', exact: true }).click();
      await page.getByRole('dialog', { name: 'Particle Editor', exact: true }).waitFor({ state: 'hidden' });
    };
    const size = width => app.evaluate(({ BrowserWindow }, width) => { const w = BrowserWindow.getAllWindows()[0]; w.webContents.setBackgroundThrottling(false); w.setSize(width, 900); w.showInactive(); }, width);
    const state = () => page.evaluate(() => {
      const el = document.querySelector('.classic-app');
      for (let fiber = el[Object.keys(el).find(key => key.startsWith('__reactFiber'))]; fiber; fiber = fiber.return) {
        for (let hook = fiber.memoizedState; hook; hook = hook.next) {
          const value = hook.memoizedState;
          if (value?.doc?.model) return { model: JSON.stringify(value.doc.model), sequences: value.doc.model.Sequences.map(s => ({ name: s.Name, interval: Array.from(s.Interval) })), ribbons: value.doc.model.RibbonEmitters.map(n => n.ObjectId), particles: value.doc.model.ParticleEmitters2.map(n => n.ObjectId), undo: value.doc.historyStats.undoSteps };
        }
      }
      throw Error('Live document unavailable');
    });
    const camera = () => page.evaluate(() => {
      const el = document.querySelector('.pe-preview .game-preview-root');
      for (let fiber = el?.[Object.keys(el).find(key => key.startsWith('__reactFiber'))]; fiber; fiber = fiber.return) {
        for (let hook = fiber.memoizedState; hook; hook = hook.next) {
          const value = hook.memoizedState?.current;
          if (value?.controls?.object) return value.controls.object.quaternion.toArray();
        }
      }
      return null;
    });
    const rotate = async () => {
      await page.locator('.pe-preview .game-preview-root canvas').first().waitFor();
      await page.waitForFunction(() => document.querySelector('.pe-preview .game-preview-root canvas')?.width > 0);
      let before;
      for (let i = 0; i < 50 && !(before = await camera()); i++) await page.waitForTimeout(100);
      assert.ok(before, 'Native preview camera exists');
      const box = await page.locator('.pe-preview .game-preview-root').boundingBox();
      const x = box.x + box.width * .3, y = box.y + box.height * .4;
      await page.keyboard.down('Alt'); await page.mouse.move(x, y); await page.mouse.down();
      await page.mouse.move(x + 70, y + 30, { steps: 8 }); await page.mouse.up(); await page.keyboard.up('Alt');
      await page.waitForTimeout(100);
      const after = await camera(), delta = Math.hypot(...after.map((v, i) => v - before[i]));
      assert.ok(delta > .01, 'Real mouse drag rotates EMTR camera');
      return delta;
    };
    await size(1600); await page.getByText('Opened Existing-effects.mdx', { exact: true }).waitFor();
    await menu('animation'); await page.locator('.movement-controller').waitFor();
    const initial = await state();
    for (const vis of [false, true]) {
      const active = await page.locator('.classic-app').getAttribute('data-vis-ui');
      if (!!active !== vis) await page.locator('.vis-toggle').click();
      for (const width of [1100, 1600]) {
        await size(width);
        const row = page.locator('.movement-sequence'), before = await state();
        const layout = await row.evaluate(el => { const r = el.getBoundingClientRect(), button = el.querySelector('button').getBoundingClientRect(), select = el.querySelector('select').getBoundingClientRect(); return { row: r.width, overflow: el.scrollWidth > el.clientWidth, inside: button.right <= r.right + 1, select: select.width }; });
        assert.equal(layout.overflow, false); assert.equal(layout.inside, true); assert.ok(layout.select > 25);
        await row.getByRole('button', { name: 'Create', exact: true }).click();
        const after = await state(), index = before.sequences.length, created = after.sequences[index];
        assert.equal(after.sequences.length, index + 1); assert.equal(created.interval[1] - created.interval[0], 1000);
        assert.equal(await page.getByLabel('Movement current sequence', { exact: true }).inputValue(), String(index));
        const timing = await page.locator('.movement-controller').evaluate(el => {
          for (let fiber = el[Object.keys(el).find(key => key.startsWith('__reactFiber'))]; fiber; fiber = fiber.return) if (fiber.memoizedProps?.onTimelineChange) return { time: fiber.memoizedProps.time, playing: fiber.memoizedProps.playing };
        });
        assert.equal(timing.time, created.interval[0]); assert.equal(timing.playing, false); assert.equal(after.undo, before.undo + 1);
        await page.getByText('One-second blank sequence created.', { exact: true }).waitFor();
        await page.evaluate(() => document.activeElement?.blur()); await page.keyboard.press('Control+z');
        await page.waitForFunction(count => document.querySelectorAll('[aria-label="Movement current sequence"] option').length === count, before.sequences.length + 1);
        assert.equal((await state()).model, before.model, 'Ctrl+Z restores authored model');
        checks.push({ check: 'Movement Create and Ctrl+Z', vis, width, layout });
      }
    }
    // Animations still creates through the same action.
    await menu('animations'); await page.locator('.animation-controller').waitFor();
    const beforeAnimation = await state();
    await page.locator('.ac-sequence-actions').getByRole('button', { name: 'Create', exact: true }).click();
    assert.equal((await state()).sequences.length, beforeAnimation.sequences.length + 1);
    await page.evaluate(() => document.activeElement?.blur()); await page.keyboard.press('Control+z');
    await page.waitForTimeout(100); assert.equal((await state()).model, beforeAnimation.model);
    await menu('bones'); await page.locator('.movement-controller').waitFor(); assert.equal(await page.locator('.movement-sequence').count(), 0);
    checks.push({ check: 'Animations Create and rest-pose exclusion' });
    await menu('animation'); await page.locator('.movement-controller').waitFor();
    await page.getByLabel('Movement bone or node', { exact: true }).selectOption('');
    await menu('particles'); await page.getByLabel('Particle context', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('Particle context', { exact: true }).inputValue(), 'On model');
    assert.equal(await page.getByLabel('Effect ingredient', { exact: true }).inputValue(), String(initial.ribbons[0]));
    assert.equal(await page.getByRole('button', { name: 'Close Particle Library', exact: true }).count(), 0);
    const delta = await rotate(); assert.equal((await state()).model, initial.model, 'Opening and camera rotation do not mutate model');
    checks.push({ check: 'Unselected EMTR chooses existing first ribbon; mouse rotates', delta });
    await page.getByLabel('Effect ingredient', { exact: true }).selectOption(String(initial.particles[0]));
    await closeEditor();
    await menu('particles'); assert.equal(await page.getByLabel('Effect ingredient', { exact: true }).inputValue(), String(initial.particles[0]));
    await page.getByRole('button', { name: 'Library', exact: true }).click(); await page.getByRole('button', { name: 'Close Particle Library', exact: true }).click();
    await page.getByRole('button', { name: 'New', exact: true }).click(); await page.locator('.pe-action-strip').getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal((await state()).model, initial.model);
    checks.push({ check: 'Selected effect, effect dropdown, Library and New preserved' });
    await closeEditor();
    await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, empty);
    await menu('open'); await page.getByText('Opened No-effects.mdx', { exact: true }).waitFor();
    await menu('particles'); assert.equal(await page.getByLabel('Particle context', { exact: true }).inputValue(), 'Lab');
    await page.getByRole('button', { name: 'Close Particle Library', exact: true }).click();
    checks.push({ check: 'No-effects model still opens Lab; mouse rotates', delta: await rotate() });
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ checks, errors }, null, 2));
    console.log(JSON.stringify({ checks, errors }));
  } catch (error) {
    console.error(error.stack || error);
    if (page) { console.error((await page.locator('body').innerText()).slice(-2500)); await page.screenshot({ path: path.join(out, 'failure.png') }); }
    throw error;
  } finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); }
})().catch(error => { console.error(error); process.exit(1); });
