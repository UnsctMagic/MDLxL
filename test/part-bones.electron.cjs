const { launchApp, closeApp, settle: settlePage } = require('./helpers/app.cjs');
// Double-click a part in Movement with Bones and Focused Skeleton off: the bone
// it hangs on is selected and Focused Skeleton turns on, showing the axis cross
// on its pivot. Synthetic data and an isolated profile only.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const { createDemoDocument } = await import('../src/editor-document.js');
  const cwd = process.cwd(), out = path.join(cwd, 'out/part-bones');
  fs.mkdirSync(out, { recursive: true });
  const fixture = path.join(out, 'part-bones-fixture.mdx'), errors = [];
  const doc = createDemoDocument();
  doc.apply('Synthetic sway', ['Nodes'], model => {
    const tilt = degrees => new Float32Array([Math.sin(degrees * Math.PI / 360), 0, 0, Math.cos(degrees * Math.PI / 360)]);
    model.Bones[0].Rotation = { LineType: 1, Keys: [[0, 0], [1000, 25], [2000, 0]].map(([Frame, degrees]) => ({ Frame, Vector: tilt(degrees) })) };
  });
  fs.writeFileSync(fixture, doc.serialize('mdx'));
  const { app, page } = await launchApp({ out: out, profile: path.join(out, 'profile-' + Date.now()), env: {  }, timeout: 60000, fixture: fixture , errors, pageTimeout: 15000, bounds: { x: -3000, y: 0, width: 1600, height: 1000 }, show: 'inactive' });
  try {

    page.on('console', message => { if (message.type() === 'error' && /TypeError|ReferenceError/.test(message.text())) errors.push(message.text()); });
    await page.locator('[data-hotkey="animation"]').click({ timeout: 60000 });
    await page.getByLabel('Movement current sequence').selectOption('0');
    const quick = page.getByRole('group', { name: 'Quick display', exact: true }), toggle = key => quick.locator(`input[data-hotkey="${key}"]`);
    for (const key of ['display:bones', 'display:skeleton', 'display:focusedSkeleton']) if (await toggle(key).count()) await toggle(key).setChecked(false);
    await page.getByLabel('Movement bone or node').selectOption({ index: 0 }).catch(() => {});
    const canvas = page.locator('canvas[data-clean-model-canvas]'), object = page.getByLabel('Movement bone or node');
    await canvas.waitFor();
    const box = await canvas.boundingBox();
    let hit = null;
    for (const [dx, dy] of [[0, 0], [0, -40], [0, 40], [-30, 0], [30, 0], [0, -80], [0, 80]]) {
      await canvas.dblclick({ position: { x: box.width / 2 + dx, y: box.height / 2 + dy } });
      if (await toggle('display:focusedSkeleton').isChecked()) { hit = [dx, dy]; break; }
    }
    assert.ok(hit, 'double-click turned Focused Skeleton on');
    assert.match(await object.evaluate(select => select.selectedOptions[0]?.textContent || ''), /Blade_Root/, 'the bone the part hangs on is selected');
    assert.equal(await toggle('display:bones').isChecked(), false, 'Bones stays as it was');
    await settlePage(page, 300);
    await page.screenshot({ path: path.join(out, 'focused-cross.png'), clip: box });

    // Normal mouse camera rotation still works.
    const before = await page.screenshot({ clip: box });
    const x = box.x + box.width / 2 + 200, y = box.y + box.height / 2;
    await page.keyboard.down('Alt'); await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 90, y + 30, { steps: 8 }); await page.mouse.up(); await page.keyboard.up('Alt');
    await settlePage(page, 300);
    assert.ok(!before.equals(await page.screenshot({ clip: box })), 'Alt+drag still turns the camera');
    assert.deepEqual(errors, []);
    console.log('part-bones: ok', JSON.stringify({ hit }));
  } finally { await closeApp(app).catch(() => {}); }
})().catch(error => { console.error(error); process.exitCode = 1; });
