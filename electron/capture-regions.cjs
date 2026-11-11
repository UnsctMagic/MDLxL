const { spawn } = require('node:child_process');
const path = require('node:path');

function captureRegionsFor(window) {
  let helper, last;
  let failed = false;
  window.once('closed', () => helper?.stdin.end());

  return edges => {
    if (failed || !Array.isArray(edges) || edges.length !== 8 ||
        !edges.every(value => Number.isInteger(value) && value >= 0 && value <= 65535)) return;
    const line = edges.join(' ');
    if (line === last) return;
    last = line;

    if (!helper) {
      if (edges.every(value => value === 0)) return;
      const handle = window.getNativeWindowHandle().readBigUInt64LE();
      helper = spawn(path.join(__dirname, '../dist/capture-regions.exe'), [handle.toString()], {
        windowsHide: true, stdio: ['pipe', 'ignore', 'inherit']
      });
      helper.once('error', error => { failed = true; console.warn('Capture regions: ' + error.message); });
      helper.once('exit', code => {
        failed = true;
        if (code) console.warn('Capture regions helper exited with code ' + code);
      });
      helper.stdin.on('error', error => {
        if (!failed && !window.isDestroyed()) console.warn('Capture regions: ' + error.message);
        failed = true;
      });
    }
    helper.stdin.write(line + '\n');
  };
}

module.exports = { captureRegionsFor };
