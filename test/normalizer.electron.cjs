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
    const center=p.normalizer && camera.position.clone().fromArray(p.normalizer.center).project(camera);
    return {renderFrame:s.renderer.info.render.frame,previewSynced:s.sampledNormalizer===p.normalizer,model:structuredClone(p.model),revision:p.revision,selection:structuredClone(p.selectionByGeoset),hidden:structuredClone(p.hiddenVertices),
      normalizer: p.normalizer && {center:p.normalizer.center,mode:p.normalizer.mode}, camera:camera.quaternion.toArray(),
      normals:s.entries.map(e=>Array.from(e.geometry.attributes.normal.array)), rect:{x:r.x,y:r.y,width:r.width,height:r.height},
      centerPoint:center && {x:r.x+(center.x+1)*r.width/2,y:r.y+(1-center.y)*r.height/2},
      points:p.model.Geosets.map(g=>Array.from({length:g.Vertices.length/3},(_,i)=>{
        const v=camera.position.clone().fromArray(g.Vertices,i*3).project(camera);
        return {x:r.x+(v.x+1)*r.width/2,y:r.y+(1-v.y)*r.height/2,z:v.z};
      }))};
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
    const selectAll=async()=>{await page.getByLabel('3D model viewport',{exact:true}).focus();await page.keyboard.press('Control+a');};
    const open=async()=>{await page.getByRole('button',{name:'NormalsXL',exact:true}).click();await page.locator('.normalizer-controls').waitFor();for(let tries=0;tries<100;tries++){const v=await page.evaluate(readView);if(v.previewSynced&&v.renderFrame>0)return;await sleep(100);}throw Error('Preview did not render');};
    const panel=page.locator('.normalizer-controls');
    await selectAll(); const selected=await page.evaluate(readView); await open();
    let view=await page.evaluate(readView);
    assert.deepEqual(view.model,original.model); assert.equal(view.revision,original.revision);
    assert.notDeepEqual(view.normals,original.normals); assert.deepEqual(view.selection,selected.selection);
    assert.equal(await page.getByLabel('Render mode',{exact:true}).inputValue(),'solid');
    await page.getByLabel('Render mode',{exact:true}).selectOption('textured');await sleep(100);
    assert.equal(await page.getByLabel('Render mode',{exact:true}).inputValue(),'textured');
    await page.getByLabel('Render mode',{exact:true}).selectOption('solid');
    checks.push('Globe fits selection; zero normals preview without changing the document; preview mode is selectable');
    await panel.getByRole('button',{name:'Inward',exact:true}).click(); await sleep(100);
    const inward=await page.evaluate(readView);
    assert.ok(view.normals[0].every((v,i)=>Math.abs(v+inward.normals[0][i])<1e-6));
    await panel.getByRole('checkbox',{name:'Preview changes',exact:true}).uncheck(); await sleep(100);
    assert.deepEqual((await page.evaluate(readView)).normals,original.normals);
    await panel.getByRole('checkbox',{name:'Preview changes',exact:true}).check();
    await panel.getByLabel('Normal strength',{exact:true}).focus();await page.keyboard.press('Home');await sleep(100);
    assert.equal(await panel.getByRole('button',{name:'Apply',exact:true}).isDisabled(),true);
    assert.deepEqual((await page.evaluate(readView)).normals,original.normals);
    await page.keyboard.press('End'); await sleep(100);
    checks.push('Inward, Preview comparison and zero-strength no-op');
    view=await page.evaluate(readView);
    await page.mouse.move(view.rect.x+view.rect.width*.35,view.rect.y+view.rect.height*.75);
    await page.keyboard.down('Alt');await page.mouse.down();await page.mouse.move(view.rect.x+view.rect.width*.45,view.rect.y+view.rect.height*.67,{steps:12});await page.mouse.up();await page.keyboard.up('Alt');await sleep(150);
    const rotated=await page.evaluate(readView);assert.notDeepEqual(rotated.camera,view.camera);assert.deepEqual(rotated.normalizer.center,view.normalizer.center);
    await page.getByRole('button',{name:'Camera rotation',exact:true}).click();
    await page.mouse.move(rotated.centerPoint.x,rotated.centerPoint.y);await page.mouse.down();await page.mouse.move(rotated.centerPoint.x+45,rotated.centerPoint.y+20,{steps:10});await page.mouse.up();await sleep(150);
    const moved=await page.evaluate(readView);assert.notDeepEqual(moved.normalizer.center,rotated.normalizer.center);assert.deepEqual(moved.model,original.model);assert.ok(moved.camera.every((v,i)=>Math.abs(v-rotated.camera[i])<1e-10),'Dragging the centre does not rotate the camera');
    await page.getByRole('button',{name:'Work mode',exact:true}).click();
    checks.push('Actual camera mouse drag and globe-centre drag preserve model data');
    await panel.getByRole('button',{name:'Fit globe to selection',exact:true}).click(); await panel.getByRole('button',{name:'Outward',exact:true}).click(); await sleep(100);
    assert.deepEqual((await page.evaluate(readView)).normalizer.center,view.normalizer.center);
    const image=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.capturePage().then(i=>i.toPNG().toString('base64')));
    fs.writeFileSync(path.join(out,'normalizer-preview.png'),Buffer.from(image,'base64'));
    await panel.getByRole('button',{name:'Cancel',exact:true}).click(); await sleep(100);
    assert.deepEqual((await page.evaluate(readView)).model,original.model);assert.deepEqual((await page.evaluate(readView)).normals,original.normals);
    assert.equal((await page.locator('.classic-sidebar').boundingBox()).width,sidebar.width);
    assert.equal(await page.getByLabel('Render mode',{exact:true}).inputValue(),'wireframe');
    await open(); await page.keyboard.press('Escape'); await panel.waitFor({state:'hidden'});
    assert.deepEqual((await page.evaluate(readView)).model,original.model);
    checks.push('Cancel and Escape restore original preview, selection and sidebar width');
    await open(); await panel.getByRole('button',{name:'Inward',exact:true}).click(); await sleep(100);
    const beforeApply=await page.evaluate(readView);await panel.getByRole('button',{name:'Apply',exact:true}).click();await panel.waitFor({state:'hidden'});await sleep(150);
    const applied=await page.evaluate(readView);assert.equal(applied.revision,original.revision+1);
    assert.ok(applied.normals.every((values,g)=>values.every((v,i)=>Math.abs(v-beforeApply.normals[g][i])<1e-6)),'Rendered normals match the preview within Float32 normalization precision');
    for(let g=0;g<original.model.Geosets.length;g++)for(const key of Object.keys(original.model.Geosets[g]).filter(k=>k!=='Normals'))assert.deepEqual(applied.model.Geosets[g][key],original.model.Geosets[g][key]);
    await page.getByLabel('3D model viewport',{exact:true}).focus();await page.keyboard.press('Control+z');await sleep(100);
    assert.deepEqual((await page.evaluate(readView)).model,original.model);
    await page.keyboard.press('Control+y');await sleep(100);assert.deepEqual((await page.evaluate(readView)).model,applied.model);
    for(let g=0;g<original.model.Geosets.length;g++)if(!selected.selection[g]?.length)assert.deepEqual(applied.model.Geosets[g],original.model.Geosets[g]);
    checks.push('Apply commits only selected normals in one edit; other geosets, one Undo and Redo are exact');
    for(const format of ['MDX','MDL']){
      const saved=path.join(out,'saved.'+format.toLowerCase());
      await app.evaluate(({dialog},saved)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:saved});},saved);
      await page.keyboard.press('Control+Shift+s');await page.getByRole('button',{name:'Save '+format+'…',exact:true}).click();
      for(let tries=0;tries<100&&!fs.existsSync(saved);tries++)await sleep(50);
      const reopened=openDocument(fs.readFileSync(saved),'saved.'+format.toLowerCase());
      for(let g=0;g<reopened.model.Geosets.length;g++)assert.ok(Array.from(reopened.model.Geosets[g].Normals).every((v,i)=>Math.abs(v-applied.normals[g][i])<1e-6));
    }
    checks.push('Real packaged Save As roundtrips authored normals through MDL and MDX');
    await open(); await panel.getByRole('button',{name:'From surface',exact:true}).click();await sleep(100);
    assert.equal((await page.evaluate(readView)).normalizer.mode,'surface');
    await panel.getByRole('button',{name:'Cancel',exact:true}).click();
    await open();await panel.getByRole('button',{name:'Repair facing…',exact:true}).click();
    await page.locator('.normals-xl-prompt').waitFor();await page.keyboard.press('Escape');await page.locator('.normals-xl-prompt').waitFor({state:'hidden'});
    checks.push('Surface rebuild previews and the existing facing repair remains available');
    await page.locator('[data-hotkey="geosetsAll"]').click();await selectAll();await open();
    const multi=await page.evaluate(readView);assert.ok(Object.keys(multi.selection).filter(k=>multi.selection[k].length).length>1);
    await page.getByRole('button',{name:'Quad View',exact:true}).click();
    const perspective=page.locator('.quad-pane[data-viewport="perspective"]'), bounds=await perspective.boundingBox();
    await page.mouse.click(bounds.x+bounds.width*.3,bounds.y+bounds.height*.7);await sleep(100);
    const quadBefore=await page.evaluate(readView);
    await page.keyboard.down('Alt');await page.mouse.move(bounds.x+bounds.width*.3,bounds.y+bounds.height*.7);await page.mouse.down();
    await page.mouse.move(bounds.x+bounds.width*.45,bounds.y+bounds.height*.55,{steps:10});await page.mouse.up();await page.keyboard.up('Alt');await sleep(150);
    const quadAfter=await page.evaluate(readView);assert.notDeepEqual(quadAfter.camera,quadBefore.camera);
    assert.deepEqual(quadAfter.normalizer.center,quadBefore.normalizer.center);assert.deepEqual(quadAfter.model,multi.model);
    await panel.getByRole('button',{name:'Cancel',exact:true}).click();
    checks.push('Multiple geosets preview together; Quad View perspective mouse rotation stays usable');
    assert.ok(fs.readFileSync(fixture).equals(originalBytes));assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({checks,errors},null,2));
    console.log(checks.map(c=>'PASS '+c).join('\n'));
  } catch(error) {
    console.error(error.stack);console.error('Renderer errors:',errors);
    if(page)console.error((await page.locator('body').innerText()).slice(0,2500));
    throw error;
  } finally {await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
