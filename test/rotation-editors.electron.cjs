const fs = require('node:fs'), path = require('node:path');
module.exports = async function rotationEditors({ app, page, check, out }) {
  const idle = () => page.waitForTimeout(180);
  const menu = id => app.evaluate(({ BrowserWindow }, id) => BrowserWindow.getAllWindows()[0].webContents.send('menu', id), id);
  const settings = async () => { await menu('settings'); const d=page.getByRole('dialog',{name:'Settings',exact:true}); await d.getByRole('tab',{name:'Mouse',exact:true}).click(); return d; };
  const closeSettings = () => page.getByRole('button',{name:'Close Settings',exact:true}).click();
  const rotationPage = async () => {const d=await settings();await d.getByRole('navigation',{name:'Mouse pages'}).getByRole('button',{name:'Rotation',exact:true}).click();return d;};
  const configure = async (editor, behavior, speed) => {
    const d=await rotationPage();await d.getByLabel('Rotation editor',{exact:true}).selectOption(editor);
    await d.getByLabel('Rotational Behavior',{exact:true}).selectOption(behavior);
    if (speed !== undefined) {if(editor!=='all')await d.getByLabel('Use default rotation sensitivity').uncheck();await d.getByLabel('Rotation sensitivity',{exact:true}).fill(String(speed));await d.getByLabel('Rotation sensitivity',{exact:true}).press('Tab');}
    await closeSettings();await idle();
  };
  let d=await settings();
  for (const [name, label] of [['Camera','Right mouse camera action'],['Wheel','Mouse wheel sensitivity value'],['Pointer','MdlVis pointer sensitivity value'],['UV','UV transform sensitivity']]) {
    await d.getByRole('navigation',{name:'Mouse pages'}).getByRole('button',{name,exact:true}).click();check('Mouse subsection '+name,await d.getByLabel(label,{exact:true}).isVisible());
  }
  await d.getByRole('navigation',{name:'Mouse pages'}).getByRole('button',{name:'Rotation',exact:true}).click();
  check('global UI defaults to Pivot-based',await d.getByLabel('Rotational Behavior',{exact:true}).inputValue()==='pivot');
  check('global rotation speed defaults to 1x',await d.getByLabel('Rotation sensitivity',{exact:true}).inputValue()==='1');
  await idle(); fs.writeFileSync(path.join(out,'mouse-settings.png'),Buffer.from(await app.evaluate(async ({BrowserWindow})=>{const contents=BrowserWindow.getAllWindows()[0].webContents;contents.invalidate();await contents.capturePage(undefined,{stayHidden:true,stayAwake:true});await new Promise(resolve=>setTimeout(resolve,150));return (await contents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG().toString('base64');}),'base64'));await closeSettings();
  await configure('all','pivot',2);await configure('uv','linear',.5);
  d=await rotationPage();await d.getByLabel('Rotation editor',{exact:true}).selectOption('uv');
  check('UV overrides persist after reopening Settings',await d.getByLabel('Rotational Behavior',{exact:true}).inputValue()==='linear'&&await d.getByLabel('Rotation sensitivity',{exact:true}).inputValue()==='0.5');
  await d.getByLabel('Rotation editor',{exact:true}).selectOption('forge');
  check('unmodified editor inherits behavior and speed',await d.getByLabel('Rotational Behavior',{exact:true}).inputValue()===''&&await d.getByLabel('Use default rotation sensitivity').isChecked()&&await d.getByLabel('Rotation sensitivity',{exact:true}).inputValue()==='2');
  await d.getByRole('button',{name:'Restore mouse defaults',exact:true}).click();
  check('Restore mouse defaults clears editor overrides',await d.getByLabel('Rotational Behavior',{exact:true}).inputValue()===''&&await d.getByLabel('Rotation sensitivity',{exact:true}).inputValue()==='1');
  await closeSettings();
  // Pivot-based is the default; the straight-drag checks below measure Linear.
  await configure('all','linear');
  await menu('vertices');await page.getByLabel('3D model viewport',{exact:true}).waitFor();
  await page.locator('[data-hotkey="geosetsClear"]').click();await page.getByLabel('Select geoset 0',{exact:true}).check();await page.getByLabel('3D model viewport',{exact:true}).focus();await menu('selectAll');
  await page.evaluate(() => {
    window.rotationView = (scope='') => {
      const host=document.querySelector(scope+' [aria-label="3D model viewport"]');let runtime,props;
      for(let f=host?.[Object.keys(host).find(k=>k.startsWith('__reactFiber'))];f;f=f.return)for(let h=f.memoizedState;h;h=h.next){const v=h.memoizedState?.current;if(v?.renderer&&v?.entries)runtime=v;if(v?.model&&v?.transformMode)props=v;}
      if(!runtime||!props)throw Error('Mesh runtime missing '+scope);return {runtime,props};
    };
    window.rotationMeshSnap = (scope='') => {
      const {runtime:s,props:p}=rotationView(scope),r=s.controls.domElement.getBoundingClientRect(),vertices=Array.from(s.entries[0].geoset.Vertices),center=[0,0,0];
      vertices.forEach((v,i)=>center[i%3]+=v/(vertices.length/3));const q=s.controls.target.clone().set(...center).project(s.controls.object);
      return {vertices,center,pivot:{x:r.x+(q.x+1)*r.width/2,y:r.y+(1-q.y)*r.height/2},camera:s.controls.object.quaternion.toArray(),tool:p.transformMode,editor:p.rotationEditor||'vertices',rect:{x:r.x,y:r.y,width:r.width,height:r.height},selection:p.selectionByGeoset||Array.from(p.selectedVertices||[])};
    };
  });
  const dragMouse = async (start, dx,dy) => {await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x+dx,start.y+dy,{steps:8});await page.mouse.up();await idle();};
  const mesh = async (scope, label) => {
    const parent=scope?page.locator(scope):page.locator('.classic-sidebar');
    await parent.getByRole('button',{name:'Rotate',exact:true}).click();await parent.getByLabel('XY workplane',{exact:true}).check();await idle();
    const before=await page.evaluate(scope => rotationMeshSnap(scope),scope),start={x:before.pivot.x+70,y:before.pivot.y+40};
    await dragMouse(start,30,0);const after=await page.evaluate(scope => rotationMeshSnap(scope),scope),angle=Math.PI/6,c=Math.cos(angle),s=Math.sin(angle);
    const expected=before.vertices.map((v,i)=>{const j=i-i%3,x=before.vertices[j]-before.center[0],y=before.vertices[j+1]-before.center[1];return i%3===0?before.center[0]+x*c-y*s:i%3===1?before.center[1]+x*s+y*c:v;});
    check(label+' straight drag authors 30 degrees around grid Z',after.vertices.every((v,i)=>Math.abs(v-expected[i])<.001),{before:before.vertices.slice(0,6),after:after.vertices.slice(0,6),expected:expected.slice(0,6),selection:before.selection});
    await page.keyboard.press('Control+z');await idle();check(label+' one-step Undo',JSON.stringify((await page.evaluate(scope => rotationMeshSnap(scope),scope)).vertices)===JSON.stringify(before.vertices));
    const cameraBefore=await page.evaluate(scope => rotationMeshSnap(scope),scope),box=cameraBefore.rect;
    await page.keyboard.down('Alt');await dragMouse({x:box.x+box.width*.75,y:box.y+box.height*.8},40,20);await page.keyboard.up('Alt');
    const cameraAfter=await page.evaluate(scope => rotationMeshSnap(scope),scope);
    check(label+' actual mouse camera rotation preserves geometry',Math.hypot(...cameraBefore.camera.map((v,i)=>v-cameraAfter.camera[i]))>.01&&JSON.stringify(cameraBefore.vertices)===JSON.stringify(cameraAfter.vertices),{before:cameraBefore.camera,after:cameraAfter.camera,geometryUnchanged:JSON.stringify(cameraBefore.vertices)===JSON.stringify(cameraAfter.vertices)});
    return before;
  };
  await mesh('','Vertices');
  await configure('vertices','linear',.5);
  let before=await page.evaluate(scope => rotationMeshSnap(scope),''),start={x:before.pivot.x-80,y:before.pivot.y+40};await dragMouse(start,60,0);
  let after=await page.evaluate(scope => rotationMeshSnap(scope),''),c=Math.cos(Math.PI/6),s=Math.sin(Math.PI/6),x=before.vertices[0]-before.center[0],y=before.vertices[1]-before.center[1];
  check('Vertices override halves rotation speed from the opposite grab side',Math.abs(after.vertices[0]-(before.center[0]+x*c-y*s))<.001&&Math.abs(after.vertices[1]-(before.center[1]+x*s+y*c))<.001);
  await page.keyboard.press('Control+z');await idle();await configure('vertices','pivot',1);
  before=await page.evaluate(scope => rotationMeshSnap(scope),'');start={x:before.pivot.x+80,y:before.pivot.y};await dragMouse(start,30,0);after=await page.evaluate(scope => rotationMeshSnap(scope),'');
  check('Vertices Pivot-based radial drag has no turn',after.vertices.every((v,i)=>Math.abs(v-before.vertices[i])<.001));
  await configure('vertices','',1);
  // UV uses its own editor preference and keeps the existing 2D pivot.
  await menu('uv');const uv=page.locator('.uv-tab-window');await uv.waitFor();
  await uv.getByRole('button',{name:'Rotate',exact:true}).click();await idle();
  await page.evaluate(()=>{window.rotationUV=()=>{const el=document.querySelector('.uv-editor');let state,props;for(let f=el?.[Object.keys(el).find(k=>k.startsWith('__reactFiber'))];f;f=f.return)for(let h=f.memoizedState;h;h=h.next){const v=h.memoizedState?.current;if(v?.uv&&v?.draw)state=v;if(v?.geoset&&v?.onSelectVertices)props=v;}if(!state||!props)throw Error('UV runtime missing');return {state,props};};});
  const uvSnap=()=>page.evaluate(()=>{const {state,props}=rotationUV();return {uv:Array.from(state.uv),authored:Array.from(props.geoset.TVertices[0]),selected:Array.from(props.selectedVertices)};});
  const uvCanvas=uv.locator('.uv-editor canvas'),uvBox=await uvCanvas.boundingBox();
  const uvBefore=await uvSnap();await dragMouse({x:uvBox.x+uvBox.width*.65,y:uvBox.y+uvBox.height*.45},30,0);const uvAfter=await uvSnap();
  const ids=uvBefore.selected,center=[0,0];ids.forEach(i=>{center[0]+=uvBefore.uv[i*2]/ids.length;center[1]+=uvBefore.uv[i*2+1]/ids.length;});
  check('UV default straight drag authors 30 degrees',ids.length>0&&ids.every(i=>{const x=uvBefore.uv[i*2]-center[0],y=uvBefore.uv[i*2+1]-center[1];return Math.abs(uvAfter.uv[i*2]-(center[0]+x*c-y*s))<.0001&&Math.abs(uvAfter.uv[i*2+1]-(center[1]+x*s+y*c))<.0001;}),{ids,before:uvBefore.uv.slice(0,6),after:uvAfter.uv.slice(0,6)});
  await uvCanvas.focus();await page.keyboard.press('Control+z');await idle();check('UV one-step Undo',JSON.stringify((await uvSnap()).uv)===JSON.stringify(uvBefore.uv));
  await configure('uv','linear',.5);
  await dragMouse({x:uvBox.x+uvBox.width*.35,y:uvBox.y+uvBox.height*.4},60,0);const uvSlower=await uvSnap();
  check('UV editor sensitivity override halves the angle',uvSlower.uv.every((v,i)=>Math.abs(v-uvAfter.uv[i])<.0001));
  await uvCanvas.focus();await page.keyboard.press('Control+z');await idle();
  await configure('uv','pivot',1);
  const uvStart={x:uvBox.x+uvBox.width*.7,y:uvBox.y+uvBox.height*.5};
  await page.mouse.move(uvStart.x,uvStart.y);await page.mouse.down();
  const uvPivot=await page.evaluate(()=>rotationUV().state.drag.pivotScreen);
  const ux=uvStart.x-uvBox.x-uvPivot[0],uy=uvStart.y-uvBox.y-uvPivot[1];
  for(let i=1;i<=8;i++){const a=i*Math.PI/16;await page.mouse.move(uvBox.x+uvPivot[0]+ux*Math.cos(a)-uy*Math.sin(a),uvBox.y+uvPivot[1]+ux*Math.sin(a)+uy*Math.cos(a));}
  await page.mouse.up();await idle();const uvPivotAfter=await uvSnap();
  check('UV Pivot-based choice follows a quarter-circle',ids.every(i=>Math.abs(uvPivotAfter.uv[i*2]-(center[0]-(uvBefore.uv[i*2+1]-center[1])))<.01&&Math.abs(uvPivotAfter.uv[i*2+1]-(center[1]+uvBefore.uv[i*2]-center[0]))<.01));
  await uvCanvas.focus();await page.keyboard.press('Control+z');await idle();
  const previewCamera=()=>page.evaluate(()=>{const el=document.querySelector('.uv-tab-window .game-preview-root');for(let f=el[Object.keys(el).find(k=>k.startsWith('__reactFiber'))];f;f=f.return)for(let h=f.memoizedState;h;h=h.next){const v=h.memoizedState?.current;if(v?.native&&v?.controls)return v.controls.object.quaternion.toArray();}throw Error('UV camera missing');});
  const cameraBefore=await previewCamera(),previewBox=await uv.locator('[data-clean-model-canvas]').boundingBox();
  await dragMouse({x:previewBox.x+previewBox.width*.4,y:previewBox.y+previewBox.height*.5},40,20);
  const cameraAfter=await previewCamera();check('UV preview actual mouse camera rotation',Math.hypot(...cameraBefore.map((v,i)=>v-cameraAfter[i]))>.01);
  await uv.getByRole('button',{name:'Close UV Wrapper',exact:true}).click();
  await page.getByRole('button',{name:'Forge',exact:true}).click();const forge=page.getByRole('dialog',{name:'Forge',exact:true});await forge.locator('.forge-editor').waitFor();await forge.getByRole('button',{name:'Cube',exact:true}).click();await idle();await mesh('.forge-editor','Forge');await forge.getByRole('button',{name:'Close Forge',exact:true}).click();
  await page.getByRole('button',{name:'Showcase',exact:true}).click();await page.getByRole('region',{name:'Text',exact:true}).getByRole('button',{name:'Add',exact:true}).click();
  const handle=await page.getByRole('button',{name:'Rotate text',exact:true}).boundingBox(),selection=page.locator('.showcase-layer-selection');const old=await selection.evaluate(el=>el.style.transform);
  await dragMouse({x:handle.x+handle.width/2,y:handle.y+handle.height/2},30,0);check('Showcase text straight drag turns 30 degrees',await selection.evaluate(el=>el.style.transform)==='rotate(30deg)',{old,after:await selection.evaluate(el=>el.style.transform)});
  d=await rotationPage();await d.getByRole('button',{name:'Restore mouse defaults',exact:true}).click();await closeSettings();await menu('vertices');await idle();
};
