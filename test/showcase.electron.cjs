const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {_electron}=require(process.env.MDLXL_PLAYWRIGHT_MODULE||'C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
  const root=process.cwd(),out=path.join(root,'out/showcase');fs.mkdirSync(out,{recursive:true});
  const {createDemoDocument,createNode}=await import('../src/editor-document.js'),demo=createDemoDocument(),model=demo.model;
  model.Sequences.push({...structuredClone(model.Sequences[0]),Name:'Portrait Talk',Interval:new Uint32Array([2000,4000])},{...structuredClone(model.Sequences[0]),Name:'Death',Interval:new Uint32Array([4000,5000]),NonLooping:true});
  const offset=[650,-300,50];
  for(const geo of model.Geosets)for(let i=0;i<geo.Vertices.length;i++)geo.Vertices[i]+=offset[i%3];
  for(const node of [...model.Bones,...model.Attachments])for(let i=0;i<3;i++)node.PivotPoint[i]+=offset[i];
  model.GlobalSequences=new Uint32Array([1000]);
  const emitter=createNode(model,'ParticleEmitter2');emitter.Name='Showcase Sparks';emitter.Parent=model.Bones[0].ObjectId;emitter.PivotPoint=new Float32Array([650,-300,200]);emitter.Squirt=false;emitter.EmissionRate=20;
  model.Cameras=[{Name:'Portrait Camera',Position:new Float32Array([650,-650,170]),TargetPosition:new Float32Array([650,-300,155]),FieldOfView:Math.PI/4,NearClip:1,FarClip:1000}];
  const fixture=path.join(out,'ShowcaseTest.mdx');fs.writeFileSync(fixture,demo.serialize('mdx'));
  const videoFile=path.join(out,'trim-test.mp4'),ffmpeg=path.join(root,'electron/ffmpeg/ffmpeg.exe');
  execFileSync(ffmpeg,['-v','error','-f','lavfi','-i','testsrc2=size=160x120:rate=20','-f','lavfi','-i','sine=frequency=440:sample_rate=44100','-t','4','-c:v','libopenh264','-c:a','aac','-y',videoFile],{windowsHide:true});
  const entry=path.join(out,'main.cjs');
  fs.writeFileSync(entry,'const {app}=require("electron");app.getAppPath=()=>'+JSON.stringify(root)+';app.on("browser-window-created",(_,w)=>w.webContents.setBackgroundThrottling(false));require('+JSON.stringify(path.join(root,'electron/main.cjs'))+');');
  const app=await _electron.launch({executablePath:path.join(root,'node_modules/electron/dist/electron.exe'),args:['--disable-backgrounding-occluded-windows',entry,fixture],env:{...process.env,MDLVIS_HEADLESS:'1',MDLXL_PROFILE:path.join(out,'profile-'+Date.now())},timeout:60000});
  const errors=[];
  try{
    const page=await app.firstWindow();page.setDefaultTimeout(15000);page.on('pageerror',e=>{errors.push(e.message);console.error('PAGEERROR',e.message);});
    await page.getByRole('button',{name:'Showcase',exact:true}).click();
    const record=page.getByRole('button',{name:'RECORD',exact:true});
    await record.waitFor();await page.waitForFunction(()=>!document.querySelector('.showcase-record').disabled);
    const controls=await page.locator('.showcase-sidebar').boundingBox(),preview=await page.locator('.showcase-preview').boundingBox();
    assert.ok(controls.x>=preview.x+preview.width-1&&controls.width<=251,'Compact controls must occupy the right side');
    assert.equal(await page.locator('.showcase-preview [data-geometry-overlay],.showcase-preview [data-node-overlay]').count(),0);
    const canvas=page.locator('.showcase-preview [data-clean-model-canvas]');
    const sampling=()=>canvas.evaluate(c=>({aa:c.getContext('webgl2').getContextAttributes().antialias,ratio:c.width/c.clientWidth}));
    let high=await sampling();assert.equal(high.aa,true);assert.ok(high.ratio>1.95);
    await page.getByLabel('Graphics quality').selectOption('low');await page.waitForTimeout(700);
    const low=await sampling();assert.equal(low.aa,false);assert.ok(low.ratio<1.05);
    await page.getByLabel('Graphics quality').selectOption('medium');await page.waitForTimeout(700);
    const medium=await sampling();assert.equal(medium.aa,true);assert.ok(medium.ratio>1.45&&medium.ratio<1.55);
    await page.screenshot({path:path.join(out,'compact-menu.png')});
    assert.equal(await record.evaluate(b=>getComputedStyle(b).backgroundColor),'rgb(186, 32, 40)');console.log('LAYOUT AND PRESET SAMPLING',JSON.stringify({controls,preview,low,medium,high}));
    // Since ecc30f3d/2582431d the Showcase opens on a color background, sizes sequences automatically (plus Extra Time)
    // and records a centered Z-axis turntable: the free-camera list, orbit-axis dialog and screenshot batches are gone.
    await page.getByLabel('Background source').selectOption('folder');const backgrounds=page.getByLabel('Backgrounds',{exact:true});
    await page.waitForFunction(()=>document.querySelector('[aria-label="Backgrounds"]')?.options.length>1);
    console.log('STEP folder');await backgrounds.selectOption({index:1});
    await page.waitForTimeout(700);
    assert.ok(await page.locator('[data-preview-background]').evaluate(c=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;const colors=new Set();for(let i=0;i<d.length;i+=1024)colors.add(d[i]+','+d[i+1]+','+d[i+2]);return colors.size>16;}),'Folder background must render');
    console.log('STEP color');await page.getByLabel('Background source').selectOption('color');
    await page.getByLabel('Background color').fill('#22aa66');await page.waitForTimeout(150);
    assert.deepEqual(await page.locator('[data-preview-background]').evaluate(c=>Array.from(c.getContext('2d').getImageData(0,0,1,1).data)),[34,170,102,255]);
    const list=page.getByRole('list',{name:'Animation sequence'});
    console.log('STEP length');const extra=page.getByLabel('Extra Time',{exact:true}),base=Number((await page.locator('label.showcase-extra-time:has([aria-label="Extra Time"]) output').getAttribute('title')).match(/Sequence: ([0-9.]+)s/)[1]);
    assert.ok(base>0&&base<10,'automatic sequence length '+base);await extra.fill(String(Math.round((10-base)*100)/100));
    await page.locator('label.showcase-extra-time:has([aria-label="Extra Time"]) output').filter({hasText:/^10s$/}).waitFor();
    console.log('STEP video');await page.getByLabel('Background source').selectOption('media');
    await page.evaluate(()=>{const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){window.testVideo=this;return play.apply(this,arguments);};});
    await page.getByRole('region',{name:'Background',exact:true}).locator('input[type=file]').setInputFiles(videoFile);
    await page.getByLabel('To (s)').waitFor();await page.getByLabel('From (s)').fill('1');await page.getByLabel('To (s)').fill('2.5');
    await page.waitForTimeout(400);
    const video=await page.evaluate(()=>({muted:window.testVideo.muted,volume:window.testVideo.volume,time:window.testVideo.currentTime}));
    assert.equal(video.muted,true);assert.equal(video.volume,0);assert.ok(video.time>=1&&video.time<2.6);
    console.log('VIDEO TRIM',JSON.stringify(video));
    // Access the React-owned director only in the test, without adding a product debug API.
    const clock=()=>page.locator('.game-preview-root').evaluate(el=>{let f=el[Object.keys(el).find(k=>k.startsWith('__reactFiber$'))];while(f&&!f.memoizedProps?.showcase)f=f.return;return f.memoizedProps.showcase.sample(0);});
    // Supply regular render ticks to this hidden preview. Restore browser RAF
    // immediately after GamePreview binds its scheduler so UI automation retains
    // the native compositor API.
    await page.evaluate(()=>{window.savedRAF=window.requestAnimationFrame;window.savedCancelRAF=window.cancelAnimationFrame;window.requestAnimationFrame=callback=>setTimeout(()=>callback(performance.now()),16);window.cancelAnimationFrame=clearTimeout;});
    await page.getByLabel('Graphics quality').selectOption('low');await page.getByLabel('Recording FPS').selectOption('10');await page.waitForTimeout(500);
    await page.evaluate(()=>{window.requestAnimationFrame=window.savedRAF;window.cancelAnimationFrame=window.savedCancelRAF;});
    await page.locator('.game-preview-root').evaluate(el=>{
      let f=el[Object.keys(el).find(k=>k.startsWith('__reactFiber$'))];while(f&&!f.memoizedProps?.showcase)f=f.return;
      const director=f.memoizedProps.showcase,begin=director.begin,freeze=director.freeze,sample=director.sample;
      window.testRecordingTiming={samples:0};director.sample=(...args)=>{window.testRecordingTiming.samples++;return sample.apply(director,args);};
      director.begin=(...args)=>{window.testRecordingTiming.started=performance.now();return begin.apply(director,args);};
      director.freeze=(...args)=>{window.testRecordingTiming.finished=performance.now();return freeze.apply(director,args);};
    });
    console.log('STEP record');await record.click();await page.waitForSelector('.showcase-capture-status');await page.waitForTimeout(2200);
    const during=await clock();assert.ok(during.presentationTime>1700&&during.presentationTime<3000,'Visible clock must follow elapsed time');
    // The turntable (2582431d) has no free camera: it turns about the model's own center.
    assert.ok(Number.isFinite(during.angle),'Turntable angle follows the recording clock');
    assert.deepEqual((await record.evaluate(el=>{let f=el[Object.keys(el).find(k=>k.startsWith('__reactFiber$'))];while(f&&!f.memoizedProps?.captureAPI)f=f.return;return f.memoizedProps.captureAPI.modelCenter();})).map(Math.round),[650,-300,154]);
    await page.waitForFunction(()=>document.querySelector('.showcase-capture-status')?.textContent.includes('Creating GIF')||document.querySelector('.classic-status')?.textContent.includes('Saved')||document.querySelector('.capture-error'),{},{timeout:18000});
    const elapsed=await page.evaluate(()=>window.testRecordingTiming.finished-window.testRecordingTiming.started);assert.ok(elapsed>=9900&&elapsed<10600,'10 seconds must visibly complete in ~10 seconds: '+elapsed);
    await page.waitForFunction(()=>document.querySelector('.classic-status')?.textContent.includes('Saved')||document.querySelector('.capture-error'),{},{timeout:120000});
    assert.equal(await page.locator('.capture-error').count(),0,await page.locator('.showcase-capture').innerText());
    const status=await page.locator('.classic-status').innerText(),gifPath=status.match(/Saved (.+\.gif)/)?.[1];assert.ok(gifPath,status);
    const gif=fs.readFileSync(gifPath);let at=13,frames=0,delay=0;if(gif[10]&0x80)at+=3*(1<<((gif[10]&7)+1));
    while(at<gif.length){const marker=gif[at++];if(marker===0x3b)break;if(marker===0x21){const label=gif[at++];if(label===0xf9){assert.equal(gif[at++],4);at++;delay+=gif.readUInt16LE(at);at+=3;assert.equal(gif[at++],0);}else{while(true){const size=gif[at++];if(!size)break;at+=size;}}continue;}assert.equal(marker,0x2c);at+=9;const packed=gif[at-1];if(packed&0x80)at+=3*(1<<((packed&7)+1));at++;while(true){const size=gif[at++];if(!size)break;at+=size;}frames++;}
    assert.equal(delay,1000);assert.ok(frames>80&&frames<=101,'Captured real-time frame count '+frames);
    console.log('LIVE RECORDING',JSON.stringify({elapsed,frames,gifSeconds:delay/100,gifPath}));
    console.log('ERRORS',JSON.stringify(errors));assert.deepEqual(errors,[]);
    await page.screenshot({path:path.join(out,'completed-menu.png')});
  }catch(error){console.error('ORIGINAL FAILURE',error);const page=await app.firstWindow();await page.screenshot({path:path.join(out,'failure.png'),timeout:3000}).catch(()=>{});console.error((await page.locator('body').innerText({timeout:3000})).slice(-5000));throw error;}
  finally{await app.evaluate(({app})=>app.exit(0));}
})().catch(error=>{console.error(error);process.exitCode=1;});
