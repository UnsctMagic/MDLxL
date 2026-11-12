const { spawn } = require('node:child_process');
const path = require('node:path');

function captureRegionsFor(window) {
  let helper, last;
  let failed = false;
  const stop = () => {
    const running = helper;
    helper = undefined;
    last = undefined;
    running?.stdin.end();
  };
  window.once('closed', stop);

  return edges => {
    if (edges === null) { stop(); return; }
    if (failed || !Array.isArray(edges) || edges.length !== 8 ||
        !edges.every(value => Number.isInteger(value) && value >= 0 && value <= 65535)) return;
    const line = edges.join(' ');
    if (line === last) return;
    last = line;

    if (!helper) {
      if (edges.every(value => value === 0)) return;
      const handle = window.getNativeWindowHandle().readBigUInt64LE();
      const running = helper = spawn(path.join(__dirname, '../dist/capture-regions.exe'), [handle.toString()], {
        windowsHide: true, stdio: ['pipe', 'ignore', 'inherit']
      });
      running.once('error', error => {
        if (helper !== running) return;
        failed = true;
        console.warn('Capture regions: ' + error.message);
      });
      running.once('exit', code => {
        if (helper !== running) return;
        failed = true;
        if (code) console.warn('Capture regions helper exited with code ' + code);
      });
      running.stdin.on('error', error => {
        if (helper !== running) return;
        if (!failed && !window.isDestroyed()) console.warn('Capture regions: ' + error.message);
        failed = true;
      });
    }
    helper.stdin.write(line + '\n');
  };
}

module.exports = { captureRegionsFor };
