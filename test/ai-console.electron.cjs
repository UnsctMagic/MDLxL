// AI console in the packaged app: docked layout, Pen/Marker/Eraser with real
// mouse drags, camera controls while a tool is active, live thinking/steps and
// steering a running task. Run through scripts/hidden-run.ps1 on Windows.
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
  const requests = [];
  server = http.createServer(async (req, res) => {
    let body = '';
    for await (const part of req) body += part;
    if (req.url.endsWith('/models')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"data":[{"id":"fixture-model"}]}');
      return;
    }
    const data = JSON.parse(body);
    requests.push(data);
    const n = requests.length;
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    const stream = async (kind, text, pause) => {
      for (const word of text.split(/(?<= )/)) {
        sse(res, { choices: [{ delta: { [kind]: word } }] });
        await wait(pause);
      }
    };
    const callTool = (name, args) => {
      sse(res, {
        choices: [
          {
            delta: { tool_calls: [{ index: 0, id: 'call-' + n, function: { name, arguments: JSON.stringify(args) } }] },
            finish_reason: 'tool_calls',
          },
        ],
      });
      res.end();
    };
    if (n === 1) {
      await stream('reasoning_content', 'The user marked an area on the chest and drew an outline with the pen. ', 60);
      await stream('content', 'I will look at the marked area first. ', 40);
      return callTool('mdlxl_context', {});
    }
    if (n === 2) {
      // Slow thinking leaves time to steer while the AI works.
      await stream('reasoning_content', 'The marked vertices belong to one geoset. I should check which faces use them before separating anything. ', 180);
      return callTool('mdlxl_help', { query: 'geoset' });
    }
    const steered = JSON.stringify(data.messages).includes('Keep the shoulder pads');
    await stream('content', steered ? 'Understood, I will keep the shoulder pads in the original geoset. ' : 'No steering arrived. ', 30);
    sse(res, { choices: [{ delta: {}, finish_reason: 'stop' }] });
    res.end();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const executablePath =
    process.env.MDLXL_AI_TEST_EXE || path.resolve('out/pkg-ai/MDLxL-win32-x64/MDLxL.exe');
  app = await _electron.launch({
    executablePath,
    args: [model, '--disable-gpu-vsync', '--disable-frame-rate-limit'],
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
  check('console docks at the right edge, full workspace height', Math.abs(panel.x + panel.width - size.width) <= 1 && panel.height > size.height * 0.6, { panel, size });
  check('viewport makes room instead of being covered', viewOpen.x + viewOpen.width <= panel.x + 1 && viewOpen.width < viewBefore.width, { viewOpen, panel });
  await shot('02-open-empty');

  // Resize by its left edge.
  const handle = await page.locator('.ai-resize').boundingBox();
  await drag([handle.x + 3, handle.y + 200], [handle.x - 117, handle.y + 200], { steps: 8 });
  const wider = await page.locator('.ai-assistant').boundingBox();
  check('console resizes by dragging its left edge', wider.width - panel.width > 100, { before: panel.width, after: wider.width });

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
  for (let x = box.x + 40; x < box.x + box.width - 40; x += 60)
    await drag([x, box.y + 40], [x, box.y + box.height - 40], { steps: 10 });
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
  check('the model is never modified by drawings', !(await page.locator('.classic-status').innerText()).includes('Modified'));

  // Prompt with drawings, live thinking and steps, then steer mid-task.
  await page.getByLabel('AI prompt').fill('Cut the marked area into its own geoset');
  await page.getByLabel('AI prompt').press('Enter');
  await page.waitForSelector('.ai-thinking.ai-live', { timeout: 15000 });
  await shot('05-thinking');
  const context = JSON.parse(
    requests[0].messages
      .find(m => m.role === 'user')
      .content[0].text.split('MDLxL context captured when this prompt was sent:\n')[1],
  );
  const annotations = context.annotations;
  check('the AI receives both drawings', annotations?.strokes.length === 2, annotations && annotations.strokes.map(s => s.tool));
  const markerNote = annotations.strokes.find(s => s.tool === 'marker');
  check('the marker names the vertices it covers', Object.values(markerNote.markedVertices || {}).flat().length > 0, markerNote);
  check('the user message notes the attached drawings', (await page.locator('.ai-role-user .ai-message-note').first().innerText()).includes('2 drawings'));
  await page.waitForSelector('.ai-step', { timeout: 15000 });
  for (let i = 0; i < 60 && requests.length < 2; i++) await wait(100);
  await page.getByLabel('AI prompt').fill('Keep the shoulder pads');
  check('while busy the send button steers', (await page.locator('.ai-send').getAttribute('aria-label')) === 'Steer');
  await page.getByLabel('AI prompt').press('Enter');
  await page.waitForSelector('.ai-message-note:has-text("Sent while the AI was working")', { timeout: 5000 });
  await shot('06-steered');
  await page.waitForFunction(() => document.querySelector('.ai-messages')?.textContent.includes('keep the shoulder pads'), null, { timeout: 30000 });
  await page.waitForFunction(() => !document.querySelector('.ai-stop'), null, { timeout: 15000 });
  check('steering reaches the running task', JSON.stringify(requests.at(-1).messages).includes('steering for the current task:\\nKeep the shoulder pads'));
  check('every tool step settles once the AI finishes', (await page.locator('.ai-step').count()) >= 2 && (await page.locator('.ai-step-running').count()) === 0 && (await page.locator('.ai-step-done').count()) >= 1);
  const order = await page.evaluate(() =>
    [...document.querySelectorAll('.ai-thread > article')].map(a => (a.classList.contains('ai-role-user') ? 'user' : 'ai')),
  );
  check('the steering message sits where it was sent', JSON.stringify(order) === JSON.stringify(['user', 'ai', 'user', 'ai']), order);
  await page.locator('.ai-thinking .ai-part-toggle').first().click();
  await shot('07-done-thinking-open');

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
