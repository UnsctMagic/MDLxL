// Disposable packaged mouse acceptance. Never opens or replaces a user profile.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const { ObjectLoader, Vector3, Matrix4 } = await import('three');
  const { projectPoseHandles } = await import('../app/pose-overlay.js');
  const { movementAxisHandles, pickMovementHandle, projectMovementNodes } = await import('../app/movement-overlay.js');
  const { openDocument } = await import('../src/editor-document.js');
  const out = path.resolve(process.env.MDLXL_POSE_OUT || 'out/pose-move-gizmo-ui'), fixture = path.resolve(process.env.MDLXL_POSE_FIXTURE || 'out/pose/Footman.mdx');
  const executablePath = path.resolve(process.env.MDLXL_POSE_EXE || 'out/pose-move-gizmo-package/MDLxL-win32-x64/MDLxL.exe');
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
    });
    await page.waitForFunction(() => { try { return !!poseProbe().runtime.captureApi?.isReady; } catch { return false; } });
    const snap = () => page.evaluate(async () => {
      const {doc}=poseProbe().session;
      const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(doc.model)));
      return {revision:doc.revision,model:Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join(''),undo:doc.historyStats.undoSteps};
    });
    const settle = () => page.waitForTimeout(180);
    const tool = name => page.getByRole('group', { name: 'Movement tool', exact: true }).getByRole('button', { name, exact: true }).click();
    const shot = async name => { const data = await app.evaluate(async ({BrowserWindow}) => (await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64')); fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(data,'base64')); };
    const menu = command => command === 'undo' ? page.keyboard.press('Control+z') : command === 'redo' ? page.keyboard.press('Control+y') : app.evaluate(({ BrowserWindow }, command) => { BrowserWindow.getAllWindows()[0].webContents.send('menu', command); return true; }, command);
    const viewportBox = () => page.locator('[data-clean-model-canvas]').boundingBox();
    async function handles() {
      const data = await page.evaluate(() => { const { runtime, props } = poseProbe(), canvas = document.querySelector('[data-clean-model-canvas]'); return { config: props.poseConfig, frame: runtime.native.getFrame(), sequence: props.sequenceIndex, camera: runtime.controls.object.toJSON(), width: canvas.clientWidth, height: canvas.clientHeight }; });
      const camera = new ObjectLoader().parse(data.camera); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
      return projectPoseHandles(sourceModel, data.config, data.frame, data.sequence, camera, data.width, data.height);
    }
    async function handleFor(kind, endpoint) { const points = await handles(); const result = points.find(handle => !handle.marker && handle.kind === kind && (endpoint == null || (kind === 'node' ? handle.id : handle.chain?.end) === endpoint)); assert.ok(result?.visible, `Visible ${kind} ${endpoint}`); return result; }
    await page.getByLabel('Workplane',{exact:true}).uncheck();
    await page.getByRole('button',{name:'POSE',exact:true}).click();await settle();await tool('Move');
    const config=await page.evaluate(()=>poseProbe().props.poseConfig);results.mapping=config;

    const sidebarWidth=await page.locator('.classic-sidebar').evaluate(el=>el.getBoundingClientRect().width);
    async function selectBody(){
      await tool('Select');const h=await handleFor('body'),box=await viewportBox();
      for(let i=0;i<25;i++){const selected=await page.evaluate(()=>poseProbe().props.poseConfig.target);if(selected?.kind==='body')break;await page.mouse.click(box.x+h.x,box.y+h.y);await settle();}
      assert.equal((await page.evaluate(()=>poseProbe().props.poseConfig.target)).kind,'body');await tool('Move');await settle();
    }
    await selectBody();
    const cameraBefore=await page.evaluate(()=>poseProbe().runtime.controls.object.toJSON());
    let box=await viewportBox();
    await page.keyboard.down('Alt');await page.mouse.move(box.x+50,box.y+50);await page.mouse.down();await page.mouse.move(box.x+105,box.y+75,{steps:5});await page.mouse.up();await page.keyboard.up('Alt');await settle();
    assert.ok(new ObjectLoader().parse(cameraBefore).quaternion.angleTo(new ObjectLoader().parse(await page.evaluate(()=>poseProbe().runtime.controls.object.toJSON())).quaternion)>.01);
    results.checks.push('Actual Alt-mouse camera rotation');
    await page.getByRole('button',{name:'Fit',exact:true}).click();await settle();
    async function gizmo(pose){
      const data=await page.evaluate(()=>{const {runtime,props}=poseProbe(),canvas=document.querySelector('[data-clean-model-canvas]');return {camera:runtime.controls.object.toJSON(),width:canvas.clientWidth,height:canvas.clientHeight,frame:runtime.native.getFrame(),sequence:props.sequenceIndex,id:props.selectedNodeIds.at(-1),radius:runtime.captureApi.showcaseView().radius};});
      const camera=new ObjectLoader().parse(data.camera);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
      const active=pose?await handleFor('body'):projectMovementNodes(sourceModel,data.frame,data.sequence,camera,data.width,data.height).find(p=>p.node.ObjectId===data.id);
      return {active,handles:movementAxisHandles(active,camera,data.width,data.height,data.radius,'world','move',pose?await handles():[])};
    }
    async function position(id){const data=await page.evaluate(id=>{const n=poseProbe().runtime.native.rendererData.nodes.find(n=>n?.node.ObjectId===id);return {pivot:Array.from(n.node.PivotPoint),matrix:Array.from(n.matrix)};},id);return new Vector3().fromArray(data.pivot).applyMatrix4(new Matrix4().fromArray(data.matrix));}
    async function checkedDrag(pose,label,point,dx,dy,allowed,cancel=false){
      const before=await snap(), g=await gizmo(pose), id=pose?config.body:g.active.node.ObjectId, from=await position(id);box=await viewportBox();console.log(pose?'POSE':'Bone',label,'pick',pickMovementHandle(g.handles,point.x,point.y,'move')?.axis);
      await page.mouse.move(box.x+point.x,box.y+point.y);await page.mouse.down();
      const picked=pickMovementHandle(g.handles,point.x,point.y,'move');
      if(picked){await settle();const axis=picked.plane?({xy:'X',xz:'Y',yz:'Z'})[picked.plane]:picked.axis,rgb=({X:[255,102,119],Y:[85,255,119],Z:[85,187,255]})[axis];
        const neon=await page.locator('[data-node-overlay]').evaluate((canvas,rgb)=>{const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let count=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]>40&&rgb.every((v,j)=>Math.abs(v-pixels[i+j])<=2))count++;return count;},rgb);
        assert.ok(neon>0,(pose?'POSE ':'Bone ')+label+' glows in its own neon color immediately on press');
        if(label==='X shaft middle'||label==='XY square')await shot((pose?'pose':'bone')+'-'+picked.axis+'-neon-active');
      }
      await page.mouse.move(box.x+point.x+dx,box.y+point.y+dy,{steps:4});
      if(cancel){if(pose)await page.keyboard.press('Escape');else await page.locator('[data-clean-model-canvas]').dispatchEvent('pointercancel',{pointerId:1});}await page.mouse.up();await settle();const after=await snap();
      if(cancel){assert.equal(after.model,before.model,label+' cancelled');assert.equal(after.undo,before.undo);}
      else{
        assert.equal(after.undo,before.undo+1,label+' one native Undo entry');const delta=(await position(id)).sub(from).toArray();
        assert.ok(Math.hypot(...delta)>.0001,label+' actually moves native model');
        for(let i=0;i<3;i++)if(!allowed.includes(i))assert.ok(Math.abs(delta[i])<.004,label+' keeps excluded coordinate '+i+' fixed: '+delta);
        await menu('undo');await settle();assert.equal((await snap()).model,before.model,label+' exact Undo');await menu('redo');await settle();assert.equal((await snap()).model,after.model,label+' exact Redo');await menu('undo');await settle();
      }
      assert.equal(await page.getByLabel('Workplane',{exact:true}).isChecked(),false);results.checks.push((pose?'POSE ':'Bone ')+label);
    }
    for(const pose of [true,false]){
      if(!pose){await page.getByRole('button',{name:'POSE',exact:true}).click();await page.getByLabel('Movement bone or node').selectOption(String(config.body));await tool('Move');await settle();}
      for(const axis of ['X','Y','Z'])for(const part of ['shaft start','shaft middle','tip']){
        const a=(await gizmo(pose)).handles.find(h=>h.axis===axis),length=Math.hypot(a.dx,a.dy),pixels=part==='tip'?length:part==='shaft start'?26:(20+length)/2;
        await checkedDrag(pose,axis+' '+part,{x:a.startX+a.dx/length*pixels,y:a.startY+a.dy/length*pixels},a.dx/length*4,a.dy/length*4,[{X:0,Y:1,Z:2}[axis]]);
      }
      const gizmoHandles=(await gizmo(pose)).handles, pads=gizmoHandles.filter(h=>h.plane);assert.equal(pads.length,3,'all plane squares visible in angled view');
      for(const pad of pads){const points=[pad,...pad.polygon.map(v=>({x:pad.x+(v.x-pad.x)*.6,y:pad.y+(v.y-pad.y)*.6}))],point=points.find(p=>pickMovementHandle(gizmoHandles,p.x,p.y,'move')===pad);assert.ok(point,'visible clickable '+pad.axis+' square');await checkedDrag(pose,pad.axis+' square',point,4,-3,pad.plane.split('').map(axis=>({x:0,y:1,z:2}[axis])));}
      const active=(await gizmo(pose)).active;await checkedDrag(pose,'direct symbol',active,5,-4,[0,1,2]);
      const current=(await gizmo(pose)).handles,pad=current.find(h=>h.plane),point=[pad,...pad.polygon.map(v=>({x:pad.x+(v.x-pad.x)*.6,y:pad.y+(v.y-pad.y)*.6}))].find(p=>pickMovementHandle(current,p.x,p.y,'move')===pad);await checkedDrag(pose,pose?'plane Escape':'plane pointercancel',point,5,-4,[0,1,2],true);
    }
    await page.getByRole('button',{name:'POSE',exact:true}).click();await selectBody();await shot('move-arrows-and-squares');
    const footId=config.chains.find(chain=>chain.kind==='leg').end;
    await tool('Select');const foot=await handleFor('endpoint',footId);box=await viewportBox();
    for(let i=0;i<45;i++){const selected=await page.evaluate(()=>poseProbe().props.poseConfig.target);if(selected?.kind==='endpoint'&&selected.key===foot.key)break;await page.mouse.click(box.x+foot.x,box.y+foot.y);await settle();}
    assert.equal((await page.evaluate(()=>poseProbe().props.poseConfig.target)).key,foot.key);await tool('Move');await settle();
    for(let view=0;view<3;view++){
      const h=await handleFor('endpoint',footId),data=await page.evaluate(()=>({camera:poseProbe().runtime.controls.object.toJSON(),radius:poseProbe().runtime.captureApi.showcaseView().radius})),camera=new ObjectLoader().parse(data.camera);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);box=await viewportBox();
      const controls=movementAxisHandles(h,camera,box.width,box.height,data.radius,'world','move',await handles()),pin=await page.locator('[data-pose-pin]').boundingBox();assert.ok(pin);
      for(let x=pin.x-box.x+2;x<pin.x-box.x+pin.width-2;x+=3)for(let y=pin.y-box.y+2;y<pin.y-box.y+pin.height-2;y+=3)assert.equal(pickMovementHandle(controls,x,y,'move'),null,'Pin button is outside gizmo drag areas');
      const before=await snap();await page.locator('[data-pose-pin]').click();assert.equal(await page.locator('[data-pose-pin]').getAttribute('aria-pressed'),'true');await page.locator('[data-pose-pin]').click();assert.equal(await page.locator('[data-pose-pin]').getAttribute('aria-pressed'),'false');assert.equal((await snap()).model,before.model,'Pin placement/toggle does not alter native keys');
      await shot('foot-pin-spacing-'+view);results.checks.push('Pin spacing and mouse toggle at view '+view);
      await page.keyboard.down('Alt');await page.mouse.move(box.x+50,box.y+50);await page.mouse.down();await page.mouse.move(box.x+100,box.y+65,{steps:4});await page.mouse.up();await page.keyboard.up('Alt');await settle();
    }
    assert.equal(await page.locator('.classic-sidebar').evaluate(el=>el.getBoundingClientRect().width),sidebarWidth);assert.equal(await page.getByRole('dialog',{name:'POSE setup',exact:true}).count(),0);
    assert.equal(hash(fixture),fixtureHash);assert.deepEqual(errors,[]);results.errors=errors;fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(results,null,2));console.log(JSON.stringify({checks:results.checks,errors}));
  } catch(error){console.error(error);const data=await app.evaluate(async ({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64'));fs.writeFileSync(path.join(out,'failure.png'),Buffer.from(data,'base64'));throw error;} finally{await app.evaluate(({app})=>app.exit(0));}
})().catch(error=>{console.error(error);process.exitCode=1;});
function hash(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
