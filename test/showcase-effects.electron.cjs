const { fixturePath, gameFolder } = require('./helpers/fixtures.cjs');
const { launchApp, closeApp, sha256File } = require('./helpers/app.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');

(async()=>{
 const root=process.cwd(),out=path.join(root,'out/showcase-review/ui-'+Date.now());fs.mkdirSync(out,{recursive:true});
 const fixture=fixturePath('effect');if(!fixture)throw Error('Set MDLXL_EFFECT_MODEL to the Flail model to inspect.');
 const original=sha256File(fixture);
 const {GameDataDiscovery}=require('../electron/game-data.cjs');
 const folder=await gameFolder();assert.ok(folder,'Set MDLXL_GAME_FOLDER to the Warcraft installation used by the effect fixture.');
 const cache=await new GameDataDiscovery({cacheFile:path.join(out,'game-data-discovery.json'),env:{},registry:async()=>[],drives:async()=>[]}).discover({explicitFolder:folder});
 const entry=path.join(out,'main.cjs');fs.writeFileSync(entry,`
 const {app}=require('electron');app.getAppPath=()=>${JSON.stringify(root)};
 const {GameDataDiscovery}=require(${JSON.stringify(path.join(root,'electron/game-data.cjs'))});GameDataDiscovery.prototype.discover=async()=>(${JSON.stringify(cache)});
 require(${JSON.stringify(path.join(root,'electron/main.cjs'))});`);
 const launched = await launchApp({ out, fixture, entry, timeout: 60000, bounds: { x: -3000, y: 0, width: 1280, height: 920 }, show: 'hide', pageTimeout: 20000 }); const app = launched.app;let clipboard;
 try{
  clipboard=await app.evaluate(({clipboard})=>clipboard.readText());const page=launched.page;
  await page.getByRole('button',{name:'Showcase',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.showcase-record')&&!document.querySelector('.showcase-record').disabled);
  await page.getByRole('list',{name:'Animation sequence'}).locator('li').first().dblclick();await page.getByRole('dialog').getByLabel('Animation',{exact:true}).selectOption({label:'Attack - Slam'});await page.getByRole('dialog').getByLabel('Loops',{exact:true}).fill('1');
  // 47e379b2/ecc30f3d replaced the "1 loop · Ns" buttons and the Length field with a Loops number beside its computed length.
  const length=Number((await page.getByRole('dialog').locator('label:has([aria-label="Loops"]) output').innerText()).replace(/s$/,''));// b2619668/31567d99: continuous auras and global effects no longer lengthen an action; Attack - Slam (1.437 s) ends with its own particle tail at 1.9 s.
  assert.ok(length>=1.85&&length<1.95,length);await page.getByRole('dialog').getByRole('button',{name:'OK',exact:true}).click();
  const samples=await page.locator('.showcase-workspace').evaluate(async el=>{
    const api=findFiberState(el,v=>v?.prepareRecording);
    if(!api)throw Error('No Showcase capture API');await api.whenReady();await api.prepareRecording();const samples=[];
    for(const time of [1600,2000,2600]){await api.seekRecordingFrame(time);const c=api.captureFrame({maxDimension:800});samples.push({time,state:api.playbackState(),png:c.toDataURL('image/png')});}
    api.endRecording();return samples;
  });
  for(const item of samples){fs.writeFileSync(path.join(out,'slam-'+item.time+'.png'),Buffer.from(item.png.split(',')[1],'base64'));delete item.png;assert.equal(item.state.frame,171437);}
  assert.equal(sha256File(fixture),original);
  fs.writeFileSync(path.join(out,'slam.json'),JSON.stringify({length,samples},null,2));console.log('PASS actual Slam duration '+length+'s, held pose and continuous effect clocks, model bytes unchanged. '+out);
 }finally{if(clipboard!==undefined)await app.evaluate(({clipboard},text)=>clipboard.writeText(text),clipboard);await closeApp(app);}
})().catch(error=>{console.error(error);process.exitCode=1;});
