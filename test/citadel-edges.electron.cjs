// All edits use ordinary UI input. Fiber access observes project/preview state.
const { launchApp, closeApp, sha256File, settle: waitForSettle } = require('./helpers/app.cjs');
const { fixturePath } = require('./helpers/fixtures.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=process.cwd(),fixture=(process.env.MDLXL_PAINT_FIXTURE || fixturePath('citadel-footman')),out=path.resolve(process.env.MDLXL_PAINT_OUT||'out/citadel-audit/edges-'+Date.now());
if(!fixture)throw Error('Set MDLXL_PAINT_FIXTURE to the original Classic Footman.');
fs.mkdirSync(out,{recursive:true});const sourceHash=sha256File(fixture),result={checks:[],errors:[]};let app,page;
const settle=()=>waitForSettle(page, 120),shot=name=>page.screenshot({path:path.join(out,name+'.png')}),idle=async()=>{await page.mouse.move(940,70);await settle();};
const history=()=>page.evaluate(()=>audit().project.history.undo.length),coat=()=>page.evaluate(()=>digest(audit().project.targets[0].coats[0].raster.data));
async function run(){
  ({ app, page, errors: result.errors } = await launchApp({ fixture: fixture, out, pageTimeout: 15000 }));
  page.on('console',m=>{if(m.type()==='error'&&/shader|WebGLProgram|ReferenceError|TypeError/i.test(m.text()))result.errors.push(m.text());});
  await page.locator('[data-hotkey="paint"]').click();await shot('00-start');await page.getByRole('button',{name:'Begin painting',exact:true}).click();await page.locator('.paint-texture-view').waitFor();
  await page.evaluate(()=>{
    window.audit=()=>{const props=findFiberState('.paint-workspace', p => p?.onWorkingModelChange && p?.originalModel, { tree: true, props: true }),viewport=findFiberState('.paint-workspace', p => p?.onPaintStart && p?.paintMode, { tree: true, props: true }),runtime=findFiberState('.paint-workspace', s => s?.renderer && s?.camera, { tree: true });const hover=findFiberState('.paint-workspace', s => s?.entries && s?.parts, { tree: true });const projection=findFiberState('.paint-workspace', s => s?.pose && s?.entries, { tree: true });return {props,project:props.project,runtime,hover,projection,viewport,model:viewport.model};};
    window.pointFor=world=>{const r=audit().runtime,p=r.camera.position.clone().set(...world).project(r.camera),b=r.renderer.domElement.getBoundingClientRect();return [b.x+(p.x+1)*b.width/2,b.y+(1-p.y)*b.height/2];};
    window.digest=async data=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),x=>x.toString(16).padStart(2,'0')).join('');
    window.geometryState=()=>JSON.stringify({geosets:audit().props.model.Geosets,edits:audit().project.geometryEdits,uv:audit().project.uvEdits,bindings:audit().project.targets.map(t=>t.bindings),dimensions:audit().project.targets.map(t=>[t.base.width,t.base.height])});
  });
  await page.getByRole('button',{name:'5 starters',exact:true}).click();await settle();assert.equal(await page.locator('.paint-shelf-tile').count(),5);assert.deepEqual(await page.evaluate(()=>audit().project.targets.map(t=>[t.base.width,t.base.height])),[[512,512],[128,128]]);await shot('01-editor');


  const b=(name)=>page.getByRole('button',{name,exact:true}),key=async k=>{await page.locator('[aria-label="3D model viewport"]').focus();await page.keyboard.press(k);await settle();};
  const region=()=>page.evaluate(()=>{const r=audit().viewport.paintRegion;return r?.byGeoset?[...r.byGeoset].map(([g,f])=>[g,f.size]):[];}),shield=await page.evaluate(()=>pointFor([14.75,-29,52.26])),sword=await page.evaluate(()=>pointFor([54.9762,20.8331,59.2066]));

  await page.keyboard.down('Shift');await page.mouse.click(...shield);await page.keyboard.up('Shift');await idle();
  const before=await page.evaluate(()=>audit().project.targets.map(t=>t.coats.map(c=>Array.from(c.raster.data))));
  const viewport=await page.locator('.paint-model-view canvas').first().boundingBox(),outside=[viewport.x+12,viewport.y+viewport.height*.5];
  await b('Footman chainmail').click();await page.getByRole('spinbutton',{name:'Stamp size value',exact:true}).fill('1024');await key('.');await key(',');
  const h=await history();await page.mouse.click(...outside);await idle();assert.equal(await history(),h,'Outside click is inactive without R');
  await page.locator('[aria-label="3D model viewport"]').focus();await page.keyboard.down('r');await settle();assert.equal(await page.evaluate(()=>audit().viewport.paintOutside),true);await page.mouse.move(...outside);await shot('01-outside-ready');await page.mouse.click(...outside);await idle();await page.keyboard.up('r');await settle();assert.equal(await page.evaluate(()=>audit().viewport.paintOutside),false);assert.equal(await history(),h+1,'R must stamp from off the model');
  const {paintGeosetMask}=await import('../src/paint-view.js'),{regionPaintTarget}=await import('../src/paint-region.js');
  const snapshot=await page.evaluate(()=>({model:audit().props.model,targets:audit().project.targets,region:[...audit().viewport.paintRegion.byGeoset].map(([g,f])=>[g,[...f]])}));
  // Reconstruct serialized typed arrays after Playwright transfers them.
  const selectedRegion={byGeoset:new Map(snapshot.region.map(([g,f])=>[g,new Set(f)]))};let changed=0;
  for(let ti=0;ti<snapshot.targets.length;ti++){const t=snapshot.targets[ti],mask=paintGeosetMask(snapshot.model,regionPaintTarget(t,selectedRegion,null),t.base.width,t.base.height);for(let ci=0;ci<t.coats.length;ci++)for(let i=0;i<t.coats[ci].raster.data.length;i+=4){if(t.coats[ci].raster.data.slice(i,i+4).some((v,k)=>v!==before[ti][ci][i+k])){changed++;assert.ok(mask[i/4]>0,'Changed pixel must belong to selected faces');}}}
  assert.ok(changed>10);result.checks.push(`Outside stamp changes ${changed} selected pixels and no pixels outside selection`);await shot('02-outside-stamped');await key('Control+z');assert.equal(await history(),h);
  await key('b');await page.getByRole('spinbutton',{name:'Brush size value',exact:true}).fill('1024');await page.getByLabel('Paint color',{exact:true}).fill('#ec1749');await page.locator('[aria-label="3D model viewport"]').focus();await page.keyboard.down('r');await settle();await page.mouse.click(...outside);await page.keyboard.up('r');await idle();assert.equal(await history(),h+1);await key('Control+z');result.checks.push('Outside brush works and remains one undoable stroke');
  await key('Control+d');await key('0');const image=page.locator('.paint-texture-image'),box=await image.boundingBox();await page.getByRole('spinbutton',{name:'Brush size value',exact:true}).fill('100');await page.locator('[aria-label="3D model viewport"]').focus();await page.keyboard.down('r');await settle();const ht=await history();await page.mouse.click(box.x+box.width+8,box.y+box.height*.5);await page.keyboard.up('r');await idle();assert.equal(await history(),ht+1);await key('Control+z');result.checks.push('R permits a partial brush from the texture margin');
  await b('Copy a patch').click();await page.getByRole('button',{name:'Polygon lasso',exact:true}).click();const cut=page.locator('.paint-cutout-image'),cb=await cut.boundingBox();const p=[[40,40],[180,70],[120,170]];for(const [x,y] of p)await page.mouse.click(cb.x+x,cb.y+y);await page.mouse.move(cb.x+65,cb.y+190);await settle();assert.equal(await cut.locator('circle').count(),3);assert.equal(await cut.locator('.paint-selection-closing').count(),1);await shot('03-polygon-live');await page.keyboard.press('Backspace');assert.equal(await cut.locator('circle').count(),2);await page.mouse.click(cb.x+120,cb.y+170);await page.mouse.click(cb.x+40,cb.y+40);await settle();assert.equal(await cut.locator('circle').count(),0);assert.ok((await page.locator('.paint-selection-guide').innerText()).includes('selected'));await shot('04-polygon-finished');result.checks.push('Polygon shows numbered corners and closing edge; Backspace removes a point; first corner finishes');
  // "Enter to finish": the user clicks three corners on the image (focus stays where those clicks leave it) and presses Enter.
  const guide=page.locator('.paint-selection-guide'),cutoutWindow=page.getByRole('dialog',{name:'Texture cutout',exact:true}),at=(fx,fy)=>[cb.x+cb.width*fx,cb.y+cb.height*fy];
  const firstSelection=await guide.innerText();
  for(const [fx,fy] of [[.15,.5],[.7,.55],[.45,.9]])await page.mouse.click(...at(fx,fy));await settle();
  assert.equal(await cut.locator('circle').count(),3);assert.match(await guide.innerText(),/Esc cancels the outline/,'an open outline says Esc cancels it');
  await page.keyboard.press('Enter');await settle();
  assert.equal(await cut.locator('circle').count(),0,'Enter finishes the open outline');assert.notEqual(await guide.innerText(),firstSelection,'Enter makes the new outline the selection');
  result.checks.push('Polygon: click corners, Enter finishes the outline');
  // "Esc cancels the outline": two corners clicked, Esc drops them and leaves the cutout window and selection as they were.
  const kept=await guide.innerText();
  for(const [fx,fy] of [[.1,.1],[.4,.15]])await page.mouse.click(...at(fx,fy));await settle();assert.equal(await cut.locator('circle').count(),2);
  await page.keyboard.press('Escape');await settle();
  assert.equal(await cut.locator('circle').count(),0,'Esc cancels the open outline');assert.equal(await cutoutWindow.count(),1,'Esc with an open outline keeps the cutout window open');assert.equal(await guide.innerText(),kept,'Esc leaves the selection unchanged');
  result.checks.push('Polygon: Esc cancels an open outline and keeps the window');
  await page.keyboard.press('Escape');await cutoutWindow.waitFor({state:'detached'});
  // Paint UVs "Apply to mesh · Enter": click UVs, click the Scale field, type 50, press Enter.
  const view=page.locator('.paint-texture-view'),uvState=()=>page.evaluate(()=>JSON.stringify(audit().project.uvEdits));
  await view.getByRole('button',{name:'Adjust mapping',exact:true}).click();await settle();
  const scaleField=view.getByRole('spinbutton',{name:'Scale'}),uvBefore=await uvState();
  await scaleField.click();await page.keyboard.press('Control+a');await page.keyboard.type('50');await page.keyboard.press('Enter');await settle();
  const uvScaled=await uvState();assert.notEqual(uvScaled,uvBefore,'Enter in the Scale field applies the scale to the mesh');assert.equal(await scaleField.inputValue(),'100','applying resets the Scale field');
  result.checks.push('Paint UVs: typing a scale and pressing Enter applies it');
  // Same with the angle, after the user's last click was on the texture itself (not in a field).
  const angleField=view.getByRole('spinbutton',{name:'Angle'});await angleField.click();await page.keyboard.press('Control+a');await page.keyboard.type('30');
  const tex=await page.locator('.paint-texture-image').boundingBox();await page.mouse.click(tex.x+tex.width*.5,tex.y+tex.height*.5);await settle();
  const uvClicked=await uvState();await page.keyboard.press('Enter');await settle();
  assert.notEqual(await uvState(),uvClicked,'after clicking the texture, Enter still applies the typed angle (focus: '+await page.evaluate(()=>document.activeElement?.tagName+'.'+document.activeElement?.className)+')');
  result.checks.push('Paint UVs: after a click on the texture, Enter applies the typed angle');
  await view.getByRole('button',{name:'Adjust mapping',exact:true}).click();await settle();
  assert.deepEqual(result.errors,[]);console.log(JSON.stringify({out,...result},null,2));
}
run().catch(async error=>{result.failure=error.stack;console.error(error);if(page){console.error((await page.locator('body').innerText()).slice(-4000));await shot('failure');}process.exitCode=1;}).finally(async()=>{fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));if(app)await closeApp(app);});
