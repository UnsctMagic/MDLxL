const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {launchApp,closeApp,bundleHashes}=require('./helpers/app.cjs');const {fixturePath}=require('./helpers/fixtures.cjs');
(async()=>{
 const out=path.resolve(process.env.MDLXL_UV_GRID_NUDGE_OUT||'out/uv-grid-nudge'),fixture=fixturePath('footman'),original=fs.readFileSync(fixture);fs.mkdirSync(out,{recursive:true});const checks=[],failures=[],errors=[];
 const check=(label,value)=>{checks.push({label,passed:!!value});console.log((value?'PASS ':'FAIL ')+label);if(!value)failures.push(label);};
 const {app,page}=await launchApp({fixture,out,errors,bounds:{x:0,y:0,width:1440,height:1000},args:['--disable-renderer-backgrounding','--disable-background-timer-throttling'],settings:{preferences:{uvSensitivity:1,uvGrid:{enabled:true,snap:true,spacing:.013},uvPreviewDisplay:{snapTextureFrame:true},graphics:{pauseWhenHidden:false}}}});
 try{
  await page.getByLabel('Select geoset 0',{exact:true}).waitFor();await page.locator('[data-hotkey="geosetsClear"]').click();await page.getByLabel('Select geoset 0',{exact:true}).check();await page.getByLabel('3D model viewport',{exact:true}).click();await page.keyboard.press('Control+a');await page.locator('[data-hotkey="uv"]').click();
  const uv=page.locator('.uv-tab-window'),canvas=uv.locator('.uv-editor canvas');await canvas.waitFor();await uv.getByRole('button',{name:'Move',exact:true}).click();await canvas.click();
  await page.evaluate(()=>{window.nudgeProps=()=>findFiberProps('.uv-editor',p=>p?.geoset&&p?.onSelectVertices);window.nudgeValues=()=>Array.from(nudgeProps().geoset.TVertices[0]);window.nudgeState=()=>findFiberState('.uv-editor',s=>s?.uv&&s?.draw,{last:true});});
  const before=await page.evaluate(()=>({values:nudgeValues(),ids:Array.from(nudgeProps().selectedVertices),model:JSON.stringify(__mdlxl.model())}));
  const undo=async()=>{await page.keyboard.press('Control+z');await page.waitForFunction(b=>JSON.stringify(__mdlxl.model())===b,before.model);};
  const nudge=async(key,x,y,step,label)=>{await page.keyboard.press(key);await page.waitForFunction(b=>JSON.stringify(__mdlxl.model())!==b,before.model);const after=await page.evaluate(()=>nudgeValues());check(label,after.every((v,i)=>Math.abs(v-before.values[i]-(before.ids.includes(Math.floor(i/2))?(i%2?y:x)*step:0))<1e-6));await undo();};
  for(const [key,x,y]of[['Numpad6',1,0],['Numpad4',-1,0],['Numpad8',0,-1],['Numpad2',0,1],['Numpad7',-1,-1],['Numpad9',1,-1],['Numpad1',-1,1],['Numpad3',1,1]])await nudge(key,x,y,.013,key+' moves exactly one .013 grid cell per active axis');
  await uv.getByRole('button',{name:'Settings',exact:true}).click();const spacing=page.getByLabel('UV grid spacing',{exact:true});await spacing.fill('0.007');await spacing.press('Enter');await canvas.click();await nudge('Numpad6',1,0,.007,'numpad follows the changed grid spacing');
  await uv.getByRole('button',{name:'Snap',exact:true}).click();await canvas.click();await nudge('Numpad6',1,0,.005,'Grid on / Snap off keeps the original step');
  await uv.getByRole('button',{name:'Snap',exact:true}).click();await uv.getByRole('button',{name:'Grid',exact:true}).click();await canvas.click();await nudge('Numpad6',1,0,.005,'Grid off / Snap on keeps the original step');
  await uv.getByRole('button',{name:'Snap',exact:true}).click();await canvas.click();await nudge('Numpad6',1,0,.005,'both off keep the original step');
  const box=await canvas.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();const size=await page.evaluate(()=>nudgeState().drag.sizeX);await page.mouse.up();
  const id=before.ids.reduce((a,b)=>Math.abs(Math.round(before.values[b*2])-before.values[b*2])<Math.abs(Math.round(before.values[a*2])-before.values[a*2])?b:a),delta=Math.round(before.values[id*2])-before.values[id*2]+2/size;
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+delta*size,box.y+box.height/2,{steps:8});await page.mouse.up();const free=await page.evaluate(()=>nudgeValues());
  check('saved texture-frame snap cannot magnetize a Move near a tile edge',free.every((v,i)=>Math.abs(v-before.values[i]-(before.ids.includes(Math.floor(i/2))&&i%2===0?delta:0))<2e-6));await undo();
  check('texture-frame snapping checkbox is absent',await uv.getByLabel('Snap to texture frame',{exact:true}).count()===0);check('Highlight Texture Frame remains available',await uv.getByLabel('Highlight texture frame',{exact:true}).count()===1);check('source fixture unchanged',fs.readFileSync(fixture).equals(original));check('no renderer errors',errors.length===0);assert.deepEqual(failures,[]);
 }finally{fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({checks,failures,errors,bundle:bundleHashes()},null,2));await closeApp(app);}
})().catch(e=>{console.error(e);process.exitCode=1;});
