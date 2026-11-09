// Click-everything QA sweep (docs/QA-AND-RELEASE-KIT.md#6-click-through-qa).
// Finds every visible, enabled control in the running app, gives each one real mouse click from a known state, and
// records what happened. Windows a click opens are swept too. It is excluded from `all` and `core`; name it to run it:
//   node scripts/run-packaged-tests.mjs default click-sweep
// MDLXL_SWEEP_SETUPS = comma list of setups below, or "all" (default: baseline).
// MDLXL_SWEEP_MINUTES = time limit per setup (default 40). What was not reached is listed in the report.
// Exit 1 only for crashes, freezes and failed Undo. Dead controls, clipped and untranslated text are for review.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { launchApp, closeApp, stubDialogs, root } = require('./helpers/app.cjs');
const { fixturePath } = require('./helpers/fixtures.cjs');

const out = path.resolve(process.env.MDLXL_SWEEP_OUT || 'out/click-sweep');
const MINUTES = Number(process.env.MDLXL_SWEEP_MINUTES || 40);
const LANGUAGES = ['ru', 'es', 'zh', 'fr', 'de', 'mordor'];
const THEMES = Object.keys(require('../src/application-themes.json'));

const SETUPS = {
  baseline: {},
  'no-model': { model: null },
  footman: { model: 'footman' },
  'toolbar-trim': { prefs: { toolbarMode: 'trim' } },
  'toolbar-hidden': { prefs: { toolbarMode: 'hidden' } },
  vis: { vis: true },
  small: { bounds: { x: -3000, y: 0, width: 1024, height: 700 } },
  ...Object.fromEntries(THEMES.map(theme => ['theme-' + theme, { prefs: { theme } }])),
  ...Object.fromEntries(LANGUAGES.map(language => ['lang-' + language, { prefs: { language } }])),
};

// Each starting point is reached the way a user reaches it. Controls already clicked elsewhere are not repeated, and
// a control that was disabled in one state is tried again in the next, so the selection states matter.
const START_POINTS = [
  { name: 'vertices', path: [{ hotkey: 'vertices' }] },
  { name: 'vertices, all selected', path: [{ hotkey: 'vertices' }, { press: 'Control+a' }] },
  { name: 'bones', path: [{ hotkey: 'bones' }] },
  { name: 'bones, all selected', path: [{ hotkey: 'bones' }, { press: 'Control+a' }] },
  { name: 'movement', path: [{ hotkey: 'animation' }] },
  { name: 'animations', path: [{ hotkey: 'animations' }] },
  { name: 'managers', path: [{ menu: 'managers' }] },
  { name: 'uv', path: [{ hotkey: 'vertices' }, { press: 'Control+a' }, { hotkey: 'uv' }] },
  { name: 'showcase', path: [{ menu: 'showcase' }] },
  { name: 'settings', path: [{ press: 'Control+k' }] },
];

// Never fired, in any language: leaving the app, updating, signing in and anything sent to a person or service.
const EXACT_DENY = ['exit', 'quit', 'send'];
const DENY = [...EXACT_DENY, 'search for updates', 'update and restart', 'revert to last version', 'sign in', 'sign out', 'log in', 'log out', 'publish'];
const MENU_DENY = /^(exit|quit|recent files)$|update|revert|sign in|sign out/i;
const menuDenied = (trail, deny) => trail.some(part => MENU_DENY.test(part) || deny.includes(part.toLowerCase()) || /^AI\b/.test(part));
const CLOSE_WORDS = ['close', 'cancel', 'exit', 'done'];
const closeWords = language => {
  if (!language || language === 'en' || language === 'mordor') return CLOSE_WORDS;
  let catalog = {};
  try { catalog = JSON.parse(fs.readFileSync(path.join(root, 'src/locales', language + '.json'), 'utf8')); } catch { /* English only */ }
  return [...CLOSE_WORDS, ...['Close', 'Cancel', 'Done'].map(word => catalog[word]?.toLowerCase()).filter(Boolean)];
};
const denyWords = language => {
  if (!language || language === 'en' || language === 'mordor') return DENY;
  let catalog = {};
  try { catalog = JSON.parse(fs.readFileSync(path.join(root, 'src/locales', language + '.json'), 'utf8')); } catch { /* English only */ }
  const translated = Object.entries(catalog).filter(([english, value]) => typeof value === 'string' && DENY.includes(english.toLowerCase())).map(([, value]) => value.toLowerCase());
  return [...DENY, ...translated];
};

