const { BrowserWindow } = require('electron');
const APPLICATION_THEMES = require('../src/application-themes.json');

const escapeHtml = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

// The native Windows message box cannot color its buttons, so the close prompt
// is a small themed window: Save, a yellow CANCEL? and, set apart below, a red Close.
function closePromptHtml({ message, detail, labels, theme }) {
  const { colors, scheme } = APPLICATION_THEMES[theme] || APPLICATION_THEMES.light;
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
<style>
:root{color-scheme:${scheme}}
*{box-sizing:border-box}
body{margin:0;padding:14px 16px 16px;font:12px/1.4 Tahoma,Verdana,"Segoe UI",sans-serif;background:${colors.panel};color:${colors.text};user-select:none}
p{margin:0 0 6px;overflow-wrap:anywhere}
.detail{color:${colors.muted};margin-bottom:14px}
button{display:block;width:100%;min-height:30px;margin:0 0 8px;font:inherit;font-weight:bold;border:1px solid ${colors.border};border-radius:2px;cursor:pointer}
button:focus-visible{outline:2px solid ${colors.link};outline-offset:2px}
.save{background:${colors.surface};color:${colors.text}}
.save:hover{background:${colors.hover}}
.cancel{background:#f5c400;border-color:#a88600;color:#1b1600;letter-spacing:.04em}
.cancel:hover{background:#ffd633}
.close{margin:22px 0 0;background:#c62828;border-color:#8a1515;color:#fff}
.close:hover{background:#dd3333}
</style></head><body>
<p><b>${escapeHtml(message)}</b></p><p class="detail">${escapeHtml(detail)}</p>
<button class="save" data-action="save" autofocus>${escapeHtml(labels.save)}</button>
<button class="cancel" data-action="cancel">${escapeHtml(labels.cancel)}</button>
<button class="close" data-action="close">${escapeHtml(labels.close)}</button>
<script>
for(const button of document.querySelectorAll('button'))button.onclick=()=>{document.title='mdlxl-close:'+button.dataset.action;};
addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();document.title='mdlxl-close:cancel';}});
</script></body></html>`;
}

// Resolves 'save', 'cancel' or 'close'. Closing the prompt window itself cancels.
function showClosePrompt(parent, { title, message, detail, labels, theme }) {
  return new Promise(resolve => {
    const prompt = new BrowserWindow({
      parent, modal: true, show: false, width: 340, height: 220, useContentSize: true, title,
      resizable: false, minimizable: false, maximizable: false, fullscreenable: false, autoHideMenuBar: true,
      backgroundColor: (APPLICATION_THEMES[theme] || APPLICATION_THEMES.light).colors.panel,
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, spellcheck: false },
    });
    let answer = 'cancel';
    prompt.setMenu(null);
    prompt.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    prompt.webContents.on('will-navigate', event => event.preventDefault());
    // Buttons report through the page title; the window keeps its own title.
    prompt.on('page-title-updated', (event, pageTitle) => {
      event.preventDefault();
      const action = /^mdlxl-close:(save|cancel|close)$/.exec(pageTitle)?.[1];
      if (action && !prompt.isDestroyed()) { answer = action; prompt.close(); }
    });
    prompt.webContents.once('did-finish-load', async () => {
      try {
        const height = await prompt.webContents.executeJavaScript('document.documentElement.scrollHeight');
        if (!prompt.isDestroyed()) prompt.setContentSize(340, Math.min(600, Math.ceil(height)));
      } catch {}
      if (!prompt.isDestroyed() && process.env.MDLVIS_HEADLESS !== '1') { prompt.show(); prompt.webContents.focus(); }
    });
    prompt.on('closed', () => resolve(answer));
    prompt.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(closePromptHtml({ message, detail, labels, theme })));
  });
}

module.exports = { showClosePrompt, closePromptHtml };
