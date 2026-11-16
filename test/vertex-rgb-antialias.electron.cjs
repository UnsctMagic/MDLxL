// Vertices shows the same colours with anti-aliasing on as off (owner, 16 Nov 2026: "RGB does not appear the
// same" — Baron Rivendare's red was orange and washed out in Vertices next to Animations). With anti-aliasing on,
// Vertices drew the model into a linear buffer, so the geoset RGB and Blend layers mixed linear colours and the
// screen copy encoded them afterwards. Animations (war3-model) and the game mix encoded colours; anti-aliasing off
// draws straight to the screen and already did. Only edge pixels may differ (that is the smoothing itself).
// Needs the installed Warcraft III for the game textures (MDLVIS_GAME_DATA, else gameFolder()).
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { launchApp, closeApp } = require('./helpers/app.cjs');
const { fixturePath, gameFolder, tempDir } = require('./helpers/fixtures.cjs');
const { PNG } = require(path.join(path.dirname(require.resolve(process.env.MDLXL_REAL_PLAYWRIGHT || 'playwright-core')), 'lib/utilsBundle.js'));

const graphics = antialias => ({ pixelRatio: 1, antialias, maxFps: 60, textures: true, lighting: true, particles: false, pauseWhenHidden: true, softwareLow: false });

async function texturedVertices(file, out, game, antialias) {
  const { app, page, errors } = await launchApp({ out, fixture: file, env: { MDLVIS_GAME_DATA: game }, settings: { preferences: { graphics: graphics(antialias) } },
    bounds: { x: -3000, y: 0, width: 1280, height: 920 }, show: 'inactive', timeout: 90000, pageTimeout: 60000 });
  try {
    const viewport = page.getByLabel('3D model viewport', { exact: true }).first();
    await viewport.waitFor();
    // Vertices opens with RGB on (649e506d); the user picks Textured View.
    await page.getByLabel('Render mode', { exact: true }).selectOption('textured');
    // Settled: textures decoded and two captures in a row identical.
    let previous = await viewport.screenshot(), current;
    for (let attempt = 0; attempt < 80; attempt++) {
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 150)));
      current = await viewport.screenshot();
      if (current.equals(previous) && attempt > 10) break;
      previous = current;
    }
    assert.ok(current.equals(previous), 'the textured viewport never settled');
    assert.deepEqual(errors, []);
    return PNG.sync.read(current);
  } finally { await closeApp(app); }
}

(async () => {
  const source = fixturePath('vertex-rgb-match');
  const out = tempDir('vertex-rgb-antialias-'), game = process.env.MDLVIS_GAME_DATA || await gameFolder();
  const file = path.join(out, 'TEST RGB MATCH 01.mdx');
  fs.copyFileSync(source, file);
  for (const name of fs.readdirSync(path.dirname(source))) if (/\.blp$/i.test(name)) fs.copyFileSync(path.join(path.dirname(source), name), path.join(out, name));

  const smooth = await texturedVertices(file, out, game, true), plain = await texturedVertices(file, out, game, false);
  assert.equal(smooth.width, plain.width); assert.equal(smooth.height, plain.height);
  // Interior model pixels: the pixel and its 8 neighbours are model in both captures (not the 204 grey backdrop).
  const backdrop = (png, i) => Math.abs(png.data[i] - 204) < 4 && Math.abs(png.data[i + 1] - 204) < 4 && Math.abs(png.data[i + 2] - 204) < 4;
  let pixels = 0, differing = 0, reds = 0; const red = [0, 0, 0, 0, 0, 0];
  for (let y = 80; y < smooth.height - 1; y++) for (let x = 1; x < smooth.width - 1; x++) {
    let interior = true;
    for (let dy = -1; dy <= 1 && interior; dy++) for (let dx = -1; dx <= 1; dx++) {
      const j = ((y + dy) * smooth.width + x + dx) * 4;
      if (backdrop(smooth, j) || backdrop(plain, j)) { interior = false; break; }
    }
    if (!interior) continue;
    const i = (y * smooth.width + x) * 4;
    pixels++;
    if (Math.max(...[0, 1, 2].map(c => Math.abs(smooth.data[i + c] - plain.data[i + c]))) > 12) differing++;
    if (plain.data[i] > plain.data[i + 1] + 40) { reds++; for (let c = 0; c < 3; c++) { red[c] += smooth.data[i + c]; red[c + 3] += plain.data[i + c]; } }
  }
  const mean = values => values.map(value => +(value / reds).toFixed(1));
  const result = { pixels, differing, share: +(differing / pixels).toFixed(3), redSmooth: mean(red.slice(0, 3)), redPlain: mean(red.slice(3)) };
  console.log(JSON.stringify(result));
  assert.ok(pixels > 20000 && reds > 5000, `too little of the model was compared: ${JSON.stringify(result)}`);
  // Before the fix: share 0.323, smoothed red [101.8, 28.7, 18.9] against [100.5, 19.2, 12.1]. After: 0.031, edges only.
  for (let c = 0; c < 3; c++) assert.ok(Math.abs(result.redSmooth[c] - result.redPlain[c]) < 3, `anti-aliasing changes the red: ${JSON.stringify(result)}`);
  assert.ok(result.share < .08, `anti-aliasing changes the colours of the model's surfaces: ${JSON.stringify(result)}`);
  fs.rmSync(out, { recursive: true, force: true });
})().catch(error => { console.error(error); process.exitCode = 1; });
