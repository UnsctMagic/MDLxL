// Enter/leave applies a number; Escape restores it, including Settings and Showcase.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {launchApp,closeApp,clickMenu,settle}=require('./helpers/app.cjs');
(async()=>{
  const out=path.resolve('out/number-commit');fs.mkdirSync(out,{recursive:true});
  const {createDemoDocument}=await import('../src/editor-document.js');
  const fixture=path.join(out,'NumberFields.mdx');fs.writeFileSync(fixture,createDemoDocument().serialize('mdx'));
  const {app,page,errors}=await launchApp({out,fixture,settings:{preferences:{language:'en',theme:'light',scrollSensitivity:2.5,pointerSensitivity:1,updateOfferAnswered:true,modelLookAnswered:true}},show:'inactive',bounds:{x:0,y:0,width:1500,height:1000}});
  try{
    await page.locator('.classic-toolbar').waitFor();await settle(page,200);
    async function deferred(field,read,next,{blur=false}={}){
      const before=await read();await field.fill(String(next));await settle(page,100);
      assert.equal(await read(),before,'Typing must keep the previous value');
      await field.press('Escape');await settle(page,100);
      assert.equal(await read(),before,'Escape must keep the previous value');
      assert.equal(Number(await field.inputValue()),before,'Escape restores the displayed number');
      await field.fill(String(next));await settle(page,100);
      assert.equal(await read(),before,'Typing again must still wait');
      await field.press(blur?'Tab':'Enter');await settle(page,750);
      assert.equal(await read(),next,blur?'Leaving applies the number':'Enter applies the number');
    }
    await clickMenu(app,'Mouse and general…');await page.locator('[data-hotkey="tab:mouse"]').click();
    for(const[tab,id,key,next]of [['Wheel','sensitivity-value','scrollSensitivity',3.2],['Pointer','pointer-value','pointerSensitivity',1.3],['Rotation','rotation-sensitivity','rotation',1.2]]){
      await page.getByRole('button',{name:tab,exact:true}).click();
      const read=()=>page.evaluate(async key=>{const p=(await window.desktop.getSettings()).preferences;return key==='rotation'?p.rotation.sensitivity:p[key];},key);
      await deferred(page.locator(`[data-hotkey="mouse:${id}"]`),read,next,{blur:tab==='Pointer'});
      console.log('PASS Settings',tab);
    }
    await page.locator('.settings-window [data-hotkey="close"]').click();
    await page.getByRole('button',{name:'Showcase',exact:true}).first().click();
    await page.waitForFunction(()=>document.querySelector('.showcase-record')&&!document.querySelector('.showcase-record').disabled);
    await page.waitForFunction(()=>findFiberState('.showcase-workspace',v=>v?.travel&&v.undo)?.present);
    const state=()=>page.evaluate(()=>findFiberState('.showcase-workspace',v=>v?.travel&&v.undo,{current:true}).present);
    await deferred(page.getByLabel('Extra Time',{exact:true}),async()=>(await state()).sequenceExtraTime,-.25,{blur:true});
    await page.getByRole('region',{name:'Text',exact:true}).getByRole('button',{name:'Add',exact:true}).click();
    const layer=()=>page.evaluate(()=>findFiberProps('.showcase-layer-tools',p=>Array.isArray(p.layers)).layers.find(l=>l.kind==='text'));
    const size=page.getByLabel('Text size',{exact:true});await deferred(size,async()=>(await layer()).size,72);
    await page.keyboard.press('Control+z');await settle(page,100);assert.equal((await layer()).size,48);
    await page.keyboard.press('Control+y');await settle(page,100);assert.equal((await layer()).size,72);
    await page.locator('.showcase-text-fades summary').click();
    for(const[label,key,next]of [['Fade in start','fadeInStart',.2],['Fade in length','fadeInLength',.3],['Fade out start','fadeOutStart',.4],['Fade out length','fadeOutLength',.5]]){
      await deferred(page.getByLabel(label,{exact:true}),async()=>(await layer())[key],next,{blur:true});
    }
    console.log('PASS Showcase Extra Time, text size, Undo/Redo and fades');
    await page.locator('.showcase-list li').first().click();
    const loops=page.getByLabel('Loops',{exact:true});
    const draft=()=>page.evaluate(()=>findFiberState('.showcase-dialog',v=>typeof v?.durationLoops==='number'));
    await deferred(loops,async()=>(await draft()).durationLoops,2,{blur:true});
    await deferred(page.getByLabel('Animation Extra Time',{exact:true}),async()=>(await draft()).extraTime,-.1,{blur:true});
    await loops.fill('0');await loops.press('Tab');
    // Allow the form's existing validation message to run rather than HTML's min constraint.
    await page.locator('.showcase-dialog form').evaluate(form=>{form.noValidate=true;});
    await page.locator('.showcase-dialog').getByRole('button',{name:'OK',exact:true}).click();
    await page.getByRole('alert').filter({hasText:'Enter a whole number of loops, at least 1.'}).waitFor();
    await loops.fill('2');await loops.press('Enter');
    assert.equal((await draft()).durationLoops,2,'Enter applies Loops before OK');
    await page.locator('.showcase-dialog').getByRole('button',{name:'OK',exact:true}).click();
    await page.locator('.showcase-dialog').waitFor({state:'hidden'});
    assert.equal((await state()).sequencePlaylist[0].durationLoops,2);
    assert.equal((await state()).sequencePlaylist[0].extraTime,-.1);
    assert.deepEqual(errors,[]);console.log('PASS Loops keeps whole-number validation and negative animation Extra Time');
  }finally{await closeApp(app);}
})().catch(error=>{console.error(error);process.exitCode=1;});
