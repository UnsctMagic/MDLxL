const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { isDeepStrictEqual } = require('node:util');
const { launchApp, closeApp, bundleHashes } = require('./helpers/app.cjs');
const { fixturePath } = require('./helpers/fixtures.cjs');

// Settings -> Mouse -> UV and the Each piece toggle on the packaged UV Wrapper.
// Real mouse and keyboard only, focus left where real clicks leave it; probes only read state.
// See docs/UV-ROTATE-ZOOM.md and docs/agent-tasks/uv-drag-settings.md.
const OWNER_MOUSE = { pointerSensitivity: 1.22, uvSensitivity: 1.7, fineSensitivity: .2, rotation: { behavior: 'ring', sensitivity: .3, editors: {} } };
const RAD = Math.PI / 180;

(async () => {
  const out = path.resolve(process.env.MDLXL_UV_SETTINGS_OUT || 'out/uv-drag-settings');
  fs.mkdirSync(out, { recursive: true });
  const fixture = fixturePath('footman'), originalFile = fs.readFileSync(fixture);
  const checks = [], errors = [], measurements = [], failures = [], bundle = bundleHashes();
  const check = (label, actual, expected = true) => { assert.deepEqual(actual, expected, label); checks.push(label); console.log('PASS ' + label); };
  const near = (label, actual, expected, tolerance) => {
    assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected} (within ${tolerance}), got ${actual}`);
    checks.push(label); console.log(`PASS ${label} [${Number(actual).toFixed(5)}]`);
  };
  const args = ['--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-gpu-vsync', '--disable-frame-rate-limit'];
  const shot = (page, name) => page.screenshot({ path: path.join(out, name + '.png') });

  // Each session is its own app start, so a seeded preference is what the app read at launch.
  async function session(name, preferences, body, { profile, keepProfile = false, bounds = { x: 0, y: 0, width: 1440, height: 1000 } } = {}) {
    const settings = preferences ? { preferences: { ...OWNER_MOUSE, graphics: { pauseWhenHidden: false }, ...preferences } } : undefined;
    const launched = await launchApp({ fixture, out, errors, bounds, args, profile, settings });
    console.log('SESSION ' + name);
    try { return await body(launched); }
    catch (error) { await launched.page.screenshot({ path: path.join(out, 'failure-' + name + '.png') }).catch(() => {}); throw error; }
    finally { await closeApp(launched.app, { keepProfile }); }
  }
  // One failed session does not hide what the others would have shown.
  async function test(name, preferences, body, options) {
    try { await session(name, preferences, body, options); }
    catch (error) { failures.push({ session: name, message: error.message }); console.log('FAIL ' + name + ': ' + error.message); }
  }

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
      window.uvCamera = () => { const s = mdlxlProbe('.uv-tab-window .game-preview-root').runtime; return s ? { quaternion: s.controls.object.quaternion.toArray(), position: s.controls.object.position.toArray(), zoom: s.controls.object.zoom } : null; };
      // Size of the selection as drawn: the farthest selected point, and how far any other point is from that size.
      window.uvFactorNow = () => {
        const base = window.uvBaseInfo, uv = uvState().uv, [cu, cv] = base.center;
        let best = 0, factor = 0, spread = 0;
        for (const i of base.ids) { const du = base.uv[i * 2] - cu, dv = base.uv[i * 2 + 1] - cv, length = du * du + dv * dv; if (length > best) { best = length; factor = ((uv[i * 2] - cu) * du + (uv[i * 2 + 1] - cv) * dv) / length; } }
        for (const i of base.ids) spread = Math.max(spread, Math.abs(uv[i * 2] - (cu + (base.uv[i * 2] - cu) * factor)), Math.abs(uv[i * 2 + 1] - (cv + (base.uv[i * 2 + 1] - cv) * factor)));
        return { factor, spread };
      };
      window.uvSpots = () => { const base = window.uvBaseInfo, uv = uvState().uv; return new Set(base.ids.map(i => uv[i * 2] + ',' + uv[i * 2 + 1])).size; };
    });
    await page.waitForFunction(() => uvCamera() && uvInfo().ids.length > 2);
    return { uv, canvas };
  }

  // Reads the map transform from a stationary press in the active tool, which edits nothing.
  async function rig(page, { uv, canvas }, tool) {
    await uv.getByRole('button', { name: tool, exact: true }).click();
    const box = await canvas.boundingBox(), before = await page.evaluate(() => uvInfo());
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    const map = await page.evaluate(() => { const d = uvState().drag; return { pivot: d.pivotScreen, center: d.center, sizeX: d.sizeX, sizeY: d.sizeY, reach: d.reach }; });
    await page.mouse.up();
    const cx = box.x + map.pivot[0], cy = box.y + map.pivot[1];
    await page.evaluate(({ map, before }) => { window.uvBaseInfo = { ids: before.ids, uv: before.uv, center: map.center }; window.uvBaseline = JSON.stringify(__mdlxl.model()); }, { map, before });
    const at = (x, y) => [cx + x, cy + y];
    const read = () => page.evaluate(() => uvInfo());
    const applied = () => page.waitForFunction(() => { const s = uvState(), d = s.drag, p = s.pendingMove?.rawEnd; return !!d && !!p && Math.abs(d.endX - (d.x + (p.x - d.x) * d.pointerSensitivity)) < .01 && Math.abs(d.endY - (d.y + (p.y - d.y) * d.pointerSensitivity)) < .01; }, undefined, { polling: 16 });
    const released = () => page.waitForFunction(() => !uvState().drag && Array.from(uvProps().geoset.TVertices[0]).every((v, i) => v === uvState().uv[i]), undefined, { polling: 16 });
    const factorNow = () => page.evaluate(() => uvFactorNow());
    const spots = () => page.evaluate(() => uvSpots());
    const turn = () => page.evaluate(() => uvState().drag.turn);
    const press = async (x, y) => { await page.mouse.move(...at(x, y)); await page.mouse.down(); };
    const moveTo = async (x, y, steps = 10) => { await page.mouse.move(...at(x, y), { steps }); await applied(); };
    const arc = async (radius, start, sweep) => {
      const steps = Math.max(12, Math.ceil(Math.abs(sweep) / (Math.PI / 24)));
      for (let i = 1; i <= steps; i++) { const angle = start + sweep * i / steps; await page.mouse.move(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)); }
      await applied();
    };
    const release = async () => { await page.mouse.up(); await released(); };
    const undo = async label => {
      await page.keyboard.press('Control+z');
      await page.waitForFunction(() => JSON.stringify(__mdlxl.model()) === window.uvBaseline, undefined, { polling: 50 });
      check(label, (await read()).uv, before.uv);
    };
    const rotated = (angle, pieceCentre = () => map.center) => {
      const values = before.uv.slice();
      for (const i of before.ids) {
        const [cu, cv] = pieceCentre(i), x = (before.uv[i * 2] - cu) * map.sizeX, y = (before.uv[i * 2 + 1] - cv) * map.sizeY;
        values[i * 2] = cu + (x * Math.cos(angle) - y * Math.sin(angle)) / map.sizeX;
        values[i * 2 + 1] = cv + (x * Math.sin(angle) + y * Math.cos(angle)) / map.sizeY;
      }
      return values;
    };
    const scaled = (factor, pieceCentre = () => map.center) => {
      const values = before.uv.slice();
      for (const i of before.ids) { const [cu, cv] = pieceCentre(i); values[i * 2] = cu + (before.uv[i * 2] - cu) * factor; values[i * 2 + 1] = cv + (before.uv[i * 2 + 1] - cv) * factor; }
      return values;
    };
    const maxError = (actual, expected) => Math.max(...actual.map((v, i) => Math.abs(v - expected[i])));
    return { box, before, map, cx, cy, at, read, applied, factorNow, spots, turn, press, moveTo, arc, release, undo, rotated, scaled, maxError };
  }

  const setting = (page, key) => page.evaluate(async key => (await window.desktop.getSettings()).preferences[key], key);
  const waitForSaved = async (page, key, value) => {
    let current;
    for (let tries = 0; tries < 100; tries++) { current = await setting(page, key); if (isDeepStrictEqual(current, value)) return; await page.waitForTimeout(100); }
    assert.fail(`${key} was not saved as ${JSON.stringify(value)}, still ${JSON.stringify(current)}`);
  };

  // A zoom drag held to an end point: live size, committed size, one undo.
  async function zoomCase(r, label, from, to, factor, tolerance = .002) {
    await r.press(...from);
    await r.moveTo(...to);
    const live = await r.factorNow();
    near(label + ': live size', live.factor, factor, tolerance);
    assert.ok(live.spread < 1e-5, label + ': the selection keeps its shape, spread ' + live.spread);
    await r.release();
    const after = await r.factorNow();
    near(label + ': committed size', after.factor, factor, tolerance);
    await r.undo(label + ': one Ctrl+Z restores the exact UVs');
  }
  async function circleCase(r, page, label, radius, start, sweep, expected, tolerance = .002) {
    await page.mouse.move(r.cx + radius * Math.cos(start), r.cy + radius * Math.sin(start));
    await page.mouse.down();
    await r.arc(radius, start, sweep);
    const turn = await r.turn();
    near(label + ': turn', turn, expected, tolerance);
    await r.release();
    assert.ok(r.maxError((await r.read()).uv, r.rotated(turn)) < .002, label + ': committed UVs do not match the turn');
    await r.undo(label + ': one Ctrl+Z restores the exact UVs');
  }
  async function sideCase(r, label, from, dx, dy, expected) {
    await r.press(...from);
    await r.moveTo(from[0] + dx, from[1] + dy, 12);
    const turn = await r.turn();
    near(label + ': turn', turn, expected, .002);
    await r.release();
    if (expected !== 0) {
      assert.ok(r.maxError((await r.read()).uv, r.rotated(expected)) < .002, label + ': committed UVs do not match the turn');
      await r.undo(label + ': one Ctrl+Z restores the exact UVs');
    }
  }

  const sides = [['right', 1, 0], ['left', -1, 0], ['above', 0, -1], ['below-left', -Math.SQRT1_2, Math.SQRT1_2]];

  // ---- Zoom, the new default: nothing seeded under uvDrag, the owner's mouse numbers.
  await test('zoom-default', {}, async ({ page }) => {
    const opened = await openUV(page), { uv } = opened;
    const toggle = uv.getByRole('button', { name: 'Each piece', exact: true });
    check('Each piece is visible in Tools by default', await uv.getByRole('region', { name: 'UV tools' }).getByRole('button', { name: 'Each piece', exact: true }).isVisible());
    check('Each piece starts unpressed', await toggle.getAttribute('aria-pressed'), 'false');
    const r = await rig(page, opened, 'Zoom'), sensitivity = 1.7;
    const size = (distance, grab = 120) => Math.max(0, 1 + (distance - grab) / grab * sensitivity);
    for (const [side, x, y] of sides) {
      await zoomCase(r, `default Zoom: dragging away, grabbed ${side} of the centre`, [x * 120, y * 120], [x * 180, y * 180], size(180));
      await zoomCase(r, `default Zoom: dragging toward, grabbed ${side} of the centre`, [x * 120, y * 120], [x * 96, y * 96], size(96));
    }
    for (const [side, x, y] of sides.slice(0, 2).concat(sides.slice(3))) {
      // Reaching the centre: exactly one spot.
      await r.press(x * 120, y * 120);
      await r.moveTo(0, 0, 14);
      check(`default Zoom ${side}: the mouse on the centre puts every point on exactly one spot`, await r.spots(), 1);
      await r.release();
      check(`default Zoom ${side}: released on the centre stays on one spot`, await r.spots(), 1);
      await r.undo(`default Zoom ${side}: one Ctrl+Z after a collapse restores the exact UVs`);
      // Carrying on past the centre, in steps, never grows while held.
      await r.press(x * 120, y * 120);
      await r.moveTo(0, 0, 14);
      let biggest = 0;
      for (let d = 12; d <= 140; d += 8) { await r.moveTo(-x * d, -y * d, 1); biggest = Math.max(biggest, (await r.factorNow()).factor); check(`default Zoom ${side}: ${d} px past the centre still one spot`, await r.spots(), 1); }
      near(`default Zoom ${side}: carrying on past the centre never grows`, biggest, 0, 1e-5);
      // Coming back the way it came, still holding, grows it again.
      await r.moveTo(0, 0, 14);
      check(`default Zoom ${side}: back on the centre still one spot`, await r.spots(), 1);
      await r.moveTo(x * 100, y * 100, 14);
      near(`default Zoom ${side}: coming back while held grows it again`, (await r.factorNow()).factor, size(100), .002);
      await r.moveTo(-x * 140, -y * 140, 14);
      check(`default Zoom ${side}: going past again collapses again`, await r.spots(), 1);
      await r.release();
      check(`default Zoom ${side}: released past the centre stays collapsed`, await r.spots(), 1);
      await r.undo(`default Zoom ${side}: one Ctrl+Z after carrying past restores the exact UVs`);
    }
    // A hand sweep that misses the centre by about 10 px never rebounds.
    for (const offset of [10, -10]) {
      const grab = Math.hypot(120, offset);
      await r.press(120, offset);
      let previous = 1, rebound = 0, zeroFrom = null;
      for (let x = 118; x >= -140; x -= 2) {
        await r.moveTo(x, offset, 1);
        const { factor } = await r.factorNow();
        rebound = Math.max(rebound, factor - previous); previous = factor;
        if (factor < 1e-5 && zeroFrom === null) zeroFrom = x;
      }
      measurements.push({ name: 'default sweep 1.7x', offset, zeroFrom, rebound });
      near(`default Zoom: a sweep ${offset} px off the centre never grows back`, rebound, 0, 1e-6);
      check(`default Zoom: a sweep ${offset} px off the centre ends collapsed`, await r.spots(), 1);
      await r.moveTo(100, offset, 14);
      near(`default Zoom: coming back after the ${offset} px sweep grows it again`, (await r.factorNow()).factor, Math.max(0, 1 + (Math.hypot(100, offset) - grab) / grab * sensitivity), .002);
      await r.moveTo(-140, offset, 14);
      await r.release();
      check(`default Zoom: released after the ${offset} px sweep stays collapsed`, await r.spots(), 1);
      await r.undo(`default Zoom: one Ctrl+Z after the ${offset} px sweep restores the exact UVs`);
    }
    // A press and release that does not move adds no undo step: Ctrl+Z after it removes the real edit before it.
    await r.press(120, 0); await r.moveTo(180, 0); await r.release();
    const edited = (await r.read()).uv;
    await r.press(150, 0); await page.mouse.up();
    await page.waitForFunction(() => !uvState().drag);
    check('default Zoom: a click with no movement changes nothing', (await r.read()).uv, edited);
    await r.undo('default Zoom: a click with no movement adds no undo step');
    // Very near the centre there is no direction to read: right/up for that drag.
    await zoomCase(r, 'default Zoom: a drag starting beside the centre uses right', [5, 0], [55, 0], 1 + 50 * sensitivity / 100);
    await zoomCase(r, 'default Zoom: a drag starting beside the centre uses up', [0, 5], [0, -45], 1 + 50 * sensitivity / 100);
    // Shift changes only the following movement: no jump pressing or releasing it.
    await r.press(120, 0); await r.moveTo(150, 0);
    const held = (await r.factorNow()).factor;
    await page.keyboard.down('Shift');
    near('default Zoom: pressing Shift mid-drag does not jump', (await r.factorNow()).factor, held, 1e-6);
    await r.moveTo(180, 0);
    near('default Zoom: Shift slows the following movement', (await r.factorNow()).factor, held + 30 / 120 * sensitivity * .2, .002);
    await page.keyboard.up('Shift');
    await page.mouse.up(); await page.waitForFunction(() => !uvState().drag);
    await r.undo('default Zoom: one Ctrl+Z after the Shift drag restores the exact UVs');
    // The Rotate default, for the Big pieces contrast below.
    const rotate = await rig(page, opened, 'Rotate');
    assert.ok(rotate.map.reach > 60, 'the whole geoset is bigger than the 60 px circle, reach ' + rotate.map.reach);
    measurements.push({ name: 'default reach', reach: rotate.map.reach });
    await circleCase(rotate, page, 'default Rotate: a quarter circle over a big piece is gentler', 60, 0, Math.PI / 2, Math.PI / 2 * .7 * 60 / rotate.map.reach);
  });

  // At 1x the distance alone sets the size, and a miss by 10 px is still visibly above zero at its closest.
  await test('zoom-1x', { uvSensitivity: 1 }, async ({ page }) => {
    const r = await rig(page, await openUV(page), 'Zoom');
    await zoomCase(r, 'default Zoom at 1x: half the distance is half the size', [120, 0], [60, 0], .5);
    await zoomCase(r, 'default Zoom at 1x: twice the distance is twice the size', [-120, 0], [-240, 0], 2);
    for (const offset of [10, -10]) {
      await r.press(120, offset);
      let previous = 1, rebound = 0, closest = null;
      for (let x = 118; x >= -140; x -= 2) {
        await r.moveTo(x, offset, 1);
        const { factor } = await r.factorNow();
        rebound = Math.max(rebound, factor - previous); previous = factor;
        if (x === 0) closest = factor;
      }
      measurements.push({ name: 'default sweep 1x', offset, closest, rebound });
      near(`default Zoom at 1x: at its closest the ${offset} px sweep is near nothing`, closest, Math.abs(offset) / Math.hypot(120, offset), .01);
      near(`default Zoom at 1x: the ${offset} px sweep never grows back`, rebound, 0, 1e-6);
      check(`default Zoom at 1x: the ${offset} px sweep ends collapsed`, await r.spots(), 1);
      await r.release();
      await r.undo(`default Zoom at 1x: one Ctrl+Z after the ${offset} px sweep restores the exact UVs`);
    }
  });

  // ---- Rotate and Zoom options, each seeded in the profile.
  await test('follow-the-mouse', { uvDrag: { rotateStyle: 'circle', rotateSpeed: 100, rotateZone: 0, rotateBigPieces: false, zoomStyle: 'leftRight' } }, async ({ page }) => {
    const opened = await openUV(page), r = await rig(page, opened, 'Rotate');
    // The 300 px circle starts below the centre, where the press is still on the canvas.
    for (const [radius, tolerance, start] of [[10, .02, 0], [24, .004, 0], [60, .002, 0], [300, .002, Math.PI / 2]]) await circleCase(r, page, `Follow the mouse: a quarter circle at ${radius} px is 90 degrees`, radius, start, Math.PI / 2, Math.PI / 2, tolerance);
    await circleCase(r, page, 'Follow the mouse: counter-clockwise past a full turn', 100, 0, -Math.PI * 2.5, -Math.PI * 2.5);
    const zoom = await rig(page, opened, 'Zoom');
    await zoomCase(zoom, 'Zoom left/right only: right grows', [120, 0], [170, 0], 1 + 50 * 1.7 / 100);
    await zoomCase(zoom, 'Zoom left/right only: left shrinks from the far side too', [-120, 0], [-170, 0], 1 - 50 * 1.7 / 100);
    await zoom.press(120, 0); await zoom.moveTo(120, 60);
    near('Zoom left/right only: up and down do nothing', (await zoom.factorNow()).factor, 1, 1e-6);
    await zoom.release();
    await zoomCase(zoom, 'Zoom left/right only: far enough left collapses', [120, 0], [0, 0], 0);
  });
  await test('left-right', { uvDrag: { rotateStyle: 'leftRight', rotateSpeed: 100, zoomSpeed: 200 } }, async ({ page }) => {
    const opened = await openUV(page), r = await rig(page, opened, 'Rotate');
    await sideCase(r, 'Left/right drag: 90 px right is 90 degrees', [60, 0], 90, 0, 90 * RAD);
    await sideCase(r, 'Left/right drag: 45 px left is minus 45 degrees', [60, 0], -45, 0, -45 * RAD);
    await sideCase(r, 'Left/right drag: the same from elsewhere', [-200, 150], 90, 0, 90 * RAD);
    await sideCase(r, 'Left/right drag: up and down do nothing', [60, 0], 0, 70, 0);
    // Right is clockwise on screen: a point right of the centre moves down.
    const { before, map } = r, rightmost = before.ids.reduce((best, i) => before.uv[i * 2] > before.uv[best * 2] ? i : best, before.ids[0]);
    const offset = [(before.uv[rightmost * 2] - map.center[0]) * map.sizeX, (before.uv[rightmost * 2 + 1] - map.center[1]) * map.sizeY];
    assert.ok(map.sizeY > 0, 'the UV map draws v downward');
    await r.press(60, 0); await r.moveTo(150, 0, 12); await r.release();
    const after = (await r.read()).uv, moved = [(after[rightmost * 2] - map.center[0]) * map.sizeX, (after[rightmost * 2 + 1] - map.center[1]) * map.sizeY];
    near('Left/right drag: right is clockwise (x)', moved[0], -offset[1], .5);
    near('Left/right drag: right is clockwise (y)', moved[1], offset[0], .5);
    await r.undo('Left/right drag: one Ctrl+Z restores the exact UVs');
    const zoom = await rig(page, opened, 'Zoom');
    await zoomCase(zoom, 'Zoom speed 200%: away grows twice as fast', [120, 0], [150, 0], 1 + 30 / 120 * 1.7 * 2);
    await zoomCase(zoom, 'Zoom speed 200%: toward shrinks twice as fast', [0, 120], [0, 108], 1 - 12 / 120 * 1.7 * 2);
  });
  await test('reverse-and-size-snap', { uvDrag: { rotateStyle: 'leftRight', rotateReverse: true, rotateSpeed: 50, zoomSnap: 25 } }, async ({ page }) => {
    const opened = await openUV(page), r = await rig(page, opened, 'Rotate');
    await sideCase(r, 'Reverse at 50%: 90 px right is 45 degrees counter-clockwise', [60, 0], 90, 0, -45 * RAD);
    await sideCase(r, 'Reverse at 50%: 90 px left is 45 degrees clockwise', [60, 0], -90, 0, 45 * RAD);
    const zoom = await rig(page, opened, 'Zoom'), real = d => 1 + (d - 120) / 120 * 1.7;
    await page.keyboard.down('Control');
    await zoom.press(120, 0); await zoom.moveTo(150, 0);
    near('Size snap 25%: Ctrl held rounds to the step', (await zoom.factorNow()).factor, 1.5, 1e-5);
    await zoom.moveTo(160, 0);
    near('Size snap 25%: Ctrl held rounds to the next step', (await zoom.factorNow()).factor, 1.5, 1e-5);
    await page.keyboard.up('Control');
    await zoom.moveTo(161, 0, 1);
    near('Size snap 25%: releasing Ctrl mid-drag returns to the real size', (await zoom.factorNow()).factor, real(161), .002);
    await page.keyboard.down('Control');
    await zoom.moveTo(186, 0, 1);
    near('Size snap 25%: pressing Ctrl mid-drag snaps again', (await zoom.factorNow()).factor, 2, 1e-5);
    await zoom.release();
    near('Size snap 25%: releasing the mouse with Ctrl held keeps the snapped size', (await zoom.factorNow()).factor, 2, 1e-5);
    await page.keyboard.up('Control');
    await zoom.undo('Size snap 25%: one Ctrl+Z restores the exact UVs');
    // Without Ctrl the setting does nothing.
    await zoomCase(zoom, 'Size snap 25%: no snap without Ctrl', [120, 0], [150, 0], real(150));
  });
  await test('deadzone', { uvDrag: { rotateStyle: 'circle', rotateSpeed: 100, rotateZone: 60, rotateBigPieces: false } }, async ({ page }) => {
    const r = await rig(page, await openUV(page), 'Rotate');
    await circleCase(r, page, 'Deadzone 60 px: half the zone turns half as far', 30, 0, Math.PI / 2, Math.PI / 4, .004);
    await circleCase(r, page, 'Deadzone 60 px: outside the zone turns fully', 120, 0, Math.PI / 2, Math.PI / 2);
    await page.keyboard.down('Control');
    await circleCase(r, page, 'Deadzone 60 px: Ctrl does nothing with Angle snap off', 120, 0, 37 * RAD, 37 * RAD);
    await page.keyboard.up('Control');
  });
  await test('turn-speed', { uvDrag: { rotateStyle: 'circle', rotateSpeed: 150, rotateZone: 24, rotateBigPieces: true } }, async ({ page }) => {
    const r = await rig(page, await openUV(page), 'Rotate');
    await circleCase(r, page, 'Turn speed 150%: a quarter circle outside the piece is 135 degrees', 300, Math.PI / 2, Math.PI / 2, Math.PI / 2 * 1.5);
  });
  await test('big-pieces-off', { uvDrag: { rotateBigPieces: false } }, async ({ page }) => {
    const r = await rig(page, await openUV(page), 'Rotate');
    assert.ok(r.map.reach > 60, 'the whole geoset is bigger than the 60 px circle, reach ' + r.map.reach);
    await circleCase(r, page, 'Big pieces off: a quarter circle over a big piece turns the full 70%', 60, 0, Math.PI / 2, Math.PI / 2 * .7);
    await circleCase(r, page, 'Big pieces off: the 24 px deadzone still applies', 12, 0, Math.PI / 2, Math.PI / 2 * .7 * 12 / 24, .01);
  });
  await test('angle-snap', { uvDrag: { rotateStyle: 'circle', rotateSpeed: 100, rotateZone: 0, rotateBigPieces: false, rotateSnap: 15 } }, async ({ page }) => {
    const r = await rig(page, await openUV(page), 'Rotate'), uvNow = async () => (await r.read()).uv;
    await page.keyboard.down('Control');
    await page.mouse.move(r.cx + 100, r.cy); await page.mouse.down();
    await r.arc(100, 0, 37 * RAD);
    near('Angle snap 15: the real turn keeps counting under Ctrl', await r.turn(), 37 * RAD, .002);
    assert.ok(r.maxError(await uvNow(), r.rotated(30 * RAD)) < .0005, 'Angle snap 15: Ctrl held applies 30 degrees for a 37 degree turn');
    check('Angle snap 15: Ctrl held applies the step, not the real turn', true);
    await page.keyboard.up('Control');
    await r.arc(100, 37 * RAD, 1 * RAD);
    near('Angle snap 15: releasing Ctrl loses nothing', await r.turn(), 38 * RAD, .002);
    assert.ok(r.maxError(await uvNow(), r.rotated(38 * RAD)) < .002, 'Angle snap 15: releasing Ctrl mid-drag returns to the real angle');
    check('Angle snap 15: releasing Ctrl mid-drag returns to the real angle', true);
    await page.keyboard.down('Control');
    await r.arc(100, 38 * RAD, 14 * RAD);
    assert.ok(r.maxError(await uvNow(), r.rotated(45 * RAD)) < .0005, 'Angle snap 15: pressing Ctrl mid-drag snaps to 45 degrees');
    check('Angle snap 15: pressing Ctrl mid-drag snaps again', true);
    await r.release();
    await page.keyboard.up('Control');
    assert.ok(r.maxError(await uvNow(), r.rotated(45 * RAD)) < .0005, 'Angle snap 15: releasing the mouse with Ctrl held commits the step');
    check('Angle snap 15: releasing the mouse with Ctrl held commits the step', true);
    await r.undo('Angle snap 15: one Ctrl+Z restores the exact UVs');
    await circleCase(r, page, 'Angle snap 15: no snap without Ctrl', 100, 0, 37 * RAD, 37 * RAD);
  });

  // ---- The Settings page, by real clicks.
  const openUVSettings = async page => {
    await page.keyboard.press('Control+,');
    const dialog = page.getByRole('dialog', { name: 'Settings', exact: true });
    await dialog.waitFor();
    await dialog.getByRole('tab', { name: 'Mouse', exact: true }).click();
    await dialog.getByRole('navigation', { name: 'Mouse pages' }).getByRole('button', { name: 'UV', exact: true }).click();
    await dialog.getByLabel('UV Rotate preset', { exact: true }).waitFor();
    return dialog;
  };
  const chosen = select => select.evaluate(element => element.selectedOptions[0].textContent);
  const typeNumber = async (page, field, value) => { await field.click({ clickCount: 3 }); await page.keyboard.type(String(value)); await page.keyboard.press('Enter'); };
  const profileDir = path.join(out, 'profile-settings-' + process.pid);
  await test('settings-page', {}, async ({ page }) => {
    const opened = await openUV(page);
    const dialog = await openUVSettings(page);
    const preset = dialog.getByLabel('UV Rotate preset', { exact: true }), style = dialog.getByLabel('UV Rotate drag', { exact: true }), zoomStyle = dialog.getByLabel('UV Zoom drag', { exact: true });
    const speed = dialog.getByLabel('Turn speed', { exact: true }), zone = dialog.getByLabel('Deadzone near centre', { exact: true }), big = dialog.getByLabel('Big pieces turn slower', { exact: true }), reverse = dialog.getByLabel('Reverse direction', { exact: true });
    check('Settings default: preset reads MDLxL (default)', await chosen(preset), 'MDLxL (default)');
    check('Settings default: Zoom reads Away from or toward the centre', await chosen(zoomStyle), 'Away from or toward the centre');
    check('Settings default: Turn speed 70', await speed.inputValue(), '70');
    check('Settings default: Deadzone 24', await zone.inputValue(), '24');
    check('Settings default: Big pieces on', await big.isChecked());
    check('Settings default: Reverse hidden while circling', await reverse.count(), 0);
    await shot(page, 'settings-mouse-uv-default');
    await typeNumber(page, speed, 90);
    await page.waitForFunction(() => document.querySelector('[aria-label="UV Rotate preset"]').selectedOptions[0].textContent === 'Custom');
    check('Settings: changing a Rotate number shows Custom', await chosen(preset), 'Custom');
    await preset.selectOption({ label: 'Freeform' });
    await page.waitForFunction(() => document.querySelector('[aria-label="Turn speed"]').value === '100');
    check('Settings: Freeform fills Turn speed', await speed.inputValue(), '100');
    check('Settings: Freeform fills Deadzone', await zone.inputValue(), '0');
    check('Settings: Freeform fills Big pieces', await big.isChecked(), false);
    check('Settings: Freeform fills How you drag', await chosen(style), 'Circle around the centre');
    check('Settings: Freeform is the preset shown', await chosen(preset), 'Freeform');
    await style.selectOption({ label: 'Left and right' });
    await reverse.waitFor();
    check('Settings Left and right: Deadzone hidden', await zone.count(), 0);
    check('Settings Left and right: Big pieces hidden', await big.count(), 0);
    check('Settings Left and right: Reverse shown', await reverse.isVisible());
    await shot(page, 'settings-mouse-uv-left-right');
    await dialog.getByRole('button', { name: 'Restore UV defaults', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[aria-label="UV Rotate preset"]').selectedOptions[0].textContent === 'MDLxL (default)');
    check('Settings Restore: Turn speed 70', await speed.inputValue(), '70');
    check('Settings Restore: Deadzone 24', await zone.inputValue(), '24');
    check('Settings Restore: Big pieces on', await big.isChecked());
    check('Settings Restore: How you drag', await chosen(style), 'Circle around the centre');
    check('Settings Restore: Zoom', await chosen(zoomStyle), 'Away from or toward the centre');
    await preset.selectOption({ label: 'MDLVis' });
    await page.waitForFunction(() => document.querySelector('[aria-label="UV Zoom drag"]').selectedOptions[0].textContent === 'Up and down only');
    check('Settings: MDLVis fills How you drag', await chosen(style), 'Left and right');
    check('Settings: MDLVis fills Zoom', await chosen(zoomStyle), 'Up and down only');
    await zoomStyle.selectOption({ label: 'Left and right only' });
    await waitForSaved(page, 'uvDrag', { rotateStyle: 'leftRight', rotateSpeed: 100, rotateZone: 0, rotateBigPieces: false, rotateReverse: false, rotateSnap: 0, zoomStyle: 'leftRight', zoomSpeed: 100, zoomSnap: 0 });
    await dialog.getByRole('button', { name: 'Close Settings', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    const r = await rig(page, opened, 'Rotate');
    await sideCase(r, 'A changed setting changes the next drag: 30 px right is 30 degrees', [60, 0], 30, 0, 30 * RAD);
    const zoom = await rig(page, opened, 'Zoom');
    await zoomCase(zoom, 'A changed setting changes the next drag: Zoom right grows', [120, 0], [170, 0], 1 + 50 * 1.7 / 100);
    await zoom.press(120, 0); await zoom.moveTo(120, 70);
    near('A changed setting changes the next drag: Zoom ignores up and down', (await zoom.factorNow()).factor, 1, 1e-6);
    await zoom.release();
  }, { profile: profileDir, keepProfile: true });
  await test('settings-after-restart', null, async ({ page }) => {
    const opened = await openUV(page);
    const dialog = await openUVSettings(page);
    check('Settings after restart: an edited preset still reads Custom', await chosen(dialog.getByLabel('UV Rotate preset', { exact: true })), 'Custom');
    check('Settings after restart: Zoom remembered', await chosen(dialog.getByLabel('UV Zoom drag', { exact: true })), 'Left and right only');
    await dialog.getByRole('button', { name: 'Close Settings', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    const r = await rig(page, opened, 'Rotate');
    await sideCase(r, 'Settings after restart: the saved style still drives the drag', [60, 0], 30, 0, 30 * RAD);
  }, { profile: profileDir });

  // ---- Each piece, with two separate pieces of the map.
  const eachProfile = path.join(out, 'profile-each-' + process.pid);
  async function selectTwoPieces(page, opened) {
    const { uv, canvas } = opened, r = await rig(page, opened, 'Zoom');
    const found = await page.evaluate(map => {
      const p = uvProps(), g = p.geoset, uv = uvState().uv, parent = new Map(), allowed = new Set(p.selectedVertices);
      const find = a => { while (parent.get(a) !== a) { parent.set(a, parent.get(parent.get(a))); a = parent.get(a); } return a; };
      const faces = [], screen = i => [map.pivot[0] + (uv[i * 2] - map.center[0]) * map.sizeX, map.pivot[1] + (uv[i * 2 + 1] - map.center[1]) * map.sizeY];
      for (let f = 0; f < g.Faces.length; f += 3) {
        const tri = [g.Faces[f], g.Faces[f + 1], g.Faces[f + 2]];
        if (!tri.every(i => allowed.has(i))) continue;
        for (const i of tri) if (!parent.has(i)) parent.set(i, i);
        parent.set(find(tri[0]), find(tri[1])); parent.set(find(tri[1]), find(tri[2]));
        faces.push(tri);
      }
      const pieces = new Map();
      for (const i of parent.keys()) { const root = find(i); if (!pieces.has(root)) pieces.set(root, { ids: [], tris: [] }); pieces.get(root).ids.push(i); }
      for (const tri of faces) pieces.get(find(tri[0])).tris.push(tri);
      const inside = (p, [a, b, c]) => { const s = (u, v, w) => (u[0] - w[0]) * (v[1] - w[1]) - (v[0] - w[0]) * (u[1] - w[1]); const d = [s(p, a, b), s(p, b, c), s(p, c, a)]; return !(d.some(x => x < 0) && d.some(x => x > 0)); };
      const list = [...pieces.values()].filter(piece => piece.ids.length >= 4).map(piece => {
        const points = piece.tris.map(tri => ({ tri, s: tri.map(screen) })).map(t => ({ ...t, area: Math.abs((t.s[1][0] - t.s[0][0]) * (t.s[2][1] - t.s[0][1]) - (t.s[2][0] - t.s[0][0]) * (t.s[1][1] - t.s[0][1])) })).sort((a, b) => b.area - a.area);
        for (const candidate of points.slice(0, 12)) {
          const click = [0, 1].map(k => (candidate.s[0][k] + candidate.s[1][k] + candidate.s[2][k]) / 3);
          const stacked = faces.some(tri => !piece.ids.includes(tri[0]) && inside(click, tri.map(screen)));
          const nearest = Math.min(...[...parent.keys()].map(i => { const q = screen(i); return Math.abs(q[0] - click[0]) + Math.abs(q[1] - click[1]); }));
          if (!stacked && nearest > 8) { const centre = [0, 1].map(k => piece.ids.reduce((sum, i) => sum + uv[i * 2 + k], 0) / piece.ids.length); return { ids: piece.ids, click, centre, screenCentre: [map.pivot[0] + (centre[0] - map.center[0]) * map.sizeX, map.pivot[1] + (centre[1] - map.center[1]) * map.sizeY], area: candidate.area }; }
        }
        return null;
      }).filter(Boolean).sort((a, b) => b.ids.length - a.ids.length);
      return list;
    }, r.map);
    measurements.push({ name: 'islands', count: found.length, sizes: found.map(piece => piece.ids.length) });
    assert.ok(found.length >= 2, 'geoset 0 supplies two separate clickable pieces, found ' + found.length);
    // The whole map is only about 125 px wide at the opening zoom: take the two pieces farthest apart.
    let a = null, b = null, gap = 0;
    for (const first of found) for (const second of found) { const apart = Math.hypot(second.screenCentre[0] - first.screenCentre[0], second.screenCentre[1] - first.screenCentre[1]); if (apart > gap) { a = first; b = second; gap = apart; } }
    measurements.push({ name: 'chosen pieces', gap, sizes: [a.ids.length, b.ids.length] });
    assert.ok(gap > 25, 'two pieces at least 25 px apart, got ' + gap);
    const box = await canvas.boundingBox();
    await uv.getByRole('button', { name: 'Select', exact: true }).click();
    await page.mouse.click(box.x + a.click[0], box.y + a.click[1]);
    await page.waitForFunction(ids => uvInfo().ids.every(i => ids.includes(i)) && uvInfo().ids.length === 3, a.ids);
    await page.keyboard.press('Control+e');
    await page.waitForFunction(count => uvInfo().ids.length === count, a.ids.length);
    await page.keyboard.down('Shift');
    await page.mouse.click(box.x + b.click[0], box.y + b.click[1]);
    await page.keyboard.up('Shift');
    await page.waitForFunction(count => uvInfo().ids.length === count + 3, a.ids.length);
    await page.keyboard.press('Control+e');
    await page.waitForFunction(count => uvInfo().ids.length === count, a.ids.length + b.ids.length);
    return { a, b };
  }
  const centreOf = (values, ids) => [0, 1].map(k => ids.reduce((sum, i) => sum + values[i * 2 + k], 0) / ids.length);
  const ownTurn = (r, values, ids, centre) => {
    const angles = [];
    for (const i of ids) {
      const x0 = (r.before.uv[i * 2] - centre[0]) * r.map.sizeX, y0 = (r.before.uv[i * 2 + 1] - centre[1]) * r.map.sizeY, x1 = (values[i * 2] - centre[0]) * r.map.sizeX, y1 = (values[i * 2 + 1] - centre[1]) * r.map.sizeY;
      if (Math.hypot(x0, y0) > 3) angles.push(Math.atan2(y1, x1) - Math.atan2(y0, x0));
    }
    assert.ok(angles.length >= 2, 'a piece has points away from its centre');
    const wrapped = angles.map(angle => Math.atan2(Math.sin(angle), Math.cos(angle)));
    return { mean: wrapped.reduce((sum, angle) => sum + angle, 0) / wrapped.length, spread: Math.max(...wrapped) - Math.min(...wrapped) };
  };
  async function eachPieceChecks(page, opened, { a, b }, toggle) {
    const { uv } = opened, inside = 1e-4;
    const pieceCentreBefore = values => [centreOf(values, a.ids), centreOf(values, b.ids)];
    // Rotate off: the two pieces orbit one shared centre, so both move.
    let r = await rig(page, opened, 'Rotate');
    const start = pieceCentreBefore(r.before.uv), radius = Math.max(r.map.reach, 60) + 20;
    measurements.push({ name: 'each piece shared rotate', reach: r.map.reach, radius, pieces: [a.ids.length, b.ids.length] });
    const off = async label => {
      await page.mouse.move(r.cx + radius, r.cy); await page.mouse.down();
      await r.arc(radius, 0, Math.PI / 2);
      const turn = await r.turn(); await r.release();
      near(label + ': the turn around the shared centre', turn, Math.PI / 2 * .7, .002);
      const after = (await r.read()).uv, centres = pieceCentreBefore(after);
      assert.ok(r.maxError(after, r.rotated(turn)) < .002, label + ': committed UVs orbit the shared centre');
      for (const [piece, index] of [['A', 0], ['B', 1]]) {
        const moved = Math.hypot((centres[index][0] - start[index][0]) * r.map.sizeX, (centres[index][1] - start[index][1]) * r.map.sizeY);
        assert.ok(moved > 3, `${label}: piece ${piece} moved around the shared centre (${moved} px)`);
        check(`${label}: piece ${piece} orbits the shared centre`, true);
      }
      await r.undo(label + ': one Ctrl+Z restores the exact UVs');
    };
    await off('Each piece off, Rotate');
    // Rotate on: each piece's own centre stays and both turn the same.
    await toggle.click();
    check('Each piece: pressed reads aria-pressed true', await toggle.getAttribute('aria-pressed'), 'true');
    check('Each piece: pressed look is visible', await toggle.evaluate(element => getComputedStyle(element).outlineStyle), 'solid');
    await waitForSaved(page, 'uvEachPiece', true);
    r = await rig(page, opened, 'Rotate');
    await page.mouse.move(r.cx + radius, r.cy); await page.mouse.down();
    await r.arc(radius, 0, Math.PI / 2);
    const turn = await r.turn(); await r.release();
    near('Each piece on, Rotate: the turn', turn, Math.PI / 2 * .7, .002);
    let after = (await r.read()).uv, centres = pieceCentreBefore(after);
    near('Each piece on, Rotate: piece A centre stays (u)', centres[0][0], start[0][0], inside);
    near('Each piece on, Rotate: piece A centre stays (v)', centres[0][1], start[0][1], inside);
    near('Each piece on, Rotate: piece B centre stays (u)', centres[1][0], start[1][0], inside);
    near('Each piece on, Rotate: piece B centre stays (v)', centres[1][1], start[1][1], inside);
    const turnA = ownTurn(r, after, a.ids, start[0]), turnB = ownTurn(r, after, b.ids, start[1]);
    measurements.push({ name: 'each piece turns', turn, turnA, turnB });
    near('Each piece on, Rotate: piece A turned by the drag', turnA.mean, turn, .01);
    near('Each piece on, Rotate: piece B turned by the drag', turnB.mean, turn, .01);
    near('Each piece on, Rotate: both pieces turned the same', turnA.mean, turnB.mean, .01);
    near('Each piece on, Rotate: piece A stays rigid', turnA.spread, 0, .05);
    near('Each piece on, Rotate: piece B stays rigid', turnB.spread, 0, .05);
    await r.undo('Each piece on, Rotate: one Ctrl+Z restores the exact UVs');
    // Zoom off, then on.
    await toggle.click();
    check('Each piece: released reads aria-pressed false', await toggle.getAttribute('aria-pressed'), 'false');
    await waitForSaved(page, 'uvEachPiece', false);
    let zoom = await rig(page, opened, 'Zoom');
    const zoomFactor = 1 - 50 / 200 * 1.7;
    await zoom.press(-200, 0); await zoom.moveTo(-150, 0); await zoom.release();
    after = (await zoom.read()).uv; centres = pieceCentreBefore(after);
    assert.ok(zoom.maxError(after, zoom.scaled(zoomFactor)) < .002, 'Each piece off, Zoom: committed UVs shrink toward the shared centre');
    check('Each piece off, Zoom: both pieces shrink toward the shared centre', true);
    for (const [piece, index] of [['A', 0], ['B', 1]]) {
      const moved = Math.hypot((centres[index][0] - start[index][0]) * zoom.map.sizeX, (centres[index][1] - start[index][1]) * zoom.map.sizeY);
      assert.ok(moved > 3, `Each piece off, Zoom: piece ${piece} moved (${moved} px)`);
      check(`Each piece off, Zoom: piece ${piece} moves toward the shared centre`, true);
    }
    await zoom.undo('Each piece off, Zoom: one Ctrl+Z restores the exact UVs');
    await toggle.click();
    await waitForSaved(page, 'uvEachPiece', true);
    zoom = await rig(page, opened, 'Zoom');
    await zoom.press(-200, 0); await zoom.moveTo(-150, 0); await zoom.release();
    after = (await zoom.read()).uv; centres = pieceCentreBefore(after);
    near('Each piece on, Zoom: piece A centre stays (u)', centres[0][0], start[0][0], inside);
    near('Each piece on, Zoom: piece A centre stays (v)', centres[0][1], start[0][1], inside);
    near('Each piece on, Zoom: piece B centre stays (u)', centres[1][0], start[1][0], inside);
    near('Each piece on, Zoom: piece B centre stays (v)', centres[1][1], start[1][1], inside);
    const own = index => (a.ids.includes(index) ? start[0] : start[1]);
    assert.ok(zoom.maxError(after, zoom.scaled(zoomFactor, own)) < .002, 'Each piece on, Zoom: each piece shrinks by the same size around its own centre');
    check('Each piece on, Zoom: each piece shrinks by the same size around its own centre', true);
    await zoom.undo('Each piece on, Zoom: one Ctrl+Z restores the exact UVs');
    // Reaching the centre with Each piece on: every piece on its own single spot.
    await zoom.press(-200, 0); await zoom.moveTo(0, 0, 14); await zoom.release();
    after = (await zoom.read()).uv;
    for (const ids of [a.ids, b.ids]) check('Each piece on, Zoom: reaching the centre leaves a piece on one spot', new Set(ids.map(i => after[i * 2] + ',' + after[i * 2 + 1])).size, 1);
    await zoom.undo('Each piece on, Zoom: one Ctrl+Z after a collapse restores the exact UVs');
    return { uv };
  }
  await test('each-piece', {}, async ({ page }) => {
    const opened = await openUV(page), toggle = opened.uv.getByRole('button', { name: 'Each piece', exact: true });
    const pieces = await selectTwoPieces(page, opened);
    await eachPieceChecks(page, opened, pieces, toggle);
    check('Each piece: left on for the restart', await setting(page, 'uvEachPiece'), true);
  }, { profile: eachProfile, keepProfile: true });
  await test('each-piece-after-restart', null, async ({ page }) => {
    const opened = await openUV(page), toggle = opened.uv.getByRole('button', { name: 'Each piece', exact: true });
    check('Each piece: remembered after a restart', await toggle.getAttribute('aria-pressed'), 'true');
    await opened.uv.getByRole('button', { name: 'Rotate', exact: true }).click();
    const box = await opened.canvas.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    check('Each piece after a restart: a drag uses piece centres', await page.evaluate(() => !!uvState().drag.pieceCenters));
    await page.mouse.up();
  }, { profile: eachProfile });

  // ---- 3D stays out of it.
  const NON_DEFAULT = { uvDrag: { rotateStyle: 'leftRight', rotateSpeed: 200, rotateReverse: true, rotateSnap: 45, zoomStyle: 'leftRight', zoomSpeed: 400, zoomSnap: 25 }, uvEachPiece: true };
  await test('3d-live-view', NON_DEFAULT, async ({ page }) => {
    const opened = await openUV(page), { uv } = opened, toggle = uv.getByRole('button', { name: 'Each piece', exact: true });
    const before = await page.evaluate(() => uvCamera());
    await toggle.click();
    await page.waitForFunction(() => document.querySelector('[data-hotkey="uv:each-piece"]').getAttribute('aria-pressed') === 'false');
    check('3D Live View: toggling Each piece does not touch the camera', await page.evaluate(() => uvCamera()), before);
    const preview = uv.locator('[data-clean-model-canvas]'), box = await preview.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 65, box.y + box.height / 2 + 30, { steps: 8 }); await page.mouse.up();
    await page.waitForFunction(q => JSON.stringify(uvCamera().quaternion) !== JSON.stringify(q), before.quaternion);
    check('3D Live View: a real mouse drag still rotates the camera', (await page.evaluate(() => uvCamera())).quaternion.some((v, i) => v !== before.quaternion[i]));
  });
  // The same real 3D Rotate on vertices, with the default UV settings and with very different ones.
  const mainRotate = async page => {
    await page.getByLabel('Select geoset 0', { exact: true }).waitFor();
    await page.locator('[data-hotkey="geosetsClear"]').click();
    await page.getByLabel('Select geoset 0', { exact: true }).check();
    const sidebar = page.locator('.classic-sidebar'), view = page.locator('.classic-view').getByLabel('3D model viewport', { exact: true });
    await sidebar.getByRole('button', { name: 'Select', exact: true }).click();
    const box = await view.boundingBox();
    await page.mouse.click(box.x + box.width * .7, box.y + box.height * .7);
    await page.keyboard.press('Control+a');
    await sidebar.getByRole('button', { name: 'Rotate', exact: true }).click();
    const before = await page.evaluate(() => Array.from(__mdlxl.model().Geosets[0].Vertices));
    const start = { x: box.x + box.width * .72, y: box.y + box.height * .7 }, end = { x: start.x + 40, y: start.y + 17 };
    await page.mouse.click(start.x, start.y);
    await page.mouse.move(start.x, start.y); await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 12 }); await page.mouse.up();
    await page.waitForFunction(old => Array.from(__mdlxl.model().Geosets[0].Vertices).some((v, i) => Math.abs(v - old[i]) > 1e-3), before);
    return { before, after: await page.evaluate(() => Array.from(__mdlxl.model().Geosets[0].Vertices)) };
  };
  let defaultRotate = null;
  await test('3d-rotate-default', {}, async ({ page }) => { defaultRotate = await mainRotate(page); });
  await test('3d-rotate-non-default', NON_DEFAULT, async ({ page }) => {
    const result = await mainRotate(page);
    assert.ok(defaultRotate, 'the default 3D Rotate ran');
    check('3D Rotate: the two runs start from the same vertices', result.before, defaultRotate.before);
    const biggest = Math.max(...result.after.map((v, i) => Math.abs(v - result.before[i])));
    measurements.push({ name: '3d rotate', biggestChange: biggest });
    assert.ok(biggest > .1, '3D Rotate moved the vertices by ' + biggest);
    near('3D Rotate: the same result with non-default UV settings', Math.max(...result.after.map((v, i) => Math.abs(v - defaultRotate.after[i]))), 0, 1e-3);
  });

  // ---- The Tools title row, at normal size and in a small window.
  const titleRow = page => page.evaluate(() => {
    const row = document.querySelector('.uv-toolbox .uv-panel-title'), r = row.getBoundingClientRect(), kids = [...row.children].map(c => c.getBoundingClientRect());
    const buttons = [...row.querySelectorAll('button')].map(b => { const range = document.createRange(); range.selectNodeContents(b); return { text: b.textContent, lines: range.getClientRects().length, clipped: b.scrollWidth > b.clientWidth || b.scrollHeight > b.clientHeight }; });
    let clipLeft = 0, clipRight = window.innerWidth, clipBottom = window.innerHeight;
    for (let up = row.parentElement; up; up = up.parentElement) if (getComputedStyle(up).overflowX !== 'visible') { const box = up.getBoundingClientRect(); clipLeft = Math.max(clipLeft, box.left); clipRight = Math.min(clipRight, box.right); clipBottom = Math.min(clipBottom, box.bottom); }
    return { clipLeft, clipRight, clipBottom, bottom: r.bottom, width: r.width, height: r.height, left: r.left, right: r.right, overflow: row.scrollWidth > row.clientWidth, kidLeft: Math.min(...kids.map(k => k.left)), kidRight: Math.max(...kids.map(k => k.right)), kidTop: Math.min(...kids.map(k => k.top)), kidBottom: Math.max(...kids.map(k => k.bottom)), buttons };
  });
  const rowFits = async (page, label, { panelEdge = true } = {}) => {
    const row = await titleRow(page);
    measurements.push({ name: 'title row ' + label, row });
    check(`Tools title row ${label}: no overflow`, row.overflow, false);
    assert.ok(row.height <= 40, `Tools title row ${label}: does not wrap, height ${row.height}`);
    assert.ok(row.kidRight <= row.right + .5 && row.kidLeft >= row.left - .5, `Tools title row ${label}: nothing clipped ${JSON.stringify(row)}`);
    if (panelEdge) assert.ok(row.kidRight <= row.clipRight + .5 && row.kidLeft >= row.clipLeft - .5 && row.bottom <= row.clipBottom + .5, `Tools title row ${label}: no panel cuts it off ${JSON.stringify(row)}`);
    assert.ok(row.buttons.every(b => b.lines === 1 && !b.clipped), `Tools title row ${label}: each button fits on one line ${JSON.stringify(row.buttons)}`);
    check(`Tools title row ${label}: no wrap, no clipping`, true);
  };
  await test('tools-title', {}, async ({ app, page }) => {
    const opened = await openUV(page), { uv } = opened, toggle = uv.getByRole('button', { name: 'Each piece', exact: true });
    const both = async (label, name, options) => {
      if (await toggle.getAttribute('aria-pressed') === 'true') await toggle.click();
      await rowFits(page, label + ' off', options); await shot(page, `tools-each-piece-off-${name}`);
      await toggle.click();
      await page.waitForFunction(() => document.querySelector('[data-hotkey="uv:each-piece"]').getAttribute('aria-pressed') === 'true');
      await rowFits(page, label + ' on', options); await shot(page, `tools-each-piece-on-${name}`);
    };
    await both('at normal size', 'normal');
    const wheelTo = async () => {
      const panel = await uv.locator('.uv-side-controls').boundingBox();
      await page.mouse.move(panel.x + panel.width / 2, panel.y + panel.height / 2);
      for (let i = 0; i < 12 && !await uv.locator('.uv-toolbox .uv-panel-title').evaluate(el => { const r = el.getBoundingClientRect(), p = el.closest('.uv-side-controls').getBoundingClientRect(); return r.top >= p.top && r.bottom <= p.bottom; }); i++) await page.mouse.wheel(0, 120);
      await page.waitForTimeout(100);
    };
    const resize = async (width, height) => {
      await app.evaluate(({ BrowserWindow }, bounds) => BrowserWindow.getAllWindows()[0].setBounds(bounds), { x: 0, y: 0, width, height });
      await page.waitForFunction(width => window.innerWidth <= width, width);
      await page.waitForTimeout(250);
    };
    // Compact windows where the right column fits inside the UV Wrapper.
    await resize(1000, 720); await wheelTo();
    await both('in a compact window', 'compact');
    await resize(840, 880); await wheelTo();
    await both('in a narrow window', 'narrow');
    // At 800 px and below the right column, tool grid included, is wider than the UV Wrapper and runs off its edge,
    // so here only the row itself is checked; the measurement in result.json says how much is cut off.
    await resize(720, 800); await wheelTo();
    await both('at the narrowest width', 'narrowest', { panelEdge: false });
    // The floating (not expanded) UV Wrapper: tall enough that the live preview's minimum height leaves room for Tools.
    await resize(1000, 1000);
    await uv.getByRole('button', { name: 'Restore UV Wrapper size', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('.uv-tab-window').classList.contains('expanded'));
    await page.waitForTimeout(250); await wheelTo();
    await both('in the floating Wrapper of a compact window', 'compact-floating');
    // The app's smallest window: only a measurement, the live preview's minimum height decides what fits.
    await uv.getByRole('button', { name: 'Expand UV Wrapper', exact: true }).click();
    await resize(720, 480);
    measurements.push({ name: 'side controls height at 720x480', height: (await uv.locator('.uv-side-controls').boundingBox())?.height ?? null });
  });

  check('source model file unchanged', fs.readFileSync(fixture).equals(originalFile));
  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ checks: checks.length, failures, errors, measurements, fixture, bundle }, null, 2));
  console.log(`CHECKS ${checks.length}, FAILED SESSIONS ${failures.length}, RENDERER ERRORS ${errors.length}`);
  for (const failure of failures) console.log('FAILED ' + failure.session + ': ' + failure.message);
  for (const error of errors) console.log('RENDERER ERROR ' + error);
  assert.equal(failures.length, 0, 'failed sessions');
  assert.deepEqual(errors, [], 'no renderer errors');
})().catch(error => { console.error(error); process.exitCode = 1; });
