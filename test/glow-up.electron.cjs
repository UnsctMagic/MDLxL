// Glow Up in EMTR: button beside Add ribbon, trim panel, live preview with real
// mouse orbit, Create as one undo step, and no Glow Up left in Forge.
// MDLXL_GLOW_MODEL runs it on another model (weapon checks then follow that model).
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {_electron}=require(process.env.MDLXL_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),out=process.env.MDLXL_TEST_OUT||path.join(root,'out/glow-up-ui');
const executable=process.env.MDLXL_TEST_EXE||path.join(root,'out/pkg-glow-up/MDLxL-win32-x64/MDLxL.exe');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function heroFixture(file){
 const {createStarterDocument}=await import('../src/starter-model.js'),{createNode}=await import('../src/editor-document.js');
 const doc=createStarterDocument();
 doc.apply('Hero fixture',[],m=>{
  m.Sequences=['Stand','Death'].map((Name,i)=>({Name,Interval:new Uint32Array([i*1000,i*1000+900]),MoveSpeed:0,NonLooping:false,Rarity:0,MinimumExtent:new Float32Array(3),MaximumExtent:new Float32Array(3),BoundsRadius:0}));
  const hand=createNode(m,'Bone');hand.Name='Bone_Hand_R';hand.PivotPoint.set([10,-40,20]);hand.Parent=m.Bones[0].ObjectId;
  const sword=createNode(m,'Bone');sword.Name='Sword';sword.PivotPoint.set([10,-40,20]);sword.Parent=hand.ObjectId;
  const v=[];for(const x of [2,6,14,30,46,62,78])for(const [dy,dz] of [[-2,-1],[2,-1],[2,1],[-2,1]])v.push(x,-40+dy,20+dz);
  const n=v.length/3,faces=[];for(let k=0;k+4<n;k+=4)faces.push(k,k+1,k+5,k,k+5,k+4);
  m.Geosets.push({Vertices:new Float32Array(v),Normals:new Float32Array(v.length).map((_,i)=>i%3===2?1:0),TVertices:[new Float32Array(n*2)],Faces:new Uint16Array(faces),VertexGroup:new Uint8Array(n),Groups:[[sword.ObjectId]],TotalGroupsCount:1,MaterialID:0,SelectionGroup:0,Unselectable:false,MinimumExtent:new Float32Array([2,-42,19]),MaximumExtent:new Float32Array([78,-38,21]),BoundsRadius:40,Anims:[]});
 });
 fs.writeFileSync(file,doc.serialize('mdx'));
}

