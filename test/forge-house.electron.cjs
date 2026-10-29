const { launchApp, closeApp, settle } = require('./helpers/app.cjs');
// Acceptance proof: an empty file becomes a house through public UI input only.
// Every change is made with the mouse and keyboard (Forge buttons, dimension and
// coordinate fields, double-click, viewport drags, Save). React state is read only
// to find where on screen a face or handle is, as the other Forge tests do; no mesh
// is injected and no private editing call is made.
// Run against a packaged app using MDLXL_TEST_EXE and MDLXL_PLAYWRIGHT_MODULE.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const out = process.env.MDLXL_TEST_OUT || path.join(root, 'out/forge-house-proof');
const faceEditing = fs.readFileSync(path.join(__dirname, 'forge-face-editing.electron.cjs'), 'utf8');
let helper = faceEditing.slice(faceEditing.indexOf('function readView'), faceEditing.indexOf('(async()=>{'));
const handleEnd = 'y:r.y+(1-v.y)*r.height/2};}),surfaceColors:'; assert.ok(helper.includes(handleEnd), 'readView reports shaping handles');
// Screen direction of each model axis at a shaping handle, so a drag can follow it.
helper = helper.replace(handleEnd, 'y:r.y+(1-v.y)*r.height/2,axes:[0,1,2].map(a=>{const q=camera.position.clone().fromArray(h.position);q.setComponent(a,q.getComponent(a)+1);q.project(camera);return [(q.x-v.x)*r.width/2,(v.y-q.y)*r.height/2];})};}),surfaceColors:');
eval(helper);
const cuts = fs.readFileSync(path.join(__dirname, 'forge-cuts.electron.cjs'), 'utf8');
eval(cuts.slice(cuts.indexOf('function readDraft'), cuts.indexOf('(async()=>{', cuts.indexOf('function readDraft'))));

