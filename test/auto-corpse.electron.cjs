// Real production bundle, hidden window, isolated profile. No desktop input.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {_electron}=require(process.env.MDLXL_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),out=process.env.MDLXL_TEST_OUT||path.join(root,'out/auto-corpse'),fixture=process.env.MDLXL_CORPSE_FIXTURE;
if(!fixture)throw Error('Set MDLXL_CORPSE_FIXTURE to a model with Death.');
function runtime() {
  const el=document.querySelector('.game-preview-root')||document.querySelector('.classic-view [aria-label="3D model viewport"]');
  if(!el)throw Error('Missing viewport');let top=el[Object.keys(el).find(k=>k.startsWith('__reactFiber'))];while(top.return)top=top.return;
  const stack=[top.stateNode.current];while(stack.length){const f=stack.pop();for(let h=f.memoizedState;h;h=h.next){const s=h.memoizedState?.current;if(f.memoizedProps?.model&&(s?.native&&s?.controls||s?.renderer&&s?.entries)){const p=f.memoizedProps,c=s.controls?.object||s.camera,canvas=s.renderer?.domElement||document.querySelector('[data-clean-model-canvas]');return {model:structuredClone(p.model),frame:s.native?.getFrame()??p.frame,sequence:p.sequenceIndex,camera:c.position.toArray(),quaternion:c.quaternion.toArray(),ready:s.captureApi?.isReady??true,rect:canvas.getBoundingClientRect().toJSON()};}}for(let c=f.child;c;c=c.sibling)stack.push(c);}
  throw Error('Missing viewport runtime');
}
(async()=>{
  fs.mkdirSync(out,{recursive:true});const profile=fs.mkdtempSync(path.join(out,'profile-'));fs.writeFileSync(path.join(profile,'settings.json'),JSON.stringify({gameData:'D:\\Warcraft III',preferences:{language:'en'}}));
  const original=fs.readFileSync(fixture),app=await _electron.launch({executablePath:process.env.MDLXL_TEST_EXE||require('electron'),args:[...(process.env.MDLXL_TEST_EXE?[]:[root]),fixture,'--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding','--disable-background-timer-throttling'],env:{...process.env,MDLVIS_HEADLESS:'1',MDLXL_PROFILE:profile},timeout:60000});
  const appPid=await app.evaluate(()=>process.pid),errors=[],checks=[];
  try {
    const page=await app.firstWindow();page.setDefaultTimeout(25000);page.on('pageerror',e=>errors.push(e.message));
    await page.evaluate('window.corpseRuntime='+runtime.toString());
    await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.webContents.setBackgroundThrottling(false);w.setBounds({x:0,y:0,width:1500,height:950});});
    assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible()),false);
    await page.getByLabel('3D model viewport',{exact:true}).waitFor();
    const before=await page.evaluate(runtime),button=page.getByRole('button',{name:'Auto Corpse (test)',exact:true}),vis=page.getByRole('button',{name:'VIS',exact:true});
    const a=await button.boundingBox(),b=await vis.boundingBox();assert.ok(Math.abs(a.y-b.y)<4);assert.ok(a.width<=50);assert.equal(await page.getByRole('dialog').count(),0);
    await button.click();await page.locator('[data-clean-model-canvas]').waitFor();await page.waitForTimeout(700);
    const after=await page.evaluate(runtime);assert.ok(after.model.Geosets.length>before.model.Geosets.length);assert.match(after.model.Sequences[after.sequence].Name,/Decay Flesh/i);assert.equal(await page.getByRole('dialog').count(),0);
    checks.push('One compact button beside VIS; one click creates corpse and opens Decay Flesh without a dialog');
    const input=page.getByLabel('Current animation frame',{exact:true});
    async function seek(time){await input.fill(String(time));await input.press('Enter');await page.waitForFunction(t=>Math.abs(window.corpseRuntime().frame-t)<1,time);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
    async function capture(name){const data=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.capturePage(undefined,{stayHidden:true,stayAwake:true}).then(i=>i.toPNG().toString('base64')));fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(data,'base64'));}
    for(const label of ['Bones','Skeleton','Nodes','Emitters','Events','Sounds']) {const box=page.getByRole('checkbox',{name:label,exact:true});if(await box.count())await box.uncheck();}
    const s=after.model.Sequences[after.sequence];await page.getByLabel('View direction',{exact:true}).selectOption('top');await page.getByRole('button',{name:'Fit',exact:true}).click();await seek(s.Interval[0]+167);await capture('body-cover');
    const bi=after.model.Sequences.findIndex(s=>/^Decay Bones?$/i.test(s.Name));await page.getByLabel('Choose animation sequence',{exact:true}).selectOption(String(bi));await seek(after.model.Sequences[bi].Interval[0]);await capture('corpse');
    console.log('Body and corpse captured at the same camera scale.');
    if(process.env.MDLXL_CORPSE_CAPTURE_ONLY==='1')return;
    // Normal camera tool plus actual pointer drag through Chromium on the
    // hidden window, never OS-level input on the user's desktop.
    await page.getByLabel('View direction',{exact:true}).selectOption('perspective');await page.getByRole('button',{name:'Camera rotation',exact:true}).click();
    const view=await page.evaluate(runtime),r=view.rect;await page.mouse.move(r.x+r.width*.6,r.y+r.height*.5);await page.mouse.down();await page.mouse.move(r.x+r.width*.6+70,r.y+r.height*.5+35,{steps:8});await page.mouse.up();await page.waitForTimeout(100);assert.notDeepEqual((await page.evaluate(runtime)).quaternion,view.quaternion);checks.push('Normal mouse camera rotation remains functional');
    await page.getByRole('button',{name:'Undo',exact:true}).click();await page.waitForTimeout(120);assert.deepEqual((await page.evaluate(runtime)).model,before.model);await page.getByRole('button',{name:'Redo',exact:true}).click();await page.waitForTimeout(120);assert.deepEqual((await page.evaluate(runtime)).model,after.model);checks.push('One Undo restores the exact original model; Redo restores the result');
    await button.click();await page.waitForTimeout(100);assert.deepEqual((await page.evaluate(runtime)).model,after.model);checks.push('Repeat click creates no duplicate corpse, mesh, material or key');
    console.log('Camera, Undo, Redo and repeat click passed.');
    const {EditorDocument}=await import('../src/editor-document.js');
    for(const format of ['MDX','MDL']) {
      const saved=path.join(out,'saved.'+format.toLowerCase());
      await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});},saved);
      await page.keyboard.press('F12');await page.getByRole('button',{name:'Save '+format+'…',exact:true}).click();
      await page.getByRole('dialog',{name:'Save as',exact:true}).waitFor({state:'hidden'});
      for(let n=0;n<100&&!fs.existsSync(saved);n++)await page.waitForTimeout(100);
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
    } else await app.close();
    fs.rmSync(profile,{recursive:true,force:true,maxRetries:10,retryDelay:100});
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
