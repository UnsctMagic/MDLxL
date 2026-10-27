// Background packaged acceptance: optional live context, failed verification,
// correction, and resuming a durable task after an actual application restart.
const fs = require('node:fs'),
  path = require('node:path'),
  http = require('node:http'),
  assert = require('node:assert/strict'),
  crypto = require('node:crypto');
const { _electron } = require(
  process.env.MDLXL_PLAYWRIGHT_MODULE ||
    'C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright',
);
const out = path.resolve(process.env.MDLXL_AI_TEST_OUT || 'out/ai-awareness'),
  profile = path.join(out, 'profile');
const checks = [],
  calls = [],
  errors = [];
let app,
  page,
  server,
  link,
  mode = 'interrupt',
  requests = 0,
  firstEdits = 0,
  corrections = 0,
  failedFinish = false;
const check = (name, value) => {
  checks.push({ name, passed: !!value });
  assert.ok(value, name);
};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function rpc(method, params = {}) {
  const response = await fetch(link.url, {
    method: 'POST',
    headers: { ...link.headers, 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: crypto.randomUUID(), method, params }),
  });
  const reply = await response.json();
  if (reply.error) throw Error(reply.error.message);
  return reply.result;
}
async function tool(name, args = {}) {
  const result = await rpc('tools/call', { name, arguments: args });
  if (result.isError) throw Error(result.content[0].text);
  return result.content[0].type === 'text'
    ? JSON.parse(result.content[0].text.split('\nMDLxL continuous awareness')[0])
    : result.content[0];
}
const resource = async () =>
  JSON.parse((await rpc('resources/read', { uri: 'mdlxl://editor/context' })).contents[0].text);
