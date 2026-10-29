const { launchApp, closeApp, settle: settlePage } = require('./helpers/app.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
(async () => {
  const root = process.cwd(), out = path.join(root, 'out', 'hotkey-badges');
  await fs.mkdir(out, {recursive:true});
  const profile = await fs.mkdtemp(path.join(out, 'profile-'));
  const { createDemoDocument } = await import('../src/editor-document.js');
  const fixture = path.join(out, 'badges.mdx');
  await fs.writeFile(fixture, createDemoDocument().serialize('mdx'));
  const app = (await launchApp({ out: path.resolve('out'), profile: profile, args: (['--disable-gpu-vsync','--disable-frame-rate-limit',fixture]).filter(arg => arg !== path.resolve(__dirname, '..') && arg !== '--disable-backgrounding-occluded-windows'), env: { MDLVIS_HEADLESS:'1' }, timeout: 60000 })).app;
  const errors = [];
  try {
    const page = await app.firstWindow(); page.setDefaultTimeout(20000);
    page.on('pageerror', error => errors.push(error.message));
    await app.evaluate(({BrowserWindow}) => {const win=BrowserWindow.getAllWindows()[0];win.webContents.setBackgroundThrottling(false);win.setSize(1100,800);win.showInactive();});
    await page.locator('.learner-tool').waitFor();
    await page.waitForFunction(()=>document.querySelector('.model-tabs')?.textContent.includes('badges.mdx'));
    const click = async locator => {const b=await locator.boundingBox();await page.mouse.click(b.x+b.width/2,b.y+b.height/2);};
    const inspect = async () => page.locator('[data-hotkey-badge]:popover-open').evaluateAll(badges => badges.map(badge => {
      const style=getComputedStyle(badge), rect=badge.getBoundingClientRect();
      const control=badge.closest('[data-hotkey]')||badge.parentElement.querySelector('[data-hotkey]')||badge.parentElement;
      const anchor=control.getBoundingClientRect();
      const range=document.createRange();range.selectNodeContents(badge);const ink=range.getBoundingClientRect();
      return {text:badge.textContent,border:style.borderTopWidth,background:style.backgroundColor,outline:style.outlineWidth,font:style.fontSize,display:style.display,visibility:style.visibility,
        control:control.getAttribute('data-hotkey'),controlRight:anchor.right,controlTop:anchor.top,left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom,inkLeft:ink.left,inkRight:ink.right,inkBottom:ink.bottom,width:rect.width,height:rect.height};
    }));
    const verify = async label => {
      const badges=await inspect();assert.ok(badges.length>5,label+': visible hints');
      const size=await page.evaluate(()=>({width:innerWidth,height:innerHeight}));
      for(const badge of badges){
        assert.notEqual(badge.display,'none');assert.equal(badge.visibility,'visible');assert.ok(badge.width>0&&badge.height>0,'badge is actually drawn: '+badge.text);
        assert.equal(badge.border,'0px',label+': '+badge.text);assert.equal(badge.outline,'0px');assert.equal(badge.background,'rgba(0, 0, 0, 0)');assert.equal(badge.font,'11px');
        assert.ok(badge.left>=0&&badge.top>=0&&badge.right<=size.width&&badge.bottom<=size.height,label+': viewport '+JSON.stringify(badge));
        assert.ok(badge.inkLeft>=badge.left-1&&badge.inkRight<=badge.right+1&&badge.inkBottom<=badge.bottom+1,label+': full text '+JSON.stringify(badge));
        const right=Math.max(badge.width+3,Math.min(badge.controlRight,size.width-3));
        const top=Math.max(3,Math.min(badge.controlTop,size.height-badge.height-3));
        assert.ok(Math.abs(badge.right-right)<=1&&Math.abs(badge.top-top)<=1,label+': control top-right '+JSON.stringify(badge));
      }
      return badges;
    };
    const dock=page.locator('.toolbar-modules');
    const before=await dock.boundingBox();
    await click(page.locator('.learner-tool'));await click(page.locator('.learn-menu [data-hotkey="show-hotkeys"]'));await page.keyboard.press('Escape');
    await page.waitForFunction(()=>document.querySelectorAll('[data-hotkey-badge]:popover-open').length>10);
    await page.locator('.learn-keycap').waitFor({state:'detached',timeout:7000});
    for(const width of [1100,1920]){
      await app.evaluate(({BrowserWindow},width)=>BrowserWindow.getAllWindows()[0].setSize(width,800),width);
      await settlePage(page, 200);await verify('editor '+width);
      for(const [id,text] of [['learn','Ctrl+J'],['pressedKeys','Shift+K'],['fitSelection','Shift+Home'],['convertVersion','Ctrl+F12']]){
        const badge=page.locator(`button[data-hotkey="${id}"]:visible`).first().locator('[data-hotkey-badge]');
        assert.equal(await badge.textContent(),text);assert.equal(await badge.evaluate(e=>e.matches(':popover-open')),true,id);
      }
      const window=await app.browserWindow(page);const png=await window.evaluate(w=>w.webContents.capturePage().then(i=>i.toPNG().toString('base64')));
      await fs.writeFile(path.join(out,'badges-'+width+'.png'),Buffer.from(png,'base64'));
    }
    await click(page.locator('button[data-hotkey="animation"]:visible').first());
    await page.locator('.game-preview-root canvas[data-clean-model-canvas]').waitFor();
    for(const width of [1600,1100,1920]){
      await app.evaluate(({BrowserWindow},width)=>BrowserWindow.getAllWindows()[0].setSize(width,800),width);
      // Let AppToolbar's ResizeObserver finish its responsive editor-name change.
      // No click, focus or scroll between resizing and the placement assertion.
      await settlePage(page, 200);
      assert.equal(await page.locator('.editor-modules').evaluate(row=>row.hasAttribute('data-short-editors')),width===1100,'responsive editor names at '+width);
      const badges=await verify('Movement resize '+width);
      console.log('✓ Movement resize '+width+': '+badges.length+' labels at their controls\' top-right corners');
    }
    await click(page.locator('button[data-hotkey="vertices"]:visible').first());
    await page.locator('.classic-view canvas').first().waitFor();
    await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1100,800));await settlePage(page, 150);
    assert.deepEqual(await dock.boundingBox(),before,'badges do not change dock geometry');
    const narrow=await page.locator('button[data-hotkey="pressedKeys"]:visible').first().locator('[data-hotkey-badge]').boundingBox();
    assert.ok(narrow.height>=25,'narrow icon wraps the complete modifier and key');
    console.log('✓ Full modifier chords, no white boxes, complete text on icons/status/view/sidebar, 1600/1100/1920 control top-right anchoring and unchanged dock geometry');

    const move=page.locator('button[data-hotkey="translate"]:visible').first().locator('[data-hotkey-badge]');
    await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1100,500));await settlePage(page, 150);
    await page.locator('.classic-sidebar').evaluate(element=>{element.scrollTop=element.scrollHeight;});
    await settlePage(page, 100);
    assert.equal(await move.evaluate(element=>{const button=element.parentElement.getBoundingClientRect(),side=element.closest('.classic-sidebar').getBoundingClientRect();return button.bottom<=side.top;}),true,'test control is fully scrolled out');
    assert.equal(await move.evaluate(element=>element.matches(':popover-open')),false,'scrolled-out control gets no floating hint');
    await page.locator('.classic-sidebar').evaluate(element=>{element.scrollTop=0;});
    await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1100,800));
    await page.waitForFunction(()=>document.querySelector('button[data-hotkey="translate"] [data-hotkey-badge]')?.matches(':popover-open'));
    await page.keyboard.press('Control+k');await page.locator('#settings-tab-hotkeys').waitFor();await verify('settings dialog');
    assert.equal(await move.evaluate(e=>e.matches(':popover-open')),false,'modal hides editor hints');
    await click(page.getByRole('button',{name:'Close Settings',exact:true}));
    await page.waitForFunction(()=>document.querySelector('button[data-hotkey="translate"] [data-hotkey-badge]')?.matches(':popover-open'));
    console.log('✓ Scroll, resize and modal availability keep labels attached to their visible controls');

    const camera=()=>page.evaluate(()=>{const host=document.querySelector('[aria-label="3D model viewport"]');{ const s = findFiberState(host, s => s?.renderer&&s?.entries); if (s?.renderer&&s?.entries) return s.camera.quaternion.toArray(); }
throw Error('camera missing');});
    const rotation=await camera(), canvas=await page.locator('.classic-view canvas').first().boundingBox();
    await page.mouse.move(canvas.x+canvas.width/2,canvas.y+canvas.height/2);await page.keyboard.down('Alt');await page.mouse.down();await page.mouse.move(canvas.x+canvas.width/2+70,canvas.y+canvas.height/2+45,{steps:8});await page.mouse.up();await page.keyboard.up('Alt');
    assert.notDeepEqual(await camera(),rotation,'real Alt drag still rotates');
    await click(page.locator('.learner-tool'));await click(page.locator('.learn-menu [data-hotkey="show-hotkeys"]'));await page.keyboard.press('Escape');
    assert.equal(await page.locator('[data-hotkey-badge]:popover-open').count(),0);
    await page.keyboard.down('Alt');await verify('held Alt');await page.keyboard.up('Alt');
    // A lone Alt keeps the hints for the next key; Escape puts them away.
    assert.ok(await page.locator('[data-hotkey-badge]:popover-open').count()>5,'tapped Alt keeps hints');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('[data-hotkey-badge]:popover-open').count(),0);
    // "Alt, then R" runs Alt+R (Recovery) instead of R (Rotate).
    await page.keyboard.press('Alt');await page.keyboard.press('KeyR');
    await page.locator('[role="dialog"]',{hasText:'Recovery'}).waitFor();
    assert.equal(await page.locator('[data-hotkey-badge]:popover-open').count(),0);
    assert.deepEqual(errors,[]);
    console.log('✓ Labels ignore mouse input, real camera drag works, persistent, held- and tapped-Alt hints dismiss correctly; Alt then R runs Alt+R');
  } finally {await closeApp(app);await fs.rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:300});}
})().then(()=>process.exit(0),error=>{console.error(error);process.exit(1);});
