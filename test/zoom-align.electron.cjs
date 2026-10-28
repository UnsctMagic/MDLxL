// Zoom align with real mouse drags on the built bundle: node test/zoom-align.electron.cjs
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const out = path.resolve('out/zoom-align'); fs.mkdirSync(out, {recursive:true});
  const {createStarterDocument} = await import('../src/starter-model.js');
  const doc = createStarterDocument();
  // A slightly crooked box, like a surface that is not quite flat.
  doc.apply('Crooked test vertices', ['Geosets'], model => { model.Geosets[0].Vertices.set([17,29,43],0); model.Geosets[0].Vertices.set([-21,-8,30],3); });
  const fixture=path.join(out,'zoom-align.mdx');fs.writeFileSync(fixture,Buffer.from(doc.serialize('mdx')));
  const errors=[];
  const app=await _electron.launch({executablePath:path.resolve('node_modules/electron/dist/electron.exe'),args:['--disable-backgrounding-occluded-windows',process.cwd(),fixture],env:{...process.env,MDLVIS_HEADLESS:'1',MDLXL_PROFILE:path.join(out,'profile-'+Date.now())},timeout:60000});
  try {
    const page=await app.firstWindow();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
    await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.webContents.setBackgroundThrottling(false);w.setPosition(-3000,0);w.showInactive();});
    await page.locator('[aria-label="3D model viewport"] canvas').first().waitFor({timeout:60000});
    await page.waitForFunction(()=>document.querySelector('.classic-counts')?.textContent.includes('Vertices: 8'));
    // Read existing React runtime refs for assertions; no production test API.
    await page.evaluate(()=>{
      window.viewportState=()=>{
        const host=document.querySelector('[aria-label="3D model viewport"]');
        let fiber=host[Object.keys(host).find(key=>key.startsWith('__reactFiber'))];
        for(;fiber;fiber=fiber.return)for(let hook=fiber.memoizedState;hook;hook=hook.next){
          const value=hook.memoizedState?.current;if(value?.renderer&&value?.entries)return value;
        }
        throw Error('Viewport runtime not found');
      };
      window.vertexPoint=index=>{
        const state=viewportState(),p=state.controls.target.clone().fromBufferAttribute(state.entries[0].geometry.attributes.position,index).project(state.camera);
        const r=state.controls.domElement.getBoundingClientRect();return{x:r.x+(p.x+1)*r.width/2,y:r.y+(1-p.y)*r.height/2};
      };
      window.vertices=()=>Array.from(viewportState().entries[0].geoset.Vertices);
      window.eye=()=>viewportState().camera.position.toArray();
      // Counts overlay pixels near a vertex in a colour: pink align or green anchor.
      window.markerPixels=(index,[r,g,b])=>{
        const canvas=document.querySelector('canvas[data-anchor-overlay]');if(!canvas)return 0;
        const p=vertexPoint(index),rect=canvas.getBoundingClientRect(),scale=canvas.width/rect.width;
        const data=canvas.getContext('2d').getImageData(Math.round((p.x-rect.x-40)*scale),Math.round((p.y-rect.y-30)*scale),Math.round(80*scale),Math.round(30*scale)).data;
        let count=0;for(let i=0;i<data.length;i+=4)if(data[i+3]>200&&Math.abs(data[i]-r)<40&&Math.abs(data[i+1]-g)<40&&Math.abs(data[i+2]-b)<40)count++;return count;
      };
    });
    const idle=()=>page.waitForTimeout(200);
    await page.getByLabel('View direction',{exact:true}).selectOption('perspective');
    await page.locator('[data-hotkey="select"]').click();await idle();
    await page.keyboard.press('Control+a');await idle();
    await page.keyboard.press('z');await idle();
    const pick=async(key,index)=>{
      await page.keyboard.press(key);await idle();
      const p=await page.evaluate(i=>vertexPoint(i),index);
      await page.mouse.move(p.x-5,p.y-5);await page.mouse.down();await page.mouse.move(p.x+5,p.y+5,{steps:4});await page.mouse.up();await idle();
    };
    await pick('Shift+1',0);
    await page.waitForFunction(()=>document.body.innerText.includes('Align vertex selected.'));
    assert.ok(await page.evaluate(()=>markerPixels(0,[255,79,216]))>10,'pink ALIGN marker');
    assert.equal(await page.evaluate(()=>markerPixels(0,[57,255,20])),0,'no green marker for align');

    const before=await page.evaluate(()=>vertices()),eye=await page.evaluate(()=>eye());
    const distance=(v,i)=>Math.hypot(v[i*3]-eye[0],v[i*3+1]-eye[1],v[i*3+2]-eye[2]);
    const box=await page.locator('[aria-label="3D model viewport"] canvas').first().boundingBox();
    const start={x:box.x+box.width*.7,y:box.y+box.height*.8};
    const drag=async(dx,back=0)=>{await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x+dx,start.y,{steps:12});if(back)await page.mouse.move(start.x+dx+back,start.y,{steps:6});await page.mouse.up();await idle();};
    // Half way, then back out within the same drag: nothing changes.
    await drag(-50,50);
    assert.deepEqual(await page.evaluate(()=>vertices()),before,'reversing within the drag undoes the pull');
    // Past fully lined up: stops there.
    await drag(-300);
    const after=await page.evaluate(()=>vertices());
    const target=await page.evaluate(()=>vertexPoint(0));
    for(let i=0;i<8;i++){
      const p=await page.evaluate(index=>vertexPoint(index),i);
      assert.ok(Math.hypot(p.x-target.x,p.y-target.y)<.5,`vertex ${i} hides behind the align vertex (${p.x},${p.y} vs ${target.x},${target.y})`);
      assert.ok(Math.abs(distance(after,i)-distance(before,i))<1e-3,`vertex ${i} keeps its distance from the eye`);
    }
    assert.deepEqual(after.slice(0,3),before.slice(0,3),'the align vertex stays put');
    // Once released, align cannot push outward.
    await drag(250);
    assert.deepEqual(await page.evaluate(()=>vertices()),after,'dragging outward does nothing');
    await page.keyboard.press('Control+z');await idle();
    assert.deepEqual(await page.evaluate(()=>vertices()),before,'one undo step');
    // Anchor (1) replaces align and keeps its green marker and normal zoom.
    await pick('1',0);
    await page.waitForFunction(()=>document.body.innerText.includes('Anchor vertex selected.'));
    assert.ok(await page.evaluate(()=>markerPixels(0,[57,255,20]))>10,'green ANCHOR marker');
    assert.equal(await page.evaluate(()=>markerPixels(0,[255,79,216])),0,'anchor replaced align');
    await drag(-50);
    const zoomed=await page.evaluate(()=>vertices());
    for(let i=1;i<8;i++)for(let a=0;a<3;a++)assert.ok(Math.abs(zoomed[i*3+a]-(before[a]+(before[i*3+a]-before[a])*.5))<1e-3,'anchor zoom scales toward the anchor');
    await page.screenshot({path:path.join(out,'anchor.png')});
    assert.deepEqual(errors,[]);
    console.log('PASS zoom align: pink marker, lined up from the eye, distances kept, stops at lined up, inward only, one undo, anchor still zooms');
  } catch(error) {
    console.error(error);
    try{await (await app.firstWindow()).screenshot({path:path.join(out,'failure.png')});}catch{}
    throw error;
  } finally {await app.evaluate(({app})=>app.exit(0));}
})().catch(e=>{console.error(e);process.exitCode=1;});
