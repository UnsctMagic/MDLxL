const { gameFolder } = require('./helpers/fixtures.cjs');
const { stubDialogs } = require('./helpers/app.cjs');
const { launchApp, closeApp, settle: settlePage } = require('./helpers/app.cjs');
// Real production bundle, hidden window, isolated profile. No desktop input.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=process.env.MDLXL_TEST_OUT||path.join(root,'out/auto-corpse'),fixture=process.env.MDLXL_CORPSE_FIXTURE;
if(!fixture)throw Error('Set MDLXL_CORPSE_FIXTURE to a model with Death.');
function runtime(scope){const el=scope?document.querySelector(scope+' .game-preview-root'):document.querySelector('.game-preview-root')||document.querySelector('.classic-view [aria-label="3D model viewport"]');if(!el)throw Error('Missing viewport');let p;const s=findFiberState(el,(s,props)=>{if(props?.model&&(s?.native&&s?.controls||s?.renderer&&s?.entries)){p=props;return true;}return false;},{tree:!scope});if(!s)throw Error('Missing viewport runtime');const c=s.controls?.object||s.camera,canvas=s.renderer?.domElement||document.querySelector('[data-clean-model-canvas]');return {model:structuredClone(p.model),frame:s.native?.getFrame()??p.frame,sequence:p.sequenceIndex,playing:p.playing,camera:c.position.toArray(),quaternion:c.quaternion.toArray(),ready:s.captureApi?.isReady??true,rect:canvas.getBoundingClientRect().toJSON()};}
(async()=>{
  fs.mkdirSync(out,{recursive:true});const profile=fs.mkdtempSync(path.join(out,'profile-'));fs.writeFileSync(path.join(profile,'settings.json'),JSON.stringify({gameData:await gameFolder(),preferences:{language:'en'}}));
  const original=fs.readFileSync(fixture),app=(await launchApp({ out: path.dirname(profile), profile: profile, show: 'hide', args: ['--disable-renderer-backgrounding', '--disable-background-timer-throttling'], env: { MDLVIS_HEADLESS:'1' }, timeout: 60000, fixture: fixture })).app;
  const appPid=await app.evaluate(()=>process.pid),errors=[],checks=[];
  try {
    const page=await app.firstWindow();page.setDefaultTimeout(25000);page.on('pageerror',e=>errors.push(e.message));
    await page.evaluate('window.corpseRuntime='+runtime.toString());
    await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.webContents.setBackgroundThrottling(false);w.setBounds({x:0,y:0,width:1500,height:950});});
    assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible()),false);
    await page.getByLabel('3D model viewport',{exact:true}).waitFor();
    const before=await page.evaluate(runtime),button=page.getByRole('button',{name:'Auto Corpse (test)',exact:true}),vis=page.getByRole('button',{name:'VIS',exact:true});
    const a=await button.boundingBox(),b=await vis.boundingBox();assert.ok(Math.abs(a.y-b.y)<4);assert.ok(a.width<=50);assert.equal(await page.getByRole('dialog').count(),0);
    async function capture(name){await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const data=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.capturePage(undefined,{stayHidden:true,stayAwake:true}).then(i=>i.toPNG().toString('base64')));fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(data,'base64'));}
    // CORP opens a preview first. Size/Height and Close leave the model alone.
    const window_=page.getByRole('dialog',{name:'Auto Corpse',exact:true});
    await button.click();await window_.waitFor();await window_.locator('.game-preview-root').waitFor();await settlePage(page, 700);
    const scoped=()=>page.evaluate(runtime,'[aria-label="Auto Corpse preview"]'),preview=await scoped(),pr=preview.rect;assert.ok(preview.model.Geosets.length>before.model.Geosets.length,'The preview shows the corpse');
    await page.mouse.move(pr.x+pr.width*.6,pr.y+pr.height*.5);await page.mouse.down();await page.mouse.move(pr.x+pr.width*.6+70,pr.y+pr.height*.5+35,{steps:8});await page.mouse.up();await settlePage(page, 100);
    assert.notDeepEqual((await scoped()).quaternion,preview.quaternion);checks.push('Auto Corpse preview turns with a normal mouse drag');
    const size=window_.getByRole('slider',{name:'Size',exact:true});await size.focus();for(let n=0;n<10;n++)await page.keyboard.press('ArrowRight');
    await page.waitForFunction(()=>document.querySelector('[aria-label="Auto Corpse"] output')?.textContent==='150%');await settlePage(page, 500);await capture('window-size-150');
    // Delete removes the selected part while a preview handle has focus.
    const fitted=(await scoped()).model.Geosets;await window_.getByRole('button',{name:'+ Skull',exact:true}).click();await settlePage(page, 300);
    assert.notDeepEqual((await scoped()).model.Geosets,fitted,'+ Skull adds a part');
    await window_.getByRole('slider',{name:'Move this piece',exact:true}).focus();await page.keyboard.press('Delete');await settlePage(page, 300);
    assert.deepEqual((await scoped()).model.Geosets,fitted);checks.push('Delete removes the selected part while its handle has focus');
    // The user's way: double-click a generated piece in the preview (focus
    // stays on the preview), press Delete; Ctrl+Z brings it back.
    const corpseVertices=()=>scoped().then(s=>s.model.Geosets.reduce((n,g)=>n+g.Vertices.length,0));
    const whole=await corpseVertices(),box=(await scoped()).rect,corpseGeosets=async()=>JSON.stringify((await scoped()).model.Geosets.map(g=>Array.from(g.Vertices)));
    await page.mouse.dblclick(box.x+box.width*.5,box.y+box.height*.55);await settlePage(page, 300);
    const handle=window_.getByRole('slider',{name:'Move this piece',exact:true});await handle.waitFor();
    const dragFrom=async()=>{const h=await handle.boundingBox();return [h.x+h.width/2,h.y+h.height/2];};
    // Escape during a real handle drag cancels the drag and keeps the window open.
    const unmoved=await corpseGeosets();let [hx,hy]=await dragFrom();
    await page.mouse.move(hx,hy);await page.mouse.down();await page.mouse.move(hx+40,hy+25,{steps:6});await settlePage(page, 200);
    assert.notEqual(await corpseGeosets(),unmoved,'dragging the handle moves the piece');
    await page.keyboard.press('Escape');await page.mouse.up();await settlePage(page, 300);
    assert.equal(await window_.count(),1,'Escape during a drag does not close Auto Corpse');
    assert.equal(await corpseGeosets(),unmoved,'Escape during a drag puts the piece back');
    checks.push('Escape during a handle drag cancels the drag and keeps the window open');
    // The reported path: drag the handle, then Delete, then Ctrl+Z.
    [hx,hy]=await dragFrom();await page.mouse.move(hx,hy);await page.mouse.down();await page.mouse.move(hx+30,hy+20,{steps:6});await page.mouse.up();await settlePage(page, 300);
    const dragged=await corpseVertices();
    await page.keyboard.press('Delete');await settlePage(page, 300);
    assert.ok(await corpseVertices()<dragged,'Delete removes a dragged generated piece');
    await page.keyboard.press('Control+z');await settlePage(page, 300);
    assert.equal(await corpseVertices(),dragged,'Ctrl+Z brings the deleted piece back');
    assert.ok(whole>0);checks.push('Double-click a piece, drag its handle, Delete removes it; Ctrl+Z restores it');
    // Blood: the × button removes itself with focus; Ctrl+Z still undoes inside the window.
    await window_.getByRole('tab',{name:'Blood Editor'}).or(window_.getByRole('button',{name:'Blood Editor',exact:true})).first().click();await settlePage(page, 300);
    await window_.getByRole('button',{name:'+ Splat',exact:true}).click();await settlePage(page, 300);
    const removeButtons=window_.getByRole('button',{name:/^Remove /});const rows=await removeButtons.count();assert.ok(rows>0,'+ Splat adds a blood row');
    await removeButtons.last().click();await settlePage(page, 300);assert.equal(await removeButtons.count(),rows-1,'× removes the blood');
    await page.keyboard.press('Control+z');await settlePage(page, 300);assert.equal(await removeButtons.count(),rows,'Ctrl+Z after × brings the blood back');
    checks.push('Blood ×, then Ctrl+Z, restores the blood');
    // "Delete removes it" for blood, the user's way: click a blood row in the list
    // (focus stays wherever that click leaves it, no .focus()), press Delete; Ctrl+Z brings it back.
    const bloodRows=window_.getByRole('listbox',{name:'Death blood',exact:true}).getByRole('option'),bloodCount=await bloodRows.count();
    await bloodRows.last().locator('span').first().click();await settlePage(page, 300);
    assert.equal(await bloodRows.last().getAttribute('aria-selected'),'true','clicking a blood row selects it');
    await window_.getByText('Drag the handle to move this blood. Delete removes it.',{exact:true}).waitFor();
    await page.keyboard.press('Delete');await settlePage(page, 300);
    assert.equal(await bloodRows.count(),bloodCount-1,'Delete removes the blood clicked in the list');
    await page.keyboard.press('Control+z');await settlePage(page, 300);
    assert.equal(await bloodRows.count(),bloodCount,'Ctrl+Z after Delete brings the blood back');
    checks.push('Blood: click a row, Delete removes it; Ctrl+Z restores it');
    // The preview way: double-click the blood in the preview, drag its handle, then Delete and Ctrl+Z.
    await bloodRows.last().locator('span').first().click();await settlePage(page, 300);
    const bloodHandle=window_.getByRole('slider',{name:'Move this blood',exact:true});await bloodHandle.waitFor();
    const hb=await bloodHandle.boundingBox(),spot=[hb.x+hb.width/2,hb.y+hb.height/2],pv=(await scoped()).rect;
    // Double-click empty ground (a corner of the preview) lets the blood go.
    await page.mouse.dblclick(pv.x+12,pv.y+pv.height-12);await settlePage(page, 300);
    assert.equal(await bloodHandle.count(),0,'double-clicking empty ground lets the blood go');
    await page.mouse.dblclick(...spot);await settlePage(page, 300);
    await bloodHandle.waitFor({timeout:3000}).catch(()=>{throw Error('double-clicking the blood in the preview does not select it');});
    {const b=await bloodHandle.boundingBox(),bx=b.x+b.width/2,by=b.y+b.height/2;await page.mouse.move(bx,by);await page.mouse.down();await page.mouse.move(bx+30,by+20,{steps:6});await page.mouse.up();await settlePage(page, 300);}
    const draggedBlood=await bloodRows.count();
    await page.keyboard.press('Delete');await settlePage(page, 300);
    assert.equal(await bloodRows.count(),draggedBlood-1,'Delete removes the blood after its handle was dragged');
    await page.keyboard.press('Control+z');await settlePage(page, 300);
    assert.equal(await bloodRows.count(),draggedBlood,'Ctrl+Z brings the dragged and deleted blood back');
    checks.push('Blood: double-click it in the preview, drag its handle, Delete removes it; Ctrl+Z restores it');
    await window_.getByRole('tab',{name:'Corpse Editor'}).or(window_.getByRole('button',{name:'Corpse Editor',exact:true})).first().click();await settlePage(page, 200);
    await window_.getByRole('button',{name:'Close',exact:true}).click();await window_.waitFor({state:'hidden'});
    assert.deepEqual((await page.evaluate(runtime)).model,before.model);checks.push('Closing the preview leaves the model unchanged');
    await button.click();await window_.waitFor();await window_.getByRole('button',{name:'Create',exact:true}).click();await window_.waitFor({state:'hidden'});
    await page.locator('[data-clean-model-canvas]').waitFor();await settlePage(page, 700);
    const after=await page.evaluate(runtime);assert.ok(after.model.Geosets.length>before.model.Geosets.length);assert.match(after.model.Sequences[after.sequence].Name,/Decay Bones?/i);
    assert.equal(after.frame,after.model.Sequences[after.sequence].Interval[0]);
    assert.equal(after.playing,false);
    await settlePage(page, 200);
    assert.equal((await page.evaluate(runtime)).frame,after.frame);
    checks.push('One compact button beside VIS; Create immediately displays the first Bone Decay frame, paused');
    const input=page.getByLabel('Current animation frame',{exact:true});
    async function seek(time){await input.fill(String(time));await input.press('Enter');await page.waitForFunction(t=>Math.abs(window.corpseRuntime().frame-t)<1,time);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
    for(const label of ['Bones','Skeleton','Nodes','Emitters','Events','Sounds']) {const box=page.getByRole('checkbox',{name:label,exact:true});if(await box.count())await box.uncheck();}
    const fi=after.model.Sequences.findIndex(s=>/^Decay Flesh$/i.test(s.Name));await page.getByLabel('Choose animation sequence',{exact:true}).selectOption(String(fi));
    const s=after.model.Sequences[fi];await page.getByLabel('View direction',{exact:true}).selectOption('top');await page.getByRole('button',{name:'Fit',exact:true}).click();await seek(s.Interval[0]+167);await capture('body-cover');
    const bi=after.model.Sequences.findIndex(s=>/^Decay Bones?$/i.test(s.Name));await page.getByLabel('Choose animation sequence',{exact:true}).selectOption(String(bi));await seek(after.model.Sequences[bi].Interval[0]);await capture('corpse');
    console.log('Body and corpse captured at the same camera scale.');
    if(process.env.MDLXL_CORPSE_CAPTURE_ONLY==='1')return;
    // Normal camera tool plus actual pointer drag through Chromium on the
    // hidden window, never OS-level input on the user's desktop.
    await page.getByLabel('View direction',{exact:true}).selectOption('perspective');await page.keyboard.press('Shift+E');
    const view=await page.evaluate(runtime),r=view.rect;await page.mouse.move(r.x+r.width*.6,r.y+r.height*.5);await page.mouse.down();await page.mouse.move(r.x+r.width*.6+70,r.y+r.height*.5+35,{steps:8});await page.mouse.up();await settlePage(page, 100);assert.notDeepEqual((await page.evaluate(runtime)).quaternion,view.quaternion);checks.push('Normal mouse camera rotation remains functional');
    await page.keyboard.press('Control+z');await settlePage(page, 120);assert.deepEqual((await page.evaluate(runtime)).model,before.model);await page.keyboard.press('Control+y');await settlePage(page, 120);assert.deepEqual((await page.evaluate(runtime)).model,after.model);checks.push('One Undo restores the exact original model; Redo restores the result');
    await button.click();await window_.waitFor();await window_.getByRole('button',{name:'Create',exact:true}).click();await settlePage(page, 150);
    await window_.getByRole('button',{name:'Close',exact:true}).click();await window_.waitFor({state:'hidden'});
    assert.deepEqual((await page.evaluate(runtime)).model,after.model);checks.push('Repeat Create adds no duplicate corpse, mesh, material or key');
    console.log('Camera, Undo, Redo and repeat click passed.');
    const {EditorDocument}=await import('../src/editor-document.js');
    for(const format of ['MDX','MDL']) {
      const saved=path.join(out,'saved.'+format.toLowerCase());
      await stubDialogs(app, { save: (saved) });
      await page.keyboard.press('F12');await page.getByRole('button',{name:'Save '+format+'…',exact:true}).click();
      await page.getByRole('dialog',{name:'Save as',exact:true}).waitFor({state:'hidden'});
      for(let n=0;n<100&&!fs.existsSync(saved);n++)await settlePage(page, 100);
      const reopened=new EditorDocument(fs.readFileSync(saved),saved);assert.equal(reopened.readOnly,false);assert.equal(reopened.model.Geosets.length,after.model.Geosets.length);
      assert.ok(reopened.model.Bones.some(n=>n.Name==='MDLxL Corpse 0'));checks.push('Native Save As '+format+' reopens with the corpse');fs.unlinkSync(saved);
    }
    assert.deepEqual(fs.readFileSync(fixture),original);assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({checks,errors,fixture,hidden:true,geosetsBefore:before.model.Geosets.length,geosetsAfter:after.model.Geosets.length},null,2));
    console.log(JSON.stringify({checks,errors}));
  } finally {
    // Electron is launched through a Windows command wrapper. End that exact
    // owned process tree as well as its hidden window; never leave helpers.
    if(process.platform==='win32') {
      try{require('node:child_process').execFileSync('taskkill',['/PID',String(appPid),'/T','/F'],{windowsHide:true,stdio:'ignore'});}catch(error){let exited=false;try{process.kill(appPid,0);}catch(probe){if(probe.code!=='ESRCH')throw probe;exited=true;}if(!exited)throw error;}
    } else await closeApp(app);
    fs.rmSync(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
