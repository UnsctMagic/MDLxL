// Real owner model; run only through the hidden packaged suite.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {fixturePath}=require('./helpers/fixtures.cjs');
const {launchApp,prepareWindow,closeApp,appTarget}=require('./helpers/app.cjs');
(async()=>{
 const {openDocument}=await import('../src/editor-document.js');
 const {sampleGeosetAnimation}=await import('../src/animation.js');
 const out=path.resolve(process.env.MDLXL_OPTIMIZEXL_PROOF_ROOT||'out','exact-cleanup-ui');fs.mkdirSync(out,{recursive:true});
 const sourcePath=fixturePath('optimizexl-exact-unit'),source=fs.readFileSync(sourcePath),copy=path.join(out,'Champion.mdx');fs.writeFileSync(copy,source);
 const {app,errors}=await launchApp({fixture:copy,out,pageTimeout:15000});let p;
 try{
  const main=await app.firstWindow();await main.getByTitle(/^OptimizeXL(\nHotkey: .+)?$/).waitFor({timeout:60000});
  const pending=app.waitForEvent('window');await main.getByTitle(/^OptimizeXL(\nHotkey: .+)?$/).click();p=await pending;
  await prepareWindow(app,p,{bounds:{x:-3500,y:0,width:1500,height:950},errors,pageTimeout:15000});
  await p.getByRole('heading',{name:'Insanity FIxer',exact:true}).waitFor();
  await p.getByLabel('Proposed fix',{exact:true}).selectOption({label:'Remove exact redundancy'});
  const ready=()=>p.waitForFunction(()=>document.querySelector('.ox-savings strong')&&!document.querySelector('.ox-savings').textContent.includes('Updating'));
  await ready();
  const sides=()=>p.evaluate(()=>Array.from(document.querySelectorAll('.ox-preview .game-preview-root'),el=>mdlxlProbe(el).props.model));
  let [before,after]=await sides();assert.equal(before.Geosets[4].Faces.length/3,59);assert.equal(after.Geosets[4].Faces.length/3,47,'the twelve permanently collapsed triangles disappear');
  const original=openDocument(source,'source.mdx').model;
  for(const si of [-1,...original.Sequences.map((_,i)=>i)])for(const gi of [8,34]){const frame=si<0?0:original.Sequences[si].Interval[0];assert.deepEqual(sampleGeosetAnimation(after,gi,frame,si),sampleGeosetAnimation(original,gi,frame,si),'animated and unanimated RGB tint survives');}
  const roots=[p.locator('[aria-label="Before preview"] .game-preview-root'),p.locator('[aria-label="After preview"] .game-preview-root')];
  const camera=root=>root.evaluate(el=>mdlxlProbe(el).runtime.controls.object.position.toArray());
  for(let side=0;side<2;side++){
   const previous=await camera(roots[side]),box=await roots[side].locator('[data-clean-model-canvas]').boundingBox();
   await p.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await p.mouse.down();await p.mouse.move(box.x+box.width*.7,box.y+box.height*.56,{steps:12});await p.mouse.up();
   await p.waitForFunction(({previous,side})=>mdlxlProbe(document.querySelectorAll('.ox-preview .game-preview-root')[side]).runtime.controls.object.position.toArray().some((v,i)=>Math.abs(v-previous[i])>.1),{previous,side});
   const a=await camera(roots[0]),b=await camera(roots[1]);a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<1e-6));
  }
  const selection=p.locator('.ox-fix-selection');await selection.locator('summary').click();await selection.getByRole('checkbox',{name:'Select Remove exact redundancy',exact:true}).check();
  await p.getByRole('button',{name:'Preview all selected fixes',exact:true}).click();await ready();
  await p.getByRole('button',{name:'Approve selected',exact:true}).click();await p.getByRole('button',{name:'Back',exact:true}).click();await ready();
  [before,after]=await sides();assert.equal(before.Geosets[4].Faces.length/3,59,'Before remains original after Back');assert.equal(after.Geosets[4].Faces.length/3,47,'Back restores the exact preview');
  await p.screenshot({path:path.join(out,'exact-cleanup.png')});
  await p.getByRole('button',{name:'Approve selected',exact:true}).click();await p.getByRole('button',{name:'Save',exact:true}).click();
  await p.getByRole('dialog',{name:'Save changes'}).waitFor();await p.getByRole('button',{name:'Save without backup',exact:true}).click();await p.getByText(/^Saved Champion\.mdx\./).waitFor();
  const saved=fs.readFileSync(copy),model=openDocument(saved,'saved.mdx').model;assert.ok(saved.length<source.length);assert.equal(model.Geosets[4].Faces.length/3,47);
  assert.deepEqual(fs.readFileSync(sourcePath),source);assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,packaged:appTarget().packaged,before:source.length,after:saved.length,saved:source.length-saved.length,collapsedTriangles:12,colorPreserved:true,pairedMouseRotation:true,selectedApproval:true,back:true,save:true,sourceUnchanged:true,errors},null,2));
  console.log('optimizexl-exact-cleanup passed');
 }catch(error){if(p&&!p.isClosed())await p.screenshot({path:path.join(out,'failed.png')});throw error;}
 finally{await closeApp(app);}
})().catch(error=>{console.error(error);process.exitCode=1;});
