// Run against the rebuilt portable app with MDLXL_EXE; all fixtures/profiles use D:.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');
const { buildSync } = require('esbuild');
(async () => {
  const root = process.cwd(), out = path.resolve(process.env.MDLXL_OBJECT_TEST_OUT || 'out/object-types');
  fs.mkdirSync(out, { recursive: true });
  const profile = path.join(out, 'profile'), fixture = path.join(out, 'object-types.mdx');
  const { createStarterDocument } = await import('../src/starter-model.js');
  const { createNode } = await import('../src/editor-document.js');
  const { BUILT_IN_VIEWPORT_PRESETS: presets } = await import('../src/viewport-appearance.js');
  const doc = createStarterDocument();
  const helper = createNode(doc.model, 'Helper'), ref = createNode(doc.model, 'Attachment');
  helper.Name = 'Test Helper'; ref.Name = 'Test Ref';
  for (const [node, pivot] of [[helper, [0,-70,20]], [ref, [0,70,20]]]) {
    node.PivotPoint = new Float32Array(pivot); doc.model.PivotPoints[node.ObjectId] = node.PivotPoint;
  }
  const original = Buffer.from(doc.serialize('mdx')); fs.writeFileSync(fixture, original);
  const audit = buildSync({ stdin: { contents: `export { projectMovementNodes } from './app/movement-overlay.js'; export { markerStyle } from './app/rig-markers-gl.js'; export { visibleMovementPoints, previewOverlayOptions } from './app/preview-overlays.js';`, resolveDir: root }, bundle: true, format: 'iife', globalName: 'rigAudit', write: false }).outputFiles[0].text;
  const errors = [], result = { palettes: [], drags: [] };
  let app, page;
  const launch = async () => {
    const exe = process.env.MDLXL_EXE;
    app = await _electron.launch({ executablePath: exe || path.resolve('node_modules/electron/dist/electron.exe'), args: exe ? [fixture, '--disable-backgrounding-occluded-windows'] : [root, fixture, '--disable-backgrounding-occluded-windows'], env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: profile }, timeout: 60000 });
    page = await app.firstWindow(); page.setDefaultTimeout(20000); page.on('pageerror', e => errors.push(e.message));
    await app.evaluate(({ BrowserWindow }) => { const w=BrowserWindow.getAllWindows()[0]; w.setSize(1600,1000); w.setPosition(-3000,0); w.webContents.setBackgroundThrottling(false); w.showInactive(); });
    await page.locator('[data-hotkey="bones"]').first().click();
    await page.getByLabel('Bones controller', { exact: true }).waitFor();
    await page.evaluate(audit);
    await page.evaluate(() => {
      window.rigState = () => {
        const host = document.querySelector('.game-preview-root'); let runtime, props;
        for (let fiber=host?.[Object.keys(host).find(k=>k.startsWith('__reactFiber'))]; fiber; fiber=fiber.return) {
          // The shared latest-props ref stays current across React's alternate fibers.
          for (let hook=fiber.memoizedState; hook; hook=hook.next) { const v=hook.memoizedState?.current; if (v?.native && v?.controls) runtime=v; if (v?.model && v?.overlays && v?.onSelectNodes) props=v; }
        }
        if (!runtime || !props) throw Error('Rig runtime not ready'); return { runtime, props };
      };
      window.objectWorld = id => { const node=rigState().runtime.native.rendererData.nodes.find(n=>n?.node.ObjectId===id), m=node.matrix, [x,y,z]=node.node.PivotPoint; return [0,1,2].map(i=>m[i]*x+m[4+i]*y+m[8+i]*z+m[12+i]); };
      window.objectScreen = id => { const camera=rigState().runtime.controls.object, point=camera.position.clone().fromArray(objectWorld(id)).project(camera), box=document.querySelector('[data-clean-model-canvas]').getBoundingClientRect(); return { x: box.x+(point.x+1)*box.width/2, y: box.y+(1-point.y)*box.height/2 }; };
      window.objectColors = () => { const {props:p,runtime:r}=rigState(), camera=r.controls.object, nodes=rigAudit.projectMovementNodes(p.model,0,-1,camera,1000,800), byId=new Map(nodes.map(n=>[n.node.ObjectId,n])); return nodes.map(n=>({id:n.node.ObjectId, color:rigAudit.markerStyle(n,byId,p.preferences,undefined,p.vanilla).color})); };
    });
    await page.waitForFunction(() => { try { return !!rigState().runtime.captureApi?.isReady; } catch { return false; } });
  };
  const close = async () => { if(app){ await app.evaluate(({app})=>app.exit(0)).catch(()=>{}); await app.close().catch(()=>{}); app=null; } };
  const idle = () => page.waitForTimeout(220);
  const checks = () => page.locator('.movement-object-filters input').evaluateAll(es=>es.map(e=>e.checked));
  const menu = command => app.evaluate(({BrowserWindow},c)=>BrowserWindow.getAllWindows()[0].webContents.send('menu',c),command);
  const settings = async tab => { await menu('appearanceSettings'); await page.locator('.settings-appearance-nav').getByRole('button',{name:tab,exact:true}).click(); };
  const done = () => page.getByRole('button',{name:'Done',exact:true}).click();
  const drag = async id => {
    await page.getByRole('group',{name:'Bones tools',exact:true}).getByRole('button',{name:'Move',exact:true}).click();
    await page.getByLabel('Workplane',{exact:true}).uncheck(); await idle();
    const before=await page.evaluate(id=>({world:objectWorld(id), screen:objectScreen(id)}),id);
    await page.mouse.move(before.screen.x,before.screen.y); await page.mouse.down(); await page.mouse.move(before.screen.x+42,before.screen.y-24,{steps:8}); await page.mouse.up(); await idle();
    const after=await page.evaluate(id=>objectWorld(id),id);
    assert.ok(after.some((v,i)=>Math.abs(v-before.world[i])>1e-3),'object '+id+' moved');
    assert.equal(await page.getByLabel('Movement bone or node',{exact:true}).inputValue(),String(id),'mouse selected object');
    await page.evaluate(()=>document.activeElement?.blur()); await page.keyboard.press('Control+z'); await idle();
    const undo=await page.evaluate(id=>objectWorld(id),id); assert.ok(undo.every((v,i)=>Math.abs(v-before.world[i])<1e-3),'undo restores object '+id);
    result.drags.push({id,before:before.world,after,undo});
  };
  try {
    await launch();
    assert.deepEqual(await checks(),[true,false,false]);
    const order = await page.evaluate(() => {
      const y = selector => document.querySelector(selector).getBoundingClientRect().top;
      return [y('.movement-object-combo'),y('.movement-object-filters'),y('.movement-list-selection')];
    });
    assert.ok(order[0] < order[1] && order[1] < order[2], 'filters sit below the dropdown and above Multiselect');
    const refCount = await page.evaluate(() => rigState().props.model.Attachments.length);
    await page.getByRole('button',{name:'Create',exact:true}).click();
    await page.getByRole('menuitem',{name:'Ref',exact:true}).click(); await idle();
    assert.equal(await page.evaluate(() => rigState().props.model.Attachments.length),refCount+1,'Create Ref adds an actual attachment');
    assert.equal(await page.getByLabel('Selected object name',{exact:true}).inputValue(),'New Ref');
    assert.equal((await checks())[2],true,'new ref is visible without an extra toggle');
    await page.evaluate(()=>document.activeElement?.blur()); await page.keyboard.press('Control+z'); await idle();
    assert.equal(await page.evaluate(() => rigState().props.model.Attachments.length),refCount,'Undo removes the created ref');
    await page.locator('.movement-object-filters').getByLabel('Refs',{exact:true}).uncheck();
    await page.getByLabel('Movement bone or node',{exact:true}).selectOption(String(ref.ObjectId)); await idle();
    const textStyles = await page.evaluate(id => {
      const picker = document.querySelector('.movement-object-picker'), input=document.querySelector('[aria-label="Selected object name"]'), option=[...picker.options].find(o=>o.value===String(id));
      const read = e => ({ color:getComputedStyle(e).color, stroke:getComputedStyle(e).webkitTextStrokeColor, width:getComputedStyle(e).webkitTextStrokeWidth });
      const colored=document.createElement('span'),plain=document.createElement('span'); colored.style.color='#00ff00';plain.style.color='#16191e';colored.textContent=plain.textContent='Outline'; document.body.append(colored,plain);
      const dynamic={colored:read(colored),plain:read(plain)};colored.remove();plain.remove();
      return {input:read(input),option:read(option),filters:[...document.querySelectorAll('.movement-object-filters label')].map(read),arrow:{color:getComputedStyle(picker).color,appearance:getComputedStyle(picker).appearance,background:getComputedStyle(picker).backgroundImage},otherSelects:[...document.querySelectorAll('select')].filter(e=>e!==picker).map(e=>({appearance:getComputedStyle(e).appearance,background:getComputedStyle(e).backgroundImage})),dynamic};
    },ref.ObjectId);
    assert.equal(textStyles.input.color,'rgb(190, 24, 93)'); assert.equal(textStyles.option.color,textStyles.input.color);
    assert.deepEqual(textStyles.filters.map(s=>s.color),['rgb(22, 101, 52)','rgb(107, 33, 168)','rgb(190, 24, 93)'],'option 1 text colors');
    assert.ok([...textStyles.filters,textStyles.input,textStyles.option].every(s=>parseFloat(s.width)===.2),'option 1 fine outline');
    assert.ok(['rgb(0, 0, 0)','color(srgb 0 0 0)'].includes(textStyles.input.stroke)); assert.ok(['rgb(0, 0, 0)','color(srgb 0 0 0)'].includes(textStyles.option.stroke)); assert.ok(parseFloat(textStyles.option.width)>0);
    assert.equal(textStyles.arrow.color,'rgb(0, 0, 0)','the original small object-picker arrow is black');
    assert.notEqual(textStyles.arrow.appearance,'base-select','object picker retains its normal native rendering');
    assert.equal(textStyles.arrow.background,'none','object picker has no drawn background arrows');
    assert.ok(textStyles.otherSelects.every(s=>s.appearance!=='base-select' && s.background==='none'),'all other dropdowns retain their native rendering without background arrows');
    assert.ok(['rgb(0, 0, 0)','color(srgb 0 0 0)'].includes(textStyles.dynamic.colored.stroke)); assert.ok(['rgba(0, 0, 0, 0)','color(srgb 0 0 0 / 0)'].includes(textStyles.dynamic.plain.stroke),'neutral text is unchanged');
    await page.getByLabel('Movement bone or node',{exact:true}).click(); await idle();
    await page.screenshot({path:path.join(out,'outlined-dropdown.png')}); await page.keyboard.press('Escape');
    result.textStyles=textStyles;

    const rows=await page.locator('.movement-object-filters label').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().top));
    assert.ok(Math.max(...rows)-Math.min(...rows)<1,'all three controls occupy one row');
    await page.getByLabel('View direction',{exact:true}).selectOption('front'); await idle();
    await page.locator('.movement-object-filters').getByLabel('Helpers',{exact:true}).check();
    await page.locator('.movement-object-filters').getByLabel('Refs',{exact:true}).check(); await idle();
    await drag(ref.ObjectId); await drag(helper.ObjectId);
    await page.keyboard.press('Escape');
    await page.locator('.movement-object-filters').getByLabel('Bones',{exact:true}).uncheck();
    await page.locator('.movement-object-filters').getByLabel('Refs',{exact:true}).uncheck();
    await page.keyboard.press('Escape'); await idle(); await drag(helper.ObjectId);
    await page.locator('.movement-object-filters').getByLabel('Bones',{exact:true}).check();
    await page.locator('.movement-object-filters').getByLabel('Refs',{exact:true}).check();
    await page.getByLabel('Movement bone or node',{exact:true}).selectOption(String(ref.ObjectId));
    await page.getByLabel('X coordinate',{exact:true}).fill('12'); await page.getByLabel('X coordinate',{exact:true}).press('Enter'); await idle();
    assert.ok(Math.abs((await page.evaluate(id=>objectWorld(id),ref.ObjectId))[0]-12)<1e-3,'typed ref coordinate edits live pivot');
    await page.evaluate(()=>document.activeElement?.blur()); await page.keyboard.press('Control+z'); await idle();
    const beforeRotation=await page.evaluate(()=>rigState().runtime.controls.object.quaternion.toArray());
    const canvas=await page.locator('[data-clean-model-canvas]').boundingBox();
    await page.mouse.move(canvas.x+canvas.width*.6,canvas.y+canvas.height*.6); await page.keyboard.down('Alt'); await page.mouse.down(); await page.mouse.move(canvas.x+canvas.width*.6+90,canvas.y+canvas.height*.6+60,{steps:8}); await page.mouse.up(); await page.keyboard.up('Alt'); await idle();
    assert.notDeepEqual(await page.evaluate(()=>rigState().runtime.controls.object.quaternion.toArray()),beforeRotation,'normal Alt+drag rotates the camera');
    await page.keyboard.press('Escape');
    for(const preset of Object.values(presets)) {
      await settings('Presets'); await page.getByLabel('Viewport appearance preset',{exact:true}).selectOption(preset.id); await done(); await idle();
      const colors=await page.evaluate(()=>objectColors());
      assert.equal(colors.find(c=>c.id===helper.ObjectId).color,preset.appearance.bones.helper,preset.name+' helper');
      assert.equal(colors.find(c=>c.id===ref.ObjectId).color,preset.appearance.bones.ref,preset.name+' ref');
      assert.deepEqual(await page.locator('.movement-object-filters label').evaluateAll(es=>es.map(e=>e.style.color)),[preset.appearance.tree.nodes.bone,preset.appearance.tree.nodes.helper,preset.appearance.tree.nodes.attachment].map(hex=>'rgb('+[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)).join(', ')+')'),preset.name+' text palette');
      result.palettes.push({name:preset.name,colors});
      if(['mdlvis-vanilla','blender-style'].includes(preset.id))await page.screenshot({path:path.join(out,preset.id==='mdlvis-vanilla'?'lordaeron.png':'blackrock.png')});
    }
    await settings('Bones & skeleton');
    await page.getByLabel('Bones Helpers',{exact:true}).fill('#b940ff'); await page.getByLabel('Bones Refs',{exact:true}).fill('#ff22aa');
    await page.locator('.settings-appearance-nav').getByRole('button',{name:'Lists & folders',exact:true}).click();
    await page.getByLabel('Node Bones',{exact:true}).fill('#1b6837'); await page.getByLabel('Node Helpers',{exact:true}).fill('#7123ad'); await page.getByLabel('Node Attachments',{exact:true}).fill('#c11964');
    await page.locator('.settings-appearance-nav').getByRole('button',{name:'Presets',exact:true}).click();
    await page.getByLabel('Custom viewport preset name').fill('Object colors test'); await page.getByRole('button',{name:'Save as custom preset',exact:true}).click();
    const custom=await page.getByLabel('Viewport appearance preset').inputValue();
    await page.getByLabel('Viewport appearance preset').selectOption('blender-style'); await page.getByLabel('Viewport appearance preset').selectOption(custom); await done(); await idle();
    assert.equal((await page.evaluate(()=>objectColors())).find(c=>c.id===ref.ObjectId).color,'#ff22aa');
    await page.locator('.movement-object-filters').getByLabel('Bones',{exact:true}).uncheck();
    await page.locator('.vis-toggle').click(); await idle(); assert.equal(await page.locator('.movement-object-filters').count(),0,'VIS hides the row');
    let vis=await page.evaluate(()=>rigState().props.overlays); assert.deepEqual([vis.bones,vis.helpers,vis.attachments],[true,true,true]);
    await drag(ref.ObjectId);
    await page.locator('.quick-display').getByRole('button',{name:'Clear',exact:true}).click(); await idle();
    vis=await page.evaluate(()=>rigState().props.overlays); assert.deepEqual([vis.bones,vis.helpers,vis.attachments],[true,true,true],'VIS keeps all three enabled');
    await page.locator('.vis-toggle').click(); await idle(); assert.deepEqual(await checks(),[false,true,true],'XL choices survive VIS switch');
    await close(); await launch(); assert.deepEqual(await checks(),[false,true,true],'object choices persist after app reopen');
    const restored=await page.evaluate(()=>objectColors()); assert.equal(restored.find(c=>c.id===helper.ObjectId).color,'#b940ff'); assert.equal(restored.find(c=>c.id===ref.ObjectId).color,'#ff22aa');
    assert.deepEqual(await page.locator('.movement-object-filters label').evaluateAll(es=>es.map(e=>getComputedStyle(e).color)),['rgb(27, 104, 55)','rgb(113, 35, 173)','rgb(193, 25, 100)'],'custom text colors persist after reopen');
    assert.deepEqual(fs.readFileSync(fixture),original,'fixture bytes unchanged'); assert.deepEqual(errors,[]);
    result.pass=true; fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2)); console.log('PASS object row, ref/helper mouse moves, typed coordinates, undo, all palettes, custom colors, VIS, app reopen and camera rotation');
  } finally { await close(); fs.rmSync(profile,{recursive:true,force:true}); fs.rmSync(fixture,{force:true}); }
})().catch(error=>{console.error(error);process.exitCode=1;});
