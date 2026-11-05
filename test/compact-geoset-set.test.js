import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePreferences } from '../src/preferences.js';
import { BUILT_IN_VIEWPORT_PRESETS } from '../src/viewport-appearance.js';
import { exportConfiguration, importConfiguration } from '../src/portable-settings.js';
import { captureSelection, restoreSelection, validSelectionHistory } from '../src/selection-history.js';
import { createDemoDocument } from '../src/editor-document.js';

test('new and older profiles default to Compact Set with each preset color', () => {
  assert.equal(normalizePreferences().viewportAppearance.geosetSet?.style, 'compact');
  assert.equal(normalizePreferences().viewportAppearance.geosetSet.color, '#71b5f3');
  for (const preset of Object.values(BUILT_IN_VIEWPORT_PRESETS)) {
    assert.equal(preset.appearance.geosetSet.style, 'compact', preset.name);
    const old = structuredClone(preset.appearance); delete old.geosetSet;
    const migrated = normalizePreferences({ rendererRevision: 3, theme: preset.theme, viewportPreset: preset.id, viewportAppearance: old });
    assert.deepEqual(migrated.viewportAppearance.geosetSet, preset.appearance.geosetSet, preset.name);
    const custom = normalizePreferences({ viewportPresets: [{ id: `custom-${preset.id}`, name: `My ${preset.name}`, theme: preset.theme, appearance: old }] });
    assert.deepEqual(custom.viewportPresets[0].appearance.geosetSet, preset.appearance.geosetSet, preset.name + ' older custom preset');
  }
});

test('Classic Set and custom neon color survive settings export and normalization', () => {
  const prefs = normalizePreferences({ rendererRevision: 3, viewportAppearance: { geosetSet: { style: 'classic', color: '#E0457B' } } });
  assert.deepEqual(prefs.viewportAppearance.geosetSet, { style: 'classic', color: '#e0457b' });
  assert.deepEqual(importConfiguration(JSON.stringify(exportConfiguration(prefs))), prefs);
  assert.deepEqual(normalizePreferences({ viewportAppearance: { geosetSet: { style: 'other', color: 'invalid' } } }).viewportAppearance.geosetSet,
    { style: 'compact', color: '#71b5f3' });
});

test('Show Always is independent of selection and hidden geosets survive selection history', () => {
  const model = createDemoDocument().model;
  const state = { selectable: new Set([0]), selection: {}, activeGeoset: 0, uvSet: 0, visibleOnly: new Set([0, 1]), hiddenByUser: new Set([2, 99]) };
  const snapshot = captureSelection(state, model);
  assert.deepEqual(Array.from(snapshot.visibleOnly), [0, 1]);
  assert.deepEqual(Array.from(snapshot.hiddenByUser), [2]);
  assert.deepEqual(restoreSelection(snapshot, model), { ...state, hiddenByUser: new Set([2]) });
  assert.ok(validSelectionHistory({ version: 1, before: snapshot, after: snapshot }));
});
