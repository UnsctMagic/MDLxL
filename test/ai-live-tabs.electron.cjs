// Opt-in: a real signed-in provider works on several model tabs at once, with
// birds editing in the background while other tabs are showing. Run on the hidden
// desktop. Uses only generated models and a disposable profile:
//   MDLXL_AI_LIVE_PROFILE  a copy of a signed-in MDLxL profile (it is used as is)
//   MDLXL_AI_TEST_EXE      the packaged app
//   MDLXL_AI_LIVE_MODEL    optional chat model (default: the profile's choice)
const fs = require('node:fs'),
  path = require('node:path'),
  crypto = require('node:crypto');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'D:/Claude/tools/node_modules/playwright-core');
const profile = process.env.MDLXL_AI_LIVE_PROFILE,
  executablePath = process.env.MDLXL_AI_TEST_EXE;
if (!profile || !executablePath) throw Error('Set MDLXL_AI_LIVE_PROFILE and MDLXL_AI_TEST_EXE.');
const out = path.resolve(process.env.MDLXL_AI_TEST_OUT || 'out/ai-live-tabs'),
  checks = [],
  prompts = [];
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
// A failed check is recorded, not thrown: one weak answer must not hide the rest.
const check = (name, condition, detail) => {
  checks.push({ name, passed: !!condition, ...(detail !== undefined ? { detail } : {}) });
  console.log((condition ? 'PASS ' : 'FAIL ') + name + (condition || detail === undefined ? '' : ' ' + JSON.stringify(detail).slice(0, 400)));
};
let app, page;
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const { createStarterDocument } = await import('../src/starter-model.js');
  // Three small models: two quads (geosets 0 and 1), one bone with keys, two animations.
  const fixture = (name, offset) => {
    const doc = createStarterDocument();
    doc.apply('Live fixture', ['Geosets', 'Sequences', 'Bones'], model => {
      const g = model.Geosets[0];
      Object.assign(g, {
        Vertices: new Float32Array([0, 0, -20, 40, 0, -20, 40, 0, 20, 0, 0, 20].map((v, i) => (i % 3 === 0 ? v + offset : v))),
        Normals: new Float32Array([0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0]),
        Faces: new Uint16Array([0, 1, 2, 0, 2, 3]),
        VertexGroup: new Uint8Array(4),
        TVertices: [new Float32Array([0, 0, 1, 0, 1, 1, 0, 1])],
      });
      delete g.Tangents;
      delete g.SkinWeights;
      const other = structuredClone(g);
      for (let i = 0; i < other.Vertices.length; i += 3) other.Vertices[i] += 100;
      model.Geosets.push(other);
      model.Sequences = [
        { Name: 'Stand', Interval: new Uint32Array([0, 1000]), MoveSpeed: 0, NonLooping: false, Rarity: 0 },
        { Name: 'Attack', Interval: new Uint32Array([2000, 3000]), MoveSpeed: 0, NonLooping: false, Rarity: 0 },
      ];
      model.Bones[0].Translation = {
        LineType: 1,
        GlobalSeqId: null,
        Keys: [0, 1000, 2000, 3000].map(Frame => ({ Frame, Vector: new Float32Array([0, 0, 0]) })),
      };
    });
    const file = path.join(out, name);
    fs.writeFileSync(file, doc.serialize('mdx'));
    return { file, name, original: doc.model };
  };
  const models = { A: fixture('Alpha.mdx', 0), B: fixture('Bravo.mdx', 0), C: fixture('Charlie.mdx', 0) };
  const originalBytes = Object.fromEntries(Object.entries(models).map(([k, m]) => [k, fs.readFileSync(m.file)]));
  app = await _electron.launch({
    executablePath,
    args: [models.A.file, '--disable-gpu-vsync', '--disable-frame-rate-limit'],
    env: { ...process.env, MDLXL_PROFILE: profile, MDLXL_DISABLE_UPDATES: '1', TEMP: path.join(out, 'temp'), TMP: path.join(out, 'temp') },
    timeout: 60000,
  });
  page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    win.webContents.setBackgroundThrottling(false);
    win.unmaximize();
    win.setContentSize(1440, 900);
  });
  await page.waitForSelector('.classic-toolbar', { timeout: 60000 });
  // An earlier interrupted run leaves recovery copies; this run starts from its own files.
  await page.waitForTimeout(1500);
  if (await page.locator('.classic-modal', { hasText: 'Recovery' }).count())
    await page.locator('.classic-modal').getByRole('button', { name: 'Close', exact: true }).click();
  for (const key of ['B', 'C']) {
    await app.evaluate(({ dialog }, file) => (dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] })), models[key].file);
    await page.getByRole('button', { name: 'Open', exact: true }).click();
    await page.waitForFunction(name => document.querySelector('.model-tab.active [role="tab"]')?.textContent.includes(name), models[key].name, { timeout: 20000 });
  }
  if (process.env.MDLXL_AI_LIVE_MODEL) await page.evaluate(model => window.desktop.aiModel(model), process.env.MDLXL_AI_LIVE_MODEL);
  const auth = await page.evaluate(() => window.desktop.aiAuth('status'));
  check('the real provider account is signed in', auth.loggedIn === true, auth);
  if (!auth.loggedIn) return;
  const link = (await page.evaluate(async () => (await window.desktop.aiEnable(true), window.desktop.aiConfig()))).mcpServers.mdlxl;
  const tool = async (name, args = {}) => {
    const response = await fetch(link.url, {
      method: 'POST',
      headers: { ...link.headers, 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: crypto.randomUUID(), method: 'tools/call', params: { name, arguments: args } }),
    });
    const value = await response.json();
    if (value.error || value.result?.isError) throw Error(value.error?.message || value.result.content[0].text);
    return value.result.content[0].type === 'image' ? value.result.content[0] : JSON.parse(value.result.content[0].text);
  };
  const documents = async () => Object.fromEntries((await tool('mdlxl_document', { action: 'list' })).map(d => [d.name, d.id]));
  const read = async (key, pointer) => (await tool('mdlxl_read', { documentId: (await documents())[models[key].name], path: pointer })).value;
  const floats = value => Array.from(value?.$data ?? value ?? []);
  const show = async key => {
    // After saving a model the AI worked on, MDLxL asks how to tidy its chats.
    if (await page.locator('.ai-cleanup').count()) {
      check('saving after AI work asks how to tidy the chats', true);
      await page.locator('.ai-cleanup-choices button', { hasText: 'Keep everything' }).click();
    }
    await page.locator('.model-tab [role="tab"]', { hasText: models[key].name }).click();
    await page.waitForFunction(name => document.querySelector('.model-tab.active [role="tab"]')?.textContent.includes(name), models[key].name);
    await page.waitForTimeout(700);
  };
  const select = async vertices => {
    const context = await tool('mdlxl_context');
    await tool('mdlxl_select', { target: context.target, geosetIds: Object.keys(vertices).map(Number), vertices });
    await page.waitForTimeout(200);
  };
  const running = () => page.evaluate(async () => (await window.desktop.aiStatus()).running || []);
  const reply = () => page.evaluate(() => document.querySelector('.ai-messages')?.innerText || '');
  async function send(key, text, { vertices } = {}) {
    await show(key);
    if (vertices) await select(vertices);
    await page.getByLabel('AI prompt').fill(text);
    // Send once this model's own chat shows and is free (not the previous tab's chat).
    const button = page.locator('.ai-send');
    let ready = false;
    for (let i = 0; i < 60 && !ready; i++) {
      ready = (await button.getAttribute('aria-label')) === 'Send' && !(await button.isDisabled());
      if (!ready) await wait(250);
    }
    check(`${models[key].name}: its chat is ready to send "${text.slice(0, 40)}"`, ready);
    await page.getByLabel('AI prompt').press('Enter');
    prompts.push({ model: models[key].name, text, sent: new Date().toISOString() });
    await page.waitForTimeout(3000);
    const problem = (await page.locator('.ai-error').count()) ? await page.locator('.ai-error').first().innerText() : '';
    check(`${models[key].name}: the prompt started without an error`, !problem, problem);
  }
  async function settle(label, minutes = 8) {
    const until = Date.now() + minutes * 60000;
    let peak = 0;
    while (Date.now() < until) {
      const now = await running();
      peak = Math.max(peak, now.length);
      if (!now.length) break;
      await wait(2000);
    }
    const left = await running();
    check(`${label}: every job finished in time`, !left.length, left);
    return peak;
  }
  await page.getByRole('button', { name: 'AI assistant', exact: true }).click();
  await page.waitForSelector('.ai-assistant');
  await page.waitForTimeout(1500);

  // MDLXL_AI_LIVE_FROM=5 runs only the last batch (it does not depend on earlier ones).
  const from = Number(process.env.MDLXL_AI_LIVE_FROM || 1),
    aOrig = Array.from(models.A.original.Geosets[0].Vertices);
  if (from <= 4) {
  // Batch 1: three models at once.
  await send('A', 'Move the marked vertices up by 10 on the Z axis. Nothing else.', { vertices: { 0: [0, 1] } });
  await send('B', 'Rename bone 0 to Root.');
  await send('C', 'Rename the animation "Attack" to "Slam".');
  const peak1 = await settle('batch 1');
  check('three jobs on three models ran at the same time', peak1 >= 2, peak1);
  const aVerts = floats(await read('A', '/Geosets/0/Vertices'));
  check('1 Alpha: marked vertices raised 10 on Z, the rest unchanged', aVerts[2] === aOrig[2] + 10 && aVerts[5] === aOrig[5] + 10 && aVerts.every((v, i) => [2, 5].includes(i) || v === aOrig[i]), aVerts);
  check('2 Bravo: bone renamed to Root', (await read('B', '/Bones/0/Name')) === 'Root');
  check('3 Charlie: Attack renamed to Slam', (await read('C', '/Sequences/1/Name')) === 'Slam' && (await read('C', '/Sequences/0/Name')) === 'Stand');

  // Each tab keeps its own Undo: Ctrl+Z on Alpha takes back only Alpha's AI edit.
  await show('A');
  await page.locator('.classic-view canvas').first().click({ position: { x: 30, y: 300 } });
  let undone = false;
  for (let i = 0; i < 4 && !undone; i++) {
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);
    undone = floats(await read('A', '/Geosets/0/Vertices'))[2] === aOrig[2];
  }
  check('Ctrl+Z on Alpha undoes its AI edit; Bravo keeps its rename', undone && (await read('B', '/Bones/0/Name')) === 'Root');
  for (let i = 0; i < 4 && floats(await read('A', '/Geosets/0/Vertices'))[2] !== aOrig[2] + 10; i++) {
    await page.keyboard.press('Control+y');
    await page.waitForTimeout(300);
  }

  // Batch 2: geometry, animation and normals, again side by side.
  await send('A', 'Delete geoset 1 completely. Keep geoset 0 as it is.');
  await send('B', 'Add a new animation named "Walk" from frame 4000 to 5000.');
  await send('C', 'Reverse the normals of geoset 0 (flip them to point the other way). Do not move any vertex.');
  await settle('batch 2');
  check('4 Alpha: geoset 1 deleted, geoset 0 kept', (await read('A', '/Geosets')).length === 1 && floats(await read('A', '/Geosets/0/Vertices'))[2] === aOrig[2] + 10);
  const walk = (await read('B', '/Sequences')).find(s => s.Name === 'Walk');
  check('5 Bravo: Walk animation 4000-5000 added', walk && floats(walk.Interval).join() === '4000,5000', walk);
  const cNormals = floats(await read('C', '/Geosets/0/Normals'));
  check('6 Charlie: geoset 0 normals flipped, vertices kept', cNormals[1] === 1 && floats(await read('C', '/Geosets/0/Vertices')).join() === Array.from(models.C.original.Geosets[0].Vertices).join(), cNormals);

  // Batch 3: rig and animation keys while the user watches another tab.
  await send('B', "Move bone 0's pivot point to 0, 0, 50.");
  await send('C', 'In the Stand animation, add a translation key at frame 500 on bone 0 that moves it up 20 on Z. Leave the other keys as they are.');
  await send('A', 'How many vertices and triangles does this model have now? Just answer, do not edit.');
  await show('A');
  await settle('batch 3');
  check('7 Bravo: pivot moved to 0,0,50', floats(await read('B', '/PivotPoints/0')).join() === '0,0,50', await read('B', '/PivotPoints/0'));
  const keys = (await read('C', '/Bones/0/Translation')).Keys;
  const key500 = keys.find(k => k.Frame === 500);
  check('8 Charlie: key at 500 moves the bone up 20', key500 && floats(key500.Vector)[2] === 20 && keys.filter(k => k.Frame !== 500).every(k => floats(k.Vector).every(v => v === 0)), keys);
  const answer = await reply();
  check('9 Alpha: a question gets an answer (4 vertices, 2 triangles) without an edit', /\b4\b/.test(answer) && /\b2\b/.test(answer) && (await read('A', '/Geosets')).length === 1, answer.slice(-300));

  // Batch 4: drawings and pictures in the background.
  await show('C');
  await page.getByRole('button', { name: 'Marker', exact: true }).click();
  const box = await page.locator('.classic-view canvas').first().boundingBox();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5);
  await page.mouse.down();
  for (let i = 1; i <= 20; i++) await page.mouse.move(box.x + box.width * (0.3 + 0.4 * (i / 20)), box.y + box.height * 0.5);
  await page.mouse.up();
  await page.keyboard.press('Escape');
  const drawn = (await tool('mdlxl_context')).annotations;
  check('the marker drawing reaches the AI context', drawn?.strokes?.length === 1, drawn?.strokes?.length);
  await send('C', 'Look at a picture of the model and tell me in a few words what colour the marker drawing is and roughly where it is. Do not edit.');
  await send('B', 'Take a picture of the model from the front and from the left and describe the shape in one sentence. Do not edit.');
  await show('A'); // both work while Alpha is showing
  const viewBefore = await page.locator('.classic-view canvas').first().screenshot();
  await settle('batch 4');
  check("10/11 the birds' pictures never moved the view on screen", viewBefore.equals(await page.locator('.classic-view canvas').first().screenshot()));
  await show('C');
  const colour = await reply();
  check('10 Charlie: the AI sees the yellow marker in its picture', /yellow/i.test(colour), colour.slice(-300));
  await show('B');
  check('11 Bravo: the AI describes its off-screen pictures', /flat|plane|quad|square|rectang|panel|sheet/i.test(await reply()), (await reply()).slice(-300));

  }
  // Batch 5: screen steps wait for their tab; more edits side by side.
  await send('B', 'Rename bone 0 to Base, then save this model with the normal Save command.');
  await show('A');
  let paused = false;
  for (let i = 0; i < 120 && !paused; i++) {
    paused = (await page.locator('.ai-paused').count()) > 0;
    await wait(500);
  }
  check("12 Bravo: Save waits for Bravo's tab", paused || !fs.readFileSync(models.B.file).equals(originalBytes.B));
  const beforeScale = floats(await read('A', '/Geosets/0/Vertices'));
  await send('A', 'Scale geoset 0 to twice its size around the origin.');
  await show('B');
  await settle('batch 5a');
  check('12 Bravo: saved after returning to its tab', !fs.readFileSync(models.B.file).equals(originalBytes.B));
  const aScaled = floats(await read('A', '/Geosets/0/Vertices'));
  check('13 Alpha: geoset 0 scaled 2x', aScaled.every((v, i) => Math.abs(v - beforeScale[i] * 2) < 1e-3), aScaled);
  await send('C', 'Set the "Stand" animation to be non-looping.');
  await send('A', 'Undo your last edit.');
  await show('B');
  await settle('batch 5b');
  check('14 Charlie: Stand is non-looping', !!(await read('C', '/Sequences/0')).NonLooping, await read('C', '/Sequences/0'));
  check('15 Alpha: the AI undid the scale on its own model', floats(await read('A', '/Geosets/0/Vertices')).join() === beforeScale.join());
  check('no page errors', errors.length === 0, errors);
  for (const key of ['A', 'C']) check(`${models[key].name} file on disk untouched until saved`, fs.readFileSync(models[key].file).equals(originalBytes[key]));
})()
  .catch(error => {
    checks.push({ name: 'run', passed: false, detail: String(error.stack || error) });
    console.log('FAIL run ' + String(error.stack || error));
    process.exitCode = 1;
  })
  .finally(async () => {
    if (page) await page.screenshot({ path: path.join(out, 'final.png') }).catch(() => {});
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ checks, prompts }, null, 2));
    console.log(JSON.stringify({ passed: checks.filter(c => c.passed).length, failed: checks.filter(c => !c.passed).length }));
    if (checks.some(c => !c.passed)) process.exitCode = 1;
    await Promise.race([app?.close(), wait(8000)]).catch(() => {});
    setTimeout(() => process.exit(), 500);
  });
