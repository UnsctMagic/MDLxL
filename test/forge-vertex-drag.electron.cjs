const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {launchApp,closeApp}=require('./helpers/app.cjs');
const {fixturePath}=require('./helpers/fixtures.cjs');
function read(){const p=findFiberProps('[aria-label="3D model viewport"]',p=>p?.model&&p?.onTransform),s=findFiberState('[aria-label="3D model viewport"]',s=>s?.renderer&&s?.entries),op=findFiberState('.forge-vertex-tools',s=>s?.kind&&s?.draft,{current:true}),state=op?.mold||op?.handle,b=s.renderer.domElement.getBoundingClientRect(),h=p.editHandles?.points?.find(h=>h.id==='amount');const project=point=>{const q=s.camera.position.clone().fromArray(point).project(s.camera);return{x:b.x+(q.x+1)*b.width/2,y:b.y+(1-q.y)*b.height/2};};return{count:p.model.Geosets[5].Vertices.length/3,selection:p.selectionByGeoset[5],handle:h&&project(h.position),end:h&&project(h.position.map((v,i)=>v+(i===state.direction?1:0))),amount:state?.amount};}
(async()=>{
 const out=path.resolve('out/contract-review/shield-drag');fs.mkdirSync(out,{recursive:true});
 const {openDocument}=await import('../src/editor-document.js'),{detachFaces}=await import('../src/mesh-tools.js');
 const doc=openDocument(fs.readFileSync(fixturePath('citadel-footman')),'Footman.mdx');detachFaces(doc.model,0,Array.from({length:14},(_,i)=>253+i));
 const fixture=path.join(out,'shield.mdx');fs.writeFileSync(fixture,doc.serialize('mdx'));
 const {app,page,errors}=await launchApp({fixture,out,pageTimeout:15000});
 try{
  const view=page.getByLabel('3D model viewport',{exact:true});await view.waitFor();await page.getByRole('button',{name:'Forge',exact:true}).click({button:'right'});await page.getByRole('menuitem',{name:'Call Upon Forge',exact:true}).click();
  const drawer=page.getByRole('complementary',{name:'Forge tools',exact:true});await page.locator('[data-hotkey="geosetsClear"]').click();await page.getByLabel('Select geoset 5',{exact:true}).check();await page.getByLabel('Show all geosets',{exact:true}).uncheck();
  await page.getByLabel('View direction',{exact:true}).selectOption('left');await page.getByLabel('Render mode',{exact:true}).selectOption('solid');
  await view.click({position:{x:50,y:150}});await page.keyboard.press('Control+a');const original=await page.evaluate(read);assert.equal(original.count,14);assert.equal(original.selection.length,14);await page.getByRole('button',{name:'Fit selection',exact:true}).click();
  const cdp=await page.context().newCDPSession(page),summary={geosetVertices:original.count,selection:original.selection,tools:[]};
  for(const tool of ['Bevel','Inset']){
   await drawer.getByRole('button',{name:tool,exact:true}).click();let h=await page.evaluate(read);assert.ok(h.handle);
   const dx=h.end.x-h.handle.x,dy=h.end.y-h.handle.y,len=Math.hypot(dx,dy),start=h.handle;
   await page.mouse.move(start.x,start.y);await page.mouse.down();
   // Warm the preview once, then trace the repeated live-drag updates, including
   // React, attribute uploads, wire updates and viewport drawing.
   await page.mouse.move(start.x+dx/len*6,start.y+dy/len*6);await page.waitForFunction(()=>{const op=findFiberState('.forge-vertex-tools',s=>s?.kind&&s?.draft,{current:true});return Math.abs((op?.mold||op?.handle)?.amount)>0;});const warm=await page.evaluate(read);
   const events=[];const collect=({value})=>events.push(...value);cdp.on('Tracing.dataCollected',collect);
   await cdp.send('Tracing.start',{categories:'devtools.timeline,toplevel',transferMode:'ReportEvents'});
   for(let n=7;n<=24;n++)await page.mouse.move(start.x+dx/len*n,start.y+dy/len*n);
   await page.mouse.up();await page.waitForFunction(amount=>{const op=findFiberState('.forge-vertex-tools',s=>s?.kind&&s?.draft,{current:true});return Math.abs((op?.mold||op?.handle)?.amount)>Math.abs(amount);},warm.amount);
   const complete=new Promise(resolve=>cdp.once('Tracing.tracingComplete',resolve));await cdp.send('Tracing.end');await complete;cdp.off('Tracing.dataCollected',collect);
   const main=events.find(e=>e.name==='thread_name'&&e.args?.name==='CrRendererMain');
   const mainEvents=events.filter(e=>e.ph==='X'&&e.pid===main?.pid&&e.tid===main?.tid),runs=mainEvents.filter(e=>/RunTask$/.test(e.name)),tasks=runs.map(e=>e.dur/1000).sort((a,b)=>a-b);
   const frames=mainEvents.filter(e=>e.name==='FireAnimationFrame').map(e=>e.ts).sort((a,b)=>a-b),frameWork=[];
   for(let i=1;i<frames.length;i++)if(frames[i]-frames[i-1]>1000)frameWork.push(runs.reduce((n,e)=>n+Math.max(0,Math.min(e.ts+e.dur,frames[i])-Math.max(e.ts,frames[i-1]))/1000,0));
   const after=await page.evaluate(read);assert.ok(after.count>original.count);assert.equal(await drawer.getByRole('alert').count(),0);assert.ok(tasks.length>0,'renderer trace contains main-thread tasks');
   assert.ok(frameWork.length>0,'trace includes drawn animation frames');
   summary.tools.push({tool,amount:after.amount,vertices:after.count,tasks:tasks.length,p95:tasks[Math.floor(tasks.length*.95)],max:tasks.at(-1),frames:frameWork.length,maxFrameWork:Math.max(...frameWork)});
   await page.screenshot({path:path.join(out,tool.toLowerCase()+'.png')});await page.keyboard.press('Escape');assert.equal((await page.evaluate(read)).count,original.count);
  }
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));assert.deepEqual(errors,[]);
  for(const result of summary.tools)assert.ok(Math.max(result.max,result.maxFrameWork)<1000/60,`${result.tool} live-drag renderer work ${Math.max(result.max,result.maxFrameWork).toFixed(2)} ms exceeds one 60 Hz display frame`);
 }finally{await closeApp(app);fs.unlinkSync(fixture);}
})().catch(e=>{console.error(e);process.exitCode=1;});
