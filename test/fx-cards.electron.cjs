const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {launchApp,closeApp,root}=require('./helpers/app.cjs');
const {testModel}=require('./helpers/fixtures.cjs');
const {selectOption,addFxLayer}=require('./helpers/fx-input.cjs');
// Card layers by real input on the Slaanesh dual weapon: add one, see it, see it pulse, drag it with the emitter
// handle without moving the camera, change Facing, Apply and find it again. Also the app-review fixes: Built-in
// rhythm on a native card and a look status that clears on another look.
(async()=>{
 const out=path.join(root,'out/fx-cards');fs.mkdirSync(out,{recursive:true});
 const {app,page,errors}=await launchApp({fixture:testModel('WH_WOC_WarriorSlaaneshDual01.mdx'),out,bounds:{x:0,y:0,width:1450,height:960}});
 const fx=page.getByRole('dialog',{name:'Surface Effects',exact:true}),stage=fx.locator('.sfx-stage'),button=n=>fx.getByRole('button',{name:n,exact:true});
 const ready=()=>page.waitForFunction(()=>{const e=document.querySelector('.sfx-stage .game-preview-root');if(!e)return false;const p=mdlxlProbe(e);return p.runtime?.captureApi.isReady&&p.runtime.particleSourceModel===p.props.model&&!document.querySelector('.sfx-apply')?.disabled;},null,{timeout:45000});
 const choose=async name=>{await fx.getByLabel('Find a surface effect').fill(name);await button(name+' global animation').click();await ready();};
 const card=()=>page.evaluate(()=>mdlxlProbe('.sfx-stage .game-preview-root').props.model.Geosets.find(g=>g._FxStack)?._FxStack.layers.find(l=>l.type==='Card'));
 const camera=()=>page.evaluate(()=>mdlxlProbe('.sfx-stage .game-preview-root').runtime.controls.object.position.toArray());
 const difference=(a,b)=>page.evaluate(async ([a,b])=>{
  const pixels=async data=>{const im=await createImageBitmap(new Blob([Uint8Array.from(atob(data),c=>c.charCodeAt(0))]));const c=new OffscreenCanvas(im.width,im.height),ctx=c.getContext('2d');ctx.drawImage(im,0,0);im.close();return ctx.getImageData(0,0,c.width,c.height).data;};
  const [x,y]=await Promise.all([pixels(a),pixels(b)]);let count=0;for(let i=0;i<x.length;i+=4)if(Math.max(...[0,1,2].map(k=>Math.abs(x[i+k]-y[i+k])))>3)count++;return count;
 },[a,b].map(buf=>buf.toString('base64')));
 // The first card's size pulse clock and its phase in the running preview.
 const pulseClock=()=>page.evaluate(()=>mdlxlProbe('.sfx-stage .game-preview-root').props.model.Bones.find(b=>b._FxTag?.endsWith('/card0-0')).Scaling.GlobalSeqId);
 const phase=index=>page.evaluate(index=>{const p=mdlxlProbe('.sfx-stage .game-preview-root');return p.runtime.native.rendererData.globalSequencesFrames[index]/p.props.model.GlobalSequences[index];},index);
 const at=async(index,target)=>{await page.waitForFunction(([index,target])=>{const p=mdlxlProbe('.sfx-stage .game-preview-root'),t=p.runtime.native.rendererData.globalSequencesFrames[index]/p.props.model.GlobalSequences[index];return Math.abs(t-target)<.04;},[index,target],{timeout:30000});return stage.screenshot();};
 const handle=async(label,dx,dy)=>{const knob=fx.getByRole('slider',{name:label,exact:true}).locator('circle');await knob.waitFor();const b=await knob.boundingBox(),x=b.x+b.width/2,y=b.y+b.height/2;await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:8});await page.mouse.up();await ready();};
 try{
  await page.getByRole('button',{name:'Surface Effects',exact:true}).click();await ready();
  await fx.getByLabel('Geoset',{exact:true}).selectOption('28');await ready();

  // App review: a native card that keeps its own rhythm shows Built-in, not its layer name.
  await choose('Poison');await fx.getByRole('group',{name:'Layers'}).getByRole('button',{name:/^Poison surface/}).click();await ready();
  const rhythm=await fx.getByLabel('Rhythm',{exact:true}).evaluate(s=>s.selectedOptions[0].textContent);
  assert.match(rhythm,/^(Built-in|Integrados?)$/,'the own rhythm reads Built-in: '+rhythm);
  // App review: "… saved." clears when another look is chosen.
  await button('Save as…').click();await fx.getByLabel('Preset name',{exact:true}).fill('Card test');await button('Save').click();
  assert.ok(await fx.getByRole('status').filter({hasText:'Card test saved.'}).isVisible(),'the status shows after saving');

  await choose('Empty');
  assert.equal(await fx.getByRole('status').filter({hasText:'saved.'}).count(),0,'the status clears on another look');
  await button('Solo').click();await button('Fit selection').click();await ready();
  const empty=await stage.screenshot();

  // Add a Card with the Add layer menu.
  await addFxLayer(page,fx,'Card');await ready();
  const added=await card();assert.ok(added,'the Card layer is in the stack');assert.equal(added.label,'Card');
  assert.equal(await fx.getByRole('group',{name:'Layers'}).getByRole('button',{name:/^Card/}).getAttribute('aria-pressed'),'true','the new card is selected');
  for(const label of ['Facing','Count','Rhythm'])assert.ok(await fx.getByLabel(label,{exact:true}).isVisible(),label+' shows by default');
  for(const label of ['Spin','Jitter','Smallest size'])assert.equal(await fx.getByRole('slider',{name:label,exact:true}).count(),0,label+' waits under More');
  const shown=await difference(empty,await stage.screenshot());assert.ok(shown>300,'the card is visible in the preview: '+shown);

  // The size pulse: the card is a different size half a loop later.
  const clock=await pulseClock(),small=await at(clock,.02),large=await at(clock,.5);
  const pulse=await difference(small,large);assert.ok(pulse>150,'the card changes size between loop phases: '+pulse);

  // Drag the card with the emitter move handle; the camera stays where it is.
  await button('Pause').click();await ready();
  await button('Position & size').click();await ready();
  const view=await camera(),before=await card(),beforeMove=await stage.screenshot();
  await handle('Move emitter',40,-24);
  const moved=await card();assert.notDeepEqual(moved.offset,before.offset,'the card offset changes');
  assert.deepEqual(await camera(),view,'the camera did not move');
  const travelled=await difference(beforeMove,await stage.screenshot());assert.ok(travelled>200,'the card moved on screen: '+travelled);
  await handle('Resize particle',24,0);assert.notEqual((await card()).size,moved.size,'the size handle resizes the card');
  assert.deepEqual(await camera(),view,'the camera still did not move');
  await button('Position & size').click();await ready();

  // More holds the motion fields; Facing turns the card flat on the ground.
  await fx.locator('details.fx-more>summary').click();
  for(const label of ['Spin','Jitter','Smallest size','Largest size'])assert.ok(await fx.getByRole('slider',{name:label,exact:true}).isVisible(),label+' under More');
  const standing=await stage.screenshot();
  await selectOption(page,fx.getByLabel('Facing',{exact:true}),'Ground');await ready();
  assert.equal((await card()).facing,'ground');
  const flat=await difference(standing,await stage.screenshot());assert.ok(flat>200,'the ground card looks different: '+flat);

  // Apply, reopen FX and find the same card.
  const kept=await card();
  await button('Apply effect').click();await fx.waitFor({state:'hidden'});
  assert.ok(await page.evaluate(()=>mdlxlProbe().session.doc.model.Geosets.some(g=>g._FxTag?.endsWith('/shape'))),'the model has the card geoset');
  await page.getByRole('button',{name:'Surface Effects',exact:true}).click();await ready();
  await fx.getByLabel('Geoset',{exact:true}).selectOption('28');await ready();
  assert.ok(await fx.getByRole('group',{name:'Layers'}).getByRole('button',{name:/^Card/}).isVisible(),'the Card layer is listed again');
  const again=await card();
  for(const key of ['facing','size','offset','image'])assert.deepEqual(again[key],kept[key],'reopened '+key);
  assert.deepEqual(errors,[]);console.log('PASS Card layer by real input',{shown,pulse,travelled,flat});
 }catch(error){console.error((await page.locator('body').innerText()).slice(-2100));await page.screenshot({path:path.join(out,'failure.png')});throw error;}finally{await closeApp(app);}
})().catch(e=>{console.error(e);process.exitCode=1;});
