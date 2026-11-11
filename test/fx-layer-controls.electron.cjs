const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {launchApp,closeApp,root}=require('./helpers/app.cjs');
const {testModel}=require('./helpers/fixtures.cjs');
// Every surface layer is editable whatever preset it came from: texture area, rune layout,
// colour rhythm with a second colour, and Speed 0. Real clicks and drags only.
(async()=>{
 const out=path.join(root,'out/fx-layer-controls');fs.mkdirSync(out,{recursive:true});
 const {app,page,errors}=await launchApp({fixture:testModel('WH_WOC_WarriorSlaaneshDual01.mdx'),out,bounds:{x:0,y:0,width:1450,height:960}});
 const fx=page.getByRole('dialog',{name:'Surface Effects',exact:true}),stage=fx.locator('.sfx-stage');
 const ready=()=>page.waitForFunction(()=>{const e=document.querySelector('.sfx-stage .game-preview-root');if(!e)return false;const p=mdlxlProbe(e);return p.runtime?.captureApi.isReady&&p.runtime.particleSourceModel===p.props.model&&!document.querySelector('.sfx-apply')?.disabled;});
 const choose=async name=>{await fx.getByLabel('Find a surface effect').fill(name);await fx.getByRole('button',{name:name+' global animation',exact:true}).click();await ready();};
 const select=async name=>{await fx.getByRole('group',{name:'Layers'}).getByRole('button',{name:new RegExp('^'+name)}).click();await ready();};
 const layer=label=>page.evaluate(label=>mdlxlProbe('.sfx-stage .game-preview-root').props.model.Geosets.find(g=>g._FxStack)._FxStack.layers.find(l=>l.label===label),label);
 const only=async keep=>{for(const box of await fx.getByRole('group',{name:'Layers'}).getByRole('checkbox').all()){const name=await box.getAttribute('aria-label');if(name!=='Enable '+keep&&await box.isChecked()){await box.click();await ready();}}};
 const difference=(a,b)=>page.evaluate(async ([a,b])=>{
  const pixels=async data=>{const im=await createImageBitmap(new Blob([Uint8Array.from(atob(data),c=>c.charCodeAt(0))]));const c=new OffscreenCanvas(im.width,im.height),ctx=c.getContext('2d');ctx.drawImage(im,0,0);im.close();return ctx.getImageData(0,0,c.width,c.height).data;};
  const [x,y]=await Promise.all([pixels(a),pixels(b)]);let count=0;for(let i=0;i<x.length;i+=4)if(Math.max(...[0,1,2].map(k=>Math.abs(x[i+k]-y[i+k])))>3)count++;return count;
 },[a,b].map(buf=>buf.toString('base64')));
 // Wait for a layer clock to move by a fraction of its loop, then capture.
 const clock=label=>page.evaluate(label=>{const p=mdlxlProbe('.sfx-stage .game-preview-root'),m=p.props.model,s=m.Geosets.find(g=>g._FxStack)._FxStack,l=s.layers.find(l=>l.label===label);return m.GlobalSequences.indexOf(l.loop??s.loop);},label);
 const phase=index=>page.evaluate(index=>{const p=mdlxlProbe('.sfx-stage .game-preview-root');return p.runtime.native.rendererData.globalSequencesFrames[index]/p.props.model.GlobalSequences[index];},index);
 const later=async(index,fraction)=>{const start=await phase(index);await page.waitForFunction(([index,start,fraction])=>{const p=mdlxlProbe('.sfx-stage .game-preview-root'),t=p.runtime.native.rendererData.globalSequencesFrames[index]/p.props.model.GlobalSequences[index];const d=((t-start)%1+1)%1;return Math.abs(d-fraction)<.06;},[index,start,fraction],{timeout:20000});return stage.screenshot();};
 const drag=async(locator,from,to)=>{await locator.scrollIntoViewIfNeeded();const b=await locator.boundingBox();await page.mouse.move(b.x+b.width*from[0],b.y+b.height*from[1]);await page.mouse.down();await page.mouse.move(b.x+b.width*to[0],b.y+b.height*to[1],{steps:8});await page.mouse.up();await ready();};
 try{
  await page.getByRole('button',{name:'Surface Effects',exact:true}).click();await ready();await fx.getByLabel('Geoset',{exact:true}).selectOption('28');
  await fx.getByRole('button',{name:'Solo',exact:true}).click();await fx.getByRole('button',{name:'Fit selection'}).click();await ready();

  // Poison: pick another area of the native tileset inside FX.
  await choose('Poison');await select('Poison surface');await fx.getByRole('button',{name:'Pause',exact:true}).click();await ready();
  const startArea=(await layer('Poison surface')).atlasRect,beforePoison=await stage.screenshot();
  await fx.getByRole('button',{name:'Scale area',exact:true}).click();const canvas=fx.locator('.fx-uv-fit canvas');
  await drag(canvas,[.62,.62],[.9,.9]);
  await fx.getByRole('button',{name:'Move area',exact:true}).click();await drag(canvas,[.5,.5],[.3,.35]);
  const moved=(await layer('Poison surface')).atlasRect;assert.ok(moved&&moved.join()!==String(startArea),'Move and Scale change the texture area: '+moved);
  const poisonChange=await difference(beforePoison,await stage.screenshot());assert.ok(poisonChange>200,'the rendered poison surface changes: '+poisonChange);
  await fx.getByRole('button',{name:'Whole picture',exact:true}).click();await ready();assert.deepEqual((await layer('Poison surface')).atlasRect,[0,0,1,1]);
  await fx.getByRole('button',{name:'Reset',exact:true}).click();await ready();assert.equal((await layer('Poison surface')).atlasRect,undefined,'Reset returns to the card area');
  await fx.getByRole('button',{name:'Play',exact:true}).click();

  // Runes: Repeat and Turn sliders lay out the glyphs without the UV Wrapper.
  await choose('Runes');await fx.getByRole('button',{name:'Pause',exact:true}).click();await ready();
  const beforeRunes=await stage.screenshot(),repeat=fx.getByRole('slider',{name:'Repeat',exact:true});
  await drag(repeat,[.05,.5],[.8,.5]);assert.ok((await layer('Runes')).repeats>=8,'Repeat is stored');
  const turn=fx.getByRole('slider',{name:'Turn',exact:true});await drag(turn,[.5,.5],[.75,.5]);
  assert.ok(Math.abs((await layer('Runes')).glyphTurn)>=45,'Turn is stored');
  const runeChange=await difference(beforeRunes,await stage.screenshot());assert.ok(runeChange>200,'the runes visibly change: '+runeChange);
  await fx.getByRole('button',{name:'Play',exact:true}).click();

  // Colour beat with a second colour: the colour changes over the layer's loop.
  await fx.getByLabel('Rhythm',{exact:true}).selectOption('beat');await ready();
  await fx.getByLabel('Second colour',{exact:true}).fill('#00ff00');await ready();
  assert.deepEqual((await layer('Runes')).tint2,[0,1,0]);
  const runeClock=await clock('Runes'),start=await later(runeClock,0),half=await later(runeClock,.5);
  const beat=await difference(start,half);assert.ok(beat>200,'the colour beat changes the runes over time: '+beat);

  // Speed 0 holds a moving surface still.
  await choose('Arcane');await only('Flowing energy');await select('Flowing energy');
  await fx.getByLabel('Rhythm',{exact:true}).selectOption('steady');await ready();
  const energy=await clock('Flowing energy'),moving=await difference(await later(energy,0),await later(energy,.3));assert.ok(moving>200,'Speed 1 travels: '+moving);
  const speed=fx.getByLabel('Speed',{exact:true});await speed.click();await speed.fill('0');await speed.press('Enter');await ready();
  assert.equal((await layer('Flowing energy')).speed,0);
  const still=await difference(await later(energy,0),await later(energy,.3));assert.ok(still<20,'Speed 0 holds still: '+still);
  assert.deepEqual(errors,[]);console.log('PASS texture area, rune layout, colour beat and Speed 0 by real input',{poisonChange,runeChange,beat,moving,still});
 }catch(error){console.error((await page.locator('body').innerText()).slice(-2100));await page.screenshot({path:path.join(out,'failure.png')});throw error;}finally{await closeApp(app);}
})().catch(e=>{console.error(e);process.exitCode=1;});
