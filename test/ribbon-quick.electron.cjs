const {_electron}=require(process.env.MDLXL_PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const root=process.cwd(),out=path.join(root,'out','ribbon-quick','run-'+Date.now());await fs.mkdir(out,{recursive:true});
 const {CascReader}=require('../electron/casc.cjs'),reader=new CascReader('D:/Warcraft III',root);let bytes;
 try{bytes=await reader.read('war3.w3mod:units\\orc\\heroblademaster\\heroblademaster.mdx');}finally{reader.close();}
 const fixture=path.join(out,'Blademaster.mdx');await fs.writeFile(fixture,bytes);
 const {openDocument}=await import('../src/editor-document.js'),{RIBBON_TEXTURE}=await import('../src/particle-starters.js');
 const original=openDocument(bytes,fixture).model;
 let app;const errors=[];
 try{
  app=await _electron.launch({executablePath:path.resolve('node_modules/electron/dist/electron.exe'),args:['--disable-backgrounding-occluded-windows',root,fixture],env:{...process.env,MDLVIS_HEADLESS:'1',MDLXL_PROFILE:path.join(out,'profile')},timeout:60000});
  const page=await app.firstWindow();page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message));
  await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.webContents.setBackgroundThrottling(false);w.setFocusable(false);w.setSkipTaskbar(true);w.setIgnoreMouseEvents(true);w.setOpacity(0);w.setSize(1400,920);w.setPosition(-3000,0);w.showInactive();});
  await page.getByText('Opened Blademaster.mdx',{exact:true}).waitFor();
  await page.locator('.classic-geosets').getByRole('button',{name:'Clear',exact:true}).click();
  await page.getByLabel('Select geoset 3',{exact:true}).check();await page.getByLabel('Show all geosets',{exact:true}).uncheck();
  await page.getByLabel('View direction',{exact:true}).selectOption('top');
  await page.locator('.viewport').click({position:{x:30,y:120}});await page.keyboard.press('Control+A');await page.getByRole('button',{name:'Fit selection',exact:true}).click();
  await page.waitForTimeout(150);
  const centers=await page.evaluate(points=>{let el=document.querySelector('.viewport'),f=el[Object.keys(el).find(k=>k.startsWith('__reactFiber'))];for(;f;f=f.return)for(let h=f.memoizedState;h;h=h.next){const state=h.memoizedState?.current;if(state?.renderer&&state?.camera){const rect=state.renderer.domElement.getBoundingClientRect();return points.map(point=>{const v=state.camera.position.clone().set(...point).project(state.camera);return {x:rect.x+(v.x+1)*rect.width/2,y:rect.y+(1-v.y)*rect.height/2};});}}throw Error('Camera missing');},[8,9,10].map(face=>{const g=original.Geosets[3],ids=Array.from(g.Faces.slice(face*3,face*3+3));return [0,1,2].map(axis=>ids.reduce((sum,id)=>sum+g.Vertices[id*3+axis],0)/3);}));
  for(let i=0;i<centers.length;i++){if(i)await page.keyboard.down('Shift');await page.mouse.click(centers[i].x,centers[i].y);if(i)await page.keyboard.up('Shift');}
  await page.evaluate(()=>{window.ribbonProbe=()=>{let session,runtime;for(const root of document.querySelectorAll('.game-preview-root, .viewport, .classic-view'))for(let f=root[Object.keys(root).find(k=>k.startsWith('__reactFiber'))];f;f=f.return)for(let h=f.memoizedState;h;h=h.next){const state=h.memoizedState,ref=state?.current;if(state?.doc?.model&&state?.assets)session=state;if(ref?.native&&ref?.controls)runtime=ref;}if(!session)throw Error('Session missing');return {doc:session.doc,session,runtime};};});
  const read=()=>page.evaluate(()=>{const {doc}=ribbonProbe();return {model:JSON.parse(JSON.stringify({RibbonEmitters:doc.model.RibbonEmitters,Textures:doc.model.Textures,Materials:doc.model.Materials,Geosets:doc.model.Geosets.length})),undo:doc.historyStats.undoSteps};});
  const before=await read();

  // EMTR with marked polygons offers the quick ribbon; the big editor stays one click away.
  await page.getByRole('button',{name:'Emitter Editor',exact:true}).click();
  assert.equal(await page.getByRole('dialog',{name:'Particle Editor',exact:true}).count(),0);
  await page.keyboard.press('Escape');assert.equal(await page.locator('.emtr-menu').count(),0,'Escape closes the EMTR menu');
  await page.getByRole('button',{name:'Emitter Editor',exact:true}).click();await page.screenshot({path:path.join(out,'1-emtr-menu.png')});
  await page.getByRole('menuitem',{name:'Add ribbon to selection',exact:true}).click();
  await page.getByText('Ribbon added. Drag its two ends to stretch it.',{exact:true}).waitFor();
  const box=page.getByRole('region',{name:'Ribbon',exact:true});await box.waitFor();
  assert.equal(await page.getByRole('dialog',{name:'Particle Editor',exact:true}).count(),0,'No big Particle Editor window');
  const added=await read(),ribbon=added.model.RibbonEmitters.at(-1);
  assert.equal(added.undo,before.undo+1,'One undo step adds the ribbon');assert.equal(added.model.RibbonEmitters.length,before.model.RibbonEmitters.length+1);
  assert.equal(added.model.Textures[added.model.Materials[ribbon.MaterialID].Layers[0].TextureID].Image,RIBBON_TEXTURE);
  // Only the simple settings and the visibility switch show before Advanced is opened.
  for(const label of ['Ribbon color','Ribbon intensity','Ribbon lasts','Ribbon size','Ribbon visible at this frame'])assert.ok(await page.getByLabel(label,{exact:true}).isVisible(),label);
  for(const label of ['Ribbon upper end','Ribbon smoothness','Ribbon gravity'])assert.equal(await page.getByLabel(label,{exact:true}).isVisible(),false,label+' stays in Advanced');
  await page.waitForTimeout(400);
  const keys=await page.locator('.classic-reel-key').count();assert.ok(keys>=2,'Visibility keys are on the timeline: '+keys);
  await page.screenshot({path:path.join(out,'2-ribbon-box.png')});

  // Color commits once when the picker closes.
  await page.getByLabel('Ribbon color',{exact:true}).evaluate(el=>{el.value='#ff2000';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});
  let now=await read();assert.equal(now.undo,added.undo+1);assert.deepEqual(Object.values(now.model.RibbonEmitters.at(-1).Color).map(v=>Math.round(v*255)),[255,32,0]);
  // Intensity: a real drag on the slider is one undo step.
  const intensity=await page.getByLabel('Ribbon intensity',{exact:true}).boundingBox();
  await page.mouse.move(intensity.x+intensity.width-3,intensity.y+intensity.height/2);await page.mouse.down();await page.mouse.move(intensity.x+intensity.width*.5,intensity.y+intensity.height/2,{steps:6});await page.mouse.up();
  let after=await read();assert.equal(after.undo,now.undo+1);const alpha=after.model.RibbonEmitters.at(-1).Alpha;assert.ok(alpha>.3&&alpha<.7,'Intensity about half: '+alpha);
  // Size grows both ends around the same split.
  await page.getByLabel('Ribbon size',{exact:true}).focus();await page.keyboard.press('ArrowRight');
  now=await read();const sized=now.model.RibbonEmitters.at(-1);assert.equal(now.undo,after.undo+1);assert.ok(sized.HeightAbove+sized.HeightBelow>ribbon.HeightAbove+ribbon.HeightBelow);
  assert.ok(Math.abs(sized.HeightAbove/sized.HeightBelow-ribbon.HeightAbove/ribbon.HeightBelow)<1e-4);

  // Drag the upper end in the 3D view with the mouse.
  const upper=page.locator('.ribbon-end-handle[data-ribbon-end="above"]'),lower=page.locator('.ribbon-end-handle[data-ribbon-end="below"]');
  await upper.waitFor();const u=await upper.boundingBox(),l=await lower.boundingBox();
  const dir={x:u.x-l.x,y:u.y-l.y},len=Math.hypot(dir.x,dir.y);assert.ok(len>4,'Ends are apart on screen');
  await page.mouse.move(u.x+u.width/2,u.y+u.height/2);await page.mouse.down();await page.mouse.move(u.x+u.width/2+dir.x/len*40,u.y+u.height/2+dir.y/len*40,{steps:8});await page.mouse.up();
  after=await read();const stretched=after.model.RibbonEmitters.at(-1);
  assert.equal(after.undo,now.undo+1,'One undo step per stretch');assert.ok(stretched.HeightAbove>sized.HeightAbove+.5,'Upper end grew');assert.equal(stretched.HeightBelow,sized.HeightBelow);
  assert.equal(after.model.Geosets,before.model.Geosets);
  const moved=await upper.boundingBox();assert.ok(Math.hypot(moved.x-u.x,moved.y-u.y)>20,'Handle follows the new end');
  await page.screenshot({path:path.join(out,'3-stretched.png')});
  // Drag the strip itself to move the whole ribbon.
  const strip=page.locator('.ribbon-strip-handle'),s0=await strip.boundingBox(),pivot0=stretched.PivotPoint;
  await page.mouse.move(s0.x+s0.width/2,s0.y+s0.height/2);await page.mouse.down();await page.mouse.move(s0.x+s0.width/2+25,s0.y+s0.height/2+15,{steps:6});await page.mouse.up();
  let movedRibbon=(await read());assert.equal(movedRibbon.undo,after.undo+1,'One undo step per move');
  const shifted=Object.values(movedRibbon.model.RibbonEmitters.at(-1).PivotPoint),base=Object.values(pivot0);assert.ok(Math.hypot(...shifted.map((v,i)=>v-base[i]))>1,'Pivot moved');
  assert.equal(movedRibbon.model.RibbonEmitters.at(-1).HeightAbove,stretched.HeightAbove);
  after=movedRibbon;
  // A size key at this frame makes the size animatable; the timeline shows the new keys.
  const keysBefore=await page.locator('.classic-reel-key').count();
  await page.getByRole('button',{name:'Set ribbon size key',exact:true}).click();
  now=await read();assert.equal(now.undo,after.undo+1);assert.ok(now.model.RibbonEmitters.at(-1).HeightAbove.Keys?.length>0,'Size is keyed');
  assert.equal(await page.getByRole('button',{name:'Set ribbon size key',exact:true}).getAttribute('aria-pressed'),'true');
  await page.waitForTimeout(300);assert.ok(await page.locator('.classic-reel-key').count()>=keysBefore,'Size keys are on the timeline');
  await page.getByRole('button',{name:'Undo',exact:true}).first().click().catch(async()=>{await page.keyboard.press('Control+Z');});
  after=await read();

  // Normal mouse camera rotation still works next to the handles.
  const camera=()=>page.evaluate(()=>{const c=ribbonProbe().runtime.controls.object;return [...c.position.toArray(),...c.quaternion.toArray()];});
  const canvas=await page.locator('.game-preview-root canvas').first().boundingBox(),cameraBefore=await camera();
  await page.keyboard.down('Alt');await page.mouse.move(canvas.x+60,canvas.y+canvas.height-60);await page.mouse.down();await page.mouse.move(canvas.x+160,canvas.y+canvas.height-90,{steps:8});await page.mouse.up();await page.keyboard.up('Alt');await page.waitForTimeout(200);
  const cameraAfter=await camera();assert.ok(cameraAfter.some((v,i)=>Math.abs(v-cameraBefore[i])>1e-3),'Mouse drag rotates the camera');
  assert.equal((await read()).undo,after.undo,'Camera drag does not edit');

  // Visibility: switch the ribbon off from the current frame.
  const vis=page.getByLabel('Ribbon visible at this frame',{exact:true});assert.equal(await vis.isChecked(),true);
  await vis.uncheck();now=await read();assert.equal(now.undo,after.undo+1);assert.equal(await vis.isChecked(),false);

  // Play Attack with the ribbon on: the newest trail piece sits at the blade and uses the bright edge of the picture.
  await page.getByLabel('Movement current sequence',{exact:true}).selectOption({label:'Attack'});await page.waitForTimeout(200);
  if(!(await vis.isChecked()))await vis.check();
  await page.getByRole('button',{name:'Play',exact:true}).click();await page.waitForTimeout(700);
  const trail=await page.evaluate(id=>{const {runtime}=ribbonProbe(),e=runtime.native.ribbonsController.emitters.find(item=>item.props.ObjectId===id);const n=e.creationTimes.length;return {n,newest:e.texCoords[(n-1)*4],oldest:e.texCoords[0]};},stretched.ObjectId);
  await page.getByRole('button',{name:'Stop',exact:true}).click();
  assert.ok(trail.n>3,'The ribbon emits while Attack plays: '+trail.n);assert.ok(trail.newest<.1&&trail.oldest>trail.newest,'Newest piece maps to the bright edge: '+JSON.stringify(trail));
  const {starterTextureAsset}=await import('../src/particle-starters.js'),picture=starterTextureAsset(RIBBON_TEXTURE).bytes,alphaAt=u=>picture[18+(32*64+Math.min(63,Math.floor(u*64)))*4+3];
  assert.ok(alphaAt(trail.newest)>alphaAt(trail.oldest)+40,'Brighter at the weapon than along the tail');
  // Advanced opens on click; closing removes the box and the end handles.
  await box.getByText('Advanced settings',{exact:true}).click();assert.ok(await page.getByLabel('Ribbon upper end',{exact:true}).isVisible());
  await page.screenshot({path:path.join(out,'4-advanced.png')});
  await page.getByRole('button',{name:'Close ribbon',exact:true}).click();
  assert.equal(await box.count(),0);assert.equal(await upper.count(),0);
  // EMTR on the selected ribbon reopens the box, not the big editor.
  await page.getByRole('button',{name:'Emitter Editor',exact:true}).click();await box.waitFor();
  await box.getByText('Advanced settings',{exact:true}).click();await page.getByRole('button',{name:'Emitter Editor…',exact:true}).click();
  const editor=page.getByRole('dialog',{name:'Particle Editor',exact:true});await editor.waitFor();assert.equal(await box.count(),0);
  for(const name of ['Basics','Appearance','Sweep'])assert.equal(await editor.getByRole('button',{name,exact:true}).count(),0,name+' tab is gone for ribbons');
  for(const label of ['Picture cell','Ribbon material','Emitting'])assert.equal(await editor.getByLabel(label).count(),0,label);
  assert.ok(await editor.getByLabel('Ribbon size',{exact:true}).isVisible());
  assert.equal(await editor.getByLabel('Preview speed',{exact:true}).inputValue(),'0.25','Slower preview by default');
  const marks=editor.locator('.pe-key-mark');assert.ok(await marks.count()>=1,'The playhead shows the ribbon keys');
  await marks.first().click();assert.equal(await editor.getByRole('button',{name:'Play',exact:true}).count(),1,'Jumping to a key pauses');
  await editor.getByRole('button',{name:'Play',exact:true}).click();await editor.getByRole('button',{name:'Pause',exact:true}).waitFor();
  await editor.getByLabel('Ribbon lasts',{exact:true}).focus();await page.keyboard.press('ArrowLeft');
  await editor.getByRole('button',{name:'Play',exact:true}).waitFor();
  await page.screenshot({path:path.join(out,'5-emitter-editor.png')});
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({ok:true,out,keys},null,1));
 }finally{const child=app?.process();await Promise.race([app?.close().catch(()=>{}),new Promise(done=>setTimeout(done,8000))]);if(child&&child.exitCode==null)child.kill();}
})().then(()=>process.exit(0),error=>{console.error(error);process.exit(1);});
