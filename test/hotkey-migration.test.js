import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { COMMANDS } from '../src/commands.js';
import { effectiveBindings, normalizePreferences } from '../src/preferences.js';
import { contextualHotkeyDefaults, migrateHotkeyBindings, migrateHotkeyId } from '../src/hotkey-defaults.js';
import { exportConfiguration, importConfiguration } from '../src/portable-settings.js';
import { loadAddons, validateAddon } from '../src/addons.js';
import { tempDir } from './helpers/fixtures.cjs';

const require = createRequire(import.meta.url);
const { SettingsStore } = require('../electron/settings.cjs');

// Up to 0.24.0 the Hotkeys feature was internally named "WarmKeys"; these are
// IDs and saved data exactly as that release wrote them.
const LEGACY = 'warmkeys';
const legacyHotkeys = {
  [LEGACY]: ['Ctrl+Shift+K'],
  [`tab:${LEGACY}`]: ['Ctrl+Alt+Space > Q1Z'],
  [`${LEGACY}:search`]: ['alt+f'],
  [`${LEGACY}:reset-all`]: [],
  [`Close model tab?:${LEGACY}`]: ['Ctrl+Alt+Space > 7Y9'],
  [`resource:Materials:${LEGACY}`]: ['Shift+F9'],
  open: ['Alt+O'],
  save: [],
  'resource:Materials:material:0:layer:0:Alpha': ['Ctrl+Alt+Space > B00'],
};
const migrated = {
  hotkeys: ['Ctrl+Shift+K'],
  'tab:hotkeys': ['Ctrl+Alt+Space > Q1Z'],
  'hotkeys:search': ['Alt+F'],
  'hotkeys:reset-all': [],
  'Close model tab?:hotkeys': ['Ctrl+Alt+Space > 7Y9'],
  'resource:Materials:hotkeys': ['Shift+F9'],
  open: ['Alt+O'],
  save: [],
  'resource:Materials:material:0:layer:0:Alpha': ['Ctrl+Alt+Space > B00'],
};

test('pre-rename IDs migrate one way and only whole "warmkeys" ID segments change', () => {
  assert.equal(migrateHotkeyId(LEGACY), 'hotkeys');
  assert.equal(migrateHotkeyId(`tab:${LEGACY}`), 'tab:hotkeys');
  assert.equal(migrateHotkeyId(`Close model tab?:${LEGACY}`), 'Close model tab?:hotkeys');
  for (const id of ['hotkeys', 'tab:hotkeys', `${LEGACY}x`, `x${LEGACY}:a`, 'Warm gray', 'tab:mouse', '']) assert.equal(migrateHotkeyId(id), id);
  assert.equal(migrateHotkeyId(undefined), undefined);
  const unchanged = { open: ['Alt+O'] };
  assert.equal(migrateHotkeyBindings(unchanged), unchanged, 'profiles without old IDs are passed through untouched');
  // An assignment already saved under the new ID wins over a stale old one.
  assert.deepEqual(migrateHotkeyBindings({ [LEGACY]: ['Ctrl+1'], hotkeys: ['Ctrl+2'] }), { hotkeys: ['Ctrl+2'] });
  assert.deepEqual(migrateHotkeyBindings({ hotkeys: ['Ctrl+2'], [LEGACY]: ['Ctrl+1'] }), { hotkeys: ['Ctrl+2'] });
});

test('0.24.0 preferences with custom hotkeys load under the new IDs with the same meaning, round-trip and lose nothing', () => {
  const old = { theme: 'warm-dark', scrollSensitivity: 3.2, rendererRevision: 3, hotkeys: legacyHotkeys };
  const prefs = normalizePreferences(old);
  assert.deepEqual(prefs.hotkeys, migrated);
  assert.equal(Object.keys(prefs.hotkeys).length, Object.keys(legacyHotkeys).length, 'no assignment lost');
  assert.equal(prefs.theme, 'warm-dark'); assert.equal(prefs.scrollSensitivity, 3.2);
  assert.ok(!JSON.stringify(prefs).includes(LEGACY), 'saving writes only the new names');
  assert.deepEqual(normalizePreferences(prefs), prefs, 'round-trip is stable');
  assert.deepEqual(normalizePreferences(JSON.parse(JSON.stringify(prefs))), prefs);
  // Same meaning: the Keyboard Shortcuts command keeps the user's key and loses its default.
  const bindings = effectiveBindings(COMMANDS, prefs.hotkeys);
  assert.deepEqual(bindings.hotkeys, ['Ctrl+Shift+K']);
  assert.deepEqual(effectiveBindings(COMMANDS, {}).hotkeys, ['Ctrl+K']);
  assert.deepEqual(bindings.save, []);
  assert.deepEqual(bindings['hotkeys:search'], ['Alt+F']);
  assert.ok(!Object.keys(bindings).some(id => id.includes(LEGACY)));
});

