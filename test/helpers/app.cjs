// Shared launcher for the app harnesses in test/*.electron.cjs (see docs/PACKAGED-TESTS.md#shared-helper).
// One variable chooses the app under test: MDLXL_TEST_EXE (an MDLxL.exe), else MDLXL_SUITE_PKG (an unzipped
// MDLxL-win32-x64 folder), else the development Electron with this repo's dist/.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { PROBE_SOURCE } = require('./fiber-probe.cjs');
const childProcess = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const devElectron = () => { try { return require('electron'); } catch { return path.join(root, 'node_modules/electron/dist/electron.exe'); } };
const profiles = new WeakMap();

function appTarget(env = process.env) {
  if (env.MDLXL_TEST_EXE) return { executablePath: path.resolve(env.MDLXL_TEST_EXE), args: [], packaged: true };
  if (env.MDLXL_SUITE_PKG) return { executablePath: path.join(path.resolve(env.MDLXL_SUITE_PKG), 'MDLxL.exe'), args: [], packaged: true };
  return { executablePath: devElectron(), args: [root], packaged: false };
}

// The built renderer the target loads: resources/app/dist beside a packaged exe, this repo's dist/ otherwise.
const appDist = (target = appTarget()) => target.packaged ? path.join(path.dirname(target.executablePath), 'resources/app/dist') : path.join(root, 'dist');

function sha256File(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }

// Identifies the exact renderer bundle a run tested: index.html plus every file in assets/, by name and content.
function bundleHashes(target = appTarget()) {
  const dist = appDist(target), assets = path.join(dist, 'assets'), bundle = crypto.createHash('sha256');
  for (const name of fs.readdirSync(assets).sort()) bundle.update(name).update(fs.readFileSync(path.join(assets, name)));
  return { indexHash: sha256File(path.join(dist, 'index.html')), assetsHash: bundle.digest('hex') };
}

const loadPlaywright = () => require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

// Starts the app with a throwaway profile under out/, hidden off-screen, unthrottled, collecting page errors.
// show: 'inactive' shows the window without focus (default), 'hide' keeps it hidden.
// settings: optional settings.json written into the new profile before start.
// entry: a DEV_ONLY wrapper; profile/errors: retain a harness's seeded fixture profile and error collection.
async function launchApp({ fixture, out, entry, target = appTarget(), cwd, profile: seededProfile, errors = [], args = [], env = {}, playwright, settings, bounds = { x: -3000, y: 0, width: 1280, height: 920 }, show = 'inactive', timeout = 60000, pageTimeout = 20000 } = {}) {
  if (!out) throw Error('launchApp needs an out folder for its profile');
  const { _electron } = playwright || loadPlaywright();
  if (entry && target.packaged) throw Error('A wrapper entry needs a DEV_ONLY harness');
  const profile = seededProfile ? path.resolve(seededProfile) : path.join(path.resolve(out), `profile-${Date.now()}-${process.pid}`);
  if (!profile.startsWith(path.resolve(out) + path.sep)) throw Error('Test profiles must be inside out');
  fs.mkdirSync(profile, { recursive: true });
  if (settings) fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify(settings));
  const app = await _electron.launch({
    executablePath: target.executablePath, cwd,
    args: [...(entry ? [entry] : target.args), ...(fixture ? [fixture] : []), '--disable-backgrounding-occluded-windows', ...args],
    env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_TEST_HOOK: '1', MDLXL_PROFILE: profile, ...env },
    timeout,
  });
  profiles.set(app, { profile, child: app.process?.() });
  const page = await app.firstWindow();
  await prepareWindow(app, page, { bounds, show, pageTimeout, errors });
  return { app, page, errors, profile, target };
}

// The OptimizeXL review is a second window; apply the same hidden setup, errors and probes there.
async function prepareWindow(app, page, { bounds = { x: -3000, y: 0, width: 1280, height: 920 }, show = 'inactive', pageTimeout = 20000, errors = [] } = {}) {
  page.setDefaultTimeout(pageTimeout); page.on('pageerror', error => errors.push(error.message));
  await app.evaluate(({ BrowserWindow }, { bounds, show }) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.setBackgroundThrottling(false); if (bounds) win.setBounds(bounds);
      if (show === 'hide') win.hide(); else win.showInactive();
    }
  }, { bounds, show });
  await page.addInitScript(PROBE_SOURCE).catch(() => {});
  await page.evaluate(PROBE_SOURCE).catch(() => {});
}

// Replaces native dialogs in the main process. save: path for Save dialogs; open: path or paths for Open dialogs;
// message: button index for message boxes. A missing value cancels that dialog.
async function stubDialogs(app, { save, open, message } = {}) {
  await app.evaluate(({ dialog }, { save, open, message }) => {
    if (save !== undefined) dialog.showSaveDialog = async () => ({ canceled: !save, filePath: save || undefined });
    if (open !== undefined) dialog.showOpenDialog = async () => ({ canceled: !open, filePaths: open ? [].concat(open) : [] });
    if (message !== undefined) { dialog.showMessageBox = async () => ({ response: message, checkboxChecked: false }); dialog.showMessageBoxSync = () => message; }
  }, { save, open, message });
}

// Clicks an application-menu item by id or by its label without the & mnemonic and shortcut text.
async function clickMenu(app, id) {
  await app.evaluate(({ Menu }, id) => {
    const all = menu => menu.items.flatMap(item => [item, ...(item.submenu ? all(item.submenu) : [])]);
    const item = all(Menu.getApplicationMenu()).find(item => item.id === id || item.label.replace('&', '').split('\t')[0] === id);
    if (!item) throw Error('No menu item ' + id);
    item.click();
  }, id);
}

const settle = (page, ms = 150) => page.waitForTimeout(ms);

// Quits the app and removes the throwaway profile launchApp created.
// keepProfile is only for a test that immediately restarts with the same disposable draft/library.
async function closeApp(app, { keepProfile = false } = {}) {
  const { profile, child } = profiles.get(app);
  try { await app.evaluate(({ app }) => app.exit(0)); } catch { /* the connection closes as the app exits */ }
  const exited = () => !child || child.exitCode !== null || !!child.signalCode;
  const waitForExit = () => exited() ? Promise.resolve(true) : new Promise(resolve => {
    const done = () => { clearTimeout(timer); child.removeListener('exit', done); resolve(true); };
    const timer = setTimeout(() => { child.removeListener('exit', done); resolve(false); }, 10000);
    child.once('exit', done);
  });
  if (!await waitForExit()) {
    // Playwright's Windows child is a cmd wrapper. Stop its whole owned tree
    // before removing a profile that Chromium can still have open.
    console.warn('Test app did not exit; stopping its launched process tree.');
    let failure;
    if (process.platform === 'win32') failure = await new Promise(resolve => childProcess.execFile('taskkill', ['/T', '/F', '/PID', String(child.pid)], { windowsHide: true }, error => resolve(error)));
    else child.kill('SIGKILL');
    if (!await waitForExit()) throw failure || Error('Test app process did not exit.');
  }
  if (profile && !keepProfile) {
    // Particle fixtures can contain junctions to read-only source libraries. Remove links before the tree.
    const unlink = directory => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isSymbolicLink()) { if (fs.statSync(file).isDirectory()) fs.rmdirSync(file); else fs.unlinkSync(file); }
        else if (entry.isDirectory()) unlink(file);
      }
    };
    if (fs.existsSync(profile)) unlink(profile);
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
  profiles.delete(app);
}

module.exports = { root, appTarget, appDist, bundleHashes, launchApp, prepareWindow, stubDialogs, clickMenu, sha256File, settle, closeApp };
