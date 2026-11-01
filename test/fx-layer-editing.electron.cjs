const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {launchApp,closeApp,root}=require('./helpers/app.cjs');
const {testModel}=require('./helpers/fixtures.cjs');
(async()=>{
 const out=path.join(root,'out/fx-layer-editing');fs.mkdirSync(out,{recursive:true});
 const {app,page,errors}=await launchApp({fixture:testModel('WH_WOC_WarriorSlaaneshDual01.mdx'),out,bounds:{x:0,y:0,width:1450,height:960}});
 const fx=page.getByRole('dialog',{name:'Surface Effects',exact:true}),stage=fx.locator('.sfx-stage');
 const ready=()=>page.waitForFunction(()=>{const e=document.querySelector('.sfx-stage .game-preview-root');if(!e)return false;const p=mdlxlProbe(e);return p.runtime?.captureApi.isReady&&p.runtime.particleSourceModel===p.props.model&&!document.querySelector('.sfx-apply')?.disabled;});
 const choose=async name=>{await fx.getByLabel('Find a surface effect').fill(name);await fx.getByRole('button',{name:name+' global animation',exact:true}).click();await ready();};
 const select=async name=>fx.getByRole('group',{name:'Layers'}).getByRole('button',{name:new RegExp('^'+name)}).click();
 const passes=()=>page.evaluate(()=>{const p=mdlxlProbe('.sfx-stage .game-preview-root'),m=p.runtime.native.model;return m.Geosets.filter(g=>g._FxTag?.endsWith('/shape')).map(g=>m.Materials[g.MaterialID].Layers.map(l=>typeof l.Alpha==='number'?l.Alpha:l.Alpha.Keys.map(k=>k.Vector[0])));});
 const difference=(a,b)=>page.evaluate(async ([a,b])=>{
  const pixels=async data=>{const im=await createImageBitmap(new Blob([Uint8Array.from(atob(data),c=>c.charCodeAt(0))]));const c=new OffscreenCanvas(im.width,im.height),ctx=c.getContext('2d');ctx.drawImage(im,0,0);im.close();return ctx.getImageData(0,0,c.width,c.height).data;};
  const [x,y]=await Promise.all([pixels(a),pixels(b)]);let count=0;for(let i=0;i<x.length;i+=4)if(Math.max(...[0,1,2].map(k=>Math.abs(x[i+k]-y[i+k])))>3)count++;return count;
 },[a,b].map(buf=>buf.toString('base64')));
 try{
  await page.getByRole('button',{name:'Surface Effects',exact:true}).click();await ready();await fx.getByLabel('Geoset',{exact:true}).selectOption('28');await choose('Basalt kiln');
  await fx.getByLabel('Create as overlay').check();await ready();await fx.getByRole('button',{name:'Solo',exact:true}).click();await fx.getByRole('button',{name:'Fit selection'}).click();await fx.getByRole('button',{name:'Pause',exact:true}).click();
  for(const [i,label] of ['Black stone','Heat seams'].entries()){
   await select(label);const slider=fx.getByRole('slider',{name:'Intensity',exact:true});await slider.scrollIntoViewIfNeeded();const box=await slider.boundingBox(),before=await passes(),beforeImg=await stage.screenshot();
   await page.mouse.move(box.x+box.width-9,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+6,box.y+box.height/2,{steps:7});
   await page.waitForFunction(()=>{const p=mdlxlProbe('.sfx-stage .game-preview-root'),m=p.runtime.native.model,id=m.Geosets.find(g=>g._FxStack)._FxStack.owner;
    const i=Array.from(document.querySelectorAll('.fx-layer-list button')).findIndex(b=>b.getAttribute('aria-pressed')==='true')+1;
    const g=m.Geosets.find(g=>g._FxTag===id+'/'+i+'/shape'),a=m.Materials[g.MaterialID].Layers[0].Alpha;return (typeof a==='number'?a:Math.max(...a.Keys.map(k=>k.Vector[0])))<.05;},null,{timeout:5000});
   const during=await passes();assert.deepEqual(during[1-i],before[1-i],label+' keeps the sibling native pass');assert.notDeepEqual(during[i],before[i]);
   const changed=await difference(beforeImg,await stage.screenshot());assert.ok(changed>20,label+' visibly changes before release: '+changed);
   await page.mouse.up();await ready();await slider.click();await page.keyboard.press('End');await ready();console.log(label,changed,'changed pixels');
  }
  await choose('Living ink');assert.equal(await fx.getByLabel('Enable Ink seal').count(),0);
  await fx.getByLabel('Add layer',{exact:true}).selectOption('Ink seal');await ready();
  await fx.getByRole('button',{name:'Change texture',exact:true}).click();
  const search=page.getByRole('searchbox',{name:'Search textures'});await page.getByRole('checkbox',{name:'Vibe search'}).uncheck();await search.fill('DemonRune5');
  const tile=page.locator('.tl-grid button').filter({has:page.getByText('Demon Rune5',{exact:true})});await tile.click({timeout:60000});
  await page.getByRole('button',{name:'Use picture',exact:true}).click();await search.waitFor({state:'hidden'});await ready();
  const checkImage=()=>page.evaluate(()=>{const m=mdlxlProbe('.sfx-stage .game-preview-root').props.model,s=m.Geosets.find(g=>g._FxStack)._FxStack,l=s.layers.find(l=>l.label==='Ink seal'),g=m.Geosets.find(g=>g._FxTag===s.owner+'/'+l.id+'/shape');return m.Textures[m.Materials[g.MaterialID].Layers[0].TextureID].Image;});
  assert.match(await checkImage(),/DemonRune5\.blp$/i);
  await choose('Briar binding');await fx.getByLabel('Enable Spores',{exact:true}).check();await ready();await select('Spores');await fx.getByLabel('Change emitter',{exact:true}).selectOption('Rising embers');await ready();
  assert.equal(await fx.getByLabel('Enable Rising embers',{exact:true}).isChecked(),true);
  const particle=fx.getByRole('slider',{name:'Intensity',exact:true});await particle.scrollIntoViewIfNeeded();const pb=await particle.boundingBox();
  await page.mouse.move(pb.x+pb.width-7,pb.y+pb.height/2);await page.mouse.down();await page.mouse.move(pb.x+1,pb.y+pb.height/2,{steps:8});
  const isolated=()=>{const es=mdlxlProbe('.sfx-stage .game-preview-root').runtime.native.particlesController.emitters.map(e=>e.props);
   const selected=es.filter(e=>e.Name.startsWith('FX Rising embers'));return selected.length>0&&selected.every(e=>e.Alpha.every(v=>v===0))&&es.some(e=>e.Name.startsWith('FX Pollen')&&e.Alpha.some(v=>v>0));};
  await page.waitForFunction(isolated,null,{timeout:5000});await page.mouse.up();await ready();assert.ok(await page.evaluate(isolated));
  await choose('Lightning blade');await select('Blade crackle');for(const [label,value] of [['Time between bursts (s)','2'],['Burst duration (s)','.3'],['Bolts per burst','8'],['Spread (°)','68']]){
   const field=fx.getByLabel(label,{exact:true});await field.fill(value);await field.press('Enter');await ready();
  }
  assert.deepEqual(errors,[]);console.log('PASS live layer isolation, native texture library, emitter substitution and independent lightning controls');
 }catch(error){console.error((await page.locator('body').innerText()).slice(-2100));await page.screenshot({path:path.join(out,'failure.png')});throw error;}finally{await closeApp(app);}
})().catch(e=>{console.error(e);process.exitCode=1;});
