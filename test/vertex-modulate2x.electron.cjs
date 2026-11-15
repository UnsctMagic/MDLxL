// Vertices -> Textured View draws a Modulate 2x layer the way the game preview does (owner, 14 Nov 2026:
// Baron Rivendare's horse legs and tail were silver-white in Vertices, dark in Animations/Movement/Bones).
// The legs use HeroDeathknight (None) + the dark-gray TeamColor24 at Modulate 2x, so the second layer must
// darken the legs (2 x 46/255 x base), never brighten them.
// Needs the installed Warcraft III for the game textures (MDLVIS_GAME_DATA, else gameFolder()).
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { launchApp, closeApp } = require('./helpers/app.cjs');
const { fixturePath, gameFolder, tempDir } = require('./helpers/fixtures.cjs');
const { PNG } = require(path.join(path.dirname(require.resolve(process.env.MDLXL_REAL_PLAYWRIGHT || 'playwright-core')), 'lib/utilsBundle.js'));

const MODULATE_TEXTURE = 29; // ReplaceableTextures\TeamColor\TeamColor24.blp

async function texturedVertices(file, out, game) {
  const { app, page, errors } = await launchApp({ out, fixture: file, env: { MDLVIS_GAME_DATA: game }, bounds: { x: -3000, y: 0, width: 1280, height: 920 }, show: 'inactive', timeout: 90000, pageTimeout: 60000 });
  try {
    const viewport = page.getByLabel('3D model viewport', { exact: true }).first();
    await viewport.waitFor();
    await page.getByLabel('Render mode', { exact: true }).selectOption('textured');
    // Read-only: wait until the viewport has decoded the base and the Modulate 2x textures.
    await page.waitForFunction(index => {
      const el = document.querySelector('[aria-label="3D model viewport"]'), key = el && Object.keys(el).find(k => k.startsWith('__reactFiber'));
      for (let fiber = key && el[key]; fiber; fiber = fiber.return) for (let hook = fiber.memoizedState; hook && typeof hook === 'object' && 'next' in hook; hook = hook.next) {
        const state = hook.memoizedState?.current;
        if (state?.entries && state?.textures instanceof Map) return state.textures.has(1) && state.textures.has(index);
      }
      return false;
    }, MODULATE_TEXTURE, { timeout: 60000 });
    // Settled: two captures in a row are identical.
    let previous = await viewport.screenshot(), current;
    for (let attempt = 0; attempt < 40; attempt++) {
      current = await viewport.screenshot();
      if (current.equals(previous)) break;
      previous = current;
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 50)));
    }
    assert.ok(current.equals(previous), 'the textured viewport never settled');
    assert.deepEqual(errors, []);
    return PNG.sync.read(current);
  } finally { await closeApp(app); }
}

(async () => {
  const source = fixturePath('vertex-modulate2x');
  const out = tempDir('vertex-modulate2x-'), game = process.env.MDLVIS_GAME_DATA || await gameFolder();
  const { openDocument } = await import('../src/editor-document.js');
  const bytes = fs.readFileSync(source), doc = openDocument(new Uint8Array(bytes), 'Baron Rivendare.mdx');
  const layers = doc.model.Materials[0].Layers;
  assert.equal(layers.length, 2); assert.equal(layers[1].FilterMode, 6); assert.equal(layers[1].TextureID, MODULATE_TEXTURE);
  // Disposable copies: the owner's model, and the same model without its Modulate 2x layer.
  const withModulate = path.join(out, 'TEST MODULATE2X 01.mdx'), baseOnly = path.join(out, 'TEST MODULATE2X 02.mdx');
  fs.writeFileSync(withModulate, bytes);
  doc.apply('Drop the Modulate 2x layer', ['Materials'], model => { model.Materials[0].Layers = [model.Materials[0].Layers[0]]; });
  fs.writeFileSync(baseOnly, doc.serialize('mdx'));

  const a = await texturedVertices(withModulate, out, game), b = await texturedVertices(baseOnly, out, game);
  assert.equal(a.width, b.width); assert.equal(a.height, b.height);
  // Pixels the Modulate 2x layer changes are the legs and tail; compare their mean brightness.
  let count = 0, sumA = 0, sumB = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    const difference = Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]);
    if (difference <= 24) continue;
    count++; sumA += a.data[i] + a.data[i + 1] + a.data[i + 2]; sumB += b.data[i] + b.data[i + 1] + b.data[i + 2];
  }
  const meanA = sumA / count / 3, meanB = sumB / count / 3;
  const result = { pixels: count, withModulate2x: +meanA.toFixed(1), withoutModulate2x: +meanB.toFixed(1) };
  console.log(JSON.stringify(result));
  assert.ok(count > 500, `the Modulate 2x layer changed only ${count} pixels`);
  // 2 x 46/255 = 0.36 of the base colour; allow generous room for lighting and filtering.
  assert.ok(meanA < meanB * .6, `Modulate 2x with the dark TeamColor24 must darken the legs: ${JSON.stringify(result)}`);
  fs.rmSync(out, { recursive: true, force: true });
})().catch(error => { console.error(error); process.exitCode = 1; });
