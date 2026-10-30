const { fixturePath } = require('./helpers/fixtures.cjs');
const { stubDialogs } = require('./helpers/app.cjs');
const { appTarget } = require('./helpers/app.cjs');
const { launchApp, closeApp, settle: settlePage } = require('./helpers/app.cjs');
// Attachemator in the rebuilt Electron bundle: node test/attachemator.electron.cjs
// Needs an SD unit with standard attachment points (default out/pose/Footman.mdx,
// or MDLXL_ATTACHEMATOR_MODEL). Its Weapon and Chest points are removed and its
// left hand point misplaced first, so the run covers adding, fixing and vetoing.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const source = path.resolve(process.env.MDLXL_ATTACHEMATOR_MODEL || fixturePath('footman'));
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
  const executablePath = appTarget().executablePath;
  const { app, page } = await launchApp({ out: output, profile: path.join(output, 'profile-' + Date.now()), env: { MDLVIS_HEADLESS: '1' }, timeout: 60000, fixture: fixture , errors, pageTimeout: 20000, bounds: { x: -3000, y: 0, width: 1500, height: 950 }, show: 'inactive' });
  try {

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
    await settlePage(page, 1500);
    const rowOf = name => page.locator('.atm-row').filter({ has: page.locator('span[role=cell]:nth-child(2)', { hasText: new RegExp(`^${name}`) }) });
    const boneText = name => dialog.getByLabel(new RegExp(`^Bone for ${name}`)).evaluate(select => select.selectedOptions[0].textContent);
    assert.equal(await page.locator('.atm-row').count(), doc.model.Attachments.length + 2, 'every point is listed, plus the two missing ones');
    for (const name of ['Chest Ref', 'Weapon Ref', 'Hand Left Ref']) assert.ok(await dialog.getByRole('checkbox', { name: `Use ${name}` }).isChecked(), name);
    assert.equal(await boneText('Hand Left Ref'), doc.model.Bones.concat(doc.model.Helpers).find(node => node.ObjectId === original.hand).Name);
    assert.equal(await page.getByText(/What happens|Already right|Move \d/).count(), 0, 'no change report, just points and bones');
    await page.screenshot({ path: path.join(output, '2-attachemator.png') });

    // Veto the head: it must stay exactly where it was, on no bone.
    await dialog.getByRole('checkbox', { name: /^Use Head/ }).uncheck();
    assert.equal(await boneText('Head'), '(none)');

    const runtime = () => page.evaluate(() => {
      const host = document.querySelector('.atm-preview .game-preview-surface');

      { const state = mdlxlProbe(host?.closest('.game-preview-root') || null).runtime; if (state?.native && state?.controls) {
          window.__atm = state;
          return { position: state.controls.object.position.toArray(), quaternion: state.controls.object.quaternion.toArray() };
        } }

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

    // Clicking a point on the model selects its row.
    const pointOf = name => page.evaluate(name => { const props = findFiberProps('.atm-preview .game-preview-surface', props => props?.model?.Attachments && props?.selectedNodeIds); if (props) {
        const node = props.model.Attachments.find(item => item.Name.startsWith(name));
        return node ? Array.from(node.PivotPoint) : null;
      }
      return null;
     }, name);
    const handPoint = await project(await pointOf('Hand Left'));
    await page.mouse.click(handPoint.x, handPoint.y);
    await settlePage(page, 300);
    assert.match(await page.locator('.atm-row.is-selected').innerText(), /Hand Left/, 'clicking a point in the preview selects it');
    await page.screenshot({ path: path.join(output, '2b-clicked.png') });

    // Drag: select Chest Ref and drag its point with the mouse.
    await rowOf('Chest Ref').locator('span').nth(1).click();
    await page.locator('.atm-row.is-selected', { hasText: 'Chest Ref' }).waitFor(); await settlePage(page, 300);
    const pivotNow = await pointOf('Chest Ref');
    assert.ok(pivotNow, 'the chest point is in the preview');
    const start = await project(pivotNow);
    await page.mouse.move(start.x, start.y); await page.mouse.down();
    await page.mouse.move(start.x + 30, start.y - 25, { steps: 10 }); await page.mouse.up();
    await settlePage(page, 300);
    const dragged = await pointOf('Chest Ref');
    assert.ok(dragged.some((value, i) => Math.abs(value - pivotNow[i]) > 1), 'dragging moves the point');
    await page.screenshot({ path: path.join(output, '3-adjusted.png') });

    // Another bone from the list.
    await dialog.getByLabel('Bone for Hand Right Ref').selectOption({ label: 'Bone_Chest' });
    assert.equal(await boneText('Hand Right Ref'), 'Bone_Chest');

    // The Pick tooltip promises "Esc cancels": Escape leaves picking and keeps the window open.
    await rowOf('Weapon Ref').getByRole('button', { name: 'Pick' }).click();
    assert.equal(await rowOf('Weapon Ref').getByRole('button', { name: 'Pick' }).getAttribute('aria-pressed'), 'true');
    await page.keyboard.press('Escape');await settlePage(page, 200);
    assert.equal(await rowOf('Weapon Ref').getByRole('button', { name: 'Pick' }).getAttribute('aria-pressed'), 'false', 'Esc cancels bone picking');
    assert.equal(await page.getByRole('dialog', { name: 'Attachemator', exact: true }).count(), 1, 'Esc during picking keeps Attachemator open');
    // Pick: click a bone in the preview, like Bones mode's Attach.
    await rowOf('Weapon Ref').getByRole('button', { name: 'Pick' }).click();
    await settlePage(page, 500);
    const headBone = await page.evaluate(() => { const props = findFiberProps('.atm-preview .game-preview-surface', props => props?.model?.Bones && props?.attachSourceIds); if (props) {
        const node = props.model.Bones.concat(props.model.Helpers || []).find(item => item.Name === 'Bone_Head');
        return node ? Array.from(node.PivotPoint) : null;
      }
      return null;
     });
    const headPoint = await project(headBone);
    await page.mouse.click(headPoint.x, headPoint.y);
    await settlePage(page, 300);
    const pickedBone = await boneText('Weapon Ref');
    assert.notEqual(pickedBone, 'Mesh02', 'picking a bone in the preview re-attaches the point');
    assert.equal(await rowOf('Weapon Ref').getByRole('button', { name: 'Pick' }).getAttribute('aria-pressed'), 'false');
    await page.screenshot({ path: path.join(output, '3b-picked.png') });

    await dialog.getByRole('button', { name: 'Commit', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    await page.waitForFunction(() => /Attachemator placed/.test(document.body.innerText));
    await page.screenshot({ path: path.join(output, '4-committed.png') });

    await stubDialogs(app, { save: (savedPath) });
    await page.keyboard.press('F12'); await page.getByRole('button', { name: 'Save MDX…', exact: true }).click();
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
    assert.equal(names.get(find('hand right').Parent), 'Bone_Chest', 'a bone chosen from the list is kept');
    assert.equal(names.get(find('weapon').Parent), pickedBone, 'a picked bone is kept');
    assert.equal(saved.Attachments.length, doc.model.Attachments.length + 2);
    assert.deepEqual(errors, []);
    console.log('Attachemator passed.');
  } catch (error) { try {  await page.screenshot({ path: path.join(output, 'failure.png') }); } catch { /* window gone */ } throw error; } finally { await closeApp(app); }
})().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
