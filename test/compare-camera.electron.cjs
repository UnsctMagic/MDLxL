// Run through scripts/run-packaged-tests.mjs: real mouse input on the hidden desktop.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { launchApp, prepareWindow, closeApp, bundleHashes } = require('./helpers/app.cjs');
const { fixturePath } = require('./helpers/fixtures.cjs');

const out = path.resolve('out/compare-camera');
const checks = [];
const tolerance = 1e-5;

// Read the live cameras; never drive controls or React state through the probe.
async function inspectPair(page, selector) {
  await page.evaluate(selector => {
    const runtimes = new WeakMap();
    let nextRuntime = 0;
    window.compareCameras = () => [...document.querySelectorAll(selector)].map(root => {
      const { runtime, props } = mdlxlProbe(root);
      if (!runtime || !props) return null;
      const camera = runtime.controls.object;
      if (!runtimes.has(runtime)) runtimes.set(runtime, ++nextRuntime);
      return {
        values: [...camera.position.toArray(), ...camera.quaternion.toArray(), ...camera.up.toArray(), ...runtime.controls.target.toArray(), camera.zoom, camera.fov ?? 0],
        revision: props.revision,
        runtimeId: runtimes.get(runtime),
      };
    });
  }, selector);
  await page.waitForFunction(() => compareCameras().length === 2 && compareCameras().every(Boolean));
  const pair = await page.evaluate(() => compareCameras());
  assertPaired(pair, 'initial framing');
}

function assertPaired(pair, label) {
  pair[0].values.forEach((value, i) => assert.ok(Math.abs(value - pair[1].values[i]) < tolerance,
    `${label}: camera component ${i}: ${value} vs ${pair[1].values[i]}`));
}
function assertKept(pair, previous, label) {
  assertPaired(pair, label);
  for (const side of pair) side.values.forEach((value, i) => assert.ok(Math.abs(value - previous[i]) < tolerance, `${label}: camera component ${i} moved`));
}

