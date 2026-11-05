import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { restartWithSoftwareRendering } = createRequire(import.meta.url)('../electron/software-rendering.cjs');

function environment(t, hook, probe) {
  for (const [key, value] of Object.entries({ MDLXL_TEST_HOOK: hook, MDLXL_TEST_WEBGL_PROBE: probe })) {
    const previous = process.env[key];
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
}

function electron(usable = true, switches = []) {
  const calls = [];
  return {
    calls,
    app: {
      commandLine: { hasSwitch: name => switches.includes(name) },
      relaunch: options => calls.push(['relaunch', options]),
      exit: code => calls.push(['exit', code]),
    },
    WebContentsView: class {
      constructor(options) {
        calls.push(['probe', options]);
        this.webContents = {
          loadURL: async url => calls.push(['load', url]),
          executeJavaScript: async () => usable,
          close: () => calls.push(['close']),
        };
      }
    },
  };
}

for (const optIn of [undefined, '0', 'true']) {
  test(`automated test run skips the probe without explicit opt-in (${optIn})`, async t => {
    environment(t, '1', optIn);
    const api = electron(false);
    assert.equal(await restartWithSoftwareRendering(api, 'win32'), false);
    assert.deepEqual(api.calls, [], 'test startup must not create a transient page or relaunch');
  });
}

for (const hook of [undefined, '1']) {
  for (const usable of [true, false]) {
    test(`${hook ? 'opted-in test' : 'normal user'} probes WebGL (${usable ? 'usable' : 'unavailable'})`, async t => {
      environment(t, hook, hook ? '1' : undefined);
      const api = electron(usable);
      assert.equal(await restartWithSoftwareRendering(api, 'win32'), !usable);
      assert.deepEqual(api.calls.slice(0, 3), [
        ['probe', { webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } }],
        ['load', 'about:blank'], ['close'],
      ]);
      assert.deepEqual(api.calls.slice(3), usable ? [] : [
        ['relaunch', { args: [...process.argv.slice(1), '--use-angle=d3d11-warp'] }], ['exit', 0],
      ]);
    });
  }
}

for (const [platform, switches] of [['linux', []], ['win32', ['use-angle']], ['win32', ['use-gl']]]) {
  test(`opt-in preserves the existing bypass (${platform}, ${switches})`, async t => {
    environment(t, '1', '1');
    const api = electron(false, switches);
    assert.equal(await restartWithSoftwareRendering(api, platform), false);
    assert.deepEqual(api.calls, []);
  });
}
