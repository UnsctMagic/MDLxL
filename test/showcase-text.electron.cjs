const { launchApp, closeApp } = require('./helpers/app.cjs');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');

(async()=>{
  const root=process.cwd(),out=path.join(root,'out/showcase-text');fs.mkdirSync(out,{recursive:true});
  const {createDemoDocument}=await import('../src/editor-document.js'),demo=createDemoDocument();
  demo.model.Sequences.push({...structuredClone(demo.model.Sequences[0]),Name:'Portrait Talk',Interval:new Uint32Array([2000,4000])});
  demo.model.Cameras=[{Name:'Portrait Camera',Position:new Float32Array([0,-350,120]),TargetPosition:new Float32Array([0,0,100]),FieldOfView:Math.PI/4,NearClip:1,FarClip:1000}];
  const fixture=path.join(out,'TextEffects.mdx');fs.writeFileSync(fixture,demo.serialize('mdx'));
  const entry=path.join(out,'main.cjs');
  fs.writeFileSync(entry,'const {app}=require("electron");app.getAppPath=()=>'+JSON.stringify(root)+';require('+JSON.stringify(path.join(root,'electron/main.cjs'))+');');
  const launched = await launchApp({ out, fixture, entry, timeout: 30000, bounds: { x: -3000, y: 0, width: 1280, height: 920 }, show: 'hide', pageTimeout: 15000 }); const app = launched.app;
  const errors=launched.errors;
  try{
    const page=launched.page;
    await page.getByRole('button',{name:'Showcase',exact:true}).click();
    const textSection=page.getByRole('region',{name:'Text',exact:true});
    await textSection.getByRole('button',{name:'Add',exact:true}).click();
    await page.getByLabel('Text content').fill('IRON WITHIN');
    await page.getByRole('button',{name:'Orbitron',exact:true}).click();
    await page.getByLabel('Text size',{exact:true}).fill('64');
    await page.getByLabel('Main color',{exact:true}).fill('#82c8e6');
    await page.getByLabel('Gradient color 2').fill('#d5b275');
    await page.getByLabel('Gradient color 3').fill('#788ac4');
    await page.getByRole('button',{name:'Outline',exact:true}).click();
    await page.getByLabel('Outline color',{exact:true}).fill('#162947');
    await page.getByRole('button',{name:'Neon',exact:true}).click();
    const layout=await page.evaluate(()=>{
      const grid=document.querySelector('.showcase-font-grid'),palette=document.querySelector('.showcase-font-palette'),sidebar=document.querySelector('.showcase-sidebar'),format=document.querySelector('.showcase-text-format'),outline=document.querySelector('.showcase-text-style .outline');
      const box=element=>({width:element.getBoundingClientRect().width,height:element.getBoundingClientRect().height});
      return {grid:box(grid),palette:box(palette),sidebar:box(sidebar),format:box(format),overflow:format.scrollWidth-format.clientWidth,names:[...grid.querySelectorAll('button')].map(button=>button.innerText),outline:{fill:getComputedStyle(outline).color,stroke:getComputedStyle(outline).webkitTextStrokeColor}};
    });
    assert.equal(layout.names.length,15);assert.ok(layout.names.every(name=>name==='Aa'));assert.ok(layout.grid.height<153);assert.ok(layout.sidebar.width<=250);assert.ok(layout.overflow<=1,JSON.stringify(layout));assert.equal(layout.outline.fill,'rgb(255, 255, 255)');assert.notEqual(layout.outline.fill,layout.outline.stroke);
    assert.equal(await page.getByRole('button',{name:'Neon',exact:true}).evaluate(element=>getComputedStyle(element).backgroundColor),'rgb(37, 40, 51)');
    assert.equal(await page.locator('.showcase-text-colors input[type=color]').count(),3);
    // 015d8090 replaced the Text rotation field with the on-canvas Rotate text handle (1d71df1f): drag it about 27 degrees.
    const rotateText=async degrees=>{const selection=await page.locator('.showcase-layer-selection').boundingBox(),handle=await page.getByRole('button',{name:'Rotate text',exact:true}).boundingBox(),cx=selection.x+selection.width/2,cy=selection.y+selection.height/2,hx=handle.x+handle.width/2,hy=handle.y+handle.height/2,radius=Math.hypot(hx-cx,hy-cy),angle=Math.atan2(hy-cy,hx-cx)+degrees*Math.PI/180;
      await page.mouse.move(hx,hy);await page.mouse.down();await page.mouse.move(cx+radius*Math.cos(angle),cy+radius*Math.sin(angle),{steps:8});await page.mouse.up();};
    await rotateText(27);
    const transform=await page.locator('.showcase-layer-selection').evaluate(element=>getComputedStyle(element).transform);assert.notEqual(transform,'none');
    await page.getByText('Fades',{exact:true}).click();
    await page.getByLabel('Fade in start').fill('1');await page.getByLabel('Fade in length').fill('2');
    await page.getByLabel('Fade out start').fill('5');await page.getByLabel('Fade out length').fill('1.5');await page.getByLabel('Fade out length').press('Enter');
    await page.locator('.showcase-font-grid').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'controls.png')});
    // Import the real module and its dependencies; keep every pixel/fade assertion.
    await page.evaluate(async url=>{window.textModule=await import(url);},pathToFileURL(path.join(root,'app/showcase-text.js')).href);
    const report=await page.evaluate(async()=>{
      const {SHOWCASE_FONTS,TEXT_EFFECTS,paintShowcaseText:paint,textFadeOpacity}=window.textModule;
      await Promise.all(SHOWCASE_FONTS.map(font=>document.fonts.load('48px "'+font.family+'"')));
      const canvas=document.createElement('canvas');canvas.width=800;canvas.height=300;const ctx=canvas.getContext('2d',{willReadFrequently:true});
      const base={id:'proof',kind:'text',text:'WARHAMMER',font:'cinzeldecorative',size:58,color:'#e3d9c1',color2:'#b79053',color3:'#729ab7',outline:true,outlineColor:'#151927',rect:{x:.1,y:.22,width:.8,height:.56}};
      const render=(layer,time)=>{ctx.clearRect(0,0,800,300);paint(ctx,layer,800,300,time);return ctx.getImageData(0,0,800,300).data.slice();};
      const difference=(a,b,tolerance=3)=>{let count=0;for(let i=0;i<a.length;i++)if(Math.abs(a[i]-b[i])>tolerance)count++;return count;};
      const total=data=>{let sum=0;for(let i=3;i<data.length;i+=4)sum+=data[i];return sum;};
      const sheet=document.createElement('canvas');sheet.width=1200;sheet.height=TEXT_EFFECTS.length*122;const sc=sheet.getContext('2d');sc.fillStyle='#11141b';sc.fillRect(0,0,sheet.width,sheet.height);
      const effects=[];
      for(let index=0;index<TEXT_EFFECTS.length;index++){
        const [effect,name]=TEXT_EFFECTS[index],layer={...base,effect};
        const first=render(layer,1400),second=render(layer,5100),again=render(layer,1400);
        // GPU-accelerated scratch canvases sometimes rasterize the Lightning bolt a few levels apart
        // (one pixel, one channel, 192 vs 196); forced CPU canvases repeat exactly. Allow that sub-visual noise.
        const changed=difference(first,second),deterministic=difference(first,again,8);
        effects.push({effect,changed,deterministic,coverage:total(first)});
        for(let column=0;column<2;column++){
          sc.save();sc.translate(column*600,index*122);sc.fillStyle='#8794a6';sc.font='11px Arial';sc.fillText(name+(column?' · 5.1s':' · 1.4s'),15,17);
          paint(sc,{...layer,id:'sheet-'+index+'-'+column,font:column?'orbitron':base.font,bold:!!column,size:column?42:49,rect:{x:.1,y:.25,width:.8,height:.55}},600,122,column?5100:1400);sc.restore();
        }
      }
      const gradient1=render({...base,effect:'gradient'},2400),gradient2=render({...base,effect:'gradient',color2:'#5bc375',color3:'#d94071'},2400);
      const shimmer1=render({...base,effect:'shimmer'},3300),shimmer2=render({...base,effect:'shimmer',color2:'#5bc375',color3:'#d94071'},3300);
      const border1=render({...base,effect:'solid',outlineColor:'#ff0000'},0),border2=render({...base,effect:'solid',outlineColor:'#00ff00'},0);
      const fades={...base,effect:'solid',fadeInStart:1,fadeInLength:2,fadeOutStart:5,fadeOutLength:1.5};
      const fadeTotals=[0,1000,2000,3000,5750,6500].map(time=>total(render(fades,time)));
      const bounds=data=>{let left=800,right=0,top=300,bottom=0;for(let y=0;y<300;y++)for(let x=0;x<800;x++)if(data[(y*800+x)*4+3]>10){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}return {width:right-left+1,height:bottom-top+1};};
      const rotated=[0,90].map(rotation=>bounds(render({...base,text:'WARD',effect:'solid',rotation},0)));
      const before=performance.now();for(let i=0;i<60;i++)render({...base,effect:'flame'},i*1000/30);const frameMs=(performance.now()-before)/60;
      return {rotated,fonts:SHOWCASE_FONTS.map(font=>({name:font.name,loaded:document.fonts.check('48px "'+font.family+'"')})),effects,palette:{gradient:difference(gradient1,gradient2),shimmer:difference(shimmer1,shimmer2),border:difference(border1,border2)},fadeTotals,fadeExact:[0,1000,2000,3000,5750,6500].map(time=>textFadeOpacity(fades,time)),frameMs,sheet:sheet.toDataURL('image/png')};
    });
    fs.writeFileSync(path.join(out,'effects.png'),Buffer.from(report.sheet.split(',')[1],'base64'));delete report.sheet;
    assert.ok(report.fonts.every(font=>font.loaded));assert.ok(report.effects.every(row=>row.deterministic===0));
    assert.ok(report.effects.filter(row=>row.effect!=='solid').every(row=>row.changed>150),JSON.stringify(report.effects));
    assert.ok(Object.values(report.palette).every(value=>value>300));assert.deepEqual(report.fadeExact,[0,0,.5,1,.5,0]);
    assert.ok(Math.abs(report.rotated[0].width-report.rotated[1].height)<=2);assert.ok(Math.abs(report.rotated[0].height-report.rotated[1].width)<=2);
    assert.equal(report.fadeTotals[0],0);assert.equal(report.fadeTotals[5],0);assert.ok(Math.abs(report.fadeTotals[2]/report.fadeTotals[3]-.5)<.035);
    // Exercise the real recording API with the UI-created layer, then a frameless portrait.
    const capture=await page.locator('.showcase-record').evaluate(async element=>{
      const api=findFiberState(element,p=>p?.captureAPI,{props:true}).captureAPI;window.textTestCapture=api;await api.prepareRecording();
      const values=[];for(const time of [0,2000,3500,6500]){await api.seekRecordingFrame(time);const overlay=document.querySelector('.showcase-layer-stage canvas'),data=overlay.getContext('2d').getImageData(0,0,overlay.width,overlay.height).data;let total=0;for(let i=3;i<data.length;i+=4)total+=data[i];values.push(total);}
      await api.seekRecordingFrame(3500);const recorded=api.captureFrame({maxDimension:900}),png=recorded.toDataURL('image/png');api.endRecording();return {values,png};
    });
    console.log('CAPTURE FADES',JSON.stringify(capture.values));assert.equal(capture.values[0],0);assert.equal(capture.values[3],0);assert.ok(capture.values[2]>capture.values[1]*1.5,JSON.stringify(capture.values));
    fs.writeFileSync(path.join(out,'captured-text.png'),Buffer.from(capture.png.split(',')[1],'base64'));delete capture.png;
    await page.getByRole('tab',{name:'Portrait',exact:true}).click();await page.getByLabel('Portrait frame',{exact:true}).uncheck();await page.getByLabel('Crop size',{exact:true}).selectOption('square');
    const portrait=await page.evaluate(async()=>{const api=window.textTestCapture;await api.prepareRecording();await api.seekRecordingFrame(3500);const canvas=api.captureFrame({maxDimension:700});const png=canvas.toDataURL('image/png');api.endRecording();return png;});
    fs.writeFileSync(path.join(out,'frameless-text.png'),Buffer.from(portrait.split(',')[1],'base64'));
    await page.getByLabel('Fade in length').fill('0');await page.getByLabel('Fade out length').fill('0');
    await page.getByRole('button',{name:'Gradient',exact:true}).click();
    await page.screenshot({path:path.join(out,'portrait-controls.png')});
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({layout,report,capture,errors},null,2));
    console.log(JSON.stringify({layout,effects:report.effects,fadeExact:report.fadeExact,frameMs:report.frameMs,capture,errors},null,2));
  }catch(error){const page=launched.page;await page.screenshot({path:path.join(out,'failure.png'),timeout:4000}).catch(()=>{});throw error;}
  finally{if(app)await closeApp(app);}
})().catch(error=>{console.error(error);process.exitCode=1;});
