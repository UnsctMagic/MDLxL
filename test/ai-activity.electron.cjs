// Run on scripts/hidden-run.ps1: real packaged UI, MCP bridge and sandbox.
// All fixtures/profiles are disposable; no provider account or AI request is used.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'D:/Claude/tools/node_modules/playwright-core');
const out = path.resolve(process.env.MDLXL_AI_TEST_OUT || 'out/ai-activity');
let app, page, link;
const checks = [], errors = [];
function check(name, value, detail) {
  checks.push({ name, passed: !!value, ...(detail === undefined ? {} : { detail }) });
  console.log((value ? 'PASS ' : 'FAIL ') + name);
  assert.ok(value, name + (detail === undefined ? '' : ': ' + JSON.stringify(detail)));
}
async function tool(name, args = {}) {
  const response = await fetch(link.url, { method: 'POST', headers: { ...link.headers, 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: crypto.randomUUID(), method: 'tools/call', params: { name, arguments: args } }) });
  const reply = await response.json();
  if (reply.error) throw Error(reply.error.message);
  if (reply.result.isError) throw Error(reply.result.content[0].text);
  return JSON.parse(reply.result.content[0].text.split('\nMDLxL continuous awareness')[0]);
}
const delayCode = 'await new Promise(resolve => setTimeout(resolve, 1200));';
const moveCode = 'model.Geosets[0].Vertices[0] += 8; model.Geosets[0].Vertices[6] += 8; return "moved";';
const argsFor = target => ({ target, edit: true, label: 'Activity fixture move', scope: ['/Geosets/0/Vertices'], code: moveCode });
async function context() { return tool('mdlxl_context'); }
async function marks(color) {
  await page.waitForFunction(color => document.querySelector('[data-ai-activity]')?._marks?.some(m => m.color === color), color);
  return page.evaluate(() => document.querySelector('[data-ai-activity]')._marks);
}
async function absent() { await page.waitForFunction(() => !document.querySelector('[data-ai-activity]')); }
async function snapshot() {
  return page.evaluate(() => {
    const { doc, selection } = activityBridge.state();
    return { vertices: Array.from(doc.model.Geosets[0].Vertices), undo: doc.historyStats.undoSteps, redo: doc.historyStats.redoSteps, selection, revision: doc.revision };
  });
}
async function toggle(value) {
  if (!await page.getByLabel('AI activity preview', { exact: true }).isVisible())
    await page.getByRole('button', { name: 'Connection settings', exact: true }).click();
  await page.getByLabel('AI activity preview', { exact: true }).setChecked(value);
}
(async () => {
  fs.mkdirSync(path.join(out, 'temp'), { recursive: true });
  const { createStarterDocument } = await import('../src/starter-model.js');
  const doc = createStarterDocument();
  doc.apply('Two cubes', ['Geosets'], model => {
    const other = structuredClone(model.Geosets[0]); other.Vertices.forEach((v, i, a) => { if (i % 3 === 0) a[i] += 130; });
    model.Geosets.push(other);
  });
  const large = createStarterDocument();
  large.apply('Large fixture', ['Geosets'], model => {
    const g=model.Geosets[0], original=structuredClone(g), copies=2048, count=copies*8;
    g.Vertices=new Float32Array(count*3); g.Normals=new Float32Array(count*3);
    g.TVertices=[new Float32Array(count*2)]; g.VertexGroup=new Uint8Array(count);g.Faces=new Uint16Array(copies*original.Faces.length);
    for(let c=0;c<copies;c++){
      const x=(c%64)*70,y=Math.floor(c/64)*70;
      for(let v=0;v<24;v++)g.Vertices[c*24+v]=original.Vertices[v]+(v%3===0?x:v%3===1?y:0);
      g.Normals.set(original.Normals,c*24);g.TVertices[0].set(original.TVertices[0],c*16);
      for(let i=0;i<original.Faces.length;i++)g.Faces[c*original.Faces.length+i]=original.Faces[i]+c*8;
    }
  });
  fs.writeFileSync(path.join(out,'Activity large.mdx'),large.serialize('mdx'));
  for (const name of ['Activity A.mdx', 'Activity B.mdx']) fs.writeFileSync(path.join(out, name), doc.serialize('mdx'));
  app = await _electron.launch({ executablePath: process.env.MDLXL_AI_TEST_EXE || path.resolve('out/pkg/MDLxL-win32-x64/MDLxL.exe'),
    args: ['--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-gpu-vsync', '--disable-frame-rate-limit', path.join(out, 'Activity A.mdx')],
    env: { ...process.env, MDLXL_PROFILE: path.join(out, 'profile-' + Date.now()), MDLXL_DISABLE_UPDATES: '1', TEMP: path.join(out, 'temp'), TMP: path.join(out, 'temp') }, timeout: 60000 });
  page = await app.firstWindow(); page.setDefaultTimeout(15000); page.on('pageerror', e => errors.push(e.message));
  await page.waitForSelector('.classic-toolbar', { timeout: 60000 });
  await app.evaluate(({ BrowserWindow, ipcMain }) => {
    const win = BrowserWindow.getAllWindows()[0]; win.webContents.setBackgroundThrottling(false); win.unmaximize(); win.setContentSize(1440, 900);
    global.activityWindow = win.id;
    global.activityTraffic = {};
    for (const channel of ['ai:script', 'ai:capture', 'ai:send']) {
      const handler = ipcMain._invokeHandlers.get(channel); if (!handler) continue;
      ipcMain.removeHandler(channel); ipcMain.handle(channel, (...args) => {
        global.activityTraffic[channel] = (global.activityTraffic[channel] || 0) + 1;
        if (channel === 'ai:script') global.activityRequestId = args[1].requestId;
        return handler(...args);
      });
    }
    ipcMain.on('ai:contextChanged', () => { global.activityTraffic.awareness = (global.activityTraffic.awareness || 0) + 1; });
  });
  link = (await page.evaluate(async () => { await window.desktop.aiOffload(false); await window.desktop.aiEnable(true); return window.desktop.aiConfig(); })).mcpServers.mdlxl;
  await page.getByRole('tab', { name: 'Activity A.mdx', exact: true }).waitFor();
  await page.locator('input[type=file][accept=".mdl,.mdx,.mdlxlpaint"]').setInputFiles(path.join(out, 'Activity B.mdx'));
  await page.getByRole('tab', { name: 'Activity B.mdx', exact: true }).waitFor();
  await page.getByRole('button', { name: 'AI assistant', exact: true }).click();
  await page.getByRole('tab', { name: 'Activity A.mdx', exact: true }).click();
  await page.evaluate(() => {
    const el = document.querySelector('.ai-assistant');
    for (let fiber = el[Object.keys(el).find(k => k.startsWith('__reactFiber'))]; fiber; fiber = fiber.return)
      if (fiber.memoizedProps?.bridge) { window.activityBridge = fiber.memoizedProps.bridge; break; }
    if (!activityBridge) throw Error('Missing real bridge');
    window.activityProbe = () => {
      const el = document.querySelector('.viewport'); let runtime, props;
      for (let fiber = el?.[Object.keys(el).find(k => k.startsWith('__reactFiber'))]; fiber; fiber = fiber.return)
        for (let hook = fiber.memoizedState; hook; hook = hook.next) {
          const ref = hook.memoizedState?.current;
          if (ref?.renderer && ref?.entries) runtime = ref;
          if (ref?.aiActivityDocument && ref?.model) props = ref;
        }
      return { runtime, props };
    };
    // Observe real canvas drawing without replacing the renderer or its lifecycle.
    const proto = CanvasRenderingContext2D.prototype, transform = proto.setTransform, arc = proto.arc, rect = proto.strokeRect;
    proto.setTransform = function (...args) { if (this.canvas.hasAttribute('data-ai-activity')) { this.canvas._marks = []; this.canvas._rects = []; } return transform.apply(this, args); };
    proto.arc = function (x, y, radius, ...rest) { if (this.canvas.hasAttribute('data-ai-activity')) this.canvas._marks.push({ x, y, radius, color: this.strokeStyle }); return arc.call(this, x, y, radius, ...rest); };
    proto.strokeRect = function (...args) { if (this.canvas.hasAttribute('data-ai-activity')) this.canvas._rects.push({ args, color: this.strokeStyle }); return rect.apply(this, args); };
  });
  await page.waitForFunction(() => activityProbe().runtime?.entries.length === 2);
  let ctx = await context();
  await tool('mdlxl_select', { target: ctx.target, vertices: { 0: [0, 1, 2] }, geosetIds: [0, 1], activeGeoset: 0 });
  ctx = await context();
  const initial = await snapshot();
  if (!await page.getByLabel('AI activity preview', { exact: true }).isVisible()) await page.getByRole('button', { name: 'Connection settings', exact: true }).click();
  check('session starts with preview off', !await page.getByLabel('AI activity preview', { exact: true }).isChecked());
  const beforeToggle = await app.evaluate(() => ({ ...global.activityTraffic }));
  await toggle(true);
  await page.waitForTimeout(450);
  check('toggle sends no AI IPC traffic', JSON.stringify(beforeToggle) === JSON.stringify(await app.evaluate(() => global.activityTraffic)));
  const pending = tool('mdlxl_script', { ...argsFor(ctx.target), code: delayCode + moveCode });
  const targetMarks = await marks('#e6bd68');
  check('real executing script pulses the three known selected vertices', targetMarks.length === 3, targetMarks);
  await page.screenshot({ path: path.join(out, 'target-pulse.png') });
  const result = await pending;
  check('normal bridge commits successfully with review still pending', result.applied && result.review?.phase === 'pending', result.review);
  const appliedMarks = await marks('#70dbed');
  check('only two genuinely moved vertices are highlighted', appliedMarks.length === 2, appliedMarks);
  const positionsMatch = await page.evaluate(marks => {
    const { runtime } = activityProbe(), size = runtime.renderer.domElement.getBoundingClientRect(), camera = runtime.camera;
    return [0, 2].every(id => {
      const point = runtime.center.clone().fromBufferAttribute(runtime.entries[0].geometry.attributes.position, id).project(camera);
      return marks.some(mark => Math.hypot(mark.x - (point.x + 1) * size.width / 2, mark.y - (1 - point.y) * size.height / 2) < 1);
    });
  }, appliedMarks);
  check('highlight positions match the committed viewport geometry', positionsMatch);
  await page.screenshot({ path: path.join(out, 'change-applied.png') });
  const on = await snapshot();
  check('one normal Undo step and selection preserved', on.undo === initial.undo + 1 && JSON.stringify(on.selection) === JSON.stringify(initial.selection));
  await absent();
  // Allow the final clearing render before measuring a genuinely idle interval.
  await page.waitForTimeout(150);
  // Count WebGL renders once both effects and ordinary startup work have stopped.
  await page.evaluate(() => {
    const runtime = activityProbe().runtime, render = runtime.renderer.render.bind(runtime.renderer); window.idleRenders = 0;
    runtime.renderer.render = (...args) => { window.idleRenders++; return render(...args); };
  });
  await page.waitForTimeout(350);
  check('expired effects leave no viewport animation loop', await page.evaluate(() => idleRenders) === 0);
  await tool('mdlxl_command', { target: ctx.target, id: 'undo' });
  check('Undo restores original positions', JSON.stringify((await snapshot()).vertices) === JSON.stringify(initial.vertices));
  ctx = await context(); await toggle(false);
  const offResult = await tool('mdlxl_script', argsFor(ctx.target));
  const off = await snapshot();
  const payload = ({ target, revision, ...value }) => value;
  check('toggle adds no tool-result fields or model-facing content', JSON.stringify(payload(result)) === JSON.stringify(payload(offResult)));
  check('toggle on/off yields identical geometry, selection and one Undo step', offResult.applied && JSON.stringify(off.vertices) === JSON.stringify(on.vertices) && off.undo === on.undo && JSON.stringify(off.selection) === JSON.stringify(on.selection));
  await absent();
  await tool('mdlxl_command', { target: ctx.target, id: 'undo' });
  await tool('mdlxl_command', { target: ctx.target, id: 'redo' });
  check('normal Redo restores edited geometry', JSON.stringify((await snapshot()).vertices) === JSON.stringify(on.vertices));
  await toggle(true); ctx = await context();
  const patch = await tool('mdlxl_patch', { target: ctx.target, label: 'Patch vertex', scope: ['/Geosets/0/Vertices'], operations: [{ op: 'set', path: '/Geosets/0/Vertices/12', value: -24 }] });
  check('patch completion is connected to the normal bridge', patch.applied && (await marks('#70dbed')).length === 1);
  await toggle(false); check('disable removes effects immediately', await page.locator('[data-ai-activity]').count() === 0);
  await toggle(true); ctx = await context();
  const noop = await tool('mdlxl_script', { ...argsFor(ctx.target), code: 'return "no-op";' });
  check('no-op returns no applied change and no completion', !noop.applied && await page.locator('[data-ai-activity]').count() === 0);
  const read = await tool('mdlxl_script', { target: ctx.target, code: 'return model.Geosets.length;' });
  check('read-only script has no effects', read.value === 2 && await page.locator('[data-ai-activity]').count() === 0);
  let rejected = false;
  try { await tool('mdlxl_script', { ...argsFor(ctx.target), code: 'model.Geosets[0].Vertices[0] = NaN;' }); } catch { rejected = true; }
  check('rejected edit has no completion', rejected && await page.locator('[data-ai-activity]').count() === 0);
  // Inject a writer failure at the real post-commit save gate, then prove normal rollback.
  const beforeRollback = await snapshot();
  await page.evaluate(() => {
    const doc = activityBridge.state().doc, serialize = doc.serialize;
    doc.serialize = function (...args) { if (this.revision > window.rollbackRevision) throw Error('Fixture save failure'); return serialize.apply(this, args); };
    window.rollbackRevision = doc.revision; window.restoreSerialize = () => { doc.serialize = serialize; };
  });
  let rolledBack = false;
  try { await tool('mdlxl_script', argsFor(ctx.target)); } catch (e) { rolledBack = /undone/.test(e.message); }
  await page.evaluate(() => restoreSerialize());
  check('save failure rolls back without successful highlight', rolledBack && JSON.stringify((await snapshot()).vertices) === JSON.stringify(beforeRollback.vertices) && await page.locator('[data-ai-activity]').count() === 0);
  ctx = await context();
  const previousRequest = await app.evaluate(() => global.activityRequestId);
  const cancelPending = tool('mdlxl_script', { ...argsFor(ctx.target), code: delayCode + moveCode }).then(() => 'success', e => e.message);
  await marks('#e6bd68');
  await app.evaluate(async ({ BrowserWindow }, previous) => {
    for (let i = 0; i < 100 && global.activityRequestId === previous; i++) await new Promise(r => setTimeout(r, 10));
    if (global.activityRequestId === previous) throw Error('Current script did not start');
    BrowserWindow.fromId(global.activityWindow).webContents.send('ai:toolCancel', global.activityRequestId);
  }, previousRequest);
  await absent();
  check('cancellation removes target immediately', await page.locator('[data-ai-activity]').count() === 0);
  const cancelledResult = await cancelPending;
  check('cancelled script does not commit or highlight', /cancelled/.test(cancelledResult) && await page.locator('[data-ai-activity]').count() === 0, cancelledResult);
  // Slow read of the same geometry lets captures compare identical model/view state.
  ctx = await context();
  const capturePending = tool('mdlxl_script', { ...argsFor(ctx.target), code: 'await new Promise(r=>setTimeout(r,3000)); return "capture no-op";' });
  await marks('#e6bd68');
  const captureOn = await page.evaluate(() => activityBridge.host().capture());
  const uiOn = await page.evaluate(target => activityBridge.dispatch('mdlxl_ui', { target, action: 'capture' }), ctx.target);
  await toggle(false);
  const captureOff = await page.evaluate(() => activityBridge.host().capture());
  const uiOff = await page.evaluate(target => activityBridge.dispatch('mdlxl_ui', { target, action: 'capture' }), ctx.target);
  check('AI viewport capture is byte-identical with effect on/off', captureOn === captureOff);
  if (uiOn.image !== uiOff.image) {
    fs.writeFileSync(path.join(out,'ui-on.png'), Buffer.from(uiOn.image.split(',')[1], 'base64'));
    fs.writeFileSync(path.join(out,'ui-off.png'), Buffer.from(uiOff.image.split(',')[1], 'base64'));
    const diff = await page.evaluate(async images => {
      const pixels = await Promise.all(images.map(async src => { const im = new Image(); im.src=src; await im.decode(); const c=document.createElement('canvas'); c.width=im.width;c.height=im.height;const x=c.getContext('2d'); x.drawImage(im,0,0);return x.getImageData(0,0,c.width,c.height); }));
      let count=0, left=Infinity,top=Infinity,right=-1,bottom=-1;const [a,b]=pixels;
      for(let i=0;i<a.data.length;i+=4) if(a.data.slice(i,i+4).some((v,j)=>v!==b.data[i+j])) {count++;const x=i/4%a.width,y=Math.floor(i/4/a.width);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
      return {count,left,top,right,bottom};
    }, [uiOn.image,uiOff.image]);
    console.log('UI capture difference',JSON.stringify(diff));
  }
  await capturePending;
  check('AI full-editor capture is byte-identical with effect on/off', uiOn.image === uiOff.image);
  await capturePending; await toggle(true);
  ctx = await context();
  const background = tool('mdlxl_script', { ...argsFor(ctx.target), code: delayCode + moveCode });
  await marks('#e6bd68');
  await page.getByRole('tab', { name: 'Activity B.mdx', exact: true }).click();
  await absent();
  check('tab B never displays A target or completion', (await background).applied && await page.locator('[data-ai-activity]').count() === 0);
  await page.getByRole('tab', { name: 'Activity A.mdx', exact: true }).click();
  await absent();
  ctx = await context();
  const stale = tool('mdlxl_script', { ...argsFor(ctx.target), code: delayCode + moveCode }).then(() => false, () => true);
  await marks('#e6bd68');
  await page.evaluate(() => activityBridge.host().edit('Intervening edit', ['Geosets'], model => { model.Geosets[0].Vertices[3] += 1; }));
  check('later user edit invalidates running activity and stale result', await stale && await page.locator('[data-ai-activity]').count() === 0);
  // Close an unchanged target while its sandbox is working.
  await page.getByRole('tab', { name: 'Activity B.mdx', exact: true }).click();
  ctx = await context();
  await tool('mdlxl_select', { target: ctx.target, vertices: { 0: [0, 1, 2] }, geosetIds: [0, 1] });
  ctx = await context();
  const closed = tool('mdlxl_script', { ...argsFor(ctx.target), code: delayCode + moveCode }).then(() => false, e => /closed/.test(e.message));
  await marks('#e6bd68');
  await page.getByRole('button', { name: 'Close Activity B.mdx', exact: true }).click();
  check('closing the target discards its activity and result', await closed && await page.locator('[data-ai-activity]').count() === 0);
  await page.locator('input[type=file][accept=".mdl,.mdx,.mdlxlpaint"]').setInputFiles(path.join(out, 'Activity large.mdx'));
  await page.getByRole('tab', { name: 'Activity large.mdx', exact: true }).waitFor();
  await page.waitForFunction(() => activityProbe().runtime?.entries[0]?.geometry.attributes.position.count === 16384);
  ctx = await context();
  const broad = tool('mdlxl_script', { ...argsFor(ctx.target), scope: ['/Geosets'], code: delayCode + 'for(let i=0;i<model.Geosets[0].Vertices.length;i+=3)model.Geosets[0].Vertices[i]+=1;' });
  await page.waitForFunction(() => document.querySelector('[data-ai-activity]')?._rects?.some(r => r.color === '#e6bd68'));
  check('broad scope uses one coarse region with no invented vertex sequence', await page.evaluate(() => {const c=document.querySelector('[data-ai-activity]');return c._rects.length===1&&c._marks.length===0;}));
  const cameraBefore = await page.evaluate(() => activityProbe().runtime.camera.quaternion.toArray());
  const view = await page.getByLabel('3D model viewport', { exact: true }).boundingBox();
  const start=Date.now();
  await page.keyboard.down('Alt'); await page.mouse.move(view.x+view.width*.6,view.y+view.height*.5); await page.mouse.down();
  await page.mouse.move(view.x+view.width*.6+85,view.y+view.height*.5+35,{steps:8});await page.mouse.up();await page.keyboard.up('Alt');
  const cameraAfter = await page.evaluate(() => activityProbe().runtime.camera.quaternion.toArray());
  check('actual mouse rotates camera during 16384-vertex edit', cameraAfter.some((v,i)=>Math.abs(v-cameraBefore[i])>.01), {gestureMs:Date.now()-start});
  check('large edit commits', (await broad).applied);
  await page.waitForFunction(() => document.querySelector('[data-ai-activity]')?._rects?.some(r => r.color === '#70dbed'));
  check('large completion draws one coarse region and zero vertex markers', await page.evaluate(() => {const c=document.querySelector('[data-ai-activity]');return c._rects.length===1&&c._marks.length===0;}));
  await absent();
  check('no unsolicited model-facing requests or awareness', await app.evaluate(() => !(global.activityTraffic['ai:send'] || global.activityTraffic.awareness)));
  check('no renderer errors', errors.length === 0, errors);
})().catch(error => { console.error(error.stack); process.exitCode = 1; }).finally(async () => {
  if (page && process.exitCode) await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {});
  fs.writeFileSync(path.join(out, 'checks.json'), JSON.stringify({ checks, errors }, null, 2));
  if (app) await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
});
