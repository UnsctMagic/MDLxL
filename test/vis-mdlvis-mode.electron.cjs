// Run with pnpm run test:packaged default vis-mdlvis-mode (hidden desktop on Windows).
// MDLXL_SUITE_PKG selects a disposable package; MDLXL_VIS_OUT selects evidence output.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');
const VIS_MENU = require('../src/vis-view-menu.json');
const VIEW_MENU = require('../src/view-menu.json');
const root = path.resolve(__dirname, '..');
const out = path.resolve(process.env.MDLXL_VIS_OUT || path.join(root, 'out/vis-mdlvis-mode'));
const pkg = process.env.MDLXL_SUITE_PKG || path.join(root, 'out/pkg/MDLxL-win32-x64');
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

(async () => {
  if (process.platform === 'win32') assert.equal(process.env.MDLXL_SUITE_HIDDEN, '1', 'Run through the hidden-desktop packaged runner');
  fs.mkdirSync(out, { recursive: true });
  const fixture = path.join(out, 'VIS-test.mdx');
  fs.copyFileSync(path.join(root, 'fixtures/demo.mdx'), fixture);
  const originalHash = digest(fs.readFileSync(fixture));
  const profile = path.join(out, 'profile'); fs.mkdirSync(profile, { recursive: true });
  fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify({ preferences: { rendererRevision: 3, graphics: { pauseWhenHidden: false } } }));
  const app = await _electron.launch({ executablePath: path.join(pkg, 'MDLxL.exe'), args: ['--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-gpu-vsync', '--disable-frame-rate-limit', fixture], cwd: root, env: { ...process.env, MDLVIS_HEADLESS: '', MDLXL_PROFILE: profile }, timeout: 60000 });
  const records = [], errors = [];
  try {
    const page = await app.firstWindow(); page.setDefaultTimeout(20000);
    page.on('pageerror', error => errors.push(error.message));
    await page.locator('.vis-toggle').waitFor();
    await page.evaluate(() => {
      // Count the real layout reads, including callbacks left behind by a previous XL row.
      window.visWidthReads = 0;
      for (const key of ['scrollWidth', 'clientWidth']) {
        const original = Object.getOwnPropertyDescriptor(Element.prototype, key);
        Object.defineProperty(Element.prototype, key, { ...original, get() {
          if (this.matches('.classic-app[data-vis-ui] .editor-modules')) window.visWidthReads++;
          return original.get.call(this);
        } });
      }
      window.visProbe = () => {
        let doc, controls;
        for (const start of [document.querySelector('.classic-app'), document.querySelector('.game-preview-root,.viewport')]) {
          for (let fiber = start?.[Object.keys(start).find(key => key.startsWith('__reactFiber'))]; fiber; fiber = fiber.return) {
            for (let hook = fiber.memoizedState; hook; hook = hook.next) {
              const value = hook.memoizedState;
              if (value?.doc?.model) doc = value.doc;
              if (value?.current?.controls?.object) controls = value.current.controls;
            }
          }
        }
        if (!doc || !controls) throw Error('Live document or preview controls unavailable');
        return { model: JSON.stringify(doc.model), bytes: Array.from(new Uint8Array(doc.serialize('mdx'))), revision: doc.revision, undo: doc.historyStats.undoSteps, camera: controls.object.quaternion.toArray() };
      };
    });
    const menu = action => app.evaluate(({ BrowserWindow }, id) => BrowserWindow.getAllWindows()[0].webContents.send('menu', id), action);
    const modelState = value => ({ model: value.model, bytes: digest(Buffer.from(value.bytes)), revision: value.revision, undo: value.undo });
    const { COMMANDS } = await import('../src/commands.js');
    const press = async key => {
      const parts = key.split(' > ');
      await page.keyboard.press(parts[0].replace('Ctrl', 'Control'));
      if (parts[1]) for (const letter of parts[1]) await page.keyboard.press(letter);
    };
    for (const [width, height] of [[900, 760], [1100, 760], [1920, 1080]]) {
      await app.evaluate(({ BrowserWindow }, size) => { const win = BrowserWindow.getAllWindows()[0]; win.unmaximize(); win.setContentSize(...size); win.webContents.setBackgroundThrottling(false); }, [width, height]);
      for (const [mode, viewMode] of [['vertices', 'vertices'], ['bones', 'bones'], ['animation', 'movement'], ['animations', 'animations']]) {
        await menu(mode); await page.waitForTimeout(250);
        await page.getByLabel('View direction', { exact: true }).selectOption('perspective');
        await page.waitForFunction(() => { try { return !!visProbe().camera; } catch { return false; } });
        const initial = modelState(await page.evaluate(() => visProbe()));
        for (const vis of [true, false]) {
          if (await page.locator('.classic-app').getAttribute('data-vis-ui') !== (vis ? 'true' : null)) await page.locator('.vis-toggle').click();
          await page.waitForTimeout(150);
          const row = page.locator('.editor-modules');
          const data = await page.evaluate(() => {
            const visible = e => !!e.getBoundingClientRect().width && !!e.getBoundingClientRect().height;
            const q = document.querySelector('.quick-display'), bounds = document.querySelector('.editor-modules').getBoundingClientRect();
            return { size: [innerWidth, innerHeight], short: document.querySelector('.editor-modules').hasAttribute('data-short-editors'), reads: window.visWidthReads,
              tabs: [...document.querySelectorAll('.model-tabs-bar')].filter(visible).length, editors: [...document.querySelectorAll('.editor-modules>button')].filter(visible).length,
              icons: q.querySelectorAll('.look-icon').length, quick: [...q.querySelectorAll('label')].map(e => {
                const input = e.querySelector('input'), s = getComputedStyle(input), r = e.getBoundingClientRect(), name = e.querySelector('.quick-display-name');
                return { name: e.textContent, action: input.dataset.hotkey, checkbox: input.type, opacity: s.opacity, position: s.position, visible: visible(e) && r.left >= bounds.left && r.right <= bounds.right, fullName: getComputedStyle(name).display !== 'none', radius: getComputedStyle(e).borderRadius };
              }), topDock: !!document.querySelector('.classic-toolbar>.toolbar-modules'), dockInEditorRow: (() => { const d = document.querySelector('.toolbar-modules').getBoundingClientRect(), r = document.querySelector('.classic-modules').getBoundingClientRect(); return d.top >= r.top && d.bottom <= r.bottom; })(),
              hint: document.querySelector('.classic-status').innerText, inputAtTop: !!document.querySelector('.classic-toolbar .compact-input-strength') };
          });
          assert.deepEqual(data.size, [width, height]);
          assert.deepEqual(data.quick.map(({ name, action }) => [name, action]), (vis ? VIS_MENU : VIEW_MENU)[viewMode].filter(([, action]) => action !== 'clearDisplay' && !(vis && ['display:bones', 'display:attachments'].includes(action))));
          if (vis) {
            assert.equal(data.short, false); assert.equal(data.reads, 0); assert.equal(data.tabs, 0); assert.equal(data.editors, 0); assert.equal(data.icons, 0);
            assert.ok(data.quick.every(item => item.checkbox === 'checkbox' && item.opacity === '1' && item.position === 'static' && item.visible && item.fullName && item.radius === '0px'));
            assert.equal(data.dockInEditorRow, true); assert.equal(data.topDock, true); assert.equal(data.inputAtTop, true);
            assert.ok(data.hint.includes({ vertices: 'Vertex editor (F1)', bones: 'Bones · Rest pose', animation: 'Movement (F3)', animations: 'Animations' }[mode]));
          } else {
            assert.equal(data.tabs, 1); assert.equal(data.editors, 6); assert.ok(data.icons > 0); assert.equal(data.topDock, true); assert.equal(data.dockInEditorRow, false); assert.equal(data.inputAtTop, false);
            assert.equal(data.short, await row.evaluate(e => { const short = e.hasAttribute('data-short-editors'); e.removeAttribute('data-short-editors'); const overflow = e.scrollWidth > e.clientWidth; if (short) e.setAttribute('data-short-editors', ''); return overflow; }));
          }
          // Exercise each checkbox and its existing assigned key in the wide VIS view.
          if (vis && width === 1920) for (const item of data.quick) {
            const input = page.locator(`.quick-display input[data-hotkey="${item.action}"]`);
            if (await input.isDisabled()) continue;
            const checked = await input.isChecked(); await input.click(); assert.equal(await input.isChecked(), !checked, `${viewMode}/${item.name} checkbox toggles`);
            const key = COMMANDS.find(command => command.id === item.action)?.defaultKeys[0];
            if (key) { await page.evaluate(() => document.activeElement?.blur()); await press(key); }
            else await input.click();
            assert.equal(await input.isChecked(), checked, `${viewMode}/${item.name} key restores checked state`);
          }
          const before = await page.evaluate(() => visProbe());
          const box = await page.locator('.game-preview-root,.viewport').first().boundingBox();
          const x = box.x + box.width * .35, y = box.y + box.height * .45;
          await page.keyboard.down('Alt'); await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 70, y + 30, { steps: 8 }); await page.mouse.up(); await page.keyboard.up('Alt');
          await page.waitForTimeout(100);
          const after = await page.evaluate(() => visProbe());
          const delta = Math.hypot(...after.camera.map((value, i) => value - before.camera[i]));
          assert.ok(delta > .01, `${mode}/${width}/${vis ? 'VIS' : 'XL'} real mouse rotates the camera`);
          assert.deepEqual(modelState(after), initial, 'presentation, shortcuts and mouse rotation preserve model, serialized bytes and undo history');
          await page.screenshot({ path: path.join(out, `${mode}-${width}-${vis ? 'vis' : 'xl'}.png`) });
          records.push({ mode, width, height, vis, cameraDelta: delta, modelHash: digest(Buffer.from(after.model)), saveHash: digest(Buffer.from(after.bytes)), ...data });
          console.log('PASS', mode, width, vis ? 'VIS' : 'XL', 'mouse delta', delta.toFixed(4));
        }
      }
    }
    // VIS is presentation only: moving the dock must not remount the AI console.
    await page.locator('.ai-tool').click();
    const prompt = page.getByLabel('AI prompt', { exact: true });
    await prompt.fill('Unsent VIS toggle draft');
    for (let i = 0; i < 2; i++) {
      await page.locator('.vis-toggle').click();
      assert.equal(await prompt.inputValue(), 'Unsent VIS toggle draft');
    }
    await page.getByLabel('Close AI assistant', { exact: true }).click();
    console.log('PASS AI console and unsent prompt survive VIS/XL toggles');
    // Save through the real editor path, using only the disposable input copy.
    await menu('save');
    await page.waitForFunction(() => document.querySelector('.classic-status').textContent.includes('Saved VIS-test.mdx'));
    const saved = digest(fs.readFileSync(fixture));
    await page.locator('.vis-toggle').click();
    await page.waitForTimeout(100);
    const priorWrite = fs.statSync(fixture).mtimeMs;
    await menu('save');
    for (const deadline = Date.now() + 20000; fs.statSync(fixture).mtimeMs <= priorWrite && Date.now() < deadline;) await page.waitForTimeout(50);
    assert.ok(fs.statSync(fixture).mtimeMs > priorWrite, 'VIS save actually wrote the disposable model');
    await page.waitForFunction(() => !document.querySelector('.classic-status').textContent.includes('Saving'));
    assert.equal(digest(fs.readFileSync(fixture)), saved, 'actual XL/VIS file saves match');
    console.log('PASS actual XL/VIS file saves match');
    assert.deepEqual(errors, []);
    assert.equal(digest(fs.readFileSync(fixture)), originalHash, 'input bytes unchanged');
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ records, rendererErrors: errors, originalHash }, null, 2));
  } finally { await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
