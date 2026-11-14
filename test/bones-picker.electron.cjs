const { launchApp, closeApp } = require('./helpers/app.cjs');
// Exercise the rebuilt Electron picker: node test/bones-picker.electron.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const root = path.resolve(__dirname, '..');
  const output = path.join(root, 'out/bones-picker-ui'); fs.mkdirSync(output, { recursive: true });
  const { createStarterDocument } = await import('../src/starter-model.js');
  const fixture = path.join(output, 'bones-picker.mdx');
  fs.writeFileSync(fixture, Buffer.from(createStarterDocument().serialize('mdx')));
  const { app, page } = await launchApp({ out: output, profile: path.join(output, 'profile-' + Date.now()), env: { MDLVIS_HEADLESS: '1' }, timeout: 60000, fixture: fixture , pageTimeout: 60000, bounds: { x: -3000, y: 0, width: 1280, height: 920 }, show: 'inactive' });
  try {

    await page.getByRole('button', { name: 'Bones', exact: true }).click();
    const picker = page.getByLabel('Movement bone or node');
    await picker.waitFor();
    const { pickerFontSize, optionFontSize, optionNames } = await picker.evaluate(element => ({
      pickerFontSize: getComputedStyle(element).fontSize,
      optionFontSize: getComputedStyle(element.options[0]).fontSize,
      optionNames: [...element.options].map(option => option.textContent),
    }));
    assert.ok(Number.parseFloat(pickerFontSize) > 0, 'the collapsed picker must not suppress its menu text');
    assert.ok(Number.parseFloat(optionFontSize) > 0, 'picker options must have a visible font size');
    assert.ok(optionNames.includes('Bone_Root'), 'the menu contains the model bones');
    await page.screenshot({ path: path.join(output, 'bones-picker.png') });
    console.log('Bones picker menu labels are visible.');
  } finally {
    await closeApp(app);
  }
})().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
