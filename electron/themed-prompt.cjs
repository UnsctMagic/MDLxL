const APPLICATION_THEMES = require('../src/application-themes.json');

const escapeHtml = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

// A small themed window for one question. The page reports its answer by setting
// its title to `<prefix>:<answer>`; closing the window resolves the fallback.
// onLoaded runs before the window is sized to its content, onShown after it appears.
function showThemedPrompt(parent, { html, title, theme, width, height, prefix, answers, fallback, frame = true, modal = true, webPreferences = {}, onLoaded, onShown }) {
  // Loaded on use so main.cjs stays loadable where Electron is stubbed or absent.
  const { BrowserWindow } = require('electron');
  const pattern = new RegExp(`^${prefix}:(${answers.join('|')})$`);
  return new Promise(resolve => {
    const prompt = new BrowserWindow({
      parent, modal, show: false, ...(frame ? {} : { frame: false }), width, height, useContentSize: true, title,
      resizable: false, minimizable: false, maximizable: false, fullscreenable: false, autoHideMenuBar: true,
      backgroundColor: (APPLICATION_THEMES[theme] || APPLICATION_THEMES.light).colors.panel,
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, spellcheck: false, ...webPreferences },
    });
    let answer = fallback;
    prompt.setMenu(null);
    prompt.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    prompt.webContents.on('will-navigate', event => event.preventDefault());
    // Buttons report through the page title; the window keeps its own title.
    prompt.on('page-title-updated', (event, pageTitle) => {
      event.preventDefault();
      const action = pattern.exec(pageTitle)?.[1];
      if (action && !prompt.isDestroyed()) { answer = action; prompt.close(); }
    });
    prompt.webContents.once('did-finish-load', async () => {
      await onLoaded?.(prompt);
      try {
        const contentHeight = await prompt.webContents.executeJavaScript('document.documentElement.scrollHeight');
        if (!prompt.isDestroyed()) prompt.setContentSize(width, Math.min(600, Math.ceil(contentHeight)));
      } catch {}
      if (!prompt.isDestroyed() && process.env.MDLVIS_HEADLESS !== '1') { prompt.show(); prompt.webContents.focus(); onShown?.(prompt); }
    });
    prompt.on('closed', () => resolve(answer));
    prompt.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  });
}

module.exports = { showThemedPrompt, escapeHtml };
