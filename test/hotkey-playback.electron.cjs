const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { _electron } = require(process.env.MDLXL_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const root = process.cwd(), variant = process.env.MDLXL_VARIANT_CPU ? 'slow-cpu' : 'default';
  const baseline = process.env.PLAYBACK_CAPTURE_BASELINE === '1';
  const out = path.join(root, 'out', 'hotkey-playback', baseline ? 'baseline' : 'fixed', variant);
  await fs.mkdir(out, { recursive: true });
  const profile = await fs.mkdtemp(path.join(out, 'profile-'));
  await fs.writeFile(path.join(profile, 'settings.json'), JSON.stringify({ preferences: { learn: { enabled: false }, showHotkeys: false } }));
  const { createDemoDocument } = await import('../src/editor-document.js');
  const fixture = path.join(out, 'playback.mdx');
  await fs.writeFile(fixture, createDemoDocument().serialize('mdx'));
  const executablePath = process.env.MDLXL_PLAYBACK_EXE || path.join(root, 'out', 'pkg', 'MDLxL-win32-x64', 'MDLxL.exe');
  const app = await _electron.launch({ executablePath, args: ['--disable-gpu-vsync', '--disable-frame-rate-limit', fixture], cwd: root,
    env: { ...process.env, MDLXL_PROFILE: profile, MDLVIS_HEADLESS: '1' }, timeout: 60000 });
  const samples = [], errors = [];
  try {
    const page = await app.firstWindow(); page.setDefaultTimeout(20000);
    page.on('pageerror', error => errors.push(error.message));
    await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.webContents.setBackgroundThrottling(false); w.setSize(1600, 900); w.showInactive(); });
    await page.waitForFunction(() => document.querySelector('.model-tabs')?.textContent.includes('playback.mdx'));
    const click = async locator => { const box = await locator.boundingBox(); assert.ok(box); await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2); };
    await click(page.locator('button[data-hotkey="animation"]:visible').first());
    await page.getByLabel('Movement current sequence', { exact: true }).selectOption('0');
    await page.locator('.game-preview-root canvas[data-clean-model-canvas]').waitFor();
    await page.evaluate(() => {
      const host = document.querySelector('.game-preview-root');
      let fiber = host[Object.keys(host).find(key => key.startsWith('__reactFiber'))], runtime;
      for (; fiber && !runtime; fiber = fiber.return) for (let hook = fiber.memoizedState; hook; hook = hook.next) {
        const value = hook.memoizedState?.current;
        if (value?.native && value?.controls) { runtime = value; break; }
      }
      if (!runtime) throw Error('Main viewport runtime not found');
      const probe = window.__playbackCost = { runtime, sample: null };
      const render = runtime.native.render;
      runtime.native.render = function (...args) {
        const now = performance.now(), s = probe.sample;
        if (s) { s.frames++; s.gaps.push(now - s.last); s.last = now; }
        return render.apply(this, args);
      };
      const rect = Element.prototype.getBoundingClientRect, style = window.getComputedStyle;
      Element.prototype.getBoundingClientRect = function (...args) {
        const s = probe.sample;
        if (s) { s.rects++; if (this.matches('.hotkey-control,[data-hotkey-badge]')) s.hintRects++; }
        return rect.apply(this, args);
      };
      window.getComputedStyle = function (element, ...args) {
        if (probe.sample && element.matches('.hotkey-control,[data-hotkey-badge]')) probe.sample.hintStyles++;
        return style.call(window, element, ...args);
      };
      const cursor = document.querySelector('.classic-reel-cursor');
      if (!cursor) throw Error('Movement timeline cursor not found');
      probe.cursorObserver = new MutationObserver(records => { if (probe.sample) probe.sample.cursorWrites += records.length; });
      probe.cursorObserver.observe(cursor, { attributes: true, attributeFilter: ['style'] });
    });
    const play = page.locator('.classic-reel-play:visible').first();
    assert.equal(await play.isEnabled(), true);
    await click(play);
    await page.waitForFunction(() => document.querySelector('.classic-reel-play')?.getAttribute('aria-label') === 'Stop');
    let shown = false;
    const rounds = Number(process.env.PLAYBACK_ROUNDS || (baseline ? 1 : 3));
    const duration = Number(process.env.PLAYBACK_SAMPLE_MS || 5000);
    for (let round = 0; round < rounds; round++) for (const on of round % 2 ? [true, false] : [false, true]) {
      if (on !== shown) {
        await click(page.locator('.learner-tool'));
        await click(page.locator('.learn-menu [data-hotkey="show-hotkeys"]'));
        await page.keyboard.press('Escape'); shown = on;
      }
      await page.waitForTimeout(1000);
      const sample = await page.evaluate(ms => new Promise(resolve => {
        const probe = window.__playbackCost, start = performance.now();
        probe.sample = { frames: 0, gaps: [], last: start, rects: 0, hintRects: 0, hintStyles: 0, cursorWrites: 0 };
        setTimeout(() => {
          const s = probe.sample, seconds = (performance.now() - start) / 1000; probe.sample = null;
          const gaps = s.gaps.sort((a, b) => a - b);
          resolve({ seconds, frames: s.frames, fps: s.frames / seconds, worstFrameMs: Math.max(...gaps), p99FrameMs: gaps[Math.min(gaps.length - 1, Math.floor(gaps.length * .99))],
            rectsPerSec: s.rects / seconds, hintRectsPerSec: s.hintRects / seconds, hintStylesPerSec: s.hintStyles / seconds, cursorWritesPerSec: s.cursorWrites / seconds,
            badges: document.querySelectorAll('[data-hotkey-badge]:popover-open').length });
        }, ms);
      }), duration);
      assert.ok(sample.frames > 10 && sample.cursorWritesPerSec > 5, 'real rendering and timeline playback continued');
      if (on) assert.ok(sample.badges > 10, 'persistent hints remained displayed');
      samples.push({ round: round + 1, showHotkeys: on, ...sample });
      console.log(JSON.stringify(samples.at(-1)));
    }
    await click(play);
    const summary = Object.fromEntries([false, true].map(on => {
      const rows = samples.filter(s => s.showHotkeys === on), seconds = rows.reduce((sum, s) => sum + s.seconds, 0);
      return [on ? 'on' : 'off', { fps: rows.reduce((sum, s) => sum + s.frames, 0) / seconds, worstFrameMs: Math.max(...rows.map(s => s.worstFrameMs)),
        hintRectsPerSec: rows.reduce((sum, s) => sum + s.hintRectsPerSec, 0) / rows.length, hintStylesPerSec: rows.reduce((sum, s) => sum + s.hintStylesPerSec, 0) / rows.length }];
    }));
    await fs.writeFile(path.join(out, 'results.json'), JSON.stringify({ baseline, variant, executablePath, rounds, duration, samples, summary }, null, 2));
    console.log('SUMMARY ' + JSON.stringify({ baseline, variant, ...summary }));
    if (!baseline) {
      assert.equal(summary.on.hintRectsPerSec, 0, 'timeline playback must not remeasure hint controls');
      assert.equal(summary.on.hintStylesPerSec, 0, 'timeline playback must not restyle hint controls');
    }
    assert.deepEqual(errors, []);
  } finally {
    await app.close();
    await fs.rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
  }
})().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
