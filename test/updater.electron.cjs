const { launchApp, closeApp, settle: settlePage } = require('./helpers/app.cjs');
// Exercise the packaged renderer with deterministic release responses and an isolated profile.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root=path.resolve(__dirname,'..');
const appRoot=process.env.MDLXL_TEST_APP_ROOT||root;
(async()=>{
  const output=path.join(root,'out/updater');fs.mkdirSync(output,{recursive:true});
  const run=fs.mkdtempSync(path.join(output,'ui-')),entry=path.join(run,'main.cjs');
  fs.writeFileSync(entry,`
    const {app,BrowserWindow,dialog,shell}=require('electron');
    app.getAppPath=()=>${JSON.stringify(appRoot)};app.getVersion=()=> '0.18.8';
    global.updaterTest={calls:[],links:[],installs:0,closePrompts:0};
    shell.openExternal=async url=>{updaterTest.links.push(url);};
    dialog.showMessageBoxSync=()=>{updaterTest.closePrompts++;return 1;};
    const {Updater}=require(${JSON.stringify(path.join(appRoot,'electron/updater.cjs'))});
    Updater.prototype.initialize=async function(){this.publish({canInstall:true,previousVersion:'0.18.7'});};
    Updater.prototype.response=async function(url){
      updaterTest.calls.push(url);
      if(url.includes('api.github.com'))return {json:async()=>({tag_name:process.env.UPDATE_TEST_CURRENT==='1'?'v0.18.8':'v0.19.0',html_url:'https://github.com/UnsctMagic/MDLxL/releases/tag/v0.19.0',name:'Future release',body:'[English](https://github.com/UnsctMagic/MDLxL/blob/v0.19.0/docs/RELEASE-0.19.0.md)\\n[Русский](https://github.com/UnsctMagic/MDLxL/blob/v0.19.0/docs/RELEASE-0.19.0-RU.md)\\n[简体中文](https://github.com/UnsctMagic/MDLxL/blob/v0.19.0/docs/RELEASE-0.19.0-ZH-CN.md)',assets:[{name:'MDLxL-0.19.0-win32-x64.zip',browser_download_url:'https://github.com/UnsctMagic/MDLxL/releases/download/v0.19.0/MDLxL-0.19.0-win32-x64.zip'}]})};
      return {text:async()=>url.endsWith('-RU.md')?'- Исправлено сохранение моделей.\\n- Улучшена библиотека текстур.':'- Model saving improved.\\n- Texture library improved.'};
    };
    Updater.prototype.prepare=async function(){updaterTest.installs++;this.pending=true;return this.publish({state:'ready'});};
    app.on('browser-window-created',(_,win)=>win.webContents.setBackgroundThrottling(false));
    require(${JSON.stringify(path.join(appRoot,'electron/main.cjs'))});
  `);
  for(const scenario of ['manual','startup','current']){
    const profile=path.join(run,scenario);fs.mkdirSync(profile,{recursive:true});
    fs.writeFileSync(path.join(profile,'settings.json'),JSON.stringify({preferences:{language:scenario==='startup'?'ru':'en',checkUpdatesOnStartup:scenario==='startup'}}));
    const app=(await launchApp({ out: path.resolve('out'), profile: profile, entry, args: (['--disable-backgrounding-occluded-windows',entry]).filter(arg => arg !== path.resolve(__dirname, '..') && arg !== '--disable-backgrounding-occluded-windows' && arg !== entry), env: { MDLVIS_HEADLESS:'1', UPDATE_TEST_CURRENT:scenario==='current'?'1':'0' }, timeout: 30000 })).app;
    const errors=[];
    try{
      const page=await app.firstWindow();page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));
      await page.waitForFunction(()=>!!document.querySelector('.classic-app canvas'));
      // waitForFunction treats an async predicate's Promise as truthy and returns at once.
      const until=async check=>{for(const end=Date.now()+15000;!(await check());await new Promise(resolve=>setTimeout(resolve,100)))if(Date.now()>end)throw Error('Timed out waiting for updater state.');};
      const command=id=>app.evaluate(({BrowserWindow},id)=>BrowserWindow.getAllWindows()[0].webContents.send('menu',id),id);
      if(scenario==='startup'){
        const prompt=page.locator('[role="dialog"]').filter({has:page.locator('[data-hotkey="update:install"]')});
        await prompt.waitFor();assert.match(await prompt.innerText(),/Обновить и перезапустить/);assert.match(await prompt.innerText(),/Исправлено сохранение моделей/);
        assert.equal(await app.evaluate(()=>updaterTest.installs),0);
        await page.locator('[data-hotkey="update:later"]').dispatchEvent('click');await prompt.waitFor({state:'detached'});
      }else{
        assert.equal(await page.locator('[data-hotkey="update:install"]').count(),0);
        assert.equal((await app.evaluate(()=>updaterTest.calls)).length,0);
        await command('help');const help=page.getByRole('dialog',{name:'MDLxL help'});await help.waitFor();
        await help.locator('.official-website a').dispatchEvent('click');assert.equal((await app.evaluate(()=>updaterTest.links)).at(-1),'https://www.lowpolyworks.com/mdlxl');
        await help.locator('[data-hotkey="close"]').dispatchEvent('click');
        await command('about');const about=page.getByRole('dialog',{name:'About MDLxL'});await about.waitFor();assert.equal(await about.locator('.official-website a').count(),1);await about.locator('[data-hotkey="close"]').dispatchEvent('click');
        await command('settings');await page.locator('.settings-window').waitFor();
        await page.locator('.settings-window [data-hotkey="tab:configuration"]').dispatchEvent('click');
        assert.equal(await page.locator('[data-hotkey="updates:startup"]').isChecked(),false);
        assert.equal(await page.locator('[data-hotkey="updates:revert"]').isEnabled(),true);
        await page.locator('[data-hotkey="updates:check"]').dispatchEvent('click');
        if(scenario==='current'){
          await page.getByText('You have the latest version.',{exact:true}).waitFor();assert.equal(await page.locator('[data-hotkey="update:install"]').count(),0);
        }else{
          const prompt=page.getByRole('dialog',{name:'MDLxL update'});await prompt.waitFor();assert.equal(await prompt.locator('li').count(),2);
          const top=await prompt.evaluate(node=>{const r=node.getBoundingClientRect();return document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)?.closest('[role="dialog"]')===node;});assert.equal(top,true,'update prompt appears above Settings');
          assert.equal(await prompt.locator('a').count(),5);
          await prompt.locator('a').first().dispatchEvent('click');assert.match((await app.evaluate(()=>updaterTest.links)).at(-1),/RELEASE-0.19.0.md$/);
          await page.locator('[data-hotkey="update:install"]').dispatchEvent('click');
          // The prepared update is cancelled by the close confirmation and returns to "available".
          await until(async()=>await app.evaluate(()=>updaterTest.installs)===1&&(await page.evaluate(()=>window.desktop.updateStatus())).state==='available');
          assert.equal(await app.evaluate(()=>updaterTest.installs),1);assert.ok(await app.evaluate(()=>updaterTest.closePrompts)>0,'cancel uses the existing close confirmation');
          await page.locator('[data-hotkey="update:later"]').dispatchEvent('click');
          await page.locator('[data-hotkey="updates:startup"]').dispatchEvent('click');
          await until(async()=>(await page.evaluate(()=>window.desktop.getSettings())).preferences.checkUpdatesOnStartup===true);
        }
      }
      assert.deepEqual(errors,[]);console.log('PASS updater UI '+scenario);
    }finally{await app.evaluate(({dialog})=>{dialog.showMessageBoxSync=()=>2;});await closeApp(app);}
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
