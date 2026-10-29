const { launchApp, closeApp, settle: settlePage } = require('./helpers/app.cjs');
// Run after building: MDLXL_PAINT_FIXTURE=<MDX800 Footman> node test/paint-tab-camera.electron.cjs
// Each model tab keeps the camera the user left there: Paint and the ordinary editor.
// The camera is moved with real mouse drags and the wheel; fiber access only reads it.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=process.cwd(),fixture=process.env.MDLXL_PAINT_FIXTURE,out=path.resolve(process.env.MDLXL_PAINT_OUT||'out/paint-tab-camera');
if(!fixture)throw Error('Set MDLXL_PAINT_FIXTURE to the original Classic Footman.');
fs.mkdirSync(out,{recursive:true});const first=path.join(out,'FirstFootman.mdx'),second=path.join(out,'SecondFootman.mdx');fs.copyFileSync(fixture,first);fs.copyFileSync(fixture,second);
const result={checks:[],errors:[]};let app,page;
const settle=()=>settlePage(page, 250),shot=name=>page.screenshot({path:path.join(out,name+'.png')});
const camera=()=>page.evaluate(()=>{
  const host=document.querySelector('.viewport');
  { const s = findFiberState(host, s => s?.renderer&&s?.perspective&&s?.controls); if (s?.renderer&&s?.perspective&&s?.controls) {const r=v=>v.toArray().map(x=>Math.round(x*1000)/1000);return {position:r(s.perspective.position),target:r(s.controls.target),zoom:s.perspective.zoom};} }

  throw Error('Viewport camera not found.');
});
async function orbit(dx,dy,zoom){
  const box=await page.locator('.viewport canvas').first().boundingBox(),x=box.x+box.width*.5,y=box.y+box.height*.5;
  await page.mouse.move(x,y);await page.keyboard.down('Alt');await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:12});await page.mouse.up();await page.keyboard.up('Alt');
  await page.mouse.move(x,y);await page.mouse.wheel(0,zoom);await settle();await page.mouse.move(box.x+4,box.y+4);await settle();
}
async function tab(name){await page.getByRole('tab',{name,exact:true}).click();await page.waitForFunction(n=>document.querySelector('.model-tab.active [role="tab"]')?.getAttribute('aria-label')===n,name);await settle();await settle();}
async function beginPainting(){await page.locator('[data-hotkey="paint"]').click();await page.getByRole('button',{name:'Begin painting',exact:true}).click();await page.locator('.paint-texture-view').waitFor();await settle();await settle();}
async function run(){
  app=(await launchApp({ out: path.resolve('out'), profile: fs.mkdtempSync(path.join(out,'profile-')), env: { MDLVIS_HEADLESS:'1' }, timeout: 60000, fixture: first })).app;
  page=await app.firstWindow();page.setDefaultTimeout(15000);page.on('pageerror',e=>result.errors.push(e.message));
  await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.webContents.setBackgroundThrottling(false);w.setSize(1280,920);w.setPosition(-3000,0);w.showInactive();});
  await page.getByRole('tab',{name:'FirstFootman.mdx',exact:true}).waitFor();

  await beginPainting();const framed=await camera();
  await orbit(90,35,-240);const firstPaint=await camera();assert.notDeepEqual(firstPaint.position,framed.position,'Alt-drag and wheel move the Paint camera');await shot('01-first-paint');
  await page.locator('input[accept=".mdl,.mdx,.mdlxlpaint"]').setInputFiles(second);await page.waitForFunction(()=>document.querySelector('.model-tab.active [role="tab"]')?.getAttribute('aria-label')==='SecondFootman.mdx');await settle();
  await beginPainting();assert.deepEqual(await camera(),framed,'a newly opened model starts with its own framed camera');
  await orbit(-120,-20,180);const secondPaint=await camera();assert.notDeepEqual(secondPaint.position,framed.position);await shot('02-second-paint');
  await tab('FirstFootman.mdx');await page.locator('.paint-texture-view').waitFor();assert.deepEqual(await camera(),firstPaint,'returning to the first tab keeps its Paint camera');await shot('03-first-again');
  await tab('SecondFootman.mdx');assert.deepEqual(await camera(),secondPaint,'returning to the second tab keeps its Paint camera');
  await orbit(0,0,0);assert.deepEqual(await camera(),secondPaint);result.checks.push('Paint keeps each model tab\'s rotation and zoom across tab switches');

  await page.locator('[data-hotkey="vertices"]').click();await settle();await orbit(70,-40,-200);const secondEditor=await camera();
  await tab('FirstFootman.mdx');await page.locator('[data-hotkey="vertices"]').click();await settle();await orbit(-60,30,150);const firstEditor=await camera();assert.notDeepEqual(firstEditor.position,secondEditor.position);
  await tab('SecondFootman.mdx');assert.deepEqual(await camera(),secondEditor,'the editor view keeps its own camera per tab');
  await tab('FirstFootman.mdx');assert.deepEqual(await camera(),firstEditor);await shot('04-first-editor');result.checks.push('The ordinary editor keeps each model tab\'s camera instead of copying the other tab\'s');
  await page.locator('[data-hotkey="paint"]').click();await page.locator('.paint-texture-view').waitFor();await settle();assert.deepEqual(await camera(),firstPaint,'Paint returns to its own camera after editing in the same tab');result.checks.push('Leaving and re-entering Paint in one tab keeps the Paint camera');
  assert.deepEqual(result.errors,[]);console.log(JSON.stringify({out,...result},null,2));
}
run().catch(async error=>{result.failure=error.stack;console.error(error);if(page)await shot('failure').catch(()=>{});process.exitCode=1;}).finally(async()=>{fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));if(app)await closeApp(app).catch(()=>{});});
