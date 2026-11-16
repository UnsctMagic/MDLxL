const { launchApp, closeApp, clickMenu, waitForInfo } = require('./helpers/app.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
// Every slider's − and +: a click moves one step, holding repeats, and each press is one Undo.
// Real mouse presses on the packaged app: an EMTR slider (edit opened on press) and a Settings slider (live).
(async()=>{
 const root=process.cwd(),out=path.join(root,'out','slider-steps','run-'+Date.now());fs.mkdirSync(out,{recursive:true});
 const {createNode,openDocument}=await import('../src/editor-document.js'),{createStarterDocument}=await import('../src/starter-model.js');
 const doc=createStarterDocument();doc.apply('Add emitter',['Nodes','PivotPoints'],m=>{createNode(m,'ParticleEmitter2');});
 const fixture=path.join(out,'TEST SLIDER STEPS 01.mdx'),bytes=Buffer.from(doc.serialize('mdx'));fs.writeFileSync(fixture,bytes);
 const id=openDocument(bytes).model.ParticleEmitters2[0].ObjectId;
 let app;const errors=[],sleep=ms=>new Promise(r=>setTimeout(r,ms));
 try{
  const launched=await launchApp({ out, fixture, errors, timeout: 60000, bounds: { x: -3000, y: 0, width: 1400, height: 920 }, show: 'inactive', pageTimeout: 15000 });app=launched.app;const page=launched.page;page.on('pageerror',e=>errors.push(e.stack||e.message));
  await waitForInfo(page,'Opened TEST SLIDER STEPS 01.mdx');
  await clickMenu(app,'Particle Editor…');await page.getByLabel('Particle context',{exact:true}).waitFor();
  if(await page.getByRole('button',{name:'Close Particle Library',exact:true}).count())await page.getByRole('button',{name:'Close Particle Library',exact:true}).click();
  await page.getByLabel('Particle context',{exact:true}).selectOption('On model');await page.getByLabel('Effect ingredient',{exact:true}).selectOption(String(id));
  await page.getByRole('button',{name:'Motion',exact:true}).click();
  const slider=page.getByRole('slider',{name:'Aim X',exact:true});await slider.waitFor({timeout:5000});
  const up=page.getByRole('button',{name:'One step up Aim X',exact:true}),down=page.getByRole('button',{name:'One step down Aim X',exact:true});
  const value=async()=>Number(await slider.inputValue());
  const undo=()=>page.locator('.pe-toolbar').getByRole('button',{name:'Undo',exact:true}).click();
  // The − and + sit on the slider's two ends, inside the slider's own row.
  const [s,u,d]=await Promise.all([slider,up,down].map(l=>l.boundingBox()));
  assert.ok(d.x+d.width<=s.x+1&&u.x>=s.x+s.width-1,'− left of the slider, + right of it');
  assert.ok(u.height<=18&&u.width<=16,'the buttons stay small');
  await page.screenshot({path:path.join(out,'emtr-slider-steps.png')});
  const start=await value();
  await up.click();await sleep(150);const one=await value();
  assert.ok(one>start,`+ moved the slider (${start} → ${one})`);
  await down.click();await sleep(150);assert.ok(Math.abs(await value()-start)<1e-6,'− moves back the same step');
  await up.click();await sleep(150);
  await undo();await sleep(200);assert.ok(Math.abs(await value()-start)<1e-6,'one Undo takes back one + press');
  const box=await up.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  await page.mouse.down();await sleep(1100);await page.mouse.up();await sleep(150);
  const held=await value(),step=one-start;
  assert.ok(held-start>step*4,`holding + repeats (${start} → ${held}, step ${step})`);
  await undo();await sleep(200);assert.ok(Math.abs(await value()-start)<1e-6,'one Undo takes back the whole hold');
  // A live slider without an edit gesture: Settings → Mouse.
  await page.getByRole('button',{name:'Close',exact:true}).last().click().catch(()=>{});await clickMenu(app,'Mouse and general…');const wheel=page.getByRole('slider',{name:'Mouse wheel sensitivity',exact:true});
  await page.getByText('Wheel',{exact:true}).click();
  await wheel.waitFor({timeout:5000});const before=Number(await wheel.inputValue());
  await page.getByRole('button',{name:'One step down Mouse wheel sensitivity',exact:true}).click();await sleep(150);
  assert.ok(Math.abs(Number(await wheel.inputValue())-(before-0.01))<1e-6,'Settings slider moves one step of 0.01');
  await page.getByRole('button',{name:'One step up Mouse wheel sensitivity',exact:true}).click();await sleep(150);
  assert.ok(Math.abs(Number(await wheel.inputValue())-before)<1e-6,'and back');
  await page.screenshot({path:path.join(out,'settings-slider-steps.png')});
  assert.deepEqual(errors,[]);console.log('Slider − and +: one step per click, hold repeats, one Undo per press (EMTR and Settings)');
 }catch(error){if(app){const page=await app.firstWindow();console.error((await page.locator('body').innerText()).slice(-2500));await page.screenshot({path:path.join(out,'failure.png')});}throw error;}finally{if(app)await closeApp(app);}
})().catch(error=>{console.error(error);process.exit(1);});
