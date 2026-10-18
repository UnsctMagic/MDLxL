const {_electron}=require(process.env.MDLXL_PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
// The game's own sprite sheets offer the game's frame setups; the grid and frames can be set by hand.
(async()=>{
 const root=process.cwd(),out=path.join(root,'out','sprite-frames','run-'+Date.now());await fs.mkdir(out,{recursive:true});
 const {CascReader}=require('../electron/casc.cjs'),reader=new CascReader('D:/Warcraft III',root);let bytes;
 try{bytes=await reader.read('war3.w3mod:abilities\\spells\\human\\polymorph\\polymorphdoneground.mdx');}finally{reader.close();}
 const fixture=path.join(out,'PolymorphDoneGround.mdx');await fs.writeFile(fixture,bytes);
 let app;const errors=[];
 try{
  app=await _electron.launch({executablePath:path.resolve('node_modules/electron/dist/electron.exe'),args:['--disable-backgrounding-occluded-windows',root,fixture],env:{...process.env,MDLVIS_HEADLESS:'1',MDLXL_PROFILE:path.join(out,'profile')},timeout:60000});
  const page=await app.firstWindow();page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(error.message));
  await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.webContents.setBackgroundThrottling(false);w.setFocusable(false);w.setSkipTaskbar(true);w.setIgnoreMouseEvents(true);w.setOpacity(0);w.setSize(1400,920);w.setPosition(-3000,0);w.showInactive();});
  await page.getByText('Opened PolymorphDoneGround.mdx',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Emitter Editor',exact:true}).click();
  const editor=page.getByRole('dialog',{name:'Particle Editor',exact:true});await editor.waitFor();
  if(await editor.getByRole('button',{name:'Close Particle Library',exact:true}).count())await editor.getByRole('button',{name:'Close Particle Library',exact:true}).click();
  await editor.getByLabel('Particle context',{exact:true}).selectOption('On model');
  const read=()=>page.evaluate(()=>{let el=document.querySelector('.pe-window'),f=el[Object.keys(el).find(k=>k.startsWith('__reactFiber'))];for(;f;f=f.return){const doc=f.memoizedProps?.doc;if(doc?.model)return {emitters:JSON.parse(JSON.stringify(doc.model.ParticleEmitters2.map(p=>({id:p.ObjectId,texture:doc.model.Textures[p.TextureID]?.Image,Rows:p.Rows,Columns:p.Columns,life:p.LifeSpanUVAnim,decay:p.DecayUVAnim})))),undo:doc.historyStats.undoSteps};}throw Error('Model missing');});
  const before=await read(),sheet=before.emitters.find(p=>/clouds8x8/i.test(p.texture||''));assert.ok(sheet,'The model uses a game cloud sheet');
  await editor.getByLabel('Effect ingredient',{exact:true}).selectOption(String(sheet.id));
  const suggestions=editor.locator('.pe-frame-suggestions button');await suggestions.first().waitFor();
  const count=await suggestions.count();assert.ok(count>=1,'Game setups are suggested');
  assert.match(await suggestions.first().textContent(),/^Like .+ · /);const labels=await suggestions.allTextContents();assert.equal(new Set(labels.map(t=>t.split(' · ')[1])).size>=1,true);assert.ok((await suggestions.evaluateAll(b=>b.filter(x=>x.getAttribute('aria-pressed')==='true').length))<=1,'At most one suggestion is current');
  assert.equal(await editor.getByRole('listbox',{name:'Frames that play',exact:true}).getByRole('option').count(),Math.min(256,sheet.Rows*sheet.Columns));
  await page.screenshot({path:path.join(out,'suggestions.png')});
  // Picking a suggestion is one undo step and writes the game's exact setup.
  const other=(await suggestions.evaluateAll(buttons=>buttons.findIndex(button=>button.getAttribute('aria-pressed')!=='true')));
  if(other>=0){const ready=await read();await suggestions.nth(other).click();const after=await read();assert.equal(after.undo,ready.undo+1,'One undo step: '+ready.undo+' -> '+after.undo+' (opened at '+before.undo+')');assert.equal(await suggestions.nth(other).getAttribute('aria-pressed'),'true');}
  // Own grid and frames.
  await editor.getByRole('button',{name:'Fewer rows',exact:true}).click();const own=(await read()).emitters.find(p=>p.id===sheet.id);assert.equal(own.Rows,sheet.Rows-1);
  const cells=editor.getByRole('listbox',{name:'Frames that play',exact:true}).getByRole('option'),a=await cells.nth(2).boundingBox(),b=await cells.nth(5).boundingBox();
  await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:5});await page.mouse.up();
  const picked=(await read()).emitters.find(p=>p.id===sheet.id);assert.equal(Object.values(picked.life)[0],2);assert.equal(Object.values(picked.decay)[1],6);
  assert.equal(await editor.getByRole('button',{name:'Load own sprite sheet…',exact:true}).count(),1);
  await page.screenshot({path:path.join(out,'own-frames.png')});
  assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,out,suggestions:count}));
 }finally{const child=app?.process();await Promise.race([app?.close().catch(()=>{}),new Promise(done=>setTimeout(done,8000))]);if(child&&child.exitCode==null)child.kill();}
})().then(()=>process.exit(0),error=>{console.error(error);process.exit(1);});