const shortHash = value => crypto.createHash('sha1').update(value).digest('hex').slice(0, 12);
const withTimeout = (promise, ms, label) => { let timer; return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Error('TIMEOUT ' + label)), ms); })]).finally(() => clearTimeout(timer)); };

// Runs in the page. Finds the topmost open layer and every control in it.
function readControls({ deny, exact }) {
  const visible = element => { const box = element.getBoundingClientRect(), style = getComputedStyle(element); return box.width > 1 && box.height > 1 && style.visibility !== 'hidden' && style.display !== 'none' && box.right > 0 && box.bottom > 0 && box.left < innerWidth && box.top < innerHeight; };
  const onTop = element => { const box = element.getBoundingClientRect(), hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2); return !!hit && (element === hit || element.contains(hit) || hit.contains(element) || hit.closest('label')?.contains(element)); };
  const layers = [...document.querySelectorAll('[role="menu"],.context-menu,[role="dialog"],[role="alertdialog"],.mdlxl-window')].filter(element => visible(element) && onTop(element));
  const layer = layers.at(-1) || document.body;
  const layerName = layer === document.body ? 'main' : (layer.getAttribute('aria-label') || layer.querySelector('h1,h2,h3,.title')?.textContent?.trim().slice(0, 40) || String(layer.className).split(' ')[0] || layer.tagName);
  const textOf = element => (element.getAttribute('aria-label') || element.getAttribute('title') || element.textContent || element.value || '').replace(/\s+/g, ' ').trim().slice(0, 70);
  const selector = 'button,[role=button],[role=menuitem],[role=menuitemcheckbox],[role=menuitemradio],[role=tab],[role=checkbox],[role=switch],input[type=checkbox],input[type=radio],select,summary,[data-action]';
  const groups = new Map(), seen = new Map(), controls = [], skipped = { covered: 0, repeated: 0, excluded: [], fields: layer.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=hidden]),textarea').length };
  for (const element of layer.querySelectorAll(selector)) {
    if (!visible(element) || element.disabled || element.getAttribute('aria-disabled') === 'true') continue;
    if (!onTop(element)) { skipped.covered++; continue; }
    const label = textOf(element), id = element.getAttribute('data-hotkey') || '';
    const base = `${layerName}|${element.tagName}|${id || label}`, nth = seen.get(base) || 0; seen.set(base, nth + 1);
    const key = base + '~' + nth;
    let ai = false; for (let node = element; node && !ai; node = node.parentElement) ai = [...node.classList].some(name => name.startsWith('ai-'));
    if (ai || /^AI\b/.test(label) || deny.some(word => label.toLowerCase() === word || (!exact.includes(word) && label.toLowerCase().startsWith(word + ' ')))) { skipped.excluded.push(label); continue; }
    // Long lists (bones, textures) repeat one control. Eight of each prove the row works.
    const group = `${element.tagName}|${element.className}|${element.parentElement?.className}`, count = groups.get(group) || 0;
    if (!id && count >= 8) { skipped.repeated++; continue; }
    groups.set(group, count + 1);
    const box = element.getBoundingClientRect();
    controls.push({ key, label, id, tag: element.tagName, type: element.type || '', x: box.left + box.width / 2, y: box.top + box.height / 2,
      already: element.classList.contains('active') || element.getAttribute('aria-pressed') === 'true' || element.getAttribute('aria-selected') === 'true' || element.getAttribute('aria-current') === 'true' || (element.type === 'radio' && element.checked), toggle: element.type === 'checkbox' || element.hasAttribute('aria-pressed') || element.hasAttribute('aria-checked') });
  }
  return { layerName, controls, skipped };
}

