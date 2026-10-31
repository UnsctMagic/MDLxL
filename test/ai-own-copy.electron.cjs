// Packaged acceptance: the AI chat works on its own copy of the model.
// A scripted local provider (the "Other AI / local model" connection) holds each
// job open while the harness does what the owner does: tick geosets, edit a part,
// peek and look around. Run hidden (scripts/run-packaged-tests.mjs or
// scripts/hidden-run.ps1); never on the owner's desktop.
const fs = require('node:fs'),
  path = require('node:path'),
  http = require('node:http');
const { launchApp, closeApp, settle } = require('./helpers/app.cjs');
const out = path.resolve(process.env.MDLXL_AI_TEST_OUT || 'out/ai-own-copy');
const checks = [];
// A failed check is recorded, not thrown, so the later steps still report.
const check = (name, value, detail) => {
  checks.push({ name, passed: !!value, ...(value ? {} : { detail }) });
  console.log((value ? 'PASS ' : 'FAIL ') + name + (value || detail === undefined ? '' : ' ' + JSON.stringify(detail).slice(0, 300)));
};
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const until = async (condition, ms = 60000) => {
  for (const start = Date.now(); Date.now() - start < ms; await wait(100)) if (await condition()) return true;
  return false;
};
let app, server;
const hold = { A: true, B: true, C: true },
  turns = { A: 0, B: 0, C: 0 },
  pictures = { C: [] };
