const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {root,launchApp,closeApp,stubDialogs}=require('./helpers/app.cjs');const {testModel}=require('./helpers/fixtures.cjs');
(async()=>{
 const {GLOBAL_LOOKS}=await import('../src/global-animation-looks.js'),{fxData}=await import('../src/global-animation-data.js'),{openDocument}=await import('../src/editor-document.js');
 const out=path.join(root,'out/visual-effects-save');fs.mkdirSync(out,{recursive:true});
 const targets=[['WH_WOC_WarriorSlaaneshDual01.mdx',28,26],['optimizexl-diagnostics/WH_WOC_WarriorKhorneGW02.mdx',18,12],['surface-effects/WH_WOC_WarriorNurgle02.mdx',19,8]];
 const {app,page,errors}=await launchApp({out,fixture:testModel(targets[0][0]),bounds:{x:0,y:0,width:1450,height:960}}),fx=page.getByRole('dialog',{name:'Surface Effects',exact:true});
 const ready=()=>page.waitForFunction(()=>{const e=document.querySelector('.sfx-stage .game-preview-root');if(!e)return false;const p=mdlxlProbe(e);return p.runtime?.captureApi.isReady&&p.runtime.particleSourceModel===p.props.model&&!document.querySelector('.sfx-apply')?.disabled;},null,{timeout:60000});
 const read=()=>page.evaluate(()=>JSON.parse(JSON.stringify(mdlxlProbe().session.doc.model,(k,v)=>ArrayBuffer.isView(v)?Array.from(v):v)));
 const open=async file=>{await stubDialogs(app,{open:file});await page.keyboard.press('Control+o');await page.waitForFunction(n=>mdlxlProbe().session?.path?.endsWith(n),path.basename(file));};
 const save=async file=>{await stubDialogs(app,{save:file});await page.keyboard.press('F12');await page.getByRole('button',{name:'Save '+path.extname(file).slice(1).toUpperCase()+'…',exact:true}).click();await page.getByRole('dialog',{name:'Save model',exact:true}).getByRole('button',{name:'Save',exact:true}).click();await page.getByRole('dialog',{name:'Save model',exact:true}).waitFor({state:'hidden'});await page.waitForFunction(n=>mdlxlProbe().session.path?.endsWith(n),path.basename(file));assert.ok(fs.statSync(file).size>1000);};
 const results=[];
 try{
  await stubDialogs(app,{message:1});
  for(const [i,look] of GLOBAL_LOOKS.entries()){
   const [fixture,weapon,body]=targets[i%targets.length],part=look.group==='Blades'||look.impact?weapon:body;await open(testModel(fixture));const original=await read();
   await page.getByRole('button',{name:'Surface Effects',exact:true}).click();await ready();await fx.getByLabel('Geoset',{exact:true}).selectOption(String(part));await fx.getByLabel('Find a surface effect').fill(look.name);await fx.getByRole('button',{name:look.name+(look.impact?' impact':' global animation'),exact:true}).click();await ready();await fx.getByRole('button',{name:'Apply effect',exact:true}).click();await fx.waitFor({state:'hidden'});
   const after=await read(),files=[];assert.equal(after.Geosets[part]._FxStack.look,look.id);assert.deepEqual(after.Sequences,original.Sequences);
   for(const ext of ['mdx','mdl']){const file=path.join(out,look.id+'.'+ext);await save(file);files.push(file);const parsed=openDocument(fs.readFileSync(file),file).model;assert.equal(parsed.Geosets[part]._FxStack.look,look.id);assert.deepEqual(fxData(parsed),fxData(openDocument(fs.readFileSync(files[0]),files[0]).model));}
   await page.keyboard.press('Control+z');await page.waitForFunction(part=>!mdlxlProbe().session.doc.model.Geosets[part]._FxStack,part);assert.deepEqual(await read(),original,look.name+' restores every original model field in one Undo');
   for(const file of files){await open(file);const reopened=await read();assert.equal(reopened.Geosets[part]._FxStack.look,look.id);const baseline=openDocument(openDocument(fs.readFileSync(testModel(fixture)),fixture).serialize(path.extname(file).slice(1)),file).model;assert.deepEqual(reopened.Sequences,JSON.parse(JSON.stringify(baseline.Sequences,(k,v)=>ArrayBuffer.isView(v)?Array.from(v):v)));for(const key of ['Geosets','ParticleEmitters2','RibbonEmitters','EventObjects'])assert.equal(reopened[key].length,after[key].length,key+' count survives '+file);
    await page.getByRole('button',{name:'Surface Effects',exact:true}).click();await ready();await fx.getByLabel('Geoset',{exact:true}).selectOption(String(part));await ready();assert.equal(await fx.getByRole('button',{name:look.name+(look.impact?' impact':' global animation'),exact:true}).getAttribute('aria-pressed'),'true');await fx.getByRole('button',{name:'Cancel',exact:true}).click();
   }
   results.push({look:look.name,model:fixture,part:part+1,mdx:true,mdl:true,undo:true,reedit:true});fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(results,null,2));for(const file of files)fs.unlinkSync(file);console.log('PASS',look.name,'MDX + MDL reopen/re-edit + exact Undo');
  }assert.deepEqual(errors,[]);console.log('TOTAL',results.length,'looks;',results.length*2,'round trips; 0 failures; 0 skips');
 }catch(e){await page.screenshot({path:path.join(out,'failure.png')});console.error((await page.locator('body').innerText()).slice(-1300));throw e;}finally{await closeApp(app);}
})().catch(e=>{console.error(e);process.exitCode=1;});
