// Run after building; MDLXL_ELECTRON_PATH selects an isolated portable package.
// MDLXL_TEST_CASC optionally exercises a real, read-only CASC storage.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');
const { hash, decrypt, Mpq } = require('../electron/mpq.cjs');
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

// One uncompressed entry in a real MPQ v0, with encrypted hash/block tables.
function archive(name, bytes) {
  const crypt = new Uint32Array(1280); let seed = 0x100001;
  for (let i = 0; i < 256; i++) for (let j = i; j < 1280; j += 256) {
    seed = (seed * 125 + 3) % 0x2aaaab; const a = (seed & 65535) << 16;
    seed = (seed * 125 + 3) % 0x2aaaab; crypt[j] = (a | (seed & 65535)) >>> 0;
  }
  function encrypt(input, key) {
    const out = Buffer.from(input); let b = 0xeeeeeeee;
    for (let p = 0; p < out.length; p += 4) {
      b = (b + crypt[0x400 + (key & 255)]) >>> 0; const v = input.readUInt32LE(p);
      out.writeUInt32LE((v ^ (key + b)) >>> 0, p);
      key = (((~key << 21) + 0x11111111) | (key >>> 11)) >>> 0;
      b = (v + b + (b << 5) + 3) >>> 0;
    }
    return out;
  }
  const hashes = Buffer.alloc(8 * 16, 255), p = (hash(name, 0) % 8) * 16;
  hashes.writeUInt32LE(hash(name, 1), p); hashes.writeUInt32LE(hash(name, 2), p + 4);
  hashes.writeUInt32LE(0, p + 8); hashes.writeUInt32LE(0, p + 12);
  const blocks = Buffer.alloc(16); blocks.writeUInt32LE(176); blocks.writeUInt32LE(bytes.length, 4);
  blocks.writeUInt32LE(bytes.length, 8); blocks.writeUInt32LE(0x81000000, 12);
  const header = Buffer.alloc(32); header.write('MPQ\x1a', 'binary'); header.writeUInt32LE(32, 4);
  header.writeUInt32LE(176 + bytes.length, 8); header.writeUInt16LE(3, 14);
  header.writeUInt32LE(32, 16); header.writeUInt32LE(160, 20); header.writeUInt32LE(8, 24); header.writeUInt32LE(1, 28);
  const encryptedHashes = encrypt(hashes, hash('(hash table)', 3));
  assert.deepEqual(decrypt(encryptedHashes, hash('(hash table)', 3)), hashes);
  return Buffer.concat([header, encryptedHashes, encrypt(blocks, hash('(block table)', 3)), bytes]);
}

