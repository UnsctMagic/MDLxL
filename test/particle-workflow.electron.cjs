const {openEffectCollection}=require('./helpers/library-browser.cjs');
const { waitForInfo } = require('./helpers/app.cjs');
const { launchApp, closeApp } = require('./helpers/app.cjs');

const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {ParticleLibrary}=require('../electron/particle-library.cjs');
(async()=>{
 const root=process.cwd(),out=path.join(root,'out','particle-prototype','workflow-'+Date.now()),profile=path.join(out,'profile');
 await fs.mkdir(profile,{recursive:true});
 const {createStarterRecipe}=await import('../src/particle-starters.js'),{stringifyParticleData}=await import('../src/particle-data.js');
 const {createDemoDocument}=await import('../src/editor-document.js'),fixture=path.join(out,'placement-target.mdx'),fixtureBytes=Buffer.from(createDemoDocument().serialize('mdx'));await fs.writeFile(fixture,fixtureBytes);
 const store=new ParticleLibrary({directory:path.join(profile,'particles'),discover:async()=>({cascFolders:[]})});
 const picture='data:image/png;base64,'+(await fs.readFile('public/classic/btn-mana-flare.png')).toString('base64');
 for(let i=0;i<41;i++){
  const saved=await store.save({data:stringifyParticleData(createStarterRecipe()),name:'Effect '+String(i).padStart(2,'0')});
  const {revision}=(await store.thumbnails([saved.id]))[saved.id];await store.thumbnail({id:saved.id,revision,url:picture});
 }
 const cardName=(await store.catalog()).items.filter(item=>item.collection==='My presets').at(-1).name;
 await store.close();let app;const errors=[];
 try{
  const launched = await launchApp({ out, fixture, profile, errors, timeout: 60000, bounds: { x: -3000, y: 0, width: 1400, height: 920 }, show: 'inactive', pageTimeout: 15000 }); app = launched.app;
  const page=launched.page;

  const shortcut=page.getByRole('button',{name:'Emitter Editor',exact:true});await shortcut.waitFor();
  await waitForInfo(page, 'Opened placement-target.mdx');
  await page.getByRole('button',{name:'Movement',exact:true}).click();await page.getByLabel('Movement current sequence',{exact:true}).selectOption('0');
  await page.getByLabel('Movement bone or node',{exact:true}).selectOption('0');
  await page.getByLabel('Current animation frame',{exact:true}).fill('350');await page.getByLabel('Current animation frame',{exact:true}).press('Enter');
  assert.equal(await shortcut.locator('img').getAttribute('src'),'./classic/btn-mana-flare.png');
  assert.deepEqual(await shortcut.locator('b').evaluateAll(els=>els.map(el=>[el.textContent,getComputedStyle(el).color])),['E','M','T','R'].map(letter=>[letter,'rgb(95, 224, 207)']));
  await shortcut.click();const dialog=page.getByRole('dialog',{name:'Particle Editor',exact:true});await dialog.waitFor();
  await openEffectCollection(page,'My presets');
  const tree=page.locator('.pe-library .gf-tree');
  const firstRecipe=tree.locator('[data-effect-id][data-row^="My presets/"]').first();
  await firstRecipe.click();
  await page.waitForFunction(()=>!!document.querySelector('.pe-library .gf-row.focused[data-effect-id]'));
  for(let i=0;i<40;i++){
    const prior=await tree.locator('.gf-row.focused').getAttribute('data-row');await page.keyboard.press('ArrowDown');
    await page.waitForFunction(prior=>document.querySelector('.pe-library .gf-row.focused')?.dataset.row!==prior,prior);
  }
  assert.ok(await tree.evaluate(e=>e.scrollTop)>0,'Keyboard browsing reaches a late virtualized recipe');
  const last=page.locator('.pe-library [data-effect-id][data-row^="My presets/"]').filter({hasText:cardName});
  await last.locator('img').waitFor();const before=await last.locator('img').getAttribute('src');
  await last.click();const favorite=page.getByRole('button',{name:'Favorite '+cardName,exact:true});
  await favorite.click();await page.waitForFunction(name=>document.querySelector('[aria-label="Favorite '+name+'"]').getAttribute('aria-pressed')==='true',cardName);
  assert.equal(await last.locator('img').getAttribute('src'),before,'Favorite keeps a late-list thumbnail');
  await page.getByLabel('Effect tags',{exact:true}).fill('favorite test');await page.getByLabel('Effect tags',{exact:true}).press('Tab');
  await last.locator('img').waitFor();assert.equal(await last.locator('img').getAttribute('src'),before,'Metadata refresh keeps the virtualized thumbnail');
  await page.screenshot({path:path.join(out,'favorites.png')});
  await last.dblclick();await page.locator('.pe-library').waitFor({state:'hidden'});
  const size=page.getByRole('spinbutton',{name:'Halfway size',exact:true});await size.fill(String(Number(await size.inputValue())+25));await size.press('Enter');const edited=await size.inputValue();
  const readLab=()=>page.evaluate(()=>{let f=document.querySelector('.pe-window');{ const v = findFiberState(f, v => v?.doc?.model&&v?.recipe); if (v) return {key:v.key,undo:v.doc.historyStats.undoSteps,scaling:Array.from(v.doc.model.ParticleEmitters2[0].ParticleScaling)}; }throw Error('Lab missing');});
  const first=await readLab();assert.ok(first.undo>0);
  await dialog.getByRole('button',{name:'Library',exact:true}).click();await openEffectCollection(page,'My presets');
  const next=page.locator('.pe-library [data-effect-id][data-row^="My presets/"]').filter({hasNotText:cardName}).first();await next.dblclick();await page.locator('.pe-library').waitFor({state:'hidden'});
  assert.equal(await page.getByText('Keep the edited Lab effect?',{exact:true}).count(),0);
  assert.notEqual((await readLab()).key,first.key);
  await dialog.getByRole('button',{name:'Library',exact:true}).click();await openEffectCollection(page,'My presets');await page.getByLabel('Find an effect',{exact:true}).fill(cardName);
  await page.locator('.pe-library [data-effect-id][data-row^="My presets/"]').filter({hasText:cardName}).dblclick();await page.locator('.pe-library').waitFor({state:'hidden'});
  const fresh=await readLab();assert.notEqual(fresh.key,first.key);assert.equal(fresh.undo,0);assert.notDeepEqual(fresh.scaling,first.scaling,'Selecting a preset starts from its saved values');
  await dialog.getByRole('button',{name:'Library',exact:true}).click();await openEffectCollection(page,'My work');
  await page.locator('.pe-library [data-effect-id][data-row^="My work/"]').filter({hasText:cardName}).last().dblclick();await page.locator('.pe-library').waitFor({state:'hidden'});
  const resumed=await readLab();assert.equal(resumed.undo,first.undo);assert.deepEqual(resumed.scaling,first.scaling,'My work resumes edited values and undo');
  assert.equal(await size.inputValue(),edited);
  await dialog.getByRole('button',{name:'Undo',exact:true}).click();assert.notEqual(await size.inputValue(),edited);
  await dialog.getByRole('button',{name:'New',exact:true}).click();await page.getByRole('button',{name:'Soft smoke',exact:true}).click();
  await page.waitForFunction(()=>{let el=document.querySelector('.pe-window');{ const state = findFiberState(el, state => state?.recipe?.name==='MDLxL starter · Soft smoke'); if (state) return true; }return false;});
  await size.fill(String(Number(await size.inputValue())+25));await size.press('Enter');const newWork=await readLab();
  await dialog.getByRole('button',{name:'Library',exact:true}).click();await openEffectCollection(page,'My work');
  await page.locator('.pe-library [data-effect-id][data-row^="My work/"]').filter({hasText:'MDLxL starter · Soft smoke'}).locator('img').waitFor();
  await page.locator('.pe-library [data-effect-id][data-row^="My work/"]').filter({hasNotText:'MDLxL starter · Soft smoke'}).first().dblclick();await page.locator('.pe-library').waitFor({state:'hidden'});
  await dialog.getByRole('button',{name:'Library',exact:true}).click();await openEffectCollection(page,'My work');await page.locator('.pe-library [data-effect-id][data-row^="My work/"]').filter({hasText:'MDLxL starter · Soft smoke'}).dblclick();await page.locator('.pe-library').waitFor({state:'hidden'});
  const recoveredWork=await readLab();assert.equal(recoveredWork.undo,newWork.undo);assert.deepEqual(recoveredWork.scaling,newWork.scaling);await dialog.getByRole('button',{name:'Undo',exact:true}).click();assert.notDeepEqual((await readLab()).scaling,newWork.scaling);
  await dialog.getByRole('button',{name:'Remove',exact:true}).click();await dialog.getByRole('button',{name:'Library',exact:true}).click();await openEffectCollection(page,'My work');
  const emptyCard=page.locator('.pe-library [data-effect-id][data-row^="My work/"]').filter({hasText:'MDLxL starter · Soft smoke'});await emptyCard.getByText('Empty effect',{exact:true}).waitFor();await emptyCard.dblclick();await page.locator('.pe-library').waitFor({state:'hidden'});
  assert.equal(await page.getByRole('spinbutton',{name:'Halfway size',exact:true}).count(),0);await dialog.getByRole('button',{name:'Undo',exact:true}).click();await page.getByRole('spinbutton',{name:'Halfway size',exact:true}).waitFor();
  await page.getByRole('button',{name:'Pause',exact:true}).click();
  const move=page.getByRole('slider',{name:'Move emitter',exact:true});await move.waitFor();const moveBox=await move.locator('circle').boundingBox();
  const readPosition=()=>page.evaluate(()=>{let el=document.querySelector('.pe-window');{ const v = findFiberState(el, v => v?.doc?.model&&v?.recipe); if (v) return {translation:JSON.parse(JSON.stringify(v.doc.model.ParticleEmitters2[0].Translation||null)),undo:v.doc.historyStats.undoSteps,count:v.doc.model.ParticleEmitters2.length}; }throw Error('Lab missing');});
  const beforeMove=await readPosition();await page.mouse.move(moveBox.x+7,moveBox.y+7);await page.mouse.down();await page.mouse.move(moveBox.x+42,moveBox.y-18,{steps:5});await page.mouse.up();
  const afterMove=await readPosition();assert.ok(afterMove.translation.Keys.length);assert.equal(afterMove.undo,beforeMove.undo+1);
  await dialog.getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual(await readPosition(),beforeMove);
  assert.equal(await page.getByRole('slider',{name:/^Resize particle/}).count(),4);
  await dialog.getByRole('button',{name:'Add',exact:true}).click();await openEffectCollection(page,'My presets');await page.locator('.pe-library [data-effect-id][data-row^="My presets/"]').first().dblclick();await page.locator('.pe-library').waitFor({state:'hidden'});
  assert.equal((await readPosition()).count,2);await dialog.getByRole('button',{name:'Remove',exact:true}).click();assert.equal((await readPosition()).count,1);
  await dialog.getByRole('button',{name:'Undo',exact:true}).click();assert.equal((await readPosition()).count,2);
  await dialog.getByRole('button',{name:'Undo',exact:true}).click();assert.equal((await readPosition()).count,1);
  await page.screenshot({path:path.join(out,'direct-edit.png')});
  const readModel=()=>page.evaluate(()=>{let el=document.querySelector('.pe-window')||document.querySelector('.movement-controller');{ const props = findFiberState(el, props => { const model = props?.doc?.model||props?.model; return model?.Nodes; }, { props: true }); if (props) { const model = props?.doc?.model||props?.model; return JSON.parse(JSON.stringify(model)); } }throw Error('Model missing');});
  const beforeModel=await readModel();
  await dialog.getByRole('button',{name:'Add to model',exact:true}).click();
  const visibility=page.locator('.pe-ribbon-sequences input');assert.equal(await visibility.count(),beforeModel.Sequences.length);
  for(let i=0;i<beforeModel.Sequences.length;i++){if(i===0)await visibility.nth(i).check();else await visibility.nth(i).uncheck();}
  assert.equal(await page.getByLabel('Effect start',{exact:true}).count(),0,'Full checked animations replace partial start/end placement');
  await dialog.locator('.pe-placement').getByRole('button',{name:'Create',exact:true}).click();await page.getByText('Effect added. Drag it to adjust.',{exact:true}).waitFor();
  const placed=await readModel(),emitter=placed.ParticleEmitters2[0];assert.equal(placed.Helpers.find(n=>n.ObjectId===emitter.Parent).Parent,0,'The preserved recipe helper belongs to the selected bone');
  for(const [i,clip]of placed.Sequences.entries())for(const frame of Object.values(clip.Interval))assert.equal(emitter.Visibility.Keys.find(k=>k.Frame===frame).Vector[0],i===0?1:0,'Checked full-clip visibility is authored at both endpoints');
  assert.deepEqual(placed.Geosets,beforeModel.Geosets);assert.deepEqual(placed.Bones,beforeModel.Bones);
  await page.getByRole('button',{name:'Close Particle Editor',exact:true}).click();
  const visible=page.getByRole('checkbox',{name:'Emitter visible at current frame',exact:true});await visible.waitFor();assert.equal(await visible.isChecked(),true);
  await visible.uncheck();const hidden=await readModel();assert.equal(hidden.ParticleEmitters2[0].Visibility.Keys.find(k=>k.Frame===350).Vector[0],0);
  assert.deepEqual(hidden.ParticleEmitters2[0].SegmentColor,emitter.SegmentColor,'Main visibility never changes RGB');
  await page.screenshot({path:path.join(out,'movement-marker.png')});
  await page.getByRole('button',{name:'Edit effect',exact:true}).click();assert.equal(await page.getByLabel('Particle context',{exact:true}).inputValue(),'On model');
  await dialog.getByRole('button',{name:'Remove',exact:true}).click();assert.equal((await readModel()).ParticleEmitters2.length,0);
  await dialog.getByRole('button',{name:'Undo',exact:true}).click();assert.deepEqual((await readModel()).ParticleEmitters2,hidden.ParticleEmitters2);
  await page.screenshot({path:path.join(out,'on-model.png')});
  assert.deepEqual(await fs.readFile(fixture),fixtureBytes);assert.deepEqual(errors,[]);console.log('EMTR, favorites, direct editing and recovery, checked full-animation visibility, main visibility and unchanged source passed.');
 }catch(error){if(app){const page=await app.firstWindow();console.error((await page.locator('body').innerText()).slice(-1600));await page.screenshot({path:path.join(out,'failure.png')});}throw error;}
 finally{if(app)await closeApp(app);}
})().catch(error=>{console.error(error);process.exit(1);});