(async () => {
  fs.mkdirSync(path.join(out, 'steps'), { recursive: true });
  const { forgeFaceNormal } = await import('../src/forge-shape-editing.js');
  const modelPath = path.join(out, 'Forge House.mdl');
  fs.writeFileSync(modelPath, 'Version { FormatVersion 800, }\nModel "Forge House" { BlendTime 150, }\n');
  const emptyBytes = fs.readFileSync(modelPath);
  const launched = await launchApp({ out, fixture: modelPath, timeout: 60000, bounds: { x: 0, y: 0, width: 1600, height: 1000 }, show: 'hide', pageTimeout: 12000 }); const app = launched.app; const executable = launched.target.executablePath;
  let page, step = 0;
  const errors=launched.errors, steps = [];
  const capture = async label => {
    const file = path.join(out, 'steps', `${String(++step).padStart(3, '0')}-${label}.png`);
    const pixels = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.capturePage().then(image => image.toPNG().toString('base64')));
    fs.writeFileSync(file, Buffer.from(pixels, 'base64'));
    steps.push(label);
  };
  try {
    page=launched.page;

    await page.getByLabel('3D model viewport', { exact: true }).waitFor(); await capture('empty-model');
    await page.locator('[data-hotkey="forge"]').click();
    const d = page.getByRole('dialog', { name: 'Forge', exact: true });
    await d.getByRole('tab', { name: 'Shape', exact: true }).click();
    // Deliberately human-paced, including ordinary button clicks.
    const click = async name => { await d.getByRole('button', { name, exact: true }).click(); await settle(page, 250); };
    const type = async (label, value) => { const field = d.getByLabel(label, { exact: true }); await field.fill(String(value)); await field.press('Enter'); await settle(page, 200); };
    const view = async () => { await settle(page, 150); return page.evaluate(readView); };
    const draft = () => page.evaluate(readDraft);
    const drag = async (from, dx, dy, modifiers = []) => {
      for (const key of modifiers) await page.keyboard.down(key);
      await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move(from.x + dx, from.y + dy, { steps: 12 }); await page.mouse.up();
      for (const key of modifiers) await page.keyboard.up(key);
      await settle(page, 250);
    };
    // Add one piece from the shape palette with typed dimensions, then place its center.
    const piece = async (label, shape, [width, height, depth], [x, y, z]) => {
      if (await d.getByRole('group', { name: 'Add shape', exact: true }).count() === 0) await click('Add shape');
      await type('Width', width); await type('Height', height); await type('Depth', depth); await click(shape);
      await type('X coordinate', x); await type('Y coordinate', y); await type('Z coordinate', z);
      await capture(label);
      return (await draft()).shapes.at(-1);
    };
    // Screen point of a face of the shape-th Forge piece (each piece is its own preview geoset).
    const facePoint = (v, doc, shape, face) => { const gi = doc.shapes.findIndex(s => s.id === shape.id), points = face.vertices.map(i => pointForVertex(v, shape.vertices[i], gi)); return { x: points.reduce((n, p) => n + p.x, 0) / points.length, y: points.reduce((n, p) => n + p.y, 0) / points.length }; };
    const bounds = shape => [0, 1, 2].map(a => [Math.min(...shape.vertices.map(p => p[a])), Math.max(...shape.vertices.map(p => p[a]))]);
    const near = (a, b, label) => assert.ok(Math.abs(a - b) < 1e-3, `${label}: ${a} vs ${b}`);
    const box = (shape, expected, label) => bounds(shape).forEach((range, a) => range.forEach((n, i) => near(n, expected[a][i], label + ' ' + 'XYZ'[a])));

    // Walls, then a roof block resting on them.
    let walls = await piece('walls', 'Cube', [240, 120, 160], [0, 0, 60]);
    box(walls, [[-120, 120], [-80, 80], [0, 120]], 'walls');
    const roofBlock = await piece('roof-block', 'Cube', [270, 70, 190], [0, 0, 155]);
    box(roofBlock, [[-135, 135], [-95, 95], [120, 190]], 'roof block');

    // Taper the roof along Up by dragging the gold handle toward the narrow end.
    await click('Taper'); await click('Shape along up');
    let v = await view(); const handle = v.moldHandles.find(h => h.id === 'amount'); assert.ok(handle, 'Taper amount handle');
    const [ax, ay] = handle.axes[0], length = Math.hypot(ax, ay);
    const distance = 160 * length; // model units: -0.9 needs 121.5 along X here
    await drag(handle, -ax / length * distance, -ay / length * distance);
    assert.match(await d.locator('.forge-mold-bar').innerText(), /-90%/);
    await capture('roof-taper-preview'); await click('Keep shaping');
    const roof = (await draft()).shapes.find(s => s.id === roofBlock.id), roofTop = roof.vertices.filter(p => Math.abs(p[2] - 190) < 1e-3), roofBase = roof.vertices.filter(p => Math.abs(p[2] - 120) < 1e-3);
    assert.ok(roofTop.length && roofBase.length);
    near(Math.max(...roofTop.map(p => p[0])), 13.5, 'roof ridge half width'); near(Math.max(...roofBase.map(p => p[0])), 135, 'roof eaves half width');

    // Chimney: a tall block through the roof whose top is inset and extruded into a flue.
    const chimney = await piece('chimney', 'Cube', [28, 80, 28], [60, 25, 190]);
    v = await view(); let doc = await draft(), shape = doc.shapes.find(s => s.id === chimney.id);
    let top = shape.faces.find(f => forgeFaceNormal(shape, f)[2] > .999), point = facePoint(v, doc, shape, top);
    await page.mouse.dblclick(point.x, point.y, { delay: 90 }); await settle(page, 250);
    doc = await draft(); assert.equal(doc.mode, 'Faces'); assert.deepEqual(doc.selection[chimney.id], [top.id]);
    await click('Inset'); doc = await draft(); shape = doc.shapes.find(s => s.id === chimney.id);
    assert.equal(doc.selection[chimney.id].length, 1); assert.ok(shape.faces.length > chimney.faces.length, 'inset adds a border');
    v = await view(); point = facePoint(v, doc, shape, shape.faces.find(f => f.id === doc.selection[chimney.id][0]));
    await click('Extrude'); await drag(point, 0, -30); await capture('chimney-flue');
    const flue = (await draft()).shapes.find(s => s.id === chimney.id);
    assert.ok(Math.max(...flue.vertices.map(p => p[2])) > 230 + 1, 'flue rises above the chimney');

    // Door and two windows on the front (-Y) wall; the second window is a Duplicate.
    await click('Shape');
    const door = await piece('door', 'Cube', [50, 80, 8], [0, -82, 40]);
    const window1 = await piece('window', 'Cube', [40, 36, 8], [-75, -82, 72]);
    await click('Duplicate'); await type('X coordinate', 75); await type('Y coordinate', -82); await type('Z coordinate', 72); await capture('second-window');
    doc = await draft(); assert.equal(doc.shapes.length, 6);
    box(doc.shapes.find(s => s.id === door.id), [[-25, 25], [-86, -78], [0, 80]], 'door'); box(doc.shapes.find(s => s.id === window1.id), [[-95, -55], [-86, -78], [54, 90]], 'window'); box(doc.shapes.at(-1), [[55, 95], [-86, -78], [54, 90]], 'duplicated window');

    // The preview keeps normal mouse camera rotation.
    v = await view(); await drag({ x: v.rect.x + v.rect.width * .7, y: v.rect.y + v.rect.height * .5 }, 60, 25, ['Alt']);
    assert.notDeepEqual((await view()).quaternion, v.quaternion, 'Alt-drag rotates the Forge camera');
    await capture('house-draft');

    await click('Add to model'); await d.waitFor({ state: 'hidden' }); await capture('added-to-model');
    await page.keyboard.press('Control+s');
    for (let tries = 0; tries < 200 && fs.readFileSync(modelPath).equals(emptyBytes); tries++) await settle(page, 50);
    await settle(page, 500); await capture('saved');

    const { openDocument } = await import('../src/editor-document.js');
    const document = openDocument(fs.readFileSync(modelPath), 'Forge House.mdl');
    assert.deepEqual(document.diagnostics.filter(diagnostic => diagnostic.severity === 'error'), []);
    const geosets = document.model.Geosets;
    assert.equal(geosets.length, 6);
    for (const geoset of geosets) {
      assert.ok([...geoset.Vertices, ...geoset.Normals, ...geoset.TVertices[0]].every(Number.isFinite));
      assert.ok(geoset.Faces.length > 0 && geoset.Faces.every(index => index < geoset.Vertices.length / 3));
    }
    const extent = g => [0, 1, 2].map(a => { const values = Array.from({ length: g.Vertices.length / 3 }, (_, i) => g.Vertices[i * 3 + a]); return [Math.min(...values), Math.max(...values)]; });
    const [wallsBox, roofBox, chimneyBox, doorBox, windowBox, window2Box] = geosets.map(extent);
    near(wallsBox[2][1], roofBox[2][0], 'roof rests on the walls'); near(chimneyBox[0][0], 46, 'chimney x');
    assert.ok(chimneyBox[2][1] > roofBox[2][1] && chimneyBox[2][0] < roofBox[2][1], 'chimney passes through the roof');
    for (const box of [doorBox, windowBox, window2Box]) assert.ok(box[1][0] < wallsBox[1][0] && box[1][1] > wallsBox[1][0], 'front-wall piece sits on the front wall');
    near(doorBox[2][0], 0, 'door on the ground'); assert.ok(windowBox[0][1] < doorBox[0][0] && window2Box[0][0] > doorBox[0][1], 'door between the windows');
    const triangles = geosets.reduce((count, geoset) => count + geoset.Faces.length / 3, 0);
    assert.equal(triangles, 88);
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'verification.json'), JSON.stringify({ executable, modelPath, construction: 'Public mouse/keyboard controls only, from an empty model', steps, geosets: geosets.length, triangles, rendererErrors: errors }, null, 2));
    console.log(`PASS: mouse-built house (${geosets.length} geosets, ${triangles} triangles) saved to ${modelPath}`);
  } catch (error) { if (page) await capture('failure').catch(() => {}); throw error; }
  finally{if(app)await closeApp(app); }
})().catch(error => { console.error(error); process.exitCode = 1; });
