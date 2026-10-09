// Run after building. MDLXL_ELECTRON_PATH selects an isolated portable build;
// MDLXL_INPUT_PATH optionally exercises an existing model without editing it.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const scenario = process.env.MDLXL_PASTE_SCENARIO || 'parent';
  const root = path.resolve(__dirname, '..'), out = path.join(root, 'out/dummy-bone-ui', scenario);
  await fs.mkdir(out, { recursive: true });
  const profile = await fs.mkdtemp(path.join(out, 'profile-'));
  await fs.writeFile(path.join(profile, 'settings.json'), JSON.stringify({ preferences: { graphics: { pauseWhenHidden: false } } }));
  const { createDemoDocument, createNode, openDocument, validateModel } = await import('../src/editor-document.js');
  const fixture = createDemoDocument();
  fixture.apply('Parent DummyBone', [], model => { const dummy = createNode(model, 'Bone'); dummy.Name = 'DummyBone'; dummy.Parent = model.Bones[0].ObjectId; });
  const input = scenario === 'parent' ? process.env.MDLXL_INPUT_PATH : undefined, original = input ? await fs.readFile(input) : Buffer.from(fixture.serialize('mdx'));
  const target = openDocument(original, 'paste-target.mdx');
  if (target.model.Bones.find(node => node.Name === 'DummyBone')?.Parent == null) target.apply('Reproduce parented DummyBone', [], model => {
    model.Bones.find(node => node.Name === 'DummyBone').Parent = model.Bones.find(node => node.Name === 'Bone_Head')?.ObjectId ?? model.Bones[0].ObjectId;
  });
  if (scenario === 'node-order') target.apply('General noncanonical order', [], model => {
    model.Bones.find(node => node.Name === 'DummyBone').Parent = null;
    createNode(model, 'Helper'); const bone = createNode(model, 'Bone'); bone.Name = 'Late_Bone'; model.Geosets[0].Groups = [[bone.ObjectId]];
  });
  if (scenario === 'format') target.convertVersion(1000);
  const { generateMDX } = await import('war3-model');
  const targetBytes = scenario === 'node-order' ? Buffer.from(generateMDX({ ...target.model, BindPoses: undefined })) : Buffer.from(target.serialize('mdx'));
  const targetPath = path.join(out, 'paste-target.mdx'), donorPath = path.join(out, 'paste-donor.mdx'), savedPath = path.join(out, 'paste-saved.mdx'), reopenedPath = path.join(out, 'paste-reopened.mdx');
  await fs.writeFile(targetPath, targetBytes); await fs.writeFile(donorPath, createDemoDocument().serialize('mdx'));
  const executablePath = process.env.MDLXL_ELECTRON_PATH || path.join(root, 'node_modules/electron/dist/electron.exe'), packaged = !!process.env.MDLXL_ELECTRON_PATH;
  const app = await _electron.launch({ executablePath, args: packaged ? [targetPath] : [root, targetPath], cwd: root,
    env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: profile }, timeout: 60000 });
  const errors = []; let page;
  const screenshot = async name => {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const png = await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].capturePage({}, { stayHidden: true, stayAwake: true })).toPNG().toString('base64'));
    await fs.writeFile(path.join(out, name), Buffer.from(png, 'base64'));
  };
  try {
    page = await app.firstWindow(); page.setDefaultTimeout(20000); page.on('pageerror', error => errors.push(error.message));
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.setBackgroundThrottling(false));
    await page.getByRole('tab', { name: 'paste-target.mdx' }).waitFor();
    await page.evaluate(() => {
      window.pasteSummary = () => {
        const host = document.querySelector('.viewport');
        let fiber = host?.[Object.keys(host).find(key => key.startsWith('__reactFiber'))];
        for (; fiber; fiber = fiber.return) if (fiber.memoizedProps?.model?.Geosets && fiber.memoizedProps?.model?.Nodes) {
          const model = fiber.memoizedProps.model, dummy = model.Bones.find(node => node.Name === 'DummyBone');
          let camera;
          for (let hook = fiber.memoizedState; hook; hook = hook.next) if (hook.memoizedState?.current?.controls) camera = hook.memoizedState.current.controls.object.matrixWorld.elements;
          const ordered = ['Bones', 'Lights', 'Helpers', 'Attachments', 'ParticleEmitters', 'ParticleEmitters2', 'ParticleEmitterPopcorns', 'RibbonEmitters', 'EventObjects', 'CollisionShapes'].flatMap(key => model[key] || []).every((node, index) => node.ObjectId === index);
          return { geosets: model.Geosets.length, nodes: model.Nodes.filter(Boolean).length, ordered, dummyId: dummy?.ObjectId, parent: dummy?.Parent, lastGroups: model.Geosets.at(-1)?.Groups, model: JSON.stringify(model), camera: camera && Array.from(camera) };
        }
        throw Error('Active model was not found.');
      };
    });
    const before = await page.evaluate(() => pasteSummary()), sidebarWidth = await page.locator('.classic-sidebar').evaluate(el => el.getBoundingClientRect().width);
    if (scenario === 'node-order') assert.equal(before.ordered, false, 'fixture reproduces the general node-order rejection');
    else assert.ok(before.parent != null && before.parent !== -1, 'fixture reproduces the root-bone rejection');
    const open = async file => {
      await app.evaluate(({ dialog }, filePath) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] }); }, file);
      await page.keyboard.press('Control+o'); await page.getByRole('tab', { name: path.basename(file) }).waitFor();
    };
    if (scenario === 'node-order') {
      await page.keyboard.press('Control+c'); await page.keyboard.press('Control+Shift+v');
      await page.getByRole('dialog', { name: 'Special paste', exact: true }).getByRole('button', { name: 'Paste', exact: true }).click();
      await page.getByRole('dialog', { name: 'Fix paste', exact: true }).getByRole('button', { name: 'Fix and paste', exact: true }).click();
      await page.waitForFunction(original => pasteSummary().model !== original && pasteSummary().ordered, before.model);
      const special = JSON.parse((await page.evaluate(() => pasteSummary())).model);
      assert.ok(Object.keys(special.Geosets[0].Vertices).length > Object.keys(JSON.parse(before.model).Geosets[0].Vertices).length);
      assert.ok(special.Geosets[0].Groups.every(group => group.every(id => special.Nodes[id].Name === 'Late_Bone')));
      assert.equal(special.Nodes.filter(Boolean).length, before.nodes);
      await page.keyboard.press('Control+z'); await page.waitForFunction(original => pasteSummary().model === original, before.model);
    }
    await open(donorPath); await page.keyboard.press('Control+c');
    await page.waitForFunction(() => document.querySelector('.classic-status')?.textContent.includes('Copied'));
    await page.getByRole('tab', { name: 'paste-target.mdx' }).click();
    await page.keyboard.press('Control+p');
    const repairDialog = page.getByRole('dialog', { name: 'Fix paste', exact: true });
    await repairDialog.waitFor();
    await screenshot('paste-repair-prompt.png');
    assert.match(await repairDialog.innerText(), scenario === 'node-order' ? /Repair node order/ : /Make DummyBone a root bone/);
    if (scenario === 'format') assert.match(await repairDialog.innerText(), /MDX800 to MDX1000/);
    assert.equal((await page.evaluate(() => pasteSummary())).model, before.model);
    await repairDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal((await page.evaluate(() => pasteSummary())).model, before.model, 'Cancel leaves the model unchanged');
    await page.keyboard.press('Control+p'); await repairDialog.getByRole('button', { name: 'Fix and paste', exact: true }).click();
    await page.waitForFunction(count => pasteSummary().geosets === count + 1, before.geosets);
    const pasted = await page.evaluate(() => pasteSummary());
    assert.equal(pasted.parent, null); assert.equal(pasted.nodes, before.nodes); assert.deepEqual(pasted.lastGroups, [[pasted.dummyId]]);
    const oldModel = JSON.parse(before.model), newModel = JSON.parse(pasted.model);
    // importGeosets already recomputes derived bounds, including stale source
    // extents. The existing vertices, attributes, bindings and tracks stay exact.
    const geometry = (model, { BoundsRadius, MinimumExtent, MaximumExtent, Groups, ...geoset }) => ({ ...geoset, Groups: Groups.map(group => group.map(id => model.Nodes[id].Name)) });
    assert.deepEqual(newModel.Geosets.slice(0, before.geosets).map(geoset => geometry(newModel, geoset)), oldModel.Geosets.map(geoset => geometry(oldModel, geoset)));
    for (const node of oldModel.Nodes.filter(Boolean)) {
      const repaired = newModel.Nodes.find(value => value?.Name === node.Name);
      const expected = { ...node, ObjectId: repaired.ObjectId, Parent: node.Parent == null || node.Parent === -1 ? node.Parent : newModel.Nodes.find(value => value?.Name === oldModel.Nodes[node.Parent]?.Name)?.ObjectId };
      assert.deepEqual(repaired, node.Name === 'DummyBone' ? { ...expected, Parent: null, GeosetId: null, GeosetAnimId: null } : expected);
    }
    assert.equal(await page.getByRole('dialog').count(), 0);
    assert.equal(await page.locator('.classic-sidebar').evaluate(el => el.getBoundingClientRect().width), sidebarWidth);
    await page.keyboard.press('Control+z');
    await page.waitForFunction(count => pasteSummary().geosets === count, before.geosets);
    assert.equal((await page.evaluate(() => pasteSummary())).model, before.model, 'one Undo restores both the parent and imported geometry');
    await page.keyboard.press('Control+y');
    await page.waitForFunction(count => pasteSummary().geosets === count + 1, before.geosets);

    await page.getByRole('tab', { name: 'paste-donor.mdx' }).click();
    await page.locator('[data-warmkey="bones"]').click(); await page.keyboard.press('Control+a'); await page.keyboard.press('Control+c');
    await page.getByRole('tab', { name: 'paste-target.mdx' }).click();
    await page.keyboard.press('Control+p');
    if (scenario === 'format') await repairDialog.getByRole('button', { name: 'Fix and paste', exact: true }).click();
    await page.waitForFunction(count => pasteSummary().nodes > count, before.nodes);
    assert.equal((await page.evaluate(() => pasteSummary())).parent, null);
    assert.equal(await page.getByRole('dialog').count(), 0);
    await app.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, savedPath);
    await page.keyboard.press('Control+Shift+s'); await page.getByRole('button', { name: 'Save MDX…', exact: true }).click();
    await page.getByRole('dialog', { name: 'Save as', exact: true }).waitFor({ state: 'hidden' });
    await page.waitForFunction(() => !document.title.startsWith('* '));
    const saved = await fs.readFile(savedPath), reopened = openDocument(saved, 'paste-saved.mdx');
    assert.equal(reopened.readOnly, false); assert.deepEqual(validateModel(reopened.model).filter(issue => issue.severity === 'error'), []);
    const dummy = reopened.model.Bones.find(node => node.Name === 'DummyBone'); assert.equal(dummy.Parent, null);
    assert.deepEqual(reopened.model.Geosets.at(-1).Groups, [[dummy.ObjectId]]);
    const bindingNames = model => model.Geosets.slice(0, before.geosets).map(geoset => geoset.Groups.map(group => group.map(id => model.Nodes[id].Name)));
    assert.deepEqual(bindingNames(reopened.model), bindingNames(oldModel));
    await fs.writeFile(reopenedPath, saved); await open(reopenedPath);
    await page.waitForFunction(() => document.querySelector('.model-tab.active [role="tab"]')?.textContent.includes('paste-reopened.mdx'));
    assert.equal((await page.evaluate(() => pasteSummary())).parent, null);
    const cameraBefore = (await page.evaluate(() => pasteSummary())).camera, canvas = await page.locator('.viewport canvas').first().boundingBox();
    await page.keyboard.down('Alt'); await page.mouse.move(canvas.x + canvas.width * .7, canvas.y + canvas.height * .7); await page.mouse.down();
    await page.mouse.move(canvas.x + canvas.width * .55, canvas.y + canvas.height * .55, { steps: 12 }); await page.mouse.up(); await page.keyboard.up('Alt');
    await page.waitForFunction(previous => pasteSummary().camera.some((value, index) => Math.abs(value - previous[index]) > .01), cameraBefore);
    await screenshot('paste-repaired.png');
    if (input) assert.deepEqual(await fs.readFile(input), original);
    assert.deepEqual(await fs.readFile(targetPath), targetBytes); assert.deepEqual(errors, []);
    const result = { passed: true, packaged, scenario, input, savedPath, geosetsBefore: before.geosets, geosetsAfter: reopened.model.Geosets.length, parentBefore: before.parent, parentAfter: dummy.Parent, repairPrompt: true, cancelPreservedOriginal: true, undoRestoredOriginal: true, sameDocumentSpecialPaste: scenario === 'node-order', mouseRotation: true, originalFilePreserved: true, rendererErrors: errors };
    await fs.writeFile(path.join(out, 'result.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
  } catch (error) {
    if (page) { await screenshot('failure.png').catch(() => {}); console.error((await page.locator('body').innerText()).slice(-1000)); }
    throw error;
  } finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); }
})().catch(error => { console.error(error); process.exitCode = 1; });
