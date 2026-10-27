// Packaged acceptance: AI versions side by side. Saving, listing, comparing,
// reading a version from a script, and going back as one Undo step.
// Run through scripts/run-packaged-tests.mjs (hidden desktop).
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict'),
  crypto = require('node:crypto');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'D:/Claude/tools/node_modules/playwright-core');
const out = path.resolve(process.env.MDLXL_AI_TEST_OUT || 'out/ai-versions');
const checks = [],
  errors = [];
let app, page, link;
const check = (name, value, detail) => {
  checks.push({ name, passed: !!value, ...(value ? {} : { detail }) });
  assert.ok(value, name);
};
async function rpc(method, params = {}) {
  const response = await fetch(link.url, {
    method: 'POST',
    headers: { ...link.headers, 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: crypto.randomUUID(), method, params }),
  });
  const reply = await response.json();
  if (reply.error) throw Error(reply.error.message);
  return reply.result;
}
async function tool(name, args = {}) {
  const result = await rpc('tools/call', { name, arguments: args });
  if (result.isError) throw Error(result.content[0].text);
  return JSON.parse(result.content[0].text.split('\nMDLxL continuous awareness')[0]);
}
const height = async () => (await tool('mdlxl_read', { path: '/Geosets/0/Vertices', limit: 3 })).value.$data[2];
async function raise(by, label) {
  const { target } = await tool('mdlxl_context');
  return tool('mdlxl_script', {
    target,
    edit: true,
    label,
    scope: ['/Geosets/0/Vertices'],
    code: `model.Geosets[0].Vertices[2] += ${by}; return model.Geosets[0].Vertices[2];`,
  });
}
(async () => {
  // A fresh profile each run, so versions and chats from an earlier run never mix in.
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(path.join(out, 'temp'), { recursive: true });
  const { createStarterDocument } = await import('../src/starter-model.js');
  const fixture = path.join(out, 'Versions-fixture.mdx');
  // A second part off to the side, so a picture of only the first one must differ.
  const doc = createStarterDocument();
  doc.apply('Second part', ['Geosets'], model => {
    const copy = structuredClone(model.Geosets[0]);
    for (let i = 0; i < copy.Vertices.length; i += 3) copy.Vertices[i] += 200;
    model.Geosets.push(copy);
  });
  fs.writeFileSync(fixture, doc.serialize('mdx'));
  app = await _electron.launch({
    executablePath: process.env.MDLXL_AI_TEST_EXE,
    args: [fixture],
    env: { ...process.env, MDLXL_PROFILE: path.join(out, 'profile'), MDLXL_DISABLE_UPDATES: '1', TEMP: path.join(out, 'temp'), TMP: path.join(out, 'temp') },
    timeout: 60000,
  });
  page = await app.firstWindow();
  page.on('pageerror', error => errors.push(error.message));
  await page.waitForSelector('.classic-toolbar', { timeout: 60000 });
  await page.waitForTimeout(350);
  link = (await page.evaluate(async () => {
    await window.desktop.aiEnable(true);
    return window.desktop.aiConfig();
  })).mcpServers.mdlxl;

  const original = await height();
  await raise(5, 'Raise one vertex');
  let { target } = await tool('mdlxl_context');
  const saved = await tool('mdlxl_versions', { target, action: 'save', name: 'raised', note: 'first try' });
  check('the first edit kept "original" and "before job 1" automatically', ['original', 'before job 1', 'raised'].every(n => saved.versions.some(v => v.name === n)), saved.versions);
  await raise(10, 'Raise it further');
  ({ target } = await tool('mdlxl_context'));
  const listed = (await tool('mdlxl_versions', { target, action: 'list' })).versions;
  check('list shows how each version differs from the current model', listed.every(v => v.sameAsCurrent === false && v.differencesFromCurrent > 0), listed);
  const compared = await tool('mdlxl_versions', { target, action: 'compare', name: 'original', other: 'raised' });
  check('compare names what changed between two versions', compared.differences === 1 && compared.bySection.Geosets === 1, compared);
  const measured = await tool('mdlxl_script', { target, code: 'return [references["version:raised"].model.Geosets[0].Vertices[2], references["version:original"].model.Geosets[0].Vertices[2]];' });
  check('scripts measure saved versions side by side', measured.value[0] === original + 5 && measured.value[1] === original, measured.value);

  const used = await tool('mdlxl_versions', { target, action: 'use', name: 'original' });
  check('use makes the model exactly that version again', used.applied === true && (await height()) === original);
  ({ target } = await tool('mdlxl_context'));
  check('going back leaves the model the same as "original"', (await tool('mdlxl_versions', { target, action: 'list' })).versions.find(v => v.name === 'original').sameAsCurrent);
  await tool('mdlxl_command', { target, id: 'undo' });
  check('one Undo step takes the model back to before the version was used', (await height()) === original + 15);
  await assert.rejects(() => tool('mdlxl_versions', { target, action: 'use', name: 'missing' }), /no version called "missing"/);
  check('an unknown version is refused by name', true);
  // Pictures of only the parts in question, in plain shading.
  const captured = await rpc('tools/call', { name: 'mdlxl_capture', arguments: { target, samples: [{ view: 'front', geosets: [0], plain: true }, { view: 'front' }] } });
  const texts = captured.content.filter(c => c.type === 'text').map(c => c.text).join('\n'),
    pictures = captured.content.filter(c => c.type === 'image');
  check('an isolated plain picture is drawn and labelled', !captured.isError && pictures.length === 2 && /only geosets 0; plain shading/.test(texts), texts.slice(0, 300));
  check('isolated and normal pictures differ', pictures[0]?.data !== pictures[1]?.data);
  const missing = await rpc('tools/call', { name: 'mdlxl_capture', arguments: { target, samples: [{ view: 'front', geosets: [99] }] } });
  check('a picture of geosets that do not exist is refused', missing.isError && /None of those geosets exist/.test(missing.content[0].text));
  check('no page errors', errors.length === 0, errors);
  fs.writeFileSync(path.join(out, 'checks.json'), JSON.stringify(checks, null, 2));
  console.log(JSON.stringify(checks, null, 2));
})()
  .catch(error => {
    checks.push({ name: 'exception', passed: false, error: error.stack || error.message });
    console.log(JSON.stringify(checks, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    // The edited model is unsaved: close the windows directly so no save question waits.
    if (app) {
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach(win => win.destroy())).catch(() => {});
      await app.close().catch(() => {});
    }
  });
