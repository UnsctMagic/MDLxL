import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const source = await fs.readFile(new URL('../app/test-hook.js', import.meta.url), 'utf8');
async function hook(enabled) {
  globalThis.window = { desktop: { testHook: enabled } };
  return import('data:text/javascript,' + encodeURIComponent(source) + '#' + Math.random());
}
test('info history is opt-in, bounded, read-only and distinguishes repeated messages', async () => {
  const disabled = await hook(false);
  disabled.recordInfoForTests('quiet');
  assert.equal(window.__mdlxl, undefined);
  const enabled = await hook(true);
  enabled.recordInfoForTests('Opened test.mdx');
  const snapshot = window.__mdlxl.infoMessages();
  assert.deepEqual(snapshot, [{ id: 1, message: 'Opened test.mdx' }]);
  snapshot[0].message = 'changed'; snapshot.length = 0;
  assert.equal(window.__mdlxl.infoMessages()[0].message, 'Opened test.mdx');
  for (let i = 0; i < 110; i++) enabled.recordInfoForTests('Saved test.mdx');
  const recent = window.__mdlxl.infoMessages();
  assert.equal(recent.length, 100);
  assert.equal(recent.at(-1).id, 111);
  assert.equal(recent[0].id, 12);
  delete globalThis.window;
});
