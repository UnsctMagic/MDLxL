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
  "0850ce0a6ea23d44cb368a30be22cc422a91571ce3f48c9819618668697d561d",
  "b0a510baab3dfef8a3f80713e0b01004bf4d3bee879626d35af5428b257d9da0",
  "e0d8b5f2c85d1eb28a90885f1e6b3f27274454797935451002a285daa6446910",
  "c620e17f89d2c96ecf75244ede2db503be8578ac69ffc2818d0e273a14a98c1f",
  "6b866658b77033eabd81e98bc69e87ffd78b437fd402929e3f7c2fcd7176609d",
  "07768e1a0cb59bbba60432d5193d473c3e249408bd3c91f048c95e1d2a9282c7",
  "7fa9acb624c2bdc1f89f060da065129311b1f6860a4d661573af26e8068f726d",
  "a39ffb19b700d4b778ea7ba998b2e6e995d218e0af901720da7d196204f047bf",
  "f3aec22bbb0423705b14058513b1fcc43f025e49dfea380e20a10fe411bd60bb",
  "54384660192f2c212432a3262ca9c67baa6ea33d944e8ffcdb16c68f683804ff",
  "0a2b3a460ae6710cdd54a1c2bc3ada4ae2b84c1e8a9d5df986c07447928df55d",
  "a9c32d2df39979e01f832e9be72fcb4b2ed5ac1f00ef0b2625eadf9f1abbed65",
  "d1d0d3056932f299a35fddce3630e50841c95bd9a6019cc0ecc765bb390bd37c",
  "2be472c529c49d2e262521e5941fe6b74808c3970c6213d67cdd621ba6a4704e",
  "2c48bdacd8272dad5b055665a72186a958226b5ccb6335cdc1a636bd365765e0",
  "b17d443d189a1c07f278af419e5f8a675346b83e93451aeaf8b9810f994ba916",
  "941fc6fea44f717a892d6fd477c55cab88f45af773bb0613bf09cfed643a4f4b",
  "c977c47c769680c730e38b0d8e5b1fb04e53bd4d29210d2ec7b961e3458fb6a3",
  "ad9acaa077687efb427fe1c14e703c3d492b84a64085098721f9e65911c0058e",
  "f750f1a38b1e9a0144c0ff0eb915455ed3d38a6d76406f5544921d12d425eb7a"
];
const Component = await loadComponent(fileURLToPath(new URL('../app/AiConnectionSettings.jsx', import.meta.url)));
for (const [index, { name, props }] of cases.entries()) {
  test('connection settings preserve the inline markup: ' + name, () => {
    assert.equal(digest(markup(Component, props)), before[index]);
  });
}
