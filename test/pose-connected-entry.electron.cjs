// Reproduce and verify the selected-hand entry path in the portable editor.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const { ObjectLoader } = await import('three');
  const { projectPoseHandles } = await import('../app/pose-overlay.js');
  const { allNodes } = await import('../src/animation.js');
  const out = path.resolve(process.env.MDLXL_POSE_OUT || 'out/pose-connected-entry-ui');
  const fixture = path.resolve(process.env.MDLXL_POSE_FIXTURE || 'out/pose/Footman.mdx');
  const executablePath = path.resolve(process.env.MDLXL_POSE_EXE || 'out/motion-review-package/MDLxL-win32-x64/MDLxL.exe');
  fs.mkdirSync(out, { recursive: true });
  const profile = path.join(out, 'profile-' + Date.now());
  fs.mkdirSync(profile, { recursive: true });
  fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify({ preferences: { graphics: { pauseWhenHidden: false } } }));
  const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const fixtureHash = digest(fixture), errors = [], result = { fixture, fixtureHash, executablePath, checks: [] };
  const app = await _electron.launch({ executablePath, args: [fixture, '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'], env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: profile }, timeout: 60000 });
  try {
    console.log('Launched'); const page = await app.firstWindow(); console.log('Window ready'); page.setDefaultTimeout(20000); page.on('pageerror', error => errors.push(error.message));
    await app.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows()[0]; win.webContents.setBackgroundThrottling(false); win.setBounds({ x: -3000, y: 0, width: 1280, height: 920 }); win.showInactive(); });
    await page.locator('[data-warmkey="animation"]').click();
    await page.getByLabel('Movement current sequence').selectOption('0');
    const time = page.getByLabel('Current animation frame');
    const seek = async frame => { await time.fill(String(frame)); await time.press('Enter'); await page.waitForTimeout(150); };
    console.log('Movement ready'); await seek(500); await page.getByLabel('Render mode', { exact: true }).selectOption('textured'); await page.getByLabel('View direction', { exact: true }).selectOption('front');
    await page.evaluate(() => {
      window.poseProbe = () => {
        const root = document.querySelector('.game-preview-root'); let runtime, props, session;
        for (let fiber = root?.[Object.keys(root).find(key => key.startsWith('__reactFiber'))]; fiber; fiber = fiber.return) for (let hook = fiber.memoizedState; hook; hook = hook.next) {
          const state = hook.memoizedState, ref = state?.current;
          if (ref?.native && ref?.controls) runtime = ref;
          if (ref?.model && ref?.onPoseCommit) props = ref;
          if (state?.doc?.model && state?.assets) session = state;
        }
        if (!runtime || !props || !session) throw Error('Packaged owners not ready');
        return { runtime, props, session };
      };
      window.poseSnapshot = () => { const { session } = poseProbe(); return { model: JSON.parse(JSON.stringify(session.doc.model, (_key, value) => ArrayBuffer.isView(value) ? Array.from(value) : value)), undo: session.doc.historyStats.undoSteps }; };
    });
    await page.waitForFunction(() => { try { return !!poseProbe().runtime.captureApi?.isReady; } catch { return false; } });
    const snap = () => page.evaluate(() => poseSnapshot());
    const canvas = page.locator('[data-clean-model-canvas]');
    const tool = name => page.getByRole('group', { name: 'Movement tool', exact: true }).getByRole('button', { name, exact: true }).click();
    const settle = () => page.waitForTimeout(150);
    const width = await page.locator('.classic-sidebar').evaluate(element => element.getBoundingClientRect().width);
    await page.getByRole('button', { name: 'POSE', exact: true }).click(); await settle();
    await page.getByRole('button', { name: 'Fit', exact: true }).click(); await settle();
    console.log('POSE ready'); const initial = await snap();
    const config = await page.evaluate(() => poseProbe().props.poseConfig);
    const data = await page.evaluate(() => { const { runtime, props } = poseProbe(), c=document.querySelector('[data-clean-model-canvas]'); return {camera:runtime.controls.object.toJSON(),width:c.clientWidth,height:c.clientHeight,appearance:props.preferences.viewportAppearance.controllers}; });
    const camera = new ObjectLoader().parse(data.camera); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    const hs = projectPoseHandles(initial.model,config,500,0,camera,data.width,data.height,500,undefined,data.appearance).filter(h=>h.visible&&!h.quiet&&h.kind==='endpoint');
    for (const h of hs) {
      const b=await canvas.boundingBox();
      await page.mouse.move(b.x+h.x,b.y+h.y); await page.mouse.down(); await page.mouse.move(b.x+h.x+12,b.y+h.y-8,{steps:6}); await settle();
      const target=await page.evaluate(()=>poseProbe().props.poseConfig.target);
      await page.mouse.up();await settle();const after=await snap();
      const old=new Map(allNodes(initial.model).map(n=>[n.ObjectId,n]));
      const changes=allNodes(after.model).flatMap(n=>['Translation','Rotation','Scaling'].filter(p=>JSON.stringify(n[p])!==JSON.stringify(old.get(n.ObjectId)[p])).map(p=>({id:n.ObjectId,name:n.Name,property:p})));
      result.checks.push({handle:h.label,kind:h.kind,id:h.id,key:h.key,target,changes});
      assert.deepEqual(target,{kind:'endpoint',key:h.key});
      assert.ok(changes.some(item=>item.id===config.chains.find(c=>c.key===h.key).root&&item.property==='Rotation'));
      if(changes.length){await canvas.focus();await page.keyboard.press('Control+z');await settle();}
      await page.getByRole('button',{name:'POSE',exact:true}).click();await page.getByRole('button',{name:'POSE',exact:true}).click();await settle();
    }
    // A native bone selected before entering POSE keeps a visible Move gizmo.
    await page.getByRole('button',{name:'POSE',exact:true}).click();
    const chain=config.chains.find(c=>c.kind==='arm');
    await page.getByLabel('Movement bone or node').selectOption(String(chain.end));
    await page.getByRole('button',{name:'POSE',exact:true}).click();await settle();
    const {projectMovementNodes,movementAxisHandles}=await import('../app/movement-overlay.js');
    const {Box3,Vector3}=await import('three');const bounds=new Box3();for(const g of initial.model.Geosets)for(let i=0;i<g.Vertices.length;i+=3)bounds.expandByPoint(new Vector3().fromArray(g.Vertices,i));
    const point=projectMovementNodes(initial.model,500,0,camera,data.width,data.height).find(p=>p.node.ObjectId===chain.end);
    const arrow=movementAxisHandles(point,camera,data.width,data.height,Math.max(1,bounds.getSize(new Vector3()).length()/2),'world','move').find(h=>h.axis==='X');
    const b=await canvas.boundingBox(),before=await snap();
    result.entryTarget=await page.evaluate(()=>poseProbe().props.poseConfig.target);
    await page.mouse.move(b.x+arrow.x,b.y+arrow.y);await page.mouse.down();await page.mouse.move(b.x+arrow.x+12,b.y+arrow.y,{steps:6});await page.mouse.up();await settle();
    const after=await snap(),old=new Map(allNodes(before.model).map(n=>[n.ObjectId,n]));
    result.entryChanges=allNodes(after.model).flatMap(n=>['Translation','Rotation'].filter(p=>JSON.stringify(n[p])!==JSON.stringify(old.get(n.ObjectId)[p])).map(p=>({id:n.ObjectId,name:n.Name,property:p})));
    console.log('ENTRY: '+JSON.stringify({target:result.entryTarget,changes:result.entryChanges}));
    assert.deepEqual(result.entryTarget,{kind:'endpoint',key:chain.key});
    assert.ok(result.entryChanges.some(item=>item.id===chain.root&&item.property==='Rotation'),'entry drag bends the connected limb');
    assert.ok(!result.entryChanges.some(item=>item.id===chain.end&&item.property==='Translation'),'entry drag cannot translate the hand alone');
    assert.equal(digest(fixture),fixtureHash);assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(out,'entry.json'),JSON.stringify(result,null,2));console.log('Direct handle probes: '+result.checks.length);
    await page.evaluate(()=>poseProbe().runtime.captureApi.captureFrame());await settle();
    const png=await Promise.race([app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64')),new Promise((_,reject)=>setTimeout(()=>reject(Error('Entry capture timed out')),10000))]);fs.writeFileSync(path.join(out,'entry.png'),Buffer.from(png,'base64'));
  } catch (error) { console.error(error); throw error; } finally { await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows().forEach(w=>w.destroy())).catch(()=>{}); await app.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
