// View AI work in the app (W1-W3), the user's way: a fixture OpenAI-compatible provider runs a
// job (a picture, an edit, a sample at another frame) while the user clicks the console.
// Run through scripts/hidden-run.ps1 on Windows; never uses the user's profile.
const fs = require('node:fs'), http = require('node:http'), path = require('node:path'), assert = require('node:assert/strict');
const { launchApp, closeApp, settle } = require('./helpers/app.cjs');
const { fixturePath } = require('./helpers/fixtures.cjs');
const out = path.resolve(process.env.MDLXL_AI_TEST_OUT || 'out/ai-watch');
const checks = [];
const check = (name, condition, detail) => {
  checks.push({ name, passed: !!condition, ...(detail === undefined ? {} : { detail }) });
  assert.ok(condition, name + (detail === undefined ? '' : ': ' + JSON.stringify(detail)));
};
// Polls a reading in the page until it passes or the time is up (TESTING-RULES rule 8).
async function until(page, read, test, timeout = 15000) {
  const end = Date.now() + timeout;
  let value;
  while (Date.now() < end) {
    value = await page.evaluate(read);
    if (test(value)) return value;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  return value;
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const fixture = fixturePath('citadel-footman');
  assert.ok(fixture && fs.existsSync(fixture), 'the Footman test model is in MDLxL-TestModels');
  // Each prompt is one job: job 1 (switch on) and job 2 (switch off) look at different frames and views.
  const jobs = {
    watched: [
      ['mdlxl_capture', { samples: [{ view: 'front', sequence: 4, frame: 12900 }] }],
      ['mdlxl_script', { edit: true, label: 'AI nudge', scope: ['/Geosets/1/Vertices'], code: 'model.Geosets[1].Vertices[0] += 2; return "moved";' }],
      ['mdlxl_sample', { sequence: 6, frames: [18000] }],
    ],
    unwatched: [
      ['mdlxl_capture', { samples: [{ view: 'left', sequence: 9, frame: 22000 }] }],
      ['mdlxl_sample', { sequence: 2, frames: [5000] }],
    ],
  };
  const errors = [];
  const server = http.createServer(async (req, res) => {
    if (req.url.endsWith('/models')) { res.end('{"data":[{"id":"fixture"}]}'); return; }
    let body = '';
    for await (const chunk of req) body += chunk;
    const data = JSON.parse(body);
    const text = m => (Array.isArray(m.content) ? m.content[0]?.text : m.content) || '';
    const prompts = data.messages.filter(m => m.role === 'user' && /MDLxL context/.test(text(m)));
    const prompt = prompts.at(-1), name = /^watched/.test(text(prompt)) ? 'watched' : 'unwatched';
    const turn = data.messages.slice(data.messages.lastIndexOf(prompt) + 1);
    const results = turn.filter(m => m.role === 'tool');
    // Results are JSON, or picture labels ('Image 1: ...'); anything else is an editor error message.
    for (const m of results) if (!/^(?:\{|Image \d|Viewport image follows)/.test(String(m.content)) && !errors.includes(m.content)) errors.push(m.content);
    const target = [...data.messages.filter(m => m.role === 'user').map(text).join('\n').matchAll(/"target"\s*:\s*"([^"]+)"/g)].at(-1)?.[1];
    const step = jobs[name][results.length];
    const delta = step
      ? { tool_calls: [{ index: 0, id: name + '-' + results.length, function: { name: step[0], arguments: JSON.stringify({ target, ...step[1] }) } }] }
      : { content: 'Done.' };
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    res.end('data: ' + JSON.stringify({ choices: [{ delta, finish_reason: step ? 'tool_calls' : 'stop' }] }) + '\n\n');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const profile = fs.mkdtempSync(path.join(out, 'profile-'));
  fs.mkdirSync(path.join(profile, 'ai'));
  fs.writeFileSync(path.join(profile, 'ai/connections.json'), JSON.stringify({ provider: 'compatible', outsideCheck: false,
    providers: { compatible: { model: 'fixture', baseUrl: 'http://127.0.0.1:' + server.address().port + '/v1' } } }));
  let app;
  try {
    const launched = await launchApp({ fixture, out, profile, show: 'inactive', env: { MDLXL_DISABLE_UPDATES: '1' } });
    app = launched.app;
    const { page } = launched;
    await page.waitForSelector('.classic-toolbar', { timeout: 60000 });
    await settle(page, 500);
    await page.getByRole('button', { name: 'Animations', exact: true }).click();
    await page.getByRole('button', { name: 'AI assistant', exact: true }).click();
    const watchSwitch = page.getByRole('switch', { name: 'View AI work', exact: true });
    check('the View AI work switch is in the console header and off by default', (await watchSwitch.getAttribute('aria-checked')) === 'false');
    const live = () => {
      const app = window.__mdlxl, preview = app.preview();
      return { sequence: app.session() && preview?.props.sequenceIndex, time: preview?.props.time, view: preview?.props.view,
        hovered: preview?.props.hoveredGeoset ?? null, vertex: app.model().Geosets[1].Vertices[0], tab: app.session().doc.name };
    };
    const before = await page.evaluate(live);

    // W2 on: the live editor follows the job.
    await watchSwitch.click();
    await until(page, () => document.querySelector('[aria-label="View AI work"]')?.getAttribute('aria-checked'), v => v === 'true');
    check('clicking the switch turns View AI work on', (await watchSwitch.getAttribute('aria-checked')) === 'true');
    await page.getByLabel('AI prompt').fill('watched: look at the attack, nudge the shield, check the walk');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await page.getByRole('button', { name: 'Stop', exact: true }).waitFor({ state: 'hidden', timeout: 60000 });
    const followed = await until(page, live, v => v.sequence === 6 && v.time === 18000);
    check('the live animation and frame follow the frame the AI sampled last', followed.sequence === 6 && followed.time === 18000, followed);
    check('the live view follows the view of the AI picture', followed.view === 'front', followed);
    check('the edit landed live on the model on screen (no private copy)', followed.vertex === Math.fround(before.vertex + 2) && followed.tab === before.tab, { before, followed });
    check('no model-changed question while only the AI moved the frame', (await page.getByRole('group', { name: 'Model changed during the AI job' }).count()) === 0);
    check('no private-copy offer', (await page.getByRole('group', { name: 'AI private copy' }).count()) === 0);
    check('no provider tool error', errors.length === 0, errors);

    // W1: the capture step shows the picture the AI received; click enlarges, Escape closes.
    const thumbs = page.locator('.ai-step-picture');
    check('the capture step shows a thumbnail of the AI picture', (await thumbs.count()) === 1, await thumbs.count());
    const thumbSize = await thumbs.first().locator('img').evaluate(img => ({ w: img.naturalWidth, h: img.naturalHeight, src: img.src.slice(0, 23) }));
    check('the stored thumbnail is a small JPEG copy', thumbSize.src === 'data:image/jpeg;base64,' && Math.max(thumbSize.w, thumbSize.h) <= 768 && thumbSize.w > 0, thumbSize); // 768 px since ac6e329a (sharper chat pictures)
    await thumbs.first().click();
    const viewer = page.getByRole('dialog', { name: 'AI picture' });
    await viewer.waitFor();
    const large = await viewer.locator('img').boundingBox(), small = await thumbs.first().locator('img').boundingBox();
    check('a click shows the picture larger', large.width > small.width * 3, { large, small });
    await page.keyboard.press('Escape');
    await viewer.waitFor({ state: 'hidden', timeout: 5000 });
    check('Escape closes the larger picture and leaves the console open', (await page.locator('section.ai-assistant').count()) === 1);
    await thumbs.first().click();
    await viewer.waitFor();
    await viewer.click();
    await viewer.waitFor({ state: 'hidden', timeout: 5000 });
    check('a click on the larger picture closes it', true);

    // W3: the edit step names the part it changed; a click flashes it on the model.
    const chip = page.getByRole('button', { name: 'Geoset 2', exact: true });
    check('the edit step shows the geoset it changed', (await chip.count()) === 1);
    check('nothing is highlighted before the click', (await page.evaluate(live)).hovered === null);
    await chip.click();
    const flashed = await until(page, live, v => v.hovered === 1, 3000);
    check('clicking the part flashes that geoset on the model', flashed.hovered === 1, flashed);
    const faded = await until(page, live, v => v.hovered === null, 5000);
    check('the flash ends by itself', faded.hovered === null, faded);

    // W2 off: nothing on screen follows the AI any more.
    await watchSwitch.click();
    await until(page, () => document.querySelector('[aria-label="View AI work"]')?.getAttribute('aria-checked'), v => v === 'false');
    const still = await page.evaluate(live);
    await page.getByLabel('AI prompt').fill('unwatched: look at the death, check the victory');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await page.getByRole('button', { name: 'Stop', exact: true }).waitFor({ state: 'hidden', timeout: 60000 });
    await page.waitForFunction(() => document.querySelectorAll('.ai-step-picture').length === 2, null, { timeout: 15000 });
    await settle(page, 300);
    const after = await page.evaluate(live);
    check('switch off: animation, frame and view stay where the user left them', after.sequence === still.sequence && after.time === still.time && after.view === still.view, { still, after });
    check('switch off: the chat still shows the new picture', (await thumbs.count()) === 2);

    // W1: the pictures are kept with the chat and come back after a reload.
    // Harness only: the nudged model is unsaved, which would hold the reload.
    await app.evaluate(({ BrowserWindow }) => { for (const win of BrowserWindow.getAllWindows()) win.webContents.on('will-prevent-unload', event => event.preventDefault()); });
    await page.reload();
    await page.waitForSelector('.classic-toolbar', { timeout: 60000 });
    if (!(await page.locator('section.ai-assistant').count())) await page.getByRole('button', { name: 'AI assistant', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('.ai-step-picture').length === 2, null, { timeout: 20000 });
    check('the thumbnails survive a reload', (await page.locator('.ai-step-picture').count()) === 2);
    check('the switch is remembered off', (await page.getByRole('switch', { name: 'View AI work', exact: true }).getAttribute('aria-checked')) === 'false');
    check('the changed-part chip survives a reload', (await page.getByRole('button', { name: 'Geoset 2', exact: true }).count()) === 1);
    const pageErrors = launched.errors.filter(message => !/ResizeObserver/.test(message));
    check('no page errors', pageErrors.length === 0, pageErrors);
  } finally {
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify({ checks }, null, 2));
    if (app) await closeApp(app).catch(() => {});
    server.close();
  }
  console.log(checks.map(c => (c.passed ? 'PASS ' : 'FAIL ') + c.name).join('\n'));
  console.log(`${checks.filter(c => c.passed).length}/${checks.length} checks passed`);
})().catch(error => {
  console.log(checks.map(c => (c.passed ? 'PASS ' : 'FAIL ') + c.name).join('\n'));
  console.error(error);
  process.exitCode = 1;
});
