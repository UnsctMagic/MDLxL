// Tests only a disposable packaged executable/profile and copied model files.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
(async () => {
  const { openDocument } = await import('../src/editor-document.js');
  const { sampleGeosetAnimation, sampleNodeMatrices, skinGeoset, sampleTrack } = await import('../src/animation.js');
  const { assertModelEquivalent } = await import('../src/save-equivalence.js');
  const { ObjectLoader } = await import('three');
  const { projectPoseHandles } = await import('../app/pose-overlay.js');
  const out = path.resolve('out/importer-ui'), destination = path.join(out, 'input/destination.mdx'), source = path.join(out, 'input/source.mdx');
  const exe = process.env.MDLXL_IMPORTER_EXE, errors = [], checks = [], inputHashes = [destination, source].map(file => hash(fs.readFileSync(file)));
  const app = await _electron.launch({ executablePath: exe, args: [destination, '--disable-backgrounding-occluded-windows'], env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: path.join(out, 'profile-' + Date.now()) }, timeout: 60000 });
  try {
    const page = await app.firstWindow(); page.setDefaultTimeout(25000); page.on('pageerror', error => errors.push(error.message));
    await app.evaluate(({ BrowserWindow, dialog }, source) => { const win = BrowserWindow.getAllWindows()[0]; win.webContents.setBackgroundThrottling(false); win.setBounds({ x: -3000, y: 0, width: 1280, height: 920 }); win.showInactive(); dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [source] }); }, source);
    await page.locator('[data-warmkey="animation"]').click(); await page.getByLabel('Movement current sequence').selectOption('0');
    await page.evaluate(() => {
      window.importOwner = () => {
        const root = document.querySelector('.game-preview-root');
        for (let fiber = root?.[Object.keys(root).find(key => key.startsWith('__reactFiber'))]; fiber; fiber = fiber.return) for (let hook = fiber.memoizedState; hook; hook = hook.next) { const state = hook.memoizedState; if (state?.doc?.model && state.assets) return state; }
        throw Error('Packaged document is not ready');
      };
      window.importView = index => {
        const root = document.querySelectorAll('.animation-import-preview .game-preview-root')[index]; let runtime, props;
        for (let fiber = root?.[Object.keys(root).find(key => key.startsWith('__reactFiber'))]; fiber; fiber = fiber.return) { if (fiber.memoizedProps?.poseConfig && fiber.memoizedProps?.model) props ||= fiber.memoizedProps; for (let hook = fiber.memoizedState; hook; hook = hook.next) { const ref = hook.memoizedState?.current; if (ref?.native && ref.controls) runtime = ref; } if (runtime && props) return { runtime, props }; }
        throw Error('Importer renderer is not ready');
      };
      window.importBytes = format => Array.from(importOwner().doc.serialize(format));
    });
    await page.waitForFunction(() => { try { return !!importOwner().doc.model; } catch { return false; } });
    const bytes = async (format = 'mdx') => Buffer.from(await page.evaluate(format => importBytes(format), format));
    const snapshot = async () => ({ hash: hash(await bytes()), history: await page.evaluate(() => importOwner().doc.historyStats.undoSteps) });
    const before = await snapshot(), original = openDocument(await bytes(), 'original.mdx').model;
    const sidebarWidth = await page.locator('.classic-sidebar').evaluate(element => element.getBoundingClientRect().width);
    const open = async () => { await page.getByRole('button', { name: 'import anination', exact: true }).click(); await page.getByRole('dialog', { name: 'Animation Importer' }).waitFor(); await page.getByRole('button', { name: 'Select model', exact: true }).click(); await page.getByLabel('Imported animation', { exact: true }).waitFor(); await page.getByLabel('Imported animation', { exact: true }).selectOption('6'); await page.waitForFunction(() => { try { return [0, 1].every(index => importView(index).runtime.captureApi?.isReady); } catch { return false; } }); };
    const answerObjects = async includeSpark => { const rows = page.locator('.animation-import-objects > div'); for (let index = 0; index < await rows.count(); index++) { const row = rows.nth(index), text = await row.innerText(); await row.getByRole('button', { name: includeSpark && text.includes('Test Sparks') ? 'Yes' : 'No', exact: true }).click(); } };
    await open(); checks.push('Exact Movement button opens two POSE skeletons');
    assert.equal(await page.locator('.animation-import-models .game-preview-root').count(), 2);
    assert.equal(await page.getByRole('button', { name: 'Import animation', exact: true }).isDisabled(), true, 'extra-object questions require answers');
    await answerObjects(false);
    for (const index of [0, 1]) {
      const camera = await page.evaluate(index => importView(index).runtime.controls.object.quaternion.toArray(), index), box = await page.locator('.animation-import-preview [data-clean-model-canvas]').nth(index).boundingBox();
      await page.keyboard.down('Alt'); await page.mouse.move(box.x + box.width * .7, box.y + box.height * .4); await page.mouse.down(); await page.mouse.move(box.x + box.width * .7 + 60, box.y + box.height * .4 + 35, { steps: 8 }); await page.mouse.up(); await page.keyboard.up('Alt');
      const next = await page.evaluate(index => importView(index).runtime.controls.object.quaternion.toArray(), index); assert.ok(next.some((value, id) => Math.abs(value - camera[id]) > .001), `actual camera rotation in view ${index}`);
    }
    checks.push('Both packaged previews rotate with actual Alt+mouse drags');
    for (const index of [0, 1]) {
      const rendered = await page.evaluate(index => { const canvas = importView(index).runtime.captureApi.captureFrame(), pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data; let modelPixels = 0; for (let offset = 0; offset < pixels.length; offset += 4) if ([0, 1, 2].some(channel => Math.abs(pixels[offset + channel] - pixels[channel]) > 12)) modelPixels++; return { pixels: modelPixels, png: canvas.toDataURL('image/png') }; }, index);
      assert.ok(rendered.pixels > 1000, `actual native model pixels in preview ${index}`); fs.writeFileSync(path.join(out, `native-${index}.png`), Buffer.from(rendered.png.split(',')[1], 'base64'));
    }
    checks.push('Both native textured meshes render independently of POSE overlays');
    fs.writeFileSync(path.join(out, 'side-by-side.png'), await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.capturePage().then(image => image.toPNG())));
    // Click a POSE label in the source and verify its real native identity.
    const data = await page.evaluate(() => { const view = importView(1), canvas = document.querySelectorAll('.animation-import-preview [data-clean-model-canvas]')[1]; return { model: view.props.model, config: view.props.poseConfig, frame: view.runtime.native.getFrame(), sequence: view.props.sequenceIndex, camera: view.runtime.controls.object.toJSON(), width: canvas.clientWidth, height: canvas.clientHeight }; });
    const camera = new ObjectLoader().parse(data.camera); camera.updateMatrixWorld(true);
    const handle = projectPoseHandles(data.model, data.config, data.frame, data.sequence, camera, data.width, data.height).find(handle => handle.kind === 'endpoint' && handle.visible && !handle.marker);
    assert.ok(handle, 'recognized limb handle'); const sourceBox = await page.locator('.animation-import-preview [data-clean-model-canvas]').nth(1).boundingBox();
    await page.mouse.click(sourceBox.x + handle.labelX + 3, sourceBox.y + handle.labelY);
    assert.deepEqual(await page.evaluate(() => importView(1).props.selectedNodeIds), [handle.chain.end]); checks.push('POSE handle selects the real source endpoint for matching');
    await page.getByRole('dialog', { name: 'Animation Importer' }).getByRole('button', { name: 'Play', exact: true }).click(); const frameBefore = await page.getByLabel('Imported animation frame').inputValue(); await page.waitForFunction(before => document.querySelector('[aria-label="Imported animation frame"]').value !== before, frameBefore); await page.getByRole('dialog', { name: 'Animation Importer' }).getByRole('button', { name: 'Pause', exact: true }).click();
    checks.push('Source animation playback advances the retargeted preview');
    assert.deepEqual(await snapshot(), before, 'preview does not mutate destination');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click(); assert.deepEqual(await snapshot(), before); checks.push('Cancel preserves native model and history');
    await open(); await answerObjects(false); await page.getByLabel('Replace which animation?').selectOption('0');
    await page.getByRole('button', { name: 'Import animation', exact: true }).click(); await page.getByRole('dialog', { name: 'Animation Importer' }).waitFor({ state: 'hidden' });
    const replacementBytes = await bytes(), replaced = openDocument(replacementBytes, 'replace.mdx').model;
    assert.equal(replaced.Sequences.length, original.Sequences.length); assert.equal(replaced.Sequences[0].Name, original.Sequences[0].Name); assert.deepEqual(replaced.Sequences[0].Interval, original.Sequences[0].Interval); assert.deepEqual(replaced.GeosetAnims, original.GeosetAnims);
    const oldVertices = skinGeoset(original.Geosets[0], sampleNodeMatrices(original, 917, 0)), moved = skinGeoset(replaced.Geosets[0], sampleNodeMatrices(replaced, 917, 0)); assert.ok(moved.some((value, index) => Math.abs(value - oldVertices[index]) > .01));
    assert.equal((await snapshot()).history, before.history + 1); checks.push('Replace changes the real destination mesh and keeps selected duration/RGB/visibility in one Undo');
    const menu = command => app.evaluate(({ BrowserWindow }, command) => BrowserWindow.getAllWindows()[0].webContents.send('menu', command), command);
    await menu('undo'); await page.waitForFunction(() => importOwner().doc.historyStats.redoSteps > 0); assert.equal((await snapshot()).hash, before.hash);
    await menu('redo'); await page.waitForFunction(() => importOwner().doc.historyStats.undoSteps > 0); assert.equal(hash(await bytes()), hash(replacementBytes));
    await menu('undo'); await page.waitForFunction(() => importOwner().doc.historyStats.redoSteps > 0); assert.equal((await snapshot()).hash, before.hash); checks.push('Native Undo/Redo restores the original model');
    await open(); await page.getByRole('button', { name: 'Make new', exact: true }).click(); await page.getByLabel('Use RGB/Visbility settings from which animation?').selectOption('9'); await answerObjects(true);
    await page.getByRole('button', { name: 'Import animation', exact: true }).click(); await page.getByRole('dialog', { name: 'Animation Importer' }).waitFor({ state: 'hidden' });
    const newBytes = await bytes(), added = openDocument(newBytes, 'new.mdx').model, index = original.Sequences.length, interval = added.Sequences[index].Interval;
    assert.equal(added.Sequences.length, index + 1); assert.equal(added.Sequences[index].Name, 'Walk'); assert.equal(interval[1] - interval[0], 800);
    for (const phase of [0, .5, 1]) for (let geoset = 0; geoset < original.Geosets.length; geoset++) {
      const expected = sampleGeosetAnimation(original, geoset, original.Sequences[9].Interval[0] + phase * (original.Sequences[9].Interval[1] - original.Sequences[9].Interval[0]), 9), actual = sampleGeosetAnimation(added, geoset, interval[0] + phase * 800, index);
      assert.ok(Math.abs(actual.alpha - expected.alpha) < .0001); actual.color.forEach((value, channel) => assert.ok(Math.abs(value - expected.color[channel]) < .0001));
    }
    const emitter = added.ParticleEmitters2.find(node => node.Name === 'Test Sparks'); assert.ok(emitter); const parent = added.Nodes[emitter.Parent]; assert.ok(/hand.*(?:right|_r$)|right.*hand/i.test(parent.Name), 'approved emitter binds to the correct source-corresponding hand');
    for (const sequence of [0, 9, index]) assert.equal(sampleTrack(emitter.Visibility, added.Sequences[sequence].Interval[0], { interval: added.Sequences[sequence].Interval, fallback: 1 }), sequence === index ? 1 : 0);
    checks.push('Make new uses original Death RGB/visibility and approved effect is bound to the hand, hidden in other animations');
    const savedMdl = await bytes('mdl'); for (const [format, saved] of [['mdx', newBytes], ['mdl', savedMdl]]) { fs.writeFileSync(path.join(out, `imported.${format}`), saved); const reopened = openDocument(saved, `imported.${format}`); assertModelEquivalent(added, reopened.model, { keys: ['Bones', 'Helpers', 'Attachments', 'ParticleEmitters2', 'Geosets', 'GeosetAnims', 'Sequences', 'Materials', 'Textures'] }); }
    checks.push('Packaged MDL and MDX serialization reopens with equivalent native data');
    assert.equal(await page.locator('.classic-sidebar').evaluate(element => element.getBoundingClientRect().width), sidebarWidth);
    assert.deepEqual([destination, source].map(file => hash(fs.readFileSync(file))), inputHashes); assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ executable: exe, executableHash: hash(fs.readFileSync(exe)), inputHashes, checks, errors }, null, 2));
    fs.writeFileSync(path.join(out, 'result.png'), await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.capturePage().then(image => image.toPNG())));
    console.log(JSON.stringify({ checks, errors }, null, 2));
  } catch (error) { const page = await app.firstWindow(); fs.writeFileSync(path.join(out, 'failure.png'), await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.capturePage().then(image => image.toPNG()))); console.error(await page.locator('.animation-import-dialog').innerText().catch(() => 'dialog closed')); throw error; }
  finally { await app.evaluate(({ BrowserWindow }) => { for (const win of BrowserWindow.getAllWindows()) win.destroy(); }); await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
