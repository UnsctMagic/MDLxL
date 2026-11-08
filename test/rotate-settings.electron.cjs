// Every 3D Rotate setting through the packaged app's real mouse and keyboard, each from its own
// seeded profile, plus the Each piece toggle with real clicks. Probes only read state.
// Contract: docs/agent-tasks/presets-previews-toolbar.md. Numbers: test/rotate-settings.test.js.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { isDeepStrictEqual } = require('node:util');
const { launchApp, closeApp, clickMenu, settle, bundleHashes } = require('./helpers/app.cjs');
const { fixturePath } = require('./helpers/fixtures.cjs');

const RINGS = { viewportAppearance: { controllers: { rotateHandles: 'rings' } } };
const args = ['--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-gpu-vsync', '--disable-frame-rate-limit'];
const MAIN = '.classic-view', FORGE = '.forge-dialog .forge-editor';
const SIGN = { XY: 1, ZX: -1, YZ: 1 };

(async () => {
  const out = path.resolve(process.env.MDLXL_ROTATE_SETTINGS_OUT || 'out/rotate-settings');
  fs.mkdirSync(out, { recursive: true });
  const footman = fixturePath('footman'), originalFile = fs.readFileSync(footman);
  const checks = [], errors = [], failures = [], bundle = bundleHashes();
  const { ROTATION_PRESETS } = await import('../src/rotation-drag.js');
  const { Matrix4, ObjectLoader } = await import('three');
  const { movementAxisHandles, pickMovementHandle, projectMovementNodes } = await import('../app/movement-overlay.js');
  const { projectPoseHandles } = await import('../app/pose-overlay.js');
  const check = (label, actual, expected = true) => { assert.deepEqual(actual, expected, label); checks.push(label); console.log('PASS ' + label); };
  const near = (label, actual, expected, tolerance = .15) => {
    assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected} (within ${tolerance}), got ${actual}`);
    checks.push(label); console.log(`PASS ${label} [${Number(actual).toFixed(4)}]`);
  };
  const along = (start, tangent, pixels) => ({ x: start.x + tangent.x * pixels, y: start.y + tangent.y * pixels });

  // Each session is its own app start, so a seeded preference is what the app read at launch.
  async function test(name, preferences, body, { fixture = footman, bounds = { x: 0, y: 0, width: 1500, height: 980 } } = {}) {
    const settings = { preferences: { language: 'en', pointerSensitivity: 1, graphics: { pauseWhenHidden: false }, ...preferences } };
    let launched;
    try {
      launched = await launchApp({ fixture, out, errors, bounds, args, settings, show: 'hide' });
      console.log('SESSION ' + name);
      await installViewportProbes(launched.page);
      await body(launched);
    } catch (error) {
      failures.push({ session: name, message: error.message });
      console.log('FAIL ' + name + ': ' + error.message);
      await launched?.page.screenshot({ path: path.join(out, 'failure-' + name + '.png') }).catch(() => {});
    } finally { if (launched) await closeApp(launched.app); }
  }

  const installViewportProbes = page => page.evaluate(() => {
    window.rotateView = scope => {
      const host = document.querySelector(scope + ' [aria-label="3D model viewport"]');
      let props;
      const state = findFiberState(host, (value, owner) => { if (value?.renderer && value?.entries) { props = owner; return true; } return false; }, { current: true });
      return state ? { state, props } : null;
    };
    window.rotateRead = scope => {
      const view = rotateView(scope); if (!view) return null;
      const drag = view.state.drag, turn = drag?.rotationDrag;
      return {
        dragging: !!turn, degrees: turn?.degrees, axis: turn?.axisName ?? null, lever: turn?.lever ?? null, circle: !!turn?.circle, straight: !!turn?.straight,
        tangent: turn?.tangent ? { x: turn.tangent.x, y: turn.tangent.y } : null, ringRadius: turn?.ringRadius ?? null, hold: turn?.hold, steady: turn?.steady, sensitivity: turn?.sensitivity,
        pivot: turn ? { x: turn.pivot.x, y: turn.pivot.y } : null, pieces: drag?.payload?.pieces ?? null,
        handles: (view.state.gizmoHandles || []).map(({ axis, plane, x, y, startX, startY, ring, points, dx, dy, mode }) => ({ axis, plane, x, y, startX, startY, ring, points, dx, dy, mode })),
      };
    };
    window.rotateDocument = () => JSON.stringify(__mdlxl.model());
  });

  // ---- Vertices and Forge share one rig: every number below is read from the live drag.
  function rig(page, scope, surface, box, sideRoot) {
    const read = () => page.evaluate(s => rotateRead(s), scope);
    const start = { x: box.x + box.width * .72, y: box.y + box.height * .7 };
    async function set({ view, workplane = true, plane = 'XY' } = {}) {
      if (view) { await sideRoot.getByLabel('View direction', { exact: true }).selectOption(view); await settle(page, 250); }
      await sideRoot.getByLabel('Workplane Constraints', { exact: true }).setChecked(workplane);
      await sideRoot.getByLabel(plane + ' workplane', { exact: true }).check();
      if (!workplane) await page.waitForFunction(s => rotateView(s)?.state.gizmoHandles?.some(h => h.mode === 'rotate'), scope);
      await settle(page, 80);
    }
    async function begin(point = start) {
      await page.mouse.move(point.x, point.y); await page.mouse.down();
      await page.waitForFunction(s => !!rotateView(s)?.state.drag?.rotationDrag, scope);
      return read();
    }
    async function moveTo(point, steps = 10) {
      await page.mouse.move(point.x, point.y, { steps });
      await page.waitForFunction(({ s, x, y }) => { const at = rotateView(s)?.state.drag?.lastMove?.rawEnd; return !!at && Math.abs(at.x - x) < .1 && Math.abs(at.y - y) < .1; }, { s: scope, x: point.x - box.x, y: point.y - box.y });
      return read();
    }
    const degreesReach = value => page.waitForFunction(({ s, value }) => Math.abs((rotateView(s)?.state.drag?.rotationDrag?.degrees ?? NaN) - value) < .01, { s: scope, value });
    const released = () => page.waitForFunction(s => !rotateView(s)?.state.drag, scope);
    async function pivot(point = start) { const info = await begin(point); await page.mouse.up(); await released(); return { x: box.x + info.pivot.x, y: box.y + info.pivot.y }; }
    async function arc(center, radius, from, to, steps = 18) {
      let info;
      for (let i = 1; i <= steps; i++) { const a = from + (to - from) * i / steps; await page.mouse.move(center.x + radius * Math.cos(a), center.y + radius * Math.sin(a)); }
      const a = to; info = await moveTo({ x: center.x + radius * Math.cos(a), y: center.y + radius * Math.sin(a) }, 1);
      return info;
    }
    function grab(handles, wanted) {
      for (const handle of handles) {
        if (wanted && handle.axis !== wanted) continue;
        for (const point of handle.ring ? handle.points : [handle]) {
          if (point.x < 30 || point.y < 50 || point.x > box.width - 30 || point.y > box.height - 30) continue;
          if (Math.hypot(point.x - handle.startX, point.y - handle.startY) >= 22 && pickMovementHandle(handles, point.x, point.y, 'rotate')?.axis === handle.axis) return { axis: handle.axis, x: box.x + point.x, y: box.y + point.y };
        }
      }
      assert.fail('no grabbable Rotate handle' + (wanted ? ' for ' + wanted : ''));
    }
    const handles = async () => (await read()).handles;
    const beside = (point, list, pixels) => { const handle = list.find(item => item.axis === point.axis), length = Math.hypot(handle.dx, handle.dy) || 1; return { x: point.x - handle.dy / length * pixels, y: point.y + handle.dx / length * pixels }; };
    return { page, scope, surface, box, sideRoot, read, start, set, begin, moveTo, degreesReach, released, pivot, arc, grab, handles, beside };
  }

  async function openVertices(page, geosets = [0]) {
    const surface = page.getByLabel('3D model viewport', { exact: true }), sidebar = page.locator('.classic-sidebar');
    await surface.waitFor();
    await page.locator('[data-hotkey="geosetsClear"]').click();
    for (const geoset of geosets) await page.getByLabel(`Select geoset ${geoset}`, { exact: true }).check();
    await sidebar.getByRole('button', { name: 'Select', exact: true }).click();
    const box = await surface.boundingBox();
    await page.mouse.click(box.x + box.width * .7, box.y + box.height * .7);
    await page.keyboard.press('Control+a');
    await sidebar.getByRole('button', { name: 'Rotate', exact: true }).click();
    await page.waitForFunction(() => { const view = rotateView('.classic-view'); return !!view && Object.keys(view.state.entries).length > 0 && Object.values(view.props.selectionByGeoset || {}).some(ids => Array.from(ids).length > 0); });
    await page.evaluate(() => { window.__baseline = rotateDocument(); });
    const r = rig(page, MAIN, surface, box, page);
    // Commits with a real release, then one Ctrl+Z restores the exact model.
    r.commitAndUndo = async label => {
      await page.mouse.up(); await r.released();
      await page.waitForFunction(() => rotateDocument() !== window.__baseline);
      await page.keyboard.press('Control+z');
      await page.waitForFunction(() => rotateDocument() === window.__baseline);
      if (label) check(label + ': commits and one Ctrl+Z restores the model', true);
    };
    return r;
  }

  const lineTurn = async (r, label, pixels, expected, options) => {
    const info = await r.begin(options?.point);
    assert.ok(info.tangent, label + ': a straight path');
    near(label, (await r.moveTo(along(options?.point || r.start, info.tangent, pixels))).degrees, expected);
    await r.commitAndUndo(label);
  };

  // ---- The untouched profile first: today's behaviour, against which every option below differs.
  await test('defaults', {}, async ({ page }) => {
    const r = await openVertices(page), toggle = page.locator('.classic-sidebar').getByRole('button', { name: 'Each piece', exact: true });
    check('Default: Each piece is visible', await toggle.isVisible());
    check('Default: Each piece starts unpressed', await toggle.getAttribute('aria-pressed'), 'false');
    await r.set({ view: 'perspective' });
    let info = await r.begin();
    check('Default: workplane drag is the arrow', [info.straight, info.circle], [true, false]);
    near('Default: one degree per pixel along the arrow', (await r.moveTo(along(r.start, info.tangent, 40))).degrees, 40);
    await r.commitAndUndo('Default arrow');
    await r.set({ view: 'top' });
    info = await r.begin(); check('Default: Top view circles', info.circle, true); check('Default: deadzone is 8', info.hold, 8); await page.mouse.up(); await r.released();
    await r.set({ view: 'perspective', workplane: false });
    const tip = r.grab(await r.handles(), 'X');
    info = await r.begin(tip); check('Default: Lines are levers', [info.lever, info.axis, info.ringRadius, info.tangent], ['X', null, 68, null]); await page.mouse.up(); await r.released();
    info = await r.begin({ x: r.box.x + r.box.width * .92, y: r.box.y + r.box.height * .85 });
    check('Default: dragging away from the handles turns', info.dragging, true); check('Default: the rim is 68', info.ringRadius, 68); check('Default: no big-selection zone', info.steady, 0);
    await page.mouse.up(); await r.released();
  });

  await test('use-dpi-default', { pointerSensitivity: 1.5 }, async ({ page }) => {
    const r = await openVertices(page); await r.set({ view: 'perspective' });
    await lineTurn(r, 'Default: Pointer sensitivity multiplies the turn', 40, 60);
  });

  // ---- One option per profile.
  await test('workplane-left-right', { rotation: { workplaneDrag: 'leftRight' } }, async ({ page }) => {
    const r = await openVertices(page);
    for (const plane of ['XY', 'ZX', 'YZ']) {
      await r.set({ view: 'perspective', plane });
      const info = await r.begin();
      near(`Left/right ${plane}: arrow sign`, info.tangent.x, SIGN[plane], 1e-9); near(`Left/right ${plane}: arrow is level`, info.tangent.y, 0, 1e-9);
      near(`Left/right ${plane}: right turns with the MDLVis sign`, (await r.moveTo({ x: r.start.x + 40, y: r.start.y })).degrees, 40 * SIGN[plane]);
      near(`Left/right ${plane}: up and down do nothing`, (await r.moveTo({ x: r.start.x + 40, y: r.start.y + 60 })).degrees, 40 * SIGN[plane]);
      await r.commitAndUndo(`Left/right ${plane}`);
    }
    await r.set({ view: 'top' });
    check('Left/right: a facing plane still circles while Front/Top/Side is Circle', (await r.begin()).circle, true); await page.mouse.up(); await r.released();
  });

  await test('workplane-circle', { rotation: { workplaneDrag: 'circle' } }, async ({ page }) => {
    const r = await openVertices(page); await r.set({ view: 'perspective' });
    const center = await r.pivot(), from = { x: center.x + 140, y: center.y };
    const info = await r.begin(from); check('Circle: every camera circles', [info.circle, info.tangent], [true, null]);
    near('Circle: a quarter circle is a quarter turn', Math.abs((await r.arc(center, 140, 0, Math.PI / 2)).degrees), 90, 1);
    await r.commitAndUndo('Circle');
  });

  await test('workplane-ring', { rotation: { workplaneDrag: 'ring' } }, async ({ page }) => {
    const r = await openVertices(page); await r.set({ view: 'perspective' });
    const center = await r.pivot(), press = { x: center.x + 90, y: center.y - 40 }, other = { x: center.x - 90, y: center.y + 40 };
    const info = await r.begin(press); near('Ring: unit direction', Math.hypot(info.tangent.x, info.tangent.y), 1, 1e-9);
    near('Ring: along the tangent', (await r.moveTo(along(press, info.tangent, 30))).degrees, 30);
    near('Ring: across the tangent does nothing', (await r.moveTo({ x: press.x + info.tangent.x * 30 - info.tangent.y * 60, y: press.y + info.tangent.y * 30 + info.tangent.x * 60 })).degrees, 30);
    await r.commitAndUndo('Ring');
    const opposite = await r.begin(other); assert.ok(info.tangent.x * opposite.tangent.x + info.tangent.y * opposite.tangent.y < 0, 'the far side of the ring pulls the other way'); check('Ring: direction comes from where you grab', true);
    await page.mouse.up(); await r.released();
  });

  await test('handle-ring', { ...RINGS, rotation: { handleDrag: 'ring' } }, async ({ page }) => {
    const r = await openVertices(page); await r.set({ view: 'perspective', workplane: false });
    const handles = await r.handles(); check('Rings are showing', handles.every(h => h.ring));
    const point = r.grab(handles), info = await r.begin(point);
    check('Handle ring: straight, no rim', [info.straight, info.ringRadius, info.lever, info.axis], [true, null, null, point.axis]);
    near('Handle ring: along the ring', (await r.moveTo(along(point, info.tangent, 30))).degrees, 30);
    await r.commitAndUndo('Handle ring');
  });

  await test('handle-left-right', { ...RINGS, rotation: { handleDrag: 'leftRight' } }, async ({ page }) => {
    const r = await openVertices(page); await r.set({ view: 'perspective', workplane: false });
    const point = r.grab(await r.handles()), info = await r.begin(point);
    check('Handle left/right: level', info.tangent.y, 0);
    near('Handle left/right: right', (await r.moveTo({ x: point.x + 40, y: point.y })).degrees, 40 * info.tangent.x);
    near('Handle left/right: up and down do nothing', (await r.moveTo({ x: point.x + 40, y: point.y + 70 })).degrees, 40 * info.tangent.x);
    await r.commitAndUndo('Handle left/right');
  });

  await test('line-pick-axis', { rotation: { linePick: 'axis' } }, async ({ page }) => {
    const r = await openVertices(page); await r.set({ view: 'perspective', workplane: false });
    const list = await r.handles(), point = r.grab(list, 'X'), info = await r.begin(point);
    check('Lines by axis: no lever, the handle is the axis from the press', [info.lever, info.axis], [null, 'X']);
    const moved = await r.moveTo(r.beside(point, list, 50)); assert.ok(Math.abs(moved.degrees) > 1, 'it turns'); check('Lines by axis: turns around its own axis', moved.axis, 'X');
    await r.commitAndUndo('Lines by axis');
  });

  await test('lever-pick', { rotation: { leverPick: 20 } }, async ({ page }) => {
    const r = await openVertices(page); await r.set({ view: 'perspective', workplane: false });
    const list = await r.handles(), point = r.grab(list, 'X'); await r.begin(point);
    check('Lever pick 20: still choosing at 10 px', (await r.moveTo(r.beside(point, list, 10))).axis, null);
    assert.ok((await r.moveTo(r.beside(point, list, 26))).axis, 'chosen past 20 px'); check('Lever pick 20: chosen past 20 px', true);
    await r.commitAndUndo('Lever pick');
  });

  await test('off-handle-none', { rotation: { offHandle: 'none' } }, async ({ page }) => {
    const r = await openVertices(page); await r.set({ view: 'perspective', workplane: false });
    const blank = { x: r.box.x + r.box.width * .92, y: r.box.y + r.box.height * .85 }, selectionBefore = await page.evaluate(() => JSON.stringify(__mdlxl.selection().selection));
    await page.mouse.move(blank.x, blank.y); await page.mouse.down(); await page.mouse.move(blank.x - 90, blank.y - 40, { steps: 8 }); await settle(page, 120);
    check('Off handles, none: no drag starts', (await r.read()).dragging, false);
    await page.mouse.up(); await settle(page, 120);
    check('Off handles, none: the model is untouched', await page.evaluate(() => rotateDocument() === window.__baseline));
    check('Off handles, none: the selection is untouched', await page.evaluate(() => JSON.stringify(__mdlxl.selection().selection)), selectionBefore);
    const point = r.grab(await r.handles()); check('Off handles, none: handles still work', (await r.begin(point)).dragging, true);
    await r.moveTo({ x: point.x + 20, y: point.y + 40 }); await r.commitAndUndo('Off handles, none: a handle');
    await r.set({ workplane: true }); check('Off handles, none: the workplane is not affected', (await r.begin()).dragging, true); await page.mouse.up(); await r.released();
  });

  await test('face-on-arrow', { rotation: { faceOn: 'arrow' } }, async ({ page }) => {
    const r = await openVertices(page); await r.set({ view: 'top' });
    for (const [x, y] of [[-60, 0], [60, 0], [0, -60], [0, 60]]) {
      const center = { x: r.box.x + r.box.width / 2, y: r.box.y + r.box.height / 2 }, point = { x: center.x + x, y: center.y + y }, info = await r.begin(point);
      check('Facing arrow: no circle', info.circle, false); near('Facing arrow: level wherever you press', Math.abs(info.tangent.x), 1, 1e-6); near('Facing arrow: level', info.tangent.y, 0, 1e-6);
      await page.mouse.up(); await r.released();
    }
    await lineTurn(r, 'Facing arrow: turns along the arrow', 40, 40);
  });

  await test('reverse', { rotation: { reverse: true } }, async ({ page }) => {
    const r = await openVertices(page); await r.set({ view: 'perspective' });
    await lineTurn(r, 'Reverse: the arrow turns the other way', 40, -40);
  });

  await test('handle-sensitivity', { ...RINGS, rotation: { handleSensitivity: .5, handleDrag: 'ring' } }, async ({ page }) => {
    const r = await openVertices(page); await r.set({ view: 'perspective', workplane: false });
    const point = r.grab(await r.handles()), info = await r.begin(point);
    check('Handle speed: handles use it', info.sensitivity, .5);
    near('Handle speed: half the turn', (await r.moveTo(along(point, info.tangent, 40))).degrees, 20);
    await r.commitAndUndo('Handle speed');
    await r.set({ workplane: true }); await lineTurn(r, 'Handle speed: the workplane keeps Rotation sensitivity', 40, 40);
  });

  await test('use-dpi-off', { pointerSensitivity: 1.5, rotation: { useDPI: false } }, async ({ page }) => {
    const r = await openVertices(page); await r.set({ view: 'perspective' });
    await lineTurn(r, 'DPI off: Pointer sensitivity is ignored', 40, 40);
  });

  await test('center-zone', { rotation: { centerZone: 40 } }, async ({ page }) => {
    const r = await openVertices(page); await r.set({ view: 'top' });
    const center = await r.pivot(), info = await r.begin({ x: center.x + 140, y: center.y });
    check('Deadzone 40: read from the setting', info.hold, 40);
    near('Deadzone 40: outside it the turn follows', Math.abs((await r.arc(center, 140, 0, Math.PI / 4)).degrees), 45, 1);
    near('Deadzone 40: inside it the turn holds', Math.abs((await r.moveTo({ x: center.x + 20 * Math.cos(Math.PI * .75), y: center.y + 20 * Math.sin(Math.PI * .75) }, 1)).degrees), 45, 1);
    near('Deadzone 40: leaving it picks up the mouse', Math.abs((await r.moveTo({ x: center.x + 140 * Math.cos(Math.PI * .75), y: center.y + 140 * Math.sin(Math.PI * .75) }, 1)).degrees), 135, 1.5);
    await r.commitAndUndo('Deadzone 40');
    await r.set({ view: 'perspective', workplane: false });
    check('Deadzone 40: the handle rim follows the piecewise map', (await r.begin({ x: r.box.x + r.box.width * .92, y: r.box.y + r.box.height * .85 })).ringRadius, 100); await page.mouse.up(); await r.released();
  });

  await test('center-zone-off', { rotation: { centerZone: 0 } }, async ({ page }) => {
    const r = await openVertices(page); await r.set({ view: 'perspective', workplane: false });
    check('Deadzone 0: no rim', (await r.begin({ x: r.box.x + r.box.width * .92, y: r.box.y + r.box.height * .85 })).ringRadius, 0); await page.mouse.up(); await r.released();
  });

  await test('big-selections', { rotation: { bigSelections: true } }, async ({ page }) => {
    const r = await openVertices(page); await r.set({ view: 'perspective', workplane: false });
    let info = await r.begin({ x: r.box.x + r.box.width * .92, y: r.box.y + r.box.height * .85 }); await page.mouse.up(); await r.released();
    assert.ok(info.steady > 68, `the selection measures ${info.steady} px on screen`); check('Big selections: the zone is the selection itself', info.ringRadius, info.steady);
    await r.set({ view: 'top' });
    const center = await r.pivot(); info = await r.begin({ x: center.x + 100, y: center.y });
    near('Big selections: a circle over the piece turns less', Math.abs((await r.arc(center, 100, 0, Math.PI / 2, 24)).degrees), 90 * Math.min(1, 100 / info.steady), 2);
    await r.commitAndUndo('Big selections');
  });

  await test('shift-snap', { rotation: { shift: 'snap' } }, async ({ page }) => {
    const r = await openVertices(page); await r.set({ view: 'perspective' });
    const info = await r.begin(); near('Shift snap: free before Shift', (await r.moveTo(along(r.start, info.tangent, 23))).degrees, 23);
    await page.keyboard.down('Shift'); await r.degreesReach(30); check('Shift snap: pressing Shift alone snaps to 15', true);
    await page.keyboard.up('Shift'); await r.degreesReach(23); check('Shift snap: releasing it loses nothing', true);
    await r.commitAndUndo('Shift snap');
  });

  await test('ctrl-snap', { rotation: { snap: 15 } }, async ({ page }) => {
    const r = await openVertices(page); await r.set({ view: 'perspective' });
    const info = await r.begin(); near('Ctrl snap: free before Ctrl', (await r.moveTo(along(r.start, info.tangent, 23))).degrees, 23);
    await page.keyboard.down('Control'); await r.degreesReach(30); check('Ctrl snap: pressing Ctrl alone snaps', true);
    await r.moveTo(along(r.start, info.tangent, 52)); await r.degreesReach(45); check('Ctrl snap: moving while held keeps snapping', true);
    await page.keyboard.up('Control'); await r.degreesReach(52); check('Ctrl snap: releasing it restores the real amount', true);
    await r.commitAndUndo('Ctrl snap');
  });

  // ---- Built-ins.
  for (const id of Object.keys(ROTATION_PRESETS)) await test('preset-' + id, { pointerSensitivity: 1.5, rotation: { ...ROTATION_PRESETS[id] } }, async ({ page }) => {
    const r = await openVertices(page); await r.set({ view: 'perspective' });
    if (id === 'freeform') {
      const center = await r.pivot(), info = await r.begin({ x: center.x + 150, y: center.y }); check('Freeform: every camera circles', info.circle, true); check('Freeform: no deadzone beyond the exact centre', info.hold, 2);
      const moved = await r.arc(center, 150, 0, 23 * Math.PI / 180); near('Freeform: follows the mouse, no DPI', Math.abs(moved.degrees), 23, 1);
      await page.keyboard.down('Control'); await page.waitForFunction(s => rotateView(s).state.drag.rotationDrag.degrees % 5 === 0, MAIN); check('Freeform: Ctrl snaps to 5', true); await page.keyboard.up('Control');
      await r.commitAndUndo('Freeform circle');
    } else {
      const info = await r.begin(), rule = id === 'mdlvis' ? { x: 1, y: 0 } : info.tangent;
      if (id === 'mdlvis') check('MDLVis: left/right on XY', info.tangent.x, 1);
      near(`${id}: the sample drag`, (await r.moveTo(along(r.start, rule, 40))).degrees, id === 'mdlxl' ? 60 : 40);
      await page.keyboard.down('Shift');
      const shifted = await r.moveTo(along(r.start, rule, 50));
      near(`${id}: Shift`, shifted.degrees, id === 'mdlxl' ? 60 + 15 * .1 : id === 'mdlvis' ? 50 : 41);
      await page.keyboard.up('Shift');
      if (id === 'manipulator') { await page.keyboard.down('Control'); await r.degreesReach(45); check('Manipulator: Ctrl snaps to 15', true); await page.keyboard.up('Control'); }
      await r.commitAndUndo(`${id} sample drag`);
    }
    await r.set({ view: 'top' });
    const facing = await r.begin(); check(`${id}: a facing plane`, facing.circle, id !== 'mdlvis'); await page.mouse.up(); await r.released();
    await r.set({ view: 'perspective', workplane: false });
    const point = r.grab(await r.handles(), 'X'), line = await r.begin(point);
    check(`${id}: a Lines handle`, [line.lever, line.axis], id === 'mdlxl' ? ['X', null] : [null, 'X']);
    check(`${id}: handle rim`, line.ringRadius, { mdlxl: 68, mdlvis: null, freeform: 0, manipulator: 68 }[id]);
    await page.mouse.up(); await r.released();
  });

  // ---- Each piece, with real clicks on the toggle.
  const waitForEachPiece = async (page, expected) => {
    let current;
    for (let tries = 0; tries < 100; tries++) { current = (await page.evaluate(async () => (await window.desktop.getSettings()).preferences.rotation)).eachPiece === true; if (isDeepStrictEqual(current, expected)) return; await page.waitForTimeout(100); }
    assert.fail(`rotation.eachPiece was not saved as ${expected}`);
  };
  const geometry = (page, keys) => page.evaluate(keys => Object.fromEntries(keys.map(key => { const g = __mdlxl.model().Geosets[key]; return [key, { vertices: Array.from(g.Vertices), normals: Array.from(g.Normals) }]; })), keys);

  await test('each-piece-vertices', {}, async ({ page }) => {
    const r = await openVertices(page, [0, 1]), sidebar = page.locator('.classic-sidebar'), toggle = sidebar.getByRole('button', { name: 'Each piece', exact: true });
    check('Each piece: tooltip', (await toggle.getAttribute('title')).startsWith('On: Rotate works on each separate piece, on its own spot. Off: the whole selection turns as one group.'));
    await r.set({ view: 'perspective' });
    let info = await r.begin(); await r.moveTo(along(r.start, info.tangent, 30));
    check('Each piece off: one group', (await r.read()).pieces, null);
    await r.commitAndUndo('Each piece off');
    const look = () => toggle.evaluate(element => { const style = getComputedStyle(element); return [style.boxShadow, style.backgroundColor, style.fontWeight, style.borderTopStyle].join('|'); });
    await toggle.hover(); const unpressedLook = await look();
    await toggle.click();
    check('Each piece: pressed after a real click', await toggle.getAttribute('aria-pressed'), 'true');
    await waitForEachPiece(page, true);
    assert.notEqual(await look(), unpressedLook, 'the pressed look is visible'); check('Each piece: pressed look', true);
    info = await r.begin();
    const live = await r.moveTo(along(r.start, info.tangent, 40)), keys = Object.keys(live.pieces);
    check('Each piece: both geosets are in the turn', keys.length, 2); near('Each piece: the turn', live.degrees, 40);
    const before = await geometry(page, keys), radians = 40 * Math.PI / 180, cos = Math.cos(radians), sin = Math.sin(radians);
    await page.mouse.up(); await r.released();
    await page.waitForFunction(() => rotateDocument() !== window.__baseline);
    const after = await geometry(page, keys);
    for (const key of keys) for (const piece of live.pieces[key]) {
      const mean = [0, 1, 2].map(axis => piece.indices.reduce((sum, i) => sum + after[key].vertices[i * 3 + axis], 0) / piece.indices.length);
      mean.forEach((value, axis) => assert.ok(Math.abs(value - piece.center[axis]) < .05, `piece of geoset ${key} left its spot on axis ${axis}: ${value} vs ${piece.center[axis]}`));
      for (const i of piece.indices.slice(0, 40)) {
        const x = before[key].vertices[i * 3] - piece.center[0], y = before[key].vertices[i * 3 + 1] - piece.center[1];
        assert.ok(Math.abs(after[key].vertices[i * 3] - (piece.center[0] + x * cos - y * sin)) < .05 && Math.abs(after[key].vertices[i * 3 + 1] - (piece.center[1] + x * sin + y * cos)) < .05, `vertex ${i} is not turned around its own piece`);
        const nx = before[key].normals[i * 3], ny = before[key].normals[i * 3 + 1];
        assert.ok(Math.abs(after[key].normals[i * 3] - (nx * cos - ny * sin)) < .01 && Math.abs(after[key].normals[i * 3 + 1] - (nx * sin + ny * cos)) < .01, `the normal of vertex ${i} did not turn`);
      }
    }
    check('Each piece: every piece turns on its own spot and its normals turn with it', true);
    await page.keyboard.press('Control+z');
    await page.waitForFunction(() => rotateDocument() === window.__baseline);
    check('Each piece: one Ctrl+Z restores the exact model', true);
    await page.getByRole('button', { name: 'Quad View', exact: true }).click();
    check('Each piece: stays visible in quad view', await toggle.isVisible()); check('Each piece: quad view still hides the plane controls', await sidebar.locator('.classic-planes').count(), 0);
    await page.getByRole('button', { name: 'Quad View', exact: true }).click();
    await toggle.click();
    check('Each piece: released after a real click', await toggle.getAttribute('aria-pressed'), 'false');
    await waitForEachPiece(page, false);
  });

  await test('each-piece-remembered', { rotation: { eachPiece: true } }, async ({ page }) => {
    const r = await openVertices(page);
    check('Each piece: remembered from the profile', await page.locator('.classic-sidebar').getByRole('button', { name: 'Each piece', exact: true }).getAttribute('aria-pressed'), 'true');
    await r.set({ view: 'perspective' });
    const info = await r.begin(); assert.ok((await r.moveTo(along(r.start, info.tangent, 30))).pieces, 'the drag uses pieces'); check('Each piece: a drag after a restart uses pieces', true);
    await r.commitAndUndo('Each piece after a restart');
  });

  await test('each-piece-forge', { rotation: { snap: 15 } }, async ({ page }) => {
    const forge = page.getByRole('dialog', { name: 'Forge', exact: true }), sidebar = forge.locator('.forge-editor-sidebar');
    await page.getByLabel('3D model viewport', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Forge', exact: true }).click();
    await forge.getByRole('button', { name: 'Cube', exact: true }).click();
    await forge.getByRole('button', { name: 'Add shape', exact: true }).click();
    await forge.getByRole('button', { name: 'Cube', exact: true }).click();
    const shapes = forge.getByRole('group', { name: 'Forge shapes', exact: true }).getByRole('button');
    await shapes.first().click(); await shapes.last().click({ modifiers: ['Shift'] });
    await sidebar.getByRole('button', { name: 'Rotate', exact: true }).click();
    const surface = forge.locator('.forge-editor').getByLabel('3D model viewport', { exact: true }), box = await surface.boundingBox(), r = rig(page, FORGE, surface, box, forge);
    await r.set({ plane: 'XY' });
    const draft = () => page.evaluate(selector => findFiberState(document.querySelector(selector), v => v?.shapes && v?.mode, { last: true }).shapes.map(shape => shape.vertices.filter(Boolean)), FORGE);
    const centres = shapes => shapes.map(vertices => [0, 1, 2].map(axis => vertices.reduce((sum, v) => sum + v[axis], 0) / vertices.length));
    const undo = forge.getByRole('button', { name: 'Undo', exact: true }), toggle = sidebar.getByRole('button', { name: 'Each piece', exact: true });
    check('Forge: Each piece is visible', await toggle.isVisible());
    const original = await draft();
    const turn = async () => {
      const info = await r.begin(), live = await r.moveTo(along(r.start, info.tangent, 40));
      await page.mouse.up(); await r.released();
      await page.waitForFunction(({ selector, before }) => JSON.stringify(findFiberState(document.querySelector(selector), v => v?.shapes && v?.mode, { last: true }).shapes.map(shape => shape.vertices.filter(Boolean))) !== before, { selector: FORGE, before: JSON.stringify(original) });
      return live;
    };
    let live = await turn();
    check('Forge, Each piece off: one group', live.pieces, null);
    assert.ok(centres(await draft()).some((centre, i) => Math.hypot(...centre.map((v, a) => v - centres(original)[i][a])) > 1), 'the cubes swing around their shared centre'); check('Forge, Each piece off: the pieces swing around the shared centre', true);
    await undo.click(); await page.waitForFunction(({ selector, before }) => JSON.stringify(findFiberState(document.querySelector(selector), v => v?.shapes && v?.mode, { last: true }).shapes.map(shape => shape.vertices.filter(Boolean))) === before, { selector: FORGE, before: JSON.stringify(original) });
    await toggle.click(); check('Forge: Each piece pressed after a real click', await toggle.getAttribute('aria-pressed'), 'true');
    live = await turn();
    check('Forge: per-triangle meshes group into one piece per cube', Object.values(live.pieces).map(list => list.length), [1, 1]);
    centres(await draft()).forEach((centre, i) => centre.forEach((value, axis) => assert.ok(Math.abs(value - centres(original)[i][axis]) < .05, `cube ${i} left its spot`)));
    check('Forge, Each piece on: every cube turns on its own spot', true);
    await undo.click(); await settle(page, 150);
    // Ctrl already down at the press keeps its old meaning; Ctrl pressed afterwards snaps.
    await toggle.click();
    await page.keyboard.down('Control');
    const info = await r.begin();
    near('Forge: Ctrl held from the press does not snap', (await r.moveTo(along(r.start, info.tangent, 23))).degrees, 23);
    await page.keyboard.up('Control'); await r.degreesReach(23);
    await page.keyboard.down('Control'); await r.degreesReach(30); check('Forge: Ctrl pressed after the drag began snaps', true); await page.keyboard.up('Control');
    await page.mouse.up(); await r.released();
    await forge.getByRole('button', { name: 'Cancel', exact: true }).click();
  });

  // ---- Movement and POSE use GamePreview's own path.
  const MOVEMENT = { pointerSensitivity: 1.5, rotation: { editors: { movement: { workplaneDrag: 'leftRight', offHandle: 'none', useDPI: false, snap: 15 } } } };
  await test('movement-pose', MOVEMENT, async ({ page }) => {
    await page.getByLabel('3D model viewport', { exact: true }).waitFor();
    await page.locator('[data-hotkey="animation"]').click();
    await page.getByLabel('Movement current sequence').selectOption('0');
    await page.getByLabel('Movement bone or node').selectOption('0');
    await page.getByLabel('View direction', { exact: true }).selectOption('perspective');
    const tools = page.getByRole('group', { name: 'Movement tool', exact: true });
    await tools.getByRole('button', { name: 'Rotate', exact: true }).click();
    const canvas = page.locator('[data-clean-model-canvas]');
    const ready = () => page.waitForFunction(() => { const { runtime: r, props: p } = mdlxlProbe(); return r?.captureApi?.isReady && (p.restPose || Math.round(r.native.getFrame()) === Math.round(p.time)); });
    const gameData = async () => { await ready(); return page.evaluate(() => { const { runtime: r, props: p, session: s } = mdlxlProbe(), c = document.querySelector('[data-clean-model-canvas]'); return { model: p.model, document: JSON.stringify(s.doc.model), camera: r.controls.object.toJSON(), frame: r.native.getFrame(), sequence: p.sequenceIndex, config: p.poseConfig, selected: p.selectedNodeIds, space: p.transformSpace, width: c.clientWidth, height: c.clientHeight, radius: r.captureApi.showcaseView().radius, appearance: p.preferences.viewportAppearance.controllers, matrices: (r.native.rendererData.nodes || []).flatMap((node, index) => node?.matrix ? [[index, Array.from(node.matrix)]] : []) }; }); };
    const documentNow = () => page.evaluate(() => JSON.stringify(mdlxlProbe().session.doc.model));
    const overlay = () => page.evaluate(() => { const data = document.querySelector('[data-node-overlay]').dataset; return { feedback: data.rotationFeedback, mode: data.rotationMode, direction: data.rotationDirection }; });
    const degreesReach = value => page.waitForFunction(value => { const text = document.querySelector('[data-node-overlay]')?.dataset.rotationFeedback; return !!text && Math.abs(Number(text.split(' ').at(-1)) - value) < .06; }, value);
    const workplaneOn = async () => { await page.getByLabel('Workplane Constraints', { exact: true }).check(); await page.locator('[data-hotkey="plane:xy"]').check(); await ready(); };
    const box = await canvas.boundingBox(), spot = { x: box.x + box.width * .8, y: box.y + box.height * .7 }, blank = { x: box.x + box.width * .86, y: box.y + box.height * .22 };
    // A press and drag on the empty part of the view, in the workplane.
    const workplaneTurn = async label => {
      const before = await documentNow();
      await page.mouse.move(spot.x, spot.y); await page.mouse.down();
      await page.waitForFunction(() => document.querySelector('[data-node-overlay]')?.dataset.rotationMode === 'line');
      check(`${label}: left/right arrow`, (await overlay()).direction, '1,0');
      await page.mouse.move(spot.x + 40, spot.y, { steps: 8 }); await degreesReach(40); check(`${label}: right turns 40, no DPI`, true);
      await page.mouse.move(spot.x + 40, spot.y + 70, { steps: 6 }); await degreesReach(40); check(`${label}: up and down do nothing`, true);
      await page.keyboard.down('Control'); await degreesReach(45); check(`${label}: Ctrl after the press snaps`, true);
      await page.keyboard.up('Control'); await degreesReach(40); check(`${label}: releasing Ctrl restores the real amount`, true);
      await page.mouse.up();
      await page.waitForFunction(old => JSON.stringify(mdlxlProbe().session.doc.model) !== old, before);
      await page.keyboard.press('Control+z');
      await page.waitForFunction(old => JSON.stringify(mdlxlProbe().session.doc.model) === old, before);
      check(`${label}: commits and one Ctrl+Z restores`, true);
    };
    const offHandleDoesNothing = async label => {
      await page.getByLabel('Workplane Constraints', { exact: true }).uncheck(); await ready();
      const before = await gameData();
      await page.mouse.move(blank.x, blank.y); await page.mouse.down(); await page.mouse.move(blank.x - 45, blank.y + 60, { steps: 8 }); await settle(page, 120);
      check(`${label}, off handles: nothing is drawn`, (await overlay()).feedback, '');
      await page.mouse.up(); await settle(page, 120);
      check(`${label}, off handles: the model is untouched`, (await gameData()).document, before.document);
      check(`${label}, off handles: a drag is no click, so the selection stays`, (await gameData()).selected, before.selected);
    };
    await workplaneOn(); await workplaneTurn('Movement');
    await offHandleDoesNothing('Movement');
    // The handles themselves still turn.
    const state = await gameData(), camera = new ObjectLoader().parse(state.camera); camera.updateMatrixWorld(true); camera.updateProjectionMatrix();
    const nodes = projectMovementNodes(state.model, state.frame, state.sequence, camera, state.width, state.height, state.frame, new Map(state.matrices.map(([id, m]) => [id, new Matrix4().fromArray(m)])));
    const active = nodes.find(point => point.node.ObjectId === state.selected.at(-1)), handles = movementAxisHandles(active, camera, state.width, state.height, state.radius, state.space, 'rotate', state.appearance);
    const hit = handles.find(handle => pickMovementHandle(handles, handle.x, handle.y, 'rotate') === handle && handle.x > 20 && handle.y > 20 && handle.x < state.width - 20 && handle.y < state.height - 20);
    assert.ok(hit, 'a pickable Rotate handle');
    await page.mouse.move(box.x + hit.x, box.y + hit.y); await page.mouse.down(); await page.mouse.move(box.x + hit.x + 30, box.y + hit.y + 40, { steps: 8 }); await page.mouse.up();
    await page.waitForFunction(old => JSON.stringify(mdlxlProbe().session.doc.model) !== old, state.document);
    await page.keyboard.press('Control+z');
    await page.waitForFunction(old => JSON.stringify(mdlxlProbe().session.doc.model) === old, state.document);
    check('Movement: handles still turn with off-handle drags switched off', true);
    // POSE: the selected Body takes the same settings.
    await page.getByRole('button', { name: 'POSE', exact: true }).click();
    await tools.getByRole('button', { name: 'Select', exact: true }).click();
    const current = await gameData(), view = new ObjectLoader().parse(current.camera); view.updateMatrixWorld(true); view.updateProjectionMatrix();
    const body = projectPoseHandles(current.model, current.config, current.frame, current.sequence, view, current.width, current.height).find(handle => handle.kind === 'body');
    assert.ok(body?.visible, 'Body is visible');
    for (let i = 0; i < 45 && (await page.evaluate(() => mdlxlProbe().props.poseConfig.target))?.kind !== 'body'; i++) {
      const stamp = await page.evaluate(() => JSON.stringify(mdlxlProbe().props.poseConfig.target));
      await page.mouse.click(box.x + body.x, box.y + body.y);
      await page.waitForFunction(old => JSON.stringify(mdlxlProbe().props.poseConfig.target) !== old, stamp);
    }
    check('POSE: Body is selected', (await page.evaluate(() => mdlxlProbe().props.poseConfig.target)).kind, 'body');
    await tools.getByRole('button', { name: 'Rotate', exact: true }).click();
    await workplaneOn(); await workplaneTurn('POSE');
    await offHandleDoesNothing('POSE');
  });

  // ---- EMTR and Glow Up are two entries.
  const stageDrag = page => page.evaluate(() => {
    const drag = findFiberState('canvas.pe-rotate-gizmo', value => value?.rotation?.directions, { current: true });
    if (!drag) return null;
    const turn = drag.rotation;
    return { degrees: turn.degrees, axis: turn.axisName ?? null, lever: turn.lever ?? null, tangent: turn.tangent ? { x: turn.tangent.x, y: turn.tangent.y } : null, ringRadius: turn.ringRadius ?? null, sensitivity: turn.sensitivity };
  });
  const handleTip = async (page, handle) => {
    const [x1, y1, x2, y2] = await handle.locator('line').evaluate(line => ['x1', 'y1', 'x2', 'y2'].map(name => Number(line.getAttribute(name))));
    const box = await handle.evaluate(element => { const b = element.ownerSVGElement.getBoundingClientRect(); return { x: b.x, y: b.y }; });
    return { x: box.x + x1 + (x2 - x1) * .6, y: box.y + y1 + (y2 - y1) * .6 };
  };
  const stageReach = (page, value) => page.waitForFunction(value => { const drag = findFiberState('canvas.pe-rotate-gizmo', v => v?.rotation?.directions, { current: true }); return !!drag && Math.abs(Math.abs(drag.rotation.degrees) - value) < .06; }, value);

  const { createStarterRecipe } = await import('../src/particle-starters.js'), { generateCompatibleMdx } = await import('../src/mdx-compatibility.js');
  const emtrModel = createStarterRecipe().native, emtrFixture = path.join(out, 'emtr.mdx'); fs.writeFileSync(emtrFixture, Buffer.from(generateCompatibleMdx(emtrModel)));
  await test('emtr', { pointerSensitivity: 1.5, rotation: { editors: { emtr: { handleDrag: 'leftRight', handleSensitivity: .5, useDPI: false, snap: 15 }, glow: { handleDrag: 'ring' } } } }, async ({ app, page }) => {
    await clickMenu(app, 'Particle Editor…'); await page.getByLabel('Particle context', { exact: true }).waitFor();
    if (await page.getByRole('button', { name: 'Close Particle Library', exact: true }).count()) await page.getByRole('button', { name: 'Close Particle Library', exact: true }).click();
    await page.getByLabel('Particle context', { exact: true }).selectOption('On model');
    await page.getByLabel('Effect ingredient', { exact: true }).selectOption(String(emtrModel.ParticleEmitters2[0].ObjectId));
    await settle(page, 1500); await page.getByRole('button', { name: 'Fit view', exact: true }).click(); await settle(page, 1000);
    const handle = page.getByRole('slider', { name: 'Rotate Z', exact: true }); await handle.waitFor();
    const point = await handleTip(page, handle);
    await page.mouse.move(point.x, point.y); await page.mouse.down();
    await page.waitForFunction(() => !!findFiberState('canvas.pe-rotate-gizmo', value => value?.rotation?.directions, { current: true }));
    const started = await stageDrag(page);
    check('EMTR: its own settings, not Glow Up\'s', [started.sensitivity, started.ringRadius, started.lever], [.5, null, 'Z']);
    await page.mouse.move(point.x + 40, point.y, { steps: 10 }); await stageReach(page, 20);
    check('EMTR: left/right at the handle speed, no DPI', true);
    await page.mouse.move(point.x + 40, point.y + 70, { steps: 6 }); await stageReach(page, 20); check('EMTR: up and down do nothing', true);
    await page.keyboard.down('Control'); await stageReach(page, 15); check('EMTR: Ctrl alone snaps', true);
    await page.keyboard.up('Control'); await stageReach(page, 20); check('EMTR: releasing Ctrl restores the real amount', true);
    await page.mouse.up();
  }, { fixture: emtrFixture, bounds: { x: 0, y: 0, width: 1400, height: 920 } });

  const { createStarterDocument } = await import('../src/starter-model.js'), { createNode } = await import('../src/editor-document.js');
  const glowFixture = path.join(out, 'hero.mdx');
  { // The smallest model with a weapon bone Glow Up can follow.
    const doc = createStarterDocument();
    doc.apply('Hero fixture', [], model => {
      model.Sequences = ['Stand', 'Death'].map((Name, i) => ({ Name, Interval: new Uint32Array([i * 1000, i * 1000 + 900]), MoveSpeed: 0, NonLooping: false, Rarity: 0, MinimumExtent: new Float32Array(3), MaximumExtent: new Float32Array(3), BoundsRadius: 0 }));
      const hand = createNode(model, 'Bone'); hand.Name = 'Bone_Hand_R'; hand.PivotPoint.set([10, -40, 20]); hand.Parent = model.Bones[0].ObjectId;
      const sword = createNode(model, 'Bone'); sword.Name = 'Sword'; sword.PivotPoint.set([10, -40, 20]); sword.Parent = hand.ObjectId;
      const v = []; for (const x of [2, 6, 14, 30, 46, 62, 78]) for (const [dy, dz] of [[-2, -1], [2, -1], [2, 1], [-2, 1]]) v.push(x, -40 + dy, 20 + dz);
      const n = v.length / 3, faces = []; for (let k = 0; k + 4 < n; k += 4) faces.push(k, k + 1, k + 5, k, k + 5, k + 4);
      model.Geosets.push({ Vertices: new Float32Array(v), Normals: new Float32Array(v.length).map((_, i) => i % 3 === 2 ? 1 : 0), TVertices: [new Float32Array(n * 2)], Faces: new Uint16Array(faces), VertexGroup: new Uint8Array(n), Groups: [[sword.ObjectId]], TotalGroupsCount: 1, MaterialID: 0, SelectionGroup: 0, Unselectable: false, MinimumExtent: new Float32Array([2, -42, 19]), MaximumExtent: new Float32Array([78, -38, 21]), BoundsRadius: 40, Anims: [] });
    });
    fs.writeFileSync(glowFixture, doc.serialize('mdx'));
  }
  await test('glow', { rotation: { editors: { glow: { linePick: 'axis', handleDrag: 'ring', handleSensitivity: 2 }, emtr: { handleDrag: 'leftRight' } } } }, async ({ app, page }) => {
    await page.getByLabel('3D model viewport', { exact: true }).waitFor();
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('menu', 'particles'));
    const emtr = page.getByRole('dialog', { name: 'Particle Editor', exact: true }); await emtr.waitFor();
    await emtr.locator('.pe-toolbar').getByRole('button', { name: 'Glow Up', exact: true }).click();
    await emtr.locator('.pe-glow').waitFor(); await settle(page, 1200);
    const handle = emtr.locator('svg[aria-label="Glow handles"] [aria-label="Rotate Z"]'); await handle.waitFor();
    const point = await handleTip(page, handle);
    await page.mouse.move(point.x, point.y); await page.mouse.down();
    await page.waitForFunction(() => !!findFiberState('canvas.pe-rotate-gizmo', value => value?.rotation?.directions, { current: true }));
    const started = await stageDrag(page);
    check('Glow Up: its own settings, not EMTR\'s', [started.sensitivity, started.ringRadius, started.lever, started.axis], [2, null, null, 'Z']);
    near('Glow Up: a tangent at once', Math.hypot(started.tangent.x, started.tangent.y), 1, 1e-6);
    await page.mouse.move(point.x + started.tangent.x * 20, point.y + started.tangent.y * 20, { steps: 8 }); await stageReach(page, 40);
    check('Glow Up: along the tangent at its handle speed', true);
    await page.mouse.up();
  }, { fixture: glowFixture, bounds: { x: 0, y: 0, width: 1600, height: 1000 } });

  check('Original Footman bytes preserved', fs.readFileSync(footman).equals(originalFile));
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ checks, errors, failures, bundle }, null, 2));
  assert.deepEqual(failures, [], 'failed sessions');
  assert.deepEqual(errors, [], 'renderer errors');
  console.log(`rotate-settings: ${checks.length} checks passed`);
})().catch(error => { console.error(error); process.exitCode = 1; });
