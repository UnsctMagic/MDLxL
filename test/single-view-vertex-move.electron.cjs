const assert = require('node:assert/strict');
const path = require('node:path');
const { launchApp, closeApp } = require('./helpers/app.cjs');
const { fixturePath } = require('./helpers/fixtures.cjs');

(async () => {
  const errors = [];
  const { app, page } = await launchApp({ fixture: fixturePath('footman'), out: path.resolve('out/single-view-vertex-move'), errors });
  try {
    const viewport = page.getByLabel('3D model viewport', { exact: true });
    await page.locator('[data-hotkey="geosetsClear"]').click();
    await page.getByLabel('Select geoset 0', { exact: true }).check();
    await viewport.click(); await page.keyboard.press('Control+a'); await page.keyboard.press('m');
    await page.getByLabel('Workplane Constraints', { exact: true }).check();
    await page.evaluate(() => {
      window.moveView = () => findFiberState('[aria-label="3D model viewport"]', s => s?.renderer && s?.entries);
      window.moveCenter = () => {
        const s = moveView(), e = s.entries[0], pos = e.geometry.attributes.position;
        const c = s.controls.target.clone().set(0, 0, 0), v = c.clone();
        for (let i = 0; i < pos.count; i++) c.add(v.fromBufferAttribute(pos, i));
        c.multiplyScalar(1 / pos.count).project(s.camera);
        const r = s.controls.domElement.getBoundingClientRect();
        return [(1 + c.x) * r.width / 2, (1 - c.y) * r.height / 2];
      };
      window.authored = () => Array.from(moveView().entries[0].geoset.Vertices);
    });
    await page.waitForFunction(() => moveView().entries[0].selectedPoints.geometry.index?.count === 447);
    const box = await viewport.boundingBox(), x = Math.round(box.x + box.width * .25), y = Math.round(box.y + box.height * .4);
    const sample = async (dx, dy, held = false) => {
      await page.mouse.move(x + dx, y + dy);
      await page.waitForFunction(({ x, y, held }) => {
        const move = moveView().drag?.lastMove;
        return move?.clientX === x && move.clientY === y && move.shiftKey === held;
      }, { x: x + dx, y: y + dy, held });
      return page.evaluate(() => moveCenter());
    };
    const follows = (start, end, dx, dy, label) => {
      const delta = end.map((v, i) => v - start[i]);
      assert.ok(Math.abs(delta[0] - dx) < .1 && Math.abs(delta[1] - dy) < .1,
        `${label}: expected screen move (${dx}, ${dy}), got (${delta})`);
    };
    const view = page.getByLabel('View direction', { exact: true });
    for (const camera of ['left','right','front','back','top','bottom','perspective','orthographic']) {
      await view.selectOption(camera);
      await page.waitForFunction(name => moveView().appliedView === name, camera);
      for (const plane of ['XY','ZX','YZ']) {
        await page.getByLabel(plane + ' workplane', { exact: true }).check();
        const original = await page.evaluate(() => authored());
        await page.mouse.move(x, y); await page.mouse.down();
        const start = await page.evaluate(() => moveCenter());
        const plain = await sample(36, -22);
        follows(start, plain, 36, -22, camera + '/' + plane);
        if (camera === 'left' && plane === 'XY') {
          await page.keyboard.down('Shift');
          const held = await sample(57, -36, true);
          follows(plain, held, 21, 0, 'Left/XY held Shift');
          assert.equal(await page.locator('.shift-lock-badge:visible').innerText(), 'X');
          await page.keyboard.up('Shift');
          follows(held, await sample(73, -18), 16, 18, 'Left/XY released Shift');
        }
        await page.mouse.up();
        await page.waitForFunction(before => authored().some((v, i) => Math.abs(v - before[i]) > .01), original);
        await page.keyboard.press('Control+z');
        await page.waitForFunction(before => authored().every((v, i) => v === before[i]), original);
      }
    }
    assert.deepEqual(errors, []);
    console.log('PASS Footman single-view Move in 8 views × 3 workplanes; Shift press/release, commit and undo');
  } finally { await closeApp(app); }
})().catch(error => { console.error(error); process.exitCode = 1; });
