// Real Settings clicks through IPC and registration, with only Windows registry/notification
// I/O replaced in a disposable package. Never writes the user's file associations.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { launchApp, closeApp, appTarget } = require('./helpers/app.cjs');
const { tempDir, fixturePath } = require('./helpers/fixtures.cjs');

(async () => {
  const source = appTarget(); assert.ok(source.packaged, 'Use a packaged app');
  const out = tempDir('file-icons-'), pkg = path.join(out, 'package'), registry = path.join(out, 'registry.json');
  const classes = 'HKCU\\Software\\Classes\\', ext = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\';
  fs.writeFileSync(registry, JSON.stringify({ [ext + '.mdl\\UserChoice|ProgId']: 'Applications\\MDLxL.exe', [ext + '.mdx\\UserChoice|ProgId']: 'Applications\\MDLxL.exe' }));
  let running;
  try {
    fs.cpSync(path.dirname(source.executablePath), pkg, { recursive: true, filter: file => !['profile','Addons','Backgrounds','BitsAndParts','Showcase Recordings'].includes(path.basename(file)) });
    const electron = path.join(pkg, 'resources/app/electron'), entry = path.join(electron, 'main.cjs');
    if (process.env.MDLXL_ICON_REGISTRATION_BASELINE) fs.copyFileSync(process.env.MDLXL_ICON_REGISTRATION_BASELINE, path.join(electron, 'file-types.cjs'));
    const original = fs.readFileSync(entry, 'utf8');
    assert.ok(original.includes('const fileTypes=userRun&&'));
    const instrument = `
const iconTestFs = require('node:fs');
const iconTestRegistry = process.env.MDLXL_ICON_TEST_REGISTRY;
async function iconTestRun(file, args) {
  const data = JSON.parse(iconTestFs.readFileSync(iconTestRegistry,'utf8'));
  if (file === 'powershell.exe') { data.notifications = (data.notifications || 0) + 1; iconTestFs.writeFileSync(iconTestRegistry,JSON.stringify(data)); return ''; }
  if (file !== 'reg.exe') throw Error('Unexpected native test call: '+file);
  const key = args[1] + '|' + (args.includes('/ve') ? '' : args[args.indexOf('/v')+1]);
  if (args[0] === 'add') { data[key] = args.includes('/d') ? args[args.indexOf('/d')+1] : ''; iconTestFs.writeFileSync(iconTestRegistry,JSON.stringify(data)); return ''; }
  if (args[0] === 'delete') { delete data[key]; iconTestFs.writeFileSync(iconTestRegistry,JSON.stringify(data)); return ''; }
  if (!Object.hasOwn(data,key)) throw Error('Registry value absent');
  return '\\r\\n    value    REG_SZ    '+data[key]+'\\r\\n';
}
require('electron').shell.openExternal = async url => {
  const data = JSON.parse(iconTestFs.readFileSync(iconTestRegistry,'utf8')); data.openedUrl = url;
  iconTestFs.writeFileSync(iconTestRegistry,JSON.stringify(data));
};
`;
    fs.writeFileSync(entry, instrument + original.replace('const fileTypes=userRun&&', 'const fileTypes=').replace('new FileTypeRegistration({executable:', 'new FileTypeRegistration({run:iconTestRun,executable:'));
    const target = { executablePath: path.join(pkg, 'MDLxL.exe'), args: [], packaged: true };
    running = await launchApp({ out, target, fixture: fixturePath('footman'), env: { MDLXL_ICON_TEST_REGISTRY: registry }, settings: { preferences: { modelLookAnswered: true, updateOfferAnswered: true, disableSounds: true } } });
    const { page } = running;
    await page.getByLabel('Grabthrough', { exact: true }).waitFor();
    await page.keyboard.press('Control+1');
    await page.getByRole('radiogroup', { name: 'MDL files', exact: true }).waitFor();
    const warning = page.locator('.settings-hint').filter({ hasText: 'Windows is using a shared MDLxL icon' });
    await warning.waitFor({ timeout: 5000 });
    const click = async locator => { await locator.scrollIntoViewIfNeeded(); const b = await locator.boundingBox(); assert.ok(b); await page.mouse.click(b.x+b.width/2,b.y+b.height/2); };
    await click(page.getByRole('radiogroup', { name: 'MDL files', exact: true }).getByRole('radio', { name: 'Labelled page', exact: true }));
    await click(page.getByRole('radiogroup', { name: 'MDX files', exact: true }).getByRole('radio', { name: 'Big letters', exact: true }));
    // Wait on the observable OS-boundary result, not a timer or app-function call.
    await page.exposeFunction('readRegisteredIcons', () => {
      const data = JSON.parse(fs.readFileSync(registry,'utf8'));
      return [data[classes+'MDLxL.MDL\\DefaultIcon|'],data[classes+'MDLxL.MDX\\DefaultIcon|']].map(s=>s&&path.basename(s));
    });
    await page.waitForFunction(async () => JSON.stringify(await window.readRegisteredIcons()) === JSON.stringify(['file-mdl-page.ico','file-mdx-letters.ico']));
    const data = JSON.parse(fs.readFileSync(registry,'utf8'));
    assert.ok(data.notifications > 0);
    assert.equal(data['HKCU\\Software\\MDLxL\\Capabilities\\FileAssociations|.mdl'],'MDLxL.MDL');
    assert.equal(data['HKCU\\Software\\MDLxL\\Capabilities\\FileAssociations|.mdx'],'MDLxL.MDX');
    assert.equal(data[ext+'.mdl\\UserChoice|ProgId'],'Applications\\MDLxL.exe', 'App does not rewrite protected defaults');
    await click(page.getByRole('button', { name: 'Make MDLxL the default program…', exact: true }));
    assert.equal(JSON.parse(fs.readFileSync(registry,'utf8')).openedUrl,'ms-settings:defaultapps?registeredAppUser=MDLxL');
    // Simulate the external OS result of the user choosing the two registered types.
    const defaults = JSON.parse(fs.readFileSync(registry,'utf8'));
    defaults[ext+'.mdl\\UserChoice|ProgId']='MDLxL.MDL'; defaults[ext+'.mdx\\UserChoice|ProgId']='MDLxL.MDX';
    fs.writeFileSync(registry,JSON.stringify(defaults));
    await click(page.getByRole('radiogroup', { name: 'MDX files', exact: true }).getByRole('radio', { name: 'Helmet with label', exact: true }));
    await warning.waitFor({ state: 'hidden' });
    assert.deepEqual(running.errors,[]);
    console.log('PASS: shared Open-with warning, independent registry icons, shell notification, Default apps button and cleared warning after reassociation. Registry I/O isolated.');
  } finally {
    if (running) await closeApp(running.app);
    assert.ok(out.startsWith(path.resolve('out')+path.sep));
    fs.rmSync(out,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
