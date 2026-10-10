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
  for (const entry of fs.readdirSync(path.dirname(fixture), {withFileTypes:true})) if (entry.isDirectory() || /\.(?:blp|dds|tga|png|jpe?g)$/i.test(entry.name)) fs.cpSync(path.join(path.dirname(fixture),entry.name),path.join(out,entry.name),{recursive:true});
  const sourceModel = openDocument(fs.readFileSync(fixture)).model, sequence = Math.max(0, sourceModel.Sequences.findIndex(s=>/^stand(?:\s|$)/i.test(s.Name))), frame = sourceModel.Sequences[sequence].Interval[0];
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
    const points=model=>{const matrices=sampleNodeMatrices(model,frame,sequence,frame);return new Map(allNodes(model).map(n=>[n.ObjectId,new Vector3(...n.PivotPoint).applyMatrix4(matrices.get(n.ObjectId))]));};
    await page.getByLabel('View direction',{exact:true}).selectOption('right');
    await page.getByLabel('Render mode',{exact:true}).selectOption('textured');
    {const b=await viewportBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.wheel(0,-480);await settle();await page.mouse.move(b.x+b.width*.25,b.y+b.height*.3);await page.mouse.down({button:'right'});await page.mouse.move(b.x+b.width*.25+48,b.y+b.height*.3+16,{steps:6});await page.mouse.up({button:'right'});await settle();}
    await page.getByRole('checkbox',{name:'Bones',exact:true}).uncheck();
    await page.getByLabel('Workplane',{exact:true}).uncheck();
    await page.getByRole('button',{name:'POSE',exact:true}).click();await settle();
    const initial=await snap(),config=await page.evaluate(()=>poseProbe().props.poseConfig),sidebar=await page.locator('.classic-sidebar').evaluate(e=>e.getBoundingClientRect().width);
    results.mapping=config;await shot('01-auto-handles');
    await page.getByRole('checkbox',{name:'Emitters',exact:true}).uncheck();await tool('Select');
    await page.waitForTimeout(600);
    const hoverHandle=config.chains.length ? await handleFor('endpoint',config.chains[0].end) : await handleFor('body'),hoverBox=await viewportBox();
    const overlayPixels=()=>page.locator('[data-node-overlay]').evaluate((canvas,h)=>{const ratio=canvas.width/canvas.clientWidth,data=canvas.getContext('2d').getImageData(Math.round(h.labelX*ratio),Math.round((h.labelY-7)*ratio),Math.ceil(h.labelWidth*ratio),Math.ceil(14*ratio)).data;let alpha=0;for(let i=3;i<data.length;i+=4)alpha+=data[i];return alpha;},hoverHandle);
    await page.mouse.move(8,12);await settle();const quietOverlay=await overlayPixels();await page.mouse.move(hoverBox.x+hoverHandle.x,hoverBox.y+hoverHandle.y);await settle();const hoveredOverlay=await overlayPixels();assert.ok(hoveredOverlay>quietOverlay+5000,'hover label appears with bone markers hidden');await shot('01b-hover-label');await page.mouse.move(8,12);await settle();const clearedOverlay=await overlayPixels();results.hoverLabel={quietOverlay,hoveredOverlay,clearedOverlay};assert.ok(Math.abs(clearedOverlay-quietOverlay)<=1020,'hover label clears, allowing four pixels of antialiasing at nearby symbols');
    results.checks.push('Handle labels appear on hover with bone markers hidden and clear when the pointer leaves');
    const bodyIds=new Set([config.body,...Object.keys(config.carriers||{}).map(Number),...Object.values(config.followers||{}).flat()]);
    function articulated(before,after,tolerance=.65){const a=points(before),b=points(after);for(const c of config.chains.filter(c=>c.grip)){const ma=sampleNodeMatrices(before,frame,sequence,frame),mb=sampleNodeMatrices(after,frame,sequence,frame);a.set(c.end,new Vector3(...c.grip).applyMatrix4(ma.get(c.end)));b.set(c.end,new Vector3(...c.grip).applyMatrix4(mb.get(c.end)));}for(const n of allNodes(before))if(a.has(n.Parent)&&!bodyIds.has(n.ObjectId))assert.ok(Math.abs(a.get(n.ObjectId).distanceTo(a.get(n.Parent))-b.get(n.ObjectId).distanceTo(b.get(n.Parent)))<tolerance,'joint '+n.ObjectId+' remains attached');}
    async function checkedGrab(kind,id,dx,dy){const before=await snap();await grab(kind,id,dx,dy);const after=await snap();assert.ok(after.revision>before.revision,kind+' '+id+' responds');articulated(before.model,after.model);await menu('undo');await settle();assert.deepEqual((await snap()).model,before.model);await menu('redo');await settle();assert.deepEqual((await snap()).model,after.model);return after;}
    await checkedGrab('body',null,35,-35);await shot('02-whole-body');
    await checkedGrab('body',null,0,-85);await shot('03-jump');
    await checkedGrab('body',null,0,85);await shot('04-return');
    for(const id of config.nodes){await checkedGrab('node',id,14,-8);await shot('part-'+id);}
    for(const c of config.chains){await checkedGrab('endpoint',c.end,10,-8);await shot('limb-'+c.end);}
    results.checks.push('Whole body, repeated jump and return, every inferred part and limb respond to actual mouse drags, with connected joints and exact undo/redo');
    await page.getByRole('button',{name:'POSE setup',exact:true}).click();assert.equal(await page.locator('.pose-setup select').count(),0);await shot('05-visual-setup');await page.getByRole('button',{name:'Close POSE setup',exact:true}).click();
    for(const c of config.chains.filter(c=>c.grip)){await selectHandle('endpoint',c.end);await page.getByRole('button',{name:'POSE setup',exact:true}).click();await page.getByRole('button',{name:'Save changes',exact:true}).click();await page.getByRole('button',{name:'Close POSE setup',exact:true}).click();assert.deepEqual((await page.evaluate(()=>poseProbe().props.poseConfig)).chains.find(chain=>chain.key===c.key).grip,c.grip);}
    const playbackBefore=Number(await time.inputValue());await page.getByRole('button',{name:'Play',exact:true}).click();await page.waitForTimeout(400);await page.getByRole('button',{name:'Stop',exact:true}).click();assert.notEqual(Number(await time.inputValue()),playbackBefore,'native animation playback advances');await time.fill(String(frame));await time.press('Enter');await settle();
    const cameraBefore=await page.evaluate(()=>poseProbe().runtime.controls.object.toJSON()),box=await viewportBox();
    await page.keyboard.down('Alt');await page.mouse.move(box.x+box.width*.25,box.y+box.height*.3);await page.mouse.down();await page.mouse.move(box.x+box.width*.25+55,box.y+box.height*.3+20,{steps:8});await page.mouse.up();await page.keyboard.up('Alt');await settle();const cameraAfter=await page.evaluate(()=>poseProbe().runtime.controls.object.toJSON());assert.ok(new ObjectLoader().parse(cameraBefore).quaternion.angleTo(new ObjectLoader().parse(cameraAfter).quaternion)>.01,'normal Alt-mouse changes camera orientation');await shot('07-rotated');
    assert.equal(await page.locator('.classic-sidebar').evaluate(e=>e.getBoundingClientRect().width),sidebar);
    const edited=(await snap()).model,dest=path.join(out,'ragdoll-posed.mdx');await app.evaluate(({dialog},dest)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:dest});},dest);await menu('saveAs');await page.getByRole('button',{name:'Save MDX…',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('[role=dialog][aria-label="Save model"]') || /^Saved /.test(document.querySelector('.classic-status')?.textContent||''));
    const editorData=page.getByRole('dialog',{name:'Save model',exact:true});
    if(await editorData.isVisible()){assert.equal(await editorData.getByRole('checkbox').isChecked(),false,'keep existing editor data');await editorData.getByRole('button',{name:'Save',exact:true}).click();results.editorDataPreserved=true;}
    await page.waitForFunction(()=>/^Saved /.test(document.querySelector('.classic-status')?.textContent||''));
    await page.getByRole('dialog',{name:'Save as',exact:true}).waitFor({state:'hidden'});assertModelEquivalent(edited,openDocument(fs.readFileSync(dest)).model);
    await page.locator('.model-tab.active .model-tab-close').click();await settle();await app.evaluate(({dialog},dest)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[dest]});},dest);await menu('open');await settle();await menu('animation');await page.getByLabel('Movement current sequence').selectOption(String(sequence));await time.fill(String(frame));await time.press('Enter');await settle();assertModelEquivalent(edited,(await snap()).model);await shot('08-reopened');results.checks.push('Normal camera rotation, unchanged sidebar width, native MDX save and reopen, source model unchanged');
    assert.equal(hash(fixture),fixtureHash);assert.deepEqual(errors,[]);results.errors=errors;fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
  } catch(error){await (await app.firstWindow()).screenshot({path:path.join(out,'failure.png')});throw error;} finally{await app.evaluate(({app})=>app.exit(0));}
})().catch(error=>{console.error(error);process.exitCode=1;});
function hash(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
