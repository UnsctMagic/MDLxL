// Run after rebuilding dist: node test/geoset-operations.electron.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { launchApp, closeApp } = require('./helpers/app.cjs');
const root = path.resolve(__dirname, '..');
const evaluate = (page, expression) => page.evaluate(expression);
const waitFor = async (page, expression) => (await page.waitForFunction(expression, null, { timeout: 15000, polling: 100 })).jsonValue();

(async () => {
  const { createDemoDocument } = await import('../src/editor-document.js');
  const { gather, updateBounds } = await import('../src/mesh-tools.js');
  const output = path.join(root, 'out', 'geoset-operations'); fs.mkdirSync(output, { recursive: true });
  const fixture = path.join(output, 'loose-parts.mdx'), doc = createDemoDocument();
  doc.apply('Prepare loose parts', ['Geosets'], model => {
    const g = model.Geosets[0];
    Object.assign(g, gather(g, [0, 1, 2, 3, 4, 5, 6]));
    g.Faces = Uint16Array.of(0, 1, 2, 3, 4, 5);
    g.PrimitiveTypes = Uint32Array.of(4); g.PrimitiveCounts = Uint32Array.of(6);
    updateBounds(g);
  });
  fs.writeFileSync(fixture, doc.serialize('mdx'));
  const original = fs.readFileSync(fixture);
  const { app, page: cdp, errors } = await launchApp({ fixture, out: output, pageTimeout: 15000 });
  try {
    await waitFor(cdp, `document.querySelectorAll('.classic-geoset-list [role="option"]').length === 5`);
    const controls = await evaluate(cdp, `(() => { const buttons = [...document.querySelectorAll('.classic-geoset-operations button')]; const list = document.querySelector('.classic-geosets'); return { labels: buttons.map(button => button.textContent.trim()), beforeList: buttons.every(button => !!(button.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING)), sidebarWidth: getComputedStyle(document.querySelector('.classic-sidebar')).width }; })()`);
    assert.deepEqual(controls.labels, ['Seperate by Loose parts', 'Nuclear Seperation', 'Merge Geosets', 'NormalsXL', 'Delete free vertices']);
    // NormalsXL repairs the whole visible model without a selection since e1fb86b7, so it stays enabled.
    assert.equal(controls.beforeList, true);
    assert.deepEqual(await evaluate(cdp, `[...document.querySelectorAll('.classic-geoset-operations button')].map(button => button.disabled)`), [true, true, true, false, false]);
    await evaluate(cdp, `document.querySelector('[data-hotkey="geosetsClear"]').click()`);
    assert.deepEqual(await evaluate(cdp, `[...document.querySelectorAll('.classic-geoset-operations button')].map(button => button.disabled)`), [true, true, true, false, true]);
    await evaluate(cdp, `document.querySelector('[aria-label="Select geoset 0"]').click()`);
    assert.deepEqual(await evaluate(cdp, `[...document.querySelectorAll('.classic-geoset-operations button')].map(button => button.disabled)`), [true, true, true, false, false]);
    await evaluate(cdp, `document.querySelector('.classic-geoset-operations button:last-child').click()`);
    await waitFor(cdp, `document.querySelector('.classic-status span').textContent === 'Deleted 1 free vertex from selected geosets.'`);
    const selectAll = async () => {
      // The geoset list renders before the viewport, which mounts once the saved preferences are read.
      await waitFor(cdp, `!!document.querySelector('[aria-label="3D model viewport"] canvas')`);
      await evaluate(cdp, `document.querySelector('[aria-label="3D model viewport"]').focus()`);
      await cdp.keyboard.press('Control+a');
      await waitFor(cdp, `!document.querySelector('.classic-geoset-operations button:first-child').disabled`);
      assert.deepEqual(await evaluate(cdp, `[...document.querySelectorAll('.classic-geoset-operations button')].map(button => button.disabled)`), [false, false, false, false, false]);
    };
    await selectAll();
    await evaluate(cdp, `document.querySelector('.classic-geoset-operations button:first-child').click()`);
    await waitFor(cdp, `document.querySelectorAll('.classic-geoset-list [role="option"]').length === 6`);
    await evaluate(cdp, `document.querySelector('.classic-geoset-operations button:nth-child(3)').click()`);
    await waitFor(cdp, `document.querySelectorAll('.classic-geoset-list [role="option"]').length === 5`);
    assert.deepEqual(await evaluate(cdp, `[...document.querySelectorAll('.classic-geoset-operations button')].map(button => button.disabled)`), [false, false, false, false, false]);
    await selectAll();
    await evaluate(cdp, `document.querySelector('.classic-geoset-operations button:nth-child(2)').click()`);
    await waitFor(cdp, `document.querySelectorAll('.classic-geoset-list [role="option"]').length === 6`);
    assert.equal(await evaluate(cdp, `getComputedStyle(document.querySelector('.classic-sidebar')).width`), controls.sidebarWidth);
    assert.ok(fs.readFileSync(fixture).equals(original));
    assert.deepEqual(errors, []);
    console.log('PASS rebuilt Electron: selected-geoset free-vertex deletion, refined and nuclear split, merge, sidebar width and input file preserved');
  } finally { await closeApp(app); }
})().catch(error => { console.error(error); process.exitCode = 1; });
