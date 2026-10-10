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
  const root = process.cwd(), out = path.resolve(process.env.MDLXL_POSE_OUT || 'out/pose-ragdoll-ui'), fixture = path.resolve(process.env.MDLXL_POSE_FIXTURE || 'out/pose/Footman.mdx');
  const executablePath = path.resolve(process.env.MDLXL_POSE_EXE || 'out/pose-ragdoll-package/MDLxL-win32-x64/MDLxL.exe');
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
    await page.locator('[data-warmkey="animation"]').click(); await page.getByLabel('Movement current sequence').selectOption(process.env.MDLXL_POSE_KNIGHT ? '1' : '0');
    const time = page.getByLabel('Current animation frame'); await time.fill(process.env.MDLXL_POSE_KNIGHT ? '1667' : '167'); await time.press('Enter');
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
    const menu = command => command === 'undo' ? page.keyboard.press('Control+z') : command === 'redo' ? page.keyboard.press('Control+y') : app.evaluate(({ BrowserWindow }, command) => { BrowserWindow.getAllWindows()[0].webContents.send('menu', command); return true; }, command);
    const viewportBox = () => page.locator('[data-clean-model-canvas]').boundingBox();
    async function handles() {
      const data = await page.evaluate(() => { const { runtime, props } = poseProbe(), canvas = document.querySelector('[data-clean-model-canvas]'); return { model: poseSnapshot().model, config: props.poseConfig, frame: runtime.native.getFrame(), sequence: props.sequenceIndex, camera: runtime.controls.object.toJSON(), width: canvas.clientWidth, height: canvas.clientHeight }; });
      const camera = new ObjectLoader().parse(data.camera); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
      return projectPoseHandles(data.model, data.config, data.frame, data.sequence, camera, data.width, data.height);
    }
    async function handleFor(kind, endpoint) { const points = await handles(); const result = points.find(handle => !handle.marker && handle.kind === kind && (endpoint == null || (kind === 'node' ? handle.id : handle.chain?.end) === endpoint)); assert.ok(result?.visible, `Visible ${kind} ${endpoint}`); return result; }
    const historyDepth = () => page.evaluate(() => poseProbe().session.doc.historyStats.undoSteps);
    async function selectHandleLegacy(kind, endpoint) { const depth = await historyDepth(); await tool('Select'); const h = await handleFor(kind, endpoint), b = await viewportBox(); await page.mouse.click(b.x + h.labelX + 3, b.y + h.labelY); await settle(); assert.equal(await historyDepth(), depth, 'virtual selection creates no undo step'); }
    async function drag(kind, endpoint, dx, dy, cancel = false) {
      let handle = await handleFor(kind, endpoint);
      const selected = await page.evaluate(() => poseProbe().props.poseConfig.target);
      if (selected?.kind !== kind || selected.marker || (kind === 'node' ? selected.id !== handle.id : handle.key && selected.key !== handle.key)) {
        const box = await viewportBox(); await page.mouse.click(box.x + handle.labelX + 3, box.y + handle.labelY); await settle(); handle = await handleFor(kind, endpoint);
      }
      const before = await snap(), depth = await historyDepth();
      const nativeBefore=await page.evaluate(()=>poseProbe().runtime.native.rendererData.nodes.filter(Boolean).map(n=>[n.node.ObjectId,Array.from(n.matrix)]));
      const h = handle, b = await viewportBox(), x = b.x + h.x, y = b.y + h.y;
      await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + dx, y + dy, { steps: 8 }); await settle();
      const during = await snap(); assert.deepEqual(during, before, 'every pointer preview is isolated'); assert.equal(await historyDepth(), depth);
      const preview = await page.evaluate(() => { const { runtime, props } = poseProbe(); return { model: JSON.parse(JSON.stringify(runtime.native.model, (_key, value) => ArrayBuffer.isView(value) ? Array.from(value) : value)), matrices: runtime.native.rendererData.nodes.filter(Boolean).map(node => [node.node.ObjectId, Array.from(node.matrix)]), camera: runtime.controls.object.toJSON(), sequence: props.sequenceIndex, frame: runtime.native.getFrame(), status: document.querySelector('.game-preview-root [role=status]')?.textContent }; });
      results.measurements.push({kind,endpoint,dx,dy,status:preview.status,revision:before.revision});
      fs.writeFileSync(path.join(out,'progress.json'),JSON.stringify(results,null,2));
      let meshMoved = false;
      if (preview.status && !/restricted|out of reach|cannot|invalid|unsupported|failed/i.test(preview.status)) {
        const camera = new ObjectLoader().parse(preview.camera); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
        const matrices = samplePreviewMatrices(preview.model, preview.frame, preview.sequence, preview.frame, camera);
        results.hiddenSingularNodes = preview.matrices.filter(([id]) => matrices.has(id) && Math.abs(matrices.get(id).determinant()) <= 1e-18).map(([id])=>id);
        const differences = preview.matrices.filter(([id]) => matrices.has(id) && Math.abs(matrices.get(id).determinant()) > 1e-18).map(([id, native]) => ({ id, error: Math.max(...native.map((value, i) => Math.abs(value - matrices.get(id).elements[i]))) })).filter(item => item.error >= .004);
        results.previewMatrixMaxError = Math.max(results.previewMatrixMaxError || 0, ...preview.matrices.filter(([id]) => matrices.has(id) && Math.abs(matrices.get(id).determinant()) > 1e-18).flatMap(([id, native]) => native.map((value, i) => Math.abs(value - matrices.get(id).elements[i]))));
        if(differences.length) fs.writeFileSync(path.join(out,'matrix-mismatch.json'),JSON.stringify({before:before.model,preview,nativeBefore,differences},null,2));
        assert.deepEqual(differences, [], 'native mesh and marker matrices agree during preview');
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

    const knight=!!process.env.MDLXL_POSE_KNIGHT, sequence=knight?1:0, frame=knight?1667:167;
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
      const camera=new ObjectLoader().parse(data.camera);camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
      const p=projectMovementNodes(data.model,frame,sequence,camera,data.width,data.height,frame).find(p=>p.node.ObjectId===id),b=await viewportBox();assert.ok(p?.visible);
      for(let i=0;i<50;i++){await page.mouse.click(b.x+p.x,b.y+p.y);await settle();const ids=await page.evaluate(()=>poseProbe().props.selectedNodeIds);if(ids.length===1&&ids[0]===id)return;}
      throw Error('Cannot pick bone '+id);
    }
    const points=model=>{const matrices=sampleNodeMatrices(model,frame,sequence,frame);return new Map(allNodes(model).map(n=>[n.ObjectId,new Vector3(...n.PivotPoint).applyMatrix4(matrices.get(n.ObjectId))]));};
    function connected(before,after,tolerance=.006){const a=points(before),b=points(after);for(const n of allNodes(before))if(a.has(n.Parent))assert.ok(Math.abs(a.get(n.ObjectId).distanceTo(a.get(n.Parent))-b.get(n.ObjectId).distanceTo(b.get(n.Parent)))<tolerance,'joint '+n.ObjectId+' remains connected');}
    await page.getByLabel('View direction',{exact:true}).selectOption(knight?'right':'front');
    await page.getByLabel('Render mode',{exact:true}).selectOption('textured');
    {const b=await viewportBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.wheel(0,-260);await settle();}
    await page.getByRole('checkbox',{name:'Bones',exact:true}).uncheck();
    await page.getByLabel('Workplane',{exact:true}).uncheck();
    await page.getByRole('button',{name:'POSE',exact:true}).click();await settle();
    const initial=await snap(),config=await page.evaluate(()=>poseProbe().props.poseConfig),sidebar=await page.locator('.classic-sidebar').evaluate(e=>e.getBoundingClientRect().width);
    results.mapping=config;await shot('01-auto-handles');
    await page.getByRole('checkbox',{name:'Emitters',exact:true}).uncheck();await tool('Select');
    await page.waitForTimeout(600);
    const hoverHandle=await handleFor('endpoint',config.chains[0].end),hoverBox=await viewportBox();
    const overlayPixels=()=>page.locator('[data-node-overlay]').evaluate((canvas,h)=>{const ratio=canvas.width/canvas.clientWidth,data=canvas.getContext('2d').getImageData(Math.round(h.labelX*ratio),Math.round((h.labelY-7)*ratio),Math.ceil(h.labelWidth*ratio),Math.ceil(14*ratio)).data;let alpha=0;for(let i=3;i<data.length;i+=4)alpha+=data[i];return alpha;},hoverHandle);
    await page.mouse.move(8,12);await settle();const quietOverlay=await overlayPixels();await page.mouse.move(hoverBox.x+hoverHandle.x,hoverBox.y+hoverHandle.y);await settle();const hoveredOverlay=await overlayPixels();assert.ok(hoveredOverlay>quietOverlay+5000,'hover label appears with bone markers hidden');await shot('01b-hover-label');await page.mouse.move(8,12);await settle();const clearedOverlay=await overlayPixels();results.hoverLabel={quietOverlay,hoveredOverlay,clearedOverlay};assert.ok(Math.abs(clearedOverlay-quietOverlay)<=1020,'hover label clears, allowing four pixels of antialiasing at nearby symbols');
    results.checks.push('Handle labels appear on hover with bone markers hidden and clear when the pointer leaves');
    assert.equal(config.chains.length,knight?8:4);assert.equal(config.chains.filter(c=>c.label==='Hoof').length,knight?4:0);
    if(!knight){
      await page.getByRole('button',{name:'POSE setup',exact:true}).click();assert.equal(await page.locator('.pose-setup select').count(),0);
      await page.getByRole('button',{name:'Add POSE handle',exact:true}).click();await page.getByRole('button',{name:'Map Hand',exact:true}).click();await pickBone(0);assert.equal(await page.getByRole('button',{name:'Add handle',exact:true}).isEnabled(),false);assert.equal(await page.getByRole('button',{name:'Reload editor',exact:true}).count(),0);
      await pickBone(38);assert.equal(await page.getByRole('button',{name:'Replace handle',exact:true}).isEnabled(),true);assert.deepEqual(await page.evaluate(()=>poseProbe().props.poseConfig.inspectIds),[36,37,38]);await shot('02-pick-hand');
      await page.getByRole('button',{name:'Replace handle',exact:true}).click();await page.getByRole('button',{name:'Close POSE setup',exact:true}).click();assert.deepEqual((await snap()).model,initial.model);assert.equal((await snap()).undo,initial.undo);
      await page.getByRole('button',{name:'POSE setup',exact:true}).click();
      await page.getByText('Adjust chain',{exact:true}).click();await page.getByRole('button',{name:'Pick Start',exact:true}).click();await pickBone(36);
      await page.getByRole('button',{name:'Pick End',exact:true}).click();await pickBone(38);
      assert.equal(await page.getByRole('button',{name:'Save changes',exact:true}).isEnabled(),true);await shot('02b-custom-joints');await page.getByRole('button',{name:'Save changes',exact:true}).click();await page.getByRole('button',{name:'Close POSE setup',exact:true}).click();
      assert.equal(await page.getByRole('checkbox',{name:'Bones',exact:true}).isChecked(),false);results.checks.push('Symbol plus viewport bone picking replaces dropdowns; bad root selection only disables Add; overlapping bones cycle; mapping adds no keys or history and restores bone display');
      await page.getByLabel('Workplane',{exact:true}).check();
      const before=await snap();await grab('node',26,28,13);const moved=await snap();connected(before.model,moved.model);assert.ok(moved.revision>before.revision);const a=points(before.model),b=points(moved.model);assert.ok(b.get(33).distanceTo(a.get(33))>1);assert.ok(b.get(26).clone().sub(a.get(26)).distanceTo(b.get(33).clone().sub(a.get(33)))<.006);await shot('03-pelvis-xy');
      await menu('undo');await settle();assert.deepEqual((await snap()).model,before.model);await menu('redo');await settle();assert.deepEqual((await snap()).model,moved.model);await menu('undo');await settle();await page.getByLabel('Workplane',{exact:true}).uncheck();
      await grab('node',26,0,-120);const airborne=await snap();connected(before.model,airborne.model);assert.ok(points(airborne.model).get(25).z>a.get(25).z+20);await shot('04-pelvis-jump');await grab('node',26,0,120);connected(before.model,(await snap()).model);await shot('05-pelvis-return');
      results.checks.push('Footman pelvis carries chest and head in the GIF workplane; jump and return stay connected; undo/redo restores the complete pose');
      for(const id of [33,39]){const before=await snap();await grab('node',id,18,-5);connected(before.model,(await snap()).model);}
      await shot('06-upper-body');
    } else {
      const pelvis=config.nodes.find(id=>/pelvis/i.test(allNodes(initial.model).find(n=>n.ObjectId===id).Name));
      const before=await snap(),a=points(before.model);await grab('node',pelvis,0,20);const after=await snap(),b=points(after.model);connected(before.model,after.model,.4);
      const follower=config.followers[config.body][0];assert.ok(b.get(config.body).distanceTo(a.get(config.body))>2);assert.ok(b.get(follower).clone().sub(a.get(follower)).distanceTo(b.get(config.body).clone().sub(a.get(config.body)))<.01);await shot('03-horse-crouch');
      await grab('body',null,0,-130);connected(before.model,(await snap()).model,.6);await shot('04-mounted-jump');await grab('body',null,0,130);connected(before.model,(await snap()).model,.6);await shot('04b-mounted-return');await menu('undo');await settle();await menu('undo');await settle();await menu('undo');await settle();assert.deepEqual((await snap()).model,before.model);
      for(const c of config.chains){const before=await snap();await grab('endpoint',c.end,8,-8);assert.ok((await snap()).revision>before.revision,'each actual limb is draggable');connected(before.model,(await snap()).model,.4);}
      await shot('05-horse-rider-limbs');
      for(const id of config.nodes.filter(id=>/head|chest/i.test(allNodes(initial.model).find(n=>n.ObjectId===id).Name))){const before=await snap();await grab('node',id,9,-3);assert.ok((await snap()).revision>before.revision,'head/chest control '+id+' responds');connected(before.model,(await snap()).model,.4);}
      await shot('06-horse-rider-heads');results.checks.push('Chaos Knight auto maps four hooves, rider feet and hands; pelvis carries mount and rider; every limb, horse head/chest and rider head/chest responds to mouse dragging');
    }
    const cameraBefore=await page.evaluate(()=>poseProbe().runtime.controls.object.toJSON()),box=await viewportBox();
    await page.mouse.move(box.x+box.width*.25,box.y+box.height*.3);await page.mouse.down({button:'right'});await page.mouse.move(box.x+box.width*.25+55,box.y+box.height*.3+20,{steps:8});await page.mouse.up({button:'right'});await settle();const cameraAfter=await page.evaluate(()=>poseProbe().runtime.controls.object.toJSON());assert.notDeepEqual(cameraAfter,cameraBefore,'normal right-mouse camera rotation');await shot('07-rotated');
    assert.equal(await page.locator('.classic-sidebar').evaluate(e=>e.getBoundingClientRect().width),sidebar);
    const edited=(await snap()).model,dest=path.join(out,'ragdoll-posed.mdx');await app.evaluate(({dialog},dest)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:dest});},dest);await menu('saveAs');await page.getByRole('button',{name:'Save MDX…',exact:true}).click();await page.getByRole('dialog',{name:'Save as',exact:true}).waitFor({state:'hidden'});assertModelEquivalent(edited,openDocument(fs.readFileSync(dest)).model);
    await page.locator('.model-tab.active .model-tab-close').click();await settle();await app.evaluate(({dialog},dest)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[dest]});},dest);await menu('open');await settle();await menu('animation');await page.getByLabel('Movement current sequence').selectOption(String(sequence));await time.fill(String(frame));await time.press('Enter');await settle();assertModelEquivalent(edited,(await snap()).model);await shot('08-reopened');results.checks.push('Normal camera rotation, unchanged sidebar width, native MDX save and reopen, source model unchanged');
    assert.equal(hash(fixture),fixtureHash);assert.deepEqual(errors,[]);results.errors=errors;fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
  } catch(error){await (await app.firstWindow()).screenshot({path:path.join(out,'failure.png')});throw error;} finally{await app.evaluate(({app})=>app.exit(0));}
})().catch(error=>{console.error(error);process.exitCode=1;});
function hash(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
