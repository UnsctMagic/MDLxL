// Contact sheet of one animation in AnimXL: rows for Original and presets, columns over time.
// MDLXL_PLAYWRIGHT_MODULE=<playwright> MDLXL_ANIMXL_EXE=<MDLxL.exe> node test/anim-xl-filmstrip.electron.cjs <model.mdx> <animation name> [presets...]
// A preset can carry a fall direction and a death type: Fall:left, Fall:auto:back
// MDLXL_ANIMXL_APP=<app folder> runs an unpackaged build through MDLXL_ANIMXL_EXE=<electron.exe>.
const fs = require('node:fs'), path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const [model, sequence = 'Attack - 1', ...presets] = process.argv.slice(2);
  const rows = ['Original', ...(presets.length ? presets : ['Default', 'Heavy'])];
  const out = path.resolve(process.env.MDLXL_ANIMXL_OUT || 'out/anim-xl-filmstrip'), frames = 9;
  const executablePath = path.resolve(process.env.MDLXL_ANIMXL_EXE || 'out/pkg/MDLxL-win32-x64/MDLxL.exe');
  fs.mkdirSync(out, { recursive: true });
  const app = await _electron.launch({ executablePath, args: [...(process.env.MDLXL_ANIMXL_APP ? [path.resolve(process.env.MDLXL_ANIMXL_APP)] : []), path.resolve(model), '--disable-backgrounding-occluded-windows'], env: { ...process.env, MDLVIS_HEADLESS: '1', MDLXL_PROFILE: path.join(out, 'profile-' + Date.now()) }, timeout: 60000 });
  const shots = [];
  try {
    const page = await app.firstWindow(); page.setDefaultTimeout(20000);
    await app.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows()[0]; win.webContents.setBackgroundThrottling(false); win.setBounds({ x: -3000, y: 0, width: 1400, height: 950 }); win.showInactive(); });
    await page.locator('[data-hotkey="animation"]').click();
    await page.locator('button.animxl-tool, [data-hotkey="animXL"]').first().click();
    const dialog = page.getByRole('dialog', { name: 'AnimXL' });
    await dialog.waitFor();
    await dialog.getByLabel('Animation', { exact: true }).selectOption({ label: sequence });
    await page.waitForTimeout(800);
    const strip = await dialog.getByRole('slider', { name: 'Animation time' }).boundingBox();
    const preview = await dialog.locator('.ax-preview').boundingBox();
    // MDLXL_ANIMXL_ZOOM=<wheel steps> moves the camera closer (a real mouse wheel over the preview).
    for (let i = 0; i < Number(process.env.MDLXL_ANIMXL_ZOOM || 0); i++) { await page.mouse.move(preview.x + preview.width / 2, preview.y + preview.height / 2); await page.mouse.wheel(0, -120); await page.waitForTimeout(40); }
    for (const row of rows) {
      const original = dialog.getByRole('button', { name: 'Original', exact: true });
      const pressed = await original.getAttribute('aria-pressed') === 'true';
      if ((row === 'Original') !== pressed) await original.click();
      // A row can name a fall direction and a death type too: Fall:left, Fall:auto:knees.
      const [preset, fall, style] = row.split(':');
      if (row !== 'Original') { await dialog.getByRole('button', { name: preset, exact: true }).click(); }
      if (fall) {
        if (!(await dialog.getByLabel('Death type').isVisible())) await dialog.locator('.ax-card-main', { hasText: 'Fall Simulation' }).click();
        if (style) { await dialog.getByLabel('Death type').selectOption(style); await page.waitForTimeout(500); }
        if (await dialog.getByLabel('Fall direction').count()) await dialog.getByLabel('Fall direction').selectOption(fall);
      }
      await page.waitForTimeout(700);
      for (let k = 0; k < frames; k++) {
        await page.mouse.click(strip.x + 1 + (strip.width - 2) * k / (frames - 1), strip.y + strip.height / 2);
        await page.waitForTimeout(250);
        const file = path.join(out, `${row.replace(/[^\w-]/g, '_')}-${k}.png`);
        fs.writeFileSync(file, await page.screenshot({ clip: preview }));
        shots.push({ row, k, file });
      }
    }
  } catch (error) { console.error('FAILED', error.message.split('\n')[0]); try { await (await app.firstWindow()).screenshot({ path: path.join(out, 'failure.png') }); } catch {} process.exitCode = 1; return; } finally { await app.close(); }
  // Stitch with a plain Electron-free HTML page rendered by Playwright's Chromium in the same app is not
  // available here, so write an HTML sheet next to the images.
  const html = `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#222;color:#eee;font:13px sans-serif}td{padding:2px}img{width:150px;display:block}th{text-align:left;padding:4px}</style><table>${rows.map(row => `<tr><th>${row}</th>${shots.filter(s => s.row === row).map(s => `<td><img src="${path.basename(s.file)}"></td>`).join('')}</tr>`).join('')}</table>`;
  fs.writeFileSync(path.join(out, 'sheet.html'), html);
  console.log(path.join(out, 'sheet.html'));
})();
