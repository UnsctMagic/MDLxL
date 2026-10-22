// Attachemator in the rebuilt Electron bundle: node test/attachemator.electron.cjs
// Needs an SD unit with standard attachment points (default out/pose/Footman.mdx,
// or MDLXL_ATTACHEMATOR_MODEL). Its Weapon and Chest points are removed and its
// left hand point misplaced first, so the run covers adding, fixing and vetoing.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const source = path.resolve(process.env.MDLXL_ATTACHEMATOR_MODEL || 'out/pose/Footman.mdx');
  if (!fs.existsSync(source)) { console.log(`Skipped: ${source} is missing.`); return; }
  const output = path.resolve('out/attachemator-ui'); fs.mkdirSync(output, { recursive: true });
  const { openDocument } = await import('../src/editor-document.js');
  const { deleteRigNode } = await import('../src/bone-tools.js');
  const doc = openDocument(fs.readFileSync(source), 'Footman.mdx');
  const ref = name => doc.model.Attachments.find(node => node.Name.toLowerCase().replace(/[\s-]+/g, ' ').trim().startsWith(name));
  const original = { hand: ref('hand left').Parent };
  doc.apply('Prepare', ['Nodes', 'PivotPoints', 'Info'], model => {
    for (const name of ['weapon', 'chest']) deleteRigNode(model, ref(name).ObjectId);
    const hand = model.Attachments.find(node => /^hand left/i.test(node.Name));
    hand.Parent = null; hand.PivotPoint = model.PivotPoints[hand.ObjectId] = new Float32Array([40, 40, 10]);
    const head = model.Attachments.find(node => /^head/i.test(node.Name));
    head.Parent = null; head.PivotPoint = model.PivotPoints[head.ObjectId] = new Float32Array([0, 0, 20]);
  });
  const fixture = path.join(output, 'Footman.mdx'), savedPath = path.join(output, 'Footman-saved.mdx');
  fs.writeFileSync(fixture, Buffer.from(doc.serialize('mdx')));
  if (fs.existsSync(path.join(path.dirname(source), 'Textures'))) fs.cpSync(path.join(path.dirname(source), 'Textures'), path.join(output, 'Textures'), { recursive: true });
  const errors = [];
  const executablePath = process.env.MDLXL_APP ? path.resolve(process.env.MDLXL_APP) : path.resolve('node_modules/electron/dist/electron.exe');
  const app = await _electron.launch({ executablePath, args: [...(process.env.MDLXL_APP ? [] : [process.cwd()]), '--disable-backgrounding-occluded-windows', fixture], env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: path.join(output, 'profile-' + Date.now()) }, timeout: 60000 });
  try {
    const page = await app.firstWindow(); page.setDefaultTimeout(20000);
    page.on('pageerror', error => errors.push(error.message));
    await app.evaluate(({ BrowserWindow }) => { const window = BrowserWindow.getAllWindows()[0]; window.webContents.setBackgroundThrottling(false); window.setSize(1500, 950); window.showInactive(); });
    await page.locator('[aria-label="3D model viewport"] canvas').first().waitFor({ timeout: 60000 });
    await page.getByRole('button', { name: 'Bones', exact: true }).click();
    await page.getByLabel('Bones controller').waitFor({ timeout: 60000 });

    // Default view: just the button among the bone tools, no Attachemator panel.
    const button = page.getByRole('button', { name: 'Attachemator', exact: true });
    await button.waitFor();
    assert.match(await button.getAttribute('title'), /Blizzard/);
    assert.equal(await page.locator('.atm-window').count(), 0);
    assert.ok(await button.evaluate(element => !!element.closest('.classic-sidebar')), 'Attachemator lives in the tool sidebar');
    await page.screenshot({ path: path.join(output, '1-bones-tools.png') });

    await button.click();
    const dialog = page.getByRole('dialog', { name: 'Attachemator' });
    await dialog.waitFor();
    await page.locator('.atm-preview canvas').first().waitFor();
    await page.waitForTimeout(1500);
    const rows = await page.locator('.atm-row:not(.atm-head)').allInnerTexts();
    console.log(rows.map(text => text.replace(/\s+/g, ' ')).join('\n'));
    const rowOf = name => page.locator('.atm-row:not(.atm-head)').filter({ has: page.locator('span[role=cell]:nth-child(2)', { hasText: new RegExp(`^${name}`) }) });
    assert.match(await rowOf('Chest Ref').innerText(), /Add/);
    assert.match(await rowOf('Weapon Ref').innerText(), /Add/);
    assert.match(await rowOf('Hand Left Ref').innerText(), /Attach to/);
    await page.screenshot({ path: path.join(output, '2-attachemator.png') });

    // Veto the head: it must stay exactly where it was.
    const headUse = dialog.getByRole('checkbox', { name: /^Use Head/ });
    await headUse.uncheck();
    assert.match(await rowOf('Head').innerText(), /Keep as is/);

    const runtime = () => page.evaluate(() => {
      const host = document.querySelector('.atm-preview .game-preview-surface');
      let fiber = host[Object.keys(host).find(key => key.startsWith('__reactFiber'))];
      for (; fiber; fiber = fiber.return) for (let hook = fiber.memoizedState; hook; hook = hook.next) {
        const state = hook.memoizedState?.current;
        if (state?.native && state?.controls) {
          window.__atm = state;
          return { position: state.controls.object.position.toArray(), quaternion: state.controls.object.quaternion.toArray() };
        }
      }
      throw Error('Preview camera not found');
    });
    const project = point => page.evaluate(point => {
      const state = window.__atm, camera = state.controls.object, host = document.querySelector('.atm-preview .game-preview-surface');
      const bounds = host.querySelector('canvas').getBoundingClientRect(), projected = camera.position.clone().set(...point).project(camera);
      return { x: bounds.x + (projected.x + 1) * bounds.width / 2, y: bounds.y + (1 - projected.y) * bounds.height / 2 };
    }, point);

    // Camera: drag empty space with the left mouse button.
    const before = await runtime(), box = await page.locator('.atm-preview canvas').first().boundingBox();
    await page.mouse.move(box.x + box.width * .1, box.y + box.height * .85); await page.mouse.down();
    await page.mouse.move(box.x + box.width * .35, box.y + box.height * .8, { steps: 12 }); await page.mouse.up();
    const turned = await runtime();
    assert.ok(before.position.some((value, i) => Math.abs(value - turned.position[i]) > 1), 'left drag on empty space turns the camera');

    // Adjust: select Chest Ref and drag its point with the mouse.
    await rowOf('Chest Ref').locator('span').nth(1).click();
    const pivotNow = await page.evaluate(() => {
      const host = document.querySelector('.atm-preview .game-preview-surface');
      let fiber = host[Object.keys(host).find(key => key.startsWith('__reactFiber'))];
      for (; fiber; fiber = fiber.return) if (fiber.memoizedProps?.model?.Attachments && fiber.memoizedProps?.selectedNodeIds) {
        const id = fiber.memoizedProps.selectedNodeIds[0], node = fiber.memoizedProps.model.Attachments.find(item => item.ObjectId === id);
        return node ? Array.from(node.PivotPoint) : null;
      }
      return null;
    });
    assert.ok(pivotNow, 'the chest point is selected in the preview');
    const start = await project(pivotNow);
    await page.mouse.move(start.x, start.y); await page.mouse.down();
    await page.mouse.move(start.x + 30, start.y - 25, { steps: 10 }); await page.mouse.up();
    await page.waitForTimeout(300);
    assert.match(await rowOf('Chest Ref').innerText(), /adjusted/);
    await page.screenshot({ path: path.join(output, '3-adjusted.png') });

    await dialog.getByRole('button', { name: 'Commit', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    await page.waitForFunction(() => /Attachemator placed/.test(document.body.innerText));
    await page.screenshot({ path: path.join(output, '4-committed.png') });

    await app.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, savedPath);
    await page.keyboard.press('Control+Shift+s'); await page.getByRole('button', { name: 'Save MDX…', exact: true }).click();
    await page.getByRole('dialog', { name: 'Save as', exact: true }).waitFor({ state: 'hidden' });
    await page.waitForFunction(() => !document.title.startsWith('* '));
    const saved = openDocument(fs.readFileSync(savedPath), 'Footman-saved.mdx').model;
    const names = new Map([...saved.Bones, ...saved.Helpers].map(node => [node.ObjectId, node.Name]));
    const find = name => saved.Attachments.find(node => node.Name.toLowerCase().replace(/[\s-]+/g, ' ').trim().startsWith(name));
    assert.ok(find('chest') && find('weapon'), 'missing points were added');
    assert.equal(find('chest').Parent != null && /chest/i.test(names.get(find('chest').Parent)), true, 'chest hangs on the chest bone');
    assert.equal(find('hand left').Parent, original.hand, 'the misplaced hand point is back on the bone Blizzard used');
    assert.equal(find('head').Parent, null, 'vetoed head keeps its parent');
    assert.deepEqual(Array.from(find('head').PivotPoint), [0, 0, 20], 'vetoed head keeps its spot');
    assert.equal(saved.Attachments.length, doc.model.Attachments.length + 2);
    assert.deepEqual(errors, []);
    console.log('Attachemator passed.');
  } catch (error) { try { const page = await app.firstWindow(); await page.screenshot({ path: path.join(output, 'failure.png') }); } catch { /* window gone */ } throw error; } finally { const child = app.process(); await Promise.race([app.close(), new Promise(resolve => setTimeout(resolve, 3000))]); child?.kill(); }
})().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