// Runs in the page. A fingerprint of everything a click can change except the 3D picture.
function readState() {
  const hash = text => { let value = 2166136261; for (let i = 0; i < text.length; i++) { value ^= text.charCodeAt(i); value = Math.imul(value, 16777619); } return (value >>> 0).toString(36); };
  const states = [...document.querySelectorAll('input,select,[aria-pressed],[aria-selected],[aria-checked],[aria-expanded],.active,.selected')].map(element => `${element.checked}${element.value}${element.getAttribute('aria-pressed')}${element.getAttribute('aria-selected')}${element.getAttribute('aria-checked')}${element.getAttribute('aria-expanded')}${element.className}`).join('|');
  let model = '', dirty = false, selection = '';
  try { const doc = window.__mdlxl.document(); dirty = !!doc?.dirty; const bytes = doc?.serialize('mdx'); if (bytes) { let value = 2166136261; for (let i = 0; i < bytes.length; i++) { value ^= bytes[i]; value = Math.imul(value, 16777619); } model = bytes.length + ':' + (value >>> 0).toString(36); } } catch { /* no document */ }
  try { selection = hash(JSON.stringify(window.__mdlxl.selection(), (key, value) => value instanceof Set ? [...value] : value) || ''); } catch { /* no selection */ }
  return { view: hash(document.body.innerText + states), elements: document.querySelectorAll('*').length, model, dirty, selection, info: window.__mdlxl.infoMessages().at(-1)?.id || 0, toasts: document.querySelectorAll('.warning-toast').length };
}

// Runs in the page. Text that does not fit, and catalog English left on a translated screen.
function readText({ catalog }) {
  const clipped = [], english = [];
  for (const element of document.querySelectorAll('button,label,th,td,h1,h2,h3,h4,span,summary,[role=tab]')) {
    if (element.closest('[translate="no"]') || !element.childNodes.length || ![...element.childNodes].some(node => node.nodeType === 3 && node.textContent.trim())) continue;
    const box = element.getBoundingClientRect(); if (box.width < 2 || box.height < 2 || box.left >= innerWidth || box.top >= innerHeight) continue;
    const style = getComputedStyle(element), text = element.textContent.trim().slice(0, 60);
    if (style.overflowX !== 'visible' && style.textOverflow !== 'ellipsis' && element.scrollWidth > element.clientWidth + 1) clipped.push(text);
    if (catalog && catalog[text] && catalog[text] !== text) english.push(text);
  }
  return { clipped: [...new Set(clipped)], english: [...new Set(english)] };
}

function prepareFixture(setup, folder) {
  const model = setup.model === undefined ? 'demo' : setup.model;
  if (model === null) return undefined;
  fs.mkdirSync(folder, { recursive: true });
  if (model === 'demo') { const file = path.join(folder, 'Sweep.mdx'); fs.writeFileSync(file, prepareFixture.demo); return file; }
  // Always a throwaway copy: Save buttons get clicked too, and the test-model collection is never written.
  const source = fixturePath(model), file = path.join(folder, 'Sweep.mdx');
  if (!fs.existsSync(source)) throw Error('Missing fixture ' + source);
  fs.copyFileSync(source, file);
  const textures = path.join(path.dirname(source), 'Textures');
  if (fs.existsSync(textures) && !fs.existsSync(path.join(folder, 'Textures'))) fs.cpSync(textures, path.join(folder, 'Textures'), { recursive: true });
  return file;
}

