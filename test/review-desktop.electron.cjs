const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { launchApp, closeApp } = require('./helpers/app.cjs');
const { fixturePath } = require('./helpers/fixtures.cjs');

async function click(page, locator, button = 'left') {
  await locator.waitFor();
  const box = await locator.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button });
}

async function chooseMenu(page, menu, name) {
  const bar = page.getByRole('menubar', { name: 'Application menu' });
  await click(page, bar.getByRole('menuitem', { name: menu, exact: true }));
  const popup = bar.getByRole('menu', { name: menu, exact: true });
  await click(page, popup.getByRole('menuitem', { name, exact: true }));
}

async function withModel(label, run, fixture = fixturePath('citadel-footman')) {
  const out = path.resolve('out/review-desktop', label);
  fs.mkdirSync(out, { recursive: true });
  const copy = path.join(out, path.basename(fixture));
  fs.copyFileSync(fixture, copy);
  const { app, page } = await launchApp({ out, fixture: copy, pageTimeout: 7000 });
  try {
    await page.getByRole('tab', { name: path.basename(fixture), exact: true }).waitFor();
    await page.locator('.desktop-menu').waitFor();
    await run(app, page);
  } finally { await closeApp(app); }
}

test('dragging the Node Manager to the top keeps the title bar reachable in both looks', async () => {
  await withModel('move-manager', async (_app, page) => {
    const menu = page.locator('.desktop-menu');
    const toggle = page.locator('.vis-toggle');
    for (const vis of [false, true]) {
      if (vis) await click(page, toggle);
      await chooseMenu(page, 'Managers', 'Node Manager…');
      const dialog = page.getByRole('dialog', { name: 'Node Manager', exact: true });
      const caption = dialog.locator('.re-caption');
      await caption.waitFor();
      const dragCaption = async target => {
        const box = await caption.boundingBox(), x = box.x + 35;
        await page.mouse.move(x, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(x, target, { steps: 9 });
        await page.mouse.up();
      };
      await dragCaption(1);
      const bar = await menu.boundingBox(), clamped = await caption.boundingBox();
      assert.ok(clamped.y >= bar.y + bar.height - 0.5, 'the title stays below the Windows menu');
      await dragCaption(95);
      assert.ok((await caption.boundingBox()).y > clamped.y + 30, 'the title can be dragged again');
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
    }
  });
});

test('Node Manager opens with full hierarchy and event categories while Emitter Manager is open', async () => {
  await withModel('emtr-manager', async (_app, page) => {
    const emitter = page.getByRole('button', { name: 'Emitter Editor', exact: true });
    await click(page, emitter, 'right');
    await click(page, page.getByRole('menu', { name: 'EMTR' }).getByRole('menuitem', { name: 'Manager', exact: true }));
    await page.getByRole('dialog', { name: 'Emitter Manager', exact: true }).waitFor();
    await chooseMenu(page, 'Managers', 'Node Manager…');
    const manager = page.getByRole('dialog', { name: 'Node Manager', exact: true });
    await manager.waitFor();
    assert.ok(await manager.getByLabel('Show hierarchy').isChecked());
    await click(page, manager.getByRole('button', { name: 'New', exact: true }));
    const events = manager.getByRole('group', { name: 'Event objects', exact: true });
    assert.equal(await events.getByRole('button', { name: 'Blood Splat', exact: true }).isVisible(), true);
  }, fixturePath('ribbon-attachment'));
});

async function checkPanel(page, title, top) {
  const panel = page.getByRole('dialog', { name: title, exact: true });
  await panel.waitFor();
  const menu = await page.locator('.desktop-menu').boundingBox();
  assert.equal((await panel.boundingBox()).y, top + menu.height, title + ' includes the menu height');
}

test('the Add-ons panel starts below the Windows menu', async () => {
  await withModel('addons-panel', async (_app, page) => {
    await chooseMenu(page, 'Settings', 'Add-ons…');
    await checkPanel(page, 'Add-ons', 64);
  });
});

test('the POSE setup panel includes the menu height', async () => {
  await withModel('pose-panel', async (_app, page) => {
    await click(page, page.locator('[data-hotkey="animation"]'));
    await click(page, page.getByRole('button', { name: 'POSE', exact: true }));
    await click(page, page.getByRole('button', { name: 'POSE setup', exact: true }));
    await checkPanel(page, 'POSE setup', 118);
  });
});

test('Curve Properties includes the menu height', async () => {
  await withModel('curve-panel', async (_app, page) => {
    await click(page, page.locator('[data-hotkey="animation"]'));
    const node = page.getByLabel('Movement bone or node', { exact: true });
    await click(page, node);
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await click(page, page.getByRole('group', { name: 'Movement tool' }).getByRole('button', { name: 'Rotate', exact: true }));
    const controller = page.getByLabel('Controller type', { exact: true });
    await click(page, controller);
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await click(page, page.getByRole('button', { name: 'Curve Properties…', exact: true }));
    await checkPanel(page, 'Curve Properties', 118);
  });
});

test('ShareX helper starts only when enabled and stops when disabled', async () => {
  await withModel('sharex', async (app, page) => {
    // Report only children of this launched test app.
    const helpers = () => app.evaluate(() => {
      const { execFileSync } = process.getBuiltinModule('node:child_process');
      const query = "Get-CimInstance Win32_Process -Filter 'ParentProcessId=" + process.pid + " AND Name=" + '\"capture-regions.exe\"' + "' | Select-Object -ExpandProperty ProcessId";
      return execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', query], { encoding: 'utf8', windowsHide: true }).trim().split(/\s+/).filter(Boolean);
    });
    const editor = page.locator('.classic-view [aria-label="3D model viewport"]');
    await editor.waitFor();
    await page.waitForFunction(() => window.__mdlxl.session()?.doc?.model?.Geosets.length > 0);
    assert.deepEqual(await helpers(), [], 'a visible editor does not start the helper by default');
    await chooseMenu(page, 'Settings', 'Recording and screenshots…');
    const option = page.locator('[data-hotkey="capture:sharex-regions"]');
    assert.equal(await option.isChecked(), false);
    const waitForHelpers = async expected => {
      const deadline = Date.now() + 7000;
      let children;
      do { children = await helpers(); } while (children.length !== expected && Date.now() < deadline);
      assert.equal(children.length, expected);
    };
    await click(page, option);
    await waitForHelpers(1);
    const initial = await helpers();
    await app.evaluate(({ ipcMain }) => {
      globalThis.reviewCaptureUpdates = [];
      ipcMain.on('capture:regions', (_event, edges) => globalThis.reviewCaptureUpdates.push(edges));
    });
    await click(page, page.getByRole('button', { name: 'Close Settings', exact: true }));
    const geoset = page.getByLabel('Select geoset 0', { exact: true });
    if (!(await geoset.isChecked())) await click(page, geoset);
    await click(page, editor);
    await page.keyboard.press('Control+a');
    await click(page, page.locator('[data-hotkey="uv"]'));
    const exitUV = page.getByRole('button', { name: 'Exit UV Wrapper', exact: true });
    await exitUV.waitFor();
    const updates = await app.evaluate(() => globalThis.reviewCaptureUpdates);
    assert.ok(updates.some(edges => edges?.length === 8 && edges.every(edge => edge === 0)), 'UV sends empty regions');
    assert.equal(updates.includes(null), false, 'switching mode does not stop capture');
    await click(page, exitUV);
    await exitUV.waitFor({ state: 'detached' });
    assert.deepEqual(await helpers(), initial, 'the same helper is running after returning to Vertices');
    await chooseMenu(page, 'Settings', 'Recording and screenshots…');
    await click(page, option);
    await waitForHelpers(0);
    await click(page, option);
    await waitForHelpers(1);
    await click(page, option);
    await waitForHelpers(0);
  });
});

test('VIS uses the classic square Tahoma menu and XL keeps the drawn menu style', async () => {
  await withModel('vis-menu', async (_app, page) => {
    const menu = page.getByRole('menubar', { name: 'Application menu' });
    const file = menu.getByRole('menuitem', { name: 'File', exact: true });
    const popup = menu.getByRole('menu', { name: 'File', exact: true });
    const style = () => popup.evaluate(el => {
      const style = getComputedStyle(el);
      return { radius: style.borderRadius, shadow: style.boxShadow, font: style.fontFamily, background: style.backgroundColor, border: style.borderTopStyle };
    });
    await click(page, file);
    const xl = await style();
    assert.equal(xl.radius, '10px');
    assert.match(xl.shadow, /0px 8px 20px/);
    assert.match(xl.font, /Segoe UI/);
    await page.keyboard.press('Escape');
    await click(page, page.locator('.vis-toggle'));
    await click(page, file);
    const vis = await style();
    assert.equal(vis.radius, '0px');
    assert.match(vis.shadow, /2px 2px 0px/);
    assert.match(vis.font, /^Tahoma/);
    // The classic menu's light theme uses --ui-panel instead of its unthemed fallback.
    assert.equal(vis.background, 'rgb(240, 240, 240)');
    assert.equal(vis.border, 'outset');
    await page.keyboard.press('Escape');
    await click(page, page.locator('.vis-toggle'));
    await click(page, file);
    assert.deepEqual(await style(), xl);
  });
});
