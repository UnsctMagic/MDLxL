// Automatic bird routing in the real package, driven only on scripts/hidden-run.ps1.
// Local provider and generated model: no real account, profile or user assets.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'D:/Claude/tools/node_modules/playwright-core');
const out = path.resolve(process.env.MDLXL_AI_TEST_OUT || 'out/ai-routing');
const checks = [], requests = [], errors = [];
let app, server, birdName, answered = 0, corrections = 0;
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
      if (input.text.includes('Which bones')) {
        birdName = input.nextBird;
        response = { worker: birdName, job: 'Read bone names', tiny: true };
      } else if (input.text.includes('Check those bones')) {
        response = { worker: input.current.id, job: 'Check bones again', tiny: true };
      } else if (input.text.includes('cloth')) {
        if (!input.correction) response = { worker: 'Missing bird', job: 'Cloth animation', tiny: false };
        else { corrections++; response = { worker: input.current.id, job: 'Cloth animation', tiny: false }; }
      } else response = { worker: '', job: 'Separate job', tiny: false };
      response = JSON.stringify(response);
    } else {
      response = 'Worker fixture finished ' + (++answered) + '.';
    }
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    res.end('data: ' + JSON.stringify({ choices: [{ delta: { content: response }, finish_reason: 'stop' }], usage: { prompt_tokens: 100, completion_tokens: 20 } }) + '\n\n');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  app = await _electron.launch({ executablePath: process.env.MDLXL_AI_TEST_EXE, args: [fixture], env: { ...process.env, MDLXL_PROFILE: path.join(out, 'profile'), MDLXL_DISABLE_UPDATES: '1', TEMP: path.join(out, 'temp'), TMP: path.join(out, 'temp') }, timeout: 60000 });
  const page = await app.firstWindow(); page.setDefaultTimeout(20000); page.on('pageerror', error => errors.push(error.message));
  await page.waitForSelector('.classic-toolbar', { timeout: 60000 });
  await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.webContents.setBackgroundThrottling(false); w.unmaximize(); w.setContentSize(1440, 900); });
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
  // Normal mouse input on the hidden desktop: compare the actual rendered view.
  const canvas = page.locator('.classic-view canvas').first(), box = await canvas.boundingBox();
  const before = await canvas.screenshot();
  await page.keyboard.down('Alt'); await page.mouse.move(box.x + box.width * .45, box.y + box.height * .55);
  await page.mouse.down(); await page.mouse.move(box.x + box.width * .65, box.y + box.height * .6, { steps: 16 }); await page.mouse.up(); await page.keyboard.up('Alt');
  await page.waitForTimeout(200);
  check('normal Alt and mouse drag rotates the model', !before.equals(await canvas.screenshot()));
  await page.screenshot({ path: path.join(out, 'automatic-routing.png') });
  check('no renderer errors', errors.length === 0);
})().catch(error => { checks.push({ name: 'exception', passed: false, error: error.stack }); process.exitCode = 1; }).finally(async () => {
  if (app) { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await app.close().catch(() => {}); }
  if (server) await new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(checks, null, 2)); console.log(JSON.stringify(checks, null, 2));
});
