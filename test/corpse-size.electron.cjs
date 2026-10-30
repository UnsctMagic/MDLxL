const {launchApp,closeApp,stubDialogs}=require('./helpers/app.cjs');
const {gameFolder,fixturePath}=require('./helpers/fixtures.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=process.env.MDLXL_SHOT_OUT||path.resolve('out/corpse-size');
const captureOnly=Boolean(process.env.MDLXL_SHOT_FIXTURES);
const list=captureOnly?process.env.MDLXL_SHOT_FIXTURES.split(';').filter(Boolean):[fixturePath('footman')];
function snapshot(scope='[aria-label="Auto Corpse preview"]'){
 const el=document.querySelector(scope+' .game-preview-root')||document.querySelector(scope);if(!el)return null;
 let props;const s=findFiberState(el,(s,p)=>{if(p?.model&&s?.native&&s?.controls){props=p;return true;}return false;},{current:true});if(!s)return null;
 const c=s.controls.object||s.camera,canvas=el.querySelector('canvas');
 return {model:structuredClone(props.model),sequence:props.sequenceIndex,ready:s.captureApi?.isReady,gutzResolved:[...(props.textureAssets instanceof Map?props.textureAssets:new Map(Object.entries(props.textureAssets||{})))].some(([name,asset])=>/(?:^|[\\/])gutz\.blp$/i.test(name)&&(asset?.bytes?.length||asset?.bytes?.byteLength)),rect:canvas.getBoundingClientRect().toJSON(),position:c.position.toArray(),camera:c.quaternion.toArray()};
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});const results=[];
 for(const file of list){const tag=path.basename(file,'.mdx').replace(/[^\w.-]+/g,'_');let app,page;const row={model:path.basename(file),file};
 try{
  ({app,page}=await launchApp({out,show:'hide',fixture:file,bounds:{x:0,y:0,width:1500,height:950},settings:{gameData:await gameFolder(),preferences:{language:'en'}},args:['--disable-renderer-backgrounding','--disable-background-timer-throttling']}));
  await page.getByLabel('3D model viewport',{exact:true}).waitFor();
  await page.waitForFunction(name=>document.title.includes(name),path.basename(file));
  await page.evaluate('window.readCorpsePreview='+snapshot.toString());
  await page.getByRole('button',{name:'Auto Corpse (test)',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Auto Corpse',exact:true});await dialog.waitFor();
  await page.waitForFunction(()=>document.querySelector('[aria-label="Auto Corpse"] .atm-error')||window.readCorpsePreview()?.ready,{},{timeout:60000});
  const capture=async suffix=>{await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const b=await dialog.boundingBox();const data=await app.evaluate(({BrowserWindow},b)=>BrowserWindow.getAllWindows()[0].webContents.capturePage(b,{stayHidden:true,stayAwake:true}).then(i=>i.toPNG().toString('base64')),{x:Math.round(b.x),y:Math.round(b.y),width:Math.round(b.width),height:Math.round(b.height)});fs.writeFileSync(path.join(out,tag+'-'+suffix+'.png'),Buffer.from(data,'base64'));};
  const alert=dialog.locator('.atm-error');if(await alert.count()){row.error=await alert.innerText();await capture('error');results.push(row);continue;}
  await page.waitForFunction(()=>window.readCorpsePreview()?.gutzResolved,{},{timeout:15000});
  await page.waitForFunction(()=>window.readCorpsePreview()?.ready);
  let p=await page.evaluate(snapshot);assert.ok(p?.ready);
  // Real mouse rotation, with the same resulting camera used for both pictures.
  const r=p.rect;await page.mouse.move(r.x+r.width*.78,r.y+r.height*.48);await page.mouse.down();await page.mouse.move(r.x+r.width*.78+45,r.y+r.height*.48+100,{steps:8});await page.mouse.up();
  await page.waitForFunction(before=>JSON.stringify(window.readCorpsePreview()?.camera)!==JSON.stringify(before),p.camera);row.cameraDrag=true;
  const zoom=(await page.evaluate(snapshot)).position;await page.mouse.wheel(0,-350);await page.waitForFunction(before=>JSON.stringify(window.readCorpsePreview()?.position)!==JSON.stringify(before),zoom);
  await capture('1-corpse');
  await dialog.getByRole('checkbox',{name:'Show body',exact:true}).click();
  await page.waitForFunction(old=>{const p=window.readCorpsePreview();return p?.ready&&p.sequence!==old;},p.sequence);
  await capture('2-with-body');
  row.warnings=await dialog.locator('.game-preview-root [role="status"]').allTextContents();
  if(!captureOnly){
   const {EditorDocument}=await import('../src/editor-document.js');const {sampleNodeMatrices,skinGeoset,sampleGeosetAnimation}=await import('../src/animation.js');const {booleanContours,signedArea}=await import('../src/forge-geometry.js');
   const original=new EditorDocument(fs.readFileSync(file),file).model;
   const footprint=(model,ids,seq)=>{const M=sampleNodeMatrices(model,model.Sequences[seq].Interval[0],seq),tri=[];for(const id of ids){const g=model.Geosets[id],v=skinGeoset(g,M);for(let f=0;f<g.Faces.length;f+=3){const t=Array.from(g.Faces.slice(f,f+3),i=>[v[i*3],v[i*3+1]]);if(signedArea(t)<0)t.reverse();tri.push(t);}}return Math.abs(booleanContours(tri,[],'add',1000).reduce((s,t)=>s+signedArea(t),0));};
   const bo=original.Sequences.findIndex(s=>/^decay bones?$/i.test(s.Name.trim()));const nativeIds=original.Geosets.flatMap((g,i)=>sampleGeosetAnimation(original,i,original.Sequences[bo].Interval[0],bo).alpha>.01&&original.Materials[g.MaterialID].Layers.some(l=>/gutz/i.test(original.Textures[l.TextureID]?.Image))?[i]:[]);
   await dialog.getByRole('button',{name:'Create',exact:true}).click();await dialog.waitFor({state:'hidden'});
   const saved=path.join(out,'saved.mdx');await stubDialogs(app,{save:saved});await page.keyboard.press('F12');await page.getByRole('button',{name:'Save MDX…',exact:true}).click();await page.getByRole('dialog',{name:'Save as',exact:true}).waitFor({state:'hidden'});
   assert.ok(fs.existsSync(saved),'Save As wrote the model');const result=new EditorDocument(fs.readFileSync(saved),saved).model;
   const id=result.Geosets.findIndex(g=>g.Groups.flat().some(id=>result.Bones.find(n=>n.ObjectId===id)?.Name==='MDLxL Corpse 0'));
   const afterBone=result.Sequences.findIndex(s=>/^decay bones?$/i.test(s.Name.trim()));row.nativeArea=footprint(original,nativeIds,bo);row.generatedArea=footprint(result,[id],afterBone);
   assert.ok(row.generatedArea>=row.nativeArea*.9,`Saved corpse area ${row.generatedArea.toFixed(1)} is less than 90% of Blizzard's ${row.nativeArea.toFixed(1)}`);
   assert.ok(row.generatedArea<=row.nativeArea*1.65,'saved corpse stays within the measured native size range');
   assert.equal(result.Geosets.length,original.Geosets.length+1,'only the corpse is added');fs.unlinkSync(saved);
   await page.getByRole('button',{name:'Auto Corpse (test)',exact:true}).click();await dialog.waitFor();
   await page.waitForFunction(()=>window.readCorpsePreview()?.ready);
   const vertexState=()=>page.evaluate(()=>JSON.stringify(window.readCorpsePreview().model.Geosets.map(g=>Array.from(g.Vertices))));
   const vertexCount=()=>page.evaluate(()=>window.readCorpsePreview().model.Geosets.reduce((n,g)=>n+g.Vertices.length,0));
   await page.waitForFunction(()=>{const p=findFiberProps('[aria-label="Corpse piece handles"]',p=>p.snapshot&&p.pieces);return p?.pieces.some((piece,i)=>piece.kind==='torso'&&p.snapshot.marks[i+'s']&&p.snapshot.marks[i+'e']);});
   const spot=await page.evaluate(()=>{const el=document.querySelector('[aria-label="Corpse piece handles"]'),p=findFiberProps(el,p=>p.snapshot&&p.pieces),i=p.pieces.findIndex(p=>p.kind==='torso'),a=p.snapshot.marks[i+'s'],b=p.snapshot.marks[i+'e'],r=el.getBoundingClientRect();return [r.x+(a[0]+b[0])/2,r.y+(a[1]+b[1])/2];});
   await page.mouse.dblclick(...spot);const handle=dialog.getByRole('slider',{name:'Move this piece',exact:true});await handle.waitFor();
   const startDrag=async()=>{const h=await handle.boundingBox(),x=h.x+h.width/2,y=h.y+h.height/2;await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+32,y+18,{steps:8});};
   const beforeDrag=await vertexState();await startDrag();await page.waitForFunction(before=>JSON.stringify(window.readCorpsePreview().model.Geosets.map(g=>Array.from(g.Vertices)))!==before,beforeDrag);
   await page.keyboard.press('Escape');await page.mouse.up();await page.waitForFunction(before=>JSON.stringify(window.readCorpsePreview().model.Geosets.map(g=>Array.from(g.Vertices)))===before,beforeDrag);assert.ok(await dialog.isVisible(),'Escape cancels a drag without closing the window');
   await startDrag();await page.mouse.up();await page.waitForFunction(before=>JSON.stringify(window.readCorpsePreview().model.Geosets.map(g=>Array.from(g.Vertices)))!==before,beforeDrag);
   const count=await vertexCount();await page.keyboard.press('Delete');await page.waitForFunction(count=>window.readCorpsePreview().model.Geosets.reduce((n,g)=>n+g.Vertices.length,0)<count,count);
   await page.keyboard.press('Control+z');await page.waitForFunction(count=>window.readCorpsePreview().model.Geosets.reduce((n,g)=>n+g.Vertices.length,0)===count,count);
   await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});row.keys='drag, Escape cancel, drag, Delete, Ctrl+Z, Escape close';
  }
  row.result='captured';results.push(row);console.log('captured',tag);
 }catch(error){row.error=error.stack;results.push(row);console.log('FAILED',tag,error.message);if(!captureOnly)process.exitCode=1;}
 finally{if(app)await closeApp(app);const saved=path.join(out,'saved.mdx');if(fs.existsSync(saved))fs.unlinkSync(saved);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));}
 }
 if(results.some(row=>row.error))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});

