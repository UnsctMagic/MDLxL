const { launchApp, closeApp, settle } = require('./helpers/app.cjs');
// Bones tab Wiggle: node test/bone-wiggle.electron.cjs [model.mdx]
// Selects a bone, turns Wiggle on and checks that the preview (not the model)
// swings, that a real mouse drag still turns the camera, and that Wiggle stops.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const output = path.resolve('out/bone-wiggle-ui'); fs.mkdirSync(output, { recursive: true });
  let fixture = process.argv[2] && path.resolve(process.argv[2]);
  if (!fixture) {
    const { createStarterDocument } = await import('../src/starter-model.js');
    fixture = path.join(output, 'bone-wiggle.mdx');
    fs.writeFileSync(fixture, Buffer.from(createStarterDocument().serialize('mdx')));
  }
  const before = fs.readFileSync(fixture);
  const errors = [];
  const { app, page } = await launchApp({ out: output, profile: path.join(output, 'profile-' + Date.now()), env: { MDLVIS_HEADLESS: '1' }, fixture, errors, args: ['--disable-gpu-vsync', '--disable-frame-rate-limit'] });
  try {
    await page.locator('[aria-label="3D model viewport"] canvas').first().waitFor({ timeout: 60000 });
    await page.getByRole('button', { name: 'Bones', exact: true }).click();
    await page.getByLabel('Bones controller').waitFor({ timeout: 60000 });
    await settle(page, 1500);
    const picker = page.getByLabel('Movement bone or node');
    if (!(await picker.locator('optgroup[label="Bones"] option').count())) {
      await page.getByRole('button', { name: 'Create', exact: true }).click();
      await page.getByRole('menuitem', { name: 'Bone' }).click();
    } else {
      const values = await picker.locator('optgroup[label="Bones"] option').evaluateAll(options => options.map(option => [option.value, option.textContent]));
      const pick = values.find(([, name]) => /arm|hand|shoulder/i.test(name)) || values[Math.min(values.length - 1, 2)];
      console.log('Wiggling', pick[1]);
      await picker.selectOption(pick[0]);
    }
    const wiggle = page.getByRole('button', { name: 'Wiggle', exact: true });
    assert.equal(await wiggle.getAttribute('aria-pressed'), 'false');
    const matrices = () => page.evaluate(() => (mdlxlProbe().runtime?.native?.rendererData?.nodes || []).map(node => node?.matrix ? Array.from(node.matrix).map(v => Math.round(v * 1e4) / 1e4).join(',') : '').join('|'));
    const rest = await matrices();
    await wiggle.click();
    assert.equal(await wiggle.getAttribute('aria-pressed'), 'true');
    const shots = [];
    for (let i = 0; i < 3; i++) { await settle(page, 250); shots.push(await matrices()); await page.locator('.game-preview-surface').screenshot({ path: path.join(output, `wiggle-${i}.png`) }); }
    assert.ok(shots.some(shot => shot !== rest), 'Wiggle moves the preview');
    assert.ok(new Set(shots).size > 1, 'Wiggle keeps swinging');
    // Mouse camera rotation still works while wiggling (camera rotation mode, then a normal left drag).
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press('Shift+E');
    await page.waitForFunction(() => mdlxlProbe().props.cameraMode === 'rotate');
    const cameraPosition = () => page.evaluate(() => mdlxlProbe().runtime.controls.object.position.toArray());
    const cameraBefore = await cameraPosition(), surface = await page.locator('.game-preview-surface').boundingBox();
    await page.mouse.move(surface.x + surface.width * 0.75, surface.y + surface.height * 0.75); await page.mouse.down();
    await page.mouse.move(surface.x + surface.width * 0.65, surface.y + surface.height * 0.65, { steps: 12 }); await page.mouse.up();
    await page.waitForFunction(before => mdlxlProbe().runtime.controls.object.position.toArray().some((value, index) => Math.abs(value - before[index]) > 1), cameraBefore, { timeout: 10000 });
    await page.keyboard.press('Shift+Q');
    await page.keyboard.press('j');
    assert.equal(await wiggle.getAttribute('aria-pressed'), 'false');
    await settle(page, 400);
    assert.equal(await matrices(), rest, 'Turning Wiggle off returns to the rest pose');
    assert.ok(!(await page.evaluate(() => document.title)).startsWith('*'), 'Wiggle does not modify the model');
    assert.deepEqual(fs.readFileSync(fixture), before);
    assert.deepEqual(errors.filter(error => !/Warcraft|game data|CASC/i.test(String(error))), []);
    console.log('bone wiggle ok');
  } finally { await closeApp(app); }
})().catch(error => { console.error(error); process.exit(1); });
