const { appTarget } = require('./helpers/app.cjs');
const { launchApp, closeApp, settle: settlePage } = require('./helpers/app.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

// Real wheel input must change the sequence without scrolling its sidebar,
// including at the end of the list and over the editable animation name.
(async () => {
  const root = process.cwd(), out = path.join(root, 'out', 'animation-dropdown-wheel');
  await fs.mkdir(out, { recursive: true });
  const profile = await fs.mkdtemp(path.join(out, 'profile-'));
  const { createDemoDocument } = await import('../src/editor-document.js');
  const document = createDemoDocument(), sequence = document.model.Sequences[0];
  document.model.Sequences = Array.from({ length: 64 }, (_, index) => ({ ...sequence,
    Name: `Sequence ${String(index + 1).padStart(2, '0')}`,
    Interval: new Uint32Array([index * 2000, index * 2000 + 1000]),
  }));
  document.model.GlobalSequences = [];
  const fixture = path.join(out, 'dropdown-wheel.mdx');
  await fs.writeFile(fixture, document.serialize('mdx'));
  const executablePath = appTarget().executablePath;
  const { app, page, errors } = await launchApp({ out: path.dirname(profile), profile: profile, env: { MDLVIS_HEADLESS: '1' }, timeout: 60000, fixture: fixture , pageTimeout: 20000, bounds: { x: -3000, y: 0, width: 1100, height: 480 } });
  const checks = [], consoleErrors = [];
  try {

    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });

    const sidebar = page.locator('.classic-sidebar'); await sidebar.waitFor();
    const select = page.locator('[data-hotkey="animationSequence"]');
    const scrollState = () => page.evaluate(() => ({
      page: [window.scrollX, window.scrollY],
      sidebar: [...document.querySelectorAll('.classic-sidebar')].map(element => [element.scrollLeft, element.scrollTop]),
    }));
    const wheel = async (field, expected, deltaY = 120) => {
      await field.hover(); const before = await scrollState();
      await page.mouse.wheel(0, deltaY);
      await page.waitForFunction(expected => document.querySelector('[data-hotkey="animationSequence"]').value === expected, expected);
      await settlePage(page, 200);
      assert.equal(await select.inputValue(), expected);
      assert.deepEqual(await scrollState(), before, 'wheel must not scroll the page or sidebar');
    };
    for (const tab of ['Movement', 'Animations']) {
      await page.getByRole('button', { name: tab, exact: true }).click();
      const field = tab === 'Animations' ? page.getByLabel('Animation sequence name', { exact: true }) : select;
      assert.ok(await sidebar.evaluate(element => element.scrollHeight > element.clientHeight), 'sidebar is actually scrollable');
      await select.selectOption('0');
      await wheel(field, '1'); await wheel(field, '0', -120);
      checks.push(`${tab}: wheel advances and reverses one animation without moving the screen`);
      // Check cancellation directly: a passive React listener can change the
      // sequence while leaving the browser's scroll action uncancelled.
      const cancelled = await field.evaluate(element => {
        const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 120 });
        element.dispatchEvent(event); return event.defaultPrevented;
      });
      assert.equal(cancelled, true, 'animation wheel must cancel native page scrolling');
      checks.push(`${tab}: native scrolling is cancelled`);
      await select.selectOption('63');
      await wheel(field, '63'); await wheel(field, '62', -120);
      checks.push(`${tab}: wheel stays contained at the end of the animation list`);
      await select.selectOption('0'); await select.click();
      await page.mouse.wheel(0, 480); await settlePage(page, 200);
      assert.deepEqual((await scrollState()).sidebar, [[0, 0]], 'opened dropdown wheel must not scroll its sidebar');
      await page.keyboard.press('Escape');
      checks.push(`${tab}: wheel over the opened dropdown stays contained`);
    }
    await select.selectOption('0');
    const name = page.getByLabel('Animation sequence name', { exact: true });
    await page.waitForFunction(() => document.querySelector('.ac-sequence-combo input').value === 'Sequence 01');
    await name.click(); await name.press('Control+A');
    await name.pressSequentially('Renamed sequence'); await name.press('Enter');
    await page.waitForFunction(() => document.querySelector('[data-hotkey="animationSequence"]').selectedOptions[0].textContent === 'Renamed sequence');
    checks.push('Animation name editing still commits');
    // Other sidebar controls must leave wheel events available for scrolling.
    const outsideCancelled = await page.locator('.ac-caption').first().evaluate(element => {
      const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 120 });
      element.dispatchEvent(event); return event.defaultPrevented;
    });
    assert.equal(outsideCancelled, false, 'other sidebar controls must not consume wheel events');
    checks.push('Wheel events outside the dropdown remain available for normal scrolling');
    assert.deepEqual(errors, []); assert.deepEqual(consoleErrors, []);
    console.log(JSON.stringify({ ok: true, checks, errors, consoleErrors }, null, 2));
  } catch (error) {
    console.error(error); console.log(JSON.stringify({ ok: false, checks, errors, consoleErrors }, null, 2));
    process.exitCode = 1;
  } finally {
    await closeApp(app).catch(() => {});
    await closeApp(app).catch(() => {});
    await fs.rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
