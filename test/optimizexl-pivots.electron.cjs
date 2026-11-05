// Real Standard Bearer with one unused trailing pivot. Drive the existing
// preview/approval, Back, Fix everything, Save and editor Undo with user input.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { fixturePath } = require('./helpers/fixtures.cjs');
const { launchApp, prepareWindow, closeApp } = require('./helpers/app.cjs');
(async () => {
  const { openDocument } = await import('../src/editor-document.js');
  const { generateCompatibleMdx } = await import('../src/mdx-compatibility.js');
  const { parseMdx } = await import('../src/mdx-container.js');
  const { sanityTest } = await import('./helpers/hive.mjs');
  const { flattenHiveFindings } = await import('../app/optimizexl-hive.js');
  const original = fs.readFileSync(fixturePath('optimizexl-pivots'));
  const m = openDocument(original, 'standard.mdx').model, expected = m.PivotPoints.length;
  m.PivotPoints.push(new Float32Array([17, 29, 43]));
  const broken = Buffer.from(generateCompatibleMdx(m));
  const out = path.resolve(process.env.MDLXL_OPTIMIZEXL_PROOF_ROOT || 'out', 'pivot-warning');
  fs.mkdirSync(out, {recursive:true});
  const file = path.join(out, 'Pivot-warning.mdx'); fs.writeFileSync(file, broken);
  const warning = `Expected ${expected} pivot points, got ${expected + 1}`;
  const { app, page: main, errors } = await launchApp({fixture:file, out, pageTimeout:20000});
  try {
    await main.getByTitle(/^OptimizeXL(\nHotkey: .+)?$/).waitFor();
    // Match the reported starting workflow: Animations, Stand.
    await main.getByRole('button',{name:'Animations',exact:true}).click();
    await main.getByLabel('Choose animation sequence',{exact:true}).selectOption({label:'Stand'});
    const pending = app.waitForEvent('window');
    await main.getByTitle(/^OptimizeXL(\nHotkey: .+)?$/).click();
    const p = await pending; await prepareWindow(app, p, {errors, pageTimeout:20000, bounds:{x:-3500,y:0,width:1600,height:1000}});
    await p.getByText(/^mdx-m3-viewer: \d+ errors/).waitFor();
    await p.getByText(/^Checker findings \(/).click();
    const finding = p.locator('li').filter({hasText:warning});
    await finding.waitFor();
    assert.equal(await finding.getByRole('button', {name:'Preview fix',exact:true}).count(), 1, 'the pivot warning offers Preview fix');
    await p.evaluate(() => {
      window.pivotViews = () => Array.from(document.querySelectorAll('.ox-preview .game-preview-root'), root => {
        const {runtime,props} = mdlxlProbe(root);
        return runtime && props ? {pivots:props.model.PivotPoints.length, camera:runtime.controls.object.position.toArray(), target:runtime.controls.target.toArray()} : null;
      });
    });
    await p.waitForFunction(() => pivotViews().length === 2 && pivotViews().every(Boolean));
    const cameraBefore = await p.evaluate(() => pivotViews()[0].camera);
    const box = await p.locator('[aria-label="Before preview"] [data-clean-model-canvas]').boundingBox();
    await p.mouse.move(box.x+box.width*.5,box.y+box.height*.5); await p.mouse.down();
    await p.mouse.move(box.x+box.width*.66,box.y+box.height*.55,{steps:12}); await p.mouse.up();
    await p.waitForFunction(before => pivotViews()[0].camera.some((v,i)=>Math.abs(v-before[i])>.1), cameraBefore);
    const rotated = await p.evaluate(() => pivotViews());
    rotated[0].camera.forEach((v,i)=>assert.ok(Math.abs(v-rotated[1].camera[i])<1e-8, 'mouse rotation stays linked'));
    await finding.getByRole('button',{name:'Preview fix',exact:true}).click();
    const preview = () => p.waitForFunction(expected => pivotViews()[0]?.pivots===expected+1 && pivotViews()[1]?.pivots===expected && !!document.querySelector('.ox-savings strong'), expected);
    await preview();
    assert.equal(await p.getByRole('button',{name:'Save',exact:true}).isDisabled(),true);
    assert.deepEqual(fs.readFileSync(file),broken,'preview does not write the file');
    (await p.evaluate(() => pivotViews())).forEach((s,side)=>s.camera.forEach((v,i)=>assert.ok(Math.abs(v-rotated[side].camera[i])<1e-8,'the pivot preview preserves the viewpoint')));
    await p.getByRole('button',{name:'Approve',exact:true}).click();
    await p.getByText(/^mdx-m3-viewer: 0 errors · 0 severe · 0 warnings/).waitFor();
    await p.waitForFunction(() => !!document.querySelector('.ox-savings strong'));
    // Approval selects the next existing finding (Portrait alpha keys on this
    // fixture), which deliberately uses its authored portrait camera.
    await p.getByRole('button',{name:'Back',exact:true}).click(); await finding.waitFor();
    await p.getByRole('button',{name:'Fix everything',exact:true}).click(); await preview();
    await p.getByRole('button',{name:'Approve all fixes',exact:true}).click();
    await p.getByText(/^mdx-m3-viewer: 0 errors · 0 severe · 0 warnings/).waitFor();
    const viewBeforeBack=await p.evaluate(()=>pivotViews());
    await p.getByRole('button',{name:'Back',exact:true}).click(); await finding.waitFor();
    assert.equal(await p.getByRole('button',{name:'Fix everything',exact:true}).getAttribute('aria-pressed'),'true','Back restores the combined repair preview');
    await preview();
    (await p.evaluate(()=>pivotViews())).forEach((s,side)=>s.camera.forEach((v,i)=>assert.ok(Math.abs(v-viewBeforeBack[side].camera[i])<1e-8,'Back from Fix everything keeps the camera')));
    // Save only the pivot repair so all unrelated bytes must survive exactly.
    await finding.getByRole('button',{name:'Preview fix',exact:true}).click(); await preview();
    await p.getByRole('button',{name:'Approve',exact:true}).click();
    await p.getByRole('button',{name:'Save',exact:true}).click();
    await p.getByRole('button',{name:'Back up, then save',exact:true}).click();
    await p.getByText(/^Saved Pivot-warning\.mdx\./).waitFor();
    const saved = fs.readFileSync(file);
    assert.equal(saved.length,broken.length-12);
    assert.deepEqual(fs.readFileSync(path.join(out,'Pivot-warning_backup.mdx')),broken);
    const chunks = bytes => parseMdx(bytes).chunks.filter(c=>c.tag!=='PIVT').map(c=>[c.tag,c.data]);
    assert.deepEqual(chunks(saved),chunks(broken),'all chunks except PIVT stay byte-identical');
    assert.equal(flattenHiveFindings(sanityTest(new Uint8Array(saved)).nodes).some(f=>/Expected \d+ pivot points/.test(f.message)),false);
    await p.screenshot({path:path.join(out,'approved.png')});
    const closed=p.waitForEvent('close');await p.getByRole('button',{name:'Close',exact:true}).click();await closed;
    await main.waitForFunction(expected=>__mdlxl.model()?.PivotPoints.length===expected,expected);
    await main.keyboard.press('Control+z');
    await main.waitForFunction(expected=>__mdlxl.model()?.PivotPoints.length===expected+1,expected);
    assert.deepEqual(fs.readFileSync(file),saved,'Undo affects the editor without rewriting the saved file');
    assert.deepEqual(fs.readFileSync(fixturePath('optimizexl-pivots')),original);
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,expected,preview:true,approve:true,back:true,fixEverything:true,save:true,backup:true,undo:true,linkedMouseRotation:true,otherChunksIdentical:true,errors},null,2));
    console.log('PASS pivot preview, approval, Back, Fix everything, Save, backup, Undo and linked mouse rotation');
  } finally {await closeApp(app);}
})().catch(error=>{console.error(error);process.exitCode=1;});