async function sweepSetup(name, setup) {
  const folder = path.join(out, name); fs.rmSync(folder, { recursive: true, force: true }); fs.mkdirSync(folder, { recursive: true });
  const language = setup.prefs?.language || 'en', deny = denyWords(language);
  let catalog = null; try { if (language !== 'en' && language !== 'mordor') catalog = JSON.parse(fs.readFileSync(path.join(root, 'src/locales', language + '.json'), 'utf8')); } catch { /* no catalog */ }
  const started = Date.now(), deadline = started + MINUTES * 60000;
  const result = { setup: name, clicked: 0, outcomes: {}, crashes: [], freezes: [], undo: [], dead: [], unverified: [], stuck: [], unreachable: [], clipped: {}, untranslated: {}, excluded: [], repeatedRows: 0, covered: 0, textFields: 0, notReached: [], restarts: 0 };
  const seen = new Set(), scopes = new Set(), queue = [...START_POINTS];
  let session = null, shots = 0;

  const shot = async label => { if (!session || shots >= 60) return ''; const file = `${String(++shots).padStart(2, '0')}-${label.replace(/[^\w-]+/g, '_').slice(0, 50)}.png`; await session.page.screenshot({ path: path.join(folder, file), timeout: 8000 }).catch(() => {}); return file; };
  const stop = async () => { if (!session) return; const app = session.app; session = null; await withTimeout(closeApp(app), 30000, 'close').catch(() => {}); };

  const start = async () => {
    await stop(); result.restarts++;
    const consoleErrors = [];
    const launched = await launchApp({ fixture: prepareFixture(setup, path.join(folder, 'fixture')), out: folder, bounds: setup.bounds || { x: -3000, y: 0, width: 1440, height: 1000 }, settings: { preferences: { language: 'en', learn: { enabled: false }, ...(setup.prefs || {}) } } });
    await stubDialogs(launched.app, { save: '', open: '', message: 0 });
    // Nothing a click does may leave the throwaway app: no browser, no folder window, no network.
    await launched.app.evaluate(({ shell, session, BrowserWindow }) => {
      shell.openExternal = async () => {}; shell.openPath = async () => ''; shell.showItemInFolder = () => {};
      session.defaultSession.webRequest.onBeforeRequest((details, callback) => callback({ cancel: /^(https?|wss?):/.test(details.url) && !/^(https?|wss?):\/\/(localhost|127\.)/.test(details.url) }));
      for (const win of BrowserWindow.getAllWindows()) win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    });
    launched.page.on('console', message => { if (message.type() === 'error' && !/ERR_BLOCKED|ERR_FAILED|Failed to load resource/.test(message.text())) consoleErrors.push(message.text().slice(0, 300)); });
    session = { ...launched, consoleErrors };
    await session.page.locator('.classic-toolbar,.toolbar-primary').first().waitFor({ timeout: 30000 }).catch(() => {});
    if (setup.model !== null) await session.page.locator('.model-tabs').first().waitFor({ timeout: 30000 }).catch(() => {});
    await session.page.waitForTimeout(700);
    if (setup.vis) { await command('visToggle'); await session.page.waitForTimeout(400); }
  };

  // What a native menu item sends, so a start point works in every language.
  const command = id => session.app.evaluate(({ BrowserWindow }, id) => BrowserWindow.getAllWindows()[0].webContents.send('menu', id), id);
  const park = () => session.page.mouse.move(1, 1);
  const controls = () => withTimeout(session.page.evaluate(readControls, { deny, exact: EXACT_DENY }), 10000, 'read controls');
  const state = () => withTimeout(session.page.evaluate(readState), 10000, 'read state');
  const canvas = async () => {
    const box = await session.page.evaluate(() => { const list = [...document.querySelectorAll('canvas')].map(item => item.getBoundingClientRect()).filter(item => item.width > 40 && item.height > 40 && item.left < innerWidth && item.top < innerHeight).sort((a, b) => b.width * b.height - a.width * a.height)[0]; return list ? { x: Math.max(0, list.left), y: Math.max(0, list.top), width: Math.min(list.width, innerWidth - Math.max(0, list.left)), height: Math.min(list.height, innerHeight - Math.max(0, list.top)) } : null; });
    return box ? shortHash(await session.page.screenshot({ clip: box, timeout: 8000 })) : '';
  };
  const closeExtraWindows = () => session.app.evaluate(({ BrowserWindow }) => { const all = BrowserWindow.getAllWindows(), extra = all.slice(1); for (const win of extra) win.destroy(); return extra.length; });

  const walk = async steps => {
    for (const step of steps) {
      if (step.press) await session.page.keyboard.press(step.press);
      else if (step.menu) await command(step.menu);
      else if (step.hotkey) { const target = session.page.locator(`[data-hotkey="${step.hotkey}"]:visible`).first(); const box = await target.boundingBox({ timeout: 4000 }); await session.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2); }
      else { const found = (await controls()).controls.find(item => item.key === step.key); if (!found) throw Error('control gone: ' + step.key); if (found.tag === 'SELECT') throw Error('select cannot open a layer'); await session.page.mouse.click(found.x, found.y); }
      await session.page.waitForTimeout(350);
    }
    await park(); await session.page.waitForTimeout(250);
  };

  const closeLayers = async homeLayer => {
    for (let i = 0; i < 4; i++) { if ((await controls()).layerName === homeLayer) return true; await session.page.keyboard.press('Escape'); await session.page.waitForTimeout(200); }
    const button = await session.page.evaluate(words => { const list = [...document.querySelectorAll('[role=dialog] button,.mdlxl-window button')].filter(item => { const text = (item.getAttribute('aria-label') || item.title || item.textContent.trim()).toLowerCase(); return words.some(word => text === word || text.startsWith(word + ' ')) && item.getBoundingClientRect().width > 0; }).at(-1); if (!list) return null; const box = list.getBoundingClientRect(); return { x: box.left + box.width / 2, y: box.top + box.height / 2 }; }, closeWords(language));
    if (button) { await session.page.mouse.click(button.x, button.y); await session.page.waitForTimeout(300); }
    return (await controls()).layerName === homeLayer;
  };

  const goTo = async scope => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (attempt || !session) await start();
        else { await closeLayers('main'); }
        await walk(scope.path);
        return true;
      } catch (error) { if (attempt) { result.unreachable.push(`${scope.name}: ${error.message.split('\n')[0]}`); return false; } }
    }
    return false;
  };
  const same = (a, b) => a.view === b.view && a.model === b.model && a.selection === b.selection;

  const noteProblems = async where => {
    const before = result.crashes.length;
    for (const message of session.errors.splice(0)) result.crashes.push({ where, kind: 'page error', message: message.slice(0, 400) });
    for (const message of session.consoleErrors.splice(0)) result.crashes.push({ where, kind: 'console error', message });
    if (await session.page.locator('[data-error-boundary],.error-boundary').count().catch(() => 0)) result.crashes.push({ where, kind: 'error screen', message: 'error screen shown' });
    if (result.crashes.length > before) result.crashes.at(-1).shot = await shot('crash-' + where);
  };

  const sweepScope = async scope => {
    if (!await goTo(scope)) return;
    let first = await controls();
    const homeLayer = first.layerName, label = scope.name;
    if (scopes.has(label + '|' + homeLayer) && !scope.path.some(step => step.press)) { /* same layer from another path still picks up new controls */ }
    scopes.add(label + '|' + homeLayer);
    const text = await session.page.evaluate(readText, { catalog });
    if (text.clipped.length) result.clipped[label] = text.clipped;
    if (text.english.length) result.untranslated[label] = text.english;
    result.excluded.push(...first.skipped.excluded); result.repeatedRows += first.skipped.repeated; result.covered += first.skipped.covered; result.textFields += first.skipped.fields;
    const pending = first.controls.map(item => item.key).filter(key => !seen.has(key));
    // A moving preview cannot prove a click changed the picture.
    const noisy = (await canvas()) !== (await session.page.waitForTimeout(350), await canvas());
    let base = await state();

    for (const key of pending) {
      if (Date.now() > deadline) { result.notReached.push(`${label}: ${key}`); continue; }
      let control;
      try {
        control = (await controls()).controls.find(item => item.key === key);
        if (!control) continue;
        seen.add(key); result.clicked++;
        const where = `${label} > ${control.label || control.id || control.tag}`;
        const beforeState = await state(), beforeCanvas = noisy ? '' : await canvas();
        if (control.tag === 'SELECT') {
          // A real click opens a native list the test cannot see. Choose the next option, then put it back.
          const handle = session.page.locator(`select[data-hotkey="${control.id}"]`).first();
          const options = control.id ? await handle.evaluate(element => ({ value: element.value, values: [...element.options].filter(item => !item.disabled).map(item => item.value) })).catch(() => null) : null;
          if (!options || options.values.length < 2) { result.outcomes.select = (result.outcomes.select || 0) + 1; continue; }
          // A list that is covered or filtered out cannot be chosen from; it counts as not exercised, not as a fault.
          if (!await handle.selectOption(options.values.find(value => value !== options.value), { timeout: 3000 }).then(() => true).catch(() => false)) { result.outcomes.selectUnavailable = (result.outcomes.selectUnavailable || 0) + 1; continue; }
          await session.page.waitForTimeout(250); await noteProblems(where);
          await handle.selectOption(options.value, { timeout: 3000 }).catch(() => {}); await session.page.waitForTimeout(150);
          result.outcomes.select = (result.outcomes.select || 0) + 1;
          continue;
        }
        await session.page.mouse.click(control.x, control.y);
        await session.page.waitForTimeout(280); await park(); await session.page.waitForTimeout(40);
        try { await withTimeout(session.page.evaluate(() => 1), 8000, 'frozen'); }
        catch { result.freezes.push({ where, shot: await shot('freeze-' + where) }); await start(); await walk(scope.path); base = await state(); continue; }
        await noteProblems(where);
        await closeExtraWindows().catch(() => {});

        const now = await controls();
        if (homeLayer !== 'main' && now.layerName === 'main') {
          // Close, Cancel and Done did their job. Open the window again for the next control.
          result.outcomes.closed = (result.outcomes.closed || 0) + 1;
          await walk(scope.path); base = await state();
          continue;
        }
        if (now.layerName !== homeLayer) {
          result.outcomes.opened = (result.outcomes.opened || 0) + 1;
          const child = `${label} > ${now.layerName}`;
          if (!scopes.has('opened|' + now.layerName) && scope.path.length < 7) { scopes.add('opened|' + now.layerName); queue.push({ name: child, path: [...scope.path, { key }] }); }
          if (!await closeLayers(homeLayer)) {
            // Managers and similar are full pages, left by choosing another mode. Only a layer nothing can leave is stuck.
            const left = await walk(scope.path).then(async () => (await controls()).layerName === homeLayer).catch(() => false);
            if (!left) { result.stuck.push({ where, layer: now.layerName, shot: await shot('stuck-' + where) }); await goTo({ ...scope }); }
            base = await state(); continue;
          }
        } else {
          const after = await state(), afterCanvas = noisy ? '' : await canvas();
          const changed = !same(beforeState, after) || after.elements !== beforeState.elements || after.info !== beforeState.info || after.toasts !== beforeState.toasts || (!noisy && afterCanvas !== beforeCanvas);
          if (changed) result.outcomes.changed = (result.outcomes.changed || 0) + 1;
          else if (control.already) result.outcomes.alreadyOn = (result.outcomes.alreadyOn || 0) + 1;
          else if (noisy) { result.unverified.push(where); result.outcomes.unverified = (result.outcomes.unverified || 0) + 1; }
          else { result.dead.push(where); result.outcomes.dead = (result.outcomes.dead || 0) + 1; }
          // A clean document with a different model means the tab closed or another file opened, not an edit.
          if (after.model && after.dirty && after.model !== beforeState.model) {
            await session.page.keyboard.press('Control+z'); await session.page.waitForTimeout(350);
            const undone = await state();
            if (undone.model !== beforeState.model) result.undo.push({ where, shot: await shot('undo-' + where) });
          } else if (changed && control.toggle) { await session.page.mouse.click(control.x, control.y); await session.page.waitForTimeout(220); await park(); await session.page.waitForTimeout(40); }
        }
        const settled = await state();
        if (!same(base, settled)) {
          // Modes and tabs move the whole page: walk back, and restart only if that does not restore it.
          try { await closeLayers('main'); await walk(scope.path); } catch { /* restart below */ }
          const walked = await state();
          if (!same(base, walked)) { await start(); await walk(scope.path); base = await state(); }
        }
      } catch (error) {
        result.crashes.push({ where: `${label} > ${control?.label || key}`, kind: 'sweep could not continue', message: error.message.split('\n')[0].slice(0, 300), shot: await shot('error').catch(() => '') });
        try { await start(); await walk(scope.path); base = await state(); } catch (restart) { result.unreachable.push(`${label}: ${restart.message.split('\n')[0]}`); return; }
      }
    }
  };

  const sweepMenus = async () => {
    await start();
    const items = await session.app.evaluate(({ Menu }) => { const walk = (menu, trail) => menu.items.flatMap(item => { const label = item.label.replace('&', '').split('\t')[0], next = [...trail, label]; if (item.submenu) return walk(item.submenu, next); return item.type === 'separator' || item.role || !item.enabled ? [] : [next]; }); return walk(Menu.getApplicationMenu(), []); });
    for (const trail of items) {
      const where = 'Menu > ' + trail.join(' > ');
      if (menuDenied(trail, deny)) { result.excluded.push(where); continue; }
      if (Date.now() > deadline) { result.notReached.push(where); continue; }
      try {
        const before = await state();
        const clicked = await session.app.evaluate(({ Menu }, trail) => { let menu = Menu.getApplicationMenu(), item; for (const part of trail) { item = menu.items.find(entry => entry.label.replace('&', '').split('\t')[0] === part); if (!item) return false; menu = item.submenu; } if (!item.enabled) return false; item.click(); return true; }, trail);
        if (!clicked) continue;
        result.clicked++;
        await session.page.waitForTimeout(350);
        try { await withTimeout(session.page.evaluate(() => 1), 8000, 'frozen'); } catch { result.freezes.push({ where, shot: await shot('freeze-menu') }); await start(); continue; }
        await noteProblems(where); await closeExtraWindows().catch(() => {});
        const now = await controls(), after = await state();
        if (now.layerName !== 'main') result.outcomes.opened = (result.outcomes.opened || 0) + 1;
        else if (same(before, after) && after.info === before.info && after.elements === before.elements) { result.dead.push(where); result.outcomes.dead = (result.outcomes.dead || 0) + 1; }
        else result.outcomes.changed = (result.outcomes.changed || 0) + 1;
        if (now.layerName !== 'main' || !same(before, after)) { if (!await closeLayers('main') || !same(before, await state())) await start(); }
      } catch (error) { result.crashes.push({ where, kind: 'sweep could not continue', message: error.message.split('\n')[0].slice(0, 300) }); await start(); }
    }
  };

  try {
    await start();
    while (queue.length) await sweepScope(queue.shift());
    await sweepMenus();
  } finally {
    if (session) await noteProblems('end').catch(() => {});
    await stop();
    fs.rmSync(path.join(folder, 'fixture'), { recursive: true, force: true });
  }
  result.excluded = [...new Set(result.excluded)];
  result.seconds = Math.round((Date.now() - started) / 1000);
  fs.writeFileSync(path.join(folder, 'result.json'), JSON.stringify(result, null, 1));
  return result;
}