async function drag(page, canvases, side, button = 'left') {
  const previous = await page.evaluate(side => compareCameras()[side].values, side);
  const box = await canvases.nth(side).boundingBox();
  const start = { x: box.x + box.width * .4, y: box.y + box.height * .45 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down({ button });
  try {
    // Assert after each move while the mouse is STILL DOWN: mouse-up-only sync fails.
    for (let step = 1; step <= 3; step++) {
      const beforeStep = await page.evaluate(side => compareCameras()[side].values, side);
      await page.mouse.move(start.x + step * box.width * .07, start.y + step * box.height * .035, { steps: 3 });
      await page.waitForFunction(({ side, beforeStep }) => compareCameras()[side].values.some((v, i) => Math.abs(v - beforeStep[i]) > 1e-4), { side, beforeStep });
      const pair = await page.evaluate(() => compareCameras());
      assertPaired(pair, `${button} drag from ${side ? 'right' : 'left'}, held step ${step}`);
    }
  } finally { await page.mouse.up({ button }); }
  const pair = await page.evaluate(() => compareCameras());
  assertPaired(pair, 'released drag');
  assert.ok(pair[side].values.some((v, i) => Math.abs(v - previous[i]) > 1e-4), 'mouse navigation changed the camera');
}

async function exercise(page, selector, label) {
  await inspectPair(page, selector);
  // Target the native model canvas rather than its background or overlays.
  const views = page.locator(selector + ' canvas[data-clean-model-canvas]');
  assert.equal(await views.count(), 2);
  await drag(page, views, 0);
  await drag(page, views, 1);
  await drag(page, views, 0, 'right');
  await drag(page, views, 1, 'right');
  for (const side of [0, 1]) {
    const before = await page.evaluate(side => compareCameras()[side].values, side);
    const box = await views.nth(side).boundingBox();
    await page.mouse.move(box.x + box.width * .5, box.y + box.height * .5);
    await page.mouse.wheel(0, -160);
    await page.waitForFunction(({ side, before }) => compareCameras()[side].values.some((v, i) => Math.abs(v - before[i]) > 1e-4), { side, before });
    assertPaired(await page.evaluate(() => compareCameras()), `wheel zoom from side ${side}`);
  }
  checks.push(`${label}: equal initial framing; live left/right rotation and pan while held; wheel zoom from either side`);
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const { app, page, errors } = await launchApp({
    out, fixture: fixturePath('citadel-footman'), args: ['--disable-gpu-vsync', '--disable-frame-rate-limit'],
    bounds: { x: -3000, y: 0, width: 1600, height: 1000 }, pageTimeout: 30000,
    settings: { preferences: { cameraBindings: { right: 'pan', middle: 'toggle' }, rightScrollAdjust: false } },
  });
  try {
    await page.getByTitle(/^OptimizeXL(\nHotkey: .+)?$/).waitFor();
    const opened = app.waitForEvent('window');
    await page.getByTitle(/^OptimizeXL(\nHotkey: .+)?$/).click();
    const optimize = await opened;
    await prepareWindow(app, optimize, { bounds: { x: -3500, y: 0, width: 1600, height: 1000 }, errors, pageTimeout: 30000 });
    await optimize.getByRole('navigation', { name: 'Optimization stages' }).getByRole('button', { name: 'Duplicate data', exact: true }).click();
    await optimize.waitForFunction(() => !document.querySelector('[aria-label="After preview"] h2').textContent.includes('Updating'));
    await exercise(optimize, '.ox-preview .game-preview-root', 'OptimizeXL');
    const before = await optimize.evaluate(() => compareCameras());
    await optimize.getByRole('navigation', { name: 'Optimization stages' }).getByRole('button', { name: 'Unused data', exact: true }).click();
    await optimize.waitForFunction(revision => compareCameras()[1]?.revision !== revision && !document.querySelector('[aria-label="After preview"] h2').textContent.includes('Updating'), before[1].revision);
    const rebuilt = await optimize.evaluate(() => compareCameras());
    assert.notEqual(rebuilt[1].runtimeId, before[1].runtimeId, 'After renderer was actually replaced');
    assertKept(rebuilt, before[0].values, 'OptimizeXL After rebuild');
    await drag(optimize, optimize.locator('.ox-preview canvas[data-clean-model-canvas]'), 1);
    checks.push('OptimizeXL: After revision rebuild keeps both cameras and right-side mouse rotation');
    const closed = optimize.waitForEvent('close');
    await optimize.getByRole('button', { name: 'Close', exact: true }).click();
    await closed;

    await page.getByRole('button', { name: 'Managers', exact: true }).click();
    await page.getByRole('button', { name: 'Sort My Mess', exact: true }).click();
    await page.getByRole('dialog', { name: 'Sort My Mess', exact: true }).waitFor();
    await exercise(page, '.smm-previews .game-preview-root', 'Sort My Mess');
    await page.getByRole('dialog', { name: 'Sort My Mess', exact: true }).getByRole('button', { name: 'Close', exact: true }).click();

    await page.locator('[data-hotkey="animation"]').click();
    await page.locator('button.animxl-tool, [data-hotkey="animXL"]').first().click();
    const anim = page.getByRole('dialog', { name: 'AnimXL', exact: true });
    await anim.getByRole('button', { name: 'Side by side', exact: true }).click();
    await exercise(page, '.ax-compare .game-preview-root', 'AnimXL');
    await anim.getByRole('button', { name: 'Side by side', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('.ax-compare'));
    await anim.getByRole('button', { name: 'Side by side', exact: true }).click();
    await inspectPair(page, '.ax-compare .game-preview-root');
    await drag(page, page.locator('.ax-compare canvas[data-clean-model-canvas]'), 1);
    checks.push('AnimXL: closing/reopening the pair keeps matching framing and right-side mouse rotation');
    await anim.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.deepEqual(errors, []);
  } catch (error) {
    for (const [i, window] of app.windows().entries()) fs.writeFileSync(path.join(out, 'failure-' + i + '.txt'), await window.locator('body').innerText());
    errors.push(error.message);
    throw error;
  } finally {
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ checks, errors, bundle: bundleHashes() }, null, 2));
    await closeApp(app);
  }
  console.log(checks.join('\n'));
})().catch(error => { console.error(error); process.exitCode = 1; });
