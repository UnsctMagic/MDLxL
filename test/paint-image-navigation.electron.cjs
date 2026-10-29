// Real wheel and mouse gestures against the packaged Paint and Forge image views.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {launchApp,closeApp,clickMenu,settle}=require('./helpers/app.cjs');
const {fixturePath}=require('./helpers/fixtures.cjs');
(async()=>{
  const out=path.resolve('out/paint-image-navigation');
  const {app,page,errors}=await launchApp({fixture:fixturePath('citadel-footman'),out,settings:{preferences:{scrollSensitivity:1,cameraBindings:{right:'pan',middle:'pan'}}}});
  try{
    const wheel=async(selector,delta=-100)=>{const b=await page.locator(selector).boundingBox();await page.mouse.move(b.x+b.width*.6,b.y+b.height*.5);await page.mouse.wheel(0,delta);await settle(page);};
    const width=selector=>page.locator(selector).evaluate(el=>el.getBoundingClientRect().width);
    const mouseSettings=async({speed,mode,button}={})=>{
      await clickMenu(app,'Mouse and general\u2026');const d=page.getByRole('dialog',{name:'Settings',exact:true});await d.getByRole('tab',{name:'Mouse',exact:true}).click();
      if(button){await d.getByRole('button',{name:'Camera',exact:true}).click();await d.getByLabel('Right mouse camera action').selectOption(button);}
      if(speed||mode){await d.getByRole('button',{name:'Wheel',exact:true}).click();if(speed)await d.getByLabel('Mouse wheel sensitivity value',{exact:true}).fill(String(speed));if(mode)await d.locator('[data-hotkey="mouse:wheel:'+mode+'"]').click();}
      await d.getByRole('button',{name:'Done',exact:true}).click();await settle(page);
    };
    const factor=async(selector,speed)=>{const before=await width(selector);await wheel(selector);assert.ok(Math.abs(await width(selector)/before-Math.exp(.15*speed))<.002);};
    await page.locator('[data-hotkey="paint"]').click();await page.getByRole('button',{name:'Begin painting',exact:true}).click();await page.locator('.paint-texture-image').waitFor();
    await factor('.paint-texture-image',1);await mouseSettings({speed:3});await factor('.paint-texture-image',3);
    await mouseSettings({mode:'scroll'});let before=await width('.paint-texture-image');await wheel('.paint-texture-image');assert.equal(await width('.paint-texture-image'),before);await page.getByRole('status').filter({hasText:'Scroll sensitivity:'}).waitFor();
    await mouseSettings({mode:'pointer'});await wheel('.paint-texture-image');assert.equal(await width('.paint-texture-image'),before);await page.getByRole('status').filter({hasText:'Mouse DPI / pointer speed:'}).waitFor();
    await mouseSettings({speed:1,mode:'rotate'});
    await page.getByRole('button',{name:'Copy a patch',exact:true}).click();await page.locator('.paint-cutout-image').waitFor();await factor('.paint-cutout-image',1);
    await page.getByRole('dialog',{name:'Texture cutout',exact:true}).getByRole('button',{name:/^Close/}).click();
    // Forge can open over Paint; it must receive those same persisted Mouse settings.
    await page.getByRole('button',{name:'Forge',exact:true}).click();const d=page.getByRole('dialog',{name:'Forge',exact:true});await d.getByRole('tab',{name:'Projector',exact:true}).click();
    const {encodeForgeTga}=await import('../src/forge.js');const image=path.join(out,'image.tga');fs.writeFileSync(image,encodeForgeTga({width:64,height:64,data:new Uint8Array(64*64*4).fill(255)}));await d.locator('input[type=file]').setInputFiles(image);await d.getByRole('button',{name:'FORGE',exact:true}).waitFor();await settle(page);
    const readMask=()=>page.evaluate(()=>{const p=findFiberState('[aria-label="Image cleanup canvas"]',v=>v?.image&&v?.origin&&v?.scale);return {zoom:p.zoom,origin:p.origin,scale:p.scale};});
    const canvas=d.getByLabel('Image cleanup canvas'),b=await canvas.boundingBox(),x=b.width*.6,y=b.height*.5,p=await readMask();
    await canvas.evaluate(el=>el.addEventListener('wheel',e=>{window.imageWheelPoint=[e.clientX,e.clientY];},{once:true,capture:true}));await wheel('[aria-label="Image cleanup canvas"]');const q=await readMask();const actual=await page.evaluate(()=>window.imageWheelPoint);const cursor=[actual[0]-b.x,actual[1]-b.y];assert.ok(Math.abs(q.zoom/p.zoom-Math.exp(.15))<1e-10);
    assert.ok(Math.abs((cursor[0]-p.origin[0])/p.scale-(cursor[0]-q.origin[0])/q.scale)<1e-8);assert.ok(Math.abs((cursor[1]-p.origin[1])/p.scale-(cursor[1]-q.origin[1])/q.scale)<1e-8);
    await page.mouse.down({button:'right'});await page.mouse.wheel(0,-100);await d.getByRole('status').filter({hasText:'Scroll sensitivity:'}).waitFor();assert.equal((await readMask()).zoom,q.zoom);await page.mouse.up({button:'right'});
    await page.mouse.move(b.x+x,b.y+y);await page.mouse.down({button:'right'});await page.mouse.move(b.x+x+30,b.y+y+20,{steps:4});await page.mouse.up({button:'right'});await settle(page);const r=await readMask();assert.ok(r.origin[0]>q.origin[0]);
    await page.screenshot({path:path.join(out,'forge-mouse-zoom.png')});assert.deepEqual(errors,[]);
    console.log('PASS image navigation: Paint texture/cutout speed, live Mouse settings, Peon/Wisp, Forge cursor anchoring, right-wheel adjustment and pan');
  }finally{await closeApp(app);}
})().catch(error=>{console.error(error);process.exitCode=1;});
