const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { setTimeout: delay } = require('node:timers/promises');
const { appTarget, launchApp, closeApp, stubDialogs } = require('./helpers/app.cjs');
const { fixturePath } = require('./helpers/fixtures.cjs');

async function click(page, locator) {
  await locator.waitFor();
  const box = await locator.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

async function withBit(label, multi, run, { second = false } = {}) {
  const target = appTarget();
  assert.ok(target.packaged);
  const out = path.resolve('out/review-bitz', label);
  fs.mkdirSync(out, { recursive: true });
  const fixture = path.join(out, 'Clean Footman.mdx');
  fs.copyFileSync(fixturePath('citadel-footman'), fixture);
  const { createStarterDocument } = await import('../src/starter-model.js');
  const { createSequence } = await import('../src/sequence-editor.js');
  const { partRgbOptions } = await import('../src/bits-and-parts.js');
  const doc = createStarterDocument();
  if (multi) doc.apply('Two authored looks', [], model => {
    createSequence(model, 400, { name: 'Stand' });
    createSequence(model, 400, { name: 'Attack' });
    const keys = model.Sequences.flatMap((sequence, index) => Array.from(sequence.Interval, Frame =>
      ({ Frame, Vector: index ? Float32Array.of(0, 0, 1) : Float32Array.of(1, 0, 0) })));
    model.GeosetAnims = [{ GeosetId: 0, Flags: 2, Alpha: 1, Color: { GlobalSeqId: null, LineType: 1, Keys: keys } }];
  });
  if (multi) assert.deepEqual(partRgbOptions(doc.model).map(look => look.label), ['No RGB', '255/0/0', '0/0/255']);
  const bank = path.join(path.dirname(target.executablePath), 'BitsAndParts');
  const name = label + ' Review Bit.mdx', bit = path.join(bank, name);
  fs.writeFileSync(bit, doc.serialize('mdx'), { flag: 'wx' });
  let app;
  try {
    const launched = await launchApp({ target, out, fixture, pageTimeout: 6500, bounds: { x: -3000, y: 0, width: 1440, height: 1080 } });
    app = launched.app;
    const { page } = launched;
    const footmanTab = page.getByRole('tab', { name: 'Clean Footman.mdx', exact: true });
    await footmanTab.waitFor();
    if (second) {
      const other = path.join(out, 'Other Footman.mdx');
      fs.copyFileSync(fixture, other);
      await stubDialogs(app, { open: other });
      await page.keyboard.press('Control+o');
      await page.getByRole('tab', { name: 'Other Footman.mdx', exact: true }).waitFor();
      await click(page, footmanTab);
    }
    await page.waitForFunction(() => window.__mdlxl?.model()?.Geosets[0]?.Vertices.length > 24);
    await click(page, page.locator('[data-hotkey="geosetsClear"]'));
    const geoset = page.locator('.geoset-hover-target').filter({ has: page.getByLabel('Select geoset 0', { exact: true }) });
    await geoset.waitFor();
    await click(page, geoset);
    assert.equal(await page.getByLabel('Select geoset 0', { exact: true }).isChecked(), true, 'selects only target geoset');
    await click(page, page.locator('.classic-view [aria-label="3D model viewport"]'));
    await page.keyboard.press('Control+a');
    await page.waitForFunction(() => window.__mdlxl.selection().selection[0]?.length === window.__mdlxl.model().Geosets[0].Vertices.length / 3);
    const open = () => click(page, page.locator('[data-hotkey="bitsAndParts"]'));
    const picker = page.getByRole('dialog', { name: 'BitsAndParts', exact: true });
    const replace = picker.getByRole('button', { name: 'Replace Part', exact: true });
    const choose = () => click(page, picker.getByRole('button', { name, exact: true }));
    const actions = page.getByRole('group', { name: 'Replace Part' });
    const stage = async () => {
      await open();
      await click(page, replace);
      await choose();
      await actions.waitFor();
    };
    await run({ app, page, open, replace, choose, picker, actions, stage, fixture });
  } finally {
    if (app) await closeApp(app);
    fs.unlinkSync(bit);
  }
}

test('closing a clean Footman tab asks what to do with the open replacement', async () => {
  await withBit('tab-close', false, async ({ page, stage, actions }) => {
    await stage();
    const close = page.getByRole('button', { name: 'Close Clean Footman.mdx', exact: true });
    assert.equal(await close.count(), 1, 'the original model tab can be closed while its Bit draft is open');
    await click(page, close);
    const prompt = page.getByRole('dialog', { name: 'Close model tab?', exact: true });
    await prompt.waitFor();
    assert.match(await prompt.textContent(), /commit or discard the replacement/i);
    await click(page, prompt.getByRole('button', { name: 'Cancel', exact: true }));
    await actions.waitFor();
  });
});

test('closing another model tab leaves a BITZ draft open; Commit continues the owning tab close', async () => {
  await withBit('commit-close', false, async ({ page, stage, actions, fixture }) => {
    const original = fs.readFileSync(fixture);
    await stage();
    const closeOther = page.getByRole('button', { name: 'Close Other Footman.mdx', exact: true });
    await click(page, closeOther);
    await closeOther.waitFor({ state: 'detached' });
    await actions.waitFor();
    assert.equal(await page.getByRole('dialog', { name: 'Close model tab?' }).count(), 0);
    const close = page.getByRole('button', { name: 'Close Clean Footman.mdx', exact: true });
    await click(page, close);
    const prompt = page.getByRole('dialog', { name: 'Close model tab?', exact: true });
    const commit = prompt.getByRole('button', { name: 'Commit', exact: true });
    assert.equal(await commit.getAttribute('data-hotkey'), 'app:action:3');
    await click(page, commit);
    await actions.waitFor({ state: 'detached' });
    await click(page, prompt.getByRole('button', { name: 'Save', exact: true }));
    await close.waitFor({ state: 'detached' });
    assert.notDeepEqual(fs.readFileSync(fixture), original, 'the committed replacement was saved before closing');
  }, { second: true });
});

test('Discard continues the owning BITZ tab close without changing the file', async () => {
  await withBit('discard-close', false, async ({ page, stage, fixture }) => {
    const original = fs.readFileSync(fixture);
    await stage();
    const close = page.getByRole('button', { name: 'Close Clean Footman.mdx', exact: true });
    await click(page, close);
    const prompt = page.getByRole('dialog', { name: 'Close model tab?', exact: true });
    const discard = prompt.getByRole('button', { name: 'Discard replacement', exact: true });
    assert.equal(await discard.getAttribute('data-hotkey'), 'app:action:4');
    await click(page, discard);
    await close.waitFor({ state: 'detached' });
    assert.deepEqual(fs.readFileSync(fixture), original);
  });
});

test('Exit after moving a draft warns before Save and leaves the source file intact', async () => {
  await withBit('window-close', false, async ({ app, page, stage, actions, fixture }) => {
    const original = fs.readFileSync(fixture);
    await stage();
    const front = await page.locator('[data-viewport="front"]').boundingBox();
    const getVertices = () => page.evaluate(() => Array.from(window.__mdlxl.model().Geosets.at(-1).Vertices));
    const initial = await getVertices();
    const x = Math.round(front.x + front.width * 0.2), y = Math.round(front.y + front.height * 0.3);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 35, y + 18, { steps: 9 });
    await page.mouse.up();
    await page.waitForFunction(values => window.__mdlxl.model().Geosets.at(-1).Vertices.some((value, i) => value !== values[i]), initial);
    await app.evaluate(({ dialog }) => {
      dialog.showMessageBoxSync = (_window, options) => {
        globalThis.replacementClosePrompt = options;
        return 0;
      };
    });
    const menu = page.getByRole('menubar', { name: 'Application menu' });
    await click(page, menu.getByRole('menuitem', { name: 'File', exact: true }));
    await click(page, menu.getByRole('menuitem', { name: 'Exit', exact: true }));
    const notice = page.getByRole('dialog').filter({ hasText: /commit or discard the replacement before saving/i });
    await notice.waitFor().catch(error => { throw Error('Exit did not keep the replacement open for the Save warning', { cause: error }); });
    let originalCheckpoint;
    for (const deadline = performance.now() + 10000; performance.now() < deadline;) {
      const drafts = await page.evaluate(() => window.desktop.listRecovery());
      originalCheckpoint = drafts.find(entry => entry.path === fixture);
      if (originalCheckpoint) break;
      await delay(50);
    }
    assert.ok(originalCheckpoint?.id, 'the underlying Footman kept a disk checkpoint while the draft was open');
    const prompt = await app.evaluate(() => globalThis.replacementClosePrompt);
    assert.match(prompt.message, /replacement/i);
    assert.deepEqual(fs.readFileSync(fixture), original);
    await click(page, notice.getByRole('button', { name: 'OK', exact: true }));
    await actions.waitFor();
  });
});

test('either BITZ click order stages the chosen RGB look', async () => {
  await withBit('rgb-choice', true, async ({ page, open, replace, choose, picker, actions }) => {
    const colors = [];
    for (const replaceFirst of [true, false]) {
      await open();
      if (replaceFirst) await click(page, replace);
      await choose();
      const list = picker.getByRole('combobox', { name: 'Bit RGB', exact: true });
      await list.waitFor().catch(error => { throw Error('a multi-look Bit must show its RGB list before staging', { cause: error }); });
      await click(page, list);
      await page.keyboard.press('End');
      await page.keyboard.press('Enter');
      assert.equal(await list.inputValue(), '2');
      await click(page, replaceFirst ? picker.getByRole('button', { name: 'Apply replacement', exact: true }) : replace);
      await actions.waitFor();
      colors.push(await page.evaluate(() => Array.from(window.__mdlxl.model().GeosetAnims.find(
        animation => animation.GeosetId === window.__mdlxl.model().Geosets.length - 1).Color)));
      await click(page, actions.getByRole('button', { name: 'Cancel', exact: true }));
      await actions.waitFor({ state: 'hidden' });
    }
    assert.deepEqual(colors, [[0, 0, 1], [0, 0, 1]]);
  });
});