const listing = (title, rows, render = row => row) => rows.length ? [`### ${title} (${rows.length})`, '', ...rows.map(row => '- ' + render(row)), ''] : [];
function markdown(results) {
  const lines = ['# Click sweep', '', '| Setup | Clicked | Crashes | Freezes | Undo | Stuck | Dead | Unverified | Not reached | Minutes |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |'];
  for (const r of results) lines.push(`| ${r.setup} | ${r.clicked} | ${r.crashes.filter(row => row.kind !== 'sweep could not continue').length} | ${r.freezes.length} | ${r.undo.length} | ${r.stuck.length} | ${r.dead.length} | ${r.unverified.length} | ${r.notReached.length} | ${(r.seconds / 60).toFixed(1)} |`);
  lines.push('', 'Crashes, freezes and failed Undo fail the run. Everything else needs a person or AI to judge. See "Not covered" in docs/QA-AND-RELEASE-KIT.md.', '');
  for (const r of results) {
    lines.push(`## ${r.setup}`, '', `Outcomes: ${JSON.stringify(r.outcomes)}. Rows skipped as repeats: ${r.repeatedRows}. Covered by another layer: ${r.covered}. Text fields not exercised: ${r.textFields}. App restarts: ${r.restarts}.`, '');
    const appError = row => row.kind !== 'sweep could not continue', describe = row => `${row.where}: ${row.kind}: ${row.message}${row.shot ? ` (${row.shot})` : ''}`;
    lines.push(...listing('Crashes and errors', r.crashes.filter(appError), describe), ...listing('The sweep lost its place here (not an app fault by itself)', r.crashes.filter(row => !appError(row)), describe), ...listing('Freezes', r.freezes, row => row.where), ...listing('Undo did not restore the model', r.undo, row => row.where), ...listing('Could not be closed with Esc or Close', r.stuck, row => `${row.where} (${row.layer})`), ...listing('Windows or states not reached', r.unreachable), ...listing('Dead: nothing visibly happened', r.dead), ...listing('Unverified: preview was moving, no other change', r.unverified), ...listing('Not reached before the time limit', r.notReached), ...listing('Deliberately not clicked', r.excluded));
    for (const [where, text] of Object.entries(r.clipped)) lines.push(`Clipped text in ${where}: ${text.join('; ')}`, '');
    for (const [where, text] of Object.entries(r.untranslated)) lines.push(`Untranslated in ${where}: ${text.join('; ')}`, '');
  }
  return lines.join('\n') + '\n';
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const { createDemoDocument } = await import('../src/editor-document.js');
  prepareFixture.demo = createDemoDocument().serialize('mdx');
  const wanted = (process.env.MDLXL_SWEEP_SETUPS || 'baseline').split(',').map(item => item.trim()).filter(Boolean);
  const names = wanted.includes('all') ? Object.keys(SETUPS) : wanted;
  const unknown = names.filter(name => !SETUPS[name]);
  if (unknown.length) throw Error(`Unknown setup ${unknown.join(', ')}. Setups: ${Object.keys(SETUPS).join(', ')}`);
  const results = [];
  for (const name of names) {
    const result = await sweepSetup(name, SETUPS[name]); results.push(result);
    fs.writeFileSync(path.join(out, 'report.md'), markdown(results));
    console.log(`${name}: ${result.clicked} clicked, ${result.crashes.filter(row => row.kind !== 'sweep could not continue').length} errors, ${result.freezes.length} freezes, ${result.undo.length} undo failures, ${result.stuck.length} stuck, ${result.dead.length} dead, ${result.notReached.length} not reached`);
  }
  console.log('Report: ' + path.join(out, 'report.md'));
  process.exit(results.some(r => r.crashes.some(c => c.kind !== 'sweep could not continue') || r.freezes.length || r.undo.length) ? 1 : 0);
})().catch(error => { console.error(error); process.exit(2); });
