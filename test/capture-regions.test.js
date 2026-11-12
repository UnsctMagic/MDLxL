import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { DEFAULT_CAPTURE, normalizeCapture } from '../src/capture-settings.js';

test('ShareX region sharing defaults off and preserves explicit opt-in', () => {
  assert.equal(DEFAULT_CAPTURE.shareXRegions, false);
  assert.equal(normalizeCapture({ fps: 20 }).shareXRegions, false);
  assert.equal(normalizeCapture({ shareXRegions: true }).shareXRegions, true);
  assert.equal(normalizeCapture({ shareXRegions: 'true' }).shareXRegions, false);
  const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
  assert.match(app, /useCaptureRegions\([^;]*preferences\.capture\.shareXRegions[^;]*\);/);
});

test('a Windows build warns and continues without the ShareX compiler', { skip: process.platform !== 'win32' }, async () => {
  const previous = process.env.WINDIR;
  process.env.WINDIR = new URL('../out/without-csc', import.meta.url).pathname.slice(1);
  try {
    const { default: config } = await import('../vite.config.js');
    const plugin = config.plugins.find(plugin => plugin.name === 'windows-capture-regions');
    const warnings = [];
    await plugin.generateBundle.call({
      warn: value => warnings.push(value),
      emitFile: () => assert.fail('cannot emit a helper without the compiler'),
    });
    assert.match(warnings.join('\n'), /capture regions.*csc\.exe/i);
  } finally {
    if (previous === undefined) delete process.env.WINDIR;
    else process.env.WINDIR = previous;
  }
});
