// Synthetic mappings exercise actual Electron pointer/preview/commit paths.
// Fixture creation is explicit; no supplied model is rewritten for the test.
const { launchApp, closeApp, settle: waitForSettle } = require('./helpers/app.cjs');

const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=process.cwd(),out=path.resolve(process.env.MDLXL_PAINT_OUT||'out/citadel-audit/surfaces-'+Date.now());
fs.mkdirSync(out,{recursive:true});let app,page;const result={checks:[],errors:[]};
const shot=name=>page.screenshot({path:path.join(out,name+'.png')});
async function fixture(){
  const {createDemoDocument,recalculateExtents,recalculateNormals}=await import('../src/editor-document.js');
  const {encodePaintPng}=await import('../src/paint-project.js'),{createPaintRaster}=await import('../src/paint-raster.js');
  const doc=createDemoDocument(),template=doc.model.Geosets[0];
  const panel=(cx,cz,kind)=>{
    const vertices=[],uv=[],faces=[],steps=kind==='curved'?12:1;
    for(let i=0;i<steps;i++){
      const a=i/steps,b=(i+1)/steps,point=(u,v)=>[cx+(u-.5)*65,kind==='curved'?-22*Math.cos((u-.5)*Math.PI):0,cz+(v-.5)*65];
      for(const [u,v] of [[a,0],[b,0],[a,1],[b,0],[b,1],[a,1]]){
        vertices.push(...point(u,v));
        if(kind==='collapsed')uv.push(.8,.8);
        else if(kind==='stretched')uv.push(.7+u*.002,.05+v*.3);
        else if(kind==='vertical')uv.push(.05+u*.3,.7+v*.002);
        else if(kind==='wrapped')uv.push(-.9+u*.35,1.1+v*.35);
        else if(kind==='seam'){const second=vertices.length/3>3;uv.push((second?.52:.03)+u*.35,.55+v*.35);}
        else uv.push(.03+u*.35,.04+v*.35);
        faces.push(faces.length);
      }
    }
    const geo={...structuredClone(template),Vertices:new Float32Array(vertices),Normals:new Float32Array(vertices.length),Faces:new Uint16Array(faces),TVertices:[new Float32Array(uv)],VertexGroup:new Uint8Array(vertices.length/3),Groups:[[0]],TotalGroupsCount:1,Anims:[],MaterialID:0};
    recalculateNormals(geo);return geo;
  };
  doc.apply('Create surface fixture',['Geosets','GeosetAnims','Textures','Materials','Sequences','Nodes'],m=>{
    m.Geosets=[panel(-90,60,'flat'),panel(0,60,'seam'),panel(90,60,'flat'),panel(-90,-30,'curved'),panel(0,-30,'stretched'),panel(90,-30,'collapsed'),panel(180,60,'flat'),panel(180,-30,'vertical'),panel(270,60,'wrapped')];m.Geosets[6].MaterialID=1;m.Geosets[8].MaterialID=1;
    m.GeosetAnims=[];m.Sequences=[];for(const node of m.Nodes.filter(Boolean)){delete node.Translation;delete node.Rotation;delete node.Scaling;}
    m.Textures=[{Image:'Fixture.png',ReplaceableId:0,Flags:0},{Image:'Other.png',ReplaceableId:0,Flags:3}];m.Materials=[0,1].map(TextureID=>({PriorityPlane:0,RenderMode:0,Layers:[{TextureID,CoordId:0,FilterMode:0,Shading:17,Alpha:1}]}));recalculateExtents(m);
  });
  const raster=createPaintRaster(256,256,[94,108,123,255]);for(let y=0;y<256;y++)for(let x=0;x<256;x++)if(((x>>4)+(y>>4))%2)raster.data.set([129,142,157,255],(y*256+x)*4);
  fs.writeFileSync(path.join(out,'Fixture.png'),await encodePaintPng(raster));const other=createPaintRaster(64,128,[70,112,72,255]);for(let x=0;x<64;x++)other.data.set([212,12,10,255],((128-1)*64+x)*4);fs.writeFileSync(path.join(out,'Other.png'),await encodePaintPng(other));const filename=path.join(out,'Surfaces.mdx');fs.writeFileSync(filename,doc.serialize('mdx'));return filename;
}
async function settle(){await waitForSettle(page, 180);}
async function helpers(){await page.evaluate(()=>{
  window.audit=()=>{const props=findFiberState('.paint-workspace', p => p?.onWorkingModelChange && p?.originalModel, { tree: true, props: true }),viewport=findFiberState('.paint-workspace', p => p?.onPaintStart && p?.paintMode, { tree: true, props: true }),runtime=findFiberState('.paint-workspace', s => s?.renderer && s?.camera, { tree: true });return {props,project:props.project,runtime};};
  window.hashPaint=async data=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),x=>x.toString(16).padStart(2,'0')).join('');
  window.coatHash=()=>hashPaint(audit().props.project.targets[0].coats[0].raster.data);
  window.pointFor=(index,u=.5,v=.5)=>{const a=audit(),g=a.props.model.Geosets[index],x=g.MinimumExtent[0]+(g.MaximumExtent[0]-g.MinimumExtent[0])*u,z=g.MinimumExtent[2]+(g.MaximumExtent[2]-g.MinimumExtent[2])*v,y=index===3?-22*Math.cos((u-.5)*Math.PI):0,p=a.runtime.camera.position.clone().set(x,y,z).project(a.runtime.camera),b=a.runtime.renderer.domElement.getBoundingClientRect();return [b.x+(p.x+1)*b.width/2,b.y+(1-p.y)*b.height/2];};
  window.hoverCoat=()=>findFiberState('.paint-workspace', s => s?.entries && s?.parts, { tree: true }).parts[0].coat.raster.data;
});}
async function placement(index,label,u=.5,v=.5){
  const before=await page.evaluate(()=>coatHash()),point=await page.evaluate(({index,u,v})=>pointFor(index,u,v),{index,u,v});
  await page.mouse.move(...point);await page.mouse.down();await settle();const preview=await page.evaluate(()=>hashPaint(hoverCoat()));assert.notEqual(preview,before,label+' has mapped coverage');assert.equal(await page.evaluate(()=>coatHash()),before);
  await page.screenshot({path:path.join(out,label+'-preview.png')});await page.mouse.up();await settle();assert.equal(await page.evaluate(()=>coatHash()),preview,label+' preview equals committed texels');
  await page.mouse.move(945,490);await page.screenshot({path:path.join(out,label+'-committed.png')});await page.getByRole('button',{name:'Undo paint',exact:true}).click();await settle();assert.equal(await page.evaluate(()=>coatHash()),before);result.checks.push(label+' preview, commit and exact undo');
}
async function run(){
  const model=await fixture();({ app, page, errors: result.errors } = await launchApp({ fixture: model, out, pageTimeout: 15000 }));
  await page.locator('[data-hotkey="paint"]').click();await page.getByRole('button',{name:'Begin painting',exact:true}).click();await page.locator('.paint-texture-view').waitFor();await page.getByRole('button',{name:'5 starters',exact:true}).click();await helpers();await settle();
  await page.getByRole('button',{name:'Pick color from model',exact:true}).click();await page.mouse.click(...await page.evaluate(()=>pointFor(8)));await settle();assert.equal(await page.getByLabel('Paint color',{exact:true}).inputValue(),'#467048');result.checks.push('Model eyedropper samples the repeated pixel rather than the clamped image edge');
  await page.getByRole('button',{name:'Footman chainmail',exact:true}).click();await page.getByRole('spinbutton',{name:'Stamp size value',exact:true}).fill('30');
  for(const [index,label] of [[0,'flat-shared'],[1,'uv-seam'],[3,'curved'],[4,'stretched'],[5,'collapsed']])await placement(index,label);
  const unchanged=await page.evaluate(()=>coatHash()),cameraBefore=await page.evaluate(()=>audit().runtime.camera.quaternion.toArray());const point=await page.evaluate(()=>pointFor(3));await page.mouse.move(...point);await page.keyboard.down('Alt');await page.mouse.down();await page.mouse.move(point[0]+80,point[1]+15,{steps:12});await page.mouse.up();await page.keyboard.up('Alt');await settle();assert.notDeepEqual(await page.evaluate(()=>audit().runtime.camera.quaternion.toArray()),cameraBefore,'Paint Alt-drag must orbit the camera');assert.equal(await page.evaluate(()=>coatHash()),unchanged);// The tilt moves the curved panel's centre below the canvas; its upper part remains visible.
  await placement(3,'curved-after-orbit',.5,.9);
  // Select shared geometry in the same editor and give only that piece its
  // own pixels. The original arrangement is retained, rather than rebaked.
  await page.getByRole('button',{name:'Select',exact:true}).click();await page.getByRole('button',{name:'Geoset',exact:true}).click();await page.mouse.click(...await page.evaluate(()=>pointFor(0)));await page.getByRole('button',{name:'Paint',exact:true}).first().click();await page.mouse.move(940,70);await settle();
  const beforeSeparate=await page.locator('.paint-model-view').screenshot();await page.getByRole('button',{name:'Separate this part',exact:true}).click();await settle();assert.deepEqual(await page.locator('.paint-model-view').screenshot(),beforeSeparate);result.checks.push('Independent shared panel preserves the rendered skin exactly');
  await page.getByRole('button',{name:'Footman chainmail',exact:true}).click();await page.getByRole('spinbutton',{name:'Stamp size value',exact:true}).fill('30');await placement(0,'independent-panel');
  await page.getByRole('button',{name:'Select',exact:true}).click();await page.mouse.click(...await page.evaluate(()=>pointFor(4)));await page.getByRole('button',{name:'Paint',exact:true}).first().click();await page.mouse.move(940,70);await settle();const beforeDetail=await page.locator('.paint-model-view').screenshot();await page.getByRole('button',{name:'Separate this part',exact:true}).click();await settle();assert.deepEqual(await page.locator('.paint-model-view').screenshot(),beforeDetail,'Detail space must preserve the existing stretched skin');await page.getByRole('button',{name:'Footman chainmail',exact:true}).click();await page.getByRole('spinbutton',{name:'Stamp size value',exact:true}).fill('30');await placement(4,'detail-space-stretched');result.checks.push('Compressed selection gains local detail pixels while preserving existing appearance');
  await page.getByRole('button',{name:'Select',exact:true}).click();await page.mouse.click(...await page.evaluate(()=>pointFor(7)));await page.getByRole('button',{name:'Paint',exact:true}).first().click();await page.mouse.move(940,70);await settle();const beforeVertical=await page.locator('.paint-model-view').screenshot();await page.getByRole('button',{name:'Separate this part',exact:true}).click();await settle();assert.deepEqual(await page.locator('.paint-model-view').screenshot(),beforeVertical,'Vertical detail space preserves the original skin');await page.getByRole('button',{name:'Footman chainmail',exact:true}).click();await placement(7,'detail-space-vertical');result.checks.push('Vertically compressed mapping gains detail with unchanged pre-stamp render');
  await page.getByRole('button',{name:'Select',exact:true}).click();await page.mouse.click(...await page.evaluate(()=>pointFor(5)));await page.getByRole('button',{name:'Paint',exact:true}).first().click();await page.mouse.move(940,70);await settle();const beforeCollapsed=await page.locator('.paint-model-view').screenshot();await page.getByRole('button',{name:'Separate this part',exact:true}).click();await settle();assert.deepEqual(await page.locator('.paint-model-view').screenshot(),beforeCollapsed,'Local charts preserve the original constant color');await page.getByRole('button',{name:'Footman chainmail',exact:true}).click();await page.getByRole('spinbutton',{name:'Stamp size value',exact:true}).fill('30');await placement(5,'detail-space-collapsed');result.checks.push('A single-UV-point selection gains a detailed stamp area without changing its pre-stamp render');

  await page.getByRole('button',{name:'Clear selection',exact:true}).click();await page.getByRole('button',{name:'Original',exact:true}).click();await page.getByRole('button',{name:'Footman chainmail',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Original',exact:true}).getAttribute('aria-pressed'),'false');
  const untouched=await page.evaluate(()=>coatHash());await page.mouse.move(...await page.evaluate(()=>pointFor(6)));await page.mouse.down();await settle();assert.match(await page.locator('.paint-texture-heading').innerText(),/Other.*256.*512/);assert.equal(await page.evaluate(()=>audit().props.project.activeTargetId),await page.evaluate(()=>audit().props.project.targets[1].id));await shot('other-texture-preview');
  const otherPreview=await page.evaluate(()=>{const p=audit().props.project,r=findFiberState('.paint-workspace',s=>s?.entries&&s?.parts,{tree:true});return hashPaint(r.parts.find(part=>part.target.id===p.activeTargetId).coat.raster.data);});await page.mouse.up();await settle();assert.equal(await page.evaluate(()=>hashPaint(audit().props.project.targets[1].coats[0].raster.data)),otherPreview);assert.equal(await page.evaluate(()=>coatHash()),untouched);result.checks.push('Choosing a source leaves Original view and stamping a different image target updates the live texture');
  assert.deepEqual(result.errors,[]);console.log(JSON.stringify({out,...result},null,2));fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));
}
run().catch(async error=>{console.error(error);result.failure=error.stack;if(page)await page.screenshot({path:path.join(out,'failure.png')});fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));process.exitCode=1;}).finally(async()=>{if(app)await closeApp(app);});
