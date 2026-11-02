// Run after building dist. Optional: MDLXL_PLAYWRIGHT_MODULE points to an external Playwright install.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
// Ask the OS for a free port. A fixed 4174 can already belong to another preview;
// Vite then picks 4175, so waiting for the old URL never completes.
const preview=spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'preview','--configLoader','runner','--host','127.0.0.1','--port','0'],{cwd:root,stdio:['ignore','pipe','inherit'],windowsHide:true});
const ready=new Promise((resolve,reject)=>{
  let output='';
  const timer=setTimeout(()=>reject(Error('Vite preview did not start within 15 seconds: '+output)),15000);
  const stop=error=>{clearTimeout(timer);reject(error);};
  preview.once('error',stop);
  preview.once('exit',(code,signal)=>stop(Error(`Vite preview exited before ready (${signal||code}): ${output}`)));
  preview.stdout.on('data',chunk=>{
    output+=chunk.toString();
    // Vite colours the port in a terminal; strip the colour codes before reading the URL.
    const url=output.replace(/\u001b\[[0-9;]*m/g,'').match(/http:\/\/127\.0\.0\.1:\d+\//)?.[0];
    if(url){clearTimeout(timer);resolve(url);}
  });
});

(async()=>{
  let browser;
  try{
    const url=await ready;
    console.log('Preview ready at '+url);
    browser=await chromium.launch({headless:true,executablePath:process.env.MDLXL_CHROMIUM_PATH||chromium.executablePath(),timeout:15000});
    const page=await browser.newPage({viewport:{width:1920,height:1080}});
    page.setDefaultTimeout(10000);
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(url);
    const toolbar=page.locator('.toolbar-modules');
    await toolbar.waitFor();
    assert.deepEqual(await toolbar.locator('.module-icon-badge,.pressed-keys-tool>span:not(.hotkey-badge)').allTextContents(),['AI','LIBR','FRG','BITZ','OPXL','EMTR','FX','ANIM','CORP','KEY','LER','VIS']);
    // New look (VIS off), docs/TOOLBAR-DOCK.md: every label in its own colour, bold 10px Oxanium, on a transparent background.
    assert.deepEqual(await toolbar.locator('.ai-tool,.library-tool,.forge-tool,.bits-tool,.optimizer-tool,.emitter-tool,.surface-effects-tool,.animxl-tool,.auto-corpse-tool,.pressed-keys-tool,.learner-tool,.vis-toggle').evaluateAll(buttons=>buttons.map(button=>{
      const style=getComputedStyle(button.querySelector('.module-icon-badge,span:not(.hotkey-badge)'));
      return [style.color,style.backgroundColor,style.fontSize,style.fontWeight];
    })),['rgb(201, 162, 255)','rgb(255, 191, 71)','rgb(124, 196, 255)','rgb(236, 232, 222)','rgb(143, 224, 127)','rgb(95, 224, 207)','rgb(182, 242, 255)','rgb(255, 133, 116)','rgb(230, 199, 161)','rgb(255, 162, 87)','rgb(242, 227, 92)','rgb(255, 143, 208)'].map(color=>[color,'rgba(0, 0, 0, 0)','10px','700']));
    const dockColors=await toolbar.locator(':scope>button').evaluateAll(buttons=>buttons.map(button=>getComputedStyle(button.querySelector('.module-icon-badge,span:not(.hotkey-badge)')).color));
    assert.equal(new Set(dockColors).size,dockColors.length,'every dock icon, including new ones, has its own label colour');
    // Every dock icon wears the same WC3 frame, switched on or off: a 64px picture filling the button, no ring or border, one label font and place.
    await page.evaluate(()=>document.fonts.ready);
    assert.ok(await page.evaluate(()=>document.fonts.check("700 10px 'MDLxL Dock'")),'the dock font loads');
    const frames=()=>toolbar.locator(':scope>button').evaluateAll(buttons=>buttons.map(button=>{
      const style=getComputedStyle(button),image=button.querySelector('img'),label=button.querySelector('.module-icon-badge,span:not(.hotkey-badge)');
      const box=button.getBoundingClientRect(),picture=image.getBoundingClientRect(),text=label.getBoundingClientRect();
      return [style.boxShadow,style.borderTopWidth,style.backgroundColor,image.naturalWidth,picture.x-box.x,picture.y-box.y,picture.width,picture.height,getComputedStyle(label).fontFamily,text.bottom-box.bottom,text.height].join('|');
    }));
    const learner=toolbar.locator('.learner-tool');
    for(const frame of [await frames(),(await learner.click(),await frames())])assert.equal(new Set(frame).size,1,frame.join('\n'));
    await learner.click();
    fs.mkdirSync(path.join(root,'out'),{recursive:true});
    await toolbar.screenshot({path:path.join(root,'out/toolbar-dock-frames.png')});
    // View controls share the editor row; the WC3 dock leaves the tab strip clear.
    assert.equal(await page.locator('.classic-toolbar .quick-display').count(),0);
    assert.equal(await page.locator('.editor-modules .quick-display').count(),1);
    await page.screenshot({path:path.join(root,'out/editor-row-quick-display.png')});
    await page.locator('.editor-modules [data-hotkey="animations"]').click();
    await page.locator('.portrait-toolbar').waitFor();
    assert.equal(await page.locator('.portrait-toolbar').getAttribute('aria-label'),'Animation view');
    assert.equal(await page.getByRole('button',{name:'Portrait Frame View',exact:true}).count(),1);
    assert.equal(await page.getByRole('button',{name:'Control Model',exact:true}).count(),0);
    await page.screenshot({path:path.join(root,'out/animations-portrait-view.png')});
    assert.deepEqual(errors,[]);
    console.log('PASS labeled modules, relocated Quick Display, and Animations portrait controls render');
  }finally{
    await browser?.close();
    preview.kill();
  }
})().catch(error=>{preview.kill();console.error(error);process.exitCode=1;});
