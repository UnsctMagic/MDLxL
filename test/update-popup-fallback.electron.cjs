const { launchApp, closeApp } = require('./helpers/app.cjs');
// Hidden packaged regression: optional eye rendering must not take down either popup.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
(async () => {
  const output = path.join(root, 'out/update-popup-fallback');
  await fs.mkdir(output, { recursive: true });
  const run = await fs.mkdtemp(path.join(output, 'run-'));
  const fixture = path.join(run, 'app');
  let app;
  try {
    await fs.cp(process.env.MDLXL_SUITE_PKG || path.join(root, 'out/pkg/MDLxL-win32-x64'), fixture, { recursive: true });
    const runtime = path.join(fixture, 'resources/app');
    const entry = path.join(runtime, 'electron/main.cjs');
    await fs.writeFile(entry, `
      (()=>{require('electron').app.on('browser-window-created',(_,win)=>win.webContents.setBackgroundThrottling(false));const {Updater}=require('./updater.cjs');
      global.popupWelcome=options=>require('./welcome-prompt.cjs').showWelcomePrompt(null,options);
      Updater.prototype.initialize=async function(){global.popupUpdater=this;return this.publish({canInstall:true});};
      Updater.prototype.check=async function(){return this.publish({state:'available',currentVersion:'0.35.0',release:{version:'99.0.0',summary:['Popup regression'],notes:{}}});};})();
    ` + await fs.readFile(entry, 'utf8'));
    // Disable only the optional helmet's context, after the editor has loaded.
    const profile = path.join(run, 'profile');
    await fs.mkdir(profile);
    await fs.writeFile(path.join(profile, 'settings.json'), JSON.stringify({preferences:{language:'en',checkUpdatesOnStartup:false,disableSounds:true}}));
    app = (await launchApp({ out: path.dirname(profile), profile: profile, target: { executablePath: path.join(fixture,'MDLxL.exe'), args: [], packaged: true }, env: { MDLVIS_HEADLESS:'' }, timeout: 30000 })).app;
    const page = await app.firstWindow(), errors = [];
    page.setDefaultTimeout(15000);
    page.on('pageerror', error => errors.push(error.message));
    await page.locator('.classic-app canvas').first().waitFor();
    console.log('Editor loaded');
    await page.evaluate(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(type, ...args) {
        return this.hasAttribute('data-particles') ? null : getContext.call(this, type, ...args);
      };
    });
    await app.evaluate(() => popupUpdater.check());
    await page.getByRole('dialog',{name:'MDLxL update'}).waitFor();
    await page.waitForFunction(() => {
      const icon=document.querySelector('.update-helmet img');
      return icon?.complete && getComputedStyle(icon).opacity==='1';
    });
    assert.equal(await page.locator('.classic-app').count(),1,'the editor stays mounted');
    assert.equal(await page.locator('.update-helmet').getAttribute('data-effects'),null);
    await page.locator('[data-hotkey="update:later"]').click();
    assert.equal(await page.locator('.update-overlay').count(),0,'the fallback dialog closes normally');
    assert.deepEqual(errors,[]);
    console.log('Update fallback passed');

    const bundle = path.join(runtime,'dist/update-popup-effects.js');
    await fs.writeFile(bundle, 'HTMLCanvasElement.prototype.getContext=function(){return null;};\n' + await fs.readFile(bundle,'utf8'));
    async function welcome(brokenScript) {
      if (brokenScript) await fs.writeFile(bundle, 'throw Error("effects bundle unavailable");');
      await app.evaluate((_, {icon}) => {
        global.welcomeAnswer=popupWelcome({title:'MDLxL',heading:'Welcome to MDLxL',question:'Would you like to enable auto updating?',detail:'Long localized welcome text. '.repeat(30),note:'Welcome note',labels:{yes:'Yes, enable it',no:'No thanks'},icon,theme:'light',disableSounds:true});
      }, {icon:'data:image/png;base64,'+(await fs.readFile(path.join(root,'public/branding/MDLxL.png'))).toString('base64')});
      let prompt;
      for (const end=Date.now()+15000; !prompt;) {
        prompt=app.windows().find(p=>!p.isClosed()&&p.url().startsWith('data:text/html'));
        if(Date.now()>end) throw Error('Welcome did not open');
        if(!prompt) await new Promise(r=>setTimeout(r,50));
      }
      await prompt.waitForFunction(()=>innerHeight>240,{},{polling:50});
      console.log('Welcome sized',brokenScript);
      const layout=await prompt.evaluate(()=>({height:innerHeight,bottom:document.querySelector('.buttons').getBoundingClientRect().bottom,icon:getComputedStyle(document.querySelector('img')).opacity}));
      assert(layout.bottom<=layout.height,'welcome buttons and localized text fit after effects failure');
      assert.equal(layout.icon,'1','the static helmet is visible');
      await prompt.getByRole('button',{name:'No thanks'}).click();
      assert.equal(await app.evaluate(()=>welcomeAnswer),'no');
    }
    await welcome(false);
    await welcome(true);
    console.log('PASS packaged static update fallback, editor stays mounted, welcome fits with no WebGL and with failed effects bundle');
  } finally {
    if(app) { await closeApp(app).catch(()=>{}); }
    if(path.dirname(run)!==output) throw Error('Unexpected test directory');
    await fs.rm(run,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
