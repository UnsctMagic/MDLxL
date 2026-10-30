const { launchApp, closeApp, stubDialogs, clickMenu, sha256File, settle } = require('./helpers/app.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');

(async()=>{
  const root=process.cwd(),out=path.join(root,'out/showcase-verification/actions-'+Date.now());fs.mkdirSync(out,{recursive:true});
    const {createDemoDocument}=await import('../src/editor-document.js'),doc=createDemoDocument();
  doc.model.Sequences.push({...structuredClone(doc.model.Sequences[0]),Name:'Portrait Talk',Interval:new Uint32Array([2000,4000])});
  doc.model.Cameras=[{Name:'Portrait Camera',Position:new Float32Array([0,-350,120]),TargetPosition:new Float32Array([0,0,100]),FieldOfView:Math.PI/4,NearClip:1,FarClip:1000}];
  const fixture=path.join(out,'ShowcaseActions.mdx');fs.writeFileSync(fixture,doc.serialize('mdx'));
  doc.model.Info.Name='Second Showcase';const other=path.join(out,'SecondShowcase.mdx');fs.writeFileSync(other,doc.serialize('mdx'));
  const hash=()=>sha256File(fixture),originalHash=hash();
  const launched = await launchApp({ out, fixture, timeout: 60000, bounds: { x: -3000, y: 0, width: 1280, height: 960 }, show: 'hide', pageTimeout: 20000 }); const app = launched.app; const packaged = launched.target.packaged ? path.dirname(launched.target.executablePath) : root;
  const errors=launched.errors;
  try{
    const page=launched.page;
    await app.evaluate(({BrowserWindow,ipcMain})=>{

      global.captureEvents=[];global.frameDelay=0;global.beginDelay=0;
      for(const channel of ['preview:recordBegin','preview:recordFrame','preview:recordFinish','preview:recordSave','preview:recordDiscard']){
        const handler=ipcMain._invokeHandlers.get(channel);ipcMain.removeHandler(channel);
        ipcMain.handle(channel,async(event,payload)=>{global.captureEvents.push({channel,time:Date.now(),jobId:payload?.jobId||payload});
          if(channel==='preview:recordFrame'&&global.frameDelay)await new Promise(resolve=>setTimeout(resolve,global.frameDelay));
          if(channel==='preview:recordBegin'&&global.beginDelay)await new Promise(resolve=>setTimeout(resolve,global.beginDelay));
          return handler(event,payload);});
      }
    });

    await page.addInitScript(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});window.requestAnimationFrame=callback=>setTimeout(()=>callback(performance.now()),16);window.cancelAnimationFrame=clearTimeout;});
    await page.reload();await page.getByRole('button',{name:'Showcase',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('.showcase-record')&&!document.querySelector('.showcase-record').disabled);
    await page.evaluate(()=>{
      window.showcaseAPI=()=>{const api=findFiberState('.showcase-workspace',v=>v?.showcaseView);if(api)return api;throw Error('Showcase API missing');};
      window.showcaseHistory=()=>{const history=findFiberState('.showcase-workspace',v=>v?.travel&&v.undo);if(history)return history;throw Error('Showcase history missing');};
      window.showcaseState=()=>window.showcaseHistory().present;
    });
    const ready=()=>page.waitForFunction(()=>document.querySelector('.showcase-fields')&&!document.querySelector('.showcase-fields').disabled&&window.showcaseAPI().isReady);
    const undo=async()=>{await page.keyboard.press('Control+z');await settle(page, 80);await ready();};
    const redo=async()=>{await page.keyboard.press('Control+y');await settle(page, 80);await ready();};
    await ready();await settle(page, 150);
    assert.ok((await page.locator('.showcase-sidebar').boundingBox()).width<=251);
    if(process.env.MDLXL_MODEL_PROOF){
      const canvas=page.locator('.showcase-preview [data-clean-model-canvas]'),box=await canvas.boundingBox();await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.5+90,box.y+box.height*.5+30,{steps:6});await page.mouse.up();await settle(page, 150);
      await page.getByRole('region',{name:'Text',exact:true}).getByRole('button',{name:'Add',exact:true}).click();await ready();
      await page.getByRole('button',{name:/^Add to recording list/}).click();await ready();await page.getByRole('button',{name:'Edit recording 1',exact:true}).click();await ready();await page.getByRole('button',{name:'Save changes',exact:true}).click();await ready();await page.getByRole('button',{name:'Remove recording 1',exact:true}).click();
      await stubDialogs(app, { open: other });
      await page.getByRole('button',{name:'Load model',exact:true}).click();await ready();
      await undo();
      assert.ok((await page.locator('.showcase-model-file').innerText()).includes('ShowcaseActions.mdx'));await redo();assert.ok((await page.locator('.showcase-model-file').innerText()).includes('SecondShowcase.mdx'));console.log('PASS isolated model-load undo and redo');return;
    }
    if(process.env.MDLXL_QUEUE_PROOF){
      const add=page.getByRole('button',{name:/^Add to recording list/});await add.click();await ready();await add.click();await ready();
      const before=await page.evaluate(()=>window.showcaseState().recordingList.map(row=>row.id));
      const entries=page.locator('.showcase-recording-list li'),box=await entries.last().boundingBox();await entries.first().dragTo(entries.last(),{targetPosition:{x:30,y:box.height-2}});await settle(page, 300);
      assert.deepEqual(await page.evaluate(()=>window.showcaseState().recordingList.map(row=>row.id)),[...before].reverse());
      await undo();assert.deepEqual(await page.evaluate(()=>window.showcaseState().recordingList.map(row=>row.id)),before);await redo();assert.deepEqual(await page.evaluate(()=>window.showcaseState().recordingList.map(row=>row.id)),[...before].reverse());console.log('PASS isolated queue reorder undo and redo');return;
    }
    if(process.env.MDLXL_PORTRAIT_PROOF){
      await page.getByRole('tab',{name:'Portrait',exact:true}).click();await ready();await settle(page, 250);
      const canvas=page.locator('.showcase-preview [data-clean-model-canvas]'),box=await canvas.boundingBox();
      await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.5+90,box.y+box.height*.5+30,{steps:6});await page.mouse.up();await settle(page, 100);
      const turned=await page.evaluate(()=>window.showcaseAPI().cameraView().position);await undo();assert.equal(await page.evaluate(()=>window.showcaseHistory().redo.length),1);
      await redo();const restored=await page.evaluate(()=>window.showcaseAPI().cameraView().position);restored.forEach((value,index)=>assert.ok(Math.abs(value-turned[index])<1e-7));console.log('PASS isolated portrait undo and redo');return;
    }
    if(process.env.MDLXL_BATCH_PROOF){
      await page.getByRole('group',{name:'GIF quality',exact:true}).getByRole('button',{name:'Low',exact:true}).click();await ready();await page.getByLabel('Recording FPS').selectOption('10');
      const add=page.getByRole('button',{name:/^Add to recording list/});await add.click();await ready();await add.click();await ready();
      const pending=await page.evaluate(()=>window.showcaseState().recordingList.map(row=>row.id));
      await page.getByRole('button',{name:'RECORD',exact:true}).click();
      await page.waitForFunction(()=>document.querySelector('.showcase-capture-status')?.textContent.includes('Take 2 / 2')&&document.querySelector('.showcase-capture-status')?.textContent.includes('seconds'),null,{timeout:60000});
      await page.getByRole('button',{name:'STOP',exact:true}).click();await ready();
      assert.deepEqual(await page.evaluate(()=>window.showcaseState().recordingList.map(row=>row.id)),[pending[1]]);
      await page.waitForFunction(()=>![...document.querySelectorAll('.showcase-capture-status')].some(node=>node.textContent.includes('Making GIFs')),null,{timeout:90000});
      const events=await app.evaluate(()=>global.captureEvents);
      assert.equal(events.filter(row=>row.channel==='preview:recordFinish').length,1);assert.equal(events.filter(row=>row.channel==='preview:recordSave').length,1);assert.equal(events.filter(row=>row.channel==='preview:recordDiscard').length,1);
      assert.equal(hash(),originalHash);assert.deepEqual(errors,[]);console.log('PASS batch STOP keeps the completed GIF and leaves the cancelled take queued');return;
    }
    const color=page.getByLabel('Background color',{exact:true}),initialColor=await color.inputValue();
    await color.fill('#22aa66');await undo();assert.equal(await color.inputValue(),initialColor);await redo();assert.equal(await color.inputValue(),'#22aa66');
    const light=page.getByLabel('Light',{exact:true});await light.selectOption('none');await undo();assert.equal(await light.inputValue(),'ingame');await redo();assert.equal(await light.inputValue(),'none');
    await clickMenu(app, 'Undo');await settle(page, 80);await ready();assert.equal(await light.inputValue(),'ingame');
    await clickMenu(app, 'Redo');await settle(page, 80);await ready();assert.equal(await light.inputValue(),'none');
    await page.getByRole('group',{name:'GIF quality',exact:true}).getByRole('button',{name:'Low',exact:true}).click();await ready();await page.getByLabel('Recording FPS').selectOption('10');
    const crop=page.getByLabel('Crop size',{exact:true});await crop.selectOption('square');await undo();assert.equal(await crop.inputValue(),'free');await redo();assert.equal(await crop.inputValue(),'square');
    console.log('PASS settings, color, crop, undo and redo');
    const canvas=page.locator('.showcase-preview [data-clean-model-canvas]'),box=await canvas.boundingBox();
    await canvas.click();const view=await page.evaluate(()=>window.showcaseAPI().showcaseView());
    const steps=await page.evaluate(()=>window.showcaseHistory().undo.length);
    await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.5+110,box.y+box.height*.5+40,{steps:8});await page.mouse.up();await settle(page, 150);
    const turned=await page.evaluate(()=>window.showcaseAPI().showcaseView());assert.notDeepEqual(turned.camera.position,view.camera.position,'Normal mouse drag rotates the camera');
    assert.equal(await page.evaluate(()=>window.showcaseHistory().undo.length),steps+1,'Mouse rotation is one undo step');
    await undo();const restored=await page.evaluate(()=>window.showcaseAPI().showcaseView());
    for(const key of ['position','target'])restored.camera[key].forEach((value,index)=>assert.ok(Math.abs(value-view.camera[key][index])<1e-7));await redo();
    console.log('PASS actual mouse rotation and camera undo');
    await page.getByRole('tab',{name:'Portrait',exact:true}).click();await ready();await settle(page, 200);
    const portraitBox=await canvas.boundingBox(),portraitView=await page.evaluate(()=>window.showcaseAPI().showcaseView());
    await page.mouse.move(portraitBox.x+portraitBox.width*.5,portraitBox.y+portraitBox.height*.5);await page.mouse.down();await page.mouse.move(portraitBox.x+portraitBox.width*.5+90,portraitBox.y+portraitBox.height*.5+30,{steps:6});await page.mouse.up();await settle(page, 100);
    assert.notDeepEqual(await page.evaluate(()=>window.showcaseAPI().cameraView().position),portraitView.camera.position);
    await undo();const undonePortrait=await page.evaluate(()=>window.showcaseAPI().cameraView());undonePortrait.position.forEach((value,index)=>assert.ok(Math.abs(value-portraitView.camera.position[index])<1e-7));
    await redo();assert.notDeepEqual(await page.evaluate(()=>window.showcaseAPI().cameraView().position),portraitView.camera.position);
    await page.getByRole('tab',{name:'Sequences',exact:true}).click();await ready();console.log('PASS portrait mouse rotation, undo and redo');
    const text=page.getByRole('region',{name:'Text',exact:true});await text.getByRole('button',{name:'Add',exact:true}).click();
    const content=page.getByLabel('Text content');await content.fill('UNDO THIS TEXT');await undo();assert.equal(await content.inputValue(),'Your text');await redo();assert.equal(await content.inputValue(),'UNDO THIS TEXT');
    await page.getByRole('button',{name:'Bold',exact:true}).click();await undo();assert.equal(await page.getByRole('button',{name:'Bold',exact:true}).getAttribute('aria-pressed'),'false');await redo();
    const textSize=page.getByLabel('Text size',{exact:true});await textSize.fill('72');await textSize.press('Enter');await undo();assert.equal(await textSize.inputValue(),'48');await redo();assert.equal(await textSize.inputValue(),'72');
    const layer=page.locator('.showcase-layer-selection'),layerBox=await layer.boundingBox(),beforeRect=await page.evaluate(()=>window.showcaseState().layers[0].rect);
    await page.mouse.move(layerBox.x+layerBox.width*.5,layerBox.y+layerBox.height*.5);await page.mouse.down();await page.mouse.move(layerBox.x+layerBox.width*.5+70,layerBox.y+layerBox.height*.5+35,{steps:6});await page.mouse.up();await settle(page, 100);
    assert.notDeepEqual(await page.evaluate(()=>window.showcaseState().layers[0].rect),beforeRect);await undo();assert.deepEqual(await page.evaluate(()=>window.showcaseState().layers[0].rect),beforeRect);
    await text.getByRole('button',{name:'Remove',exact:true}).click();await undo();assert.equal(await content.inputValue(),'UNDO THIS TEXT');
    console.log('PASS text field, formatting, layer drag and deletion undo');
    // Use a real signature file to prove undo keeps its blob URL usable.
    const image=path.join(out,'signature.png');await canvas.screenshot({path:image});
    const signature=page.getByRole('region',{name:'Signature',exact:true});await signature.locator('input[type=file]').setInputFiles(image);await ready();
    await signature.locator('.showcase-section-toggle').click();await signature.getByRole('button',{name:'Remove',exact:true}).click();await undo();
    const signatureURL=await page.evaluate(()=>window.showcaseState().layers.find(row=>row.kind==='image').url);
    assert.ok(await page.evaluate(async url=>(await fetch(url)).ok,signatureURL));
    console.log('PASS removed signature restored with readable image bytes');
    await page.getByLabel('Signature preset name').fill('Undo signature');await signature.getByRole('button',{name:'Save preset',exact:true}).click();await ready();
    assert.equal(await page.getByLabel('Signature presets').locator('option').count(),2);await undo();assert.equal(await page.getByLabel('Signature presets').locator('option').count(),1);await redo();assert.equal(await page.getByLabel('Signature presets').locator('option').count(),2);
    await signature.getByRole('button',{name:'Delete preset',exact:true}).click();await ready();await undo();assert.equal(await page.getByLabel('Signature presets').locator('option').count(),2);
    await page.locator('.showcase-preset-actions').first().getByRole('button',{name:'Save preset',exact:true}).click();
    const presetDialog=page.getByRole('dialog',{name:'Save preset',exact:true});await presetDialog.getByLabel('Showcase preset name').fill('Undo layout');await presetDialog.getByRole('button',{name:'OK',exact:true}).click();await ready();
    assert.equal(await page.evaluate(()=>window.showcaseState().presets.length),1);await undo();assert.equal(await page.evaluate(()=>window.showcaseState().presets.length),0);await redo();assert.equal(await page.evaluate(()=>window.showcaseState().presets.length),1);
    console.log('PASS signature and layout preset persistence undo and redo');
    const add=page.getByRole('button',{name:/^Add to recording list/});await add.click();await ready();await add.click();await ready();
    assert.equal(await page.locator('.showcase-recording-list li').count(),2);
    const order=await page.evaluate(()=>window.showcaseState().recordingList.map(row=>row.id));
    const entries=page.locator('.showcase-recording-list li'),dropBox=await entries.last().boundingBox();await entries.first().dragTo(entries.last(),{targetPosition:{x:30,y:dropBox.height-2}});await settle(page, 150);
    assert.deepEqual(await page.evaluate(()=>window.showcaseState().recordingList.map(row=>row.id)),[...order].reverse());await undo();assert.deepEqual(await page.evaluate(()=>window.showcaseState().recordingList.map(row=>row.id)),order);
    await page.getByRole('button',{name:'Remove recording 1',exact:true}).click();await undo();assert.equal(await page.locator('.showcase-recording-list li').count(),2);
    await redo();assert.equal(await page.locator('.showcase-recording-list li').count(),1);await undo();
    await page.getByRole('button',{name:'Edit recording 1',exact:true}).click();await ready();await light.selectOption('portrait');await page.getByRole('button',{name:'Save changes',exact:true}).click();await ready();
    await undo();assert.equal(await page.getByRole('button',{name:'Save changes',exact:true}).count(),1);await redo();assert.equal(await page.getByRole('button',{name:'Save changes',exact:true}).count(),0);
    console.log('PASS queued take addition, removal and saved edit undo');
    for(let n=2;n>0;n--)await page.getByRole('button',{name:'Remove recording '+n,exact:true}).click();
    await stubDialogs(app, { open: other });
    await page.getByRole('button',{name:'Load model',exact:true}).click();await ready();assert.ok((await page.locator('.showcase-model-file').innerText()).includes('SecondShowcase.mdx'));
    await undo();assert.ok((await page.locator('.showcase-model-file').innerText()).includes('ShowcaseActions.mdx'));await redo();assert.ok((await page.locator('.showcase-model-file').innerText()).includes('SecondShowcase.mdx'));await undo();
    console.log('PASS model loading undo restores the actual preview model');
    const animations=page.getByRole('list',{name:'Animation sequence'});await animations.locator('li').first().click();
    const dialog=page.getByRole('dialog',{name:'Edit animation',exact:true}),extra=dialog.getByLabel('Animation Extra Time');
    await extra.fill('5');await extra.press('Enter');await undo();assert.equal(await extra.inputValue(),'0');await redo();assert.equal(await extra.inputValue(),'5');await dialog.getByRole('button',{name:'OK',exact:true}).click();
    await page.getByRole('group',{name:'GIF quality',exact:true}).getByRole('button',{name:'High',exact:true}).click();assert.equal(await page.locator('.showcase-error').count(),0);assert.ok(!(await page.locator('.showcase-export-note').innerText()).includes('5s'));
    const events=()=>app.evaluate(()=>global.captureEvents),reset=()=>app.evaluate(()=>{global.captureEvents=[];});
    const stop=page.getByRole('button',{name:'STOP',exact:true}),record=page.getByRole('button',{name:'RECORD',exact:true});
    await reset();await app.evaluate(()=>global.beginDelay=500);await record.click();await stop.click();await ready();await app.evaluate(()=>global.beginDelay=0);
    assert.ok((await events()).every(row=>!['preview:recordFinish','preview:recordSave'].includes(row.channel)));
    await reset();await record.click();await page.waitForFunction(()=>document.querySelector('.showcase-capture-status')?.textContent.includes('seconds'));await settle(page, 300);await stop.click();await ready();
    let cancelled=await events();assert.ok(cancelled.some(row=>row.channel==='preview:recordDiscard'));assert.ok(cancelled.every(row=>!['preview:recordFinish','preview:recordSave'].includes(row.channel)));
    await reset();await app.evaluate(()=>global.frameDelay=75);await record.click();
    await page.waitForFunction(()=>document.querySelector('.showcase-capture-status')?.textContent.includes('Capturing GIF frames'),null,{timeout:30000});await stop.click();await ready();await app.evaluate(()=>global.frameDelay=0);
    cancelled=await events();assert.ok(cancelled.some(row=>row.channel==='preview:recordFrame'));assert.ok(cancelled.some(row=>row.channel==='preview:recordDiscard'));assert.ok(cancelled.every(row=>!['preview:recordFinish','preview:recordSave'].includes(row.channel)));
    console.log('PASS STOP cancels preparation, live recording and frame capture without finish/save');
    // Recordings land beside the shared package, so earlier runs' GIFs stay there; count only this take's file.
    const directory=path.join(packaged,'Showcase Recordings','ShowcaseActions'),gifs=()=>fs.existsSync(directory)?fs.readdirSync(directory).filter(name=>name.endsWith('.gif')):[],earlier=new Set(gifs());
    await reset();await record.click();await page.waitForFunction(()=>document.querySelector('.showcase-record')?.textContent==='RECORD',null,{timeout:90000});
    await page.waitForFunction(()=>![...document.querySelectorAll('.showcase-capture-status')].some(node=>node.textContent.includes('Making GIFs')),null,{timeout:120000});
    assert.ok((await events()).some(row=>row.channel==='preview:recordFinish'));assert.ok((await events()).some(row=>row.channel==='preview:recordSave'));
    const files=gifs().filter(name=>!earlier.has(name));assert.equal(files.length,1);
    const bytes=fs.readFileSync(path.join(directory,files[0]));let offset=13+(bytes[10]&128?3*(1<<((bytes[10]&7)+1)):0),duration=0,frames=0;
    const blocks=()=>{while(bytes[offset])offset+=bytes[offset]+1;offset++;};
    while(offset<bytes.length){const type=bytes[offset++];if(type===0x3b)break;
      if(type===0x21){if(bytes[offset++]===0xf9)duration+=bytes.readUInt16LE(offset+2)*10;blocks();}
      else if(type===0x2c){frames++;const packed=bytes[offset+8];offset+=9;if(packed&128)offset+=3*(1<<((packed&7)+1));offset++;blocks();}
      else assert.fail('Invalid GIF block');}
    const result={duration,frames,bytes:bytes.length};
    assert.equal(result.duration,7000);assert.equal(result.frames,210);console.log('PASS High-quality real GIF exceeds 5 seconds',JSON.stringify(result));
    assert.equal(hash(),originalHash);assert.deepEqual(errors,[]);await page.screenshot({path:path.join(out,'verified-showcase.png')});console.log('PASS source model unchanged; no renderer errors; artifacts',out);
  }catch(error){const page=launched.page;await page.screenshot({path:path.join(out,'failure.png')});console.log('FAILURE DOM',await page.locator('.showcase-sidebar').innerText());console.log('FAILURE STATUS',await page.locator('.classic-status').innerText());console.log('FAILURE HISTORY',JSON.stringify(await page.evaluate(()=>({redo:window.showcaseHistory().redo.length,last:window.showcaseHistory().undo.slice(-2).map(row=>({before:row.before.source.modelName,after:row.after.source.modelName,changes:Object.keys(row.after).filter(key=>key==='view'?JSON.stringify(row.before.view)!==JSON.stringify(row.after.view):row.before[key]!==row.after[key])}))}))));throw error;}
  finally{await closeApp(app);}
})().catch(error=>{console.error(error);process.exitCode=1;});
