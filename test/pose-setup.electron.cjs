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
  const root = process.cwd(), out = path.resolve(process.env.MDLXL_POSE_OUT || 'out/pose-setup-ui'), fixture = path.resolve(process.env.MDLXL_POSE_FIXTURE || 'out/pose-complex-fixtures/WH_WOC_KurganWarlord3.mdx');
  const executablePath = path.resolve(process.env.MDLXL_POSE_EXE || 'D:/MDLxL-Tests/pose-setup-ready/MDLxL-win32-x64/MDLxL.exe');
  fs.mkdirSync(out, { recursive: true });
  for (const entry of fs.readdirSync(path.dirname(fixture), {withFileTypes:true})) if (entry.isDirectory()) fs.cpSync(path.join(path.dirname(fixture),entry.name),path.join(out,entry.name),{recursive:true});
  const sourceModel = openDocument(fs.readFileSync(fixture)).model, sequence = sourceModel.Sequences.findIndex(s=>/^stand(?:\s|$)/i.test(s.Name)), frame = sourceModel.Sequences[sequence].Interval[0];
  const fixtureHash = hash(fixture), errors = [], results = { fixture, fixtureHash, executablePath, executableHash: hash(executablePath), checks: [], measurements: [] };
  const dist = path.join(path.dirname(executablePath), 'resources/app/dist'), bundle = crypto.createHash('sha256');
  for (const name of fs.readdirSync(path.join(dist, 'assets')).sort()) bundle.update(name).update(fs.readFileSync(path.join(dist, 'assets', name)));
  results.bundle = { indexHash: hash(path.join(dist, 'index.html')), assetsHash: bundle.digest('hex') };
  results.textureHashes = Object.fromEntries(fs.readdirSync(path.join(out, 'Textures')).map(name => [name, hash(path.join(out, 'Textures', name))]));
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
    const snap = () => page.evaluate(() => poseSnapshot());
    const settle = () => page.waitForTimeout(180);
    const tool = name => page.getByRole('group', { name: 'Movement tool', exact: true }).getByRole('button', { name, exact: true }).click();
    const shot = name => page.screenshot({ path: path.join(out, name + '.png') });
    const menu = command => command === 'undo' ? page.keyboard.press('Control+z') : command === 'redo' ? page.keyboard.press('Control+y') : app.evaluate(({ BrowserWindow }, command) => { BrowserWindow.getAllWindows()[0].webContents.send('menu', command); return true; }, command);
    const viewportBox = () => page.locator('[data-clean-model-canvas]').boundingBox();
    async function handles() {
      const data = await page.evaluate(() => { const { runtime, props } = poseProbe(), canvas = document.querySelector('[data-clean-model-canvas]'); return { model: poseSnapshot().model, config: props.poseConfig, frame: runtime.native.getFrame(), sequence: props.sequenceIndex, camera: runtime.controls.object.toJSON(), width: canvas.clientWidth, height: canvas.clientHeight }; });
      const camera = new ObjectLoader().parse(data.camera); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
      return projectPoseHandles(data.model, data.config, data.frame, data.sequence, camera, data.width, data.height);
    }
    async function handleFor(kind, endpoint) { const points = await handles(); const result = points.find(handle => !handle.marker && handle.kind === kind && (endpoint == null || (kind === 'node' ? handle.id : handle.chain?.end) === endpoint)); assert.ok(result?.visible, `Visible ${kind} ${endpoint}`); return result; }
    const historyDepth = () => page.evaluate(() => poseProbe().session.doc.historyStats.undoSteps);
    async function drag(kind, endpoint, dx, dy, cancel = false) {
      let handle = await handleFor(kind, endpoint);
      const selected = await page.evaluate(() => poseProbe().props.poseConfig.target);
      if (selected?.kind !== kind || selected.marker || (kind === 'node' ? selected.id !== handle.id : handle.key && selected.key !== handle.key)) {
        const box = await viewportBox(); await page.mouse.click(box.x + handle.labelX + 3, box.y + handle.labelY); await settle(); handle = await handleFor(kind, endpoint);
      }
      const before = await snap(), depth = await historyDepth();
      const nativeBefore=await page.evaluate(()=>poseProbe().runtime.native.rendererData.nodes.filter(Boolean).map(n=>[n.node.ObjectId,Array.from(n.matrix)]));
      const h = handle, b = await viewportBox(), x = b.x + h.x, y = b.y + h.y;
      await page.mouse.move(x, y); const gestureStart=Date.now(); await page.mouse.down(); await page.mouse.move(x + dx, y + dy, { steps: 8 }); await settle();
      const gestureMs=Date.now()-gestureStart;
      const during = await snap(); assert.deepEqual(during, before, 'every pointer preview is isolated'); assert.equal(await historyDepth(), depth);
      const preview = await page.evaluate(() => { const { runtime, props } = poseProbe(); return { model: posePlain(runtime.native.model), matrices: runtime.native.rendererData.nodes.filter(Boolean).map(node => [node.node.ObjectId, Array.from(node.matrix)]), camera: runtime.controls.object.toJSON(), sequence: props.sequenceIndex, frame: runtime.native.getFrame(), status: document.querySelector('.game-preview-root [role=status]')?.textContent }; });
      results.measurements.push({kind,endpoint,dx,dy,status:preview.status,revision:before.revision,gestureMs});
      fs.writeFileSync(path.join(out,'progress.json'),JSON.stringify(results,null,2));
      let meshMoved = false;
      if (preview.status && !/restricted|out of reach|cannot|invalid|unsupported|failed/i.test(preview.status)) {
        const camera = new ObjectLoader().parse(preview.camera); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
        const matrices = samplePreviewMatrices(preview.model, preview.frame, preview.sequence, preview.frame, camera);
        results.hiddenSingularNodes = preview.matrices.filter(([id]) => matrices.has(id) && Math.abs(matrices.get(id).determinant()) <= 1e-18).map(([id])=>id);
        const sourceMatrices = samplePreviewMatrices(before.model,preview.frame,preview.sequence,preview.frame,camera), priorNative=new Map(nativeBefore);
        const baselineError = id => Math.max(...priorNative.get(id).map((v,i)=>Math.abs(v-sourceMatrices.get(id).elements[i])));
        results.preExistingMatrixMaxError = Math.max(results.preExistingMatrixMaxError||0,...preview.matrices.filter(([id])=>sourceMatrices.has(id)).map(([id])=>baselineError(id)));
        const differences = preview.matrices.filter(([id]) => matrices.has(id) && Math.abs(matrices.get(id).determinant()) > 1e-18).map(([id, native]) => ({ id, error: Math.max(...native.map((value, i) => Math.abs(value - matrices.get(id).elements[i]))) })).filter(item => item.error >= baselineError(item.id) + .004);
        results.previewMatrixMaxError = Math.max(results.previewMatrixMaxError || 0, ...preview.matrices.filter(([id]) => matrices.has(id) && Math.abs(matrices.get(id).determinant()) > 1e-18).flatMap(([id, native]) => native.map((value, i) => Math.abs(value - matrices.get(id).elements[i]))));
        if(differences.length) fs.writeFileSync(path.join(out,'matrix-mismatch.json'),JSON.stringify({before:before.model,preview,nativeBefore,differences},null,2));
        assert.deepEqual(differences, [], 'drag introduces no native mesh/marker disagreement beyond the recorded untouched baseline');
        const source = samplePreviewMatrices(before.model, preview.frame, preview.sequence, preview.frame, camera);
        meshMoved = preview.model.Geosets.some(geoset => { const posed = skinGeoset(geoset, matrices), old = skinGeoset(geoset, source); return posed.some((value, i) => Math.abs(value - old[i]) > .00001); });
      }
      if (cancel) await page.keyboard.press('Escape'); await page.mouse.up(); await settle();
      const changed = (await snap()).revision > before.revision;
      if(!changed&&!cancel)fs.writeFileSync(path.join(out,'no-change.json'),JSON.stringify({kind,endpoint,dx,dy,before,preview,config:await page.evaluate(()=>poseProbe().props.poseConfig),origin:h.world},null,2));
      assert.equal(await historyDepth(), depth + (changed ? 1 : 0), 'one effective drag is one complete undo action');
      if (changed && !meshMoved) {
        assert.equal(kind,'node','an effective limb gesture deforms the actual preview mesh');
        const camera=new ObjectLoader().parse(preview.camera);camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);const old=samplePreviewMatrices(before.model,preview.frame,preview.sequence,preview.frame,camera).get(endpoint);
        const target=preview.matrices.find(([id])=>id===endpoint)?.[1];assert.ok(target?.some((value,i)=>Math.abs(value-old.elements[i])>1e-5),'a direct reference control moves its actual native matrix');
      } return during;
    }


    const targetNow=()=>page.evaluate(()=>poseProbe().props.poseConfig.target);
    const isTarget=(target,kind,h)=>target?.kind===kind&&!target.marker&&(kind==='node'?target.id===h.id:!h.key||target.key===h.key);
    async function selectHandle(kind,id) {
      await tool('Select'); const h=await handleFor(kind,id),b=await viewportBox();
      const visited=[];
      for(let i=0;i<45;i++) { visited.push(await targetNow()); if(isTarget(await targetNow(),kind,h))return; await page.mouse.click(b.x+h.x,b.y+h.y);await settle(); }
      fs.writeFileSync(path.join(out,'pick-mismatch.json'),JSON.stringify({kind,id,h,b,visited,handles:await handles()},null,2));
      throw Error('Cannot pick '+kind+' '+id+' through overlapping controls');
    }
    async function grab(kind,id,dx,dy) { await selectHandle(kind,id);await tool('Move');await drag(kind,id,dx,dy); }
    const {projectMovementNodes}=await import('../app/movement-overlay.js');
    async function pickBone(id) {
      const data=await page.evaluate(()=>({model:poseSnapshot().model,camera:poseProbe().runtime.controls.object.toJSON(),width:document.querySelector('[data-clean-model-canvas]').clientWidth,height:document.querySelector('[data-clean-model-canvas]').clientHeight}));
      const camera=new ObjectLoader().parse(data.camera);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
      const point=projectMovementNodes(data.model,frame,sequence,camera,data.width,data.height,frame).find(p=>p.node.ObjectId===id),box=await viewportBox();assert.ok(point?.visible,'bone '+id+' is in view');
      for(let attempt=0;attempt<50;attempt++){await page.mouse.click(box.x+point.x,box.y+point.y);await settle();const ids=await page.evaluate(()=>poseProbe().props.selectedNodeIds);if(ids.length===1&&ids[0]===id)return;}
      throw Error('Cannot cycle to bone '+id);
    }
    const configNow=()=>page.evaluate(()=>poseProbe().props.poseConfig);
    await page.getByLabel('View direction',{exact:true}).selectOption('front');
    await page.getByLabel('Render mode',{exact:true}).selectOption('textured');
    await page.getByRole('checkbox',{name:'Bones',exact:true}).uncheck();
    await page.getByLabel('Workplane',{exact:true}).uncheck();
    await page.getByRole('checkbox',{name:'Emitters',exact:true}).uncheck();
    await tool('Select');await page.getByRole('button',{name:'POSE',exact:true}).click();await settle();
    const initial=await snap(),baseline=await configNow(),sidebar=await page.locator('.classic-sidebar').evaluate(e=>e.getBoundingClientRect().width);
    const names=new Map(allNodes(initial.model).map(node=>[node.ObjectId,node.Name]));
    const setup=async()=>{await page.getByRole('button',{name:'POSE setup',exact:true}).click();if(await page.locator('.pose-adjust').count())await page.locator('.pose-adjust > summary').click();};
    const closeSetup=()=>page.getByRole('button',{name:'Close POSE setup',exact:true}).click();
    const adjust=async()=>{if(!await page.locator('.pose-adjust').evaluate(e=>e.open))await page.locator('.pose-adjust > summary').click();};
    const bound=async key=>{await adjust();await page.getByRole('button',{name:'Pick '+key,exact:true}).click();};
    const save=()=>page.getByRole('button',{name:'Save changes',exact:true}).click();
    const assertMappingOnly=async()=>{const state=await snap();assert.deepEqual(state.model,initial.model);assert.equal(state.undo,initial.undo);};
    if (process.env.MDLXL_POSE_ADD_SETUP) {
      const add=()=>page.getByRole('button',{name:'Add POSE handle',exact:true}).click();
      await add();assert.equal(await page.getByRole('button',{name:'Map Hoof',exact:true}).isVisible(),true);await shot('01-add-direct');
      for(const id of [27,28]) {await page.getByRole('button',{name:'Map Hoof',exact:true}).click();await pickBone(id);await page.getByRole('button',{name:'Add handle',exact:true}).click();}
      assert.deepEqual((await configNow()).chains.map(c=>c.joints),[[35,42,21,27],[36,14,22,28]]);
      await page.getByRole('button',{name:'Map Pelvis',exact:true}).click();await pickBone(2);
      const beforeCamera=await page.evaluate(()=>poseProbe().runtime.controls.object.toJSON()),box=await viewportBox();
      await page.keyboard.down('Alt');await page.mouse.move(box.x+box.width*.2,box.y+box.height*.65);await page.mouse.down();await page.mouse.move(box.x+box.width*.2+50,box.y+box.height*.65+15,{steps:8});await settle();
      assert.equal(await page.getByRole('dialog',{name:'POSE setup',exact:true}).count(),1,'window stays mounted during rotation');assert.deepEqual((await configNow()).inspectIds,[2]);
      await page.mouse.up();await page.keyboard.up('Alt');await settle();assert.notDeepEqual(await page.evaluate(()=>poseProbe().runtime.controls.object.toJSON()),beforeCamera);
      assert.equal(await page.getByRole('button',{name:'Add handle',exact:true}).isEnabled(),true);await shot('02-rotation-keeps-draft');
      await page.getByRole('button',{name:'Add handle',exact:true}).click();await closeSetup();await assertMappingOnly();
      await setup();assert.equal(await page.getByRole('button',{name:'Map Hoof',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'+ New bone chain',exact:true}).count(),0);await page.getByRole('button',{name:'Handles',exact:true}).click();
      assert.equal(await page.getByRole('button',{name:'Edit Hoof: '+names.get(27),exact:true}).isVisible(),true);await shot('03-setup-only-existing');await closeSetup();
      for(const id of [27,28]) {
        await selectHandle('endpoint',id);const h=await handleFor('endpoint',id),b=await viewportBox(),pin=page.getByRole('button',{name:'Pin selected foot',exact:true});
        const rect=await pin.boundingBox();assert.ok(Math.abs(rect.x-(b.x+h.x))<70 && Math.abs(rect.y-(b.y+h.y))<50,'Pin is beside the selected hoof');assert.equal(await page.locator('.pose-controls [aria-label="Pin selected foot"]').count(),0);
        await pin.click();await settle();assert.ok((await configNow()).pins.includes('limb:'+id));assert.equal(await pin.getAttribute('aria-pressed'),'true');await shot('04-pin-next-to-hoof-'+id);
        await pin.click();await settle();assert.ok(!(await configNow()).pins.includes('limb:'+id));await assertMappingOnly();
      }
      if (process.env.MDLXL_POSE_BLOCKER) {
        await selectHandle('endpoint',27);await page.getByRole('button',{name:'Pin selected foot',exact:true}).click();await settle();
        await selectHandle('node',2);await tool('Move');const h=await handleFor('node',2),b=await viewportBox(),before=await snap();
        await page.mouse.move(b.x+h.x,b.y+h.y);await page.mouse.down();await page.mouse.move(b.x+h.x,b.y+h.y-500,{steps:8});await settle();
        const blockers=await page.locator('[data-node-overlay]').getAttribute('data-pose-blockers');
        assert.deepEqual(JSON.parse(blockers),[{kind:'endpoint',key:'limb:27'}],'only the pinned hoof blocking this move is pinged');
        assert.deepEqual(await snap(),before,'ping adds no document or history changes');await shot('05-red-blocker-crosshair');
        await page.mouse.up();await menu('undo');await settle();assert.deepEqual((await snap()).model,initial.model);
        await page.waitForTimeout(1350);assert.deepEqual(JSON.parse(await page.locator('[data-node-overlay]').getAttribute('data-pose-blockers')),[],'ping fades away');
        await selectHandle('endpoint',27);await page.getByRole('button',{name:'Pin selected foot',exact:true}).click();await settle();
        results.checks.push('Dragging pelvis beyond pinned hoof reach pings only that hoof in red; feedback fades and introduces no history edit');
      }
      await selectHandle('node',2);assert.equal(await page.locator('[data-pose-pin]').count(),0);
      await grab('endpoint',27,10,-8);assert.ok((await snap()).revision>initial.revision);await menu('undo');await settle();assert.deepEqual((await snap()).model,initial.model);
      assert.equal(await page.locator('.classic-sidebar').evaluate(e=>e.getBoundingClientRect().width),sidebar);
      results.checks.push('Add opens all new handle types directly; two hooves and pelvis added consecutively with actual bone clicks', 'Alt-mouse rotation keeps the Add window and picked pelvis draft mounted during and after the gesture', 'Setup contains only existing handles and their editing controls', 'Pin follows the selected hoof in the viewport, toggles without keys/history, and disappears on pelvis selection', 'Native posing, exact Undo, camera rotation and sidebar width remain valid');
      assert.equal(hash(fixture),fixtureHash);assert.deepEqual(errors,[]);results.errors=errors;fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));return;
    }
    if (process.env.MDLXL_POSE_WAG) {
      await setup();await shot('01-quiet-setup');
      assert.equal(await page.getByRole('button',{name:'Map Hoof',exact:true}).isVisible(),false);
      await page.getByRole('button',{name:'Add POSE handle',exact:true}).click();await page.getByRole('button',{name:'+ New bone chain',exact:true}).click();await pickBone(27);
      assert.deepEqual((await configNow()).inspectIds,[35,42,21,27]);
      assert.equal(await page.getByRole('button',{name:'Pick Start',exact:true}).isVisible(),false);
      await shot('02-suggested-rear-leg');
      await pickBone(28);assert.deepEqual((await configNow()).inspectIds,[36,14,22,28]);await pickBone(27);assert.deepEqual((await configNow()).inspectIds,[35,42,21,27]);
      await bound('Start');await pickBone(2);await page.getByRole('button',{name:'Add handle',exact:true}).click();
      await page.getByRole('button',{name:'Add POSE handle',exact:true}).click();await page.getByRole('button',{name:'+ New bone chain',exact:true}).click();await pickBone(28);
      assert.deepEqual((await configNow()).inspectIds,[36,14,22,28]);
      await bound('Start');await pickBone(2);assert.equal(await page.getByRole('button',{name:'Add handle',exact:true}).isEnabled(),false);
      await shot('03-shared-start-assistance');await page.getByRole('button',{name:'Use separate limbs',exact:true}).click();
      await page.getByRole('button',{name:'Add handle',exact:true}).click();await closeSetup();
      assert.deepEqual((await configNow()).chains.map(c=>c.joints),[[35,42,21,27],[36,14,22,28]]);await assertMappingOnly();
      results.checks.push('WAG rear hooves are suggested from native branches; shared pelvis repair saves two independent chains through real bone clicks');
      const cameraBefore=await page.evaluate(()=>poseProbe().runtime.controls.object.toJSON()),box=await viewportBox();
      await page.mouse.move(box.x+box.width*.2,box.y+box.height*.65);await page.mouse.down({button:'right'});await page.mouse.move(box.x+box.width*.2+40,box.y+box.height*.65+15,{steps:6});await page.mouse.up({button:'right'});await settle();
      assert.notDeepEqual(await page.evaluate(()=>poseProbe().runtime.controls.object.toJSON()),cameraBefore);
      for(const id of [27,28]) {await grab('endpoint',id,10,-8);const posed=await snap();assert.ok(posed.revision>initial.revision);await menu('undo');await settle();assert.deepEqual((await snap()).model,initial.model);}
      await shot('04-two-rear-hooves');assert.equal(hash(fixture),fixtureHash);assert.deepEqual(errors,[]);
      results.checks.push('Both rear hoof handles independently pose and Undo exactly; actual camera rotation works; source and setup history remain unchanged');
      results.errors=errors;fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));return;
    }
    await shot('01-default');await setup();await shot('02-handles');

    assert.ok(await page.locator('.pose-mapped button').evaluateAll(buttons=>buttons.every(button=>button.clientHeight>=32&&button.scrollHeight<=button.clientHeight+1)),'handle rows fit their icon, role and bone name');
    assert.equal(await page.locator('.pose-setup select').count(),0);
    await page.getByRole('button',{name:'Add POSE handle',exact:true}).click();await page.getByRole('button',{name:'Map Hand',exact:true}).click();await pickBone(20);
    assert.equal(await page.getByRole('button',{name:'Add handle',exact:true}).isEnabled(),false);
    await pickBone(16);assert.deepEqual((await configNow()).inspectIds,[12,13,14,16]);
    await bound('Start');await pickBone(9);assert.match(await page.locator('.pose-setup [role=status]').textContent(),/same bone branch/);
    assert.equal(await page.getByRole('button',{name:'Add handle',exact:true}).isEnabled(),false);
    await pickBone(12);await page.getByRole('button',{name:'Replace handle',exact:true}).click();await closeSetup();await assertMappingOnly();
    results.checks.push('Quick endpoint suggestion exposes all four joints; invalid roots stay editable and can be corrected without restarting');
    await page.getByRole('button',{name:'Pin selected hand',exact:true}).click();
    await setup();assert.match(await page.getByRole('button',{name:'Pick Start',exact:true}).textContent(),new RegExp(names.get(12)));
    const joint=id=>page.getByRole('checkbox',{name:'Use joint '+names.get(id),exact:true});
    await joint(13).uncheck();await shot('03-edit-bending-joints');await save();await closeSetup();
    assert.deepEqual((await configNow()).chains.find(c=>c.end===16).joints,[12,14,16]);assert.ok((await configNow()).pins.includes('limb:16'));
    await setup();await joint(14).uncheck();assert.equal(await page.getByRole('button',{name:'Save changes',exact:true}).isEnabled(),false);assert.match(await page.locator('.pose-setup [role=status]').textContent(),/at least one bending joint/);
    await joint(13).check();await joint(14).check();await save();await closeSetup();
    await setup();await bound('End');await pickBone(14);await save();await closeSetup();
    assert.ok(!(await configNow()).chains.some(c=>c.end===16));assert.ok((await configNow()).chains.some(c=>c.end===14));assert.ok(!(await configNow()).pins.includes('limb:16'));
    await setup();await bound('End');await pickBone(16);await save();await closeSetup();
    assert.deepEqual((await configNow()).chains.find(c=>c.end===16).joints,[12,13,14,16]);
    results.checks.push('Existing handles reopen for editing; bending joints and End are editable, pins survive same-end edits, and retargeting removes stale mappings');
    await setup();await bound('Start');await pickBone(9);await page.getByRole('button',{name:'Cancel',exact:true}).click();
    assert.deepEqual((await configNow()).chains.find(c=>c.end===16).joints,[12,13,14,16]);
    await page.getByRole('button',{name:'POSE setup',exact:true}).click();await page.getByRole('button',{name:'Handles',exact:true}).click();await page.getByRole('button',{name:'Edit Hand: '+names.get(16),exact:true}).click();await page.getByRole('button',{name:'Remove handle',exact:true}).click();
    assert.equal((await configNow()).chains.length,baseline.chains.length-1);
    await page.getByRole('button',{name:'Add POSE handle',exact:true}).click();await page.getByRole('button',{name:'+ New bone chain',exact:true}).click();await pickBone(16);
    await shot('04-new-chain');assert.deepEqual((await configNow()).inspectIds,[12,13,14,16]);
    const panel=await page.locator('.pose-setup').boundingBox();await page.mouse.move(panel.x+70,panel.y+12);await page.mouse.down();await page.mouse.move(panel.x-250,panel.y+32,{steps:6});await page.mouse.up();await settle();
    assert.ok((await page.locator('.pose-setup').boundingBox()).x<panel.x-100,'Setup can move away from bones');
    const cameraBefore=await page.evaluate(()=>poseProbe().runtime.controls.object.toJSON()),box=await viewportBox();
    await page.mouse.move(box.x+box.width*.2,box.y+box.height*.65);await page.mouse.down({button:'right'});await page.mouse.move(box.x+box.width*.2+40,box.y+box.height*.65+15,{steps:6});await page.mouse.up({button:'right'});await settle();
    assert.notDeepEqual(await page.evaluate(()=>poseProbe().runtime.controls.object.toJSON()),cameraBefore);assert.equal(await page.getByRole('button',{name:'Add handle',exact:true}).isEnabled(),true);await shot('05-moved-setup');
    await page.getByRole('button',{name:'Add handle',exact:true}).click();await closeSetup();
    const custom=(await configNow()).chains.find(c=>c.end===16);assert.equal(custom.label,'Chain');assert.deepEqual(custom.joints,[12,13,14,16]);
    assert.deepEqual((await configNow()).chains.filter(c=>c.end!==16),baseline.chains.filter(c=>c.end!==16));await assertMappingOnly();
    assert.equal(await page.getByRole('checkbox',{name:'Bones',exact:true}).isChecked(),false);assert.equal(await page.locator('.classic-sidebar').evaluate(e=>e.getBoundingClientRect().width),sidebar);
    results.checks.push('A four-joint custom chain can be built from scratch with actual bone clicks; Cancel, Remove, overlap cycling, movable Setup and camera rotation preserve the model and other handles');
    await grab('endpoint',16,12,-10);const posed=await snap();assert.ok(posed.revision>initial.revision);await menu('undo');await settle();assert.deepEqual((await snap()).model,initial.model);await menu('redo');await settle();assert.deepEqual((await snap()).model,posed.model);await shot('06-custom-chain-posed');
    results.checks.push('The manually created chain actually poses its limb, creates one native edit, and supports exact Undo/Redo');
    assert.equal(hash(fixture),fixtureHash);assert.deepEqual(errors,[]);results.errors=errors;fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
  } catch(error){await (await app.firstWindow()).screenshot({path:path.join(out,'failure.png')});throw error;} finally{await app.evaluate(({app})=>app.exit(0));}
})().catch(error=>{console.error(error);process.exitCode=1;});
function hash(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
