import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePreferences } from '../src/preferences.js';
import { exportConfiguration, importConfiguration } from '../src/portable-settings.js';
import { BUILT_IN_VIEWPORT_PRESETS as presets } from '../src/viewport-appearance.js';
import { LIGHT_DARK_PARTNERS, lightDarkChange, themeScheme, viewportPresetChange } from '../src/light-dark-switch.js';
import { COMMANDS } from '../src/commands.js';

const load = id => normalizePreferences({ ...normalizePreferences({}), ...viewportPresetChange(normalizePreferences({}), id) });
const press = (prefs, scheme) => normalizePreferences({ ...prefs, ...lightDarkChange(prefs, scheme) });

test('Shift+F1 and Shift+F2 are the Photoshop darker / lighter interface keys', () => {
  assert.deepEqual(COMMANDS.find(action => action.id === 'theme:dark').defaultKeys, ['Shift+F1']);
  assert.deepEqual(COMMANDS.find(action => action.id === 'theme:light').defaultKeys, ['Shift+F2']);
});

test('every built-in look has a counterpart on the other side', () => {
  for (const preset of Object.values(presets)) {
    const partner = presets[LIGHT_DARK_PARTNERS[preset.id]];
    assert.ok(partner, preset.id);
    assert.notEqual(themeScheme(partner.theme), themeScheme(preset.theme), preset.id);
  }
  assert.equal(press(load('mdlvis-vanilla'), 'dark').viewportPreset, 'blender-style');
  assert.equal(press(load('blender-style'), 'light').viewportPreset, 'mdlvis-vanilla');
  assert.equal(press(load('solarized-light'), 'dark').viewportPreset, 'warm-graphite');
});

test('switching loads the counterpart exactly as Settings › Appearance would', () => {
  const dark = press(load('mdlvis-vanilla'), 'dark'), picked = load('blender-style');
  for (const key of ['theme', 'accent', 'viewportPreset', 'viewportAppearance', 'visuals', 'citadelPaint']) assert.deepEqual(dark[key], picked[key], key);
});

test('pressing the side already shown does nothing', () => {
  assert.equal(lightDarkChange(load('nord'), 'dark'), null);
  assert.equal(lightDarkChange(load('mdlvis-vanilla'), 'light'), null);
});

test('switching back restores the chosen look, customizations included', () => {
  const start = load('gruvbox-dark');
  const custom = normalizePreferences({ ...start, viewportPreset: 'custom', accent: '#123456', viewportAppearance: { ...start.viewportAppearance, background: { ...start.viewportAppearance.background, color: '#102030' } } });
  const light = press(custom, 'light');
  assert.equal(light.viewportPreset, 'solarized-light');
  const back = press(light, 'dark');
  for (const key of ['theme', 'accent', 'viewportPreset', 'viewportAppearance', 'visuals', 'citadelPaint']) assert.deepEqual(back[key], custom[key], key);
  // ...and going light again returns to Silvermoon, not to some other light look.
  assert.equal(press(back, 'light').viewportPreset, 'solarized-light');
});

test('the remembered look survives saving, export and import', () => {
  const light = press(load('catppuccin-mocha'), 'light');
  const reloaded = normalizePreferences(JSON.parse(JSON.stringify(light)));
  assert.deepEqual(reloaded.lightDarkReturn, light.lightDarkReturn);
  assert.equal(press(reloaded, 'dark').viewportPreset, 'catppuccin-mocha');
  assert.deepEqual(importConfiguration(JSON.stringify(exportConfiguration(light))).lightDarkReturn, light.lightDarkReturn);
  assert.equal(normalizePreferences({ lightDarkReturn: { theme: 'nope' } }).lightDarkReturn, null);
});
