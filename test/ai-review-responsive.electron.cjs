// The window keeps answering while the AI review measures every frame of a real model.
const fs = require('node:fs'), http = require('node:http'), path = require('node:path'), assert = require('node:assert/strict');
const { launchApp, closeApp } = require('./helpers/app.cjs');
const { testModel } = require('./helpers/fixtures.cjs');
const out = path.resolve('out/ai-review-responsive');
// The unfixed review froze the window for 26–40 s. The fixed one pauses for about 1.6 s at most;
// this leaves room for the slow-CPU variant (four times slower) and still catches a real freeze.
const MAX_STALL_MS = 8000;

async function run(scenario) {
  let action = 0, failure, inspected, reachedInspect;
  const inspecting = new Promise(resolve => { reachedInspect = resolve; });
  const server = http.createServer(async (req, res) => {
    if (req.url.endsWith('/models')) { res.end('{"data":[{"id":"fixture"}]}'); return; }
    let body = ''; for await (const chunk of req) body += chunk;
    const data = JSON.parse(body);
    const text = m => Array.isArray(m.content) ? m.content[0]?.text : m.content;
    let delta;
    try {
      const prior = data.messages.filter(m => m.role === 'tool').at(-1)?.content;
      if (action === 3) inspected = prior;
      if (action && (typeof prior !== 'string' || !prior.startsWith('{'))) throw Error('Tool failed: ' + String(prior).slice(0, 500));
      const calls = [
        ['mdlxl_plan', { cause: 'The animations need the requested rarity.', reach: 'Sequence rarity only.', keep: ['All motion'], options: [{ fix: 'Set rarity.', cost: 'One field' }, { fix: 'Rebuild the sequences', cost: 'Broader' }], choice: 0, why: 'Smallest change', checks: ['Rarity and motion'] }],
        ['mdlxl_script', { edit: true, label: 'Set rarity', scope: ['/Sequences'], code: 'for (const sequence of model.Sequences) sequence.Rarity = 9;' }],
        ['mdlxl_review', { action: 'inspect', checksCode: 'return [{ name: "Rarity set", passed: model.Sequences.every(s => s.Rarity === 9) }];' }],
        ['mdlxl_review', { action: 'finish', outcome: 'passed', summary: 'Every animation has the requested rarity and the motion is unchanged.' }],
      ];
      if (action < calls.length) {
        if (action === 2) reachedInspect();
        const [name, args] = calls[action++];
        if (name !== 'mdlxl_plan') args.target = [...data.messages.filter(m => m.role === 'user').map(text).join('\n').matchAll(/"target"\s*:\s*"([^"]+)"/g)].at(-1)?.[1];
        delta = { tool_calls: [{ index: 0, id: 'review-' + action, function: { name, arguments: JSON.stringify(args) } }] };
      } else delta = { content: 'Done.' };
    } catch (e) { failure = e; console.error(e); delta = { content: 'Fixture error: ' + e.message }; }
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    res.end('data: ' + JSON.stringify({ choices: [{ delta, finish_reason: delta.tool_calls ? 'tool_calls' : 'stop' }] }) + '\n\n');
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  fs.mkdirSync(out, { recursive: true });
  const profile = fs.mkdtempSync(path.join(out, 'profile-'));
  fs.mkdirSync(path.join(profile, 'ai'));
  fs.writeFileSync(path.join(profile, 'ai/connections.json'), JSON.stringify({ provider: 'compatible', outsideCheck: false, providers: { compatible: { model: 'fixture', baseUrl: 'http://127.0.0.1:' + server.address().port + '/v1' } } }));
  let app;
  try {
    const launched = await launchApp({ fixture: testModel('WH_WOC_KnightSlaaneshChampion01.mdx'), out, profile, show: 'inactive' });
    app = launched.app;
    const page = launched.page;
    page.setDefaultTimeout(240000);
    await page.getByRole('button', { name: 'AI assistant', exact: true }).click();
    // Every delay between two timer ticks is time the window could not react to anything.
    await page.evaluate(() => {
      const watch = window.__responsive = { stalls: [], longTasks: [] };
      let last = performance.now();
      setInterval(() => { const now = performance.now(); if (now - last > 250) watch.stalls.push(Math.round(now - last)); last = now; }, 50);
      new PerformanceObserver(list => { for (const task of list.getEntries()) watch.longTasks.push(Math.round(task.duration)); }).observe({ entryTypes: ['longtask'] });
      // Only tells the test when the measurement is really running and when it ended.
      const NativeWorker = window.Worker;
      watch.measuring = 0; watch.ended = 0;
      window.Worker = class extends NativeWorker {
        constructor(url, options) { super(url, options); this.measures = String(url).includes('ai-motion-compare'); if (this.measures) watch.measuring++; }
        terminate() { if (this.measures) watch.ended++; super.terminate(); }
      };
    });
    await page.getByLabel('AI prompt').fill('Set every animation rarity to 9.');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    const stop = page.getByRole('button', { name: 'Stop', exact: true });
    const started = Date.now();
    await inspecting;
    if (scenario === 'stop') {
      // Stop during the measurement: the job ends at once, it does not sit out the remaining frames.
      await page.waitForFunction(() => window.__responsive.measuring > 0, null, { timeout: 60000 });
      await page.waitForTimeout(1000);
      const pressed = Date.now();
      await stop.click();
      await stop.waitFor({ state: 'hidden', timeout: 10000 });
      const ended = Date.now() - pressed;
      console.log(`Stop ended the job after ${ended} ms`);
      assert.ok(ended < 8000, `Stop took ${ended} ms`);
      assert.equal(await page.evaluate(() => window.__responsive.ended), 1, 'Stop ended the measurement');
    } else {
      await stop.waitFor({ state: 'hidden', timeout: 240000 });
      console.log(`Inspect and finish took ${Date.now() - started} ms`);
    }
    const watch = await page.evaluate(() => window.__responsive);
    console.log('Stalls over 250 ms:', JSON.stringify(watch.stalls), 'long tasks:', JSON.stringify(watch.longTasks));
    if (scenario === 'finish') {
      assert.ok(inspected, 'the fixture received the inspect result');
      const review = JSON.parse(inspected.split('\n')[0]).review;
      assert.equal(review.passed, true);
      assert.equal(review.motion.sequences.length, 15, 'every changed animation was measured');
      for (const row of review.motion.sequences) assert.equal(row.distance.distance, 0, row.name + ' keeps its motion');
    }
    assert.ok(Math.max(0, ...watch.stalls) < MAX_STALL_MS, `The window stalled for ${Math.max(...watch.stalls)} ms`);
  } finally {
    server.closeAllConnections();
    server.close();
    if (app) await closeApp(app);
    assert.ifError(failure);
  }
}
async function main() {
  for (const scenario of ['finish', 'stop']) {
    try { await run(scenario); console.log('PASS', scenario); }
    catch (error) { console.error('FAIL', scenario, error); process.exitCode = 1; }
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