async function waitFor(check, timeout = 10000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await check()) return;
    await sleep(80);
  }
  throw Error('Timed out waiting for editor state.');
}
async function launch(fixture) {
  app = await _electron.launch({
    executablePath: process.env.MDLXL_AI_TEST_EXE,
    args: [fixture],
    env: {
      ...process.env,
      MDLXL_PROFILE: profile,
      MDLXL_DISABLE_UPDATES: '1',
      TEMP: path.join(out, 'temp'),
      TMP: path.join(out, 'temp'),
    },
    timeout: 60000,
  });
  page = await app.firstWindow();
  page.on('pageerror', error => errors.push(error.message));
  await page.waitForSelector('.classic-toolbar', { timeout: 60000 });
  await page.waitForTimeout(350);
  const config = await page.evaluate(async () => {
    await window.desktop.aiEnable(true);
    return window.desktop.aiConfig();
  });
  link = config.mcpServers.mdlxl;
}
async function close() {
  if (app) {
    await app.evaluate(({ BrowserWindow }) => {
      for (const win of BrowserWindow.getAllWindows()) win.destroy();
    });
    await app.close();
    app = null;
  }
}
(async () => {
  fs.mkdirSync(out, { recursive: true });
  fs.mkdirSync(path.join(out, 'temp'), { recursive: true });
  const { createStarterDocument } = await import('../src/starter-model.js');
  const doc = createStarterDocument();
  doc.apply('Verification fixture', ['Sequences', 'Bones'], model => {
    model.Sequences = [
      { Name: 'Stand', Interval: new Uint32Array([0, 1000]), MoveSpeed: 0, NonLooping: false, Rarity: 0 },
    ];
    model.Bones[0].Translation = {
      LineType: 1,
      GlobalSeqId: null,
      Keys: [0, 1000].map(Frame => ({ Frame, Vector: new Float32Array([0, 0, 0]) })),
    };
  });
  const original = Array.from(doc.model.Geosets[0].Vertices),
    fixture = path.join(out, 'Awareness-fixture.mdx');
  fs.writeFileSync(fixture, doc.serialize('mdx'));
  const checkCode =
    'const a=model.Geosets[0].Vertices,b=before.Geosets[0].Vertices;return [{name:"Both marked vertices raised by five",passed:a[2]===b[2]+5&&a[5]===b[5]+5,actual:[a[2],a[5]],expected:[b[2]+5,b[5]+5]},{name:"Unmarked coordinates preserved",passed:Array.from(a).every((v,i)=>i===2||i===5||v===b[i])}];';
  server = http.createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const data = JSON.parse(raw);
    // The outside check of a finished edit is a separate call, outside the counts.
    if (String(data.messages[0]?.content).includes('independent reviewer')) {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.end('data: ' + JSON.stringify({ choices: [{ delta: { content: '{"verdict":"good","confidence":0.9,"problems":[],"strengths":["both vertices raised"]}' }, finish_reason: 'stop' }] }) + '\n\n');
      return;
    }
    requests++;
    const user = [...data.messages]
      .reverse()
      .find(
        m =>
          m.role === 'user' &&
          Array.isArray(m.content) &&
          m.content[0]?.text?.includes('MDLxL context captured'),
      );
    const context = JSON.parse(
      user.content[0].text.split('MDLxL context captured when this prompt was sent:\n')[1],
    );
    const messages = data.messages.slice(data.messages.lastIndexOf(user) + 1),
      previous = messages
        .filter(m => m.tool_calls)
        .at(-1)
        ?.tool_calls.at(-1)?.function;
    const lastResult = messages.filter(m => m.role === 'tool').at(-1)?.content || '';
    if (mode === 'interrupt' && previous && previous.name !== 'mdlxl_plan') {
      res.writeHead(503, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'Fixture interruption after the first applied edit.' } }));
      return;
    }
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    const send = choice => {
      res.end('data: ' + JSON.stringify({ choices: [choice] }) + '\n\n');
    };
    const call = (name, args) => {
      calls.push({ name, action: args.action });
      send({
        delta: {
          tool_calls: [
            {
              index: 0,
              id: 'call-' + requests,
              function: { name, arguments: JSON.stringify({ target: context.target, ...args }) },
            },
          ],
        },
        finish_reason: 'tool_calls',
      });
    };
    // Look first: the plan comes before the first edit.
    if (mode === 'interrupt' && !previous)
      return call('mdlxl_plan', {
        cause: 'The two marked top-edge vertices are five units too low.',
        reach: 'Only those two vertices of geoset 0.',
        keep: ['every unmarked coordinate'],
        options: [
          { fix: 'Raise the two vertices by five', cost: 'Changes two Z values' },
          { fix: 'Move the whole geoset', cost: 'Moves unmarked vertices too' },
        ],
        choice: 0,
        why: 'Only the marked vertices change.',
      });
    if (mode === 'interrupt') {
      firstEdits++;
      return call('mdlxl_patch', {
        label: 'Raise first marked vertex',
        scope: ['/Geosets/0/Vertices'],
        operations: [{ op: 'set', path: '/Geosets/0/Vertices/2', value: original[2] + 5 }],
      });
    }
    if (!previous || previous.name === 'mdlxl_patch')
      return call('mdlxl_review', { action: 'inspect', checksCode: checkCode });
    const previousArgs = JSON.parse(previous.arguments);
    if (previousArgs.action === 'inspect')
      return call('mdlxl_review', {
        action: 'finish',
        outcome: 'passed',
        summary: 'The selected top edge has the requested height.',
      });
    if (lastResult.includes('Inspect and pass')) {
      failedFinish = true;
      corrections++;
      return call('mdlxl_patch', {
        label: 'Correct the second marked vertex',
        scope: ['/Geosets/0/Vertices'],
        operations: [{ op: 'set', path: '/Geosets/0/Vertices/5', value: original[5] + 5 }],
      });
    }
    send({
      delta: {
        content: 'Both marked vertices are raised by five. Checked the measurements and the viewport.',
      },
      finish_reason: 'stop',
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  await launch(fixture);
  // Awareness, interruption and resume are about direct editing by one chat;
  // Offload Mode (organiser and workers) has its own test in ai-console.electron.cjs.
  await page.evaluate(() => window.desktop.aiOffload(false));
  await page.evaluate(
    baseUrl => window.desktop.aiConfigure({ provider: 'compatible', baseUrl, model: 'workflow-fixture' }),
    `http://127.0.0.1:${server.address().port}/v1`,
  );
  await page.reload();
  await page.waitForSelector('.classic-toolbar');
  await page.waitForTimeout(350);
  await page.getByRole('button', { name: 'AI assistant', exact: true }).click();
  const toggle = page.getByRole('switch', { name: 'Continuous awareness', exact: true });
  check('continuous awareness is off by default', !(await toggle.isChecked()) && !(await resource()).enabled);
  await toggle.check();
  await waitFor(async () => (await resource()).context?.name === 'Awareness-fixture.mdx');
  let context = await tool('mdlxl_context');
  await tool('mdlxl_select', {
    target: context.target,
    vertices: { 0: [0, 1] },
    geosetIds: [0],
    activeGeoset: 0,
  });
  await waitFor(async () => JSON.stringify((await resource()).context.selection) === '{"0":[0,1]}');
  check('live resource follows exact editor selection', true);
  context = await tool('mdlxl_context');
  await tool('mdlxl_view', { target: context.target, sequence: 0, frame: 250, playing: false });
  await waitFor(async () => (await resource()).context.frame === 250);
  check('live resource follows the animation frame', true);
  const canvas = page.locator('.classic-view canvas').first(),
    box = await canvas.boundingBox(),
    prior = (await resource()).context.camera;
  await page.keyboard.down('Alt');
  await page.mouse.move(box.x + 200, box.y + 200);
  await page.mouse.down();
  await page.mouse.move(box.x + 280, box.y + 235, { steps: 8 });
  await page.mouse.up();
  await page.keyboard.up('Alt');
  await waitFor(async () => JSON.stringify((await resource()).context.camera) !== JSON.stringify(prior));
  check('normal mouse rotation updates AI camera awareness', true);
  const idleVersion = (await resource()).version;
  await sleep(1000);
  check(
    'idle awareness does not poll or start paid requests',
    (await resource()).version === idleVersion && requests === 0,
  );
  await toggle.uncheck();
  const disabled = await resource();
  context = await tool('mdlxl_context');
  await tool('mdlxl_select', { target: context.target, vertices: { 0: [3] } });
  await sleep(700);
  const off = await resource();
  check(
    'off stops future updates and clears the live snapshot',
    off.version === disabled.version && off.context === null,
  );
  await toggle.check();
  await close();
  await launch(fixture);
  await page.getByRole('button', { name: 'AI assistant', exact: true }).click();
  check(
    'awareness preference survives a real application restart',
    await page.getByRole('switch', { name: 'Continuous awareness' }).isChecked(),
  );
  // Keep the provider verification deterministic; live delivery was checked above.
  await page.getByRole('switch', { name: 'Continuous awareness' }).uncheck();
  context = await tool('mdlxl_context');
  await tool('mdlxl_select', {
    target: context.target,
    vertices: { 0: [0, 1] },
    geosetIds: [0],
    activeGeoset: 0,
  });
  await page
    .getByLabel('AI prompt')
    .fill('Raise both marked vertices by five in Z; preserve every other coordinate.');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await page.getByRole('button', { name: 'Resume task', exact: true }).waitFor({ timeout: 45000 });
  check(
    'interrupted applied edit offers Resume instead of success',
    await page
      .locator('.ai-error')
      .textContent()
      .then(t => t.includes('Fixture interruption')),
  );
  const partial = (await tool('mdlxl_read', { path: '/Geosets/0/Vertices' })).value.$data;
  check(
    'first edit was applied exactly once before interruption',
    partial[2] === original[2] + 5 && partial[5] === original[5],
  );
  context = await tool('mdlxl_context');
  await tool('mdlxl_command', { target: context.target, id: 'save' });
  await close();
  mode = 'resume';
  await launch(fixture);
  await page.getByRole('button', { name: 'AI assistant', exact: true }).click();
  await page.getByRole('button', { name: 'Resume task', exact: true }).waitFor();
  check('task checkpoint survives a real application restart', true);
  await page.getByRole('button', { name: 'Resume task', exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector('.ai-awareness')?.textContent.includes('Result verified'),
    null,
    { timeout: 60000 },
  );
  const result = (await tool('mdlxl_read', { path: '/Geosets/0/Vertices' })).value.$data;
  check('failed numerical check prevents an early finish', failedFinish);
  check(
    'AI corrects only the unfinished edit',
    firstEdits === 1 && corrections === 1 && result[2] === original[2] + 5 && result[5] === original[5] + 5,
  );
  check(
    'correction preserves all unselected coordinates',
    result.every((v, i) => i === 2 || i === 5 || v === original[i]),
  );
  context = await tool('mdlxl_context');
  check('Resume restores the exact marked selection', JSON.stringify(context.selection) === '{"0":[0,1]}');
  check(
    'completed task no longer offers Resume',
    (await page.getByRole('button', { name: 'Resume task', exact: true }).count()) === 0,
  );
  // Each model has its own chat (its organiser); find this model's.
  const chatId = (
      await page.evaluate(
        modelKey => window.desktop.aiOrganiser({ modelKey }),
        'file:' + fixture.replaceAll('/', '\\').toLowerCase(),
      )
    ).id,
    task = await page.evaluate(id => window.desktop.aiTask(id), chatId);
  check(
    'completion is recorded only after the successful image review',
    task.status === 'complete' && task.phase === 'verified',
  );
  await page.screenshot({ path: path.join(out, 'awareness-light.png') });
  await page.evaluate(() => (document.documentElement.dataset.theme = 'dark'));
  await page.screenshot({ path: path.join(out, 'awareness-dark.png') });
  check('no renderer errors', errors.length === 0);
  fs.writeFileSync(
    path.join(out, 'verification.json'),
    JSON.stringify({ checks, calls, requests, errors }, null, 2),
  );
  console.log(JSON.stringify({ passed: checks.length }));
})()
  .catch(error => {
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(
      path.join(out, 'verification.json'),
      JSON.stringify({ checks, calls, requests, errors, error: error.stack }, null, 2),
    );
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await close().catch(error => console.error(error));
    if (server)
      await new Promise(resolve => {
        server.closeAllConnections();
        server.close(resolve);
      });
    for (const name of ['profile', 'temp', 'Awareness-fixture.mdx'])
      fs.rmSync(path.join(out, name), { recursive: true, force: true });
  });