(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const custom=process.env.MDLXL_GLOW_MODEL,fixture=custom||path.join(out,'hero.mdx');if(!custom)await heroFixture(fixture);
 const app=await _electron.launch({executablePath:executable,args:['--disable-backgrounding-occluded-windows','--disable-gpu-vsync','--disable-frame-rate-limit',fixture],env:{...process.env,MDLVIS_HEADLESS:'1',MDLXL_PROFILE:path.join(out,'profile-'+Date.now())},timeout:60000});
 const checks=[],errors=[];let page;
 const capture=async name=>{const data=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.capturePage().then(i=>i.toPNG().toString('base64')));fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(data,'base64'));};
 const read=()=>page.evaluate(()=>{const el=document.querySelector('.classic-app');let f=el[Object.keys(el).find(k=>k.startsWith('__reactFiber'))];for(;f;f=f.return)for(let h=f.memoizedState;h;h=h.next){const v=h.memoizedState;if(v?.doc?.model&&v.assets)return {model:JSON.parse(JSON.stringify(v.doc.model)),undo:v.doc.historyStats.undoSteps};}throw Error('No document');});
 // The model the EMTR preview is drawing, and its camera.
 const preview=()=>page.evaluate(()=>{const el=document.querySelector('.pe-preview .game-preview-root')||document.querySelector('.pe-preview canvas');if(!el)throw Error('No preview');let f=el[Object.keys(el).find(k=>k.startsWith('__reactFiber'))],model=null,camera=null;for(;f;f=f.return){if(!model&&f.memoizedProps?.presentation==='preview'&&f.memoizedProps.model)model=JSON.parse(JSON.stringify(f.memoizedProps.model));for(let h=f.memoizedState;h;h=h.next){const s=h.memoizedState?.current,c=s?.camera||s?.controls?.object;if(!camera&&c?.position)camera=c.position.toArray();}}return {model,camera};});
 try{
  page=await app.firstWindow();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
  await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.webContents.setBackgroundThrottling(false);w.setBounds({x:0,y:0,width:1600,height:1000});});
  await page.getByLabel('3D model viewport',{exact:true}).waitFor();
  const original=(await read()).model,sidebar=await page.locator('.classic-sidebar').boundingBox();
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.send('menu','particles'));
  const emtr=page.getByRole('dialog',{name:'Particle Editor',exact:true});await emtr.waitFor();
  const glowButton=emtr.locator('.pe-toolbar').getByRole('button',{name:'Glow Up',exact:true});await glowButton.waitFor();
  assert.equal(await emtr.locator('.pe-glow').count(),0);await sleep(1500);await capture('emtr-default');
  checks.push('EMTR toolbar shows Glow Up; no glow panel until it is clicked');

  await glowButton.click();const panel=emtr.locator('.pe-glow');await panel.waitFor();
  const origin=panel.getByLabel('Origin glow',{exact:true}),weapon=panel.getByLabel('Weapon glow',{exact:true});
  assert.equal(await origin.isChecked(),true);
  if(!custom){assert.equal(await weapon.isChecked(),true);assert.equal(await panel.getByLabel('Weapon',{exact:true}).locator('option:checked').textContent(),'Sword');}
  assert.equal(await panel.locator('input[type=range]').count(),await weapon.isChecked()?3:2);
  await page.waitForFunction(()=>document.querySelector('.pe-preview canvas'));await sleep(800);
  let shown=await preview();assert.equal(shown.model.Geosets.length,original.Geosets.length+(await weapon.isChecked()?2:1));
  await sleep(2500);await capture('glow-panel');checks.push('Glow Up panel: origin + weapon toggles, weapon pick, sizes and brightness; preview shows the glow');

  const originWidth=m=>{const g=m.Geosets[original.Geosets.length],v=Object.values(g.Vertices);return v[3]-v[0];};
  const widthBefore=originWidth(shown.model);
  await panel.getByLabel('Origin size',{exact:true}).fill('150');await panel.getByLabel('Brightness',{exact:true}).fill('50');await sleep(600);
  shown=await preview();assert.ok(Math.abs(originWidth(shown.model)/widthBefore-1.5)<.01,'Origin size scales the planes');
  assert.equal(shown.model.Materials.at(-1).Layers[0].Alpha,.5);checks.push('Sliders update the live preview');

  // Real left-button drags orbit the preview camera both ways.
  const box=await emtr.locator('.pe-preview canvas').first().boundingBox(),cx=box.x+box.width/2,cy=box.y+box.height/2;
  const cam0=(await preview()).camera;await page.mouse.move(cx,cy);await page.mouse.down();await page.mouse.move(cx+120,cy+40,{steps:8});await page.mouse.up();await sleep(200);
  const cam1=(await preview()).camera;assert.notDeepEqual(cam1,cam0,'drag rotates the camera');
  await page.mouse.move(cx,cy);await page.mouse.down();await page.mouse.move(cx-160,cy-20,{steps:8});await page.mouse.up();await sleep(200);
  const cam2=(await preview()).camera;assert.notDeepEqual(cam2,cam1,'reverse drag rotates back');
  await sleep(1500);await capture('glow-orbit');checks.push('Mouse drags rotate the Glow Up preview in both directions');

  if(await weapon.isChecked()){await weapon.uncheck();await sleep(500);assert.equal((await preview()).model.Geosets.length,original.Geosets.length+1);await weapon.check();await sleep(500);}
  const undoBefore=(await read()).undo,added=await weapon.isChecked()?2:1;
  await panel.getByRole('button',{name:'Create',exact:true}).click();await panel.waitFor({state:'hidden'});
  const after=await read();assert.equal(after.undo,undoBefore+1);assert.equal(after.model.Geosets.length,original.Geosets.length+added);
  assert.deepEqual(after.model.Geosets.slice(0,original.Geosets.length),original.Geosets);
  assert.ok(after.model.Bones.some(b=>b.Name==='Glow Origin 1'));
  await emtr.getByText('Hero glow added. Undo restores the model.',{exact:true}).waitFor();
  await capture('glow-created');checks.push('Create adds the glow as one undo step and keeps existing geometry');
  await emtr.getByRole('button',{name:'Undo',exact:true}).click();await sleep(300);
  assert.deepEqual((await read()).model.Geosets,original.Geosets);checks.push('Undo removes the glow');

  await emtr.getByRole('button',{name:'Close',exact:true}).last().click();await emtr.waitFor({state:'hidden'});
  await page.getByRole('button',{name:'Forge',exact:true}).click();const forge=page.getByRole('dialog',{name:'Forge',exact:true});await forge.waitFor();
  assert.equal(await forge.getByRole('tab',{name:'Glow Up',exact:true}).count(),0);await forge.getByRole('button',{name:'Close Forge',exact:true}).click();await forge.waitFor({state:'hidden'});
  checks.push('Forge no longer has Glow Up');
  assert.equal((await page.locator('.classic-sidebar').boundingBox()).width,sidebar.width);assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({executable,fixture,checks,rendererErrors:errors},null,2));
  console.log(checks.join('\n'));
 }catch(e){if(page)await capture('failure').catch(()=>{});console.error('Renderer errors:',errors);throw e;}
 finally{await Promise.race([app.evaluate(({app})=>app.exit(0)).catch(()=>{}),sleep(5000)]);}
})().catch(e=>{console.error(e);process.exit(1);});
