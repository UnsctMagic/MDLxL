const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const {launchApp, closeApp, stubDialogs} = require('./helpers/app.cjs');
const {click, orbit} = require('./helpers/library-browser.cjs');
const {fixturePath, gameFolder} = require('./helpers/fixtures.cjs');

(async () => {
  assert.equal(process.env.MDLXL_SUITE_HIDDEN, '1', 'Run on the hidden Windows desktop');
  const out = path.resolve(process.env.MDLXL_RIBBON_OUT || 'out/ribbon-attachment');
  await fs.mkdir(out, {recursive:true});
  const fixture = fixturePath('ribbon-attachment');
  const beforeBytes = await fs.readFile(fixture);
  const {openDocument} = await import('../src/editor-document.js');
  const original = openDocument(beforeBytes, fixture).model;
  const {CascReader} = require('../electron/casc.cjs');
  const {decodeDds} = await import('../src/dds.js');
  const {decodeBlp2} = await import('../src/blp2.js');
  const {decodeBLP, getBLPImageData} = await import('war3-model');
  const {app, page, errors} = await launchApp({fixture, out, args:['--use-angle=d3d11-warp','--disable-gpu-vsync','--disable-frame-rate-limit'], show:'inactive', settings:{gameData:await gameFolder()}, bounds:{x:0,y:0,width:1600,height:1000}});
  const hit = async locator => { await locator.scrollIntoViewIfNeeded(); await click(page,locator); };
  const button = name => page.getByRole('button', {name, exact:true});
  const state = () => page.evaluate(() => {
    const doc = mdlxlProbe().session.doc;
    return {model:JSON.parse(JSON.stringify(doc.model)),undo:doc.historyStats.undoSteps};
  });
  try {
    await page.waitForFunction(name => mdlxlProbe().session?.path?.endsWith(name), path.basename(fixture));
    const originalState = await state();
    await hit(page.locator('.classic-geosets').getByRole('button',{name:'Clear',exact:true}));
    await hit(page.getByLabel('Select geoset 25',{exact:true}));
    if(await page.getByLabel('Show all geosets',{exact:true}).isChecked()) await hit(page.getByLabel('Show all geosets',{exact:true}));
    await hit(page.locator('.viewport'));
    await page.keyboard.press('Control+A');
    await page.waitForFunction(() => /222 verts\s*·\s*222 sel/.test(document.body.innerText));
    await hit(button('Emitter Editor'));
    await hit(button('Add ribbon'));
    const choices = page.locator('.pe-ribbon-sequences input');
    await hit(choices.nth(0));
    await hit(choices.nth(7));
    const beforeCreate = await state();
    await hit(button('Create'));
    await page.getByLabel('Ribbon upper end',{exact:true}).waitFor();
    const animation = page.getByLabel('Particle preview animation',{exact:true});
    await hit(animation);
    await page.keyboard.press('Home');
    for(let i=0;i<7;i++) await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => {
      const n=mdlxlProbe('.pe-preview .game-preview-root').runtime?.native;
      return n?.getSequence()===7 && n.ribbonsController.emitters.at(-1)?.creationTimes.length>10;
    });
    await hit(button('Pause'));
    await page.waitForFunction(() => mdlxlProbe('.pe-preview .game-preview-root').runtime?.captureApi?.isReady);
    const created = await state(), ribbon = created.model.RibbonEmitters.at(-1);
    assert.equal(created.undo,beforeCreate.undo+1,'Create is one undo step');
    for(const field of ['Geosets','Bones','Sequences']) assert.deepEqual(created.model[field],originalState.model[field],field+' unchanged');
    assert.equal(created.model.Nodes[ribbon.Parent].Name,'Bone_Weapon');
    const runtime = await page.evaluate(id => {
      const n=mdlxlProbe('.pe-preview .game-preview-root').runtime.native;
      const e=n.ribbonsController.emitters.find(e=>e.props.ObjectId===id),count=e.creationTimes.length;
      return {uv:Array.from(e.texCoords.subarray((count-1)*4,count*4)),vertices:Array.from(e.vertices.subarray((count-1)*6,count*6)),matrix:Array.from(n.rendererData.nodes[id].matrix),frame:n.getFrame()};
    },ribbon.ObjectId);
    const texture=created.model.Textures[created.model.Materials[ribbon.MaterialID].Layers[0].TextureID].Image;
    const reader=new CascReader(await gameFolder(),process.cwd());let bytes;
    try{bytes=await reader.read(texture);}finally{reader.close();}
    assert.ok(bytes,'Real game ribbon image resolves');
    const tag=bytes.subarray(0,4).toString();
    const image=tag==='DDS '?decodeDds(bytes):tag==='BLP2'?decodeBlp2(bytes):getBLPImageData(decodeBLP(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)),0);
    const spanAt=u=>{
      const x=Math.min(image.width-1,Math.max(0,Math.round(u*(image.width-1))));let span=0;
      for(let y=0;y<image.height;y++){const i=(y*image.width+x)*4;if(Math.max(...image.data.subarray(i,i+3))*image.data[i+3]/255>32)span++;}
      return span/image.height;
    };
    const headWidth=spanAt(runtime.uv[0]),tailWidth=spanAt(1);
    await page.screenshot({path:path.join(out,'ribbon-attachment.png')});
    assert.ok(headWidth>.75,`Newest ribbon edge must be bright across most of its width; got ${(headWidth*100).toFixed(1)}% from ${texture}`);
    assert.ok(tailWidth<.1,'Old trail fades to darkness');
    assert.ok(runtime.vertices.every(Number.isFinite),'Visible trail geometry is finite');
    await orbit(page,page.locator('.pe-preview'));
    const output=process.env.MDLXL_RIBBON_SAVE;
    if(output){
      await hit(button('Close'));
      await page.getByRole('dialog',{name:'Particle Editor',exact:true}).waitFor({state:'hidden'});
      await stubDialogs(app,{save:path.resolve(output)});
      await page.keyboard.press('F12');
      await hit(button('Save MDX…'));
      await page.waitForFunction(output => mdlxlProbe().session?.path===output && !mdlxlProbe().session.doc.dirty,path.resolve(output));
      const saved=openDocument(await fs.readFile(output),output).model;
      assert.equal(saved.Textures[saved.Materials[saved.RibbonEmitters.at(-1).MaterialID].Layers[0].TextureID].Image,texture);
      for(const field of ['Geosets','Bones','Sequences']) assert.deepEqual(saved[field],original[field],field+' preserved on disk');
    }
    assert.deepEqual(await fs.readFile(fixture),beforeBytes,'Input model unchanged');
    assert.deepEqual(errors,[]);
    await fs.writeFile(path.join(out,'result.json'),JSON.stringify({passed:true,texture,headWidth,tailWidth,frame:runtime.frame,cameraMouseRotation:true},null,2));
    console.log(JSON.stringify({passed:true,texture,headWidth,tailWidth,out}));
  } catch(error) { console.error((await page.locator('body').innerText()).slice(-6500)); await page.screenshot({path:path.join(out,'failure.png')}); throw error; } finally { await closeApp(app); }
})().catch(error=>{console.error(error);process.exitCode=1;});
