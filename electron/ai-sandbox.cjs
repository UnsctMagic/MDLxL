const path = require('node:path');
const { fileURLToPath } = require('node:url');
function runModelScript({ BrowserWindow, ipcMain, root, payload, signal }) {
  if (typeof payload?.code !== 'string' || payload.code.length > 500000) throw Error('Invalid script.');
  const timeout = Math.min(120000, Math.max(100, Number(payload.timeoutMs) || 30000));
  return new Promise((resolve, reject) => {
    const window = new BrowserWindow({
      show: false,
      width: 32,
      height: 32,
      webPreferences: {
        sandbox: true,
        nodeIntegration: false,
        contextIsolation: true,
        backgroundThrottling: false,
        preload: path.join(root, 'electron/ai-sandbox-preload.cjs'),
        partition: 'ai-script-' + require('node:crypto').randomUUID(),
      },
    });
    let done = false;
    const finish = (error, value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      ipcMain.removeListener('ai-sandbox:result', receive);
      if (!window.isDestroyed()) window.destroy();
      error ? reject(error) : resolve(value);
    };
    const abort = () => finish(Error('AI script cancelled; no edit was applied.'));
    const timer = setTimeout(() => finish(Error('AI script timed out; no edit was applied.')), timeout);
    const receive = (event, value) => {
      if (event.sender === window.webContents) finish(value?.error ? Error(value.error) : null, value);
    };
    ipcMain.on('ai-sandbox:result', receive);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) {
      abort();
      return;
    }
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', event => event.preventDefault());
    window.webContents.session.setPermissionRequestHandler((_, __, callback) => callback(false));
    const allowedRoot = path.resolve(root, 'dist') + path.sep;
    window.webContents.session.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (request, callback) => {
      let allowed = false;
      try {
        allowed =
          request.url.startsWith('file:') && path.resolve(fileURLToPath(request.url)).startsWith(allowedRoot);
      } catch {}
      callback({ cancel: !allowed });
    });
    window.webContents.once('render-process-gone', (_, detail) =>
      finish(Error('AI script process stopped: ' + detail.reason)),
    );
    window.once('closed', () => finish(Error('AI script window closed.')));
    window.webContents.once('did-finish-load', () => window.webContents.send('ai-sandbox:run', payload));
    window.loadFile(path.join(root, 'dist/ai-sandbox.html')).catch(error => finish(error));
  });
}
module.exports = { runModelScript };
