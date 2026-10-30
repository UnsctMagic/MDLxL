const { sha256File } = require('./helpers/app.cjs');
const { launchApp, closeApp, settle: settlePage } = require('./helpers/app.cjs');
// Rebuilt Electron regression; optional MDLXL_BILLBOARD_MODEL is read-only input.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const hash = sha256File;
const near = (actual, expected, label, tolerance = .003) => actual.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < tolerance, `${label}: ${actual} != ${expected}`));
(async () => {
  const { ObjectLoader, Vector3 } = await import('three');
  const { projectedPlaneTranslation, planeScreenBasis, screenPlaneTranslation } = await import('../app/viewport-math.js');
  const out = path.resolve(process.env.MDLXL_BILLBOARD_OUT || 'out/movement-billboard'); fs.mkdirSync(out, {recursive:true});
  let fixture = process.env.MDLXL_BILLBOARD_MODEL;
  if (!fixture) {
    const {createStarterDocument} = await import('../src/starter-model.js'), {createNode} = await import('../src/editor-document.js');
    const doc = createStarterDocument();
    doc.apply('Billboard movement fixture',['Nodes','PivotPoints','Sequences'],model=>{
      model.Sequences = [{Name:'Stand',Interval:new Uint32Array([100,1000]),MoveSpeed:0,NonLooping:false,Rarity:0}];
      const parent = createNode(model,'Bone'); parent.Name='Camera-facing parent'; parent.Parent=0; parent.Flags|=8;
      parent.PivotPoint=model.PivotPoints[parent.ObjectId]=new Float32Array([0,0,20]);model.Geosets[0].Groups=[[parent.ObjectId]];
      const emitter=createNode(model,'ParticleEmitter2'); emitter.Name='Billboard child emitter'; emitter.Parent=parent.ObjectId;
      emitter.PivotPoint=model.PivotPoints[emitter.ObjectId]=new Float32Array([25,12,32]);
    });
    fixture=path.join(out,'movement-billboard.mdx');fs.writeFileSync(fixture,Buffer.from(doc.serialize('mdx')));
  }
  const originalHash=hash(fixture), errors=[],checks=[],measurements=[];
  const { app, page } = await launchApp({ out: out, profile: path.join(out,'profile-'+Date.now()), env: { MDLVIS_HEADLESS:'1' }, timeout: 60000, fixture: fixture , errors, pageTimeout: 20000, bounds: {x:-3000,y:0,width:1280,height:900}, show: 'inactive' });
  try {

    await page.locator('[aria-label="3D model viewport"] canvas').first().waitFor({timeout:60000});
    const vertexSample=()=>page.evaluate(()=>{const root=document.querySelector('[aria-label="3D model viewport"]');{ const runtime = findFiberState(root, runtime => runtime?.renderer&&runtime?.entries); if (runtime?.renderer&&runtime?.entries) {const rect=runtime.renderer.domElement.getBoundingClientRect();return{vertices:runtime.entries.map(entry=>Array.from(entry.geometry.attributes.position.array)),camera:runtime.controls.object.toJSON(),rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height}};} }
throw Error('Vertex runtime not ready');});
    await settlePage(page, 250);const vertexBefore=await vertexSample(),v=vertexBefore.rect;
    await page.keyboard.down('Alt');await page.mouse.move(v.x+v.width-80,v.y+v.height-80);await page.mouse.down();await page.mouse.move(v.x+v.width-140,v.y+v.height-100,{steps:5});await page.mouse.up();await page.keyboard.up('Alt');await settlePage(page, 250);
    const vertexAfter=await vertexSample();assert.notDeepEqual(vertexAfter.camera,vertexBefore.camera,'vertex editor mouse camera rotates');assert.deepEqual(vertexAfter.vertices,vertexBefore.vertices,'vertex geometry stays fixed while editing billboard-bound mesh');checks.push('vertex editor geometry stays fixed across camera rotation');
    await page.locator('[data-hotkey="animation"]').click();
    await page.locator('[data-clean-model-canvas]').waitFor({timeout:60000});
    await page.evaluate(()=>{
      window.movementProbe=()=>{
        const {runtime,props,session}=mdlxlProbe();
        if(!runtime||!props||!session)throw Error('Movement owners not ready');return{runtime,props,session};
      };
      window.movementSample=()=>{
        const {runtime,props,session}=movementProbe(),canvas=document.querySelector('[data-clean-model-canvas]'),rect=canvas.getBoundingClientRect(),id=props.selectedNodeIds.at(-1)??window.billboardSubjectId,entry=runtime.native.rendererData.nodes.find(entry=>entry?.node.ObjectId===id),matrix=entry.matrix,p=entry.node.PivotPoint;
        const world=[matrix[0]*p[0]+matrix[4]*p[1]+matrix[8]*p[2]+matrix[12],matrix[1]*p[0]+matrix[5]*p[1]+matrix[9]*p[2]+matrix[13],matrix[2]*p[0]+matrix[6]*p[1]+matrix[10]*p[2]+matrix[14]];
        return{id,world,nodeMatrices:runtime.native.rendererData.nodes.map(entry=>entry?.matrix?Array.from(entry.matrix):null),nativeFlags:runtime.native.rendererData.nodes.map(entry=>entry?.node.Flags),sourceFlags:session.doc.model.Nodes.map(node=>node?.Flags),camera:runtime.controls.object.toJSON(),rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},sensitivity:props.preferences.pointerSensitivity??1,model:JSON.stringify(session.doc.model),scope:JSON.stringify(session.doc.model,function(key,value){if(this.ObjectId===id&&key===(props.restPose?'PivotPoint':'Translation'))return undefined;if(props.restPose&&this===session.doc.model.PivotPoints&&key===String(id))return null;return value;}),undo:session.doc.historyStats.undoSteps};
      };
    });
    await page.waitForFunction(()=>{try{return movementProbe().runtime.captureApi?.isReady;}catch{return false;}},{timeout:60000});
    const choice=await page.evaluate(()=>{const {props}=movementProbe();return{id:props.model.ParticleEmitters2.find(node=>/shockwaves|Billboard child emitter/i.test(node.Name))?.ObjectId,sequence:Math.max(0,props.model.Sequences.findIndex(s=>s.Name==='Spell'))};});assert.ok(Number.isInteger(choice.id));await page.evaluate(id=>window.billboardSubjectId=id,choice.id);
    await page.getByLabel('Movement current sequence').selectOption(String(choice.sequence));
    await page.getByLabel('Movement bone or node').selectOption(String(choice.id));
    await page.getByRole('group',{name:'Movement tool',exact:true}).getByRole('button',{name:'Move',exact:true}).click();
    await page.getByLabel('View direction',{exact:true}).selectOption('perspective');
    await page.getByRole('button',{name:'Fit',exact:true}).click();
    const settle=()=>settlePage(page, 220),sample=()=>page.evaluate(()=>movementSample());
    const undo=async()=>{await page.keyboard.press('Control+z');await settle();},redo=async()=>{await page.keyboard.press('Control+y');await settle();};
    await page.getByLabel('Workplane',{exact:true}).check();await settle();
    async function drag(plane,cancel=false){
      if(plane)await page.getByRole('group',{name:'Movement workplane',exact:true}).getByLabel(({xy:'XY',xz:'ZX',yz:'YZ'})[plane],{exact:true}).check();
      await settle();const before=await sample(),camera=new ObjectLoader().parse(before.camera);camera.updateMatrixWorld(true);camera.updateProjectionMatrix();
      const world=new Vector3().fromArray(before.world),projected=world.clone().project(camera),x=before.rect.x+(projected.x+1)*before.rect.width/2,y=before.rect.y+(1-projected.y)*before.rect.height/2,dx=11,dy=-8;
      const expected=plane?projectedPlaneTranslation(plane,planeScreenBasis(camera,world,before.rect.width,before.rect.height,plane),dx*before.sensitivity,dy*before.sensitivity):screenPlaneTranslation(camera,world,before.rect.width,before.rect.height,dx*before.sensitivity,dy*before.sensitivity).toArray();
      await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:4});await settle();
      const live=await sample(),delta=live.world.map((value,i)=>value-before.world[i]);
      measurements.push({plane:plane||'free',cancel,expected,liveDelta:delta});near(delta,expected,'live '+plane);
      if(cancel)await page.locator('[data-clean-model-canvas]').dispatchEvent('pointercancel',{pointerId:1});
      await page.mouse.up();await settle();const after=await sample();
      if(cancel){assert.ok(after.model===before.model,'cancel restores all model data');assert.equal(after.undo,before.undo);}
      else{near(after.world,live.world,'release stays at live position');assert.ok(after.scope===before.scope,'only selected emitter position channel changes');assert.equal(after.undo,before.undo+1,'one Undo per drag');await undo();assert.ok((await sample()).model===before.model,'exact Undo');await redo();assert.ok((await sample()).model===after.model,'exact Redo');await undo();}
      checks.push((cancel?'cancel ':'drag ')+(plane||'free'));
    }
    // Keep two consecutive edits, then orbit: camera motion must not undo placement.
    await page.getByLabel('Workplane',{exact:true}).uncheck();await settle();
    for(const [dx,dy] of [[-28,0],[0,24]]){
      const before=await sample(),camera=new ObjectLoader().parse(before.camera);camera.updateMatrixWorld(true);const screen=new Vector3().fromArray(before.world).project(camera),x=before.rect.x+(screen.x+1)*before.rect.width/2,y=before.rect.y+(1-screen.y)*before.rect.height/2;
      await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:4});await page.mouse.up();await settle();
      const after=await sample(),projected=new Vector3().fromArray(after.world).project(camera);
      assert.ok(Math.abs((projected.x-screen.x)*before.rect.width/2-dx*before.sensitivity)<.15,'horizontal drag follows the mouse');
      assert.ok(Math.abs((screen.y-projected.y)*before.rect.height/2-dy*before.sensitivity)<.15,'vertical drag follows the mouse');
    }
    const placed=await sample();
    await page.keyboard.down('Alt');await page.mouse.move(placed.rect.x+placed.rect.width-100,placed.rect.y+placed.rect.height-100);await page.mouse.down();await page.mouse.move(placed.rect.x+placed.rect.width-180,placed.rect.y+placed.rect.height-130,{steps:5});await page.mouse.up();await page.keyboard.up('Alt');await settle();
    near((await sample()).world,placed.world,'camera rotation preserves the two-drag placement');
    assert.ok((await sample()).model===placed.model,'camera rotation writes no model data');
    assert.deepEqual((await sample()).nodeMatrices,placed.nodeMatrices,'all editing node matrices stay fixed across orbit');
    assert.deepEqual((await sample()).sourceFlags,placed.sourceFlags,'authored billboard flags stay intact');
    checks.push('left then down then camera rotation keeps placement');
    // Continue in the new view and orbit once more without correcting the first edits.
    for(const [dx,dy]of [[21,0],[0,-18]]){
      const before=await sample(),camera=new ObjectLoader().parse(before.camera);camera.updateMatrixWorld(true);const screen=new Vector3().fromArray(before.world).project(camera),x=before.rect.x+(screen.x+1)*before.rect.width/2,y=before.rect.y+(1-screen.y)*before.rect.height/2;
      await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:4});await page.mouse.up();await settle();
      const after=await sample(),end=new Vector3().fromArray(after.world).project(camera);
      assert.ok(Math.abs((end.x-screen.x)*before.rect.width/2-dx*before.sensitivity)<.15);assert.ok(Math.abs((screen.y-end.y)*before.rect.height/2-dy*before.sensitivity)<.15);
    }
    const continued=await sample();await page.keyboard.down('Alt');await page.mouse.move(continued.rect.x+continued.rect.width-100,continued.rect.y+continued.rect.height-100);await page.mouse.down();await page.mouse.move(continued.rect.x+continued.rect.width-170,continued.rect.y+continued.rect.height-120,{steps:5});await page.mouse.up();await page.keyboard.up('Alt');await settle();
    near((await sample()).world,continued.world,'continued placement survives the next camera orbit');checks.push('rotate then right then up then rotate keeps placement');
    for(let i=0;i<4;i++)await undo();await page.getByLabel('Workplane',{exact:true}).check();
    for(let view=0;view<2;view++){
      const beforeCamera=(await sample()).camera;const box=(await sample()).rect;
      await page.keyboard.down('Alt');await page.mouse.move(box.x+box.width-100,box.y+box.height-100);await page.mouse.down();await page.mouse.move(box.x+box.width-150,box.y+box.height-120,{steps:5});await page.mouse.up();await page.keyboard.up('Alt');await settle();
      assert.notDeepEqual((await sample()).camera,beforeCamera,'normal Alt+mouse camera rotation');checks.push('mouse camera rotation '+view);
      for(const plane of ['xy','xz','yz'])await drag(plane);
    }
    await drag('xz',true);await page.getByLabel('Workplane',{exact:true}).uncheck();await drag(null);
    const editorBefore=await sample();
    assert.ok(editorBefore.nativeFlags.every(flags=>!(flags&120)),'editing disables every billboard axis');
    await page.locator('[data-hotkey="animations"]').click();await settle();
    assert.deepEqual((await sample()).nativeFlags,editorBefore.sourceFlags,'viewing restores authored billboard flags');
    const viewBefore=await sample();await page.keyboard.down('Alt');await page.mouse.move(viewBefore.rect.x+viewBefore.rect.width-100,viewBefore.rect.y+viewBefore.rect.height-100);await page.mouse.down();await page.mouse.move(viewBefore.rect.x+viewBefore.rect.width-150,viewBefore.rect.y+viewBefore.rect.height-120,{steps:5});await page.mouse.up();await page.keyboard.up('Alt');await settle();
    assert.notDeepEqual((await sample()).nodeMatrices,viewBefore.nodeMatrices,'viewing still faces billboards toward the camera');
    assert.ok((await sample()).model===viewBefore.model,'viewing changes no authored model data');
    await page.locator('[data-hotkey="animation"]').click();await settle();
    near((await sample()).world,editorBefore.world,'returning to editing restores the same placement');
    assert.ok((await sample()).nativeFlags.every(flags=>!(flags&120)));checks.push('viewing billboards preserved; returning to editing restores placement');

    await page.getByRole('button',{name:'Bones',exact:true}).click();await page.getByLabel('Bones controller').waitFor();await page.getByLabel('Movement bone or node').selectOption(String(choice.id));await page.getByRole('group',{name:'Bones tools',exact:true}).getByRole('button',{name:'Move',exact:true}).click();await page.getByLabel('Workplane',{exact:true}).check();await settle();
    for(const plane of ['xy','xz','yz'])await drag(plane);
    assert.equal(hash(fixture),originalHash,'input bytes unchanged');assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({fixture,originalHash,checks,measurements,errors},null,2));console.log(JSON.stringify({checks,measurements,errors}));
  }catch(error){fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({error:error.stack,checks,measurements,errors},null,2));throw error;}
  finally{await closeApp(app);}
})().catch(error=>{console.error(error);process.exitCode=1;});
