// OptimizeXL on a generated broken model: Before/After sit side by side and
// rotate with a real mouse drag, Fix everything clears the checker, and Save
// writes into the open file after offering one backup.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {_electron}=require(process.env.MDLXL_PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const {createStarterDocument}=await import('../src/starter-model.js'),{createNode,openDocument}=await import('../src/editor-document.js');
 const {generateCompatibleMdx}=await import('../src/mdx-compatibility.js'),{flattenHiveFindings}=await import('../app/optimizexl-hive.js');
 vm.runInThisContext(fs.readFileSync(path.resolve('public/vendor/hive-viewer-5.12.0.js'),'utf8'));
 const hive=bytes=>{const m=new ModelViewer.parsers.mdlx.Model();m.load(new Uint8Array(bytes).slice().buffer);const r=ModelViewer.utils.mdlx.sanityTest(m);return {...r,findings:flattenHiveFindings(r.nodes)};};
 const out=path.resolve(process.env.MDLXL_OPTIMIZEXL_PROOF_ROOT||'out','optimizexl-workflow-'+Date.now()),profile=path.join(out,'profile');fs.mkdirSync(profile,{recursive:true});
 // Broken in several unrelated ways: keys out of order, a helper moving
 // vertices, "Stand1", an empty event and no Origin attachment point.
 const m=structuredClone(createStarterDocument().model),seq=(Name,Interval)=>({Name,Interval:new Uint32Array(Interval),MoveSpeed:0,NonLooping:false,Rarity:0,BoundsRadius:0,MinimumExtent:new Float32Array(3),MaximumExtent:new Float32Array(3),SyncPoint:0,Flags:0});
 m.Sequences=[seq('Stand1',[0,1000]),seq('Death',[1100,2000])];for(const g of m.Geosets)g.Anims=m.Sequences.map(()=>({BoundsRadius:g.BoundsRadius,MinimumExtent:new Float32Array(g.MinimumExtent),MaximumExtent:new Float32Array(g.MaximumExtent)}));
 const k=(Frame,v)=>({Frame,Vector:new Float32Array(v)});m.Bones[0].Translation={LineType:1,GlobalSeqId:null,Keys:[k(0,[0,0,0]),k(600,[0,0,30]),k(300,[0,0,10]),k(1000,[0,0,0])]};
 const helper=createNode(m,'Helper');m.Geosets[0].Groups.push([helper.ObjectId]);m.Geosets[0].VertexGroup[0]=m.Geosets[0].Groups.length-1;m.Geosets[0].TotalGroupsCount=m.Geosets[0].Groups.reduce((n,g)=>n+g.length,0);
 createNode(m,'EventObject').EventTrack=new Uint32Array([]);
 const file=path.join(out,'Broken.mdx'),source=Buffer.from(generateCompatibleMdx(m));fs.writeFileSync(file,source);
 const before=hive(source);assert.ok(before.severe>0&&before.errors>0,'the fixture fails the checker');
 const exe=process.env.MDLXL_TEST_EXE,errors=[];
 const app=await _electron.launch({executablePath:exe||path.resolve('node_modules/electron/dist/electron.exe'),args:[...(exe?[]:[process.cwd()]),file],env:{...process.env,MDLVIS_HEADLESS:'1',MDLXL_PROFILE:profile},timeout:60000});
 try{
  const main=await app.firstWindow();main.on('pageerror',e=>errors.push(e.message));await main.getByTitle(/^OptimizeXL(\nHotkey: .+)?$/).waitFor({timeout:60000});
  const pending=app.waitForEvent('window');await main.getByTitle(/^OptimizeXL(\nHotkey: .+)?$/).click();const p=await pending;p.setDefaultTimeout(60000);p.on('pageerror',e=>errors.push(e.message));
  await app.evaluate(({BrowserWindow})=>{for(const w of BrowserWindow.getAllWindows()){w.webContents.setBackgroundThrottling(false);w.setBounds({x:-3500,y:0,width:1500,height:900});w.showInactive();}});
  await p.getByRole('heading',{name:'Insanity FIxer',exact:true}).waitFor();
  // Before and After touch; the controls sit to their right.
  const box=async label=>p.locator(`[aria-label="${label}"]`).boundingBox(),b=await box('Before preview'),a=await box('After preview'),c=await box('Optimization controls');
  assert.ok(a.x-(b.x+b.width)<=1.5,`Before and After must touch (gap ${a.x-(b.x+b.width)})`);assert.ok(Math.abs(b.width-a.width)<=1,'equal preview widths');assert.ok(c.x>=a.x+a.width-1,'controls are on the right');
  await p.screenshot({path:path.join(out,'01-side-by-side.png')});
  // Rotate with a real left-drag in the Before view; both views follow.
  const shot=async label=>(await p.locator(`[aria-label="${label}"] canvas`).first().screenshot()).toString('base64');
  await p.waitForTimeout(1500);const still=[await shot('Before preview'),await shot('After preview')];
  await p.mouse.move(b.x+b.width/2,b.y+b.height/2);await p.mouse.down();await p.mouse.move(b.x+b.width/2+160,b.y+b.height/2+30,{steps:12});await p.mouse.up();await p.waitForTimeout(800);
  assert.notEqual(await shot('Before preview'),still[0],'the Before view rotates with the mouse');assert.notEqual(await shot('After preview'),still[1],'the After view follows');
  // One click previews every repair; approving clears the checker.
  await p.getByText(/^mdx-m3-viewer: \d+ errors/).waitFor();
  await p.getByRole('button',{name:'Fix everything',exact:true}).click();
  await p.waitForFunction(()=>!!document.querySelector('.ox-savings strong'));
  await p.screenshot({path:path.join(out,'02-fix-everything-preview.png')});
  assert.equal(await p.getByRole('button',{name:'Save',exact:true}).isDisabled(),true,'nothing approved yet');assert.equal(await p.getByRole('button',{name:'Commit',exact:true}).isDisabled(),true);
  await p.getByRole('button',{name:'Approve all fixes',exact:true}).click();
  await p.getByText(/^mdx-m3-viewer: 0 errors · 0 severe · 0 warnings/).waitFor();
  // Close with unsaved approved work asks first.
  await p.getByRole('button',{name:'Close',exact:true}).click();await p.getByRole('dialog',{name:'Unsaved changes'}).waitFor();
  await p.getByRole('button',{name:'Cancel',exact:true}).click();
  // So does the window's own close button.
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().sort((a,b)=>b.id-a.id)[0].close());
  await p.getByRole('dialog',{name:'Unsaved changes'}).waitFor();assert.equal(p.isClosed(),false);
  await p.getByRole('button',{name:'Cancel',exact:true}).click();
  // Save writes the open file; the first save offers one backup copy.
  await p.getByRole('button',{name:'Save',exact:true}).click();await p.getByRole('dialog',{name:'Save changes'}).waitFor();
  await p.screenshot({path:path.join(out,'03-backup-prompt.png')});
  await p.getByRole('button',{name:'Back up, then save',exact:true}).click();await p.getByText(/^Saved Broken\.mdx\./).waitFor();
  const backup=path.join(out,'Broken_backup.mdx');assert.deepEqual(fs.readFileSync(backup),source,'the backup is the file as it was');
  const saved=fs.readFileSync(file),check=hive(saved);assert.equal(check.errors+check.severe+check.warnings,0,check.findings.map(f=>f.message).join(' | '));
  assert.deepEqual(fs.readdirSync(out).filter(n=>/\.mdx$/i.test(n)).sort(),['Broken.mdx','Broken_backup.mdx'],'no other files are written');
  // A later save in the same session saves straight away, with no second backup.
  await p.getByRole('navigation',{name:'Optimization stages'}).getByRole('button',{name:'Sphereomancer',exact:true}).click();
  await p.waitForFunction(()=>!!document.querySelector('.ox-savings strong'));await p.getByRole('button',{name:'Approve',exact:true}).click();
  await p.getByRole('button',{name:'Save',exact:true}).click();await p.waitForFunction(()=>/Saved Broken\.mdx\./.test(document.body.textContent)&&!document.querySelector('[role=dialog]'));
  assert.equal(fs.readdirSync(out).filter(n=>/_backup.*.mdx$/i.test(n)).length,1);assert.ok(openDocument(new Uint8Array(fs.readFileSync(file)),'x.mdx').model.CollisionShapes.length>0,'the second save includes the spheres');
  await p.screenshot({path:path.join(out,'04-saved.png')});
  // Commit returns to the editor with the approved state applied, without saving.
  // Back undoes the spheres, so the committed model differs from the saved file.
  const onDisk=fs.readFileSync(file);await p.getByRole('button',{name:'Back',exact:true}).click();
  assert.equal(await p.getByRole('button',{name:'Commit',exact:true}).isEnabled(),true);
  const closed=p.waitForEvent('close');await p.getByRole('button',{name:'Commit',exact:true}).click();await closed;
  assert.deepEqual(fs.readFileSync(file),onDisk,'Commit does not save the file');
  await main.getByText('OptimizeXL',{exact:true}).first().waitFor();
  await main.screenshot({path:path.join(out,'05-committed-in-editor.png')});
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,packaged:!!exe,before:[before.errors,before.severe,before.warnings],after:[check.errors,check.severe,check.warnings]},null,1));
  console.log('optimizexl-workflow passed',out);
 }finally{
  // Commit leaves the model modified, so a normal close would ask to save.
  await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
