// Mouse drag keys and the gesture guard through the packaged app's real mouse and keyboard, each
// from its own seeded profile. Probes only read state. Contract: docs/agent-tasks/presets-previews-toolbar.md.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { isDeepStrictEqual } = require('node:util');
const { launchApp, closeApp, settle, bundleHashes } = require('./helpers/app.cjs');
const { fixturePath } = require('./helpers/fixtures.cjs');

const args = ['--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-gpu-vsync', '--disable-frame-rate-limit'];
const MAIN = '.classic-view', RAD = Math.PI / 180;
const CIRCLE_UV = { rotateStyle: 'circle', rotateSpeed: 100, rotateZone: 0, rotateBigPieces: false, rotateSnap: 15 };

(async () => {
  const out = path.resolve(process.env.MDLXL_MODIFIER_BINDINGS_OUT || 'out/modifier-bindings');
  fs.mkdirSync(out, { recursive: true });
  const footman = fixturePath('footman'), originalFile = fs.readFileSync(footman);
  const checks = [], errors = [], failures = [], bundle = bundleHashes();
  const check = (label, actual, expected = true) => { assert.deepEqual(actual, expected, label); checks.push(label); console.log('PASS ' + label); };
  const near = (label, actual, expected, tolerance = .15) => {
    assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected} (within ${tolerance}), got ${actual}`);
    checks.push(label); console.log(`PASS ${label} [${Number(actual).toFixed(4)}]`);
  };
  const along = (start, tangent, pixels) => ({ x: start.x + tangent.x * pixels, y: start.y + tangent.y * pixels });

  async function test(name, preferences, body) {
    const settings = { preferences: { language: 'en', pointerSensitivity: 1, graphics: { pauseWhenHidden: false }, ...preferences } };
    let launched;
    try {
      launched = await launchApp({ fixture: footman, out, errors, bounds: { x: 0, y: 0, width: 1500, height: 980 }, args, settings, show: 'hide' });
      console.log('SESSION ' + name);
      await installProbes(launched.page);
      await body(launched);
    } catch (error) {
      failures.push({ session: name, message: error.message });
      console.log('FAIL ' + name + ': ' + error.message);
      await launched?.page.screenshot({ path: path.join(out, 'failure-' + name + '.png') }).catch(() => {});
    } finally { if (launched) await closeApp(launched.app); }
  }

  const installProbes = page => page.evaluate(() => {
    window.rotateView = scope => {
      const host = document.querySelector(scope + ' [aria-label="3D model viewport"]');
      let props;
      const state = findFiberState(host, (value, owner) => { if (value?.renderer && value?.entries) { props = owner; return true; } return false; }, { current: true });
      return state ? { state, props } : null;
    };
    window.rotateRead = scope => {
      const view = rotateView(scope); if (!view) return null;
      const drag = view.state.drag, turn = drag?.rotationDrag;
      return { dragging: !!drag, action: drag?.action, degrees: turn?.degrees, tangent: turn?.tangent ? { x: turn.tangent.x, y: turn.tangent.y } : null, transformMode: view.props.transformMode };
    };
    window.documentNow = () => JSON.stringify(__mdlxl.model());
    window.selectedVertexIds = scope => { const view = rotateView(scope), byGeoset = view.props.selectionByGeoset; return byGeoset ? Object.values(byGeoset).flatMap(ids => Array.from(ids)).sort((a, b) => a - b) : Array.from(view.props.selectedVertices || []).sort((a, b) => a - b); };
    window.cameraNow = scope => rotateView(scope).state.camera.quaternion.toArray();
    window.keyHintsShown = () => document.documentElement.dataset.shortcutHints === 'true';
  });

  // ---- The main 3D editor.
  async function openVertices(page, tool) {
    const surface = page.getByLabel('3D model viewport', { exact: true }), sidebar = page.locator('.classic-sidebar');
    await surface.waitFor();
    await page.locator('[data-hotkey="geosetsClear"]').click();
    await page.getByLabel('Select geoset 0', { exact: true }).check();
    await sidebar.getByRole('button', { name: 'Select', exact: true }).click();
    const box = await surface.boundingBox();
    await page.mouse.click(box.x + box.width * .7, box.y + box.height * .7);
    await page.keyboard.press('Control+a');
    await sidebar.getByRole('button', { name: tool, exact: true }).click();
    await page.waitForFunction(() => { const view = rotateView('.classic-view'); return !!view && Object.keys(view.state.entries).length > 0 && selectedVertexIds('.classic-view').length > 0; });
    await page.getByLabel('View direction', { exact: true }).selectOption('perspective');
    await page.getByLabel('Workplane Constraints', { exact: true }).setChecked(true);
    await page.getByLabel('XY workplane', { exact: true }).check();
    await settle(page, 120);
    const start = { x: box.x + box.width * .72, y: box.y + box.height * .7 };
    const read = () => page.evaluate(() => rotateRead('.classic-view'));
    const begin = async (point = start) => { await page.mouse.move(point.x, point.y); await page.mouse.down(); await page.waitForFunction(() => !!rotateView('.classic-view')?.state.drag); return read(); };
    const moveTo = async (point, steps = 10) => {
      await page.mouse.move(point.x, point.y, { steps });
      await page.waitForFunction(({ x, y }) => { const at = rotateView('.classic-view')?.state.drag?.lastMove?.rawEnd; return !!at && Math.abs(at.x - x) < .1 && Math.abs(at.y - y) < .1; }, { x: point.x - box.x, y: point.y - box.y });
      return read();
    };
    const degreesReach = value => page.waitForFunction(value => Math.abs((rotateView('.classic-view')?.state.drag?.rotationDrag?.degrees ?? NaN) - value) < .01, value);
    const released = () => page.waitForFunction(() => !rotateView('.classic-view')?.state.drag);
    const release = async () => { await page.mouse.up(); await released(); };
    const documentNow = () => page.evaluate(() => documentNow());
    return { page, surface, sidebar, box, start, read, begin, moveTo, degreesReach, released, release, documentNow };
  }

  // Marquee in the current view, optionally with a key held from before the press.
  async function marquee(page, box, [x0, y0, x1, y1], key) {
    if (key) await page.keyboard.down(key);
    await page.mouse.move(box.x + box.width * x0, box.y + box.height * y0); await page.mouse.down();
    await page.mouse.move(box.x + box.width * x1, box.y + box.height * y1, { steps: 6 }); await page.mouse.up();
    if (key) await page.keyboard.up(key);
    await settle(page, 80);
    return page.evaluate(() => selectedVertexIds('.classic-view'));
  }
  const LEFT_BOX = [.2, .15, .49, .9], RIGHT_BOX = [.51, .15, .8, .9];

  // ---- The UV Wrapper.
  async function openUV(page) {
    await page.getByLabel('Select geoset 0', { exact: true }).waitFor();
    await page.locator('[data-hotkey="geosetsClear"]').click();
    await page.getByLabel('Select geoset 0', { exact: true }).check();
    await page.getByLabel('3D model viewport', { exact: true }).click();
    await page.keyboard.press('Control+a');
    await page.locator('[data-hotkey="uv"]').click();
    const uv = page.locator('.uv-tab-window'), canvas = uv.locator('.uv-editor canvas');
    await canvas.waitFor();
    await page.evaluate(() => {
      window.uvState = () => findFiberState('.uv-editor', s => s?.uv && s?.draw, { last: true });
      window.uvProps = () => findFiberProps('.uv-editor', p => p?.geoset && p?.onSelectVertices);
      window.uvInfo = () => ({ ids: Array.from(uvProps().selectedVertices), uv: Array.from(uvState().uv) });
      window.uvAngle = () => {
        const { ids, uv: base, center: [cu, cv], sizeX, sizeY } = window.uvBaseInfo, uv = uvState().uv;
        let best = ids[0], length = 0;
        for (const i of ids) { const size = ((base[i * 2] - cu) * sizeX) ** 2 + ((base[i * 2 + 1] - cv) * sizeY) ** 2; if (size > length) { length = size; best = i; } }
        const a = (base[best * 2] - cu) * sizeX, b = (base[best * 2 + 1] - cv) * sizeY, c = (uv[best * 2] - cu) * sizeX, d = (uv[best * 2 + 1] - cv) * sizeY;
        return Math.atan2(a * d - b * c, a * c + b * d);
      };
    });
    await page.waitForFunction(() => uvInfo().ids.length > 2);
    return { uv, canvas };
  }
  async function uvRig(page, { uv, canvas }, tool) {
    await uv.getByRole('button', { name: tool, exact: true }).click();
    const box = await canvas.boundingBox(), before = await page.evaluate(() => uvInfo());
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    const map = await page.evaluate(() => { const d = uvState().drag; return { pivot: d.pivotScreen, center: d.center, sizeX: d.sizeX, sizeY: d.sizeY }; });
    await page.mouse.up();
    await page.evaluate(({ map, before }) => { window.uvBaseInfo = { ids: before.ids, uv: before.uv, center: map.center, sizeX: map.sizeX, sizeY: map.sizeY }; }, { map, before });
    const cx = box.x + map.pivot[0], cy = box.y + map.pivot[1];
    const applied = () => page.waitForFunction(() => { const s = uvState(), d = s.drag, p = s.pendingMove?.rawEnd; return !!d && !!p && Math.abs(d.endX - (d.x + (p.x - d.x) * d.pointerSensitivity)) < .01; }, undefined, { polling: 16 });
    const press = async angle => { await page.mouse.move(cx + 100 * Math.cos(angle), cy + 100 * Math.sin(angle)); await page.mouse.down(); };
    const arc = async (from, sweep) => { const steps = Math.max(12, Math.ceil(Math.abs(sweep) / (Math.PI / 24))); for (let i = 1; i <= steps; i++) { const a = from + sweep * i / steps; await page.mouse.move(cx + 100 * Math.cos(a), cy + 100 * Math.sin(a)); } await applied(); };
    const angleReach = degrees => page.waitForFunction(value => Math.abs(uvAngle() - value) < .002, degrees * RAD, { polling: 16 });
    const release = async () => { await page.mouse.up(); await page.waitForFunction(() => !uvState().drag, undefined, { polling: 16 }); };
    return { box, before, cx, cy, press, arc, angleReach, release };
  }

  // ---- Untouched profile: today's keys.
  await test('defaults', {}, async ({ page }) => {
    const r = await openVertices(page, 'Rotate');
    let info = await r.begin();
    near('Default: Rotate follows the mouse', (await r.moveTo(along(r.start, info.tangent, 40))).degrees, 40);
    await page.keyboard.down('Shift');
    near('Default: Shift slows Rotate', (await r.moveTo(along(r.start, info.tangent, 140))).degrees, 50);
    await page.keyboard.up('Shift');
    await page.keyboard.down('Alt');
    near('Default: Alt mid-drag does nothing to Rotate', (await r.moveTo(along(r.start, info.tangent, 150))).degrees, 60);
    check('Default: Alt mid-drag shows no key hints', await page.evaluate(() => keyHintsShown()), false);
    await page.keyboard.up('Alt');
    await r.release();
    await page.keyboard.press('Control+z');
    await r.sidebar.getByRole('button', { name: 'Select', exact: true }).click();
    const box = r.box, baseCamera = await page.evaluate(() => cameraNow('.classic-view'));
    const left = await marquee(page, box, LEFT_BOX), both = await marquee(page, box, RIGHT_BOX, 'Shift');
    check('Default: a marquee selects something', left.length > 0, true);
    check('Default: Shift adds to the selection', left.every(id => both.includes(id)) && both.length > left.length, true);
    const back = await marquee(page, box, RIGHT_BOX, 'Control');
    check('Default: Ctrl removes from the selection', isDeepStrictEqual(back, left), true);
    await marquee(page, box, [.6, .3, .7, .5], 'Alt');
    check('Default: Alt+drag rotates the camera', isDeepStrictEqual(await page.evaluate(() => cameraNow('.classic-view')), baseCamera), false);
    check('Default: a camera drag leaves the selection', isDeepStrictEqual(await page.evaluate(() => selectedVertexIds('.classic-view')), left), true);
  });

  // ---- 3D with Fine on Alt, Snap on Shift, and rebound selection and camera keys.
  const REBOUND = { 'drag.rotate.fine': 'Alt', 'drag.rotate.snap': 'Shift', 'select.add': 'Alt', 'select.remove': 'Shift', 'view.orbit': 'Ctrl', 'drag.uv.fine': 'Alt', 'drag.uv.snap': 'Shift', 'drag.uv.pressFine': 'Ctrl' };
  await test('rebound-3d', { modifiers: REBOUND, rotation: { snap: 15 } }, async ({ page }) => {
    const r = await openVertices(page, 'Rotate');
    let info = await r.begin();
    near('Rebound: Rotate follows the mouse', (await r.moveTo(along(r.start, info.tangent, 40))).degrees, 40);
    await page.keyboard.down('Alt');
    near('Rebound: Alt is now Fine control', (await r.moveTo(along(r.start, info.tangent, 140))).degrees, 50);
    check('Rebound: Fine on Alt shows no key hints', await page.evaluate(() => keyHintsShown()), false);
    await page.keyboard.up('Alt');
    await page.keyboard.down('Shift'); await r.degreesReach(45);
    check('Rebound: Shift is now Snap, and the key alone redraws', true);
    await page.keyboard.up('Shift'); await r.degreesReach(50);
    check('Rebound: letting Snap go returns the real turn', true);
    near('Rebound: Shift no longer slows the drag', (await r.moveTo(along(r.start, info.tangent, 150))).degrees, 60);
    await page.keyboard.down('Control');
    near('Rebound: Ctrl no longer snaps', (await r.moveTo(along(r.start, info.tangent, 157))).degrees, 67);
    await page.keyboard.up('Control');
    await r.release();
    await page.keyboard.press('Control+z');
    await r.sidebar.getByRole('button', { name: 'Select', exact: true }).click();
    const box = r.box, baseCamera = await page.evaluate(() => cameraNow('.classic-view'));
    const left = await marquee(page, box, LEFT_BOX), both = await marquee(page, box, RIGHT_BOX, 'Alt');
    check('Rebound: a marquee selects something', left.length > 0, true);
    check('Rebound: Alt adds to the selection', left.every(id => both.includes(id)) && both.length > left.length, true);
    check('Rebound: Alt no longer rotates the camera', isDeepStrictEqual(await page.evaluate(() => cameraNow('.classic-view')), baseCamera), true);
    check('Rebound: Shift removes from the selection', isDeepStrictEqual(await marquee(page, box, RIGHT_BOX, 'Shift'), left), true);
    await marquee(page, box, [.6, .3, .7, .5], 'Control');
    check('Rebound: Ctrl+drag rotates the camera', isDeepStrictEqual(await page.evaluate(() => cameraNow('.classic-view')), baseCamera), false);
    check('Rebound: the camera drag leaves the selection', isDeepStrictEqual(await page.evaluate(() => selectedVertexIds('.classic-view')), left), true);
  });

  // Selection keeps its default keys here, so Shift at the press starts a Rotate rather than a removal.
  // Fine moves off Shift as the Hotkeys table's Replace would make it: Shift means Snap and nothing else.
  await test('snap-key-latch', { modifiers: { 'drag.rotate.fine': 'Alt', 'drag.rotate.snap': 'Shift' }, rotation: { snap: 15 } }, async ({ page }) => {
    const r = await openVertices(page, 'Rotate');
    await page.keyboard.down('Shift');
    const info = await r.begin();
    near('Latch: Snap held from before the press waits for a release', (await r.moveTo(along(r.start, info.tangent, 37))).degrees, 37);
    await page.keyboard.up('Shift'); await r.degreesReach(37);
    await page.keyboard.down('Shift'); await r.degreesReach(30);
    check('Latch: pressed again after one release, Snap snaps', true);
    await page.keyboard.up('Shift');
    await r.release();
  });

  await test('rebound-uv', { modifiers: REBOUND, uvDrag: CIRCLE_UV }, async ({ page }) => {
    const opened = await openUV(page), r = await uvRig(page, opened, 'Rotate');
    await r.press(0); await r.arc(0, 37 * RAD);
    await r.angleReach(37); check('Rebound UV: the turn follows the mouse', true);
    await page.keyboard.down('Shift'); await r.angleReach(30);
    check('Rebound UV: pressing Snap alone updates the drag at once', true);
    await page.keyboard.up('Shift'); await r.angleReach(37);
    check('Rebound UV: letting Snap go alone returns the real angle', true);
    await page.keyboard.down('Control'); await settle(page, 60);
    near('Rebound UV: Ctrl no longer snaps', await page.evaluate(() => uvAngle()), 37 * RAD, .002);
    await page.keyboard.up('Control');
    await page.keyboard.down('Alt'); await r.arc(37 * RAD, 20 * RAD);
    await r.angleReach(41); check('Rebound UV: Alt is now Fine control', true);
    await page.keyboard.up('Alt');
    await r.release();
    await page.keyboard.press('Control+z');
    await page.waitForFunction(({ uv }) => uvState().uv.every((v, i) => Math.abs(v - uv[i]) < 1e-6), { uv: r.before.uv });
    await page.keyboard.down('Shift'); await r.press(0); await r.arc(0, 37 * RAD);
    await r.angleReach(37); check('Rebound UV: Snap held from before the press does not snap', true);
    await page.keyboard.up('Shift'); await r.angleReach(37);
    await page.keyboard.down('Shift'); await r.angleReach(30);
    check('Rebound UV: pressed again after one release, Snap snaps', true);
    await page.keyboard.up('Shift');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !uvState().drag, undefined, { polling: 16 });
    await page.mouse.up();
    await page.keyboard.down('Control'); await r.press(0); await r.arc(0, 45 * RAD);
    await r.angleReach(45 * .2); check('Rebound UV: Start fine follows its key', true);
    await page.keyboard.up('Control');
    await page.keyboard.press('Escape'); await page.mouse.up();
  });

  await test('default-uv-snap', { uvDrag: CIRCLE_UV }, async ({ page }) => {
    const opened = await openUV(page), r = await uvRig(page, opened, 'Rotate');
    await r.press(0); await r.arc(0, 37 * RAD);
    await page.keyboard.down('Control'); await r.angleReach(30);
    check('Default UV: Ctrl alone updates the drag at once', true);
    await page.keyboard.up('Control'); await r.angleReach(37);
    check('Default UV: letting Ctrl go alone returns the real angle', true);
    await page.keyboard.press('Escape'); await page.mouse.up();
    await page.keyboard.down('Control'); await r.press(0); await r.arc(0, 37 * RAD);
    await r.angleReach(37); check('Default UV: Ctrl held from before the press does not snap', true);
    await page.keyboard.up('Control'); await page.keyboard.press('Escape'); await page.mouse.up();
  });

  // ---- The Hotkeys table, wired from modifierRows.
  await test('conflict', {}, async ({ page }) => {
    await page.getByLabel('3D model viewport', { exact: true }).waitFor();
    await page.keyboard.press('Control+,');
    const settings = page.getByRole('dialog', { name: 'Settings', exact: true });
    await settings.waitFor();
    await settings.getByRole('tab', { name: 'Hotkeys', exact: true }).click();
    await settings.getByLabel('Hotkeys category', { exact: true }).selectOption('Mouse drag keys');
    const fine = settings.getByLabel('Fine control key, Rotate', { exact: true });
    check('Conflict: the row starts at the default', await fine.inputValue(), 'Shift');
    await fine.selectOption('Ctrl');
    const sentence = settings.locator('.hotkeys-conflict');
    await sentence.waitFor();
    check('Conflict: the sentence names the other meaning', (await sentence.innerText()).includes('Snap to steps'), true);
    check('Conflict: nothing is saved yet', (await page.evaluate(async () => (await window.desktop.getSettings()).preferences.modifiers)) ?? {}, {});
    await settings.getByRole('button', { name: /^Replace/ }).click();
    // waitForFunction does not wait for an async predicate, so the saved value is polled here.
    const savedModifiers = () => page.evaluate(async () => (await window.desktop.getSettings()).preferences.modifiers);
    for (let tries = 0; tries < 100 && (await savedModifiers())?.['drag.rotate.fine'] !== 'Ctrl'; tries++) await page.waitForTimeout(100);
    check('Conflict: Replace moves the key and clears the other', await savedModifiers(), { 'drag.rotate.fine': 'Ctrl', 'drag.rotate.snap': '' });
  });

  // ---- Keys pressed while the mouse is holding a drag.
  await test('mid-drag-keys', {}, async ({ page }) => {
    const r = await openVertices(page, 'Move');
    const movePoint = { x: r.start.x + 40, y: r.start.y + 10 };
    await r.begin(); await r.moveTo({ x: r.start.x + 25, y: r.start.y }); await r.release();
    const earlier = await r.documentNow();
    await r.begin(); await r.moveTo(movePoint);
    const during = async label => {
      check(label + ': the document did not change', await r.documentNow(), earlier);
      check(label + ': the drag is still running', (await r.read()).dragging, true);
    };
    for (const [key, label] of [['Delete', 'Delete'], ['Control+z', 'Ctrl+Z'], ['Control+y', 'Ctrl+Y'], ['Control+v', 'Ctrl+V'], ['F2', 'F2'], ['r', 'R'], ['Alt+m', 'Alt+M']]) {
      await page.keyboard.press(key); await settle(page, 60);
      await during(`Mid-drag ${label}`);
    }
    check('Mid-drag tool key: the tool did not change', (await r.read()).transformMode, 'translate');
    await r.release();
    check('Mid-drag: the release commits', await r.documentNow() !== earlier, true);
    await page.keyboard.press('Control+z');
    await page.waitForFunction(value => documentNow() === value, earlier);
    check('Mid-drag: one Ctrl+Z undoes exactly this drag, no half state', true);

    await r.begin(); await r.moveTo(movePoint);
    await page.keyboard.press('Escape');
    await r.released();
    await page.mouse.up();
    check('Esc cancels the drag first and changes nothing', await r.documentNow(), earlier);

    await r.begin(); await r.moveTo(movePoint);
    await page.keyboard.down('Alt'); await page.keyboard.up('Alt');
    check('Alt tapped mid-drag shows no key hints', await page.evaluate(() => keyHintsShown()), false);
    await page.keyboard.press('Escape'); await r.released(); await page.mouse.up();
    await page.keyboard.press('r');
    await page.waitForFunction(() => rotateRead('.classic-view').transformMode === 'rotate');
    check('Alt tapped mid-drag arms nothing: the next key is itself', true);
    await page.keyboard.press('m');

    const opened = await openUV(page), uv = await uvRig(page, opened, 'Move');
    const beforeUV = await page.evaluate(() => JSON.stringify(Array.from(uvState().uv)));
    await page.mouse.move(uv.cx + 40, uv.cy + 40); await page.mouse.down();
    await page.mouse.move(uv.cx + 90, uv.cy + 60, { steps: 8 });
    for (const key of ['Delete', 'Control+z', 'Control+y', 'F3']) await page.keyboard.press(key);
    await settle(page, 80);
    check('UV mid-drag keys: the drag is still running', await page.evaluate(() => !!uvState().drag), true);
    await page.mouse.up();
    await page.waitForFunction(() => !uvState().drag, undefined, { polling: 16 });
    check('UV mid-drag keys: the release commits', await page.evaluate(() => JSON.stringify(Array.from(uvState().uv))) !== beforeUV, true);
    await page.keyboard.press('Control+z');
    await page.waitForFunction(value => JSON.stringify(Array.from(uvState().uv)) === value, beforeUV);
    check('UV mid-drag keys: one Ctrl+Z restores the exact UVs', true);
  });

  assert.equal(Buffer.compare(fs.readFileSync(footman), originalFile), 0, 'the fixture file is untouched');
  const report = { ok: !failures.length && !errors.length, bundle, checks, failures, errors };
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: report.ok, checks: checks.length, failures, errors }, null, 2));
  process.exit(report.ok ? 0 : 1);
})().catch(error => { console.error(error); process.exit(1); });
