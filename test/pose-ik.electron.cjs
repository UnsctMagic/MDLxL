// Disposable packaged mouse acceptance. Never opens or replaces a user profile.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const { ObjectLoader } = await import('three');
  const { projectPoseHandles } = await import('../app/pose-overlay.js');
  const { samplePoseChain, solvePoseLimb } = await import('../src/pose-ik.js');
  const { openDocument } = await import('../src/editor-document.js');
  const { allNodes, skinGeoset } = await import('../src/animation.js');
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
      const camera = new ObjectLoader().parse(data.camera); camera.updateMatrixWorld(true);
      return projectPoseHandles(data.model, data.config, data.frame, data.sequence, camera, data.width, data.height);
    }
    async function handleFor(kind, endpoint) { const points = await handles(); const result = points.find(handle => handle.kind === kind && (endpoint == null || (kind === 'node' ? handle.id : handle.chain?.end) === endpoint)); assert.ok(result?.visible, `Visible ${kind} ${endpoint}`); return result; }
    const historyDepth = () => page.evaluate(() => poseProbe().session.doc.historyStats.undoSteps);
    async function selectHandle(kind, endpoint) { const depth = await historyDepth(); await tool('Select'); const h = await handleFor(kind, endpoint), b = await viewportBox(); await page.mouse.click(b.x + h.x, b.y + h.y); await settle(); assert.equal(await historyDepth(), depth, 'virtual selection creates no undo step'); }
    async function drag(kind, endpoint, dx, dy, cancel = false) {
      const before = await snap(), depth = await historyDepth();
      const h = await handleFor(kind, endpoint), b = await viewportBox(), x = b.x + h.x, y = b.y + h.y;
      await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + dx, y + dy, { steps: 8 }); await settle();
      const during = await snap(); assert.deepEqual(during, before, 'every pointer preview is isolated'); assert.equal(await historyDepth(), depth);
      const preview = await page.evaluate(() => { const { runtime, props } = poseProbe(); return { model: JSON.parse(JSON.stringify(runtime.native.model, (_key, value) => ArrayBuffer.isView(value) ? Array.from(value) : value)), matrices: runtime.native.rendererData.nodes.filter(Boolean).map(node => [node.node.ObjectId, Array.from(node.matrix)]), camera: runtime.controls.object.toJSON(), sequence: props.sequenceIndex, frame: runtime.native.getFrame(), status: document.querySelector('.game-preview-root [role=status]')?.textContent }; });
      let meshMoved = false;
      if (preview.status && !/restricted|out of reach|cannot|invalid|unsupported|failed/i.test(preview.status)) {
        const camera = new ObjectLoader().parse(preview.camera); camera.updateMatrixWorld(true);
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
        const camera=new ObjectLoader().parse(preview.camera);camera.updateMatrixWorld(true);const old=samplePreviewMatrices(before.model,preview.frame,preview.sequence,preview.frame,camera).get(endpoint);
        const target=preview.matrices.find(([id])=>id===endpoint)?.[1];assert.ok(target?.some((value,i)=>Math.abs(value-old.elements[i])>1e-5),'a direct reference control moves its actual native matrix');
      } return during;
    }
    async function add(end, kind = 'arm') {
      await page.getByLabel('Movement bone or node').selectOption(String(end)); await page.getByRole('button', { name: 'POSE setup', exact: true }).click();
      await page.getByText('Custom limb…', {exact:true}).click(); await page.getByRole('button',{name:'Suggest selected chain',exact:true}).click();
      await page.getByLabel('POSE limb kind').selectOption(kind); await page.getByRole('button', { name: 'Add handle', exact: true }).click();
      await page.getByRole('button', { name: 'Close POSE setup', exact: true }).click(); await settle();
    }
    const initial = await snap(), sidebarWidth = await page.locator('.classic-sidebar').evaluate(element => element.getBoundingClientRect().width);
    assert.equal(await page.getByRole('dialog', { name: 'POSE setup', exact: true }).count(), 0); await shot('01-default');
    await page.getByLabel('Movement bone or node').selectOption('0');
    await page.getByRole('button', { name: 'POSE', exact: true }).click();
    const recognized = await page.evaluate(() => poseProbe().props.poseConfig); assert.deepEqual(recognized.chains.map(chain=>chain.end).sort((a,b)=>a-b),[29,32,38,42]); assert.equal(recognized.body,25);
    await page.getByRole('button',{name:'POSE setup',exact:true}).click(); await page.getByText('Custom limb…',{exact:true}).click();
    await page.getByRole('button',{name:'Suggest selected chain',exact:true}).click(); assert.match(await page.getByRole('alert').textContent(),/distinct/);
    assert.equal(await page.getByRole('button',{name:'Reload editor',exact:true}).count(),0); assert.deepEqual(await page.getByLabel('POSE root').inputValue(),'');
    await page.getByLabel('Movement bone or node').selectOption('39'); assert.equal(await page.getByRole('dialog',{name:'POSE setup',exact:true}).count(),1,'Object picker keeps Setup open');
    await page.getByRole('button',{name:'Close POSE setup',exact:true}).click();
    for (const [kind,id] of [['body',null],['node',33],['node',26],['node',39]]) {
      await tool('Select'); const handle=await handleFor(kind,id), box=await viewportBox(), depth=await historyDepth();
      await page.mouse.click(box.x+handle.labelX+3,box.y+handle.labelY);await settle();
      const target=await page.evaluate(()=>poseProbe().props.poseConfig.target);assert.equal(target.kind,kind);if(id!=null)assert.equal(target.id,id);assert.equal(await historyDepth(),depth);
    }
    results.checks.push('First-use root selection never crashes; one POSE click recognizes both hands/feet, head/chest/pelvis and whole-body root; Object picker does not dismiss Setup; overlapping body/chest/pelvis labels are independently clickable');
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
    await page.getByLabel('Movement bone or node').selectOption(''); await page.getByRole('button', { name: 'POSE setup', exact: true }).click(); assert.match(await page.getByRole('alert').textContent(), /uniform|shear/i); await page.getByRole('button', { name: 'Close POSE setup', exact: true }).click();
    for (let index = 0; index < 2; index++) { await menu('undo'); await settle(); } assert.deepEqual((await snap()).model, beforeUnsupported.model); results.checks.push('Setup explains an unsupported nonuniform ancestor after an ordinary bone edit');
    await selectHandle('endpoint', 38); const beforeNoOp = await snap(); await tool('Move'); await drag('endpoint', 38, 0, 0); assert.deepEqual(await snap(), beforeNoOp, 'returning to IK does not author or snap');
    const noOpHandle = await handleFor('endpoint', 38), noOpBox = await viewportBox(), noOpDepth = await historyDepth(), noOpX = noOpBox.x + noOpHandle.x + 13, noOpY = noOpBox.y + noOpHandle.y;
    await page.mouse.move(noOpX, noOpY); await page.mouse.down(); await page.mouse.move(noOpX - 6, noOpY - 6, { steps: 5 }); await settle(); await page.mouse.move(noOpX, noOpY, { steps: 5 }); await settle(); await page.mouse.up(); await settle(); assert.deepEqual(await snap(), beforeNoOp); assert.equal(await historyDepth(), noOpDepth, 'dragging back to the grip is a no-op');
    await drag('endpoint', 38, 6, -6); const hybrid = await snap(); assert.equal(hybrid.undo, fk.undo + 1); results.checks.push('IK → ordinary chest Rotate with POSE visible → IK has no transition keys or stale target');
    await tool('Rotate'); await drag('endpoint', 38, 10, 0); const turn = await snap(); assert.equal(turn.undo, hybrid.undo + 1); await tool('Move'); await drag('bend', 38, 12, -6); const bend = await snap(); assert.equal(bend.undo, turn.undo + 1); await shot('03-turn-bend');
    await add(29, 'leg'); await add(32, 'leg'); await tool('Move'); await drag('endpoint', 29, 0, -5); const leg = await snap(); assert.equal(leg.undo, bend.undo + 1);
    await page.getByRole('button', { name: 'POSE setup', exact: true }).click(); await page.getByText('Body node…',{exact:true}).click(); await page.getByRole('button', { name: 'Suggest body', exact: true }).click(); await page.getByRole('button', { name: 'Confirm body', exact: true }).click(); assert.equal(await page.getByLabel('POSE body node').inputValue(), '25'); await page.getByRole('button', { name: 'Close POSE setup', exact: true }).click();
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
    await page.getByRole('button',{name:'POSE setup',exact:true}).click();await page.getByLabel('POSE object').selectOption('43');await page.getByRole('button',{name:'Add object handle',exact:true}).click();await page.getByRole('button',{name:'Close POSE setup',exact:true}).click();
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
      const camera = new ObjectLoader().parse(data.camera); camera.updateMatrixWorld(true); const axes = plane === 'XY' ? [0, 1] : plane === 'ZX' ? [0, 2] : [1, 2], origin = h.world.clone().project(camera);
      const basis = axes.map(axis => { const end = h.world.clone(); end.setComponent(axis, end.getComponent(axis) + 1); end.project(camera); return [(end.x - origin.x) * b.width / 2, (origin.y - end.y) * b.height / 2]; });
      const scale = pointerSensitivityValue(data.sensitivity), offset = projectedPlaneTranslation(plane.toLowerCase(), basis, -4 * scale, -3 * scale, shift);
      const expected = solvePoseLimb(before.model, h.chain, 500, 0, h.world.clone().add({ x: offset[0], y: offset[1], z: offset[2] }));
      if (shift) await page.keyboard.down('Shift'); await drag('endpoint', 38, -4, -3); if (shift) await page.keyboard.up('Shift'); const after = samplePoseChain((await snap()).model, h.chain, 500, 0); assert.ok(after.end.distanceTo(expected.pose.end) < .004, plane + ' follows ordinary projected workplane');
    }
    await page.getByLabel('Workplane', { exact: true }).uncheck();
    await page.getByRole('checkbox', { name: 'Translation', exact: true }).check(); const translationLocked = await snap(); await drag('endpoint', 38, 4, -3); assert.equal((await snap()).undo, translationLocked.undo + 1, 'Translation lock permits limb rotation-only Move');
    await page.getByRole('checkbox', { name: 'Rotation', exact: true }).check(); const rotationLocked = await snap(); await drag('endpoint', 38, 4, -3); assert.deepEqual(await snap(), rotationLocked);
    await page.getByRole('checkbox', { name: 'Rotation', exact: true }).uncheck(); const bodyLocked = await snap(); await selectHandle('body'); assert.ok(await page.getByRole('group', { name: 'Movement tool', exact: true }).getByRole('button', { name: 'Move', exact: true }).isDisabled()); assert.deepEqual(await snap(), bodyLocked);
    await page.getByRole('checkbox', { name: 'Translation', exact: true }).uncheck(); results.checks.push('Textured preview, XY/ZX/YZ workplanes, edge-on views, Shift constraints, and native Rotation/Translation restrictions use existing Movement behavior');
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
    assert.equal(hash(fixture), fixtureHash); for (const [name, expected] of Object.entries(results.textureHashes)) assert.equal(hash(path.join(out, 'Textures', name)), expected);
    assert.deepEqual(errors, []); results.errors = errors; fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(results, null, 2)); console.log(JSON.stringify(results, null, 2));
  } catch (error) { await (await app.firstWindow()).screenshot({ path: path.join(out, 'failure.png') }); throw error; }
  finally { await app.evaluate(({ app }) => app.exit(0)); }
})().catch(error => { console.error(error); process.exitCode = 1; });

function hash(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
