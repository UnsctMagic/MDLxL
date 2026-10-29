// Automatic bird routing in the real package, driven only on scripts/hidden-run.ps1.
// Local provider and generated model: no real account, profile or user assets.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const { launchApp, closeApp, settle } = require('./helpers/app.cjs');
const out = path.resolve(process.env.MDLXL_AI_TEST_OUT || 'out/ai-routing');
const checks = [], requests = [];
let errors = [];
let app, page, server, profile, birdName, answered = 0, corrections = 0;
let cooperativeMain = 0, cooperativeHelper = 0, cooperativeResume = 0, mainRead;
const inspected = new Promise(resolve => { mainRead = resolve; });
const tool = (name, args) => ({ delta: { tool_calls: [{ index: 0, id: 'call-' + Math.random(), function: { name, arguments: JSON.stringify(args) } }] }, finish_reason: 'tool_calls' });
const check = (name, value) => { checks.push({ name, passed: !!value }); assert.ok(value, name); };
(async () => {
  fs.mkdirSync(path.join(out, 'temp'), { recursive: true });
  const { createStarterDocument } = await import('../src/starter-model.js');
  const doc = createStarterDocument();
  doc.apply('Separate fixture parts', ['Geosets'], model => {
    const original = model.Geosets[0];
    for (let n = 1; n < 5; n++) {
      const copy = structuredClone(original);
      copy.Vertices = Float32Array.from(copy.Vertices, (v, i) => v + (i % 3 === 0 ? n * 90 : 0));
      model.Geosets.push(copy);
    }
  });
  const fixture = path.join(out, 'Routing.mdx'); fs.writeFileSync(fixture, doc.serialize('mdx'));
  server = http.createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    if (req.url.endsWith('/models')) return res.end(JSON.stringify({ data: [{ id: 'fixture-model' }, { id: 'fixture-mini' }] }));
    const data = JSON.parse(body); requests.push(data);
    const system = data.messages[0].content;
    let response;
    if (system.startsWith('Route one message')) {
      const raw = data.messages.at(-1).content;
      const input = JSON.parse(typeof raw === 'string' ? raw : raw[0].text);
      if (input.text.includes('cooperative')) {
        response = { worker: '', job: 'Cooperative measurement', helper: { job: 'Reference measurement', instructions: 'Read the model name and report it; make no changes.' }, checks: ['Model name stays unchanged', 'Report geoset count'] };
      } else if (input.text.includes('Which bones')) {
        birdName = input.nextBird;
        response = { worker: birdName, job: 'Read bone names', tiny: true };
      } else if (input.text.includes('Check those bones')) {
        response = { worker: input.current.id, job: 'Check bones again', tiny: true };
      } else if (input.text.includes('cloth')) {
        if (!input.correction) response = { worker: 'Missing bird', job: 'Cloth animation', tiny: false };
        else { corrections++; response = { worker: input.current.id, job: 'Cloth animation', tiny: false }; }
      } else response = { worker: '', job: 'Separate job', tiny: false };
      response = JSON.stringify(response);
    } else if (system.startsWith('You are a read-only')) {
      cooperativeHelper++;
      if (cooperativeHelper === 1) {
        await inspected;
        const input = data.messages.find(m => m.role === 'user').content[0].text;
        const target = JSON.parse(input.split(/MDLxL context captured when this prompt was sent[^\n]*:\n/).at(-1)).target;
        response = tool('mdlxl_script', { target, edit: true, label: 'Refused helper edit', scope: ['/Info'], code: 'model.Info.Name = "Wrong helper write"; return {};' });
      } else {
        check('helper writes are refused by the real service', /read-only/.test(data.messages.at(-1).content));
        response = 'Reference measurement completed; preserve the existing model name.';
      }
    } else if (JSON.stringify(data.messages).includes('Cooperative measurement')) {
      const input = data.messages.filter(m => m.role === 'user')[0].content[0].text;
      const rawContext = input.split(/MDLxL context captured when this prompt was sent[^\n]*:\n/).at(-1).split('\n\nOrganiser completion criteria:')[0];
      const target = JSON.parse(rawContext).target;
      if (input.includes('Resume the interrupted task')) {
        cooperativeResume++;
        if (cooperativeResume === 1) response = tool('mdlxl_script', { target, routine: 'counts', parameters: { extra: 2 } });
        else {
          check('saved routine executes after the phase handover', /"count":7/.test(data.messages.at(-1).content));
          response = 'Worker fixture finished ' + (++answered) + '.';
        }
      } else {
        cooperativeMain++;
        const plan = { cause: 'Need reference and target measurements.', reach: 'Read-only model inspection.', keep: ['model name and geometry'], options: [{ fix: 'Measure the model', cost: 'No edits' }, { fix: 'Guess', cost: 'Unreliable' }], choice: 0, why: 'Use measured data.', checks: ['Model name stays unchanged', 'Report geoset count'] };
        if (cooperativeMain === 1) response = tool('mdlxl_context', { target });
        else if (cooperativeMain === 2) { mainRead(); response = tool('mdlxl_plan', plan); }
        else if (cooperativeMain === 3) {
          check('editor receives the helper findings before proceeding', /Reference measurement completed/.test(data.messages.at(-1).content));
          response = tool('mdlxl_plan', plan);
        } else if (cooperativeMain === 4) response = tool('mdlxl_script', { target, routine: 'counts', code: 'return { count: model.Geosets.length + parameters.extra };', parameters: { extra: 0 } });
        else if (cooperativeMain === 5) response = tool('mdlxl_script', { target, routine: 'counts', parameters: { extra: 1 } });
        else {
          check('routine parameters change its computed result', /"count":6/.test(data.messages.at(-1).content));
          response = tool('mdlxl_job_checkpoint', { phase: 'verify', evidence: 'Read model and helper report; no model changes.', remaining: ['Verify saved routine after handover'] });
        }
      }
    } else {
      response = 'Worker fixture finished ' + (++answered) + '.';
    }
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    res.end('data: ' + JSON.stringify({ choices: [typeof response === 'string' ? { delta: { content: response }, finish_reason: 'stop' } : response], usage: { prompt_tokens: cooperativeMain >= 5 && !cooperativeResume && !system.startsWith('You are a read-only') ? 80000 : 100, completion_tokens: 20 } }) + '\n\n');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const launched = await launchApp({ fixture, out, env: { MDLVIS_HEADLESS: '', MDLXL_DISABLE_UPDATES: '1', TEMP: path.join(out, 'temp'), TMP: path.join(out, 'temp') } });
  ({ app, page, errors } = launched);
  profile = launched.profile;

  await page.waitForSelector('.classic-toolbar', { timeout: 60000 });
  await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.unmaximize(); w.setContentSize(1440, 900); });
  await page.getByRole('button', { name: 'AI assistant', exact: true }).click();
  if (!await page.getByLabel('AI provider', { exact: true }).isVisible()) await page.getByRole('button', { name: 'Connection settings', exact: true }).click();
  await page.getByLabel('AI provider', { exact: true }).selectOption('compatible');
  await page.getByLabel('API base URL', { exact: true }).fill('http://127.0.0.1:' + server.address().port + '/v1');
  await page.getByLabel('Model', { exact: true }).fill('fixture-model');
  await page.getByLabel('Job routing', { exact: true }).selectOption('automatic');
  await page.getByRole('button', { name: 'Load models', exact: true }).click();
  await page.getByLabel('Allow lighter models for simple jobs', { exact: true }).check();
  await page.getByRole('button', { name: 'Save connection', exact: true }).click();
  await page.getByRole('button', { name: 'Connection settings', exact: true }).click();
  const input = page.getByLabel('AI prompt', { exact: true });
  async function send(text) {
    const count = answered + 1;
    await input.fill(text); await input.press('Control+Enter');
    await page.getByText('Worker fixture finished ' + count + '.', { exact: true }).first().waitFor();
    await page.locator('.ai-send[aria-label="Send"]').waitFor();
  }
  const routeCalls = () => requests.filter(r => r.messages[0].content.startsWith('Route one message'));
  const birdCalls = () => requests.filter(r => !r.messages[0].content.startsWith('Route one message'));
  await send('Which bones belong to the garment?');
  check('automatic default starts a named tiny bird without asking the owner', answered === 1 && birdCalls()[0].model === 'fixture-mini');
  await send('Check those bones again');
  check('router bird id reuses the existing bird', await page.locator('.ai-roster .ai-roster-idle').count() === 1 && (await page.locator('.ai-roster .ai-roster-idle').innerText()).includes(birdName) && birdCalls()[1].model === 'fixture-mini');
  await send('Make the cloth respect the arm motion');
  check('invalid bird is corrected once before work starts', corrections === 1 && answered === 3 && routeCalls().length === 4);
  check('corrective routing counts both turns in token totals', (await page.locator('.ai-cost').allTextContents()).join(' ').includes('router: 2 calls') && (await page.locator('.ai-cost').allTextContents()).some(t => /router: 2 calls.*240 tokens/.test(t)));
  check('complex follow-up hands over to chosen model without manual question', birdCalls()[2].model === 'fixture-model' && await page.getByRole('button', { name: 'Keep chosen model', exact: true }).count() === 0);
  check('the chosen model routes every job', routeCalls().every(r => r.model === 'fixture-model'));
  check('router receives context without model images or editing tools', routeCalls().every(r => !r.tools && !JSON.stringify(r).includes('image_url')));
  await send('Different independent job: inspect the model proportions');
  check('unrelated job starts a fresh bird', answered === 4 && birdCalls()[3].model === 'fixture-model');
  await send('Run a cooperative reference and target inspection without changing the model');
  check('helper and editor ran concurrently without an extra owner message', cooperativeHelper === 2 && cooperativeMain === 6);
  check('full-context bird hands over inside the same job', cooperativeResume === 2);
  const chats = fs.readdirSync(path.join(profile, 'ai')).filter(n => /^chat-.*\.json$/.test(n)).map(n => JSON.parse(fs.readFileSync(path.join(profile, 'ai', n), 'utf8')));
  const helper = chats.find(c => c.helperOnly), resumed = chats.find(c => c.task?.workCheckpoint);
  check('helper has a distinct read-only conversation', !!helper && helper.task.status === 'complete');
  check('phase checkpoint and routine are persisted', !!resumed?.task.routines?.counts);
  // Normal mouse input on the hidden desktop: compare the actual rendered view.
  const canvas = page.locator('.classic-view canvas').first(), box = await canvas.boundingBox();
  const before = await canvas.screenshot();
  await page.keyboard.down('Alt'); await page.mouse.move(box.x + box.width * .45, box.y + box.height * .55);
  await page.mouse.down(); await page.mouse.move(box.x + box.width * .65, box.y + box.height * .6, { steps: 16 }); await page.mouse.up(); await page.keyboard.up('Alt');
  await settle(page, 200);
  check('normal Alt and mouse drag rotates the model', !before.equals(await canvas.screenshot()));
  await page.screenshot({ path: path.join(out, 'automatic-routing.png') });
  check('no renderer errors', errors.length === 0);
})().catch(error => { checks.push({ name: 'exception', passed: false, error: error.stack }); process.exitCode = 1; }).finally(async () => {
  if (app) await closeApp(app);
  if (server) await new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });
  if (profile) fs.rmSync(profile, { recursive: true, force: true });
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(checks, null, 2)); console.log(JSON.stringify(checks, null, 2));
});
