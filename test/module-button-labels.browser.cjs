// Run after building dist. Optional: MDLXL_PLAYWRIGHT_MODULE points to an external Playwright install.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const port = 4174;

const preview=spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'preview','--configLoader','runner','--host','127.0.0.1','--port',String(port)],{cwd:root,stdio:['ignore','pipe','inherit']});
const ready=new Promise((resolve,reject)=>{
  preview.once('error',reject);
  preview.stdout.on('data',chunk=>{
    if(chunk.toString().includes(`http://127.0.0.1:${port}/`))resolve();
  });
});

(async()=>{
  await ready;
  const browser=await chromium.launch({headless:true,executablePath:process.env.MDLXL_CHROMIUM_PATH||chromium.executablePath()});
  try{
    const page=await browser.newPage({viewport:{width:1920,height:1080}});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`http://127.0.0.1:${port}/`);
    const toolbar=page.locator('.toolbar-modules');
    await toolbar.waitFor();
    assert.deepEqual(await toolbar.locator('.module-icon-badge,.pressed-keys-tool>span:not(.hotkey-badge)').allTextContents(),['AI','LIBR','FRG','BITZ','OPXL','EMTR','ANIM','KEY','VIS']);
    // New look (VIS off): every label in its own colour, bold 7.225px Tahoma, on a transparent background.
    assert.deepEqual(await toolbar.locator('.ai-tool,.library-tool,.forge-tool,.bits-tool,.optimizer-tool,.emitter-tool,.animxl-tool,.pressed-keys-tool,.vis-toggle').evaluateAll(buttons=>buttons.map(button=>{
      const style=getComputedStyle(button.querySelector('.module-icon-badge,span:not(.hotkey-badge)'));
      return [style.color,style.backgroundColor,style.fontSize,style.fontWeight];
    })),['rgb(208, 168, 255)','rgb(255, 208, 106)','rgb(120, 198, 255)','rgb(241, 235, 224)','rgb(147, 224, 138)','rgb(102, 222, 208)','rgb(255, 139, 123)','rgb(255, 176, 98)','rgb(255, 154, 213)'].map(color=>[color,'rgba(0, 0, 0, 0)','7.225px','900']));
    fs.mkdirSync(path.join(root,'out'),{recursive:true});
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
    await browser.close();
    preview.kill();
  }
})().catch(error=>{preview.kill();console.error(error);process.exitCode=1;});