(async () => {
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(path.join(out, 'temp'), { recursive: true });
  const { createStarterDocument } = await import('../src/starter-model.js');
  // Two parts: geoset 0 and a copy of it off to the side as geoset 1.
  const doc = createStarterDocument();
  doc.apply('Second part', ['Geosets'], model => {
    const copy = structuredClone(model.Geosets[0]);
    for (let i = 0; i < copy.Vertices.length; i += 3) copy.Vertices[i] += 200;
    model.Geosets.push(copy);
  });
  const fixture = path.join(out, 'OwnCopy.mdx');
  fs.writeFileSync(fixture, doc.serialize('mdx'));
  const height = doc.model.Geosets[0].Vertices[2];

  server = http.createServer(async (req, res) => {
    let body = '';
    for await (const part of req) body += part;
    if (req.url.endsWith('/models')) return res.end(JSON.stringify({ data: [{ id: 'fixture-model' }] }));
    const data = JSON.parse(body);
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    const answer = delta => res.end('data: ' + JSON.stringify({ choices: [{ delta, finish_reason: delta.tool_calls ? 'tool_calls' : 'stop' }], usage: { prompt_tokens: 100, completion_tokens: 20 } }) + '\n\n');
    if (JSON.stringify(data.messages[0].content).includes('independent reviewer'))
      return answer({ content: '{"verdict":"good","confidence":0.9,"problems":[],"strengths":["part raised"]}' });
    // The job is named in its latest prompt; a bird's chat also holds earlier jobs.
    const prompt = [...data.messages].reverse().find(m => m.role === 'user' && /Job [ABC]:/.test(JSON.stringify(m.content)));
    const job = prompt && JSON.stringify(prompt.content).match(/Job ([ABC]):/)[1];
    if (!job) return answer({ content: 'Done.' });
    const n = ++turns[job],
      // The latest prompt's target: the bird's chat still holds the earlier jobs' ones.
      target = [...JSON.stringify(data.messages).matchAll(/\\"target\\":\\"([0-9a-f-]{36})/g)].at(-1)?.[1];
    const call = (name, args) => answer({ tool_calls: [{ index: 0, id: job + n + '-' + Date.now(), function: { name, arguments: JSON.stringify(args) } }] });
    const held = async () => { while (hold[job]) await wait(50); };
    if (job === 'C') {
      // Two pictures before Peek (to tell renderer noise apart), one after the
      // owner peeked and looked around.
      const found = body.match(/data:image\/png;base64,[A-Za-z0-9+/=]+/g) || [];
      if (n > 1 && found.length) pictures.C[n - 2] = found.at(-1);
      if (n === 1 || n === 2) return call('mdlxl_capture', { target });
      if (n === 3) { await held(); return call('mdlxl_capture', { target }); }
      return answer({ content: 'Finished Job C.' });
    }
    if (n === 1)
      return call('mdlxl_plan', { checks: ['Part 0 rises two units'], cause: 'Part 0 sits two units too low.', reach: 'Only geoset 0.', keep: ['geoset 1'], options: [{ fix: 'Raise geoset 0', cost: 'Moves that part only' }, { fix: 'Raise the whole model', cost: 'Moves everything' }], choice: 0, why: 'Only the requested part moves.' });
    if (n === 2) {
      await held();
      return call('mdlxl_script', { target, edit: true, label: 'Raise part 0', scope: ['/Geosets/0'], code: 'for (let i = 2; i < model.Geosets[0].Vertices.length; i += 3) model.Geosets[0].Vertices[i] += 2; return "raised";' });
    }
    if (n === 3) return call('mdlxl_review', { target, action: 'inspect', checksCode: `return [{ name: 'Part 0 raised', passed: Math.abs(model.Geosets[0].Vertices[2] - (${height + (job === 'A' ? 2 : 4)})) < 0.0001 }];` });
    if (n === 4) return call('mdlxl_review', { target, action: 'finish', outcome: 'passed', summary: 'Part 0 raised two units; pictures checked.' });
    return answer({ content: 'Finished Job ' + job + '.' });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const launched = await launchApp({ pageTimeout: 30000, fixture, out, env: { MDLVIS_HEADLESS: '', MDLXL_DISABLE_UPDATES: '1', TEMP: path.join(out, 'temp'), TMP: path.join(out, 'temp') } });
  app = launched.app;
  const { page, errors } = launched;
  await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows()[0];
    w.unmaximize();
    w.setContentSize(1440, 900);
  });
  await page.waitForSelector('.classic-toolbar', { timeout: 60000 });
  await settle(page, 1000);
  await page.getByRole('button', { name: 'AI assistant', exact: true }).click();
  if (!(await page.getByLabel('AI provider', { exact: true }).isVisible())) await page.getByRole('button', { name: 'Connection settings', exact: true }).click();
  await page.getByLabel('AI provider', { exact: true }).selectOption('compatible');
  await page.getByLabel('API base URL', { exact: true }).fill(`http://127.0.0.1:${server.address().port}/v1`);
  await page.getByLabel('Model', { exact: true }).fill('fixture-model');
  await page.getByRole('button', { name: 'Save connection', exact: true }).click();
  await page.getByRole('button', { name: 'Connection settings', exact: true }).click();
  await page.getByRole('button', { name: 'Dismiss', exact: true }).click().catch(() => {});
  const input = page.locator('.ai-composer textarea');
  const model = () => page.evaluate(() => { const m = window.__mdlxl.model(); return { z: m.Geosets[0].Vertices[2], normals: [Array.from(m.Geosets[0].Normals.slice(0, 3)), Array.from(m.Geosets[1].Normals.slice(0, 3))], geosets: m.Geosets.length }; });
  const history = () => page.evaluate(() => window.__mdlxl.document().historyStats);
  const send = async text => { await input.fill(text); await input.press('Control+Enter'); };
  // What the owner does by hand: choose the checked geosets, select all, reverse normals.
  const reverseNormals = async geoset => {
    await page.locator('[data-hotkey="geosetsClear"]').click();
    await page.locator('[data-hotkey="geosetsAll"]').click();
    await page.locator('[data-hotkey="geosetsClear"]').click();
    await page.getByLabel('Select geoset ' + geoset, { exact: true }).check();
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Shift+n');
    await settle(page, 300);
  };
  // A real mouse drag on a preview; the picture changes when the camera turns.
  const dragTurns = async canvas => {
    const box = await canvas.boundingBox(), before = await canvas.screenshot();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 30, { steps: 12 });
    await page.mouse.up();
    await settle(page, 300);
    return !before.equals(await canvas.screenshot());
  };

  // Job A: geoset clicks and an edit on the other part while the AI works -> merged.
  const start = await model();
  await send('Job A: raise the first part two units.');
  check('job A is working on its own copy', await until(() => turns.A >= 2));
  check('Peek is offered while the AI works', await page.locator('.ai-peek').isVisible());
  await reverseNormals(1);
  const mine = await model(), stepsBefore = (await history()).undoSteps;
  check('the owner edit on part 1 went into the model', mine.normals[1][1] !== start.normals[1][1], { start, mine });
  hold.A = false;
  check('job A finished', await until(() => turns.A >= 5, 90000));
  check("the AI's change was put into the model by itself", await until(async () => Math.abs((await model()).z - (height + 2)) < 1e-4), await model());
  const merged = await model();
  check("the owner's own edit stayed", merged.normals[1][1] === mine.normals[1][1], merged);
  const stats = await history();
  check('the AI job is one Undo step', stats.undoSteps === stepsBefore + 1 && stats.undoLabel.startsWith('AI: '), stats);
  check('no question when the parts differ', (await page.locator('.ai-copy-question').count()) === 0);
  check('no red error after the clicks', (await page.locator('.ai-error, .ai-message-error').count()) === 0, await page.locator('.ai-error, .ai-message-error').allInnerTexts());
  await page.screenshot({ path: path.join(out, 'merged.png') });

  // Job B: the owner edits the part the AI edits -> a friendly green question.
  await send('Job B: raise the first part two units again.');
  check('job B is working', await until(() => turns.B >= 2));
  await reverseNormals(0);
  const owner = await model();
  hold.B = false;
  const question = page.locator('.ai-copy-question');
  const asked = await until(() => question.isVisible(), 90000);
  check('a clash asks a question', asked, { turns, thread: (await page.locator('.ai-messages').innerText().catch(() => '')).slice(-1500) });
  if (!asked) await page.screenshot({ path: path.join(out, 'no-question.png') });
  const choices = await question.locator('button').allInnerTexts();
  check('the question offers the three choices', ['Save as a new file', 'Adapt to your changes', 'Compare side by side'].every(c => choices.includes(c)), choices);
  const color = await question.evaluate(el => getComputedStyle(el).color.match(/\d+/g).map(Number));
  check('the question is green, not red', color[1] > color[0], color);
  check('nothing was merged before the owner chose', Math.abs((await model()).z - owner.z) < 1e-4);
  await page.screenshot({ path: path.join(out, 'question.png') });
  await question.getByRole('button', { name: 'Compare side by side', exact: true }).click();
  const view = page.locator('.ai-copy-view');
  check('Compare shows the AI result next to your version', await until(async () => (await view.locator('.ai-copy-preview:has(canvas)').count()) === 2, 20000));
  await settle(page, 800);
  check('Compare previews turn with the mouse', await dragTurns(view.locator('.ai-copy-preview canvas').first()));
  check('Compare offers Keep AI result and Keep yours', (await view.getByRole('button', { name: 'Keep AI result', exact: true }).count()) === 1 && (await view.getByRole('button', { name: 'Keep yours', exact: true }).count()) === 1);
  await page.screenshot({ path: path.join(out, 'compare.png') });
  await view.getByRole('button', { name: 'Close', exact: true }).click();
  await question.getByRole('button', { name: 'Save as a new file', exact: true }).click();
  check('Save as a new file opens the AI result in its own tab', await until(() => page.locator('.model-tab.active [role="tab"]').innerText().then(t => t.includes('(AI)')), 20000));
  check('the new tab has the AI result', Math.abs((await model()).z - (owner.z + 2)) < 1e-4, await model());
  await page.locator('.model-tab [role="tab"]', { hasText: 'OwnCopy.mdx' }).first().click();
  await settle(page, 600);
  check("the owner's model kept the owner's version", Math.abs((await model()).z - owner.z) < 1e-4 && (await model()).normals[0][1] === owner.normals[0][1], await model());

  // Job C: Peek and look around while the AI takes pictures -> its pictures do not change.
  await send('Job C: look at the model.');
  check('job C took its first pictures', await until(() => turns.C >= 3));
  await page.locator('.ai-peek').click();
  check('Peek shows the AI copy, view only', await until(async () => (await view.locator('.ai-copy-preview:has(canvas)').count()) === 1 && (await view.locator('footer').count()) === 0, 20000));
  await settle(page, 800);
  check('Peek turns with the mouse', await dragTurns(view.locator('.ai-copy-preview canvas').first()));
  await page.screenshot({ path: path.join(out, 'peek.png') });
  hold.C = false;
  check('job C finished', await until(() => turns.C >= 4, 60000));
  check('the AI took three pictures', pictures.C.filter(Boolean).length === 3, pictures.C.length);
  check('two pictures of the same view match (no renderer noise)', pictures.C[0] === pictures.C[1]);
  check("looking around in Peek did not change the AI's pictures", !!pictures.C[2] && pictures.C[1] === pictures.C[2]);
  check('no renderer errors', !errors.length, errors);
})()
  .catch(error => {
    checks.push({ name: 'exception', passed: false, error: error.stack });
    console.log(error.stack);
  })
  .finally(async () => {
    // Held provider replies end too, or they keep this process alive.
    Object.keys(hold).forEach(job => (hold[job] = false));
    if (app) await closeApp(app);
    if (server) await new Promise(resolve => (server.closeAllConnections(), server.close(resolve)));
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(checks, null, 2));
    if (checks.some(c => !c.passed)) process.exitCode = 1;
  });
