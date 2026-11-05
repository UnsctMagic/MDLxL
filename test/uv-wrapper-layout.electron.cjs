const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { launchApp, closeApp, bundleHashes } = require('./helpers/app.cjs');
const { fixturePath } = require('./helpers/fixtures.cjs');
(async () => {
  const out = path.resolve(process.env.MDLXL_UV_LAYOUT_OUT || 'out/uv-wrapper-layout'), fixture = fixturePath('footman');
  fs.mkdirSync(out,{recursive:true}); const checks=[], failures=[], errors=[];
  const check=(label,value)=>{checks.push({label,passed:!!value});console.log((value?'PASS ':'FAIL ')+label);if(!value)failures.push(label);};
  const options={fixture,out,errors,bounds:{x:0,y:0,width:1920,height:1040},args:['--disable-renderer-backgrounding','--disable-background-timer-throttling']};
  let launched=await launchApp({...options,settings:{preferences:{theme:'light',graphics:{pauseWhenHidden:false}}}}), app=launched.app,page=launched.page;
  const open=async()=>{await page.getByLabel('Select geoset 0',{exact:true}).waitFor();await page.locator('[data-hotkey="geosetsClear"]').click();await page.getByLabel('Select geoset 0',{exact:true}).check();await page.getByLabel('3D model viewport',{exact:true}).click();await page.keyboard.press('Control+a');await page.locator('[data-hotkey="uv"]').click();await page.locator('.uv-tab-window .uv-editor canvas').waitFor();};
  const values=()=>page.evaluate(()=>[Number(document.querySelector('.uv-workspace-body').style.getPropertyValue('--uv-side-width').replace('%','')),Number(document.querySelector('.uv-side-panel').style.getPropertyValue('--uv-preview-height').replace('%',''))]);
  const foldFits=()=>page.evaluate(()=>{const s=document.querySelector('[aria-label="Fold direction"]'),p=s.closest('.uv-fold-control'),r=s.getBoundingClientRect(),pr=p.getBoundingClientRect(),style=getComputedStyle(s),c=document.createElement('canvas').getContext('2d');c.font=style.font;const text=Math.max(...Array.from(s.options,o=>c.measureText(o.textContent).width));return {width:r.width,required:text+parseFloat(style.paddingLeft)+parseFloat(style.paddingRight)+24,fits:r.right<=pr.right+1&&r.left>=pr.left-1&&r.width>=text+parseFloat(style.paddingLeft)+parseFloat(style.paddingRight)+24};});
  try{
    await open();check('UV opens expanded like the screenshot',await page.locator('.uv-tab-window.expanded').count()===1);
    const defaults=await values();check('new profile uses screenshot pane proportions',Math.abs(defaults[0]-45.6)<.01&&defaults[1]===50);
    check('Fold direction labels fit at screenshot width',(await foldFits()).fits);
    check('texture-frame snapping control is removed',await page.getByLabel('Snap to texture frame',{exact:true}).count()===0);
    const column=page.getByRole('separator',{name:'Resize texture and live-view columns',exact:true}),row=page.getByRole('separator',{name:'Resize live model preview',exact:true});
    const drag=async(locator,dx,dy)=>{const b=await locator.boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2+dx,b.y+b.height/2+dy,{steps:8});await page.mouse.up();};
    await drag(column,120,0);await drag(row,0,-65);const customized=await values();check('real splitter drags change both proportions',customized.every((v,i)=>Math.abs(v-defaults[i])>1));
    await page.getByRole('button',{name:'Exit UV Wrapper',exact:true}).click();await page.locator('[data-hotkey="uv"]').click();await page.locator('.uv-tab-window .uv-editor canvas').waitFor();check('reopening preserves customized proportions',JSON.stringify(await values())===JSON.stringify(customized));
    await closeApp(app,{keepProfile:true});app=null;
    launched=await launchApp({...options,profile:launched.profile});app=launched.app;page=launched.page;await open();check('app restart preserves customized proportions',JSON.stringify(await values())===JSON.stringify(customized));
    await page.getByRole('button',{name:'Restore UV Wrapper size',exact:true}).click();const narrow=await foldFits();check('Fold direction labels fit in the compact window',narrow.fits);
    await page.getByLabel('Fold direction',{exact:true}).selectOption('bottom-to-top');check('full Fold direction remains selectable',await page.getByLabel('Fold direction',{exact:true}).inputValue()==='bottom-to-top');
    await page.getByLabel('Fold direction',{exact:true}).scrollIntoViewIfNeeded();
    check('compact Fold control is fully visible after scrolling',await page.getByLabel('Fold direction',{exact:true}).evaluate(el=>{const r=el.getBoundingClientRect(),p=el.closest('.uv-side-controls').getBoundingClientRect();return r.top>=p.top-1&&r.bottom<=p.bottom+1&&r.right<=p.right+1;}));
    await page.screenshot({path:path.join(out,'compact.png')});
    await page.getByRole('button',{name:'Expand UV Wrapper',exact:true}).click();
    await page.getByRole('separator',{name:'Resize texture and live-view columns',exact:true}).dblclick();await page.getByRole('separator',{name:'Resize live model preview',exact:true}).dblclick();const reset=await values();check('splitter reset uses the new screenshot proportions',Math.abs(reset[0]-45.6)<.01&&reset[1]===50);
    await page.screenshot({path:path.join(out,'default.png')});check('no renderer errors',errors.length===0);assert.deepEqual(failures,[]);
  }finally{fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({checks,failures,errors,bundle:bundleHashes()},null,2));if(app)await closeApp(app);}
})().catch(e=>{console.error(e);process.exitCode=1;});
