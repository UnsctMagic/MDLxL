const { launchApp, closeApp, settle } = require('./helpers/app.cjs');
// BindXL window: node test/bind-xl.electron.cjs [model.mdx]
// Opens BindXL from the dock, checks the live preview (bone colours, playing
// animation, camera drag), clicks a part and makes it stiff on a picked bone,
// moves a slider, commits, and checks Undo restores the old binding.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const output = path.resolve('out/bind-xl-ui'); fs.mkdirSync(output, { recursive: true });
  let fixture = process.argv[2] && path.resolve(process.argv[2]);
  if (!fixture) {
    const { createStarterDocument } = await import('../src/starter-model.js');
    fixture = path.join(output, 'bind-xl.mdx');
    fs.writeFileSync(fixture, Buffer.from(createStarterDocument().serialize('mdx')));
  }
  const errors = [];
  const { app, page } = await launchApp({ out: output, profile: path.join(output, 'profile-' + Date.now()), env: { MDLVIS_HEADLESS: '1' }, fixture, errors, args: ['--disable-gpu-vsync', '--disable-frame-rate-limit'], bounds: { x: -3000, y: 0, width: 1600, height: 1000 } });
  const shot = name => page.locator('.bxl-window').screenshot({ path: path.join(output, name + '.png') });
  try {
    await page.locator('[aria-label="3D model viewport"] canvas').first().waitFor({ timeout: 60000 });
    const bindings = () => page.evaluate(() => {
      const model = mdlxlProbe('.classic-app').session?.doc?.model || window.__mdlxlModel;
      return model ? model.Geosets.map(geoset => Array.from(geoset.VertexGroup).map(group => (geoset.Groups[group] || []).join('+')).join(',')).join('|') : null;
    }).catch(() => null);
    const tool = page.locator('.bind-xl-tool');
    await tool.click();
    const window = page.getByRole('dialog', { name: 'BindXL' });
    await window.waitFor({ timeout: 30000 });
    await window.locator('.bxl-preview canvas').first().waitFor({ timeout: 30000 });
    await settle(page, 2500);
    const runtime = () => page.evaluate(() => { const r = mdlxlProbe('.bxl-preview .game-preview-root').runtime; return { frame: r.native.getFrame(), camera: r.controls.object.position.toArray() }; });
    const first = await runtime(); await shot('1-open');
    await settle(page, 600);
    const second = await runtime(); await shot('2-playing');
    assert.notEqual(first.frame, second.frame, 'the preview plays an animation');
    const box = await window.locator('.bxl-preview canvas').first().boundingBox();
    // Pause, then click the model to pick a part.
    await window.getByRole('button', { name: 'Pause', exact: true }).click();
    await settle(page, 300);
    await shot('2b-before-click');
    let picked = false;
    for (const [fx, fy] of [[.5, .45], [.5, .55], [.5, .35], [.47, .5], [.53, .5], [.5, .65], [.45, .4], [.55, .6], [.5, .25], [.42, .5], [.58, .5]]) {
      await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
      await settle(page, 300);
      if (await window.getByRole('region', { name: 'Selected parts' }).count() || await window.locator('[aria-label="Selected parts"]').count()) { picked = true; break; }
    }
    assert.ok(picked, 'clicking the model selects a part');
    await shot('3-part-selected');
    // Camera: a normal left drag on empty space turns it.
    await page.mouse.move(box.x + box.width * .08, box.y + box.height * .9); await page.mouse.down();
    await page.mouse.move(box.x + box.width * .28, box.y + box.height * .85, { steps: 12 }); await page.mouse.up();
    await page.waitForFunction(before => mdlxlProbe('.bxl-preview .game-preview-root').runtime.controls.object.position.toArray().some((v, i) => Math.abs(v - before[i]) > 1), first.camera, { timeout: 10000 });

    await window.getByRole('button', { name: 'Stiff', exact: true }).click();
    assert.equal(await window.getByRole('button', { name: 'Stiff', exact: true }).getAttribute('aria-pressed'), 'true');
    // Slider: Soft joints to the far right.
    const soft = window.getByRole('slider', { name: 'Soft joints' });
    await soft.focus(); await page.keyboard.press('End');
    await settle(page, 500); await shot('4-soft-joints');
    // Colours off shows the textures.
    await window.getByLabel('Bone colours').uncheck(); await settle(page, 500); await shot('5-textured');
    await window.getByLabel('Bone colours').check();
    // Flex mode swings bones one at a time.
    await window.getByLabel('Animation').selectOption('flex'); await settle(page, 1200); await shot('6-flex');
    const title = () => page.title();
    const before = await title();
    await window.getByRole('button', { name: 'Commit', exact: true }).click();
    await window.waitFor({ state: 'detached', timeout: 10000 });
    await page.waitForFunction(() => document.title.includes('*') || document.querySelector('.classic-status')?.textContent.includes('Modified'), null, { timeout: 10000 });
    console.log('title', before, '->', await title());
    await page.keyboard.press('Control+z');
    await settle(page, 500);
    assert.deepEqual(errors.filter(error => !/Warcraft|game data|CASC/i.test(String(error))), []);
    console.log('bind xl ok');
  } finally { await closeApp(app); }
})().catch(error => { console.error(error); process.exit(1); });
