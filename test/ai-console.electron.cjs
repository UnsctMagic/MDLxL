// AI console in the packaged app: docked layout, Pen/Marker/Eraser with real
// mouse drags, camera controls while a tool is active, live thinking/steps and
// steering a running task, and a bird working on its own model tab while you
// edit another one. Run through scripts/hidden-run.ps1 on Windows.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'D:/Claude/tools/node_modules/playwright-core');
const out = path.resolve(process.env.MDLXL_AI_TEST_OUT || 'out/ai-console');
const model = process.env.MDLXL_AI_CONSOLE_MODEL || path.resolve('out/pose/Footman.mdx');
const checks = [];
let app, server;
const check = (name, condition, detail) => {
  checks.push({ name, passed: !!condition, ...(detail ? { detail } : {}) });
  assert.ok(condition, name + (detail ? ' ' + JSON.stringify(detail) : ''));
};
const sse = (res, value) => res.write('data: ' + JSON.stringify(value) + '\n\n');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  if (!fs.existsSync(model)) {
    console.log('SKIP: no model fixture at ' + model);
    return;
  }
  // Work on a copy: the test saves the model.
  const workModel = path.join(out, 'Footman.mdx'),
    secondModel = path.join(out, 'Second.mdx');
  fs.copyFileSync(model, workModel);
  fs.copyFileSync(model, secondModel);
  // Offload Mode is on by default: the organiser hands the job to a worker (Crow).
  const organiserRequests = [],
    workerRequests = [];
  // The bird's background edit waits until the owner has edited the other tab.
  let ownerEdited = false;
  const secondRequests = [];
  server = http.createServer(async (req, res) => {
    let body = '';
    for await (const part of req) body += part;
    if (req.url.endsWith('/models')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"data":[{"id":"fixture-model"}]}');
      return;
    }
    const data = JSON.parse(body);
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    const stream = async (kind, text, pause) => {
      for (const word of text.split(/(?<= )/)) {
        sse(res, { choices: [{ delta: { [kind]: word } }] });
        await wait(pause);
      }
    };
    const stop = () => {
      sse(res, { choices: [{ delta: {}, finish_reason: 'stop' }] });
      res.end();
    };
    const callTool = (name, args) => {
      sse(res, {
        choices: [
          {
            delta: { tool_calls: [{ index: 0, id: 'call-' + Math.random(), function: { name, arguments: JSON.stringify(args) } }] },
            finish_reason: 'tool_calls',
          },
        ],
      });
      res.end();
    };
    if (String(data.messages[0]?.content).includes('You are the organiser')) {
      organiserRequests.push(data);
      if (!data.tools) {
        await stream('content', 'Memory: the chest area was separated; the user wants the shoulder pads kept. ', 10);
        return stop();
      }
      if (data.messages.at(-1).role === 'tool') {
        await stream('content', 'Crow separated the marked area and kept the shoulder pads. ', 20);
        return stop();
      }
      await stream('content', 'I will give this to a worker. ', 20);
      return callTool('mdlxl_worker', { job: 'Separate marked area', instructions: 'Cut the marked chest area into its own geoset.' });
    }
    // Second's own bird: a separate job on another model at the same time as Crow's.
    const sentFor = data.messages.find(m => m.role === 'user' && JSON.stringify(m.content).includes('MDLxL context captured'));
    if (/\\"name\\":\\"Second\.mdx\\"/.test(JSON.stringify(sentFor?.content))) {
      secondRequests.push(data);
      await stream('content', 'Second bird: the gem is now blue. ', 20);
      return stop();
    }
    workerRequests.push(data);
    const n = workerRequests.length;
    if (n === 1) {
      await stream('reasoning_content', 'The user marked an area on the chest and drew an outline with the pen. ', 60);
      await stream('content', 'I will look at the marked area first. ', 40);
      return callTool('mdlxl_context', {});
    }
    if (n === 2) {
      // Slow thinking leaves time to steer, and to switch to another model tab.
      await stream('reasoning_content', 'The marked vertices belong to one geoset. I should check which faces use them before separating anything at all. ', 180);
      return callTool('mdlxl_context', {});
    }
    // Background work on Footman while the owner is on Second: an edit, then the
    // review with its off-screen pictures, then a step that needs the screen.
    const target = JSON.stringify(data.messages).match(/\\"target\\":\\"([0-9a-f-]{36})/)?.[1];
    if (n === 3) {
      for (let i = 0; i < 300 && !ownerEdited; i++) await wait(100);
      return callTool('mdlxl_patch', {
        target,
        label: 'Move one vertex',
        scope: ['/Geosets/0/Vertices'],
        operations: [{ op: 'set', path: '/Geosets/0/Vertices/0', value: 123.5 }],
      });
    }
    if (n === 4)
      return callTool('mdlxl_review', {
        target,
        action: 'inspect',
        checksCode: 'return [{name:"Vertex moved",passed:model.Geosets[0].Vertices[0]===123.5}];',
      });
    if (n === 5) return callTool('mdlxl_review', { target, action: 'finish', outcome: 'passed', summary: 'The vertex moved; nothing else changed.' });
    if (n === 6) return callTool('mdlxl_ui', { target, action: 'inspect' });
    const steered = JSON.stringify(data.messages).includes('Keep the shoulder pads');
    await stream('content', steered ? 'Understood, I will keep the shoulder pads in the original geoset. ' : 'No steering arrived. ', 30);
    stop();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const executablePath =
    process.env.MDLXL_AI_TEST_EXE || path.resolve('out/pkg-ai/MDLxL-win32-x64/MDLxL.exe');
  app = await _electron.launch({
    executablePath,
    args: [workModel, '--disable-gpu-vsync', '--disable-frame-rate-limit'],
    env: {
      ...process.env,
      MDLXL_PROFILE: path.join(out, 'profile'),
      MDLXL_DISABLE_UPDATES: '1',
      TEMP: path.join(out, 'temp'),
      TMP: path.join(out, 'temp'),
    },
    timeout: 60000,
  });
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    win.webContents.setBackgroundThrottling(false);
    win.unmaximize();
    win.setContentSize(1440, 900);
  });
  await page.waitForSelector('.classic-toolbar', { timeout: 60000 });
  await page.waitForTimeout(1500);
  const canvas = page.locator('.classic-view canvas').first();
  const shot = name => page.screenshot({ path: path.join(out, name + '.png') });
  const viewShot = () => canvas.screenshot();
  const drawings = () =>
    page.evaluate(() => {
      const chip = [...document.querySelectorAll('.ai-chip')].find(c => /drawing/.test(c.textContent));
      return chip ? parseInt(chip.textContent, 10) : 0;
    });
  const drag = async (from, to, { steps = 24, button = 'left', curve = 0 } = {}) => {
    await page.mouse.move(from[0], from[1]);
    await page.mouse.down({ button });
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      await page.mouse.move(
        from[0] + (to[0] - from[0]) * t,
        from[1] + (to[1] - from[1]) * t + Math.sin(t * Math.PI) * curve,
      );
    }
    await page.mouse.up({ button });
    await page.waitForTimeout(120);
  };
  await shot('01-closed');
  check('AI console is closed by default', (await page.locator('.ai-assistant').count()) === 0);
  const viewBefore = await canvas.boundingBox();

  await page.getByRole('button', { name: 'AI assistant', exact: true }).click();
  await page.waitForSelector('.ai-assistant');
  await page.waitForTimeout(300);
  const panel = await page.locator('.ai-assistant').boundingBox(),
    viewOpen = await canvas.boundingBox(),
    size = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  check('console docks at the left edge, full workspace height', panel.x <= 1 && panel.height > size.height * 0.6, { panel, size });
  check('viewport makes room instead of being covered', viewOpen.x >= panel.x + panel.width - 1 && viewOpen.width < viewBefore.width, { viewOpen, panel });
  await shot('02-open-empty');

  // Resize by its left edge.
  const handle = await page.locator('.ai-resize').boundingBox();
  await drag([handle.x + 3, handle.y + 200], [handle.x + 123, handle.y + 200], { steps: 8 });
  const wider = await page.locator('.ai-assistant').boundingBox();
  check('console resizes by dragging its right edge', wider.width - panel.width > 100, { before: panel.width, after: wider.width });

  // Provider connection.
  if (!(await page.getByLabel('AI provider', { exact: true }).isVisible()))
    await page.getByRole('button', { name: 'Connection settings', exact: true }).click();
  await page.getByLabel('AI provider', { exact: true }).selectOption('compatible');
  await page.getByLabel('API key', { exact: true }).fill('fixture-test-secret');
  await page.getByLabel('API base URL', { exact: true }).fill(`http://127.0.0.1:${server.address().port}/v1`);
  await page.getByLabel('Model', { exact: true }).fill('fixture-model');
  await page.getByRole('button', { name: 'Save connection', exact: true }).click();
  await page.getByRole('button', { name: 'Connection settings', exact: true }).click();
  await page.getByRole('button', { name: 'Dismiss', exact: true }).click().catch(() => {});

  // Pen: a real drag across the model.
  const box = await canvas.boundingBox(),
    cx = box.x + box.width / 2,
    cy = box.y + box.height / 2;
  const tool = name => page.getByRole('button', { name, exact: true });
  await tool('Pen').click();
  check('Pen is a toggle in the composer', (await tool('Pen').getAttribute('aria-pressed')) === 'true');
  const blank = await viewShot();
  await drag([cx - 60, cy - 20], [cx + 60, cy - 10], { curve: -40 });
  check('a pen drag adds one drawing', (await drawings()) === 1);
  await page.waitForTimeout(600);
  await shot('03a-pen');
  check('the pen stroke is drawn in the viewport', !(await viewShot()).equals(blank));
  await tool('Marker').click();
  check('choosing Marker switches tools', (await tool('Marker').getAttribute('aria-pressed')) === 'true' && (await tool('Pen').getAttribute('aria-pressed')) === 'false');
  await drag([cx - 30, cy + 30], [cx + 30, cy + 40], { curve: 10 });
  check('a marker drag adds a drawing', (await drawings()) === 2);
  await shot('03-drawings');

  // Camera controls keep working while a tool is active.
  const beforeRotate = await viewShot();
  await page.keyboard.down('Alt');
  await drag([cx - 120, cy + 80], [cx + 40, cy + 70], { steps: 12 });
  await page.keyboard.up('Alt');
  await page.waitForTimeout(150);
  check('Alt+drag rotates the camera with Marker active and draws nothing', (await drawings()) === 2 && !(await viewShot()).equals(beforeRotate));
  const beforePan = await viewShot();
  await drag([cx + 100, cy + 100], [cx + 160, cy + 140], { steps: 8, button: 'right' });
  check('right-drag keeps its camera action and draws nothing', (await drawings()) === 2 && !(await viewShot()).equals(beforePan));
  await shot('04-rotated');

  // Eraser: drag over the pen line.
  await tool('Eraser').click();
  const strokes = await page.evaluate(() => document.querySelector('.ai-chip')?.textContent);
  const beforeErase = await drawings();
  // Sweep a vertical eraser pass across the whole view: it crosses every stroke.
  // Passes start below the floating view controls, which take the top 50 px.
  for (let x = box.x + 40; x < box.x + box.width - 40; x += 60)
    await drag([x, box.y + 60], [x, box.y + box.height - 40], { steps: 10 });
  check('eraser drags remove drawings', (await drawings()) < beforeErase, { strokes });
  // Draw fresh notes for the prompt.
  await page.getByRole('button', { name: 'Clear drawings', exact: true }).click().catch(() => {});
  check('Clear removes all drawings on this model', (await drawings()) === 0);
  await tool('Marker').click();
  await drag([cx - 25, cy], [cx + 25, cy + 5], { curve: 6 });
  await tool('Pen').click();
  await drag([cx - 50, cy - 50], [cx + 50, cy - 45], { curve: -30 });
  check('two fresh drawings for the prompt', (await drawings()) === 2);

  // Escape leaves the tool first.
  await canvas.focus().catch(() => {});
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  check('Escape turns the drawing tool off', (await tool('Pen').getAttribute('aria-pressed')) === 'false');

  // One tool owns the left mouse button, and the viewport says so.
  const tag = page.locator('.ai-drawing-tag'),
    editorTool = name => page.locator('.classic-tools').getByRole('button', { name, exact: true });
  await tool('Marker').click();
  check(
    'while drawing, the viewport bar says so and no editor tool is lit',
    (await tag.innerText()).includes('Marker: drawing for the AI') && (await editorTool('Select').getAttribute('aria-pressed')) === 'false',
  );
  await editorTool('Move').click();
  check(
    'picking an editor tool puts the drawing tool away',
    (await tool('Marker').getAttribute('aria-pressed')) === 'false' && (await tag.count()) === 0 && (await editorTool('Move').getAttribute('aria-pressed')) === 'true',
  );
  await tool('Pen').click();
  await page.getByRole('button', { name: 'Camera rotation', exact: true }).click();
  check('switching the camera mode puts the drawing tool away', (await tool('Pen').getAttribute('aria-pressed')) === 'false');
  await page.getByRole('button', { name: 'Work mode', exact: true }).click();
  await tool('Marker').click();
  await tag.click();
  check('clicking the viewport tag stops drawing', (await tool('Marker').getAttribute('aria-pressed')) === 'false' && (await tag.count()) === 0);
  await editorTool('Select').click();

  // Ctrl+Z / Ctrl+Y take drawings back and forth like any other step.
  const drawn = await drawings();
  await tool('Pen').click();
  await drag([cx - 40, cy + 60], [cx + 40, cy + 65], { curve: 8 });
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(200);
  check('Ctrl+Z undoes the last drawing', (await drawings()) === drawn);
  await page.keyboard.press('Control+y');
  await page.waitForTimeout(200);
  check('Ctrl+Y redoes it', (await drawings()) === drawn + 1);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(200);
  check('the model is never modified by drawings', !(await page.locator('.classic-status').innerText()).includes('Modified'));

  // Prompt with drawings: the organiser hands it to Crow; watch and steer Crow.
  await page.getByLabel('AI prompt').fill('Cut the marked area into its own geoset');
  await page.getByLabel('AI prompt').press('Enter');
  await page.waitForSelector('.ai-worker-row', { timeout: 15000 });
  await shot('05-organiser');
  const context = JSON.parse(
    organiserRequests[0].messages
      .find(m => m.role === 'user')
      .content[0].text.split('MDLxL context captured when this prompt was sent:\n')[1],
  );
  const annotations = context.annotations;
  check('the AI receives both drawings', annotations?.strokes.length === 2, annotations && annotations.strokes.map(s => s.tool));
  const markerNote = annotations.strokes.find(s => s.tool === 'marker');
  check('the marker names the vertices it covers', Object.values(markerNote.markedVertices || {}).flat().length > 0, markerNote);
  check('the user message notes the attached drawings', (await page.locator('.ai-role-user .ai-message-note').first().innerText()).includes('2 drawings'));
  check('the organiser only gets the worker and help tools', JSON.stringify(organiserRequests[0].tools.map(t => t.function.name)) === '["mdlxl_worker","mdlxl_help"]');
  // Names are random; the first bird of a chat is always a corvid.
  const bird = await page.locator('.ai-worker-row b').first().innerText();
  check('the first bird is a random corvid', ['Crow', 'Raven', 'Jackdaw', 'Rook', 'Magpie', 'Jay'].includes(bird), bird);
  const crowChip = page.locator('button.ai-roster-chip', { hasText: bird });
  await crowChip.waitFor({ timeout: 10000 });
  for (let i = 0; i < 100 && !workerRequests.length; i++) await wait(100);
  check("Crow gets the user's words exactly as written", JSON.stringify(workerRequests[0].messages).includes("The user's message, exactly as written:\\nCut the marked area into its own geoset"));
  check('the model picker and Offload switch sit in the console header', (await page.locator('.ai-heading select[aria-label="Chat model"]').count()) === 1 && (await page.locator('.ai-heading [role="switch"][aria-label="Offload Mode"]').getAttribute('aria-checked')) === 'true');
  const modelPicker = page.locator('.ai-heading select[aria-label="Chat model"]');
  check('the model dropdown stays readable and usable while the AI works', (await modelPicker.boundingBox()).width >= 80 && !(await modelPicker.isDisabled()), await modelPicker.boundingBox());
  // SD Brain is parked: no switch and nothing about it in what the AI receives.
  check('the parked SD Brain has no header switch', (await page.locator('.ai-heading [role="switch"][aria-label="SD Brain"]').count()) === 0);
  check('the first task carries no SD Brain text', !/SD Brain|Warcraft III SD modeling rulebook/.test(organiserRequests[0].messages[0].content));
  check('each bird has its own colour', /hsl\(/.test((await crowChip.getAttribute('style')) || ''));
  await crowChip.click();
  await page.waitForSelector('.ai-from-organiser', { timeout: 5000 });
  await page.waitForSelector('.ai-step', { timeout: 15000 });
  for (let i = 0; i < 100 && workerRequests.length < 2; i++) await wait(100);
  await page.waitForSelector('.ai-thinking.ai-live', { timeout: 10000 });
  await shot('05b-crow-thinking');
  await page.getByLabel('AI prompt').fill('Keep the shoulder pads');
  check('while busy the send button steers', (await page.locator('.ai-send').getAttribute('aria-label')) === 'Steer');
  await page.getByLabel('AI prompt').press('Enter');
  await page.waitForSelector('.ai-message-note:has-text("Sent while the AI was working")', { timeout: 5000 });
  await shot('06-steered');

  // Background work: switch to another model tab and edit it while Crow keeps working on Footman.
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
  }, secondModel);
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.model-tab.active [role="tab"]')?.textContent.includes('Second.mdx'), null, { timeout: 20000 });
  const dirty = name => page.locator('.model-tab', { hasText: name }).locator('.model-tab-dirty').innerText();
  await page.waitForTimeout(800);
  // The owner's own edit on Second: select every vertex and uncouple them.
  await canvas.click({ position: { x: 40, y: 300 } });
  await page.keyboard.press('Control+a');
  await page.keyboard.press('u');
  await page.waitForTimeout(300);
  check('the owner edits Second while Crow works', (await dirty('Second.mdx')) === '●' && (await page.locator('.ai-paused').count()) === 0);
  // A second AI job at the same time: Second's own chat is free while Crow works on Footman.
  check("Second's chat can send while Crow works on Footman", (await page.locator('.ai-send').getAttribute('aria-label')) === 'Send');
  await page.getByLabel('AI prompt').fill('Make the gem blue');
  await page.getByLabel('AI prompt').press('Enter');
  for (let i = 0; i < 200 && !secondRequests.length; i++) await wait(100);
  await page
    .waitForFunction(() => document.querySelector('.ai-messages')?.textContent.includes('Crow separated') || document.querySelector('.ai-worker-row.ai-worker-done'), null, { timeout: 20000 })
    .catch(async error => {
      await shot('06a-second-failed');
      console.log('SECOND', secondRequests.length, organiserRequests.length, (await page.locator('.ai-assistant').innerText()).slice(-600));
      throw error;
    });
  check("Second's bird finishes its job while Crow is still working on Footman", secondRequests.length >= 1 && workerRequests.length <= 3, { second: secondRequests.length, crow: workerRequests.length });
  await shot('06a-two-jobs');
  await page.waitForTimeout(600);
  const ownerView = await viewShot();
  ownerEdited = true;
  for (let i = 0; i < 300 && workerRequests.length < 6; i++) await wait(100);
  const patched = JSON.stringify(workerRequests[3]?.messages || []);
  check('Crow edits Footman while you are on another tab', patched.includes('\\"applied\\":true') && (await dirty('Footman.mdx')) === '●', patched.slice(-400));
  check('steering reaches the running bird', JSON.stringify(workerRequests[2].messages).includes('steering for the current task:\\nKeep the shoulder pads'));
  const reviewed = JSON.stringify(workerRequests[4]?.messages || []);
  check('the review gets before and after pictures drawn off-screen', reviewed.includes('After the edit') && reviewed.includes('Before the task') && reviewed.includes('data:image/png;base64'), reviewed.length);
  check('the review passes on the background model', JSON.stringify(workerRequests[5]?.messages || []).includes('\\"phase\\":\\"verified\\"'));
  // A step that needs MDLxL's own controls on screen pauses until you return.
  await page.waitForSelector('.ai-paused', { timeout: 15000 });
  check('a step that needs the screen waits for its model tab', (await page.locator('.ai-paused').innerText()).includes('Footman.mdx'));
  check("Crow's pictures never moved your view", (await viewShot()).equals(ownerView));
  check('the tab on screen stays Second', await page.evaluate(() => document.querySelector('.model-tab.active [role="tab"]')?.textContent.includes('Second.mdx')));
  const pausedAt = workerRequests.length;
  await wait(2500);
  check('nothing more happens on the paused model while you are away', workerRequests.length === pausedAt && pausedAt === 6, { pausedAt, now: workerRequests.length });
  await shot('06b-paused');
  // Each tab keeps its own Undo: Ctrl+Z on Second undoes the owner's edit only.
  // Selection changes are Undo steps too, so step back until Second is unchanged.
  // Ctrl+Z belongs to the editor, not the prompt box that was just used.
  await page.locator('.classic-status').click();
  let steps = 0;
  while (steps < 4 && (await dirty('Second.mdx')) === '●') {
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);
    steps++;
  }
  const undone = (await dirty('Second.mdx')) === '' && (await dirty('Footman.mdx')) === '●';
  for (let i = 0; i < steps; i++) {
    await page.keyboard.press('Control+y');
    await page.waitForTimeout(300);
  }
  check("Undo on Second undoes only the owner's edit; Footman keeps Crow's", undone && (await dirty('Second.mdx')) === '●');
  await page.locator('.model-tab [role="tab"]', { hasText: 'Footman.mdx' }).click();
  for (let i = 0; i < 150 && workerRequests.length < 7; i++) await wait(100);
  check('returning to the tab resumes the bird', workerRequests.length === 7);
  await page.waitForFunction(() => !document.querySelector('.ai-stop'), null, { timeout: 30000 });
  check('the pause banner clears', (await page.locator('.ai-paused').count()) === 0);
  await page.waitForFunction(() => document.querySelector('.ai-messages')?.textContent.includes('kept the shoulder pads'), null, { timeout: 10000 });
  check('the organiser reports when Crow is done', (await page.locator('.ai-worker-row.ai-worker-done').count()) === 1);
  await crowChip.click();
  await page.waitForFunction(() => document.querySelector('.ai-messages')?.textContent.includes('keep the shoulder pads in the original geoset'), null, { timeout: 10000 });
  check('every tool step settles once the AI finishes', (await page.locator('.ai-step').count()) >= 6 && (await page.locator('.ai-step-running').count()) === 0 && (await page.locator('.ai-step-done').count()) >= 1);
  const order = await page.evaluate(() =>
    [...document.querySelectorAll('.ai-thread > article')].map(a => (a.classList.contains('ai-role-user') ? 'user' : 'ai')),
  );
  check('the steering message sits where it was sent', JSON.stringify(order) === JSON.stringify(['user', 'ai', 'user', 'ai']), order);
  await page.locator('.ai-thinking .ai-part-toggle').first().click();
  await shot('07-done-thinking-open');
  await page.locator('button.ai-roster-chip', { hasText: 'Organiser' }).click();
  await page.waitForSelector('.ai-worker-row');
  await shot('07a-organiser-done');

  // Compaction: a running provider summarizes the long chat; the console shows it plainly.
  const sendEvent = value =>
    app.evaluate(({ BrowserWindow }, event) => BrowserWindow.getAllWindows()[0].webContents.send('ai:event', event), value);
  await sendEvent({ type: 'compaction', active: true });
  await page.waitForSelector('.ai-compaction.ai-live', { timeout: 5000 });
  check('compaction shows a sad-face compacting row', (await page.locator('.ai-compaction.ai-live').innerText()).includes('Compacting context') && (await page.locator('.ai-compaction svg.lucide-frown').count()) === 1);
  await sendEvent({ type: 'compaction', active: true });
  check('a repeated start does not add a second row', (await page.locator('.ai-compaction').count()) === 1);
  await shot('07b-compacting');
  await sendEvent({ type: 'compaction', active: false });
  await page.waitForSelector('.ai-compaction:not(.ai-live)', { timeout: 5000 });
  check('finished compaction stays as a quiet note', (await page.locator('.ai-compaction').innerText()).includes('Context compacted'));
  await shot('07c-compacted');
  // Saving offers to tidy the model's AI chats; Keep a summary leaves a memory note.
  await canvas.click({ position: { x: 30, y: 300 } }).catch(() => {});
  await page.keyboard.press('Control+s');
  await page.waitForSelector('.ai-cleanup', { timeout: 20000 });
  check('saving after AI work asks how to tidy the chats', (await page.locator('.ai-cleanup-choices button').count()) === 3);
  await shot('07d-save-cleanup');
  const before = organiserRequests.length;
  await page.locator('.ai-cleanup-choices button', { hasText: 'Keep a summary' }).click();
  await page.waitForFunction(() => !document.querySelector('.ai-cleanup') && !document.querySelector('.ai-roster'), null, { timeout: 20000 });
  check('Keep a summary asks the organiser for a memory note without tools', organiserRequests.length === before + 1 && !organiserRequests.at(-1).tools);
  await page.waitForSelector('.ai-empty', { timeout: 10000 }).catch(() => {});
  await shot('07e-after-cleanup');
  check('the chats are cleared and a fresh organiser starts', (await page.locator('.ai-empty').count()) === 1);
  await shot('07e-after-cleanup');
  // Closing hides the drawings without losing them.
  const withDrawings = await viewShot();
  await page.getByRole('button', { name: 'Close AI assistant', exact: true }).click();
  await page.waitForTimeout(400);
  const closedView = await canvas.boundingBox();
  check('closing gives the viewport its space back', Math.abs(closedView.width - viewBefore.width) <= 1, { closedView, viewBefore });
  await page.getByRole('button', { name: 'AI assistant', exact: true }).click();
  await page.waitForTimeout(400);
  check('drawings come back when the console reopens', (await drawings()) === 2);
  check('reopened view shows the drawings again', (await viewShot()).equals(withDrawings));
  await shot('08-reopened');
  // Both models save: Crow's background edit on Footman and the owner's edit on Second.
  check("saving Footman writes Crow's edit", !fs.readFileSync(workModel).equals(fs.readFileSync(model)));
  await page.locator('.model-tab [role="tab"]', { hasText: 'Second.mdx' }).click();
  await page.waitForTimeout(500);
  await canvas.click({ position: { x: 40, y: 300 } });
  await page.keyboard.press('Control+s');
  await page.waitForFunction(() => !document.querySelector('.model-tab.active .model-tab-dirty')?.textContent, null, { timeout: 20000 });
  check("saving Second writes the owner's edit", !fs.readFileSync(secondModel).equals(fs.readFileSync(model)));
  check('no page errors', errors.length === 0, errors);
})()
  .catch(error => {
    checks.push({ name: 'run', passed: false, detail: String(error.stack || error) });
    process.exitCode = 1;
  })
  .finally(async () => {
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(checks, null, 2));
    for (const c of checks) console.log((c.passed ? 'PASS ' : 'FAIL ') + c.name + (c.passed ? '' : ' ' + JSON.stringify(c.detail || '')));
    await Promise.race([app?.close(), wait(5000)]).catch(() => {});
    server?.close();
    setTimeout(() => process.exit(), 500);
  });
