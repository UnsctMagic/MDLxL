import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const providers = JSON.parse(readFileSync(new URL('../src/ai-providers.json', import.meta.url)));
const noop = () => {};
const cases = providers.flatMap(({ id }) => [0, 1, 2, 3].map(state => ({
  name: id + ' / ' + state,
  props: {
    settings: { provider: id, model: state ? 'chosen' : '', hasKey: state > 0,
      lighterModels: state ? [{ id: 'light', name: 'Light' }] : [], allowLighter: state === 2,
      baseUrl: state ? 'http://localhost:1234/v1' : '', effort: state === 2 ? 'xhigh' : '',
      spendLimit: state ? '12' : '', stepLimit: state ? '25' : '', cleanupDays: state ? '7' : '',
      executable: state ? 'provider.exe' : '', outsideCheck: state !== 2, routing: state === 2 ? 'automatic' : 'manual' },
    providers, models: [{ id: 'chosen', name: 'Chosen' }], authBusy: state === 3, anyBusy: state === 2,
    signedIn: state === 1 ? true : state === 2 ? false : null, apiKey: state ? 'draft-key' : '',
    setSettings: noop, saveSettings: noop, authenticate: noop, loadModels: noop,
    setApiKey: noop, changeProvider: noop, action: noop, setStatus: noop,
  },
})));
async function loadComponent(file) {
  const result = await build({ entryPoints: [file], bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external', logLevel: 'silent' });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
  return module.exports.default;
}
const markup = (Component, props) => renderToStaticMarkup(React.createElement(Component, props));
const digest = html => createHash('sha256').update(html).digest('hex');

// Static markup of the original inline form at 879b6c8d, before WP-3.8.
// Each hash covers every rendered byte, including labels, classes and hotkeys.
const before = [
  "de04257aa56da39f4922ba91d759666c49d8e4b31bad31e0bc5862cfbf28788d",
  "073b4c1db1faeeccc2e627afc237a11e7f90d17a0902df9d6c2f69715a73fe70",
  "8b8045af9170920f2515d05768fb06ae6d9b35dee78408f10721ecc16652bc15",
  "c6bdb3eec69b03de606b3219733206a06e73659de41428a3302d401321c86a7a",
  "a82655089c02c7260fedc06bb0d70dcd29b73aa87eae3ba13a2588f4372fda99",
  "96e40f5bd8830f84e33de2bec8fbea730b799fdd91c9aa97caa6e02d48e9d786",
  "1e88bff9f1afb1e5f2ecc21e0977f8fe0e78a8657964a90716a8bebe167feb74",
  "eed036253330b8b430a3ab5b25f7c44497a5ef0d98b90bdaa33463f49b9ddcb8",
  "ce54a5ccf72a58ee64ac3885af61ba01536356ab926cf18d3a8c9e3c3f7f1f27",
  "f1669930cb010254a32a2f31f96c0cdda4e99f7c950b07849e951051f22f9882",
  "34678462cfc7e180217ebb46fffc39f3711044cf8a083d50084caa04bd9530d2",
  "892fe313ea48abd58692fe65e2b07492b17bc12037abdfa3c2513c9d1ab74691",
  "6749ed04b5d0991740e03dc107f8976b0b26622681a7d2f25b74726270fe8bee",
  "04fae9a7556b104dbc0553910aac3cae4bbb3062559104ad5135d9a2f8b0d4cb",
  "99c88e48ae57f3faa37c73314cbe0c9e5d18785ccc4b2a0827f6f57c51509f8e",
  "6bad51dc33a36e122362d47b79c39925e4bd1c26cb6f4aec6356d8930f67c11a",
  "d7a18087302d22a38b75e5f4effa9a6f95551df8f5138b2433cc3e0827adbf61",
  "c76c7f83fd87adf018c413e32b0082707c7fa62f60162930c1b641e811214109",
  "976c6095132a6daa3a269a046584dd59648ab9c4d9fe468f9e3a186522681a6f",
  "38688efeec728e43a157ba38210c5de10481640d9c2338285bc1160a027943fd"
];
const Component = await loadComponent(fileURLToPath(new URL('../app/AiConnectionSettings.jsx', import.meta.url)));
for (const [index, { name, props }] of cases.entries()) {
  test('connection settings preserve the inline markup: ' + name, () => {
    assert.equal(digest(markup(Component, props)), before[index]);
  });
}
