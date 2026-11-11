const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { launchApp, closeApp, root } = require('./helpers/app.cjs');
const { fixturePath } = require('./helpers/fixtures.cjs');

async function click(page, locator, button = 'left') {
  await locator.waitFor();
  const box = await locator.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button });
}

async function main() {
  const fixture = fixturePath('ribbon-attachment');
  const { openDocument } = await import('../src/editor-document.js');
  const { EFFECT_FAMILIES, effectNodes } = await import('../src/particle-recipes.js');
  const model = openDocument(fs.readFileSync(fixture), fixture).model;
  const expectedIds = effectNodes(model).map(({ node }) => String(node.ObjectId)).sort();
  assert.ok(expectedIds.length && model.Bones.length, 'fixture has emitters and non-emitter nodes');

  const { app, page, errors } = await launchApp({ fixture, out: path.join(root, 'out', 'emtr-quick-options'), pageTimeout: 10000 });
  try {
    await page.waitForFunction(name => document.title.includes(name), path.basename(fixture));
    const emtr = page.getByRole('button', { name: 'Emitter Editor', exact: true });
    const quick = page.getByRole('menu', { name: 'EMTR', exact: true });
    const editor = page.getByRole('dialog', { name: 'Particle Editor', exact: true });
    const glow = editor.getByRole('dialog', { name: 'Glow Up', exact: true });
    const library = editor.getByLabel('Particle Library', { exact: true });
    const choose = async label => {
      await click(page, emtr, 'right');
      await click(page, quick.getByRole('menuitem', { name: label, exact: true }));
      await quick.waitFor({ state: 'hidden' });
    };
    const closeEditor = async () => {
      await click(page, editor.locator('.re-caption-close'));
      await editor.waitFor({ state: 'hidden' });
    };

    const learn = page.getByRole('button', { name: 'Learn', exact: true });
    const learnMenu = page.getByRole('menu', { name: 'Learn', exact: true });
    const menuStyle = element => {
      const menu = getComputedStyle(element);
      const item = getComputedStyle(element.querySelector('button'));
      return [menu.backgroundImage, menu.backgroundColor, menu.borderRadius, menu.boxShadow, item.font, item.minHeight];
    };
    await click(page, learn, 'right');
    await learnMenu.waitFor();
    const learnStyle = await learnMenu.evaluate(menuStyle);
    await click(page, emtr, 'right');
    await quick.waitFor({ timeout: 3000 });
    assert.deepEqual(await quick.evaluate(menuStyle), learnStyle, 'EMTR uses the Learn icon-menu styling');
    await learnMenu.waitFor({ state: 'hidden' });
    const [trigger, popup] = await Promise.all([emtr.boundingBox(), quick.boundingBox()]);
    assert.ok(Math.abs(popup.x + popup.width - trigger.x - trigger.width) < 2, 'menu aligns with the right edge of EMTR');
    assert.ok(Math.abs(popup.y - trigger.y - trigger.height - 6) < 2, 'menu opens directly below EMTR');
    await click(page, emtr, 'right');
    await quick.waitFor({ state: 'hidden' });
    await click(page, emtr, 'right');
    await quick.waitFor();
    assert.deepEqual(await quick.getByRole('menuitem').allTextContents(), ['Glow Up', 'EMTR Library', 'Manager']);
    assert.equal(await editor.count(), 0);
    await page.keyboard.press('Escape');
    await quick.waitFor({ state: 'hidden' });

    await click(page, emtr, 'right');
    await quick.waitFor();
    await click(page, emtr);
    await quick.waitFor({ state: 'hidden' });
    await editor.waitFor();
    assert.equal(await glow.count(), 0);
    assert.equal(await library.count(), 0);
    await closeEditor();

    await choose('Glow Up');
    await glow.waitFor();
    assert.equal(await library.count(), 0);
    const cameraPosition = previous => {
      const { runtime } = window.mdlxlProbe('.pe-preview .game-preview-root');
      const position = (runtime?.camera || runtime?.controls?.object)?.position.toArray();
      return position && (!previous || position.some((value, axis) => Math.abs(value - previous[axis]) > 0.001)) ? position : false;
    };
    const before = await (await page.waitForFunction(cameraPosition)).jsonValue();
    const canvas = await editor.locator('.pe-preview canvas').first().boundingBox();
    const x = canvas.x + canvas.width * 0.25, y = canvas.y + canvas.height * 0.85;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 100, y - 25, { steps: 8 });
    await page.mouse.up();
    await page.waitForFunction(cameraPosition, before);
    await closeEditor();

    await choose('EMTR Library');
    await library.waitFor();
    assert.equal(await glow.count(), 0);
    await closeEditor();

    await choose('Manager');
    const manager = page.getByRole('dialog', { name: 'Emitter Manager', exact: true });
    await manager.waitFor();
    const rows = manager.locator('[data-node-id]');
    assert.deepEqual((await rows.evaluateAll(nodes => nodes.map(row => row.dataset.nodeId))).sort(), expectedIds);
    assert.equal(await manager.getByRole('navigation', { name: 'Resource managers' }).count(), 0);
    assert.equal(await manager.getByLabel('Show hierarchy').count(), 0);
    const nodeTypes = await manager.getByRole('combobox', { name: 'New emitter type' }).getByRole('option').allTextContents();
    const { NODE_TYPES } = await import('../src/editor-document.js');
    assert.deepEqual(nodeTypes, Object.keys(NODE_TYPES).filter(type =>
      EFFECT_FAMILIES.includes(NODE_TYPES[type][0]) && (type !== 'ParticleEmitterPopcorn' || model.Version >= 900)));
    await click(page, rows.first());
    await click(page, manager.getByRole('button', { name: 'EMTR…', exact: true }));
    await editor.waitFor();
    await manager.waitFor({ state: 'hidden' });
    await closeEditor();

    await click(page, page.getByRole('button', { name: 'Managers', exact: true }));
    const tabs = page.getByRole('navigation', { name: 'Resource managers' });
    await click(page, tabs.getByRole('button', { name: 'Nodes', exact: true }));
    await page.locator('[data-node-type="Bones"]').first().waitFor();
    assert.ok(await page.getByLabel('Show hierarchy').isVisible());
    assert.deepEqual(errors, []);
    console.log('Shared Learn and EMTR menu styling, placement and dismissal, normal opening, Glow Up with mouse rotation, Library, emitter-only Manager and full Node Manager passed.');
  } finally {
    await closeApp(app);
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
