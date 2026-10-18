// Packaged UI: mutate only with mouse/keyboard; inspect React state for assertions.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {_electron}=require(process.env.MDLXL_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),out=process.env.MDLXL_TEST_OUT||path.join(root,'out/shaping-tools-check');
const source=fs.readFileSync(path.join(root,'test/forge-face-editing.electron.cjs'),'utf8');
eval(source.slice(source.indexOf('function readView'),source.indexOf('(async()=>{')));
const cuts=fs.readFileSync(path.join(root,'test/forge-cuts.electron.cjs'),'utf8');
eval(cuts.slice(cuts.indexOf('function readDraft'),cuts.indexOf('function pointForVertex')));
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const app=await _electron.launch({executablePath:process.env.MDLXL_TEST_EXE,args:['--disable-backgrounding-occluded-windows'],env:{...process.env,MDLVIS_HEADLESS:'0',MDLXL_PROFILE:path.join(out,'profile')},timeout:60000});
 let page;const errors=[],checks=[];
 const capture=async name=>{await page.waitForTimeout(300);const b64=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.capturePage().then(i=>i.toPNG().toString('base64')));fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(b64,'base64'));};
 try{
 page=await app.firstWindow();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
 await page.getByRole('button',{name:'Forge',exact:true}).click();const d=page.getByRole('dialog',{name:'Forge',exact:true});
 const click=async name=>{await d.getByRole('button',{name,exact:true}).click();await page.waitForTimeout(140);},view=async()=>{await page.waitForTimeout(160);return page.evaluate(readView);},doc=()=>page.evaluate(readDraft);
 const drag=async(id,dx,dy,modifier)=>{const v=await view(),h=v.moldHandles.find(h=>h.id===id);assert.ok(h,'handle '+id);if(modifier)await page.keyboard.down(modifier);await page.mouse.move(h.x,h.y);await page.mouse.down();await page.mouse.move(h.x+dx,h.y+dy,{steps:8});await page.mouse.up();if(modifier)await page.keyboard.up(modifier);await page.waitForTimeout(200);};
 await d.getByLabel('Width',{exact:true}).fill('240');await d.getByLabel('Height',{exact:true}).fill('80');await d.getByLabel('Depth',{exact:true}).fill('60');await click('Cube');
 const baseline=await doc(),baseView=await view(),sidebar=await d.locator('.forge-editor-sidebar').boundingBox();
 assert.equal(await d.getByRole('group',{name:'Shaping tools',exact:true}).getByRole('button').count(),5);
 assert.equal(await d.getByRole('group',{name:'Shaping controls',exact:true}).count(),0);
 assert.equal(await d.getByRole('button',{name:/mirror|symmetry/i}).count(),0);
 const gold=await d.getByRole('button',{name:'Bend',exact:true}).boundingBox(),blue=await d.getByRole('button',{name:'Move',exact:true}).boundingBox();assert.ok(gold.y<blue.y);assert.equal(sidebar.width,164);
 checks.push('Five compact gold tools above blue tools; no popup, mirror or default controls; sidebar stays 164px');
 for(const [name,key]of [['Bend','4'],['Bulge / Pinch','v'],['Taper','t'],['Bevel','b'],['Twist','5']]){
   await page.keyboard.press(key);await page.waitForTimeout(200);
   assert.equal(await d.getByRole('button',{name,exact:true}).getAttribute('aria-pressed'),'true');
   assert.deepEqual(await doc(),baseline);assert.deepEqual((await view()).model.Geosets,baseView.model.Geosets);
   await drag('amount',0,name==='Taper'?35:-35);
   assert.deepEqual(await doc(),baseline,'preview does not commit '+name);assert.notDeepEqual((await view()).model.Geosets,baseView.model.Geosets,name+' visible');
   assert.equal(await d.getByRole('button',{name:'Keep shaping',exact:true}).isEnabled(),true);
   if(name==='Bend')await capture('bend-preview');
   if(name==='Bevel'){const angled=(await view()).model.Geosets[0];await click('Angled');assert.ok((await view()).model.Geosets[0].Faces.length>angled.Faces.length);await capture('rounded-bevel-preview');}
   if(name==='Bevel')await click('Keep shaping');else await page.keyboard.press('Enter');await page.waitForTimeout(180);const edited=await doc();
   assert.notDeepEqual(edited.shapes,baseline.shapes);assert.equal(await d.getByRole('group',{name:'Shaping controls',exact:true}).count(),0);
   await page.keyboard.press('Control+z');await page.waitForTimeout(150);assert.deepEqual(await doc(),baseline);
   await page.keyboard.press('Control+y');await page.waitForTimeout(150);assert.deepEqual(await doc(),edited);
   await page.keyboard.press('Control+z');await page.waitForTimeout(150);
   checks.push(name+' previews from zero, changes the block, commits once and restores exactly with Undo/Redo');
 }
 await click('Bend');let v=await view(),center=v.moldHandles.find(h=>h.id==='center'),range=v.moldHandles.find(h=>h.id==='rangeStart');await drag('rangeStart',(center.x-range.x)*.5,(center.y-range.y)*.5);const narrowed=await view();assert.notDeepEqual(narrowed.moldHandles,v.moldHandles);assert.deepEqual(await doc(),baseline);
 await drag('center',25,0);await drag('amount',0,-30);const bent=(await view()).model.Geosets;await click('Turn bend');assert.notDeepEqual((await view()).model.Geosets,bent);await click('Shape along up');assert.deepEqual((await view()).model.Geosets,baseView.model.Geosets);
 await drag('amount',35,0);await page.keyboard.press('Escape');await page.waitForTimeout(150);assert.deepEqual(await doc(),baseline);assert.equal((await view()).moldHandles.length,0);
 checks.push('Bend center, affected range, direction and length axis are adjustable in the viewport; Escape discards all preview changes');
 await click('Bulge / Pinch');await drag('amount',0,30);assert.notDeepEqual((await view()).model.Geosets,baseView.model.Geosets);await page.keyboard.press('Control+z');await page.waitForTimeout(150);assert.deepEqual(await doc(),baseline);assert.equal((await view()).moldHandles.length,0);
 checks.push('Pinching works in the opposite drag direction; Ctrl+Z cancels preview before undoing older work');
 await click('Twist');const cameraBefore=await view();await drag('amount',35,15,'Alt');assert.notDeepEqual((await view()).quaternion,cameraBefore.quaternion);assert.deepEqual(await doc(),baseline);await click('Cancel shaping');
 await page.keyboard.press('w');await page.waitForTimeout(150);assert.equal(await d.getByText('Camera rotation',{exact:true}).count(),1);await page.keyboard.press('w');await page.keyboard.press('f');await page.waitForTimeout(150);assert.equal(await d.getByLabel('Render mode',{exact:true}).inputValue(),'textured');await page.keyboard.press('s');
 checks.push('Normal Alt-drag rotation and W camera/F view shortcuts remain available');
 await click('Bend');await drag('amount',0,-30);await click('Move');assert.equal((await view()).moldHandles.length,0);assert.deepEqual(await doc(),baseline);
 checks.push('Choosing a normal vertex tool cancels the shaping preview');
 // Work through every operation on the same block.
 for(const name of ['Bend','Bulge / Pinch','Taper','Twist','Bevel']){
   await click(name);await drag('amount',0,-12);await click('Keep shaping');
 }
 const combined=await doc();assert.notDeepEqual(combined.shapes,baseline.shapes);
 for(let i=0;i<5;i++){await page.keyboard.press('Control+z');await page.waitForTimeout(120);}assert.deepEqual(await doc(),baseline);
 checks.push('All five tools work together on one block; five Undo steps restore the original');
 // Existing double-click, cut and extrusion remain usable after shaping.
 await click('Bend');await drag('amount',0,-25);await click('Keep shaping');await click('Cut');await click('Apply cuts');const cut=await doc();assert.ok(cut.shapes[0].faces.length>baseline.shapes[0].faces.length);
 v=await view();const g=v.model.Geosets[0],top=Array.from(g.Normals).findIndex((n,i)=>i%3===2&&n>.9),tri=Math.floor(Math.floor(top/3)/3)*3,ps=[0,1,2].map(i=>v.points[0][tri+i]),p={x:ps.reduce((n,q)=>n+q.x,0)/3,y:ps.reduce((n,q)=>n+q.y,0)/3};
 await page.mouse.dblclick(p.x,p.y,{delay:90});await page.waitForTimeout(150);assert.equal((await doc()).mode,'Faces');await page.keyboard.press('e');await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x,p.y-25,{steps:8});await page.mouse.up();await page.waitForTimeout(150);assert.equal((await view()).tool,'translate');
 checks.push('Cut and double-click face/extrude remain available on a bent piece');
 assert.equal((await d.locator('.forge-editor-sidebar').boundingBox()).width,sidebar.width);assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({pass:true,checks,rendererErrors:errors},null,2));console.log(JSON.stringify({pass:true,checks},null,2));
 }catch(e){if(page)await capture('failure');throw e;}finally{await app.evaluate(({app})=>app.exit(0));}
})().catch(e=>{console.error(e);process.exitCode=1;});
