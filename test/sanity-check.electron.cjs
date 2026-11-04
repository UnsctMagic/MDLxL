const { launchApp, closeApp, clickMenu } = require('./helpers/app.cjs');
const { fixturePath } = require('./helpers/fixtures.cjs');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
(async () => {
 const root = process.cwd(), out = path.join(root, 'out/sanity-ui'), fixture = fixturePath('optimizexl-review');
 fs.mkdirSync(out, { recursive: true });
 const { openDocument, validateModel } = await import('../src/editor-document.js');
 const { generateCompatibleMdx } = await import('../src/mdx-compatibility.js');
 const { sanityTest } = await import('./helpers/hive.mjs');
 const { flattenHiveFindings } = await import('../app/optimizexl-hive.js');
 const m = openDocument(fs.readFileSync(fixture), fixture).model;
 assert.ok(validateModel(m).some(f => f.code === 'DEGENERATE_FACES'), 'real fixture contains MDLxL-only repeated-vertex warnings');
 const expected = sanityTest(new Uint8Array(generateCompatibleMdx(m))), findings = flattenHiveFindings(expected.nodes);
 const { app, page, errors } = await launchApp({ out, fixture, pageTimeout: 20000 });
 try {
  await page.waitForFunction(name => window.__mdlxl?.model()?.Info?.Name === name, m.Info.Name);
  const before = await page.evaluate(() => JSON.stringify(window.__mdlxl.model()));
  await clickMenu(app, 'Sanity Check');
  const popup = page.getByRole('dialog', { name: 'Sanity Check', exact: true });
  await popup.waitFor();
  await popup.getByRole('status').filter({ hasText: /Review findings|No issues found by these checks/ }).waitFor();
  assert.doesNotMatch(await popup.innerText(), /structural errors|structural warnings|Structural findings|DEGENERATE_FACES|repeated vertices/, 'Sanity Check must show only Hive findings');
  const details = popup.locator('details');
  assert.equal(await details.count(), 1, 'only Hive has a findings section');
  const summary = details.locator('summary');
  assert.equal(await summary.innerText(), `Advisory findings (${findings.length})`);
  if (!await details.evaluate(element => element.open)) await summary.click();
  await popup.getByText(`${expected.errors} errors · ${expected.severe} severe · ${expected.warnings} warnings · ${expected.unused} unused notices`, { exact: true }).waitFor();
  assert.deepEqual(await details.locator('li').allTextContents(), findings.map(f => `${f.type}: ${f.path}${f.message}`), 'every displayed finding matches Hive verbatim');
  const png = await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].webContents.capturePage({}, { stayHidden: true, stayAwake: true })).toPNG().toString('base64'));
  fs.writeFileSync(path.join(out, 'sanity-check.png'), Buffer.from(png, 'base64'));
  await popup.getByRole('button', { name: 'Close', exact: true }).click();
  await popup.waitFor({ state: 'detached' });
  assert.equal(await page.evaluate(() => JSON.stringify(window.__mdlxl.model())), before, 'the check and Close leave the model unchanged');
  assert.deepEqual(errors, []);
  console.log(`PASS hidden packaged Sanity Check: Hive-only findings (${findings.length}), exact counts and messages, native Help command, disclosure/Close clicks, unchanged model, no renderer errors.`);
 } catch (error) { fs.writeFileSync(path.join(out, 'failure.txt'), await page.locator('body').innerText()); await page.screenshot({ path: path.join(out, 'failure.png') }); throw error; } finally { await closeApp(app); }
})().catch(error => { console.error(error); process.exitCode = 1; });