(async () => {
  const root = path.resolve(__dirname, '..'), out = path.join(root, 'out/custom-game-archives-ui');
  await fs.mkdir(out, { recursive: true });
  const profile = await fs.mkdtemp(path.join(out, 'profile-'));
  await fs.writeFile(path.join(profile, 'settings.json'), JSON.stringify({ preferences: { rendererRevision: 3, graphics: { pauseWhenHidden: false } } }));
  const name = 'Textures\\MDLxLCustomArchiveProof.png';
  const png = await fs.readFile(path.join(root, 'public/classic/wc3-bits-and-parts.png'));
  const files = ['custom-assets.mpq', 'second-assets.mpq'].map(file => path.join(out, file));
  for (const file of files) await fs.writeFile(file, archive(name, png));
  const reader = await Mpq.open(files[0]);
  try { assert.deepEqual(await reader.read(name), png); } finally { await reader.close(); }
  const { createDemoDocument } = await import('../src/editor-document.js');
  const doc = createDemoDocument();
  doc.apply('Custom archive fixture', ['Textures'], model => { model.Textures[0] = { Image: name, ReplaceableId: 0, Flags: 0 }; });
  const modelPath = path.join(out, 'custom-archive-model.mdx');
  await fs.writeFile(modelPath, doc.serialize('mdx'));
  const originalHashes = await Promise.all([...files, modelPath].map(async file => digest(await fs.readFile(file))));
  const executablePath = process.env.MDLXL_ELECTRON_PATH || path.join(root, 'node_modules/electron/dist/electron.exe');
  const packaged = !!process.env.MDLXL_ELECTRON_PATH, errors = [], result = { packaged, mpq: false, restart: false, removal: false, mouseRotation: false, casc: null };
  let app, page;
  async function launch() {
    app = await _electron.launch({ executablePath, args: packaged ? [modelPath] : [root, modelPath], cwd: root, env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: profile }, timeout: 60000 });
    page = await app.firstWindow(); page.setDefaultTimeout(25000);
    page.on('pageerror', error => errors.push(error.message));
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.setBackgroundThrottling(false));
    await page.getByRole('tab', { name: 'custom-archive-model.mdx' }).waitFor();
  }
  const settings = () => page.evaluate(async () => (await window.desktop.initial()).settings);
  const menu = action => app.evaluate(({ BrowserWindow }, value) => BrowserWindow.getAllWindows()[0].webContents.send('menu', value), action);
  async function picker(paths, canceled = false) {
    await app.evaluate(({ dialog }, answer) => { dialog.showOpenDialog = async (...args) => { globalThis.archivePickerOptions = args.at(-1); return answer; }; }, { canceled, filePaths: paths });
  }
  async function idle() { await page.waitForFunction(() => !document.querySelector('[data-warmkey="game-data:add-mpq"]')?.disabled); }
  async function asset() { return page.evaluate(async name => (await window.desktop.resolveTextures({ names: [name] })).map(record => Array.from(record.bytes)), name); }
  async function capture(file) {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const png = await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].capturePage({}, { stayHidden: true, stayAwake: true })).toPNG().toString('base64'));
    await fs.writeFile(path.join(out, file), Buffer.from(png, 'base64'));
  }
  try {
    await launch(); await menu('gameDataSettings');
    await page.getByRole('button', { name: 'Add MPQ files…', exact: true }).waitFor();
    await picker([], true); await page.getByRole('button', { name: 'Add MPQ files…', exact: true }).click(); await idle();
    assert.deepEqual((await settings()).gameDataSources, []);
    await picker(files); await page.getByRole('button', { name: 'Add MPQ files…', exact: true }).click();
    await page.locator('.game-data-path code').filter({ hasText: files[1] }).waitFor(); await idle();
    assert.deepEqual(await app.evaluate(() => archivePickerOptions.properties), ['openFile', 'multiSelections']);
    assert.equal(digest(Buffer.from((await asset())[0])), digest(png)); result.mpq = true;
    const before = (await settings()).gameDataSources;
    const invalid = path.join(out, 'invalid.mpq'); await fs.writeFile(invalid, 'not an MPQ');
    await picker([invalid]);
    await assert.rejects(page.evaluate(() => window.desktop.addGameDataSource('mpq')), /MPQ header not found/);
    assert.deepEqual((await settings()).gameDataSources, before);
    const invalidCasc = path.join(out, 'invalid-casc'); await fs.mkdir(invalidCasc, { recursive: true });
    await picker([invalidCasc]);
    await assert.rejects(page.evaluate(() => window.desktop.addGameDataSource('casc')), /containing .build.info and Data/);
    assert.deepEqual((await settings()).gameDataSources, before);
    if (process.env.MDLXL_TEST_CASC) {
      const casc = path.resolve(process.env.MDLXL_TEST_CASC);
      await picker([casc]); await page.getByRole('button', { name: 'Add CASC folder…', exact: true }).click();
      await page.locator('.game-data-path code').filter({ hasText: casc }).waitFor(); await idle();
      const native = await page.evaluate(async () => (await window.desktop.resolveTextures({ names: ['war3.w3mod:ReplaceableTextures\\TeamColor\\TeamColor00.blp'] })).map(record => Array.from(record.bytes)));
      assert.ok(native[0]?.length > 148); assert.ok(['BLP1', 'BLP2', 'DDS '].includes(Buffer.from(native[0]).toString('ascii', 0, 4)));
      assert.ok((await settings()).gameDataDiscovery.customSources.cascFolders.includes(casc));
      result.casc = casc;
    }
    await capture('settings.png');
    const savedSources = (await settings()).gameDataSources;
    assert.equal((await settings()).gameData, null);
    await app.close(); app = null; await launch(); await menu('gameDataSettings');
    await page.getByRole('button', { name: 'Add MPQ files…', exact: true }).waitFor();
    assert.deepEqual((await settings()).gameDataSources, savedSources);
    assert.equal(digest(Buffer.from((await asset())[0])), digest(png)); result.restart = true;
    for (const source of savedSources) {
      await page.getByRole('button', { name: `Remove ${source.path}`, exact: true }).click(); await idle();
    }
    assert.deepEqual((await settings()).gameDataSources, []); assert.deepEqual(await asset(), []); result.removal = true;
    await picker(files); await page.getByRole('button', { name: 'Add MPQ files…', exact: true }).click();
    await page.locator('.game-data-path code').filter({ hasText: files[1] }).waitFor(); await idle();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.locator('[data-warmkey="animation"]').click();
    await page.getByLabel('Render mode', { exact: true }).selectOption('textured');
    await page.locator('.game-preview-root').waitFor();
    await page.evaluate(() => {
      window.archivePreview = () => {
        const host = document.querySelector('.game-preview-root');
        let fiber = host[Object.keys(host).find(key => key.startsWith('__reactFiber'))];
        let top = fiber; while (top.return) top = top.return;
        if (top.stateNode.current !== top) fiber = fiber.alternate || fiber;
        for (; fiber; fiber = fiber.return) if (fiber.memoizedProps?.model?.Geosets && fiber.memoizedProps.textureAssets) {
          let camera;
          for (let hook = fiber.memoizedState; hook; hook = hook.next) if (hook.memoizedState?.current?.controls) camera = hook.memoizedState.current.controls.object.matrixWorld.elements;
          const asset = fiber.memoizedProps.textureAssets.get('textures\\mdlxlcustomarchiveproof.png');
          return { camera: camera && Array.from(camera), texturePath: fiber.memoizedProps.model.Textures[0].Image, asset: asset && Array.from(asset.bytes), assetKeys: [...fiber.memoizedProps.textureAssets.keys()] };
        }
        throw Error('Archive preview owner was not found.');
      };
    });
    await page.waitForFunction(() => !!archivePreview().camera && !!archivePreview().asset);
    const preview = await page.evaluate(() => archivePreview()); assert.equal(preview.texturePath, name);
    assert.equal(digest(Buffer.from(preview.asset)), digest(png));
    const box = await page.locator('.game-preview-root').boundingBox();
    await page.keyboard.down('Alt');
    await page.mouse.move(box.x + box.width * .7, box.y + box.height * .4); await page.mouse.down({ button: 'left' });
    await page.mouse.move(box.x + box.width * .7 + 85, box.y + box.height * .4 + 30, { steps: 8 }); await page.mouse.up({ button: 'left' });
    await page.keyboard.up('Alt');
    await page.waitForFunction(before => JSON.stringify(archivePreview().camera) !== JSON.stringify(before), preview.camera);
    assert.equal((await page.evaluate(() => archivePreview())).texturePath, name); result.mouseRotation = true;
    await capture('custom-texture-preview.png');
    assert.deepEqual(errors, []);
    assert.deepEqual(await Promise.all([...files, modelPath].map(async file => digest(await fs.readFile(file)))), originalHashes);
    await fs.writeFile(path.join(out, 'result.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
  } finally { await app?.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
