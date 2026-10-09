// Disposable packaged mouse acceptance. Never opens or replaces a user profile.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const { ObjectLoader, Vector3, Quaternion } = await import('three');
  const { projectPoseHandles } = await import('../app/pose-overlay.js');
  const { samplePoseChain, solvePoseLimb } = await import('../src/pose-ik.js');
  const { openDocument } = await import('../src/editor-document.js');
  const { allNodes, sampleNodeMatrices, skinGeoset } = await import('../src/animation.js');
  const { samplePreviewMatrices } = await import('../app/preview-pose.js');
  const { assertModelEquivalent } = await import('../src/save-equivalence.js');
  const { parseMdx } = await import('../src/mdx-container.js');
  const { projectedPlaneTranslation } = await import('../app/viewport-math.js');
  const { pointerSensitivityValue } = await import('../app/viewport-performance.js');
  const { movementAxisHandles, movementDragAmount } = await import('../app/movement-overlay.js');
  const root = process.cwd(), out = path.resolve(process.env.MDLXL_POSE_OUT || 'out/pose-ui'), fixture = path.resolve(process.env.MDLXL_POSE_FIXTURE || 'out/pose/Footman.mdx');
  const executablePath = path.resolve(process.env.MDLXL_POSE_EXE || 'out/pose-package/MDLxL-win32-x64/MDLxL.exe');
  fs.mkdirSync(out, { recursive: true });
  fs.cpSync(path.join(path.dirname(fixture), 'Textures'), path.join(out, 'Textures'), { recursive: true });
  const fixtureHash = hash(fixture), errors = [], results = { fixture, fixtureHash, executablePath, executableHash: hash(executablePath), checks: [], measurements: [] };
  const dist = path.join(path.dirname(executablePath), 'resources/app/dist'), bundle = crypto.createHash('sha256');
  for (const name of fs.readdirSync(path.join(dist, 'assets')).sort()) bundle.update(name).update(fs.readFileSync(path.join(dist, 'assets', name)));
  results.bundle = { indexHash: hash(path.join(dist, 'index.html')), assetsHash: bundle.digest('hex') };
  results.textureHashes = Object.fromEntries(fs.readdirSync(path.join(out, 'Textures')).map(name => [name, hash(path.join(out, 'Textures', name))]));
  const app = await _electron.launch({ executablePath, args: [fixture, '--disable-backgrounding-occluded-windows'], env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: path.join(out, 'profile-' + Date.now()) }, timeout: 60000 });
  try {
    const page = await app.firstWindow(); page.setDefaultTimeout(20000); page.on('pageerror', error => errors.push(error.message));
    await app.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows()[0]; win.webContents.setBackgroundThrottling(false); win.setBounds({ x: -3000, y: 0, width: 1280, height: 920 }); win.showInactive(); });
    await page.locator('[data-warmkey="animation"]').click(); await page.getByLabel('Movement current sequence').selectOption('0');
    const time = page.getByLabel('Current animation frame'); await time.fill('500'); await time.press('Enter');
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
      window.poseSnapshot = () => { const { session } = poseProbe(); return { revision: session.doc.revision, undo: session.doc._historyStore.undoEntries.filter(entry => entry.changes.length).length, dirty: session.doc.dirty, model: JSON.parse(JSON.stringify(session.doc.model, (_key, value) => ArrayBuffer.isView(value) ? Array.from(value) : value)) }; };
    });
    await page.waitForFunction(() => { try { return !!poseProbe().runtime.captureApi?.isReady; } catch { return false; } });
    const snap = () => page.evaluate(() => poseSnapshot());
    const settle = () => page.waitForTimeout(180);
    const tool = name => page.getByRole('group', { name: 'Movement tool', exact: true }).getByRole('button', { name, exact: true }).click();
    const shot = name => page.screenshot({ path: path.join(out, name + '.png') });
    const menu = command => app.evaluate(({ BrowserWindow }, command) => BrowserWindow.getAllWindows()[0].webContents.send('menu', command), command);
    const viewportBox = () => page.locator('[data-clean-model-canvas]').boundingBox();
    async function handles() {
      const data = await page.evaluate(() => { const { runtime, props } = poseProbe(), canvas = document.querySelector('[data-clean-model-canvas]'); return { model: poseSnapshot().model, config: props.poseConfig, frame: runtime.native.getFrame(), sequence: props.sequenceIndex, camera: runtime.controls.object.toJSON(), width: canvas.clientWidth, height: canvas.clientHeight }; });
      const camera = new ObjectLoader().parse(data.camera); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
      return projectPoseHandles(data.model, data.config, data.frame, data.sequence, camera, data.width, data.height);
    }
    async function handleFor(kind, endpoint) { const points = await handles(); const result = points.find(handle => !handle.marker && handle.kind === kind && (endpoint == null || (kind === 'node' ? handle.id : handle.chain?.end) === endpoint)); assert.ok(result?.visible, `Visible ${kind} ${endpoint}`); return result; }
    const historyDepth = () => page.evaluate(() => poseProbe().session.doc.historyStats.undoSteps);
    async function selectHandle(kind, endpoint) {
      const depth=await historyDepth();await tool('Select');const h=await handleFor(kind,endpoint),b=await viewportBox();
      for(let i=0;i<45;i++){const target=await page.evaluate(()=>poseProbe().props.poseConfig.target);if(target?.kind===kind&&!target.marker&&(kind==='node'?target.id===h.id:!h.key||target.key===h.key)){assert.equal(await historyDepth(),depth);return;}await page.mouse.click(b.x+h.x,b.y+h.y);await settle();}
      throw Error('Cannot select '+kind+' '+endpoint);
    }
    async function drag(kind, endpoint, dx, dy, cancel = false) {
      let handle = await handleFor(kind, endpoint);
      const selected = await page.evaluate(() => poseProbe().props.poseConfig.target);
      if (selected?.kind !== kind || selected.marker || (kind === 'node' ? selected.id !== handle.id : handle.key && selected.key !== handle.key)) {
        const mode=await page.evaluate(()=>poseProbe().props.transformMode);await selectHandle(kind,endpoint);await tool(mode[0].toUpperCase()+mode.slice(1));handle=await handleFor(kind,endpoint);
      }
      const before = await snap(), depth = await historyDepth();
      const h = handle, b = await viewportBox(), x = b.x + h.x, y = b.y + h.y;
      await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + dx, y + dy, { steps: 8 }); await settle();
      const during = await snap(); assert.deepEqual(during, before, 'every pointer preview is isolated'); assert.equal(await historyDepth(), depth);
      const preview = await page.evaluate(() => { const { runtime, props } = poseProbe(); return { model: JSON.parse(JSON.stringify(runtime.native.model, (_key, value) => ArrayBuffer.isView(value) ? Array.from(value) : value)), matrices: runtime.native.rendererData.nodes.filter(Boolean).map(node => [node.node.ObjectId, Array.from(node.matrix)]), camera: runtime.controls.object.toJSON(), sequence: props.sequenceIndex, frame: runtime.native.getFrame(), status: document.querySelector('.game-preview-root [role=status]')?.textContent }; });
      let meshMoved = false;
      if (preview.status && !/restricted|out of reach|cannot|invalid|unsupported|failed/i.test(preview.status)) {
        const camera = new ObjectLoader().parse(preview.camera); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
        const matrices = samplePreviewMatrices(preview.model, preview.frame, preview.sequence, preview.frame, camera);
        const differences = preview.matrices.filter(([id]) => matrices.has(id)).map(([id, native]) => ({ id, error: Math.max(...native.map((value, i) => Math.abs(value - matrices.get(id).elements[i]))) })).filter(item => item.error >= .004);
        results.previewMatrixMaxError = Math.max(results.previewMatrixMaxError || 0, ...preview.matrices.filter(([id]) => matrices.has(id)).flatMap(([id, native]) => native.map((value, i) => Math.abs(value - matrices.get(id).elements[i]))));
        assert.deepEqual(differences, [], 'native mesh and marker matrices agree during preview');
        const source = samplePreviewMatrices(before.model, preview.frame, preview.sequence, preview.frame, camera);
        meshMoved = preview.model.Geosets.some(geoset => { const posed = skinGeoset(geoset, matrices), old = skinGeoset(geoset, source); return posed.some((value, i) => Math.abs(value - old[i]) > .00001); });
      }
      if (cancel) await page.keyboard.press('Escape'); await page.mouse.up(); await settle();
      const changed = (await snap()).revision > before.revision;
      assert.equal(await historyDepth(), depth + (changed ? 1 : 0), 'one effective drag is one complete undo action');
      if (changed && !meshMoved) {
        assert.equal(kind,'node','an effective limb gesture deforms the actual preview mesh');
        const camera=new ObjectLoader().parse(preview.camera);camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);const old=samplePreviewMatrices(before.model,preview.frame,preview.sequence,preview.frame,camera).get(endpoint);
        const target=preview.matrices.find(([id])=>id===endpoint)?.[1];assert.ok(target?.some((value,i)=>Math.abs(value-old.elements[i])>1e-5),'a direct reference control moves its actual native matrix');
      } return during;
    }
    async function add(end, kind = 'arm') {
      await page.getByRole('button',{name:'POSE setup',exact:true}).click();await page.getByRole('button',{name:kind==='leg'?'Map Foot':'Map Hand',exact:true}).click();
      await page.getByLabel('Movement bone or node').selectOption(String(end));await settle();await page.getByRole('button',{name:/^(Add|Replace) handle$/}).click();await page.getByRole('button',{name:'Close POSE setup',exact:true}).click();await settle();
    }
    const initial = await snap(), sidebarWidth = await page.locator('.classic-sidebar').evaluate(element => element.getBoundingClientRect().width);
    const section = title => page.locator('details.sidebar-section').filter({ has: page.locator('summary').filter({ hasText: new RegExp('^' + title + '$') }) });
    for (const title of ['Controller', 'Restrictions']) {
      assert.equal(await section(title).evaluate(element => element.open), false, title + ' starts as a compact header');
      await section(title).locator('summary').click(); assert.equal(await section(title).evaluate(element => element.open), true);
      await section(title).locator('summary').click(); assert.equal(await section(title).evaluate(element => element.open), false);
    }
    assert.equal(await page.getByRole('checkbox', { name: 'Rotate on Own Axis', exact: true }).count(), 0);
    results.checks.push('Own Axis tool is absent; Controller and Restrictions start minimized and open/close through their existing headers');
    assert.equal(await page.getByRole('dialog', { name: 'POSE setup', exact: true }).count(), 0); await shot('01-default');
    await page.getByLabel('Movement bone or node').selectOption('0');
    await page.getByRole('button', { name: 'POSE', exact: true }).click();
    const recognized = await page.evaluate(() => poseProbe().props.poseConfig); assert.deepEqual(recognized.chains.map(chain=>chain.end).sort((a,b)=>a-b),[29,32,38,42]); assert.equal(recognized.body,25);
    await page.getByRole('button',{name:'POSE setup',exact:true}).click();await page.getByRole('button',{name:'Map Hand',exact:true}).click();await page.getByLabel('Movement bone or node').selectOption('0');await settle();
    assert.equal(await page.getByRole('button',{name:'Add handle',exact:true}).isEnabled(),false);assert.equal(await page.getByRole('button',{name:'Reload editor',exact:true}).count(),0);assert.equal(await page.locator('.pose-setup select').count(),0);
    await page.getByLabel('Movement bone or node').selectOption('39'); assert.equal(await page.getByRole('dialog',{name:'POSE setup',exact:true}).count(),1,'Object picker keeps Setup open');
    await page.getByRole('button',{name:'Close POSE setup',exact:true}).click();
    for (const [kind,id] of [['body',null],['node',33],['node',26],['node',39]]) {
      await tool('Select'); const handle=await handleFor(kind,id), box=await viewportBox(), depth=await historyDepth();
      await selectHandle(kind,id);
      const target=await page.evaluate(()=>poseProbe().props.poseConfig.target);assert.equal(target.kind,kind);if(id!=null)assert.equal(target.id,id);assert.equal(await historyDepth(),depth);
    }
    results.checks.push('First-use root selection never crashes; one POSE click recognizes both hands/feet, head/chest/pelvis and whole-body root; Object picker does not dismiss Setup; overlapping body/chest/pelvis symbols remain independently selectable');
    await page.getByRole('checkbox', { name: 'Bones', exact: true }).check(); await selectHandle('body');
    const cycleBefore = await snap(), cycleDepth = await historyDepth(), center = await handleFor('body'), cycleBox = await viewportBox();
    const cycleKey = target => `${target.kind}:${target.id ?? target.key ?? ''}:${!!target.marker}`;
    const startKey = cycleKey(await page.evaluate(() => poseProbe().props.poseConfig.target)), stack = [];
    for (let index = 0; index < 40; index++) {
      await page.mouse.click(cycleBox.x + center.x, cycleBox.y + center.y); await settle();
      const target = await page.evaluate(() => poseProbe().props.poseConfig.target); stack.push(target);
      if (cycleKey(target) === startKey) break;
    }
    assert.equal(cycleKey(stack.at(-1)), startKey, 'overlap cycle wraps to the first handle');
    assert.ok(stack.filter(target => !target.marker).length >= 2, 'overlapping virtual handles participate');
    assert.ok(stack.filter(target => target.marker).length >= 2, 'overlapping real bones participate');
    assert.equal(new Set(stack.map(cycleKey)).size, stack.length, 'each overlapping object is visited once');
    assert.deepEqual(await snap(), cycleBefore); assert.equal(await historyDepth(), cycleDepth);
    results.overlapCycle = stack;
    await tool('Move'); await page.mouse.click(cycleBox.x + center.x, cycleBox.y + center.y); await settle();
    assert.notEqual(cycleKey(await page.evaluate(() => poseProbe().props.poseConfig.target)), startKey, 'a Move-tool click also cycles after release');
    assert.deepEqual(await snap(), cycleBefore); assert.equal(await historyDepth(), cycleDepth);
    await selectHandle('endpoint', 38); await shot('09-controller-symbols');
    results.checks.push('Actual repeated clicks cycle through overlapping handles and real bones in Select and Move without authoring keys or undo; selected and hovered labels identify a control');
    await page.getByRole('checkbox', { name: 'Bones', exact: true }).uncheck();
    await add(38); assert.deepEqual(await snap(), initial, 'setup has no keys/history');
    await page.getByLabel('Workplane', { exact: true }).uncheck(); await tool('Move');
    const preview = await drag('endpoint', 38, -18, -12); assert.deepEqual(preview, initial, 'pointer preview leaves canonical data, dirty state and history untouched');
    const ik = await snap(); assert.equal(ik.undo, initial.undo + 1); assert.ok(ik.revision > initial.revision, 'hand drag commits'); results.checks.push('Hand mouse preview is isolated; release is one native multi-track action'); await shot('02-hand');
    await page.getByLabel('Movement bone or node').selectOption('33'); await tool('Rotate'); await page.getByLabel('X coordinate', { exact: true }).fill('12'); await page.getByLabel('X coordinate', { exact: true }).press('Enter'); await settle();
    const fk = await snap(); assert.equal(fk.undo, ik.undo + 1); assert.equal(await page.getByRole('button', { name: 'POSE', exact: true }).getAttribute('aria-pressed'), 'true');
    await tool('Scale');
    const scaleBox = await viewportBox(); await page.mouse.move(scaleBox.x + scaleBox.width * .22, scaleBox.y + scaleBox.height * .3); await page.mouse.down(); await page.mouse.move(scaleBox.x + scaleBox.width * .22 + 10, scaleBox.y + scaleBox.height * .3 - 5, { steps: 5 }); await settle(); assert.deepEqual(await snap(), fk); await page.mouse.up(); await settle();
    assert.equal((await snap()).undo, fk.undo + 1); await selectHandle('endpoint', 38); await tool('Move'); await drag('endpoint', 38, -4, -3, true);
    await menu('undo'); await settle();
    assert.deepEqual((await snap()).model, fk.model, 'ordinary Resize remains independent and restores exactly'); results.checks.push('Ordinary bone Resize with POSE visible, positive uniform ancestor scale, and exact Resize Undo');
    await page.getByLabel('Movement bone or node').selectOption('33'); await tool('Scale'); const beforeUnsupported = await snap(); await page.getByLabel('X coordinate', { exact: true }).fill('1.03'); await page.getByLabel('X coordinate', { exact: true }).press('Enter'); await settle();
    await page.getByLabel('Movement bone or node').selectOption(''); await page.getByRole('button', { name: 'POSE setup', exact: true }).click(); await page.getByRole('button',{name:'Map Hand',exact:true}).click();await page.getByLabel('Movement bone or node').selectOption('38');await settle();assert.match(await page.locator('.pose-setup [role=status]').textContent(),/uneven scale/i);assert.equal(await page.getByRole('button',{name:'Add handle',exact:true}).isEnabled(),false); await page.getByRole('button', { name: 'Close POSE setup', exact: true }).click();
    for (let index = 0; index < 2; index++) { await menu('undo'); await settle(); } assert.deepEqual((await snap()).model, beforeUnsupported.model); results.checks.push('Setup explains an unsupported nonuniform ancestor after an ordinary bone edit');
    await selectHandle('endpoint', 38); const beforeNoOp = await snap(); await tool('Move'); await drag('endpoint', 38, 0, 0); assert.deepEqual(await snap(), beforeNoOp, 'returning to IK does not author or snap');
    await selectHandle('endpoint', 38); await tool('Move');
    const noOpHandle = await handleFor('endpoint', 38), noOpBox = await viewportBox(), noOpDepth = await historyDepth(), noOpX = noOpBox.x + noOpHandle.x + 13, noOpY = noOpBox.y + noOpHandle.y;
    await page.mouse.move(noOpX, noOpY); await page.mouse.down(); await page.mouse.move(noOpX - 6, noOpY - 6, { steps: 5 }); await settle(); await page.mouse.move(noOpX, noOpY, { steps: 5 }); await settle(); await page.mouse.up(); await settle(); assert.deepEqual(await snap(), beforeNoOp); assert.equal(await historyDepth(), noOpDepth, 'dragging back to the grip is a no-op');
    await drag('endpoint', 38, 6, -6); const hybrid = await snap(); assert.equal(hybrid.undo, fk.undo + 1); results.checks.push('IK → ordinary chest Rotate with POSE visible → IK has no transition keys or stale target');
    await tool('Rotate'); await drag('endpoint', 38, 10, 0); const turn = await snap(); assert.equal(turn.undo, hybrid.undo + 1); await tool('Move'); await drag('bend', 38, 12, -6); const bend = await snap(); assert.equal(bend.undo, turn.undo + 1); await shot('03-turn-bend');
    await add(29, 'leg'); await add(32, 'leg'); await tool('Move'); await drag('endpoint', 29, 0, -5); const leg = await snap(); assert.equal(leg.undo, bend.undo + 1);
    await page.getByRole('button',{name:'POSE setup',exact:true}).click();await page.getByRole('button',{name:'Map Body',exact:true}).click();await page.getByLabel('Movement bone or node').selectOption('25');await settle();await page.getByRole('button',{name:'Add handle',exact:true}).click();await page.getByRole('button',{name:'Close POSE setup',exact:true}).click();
    const legs = [{ root: 27, middle: 28, end: 29 }, { root: 30, middle: 31, end: 32 }];
    async function pinnedBody(feet) {
      const before = await snap(), poses = feet.map(c => samplePoseChain(before.model, c, 500, 0)); await selectHandle('body'); await tool('Move');
      const during = await drag('body', null, 0, 6); assert.deepEqual(during, before, 'body pointer preview stays outside canonical data'); const after = await snap(); assert.equal(after.undo, before.undo + 1, 'body compensation is one undo step');
      const measurement = feet.map((c, i) => { const p = samplePoseChain(after.model, c, 500, 0); const error = p.end.distanceTo(poses[i].end), orientation = 1 - Math.abs(p.rotations[2].dot(poses[i].rotations[2])), lengthError = Math.max(...p.lengths.map((length, index) => Math.abs(length - poses[i].lengths[index]))); assert.ok(error < .004 && orientation < 1e-6 && lengthError < .004); return { endpoint: c.end, positionError: error, orientationDotError: orientation, lengthError }; }); results.measurements.push(measurement); return { before, after };
    }
    await selectHandle('endpoint', 29); await page.getByRole('button', { name: 'Pin selected foot', exact: true }).click(); assert.equal((await snap()).undo, leg.undo);
    await pinnedBody([legs[0]]); await selectHandle('endpoint', 32); await page.getByRole('button', { name: 'Pin selected foot', exact: true }).click();
    await page.getByLabel('Movement bone or node').selectOption('27'); await tool('Rotate'); await page.getByLabel('Z coordinate', { exact: true }).fill('3'); await page.getByLabel('Z coordinate', { exact: true }).press('Enter'); await settle();
    assert.equal((await page.evaluate(() => poseProbe().props.poseConfig.pins)).length, 2); const body = await pinnedBody(legs); await shot('04-two-pins');
    results.checks.push('Visible pins permit ordinary FK leg edits and rebase to the resulting pose before body Move');
    results.checks.push('One/two explicitly pinned feet retain position, orientation and lengths through body mouse Move');
    const valid = await snap(); await drag('body', null, 0, -500); const limit = await snap(); assert.equal(limit.undo,valid.undo+1,'oversized drag retains the reachable movement');
    for(const c of legs)assert.ok(samplePoseChain(limit.model,c,500,0).end.distanceTo(samplePoseChain(valid.model,c,500,0).end)<.004,'reach limit keeps both feet');
    await menu('undo');await settle();assert.deepEqual((await snap()).model,valid.model);
    const afterLimitUndo = await snap(); await drag('body', null, 0, 4, true); assert.deepEqual(await snap(), afterLimitUndo, 'Escape restores complete body preview');
    await menu('undo'); await settle(); assert.deepEqual((await snap()).model, body.before.model); await menu('redo'); await settle(); assert.deepEqual((await snap()).model, body.after.model); results.checks.push('Reach clamping retains the valid pose without jumping back; Escape and atomic body Undo/Redo retain the complete pose');
    const beforePinToggle = await snap(); await selectHandle('endpoint', 29); await page.getByRole('button', { name: 'Pin selected foot', exact: true }).click(); assert.equal((await page.evaluate(() => poseProbe().props.poseConfig.pins)).length, 1); await page.getByRole('button', { name: 'Pin selected foot', exact: true }).click(); assert.equal((await page.evaluate(() => poseProbe().props.poseConfig.pins)).length, 2); assert.deepEqual(await snap(), beforePinToggle); results.checks.push('Explicit pin release/re-pin changes only session state');
    for(const name of ['Move','Rotate','Scale']) {await page.getByLabel('Movement bone or node').selectOption('39');await tool(name);const before=await snap();await drag('node',39,6,-3);assert.equal((await snap()).undo,before.undo+1,'head '+name+' is an ordinary atomic control');}
    await page.getByRole('button',{name:'POSE setup',exact:true}).click();await page.getByRole('button',{name:'Map Object',exact:true}).click();await page.getByLabel('Movement bone or node').selectOption('43');await settle();await page.getByRole('button',{name:'Add handle',exact:true}).click();await page.getByRole('button',{name:'Close POSE setup',exact:true}).click();
    await tool('Move');const beforeReference=await snap();await drag('node',43,3,-2);await menu('undo');await settle();assert.deepEqual((await snap()).model,beforeReference.model,'an arbitrary attachment handle undoes exactly');
    await selectHandle('body');await tool('Rotate');const beforeRotate=await snap();await drag('body',null,5,0);const afterRotate=await snap();assert.equal(afterRotate.undo,beforeRotate.undo+1);for(const c of legs)assert.ok(samplePoseChain(afterRotate.model,c,500,0).end.distanceTo(samplePoseChain(beforeRotate.model,c,500,0).end)<.004);
    await tool('Scale');const beforeScale=await snap();await drag('body',null,4,0);const afterScale=await snap();assert.equal(afterScale.undo,beforeScale.undo+1);for(const c of legs)assert.ok(samplePoseChain(afterScale.model,c,500,0).end.distanceTo(samplePoseChain(beforeScale.model,c,500,0).end)<.004,'body Scale retains planted feet');
    for(const end of [38,42]) {await selectHandle('endpoint',end);await page.getByRole('button',{name:'Pin selected hand',exact:true}).click();}
    const allLimbs=(await page.evaluate(()=>poseProbe().props.poseConfig.chains)).map(c=>({...c}));await selectHandle('body');await tool('Move');const fourBefore=await snap();await drag('body',null,0,3);const fourAfter=await snap();assert.equal(fourAfter.undo,fourBefore.undo+1);for(const c of allLimbs)assert.ok(samplePoseChain(fourAfter.model,c,500,0).end.distanceTo(samplePoseChain(fourBefore.model,c,500,0).end)<.004,'body holds four explicit pins');
    await page.getByLabel('Movement bone or node').selectOption('33');await tool('Move');const chestBefore=await snap();await drag('node',33,0,2);const chestAfter=await snap();for(const c of allLimbs.filter(c=>c.kind==='arm'))assert.ok(samplePoseChain(chestAfter.model,c,500,0).end.distanceTo(samplePoseChain(chestBefore.model,c,500,0).end)<.004,'chest compensates pinned hands');
    await page.getByLabel('Render mode',{exact:true}).selectOption('textured');await shot('08-whole-body-controllers');
    for(const end of [38,42]) {await selectHandle('endpoint',end);await page.getByRole('button',{name:'Pin selected hand',exact:true}).click();}
    results.checks.push('Head Move/Rotate/Scale, arbitrary attachment control, body Rotate/Scale with planted feet, four simultaneous pins and chest Move with pinned hands use real mouse controls and native matrices');
    await selectHandle('endpoint', 38); await tool('Move');
    for (const reason of ['pointercancel', 'lostcapture', 'blur', 'frame', 'sequence', 'tool', 'target', 'revision', 'teardown', 'commit-false', 'commit-throw']) {
      const before = await snap(), h = await handleFor('endpoint', 38), b = await viewportBox();
      await page.mouse.move(b.x + h.x + 13, b.y + h.y); await page.mouse.down(); await page.mouse.move(b.x + h.x + 9, b.y + h.y - 4, { steps: 5 }); await settle(); assert.deepEqual(await snap(), before);
      if (reason === 'pointercancel') await page.locator('[data-clean-model-canvas]').dispatchEvent('pointercancel', { pointerId: 1 });
      if (reason === 'lostcapture') await page.evaluate(() => document.querySelector('[data-clean-model-canvas]').releasePointerCapture(1));
      if (reason === 'blur') await page.evaluate(() => window.dispatchEvent(new Event('blur')));
      if (reason === 'frame') { await time.fill('501'); await time.press('Enter'); }
      if (reason === 'sequence') await page.getByLabel('Movement current sequence').selectOption('1');
      if (reason === 'tool') await menu('rotate');
      if (reason === 'target') await page.evaluate(() => poseProbe().props.onPoseSelect(null));
      if (reason === 'revision') await menu('undo');
      if (reason === 'teardown') await menu('vertices');
      if (reason.startsWith('commit-')) await page.evaluate(reason => { poseProbe().props.onPoseCommit = () => { if (reason === 'commit-throw') throw Error('Injected commit rejection'); return false; }; }, reason);
      await settle(); await page.mouse.up(); await settle();
      if (reason === 'teardown') { await menu('animation'); await settle(); }
      if (reason === 'revision') { assert.notDeepEqual((await snap()).model, before.model); await menu('redo'); await settle(); assert.deepEqual((await snap()).model, before.model); }
      else assert.deepEqual(await snap(), before, reason + ' discards every preview track');
      assert.equal(await page.evaluate(() => poseProbe().runtime.controls.enabled), true, reason + ' restores camera input');
      await page.getByLabel('Movement current sequence').selectOption('0'); await time.fill('500'); await time.press('Enter'); await selectHandle('endpoint', 38); await tool('Move');
    }
    results.checks.push('Pointer cancel/lost capture, blur, frame/sequence/tool/target/revision changes and teardown restore preview and camera input');
    const axisBefore = await snap(), axisHandle = await handleFor('endpoint', 38), axisCamera = new ObjectLoader().parse(await page.evaluate(() => poseProbe().runtime.controls.object.toJSON())); axisCamera.updateMatrixWorld(true);
    const axisBox = await viewportBox(), a = movementAxisHandles(axisHandle, axisCamera, axisBox.width, axisBox.height, 100, 'world', 'move').find(handle => handle.axis === 'X'), pose = samplePoseChain(axisBefore.model, axisHandle.chain, 500, 0), sign = -Math.sign(pose.end.x - pose.root.x) || 1;
    const dx = Math.round(sign * a.dx / Math.hypot(a.dx, a.dy) * 6), dy = Math.round(sign * a.dy / Math.hypot(a.dx, a.dy) * 6), sensitivity = pointerSensitivityValue(await page.evaluate(() => poseProbe().props.preferences?.pointerSensitivity)), amount = movementDragAmount(a, dx, dy, 'move', sensitivity);
    const target = pose.end.clone(); target.x += amount; const expectedAxis = solvePoseLimb(axisBefore.model, axisHandle.chain, 500, 0, target);
    await page.mouse.move(axisBox.x + a.x, axisBox.y + a.y); await page.mouse.down(); await page.mouse.move(axisBox.x + a.x + dx, axisBox.y + a.y + dy, { steps: 5 }); await settle(); assert.deepEqual(await snap(), axisBefore); await page.mouse.up(); await settle();
    assert.ok(samplePoseChain((await snap()).model, axisHandle.chain, 500, 0).end.distanceTo(expectedAxis.pose.end) < .004); results.checks.push('Actual Move axis-gizmo drag follows its native axis');
    await page.getByLabel('Render mode', { exact: true }).selectOption('textured'); await settle(); await drag('endpoint', 38, -4, -3, true); await shot('06-textured-preview-restored');
    await page.getByLabel('Workplane', { exact: true }).check();
    for (const [plane, view, shift] of [['XY', 'perspective', false], ['ZX', 'perspective', false], ['YZ', 'perspective', false], ['XY', 'front', false], ['ZX', 'front', true], ['YZ', 'perspective', true]]) {
      await page.getByLabel('View direction', { exact: true }).selectOption(view); await settle();
      await page.getByRole('radio', { name: plane, exact: true }).check();
      const before = await snap(), h = await handleFor('endpoint', 38), data = await page.evaluate(() => ({ camera: poseProbe().runtime.controls.object.toJSON(), sensitivity: poseProbe().props.preferences?.pointerSensitivity })), b = await viewportBox();
      const camera = new ObjectLoader().parse(data.camera); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true); const axes = plane === 'XY' ? [0, 1] : plane === 'ZX' ? [0, 2] : [1, 2], origin = h.world.clone().project(camera);
      const basis = axes.map(axis => { const end = h.world.clone(); end.setComponent(axis, end.getComponent(axis) + 1); end.project(camera); return [(end.x - origin.x) * b.width / 2, (origin.y - end.y) * b.height / 2]; });
      const scale = pointerSensitivityValue(data.sensitivity), offset = projectedPlaneTranslation(plane.toLowerCase(), basis, -4 * scale, -3 * scale, shift);
      const expected = solvePoseLimb(before.model, h.chain, 500, 0, h.world.clone().add({ x: offset[0], y: offset[1], z: offset[2] }));
      if (shift) await page.keyboard.down('Shift'); await drag('endpoint', 38, -4, -3); if (shift) await page.keyboard.up('Shift'); const after = samplePoseChain((await snap()).model, h.chain, 500, 0); assert.ok(after.end.distanceTo(expected.pose.end) < .004, plane + ' follows ordinary projected workplane');
    }
    await page.getByLabel('Workplane', { exact: true }).uncheck();
    await section('Restrictions').locator('summary').click();
    await page.getByRole('checkbox', { name: 'Translation', exact: true }).check(); const translationLocked = await snap(); await drag('endpoint', 38, 4, -3); assert.equal((await snap()).undo, translationLocked.undo + 1, 'Translation lock permits limb rotation-only Move');
    await page.getByRole('checkbox', { name: 'Rotation', exact: true }).check(); const rotationLocked = await snap(); await drag('endpoint', 38, 4, -3); assert.deepEqual(await snap(), rotationLocked);
    await page.getByRole('checkbox', { name: 'Rotation', exact: true }).uncheck(); const bodyLocked = await snap(); await selectHandle('body'); assert.ok(await page.getByRole('group', { name: 'Movement tool', exact: true }).getByRole('button', { name: 'Move', exact: true }).isDisabled()); assert.deepEqual(await snap(), bodyLocked);
    await page.getByRole('checkbox', { name: 'Translation', exact: true }).uncheck(); results.checks.push('Textured preview, XY/ZX/YZ workplanes, edge-on views, Shift constraints, and native Rotation/Translation restrictions use existing Movement behavior');
    await section('Restrictions').locator('summary').click();
    const cameraBefore = await page.evaluate(() => poseProbe().runtime.controls.object.position.toArray()), b = await viewportBox();
    await page.keyboard.down('Alt'); await page.mouse.move(b.x + b.width * .22, b.y + b.height * .3); await page.mouse.down(); await page.mouse.move(b.x + b.width * .22 + 60, b.y + b.height * .3 + 25, { steps: 10 }); await page.mouse.up(); await page.keyboard.up('Alt'); await settle();
    const cameraAfter = await page.evaluate(() => poseProbe().runtime.controls.object.position.toArray()); assert.notDeepEqual(cameraAfter, cameraBefore); assert.equal(await page.evaluate(() => poseProbe().runtime.controls.enabled), true); results.checks.push('Actual Alt+mouse camera rotation works with POSE enabled after cancelled body gestures');
    await page.mouse.move(b.x + b.width * .22, b.y + b.height * .3); await page.mouse.wheel(0, -120); await settle(); assert.notDeepEqual(await page.evaluate(() => poseProbe().runtime.controls.object.position.toArray()), cameraAfter); results.checks.push('Actual mouse-wheel zoom remains available with POSE enabled');
    const controlsOnly = await snap(); await time.fill('600'); await time.press('Enter'); await page.getByLabel('Movement current sequence').selectOption('1'); await page.getByRole('button', { name: 'POSE', exact: true }).click(); await page.getByRole('button', { name: 'POSE', exact: true }).click(); assert.deepEqual(await snap(), controlsOnly, 'scrub/sequence/toggle creates no keys');
    assert.equal(await page.locator('.classic-sidebar').evaluate(element => element.getBoundingClientRect().width), sidebarWidth); assert.equal(await page.getByRole('dialog', { name: 'POSE setup', exact: true }).count(), 0); await shot('05-dismissed-camera');
    results.checks.push('Default/dismissed UI stays compact; scrub, sequence change and toggles leave native data/history unchanged');
    const canonical = (await snap()).model, original = openDocument(fs.readFileSync(fixture), 'Footman.mdx').model, permitted = new Set([25,27, 28, 29, 30, 31, 32, 33,34,35, 36, 37, 38,39,42]), translations=new Set([25,33,39]), scalings=new Set([25,39]);
    const strip = model => { const copy = structuredClone(model); for (const key of ['Nodes', 'Bones', 'Helpers','Attachments']) for (const node of copy[key] || []) if (node) { if (permitted.has(node.ObjectId)) delete node.Rotation; if (translations.has(node.ObjectId)) delete node.Translation;if(scalings.has(node.ObjectId))delete node.Scaling; } return copy; };
    assertModelEquivalent(strip(original), strip(canonical));
    for (const node of allNodes(original)) for (const property of ['Translation', 'Rotation','Scaling']) if (permitted.has(node.ObjectId) && property === 'Rotation' || translations.has(node.ObjectId) && property === 'Translation'||scalings.has(node.ObjectId)&&property==='Scaling') {
      const after = allNodes(canonical).find(item => item.ObjectId === node.ObjectId);
      assert.deepEqual(after[property]?.Keys?.filter(key => key.Frame < 167 || key.Frame > 1667) || [], JSON.parse(JSON.stringify(node[property]?.Keys?.filter(key => key.Frame < 167 || key.Frame > 1667) || [], (_key, value) => ArrayBuffer.isView(value) ? Array.from(value) : value)), 'other animations/gap keys preserved');
    }
    for (const format of ['mdx', 'mdl']) {
      const dest = path.join(out, `posed.${format}`); await app.evaluate(({ dialog }, dest) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: dest }); }, dest);
      await menu('saveAs'); await page.getByRole('button', { name: `Save ${format.toUpperCase()}…`, exact: true }).click(); await page.getByRole('dialog', { name: 'Save as', exact: true }).waitFor({ state: 'hidden' });
      assert.ok(fs.existsSync(dest)); const reopened = openDocument(fs.readFileSync(dest), `posed.${format}`); results.checks.push(`Packaged ${format.toUpperCase()} save reopens through native codec`); assert.equal(reopened.version, 1800);
      assertModelEquivalent(canonical, reopened.model);
      if (format === 'mdx') for (const chunk of parseMdx(fs.readFileSync(fixture)).chunks) if (!['BONE', 'HELP','ATCH'].includes(chunk.tag)) { const bytes = fs.readFileSync(dest), match = parseMdx(bytes).chunks.find(item => item.tag === chunk.tag); assert.deepEqual(bytes.subarray(match.offset, match.payloadOffset + match.declaredSize), fs.readFileSync(fixture).subarray(chunk.offset, chunk.payloadOffset + chunk.declaredSize), chunk.tag + ' bytes preserved'); }
    }
    for (const format of ['mdx', 'mdl']) {
      await page.locator('.model-tab.active .model-tab-close').click(); await settle();
      const dest = path.join(out, `posed.${format}`); await app.evaluate(({ dialog }, dest) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [dest] }); }, dest); await menu('open'); await settle();
      await menu('animation'); await page.getByLabel('Movement current sequence').selectOption('0'); await time.fill('500'); await time.press('Enter'); await settle(); assertModelEquivalent(canonical, (await snap()).model);
      assert.equal(await page.getByRole('button', { name: 'POSE', exact: true }).getAttribute('aria-pressed'), 'false', 'reopening requires session setup');
      results.checks.push(`Actual packaged ${format.toUpperCase()} reopen retains native pose and resets session handles`);
    }
    const beforeBones = await snap(); await menu('bones'); await page.getByLabel('Render mode', { exact: true }).selectOption('wireframe'); await settle();
    for (const mode of ['wireframe', 'textured']) {
      await page.getByLabel('Render mode', { exact: true }).selectOption(mode); await settle();
      const rest = await page.evaluate(() => { const { runtime, props } = poseProbe(); return { restPose: props.restPose, matrices: runtime.native.rendererData.nodes.filter(Boolean).map(node => Array.from(node.matrix)) }; });
      assert.equal(rest.restPose, true); for (const matrix of rest.matrices) assert.deepEqual(matrix, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
      assert.equal(await page.getByRole('button', { name: 'POSE', exact: true }).count(), 0); assert.deepEqual(await snap(), beforeBones);
    }
    await shot('07-bones-rest'); results.checks.push('Bones retains its unanimated rest matrices in wireframe and textured views, with POSE absent');
    // Start from the immutable source again for the reference video's free-body workflow.
    await page.locator('.model-tab.active .model-tab-close').click(); await settle();
    await app.evaluate(({dialog},fixture)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[fixture]});},fixture);await menu('open');await settle();
    await menu('animation');await page.getByLabel('Movement current sequence').selectOption('0');await time.fill('500');await time.press('Enter');
    await page.getByLabel('View direction',{exact:true}).selectOption('front');await page.getByLabel('Render mode',{exact:true}).selectOption('textured');
    await page.getByLabel('Workplane',{exact:true}).uncheck();await page.getByRole('button',{name:'POSE',exact:true}).click();await settle();
    const automatic=await page.evaluate(()=>poseProbe().props.poseConfig), autoLegs=automatic.chains.filter(c=>c.kind==='leg');
    assert.deepEqual(automatic.pins,[]);assert.equal(autoLegs.length,2);const autoBefore=await snap(), autoPoses=autoLegs.map(c=>samplePoseChain(autoBefore.model,c,500,0));
    await selectHandle('body');await tool('Move');await drag('body',null,0,24);const crouch=await snap();
    for(let i=0;i<autoLegs.length;i++){const p=samplePoseChain(crouch.model,autoLegs[i],500,0);assert.ok(p.root.z<autoPoses[i].root.z-2);assert.ok(p.end.distanceTo(autoPoses[i].end)<.004);assert.ok(p.middle.distanceTo(autoPoses[i].middle)>1);}
    await shot('10-auto-crouch');await menu('undo');await settle();assert.deepEqual((await snap()).model,autoBefore.model);await menu('redo');await settle();assert.deepEqual((await snap()).model,crouch.model);await menu('undo');await settle();
    await drag('body',null,0,-180);const airborne=await snap();
    for(let i=0;i<autoLegs.length;i++){const p=samplePoseChain(airborne.model,autoLegs[i],500,0);assert.ok(p.root.z>autoPoses[i].root.z+20,'body rises beyond leg reach');assert.ok(p.end.z>autoPoses[i].end.z+5,'feet leave the ground');assert.ok(Math.abs(p.root.distanceTo(p.end)-p.lengths[0]-p.lengths[1])<.004);assert.ok(1-Math.abs(p.rotations[2].dot(autoPoses[i].rotations[2]))<1e-6);}
    await shot('11-auto-airborne');await drag('body',null,0,20);const lowered=await snap();
        for(const c of autoLegs){const p=samplePoseChain(lowered.model,c,500,0);assert.ok(p.end.z<samplePoseChain(airborne.model,c,500,0).end.z-2,'feet descend toward their original goals after re-grabbing');}
    await drag('body',null,0,160);const returned=await snap();
    for(let i=0;i<autoLegs.length;i++){const p=samplePoseChain(returned.model,autoLegs[i],500,0);assert.ok(p.end.distanceTo(autoPoses[i].end)<.004,'feet return to their ground goals');assert.ok(p.root.distanceTo(p.end)<p.lengths[0]+p.lengths[1]-.1,'knees bend again after reaching the ground');}
    for(let i=0;i<3;i++){await menu('undo');await settle();}assert.deepEqual((await snap()).model,autoBefore.model);
    // Pelvis and chest use the same body-to-limb compensation; direct FK remains available.
    await selectHandle('node',26);await tool('Move');await drag('node',26,0,12);const pelvisPose=await snap();
    for(let i=0;i<autoLegs.length;i++)assert.ok(samplePoseChain(pelvisPose.model,autoLegs[i],500,0).end.distanceTo(autoPoses[i].end)<.004);
    await menu('undo');await settle();await page.getByLabel('Movement bone or node').selectOption('33');await tool('Move');
    const armPoses=automatic.chains.filter(c=>c.kind==='arm').map(c=>({chain:c,pose:samplePoseChain(autoBefore.model,c,500,0)}));await drag('node',33,0,2);
    for(const {chain,pose} of armPoses)assert.ok(samplePoseChain((await snap()).model,chain,500,0).end.distanceTo(pose.end)<.004);
    await menu('undo');await settle();assert.deepEqual((await snap()).model,autoBefore.model);
    results.checks.push('Automatic Body/Pelvis crouching, unrestricted airborne body drag, stable endpoint orientation, bend recovery, chest/hand compensation and atomic Undo/Redo work by mouse with zero pins');
    // Connected upper-body grips must never author joint translations.
    const pointsAt=(model,frame=500)=>{const matrices=sampleNodeMatrices(model,frame,0,frame);return new Map(allNodes(model).map(node=>[node.ObjectId,new Vector3(...node.PivotPoint).applyMatrix4(matrices.get(node.ObjectId))]));};
    const assertConnected=(before,after,frame=500)=>{const a=pointsAt(before,frame),b=pointsAt(after,frame);for(const node of allNodes(after)){if(!b.has(node.Parent))continue;assert.ok(Math.abs(a.get(node.ObjectId).distanceTo(a.get(node.Parent))-b.get(node.ObjectId).distanceTo(b.get(node.Parent)))<.004,'joint '+node.ObjectId+' stays attached');const old=allNodes(before).find(old=>old.ObjectId===node.ObjectId);assert.deepEqual(node.Translation,old.Translation);assert.deepEqual(node.Scaling,old.Scaling);}};
    for(const id of [33,39]) {
      await selectHandle('node',id);await tool('Move');const before=await snap();await drag('node',id,24,-8);const after=await snap();assert.equal(after.undo,before.undo+1);assertConnected(before.model,after.model);
      assert.notDeepEqual(allNodes(after.model).find(n=>n.ObjectId===33).Rotation,allNodes(before.model).find(n=>n.ObjectId===33).Rotation,'head/chest grip moves the torso');
      if(id===33){const qa=new Quaternion().setFromRotationMatrix(sampleNodeMatrices(before.model,500,0,500).get(39)).normalize(),qb=new Quaternion().setFromRotationMatrix(sampleNodeMatrices(after.model,500,0,500).get(39)).normalize();assert.ok(1-Math.abs(qa.dot(qb))<1e-6,'chest bend preserves head facing');}
      await shot(id===33?'13-connected-chest':'14-connected-head');await menu('undo');await settle();assert.deepEqual((await snap()).model,before.model);await menu('redo');await settle();assert.deepEqual((await snap()).model,after.model);await menu('undo');await settle();
      const beforeCancel=await snap();await drag('node',id,-20,6,true);assert.deepEqual(await snap(),beforeCancel);
    }
    await selectHandle('node',39);await tool('Move');const numericBefore=await snap(), coordinate=page.getByLabel('Y coordinate',{exact:true}), oldY=Number(await coordinate.inputValue());
    await coordinate.fill(String(oldY+2));await coordinate.press('Enter');await settle();const numericAfter=await snap();assert.equal(numericAfter.undo,numericBefore.undo+1);assertConnected(numericBefore.model,numericAfter.model);await menu('undo');await settle();assert.deepEqual((await snap()).model,numericBefore.model);
    // Native marker selection retains MDLvis translation, then a handle starts
    // its next solve from that edited pose, without an old controller target.
    await page.getByRole('checkbox',{name:'Bones',exact:true}).check();await tool('Select');
    const markerCamera=new ObjectLoader().parse(await page.evaluate(()=>poseProbe().runtime.controls.object.toJSON()));markerCamera.updateMatrixWorld(true);const marker=pointsAt((await snap()).model).get(39).project(markerCamera),markerBox=await viewportBox();
    for(let i=0;i<24;i++){await page.mouse.click(markerBox.x+(marker.x+1)*markerBox.width/2,markerBox.y+(1-marker.y)*markerBox.height/2);await settle();const t=await page.evaluate(()=>poseProbe().props.poseConfig.target);if(t?.marker&&t.id===39)break;}
    assert.deepEqual(await page.evaluate(()=>poseProbe().props.poseConfig.target),{kind:'node',id:39,marker:true});await tool('Move');
    const markerBefore=await snap(), x=page.getByLabel('X coordinate',{exact:true}),oldX=Number(await x.inputValue());await x.fill(String(oldX+1));await x.press('Enter');await settle();const markerAfter=await snap();assert.notDeepEqual(allNodes(markerAfter.model).find(n=>n.ObjectId===39).Translation,allNodes(markerBefore.model).find(n=>n.ObjectId===39).Translation);
    await selectHandle('node',39);await tool('Move');await drag('node',39,5,-2);const resumed=await snap();assertConnected(markerAfter.model,resumed.model);await menu('undo');await settle();assert.deepEqual((await snap()).model,markerAfter.model);await menu('undo');await settle();assert.deepEqual((await snap()).model,autoBefore.model);
    results.checks.push('Head/Chest mouse grips and numeric coordinates rotate connected joints, retain all native translations/scales, compensate head facing, cancel/Undo/Redo atomically and resume after actual native-marker FK editing');
    // Author three ordinary native poses, scrub them, and save/reopen the resulting animation.
    const jumpFrames=[500,850,1200];
    for(const [i,frame] of jumpFrames.entries()) {
      await time.fill(String(frame));await time.press('Enter');await settle();await selectHandle('body');await tool('Move');
      const h=await handleFor('body'), b=await viewportBox(), data=await page.evaluate(()=>({camera:poseProbe().runtime.controls.object.toJSON(),sensitivity:poseProbe().props.preferences?.pointerSensitivity}));
      const camera=new ObjectLoader().parse(data.camera);camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
      const currentRoot=samplePoseChain((await snap()).model,autoLegs[0],frame,0).root.z, goalRoot=samplePoseChain(original,autoLegs[0],frame,0).root.z+(i===1?45:-7);
      const origin=h.world.clone().project(camera), goal=h.world.clone();goal.z+=goalRoot-currentRoot;goal.project(camera);
      const sensitivity=pointerSensitivityValue(data.sensitivity);
      await drag('body',null,(goal.x-origin.x)*b.width/2/sensitivity,-(goal.y-origin.y)*b.height/2/sensitivity);
      const rootAfterBody=samplePoseChain((await snap()).model,autoLegs[0],frame,0).root.z;console.log(JSON.stringify({frame,currentRoot,goalRoot,rootAfterBody,target:await page.evaluate(()=>poseProbe().props.poseConfig.target),status:await page.locator('.game-preview-root [role=status]').textContent().catch(()=>null)}));assert.ok(Math.abs(rootAfterBody-goalRoot)<.5,'body follows requested height at '+frame);
      await selectHandle('node',i===1?39:33);await tool('Move');const upperBefore=(await snap()).model;await drag('node',i===1?39:33,i===1?12:-8,-3);assertConnected(upperBefore,(await snap()).model,frame);
      if(i!==1)for(const c of autoLegs){
        await selectHandle('endpoint',c.end);await tool('Move');const foot=await handleFor('endpoint',c.end);
        const from=foot.world.clone().project(camera), to=samplePoseChain(original,c,frame,0).end.clone().project(camera);
        await drag('endpoint',c.end,(to.x-from.x)*b.width/2/sensitivity,-(to.y-from.y)*b.height/2/sensitivity);
        assert.ok(Math.abs(samplePoseChain((await snap()).model,c,frame,0).end.z-samplePoseChain(original,c,frame,0).end.z)<.5,'foot controller places the crouch/landing contact');
      }
    }
    const jumpModel=(await snap()).model, jumpHeights=[];
    for(const frame of jumpFrames){await time.fill(String(frame));await time.press('Enter');await settle();jumpHeights.push(samplePoseChain(jumpModel,autoLegs[0],frame,0).root.z);const shown=await page.evaluate(()=>{const {runtime}=poseProbe();return {frame:runtime.native.getFrame(),matrices:runtime.native.rendererData.nodes.filter(Boolean).map(n=>[n.node.ObjectId,Array.from(n.matrix)])};});assert.equal(shown.frame,frame);const evaluated=samplePreviewMatrices(jumpModel,frame,0,frame,new ObjectLoader().parse(await page.evaluate(()=>poseProbe().runtime.controls.object.toJSON())));for(const [id,matrix] of shown.matrices)if(evaluated.has(id))assert.ok(Math.max(...matrix.map((v,i)=>Math.abs(v-evaluated.get(id).elements[i])))<.004);}
    assert.ok(jumpHeights[1]>jumpHeights[0]+20&&jumpHeights[1]>jumpHeights[2]+20,JSON.stringify(jumpHeights));
    await time.fill('500');await time.press('Enter');await page.getByRole('button',{name:'Play',exact:true}).click();await page.waitForTimeout(300);const playbackFrame=await page.evaluate(()=>poseProbe().runtime.native.getFrame());await page.getByRole('button',{name:'Stop',exact:true}).click();assert.ok(playbackFrame>500,'native jump animation plays');await settle();
    const jumpDest=path.join(out,'automatic-jump.mdx');await app.evaluate(({dialog},dest)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:dest});},jumpDest);await menu('saveAs');await page.getByRole('button',{name:'Save MDX…',exact:true}).click();await page.getByRole('dialog',{name:'Save as',exact:true}).waitFor({state:'hidden'});
    const jumpSaved=openDocument(fs.readFileSync(jumpDest),'automatic-jump.mdx');assertModelEquivalent(jumpModel,jumpSaved.model);assertModelEquivalent(strip(original),strip(jumpSaved.model));
    await page.locator('.model-tab.active .model-tab-close').click();await settle();await app.evaluate(({dialog},dest)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[dest]});},jumpDest);await menu('open');await settle();await menu('animation');await page.getByLabel('Movement current sequence').selectOption('0');await time.fill('850');await time.press('Enter');await settle();assertModelEquivalent(jumpModel,(await snap()).model);await shot('12-reopened-jump');
    results.automaticJump={frames:jumpFrames,rootHeights:jumpHeights,saved:jumpDest,playbackFrame};results.checks.push('A crouch/takeoff/landing sequence with connected Head/Chest poses is authored through mouse drags at three frames, scrubs and plays with native matrices, saves as MDX and reopens in the packaged editor');
    assert.equal(hash(fixture), fixtureHash); for (const [name, expected] of Object.entries(results.textureHashes)) assert.equal(hash(path.join(out, 'Textures', name)), expected);
    assert.deepEqual(errors, []); results.errors = errors; fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(results, null, 2)); console.log(JSON.stringify(results, null, 2));
  } catch (error) { await (await app.firstWindow()).screenshot({ path: path.join(out, 'failure.png') }); throw error; }
  finally { await app.evaluate(({ app }) => app.exit(0)); }
})().catch(error => { console.error(error); process.exitCode = 1; });

function hash(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
