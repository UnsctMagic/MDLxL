const { launchApp, closeApp, settle: settlePage } = require('./helpers/app.cjs');
// Run after building dist. Optional: MDLXL_PLAYWRIGHT_MODULE points to an external Playwright install.
// Drives the themed close prompt hidden: a green Save, a yellow CANCEL? and a red Close set apart below.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

(async () => {
  const output = path.join(root, 'out/close-prompt');
  fs.mkdirSync(output, { recursive: true });
  const run = fs.mkdtempSync(path.join(output, 'regression-'));
  const saveDestination = path.join(run, 'NewModel');
  const entry = path.join(run, 'main.cjs');
  fs.writeFileSync(entry, `
    const { app, dialog } = require('electron');
    app.getAppPath = () => ${JSON.stringify(root)};
    dialog.showMessageBoxSync = () => { throw new Error('the native close message box must not be used'); };
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: ${JSON.stringify(saveDestination)} });
    require(${JSON.stringify(path.join(root, 'electron/main.cjs'))});
  `);
  const { app, page: editor } = await launchApp({ out: run, profile: path.join(run, 'profile'), entry: entry, env: { MDLVIS_HEADLESS: '1', MDLXL_STYLED_CLOSE_PROMPT: '1' }, timeout: 30000 , pageTimeout: 15000 });

  await editor.waitForFunction(() => !!document.querySelector('.classic-app'));
  const openPrompt = async () => {
    await editor.evaluate(() => window.desktop.close());
    for (const started = Date.now(); Date.now() - started < 15000; await settlePage(editor, 50)) {
      const prompt = app.windows().find(page => page !== editor && !page.isClosed() && page.url().startsWith('data:'));
      if (prompt) { await prompt.waitForSelector('button.close', { timeout: 10000 }); return prompt; }
    }
    throw new Error('the close prompt did not open');
  };
  const closedPrompt = prompt => new Promise((resolve, reject) => {
    if (prompt.isClosed()) return resolve();
    const timer = setTimeout(() => reject(new Error('the close prompt stayed open')), 10000);
    prompt.once('close', () => { clearTimeout(timer); resolve(); });
  });
  try {
    let prompt = await openPrompt();
    const layout = await prompt.evaluate(() => [...document.querySelectorAll('button')].map(button => {
      const box = button.getBoundingClientRect(), style = getComputedStyle(button);
      return { text: button.textContent, top: box.top, bottom: box.bottom, background: style.backgroundColor, color: style.color };
    }));
    assert.deepEqual(layout.map(button => button.text), ['Save', 'CANCEL?', 'Close']);
    const [save, cancel, close] = layout;
    assert.ok(cancel.bottom < close.top, 'CANCEL? sits above Close');
    assert.ok(close.top - cancel.bottom >= 20, 'Close is set apart from CANCEL?');
    assert.equal(save.background, 'rgb(90, 154, 102)', 'the whole Save button is green');
    assert.equal(cancel.background, 'rgb(227, 196, 106)', 'the whole CANCEL? button is yellow');
    assert.equal(close.background, 'rgb(189, 90, 85)', 'the whole Close button is red');
    await prompt.getByRole('button', { name: 'CANCEL?' }).click();
    await closedPrompt(prompt);
    await settlePage(editor, 200);
    assert.equal(editor.isClosed(), false, 'CANCEL? keeps the editor open');
    console.log('PASS green Save, yellow CANCEL? above a red Close and keeps the editor open');

    prompt = await openPrompt();
    await prompt.keyboard.down('Escape');
    await closedPrompt(prompt);
    await editor.keyboard.up('Escape');
    await settlePage(editor, 200);
    assert.equal(editor.isClosed(), false, 'Escape cancels');
    console.log('PASS Escape cancels closing');

    prompt = await openPrompt();
    const exited = app.waitForEvent('close');
    // The native process can exit before Playwright acknowledges this click.
    // Require both the expected disconnect (if any) and the app close event.
    const click = prompt.getByRole('button', { name: 'Close', exact: true }).click().catch(error => {
      assert.match(error.message, /Target page, context or browser has been closed/);
    });
    await exited; await click;
    assert.equal(['.mdl', '.mdx'].some(extension => fs.existsSync(saveDestination + extension)), false, 'Close discards without saving');
    console.log('PASS the red Close closes without saving');
  } finally {
    await closeApp(app);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
