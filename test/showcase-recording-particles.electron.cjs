const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {_electron}=require(process.env.MDLXL_PLAYWRIGHT_MODULE||'C:/Users/PC/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const source=process.cwd(),root=process.env.MDLXL_TEST_ROOT||source,out=path.join(source,'out','recording-particles-'+Date.now());fs.mkdirSync(out,{recursive:true});
 const {createDemoDocument,createNode}=await import('../src/editor-document.js');const demo=createDemoDocument(),m=demo.model;
 const tga=Buffer.alloc(18+4*4*4,255);tga.fill(0,0,18);tga[2]=2;tga.writeUInt16LE(4,12);tga.writeUInt16LE(4,14);tga[16]=32;tga[17]=0x28;fs.writeFileSync(path.join(out,'white.tga'),tga);
 m.Textures.push({Image:'white.tga',ReplaceableId:0,Flags:0});
 const emitter=createNode(m,'ParticleEmitter2');Object.assign(emitter,{Squirt:false,TextureID:m.Textures.length-1,EmissionRate:80,Speed:35,Width:90,Length:90,Latitude:45,LifeSpan:1,Visibility:1,FilterMode:2,SegmentColor:[0,1,2].map(()=>new Float32Array([0,1,0])),Alpha:new Uint8Array([255,255,255]),ParticleScaling:new Float32Array([12,12,12])});emitter.PivotPoint[2]=150;
 m.Sequences[0].Interval=new Uint32Array([0,1000]);const fixture=path.join(out,'RecordingParticles.mdx');fs.writeFileSync(fixture,demo.serialize('mdx'));
 const entry=path.join(out,'main.cjs');fs.writeFileSync(entry,`const {app}=require('electron');app.getAppPath=()=>${JSON.stringify(root)};const {GameDataDiscovery}=require(${JSON.stringify(path.join(root,'electron/game-data.cjs'))});GameDataDiscovery.prototype.discover=async()=>({folders:[],archives:[],cascFolders:[]});app.on('browser-window-created',(_,w)=>w.webContents.setBackgroundThrottling(false));require(${JSON.stringify(path.join(root,'electron/main.cjs'))});`);
 const app=await _electron.launch({executablePath:process.env.MDLXL_TEST_EXE||path.join(source,'node_modules/electron/dist/electron.exe'),args:['--disable-backgrounding-occluded-windows',entry,fixture],env:{...process.env,MDLVIS_HEADLESS:'1',MDLXL_PROFILE:path.join(out,'profile')},timeout:60000});
 try{
  const page=await app.firstWindow();page.setDefaultTimeout(30000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.setSize(1000,740);w.setPosition(-2500,0);w.webContents.setBackgroundThrottling(false);w.showInactive();});
  await page.getByRole('button',{name:'Showcase',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.showcase-record')&&!document.querySelector('.showcase-record').disabled);
  await page.getByRole('list',{name:'Animation sequence'}).locator('li').first().dblclick();await page.getByRole('dialog').getByLabel('Animation Extra Time').fill('0');await page.getByRole('dialog').getByRole('button',{name:'OK',exact:true}).click();
  await page.locator('.showcase-workspace').evaluate(el=>{
   let f=el[Object.keys(el).find(k=>k.startsWith('__reactFiber$'))],api;while(f&&!api){for(let h=f.memoizedState;h;h=h.next)if(h.memoizedState?.prepareRecording){api=h.memoizedState;break;}f=f.return;}if(!api)throw Error('No capture API');
   const seek=api.seekRecordingFrame.bind(api);window.recordingParticleSamples=[];
   api.seekRecordingFrame=async time=>{await seek(time);await new Promise(resolve=>setTimeout(resolve,80));
    const c=api.captureFrame({maxDimension:400}),p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let green=0;for(let i=0;i<p.length;i+=4)if(p[i+1]>40&&p[i+1]>p[i]*1.8&&p[i+1]>p[i+2]*1.8)green++;
    window.recordingParticleSamples.push({time,globalTime:api.playbackState().globalTime,green,png:time>=500&&time<540?c.toDataURL():undefined});
   };
  });
  await page.locator('.showcase-record').click();await page.waitForFunction(()=>document.querySelector('.classic-status')?.textContent.startsWith('Saved '),null,{timeout:120000});
  const status=await page.locator('.classic-status').innerText(),samples=await page.evaluate(()=>window.recordingParticleSamples),mid=samples.find(s=>s.png);assert.ok(mid);fs.writeFileSync(path.join(out,'capture.png'),Buffer.from(mid.png.split(',')[1],'base64'));for(const s of samples){delete s.png;assert.ok(Math.abs(s.globalTime-s.time)<1e-5,JSON.stringify(s));}assert.ok(samples.filter(s=>s.time>=200&&s.time<1000).every(s=>s.green>20),JSON.stringify(samples));assert.deepEqual(errors,[]);
  const gif=status.slice(6).split(' · ')[0];assert.ok(fs.existsSync(gif),status);fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify({gif,samples},null,2));console.log(JSON.stringify({passed:true,out,gif,frames:samples.length,minimumGreenPixels:Math.min(...samples.filter(s=>s.time>=200&&s.time<1000).map(s=>s.green))}));
 }catch(error){const page=await app.firstWindow();console.error((await page.locator('body').innerText()).slice(-1800));await page.screenshot({path:path.join(out,'failure.png')});throw error;}
 finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});}
})().catch(e=>{console.error(e);process.exitCode=1;});
