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
  const { gatherStreams, updateBounds } = await import('../src/mesh-tools.js');
  const output = path.join(root, 'out', 'geoset-operations'); fs.mkdirSync(output, { recursive: true });
  const fixture = path.join(output, 'loose-parts.mdx'), doc = createDemoDocument();
  doc.apply('Prepare loose parts', ['Geosets'], model => {
    const g = model.Geosets[0];
    Object.assign(g, gatherStreams(g, [0, 1, 2, 3, 4, 5, 6, 0]));
    // Vertex 7 is an exact copy of vertex 0 for Weld selected duplicates.
    g.Faces = Uint16Array.of(0, 1, 2, 3, 4, 5, 7, 2, 1);
    g.PrimitiveTypes = Uint32Array.of(4); g.PrimitiveCounts = Uint32Array.of(9);
    updateBounds(g);
  });
  fs.writeFileSync(fixture, doc.serialize('mdx'));
  const original = fs.readFileSync(fixture);
  const { app, page: page, errors } = await launchApp({ fixture: fixture, out: output, pageTimeout: 15000 });
  try {
    await waitFor(page, () => (document.querySelectorAll('.classic-geoset-list [role="option"]').length === 5));
    const controls = await evaluate(page, () => ((() => { const buttons = [...document.querySelectorAll('.classic-geoset-operations button')]; const list = document.querySelector('.classic-geosets'); return { labels: buttons.map(button => button.textContent.trim()), beforeList: buttons.every(button => !!(button.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING)), sidebarWidth: getComputedStyle(document.querySelector('.classic-sidebar')).width }; })()));
    assert.deepEqual(controls.labels, ['Seperate by Loose parts', 'Nuclear', 'Delete free vertices', 'Weld selected duplicates', 'NormalsXL', 'Merge Geosets']);
    assert.equal(await evaluate(page, () => (document.querySelectorAll('.classic-geoset-operations > .classic-geoset-split > button').length)), 2);
    // NormalsXL repairs the whole visible model without a selection since e1fb86b7, so it stays enabled.
    assert.equal(controls.beforeList, true);
    assert.deepEqual(await evaluate(page, () => ([...document.querySelectorAll('.classic-geoset-operations button')].map(button => button.disabled))), [true, true, false, true, false, true]);
    await evaluate(page, () => (document.querySelector('[data-hotkey="geosetsClear"]').click()));
    assert.deepEqual(await evaluate(page, () => ([...document.querySelectorAll('.classic-geoset-operations button')].map(button => button.disabled))), [true, true, true, true, false, true]);
    await evaluate(page, () => (document.querySelector('[aria-label="Select geoset 0"]').click()));
    assert.deepEqual(await evaluate(page, () => ([...document.querySelectorAll('.classic-geoset-operations button')].map(button => button.disabled))), [true, true, false, true, false, true]);
    await evaluate(page, () => (document.querySelector('.classic-geoset-operations').querySelectorAll('button').forEach(button => { if (button.textContent.trim() === 'Delete free vertices') button.click(); })));
    await waitFor(page, () => (document.querySelector('.classic-status span').textContent === 'Deleted 1 free vertex from selected geosets.'));
    const selectAll = async () => {
      // The geoset list renders before the viewport, which mounts once the saved preferences are read.
      await waitFor(page, () => (!!document.querySelector('[aria-label="3D model viewport"] canvas')));
      await evaluate(page, () => (document.querySelector('[aria-label="3D model viewport"]').focus()));
      await page.keyboard.press('Control+a');
      await waitFor(page, () => (!document.querySelector('.classic-geoset-operations button:first-child').disabled));
      assert.deepEqual(await evaluate(page, () => ([...document.querySelectorAll('.classic-geoset-operations button')].map(button => button.disabled))), [false, false, false, false, false, false]);
    };
    await selectAll();
    await evaluate(page, () => (document.querySelector('.classic-geoset-operations').querySelectorAll('button').forEach(button => { if (button.textContent.trim() === 'Weld selected duplicates') button.click(); })));
    await waitFor(page, () => (document.querySelector('.classic-status span').textContent === 'Welded 1 duplicate vertex.'));
    await evaluate(page, () => (document.querySelector('.classic-geoset-operations').querySelectorAll('button').forEach(button => { if (button.textContent.trim() === 'Weld selected duplicates') button.click(); })));
    await waitFor(page, () => (document.querySelector('.classic-status span').textContent === 'No exact duplicates found in the selection.'));
    await evaluate(page, () => (document.querySelector('.classic-geoset-operations').querySelectorAll('button').forEach(button => { if (button.textContent.trim() === 'Seperate by Loose parts') button.click(); })));
    await waitFor(page, () => (document.querySelectorAll('.classic-geoset-list [role="option"]').length === 6));
    await evaluate(page, () => (document.querySelector('.classic-geoset-operations').querySelectorAll('button').forEach(button => { if (button.textContent.trim() === 'Merge Geosets') button.click(); })));
    await waitFor(page, () => (document.querySelectorAll('.classic-geoset-list [role="option"]').length === 5));
    assert.deepEqual(await evaluate(page, () => ([...document.querySelectorAll('.classic-geoset-operations button')].map(button => button.disabled))), [false, false, false, false, false, false]);
    await selectAll();
    await evaluate(page, () => (document.querySelector('.classic-geoset-operations').querySelectorAll('button').forEach(button => { if (button.textContent.trim() === 'Nuclear') button.click(); })));
    await waitFor(page, () => (document.querySelectorAll('.classic-geoset-list [role="option"]').length === 6));
    assert.equal(await evaluate(page, () => (getComputedStyle(document.querySelector('.classic-sidebar')).width)), controls.sidebarWidth);
    assert.ok(fs.readFileSync(fixture).equals(original));
    assert.deepEqual(errors, []);
    console.log('PASS rebuilt Electron: selected-geoset free-vertex deletion, duplicate weld, refined and nuclear split, merge, sidebar width and input file preserved');
  } finally { await closeApp(app); }
})().catch(error => { console.error(error); process.exitCode = 1; });