test('a 0.24.0 configuration export still imports and re-exports under the new IDs', () => {
  const legacyExport = JSON.stringify({ schema: 'mdlxl-configuration', version: 1, preferences: { ...normalizePreferences(), hotkeys: Object.fromEntries(Object.entries(legacyHotkeys).map(([id, keys]) => [id, keys.map(key => key === 'alt+f' ? 'Alt+F' : key)])) } });
  const imported = importConfiguration(legacyExport);
  assert.deepEqual(imported.hotkeys, migrated);
  assert.deepEqual(importConfiguration(exportConfiguration(imported)).hotkeys, migrated);
  assert.ok(!JSON.stringify(exportConfiguration(imported)).includes(LEGACY));
});

test('a 0.24.0 desktop settings file keeps its custom hotkeys and the next save writes only the new IDs', async t => {
  const folder = tempDir('mdlxl-hotkey-migration-');
  t.after(() => fs.rm(folder, { recursive: true, force: true }));
  const file = path.join(folder, 'settings.json');
  await fs.writeFile(file, JSON.stringify({ historyMaxSteps: 12000, preferences: { ...normalizePreferences(), scrollSensitivity: 3.2, hotkeys: legacyHotkeys } }));
  const store = new SettingsStore(file, normalizePreferences);
  await store.load();
  assert.deepEqual(store.settings.preferences.hotkeys, migrated);
  await store.configure({ preferences: { scrollSensitivity: 4 } });
  const written = await fs.readFile(file, 'utf8');
  assert.ok(!written.includes(LEGACY));
  const reopened = new SettingsStore(file, normalizePreferences);
  await reopened.load();
  assert.deepEqual(reopened.settings.preferences.hotkeys, migrated);
  assert.equal(reopened.settings.preferences.scrollSensitivity, 4);
  assert.equal(reopened.settings.historyMaxSteps, 12000);
});

test('installed add-ons and manifests naming the old Keyboard Shortcuts command keep working', () => {
  const manifest = { schema: 'mdlxl-addon', apiVersion: 1, id: 'keys', name: 'Keys', actions: [{ id: 'open-keys', label: 'Keys', command: LEGACY }, { id: 'save', label: 'Save', command: 'save' }] };
  assert.deepEqual(validateAddon(manifest).actions.map(action => action.command), ['hotkeys', 'save']);
  const saved = loadAddons(JSON.stringify([{ ...manifest, enabled: true }]));
  assert.equal(saved[0].enabled, true);
  assert.deepEqual(saved[0].actions.map(action => action.command), ['hotkeys', 'save']);
  assert.ok(!JSON.stringify(saved).includes(LEGACY));
  assert.throws(() => validateAddon({ ...manifest, actions: [{ id: 'x', label: 'X', command: `${LEGACY}x` }] }), /Unknown editor command/);
});

test('controls saved with a generated code by older versions get a short key once seen on screen', () => {
  const saved = { id: migrateHotkeyId('warmkeys:search'), label: 'Search Hotkeys', contextual: true, defaultCode: 'JJE', defaultKeys: [] };
  assert.deepEqual(contextualHotkeyDefaults([...COMMANDS, saved]).find(action => action.id === 'hotkeys:search').defaultKeys, [], 'not seen yet: no window, no key');
  const seen = contextualHotkeyDefaults([...COMMANDS, { ...saved, group: 'settings' }]).find(action => action.id === 'hotkeys:search');
  assert.deepEqual(seen.defaultKeys, ['S']);
  assert.equal(seen.defaultCode, undefined);
});
