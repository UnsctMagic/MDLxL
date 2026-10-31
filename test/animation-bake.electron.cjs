const { stubDialogs } = require('./helpers/app.cjs');
const { appTarget } = require('./helpers/app.cjs');
const { launchApp, closeApp, settle: settlePage } = require('./helpers/app.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

(async () => {
  const root = process.cwd(), out = path.join(root, 'out', 'animation-bake-ui');
  await fs.mkdir(out, { recursive: true });
  const profile = await fs.mkdtemp(path.join(out, 'profile-'));
  const { createDemoDocument, openDocument } = await import('../src/editor-document.js');
  const { createGeosetAnimations, sampleAnimationProperty } = await import('../src/animation-tracks.js');
  const doc = createDemoDocument();
  doc.apply('Fixture', ['Sequences', 'Geosets', 'GeosetAnims', 'Info'], model => {
    model.Sequences.push({ ...structuredClone(model.Sequences[0]), Name: 'Walk', Interval: new Uint32Array([3000, 5000]) });
    model.Geosets.forEach(geoset => geoset.Anims.push(structuredClone(geoset.Anims[0])));
    createGeosetAnimations(model, model.Geosets.map((_, id) => id));
    for (const animation of model.GeosetAnims) {
      animation.Flags |= 2; animation.Color = new Float32Array([1, .2, .4]);
      animation.Alpha = { LineType: 0, GlobalSeqId: null, Keys: [[0, .25], [1000, .8], [2000, .75], [2500, .9], [3000, .6], [5000, .6]].map(([Frame, value]) => ({ Frame, Vector: new Float32Array([value]) })) };
    }
  });
  const original = doc.serialize('mdx'), fixture = path.join(out, 'bake.mdx');
  await fs.writeFile(fixture, original);
  const before = openDocument(original, 'bake.mdx').model;
  const executablePath = appTarget().executablePath;
  const { app, page, errors } = await launchApp({ out: path.dirname(profile), profile: profile, env: { MDLVIS_HEADLESS: '1' }, timeout: 60000, fixture: fixture , pageTimeout: 20000 });

  try {

    await page.getByRole('button', { name: 'Animations', exact: true }).click();
    await page.getByLabel('Choose animation sequence', { exact: true }).selectOption('0');
    const alpha = page.getByLabel('Visibility alpha percent', { exact: true });
    await page.waitForFunction(() => document.querySelector('[aria-label="Visibility alpha percent"]').value === '25');
    const save = async (name, format = 'mdx') => {
      const file = path.join(out, name + '.' + format);
      await fs.rm(file, { force: true });
      await stubDialogs(app, { save: (file) });
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('menu', 'saveAs'));
      await page.getByRole('button', { name: format === 'mdx' ? 'Save MDX…' : 'Save MDL…', exact: true }).click();
      await page.getByRole('dialog', { name: 'Save as', exact: true }).waitFor({ state: 'hidden' });
      const end = Date.now() + 10000; while (!(await fs.stat(file).catch(() => null))) { if (Date.now() > end) throw Error('Save did not finish'); await settlePage(page, 50); }
      const saved = openDocument(await fs.readFile(file), path.basename(file)); assert.equal(saved.readOnly, false); return saved.model;
    };
    const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, actual + ' != ' + expected);
    // RGB and visibility bake separately: the RGB buttons never touch Alpha, Bake All Visibility never touches Color.
    const verify = (model, value, all, baseline = before, alphaBaked = true) => {
      for (const animation of model.GeosetAnims) {
        const original = baseline.GeosetAnims.find(item => item.GeosetId === animation.GeosetId);
        if (animation.GeosetId !== 0) { assert.deepEqual(animation, original, 'Unchecked geosets stay unchanged'); continue; }
        if (alphaBaked) {
          assert.deepEqual(animation.Alpha.Keys.map(key => key.Frame), [0, 2000, 2500, 3000, 5000]);
          close(animation.Alpha.Keys.find(key => key.Frame === 2500).Vector[0], .9);
        } else assert.deepEqual(animation.Alpha, original.Alpha, 'Baking RGB leaves visibility unchanged');
        for (const [index, frames] of [[0, [0, 1000, 2000]], [1, [3000, 4000, 5000]]]) {
          const target = property => ({ kind: 'geoset', id: animation.GeosetId, property });
          for (const frame of frames) {
            if (alphaBaked) close(sampleAnimationProperty(model, target('Alpha'), frame, index), all || index === 0 ? value : .6);
            const rgb = sampleAnimationProperty(model, target('Color'), frame, index); [1, .2, .4].forEach((v, i) => close(rgb[i], v));
          }
        }
      }
      assert.deepEqual(model.Geosets, baseline.Geosets); assert.deepEqual(model.Bones, baseline.Bones);
    };
    const rgbOnly = (model, baseline) => verify(model, null, false, baseline, false);
    await page.getByRole('button', { name: 'Bake Sequence RGB', exact: true }).click();
    const sequence = await save('sequence'); rgbOnly(sequence);
    await page.keyboard.press('Control+z');
    assert.deepEqual((await save('undo')).GeosetAnims, before.GeosetAnims);
    await page.keyboard.press('Control+y'); assert.deepEqual((await save('redo')).GeosetAnims, sequence.GeosetAnims);
    await page.getByLabel('Visible at current frame', { exact: true }).uncheck();
    assert.equal(await alpha.inputValue(), '0');
    const unticked = await save('unticked'); // the checkbox itself keys Alpha 0 at the current frame
    await page.getByRole('button', { name: 'Bake All RGB', exact: true }).click();
    const rgb = await save('all-rgb'); rgbOnly(rgb, unticked);
    await page.getByRole('button', { name: 'Bake All Visibility', exact: true }).click();
    const visible = await save('all'); verify(visible, 0, true);
    for (const animation of visible.GeosetAnims) assert.deepEqual(animation.Color, rgb.GeosetAnims.find(item => item.GeosetId === animation.GeosetId).Color, 'Bake All Visibility leaves colour unchanged');
    verify(await save('all', 'mdl'), 0, true, openDocument(openDocument(original, 'bake.mdx').serialize('mdl'), 'baseline.mdl').model);
    await page.keyboard.press('Control+z');
    const undone = await save('undo-all');
    assert.deepEqual(undone.GeosetAnims, rgb.GeosetAnims, 'Undo removes only the visibility bake');
    await page.keyboard.press('Control+y'); verify(await save('redo-all'), 0, true);
    assert.deepEqual(await fs.readFile(fixture), Buffer.from(original)); assert.deepEqual(errors, []);
    const result = { passed: true, sequenceAlpha: .25, allAlpha: 0, rgbPreserved: true, rgbLeavesAlpha: true, visibilityLeavesRgb: true, gapKeysPreserved: true, otherSequencePreserved: true, undoRedo: true, saved: ['mdx', 'mdl'], rendererErrors: errors };
    await fs.writeFile(path.join(out, 'result.json'), JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
  } finally { await closeApp(app).catch(() => {}); }
})().catch(error => { console.error(error); process.exitCode = 1; });

