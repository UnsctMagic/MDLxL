// Disposable packaged mouse acceptance. Never opens or replaces a user profile.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const { ObjectLoader, Vector3 } = await import('three');
  const { projectPoseHandles } = await import('../app/pose-overlay.js');
  const { openDocument } = await import('../src/editor-document.js');
  const { allNodes, sampleNodeMatrices, skinGeoset } = await import('../src/animation.js');
  const { samplePreviewMatrices } = await import('../app/preview-pose.js');
  const { assertModelEquivalent } = await import('../src/save-equivalence.js');
  const root = process.cwd(), out = path.resolve(process.env.MDLXL_POSE_OUT || 'out/pose-complex-ui'), fixture = path.resolve(process.env.MDLXL_POSE_FIXTURE || 'out/pose-complex-fixtures/WH_VC_NecrarchLord3.mdx');
  const executablePath = path.resolve(process.env.MDLXL_POSE_EXE || 'out/pose-complex-package/MDLxL-win32-x64/MDLxL.exe');
  fs.mkdirSync(out, { recursive: true });

  const sourceModel = openDocument(fs.readFileSync(fixture)).model, sequence = Math.max(0, sourceModel.Sequences.findIndex(s=>/^stand(?:\s|$)/i.test(s.Name)&&!/portrait/i.test(s.Name))), frame = sourceModel.Sequences[sequence].Interval[0];
  const fixtureHash = hash(fixture), errors = [], results = { fixture, fixtureHash, executablePath, executableHash: hash(executablePath), checks: [], measurements: [] };
  const dist = path.join(path.dirname(executablePath), 'resources/app/dist'), bundle = crypto.createHash('sha256');
  for (const name of fs.readdirSync(path.join(dist, 'assets')).sort()) bundle.update(name).update(fs.readFileSync(path.join(dist, 'assets', name)));
  results.bundle = { indexHash: hash(path.join(dist, 'index.html')), assetsHash: bundle.digest('hex') };
  results.textureHashes = Object.fromEntries((fs.existsSync(path.join(out, 'Textures')) ? fs.readdirSync(path.join(out, 'Textures')) : []).map(name => [name, hash(path.join(out, 'Textures', name))]));
  const app = await _electron.launch({ executablePath, args: [fixture, '--disable-backgrounding-occluded-windows'], env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: path.join(out, 'profile-' + Date.now()) }, timeout: 60000 });
  try {
    const page = await app.firstWindow(); page.setDefaultTimeout(20000); page.on('pageerror', error => errors.push(error.message));
    await app.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows()[0]; win.webContents.setBackgroundThrottling(false); win.setBounds({ x: -3000, y: 0, width: 1280, height: 920 }); win.showInactive(); });
    await page.locator('[data-warmkey="animation"]').click(); await page.getByLabel('Movement current sequence').selectOption(String(sequence));
    const time = page.getByLabel('Current animation frame'); await time.fill(String(frame)); await time.press('Enter');
    await page.getByLabel('View direction', { exact: true }).selectOption('perspective');
    await page.evaluate(() => {
      window.poseProbe = () => {
        const root = document.querySelector('.game-preview-root'); let runtime, props, session;
        for (let fiber = root?.[Object.keys(root).find(key => key.startsWith('__reactFiber'))]; fiber; fiber = fiber.return) for (let hook = fiber.memoizedState; hook; hook = hook.next) {
          const state = hook.memoizedState, ref = state?.current;
          if (ref?.native && ref?.controls) runtime = ref;
          if (ref?.model && ref?.onPoseCommit) props = ref;
          if (state?.doc?.model && state?.assets) session = state;
        }
        if (!runtime || !props || !session) throw Error('Packaged Movement owners not ready');
        return { runtime, props, session };
      };
      // Keep signed zero: JSON snapshots erase it and falsely report native quaternion changes.
      window.posePlain = value => ArrayBuffer.isView(value) ? Array.from(value) : Array.isArray(value) ? value.map(posePlain) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key,item]) => [key,posePlain(item)])) : value;
      window.poseSnapshot = () => { const { session } = poseProbe(); return { revision: session.doc.revision, undo: session.doc._historyStore.undoEntries.filter(entry => entry.changes.length).length, dirty: session.doc.dirty, model: posePlain(session.doc.model) }; };
    });
    await page.waitForFunction(() => { try { return !!poseProbe().runtime.captureApi?.isReady; } catch { return false; } });
    const snap = () => page.evaluate(async () => {
      const {doc}=poseProbe().session;
      const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(doc.model)));
      return {revision:doc.revision,model:Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join(''),undo:doc.historyStats.undoSteps};
    });
    const settle = () => page.waitForTimeout(180);
    const tool = name => page.getByRole('group', { name: 'Movement tool', exact: true }).getByRole('button', { name, exact: true }).click();
    const shot = name => page.screenshot({ path: path.join(out, name + '.png') });
    const menu = command => command === 'undo' ? page.keyboard.press('Control+z') : command === 'redo' ? page.keyboard.press('Control+y') : app.evaluate(({ BrowserWindow }, command) => { BrowserWindow.getAllWindows()[0].webContents.send('menu', command); return true; }, command);
    const viewportBox = () => page.locator('[data-clean-model-canvas]').boundingBox();
    async function handles() {
      const data = await page.evaluate(() => { const { runtime, props } = poseProbe(), canvas = document.querySelector('[data-clean-model-canvas]'); return { config: props.poseConfig, frame: runtime.native.getFrame(), sequence: props.sequenceIndex, camera: runtime.controls.object.toJSON(), width: canvas.clientWidth, height: canvas.clientHeight }; });
      const camera = new ObjectLoader().parse(data.camera); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
      return projectPoseHandles(sourceModel, data.config, data.frame, data.sequence, camera, data.width, data.height);
    }
    async function handleFor(kind, endpoint) { const points = await handles(); const result = points.find(handle => !handle.marker && handle.kind === kind && (endpoint == null || (kind === 'node' ? handle.id : handle.chain?.end) === endpoint)); assert.ok(result?.visible, `Visible ${kind} ${endpoint}`); return result; }
    const historyDepth = () => page.evaluate(() => poseProbe().session.doc.historyStats.undoSteps);
    await page.getByLabel('Workplane',{exact:true}).uncheck();
    await page.getByRole('button',{name:'POSE',exact:true}).click();await settle();await tool('Move');
    const config=await page.evaluate(()=>poseProbe().props.poseConfig);results.mapping=config;

    async function timedDrag(kind,id){
      console.log('Measure',kind,id??'');let h=await handleFor(kind,id),box=await viewportBox();
      // Click the symbol first, using the same overlap cycle as the user.
      for(let i=0;i<20;i++){await page.mouse.click(box.x+h.x,box.y+h.y);await settle();const selected=await page.evaluate(()=>poseProbe().props.poseConfig.target);if(selected?.kind===kind&&!selected.marker&&(kind==='body'||selected.key===h.key||selected.id===id))break;}
      h=await handleFor(kind,id);const before=await snap();
      await page.mouse.move(box.x+h.x,box.y+h.y);await page.mouse.down();
      const costs=[];for(let i=1;i<=10;i++){const started=performance.now();await page.mouse.move(box.x+h.x+i*2,box.y+h.y-i);costs.push(performance.now()-started);}
      await page.mouse.up();await settle();const after=await snap();assert.ok(after.revision>before.revision,kind+' commits');assert.equal(after.undo,before.undo+1,'one drag remains one undo entry');
      assert.equal(costs.length,10,'ten real drag events measured');const ordered=costs.slice().sort((a,b)=>a-b);results.measurements.push({kind,id,metric:'mouse event round trip in milliseconds',costs,median:ordered[Math.floor(ordered.length/2)],max:ordered.at(-1)});
      await menu('undo');await settle();assert.deepEqual((await snap()).model,before.model);await menu('redo');await settle();assert.deepEqual((await snap()).model,after.model);await menu('undo');await settle();
    }
    await timedDrag('body');await timedDrag('endpoint',config.chains.find(c=>c.end===Number(process.env.MDLXL_POSE_PERF_ENDPOINT))?.end??config.chains.find(c=>c.kind==='arm'&&!c.label).end);
    const cameraBefore=await page.evaluate(()=>poseProbe().runtime.controls.object.toJSON()),box=await viewportBox();
    await page.keyboard.down('Alt');await page.mouse.move(box.x+50,box.y+50);await page.mouse.down();await page.mouse.move(box.x+100,box.y+70,{steps:5});await page.mouse.up();await page.keyboard.up('Alt');await settle();
    assert.ok(new ObjectLoader().parse(cameraBefore).quaternion.angleTo(new ObjectLoader().parse(await page.evaluate(()=>poseProbe().runtime.controls.object.toJSON())).quaternion)>.01);
    await shot('mapped-model');assert.equal(hash(fixture),fixtureHash);assert.deepEqual(errors,[]);results.errors=errors;fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results.measurements));
  } catch(error){await (await app.firstWindow()).screenshot({path:path.join(out,'failure.png')});throw error;} finally{await app.evaluate(({app})=>app.exit(0));}
})().catch(error=>{console.error(error);process.exitCode=1;});
function hash(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
