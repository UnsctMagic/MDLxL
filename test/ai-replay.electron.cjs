// AI work replay in the app, the user's way: a fixture OpenAI-compatible provider
// runs real jobs (vertex move, new part, removed part, texture change, animation key) through the
// app's own mdlxl_* tools while the console is open, and every display frame is recorded.
// No AI credits. Run through scripts/hidden-run.ps1 on Windows; never uses the user's profile.
// MDLXL_TEST_EXE points it at a packaged build; otherwise it runs the built dist.
const fs = require('node:fs'), http = require('node:http'), path = require('node:path'), assert = require('node:assert/strict');
const { launchApp, closeApp, settle } = require('./helpers/app.cjs');
const { fixturePath } = require('./helpers/fixtures.cjs');
const out = path.resolve(process.env.MDLXL_AI_TEST_OUT || 'out/ai-replay');
const checks = [];
const check = (name, condition, detail) => {
  checks.push({ name, passed: !!condition, ...(detail === undefined ? {} : { detail }) });
  assert.ok(condition, name + (detail === undefined ? '' : ': ' + JSON.stringify(detail)));
};
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(page, read, test, timeout = 15000, arg) {
  const end = Date.now() + timeout;
  let value;
  while (Date.now() < end) {
    value = await page.evaluate(read, arg);
    if (test(value)) return value;
    await wait(50);
  }
  return value;
}
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const fixture = process.env.MDLXL_AI_REPLAY_MODEL || fixturePath('footman');
  assert.ok(fixture && fs.existsSync(fixture), 'the Footman test model is in MDLxL-TestModels');
  // Each prompt is one job; its first word names it. A step is [tool, arguments].
  const jobs = {}, pause = { shape: 1500, motion: 1500, fast: 0, off: 0 }, gaps = [];
  const errors = [];
  let answeredAt = 0;
  const server = http.createServer(async (req, res) => {
    if (req.url.endsWith('/models')) { res.end('{"data":[{"id":"fixture"}]}'); return; }
    let body = '';
    for await (const chunk of req) body += chunk;
    const data = JSON.parse(body);
    const text = m => (Array.isArray(m.content) ? m.content[0]?.text : m.content) || '';
    const prompts = data.messages.filter(m => m.role === 'user' && /MDLxL context/.test(text(m)));
    const prompt = prompts.at(-1), name = /^(\w+)/.exec(text(prompt))?.[1];
    const turn = data.messages.slice(data.messages.lastIndexOf(prompt) + 1);
    const results = turn.filter(m => m.role === 'tool');
    if (results.length && answeredAt) gaps.push({ job: name, step: results.length, ms: Date.now() - answeredAt });
    for (const m of results) if (!/^(?:\{|Image \d|Viewport image follows)/.test(String(m.content)) && !errors.includes(m.content)) errors.push(m.content);
    const target = [...data.messages.filter(m => m.role === 'user').map(text).join('\n').matchAll(/"target"\s*:\s*"([^"]+)"/g)].at(-1)?.[1];
    const step = (jobs[name] || [])[results.length];
    // A real AI thinks between steps; the pause lets each replay finish before the next step.
    if (results.length && step) await wait(pause[name] || 0);
    const delta = step
      ? { tool_calls: [{ index: 0, id: name + '-' + results.length, function: { name: step[0], arguments: JSON.stringify({ target, ...step[1] }) } }] }
      : { content: 'Done.' };
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    res.end('data: ' + JSON.stringify({ choices: [{ delta, finish_reason: step ? 'tool_calls' : 'stop' }] }) + '\n\n');
    answeredAt = Date.now();
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

    // The model's own facts decide the edits: its biggest part, a second texture, an animated bone.
    const facts = await page.evaluate(() => {
      const model = window.__mdlxl.model();
      const part = model.Geosets.map((geoset, index) => [geoset.Vertices.length, index]).sort((a, b) => b[0] - a[0])[0][1];
      const layer = model.Materials[model.Geosets[part].MaterialID].Layers.find(item => typeof item.TextureID === 'number' && model.Textures[item.TextureID]?.Image);
      const other = model.Textures.findIndex((texture, index) => texture.Image && layer && index !== layer.TextureID && texture.Image !== model.Textures[layer.TextureID].Image);
      let motion = null;
      model.Sequences.some((sequence, index) => {
        const bone = model.Bones.find(item => (item.Translation?.Keys || []).filter(key => key.Frame >= sequence.Interval[0] && key.Frame <= sequence.Interval[1]).length >= 2);
        if (!bone) return false;
        const keys = bone.Translation.Keys.filter(key => key.Frame >= sequence.Interval[0] && key.Frame <= sequence.Interval[1]);
        motion = { sequence: index, bone: bone.ObjectId, frame: keys[1].Frame, start: sequence.Interval[0], end: sequence.Interval[1] };
        return true;
      });
      return { part, geosets: model.Geosets.length, texture: layer ? layer.TextureID : -1, other, motion };
    });
    assert.ok(facts.motion, 'the test model has an animated bone');
    const G = facts.part;
    const lift = amount => ['mdlxl_script', { edit: true, label: 'AI lift', scope: ['/Geosets/' + G + '/Vertices'], code: `const v = model.Geosets[${G}].Vertices; for (let i = 0; i < v.length; i += 3) v[i + 2] += ${amount}; return 'moved';` }];
    jobs.shape = [
      lift(18),
      ['mdlxl_script', { edit: true, label: 'AI new part', scope: ['/Geosets'], code: `const g = structuredClone(model.Geosets[${G}]); for (let i = 0; i < g.Vertices.length; i += 3) g.Vertices[i] += 60; model.Geosets.push(g); return 'added';` }],
      ['mdlxl_script', { edit: true, label: 'AI remove part', scope: ['/Geosets'], code: `model.Geosets.pop(); return 'removed';` }],
      facts.other >= 0
        ? ['mdlxl_script', { edit: true, label: 'AI texture', scope: ['/Textures'], code: `model.Textures[${facts.texture}].Image = model.Textures[${facts.other}].Image; return 'painted';` }]
        : ['mdlxl_script', { edit: true, label: 'AI material', scope: ['/Materials'], code: `model.Materials[model.Geosets[${G}].MaterialID].Layers[0].Alpha = .5; return 'restyled';` }],
    ];
    jobs.motion = [
      ['mdlxl_view', { sequence: facts.motion.sequence, frame: facts.motion.start }],
      ['mdlxl_script', { edit: true, label: 'AI key', scope: ['/Bones'], code: `const bone = model.Bones.find(b => b.ObjectId === ${facts.motion.bone}); bone.Translation.Keys.find(k => k.Frame === ${facts.motion.frame}).Vector[2] += 14; return 'keyed';` }],
      lift(-9),
    ];
    jobs.off = [lift(-8)];

    // Every display frame: the replay, what the view shows of one point, the model's real value.
    const record = () => page.evaluate(part => {
      window.__replayLog = [];
      cancelAnimationFrame(window.__replayTick);
      // Read after the frame's own drawing, so each row is what that frame showed.
      const read = () => {
        const replay = window.__mdlxl.replay(), view = replay.views[0], model = window.__mdlxl.model();
        const added = model.Geosets.length - 1;
        window.__replayLog.push({ t: performance.now(), id: replay.id || 0, p: replay.p ?? null, ms: replay.ms, look: !!replay.look, fade: replay.fade || null, counts: replay.counts || null,
          span: replay.span || null, color: replay.color, overlay: !!document.querySelector('canvas[data-ai-replay]'), kind: view?.kind, wrote: !!view?.wrote, frame: view?.frame ?? null, camera: null,
          shown: view ? view.shown(part, 1) : null, real: Array.from(model.Geosets[part].Vertices.subarray(0, 3)), geosets: model.Geosets.length,
          grown: view && added !== part ? view.shown(added, 2) : null, keys: document.querySelectorAll('[data-ai-replay-key]').length });
      };
      const tick = () => {
        setTimeout(read, 0);
        window.__replayTick = requestAnimationFrame(tick);
      };
      tick();
    }, G);
    const stop = () => page.evaluate(() => { cancelAnimationFrame(window.__replayTick); return window.__replayLog; });
    const send = async prompt => {
      await page.getByLabel('AI prompt').fill(prompt);
      await page.getByRole('button', { name: 'Send', exact: true }).click();
      await page.getByRole('button', { name: 'Stop', exact: true }).waitFor({ state: 'hidden', timeout: 90000 });
    };
    // The replays of a log, in order: [{ id, frames }], looks left out.
    const replaysOf = log => {
      const list = [];
      for (const row of log) {
        if (!row.id || row.look) continue;
        if (list.at(-1)?.id !== row.id) list.push({ id: row.id, frames: [] });
        list.at(-1).frames.push(row);
      }
      return list;
    };

    // Open the AI console.
    await page.getByRole('button', { name: 'AI assistant', exact: true }).click();
    await page.locator('section.ai-assistant').waitFor({ timeout: 15000 });

    // Switch on: every step replays in the editor view.
    const watchSwitch = page.getByRole('switch', { name: 'View AI work', exact: true });
    if ((await watchSwitch.getAttribute('aria-checked')) !== 'true') await watchSwitch.click();
    await until(page, () => document.querySelector('[aria-label="View AI work"]')?.getAttribute('aria-checked'), v => v === 'true');
    const startPoint = await page.evaluate(part => Array.from(window.__mdlxl.model().Geosets[part].Vertices.subarray(0, 3)), G);
    await record();
    // Camera rotation during a replay: a real drag on the view while the first step replays.
    const viewBox = await page.locator('canvas').first().boundingBox();
    const sending = send('shape: lift the part, add a part, remove it, repaint');
    await until(page, () => window.__mdlxl.replay().id && !window.__mdlxl.replay().look, Boolean, 30000);
    await page.screenshot({ path: path.join(out, 'replay-glide.png') });
    await sending;
    await wait(1300);
    const shape = await stop();
    await page.screenshot({ path: path.join(out, 'replay-after.png') });
    const shapeReplays = replaysOf(shape);
    check('each of the four steps replayed', shapeReplays.length === 4, shapeReplays.map(r => ({ id: r.id, frames: r.frames.length, counts: r.frames[0].counts, fade: r.frames[0].fade })));
    const [moved, added, removed, painted] = shapeReplays;
    const endPoint = [startPoint[0], startPoint[1], startPoint[2] + 18];
    const between = moved.frames.filter(row => row.shown && distance(row.shown, startPoint) > 1 && distance(row.shown, endPoint) > 1);
    check('vertex move: the point is seen on its way from the old place to the new one', between.length >= 3, { frames: moved.frames.length, between: between.length, first: moved.frames[0].shown, startPoint, endPoint });
    check('vertex move: the model itself is already final while it replays', moved.frames.every(row => Math.abs(row.real[2] - endPoint[2]) < 1e-3), moved.frames[0].real);
    const path2 = moved.frames.filter(row => row.shown).map(row => row.shown[2]);
    check('vertex move: the glide never jumps back', path2.every((z, index) => !index || z >= path2[index - 1] - 1e-3), path2.slice(0, 12));
    const afterMove = shape.find(row => row.t > moved.frames.at(-1).t && !row.id);
    check('vertex move: the view ends exactly on the real position', afterMove && distance(afterMove.shown, endPoint) < 1e-3, afterMove?.shown);
    for (const [name, replay] of [['vertex move', moved], ['new part', added], ['removed part', removed], ['texture', painted]]) {
      const lasted = replay.frames.at(-1).t - replay.frames[0].t, planned = replay.frames[0].ms;
      check(name + ': the replay lasts about half a second to a second', planned >= 500 && planned <= 1000 && lasted >= 380 && lasted <= 1150, { planned, lasted });
      check(name + ': the marker and glow are on screen while it plays', replay.frames.filter(row => row.overlay).length >= replay.frames.length - 2, { overlay: replay.frames.filter(row => row.overlay).length, frames: replay.frames.length });
    }
    check('new part: it grows into place', added.frames[0].counts.grows === 1 && (() => {
      const sizes = added.frames.filter(row => row.grown).map(row => distance(row.grown.slice(0, 3), row.grown.slice(3, 6)));
      const final = Math.max(...sizes);
      return sizes.length > 4 && sizes[1] < final * .6 && sizes.every((size, index) => !index || size >= sizes[index - 1] - 1e-3);
    })(), added.frames.filter(row => row.grown).slice(0, 4).map(row => row.grown));
    check('removed part: it shrinks and fades as a ghost', removed.frames[0].counts.ghosts === 1 && removed.frames[0].geosets === facts.geosets, removed.frames[0].counts);
    check(facts.other >= 0 ? 'texture: new pixels sweep in like a brush pass' : 'material: a smooth crossfade', painted.frames[0].fade === (facts.other >= 0 ? 'sweep' : 'cross'), painted.frames[0].fade);
    check('no overlay is left once the replays are over', shape.at(-1).overlay === false && shape.at(-1).id === 0);
    check('the marker and glow keep one soft colour', shape.every(row => row.color.toLowerCase() === '#ff1a20'), shape[0].color);
    check('no provider tool error', errors.length === 0, errors);

    // Animation view: the key pops onto the timeline, the changed span plays once, the mesh glides in the posed preview.
    await page.getByRole('button', { name: 'Animations', exact: true }).click();
    await page.waitForSelector('.game-preview-root', { timeout: 30000 });
    await settle(page, 600);
    await record();
    await send('motion: key the bone, then lower the part');
    await wait(1300);
    const motion = await stop();
    await page.screenshot({ path: path.join(out, 'replay-motion.png') });
    const motionReplays = replaysOf(motion);
    check('the key edit and the move both replayed in the animation view', motionReplays.length === 2 && motionReplays.every(replay => replay.frames[0].kind === 'preview'), motionReplays.map(r => ({ frames: r.frames.length, kind: r.frames[0].kind, counts: r.frames[0].counts, span: r.frames[0].span })));
    const [keyed, lowered] = motionReplays;
    check('animation key: the new key pops onto the timeline', keyed.frames.some(row => row.keys >= 1) && motion.at(-1).keys === 0, { during: Math.max(...keyed.frames.map(row => row.keys)), after: motion.at(-1).keys });
    check('animation key: the moving bone is lit', keyed.frames[0].counts.bones >= 1, keyed.frames[0].counts);
    const played = keyed.frames.map(row => row.frame).filter(frame => frame != null);
    check('animation key: the changed span plays once, forward', keyed.frames[0].span && played.length > 5 && played.at(-1) > played[0] && played.every((frame, index) => !index || frame >= played[index - 1]) && played[0] >= facts.motion.start && played.at(-1) <= facts.motion.end, { span: keyed.frames[0].span, first: played[0], last: played.at(-1) });
    const posed = lowered.frames.filter(row => row.shown).map(row => row.shown), settledPose = motion.at(-1).shown;
    check('animation view: the mesh glides to its new place', posed.length > 5 && distance(posed[0], settledPose) > 4 && posed.filter(point => distance(point, posed[0]) > .5 && distance(point, settledPose) > .5).length >= 3, { first: posed[0], settledPose, frames: posed.length });
    check('animation view: nothing is left on screen afterwards', motion.at(-1).overlay === false);

    // Steps faster than replays: the AI never waits, and the older replay is dropped.
    // Two edits sent back to back over the app's own local link (no AI in between).
    const link = (await page.evaluate(async () => { await window.desktop.aiEnable(true); return window.desktop.aiConfig(); })).mcpServers.mdlxl;
    let callId = 0;
    const call = async (name, args) => (await (await fetch(link.url, { method: 'POST', headers: { ...link.headers, 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++callId, method: 'tools/call', params: { name, arguments: args } }) })).json()).result;
    const linkTarget = JSON.parse((await call('mdlxl_context', {})).content[0].text).target;
    const nudge = async by => {
      const from = await page.evaluate(part => window.__mdlxl.model().Geosets[part].Vertices[2], G), started = Date.now();
      const result = await call('mdlxl_patch', { target: linkTarget, label: 'AI nudge', scope: ['/Geosets/' + G + '/Vertices'], operations: [{ op: 'set', path: '/Geosets/' + G + '/Vertices/2', value: from + by }] });
      return { ms: Date.now() - started, error: result.isError ? result.content?.[0]?.text : undefined };
    };
    const twice = async () => { const first = await nudge(6); return [first, await nudge(6)]; };
    await record();
    const linkedOn = await twice();
    await wait(1300);
    const fast = await stop(), fastReplays = replaysOf(fast);
    check('both linked edits applied', linkedOn.every(item => !item.error), linkedOn);
    check('a newer step replaces the replay still running', fastReplays.length === 2 && fastReplays[0].frames.at(-1).p < .9 && fastReplays[1].frames.at(-1).p > .9, { calls: linkedOn, replays: fastReplays.map(r => ({ frames: r.frames.length, lastP: r.frames.at(-1).p })) });

    // Switch off: the edit lands at once, nothing replays.
    await watchSwitch.click();
    await until(page, () => document.querySelector('[aria-label="View AI work"]')?.getAttribute('aria-checked'), v => v === 'false');
    await record();
    await send('off: lower the part');
    await wait(900);
    const off = await stop();
    // The same two edits return as fast with the switch on as with it off, and well inside one replay.
    const linkedOff = await twice();
    await page.evaluate(() => window.desktop.aiEnable(false));
    const slowest = list => Math.max(...list.map(item => item.ms));
    check('the AI never waits for a replay (an edit returns as fast as with the switch off)', linkedOff.every(item => !item.error) && slowest(linkedOn) < slowest(linkedOff) + 200 && slowest(linkedOn) < 450, { linkedOn, linkedOff });
    check('switch off: no replay, marker or glow', off.every(row => !row.id && !row.overlay), off.filter(row => row.id || row.overlay).length);
    const pageErrors = launched.errors.filter(message => !/ResizeObserver/.test(message));
    check('no page errors', pageErrors.length === 0, pageErrors);
    void viewBox;
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
