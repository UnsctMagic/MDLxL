// Packaged UI regression. Mutations use the public controls; React reads only
// inspect geometry, selection, camera state and UV-canvas screen coordinates.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..'), output = path.join(root, 'out', 'mesh-density-review');
const executable = process.env.MDLXL_TEST_EXE || path.join(root, 'out/triangle-subdivision-package/MDLxL-win32-x64/MDLxL.exe');

function ownerOf(selector) {
  const element = document.querySelector(selector);
  if (!element) throw Error('Missing ' + selector);
  let fiber = element[Object.keys(element).find(key => key.startsWith('__reactFiber'))], top = fiber;
  while (top.return) top = top.return;
  const stack = [top.stateNode.current];
  while (stack.length) {
    const node = stack.pop();
    if (node.stateNode === element) return { element, fiber: node };
    for (let child = node.child; child; child = child.sibling) stack.push(child);
  }
  throw Error('Missing current React owner');
}
function readPreview() {
  const { fiber } = ownerOf('.uv-preview-canvas .game-preview-root');
  for (let node = fiber; node; node = node.return) for (let hook = node.memoizedState; hook; hook = hook.next) {
    const state = hook.memoizedState?.current;
    if (state?.native && state?.controls) return { model: structuredClone(node.memoizedProps.model), selection: structuredClone(node.memoizedProps.selectionByGeoset), camera: state.controls.object.quaternion.toArray() };
  }
  throw Error('Missing native preview');
}
function readUV() {
  const { element, fiber } = ownerOf('[aria-label="UV coordinate editor"]');
  for (let node = fiber; node; node = node.return) for (let hook = node.memoizedState; hook; hook = hook.next) {
    const state = hook.memoizedState?.current, props = node.memoizedProps;
    if (!state?.uv || !state.draw || !props.geoset) continue;
    const rect = element.getBoundingClientRect(), aspect = Math.max(.01, (Number(props.textureSize?.[0]) || 1) / (Number(props.textureSize?.[1]) || 1));
    const base = Math.max(20, Math.min((rect.width - 40) / 2.7, (rect.height - 40) / 2.3));
    const sizeX = base * (aspect >= 1 ? aspect : 1) * state.zoom, sizeY = base * (aspect >= 1 ? 1 : 1 / aspect) * state.zoom;
    const x = rect.x + (rect.width - sizeX) / 2 + state.panX, y = rect.y + (rect.height - sizeY) / 2 + state.panY;
    return { x, y, sizeX, sizeY, points: Array.from({ length: state.uv.length / 2 }, (_, id) => ({ x: x + state.uv[id * 2] * sizeX, y: y + state.uv[id * 2 + 1] * sizeY })) };
  }
  throw Error('Missing UV state');
}
async function setRange(locator, value) {
  await locator.evaluate((element, next) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, String(next));
    element.dispatchEvent(new Event('input', { bubbles: true })); element.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const { createStarterDocument } = await import('../src/starter-model.js');
  const { openDocument } = await import('../src/editor-document.js');
  const doc = createStarterDocument(), fixture = path.join(output, 'selected-density.mdx');
  doc.apply('Fixture', ['Geosets', 'Info'], model => {
    const shaft = model.Geosets[0];
    for (let offset = 0; offset < shaft.Vertices.length; offset++) shaft.Vertices[offset] *= offset % 3 === 1 ? 3 : .12;
    shaft.TVertices = [new Float32Array([0,0, .7,0, 1,.5, 0,1, 2,0, 2.7,0, 3,.5, 2,1])];
    const untouched = structuredClone(shaft); for (let offset = 0; offset < untouched.Vertices.length; offset += 3) untouched.Vertices[offset] += 180;
    const plane = structuredClone(shaft);
    plane.Vertices = new Float32Array([-20,-20,20, 20,-20,20, 20,20,20, -20,20,20]);
    plane.Normals = new Float32Array([0,0,1, 0,0,1, 0,0,1, 0,0,1]); plane.VertexGroup = new Uint8Array(4);
    plane.TVertices = [new Float32Array([10,0,11,0,11,1,10,1])]; plane.Faces = new Uint16Array([0,1,2,0,2,3]);
    model.Geosets.push(untouched, plane);
  });
  fs.writeFileSync(fixture, doc.serialize('mdx')); const original = fs.readFileSync(fixture);
  const app = await _electron.launch({ executablePath: executable, args: ['--disable-backgrounding-occluded-windows', fixture], cwd: root,
    env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: path.join(output, 'profile-' + Date.now()) }, timeout: 60000 });
  let uv, main; const errors = [], checks = [];
  const capture = async name => {
    const window = await app.browserWindow(uv || main);
    const png = await window.evaluate(window => window.webContents.capturePage().then(image => image.toPNG().toString('base64')));
    fs.writeFileSync(path.join(output, name + '.png'), Buffer.from(png, 'base64'));
  };
  try {
    main = await app.firstWindow(); main.setDefaultTimeout(15000); main.on('pageerror', error => errors.push(error.message));
    const mainWindow = await app.browserWindow(main);
    await mainWindow.evaluate(window => { window.webContents.setBackgroundThrottling(false); window.setBounds({ x: -4000, y: 0, width: 1600, height: 1000 }); window.showInactive(); });
    await main.getByLabel('Select geoset 2', { exact: true }).waitFor();
    await main.locator('[data-warmkey="geosetsClear"]').click();
    await main.getByLabel('Select geoset 0', { exact: true }).check(); await main.getByLabel('Select geoset 2', { exact: true }).check();
    await main.getByLabel('3D model viewport', { exact: true }).click(); await main.keyboard.press('Control+a');
    const opened = app.waitForEvent('window'); await main.locator('[data-warmkey="uv"]').click(); uv = await opened;
    uv.setDefaultTimeout(15000); uv.on('pageerror', error => errors.push(error.message));
    const uvWindow = await app.browserWindow(uv);
    await uvWindow.evaluate(window => { window.webContents.setBackgroundThrottling(false); window.setBounds({ x: -4000, y: 0, width: 1600, height: 1000 }); window.showInactive(); });
    await uv.getByLabel('UV coordinate editor').waitFor();
    await uv.evaluate('window.ownerOf = ' + ownerOf.toString());
    await uv.evaluate('window.readDensityPreview = ' + readPreview.toString());
    await uv.waitForFunction(() => window.readDensityPreview().model.Geosets.length === 3);
    const initial = await uv.evaluate(readPreview);
    assert.equal(await uv.locator('.uv-density-popup').count(), 0); checks.push('Compact default UV workspace');
    const triangles = uv.getByRole('button', { name: 'Triangles', exact: true }), popup = uv.locator('.uv-density-popup');
    const previewAt = async (amount, count) => {
      await triangles.click(); await popup.waitFor(); assert.equal(await popup.locator('select').count(), 0);
      assert.equal(await popup.locator('.mesh-density-labels').evaluate(element => getComputedStyle(element).display), 'grid', 'density slider styles must be present in the detached window');
      await setRange(popup.getByLabel('Triangle density'), amount);
      await uv.waitForFunction(expected => document.querySelector('.uv-density-popup .mesh-density-counts')?.textContent.includes(expected + ' triangles'), count);
      assert.equal(await popup.locator('.mesh-density-error').count(), 0);
      return uv.evaluate(readPreview);
    };
    const multi = await previewAt(25, 56);
    assert.deepEqual(multi.model.Geosets.map(geoset => geoset.Faces.length / 3), [48,12,8]);
    assert.deepEqual(multi.model.Geosets[1], initial.model.Geosets[1]);
    await popup.getByRole('button', { name: 'Apply', exact: true }).click(); await popup.waitFor({ state: 'detached' });
    assert.deepEqual((await uv.evaluate(readPreview)).model.Geosets, multi.model.Geosets);
    await uv.keyboard.press('Control+z');
    await uv.waitForFunction(() => window.readDensityPreview().model.Geosets[0].Faces.length === 36);
    assert.deepEqual((await uv.evaluate(readPreview)).model.Geosets, initial.model.Geosets); checks.push('Multi-geoset Apply is one undoable edit; unselected geoset preserved');
    const mapping = await uv.evaluate(readUV);
    await uv.mouse.click(mapping.x + mapping.sizeX * (.7 + 1) / 3, mapping.y + mapping.sizeY * .5 / 3);
    await uv.waitForFunction(() => window.readDensityPreview().selection[0]?.length === 3);
    assert.deepEqual([...(await uv.evaluate(readPreview)).selection[0]].sort((a,b) => a-b), [0,1,2]);
    const one = await previewAt(25, 15), source = initial.model.Geosets[0], next = one.model.Geosets[0];
    assert.deepEqual(next.Faces.slice(12), source.Faces.slice(3));
    assert.deepEqual(next.Vertices.slice(0, source.Vertices.length), source.Vertices);
    assert.deepEqual(next.TVertices[0].slice(0, source.TVertices[0].length), source.TVertices[0]);
    assert.deepEqual(one.model.Geosets.slice(1), initial.model.Geosets.slice(1));
    assert.ok(!one.selection[0].includes(3));
    const canvas = uv.locator('.uv-preview-canvas .game-preview-surface canvas').first(), bounds = await canvas.boundingBox();
    await uv.mouse.move(bounds.x + bounds.width * .6, bounds.y + bounds.height * .6); await uv.mouse.down();
    await uv.mouse.move(bounds.x + bounds.width * .6 + 65, bounds.y + bounds.height * .6 + 35, { steps: 8 }); await uv.mouse.up();
    const rotated = await uv.evaluate(readPreview); assert.notDeepEqual(rotated.camera, one.camera); checks.push('Real mouse rotation while density preview is open');
    await capture('selected-triangle-preview');
    await popup.getByRole('button', { name: 'Cancel', exact: true }).click(); await popup.waitFor({ state: 'detached' });
    assert.deepEqual((await uv.evaluate(readPreview)).model.Geosets, initial.model.Geosets); checks.push('Cancel restores the exact original geometry');
    await previewAt(25, 15); await popup.getByRole('button', { name: 'Apply', exact: true }).click(); await popup.waitFor({ state: 'detached' });
    const applied = await uv.evaluate(readPreview); assert.deepEqual(applied.model.Geosets, one.model.Geosets);
    const repeated = await previewAt(25, 27); assert.equal(repeated.model.Geosets[0].Faces.length / 3, 27);
    assert.equal(await popup.getByLabel('Triangle density').getAttribute('max'), '100');
    await popup.getByRole('button', { name: 'Cancel', exact: true }).click(); await popup.waitFor({ state: 'detached' }); checks.push('Single-face Apply and repeated subdivision');
    await uv.keyboard.press('Control+z'); await uv.waitForFunction(() => window.readDensityPreview().model.Geosets[0].Faces.length === 36);
    assert.deepEqual((await uv.evaluate(readPreview)).model.Geosets, initial.model.Geosets);
    await uv.keyboard.press('Control+y'); await uv.waitForFunction(() => window.readDensityPreview().model.Geosets[0].Faces.length === 45);
    assert.deepEqual((await uv.evaluate(readPreview)).model.Geosets, applied.model.Geosets); checks.push('Undo/redo preserves selected subdivision');
    assert.ok(fs.readFileSync(fixture).equals(original), 'Preview and Apply leave the input file unchanged before Save');
    const point = (await uv.evaluate(readUV)).points[9]; await uv.mouse.click(point.x, point.y);
    await uv.getByRole('button', { name: 'Move', exact: true }).click();
    await uv.mouse.move(point.x, point.y); await uv.mouse.down(); await uv.mouse.move(point.x + 35, point.y + 18, { steps: 6 }); await uv.mouse.up();
    const stretched = await uv.evaluate(readPreview);
    assert.notDeepEqual(stretched.model.Geosets[0].TVertices[0], applied.model.Geosets[0].TVertices[0]);
    assert.deepEqual(stretched.model.Geosets[0].Vertices, applied.model.Geosets[0].Vertices);
    assert.deepEqual(stretched.model.Nodes, initial.model.Nodes); checks.push('New UV control point can stretch the texture without changing the surface or rig');
    await uv.getByRole('button', { name: 'Exit UV Wrapper', exact: true }).click();
    await main.keyboard.press('Control+s');
    await main.waitForFunction(() => !document.querySelector('.classic-status')?.textContent.includes('Saving'));
    await main.waitForTimeout(700);
    const reopened = openDocument(fs.readFileSync(fixture), fixture);
    assert.deepEqual(reopened.model.Geosets[0].Faces, stretched.model.Geosets[0].Faces);
    assert.deepEqual(reopened.model.Geosets[0].TVertices, stretched.model.Geosets[0].TVertices);
    assert.deepEqual(reopened.model.Geosets[1], initial.model.Geosets[1]); checks.push('MDX save/reopen retains subdivision and UV editing');
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify({ executable, checks, rendererErrors: errors }, null, 2));
    console.log(JSON.stringify({ pass: true, checks }, null, 2));
  } catch (error) {
    if (main && (!uv || !uv.isClosed())) { await capture('failure'); console.error((await (uv || main).locator('body').innerText()).slice(0, 2500)); }
    console.error('Renderer errors:', errors); throw error;
  } finally { await app.evaluate(({ app }) => app.exit(0)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
