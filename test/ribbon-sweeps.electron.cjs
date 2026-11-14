// Add ribbon > Sweep: choosing an element adds the ribbon plus ordinary emitters along the weapon.
// Real clicks and keys on the real Knight; the test hook only loads the model and reads state.
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const {launchApp, closeApp} = require('./helpers/app.cjs');
const {click, orbit} = require('./helpers/library-browser.cjs');
const {fixturePath, gameFolder} = require('./helpers/fixtures.cjs');

const SWEEPS = ['Plain','Fire','Frost','Lightning','Spirit','Fel','Shadow','Holy','Arcane','Blood'];
(async () => {
  assert.equal(process.env.MDLXL_SUITE_HIDDEN, '1', 'Run on the hidden Windows desktop');
  const out = path.resolve(process.env.MDLXL_RIBBON_SWEEPS_OUT || 'out/ribbon-sweeps');
  await fs.mkdir(out, {recursive:true});
  const fixture = fixturePath('ribbon-attachment'), beforeBytes = await fs.readFile(fixture);
  const {app, page, errors} = await launchApp({fixture, out, args:['--use-angle=d3d11-warp','--disable-gpu-vsync','--disable-frame-rate-limit'], show:'inactive', settings:{gameData:await gameFolder()}, bounds:{x:0,y:0,width:1600,height:1000}});
  const hit = async locator => { await locator.scrollIntoViewIfNeeded(); await click(page,locator); };
  const button = name => page.getByRole('button', {name, exact:true});
  const state = () => page.evaluate(() => { const doc = mdlxlProbe().session.doc; return {model:JSON.parse(JSON.stringify(doc.model)),undo:doc.historyStats.undoSteps}; });
  const preview = () => page.evaluate(() => {
    const n = mdlxlProbe('.pe-preview .game-preview-root').runtime?.native; if (!n) return null;
    return {sequence:n.getSequence(), emitters:n.model.ParticleEmitters2.map(e => e.Name), ribbons:n.model.RibbonEmitters.map(e => e.Name),
      live:Object.fromEntries(n.particlesController.emitters.map(e => [e.props.Name, e.particles.filter(p => p.lifeSpan > 0).length]))};
  });
  const sweep = page.getByLabel('Sweep', {exact:true});
  // The choice is a normal list: click it, then arrow to the name and confirm.
  const choose = async name => {
    await hit(sweep); await page.keyboard.press('Home');
    for (let i = 0; i < SWEEPS.indexOf(name); i++) await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.waitForFunction(name => document.querySelector('.pe-placement select[aria-label="Sweep"]')?.selectedOptions[0]?.textContent === name, name);
  };
  try {
    await page.waitForFunction(name => mdlxlProbe().session?.path?.endsWith(name), path.basename(fixture));
    const original = await state();
    await hit(page.locator('.classic-geosets').getByRole('button',{name:'Clear',exact:true}));
    await hit(page.getByLabel('Select geoset 25',{exact:true}));
    if (await page.getByLabel('Show all geosets',{exact:true}).isChecked()) await hit(page.getByLabel('Show all geosets',{exact:true}));
    await hit(page.locator('.viewport'));
    await page.keyboard.press('Control+A');
    await page.waitForFunction(() => /222 verts\s*·\s*222 sel/.test(document.body.innerText));
    await hit(button('Emitter Editor'));
    await hit(button('Add ribbon'));
    await sweep.waitFor();
    assert.deepEqual(await sweep.locator('option').allTextContents(), SWEEPS, 'The choice lists Plain and the elements by name');
    assert.equal(await sweep.inputValue(), 'plain', 'Plain is the default');
    const boxes = page.locator('.pe-ribbon-sequences input');
    await hit(boxes.nth(0)); await hit(boxes.nth(7));
    await page.waitForFunction(() => mdlxlProbe('.pe-preview .game-preview-root').runtime?.native?.getSequence() === 7);
    const plain = await preview(), own = plain.emitters.length;
    assert.equal(plain.ribbons.at(-1), 'Weapon ribbon');

    // Choosing an element shows it at once in the same preview, before anything is created.
    await choose('Fire');
    await page.waitForFunction(() => { const n = mdlxlProbe('.pe-preview .game-preview-root').runtime?.native; return n?.model.ParticleEmitters2.filter(e => e.Name.startsWith('Fire sweep')).length === 2 && n.particlesController.emitters.filter(e => e.props.Name.startsWith('Fire sweep')).every(e => e.particles.some(p => p.lifeSpan > 0)); }, null, {timeout:30000});
    assert.equal((await preview()).ribbons.at(-1), 'Fire sweep');
    assert.deepEqual((await state()).model, original.model, 'Choosing a sweep changes nothing in the model yet');
    await page.screenshot({path:path.join(out,'fire-choice.png')});
    // Changing the choice replaces the earlier one.
    await choose('Frost');
    await page.waitForFunction(() => { const names = mdlxlProbe('.pe-preview .game-preview-root').runtime?.native?.model.ParticleEmitters2.map(e => e.Name) || []; return names.some(n => n.startsWith('Frost sweep')) && !names.some(n => n.startsWith('Fire sweep')); }, null, {timeout:30000});
    assert.equal((await preview()).emitters.length, own + 2);
    // The mouse still turns the camera while choosing.
    await orbit(page, page.locator('.pe-preview'));

    const beforeCreate = await state();
    await hit(button('Create'));
    await page.getByLabel('Ribbon upper end',{exact:true}).waitFor();
    const created = await state(), model = created.model;
    assert.equal(created.undo, beforeCreate.undo + 1, 'Create is one undo step');
    for (const field of ['Geosets','Bones','Sequences']) assert.deepEqual(model[field], original.model[field], field + ' unchanged');
    assert.equal(model.RibbonEmitters.length, original.model.RibbonEmitters.length + 1);
    const ribbon = model.RibbonEmitters.at(-1), added = model.ParticleEmitters2.filter(e => e.Name.startsWith('Frost sweep'));
    assert.equal(ribbon.Name, 'Frost sweep'); assert.equal(added.length, 2);
    assert.equal(model.ParticleEmitters2.length, original.model.ParticleEmitters2.length + 2);
    for (const node of [ribbon, ...added]) {
      assert.equal(model.Nodes[node.Parent].Name, 'Bone_Weapon', node.Name + ' rides the weapon bone');
      assert.deepEqual(node.Visibility, ribbon.Visibility, node.Name + ' shows with the ribbon');
    }
    for (const emitter of added) assert.match(model.Textures[emitter.TextureID].Image, /^Textures\\/, 'Stock game picture');
    assert.equal(model.Textures.filter(t => !original.model.Textures.some(o => o.Image === t.Image)).every(t => /^Textures\\/.test(t.Image)), true, 'Only stock game pictures were added');

    // Every part is an ordinary ingredient: pick an emitter and its usual controls appear.
    const ingredient = page.getByLabel('Effect ingredient',{exact:true});
    const options = await ingredient.locator('option').allTextContents();
    for (const emitter of added) assert.ok(options.some(text => text.includes(emitter.Name)), emitter.Name + ' is listed');
    const pick = async id => { const values = await ingredient.locator('option').evaluateAll(list => list.map(o => o.value)); await hit(ingredient); await page.keyboard.press('Home'); for (let i = 0; i < values.indexOf(String(id)); i++) await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); };
    await pick(added[0].ObjectId);
    await page.locator('.pe-tool-tabs').getByRole('button',{name:'Look',exact:true}).waitFor();
    await pick(ribbon.ObjectId);
    await page.getByLabel('Ribbon upper end',{exact:true}).waitFor();

    // In the checked attack the swing leaves real particles behind.
    const animation = page.getByLabel('Particle preview animation',{exact:true});
    await hit(animation); await page.keyboard.press('Home');
    for (let i = 0; i < 7; i++) await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => { const n = mdlxlProbe('.pe-preview .game-preview-root').runtime?.native; return n?.getSequence() === 7 && n.particlesController.emitters.filter(e => e.props.Name.startsWith('Frost sweep')).every(e => e.particles.some(p => p.lifeSpan > 0)) && n.ribbonsController.emitters.at(-1)?.creationTimes.length > 5; }, null, {timeout:30000});
    await page.screenshot({path:path.join(out,'frost-created.png')});
    await orbit(page, page.locator('.pe-preview'));

    // Ctrl+Z takes the whole sweep away again.
    await hit(page.locator('.pe-toolbar').getByRole('button',{name:'Undo',exact:true}));
    await page.waitForFunction(count => mdlxlProbe().session.doc.model.RibbonEmitters.length === count, original.model.RibbonEmitters.length);
    assert.deepEqual((await state()).model, beforeCreate.model, 'Undo removes the ribbon and its emitters');

    // Esc leaves the choice without touching the model.
    await hit(button('Add ribbon')); await sweep.waitFor(); await choose('Blood');
    await page.keyboard.press('Escape'); await sweep.waitFor({state:'hidden'});
    assert.deepEqual((await state()).model, beforeCreate.model, 'Escape cancels');
    assert.deepEqual(await fs.readFile(fixture), beforeBytes, 'Input model unchanged');
    assert.deepEqual(errors, []);
    await fs.writeFile(path.join(out,'result.json'), JSON.stringify({passed:true,sweeps:SWEEPS,added:added.map(e => e.Name),cameraMouseRotation:true}, null, 2));
    console.log(JSON.stringify({passed:true,out}));
  } catch (error) { console.error((await page.locator('body').innerText()).slice(-3000)); await page.screenshot({path:path.join(out,'failure.png')}).catch(() => {}); throw error; } finally { await closeApp(app); }
})().catch(error => { console.error(error); process.exitCode = 1; });
