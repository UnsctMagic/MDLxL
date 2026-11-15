const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {launchApp,closeApp,root,stubDialogs}=require('../test/helpers/app.cjs');
const {fixturePath}=require('../test/helpers/fixtures.cjs');
const {addEmitter}=require('../test/helpers/fx-input.cjs');
(async()=>{
 const out=path.join(root,'out/fx-emitter-options');fs.mkdirSync(out,{recursive:true});
 const {app,page,errors}=await launchApp({fixture:fixturePath('footman'),out,bounds:{x:0,y:0,width:1280,height:920},settings:{preferences:{language:'en',learn:{enabled:false}}}});
 const fx=page.getByRole('dialog',{name:'Surface Effects',exact:true}),stage=fx.locator('.sfx-stage');
 const ready=()=>page.waitForFunction(()=>{const p=mdlxlProbe('.sfx-stage .game-preview-root');return p?.runtime?.captureApi.isReady&&p.runtime.particleSourceModel===p.props.model&&!document.querySelector('.sfx-apply')?.disabled;});
 const read=()=>page.evaluate(()=>{const p=mdlxlProbe('.sfx-stage .game-preview-root'),s=p.props.model.Geosets.find(g=>g._FxStack)._FxStack;return {layer:s.layers.find(l=>l.label==='Fire column'),nodes:p.props.model.ParticleEmitters2.filter(e=>e._FxTag?.startsWith(s.owner+'/'))};});
 const type=async(label,value)=>{const input=fx.getByRole('spinbutton',{name:label+' value',exact:true});await input.click();await page.keyboard.press('Control+a');await page.keyboard.type(String(value));await page.keyboard.press('Enter');await ready();};
 const difference=async(a,b)=>page.evaluate(async images=>{const arrays=await Promise.all(images.map(async s=>{const im=await createImageBitmap(new Blob([Uint8Array.from(atob(s),c=>c.charCodeAt(0))]));const c=new OffscreenCanvas(im.width,im.height),g=c.getContext('2d');g.drawImage(im,0,0);return g.getImageData(0,0,c.width,c.height).data;}));let n=0;for(let i=0;i<arrays[0].length;i+=4)if([0,1,2].some(k=>Math.abs(arrays[0][i+k]-arrays[1][i+k])>14))n++;return n;},[a,b].map(b=>b.toString('base64')));
 const picture=async name=>{await page.waitForFunction(()=>{const p=mdlxlProbe('.sfx-stage .game-preview-root'),n=p.runtime.native;return n.particlesController.emitters.reduce((a,e)=>a+e.particles.length,0)>35;});const shot=await stage.screenshot();fs.writeFileSync(path.join(out,name+'.png'),shot);return shot;};
 try{
  await page.getByRole('button',{name:'Surface Effects',exact:true}).click();await ready();
  const search=fx.getByLabel('Find a surface effect');await search.click();await page.keyboard.type('Empty');await fx.getByRole('button',{name:'Empty global animation',exact:true}).click();await ready();
  await addEmitter(page,fx,'Fire column',ready);await fx.locator('details.fx-more>summary').click();
  assert.equal(await fx.locator('details.fx-more').getByRole('slider',{name:'Size',exact:true}).count(),1,'native Size is offered under More');
  const camera=await page.evaluate(()=>mdlxlProbe('.sfx-stage .game-preview-root').runtime.controls.object.position.toArray());
  const counts={};
  for(const [label,key,small,large] of [['Size','ParticleScaling',1,35],['Spawn width','Width',0,90],['Spawn length','Length',0,90]]){
   await type(label,small);const before=await picture(key+'-small');await type(label,large);const after=await picture(key+'-large'),state=await read();
   if(key==='ParticleScaling')assert.ok(Array.isArray(state.layer.native[key])&&Math.abs(Math.max(...state.layer.native[key])-large)<.01);
   else assert.equal(state.layer.native[key],large);
   assert.ok(state.nodes.every(p=>key==='ParticleScaling'?Math.abs(Math.max(...Object.values(p[key]))-large)<.01:p[key]===large));
   counts[key]=await difference(before,after);assert.ok(counts[key]>300,key+' visibly changes pixels: '+counts[key]);
   await type(label,key==='ParticleScaling'?15:0);
  }
  const halfway=fx.getByRole('slider',{name:'Halfway point',exact:true});await halfway.click();await page.keyboard.press('Home');await ready();
  const early=await picture('Time-early');await halfway.click();await page.keyboard.press('End');await ready();const late=await picture('Time-late');
  assert.equal((await read()).layer.native.Time,1);counts.Time=await difference(early,late);assert.ok(counts.Time>300,'Time visibly changes pixels');
  assert.equal(await fx.getByLabel('Unfogged',{exact:true}).count(),0);assert.equal(await fx.getByLabel('Priority plane',{exact:true}).count(),0);
  assert.deepEqual(await page.evaluate(()=>mdlxlProbe('.sfx-stage .game-preview-root').runtime.controls.object.position.toArray()),camera,'option edits preserve camera');
  const saved=(await read()).layer.native;
  await fx.getByRole('button',{name:'Apply effect',exact:true}).click();await fx.waitFor({state:'hidden'});
  for(const format of ['mdx','mdl']){
   const file=path.join(out,'options.'+format);await stubDialogs(app,{save:file});await page.keyboard.press('F12');
   await page.getByRole('button',{name:'Save '+format.toUpperCase()+'…',exact:true}).click();await page.getByRole('dialog',{name:'Save model',exact:true}).getByRole('button',{name:'Save',exact:true}).click();
   await page.waitForFunction(file=>mdlxlProbe().session.path===file&&!mdlxlProbe().session.doc.dirty,file);await page.getByRole('dialog',{name:'Save as',exact:true}).waitFor({state:'hidden'});
   await page.locator('.model-tab.active .model-tab-close').click();await page.waitForFunction(file=>mdlxlProbe().session?.path!==file,file);
   await stubDialogs(app,{open:file});await page.keyboard.press('Control+o');await page.waitForFunction(file=>mdlxlProbe().session.path===file,file);
   await page.getByRole('button',{name:'Surface Effects',exact:true}).click();await ready();
   const reopened=(await read()).layer.native;for(const key of ['ParticleScaling','Width','Length','Time'])assert.deepEqual(reopened[key],saved[key],format+' '+key);
   await fx.getByRole('button',{name:'Cancel',exact:true}).click();await fx.waitFor({state:'hidden'});
  }
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({counts,errors},null,2));assert.deepEqual(errors,[]);console.log('PASS native Size, Width, Length and Time visibly change; camera preserved');
 }catch(e){await page.screenshot({path:path.join(out,'failure.png')});throw e;}finally{await closeApp(app);}
})().catch(e=>{console.error(e);process.exitCode=1;});
