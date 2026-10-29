const { gameFolder } = require('./helpers/fixtures.cjs');
const { launchApp, closeApp } = require('./helpers/app.cjs');

const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
// The game's own sprite sheets offer the game's frame setups; the grid and frames can be set by hand.
(async()=>{
 const root=process.cwd(),out=path.join(root,'out','sprite-frames','run-'+Date.now());await fs.mkdir(out,{recursive:true});
 const {CascReader}=require('../electron/casc.cjs'),reader=new CascReader(await gameFolder(),root);let bytes;
 try{bytes=await reader.read('war3.w3mod:abilities\\spells\\human\\polymorph\\polymorphdoneground.mdx');}finally{reader.close();}
 const fixture=path.join(out,'PolymorphDoneGround.mdx');await fs.writeFile(fixture,bytes);
 let app;const errors=[];
 try{
  const launched = await launchApp({ out, fixture, errors, timeout: 60000, bounds: { x: -3000, y: 0, width: 1400, height: 920 }, show: 'inactive', pageTimeout: 20000 }); app = launched.app;
  const page=launched.page;

  await page.getByText('Opened PolymorphDoneGround.mdx',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Emitter Editor',exact:true}).click();
  const editor=page.getByRole('dialog',{name:'Particle Editor',exact:true});await editor.waitFor();
  if(await editor.getByRole('button',{name:'Close Particle Library',exact:true}).count())await editor.getByRole('button',{name:'Close Particle Library',exact:true}).click();
  await editor.getByLabel('Particle context',{exact:true}).selectOption('On model');
  const read=()=>page.evaluate(()=>{let el=document.querySelector('.pe-window');{ const props = findFiberState(el, props => { const doc = props?.doc; return doc?.model; }, { props: true }); if (props) { const doc = props?.doc; return {emitters:JSON.parse(JSON.stringify(doc.model.ParticleEmitters2.map(p=>({id:p.ObjectId,texture:doc.model.Textures[p.TextureID]?.Image,Rows:p.Rows,Columns:p.Columns,life:p.LifeSpanUVAnim,decay:p.DecayUVAnim})))),undo:doc.historyStats.undoSteps}; } }throw Error('Model missing');});
  const before=await read(),sheet=before.emitters.find(p=>/clouds8x8/i.test(p.texture||''));assert.ok(sheet,'The model uses a game cloud sheet');
  await editor.getByLabel('Effect ingredient',{exact:true}).selectOption(String(sheet.id));
  const frames=editor.getByLabel('Frames',{exact:true});await frames.waitFor();
  const options=(await frames.locator('option').allTextContents());assert.ok(options.length>=2&&options.at(-1)==='Custom…',JSON.stringify(options));
  for(const name of options)assert.doesNotMatch(name,/\d|Like /,'Clear names only');
  assert.equal(await editor.getByRole('listbox',{name:'Frames that play',exact:true}).count(),0,'Frame picking stays hidden until Custom…');
  await page.screenshot({path:path.join(out,'frames.png')});
  const other=options.find(name=>name!=='Custom…'&&name!==options[0])||options[0],ready=await read();await frames.selectOption(other);
  const after=await read();assert.equal(await frames.inputValue(),other);if(other!==options[0]||after.undo!==ready.undo)assert.equal(after.undo,ready.undo+1,'Picking a pattern is one undo step');
  await frames.selectOption('Custom…');
  // Own grid and frames.
  await editor.getByRole('button',{name:'Fewer rows',exact:true}).click();const own=(await read()).emitters.find(p=>p.id===sheet.id);assert.equal(own.Rows,sheet.Rows-1);
  const cells=editor.getByRole('listbox',{name:'Frames that play',exact:true}).getByRole('option');await cells.nth(5).scrollIntoViewIfNeeded();const a=await cells.nth(2).boundingBox(),b=await cells.nth(5).boundingBox();
  await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:5});await page.mouse.up();
  const picked=(await read()).emitters.find(p=>p.id===sheet.id);assert.equal(Object.values(picked.life)[0],2);assert.equal(Object.values(picked.decay)[1],6);
  assert.equal(await editor.getByRole('button',{name:'Load own sprite sheet…',exact:true}).count(),0,'No second load button');
  await page.screenshot({path:path.join(out,'own-frames.png')});
  assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,out,frameChoices:options.length}));
 }finally{if(app)await closeApp(app);}
})().then(()=>process.exit(0),error=>{console.error(error);process.exit(1);});
