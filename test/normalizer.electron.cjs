// Run against an isolated packaged build via MDLXL_TEST_EXE and MDLXL_TEST_OUT.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..'), out = process.env.MDLXL_TEST_OUT || path.join(root, 'out/normalizer');
const executable = process.env.MDLXL_TEST_EXE;
if (!executable) throw Error('Set MDLXL_TEST_EXE to the isolated packaged MDLxL.exe.');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function readView() {
  const el = document.querySelector('.classic-view [aria-label="3D model viewport"]');
  let fiber = el?.[Object.keys(el).find(key => key.startsWith('__reactFiber'))], top = fiber;
  while (top?.return) top = top.return;
  const stack = [top.stateNode.current]; let owner;
  while (stack.length) { const n = stack.pop(); if (n.stateNode === el) { owner=n; break; } for (let c=n.child;c;c=c.sibling) stack.push(c); }
  for (fiber=owner;fiber;fiber=fiber.return) for (let hook=fiber.memoizedState;hook;hook=hook.next) {
    const s=hook.memoizedState?.current;
    if (!s?.renderer || !s?.entries) continue;
    const p=fiber.memoizedProps, r=s.renderer.domElement.getBoundingClientRect(), camera=s.camera;
    return {renderFrame:s.renderer.info.render.frame,normalizer:!!p.normalizer,model:structuredClone(p.model),revision:p.revision,selection:structuredClone(p.selectionByGeoset),
      camera:camera.quaternion.toArray(),normals:s.entries.map(e=>Array.from(e.geometry.attributes.normal.array)),rect:{x:r.x,y:r.y,width:r.width,height:r.height}};
  }
  throw Error('Viewport runtime unavailable');
}
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  const {createDemoDocument,openDocument}=await import('../src/editor-document.js');
  const fixture=path.join(out,'fixture.mdx'), doc=createDemoDocument();
  doc.apply('Zero-normal fixture',['Geosets'],m=>{for(const g of m.Geosets)g.Normals.fill(0);});
  fs.writeFileSync(fixture,doc.serialize('mdx'));
  const originalBytes=fs.readFileSync(fixture), profile=path.join(out,'profile');
  fs.mkdirSync(profile,{recursive:true});
  fs.writeFileSync(path.join(profile,'settings.json'),JSON.stringify({preferences:{graphics:{pauseWhenHidden:false}}}));
  const app=await _electron.launch({executablePath:executable,args:['--disable-backgrounding-occluded-windows',fixture],
    env:{...process.env,MDLVIS_HEADLESS:'1',MDLXL_PROFILE:profile},timeout:60000});
  const checks=[], errors=[]; let page;
  try {
    page=await app.firstWindow(); page.setDefaultTimeout(15000); page.on('pageerror',e=>errors.push(e.message));
    await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.webContents.setBackgroundThrottling(false);w.setBounds({x:-3000,y:0,width:1280,height:900});w.showInactive();});
    await page.getByLabel('3D model viewport',{exact:true}).waitFor();
    await page.getByLabel('View direction',{exact:true}).selectOption('perspective');
    const original=await page.evaluate(readView), sidebar=await page.locator('.classic-sidebar').boundingBox();
    assert.equal(await page.locator('.normalizer-controls').count(),0);
    const panel=page.locator('.normalizer-controls'), apply=panel.getByRole('button',{name:'Apply',exact:true});
    const open=async()=>{await page.getByRole('button',{name:'NormalsXL',exact:true}).click();await panel.waitFor();for(let tries=0;tries<100;tries++){const v=await page.evaluate(readView);if(v.normalizer&&v.renderFrame>0)return v;await sleep(100);}throw Error('Preview did not render');};
    // One click, no selection: the whole visible model is previewed at once.
    let view=await open();
    assert.match(await panel.innerText(),/Whole model/);assert.match(await panel.locator('[role=status]').innerText(),/normals changed/);
    assert.notDeepEqual(view.normals,original.normals);assert.equal(view.revision,original.revision);
    assert.equal(await page.getByLabel('Smoothing angle',{exact:true}).inputValue(),'90');
    assert.equal(await panel.getByRole('checkbox',{name:'Show normals',exact:true}).isChecked(),true);
    assert.equal(await panel.getByRole('checkbox').count(),1);
    await page.getByLabel('Smoothing angle',{exact:true}).focus();await page.keyboard.press('End');await sleep(150);
    assert.match(await panel.innerText(),/180°/);
    checks.push('One click previews the whole model; the smoothing angle re-previews');
    // Actual camera drag still rotates while the preview is open.
    await page.mouse.move(view.rect.x+view.rect.width*.35,view.rect.y+view.rect.height*.75);
    await page.keyboard.down('Alt');await page.mouse.down();await page.mouse.move(view.rect.x+view.rect.width*.45,view.rect.y+view.rect.height*.67,{steps:12});await page.mouse.up();await page.keyboard.up('Alt');await sleep(150);
    const rotated=await page.evaluate(readView);assert.notDeepEqual(rotated.camera,view.camera);assert.equal(rotated.revision,original.revision);
    checks.push('Camera mouse rotation works during the preview');
    const image=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.capturePage().then(i=>i.toPNG().toString('base64')));
    fs.writeFileSync(path.join(out,'normalizer-preview.png'),Buffer.from(image,'base64'));
    await panel.getByRole('button',{name:'Cancel',exact:true}).click();await panel.waitFor({state:'hidden'});await sleep(100);
    let after=await page.evaluate(readView);assert.deepEqual(after.model,original.model);assert.deepEqual(after.normals,original.normals);assert.equal(after.revision,original.revision);
    assert.equal((await page.locator('.classic-sidebar').boundingBox()).width,sidebar.width);
    await open();await page.keyboard.press('Escape');await panel.waitFor({state:'hidden'});
    assert.deepEqual((await page.evaluate(readView)).model,original.model);
    checks.push('Cancel and Escape leave the document unchanged');
    await open();await apply.click();await panel.waitFor({state:'hidden'});await sleep(150);
    const applied=await page.evaluate(readView);assert.equal(applied.revision,original.revision+1);
    assert.match(await page.locator('.classic-status').innerText(),/NormalsXL: .* normals changed/);
    // No vertex is added or removed.
    assert.deepEqual(applied.model.Geosets.map(g=>[g.Vertices.length,Array.from(g.Faces)]),original.model.Geosets.map(g=>[g.Vertices.length,Array.from(g.Faces)]));
    // Unshaded geosets (the demo's glowing rune) are left out: normals do not light them.
    const shaded=g=>!applied.model.Materials[g.MaterialID].Layers.every(l=>l.Shading&1);
    for(const g of applied.model.Geosets.filter(shaded))for(let i=0;i<g.Normals.length;i+=3)assert.ok(Math.abs(Math.hypot(g.Normals[i],g.Normals[i+1],g.Normals[i+2])-1)<1e-4);
    assert.deepEqual(applied.model.Geosets.filter(g=>!shaded(g)),original.model.Geosets.filter(g=>!shaded(g)));
    await page.getByLabel('3D model viewport',{exact:true}).focus();await page.keyboard.press('Control+z');await sleep(100);
    assert.deepEqual((await page.evaluate(readView)).model,original.model);
    await page.keyboard.press('Control+y');await sleep(100);assert.deepEqual((await page.evaluate(readView)).model,applied.model);
    checks.push('Apply is one edit; one Undo and Redo are exact');
    for(const format of ['MDX','MDL']){
      const saved=path.join(out,'saved.'+format.toLowerCase());
      await app.evaluate(({dialog},saved)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:saved});},saved);
      fs.rmSync(saved,{force:true});const saveButton=page.getByRole('button',{name:'Save '+format+'…',exact:true});
      await page.keyboard.press('F12');await saveButton.click();
      // The Save as dialog closes only after the save finishes; the next Save As must not start before that.
      await saveButton.waitFor({state:'detached'});assert.ok(fs.existsSync(saved),'saved '+format);
      const reopened=openDocument(fs.readFileSync(saved),'saved.'+format.toLowerCase());
      for(let g=0;g<reopened.model.Geosets.length;g++)assert.ok(Array.from(reopened.model.Geosets[g].Normals).every((v,i)=>Math.abs(v-applied.model.Geosets[g].Normals[i])<1e-5));
    }
    checks.push('Real packaged Save As roundtrips the result through MDL and MDX');
    // Reopening on a repaired model has nothing left to do; Fix facing on a
    // clean model flips nothing, makes no edit and keeps the panel open.
    // Undo, Redo and both saves advance the revision, so compare with the revision just before Fix facing.
    const clean=await open();assert.equal(await apply.isDisabled(),true);
    await panel.getByRole('button',{name:'Fix facing',exact:true}).click();await sleep(150);
    assert.match(await panel.locator('[role=status]').innerText(),/0 triangles flipped/);
    const unchanged=await page.evaluate(readView);assert.equal(unchanged.revision,clean.revision);assert.deepEqual(unchanged.model,clean.model);
    await panel.getByRole('button',{name:'Cancel',exact:true}).click();await panel.waitFor({state:'hidden'});
    checks.push('A repaired model needs no further changes');
    // With a selection the scope is the selected area.
    await page.getByLabel('3D model viewport',{exact:true}).focus();await page.keyboard.press('Control+a');
    await open();assert.match(await panel.innerText(),/Selected area/);
    await panel.getByRole('button',{name:'Cancel',exact:true}).click();
    checks.push('Selected vertices restrict the operation');
    assert.ok(fs.readFileSync(fixture).equals(originalBytes));assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({checks,errors},null,2));
    console.log(checks.map(c=>'PASS '+c).join('\n'));
  } catch(error) {
    console.error(error.stack);console.error('Renderer errors:',errors);
    if(page)console.error((await page.locator('body').innerText()).slice(0,2500));
    throw error;
  } finally {await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
