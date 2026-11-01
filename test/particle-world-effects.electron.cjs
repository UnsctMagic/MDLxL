const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {launchApp,closeApp}=require('./helpers/app.cjs');
const {click,type,orbit}=require('./helpers/library-browser.cjs');
const {fixturePath}=require('./helpers/fixtures.cjs');
(async()=>{
 const shard=process.env.MDLXL_RIBBON_SHARD,sharded=shard!==undefined,manifest=sharded?JSON.parse(await fs.readFile(process.env.MDLXL_RIBBON_MANIFEST)):null;
 const assigned=sharded?new Set(manifest.ids.filter((id,index)=>index%Number(process.env.MDLXL_RIBBON_SHARDS)===Number(shard))):process.env.MDLXL_RIBBON_ID?new Set([process.env.MDLXL_RIBBON_ID]):null;
 const source=process.env.MDLXL_REAL_PROFILE,out=path.resolve('out/world-effects'+(sharded?'-shard-'+shard:process.env.MDLXL_CASE_LABEL?'-'+process.env.MDLXL_CASE_LABEL:'')),profile=path.join(out,'profile'),evidence=path.resolve('test/evidence/particle-library');
 await fs.mkdir(profile,{recursive:true});await fs.mkdir(evidence,{recursive:true});
 await fs.cp(path.join(source,'particles'),path.join(profile,'particles'),{recursive:true,filter:file=>!file.includes('thumbnails')&&(!assigned||!/^wc3-.*\.json$/.test(path.basename(file))||assigned.has(path.basename(file,'.json')))});
 const current=JSON.parse(await fs.readFile(path.join(profile,'particles/current.json'))),directory=path.join(profile,'particles',current.sourceKey);
 const catalog=JSON.parse(await fs.readFile(path.join(directory,'catalog.json'))),ribbons=[];
 if(assigned){
  if(manifest)assert.equal(current.sourceKey,manifest.sourceKey);
  const file=path.join(directory,'catalog.json');await fs.writeFile(file,JSON.stringify(catalog.filter(item=>assigned.has(item.id))));
  const browse=JSON.parse(await fs.readFile(path.join(directory,'browse.json'))),{browseRevision}=require('../electron/particle-review.cjs');browse.revision=browseRevision(await fs.stat(file,{bigint:true}));await fs.writeFile(path.join(directory,'browse.json'),JSON.stringify(browse));
 }
 if(process.env.MDLXL_RIBBON_ID&&process.env.MDLXL_RETAG_RIBBON){
  const file=path.join(profile,'particles/metadata.json'),meta=await fs.readFile(file,'utf8').then(JSON.parse,error=>{if(error.code==='ENOENT')return {};throw error;});
  meta[process.env.MDLXL_RIBBON_ID]={...meta[process.env.MDLXL_RIBBON_ID],tags:['owner review']};await fs.writeFile(file,JSON.stringify(meta));
 }
 for(const item of catalog.filter(item=>!item.blocked&&(!assigned||assigned.has(item.id)))){const recipe=JSON.parse(await fs.readFile(path.join(directory,item.id+'.json')));if(recipe.native.RibbonEmitters?.length)ribbons.push(item);}
 if(assigned)assert.equal(ribbons.length,assigned.size,'Every assigned real ribbon is included');
 const arrow=ribbons.find(item=>item.sources.some(source=>/arrowmissile\.mdx$/i.test(source.logicalPath)));
 assert.ok(arrow||assigned);if(arrow){ribbons.splice(ribbons.indexOf(arrow),1);ribbons.unshift(arrow);}
 let app;
 try{
  const launched=await launchApp({out,profile,fixture:fixturePath('footman'),show:'hide',bounds:{x:0,y:0,width:1440,height:1000},pageTimeout:60000,settings:{gameData:current.folder,preferences:{checkUpdatesOnStartup:false,...(process.env.MDLXL_PREVIEW_BACKGROUND?{viewportAppearance:{background:{type:'color',color:process.env.MDLXL_PREVIEW_BACKGROUND}}}:{})}},env:{MDLVIS_GAME_DATA:current.folder}});
  app=launched.app;const page=launched.page,button=name=>page.getByRole('button',{name,exact:true});
  await click(page,button('Emitter Editor'));const library=page.locator('.pe-library');await library.waitFor();await click(page,button('World Editor Style'));
  const search=page.getByLabel('Find an effect');
  const reveal=async name=>{const row=library.getByRole('treeitem',{name,exact:true});for(let attempt=0;await row.count()===0&&attempt<30;attempt++){const box=await library.locator('.gf-tree').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.wheel(0,240);}await click(page,row);};
  const ready=async id=>{await page.waitForFunction(id=>findFiberState(document.querySelector('.pe-library .gf-stage-layer'),value=>value?.id===id&&value.model),id);await page.waitForFunction(()=>mdlxlProbe('.pe-library .gf-stage .game-preview-root').runtime?.captureApi?.isReady);};
  for(const [folders,file]of (process.env.MDLXL_ARROW_ONLY||assigned?[]:[[['Units','Human','Priest','Heal'],'priest'],[['Units','Orc','Shaman','Bloodlust'],'shaman'],[['Blood & death'],'blood-death'],[['Buildings','Orc'],'buildings-orc']])){
   await type(page,search,'');await click(page,button('Standard'));await click(page,button('World Editor Style'));for(const name of folders)await reveal(name);await page.keyboard.press('ArrowDown');const id=await library.locator('.gf-row.selected').getAttribute('data-effect-id');assert.ok(id);await ready(id);await library.screenshot({path:path.join(evidence,file+'.png')});
  }
  // Full-catalogue folder captures precede the bulk fixture. Keep every real
  // ribbon recipe, without scheduling unrelated PE2 thumbnails per path search.
  // Only the disposable catalogue snapshot is narrowed; recipe files are intact.
  await button('Index Warcraft assets').waitFor();
  const keep=new Set(ribbons.map(item=>item.id)),catalogFile=path.join(directory,'catalog.json');
  if(!process.env.MDLXL_SCREENSHOTS_ONLY)await fs.writeFile(catalogFile,JSON.stringify(catalog.filter(item=>keep.has(item.id))));
  const browseFile=path.join(directory,'browse.json'),browse=JSON.parse(await fs.readFile(browseFile)),{browseRevision}=require('../electron/particle-review.cjs');browse.revision=browseRevision(await fs.stat(catalogFile,{bigint:true}));await fs.writeFile(browseFile,JSON.stringify(browse));
  await click(page,button('Close Particle Library'));await library.waitFor({state:'hidden'});await click(page,page.getByRole('dialog',{name:'Particle Editor',exact:true}).getByRole('button',{name:'Library',exact:true}));await library.waitFor();
  await click(page,button('Standard'));
  // Static camera and settled grid remove scene motion. Keep faint authored additive colors measurable.
  const compare=async(a,b)=>app.evaluate(({nativeImage},{a,b})=>{const x=nativeImage.createFromBuffer(Buffer.from(a,'base64')).toBitmap(),y=nativeImage.createFromBuffer(Buffer.from(b,'base64')).toBitmap();let changed=0;for(let i=0;i<x.length;i+=4)if(Math.abs(x[i]-y[i])+Math.abs(x[i+1]-y[i+1])+Math.abs(x[i+2]-y[i+2])>3)changed++;return changed;},{a:a.toString('base64'),b:b.toString('base64')});
  const results=[];
  for(const item of process.env.MDLXL_ARROW_ONLY||process.env.MDLXL_SCREENSHOTS_ONLY?[arrow]:ribbons){
   const query=(item.sources[0].logicalPath||item.sources[0].physicalPath).split('\\').at(-1).replace(/\.mdx$/i,'');await type(page,search,query);
   const row=library.locator('[data-effect-id="'+item.id+'"]');
   for(let attempt=0;await row.count()===0&&attempt<20;attempt++){const box=await library.locator('.gf-tree').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.wheel(0,400);}
   await click(page,row.first());await page.waitForFunction(id=>findFiberState(document.querySelector('.pe-library .gf-stage-layer'),value=>value?.id===id&&value.model),item.id);const canvas=library.locator('.gf-stage canvas').first();await canvas.waitFor();
   if(process.env.MDLXL_RETAG_RIBBON)assert.equal(await library.getByLabel('Effect tags').inputValue(),'owner review','Native ribbon identity is independent of editable tags');
   await page.waitForFunction(()=>mdlxlProbe('.pe-library .gf-stage .game-preview-root').runtime?.captureApi?.isReady);
   await page.waitForFunction(function settledCamera(){const controls=mdlxlProbe('.pe-library .gf-stage .game-preview-root').runtime.controls,key=[...controls.object.position.toArray(),...controls.target.toArray()].map(value=>Math.round(value*1e5)).join(',');settledCamera.frames=settledCamera.key===key?(settledCamera.frames||0)+1:0;settledCamera.key=key;return settledCamera.frames>=5;});
   await page.waitForFunction(()=>mdlxlProbe('.pe-library .gf-stage .game-preview-root').runtime.native.ribbonsController.emitters.some(emitter=>emitter.creationTimes.length>=2));
   const cameraStamp=()=>page.evaluate(()=>{const controls=mdlxlProbe('.pe-library .gf-stage .game-preview-root').runtime.controls;return [...controls.object.position.toArray(),...controls.target.toArray()].map(value=>Math.round(value*1e5)).join(',');}),camera=await cameraStamp();
   const interval=await page.evaluate(()=>Array.from(mdlxlProbe('.pe-library .gf-stage .game-preview-root').runtime.native.model.Sequences[mdlxlProbe('.pe-library .gf-stage .game-preview-root').runtime.native.getSequence()].Interval)),span=await page.evaluate(()=>{const native=mdlxlProbe('.pe-library .gf-stage .game-preview-root').runtime.native,[start,end]=native.model.Sequences[native.getSequence()].Interval;return Math.max(1000,end-start,...native.model.GlobalSequences);});
   const frameImage=async()=>Buffer.from((await page.evaluate(()=>mdlxlProbe('.pe-library .gf-stage .game-preview-root').runtime.captureApi.captureView().toDataURL('image/png'))).split(',')[1],'base64');
   const a=await frameImage(),deadline=Date.now()+120000;let changed=0,elapsed=0,previous=await page.evaluate(()=>mdlxlProbe('.pe-library .gf-stage .game-preview-root').runtime.native.getFrame());
   while(changed<=10&&elapsed<span&&Date.now()<deadline){
    const frame=await page.evaluate(()=>{const native=mdlxlProbe('.pe-library .gf-stage .game-preview-root').runtime.native;return [native.getFrame(),...native.rendererData.globalSequencesFrames,...native.ribbonsController.emitters.map(emitter=>emitter.creationTimes.at(-1))].join(',');});
    await page.waitForFunction(frame=>{const native=mdlxlProbe('.pe-library .gf-stage .game-preview-root').runtime.native;return [native.getFrame(),...native.rendererData.globalSequencesFrames,...native.ribbonsController.emitters.map(emitter=>emitter.creationTimes.at(-1))].join(',')!==frame;},frame);
    changed=Math.max(changed,await compare(a,await frameImage()));
    const now=await page.evaluate(()=>mdlxlProbe('.pe-library .gf-stage .game-preview-root').runtime.native.getFrame());elapsed+=now>=previous?now-previous:interval[1]-previous+now-interval[0];previous=now;
   }
   if(changed<=10){await canvas.screenshot({path:path.resolve('report/stage-failure-'+(process.env.MDLXL_CASE_LABEL||item.id)+'.png')});console.log('Stage debug',await page.evaluate(()=>{const r=mdlxlProbe('.pe-library .gf-stage .game-preview-root').runtime,n=r.native;return {frame:n.getFrame(),camera:r.controls.object.position.toArray(),target:r.controls.target.toArray(),seq:n.getSequence(),material:n.model.Materials,ribbons:n.ribbonsController.emitters.map(e=>({creationTimes:e.creationTimes,vertices:Array.from(e.vertices.slice(0,24))})),preview:findFiberState(document.querySelector('.pe-library .gf-stage-layer'),v=>v?.model&&v?.id)?.demonstration};}));}
   assert.ok(changed>10,'A27b moving non-empty ribbon '+item.id+' changed pixels='+changed);
   assert.equal(await cameraStamp(),camera,'Static camera: changed pixels come from the effect, not the grid');
   await row.locator('img').waitFor();const thumbnail=await row.locator('img').getAttribute('src');assert.ok(thumbnail.startsWith('data:image/png'));
   const picturePixels=await app.evaluate(({nativeImage},url)=>{const bytes=nativeImage.createFromBuffer(Buffer.from(url.split(',')[1],'base64')).toBitmap();let pixels=0;for(let i=0;i<bytes.length;i+=4)if(Math.abs(bytes[i]-bytes[0])+Math.abs(bytes[i+1]-bytes[1])+Math.abs(bytes[i+2]-bytes[2])>24)pixels++;return pixels;},thumbnail);
   if(picturePixels<=10){await fs.writeFile(path.resolve('report/empty-ribbon-thumbnail.png'),Buffer.from(thumbnail.split(',')[1],'base64'));await canvas.screenshot({path:path.resolve('report/empty-thumbnail-stage.png')});console.log('Thumbnail pixels',picturePixels);}
   assert.ok(picturePixels>10,'Non-empty ribbon thumbnail '+item.id);
   if(item.id===arrow?.id&&!sharded){await orbit(page,library.locator('.gf-stage'));const view=await canvas.boundingBox();await page.mouse.move(view.x+view.width/2,view.y+view.height/2);await page.mouse.wheel(0,-240);await library.getByText('Demonstration sweep · preview only',{exact:true}).waitFor();await click(page,button('World Editor Style'));await click(page,row.first());await page.waitForFunction(()=>mdlxlProbe('.pe-library .gf-stage .game-preview-root').runtime.native.ribbonsController.emitters.some(emitter=>emitter.creationTimes.length>2));await library.screenshot({path:path.join(evidence,'archer-ribbon.png')});await click(page,button('Standard'));}
   results.push({id:item.id,changed,thumbnailPixels:picturePixels,cameraStable:true,pixelRgbDelta:3});console.log(JSON.stringify(results.at(-1)));
  }
  assert.deepEqual(launched.errors,[]);await fs.writeFile(path.resolve(sharded?'report/a27b-shard-'+shard+'.json':process.env.MDLXL_SCREENSHOTS_ONLY?'report/a27b-evidence.json':'report/a27b.json'),JSON.stringify({passed:results.length,total:ribbons.length,results},null,2));
 }catch(error){console.error(error);if(app){try{const page=await app.firstWindow();console.log('Library failure state',await page.locator('.pe-library').innerText());console.log('Thumbnail renderers',await page.locator('.pe-thumbnail-renderer').count());}catch{}}throw error;}finally{if(app)await closeApp(app);}
})().catch(error=>{console.error(error);process.exitCode=1;});
