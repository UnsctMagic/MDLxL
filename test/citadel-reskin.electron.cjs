// A small Footman reskin study made entirely through visible Paint controls.
// This is workflow evidence, not finished-art or beginner usability acceptance.
const { launchApp, closeApp, stubDialogs, sha256File, settle: waitForSettle } = require('./helpers/app.cjs');
const { fixturePath } = require('./helpers/fixtures.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=process.cwd(),fixture=(process.env.MDLXL_PAINT_FIXTURE || fixturePath('citadel-footman')),out=path.resolve(process.env.MDLXL_PAINT_OUT||'out/citadel-audit/demo-'+Date.now());
if(!fixture)throw Error('Set MDLXL_PAINT_FIXTURE to the original Classic Footman.');
fs.mkdirSync(out,{recursive:true});const sourceHash=sha256File(fixture),result={checks:[],errors:[]};let app,page;
const settle=()=>waitForSettle(page, 120),shot=name=>page.screenshot({path:path.join(out,name+'.png')}),idle=async()=>{await page.mouse.move(940,70);await settle();};
const history=()=>page.evaluate(()=>audit().project.history.undo.length),coat=()=>page.evaluate(()=>digest(audit().project.targets[0].coats[0].raster.data));
async function run(){
  ({ app, page, errors: result.errors } = await launchApp({ fixture: fixture, out, pageTimeout: 15000 }));

  await page.locator('[data-hotkey="paint"]').click();await shot('00-start');await page.getByRole('button',{name:'Begin painting',exact:true}).click();await page.locator('.paint-texture-view').waitFor();await page.getByRole('button',{name:'5 starters',exact:true}).click();
  await page.evaluate(()=>{
    window.audit=()=>{const props=findFiberState('.paint-workspace', p => p?.onWorkingModelChange && p?.originalModel, { tree: true, props: true }),viewport=findFiberState('.paint-workspace', p => p?.onPaintStart && p?.paintMode, { tree: true, props: true }),runtime=findFiberState('.paint-workspace', s => s?.renderer && s?.camera, { tree: true });const hover=findFiberState('.paint-workspace', s => s?.entries && s?.parts, { tree: true });return {props,project:props.project,runtime,hover,workingModel:viewport.model};};
    window.pointFor=world=>{const r=audit().runtime,p=r.camera.position.clone().set(...world).project(r.camera),b=r.renderer.domElement.getBoundingClientRect();return [b.x+(p.x+1)*b.width/2,b.y+(1-p.y)*b.height/2];};
    window.digest=async data=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),x=>x.toString(16).padStart(2,'0')).join('');
    window.geometryState=()=>JSON.stringify({geosets:audit().workingModel.Geosets,uv:audit().project.uvEdits,bindings:audit().project.targets.map(t=>t.bindings),dimensions:audit().project.targets.map(t=>[t.base.width,t.base.height])});
  });


  const region=async(rectangles,subtract=false)=>{
    await page.getByRole('button',{name:'Select',exact:true}).click();await page.getByRole('button',{name:'Protect pixels',exact:true}).click();const image=await page.locator('.paint-cutout-image').boundingBox();
    for(let i=0;i<rectangles.length;i++){await page.getByLabel('Selection mode',{exact:true}).selectOption(subtract?'subtract':i?'add':'replace');const [x0,y0,x1,y1]=rectangles[i];await page.mouse.move(image.x+image.width*x0/512,image.y+image.height*y0/512);await page.mouse.down();await page.mouse.move(image.x+image.width*x1/512,image.y+image.height*y1/512,{steps:5});await page.mouse.up();}
    await page.getByRole('button',{name:'Use paint region',exact:true}).click();
  };
  const fullStamp=async()=>{await page.getByRole('button',{name:'Stamp',exact:true}).click();await page.getByRole('button',{name:'Texture',exact:true}).click();await page.getByRole('spinbutton',{name:'Stamp size value',exact:true}).fill('512');const b=await page.locator('.paint-texture-image').boundingBox();await page.mouse.click(b.x+b.width/2,b.y+b.height/2);await idle();await idle();};
  await idle();await page.getByRole('button',{name:'Copy a patch',exact:true}).click();await page.locator('.paint-cutout-image').waitFor();await shot('source');await page.getByRole('button',{name:'Use full texture as source',exact:true}).click();
  await region([[129,224,320,512],[0,258,60,364],[448,258,512,364],[0,0,214,141]],true);
  await page.getByRole('button',{name:'Paint',exact:true}).first().click();await page.getByLabel('Paint color',{exact:true}).fill('#8b753c');await page.getByRole('button',{name:'Fill selection with color',exact:true}).click();await fullStamp();await page.getByRole('button',{name:'Clear selection',exact:true}).click();await idle();await shot('gold-armor');
  await page.getByRole('button',{name:'Select',exact:true}).click();await page.getByRole('button',{name:'Protect pixels',exact:true}).click();await page.getByRole('button',{name:'Polygon lasso',exact:true}).click();let b=await page.locator('.paint-cutout-image').boundingBox();for(const [x,y] of [[2,1],[56,20],[90,41],[105,62],[194,109],[214,133],[205,139],[132,111],[70,76],[29,34]])await page.mouse.click(b.x+b.width*x/512,b.y+b.height*y/512);await page.getByRole('button',{name:'Finish polygon',exact:true}).click();await page.getByRole('button',{name:'Use paint region',exact:true}).click();await page.getByRole('button',{name:'Paint',exact:true}).first().click();await page.getByLabel('Paint color',{exact:true}).fill('#389ed3');await page.getByRole('button',{name:'Fill selection with color',exact:true}).click();await fullStamp();await page.getByRole('button',{name:'Clear selection',exact:true}).click();await idle();await shot('cyan-sword');

  await region([[0,93,76,181],[192,145,338,189],[429,145,512,188]]);await page.getByRole('button',{name:'Footman chainmail',exact:true}).click();await page.getByRole('button',{name:'Full image',exact:true}).click();await page.getByRole('spinbutton',{name:'Stamp size value',exact:true}).fill('170');b=await page.locator('.paint-texture-image').boundingBox();for(const [x,y] of [[38,137],[265,168],[470,167]]){await page.mouse.click(b.x+b.width*x/512,b.y+b.height*y/512);await idle();await idle();}await page.getByRole('button',{name:'Clear selection',exact:true}).click();await idle();await shot('chainmail');
  await page.getByRole('button',{name:'Select',exact:true}).click();await page.getByRole('button',{name:'Part',exact:true}).click();const shield=await page.evaluate(()=>pointFor([14.75,-29,52.26]));await page.mouse.click(...shield);await page.getByRole('button',{name:'Paint',exact:true}).first().click();await page.getByRole('button',{name:'Separate this part',exact:true}).click();await page.getByRole('button',{name:'Riveted plate detail',exact:true}).click();await page.getByRole('button',{name:'Full image',exact:true}).click();await page.getByRole('spinbutton',{name:'Stamp size value',exact:true}).fill('130');await page.mouse.click(...shield);await idle();await page.getByRole('button',{name:'Clear selection',exact:true}).click();await page.getByRole('button',{name:'Paint',exact:true}).first().click();await idle();await shot('gold-footman-demo');
  const saved=path.join(out,'Gold-footman-study.mdlxlpaint');await stubDialogs(app, { save: saved });await page.getByRole('button',{name:'Save project',exact:true}).click();for(let i=0;i<100&&!fs.existsSync(saved);i++)await waitForSettle(page, 100);assert.ok(fs.existsSync(saved));assert.equal(sha256File(fixture),sourceHash);result.checks.push('Gold armor, cyan sword, chainmail sleeves and a different shield created through ordinary copy, mask, fill and stamp controls');assert.deepEqual(result.errors,[]);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));
  console.log(out);
}
run().catch(async error=>{process.exitCode=1;console.error(error);if(page)await shot('failure');}).finally(async()=>{if(app)await closeApp(app);}).then(()=>process.exit(process.exitCode||0),error=>{console.error(error);process.exit(1);});
