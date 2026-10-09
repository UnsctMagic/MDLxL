const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');

(async () => {
  const output = path.join(root, 'out/shredder-ui');
  await fs.mkdir(output, { recursive: true });
  const run = await fs.mkdtemp(path.join(output, 'run-'));
  const packaged = process.env.MDLXL_TEST_PACKAGE || path.join(root, 'out/shredder-package/MDLxL-win32-x64');
  const fixture = path.join(run, 'MDLxL-win32-x64');
  await fs.cp(packaged, fixture, { recursive: true });
  const entry = path.join(fixture, 'resources/app/electron/main.cjs');
  const runtimeDist = path.join(fixture, 'resources/app/dist');
  const emitted = await fs.readdir(path.join(runtimeDist,'assets'));
  for (const name of ['0','1']) {
    const file = emitted.find(file => file.startsWith(name+'-') && file.endsWith('.png'));
    assert.ok(file, 'sprite sheet is emitted as a PNG asset');
    assert.deepEqual(await fs.readFile(path.join(runtimeDist,'assets',file)),await fs.readFile(path.join(root,'app/assets/update',name+'.png')),'sprite bytes stay unchanged');
  }
  const bootstrap = `
    (()=>{
    const {app,BrowserWindow,dialog}=require('electron');
    const nativeSavePrompt=dialog.showMessageBoxSync;
    global.shredderTest={installs:0,closePrompts:0};
    dialog.showMessageBoxSync=(...args)=>{shredderTest.closePrompts++;return process.env.MDLXL_REAL_SAVE_PROMPT==='1'?nativeSavePrompt(...args):1;};
    const {Updater}=require('./updater.cjs');
    Updater.prototype.initialize=async function(){shredderTest.updater=this;return this.publish({canInstall:true});};
    Updater.prototype.check=async function(){return this.publish({state:'available',currentVersion:'0.20.1',release:{version:'0.20.2',summary:['Model saving improved.'],notes:{},url:'https://github.com/UnsctMagic/MDLxL/releases/tag/v0.20.2'}});};
    Updater.prototype.prepare=async function(){shredderTest.installs++;this.publish({state:'downloading',total:100,received:3});return new Promise(resolve=>{shredderTest.finish=()=>resolve(this.publish({state:'ready'}));});};
    app.on('browser-window-created',(_,win)=>win.webContents.setBackgroundThrottling(false));
    })();
  `;
  await fs.writeFile(entry, bootstrap + await fs.readFile(entry, 'utf8'));
  await fs.writeFile(path.join(output, 'last-fixture.txt'), fixture);
  const profile = path.join(run, 'profile');
  await fs.mkdir(profile);
  await fs.writeFile(path.join(profile, 'settings.json'), JSON.stringify({preferences:{language:'en',checkUpdatesOnStartup:false}}));
  const app = await _electron.launch({executablePath:path.join(fixture,'MDLxL.exe'),args:['--disable-backgrounding-occluded-windows'],env:{...process.env,MDLXL_PROFILE:profile},timeout:30000});
  const errors = [];
  let page;
  try {
    page = await app.firstWindow();
    page.setDefaultTimeout(15000);
    page.on('pageerror', error => errors.push(error.message));
    await page.waitForFunction(() => !!document.querySelector('.classic-app canvas'));
    assert.equal(await page.locator('.update-shredder-layer').count(),0);
    const sidebar = await page.locator('.classic-sidebar').first().boundingBox();
    await app.evaluate(() => shredderTest.updater.check());
    await page.getByRole('dialog',{name:'MDLxL update'}).waitFor();
    assert.equal(await page.locator('.update-shredder-layer').count(),0);
    await page.clock.install({time:new Date('2026-10-07T12:00:00Z')});
    await page.clock.pauseAt(new Date('2026-10-07T12:00:01Z'));
    const capture = async name => {
      if(process.env.MDLVIS_HEADLESS==='1') return;
      await page.clock.resume();
      try { await page.screenshot({path:path.join(output,name)}); }
      finally { await page.clock.pauseAt(await page.evaluate(()=>Date.now())+500); }
    };
    for (let spot = 0; spot < 4; spot++) {
      await page.mouse.move(10, 10);
      await page.evaluate(value => { Math.random = () => value; }, (spot + .1) / 4);
      if (spot === 0) await page.locator('[data-warmkey="update:install"]').click({force:true});
      else await app.evaluate(() => shredderTest.updater.publish({state:'downloading',received:3}));
      await page.locator('.update-shredder').waitFor({state:'attached'});
      const box = page.getByRole('dialog',{name:'MDLxL update'});
      const before = await box.boundingBox();
      const bird = page.locator('.update-shredder');
      for (let step=0; step<40 && await bird.getAttribute('data-phase')!=='peek'; step++) await page.clock.runFor(250);
      await page.clock.runFor(3200);
      assert.equal(await bird.getAttribute('data-phase'),'peek');
      assert.equal(await bird.getAttribute('data-spot'),String(spot));
      const sprite = await bird.locator('div').evaluate(async node => {
        const url = node.style.backgroundImage.slice(4,-1).replace(/^['"]|['"]$/g,'');
        const image = new Image(); image.src = new URL(url,document.baseURI).href;
        await image.decode();
        return { url:image.src, width:image.naturalWidth, height:image.naturalHeight };
      });
      assert.match(sprite.url, /\/assets\/0-[^/]+\.png$/, 'the visible sprite loads the emitted asset');
      assert.ok(sprite.width > 0 && sprite.height > 0);
      assert.deepEqual(await box.boundingBox(),before,'the visitor takes no dialog space');
      assert.equal((await page.locator('.classic-sidebar').first().boundingBox()).width,sidebar.width);
      await capture(`peek-${spot}.png`);
      const hit = await page.evaluate(spot => {
        const box = document.querySelector('.update-overlay [role="dialog"]'), r = box.getBoundingClientRect();
        const x = [r.left+r.width*.28,r.right+22,r.left+r.width*.78,r.left-22][spot];
        const y = [r.top-22,r.top+r.height*.24,r.bottom+22,r.top+r.height*.86][spot];
        return {x,y,bird:!!document.elementFromPoint(x,y)?.closest('.update-shredder'),covered:!!document.elementFromPoint(r.left+20,r.top+40)?.closest('[role="dialog"]')};
      },spot);
      assert.equal(hit.bird,true,'the visible portion is behind the edge of the box');
      assert.equal(hit.covered,true,'the box hides the rest of the body');
      if (spot === 0) {
        const picture = bird.locator('div');
        const left = await picture.evaluate(node => node.style.backgroundPosition);
        await page.clock.runFor(2700);
        assert.notEqual(await picture.evaluate(node => node.style.backgroundPosition),left,'he looks in both directions');
        const peckFrames = [];
        for (let step=0; step<25; step++) {
          await page.clock.runFor(100);
          peckFrames.push(await picture.evaluate(node => node.style.backgroundPosition));
        }
        assert.ok(peckFrames.includes('0px -1560px'),'the head dips toward the box');
      }
      await page.mouse.move(hit.x,hit.y);
      await page.mouse.down(); await page.mouse.up();
      await page.clock.runFor(400);
      assert.equal(await bird.evaluate(node => node.style.visibility),'hidden','a click attempt makes him escape');
      await page.mouse.move(10,10);
      await page.clock.runFor(900);
      assert.equal(await bird.getAttribute('data-phase'),'peek','he returns soon after dodging a click');
      await page.clock.runFor(1200);
      assert.equal(await page.evaluate(({x,y}) => !!document.elementFromPoint(x,y)?.closest('.update-shredder'), hit),true,'the quicker return is visibly exposed');
      await app.evaluate(() => shredderTest.updater.publish({state:'available'}));
      await page.locator('.update-shredder-layer').waitFor({state:'detached'});
    }
    await app.evaluate(() => shredderTest.updater.publish({state:'downloading',received:3,total:100}));
    await page.clock.runFor(4000);
    await app.evaluate(() => shredderTest.updater.publish({received:94}));
    await page.clock.runFor(600);
    assert.equal(await page.locator('.update-shredder').getAttribute('data-phase'),'fly');
    await capture('flight.png');
    await page.clock.runFor(3000);
    assert.equal(await page.locator('.update-shredder').getAttribute('data-phase'),'gone');
    await page.clock.fastForward(45000);
    assert.equal(await page.locator('.update-shredder').getAttribute('data-phase'),'gone','the departure is final');
    await app.evaluate(() => shredderTest.finish());
    await page.waitForFunction(async () => (await window.desktop.updateStatus()).state === 'available');
    assert.ok(await app.evaluate(() => shredderTest.closePrompts) > 0,'the normal unsaved-model prompt still runs');
    assert.equal(await page.locator('.update-shredder-layer').count(),0);
    await page.locator('[data-warmkey="update:later"]').click({force:true});
    assert.equal(await page.locator('.update-overlay').count(),0);
    await app.evaluate(() => {shredderTest.updater.publish({state:'available'});shredderTest.updater.publish({state:'downloading',total:0,received:0});});
    await page.locator('.update-shredder').waitFor({state:'attached'});
    await page.clock.runFor(4000);
    await app.evaluate(() => shredderTest.updater.publish({state:'ready'}));
    await page.clock.runFor(600);
    assert.equal(await page.locator('.update-shredder').getAttribute('data-phase'),'fly','ready starts the exit when download size is unknown');
    await app.evaluate(() => shredderTest.updater.publish({state:'error',error:'Fixture download interrupted.'}));
    await page.locator('.update-shredder-layer').waitFor({state:'detached'});
    assert.equal(await app.evaluate(() => shredderTest.installs),1);
    assert.deepEqual(errors,[]);
    console.log('PASS packaged Shredder: four locations, slow looks/peck, escape, final departure, unchanged dialog and save flow');
  } finally {
    await page?.clock.resume();
    await app.evaluate(({dialog}) => {dialog.showMessageBoxSync=()=>2;});
    await app.close();
  }
})().catch(error => {console.error(error);process.exitCode=1;});
