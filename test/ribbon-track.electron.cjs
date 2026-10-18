const {_electron}=require(process.env.MDLXL_PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const root=process.cwd(),out=path.join(root,'out','particle-prototype','ribbon-track-'+Date.now());await fs.mkdir(out,{recursive:true});
 const {CascReader}=require('../electron/casc.cjs'),reader=new CascReader('D:/Warcraft III',root);let bytes;
 try{bytes=await reader.read('war3.w3mod:units\\orc\\heroblademaster\\heroblademaster.mdx');}finally{reader.close();}
 const fixture=path.join(out,'Blademaster.mdx');await fs.writeFile(fixture,bytes);
 const {openDocument}=await import('../src/editor-document.js'),{fitRibbonToPolygons}=await import('../src/particle-ribbon-fit.js'),{Vector3,Matrix4}=await import('three');
 const original=openDocument(bytes,fixture).model,selection={3:[11,12,9,13,14]},expected=fitRibbonToPolygons(original,selection);assert.equal(expected.polygons,3);assert.equal(expected.parent,7);
 let app;const errors=[];
 try{
  app=await _electron.launch({executablePath:path.resolve('node_modules/electron/dist/electron.exe'),args:['--disable-backgrounding-occluded-windows',root,fixture],env:{...process.env,MDLVIS_HEADLESS:'1',MDLXL_PROFILE:path.join(out,'profile')},timeout:60000});
  const page=await app.firstWindow();page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message));
  await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.webContents.setBackgroundThrottling(false);w.setSize(1400,920);w.setFocusable(false);w.setSkipTaskbar(true);w.setIgnoreMouseEvents(true);w.setOpacity(0);w.setPosition(-3000,0);w.showInactive();});
  await page.getByText('Opened Blademaster.mdx',{exact:true}).waitFor();
  await page.locator('.classic-geosets').getByRole('button',{name:'Clear',exact:true}).click();
  await page.getByLabel('Select geoset 3',{exact:true}).check();await page.getByLabel('Show all geosets',{exact:true}).uncheck();
  await page.getByLabel('View direction',{exact:true}).selectOption('top');
  await page.locator('.viewport').click({position:{x:30,y:120}});await page.keyboard.press('Control+A');await page.getByRole('button',{name:'Fit selection',exact:true}).click();
  // Use the native camera only to locate triangle centers; real Shift-clicks own selection.
  await page.waitForTimeout(150);
  const centers=await page.evaluate(points=>{let el=document.querySelector('.viewport'),f=el[Object.keys(el).find(k=>k.startsWith('__reactFiber'))];for(;f;f=f.return)for(let h=f.memoizedState;h;h=h.next){const state=h.memoizedState?.current;if(state?.renderer&&state?.camera){const rect=state.renderer.domElement.getBoundingClientRect();return points.map(point=>{const v=state.camera.position.clone().set(...point).project(state.camera);return {x:rect.x+(v.x+1)*rect.width/2,y:rect.y+(1-v.y)*rect.height/2};});}}throw Error('Camera missing');},[8,9,10].map(face=>{const g=original.Geosets[3],ids=Array.from(g.Faces.slice(face*3,face*3+3));return [0,1,2].map(axis=>ids.reduce((sum,id)=>sum+g.Vertices[id*3+axis],0)/3);}));
  for(let i=0;i<centers.length;i++){if(i)await page.keyboard.down('Shift');await page.mouse.click(centers[i].x,centers[i].y);if(i)await page.keyboard.up('Shift');}
  await page.screenshot({path:path.join(out,'marked-polygons.png')});
  await page.getByRole('button',{name:'Emitter Editor',exact:true}).click();const editor=page.getByRole('dialog',{name:'Particle Editor',exact:true});
  await page.getByRole('button',{name:'Add ribbon',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'Create',exact:true}).isEnabled(),true);
  for(const label of ['Attach effect to','Effect start','Effect end','Placement playhead'])assert.equal(await page.getByLabel(label,{exact:true}).count(),0);
  assert.equal(await page.getByRole('button',{name:'End here',exact:true}).count(),0);
  const choices=page.locator('.pe-ribbon-sequences input');assert.equal(await choices.count(),original.Sequences.length);
  for(let i=0;i<original.Sequences.length;i++)await choices.nth(i).uncheck();
  assert.equal(await page.getByRole('button',{name:'Create',exact:true}).isEnabled(),true,'No extra click gate');
  await choices.nth(3).check();await choices.nth(2).check();
  const seek=async(label,time)=>{await page.getByLabel(label,{exact:true}).evaluate((el,value)=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(el,String(value));el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));},time);};
  await page.getByLabel('Fitted weapon edge',{exact:true}).waitFor();await page.screenshot({path:path.join(out,'choose-animations.png')});
  const read=()=>page.evaluate(()=>{let el=document.querySelector('.pe-window'),f=el[Object.keys(el).find(k=>k.startsWith('__reactFiber'))];for(;f;f=f.return){const doc=f.memoizedProps?.doc;if(doc?.model)return {model:JSON.parse(JSON.stringify(doc.model)),undo:doc.historyStats.undoSteps};}throw Error('Model missing');});
  const before=await read();await page.getByRole('button',{name:'Cancel',exact:true}).click();assert.deepEqual(await read(),before);
  await page.getByRole('button',{name:'Add ribbon',exact:true}).click();for(let i=0;i<original.Sequences.length;i++)await choices.nth(i).uncheck();await choices.nth(3).check();await choices.nth(2).check();
  await page.getByRole('button',{name:'Create',exact:true}).click();await page.getByText('Ribbon added. Drag its two ends to adjust the edge.',{exact:true}).waitFor();
  assert.equal(await page.getByLabel('Particle context',{exact:true}).inputValue(),'On model');assert.equal(await page.getByRole('button',{name:'Create',exact:true}).count(),0);
  const added=await read(),r=added.model.RibbonEmitters.at(-1);assert.equal(r.Parent,7);assert.equal(added.model.Helpers.length,before.model.Helpers.length);assert.equal(added.model.Materials[r.MaterialID].Layers[0].Shading,17);assert.equal(added.undo,before.undo+1);assert.deepEqual(added.model.Geosets,before.model.Geosets);assert.deepEqual(added.model.Bones,before.model.Bones);assert.deepEqual(added.model.Sequences,before.model.Sequences);
  // The play track is the ribbon's keyframe track: one pair of diamonds per on/off part.
  if(await editor.getByRole('button',{name:'Pause',exact:true}).count())await editor.getByRole('button',{name:'Pause',exact:true}).click();
  const shows=()=>editor.getByRole('slider',{name:/^Ribbon shows at frame/}),hides=()=>editor.getByRole('slider',{name:/^Ribbon hides at frame/}),frameOf=async el=>Number((await el.getAttribute('aria-label')).match(/\d+$/)[0]);
  assert.equal(await shows().count(),1);assert.equal(await hides().count(),1);
  const track=await editor.locator('.pe-key-track.ribbon').boundingBox(),d0=await shows().boundingBox(),first=await frameOf(shows());
  await page.mouse.move(d0.x+d0.width/2,d0.y+d0.height/2);await page.mouse.down();await page.mouse.move(track.x+track.width*.35,d0.y+d0.height/2,{steps:8});await page.mouse.up();
  let now=await read();assert.equal(now.undo,added.undo+1,'One undo step per diamond drag');const moved=await frameOf(shows());assert.ok(moved>first,'The shows diamond moved later');
  assert.ok(now.model.RibbonEmitters.at(-1).Visibility.Keys.some(k=>k.Frame===moved&&k.Vector[0]===1));
  await editor.getByRole('button',{name:'+ ◆◆',exact:true}).click();assert.equal(await shows().count(),2,'A second pair: show, disappear, show, disappear');
  const pairs=await read();assert.equal(pairs.undo,now.undo+1);
  await page.screenshot({path:path.join(out,'1-track.png')});

  // Right-click a diamond: Smooth Size. Green ends and a green message; nothing is written until Commit.
  const target=hides().first(),keyFrame=await frameOf(target);await target.click({button:'right'});
  await page.getByRole('menuitem',{name:'Smooth Size at frame '+keyFrame,exact:true}).click();
  const banner=editor.getByRole('status',{name:'Smooth Size',exact:true});await banner.waitFor();
  assert.match(await banner.textContent(),/Adjust the scale at this specific key.*grow\/shrink smoothly between keys/);
  assert.equal(await editor.locator('.pe-size-key').count(),1,'Ribbon ends are green');
  const green=editor.getByRole('slider',{name:'Ribbon upper edge',exact:true}),g=await green.locator('circle').boundingBox();
  await page.mouse.move(g.x+7,g.y+7);await page.mouse.down();await page.mouse.move(g.x+37,g.y-18,{steps:5});await page.mouse.up();
  assert.equal((await read()).undo,pairs.undo,'Nothing written before Commit');
  await page.screenshot({path:path.join(out,'2-smooth-size.png')});
  await banner.getByRole('button',{name:'Commit',exact:true}).click();
  now=await read();const keyed=now.model.RibbonEmitters.at(-1);assert.equal(now.undo,pairs.undo+1);
  assert.ok(keyed.HeightAbove.Keys.some(k=>k.Frame===keyFrame),'Size key at frame '+keyFrame);assert.equal(keyed.HeightAbove.LineType,1);
  assert.equal(await banner.count(),0);assert.equal(await editor.getByRole('button',{name:'Size key at frame '+keyFrame,exact:true}).count(),1,'Green size diamond on the track');
  await page.keyboard.press('Control+Z');now=await read();assert.equal(now.undo,pairs.undo,'Ctrl+Z removes the size key');assert.equal(typeof now.model.RibbonEmitters.at(-1).HeightAbove,'number');
  await target.click({button:'right'});await page.getByRole('menuitem',{name:'Smooth Size at frame '+keyFrame,exact:true}).click();await banner.waitFor();
  await page.keyboard.press('Escape');assert.equal(await banner.count(),0,'Esc cancels');assert.equal(await editor.count(),1,'Esc does not close the editor while sizing');assert.equal((await read()).undo,pairs.undo);

  // Any point on the track, away from the diamonds, can get a size key.
  const h=await hides().first().boundingBox(),n=await shows().nth(1).boundingBox(),freeX=(h.x+h.width+n.x)/2;
  await page.mouse.click(freeX,h.y+h.height/2,{button:'right'});
  const free=page.getByRole('menuitem',{name:/^Smooth Size at frame \d+$/}),freeFrame=Number((await free.textContent()).match(/\d+$/)[0]);
  assert.ok(freeFrame>await frameOf(hides().first())&&freeFrame<await frameOf(shows().nth(1)),'The frame under the pointer, between the diamonds');
  assert.equal(await page.getByRole('menuitem',{name:'Remove this pair',exact:true}).count(),0,'No pair actions off a diamond');
  await free.click();await banner.waitFor();await banner.getByRole('button',{name:'Commit',exact:true}).click();
  now=await read();assert.equal(now.undo,pairs.undo+1);assert.ok(now.model.RibbonEmitters.at(-1).HeightAbove.Keys.some(k=>k.Frame===freeFrame),'Size key at the free frame '+freeFrame);
  assert.equal(await editor.getByRole('button',{name:'Size key at frame '+freeFrame,exact:true}).count(),1);
  await page.keyboard.press('Control+Z');assert.equal((await read()).undo,pairs.undo);
  // Adjust Manually: exact MDL text, one undo step; invalid text changes nothing.
  await editor.getByRole('button',{name:'Adjust Manually',exact:true}).click();
  const manual=page.getByRole('dialog',{name:'Adjust emitter manually',exact:true}),text=manual.getByLabel('Emitter MDL text',{exact:true}),mdl=await text.inputValue();
  assert.match(mdl,/^RibbonEmitter "Weapon ribbon" \{/);
  // Hovering a word explains it in plain language.
  const word=await manual.locator('.emitter-text-mirror span',{hasText:/^RibbonEmitter$/}).first().boundingBox();await page.mouse.move(word.x+word.width/2,word.y+word.height/2);
  const tip=manual.getByRole('tooltip');await tip.waitFor();assert.match(await tip.textContent(),/A ribbon: a glowing strip/);await page.screenshot({path:path.join(out,'3-hover.png')});
  await text.fill(mdl.replace(/LifeSpan [0-9.]+/,'LifeSpan 0.75'));await manual.getByRole('button',{name:'Apply',exact:true}).click();
  now=await read();assert.equal(now.model.RibbonEmitters.at(-1).LifeSpan,.75);assert.equal(now.undo,pairs.undo+1);
  await editor.getByRole('button',{name:'Adjust Manually',exact:true}).click();await text.fill(mdl.replace(/MaterialID \d+/,'MaterialID 999'));await manual.getByRole('button',{name:'Apply',exact:true}).click();
  await manual.getByRole('alert').waitFor();assert.equal((await read()).undo,now.undo);await manual.getByRole('button',{name:'Cancel',exact:true}).click();

  // The one-screen ribbon panel, slower preview, pause while editing.
  for(const name of ['Basics','Appearance','Sweep'])assert.equal(await editor.getByRole('button',{name,exact:true}).count(),0,name);
  assert.equal(await editor.getByLabel('Preview speed',{exact:true}).inputValue(),'0.25');
  await editor.getByRole('button',{name:'Play',exact:true}).click();await editor.getByRole('button',{name:'Pause',exact:true}).waitFor();
  await editor.getByLabel('Ribbon lasts',{exact:true}).focus();await page.keyboard.press('ArrowLeft');await editor.getByRole('button',{name:'Play',exact:true}).waitFor();
  assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,out}));
 }catch(error){if(app){const page=await app.firstWindow();await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});}throw error;}
 finally{if(app)await app.evaluate(({app})=>app.exit(0)).catch(()=>{});}
})().then(()=>process.exit(0),error=>{console.error(error);process.exit(1);});
