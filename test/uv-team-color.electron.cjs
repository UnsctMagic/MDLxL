// Run the rebuilt portable package with a separate profile and synthetic textures.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const out = process.env.MDLXL_TEST_OUT || path.join(root, 'out/uv-team-color-test');
const executable = process.env.MDLXL_TEST_EXE || path.join(root, 'out/uv-team-color-package/MDLxL-win32-x64/MDLxL.exe');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

async function fixture() {
  fs.mkdirSync(out, { recursive: true });
  const bytes = Buffer.alloc(18 + 32 * 32 * 4);
  bytes[2] = 2; bytes.writeUInt16LE(32, 12); bytes.writeUInt16LE(32, 14); bytes[16] = 32; bytes[17] = 40;
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const alpha = x < 16 ? 0 : y < 16 ? 128 : 255;
    bytes.set([120, 80, 40, alpha], 18 + (y * 32 + x) * 4);
  }
  fs.writeFileSync(path.join(out, 'Skin.tga'), bytes);
  const { createDemoDocument } = await import('../src/editor-document.js');
  const doc = createDemoDocument();
  doc.apply('UV team-color fixture', ['Materials', 'Textures', 'GeosetAnims'], model => {
    model.Textures.push({ Image: 'Skin.tga', ReplaceableId: 0, Flags: 3 }, { Image: '', ReplaceableId: 2, Flags: 0 });
    const team = { TextureID: 0, FilterMode: 0, Shading: 17, Alpha: 1, CoordId: 0, TVertexAnimId: null };
    const skin = { ...team, TextureID: 1, FilterMode: 2 };
    model.Materials[0].Layers = [team, skin];
    model.Materials[1].Layers = [{ ...team }];
    model.Materials[2].Layers = [skin];
    model.Materials[3].Layers = [{ ...team, TextureID: 2, FilterMode: 4 }];
    for (const anim of model.GeosetAnims) { anim.Color = new Float32Array([1, 1, 1]); anim.Alpha = 1; }
  });
  const input = path.join(out, 'UVTeamColor.mdx'); fs.writeFileSync(input, doc.serialize('mdx'));
  return input;
}

const runtime = () => {
  const element = document.querySelector('.game-preview-root');
  let fiber = element[Object.keys(element).find(key => key.startsWith('__reactFiber'))];
  for (; fiber; fiber = fiber.return) for (let hook = fiber.memoizedState; hook; hook = hook.next) {
    const state = hook.memoizedState?.current;
    if (state?.native && state.controls) return {
      camera: Array.from(state.controls.object.matrixWorld.elements),
      team: Array.from(state.native.rendererData.teamColor),
      model: JSON.parse(JSON.stringify(state.native.model)),
    };
  }
  return null;
};

async function backdrop(page) {
  return page.getByLabel('UV coordinate editor').evaluate(async element => {
    let fiber = element[Object.keys(element).find(key => key.startsWith('__reactFiber'))];
    let top = fiber; while (top.return) top = top.return;
    const find = node => {
      if (node.memoizedProps?.textureUrl) for (let hook = node.memoizedState; hook; hook = hook.next) {
        if (hook.memoizedState?.current === element) return node;
      }
      for (let child = node.child; child; child = child.sibling) { const found = find(child); if (found) return found; }
      return null;
    };
    fiber = find(top.stateNode.current);
    if (!fiber) return null;
    const image = new Image(); image.src = fiber.memoizedProps.textureUrl; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
    const pixel = (u, v) => Array.from(context.getImageData(Math.floor(u * image.width), Math.floor(v * image.height), 1, 1).data);
    return { clear: pixel(.25, .25), half: pixel(.75, .25), opaque: pixel(.75, .75), center: pixel(.5, .5) };
  });
}

async function waitFor(check, label) {
  for (let i = 0; i < 150; i++) { const value = await check(); if (value) return value; await new Promise(resolve => setTimeout(resolve, 100)); }
  throw Error('Timed out: ' + label);
}

async function visibleCanvas(page, team) {
  return waitFor(() => page.getByLabel('UV coordinate editor').evaluate((canvas, team) => {
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let teamPixels = 0, skinPixels = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] === team[0] && pixels[i + 1] === team[1] && pixels[i + 2] === team[2]) teamPixels++;
      if (pixels[i] === 40 && pixels[i + 1] === 80 && pixels[i + 2] === 120) skinPixels++;
    }
    return teamPixels > 100 && skinPixels > 100 ? { teamPixels, skinPixels } : null;
  }, team), 'team color and skin actually drawn on visible canvas');
}

