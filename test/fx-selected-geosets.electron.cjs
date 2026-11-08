// FX with several geosets checked: real clicks. The effect is fitted to them as one surface; the geosets stay separate.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {root,launchApp,closeApp}=require('./helpers/app.cjs'),{fixturePath}=require('./helpers/fixtures.cjs');
const {selectOption}=require('./helpers/fx-input.cjs');
(async()=>{
 const out=path.join(root,'out/fx-selected-geosets');fs.mkdirSync(out,{recursive:true});
 const {app,page,errors}=await launchApp({fixture:fixturePath('citadel-footman'),out,bounds:{x:0,y:0,width:1450,height:960}});
 try{
  const fx=page.getByRole('dialog',{name:'Surface Effects',exact:true});
  const ready=()=>page.waitForFunction(()=>{const p=mdlxlProbe('.sfx-stage .game-preview-root');return p?.runtime?.captureApi.isReady&&p.runtime.particleSourceModel===p.props.model&&!document.querySelector('.sfx-apply')?.disabled;},null,{timeout:60000});
  const overlays=()=>page.evaluate(()=>mdlxlProbe('.sfx-stage .game-preview-root').props.model.Geosets.filter(g=>g._FxTag?.endsWith('/shape')).map(g=>g.Vertices.length/3));
  const source=()=>page.evaluate(()=>JSON.stringify(mdlxlProbe().session.doc.model));
  await page.locator('[data-hotkey="vertices"]').waitFor();
  const {counts,total}=await page.evaluate(()=>{const c=__mdlxl.model().Geosets.map(g=>g.Vertices.length/3);return {counts:c,total:c.reduce((a,b)=>a+b,0)};});
  assert.ok(counts.length>1,'the fixture has several geosets');
  await page.getByRole('button',{name:'All',exact:true}).first().click();
  const before=await source();
  await page.getByRole('button',{name:'Surface Effects',exact:true}).click();await fx.waitFor();await ready();
  const target=fx.getByLabel('Geoset',{exact:true});
  assert.equal(await target.locator('option:checked').textContent(),'Selected geosets ('+counts.length+')','several checked geosets start combined');
  await fx.getByLabel('Find a surface effect').fill('Flaming sword');await fx.getByRole('button',{name:'Flaming sword global animation',exact:true}).click();await ready();
  let sizes=await overlays();assert.ok(sizes.length>0);for(const size of sizes)assert.equal(size,total,'one overlay covers every selected geoset');
  const overlay=fx.getByRole('checkbox',{name:'Create as overlay',exact:true});assert.equal(await overlay.isChecked(),true);assert.equal(await overlay.isDisabled(),true);
  const box=await fx.locator('.sfx-stage').boundingBox(),camera=()=>page.evaluate(()=>mdlxlProbe('.sfx-stage .game-preview-root').runtime.controls.object.position.toArray()),start=await camera();
  await page.mouse.move(box.x+box.width*.8,box.y+box.height*.25);await page.mouse.down();await page.mouse.move(box.x+box.width*.8+50,box.y+box.height*.25+24,{steps:8});await page.mouse.up();
  await page.waitForFunction(start=>mdlxlProbe('.sfx-stage .game-preview-root').runtime.controls.object.position.toArray().some((v,i)=>Math.abs(v-start[i])>.001),start);
  const single=await target.locator('option').nth(1).textContent();await selectOption(page,target,single);await ready();
  sizes=await overlays();for(const size of sizes)assert.equal(size,counts[0],'one geoset fits only that geoset');assert.equal(await overlay.isDisabled(),false);
  await selectOption(page,target,'Selected geosets ('+counts.length+')');await ready();
  sizes=await overlays();for(const size of sizes)assert.equal(size,total);
  await page.screenshot({path:path.join(out,'combined.png')});
  await fx.getByRole('button',{name:'Apply effect',exact:true}).click();await fx.waitFor({state:'hidden'});
  const applied=await page.evaluate(()=>{const m=__mdlxl.model();return {shapes:m.Geosets.filter(g=>g._FxTag?.endsWith('/shape')).map(g=>g.Vertices.length/3),originals:m.Geosets.filter(g=>!g._FxTag).map(g=>g.Vertices.length/3)};});
  assert.deepEqual(applied.originals,counts,'the selected geosets stay separate');for(const size of applied.shapes)assert.equal(size,total);
  const revision=await page.evaluate(()=>mdlxlProbe().session.doc.revision);await page.keyboard.press('Control+z');await page.waitForFunction(r=>mdlxlProbe().session.doc.revision!==r,revision);
  assert.deepEqual(JSON.parse(await source()),JSON.parse(before),'one Undo restores the model');
  assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,counts,total}));
 }catch(error){await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw error;}
 finally{await closeApp(app);}
})().catch(error=>{console.error(error);process.exitCode=1;});
