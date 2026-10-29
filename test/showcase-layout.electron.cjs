const { launchApp, closeApp } = require('./helpers/app.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');

(async()=>{
 const root=process.cwd(),out=path.join(root,'out/showcase-review/ui-'+Date.now());fs.mkdirSync(out,{recursive:true});
 const {createDemoDocument}=await import('../src/editor-document.js');const demo=createDemoDocument();
 demo.model.Sequences.push({...structuredClone(demo.model.Sequences[0]),Name:'Portrait Talk'});
 demo.model.Sequences.forEach(sequence=>{sequence.Interval=[0,100];});
 demo.model.Cameras=[{Name:'Portrait Camera',Position:new Float32Array([0,-350,150]),TargetPosition:new Float32Array([0,0,70]),FieldOfView:Math.PI/4,NearClip:1,FarClip:1000}];
 const fixture=path.join(out,'LayoutA.mdx');fs.writeFileSync(fixture,demo.serialize('mdx'));
 demo.model.Sequences.reverse();const second=path.join(out,'LayoutB.mdx');fs.writeFileSync(second,demo.serialize('mdx'));
 demo.model.Sequences=demo.model.Sequences.filter(s=>s.Name!=='Stand');const third=path.join(out,'LayoutC.mdx');fs.writeFileSync(third,demo.serialize('mdx'));
 const entry=path.join(out,'main.cjs');fs.writeFileSync(entry,`
 const {app}=require('electron');app.getAppPath=()=>${JSON.stringify(root)};
 const {GameDataDiscovery}=require(${JSON.stringify(path.join(root,'electron/game-data.cjs'))});GameDataDiscovery.prototype.discover=async()=>({folders:[],archives:[],cascFolders:[]});
 global.nextOpen=null;require('electron').dialog.showOpenDialog=async()=>{if(!global.nextOpen)throw Error('No test file selected');const file=global.nextOpen;global.nextOpen=null;return {canceled:false,filePaths:[file]};};

 require(${JSON.stringify(path.join(root,'electron/main.cjs'))});`);
 const launched = await launchApp({ out, fixture, entry, timeout: 60000, bounds: { x: -3000, y: 0, width: 1280, height: 920 }, show: 'hide', pageTimeout: 20000 }); const app = launched.app;let clipboard;
 try{
  clipboard=await app.evaluate(({clipboard})=>clipboard.readText());const page=launched.page;
  await page.getByRole('button',{name:'Showcase',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.showcase-record')&&!document.querySelector('.showcase-record').disabled);
  const level=name=>page.getByRole('group',{name:'GIF quality',exact:true}).getByRole('button',{name:name,exact:true}),controls=page.getByRole('complementary',{name:'Showcase controls'});
  assert.equal(await level('Medium').getAttribute('aria-pressed'),'true');assert.deepEqual(await page.locator('.showcase-format button').allInnerTexts(),['Low','Medium','High','Best']);
  assert.equal(await page.getByLabel('Recording FPS').evaluate(el=>el.tagName),'SELECT');
  await level('High').click();assert.equal(await level('High').getAttribute('aria-pressed'),'true');assert.equal(await page.getByLabel('Recording FPS').inputValue(),'30','a level brings its own FPS');
  const short=async()=>{await page.getByRole('list',{name:'Animation sequence'}).locator('li').first().dblclick();await page.getByRole('dialog').getByLabel('Animation Extra Time').fill('0');await page.getByRole('dialog').getByRole('button',{name:'OK',exact:true}).click();};
  await short();const output=path.join(root,'Showcase Recordings','LayoutA'),records=[];
  const record=async()=>{const prior=await page.locator('.classic-status').textContent();await page.locator('.showcase-record').click();await page.waitForFunction(prior=>{const t=document.querySelector('.classic-status')?.textContent;return t?.startsWith('Saved ')&&t!==prior;},prior,{timeout:60000});await page.waitForFunction(()=>!document.querySelector('.showcase-record').disabled);const file=fs.readdirSync(output).map(name=>path.join(output,name)).sort((a,b)=>fs.statSync(b).mtimeMs-fs.statSync(a).mtimeMs)[0],bytes=fs.readFileSync(file);const result={file,width:bytes.readUInt16LE(6),height:bytes.readUInt16LE(8)};records.push(result);return result;};
  await page.getByLabel('Crop size',{exact:true}).selectOption('classic');let r=await record();assert.deepEqual([r.width,r.height],[864,648],'High keeps the 864 px long-edge limit (18899f1e)');
  await level('Medium').click();
  for(const [preset,ratio] of [['classic',4/3],['square',1],['wide',16/9],['portrait',3/4]]){await page.getByLabel('Crop size',{exact:true}).selectOption(preset);r=await record();assert.ok(Math.abs(r.width/r.height-ratio)<.004,JSON.stringify(r));assert.equal(Math.max(r.width,r.height),640,JSON.stringify(r));}
  await page.getByLabel('Main picture',{exact:true}).check();r=await record();assert.deepEqual([r.width,r.height],[612,490]);assert.ok(path.basename(r.file).startsWith('Main-Picture'));
  await page.getByRole('tab',{name:'Portrait',exact:true}).click();await short();assert.equal(await page.getByLabel('Portrait frame',{exact:true}).isChecked(),false);r=await record();assert.deepEqual([r.width,r.height],[612,490]);
  await page.getByLabel('Main picture',{exact:true}).uncheck();await page.getByRole('tab',{name:'Sequences',exact:true}).click();await level('Low').click();await page.getByLabel('Crop size',{exact:true}).selectOption('classic');
  await page.getByRole('region',{name:'Text',exact:true}).getByRole('button',{name:'Add',exact:true}).click();await page.getByLabel('Text content').fill('MEGAZORD');
  await app.evaluate((_,file)=>global.nextOpen=file,second);await page.getByRole('button',{name:'Load model',exact:true}).click();await page.locator('.showcase-model-file small').filter({hasText:'LayoutB.mdx'}).waitFor();await page.waitForFunction(()=>!document.querySelector('.showcase-record').disabled);
  assert.match(await page.getByRole('list',{name:'Animation sequence'}).innerText(),/Stand/);assert.equal(await page.getByLabel('Crop size',{exact:true}).inputValue(),'classic');assert.equal(await page.getByLabel('Text content').inputValue(),'MEGAZORD');assert.equal(await page.getByLabel('Extra Time').inputValue(),'0');
  await page.getByRole('button',{name:'Vertices',exact:true}).click();assert.match(await page.title(),/LayoutA/);await page.getByRole('button',{name:'Showcase',exact:true}).click();assert.match(await page.locator('.showcase-model-file small').innerText(),/LayoutB/);
  await page.getByRole('button',{name:'Vertices',exact:true}).click();await app.evaluate(({BrowserWindow},file)=>{global.nextOpen=file;BrowserWindow.getAllWindows()[0].webContents.send('menu','open');},third);await page.waitForFunction(()=>document.title.includes('LayoutC'));await page.getByRole('button',{name:'Showcase',exact:true}).click();await page.locator('.showcase-model-file small').filter({hasText:'LayoutC.mdx'}).waitFor();assert.equal(await page.getByRole('list',{name:'Animation sequence'}).locator('li').count(),0);assert.equal(await page.getByLabel('Text content').inputValue(),'MEGAZORD');assert.equal(await page.getByLabel('Crop size',{exact:true}).inputValue(),'classic');
  await page.getByRole('tab',{name:'Portrait',exact:true}).click();assert.match(await page.getByRole('list',{name:'Animation sequence'}).innerText(),/Portrait Talk/);
  fs.writeFileSync(path.join(out,'ratios.json'),JSON.stringify(records,null,2));await page.screenshot({path:path.join(out,'layout.png')});console.log('PASS ratios, quality levels, separate main picture, isolated loading and retained setup: '+out);
 }finally{if(clipboard!==undefined)await app.evaluate(({clipboard},text)=>clipboard.writeText(text),clipboard);await closeApp(app);}
})().catch(error=>{console.error(error);process.exitCode=1;});
