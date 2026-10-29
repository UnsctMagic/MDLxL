// All edits use ordinary UI input. Fiber access observes project/preview state.
const { launchApp, closeApp, sha256File, settle: waitForSettle } = require('./helpers/app.cjs');
const { fixturePath } = require('./helpers/fixtures.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=process.cwd(),fixture=(process.env.MDLXL_PAINT_FIXTURE || fixturePath('citadel-footman')),out=path.resolve(process.env.MDLXL_PAINT_OUT||'out/citadel-audit/locales-'+Date.now());
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

  const {translate}=await import('../src/localization.js'),seen=new Set();
  const collect=async()=>{for(const t of await page.locator('.paint-workspace').evaluate(e=>{const walk=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);const text=[];while(walk.nextNode()){const n=walk.currentNode;if(n.parentElement?.closest('kbd,code,pre,[translate="no"]'))continue;if(n.parentElement?.getClientRects().length&&n.textContent.trim())text.push(n.textContent.trim());}return text;}))seen.add(t);};
  async function language(locale){await page.locator('.language-trigger').click();await page.getByRole('option',{name:({en:'English',ru:'Russian',es:'Spanish',zh:'Chinese',mordor:'The Language of Mordor'})[locale],exact:true}).click();await settle();}
  for(const locale of ['en','ru','es','zh','mordor']){
    await language(locale);const button=name=>page.getByRole('button',{name:translate(name,locale),exact:true}).first();
    await button('Paint').click();await button('Related colors').click();await shot(locale+'-paint');if(locale==='en')await collect();
    await button('Help').click();await shot(locale+'-shortcuts');if(locale==='en')await collect();await page.keyboard.press('Escape');
    await button('Footman chainmail').click();await shot(locale+'-stamp');if(locale==='en')await collect();
    await button('Cut out').click();await page.locator('.paint-cutout-toolbar button[aria-pressed]').nth(3).click();await shot(locale+'-cutout');if(locale==='en')await collect();await page.keyboard.press('Escape');
    assert.equal(await page.locator('.paint-modal-shade').count(),0);await button('Protect pixels').click();await shot(locale+'-mask');if(locale==='en')await collect();await page.keyboard.press('Escape');
    result.checks.push(locale+': paint, stamp, help, cutout and protected-pixel dialogs render and accept input');
  }
  await language('en');await b('New…').click();await b('Discard and start new').click();await collect();await shot('en-start');
  for(const locale of ['ru','es','zh']){await language(locale);await shot(locale+'-start');}
  result.untranslated=[...seen].filter(s=>/[a-z]{2}/i.test(s)&&['ru','es','zh'].some(l=>translate(s,l)===s));
  assert.deepEqual(result.errors,[]);console.log(JSON.stringify({out,...result},null,2));
}
run().catch(async error=>{result.failure=error.stack;console.error(error);if(page){console.error((await page.locator('body').innerText()).slice(-4000));await shot('failure');}process.exitCode=1;}).finally(async()=>{fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));if(app)await closeApp(app);});