(async () => {
  const input = await fixture(), original = hash(input), skinHash = hash(path.join(out, 'Skin.tga'));
  const app = await _electron.launch({ executablePath: executable, args: ['--disable-backgrounding-occluded-windows', input],
    env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: path.join(out, 'profile-' + Date.now()) }, timeout: 60000 });
  const errors = []; let uv;
  try {
    const main = await app.firstWindow(); main.setDefaultTimeout(20000); main.on('pageerror', error => errors.push(error.message));
    await app.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0]; window.webContents.setBackgroundThrottling(false);
      window.setBounds({ x: 40, y: 40, width: 1600, height: 950 }); window.showInactive();
    });
    await main.getByLabel('Select geoset 0', { exact: true }).waitFor({ timeout: 60000 });
    await main.getByLabel('Team color', { exact: true }).selectOption('#ff0303');
    for (let i = 0; i < 5; i++) await main.getByLabel(`Select geoset ${i}`, { exact: true }).check();
    await main.getByLabel('3D model viewport', { exact: true }).click(); await main.keyboard.press('Control+a');
    const opened = app.waitForEvent('window'); await main.locator('[data-warmkey="uv"]').click(); uv = await opened;
    uv.setDefaultTimeout(20000); uv.on('pageerror', error => errors.push(error.message));
    await uv.getByLabel('UV coordinate editor').waitFor({ timeout: 60000 });
    await app.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows().find(window => window.webContents.getURL() === 'about:blank');
      window.webContents.setBackgroundThrottling(false); window.setBounds({ x: 80, y: 60, width: 1600, height: 950 }); window.showInactive();
    });
    let materials = uv.getByLabel('UV material', { exact: true });
    await materials.selectOption('0');
    const red = await waitFor(async () => { const pixels = await backdrop(uv); return pixels?.clear[0] === 255 && pixels.clear[1] === 3 && pixels; }, 'red team color in layered canvas');
    assert.deepEqual(red.clear, [255, 3, 3, 255]); assert.deepEqual(red.half, [147, 42, 62, 255]); assert.deepEqual(red.opaque, [40, 80, 120, 255]);
    await uv.locator('.uv-texture-caption').filter({ hasText: '2 rendered layers' }).waitFor();
    await waitFor(() => uv.evaluate(runtime), 'native preview'); const before = await uv.evaluate(runtime);
    assert.ok(Math.abs(before.team[0] - 1) < .001);
    const bounds = await uv.locator('.game-preview-root').boundingBox();
    await uv.mouse.move(bounds.x + bounds.width * .55, bounds.y + bounds.height * .55); await uv.mouse.down();
    await uv.mouse.move(bounds.x + bounds.width * .75, bounds.y + bounds.height * .65, { steps: 12 }); await uv.mouse.up();
    await waitFor(async () => JSON.stringify((await uv.evaluate(runtime)).camera) !== JSON.stringify(before.camera), 'normal mouse drag rotates preview');
    const redCanvas = await visibleCanvas(uv, [255, 3, 3]); await uv.screenshot({ path: path.join(out, 'red.png') });
    const closed = uv.waitForEvent('close'); await uv.getByRole('button', { name: 'Exit UV Wrapper', exact: true }).click(); await closed;
    await main.getByLabel('Team color', { exact: true }).selectOption('#0042ff');
    const reopened = app.waitForEvent('window'); await main.locator('[data-warmkey="uv"]').click(); uv = await reopened;
    uv.setDefaultTimeout(20000); uv.on('pageerror', error => errors.push(error.message));
    await uv.getByLabel('UV coordinate editor').waitFor({ timeout: 60000 });
    await app.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows().find(window => window.webContents.getURL() === 'about:blank');
      window.webContents.setBackgroundThrottling(false); window.setBounds({ x: 80, y: 60, width: 1600, height: 950 }); window.showInactive();
    });
    materials = uv.getByLabel('UV material', { exact: true }); await materials.selectOption('0');
    const blue = await waitFor(async () => { const pixels = await backdrop(uv); return pixels?.clear[2] === 255 && pixels.clear[0] === 0 && pixels; }, 'blue team color in layered canvas');
    assert.deepEqual(blue.clear, [0, 66, 255, 255]); assert.deepEqual(blue.half, [20, 73, 187, 255]); assert.deepEqual(blue.opaque, red.opaque);
    await waitFor(async () => Math.abs((await uv.evaluate(runtime)).team[2] - 1) < .001, 'blue team color in native preview');
    const blueCanvas = await visibleCanvas(uv, [0, 66, 255]); await uv.screenshot({ path: path.join(out, 'blue.png') });
    await materials.selectOption('1');
    assert.deepEqual((await waitFor(async () => { const pixels = await backdrop(uv); return pixels?.opaque[2] === 255 && pixels; }, 'team-color-only canvas')).opaque, [0, 66, 255, 255]);
    await materials.selectOption('2');
    const plain = await waitFor(async () => { const pixels = await backdrop(uv); return pixels?.clear[3] === 0 && pixels; }, 'ordinary texture alpha');
    assert.deepEqual(plain.opaque, [40, 80, 120, 255]); assert.equal(plain.half[3], 128);
    await materials.selectOption('3');
    const glow = await waitFor(async () => { const pixels = await backdrop(uv); return pixels?.center[3] > 100 && pixels.center[3] < 255 && pixels; }, 'team glow');
    assert.ok(glow.center[2] > glow.center[1]);
    assert.deepEqual((await uv.evaluate(runtime)).model, before.model, 'viewing, changing team color and rotating preserve the live model');
    assert.equal(hash(input), original); assert.equal(hash(path.join(out, 'Skin.tga')), skinHash); assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'verification.json'), JSON.stringify({ executable, red, blue, redCanvas, blueCanvas, plain, glow, mouseDragRotation: true, fixtureSHA256: original, skinSHA256: skinHash, rendererErrors: errors }, null, 2));
    console.log('PASS packaged UV team color: red/blue layered and pure color, image RGB/alpha, team glow, mouse rotation, unchanged model and fixture.');
  } catch (error) {
    if (uv) {
      await uv.screenshot({ path: path.join(out, 'failure.png') });
      fs.writeFileSync(path.join(out, 'failure.json'), JSON.stringify({ backdrop: await backdrop(uv), runtime: await uv.evaluate(runtime) }, null, 2));
    }
    throw error;
  } finally { await app.evaluate(({ app }) => app.exit(0)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
