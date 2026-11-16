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

// Static markup of the inline form: 879b6c8d before WP-3.8, updated for the
// Model dropdown (PR #461). Each hash covers every rendered byte, including
// labels, classes and hotkeys.
const before = [
  "bf0e6a063925688d7ccaf0d323a3d46edd67a088a138b607889ffb6c597d3958",
  "32d60215b515bd534422d0028164f1a99797ae65e92ec4d5872ac18b5f9720e3",
  "0ffa1c581e1c259cf63a192624ecdc16a21c7ad6af078b81e8e139db28b21092",
  "e3b338eb52e2ea4ce7ae5755e42367301fce45b59c611b82a1dd4466eb30ceb1",
  "f1e8972f056c64c68a0a46a0819f8c649f155f86cf4af551ea6a29245ee4d084",
  "e9743fd878a4d0cc1adcdaa4bfd54d6b400c14122dd94a53e88a2657ab2cfb4a",
  "517b5118f1a9390062721ab82d3b8c154990327f620ae504b3ede3c1432b6c99",
  "bf2de565fe9e7d813d49393b28af29a95f4bd92d45c20e5ee0e8893722128473",
  "34dc6d0d673be1f0a432ae359f7c2efd500e2dfd03ce36d42aef4b8641906e9d",
  "68a67076b6469e3b2ee8f66869f23213748ecccd9e359aa4e466352ff5467919",
  "b0f1a6030252f0f52f15b8f81f32bf1adb68fc71aa4afc878965b621b3a47582",
  "674f7587867160592c9f87fda6ffca84bad264fe8e1710bda32c59bdef86ef97",
  "568848573dea1757abac4b3ac860a415c784638977927e7c6ac79478a7c01aed",
  "a9118ad636e1a4f00d072502e338e9c001c4270e0bedb17767eaa6e05665bb3e",
  "927cf41e5b32244664604f75c7a5a5545df4058b04fda1230f8a51ddef4f8dc9",
  "d6a6a0fdd91df7c7491038f2f17ccfb9b8da2db3fb0625f4c13c72d105ebfac3",
  "a893dd370757330cb41f712f806df7478bbff51a81064e2edfa00160356827eb",
  "a3a3ed69f11e7b7f85e741e1825363b0264f2a4ccdc8d9b43e9cab8a867e6619",
  "421b488fee1d939ef970a9577f1014d2f152a4a1a99b637f302ee4bf0e14a827",
  "34bc1a001afc90dea60be4e27bd03a41b8531f49d8280854af34e389979f1d88"
];
const Component = await loadComponent(fileURLToPath(new URL('../app/AiConnectionSettings.jsx', import.meta.url)));
for (const [index, { name, props }] of cases.entries()) {
  test('connection settings remove only delegation controls: ' + name, () => {
    const html = markup(Component, props);
    assert.doesNotMatch(html, /Job routing|Lighter model|Allow lighter/);
    assert.equal(digest(html), before[index]);
  });
}
