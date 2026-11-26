// AI console notes outside the vertex editor, with real mouse drags in the packaged
// app: the UV Wrapper map (Marker, Arrow) and Movement (acted-out Arrow that plays
// the animation while held, Hold, Hit, Eraser). Checks what the AI receives.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const { launchApp, closeApp, settle } = require('./helpers/app.cjs');
const { fixturePath } = require('./helpers/fixtures.cjs');

(async () => {
  const out = path.resolve(process.env.MDLXL_AI_NOTES_OUT || 'out/ai-notes');
  fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
  const checks = [], errors = [];
  const ok = (label, value, detail) => { assert.ok(value, detail === undefined ? label : label + ' ' + JSON.stringify(detail)); checks.push(label); console.log('PASS ' + label); };
  const server = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"data":[{"id":"fixture-model"}]}'); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { app, page } = await launchApp({ fixture: fixturePath('footman'), out, errors, bounds: { x: 0, y: 0, width: 1440, height: 1000 },
    args: ['--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-gpu-vsync', '--disable-frame-rate-limit'],
    settings: { preferences: { graphics: { pauseWhenHidden: false } } } });
  try {
    const shot = name => page.screenshot({ path: path.join(out, name + '.png') });
    const tool = name => page.getByRole('group', { name: 'Drawing tools', exact: true }).getByRole('button', { name, exact: true });
    const toolNames = () => page.getByRole('group', { name: 'Drawing tools', exact: true }).getByRole('button').evaluateAll(list => list.map(b => b.getAttribute('aria-label')).filter(name => !/^Color/.test(name)));
    const notes = () => page.evaluate(() => findFiberProps('.ai-assistant', p => p?.bridge?.annotations)?.bridge.annotations() || null);
    const drag = async (from, to, { steps = 16, pause = 0, curve = 0 } = {}) => {
      await page.mouse.move(from[0], from[1]); await page.mouse.down();
      for (let i = 1; i <= steps; i++) {
        const t = i / steps; await page.mouse.move(from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t + Math.sin(t * Math.PI) * curve);
        if (pause) await page.waitForTimeout(pause);
      }
      await page.mouse.up(); await settle(page, 150);
    };

    await page.getByLabel('Select geoset 0', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'AI assistant', exact: true }).click();
    await page.waitForSelector('.ai-assistant'); await settle(page, 300);
    if (!(await page.getByLabel('AI provider', { exact: true }).isVisible())) await page.getByRole('button', { name: 'Connection settings', exact: true }).click();
    await page.getByLabel('AI provider', { exact: true }).selectOption('compatible');
    await page.getByLabel('API key', { exact: true }).fill('fixture-test-secret');
    await page.getByLabel('API base URL', { exact: true }).fill(`http://127.0.0.1:${server.address().port}/v1`);
    await page.getByLabel('Model', { exact: true }).fill('fixture-model');
    await page.getByRole('button', { name: 'Save connection', exact: true }).click();
    await page.getByRole('button', { name: 'Connection settings', exact: true }).click();
    await page.getByRole('button', { name: 'Dismiss', exact: true }).click().catch(() => {});
    ok('the vertex editor keeps Marker, Pen and Eraser', JSON.stringify(await toolNames()) === JSON.stringify(['Marker', 'Pen', 'Eraser']), await toolNames());

    // UV Wrapper: Marker and Arrow on the map.
    await page.locator('[data-hotkey="geosetsClear"]').click();
    await page.getByLabel('Select geoset 0', { exact: true }).check();
    await page.getByLabel('3D model viewport', { exact: true }).click();
    await page.keyboard.press('Control+a');
    await page.locator('[data-hotkey="uv"]').click();
    const map = page.locator('.uv-tab-window .uv-editor canvas'); await map.waitFor(); await settle(page, 400);
    ok('the UV Wrapper offers Marker, Pen, Arrow and Eraser', JSON.stringify(await toolNames()) === JSON.stringify(['Marker', 'Pen', 'Arrow', 'Eraser']), await toolNames());
    const uvPoints = await page.evaluate(() => {
      const p = findFiberProps('.uv-editor', props => props?.geoset && props?.onSelectVertices), s = findFiberState('.uv-editor', state => state?.uv && state?.draw, { last: true });
      return { uv: Array.from(s.uv), eligible: Array.from(p.eligibleVertices) };
    });
    // Aim at a real UV point: the middle eligible one, found on the drawn map through its pixels.
    const box = await map.boundingBox();
    const before = await map.screenshot();
    await tool('Marker').click();
    await drag([box.x + box.width * 0.3, box.y + box.height * 0.5], [box.x + box.width * 0.7, box.y + box.height * 0.5], { curve: -40 });
    await drag([box.x + box.width * 0.3, box.y + box.height * 0.35], [box.x + box.width * 0.7, box.y + box.height * 0.65], { curve: 30 });
    let annotations = await notes();
    ok('two marker drags on the map are two UV notes', annotations?.strokes.filter(s => s.place === 'uv map').length === 2, annotations);
    ok('the map shows the notes', !(await map.screenshot()).equals(before));
    const marked = annotations.strokes.flatMap(s => Object.values(s.markedUVPoints || {}).flat());
    ok('the marker names UV points by geoset and vertex', uvPoints.eligible.length > 0 && marked.length > 0, { marked: marked.length, eligible: uvPoints.eligible.length });
    await tool('Arrow').click();
    await drag([box.x + box.width * 0.45, box.y + box.height * 0.45], [box.x + box.width * 0.6, box.y + box.height * 0.3]);
    annotations = await notes();
    const uvArrow = annotations.strokes.find(s => s.place === 'uv map' && s.tool === 'arrow');
    ok('a UV arrow says which piece to move', !!uvArrow && 'pieceUnderTail' in uvArrow, uvArrow);
    await shot('1-uv-notes');
    await page.getByRole('button', { name: 'Close UV Wrapper', exact: true }).click(); await settle(page, 300);

    // Movement: the acted-out Arrow plays the animation while held.
    await page.locator('[data-hotkey="animation"]').click(); await settle(page, 300);
    const sequences = await page.getByLabel('Movement current sequence').evaluate(select => [...select.options].map(o => [o.value, o.textContent]));
    const attack = sequences.find(([, name]) => /attack/i.test(name)) || sequences.find(([value]) => Number(value) >= 0);
    await page.getByLabel('Movement current sequence').selectOption(attack[0]); await settle(page, 300);
    const frameField = page.getByLabel('Current animation frame'), startFrame = Number(await frameField.inputValue());
    ok('Movement offers Marker, Pen, Arrow, Hold, Hit and Eraser', JSON.stringify(await toolNames()) === JSON.stringify(['Marker', 'Pen', 'Arrow', 'Hold', 'Hit', 'Eraser']), await toolNames());
    const view = await page.locator('[data-clean-model-canvas]').boundingBox(), cx = view.x + view.width / 2, cy = view.y + view.height / 2;
    const selectedNodes = () => page.evaluate(() => findFiberProps('.ai-assistant', p => p?.bridge?.annotations).bridge.summary().nodes);
    const nodesBefore = await selectedNodes();
    await tool('Arrow').click();
    await page.mouse.move(cx, cy - 40); await page.mouse.down();
    const seen = [];
    for (let i = 1; i <= 10; i++) { await page.mouse.move(cx + i * 8, cy - 40 - i * 6); await page.waitForTimeout(110); seen.push(Number(await frameField.inputValue())); }
    await page.mouse.up(); await settle(page, 300);
    ok('the animation runs while the Arrow is held', Math.max(...seen) > startFrame + 200, { startFrame, seen });
    ok('the playhead returns to where the Arrow started', Number(await frameField.inputValue()) === startFrame, { now: await frameField.inputValue(), startFrame });
    await tool('Hold').click(); await page.mouse.click(cx - 20, cy + 60); await settle(page, 150);
    await tool('Hit').click(); await page.mouse.click(cx + 40, cy - 80); await settle(page, 150);
    ok('placing notes never selects parts or emitters', (await selectedNodes()) === nodesBefore, { before: nodesBefore, after: await selectedNodes() });
    annotations = await notes();
    const motion =annotations.strokes.filter(s => s.place === 'animation');
    const acted = motion.find(s => s.tool === 'arrow');
    ok('the Arrow note keeps its frames and pace', acted && acted.frame === startFrame && acted.endFrame > startFrame + 200 && acted.points.every(point => point.length === 4) && acted.speedProfile?.length === 5, acted);
    ok('Hold and Hit keep their animation and frame', ['hold', 'hit'].every(kind => motion.some(s => s.tool === kind && s.frame === startFrame && !!s.animation)), motion);
    ok('the AI is told what each note means', /acted-out motion/.test(annotations.about) && /UV Wrapper/.test(annotations.about));
    ok('Movement draws its three notes', (await page.evaluate(() => document.querySelector('[data-sketch-overlay]')?.dataset.notes)) === '3');
    await shot('2-movement-notes');
    // Another frame: the notes stay, faint.
    await frameField.fill(String(startFrame + 600)); await frameField.press('Enter'); await settle(page, 300);
    ok('notes stay over the animation at other frames', (await page.evaluate(() => document.querySelector('[data-sketch-overlay]')?.dataset.notes)) === '3');
    await frameField.fill(String(startFrame)); await frameField.press('Enter'); await settle(page, 300);
    // The Eraser takes notes off the animation only.
    await tool('Eraser').click();
    await drag([cx - 120, cy + 60], [cx + 120, cy + 60], { steps: 30 });
    annotations = await notes();
    ok('the Eraser removes the Hold note and keeps the UV notes', !annotations.strokes.some(s => s.tool === 'hold') && annotations.strokes.filter(s => s.place === 'uv map').length === 3, annotations.strokes.map(s => [s.place, s.tool]));
    await page.keyboard.press('Escape'); await settle(page, 150);
    ok('Escape stops drawing', (await tool('Eraser').getAttribute('aria-pressed')) === 'false');
    ok('no page errors', !errors.length, errors);
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ passed: true, checks }, null, 2));
    console.log(`PASS ai-notes: ${checks.length} checks`);
  } catch (error) {
    await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {});
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ passed: false, checks, error: error.stack }, null, 2));
    throw error;
  } finally {
    await closeApp(app); server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
