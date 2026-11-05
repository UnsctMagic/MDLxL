const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { launchApp, closeApp, bundleHashes } = require('./helpers/app.cjs');
const { testModel } = require('./helpers/fixtures.cjs');
const { RecoveryStore } = require('../electron/recovery.cjs');

// Read-only probes surround real keyboard/mouse actions. Timed intervals below
// measure latency/idle work; readiness is always tied to an observable result.
(async () => {
  const out = path.resolve(process.env.MDLXL_PERFORMANCE_OUT || 'out/performance-plumbing');
  fs.mkdirSync(out, { recursive: true });
  const profile = path.join(out, 'profile');
  const ids = ['8657d459-6030-46e0-83bd-8eedf6d7fda9', '8c74606b-2c7c-4153-acb3-72a89c6bb3f0'];
  const fixtures = new RecoveryStore(testModel('performance-20261104'));
  const seed = new RecoveryStore(path.join(profile, 'recovery'));
  const names = [];
  for (const id of ids) {
    const envelope = await fixtures.read(id);
    names.push(envelope.state.name);
    // Model data comes only from the permanent fixture, never the old Desktop path.
    envelope.path = path.join(profile, 'test-models', envelope.state.name);
    fs.mkdirSync(path.dirname(envelope.path),{recursive:true});
    fs.writeFileSync(envelope.path,envelope.state.originalBytes);
    await seed.write(envelope);
  }
  fs.writeFileSync(path.join(profile, 'recovery', '.reset-1'), '');
  const checks = [], metrics = [], errors = [], bundle = bundleHashes();
  const check = (label, pass, detail) => { checks.push({ label, pass: !!pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'} ${label} ${JSON.stringify(detail ?? '')}`); };
  const { app, page } = await launchApp({ out, profile, errors, settings: { preferences: { checkUpdatesOnStartup: false, modelLookAnswered: true } },
    args: ['--disable-gpu-vsync', '--disable-frame-rate-limit', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'],
    env: { MDLXL_STYLED_CLOSE_PROMPT: '1' },
    bounds: { x: 0, y: 0, width: 1440, height: 1000 } });
  const current = () => page.evaluate(() => ({ id: window.__mdlxl.session().id, checkpoint: window.__mdlxl.session().checkpoint, revision: window.__mdlxl.document().revision }));
  async function settledCheckpoint() {
    const target = await current();
    const until = Date.now() + 20000;
    for (;;) {
      const meta = await seed.metadata(target.id).catch(() => null);
      const now = await current();
      if (meta && meta.version >= now.checkpoint && now.checkpoint > 0) return meta;
      if (Date.now() > until) throw Error('Recovery checkpoint did not reach disk');
      await new Promise(resolve => setTimeout(resolve, 25));
    }
  }
  const sample = ms => page.evaluate(ms => new Promise(resolve => {
    const start = performance.now(), before = window.auditLongTasks.length;
    setTimeout(() => resolve({ elapsed: performance.now() - start, tasks: window.auditLongTasks.slice(before) }), ms);
  }), ms);
  try {
    await page.locator('.classic-app').waitFor();
    for (let i = 0; i < ids.length; i++) {
      await page.keyboard.press('Alt+r');
      await page.getByRole('dialog', { name: 'Recovery', exact: true }).waitFor();
      await page.locator(`[data-hotkey="restore:${ids[i]}"]`).click();
      await page.waitForFunction(id => window.__mdlxl?.session()?.id === id, ids[i]);
      await page.keyboard.press('F5');
      await page.locator('.classic-view .game-preview-root canvas').first().waitFor();
      await settledCheckpoint();
    }
    await page.evaluate(() => {
      window.auditLongTasks = [];
      window.auditObserver = new PerformanceObserver(list => window.auditLongTasks.push(...list.getEntries().map(e => ({ start: e.startTime, duration: e.duration }))));
      window.auditObserver.observe({ type: 'longtask', buffered: false });
      window.auditAssets = new Map();
    });
    // Warm each already-open tab once before measuring repeated navigation.
    for (let i = 0; i < ids.length; i++) {
      await page.getByRole('tab', { name: names[i], exact: true }).click();
      await page.waitForFunction(id => window.__mdlxl.session().id === id, ids[i]);
      await settledCheckpoint();
      await sample(650);
      await page.evaluate(() => window.auditAssets.set(window.__mdlxl.session().id, window.__mdlxl.session().assets));
    }
    const before = await Promise.all(ids.map(id => seed.metadata(id)));
    await page.evaluate(() => { window.auditLongTasks.length = 0; });
    for (let round = 0; round < 2; round++) for (let i = 0; i < ids.length; i++) {
      const started = performance.now();
      await page.getByRole('tab', { name: names[i], exact: true }).click();
      await page.waitForFunction(id => window.__mdlxl.session().id === id, ids[i]);
      const switchMs = performance.now() - started;
      const observation = await sample(800);
      metrics.push({ round, name: names[i], switchMs, ...observation });
      check(`tab ${round}/${i}: retain unchanged texture assets`, await page.evaluate(() => window.auditAssets.get(window.__mdlxl.session().id) === window.__mdlxl.session().assets));
    }
    const after = await Promise.all(ids.map(id => seed.metadata(id)));
    check('unchanged tabs do not rewrite recovery', before.every((value, i) => value.version === after[i].version), { before: before.map(v => v.version), after: after.map(v => v.version) });
    const longTasks = await page.evaluate(() => window.auditLongTasks);
    check('tab navigation avoids recovery-sized UI freezes', Math.max(0, ...longTasks.map(x => x.duration)) < 150, longTasks);
    const idle = await sample(2500);
    metrics.push({ idle });
    check('paused idle does not run long tasks', !idle.tasks.some(x => x.duration >= 100), idle);
    const canvas = page.locator('.classic-view .game-preview-root canvas[data-clean-model-canvas]').first();
    const camera = () => page.evaluate(() => { const r = window.__mdlxl.preview()?.runtime; return r?.controls && { p: r.controls.object.position.toArray(), t: r.controls.target.toArray() }; });
    // Preserve the normal camera controls while revisiting previews.
    const box = await canvas.boundingBox(), pose = await camera();
    await page.keyboard.down('Alt');
    await page.mouse.move(box.x + box.width * .5, box.y + box.height * .5); await page.mouse.down();
    await page.mouse.move(box.x + box.width * .7, box.y + box.height * .6, { steps: 12 }); await page.mouse.up(); await page.keyboard.up('Alt');
    await page.waitForFunction(old => { const r = window.__mdlxl.preview()?.runtime; return r?.controls && JSON.stringify({ p: r.controls.object.position.toArray(), t: r.controls.target.toArray() }) !== old; }, JSON.stringify(pose));
    const rotated = await camera();
    check('normal mouse navigation changes the camera', JSON.stringify(pose) !== JSON.stringify(rotated), { pose, rotated });
    // Menu input during retained-history writes must keep working.
    const digest = async () => page.evaluate(async () => {
      const doc = window.__mdlxl.document();
      const bytes = new TextEncoder().encode(JSON.stringify(doc.model));
      return { hash: Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), v => v.toString(16).padStart(2,'0')).join(''), stats: doc.historyStats, revision: doc.revision };
    });
    const original = await digest();
    await page.keyboard.press('Control+,'); await page.getByRole('dialog', { name: 'Settings', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Close Settings', exact: true }).click();
    const actions=[];
    for (const key of ['Control+z','Control+z','Control+z','Control+y','Control+y','Control+y']) {
      const before = await page.evaluate(() => window.__mdlxl.document().historyStats.undoSteps);
      const started = performance.now(); await page.keyboard.press(key);
      await page.waitForFunction(before => window.__mdlxl.document().historyStats.undoSteps !== before, before);
      actions.push({ key, ms: performance.now()-started });
      await page.keyboard.press('Control+,'); await page.getByRole('dialog', { name: 'Settings', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Close Settings', exact: true }).click();
    }
    await settledCheckpoint();
    const final = await digest();
    check('real undo/redo restores exact model and full history', final.hash === original.hash && final.stats.undoSteps === original.stats.undoSteps && final.stats.redoSteps === original.stats.redoSteps, { original, final, actions });
    const { EditorDocument } = await import('../src/editor-document.js');
    const restored = EditorDocument.restoreRecoveryState((await seed.read(ids[1])).state);
    const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
    check('autosave restores the complete edited model and history', hash(restored.model) === final.hash && restored.historyStats.undoSteps === final.stats.undoSteps, restored.historyStats);
    // Force GC only when measuring retained objects, never during latency samples.
    const cdp = await page.context().newCDPSession(page);
    const resources = async () => { await cdp.send('HeapProfiler.collectGarbage'); return { ...(await cdp.send('Memory.getDOMCounters')), ...(await cdp.send('Runtime.getHeapUsage')) }; };
    const retainedBefore = await resources(), soak=[];
    for (let batch=0;batch<3;batch++) {
      for(let round=0;round<10;round++) for(let i=0;i<ids.length;i++) {
        await page.getByRole('tab',{name:names[i],exact:true}).click();
        await page.waitForFunction(id=>window.__mdlxl.session().id===id,ids[i]);
      }
      await settledCheckpoint();
      // Observe an idle window before GC so asynchronous native/texture cleanup finishes.
      await sample(1200); soak.push(await resources());
    }
    const retainedAfter = soak.at(-1); metrics.push({retainedBefore,retainedAfter,soak});
    check('repeated tabs release detached previews and listeners', retainedAfter.nodes < retainedBefore.nodes + 1500 && retainedAfter.jsEventListeners < retainedBefore.jsEventListeners + 150, {retainedBefore,retainedAfter});
    if (process.env.MDLXL_HEAP_SNAPSHOT) {
      const fd=fs.openSync(path.join(out,'retained.heapsnapshot'),'w');
      const chunk=({chunk})=>fs.writeSync(fd,chunk);cdp.on('HeapProfiler.addHeapSnapshotChunk',chunk);
      try { await cdp.send('HeapProfiler.takeHeapSnapshot',{reportProgress:false}); }
      finally {cdp.off('HeapProfiler.addHeapSnapshotChunk',chunk);fs.closeSync(fd);}
    }
    check('retained preview memory plateaus across repeated tab batches', soak[2].backingStorageSize < soak[0].backingStorageSize + 16*1024*1024 && soak[2].nodes < soak[0].nodes + 100, soak);
    // A loose-file replacement must still be noticed when returning to a tab.
    const textureChange = await page.evaluate(() => {
      const s=window.__mdlxl.session(), key=v=>v.replaceAll('/','\\').toLowerCase();
      const source=s.doc.model.Textures.map(t=>({name:t.Image,asset:s.assets.get(key(t.Image||''))})).find(t=>t.asset?.bytes?.length && /\.blp$/i.test(t.name) && !t.name.includes(':'));
      const other=[...window.auditAssets.values()].flatMap(m=>[...new Set(m.values())]).find(a=>a.bytes?.length && /\.blp$/i.test(a.name) && a.name!==source?.asset.name);
      if(!source||!other)throw Error('Real referenced BLP textures unavailable for replacement check.');
      window.auditOriginalTexture=source.asset;
      return {name:source.name,original:Array.from(source.asset.bytes),replacement:Array.from(other.bytes),modelPath:s.path};
    });
    const textureFile=path.resolve(path.dirname(textureChange.modelPath),textureChange.name.replace(/[\\/]/g,path.sep));
    assert.ok(textureFile.startsWith(path.join(profile,'test-models')+path.sep));
    fs.mkdirSync(path.dirname(textureFile),{recursive:true});fs.writeFileSync(textureFile,Buffer.from(textureChange.replacement));
    await page.getByRole('tab',{name:names[0],exact:true}).click();await page.getByRole('tab',{name:names[1],exact:true}).click();
    await page.waitForFunction(({name,bytes})=>{const a=window.__mdlxl.session().assets.get(name.replaceAll('/','\\').toLowerCase());return a && a!==window.auditOriginalTexture && a.bytes.length===bytes.length && a.bytes.every((v,i)=>v===bytes[i]);},{name:textureChange.name,bytes:textureChange.replacement});
    check('changed loose texture reloads on tab re-entry',true,textureChange.name);
    fs.unlinkSync(textureFile);
    await page.getByRole('tab',{name:names[0],exact:true}).click();await page.getByRole('tab',{name:names[1],exact:true}).click();
    await page.waitForFunction(({name,bytes})=>{const a=window.__mdlxl.session().assets.get(name.replaceAll('/','\\').toLowerCase());return a && a.bytes.length===bytes.length && a.bytes.every((v,i)=>v===bytes[i]);},{name:textureChange.name,bytes:textureChange.original});
    check('removed loose override returns to the original game texture',true);
    // Close immediately after a real edit, before the 350ms autosave debounce.
    if (process.env.MDLXL_CLOSE_CPU_RATE) await cdp.send('Emulation.setCPUThrottlingRate',{rate:Number(process.env.MDLXL_CLOSE_CPU_RATE)});
    const prior = await page.evaluate(() => window.__mdlxl.document().historyStats.undoSteps);
    await page.keyboard.press('Control+z');
    await page.waitForFunction(prior => window.__mdlxl.document().historyStats.undoSteps === prior-1,prior);
    const closing = await digest();
    const promptOpened = app.waitForEvent('window');
    await page.keyboard.press('Alt+F4');
    const prompt = await promptOpened;
    await prompt.getByRole('button',{name:'Close',exact:true}).waitFor();
    const exited = app.waitForEvent('close');
    await prompt.getByRole('button',{name:'Close',exact:true}).click().catch(error=>{if(!/closed/.test(error.message))throw error;});
    await exited;
    const closeState = EditorDocument.restoreRecoveryState((await seed.read(ids[1])).state);
    check('immediate close flushes the final edit and undo history', hash(closeState.model) === closing.hash && closeState.historyStats.undoSteps === closing.stats.undoSteps && closeState.historyStats.redoSteps === closing.stats.redoSteps, {expected:closing.stats,actual:closeState.historyStats});
    check('no renderer errors', !errors.length, errors);
  } finally {
    await page.evaluate(() => window.auditObserver?.disconnect()).catch(() => {});
    await closeApp(app);
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ bundle, checks, metrics, errors }, null, 2));
  }
  assert.equal(checks.filter(c => !c.pass).length, 0, 'Performance plumbing must preserve interaction without repeated snapshots or texture rebuilds');
})().catch(error => { console.error(error); process.exitCode = 1; });
