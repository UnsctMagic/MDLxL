const { launchApp, closeApp, clickMenu } = require('./helpers/app.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
// A new emitter on a model without animations: the Motion tab must draw (it used to stop the interface).
(async()=>{
 const root=process.cwd(),out=path.join(root,'out','particle-prototype','motion-tab-'+Date.now());fs.mkdirSync(out,{recursive:true});
 const {createNode,openDocument}=await import('../src/editor-document.js'),{createStarterDocument}=await import('../src/starter-model.js');
 const doc=createStarterDocument();doc.apply('Add emitter',['Nodes','PivotPoints'],m=>{createNode(m,'ParticleEmitter2');});
 const fixture=path.join(out,'no-animation-emitter.mdx'),bytes=Buffer.from(doc.serialize('mdx'));fs.writeFileSync(fixture,bytes);
 const saved=openDocument(bytes).model,id=saved.ParticleEmitters2[0].ObjectId;assert.equal(saved.Sequences.length,0);
 let app;const errors=[];
 try{
  const launched = await launchApp({ out, fixture, errors, timeout: 60000, bounds: { x: -3000, y: 0, width: 1400, height: 920 }, show: 'inactive', pageTimeout: 15000 }); app = launched.app;const page=launched.page;page.on('pageerror',e=>errors.push(e.stack||e.message));
  await page.getByText('Opened no-animation-emitter.mdx',{exact:true}).waitFor();
  await clickMenu(app, 'Particle Editor…');await page.getByLabel('Particle context',{exact:true}).waitFor();if(await page.getByRole('button',{name:'Close Particle Library',exact:true}).count())await page.getByRole('button',{name:'Close Particle Library',exact:true}).click();
  await page.getByLabel('Particle context',{exact:true}).selectOption('On model');await page.getByLabel('Effect ingredient',{exact:true}).selectOption(String(id));await page.getByRole('button',{name:'Motion',exact:true}).click();
  for(const name of ['Aim X','Aim Y','Aim Z'])await page.getByRole('slider',{name,exact:true}).waitFor({timeout:5000});
  await page.getByRole('button',{name:'Burst',exact:true}).click();assert.ok(await page.getByRole('button',{name:'Place burst at playhead',exact:true}).isDisabled(),'No animation: a burst has nowhere to go');
  assert.equal(await page.getByText('The interface could not finish drawing').count(),0);
  await page.screenshot({path:path.join(out,'motion-tab.png')});assert.deepEqual(errors,[]);console.log('Motion tab draws for a new emitter on a model without animations');
 }catch(error){if(app){const page=await app.firstWindow();console.error((await page.locator('body').innerText()).slice(-2500));await page.screenshot({path:path.join(out,'failure.png')});}throw error;}finally{if(app)await closeApp(app);}
})().catch(error=>{console.error(error);process.exit(1);});
