const { launchApp, closeApp, settle: settlePage } = require('./helpers/app.cjs');
// Resize with Ctrl held, with real mouse drags on the built bundle: node test/resize-spread.electron.cjs
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const out = path.resolve('out/resize-spread'); fs.mkdirSync(out, {recursive:true});
  const {createStarterDocument} = await import('../src/starter-model.js');
  const doc = createStarterDocument();
  // Two identical boxes side by side, one per geoset.
  doc.apply('Second box', ['Geosets'], model => {
    const copy = structuredClone(model.Geosets[0]);
    for (let i = 0; i < copy.Vertices.length; i += 3) copy.Vertices[i] += 120;
    model.Geosets.push(copy);
  });
  const fixture=path.join(out,'resize-spread.mdx');fs.writeFileSync(fixture,Buffer.from(doc.serialize('mdx')));
  const errors=[];
  const { app, page } = await launchApp({ out, profile: path.join(out,'profile-'+Date.now()), env: { MDLVIS_HEADLESS:'1' }, timeout: 60000, fixture, errors, pageTimeout: 10000, bounds: { x: -3000, y: 0, width: 1280, height: 920 }, show: 'inactive' });
  try {
    await page.locator('[aria-label="3D model viewport"] canvas').first().waitFor({timeout:60000});
    await page.waitForFunction(()=>document.querySelector('.classic-counts')?.textContent.includes('Vertices:'));
    // Read existing React runtime refs for assertions; no production test API.
    await page.evaluate(()=>{
      window.viewportState=()=>{
        const host=document.querySelector('[aria-label="3D model viewport"]');
        const value = findFiberState(host, value => value?.renderer&&value?.entries); if (value?.renderer&&value?.entries) return value;
        throw Error('Viewport runtime not found');
      };
      window.boxes=()=>viewportState().entries.slice(0,2).map(entry=>Array.from(entry.geoset.Vertices));
    });
    await page.waitForFunction(()=>{try{return viewportState().entries.filter(Boolean).length>=2;}catch{return false;}});
    const idle=()=>settlePage(page, 200);
    await page.getByLabel('View direction',{exact:true}).selectOption('perspective');
    // Hold both boxes: tick the second geoset too.
    await page.getByLabel('Select geoset 1',{exact:true}).check();await idle();
    await page.locator('[data-hotkey="select"]').click();await idle();
    await page.keyboard.press('Control+a');await idle();
    await page.keyboard.press('z');await idle();
    const title=await page.locator('[data-hotkey="scale"]').getAttribute('title');
    assert.match(title,/Hold Ctrl while dragging/,'Resize tooltip explains Ctrl');

    const before=await page.evaluate(()=>boxes());
    const box=await page.locator('[aria-label="3D model viewport"] canvas').first().boundingBox();
    const start={x:box.x+box.width*.7,y:box.y+box.height*.8};
    const center=v=>[0,1,2].map(a=>{let lo=Infinity,hi=-Infinity;for(let i=a;i<v.length;i+=3){lo=Math.min(lo,v[i]);hi=Math.max(hi,v[i]);}return (lo+hi)/2;});
    const shape=v=>{const c=center(v);return v.map((value,i)=>value-c[i%3]);};
    const close=(a,b,message)=>a.forEach((value,i)=>assert.ok(Math.abs(value-b[i])<1e-3,`${message} (${i}: ${value} vs ${b[i]})`));
    // Start dragging, then hold Ctrl, and pull all the way in.
    await page.mouse.move(start.x,start.y);await page.mouse.down();
    await page.mouse.move(start.x-20,start.y,{steps:4});
    await page.keyboard.down('Control');
    await page.mouse.move(start.x-400,start.y,{steps:12});
    await page.mouse.up();await page.keyboard.up('Control');await idle();
    const together=await page.evaluate(()=>boxes());
    close(shape(together[0]),shape(before[0]),'box 1 keeps its size');
    close(shape(together[1]),shape(before[1]),'box 2 keeps its size');
    close(together[0],together[1],'matching boxes sit exactly on top of each other');
    const middle=center([...before[0],...before[1]]);
    close(center(together[0]),middle,'they meet in the middle');
    await page.screenshot({path:path.join(out,'together.png')});

    await page.keyboard.press('Control+z');await idle();
    close((await page.evaluate(()=>boxes())).flat(),before.flat(),'one undo step');

    // Pushing apart doubles the gap and still keeps both sizes.
    await page.mouse.move(start.x,start.y);await page.mouse.down();
    await page.mouse.move(start.x+5,start.y,{steps:2});
    await page.keyboard.down('Control');
    await page.mouse.move(start.x+100,start.y,{steps:10});
    await page.mouse.up();await page.keyboard.up('Control');await idle();
    const apart=await page.evaluate(()=>boxes());
    close(shape(apart[0]),shape(before[0]),'box 1 keeps its size apart');
    const gap=v=>center(v[1])[0]-center(v[0])[0];
    assert.ok(gap(apart)>gap(before)*1.5,`gap grows (${gap(before)} → ${gap(apart)})`);
    await page.keyboard.press('Control+z');await idle();

    // Without Ctrl, Resize still resizes.
    await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x-50,start.y,{steps:10});await page.mouse.up();await idle();
    const resized=await page.evaluate(()=>boxes());
    const width=v=>{let lo=Infinity,hi=-Infinity;for(let i=0;i<v.length;i+=3){lo=Math.min(lo,v[i]);hi=Math.max(hi,v[i]);}return hi-lo;};
    assert.ok(width(resized[0])<width(before[0])*.9,'plain Resize still shrinks');
    assert.deepEqual(errors,[]);
    console.log('PASS resize spread: Ctrl moves both boxes together at full size until they overlap, apart too, one undo, plain Resize unchanged');
  } catch(error) {
    console.error(error);
    try{await (await app.firstWindow()).screenshot({path:path.join(out,'failure.png')});}catch{}
    throw error;
  } finally {await closeApp(app);}
})().catch(e=>{console.error(e);process.exitCode=1;});
