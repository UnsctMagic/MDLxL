const { launchApp, closeApp, settle: settlePage } = require('./helpers/app.cjs');
// Right-click Uncouple, Nuke checkbox, real mouse on the built app: node test/uncouple-nuke.electron.cjs
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const out = path.resolve('out/uncouple-nuke'); fs.mkdirSync(out, {recursive:true});
  const {createStarterDocument} = await import('../src/starter-model.js');
  const fixture=path.join(out,'uncouple-nuke.mdx');fs.writeFileSync(fixture,Buffer.from(createStarterDocument().serialize('mdx')));
  const errors=[];
  const { app, page } = await launchApp({ out, profile: path.join(out,'profile-'+Date.now()), env: { MDLVIS_HEADLESS:'1' }, timeout: 60000, fixture, errors, pageTimeout: 10000, bounds: { x: -3000, y: 0, width: 1280, height: 920 }, show: 'inactive' });
  try {
    await page.locator('[aria-label="3D model viewport"] canvas').first().waitFor({timeout:60000});
    await page.waitForFunction(()=>document.querySelector('.classic-counts')?.textContent.includes('Vertices:'));
    await page.evaluate(()=>{
      window.viewportState=()=>{
        const host=document.querySelector('[aria-label="3D model viewport"]');
        const value = findFiberState(host, value => value?.renderer&&value?.entries); if (value?.renderer&&value?.entries) return value;
        throw Error('Viewport runtime not found');
      };
      window.points=()=>Array.from(viewportState().entries[0].geoset.Vertices);
    });
    await page.waitForFunction(()=>{try{return viewportState().entries.filter(Boolean).length>=1;}catch{return false;}});
    const idle=()=>settlePage(page, 200);
    const button=page.locator('[data-hotkey="Uncouple"]'), checkbox=page.locator('.classic-context input[type=checkbox]');
    const spots=v=>new Set(Array.from({length:v.length/3},(_,i)=>v.slice(i*3,i*3+3).map(n=>n.toFixed(3)).join(',')));
    const rightClick=async()=>{const box=await button.boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2,{button:'right'});await idle();};
    const clickAway=async()=>{const box=await page.locator('.classic-status').boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);await idle();};
    const viewportButton=await page.locator('.classic-context').count();
    assert.equal(viewportButton,0,'the option stays out of the way until asked for');
    assert.match(await button.getAttribute('title'),/Right-click/,'the button says the option exists');

    // Nothing is selected yet, so the button is greyed out; the option still opens.
    assert.equal(await button.isDisabled(),true,'Uncouple starts disabled');
    await rightClick();
    assert.equal(await checkbox.isChecked(),true,'Nuke is on by default');
    await page.screenshot({path:path.join(out,'menu.png')});
    await clickAway();
    assert.equal(await checkbox.count(),0,'clicking elsewhere dismisses it');

    const before=await page.evaluate(()=>points());
    await page.locator('[data-hotkey="select"]').click();await idle();
    await page.keyboard.press('Control+a');await idle();

    // Nuke on: copies are pulled off the original spots.
    await button.click();await idle();
    const nuked=await page.evaluate(()=>points());
    assert.ok(nuked.length>before.length,'Uncouple adds vertices');
    assert.ok([...spots(nuked)].some(spot=>!spots(before).has(spot)),'Nuke on moves corners');
    await page.keyboard.press('Control+z');await idle();
    assert.deepEqual(await page.evaluate(()=>points()),before,'one undo step');

    // Nuke off, from the button's own right-click; the tick stays visible until dismissed.
    await rightClick();
    await checkbox.click();await idle();
    assert.equal(await checkbox.isChecked(),false,'Nuke turns off');
    await clickAway();
    await page.keyboard.press('Control+a');await idle();
    await button.click();await idle();
    const kept=await page.evaluate(()=>points());
    assert.equal(kept.length,nuked.length,'the same vertices are separated');
    assert.deepEqual([...spots(kept)].sort(),[...spots(before)].sort(),'every copy stays on an original spot');
    await page.keyboard.press('Control+z');await idle();

    // The U key uses the same choice, and the choice is remembered.
    await page.keyboard.press('Control+a');await idle();
    await page.keyboard.press('u');await idle();
    const byKey=await page.evaluate(()=>points());
    assert.equal(byKey.length,nuked.length,'U separates');
    assert.deepEqual([...spots(byKey)].sort(),[...spots(before)].sort(),'U respects Nuke off');
    await rightClick();
    assert.equal(await checkbox.isChecked(),false,'the choice is remembered');
    await clickAway();
    assert.deepEqual(errors,[]);
    console.log('PASS uncouple nuke: right-click opens the checkbox even when greyed out, on by default, off keeps every copy in place, U matches, one undo, remembered');
  } catch(error) {
    console.error(error);
    try{await (await app.firstWindow()).screenshot({path:path.join(out,'failure.png')});}catch{}
    throw error;
  } finally {await closeApp(app);}
})().catch(e=>{console.error(e);process.exitCode=1;});
