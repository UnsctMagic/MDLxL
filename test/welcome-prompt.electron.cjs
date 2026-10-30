// Hidden first-run prompt: native style, four languages, real choices and persisted preferences.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { pathToFileURL } = require('node:url');
const { launchApp, closeApp } = require('./helpers/app.cjs');
const root = path.resolve(__dirname, '..');
(async () => {
  const output = path.join(root, 'out/welcome-prompt'), shots = path.join(root, 'out/wp-3-10-shots');
  fs.mkdirSync(output, { recursive: true }); fs.mkdirSync(shots, { recursive: true });
  for (const [language, choice] of [['old', 'yes'], ['old', 'escape'], ['en', 'smooth'], ['ru', 'classic']]) {
    const run = fs.mkdtempSync(path.join(output, 'regression-')), entry = path.join(run, 'main.cjs'), result = path.join(run, 'answer.json');
    fs.writeFileSync(entry, `
      const { app, nativeImage } = require('electron');
      app.setPath('userData', process.env.MDLXL_PROFILE);
      const fs = require('node:fs');
      const { showWelcomePrompt, welcomePreferences, modelLookStrings } = require(${JSON.stringify(path.join(root, 'electron/welcome-prompt.cjs'))});
      app.on('window-all-closed', () => {});
      app.whenReady().then(async () => {
        const { normalizePreferences } = await import(${JSON.stringify(pathToFileURL(path.join(root, 'src/preferences.js')).href)});
        const { translate } = await import(${JSON.stringify(pathToFileURL(path.join(root, 'src/localization.js')).href)});
        const { SettingsStore } = require(${JSON.stringify(path.join(root, 'electron/settings.cjs'))});
        const t = text => translate(text, ${JSON.stringify(language)});
        const icon = nativeImage.createFromPath(${JSON.stringify(path.join(root, 'public/branding/MDLxL.png'))}).resize({ width: 192, height: 192 }).toDataURL();
        const answer = await showWelcomePrompt(null, { title: 'MDLxL', heading: t('Welcome to MDLxL'), question: t('Would you like to enable auto updating?'), detail: t('MDLxL takes a quick look for a new version each time it starts and lets you know when there is one. Nothing is downloaded or installed until you choose Update and restart.'), note: t('We only ask this once like this. You can also change this setting at any time via Settings → Appearance → Auto update.'), labels: { yes: t('Yes, enable it'), no: t('No thanks') }, modelLook: ${language === 'old' ? 'null' : 'modelLookStrings(t)'}, icon, theme: 'light', disableSounds: true });
        const store = new SettingsStore(${JSON.stringify(result)}, normalizePreferences);
        await store.configure({ preferences: welcomePreferences(answer) });
        fs.writeFileSync(${JSON.stringify(path.join(run, 'done.txt'))}, answer);
      }).catch(error => { fs.writeFileSync(${JSON.stringify(path.join(run, 'error.txt'))}, error.stack); });
    `);
    const { app, page: prompt } = await launchApp({ out: run, profile: path.join(run, 'profile'), entry, env: { MDLVIS_HEADLESS: '1' }, timeout: 30000, pageTimeout: 10000, show: 'hide', bounds: null });
    try {
      await prompt.waitForSelector('[data-action="yes"]');
      const layout = await prompt.evaluate(() => ({ width: document.querySelector('img').getBoundingClientRect().width, color: getComputedStyle(document.querySelector('h1')).color }));
      assert.ok(layout.width >= 90); assert.equal(layout.color, 'rgb(23, 74, 161)');
      if (language !== 'old') {
        assert.equal(await prompt.locator('[data-look="smooth"]').getAttribute('aria-pressed'), 'true');
        const capture = await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].webContents.capturePage(undefined, { stayHidden: true, stayAwake: true })).toPNG().toString('base64'));
        fs.writeFileSync(path.join(shots, 'welcome-' + language + '.png'), Buffer.from(capture, 'base64'));
        if (choice === 'classic') await prompt.locator('[data-look="classic"]').click();
      }
      if (choice === 'escape') await prompt.keyboard.press('Escape').catch(error => { if (!/closed/.test(error.message)) throw error; });
      else await prompt.locator('[data-action="yes"]').click();
      for (const start = Date.now(); !fs.existsSync(path.join(run, 'done.txt')); await new Promise(r => setTimeout(r, 30))) {
        if (fs.existsSync(path.join(run, 'error.txt'))) throw Error(fs.readFileSync(path.join(run, 'error.txt'), 'utf8'));
        if (Date.now() - start > 10000) throw Error('welcome answer did not persist');
      }
      const saved = JSON.parse(fs.readFileSync(result, 'utf8')).preferences;
      assert.equal(saved.checkUpdatesOnStartup, choice !== 'escape');
      if (language !== 'old') { assert.equal(saved.graphics.antialias, choice === 'smooth'); assert.equal(saved.modelLookAnswered, true); }
      console.log('PASS ' + language + '/' + choice + ': native welcome layout and persisted choice');
    } finally {
      await closeApp(app); fs.rmSync(run, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
