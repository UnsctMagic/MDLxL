// Playwright wrapper for packaged-app test runs under machine variants (see docs/PACKAGED-TESTS.md).
// scripts/run-packaged-tests.mjs points MDLXL_PLAYWRIGHT_MODULE here; the tests then launch Electron through it.
// MDLXL_REAL_PLAYWRIGHT: the real playwright or playwright-core module (path or package name).
// MDLXL_VARIANT_ARGS: extra Chromium switches for every Electron launch (e.g. --use-angle=d3d11-warp).
// MDLXL_VARIANT_CPU: CDP CPU throttling rate applied to every window (e.g. 4 = four times slower).
function loadPlaywright() {
  const candidates = [process.env.MDLXL_REAL_PLAYWRIGHT, 'playwright', 'playwright-core'].filter(Boolean);
  for (const candidate of candidates) {
    try { return require(candidate); } catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
  }
  throw Error('Playwright not found. Set MDLXL_REAL_PLAYWRIGHT to a playwright or playwright-core folder.');
}

const playwright = loadPlaywright();
const extra = (process.env.MDLXL_VARIANT_ARGS || '').split(/\s+/).filter(Boolean);
const cpu = Number(process.env.MDLXL_VARIANT_CPU || 0);
const real = playwright._electron;
const electron = Object.create(real);
electron.launch = async (options = {}) => {
  const app = await real.launch.call(real, { ...options, args: [...extra, ...(options.args || [])] });
  if (cpu > 1) {
    const throttle = async page => { try { const session = await page.context().newCDPSession(page); await session.send('Emulation.setCPUThrottlingRate', { rate: cpu }); } catch { /* window closed early */ } };
    app.on('window', throttle);
    for (const page of app.windows()) throttle(page);
  }
  return app;
};
module.exports = new Proxy(playwright, { get: (target, key) => key === '_electron' ? electron : target[key] });
