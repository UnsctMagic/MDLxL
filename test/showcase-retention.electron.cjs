const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {launchApp,closeApp,bundleHashes,waitForInfo,infoMessageCursor}=require('./helpers/app.cjs');const {fixturePath}=require('./helpers/fixtures.cjs');
(async()=>{const out=path.resolve(process.env.MDLXL_SHOWCASE_RETENTION_OUT||'out/showcase-retention');fs.mkdirSync(out,{recursive:true});const errors=[],samples=[];
const {app,page}=await launchApp({fixture:fixturePath('citadel-footman'),out,errors,settings:{preferences:{checkUpdatesOnStartup:false,modelLookAnswered:true}},bounds:{x:0,y:0,width:1280,height:1000}});
try{await page.locator('.classic-app').waitFor();await page.getByRole('button',{name:'Showcase',exact:true}).click();
const ready=()=>page.waitForFunction(()=>window.__mdlxl.preview(document.querySelector('.showcase-preview .game-preview-root'))?.runtime.captureApi.isReady);
await ready();const cdp=await page.context().newCDPSession(page);
const sample=async()=>{await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await cdp.send('HeapProfiler.collectGarbage');return {...await cdp.send('Memory.getDOMCounters'),...await cdp.send('Runtime.getHeapUsage')};};
const quality=page.getByRole('group',{name:'GIF quality',exact:true}).getByRole('button');
for(let batch=0;batch<3;batch++){for(let i=0;i<8;i++){await quality.nth(i%2?2:0).click();await ready();}samples.push(await sample());}
console.log(JSON.stringify(samples));assert.ok(samples[2].nodes<samples[0].nodes+12 && samples[2].backingStorageSize<samples[0].backingStorageSize+5*1024*1024 && samples[2].usedSize<samples[0].usedSize+4*1024*1024,'Showcase quality changes must release prior renderer handles');
const canvas=page.locator('.showcase-preview canvas[data-clean-model-canvas]'),b=await canvas.boundingBox();
const view=()=>page.evaluate(()=>window.__mdlxl.preview(document.querySelector('.showcase-preview .game-preview-root')).runtime.controls.object.position.toArray());
const before=await view();await page.mouse.move(b.x+b.width*.5,b.y+b.height*.5);await page.mouse.down();await page.mouse.move(b.x+b.width*.65,b.y+b.height*.6,{steps:10});await page.mouse.up();assert.notDeepEqual(await view(),before,'Showcase retains normal mouse rotation');assert.deepEqual(errors,[]);console.log('PASS retained Showcase memory plateaus and mouse navigation works');
await quality.nth(0).click();await ready();await page.keyboard.press('Control+z');await page.waitForFunction(()=>document.querySelectorAll('[aria-label="GIF quality"] button')[2]?.getAttribute('aria-pressed')==='true');await ready();console.log('PASS Showcase quality undo survives renderer replacement');
await quality.nth(0).click();await ready();const cursor=await infoMessageCursor(page);await page.getByRole('button',{name:'RECORD',exact:true}).click();
const saved=await waitForInfo(page,/^Saved .*\.gif/,{after:cursor,timeout:90000});const file=saved.match(/^Saved (.*?\.gif)(?: ·|$)/)?.[1];assert.ok(file && fs.statSync(file).size>500);assert.match(fs.readFileSync(file).subarray(0,6).toString(),/^GIF8[79]a$/);console.log('PASS recorded a valid GIF after repeated renderer replacements '+fs.statSync(file).size+' bytes');
}finally{await closeApp(app);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({bundle:bundleHashes(),samples,errors},null,2));}})().catch(error=>{console.error(error);process.exitCode=1;});
